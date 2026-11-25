import type { Request, Response, NextFunction } from 'express';
import { Particular } from '../models/Particular';
import { AccountLedger } from '../models/AccountLedger';
import { escapeRegex, recalculateCustomerBalance, getParticularNetTotal } from '../utils/ledgerUtils';
import { isCloudinaryConfigured, uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { consumeBillAgainstPerforma, reverseBillConsumption } from '../services/performaConsumptionService';

function parseBillTimestamp(b: any): number {
  if (b.date) {
    const raw = String(b.date).trim();
    const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const ts = new Date(year, month, day).getTime();
      if (!isNaN(ts)) return ts;
    }
    const parsed = new Date(raw).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  if (b.createdAt) {
    const created = new Date(b.createdAt).getTime();
    if (!isNaN(created)) return created;
  }
  return 0;
}

function parseBillNumber(billNo: any): number {
  if (!billNo) return 0;
  const match = String(billNo).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export const getParticulars = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName } = req.query;
    const filter: any = {};
    if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      const trimmed = customerName.trim();
      const cleanDigits = trimmed.replace(/[^0-9]/g, '');
      let targetName = trimmed;
      if (cleanDigits.length >= 7) {
        const { Customer } = await import('../models/Customer');
        const matchedCust = await Customer.findOne({ mobile: { $regex: cleanDigits, $options: 'i' } });
        if (matchedCust) {
          targetName = matchedCust.name;
        }
      }
      filter.customerName = { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') };
    }

    const particulars = await Particular.find(filter).sort({ createdAt: -1, _id: -1 }).lean();

    // Use unified pending cases calculation to guarantee exact synchronization with Pending Cases dashboard
    const { calculatePendingCasesData } = await import('../services/performaConsumptionService');
    const { customerTotalCasesMap, customerPendingMap, customerDeliveredMap, performaPendingMap } = await calculatePendingCasesData();

    // Group bills by customer to track chronological running delivered and running pending cases per bill
    const billsByCustomer = new Map<string, any[]>();
    for (const b of particulars) {
      const cKey = (b.customerName || '').trim().toLowerCase();
      if (!billsByCustomer.has(cKey)) {
        billsByCustomer.set(cKey, []);
      }
      billsByCustomer.get(cKey)!.push(b);
    }

    // Map each bill to its historical chronological snapshot (so previous bills never change when new bills are added)
    const billMetricsMap = new Map<string, { totalCustCases: number; deliveredSoFar: number; pendingAfterThisBill: number }>();

    for (const [cKey, custBills] of billsByCustomer.entries()) {
      let totalCustCases = 0;
      if (customerTotalCasesMap?.has(cKey)) {
        totalCustCases = customerTotalCasesMap.get(cKey) || 0;
      } else {
        for (const [key, val] of customerTotalCasesMap.entries()) {
          if (key.length > 2 && (cKey.includes(key) || key.includes(cKey))) {
            totalCustCases = val;
            break;
          }
        }
      }

      // Sort customer bills chronologically (oldest first)
      custBills.sort((a, b) => {
        const timeA = parseBillTimestamp(a);
        const timeB = parseBillTimestamp(b);
        if (timeA !== timeB && timeA > 0 && timeB > 0) {
          return timeA - timeB;
        }
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createdA !== createdB) {
          return createdA - createdB;
        }
        const numA = parseBillNumber(a.billNo);
        const numB = parseBillNumber(b.billNo);
        if (numA !== numB) {
          return numA - numB;
        }
        return String(a._id).localeCompare(String(b._id));
      });

      let runningDelivered = 0;
      for (const bill of custBills) {
        const thisBillCases = (bill.caseCount && bill.caseCount !== '0')
          ? (parseFloat(bill.caseCount) || 0)
          : (bill.products || []).reduce((sum: number, pr: any) => sum + (parseFloat(pr.quantity) || 0), 0);

        runningDelivered += thisBillCases;

        const billTotalCust = (bill.totalCustomerCases && bill.totalCustomerCases > 0)
          ? bill.totalCustomerCases
          : totalCustCases;

        let pendingAfterThis = 0;
        if (billTotalCust > 0) {
          pendingAfterThis = Math.max(0, billTotalCust - runningDelivered);
        } else if (bill.pendingCaseCount !== undefined && bill.pendingCaseCount !== null) {
          pendingAfterThis = Number(bill.pendingCaseCount) || 0;
        }

        billMetricsMap.set(String(bill._id), {
          totalCustCases: billTotalCust,
          deliveredSoFar: runningDelivered,
          pendingAfterThisBill: pendingAfterThis,
        });
      }
    }

    const { Customer } = await import('../models/Customer');
    const allCustomers = await Customer.find({}, 'name mobile').lean();
    const customerPhoneMap = new Map<string, string>();
    for (const c of allCustomers) {
      if (c.name && c.mobile) {
        customerPhoneMap.set(c.name.trim().toLowerCase(), c.mobile.trim());
      }
    }

    const enriched = particulars.map((p: any) => {
      const pCustName = (p.customerName || '').trim();
      const pCustKey = pCustName.toLowerCase();
      const pCleanDigits = pCustName.replace(/[^0-9]/g, '');
      const pPfNum = (p.performaNumber || '').trim().toUpperCase();
      const pPfId = p.performaId ? String(p.performaId).trim() : '';

      let totalCustCases = 0;
      let delivered = 0;
      let pending = 0;

      // 1. Direct customer total cases match
      if (customerTotalCasesMap?.has(pCustKey)) {
        totalCustCases = customerTotalCasesMap.get(pCustKey) || 0;
      } else if (customerTotalCasesMap && pCleanDigits.length >= 7 && customerTotalCasesMap.has(pCleanDigits)) {
        totalCustCases = customerTotalCasesMap.get(pCleanDigits) || 0;
      } else if (customerTotalCasesMap && p.customerId && customerTotalCasesMap.has(String(p.customerId))) {
        totalCustCases = customerTotalCasesMap.get(String(p.customerId)) || 0;
      }

      // 2. Direct customer delivered / out cases match
      if (customerDeliveredMap?.has(pCustKey)) {
        delivered = customerDeliveredMap.get(pCustKey) || 0;
      } else if (customerDeliveredMap && pCleanDigits.length >= 7 && customerDeliveredMap.has(pCleanDigits)) {
        delivered = customerDeliveredMap.get(pCleanDigits) || 0;
      } else if (customerDeliveredMap && p.customerId && customerDeliveredMap.has(String(p.customerId))) {
        delivered = customerDeliveredMap.get(String(p.customerId)) || 0;
      }

      // 3. Direct customer pending cases match
      if (customerPendingMap.has(pCustKey)) {
        pending = customerPendingMap.get(pCustKey) || 0;
      } else if (pCleanDigits.length >= 7 && customerPendingMap.has(pCleanDigits)) {
        pending = customerPendingMap.get(pCleanDigits) || 0;
      } else if (p.customerId && customerPendingMap.has(String(p.customerId))) {
        pending = customerPendingMap.get(String(p.customerId)) || 0;
      } else {
        for (const [key, val] of customerPendingMap.entries()) {
          if (key.length > 2 && (pCustKey.includes(key) || key.includes(pCustKey))) {
            pending = val;
            if (customerTotalCasesMap?.has(key)) totalCustCases = customerTotalCasesMap.get(key) || 0;
            if (customerDeliveredMap?.has(key)) delivered = customerDeliveredMap.get(key) || 0;
            break;
          }
        }
      }

      // Fallback to performa pending map if linked performa still has remaining cases
      if (pending === 0 && totalCustCases === 0) {
        if (pPfNum && performaPendingMap.has(pPfNum)) {
          pending = performaPendingMap.get(pPfNum) || 0;
        } else if (pPfId && performaPendingMap.has(pPfId)) {
          pending = performaPendingMap.get(pPfId) || 0;
        }
      }

      const computedBillCases = (p.caseCount && p.caseCount !== '0')
        ? p.caseCount
        : (p.products || []).reduce((sum: number, pr: any) => sum + (parseFloat(pr.quantity) || 0), 0).toString();

      // Retrieve this bill's chronological snapshot from billMetricsMap
      const metrics = billMetricsMap.get(String(p._id));
      const finalTotalCases = metrics?.totalCustCases ?? totalCustCases;
      const finalDeliveredSoFar = metrics?.deliveredSoFar ?? delivered;
      const finalPendingAfterThis = metrics?.pendingAfterThisBill ?? (finalTotalCases > 0 ? Math.max(0, finalTotalCases - finalDeliveredSoFar) : pending);

      const rawPhone = p.phone && p.phone !== '+91 98765 43210' ? p.phone : '';
      const finalPhone = rawPhone || customerPhoneMap.get(pCustKey) || '';
      const rawPreparedBy = p.preparedBy && p.preparedBy !== 'S.Nagaraj' && p.preparedBy !== 'Nagaraj' ? p.preparedBy : '';

      return {
        ...p,
        phone: finalPhone,
        preparedBy: rawPreparedBy,
        caseCount: computedBillCases,
        totalCustomerCases: finalTotalCases,
        deliveredCaseCount: finalDeliveredSoFar,
        pendingCaseCount: finalPendingAfterThis,
      };
    });

    res.status(200).json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    next(error);
  }
};

export const getParticularById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const particular = await Particular.findById(req.params.id);
    if (!particular) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }
    res.status(200).json({ success: true, data: particular });
  } catch (error) {
    next(error);
  }
};

export const getNextBillNo = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allParticulars = await Particular.find({}, 'billNo');
    let maxNum = 0;
    for (const p of allParticulars) {
      if (p.billNo) {
        const match = p.billNo.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    const nextBillNo = (maxNum + 1).toString().padStart(4, '0');
    res.status(200).json({ success: true, data: { nextBillNo } });
  } catch (error) {
    next(error);
  }
};

export const createParticular = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.headers['x-user-role'] === 'user') {
      res.status(403).json({ success: false, error: 'Access denied. Customers are not allowed to create bills.' });
      return;
    }
    const {
      customerName,
      phone,
      preparedBy,
      caseCount,
      companyName,
      discount,
      transport,
      packing,
      billNo,
      tax,
      amount,
      total,
      date,
      products,
      performaId,
      performaNumber,
    } = req.body;

    let finalPhone = phone && phone !== '+91 98765 43210' ? String(phone).trim() : '';
    if (!finalPhone && customerName) {
      const { Customer } = await import('../models/Customer');
      const matchedCust = await Customer.findOne({ name: { $regex: new RegExp(`^${escapeRegex(String(customerName).trim())}$`, 'i') } });
      if (matchedCust?.mobile) {
        finalPhone = matchedCust.mobile.trim();
      }
    }

    const cleanPreparedBy = preparedBy && preparedBy !== 'S.Nagaraj' && preparedBy !== 'Nagaraj' ? String(preparedBy).trim() : '';

    let finalBillNo = billNo ? String(billNo).trim() : '';
    if (!finalBillNo) {
      const allParticulars = await Particular.find({}, 'billNo');
      let maxNum = 0;
      for (const p of allParticulars) {
        if (p.billNo) {
          const match = p.billNo.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
      finalBillNo = (maxNum + 1).toString().padStart(4, '0');
    }

    // Chronological cases snapshot for this specific bill
    let totalCustCases = 0;
    try {
      const { calculatePendingCasesData } = await import('../services/performaConsumptionService');
      const { customerTotalCasesMap } = await calculatePendingCasesData();
      const cKey = String(customerName || '').trim().toLowerCase();
      if (customerTotalCasesMap?.has(cKey)) {
        totalCustCases = customerTotalCasesMap.get(cKey) || 0;
      } else {
        for (const [k, v] of customerTotalCasesMap.entries()) {
          if (k.length > 2 && (cKey.includes(k) || k.includes(cKey))) {
            totalCustCases = v;
            break;
          }
        }
      }
    } catch (e) {
      console.error('[createParticular total cases lookup error]:', e);
    }

    const prevCustBills = await Particular.find({
      customerName: { $regex: new RegExp(`^${escapeRegex(String(customerName || '').trim())}$`, 'i') },
    }).lean();

    const prevDelivered = prevCustBills.reduce((sum, b) => {
      const bCases = (b.caseCount && b.caseCount !== '0')
        ? (parseFloat(b.caseCount) || 0)
        : (b.products || []).reduce((s: number, pr: any) => s + (parseFloat(pr.quantity) || 0), 0);
      return sum + bCases;
    }, 0);

    const thisBillCases = (caseCount && caseCount !== '0')
      ? (parseFloat(caseCount) || 0)
      : (products || []).reduce((s: number, pr: any) => s + (parseFloat(pr.quantity) || 0), 0);

    const cumulativeDelivered = prevDelivered + thisBillCases;
    const pendingCases = totalCustCases > 0 ? Math.max(0, totalCustCases - cumulativeDelivered) : 0;

    const particular = await Particular.create({
      customerName: customerName || 'General',
      phone: finalPhone,
      preparedBy: cleanPreparedBy,
      caseCount: caseCount || '0',
      companyName: companyName ? String(companyName).trim() : '',
      discount: discount || '0',
      transport: transport || '-',
      packing: packing || '0',
      billNo: finalBillNo,
      tax: tax || '0',
      amount: amount || total || '0.00',
      total: total || amount || '0.00',
      date: date || new Date().toISOString().split('T')[0],
      products: products || [],
      performaId: performaId || null,
      performaNumber: performaNumber || '',
      totalCustomerCases: totalCustCases,
      deliveredCaseCount: cumulativeDelivered,
      pendingCaseCount: pendingCases,
    });

    // Automatically log to Account Ledger using Net Total
    const billTotalNum = getParticularNetTotal(particular);
    if (billTotalNum > 0) {
      await AccountLedger.create({
        particularId: String(particular._id),
        billNo: particular.billNo,
        customerName: particular.customerName,
        date: particular.date,
        companyName: particular.companyName,
        debit: billTotalNum.toFixed(2),
        credit: '0.00',
        balance: '0.00',
        type: 'BILL',
      });

      await recalculateCustomerBalance(particular.customerName);
    }

    // Automatically consume against active Performa if available
    try {
      const consumptionResult = await consumeBillAgainstPerforma(
        String(particular._id),
        particular.billNo,
        particular.customerName,
        particular.date,
        particular.products,
        billTotalNum
      );
      if (consumptionResult.consumed && consumptionResult.items.length > 0) {
        const matchedItem = consumptionResult.items[0];
        if (!particular.performaNumber && matchedItem.performaNumber) {
          particular.performaNumber = matchedItem.performaNumber;
          particular.performaId = matchedItem.performaId as any;
          await particular.save();
        }
      }
    } catch (consumeErr) {
      console.error('[Performa Consumption on createParticular Error]:', consumeErr);
    }

    res.status(201).json({
      success: true,
      data: particular,
    });
  } catch (error) {
    next(error);
  }
};

export const updateParticular = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.headers['x-user-role'] === 'user') {
      res.status(403).json({ success: false, error: 'Access denied. Customers are not allowed to edit bills.' });
      return;
    }
    const { id } = req.params;
    const existing = await Particular.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }

    // 1. Reverse previous performa consumption
    try {
      await reverseBillConsumption(String(id));
    } catch (revErr) {
      console.error('[Performa Reversal on updateParticular Error]:', revErr);
    }

    const oldCustomerName = existing.customerName;

    const {
      customerName,
      caseCount,
      companyName,
      discount,
      transport,
      packing,
      billNo,
      tax,
      amount,
      total,
      date,
      products,
      performaId,
      performaNumber,
      totalCustomerCases,
      deliveredCaseCount,
      pendingCaseCount,
    } = req.body;

    const updatedParticular = await Particular.findByIdAndUpdate(
      id,
      {
        ...(customerName !== undefined && { customerName }),
        ...(caseCount !== undefined && { caseCount }),
        ...(companyName !== undefined && { companyName }),
        ...(discount !== undefined && { discount }),
        ...(transport !== undefined && { transport }),
        ...(packing !== undefined && { packing }),
        ...(billNo !== undefined && { billNo: String(billNo).trim() }),
        ...(tax !== undefined && { tax }),
        ...(amount !== undefined && { amount }),
        ...(total !== undefined && { total }),
        ...(date !== undefined && { date }),
        ...(products !== undefined && { products }),
        ...(performaId !== undefined && { performaId }),
        ...(performaNumber !== undefined && { performaNumber }),
        ...(totalCustomerCases !== undefined && { totalCustomerCases }),
        ...(deliveredCaseCount !== undefined && { deliveredCaseCount }),
        ...(pendingCaseCount !== undefined && { pendingCaseCount }),
      },
      { new: true, runValidators: true }
    );

    if (!updatedParticular) {
      res.status(404).json({ success: false, error: 'Failed to update particular bill' });
      return;
    }

    // Update AccountLedger entry with Net Total
    const billTotalNum = getParticularNetTotal(updatedParticular);
    
    // Find or update AccountLedger
    const ledgerEntry = await AccountLedger.findOne({
      $or: [
        { particularId: String(id) },
        { particularId: String(existing._id) },
        ...(existing.billNo ? [{ billNo: String(existing.billNo).trim() }] : []),
      ],
    });

    if (ledgerEntry) {
      ledgerEntry.customerName = updatedParticular.customerName;
      ledgerEntry.companyName = updatedParticular.companyName;
      ledgerEntry.date = updatedParticular.date;
      ledgerEntry.billNo = updatedParticular.billNo;
      ledgerEntry.debit = billTotalNum.toFixed(2);
      await ledgerEntry.save();
    } else if (billTotalNum > 0) {
      await AccountLedger.create({
        particularId: String(updatedParticular._id),
        billNo: updatedParticular.billNo,
        customerName: updatedParticular.customerName,
        date: updatedParticular.date,
        companyName: updatedParticular.companyName,
        debit: billTotalNum.toFixed(2),
        credit: '0.00',
        balance: '0.00',
        type: 'BILL',
      });
    }

    // Recalculate balances
    if (oldCustomerName && oldCustomerName !== updatedParticular.customerName) {
      await recalculateCustomerBalance(oldCustomerName);
    }
    await recalculateCustomerBalance(updatedParticular.customerName);

    // Re-consume updated bill against Performa
    try {
      await consumeBillAgainstPerforma(
        String(updatedParticular._id),
        updatedParticular.billNo,
        updatedParticular.customerName,
        updatedParticular.date,
        updatedParticular.products,
        billTotalNum
      );
    } catch (consumeErr) {
      console.error('[Performa Consumption on updateParticular Error]:', consumeErr);
    }

    res.status(200).json({
      success: true,
      data: updatedParticular,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteParticular = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.headers['x-user-role'] === 'user') {
      res.status(403).json({ success: false, error: 'Access denied. Customers are not allowed to delete bills.' });
      return;
    }
    const particular = await Particular.findById(req.params.id);
    if (!particular) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }

    const customerName = particular.customerName;

    // 1. Reverse performa consumption
    try {
      await reverseBillConsumption(String(req.params.id));
    } catch (revErr) {
      console.error('[Performa Reversal on deleteParticular Error]:', revErr);
    }

    // 2. Delete associated Cloudinary asset if present
    if (particular.pdfPublicId && isCloudinaryConfigured()) {
      await deleteFromCloudinary(particular.pdfPublicId);
    }

    // 2. Delete Particular Document
    await Particular.findByIdAndDelete(req.params.id);

    // 3. Cascade Delete: Delete matching AccountLedger entry comprehensively
    const orConditions: any[] = [
      { particularId: String(req.params.id) },
      { particularId: String(particular._id) },
    ];
    if (particular.billNo && String(particular.billNo).trim() !== '') {
      orConditions.push({ billNo: String(particular.billNo).trim() });
    }
    if (particular.customerName && particular.date) {
      const matchCond: any = {
        customerName: { $regex: new RegExp(`^${escapeRegex(particular.customerName.trim())}$`, 'i') },
        date: particular.date,
        type: 'BILL',
      };
      if (particular.companyName && particular.companyName.trim() !== '') {
        matchCond.companyName = { $regex: new RegExp(`^${escapeRegex(particular.companyName.trim())}$`, 'i') };
      }
      orConditions.push(matchCond);
    }

    await AccountLedger.deleteMany({ $or: orConditions });

    // 4. Recalculate balance for this customer
    await recalculateCustomerBalance(customerName);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const uploadParticularPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.headers['x-user-role'] === 'user') {
      res.status(403).json({ success: false, error: 'Access denied. Customers are not allowed to upload documents.' });
      return;
    }
    const { id } = req.params;
    const { pdfData, pdfName } = req.body;

    if (!pdfData) {
      res.status(400).json({ success: false, error: 'Document data is required' });
      return;
    }

    const existingParticular = await Particular.findById(id);
    if (!existingParticular) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }

    let savedUrl = pdfData;
    let publicId = '';

    if (isCloudinaryConfigured()) {
      try {
        if (existingParticular.pdfPublicId) {
          await deleteFromCloudinary(existingParticular.pdfPublicId);
        }

        const cloudRes = await uploadToCloudinary(
          pdfData,
          'gpk_crackers/bills',
          pdfName || `Bill-${existingParticular.billNo || 'receipt'}`
        );

        savedUrl = cloudRes.secure_url;
        publicId = cloudRes.public_id;
        console.log(`[Cloudinary Success] Uploaded: ${savedUrl}`);
      } catch (cloudErr) {
        console.warn('[Cloudinary Warning] Falling back to direct database storage:', cloudErr);
        savedUrl = pdfData;
      }
    } else {
      console.log('[Storage] Storing document directly in database (Cloudinary not configured)');
    }

    existingParticular.pdfData = savedUrl;
    existingParticular.pdfName = pdfName || 'transport-receipt';
    existingParticular.pdfPublicId = publicId;
    await existingParticular.save();

    res.status(200).json({
      success: true,
      message: 'Transport receipt uploaded successfully',
      data: existingParticular,
    });
  } catch (error: any) {
    console.error('[Upload Error]:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to upload document',
    });
  }
};

export const deleteParticularPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.headers['x-user-role'] === 'user') {
      res.status(403).json({ success: false, error: 'Access denied. Customers are not allowed to delete documents.' });
      return;
    }
    const { id } = req.params;
    const particular = await Particular.findById(id);

    if (!particular) {
      res.status(404).json({ success: false, error: 'Particular bill not found' });
      return;
    }

    // Delete from Cloudinary if public_id exists
    if (particular.pdfPublicId && isCloudinaryConfigured()) {
      await deleteFromCloudinary(particular.pdfPublicId);
      console.log(`[Cloudinary Delete] Removed asset: ${particular.pdfPublicId}`);
    }

    particular.pdfData = '';
    particular.pdfName = '';
    particular.pdfPublicId = '';
    await particular.save();

    res.status(200).json({ success: true, message: 'PDF deleted successfully', data: particular });
  } catch (error) {
    next(error);
  }
};
