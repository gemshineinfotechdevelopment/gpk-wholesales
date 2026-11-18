import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Performa, type IPerformaProductItem } from '../models/Performa';
import { PerformaAudit } from '../models/PerformaAudit';
import { Customer } from '../models/Customer';
import { Company } from '../models/Company';
import { Particular } from '../models/Particular';
import { escapeRegex } from '../utils/ledgerUtils';
import { getNextCustomerIdCode } from './customerController';
import { getCustomerPerformaSummary } from '../services/performaConsumptionService';

export const getPerformas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName, customerId, companyName, status, search, startDate, endDate, sortBy, sortOrder } = req.query;
    const filter: any = {};

    if (customerId && mongoose.Types.ObjectId.isValid(String(customerId))) {
      filter.customerId = new mongoose.Types.ObjectId(String(customerId));
    } else if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      const trimmed = customerName.trim();
      const cleanDigits = trimmed.replace(/[^0-9]/g, '');
      let targetName = trimmed;
      if (cleanDigits.length >= 7) {
        const matchedCust = await Customer.findOne({ mobile: { $regex: cleanDigits, $options: 'i' } });
        if (matchedCust) {
          targetName = matchedCust.name;
        }
      }
      filter['customerSnapshot.name'] = { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') };
    }

    if (companyName && typeof companyName === 'string' && companyName.trim() !== '' && companyName.toLowerCase() !== 'all') {
      const compRegex = new RegExp(escapeRegex(companyName.trim()), 'i');
      filter.$or = [
        { companyName: compRegex },
        { 'customerSnapshot.companyName': compRegex },
        { 'products.productSnapshot.companyName': compRegex },
      ];
    }

    if (status && typeof status === 'string' && status.trim() !== '' && status.toUpperCase() !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = String(startDate);
      if (endDate) filter.date.$lte = String(endDate);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      const searchConditions = [
        { performaNumber: searchRegex },
        { companyName: searchRegex },
        { 'customerSnapshot.name': searchRegex },
        { 'customerSnapshot.phone': searchRegex },
        { 'customerSnapshot.companyName': searchRegex },
        { 'products.productSnapshot.productName': searchRegex },
        { 'products.productSnapshot.productCode': searchRegex },
        { 'products.productSnapshot.companyName': searchRegex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const sortObj: any = {};
    const order = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'date') sortObj.date = order;
    else if (sortBy === 'company' || sortBy === 'companyName') sortObj.companyName = order;
    else if (sortBy === 'customer' || sortBy === 'customerName') sortObj['customerSnapshot.name'] = order;
    else if (sortBy === 'value' || sortBy === 'totalAllocatedAmount') sortObj.totalAllocatedAmount = order;
    else if (sortBy === 'advance' || sortBy === 'advanceAmount') sortObj.advanceAmount = order;
    else if (sortBy === 'remainingAdvance') sortObj.remainingAdvanceAmount = order;
    else if (sortBy === 'performaNumber') sortObj.performaNumber = order;
    else if (sortBy === 'cases' || sortBy === 'totalRequiredCases') sortObj.totalRequiredCases = order;
    else {
      sortObj.date = -1;
      sortObj.createdAt = -1;
    }
    if (!sortObj.createdAt) sortObj.createdAt = -1;

    const performas = await Performa.find(filter).sort(sortObj).lean();

    let totalAdvance = 0;
    let totalRemainingAdvance = 0;
    let totalRequiredCases = 0;

    const enrichedPerformas = performas.map((p: any) => {
      const adv = Number((p.advanceAmount || 0).toFixed(2));
      const performaTotalValue = Number((p.totalAllocatedAmount || 0).toFixed(2));
      const balanceAmount = Math.max(0, Number((performaTotalValue - adv).toFixed(2)));

      totalAdvance += adv;
      totalRemainingAdvance += adv;
      totalRequiredCases += p.totalRequiredCases || 0;

      return {
        ...p,
        initialAdvance: adv,
        additionalCredits: 0,
        totalAdvanceReceived: adv,
        totalAvailableAmount: adv,
        performaTotalValue,
        usedAmount: 0,
        remainingAmount: adv,
        advanceUsedAmount: 0,
        remainingAdvanceAmount: adv,
        balanceAmount,
        customerPendingAmount: balanceAmount,
        performaRemainingAmount: balanceAmount,
        customerBills: [],
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedPerformas.length,
      data: enrichedPerformas,
      summary: {
        totalPerformas: enrichedPerformas.length,
        totalAdvance: Number(totalAdvance.toFixed(2)),
        totalUsedAdvance: 0,
        totalRemainingAdvance: Number(totalRemainingAdvance.toFixed(2)),
        totalRequiredCases,
        totalUsedCases: 0,
        totalRemainingCases: totalRequiredCases,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getNextPerformaNumber = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allPerformas = await Performa.find({}, 'performaNumber');
    let maxNum = 0;
    for (const p of allPerformas) {
      if (p.performaNumber) {
        const match = p.performaNumber.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    const nextPerformaNumber = `PF-${(maxNum + 1).toString().padStart(6, '0')}`;
    res.status(200).json({ success: true, data: { nextPerformaNumber } });
  } catch (error) {
    next(error);
  }
};

export const getPerformaById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const performa = await Performa.findById(req.params.id);
    if (!performa) {
      res.status(404).json({ success: false, error: 'Performa record not found' });
      return;
    }

    const summary = await getCustomerPerformaSummary(String(performa.customerId || performa.customerSnapshot?.name));

    const adv = Number((performa.advanceAmount || 0).toFixed(2));
    const performaTotalValue = Number((performa.totalAllocatedAmount || 0).toFixed(2));
    const balanceAmount = summary?.balanceAmount !== undefined ? summary.balanceAmount : Math.max(0, Number((performaTotalValue - adv).toFixed(2)));

    res.status(200).json({
      success: true,
      data: {
        ...performa.toObject(),
        initialAdvance: summary?.initialAdvance ?? adv,
        additionalCredits: summary?.additionalCredits ?? 0,
        totalAdvanceReceived: summary?.totalAdvanceReceived ?? adv,
        totalAvailableAmount: summary?.availableAmount ?? adv,
        usedAmount: summary?.totalAdvanceUsed ?? 0,
        remainingAmount: summary?.availableAmount ?? adv,
        advanceUsedAmount: summary?.totalAdvanceUsed ?? 0,
        remainingAdvanceAmount: summary?.availableAmount ?? adv,
        balanceAmount,
        customerPendingAmount: summary?.customerPendingAmount ?? 0,
        performaRemainingAmount: summary?.performaRemainingAmount ?? 0,
        customerBills: summary?.customerBills ?? [],
        auditHistory: summary?.transactionHistory ?? [],
        transactionHistory: summary?.transactionHistory ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createPerforma = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      customerId,
      customerSnapshot,
      advanceAmount = 0,
      paymentMode = 'Bank',
      products = [],
      date,
      notes = '',
      createdBy = 'Admin',
      performaNumber,
      discount = '0',
      packing = '0',
      tax = '0',
    } = req.body;

    if (!customerSnapshot || !customerSnapshot.name) {
      res.status(400).json({ success: false, error: 'Customer information is required' });
      return;
    }

    // Resolve or verify customer
    let validCustomerId = customerId;
    if (!validCustomerId || !mongoose.Types.ObjectId.isValid(validCustomerId)) {
      const existingCust = await Customer.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(customerSnapshot.name.trim())}$`, 'i') },
      });
      if (existingCust) {
        validCustomerId = existingCust._id;
      } else {
        const idCode = await getNextCustomerIdCode();
        const newCust = await Customer.create({
          idCode,
          name: customerSnapshot.name.trim(),
          mobile: customerSnapshot.phone || '-',
          address: customerSnapshot.address || '-',
          gst: customerSnapshot.gst || '-',
        });
        validCustomerId = newCust._id;
      }
    }


    // Generate unique Performa Number if not provided
    let finalPerformaNumber = performaNumber ? String(performaNumber).trim().toUpperCase() : '';
    if (!finalPerformaNumber) {
      const allPerformas = await Performa.find({}, 'performaNumber');
      let maxNum = 0;
      for (const p of allPerformas) {
        if (p.performaNumber) {
          const match = p.performaNumber.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
      finalPerformaNumber = `PF-${(maxNum + 1).toString().padStart(6, '0')}`;
    }

    // Process and validate product items
    let totalRequiredCases = 0;
    let subtotalAmount = 0;

    const sanitizedProducts: IPerformaProductItem[] = products.map((item: any) => {
      const reqCases = parseFloat(item.requiredCases) || 0;
      const rate = parseFloat(item.rate) || 0;
      const pktPerUnit = parseFloat(item.pktPerUnit) || 1;
      const allocated = Number(
        (item.allocatedAmount !== undefined
          ? parseFloat(item.allocatedAmount)
          : reqCases * rate * pktPerUnit
        ).toFixed(2)
      );

      totalRequiredCases += reqCases;
      subtotalAmount += allocated;

      return {
        productId: item.productId && mongoose.Types.ObjectId.isValid(item.productId) ? item.productId : undefined,
        productSnapshot: {
          productCode: item.productSnapshot?.productCode || item.productCode || '',
          productName: item.productSnapshot?.productName || item.productName || item.particular || 'Product',
          companyName: item.productSnapshot?.companyName || item.companyName || '',
          category: item.productSnapshot?.category || item.category || '',
        },
        requiredCases: reqCases,
        usedCases: 0,
        remainingCases: reqCases,
        caseOut: 0,
        rate: rate,
        pktPerUnit: pktPerUnit,
        allocatedAmount: allocated,
        usedAmount: 0,
        remainingAmount: allocated,
      };
    });

    // Calculate Discount, Packing Charge (% on discounted amount), Tax (Amount)
    const cleanDisc = String(discount || '0').trim();
    const discNum = parseFloat(cleanDisc) || 0;
    let discountAmt = 0;
    if (discNum > 0) {
      if (cleanDisc.endsWith('%') || discNum <= 100) {
        discountAmt = (subtotalAmount * discNum) / 100;
      } else {
        discountAmt = discNum;
      }
    }
    discountAmt = Number(discountAmt.toFixed(2));

    const baseAfterDiscount = Math.max(0, subtotalAmount - discountAmt);

    const cleanPack = String(packing || '0').trim();
    const packNum = parseFloat(cleanPack) || 0;
    let packingAmt = 0;
    if (packNum > 0) {
      if (cleanPack.endsWith('%') || packNum <= 100) {
        packingAmt = (baseAfterDiscount * packNum) / 100;
      } else {
        packingAmt = packNum;
      }
    }
    packingAmt = Number(packingAmt.toFixed(2));

    const cleanTax = String(tax || '0').trim().replace(/[^0-9.]/g, '');
    const taxAmt = Number((parseFloat(cleanTax) || 0).toFixed(2));

    const finalAllocatedTotal = Math.max(0, Number((subtotalAmount - discountAmt + packingAmt + taxAmt).toFixed(2)));

    const parsedAdvance = parseFloat(String(advanceAmount).replace(/,/g, '')) || 0;
    const performaDate = date || new Date().toISOString().split('T')[0];

    // Derive unique companies from product items (excluding 'General')
    const uniqueCompanies = Array.from(
      new Set(
        sanitizedProducts
          .map((p) => p.productSnapshot?.companyName?.trim())
          .filter((c): c is string => typeof c === 'string' && c.length > 0 && c.toLowerCase() !== 'general')
      )
    );
    const combinedCompanyName =
      uniqueCompanies.length > 0
        ? uniqueCompanies.join(', ')
        : (req.body.companyName && req.body.companyName.toLowerCase() !== 'general'
            ? req.body.companyName
            : customerSnapshot.companyName && customerSnapshot.companyName.toLowerCase() !== 'general'
            ? customerSnapshot.companyName
            : req.body.companyName || customerSnapshot.companyName || '');

    const performa = await Performa.create({
      performaNumber: finalPerformaNumber,
      customerId: validCustomerId,
      companyName: combinedCompanyName,
      customerSnapshot: {
        name: customerSnapshot.name.trim(),
        phone: customerSnapshot.phone || '',
        companyName: combinedCompanyName || customerSnapshot.companyName || '',
        address: customerSnapshot.address || '',
        gst: customerSnapshot.gst || '',
      },
      advanceAmount: parsedAdvance,
      advanceUsedAmount: 0,
      remainingAdvanceAmount: parsedAdvance,
      products: sanitizedProducts,
      totalRequiredCases,
      totalUsedCases: 0,
      totalRemainingCases: totalRequiredCases,
      subtotal: Number(subtotalAmount.toFixed(2)),
      discount: cleanDisc,
      discountAmount: discountAmt,
      packing: cleanPack,
      packingAmount: packingAmt,
      tax: cleanTax,
      taxAmount: taxAmt,
      totalAllocatedAmount: finalAllocatedTotal,
      totalUsedAmount: 0,
      totalRemainingAmount: finalAllocatedTotal,
      status: 'ACTIVE',
      date: performaDate,
      notes,
      createdBy,
    });

    res.status(201).json({ success: true, data: performa });
  } catch (error) {
    next(error);
  }
};

export const updatePerforma = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await Performa.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Performa record not found' });
      return;
    }

    const { customerSnapshot, companyName, advanceAmount, products, date, notes, status, discount, packing, tax } = req.body;

    if (companyName !== undefined) {
      existing.companyName = companyName;
    }

    if (discount !== undefined) existing.discount = String(discount);
    if (packing !== undefined) existing.packing = String(packing);
    if (tax !== undefined) existing.tax = String(tax);

    if (customerSnapshot) {
      existing.customerSnapshot = {
        name: customerSnapshot.name || existing.customerSnapshot.name,
        phone: customerSnapshot.phone !== undefined ? customerSnapshot.phone : existing.customerSnapshot.phone,
        companyName:
          companyName || customerSnapshot.companyName !== undefined
            ? companyName || customerSnapshot.companyName
            : existing.customerSnapshot.companyName,
        address: customerSnapshot.address !== undefined ? customerSnapshot.address : existing.customerSnapshot.address,
        gst: customerSnapshot.gst !== undefined ? customerSnapshot.gst : existing.customerSnapshot.gst,
      };
    }

    if (advanceAmount !== undefined) {
      const newAdv = parseFloat(String(advanceAmount).replace(/,/g, '')) || 0;
      existing.advanceAmount = newAdv;
      existing.totalAdvanceReceived = newAdv;
      existing.remainingAdvanceAmount = newAdv;
    }

    if (date) existing.date = date;
    if (notes !== undefined) existing.notes = notes;
    if (status) existing.status = status;

    if (products && Array.isArray(products)) {
      let totalReq = 0;
      let totalSub = 0;

      existing.products = products.map((item: any) => {
        const reqCases = parseFloat(item.requiredCases) || 0;
        const usedCases = parseFloat(item.usedCases) || 0;
        const rate = parseFloat(item.rate) || 0;
        const pktPerUnit = parseFloat(item.pktPerUnit) || 1;
        const allocated = parseFloat(item.allocatedAmount) || reqCases * rate * pktPerUnit;
        const usedAmt = parseFloat(item.usedAmount) || 0;

        totalReq += reqCases;
        totalSub += allocated;

        return {
          productId: item.productId,
          productSnapshot: {
            productCode: item.productSnapshot?.productCode || item.productCode || '',
            productName: item.productSnapshot?.productName || item.productName || 'Product',
            companyName: item.productSnapshot?.companyName || item.companyName || '',
            category: item.productSnapshot?.category || item.category || '',
          },
          requiredCases: reqCases,
          usedCases: usedCases,
          remainingCases: Math.max(0, reqCases - usedCases),
          caseOut: parseFloat(item.caseOut) || usedCases,
          rate: rate,
          pktPerUnit: pktPerUnit,
          allocatedAmount: allocated,
          usedAmount: usedAmt,
          remainingAmount: Math.max(0, allocated - usedAmt),
        };
      });

      const totalUsed = existing.products.reduce((acc: number, p: any) => acc + (p.usedCases || 0), 0);
      existing.totalRequiredCases = totalReq;
      existing.totalUsedCases = totalUsed;
      existing.totalRemainingCases = Math.max(0, totalReq - totalUsed);
      existing.subtotal = Number(totalSub.toFixed(2));

      if (existing.totalRemainingCases > 0 && existing.status === 'COMPLETED') {
        existing.status = totalUsed > 0 ? 'PARTIALLY_USED' : 'ACTIVE';
      }
    }

    // Recalculate discount, packing, tax, totalAllocatedAmount
    const subtotalAmt = existing.subtotal !== undefined ? existing.subtotal : (existing.products || []).reduce((s, p) => s + (p.allocatedAmount || 0), 0);
    const cleanDisc = String(existing.discount || '0').trim();
    const discNum = parseFloat(cleanDisc) || 0;
    let discountAmt = 0;
    if (discNum > 0) {
      if (cleanDisc.endsWith('%') || discNum <= 100) {
        discountAmt = (subtotalAmt * discNum) / 100;
      } else {
        discountAmt = discNum;
      }
    }
    discountAmt = Number(discountAmt.toFixed(2));
    const baseAfterDiscount = Math.max(0, subtotalAmt - discountAmt);

    const cleanPack = String(existing.packing || '0').trim();
    const packNum = parseFloat(cleanPack) || 0;
    let packingAmt = 0;
    if (packNum > 0) {
      if (cleanPack.endsWith('%') || packNum <= 100) {
        packingAmt = (baseAfterDiscount * packNum) / 100;
      } else {
        packingAmt = packNum;
      }
    }
    packingAmt = Number(packingAmt.toFixed(2));

    const cleanTax = String(existing.tax || '0').trim().replace(/[^0-9.]/g, '');
    const taxAmt = Number((parseFloat(cleanTax) || 0).toFixed(2));

    const finalAlloc = Math.max(0, Number((subtotalAmt - discountAmt + packingAmt + taxAmt).toFixed(2)));

    existing.discountAmount = discountAmt;
    existing.packingAmount = packingAmt;
    existing.taxAmount = taxAmt;
    existing.totalAllocatedAmount = finalAlloc;
    existing.totalRemainingAmount = Math.max(0, Number((finalAlloc - existing.totalUsedAmount).toFixed(2)));

    // Derive combined company names if products have companies
    if (existing.products && existing.products.length > 0) {
      const uniqueCompanies = Array.from(
        new Set(
          existing.products
            .map((p) => p.productSnapshot?.companyName?.trim())
            .filter((c): c is string => typeof c === 'string' && c.length > 0 && c.toLowerCase() !== 'general')
        )
      );
      if (uniqueCompanies.length > 0) {
        existing.companyName = uniqueCompanies.join(', ');
        if (existing.customerSnapshot) {
          existing.customerSnapshot.companyName = existing.companyName;
        }
      }
    }

    await existing.save();

    res.status(200).json({ success: true, data: existing });
  } catch (error) {
    next(error);
  }
};

export const cancelPerforma = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const performa = await Performa.findById(id);
    if (!performa) {
      res.status(404).json({ success: false, error: 'Performa record not found' });
      return;
    }

    performa.status = 'CANCELLED';
    await performa.save();

    await PerformaAudit.create({
      customerId: performa.customerId,
      customerName: performa.customerSnapshot.name,
      performaId: performa._id,
      performaNumber: performa.performaNumber,
      amount: performa.remainingAdvanceAmount,
      type: 'PERFORMA_CANCELLED',
      date: new Date().toISOString().split('T')[0],
      reference: `Cancellation of Performa ${performa.performaNumber}`,
      notes: 'Performa cancelled by user',
      createdBy: 'Admin',
    });

    res.status(200).json({ success: true, message: 'Performa cancelled successfully', data: performa });
  } catch (error) {
    next(error);
  }
};

export const deletePerforma = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const performa = await Performa.findById(id);
    if (!performa) {
      res.status(404).json({ success: false, error: 'Performa record not found' });
      return;
    }

    await PerformaAudit.deleteMany({ performaId: performa._id });
    await Performa.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Performa deleted successfully', data: {} });
  } catch (error) {
    next(error);
  }
};

export const addCustomerAdvance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, customerName, amount, date, paymentMode, reference, notes, createdBy = 'Admin' } = req.body;
    const parsedAmount = parseFloat(String(amount).replace(/,/g, '')) || 0;
    if (parsedAmount <= 0) {
      res.status(400).json({ success: false, error: 'Valid advance amount greater than 0 is required' });
      return;
    }

    const query: any = {};
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customerId = customerId;
    } else if (customerName) {
      query['customerSnapshot.name'] = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }

    const performa = await Performa.findOne(query).sort({ createdAt: -1 });
    if (performa) {
      performa.advanceAmount = Number(((performa.advanceAmount || 0) + parsedAmount).toFixed(2));
      performa.remainingAdvanceAmount = Number(((performa.remainingAdvanceAmount || 0) + parsedAmount).toFixed(2));
      await performa.save();
    }

    const auditEntry = await PerformaAudit.create({
      customerId: performa?.customerId,
      customerName: customerName || performa?.customerSnapshot?.name || 'General',
      performaId: performa?._id,
      performaNumber: performa?.performaNumber || '',
      amount: parsedAmount,
      type: 'ADVANCE_RECEIVED',
      date: date || new Date().toISOString().split('T')[0],
      paymentMode: paymentMode || 'Bank',
      reference: reference || 'Performa Advance',
      notes: notes || 'Performa Advance',
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: 'Advance credit added successfully',
      data: auditEntry,
      masterPerforma: performa,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCustomerSummaryEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = String(req.params.customerId || '');
    const summary = await getCustomerPerformaSummary(customerId);
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerAuditHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customerId = String(req.params.customerId || '');
    let customer: any = null;
    if (mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findById(customerId);
    }
    if (!customer) {
      customer = await Customer.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(customerId.trim())}$`, 'i') },
      });
    }

    const query: any = {};
    if (customer) {
      query.$or = [{ customerId: customer._id }, { customerName: customer.name }];
    } else {
      query.customerName = { $regex: new RegExp(`^${escapeRegex(customerId.trim())}$`, 'i') };
    }

    const audits = await PerformaAudit.find(query).sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, count: audits.length, data: audits });
  } catch (error) {
    next(error);
  }
};

export const getPendingCasesEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, companyName, customerName } = req.query;

    // Performas that are active or partially used
    const filter: any = {
      status: { $in: ['ACTIVE', 'PARTIALLY_USED'] },
    };

    if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      filter['customerSnapshot.name'] = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }

    if (companyName && typeof companyName === 'string' && companyName.trim() !== '' && companyName.toLowerCase() !== 'all') {
      const compRegex = new RegExp(escapeRegex(companyName.trim()), 'i');
      filter.$or = [
        { companyName: compRegex },
        { 'products.productSnapshot.companyName': compRegex },
      ];
    }

    const performas = await Performa.find(filter).sort({ date: -1, createdAt: -1 }).lean();

    // Fetch registered companies to enrich company details (address, gstin, avatar)
    const registeredCompanies = await Company.find({}).lean();
    const companyMetaMap = new Map<string, any>();
    for (const comp of registeredCompanies) {
      if (comp.name) {
        companyMetaMap.set(comp.name.trim().toLowerCase(), comp);
      }
    }

    // Customer aggregation map
    const customerMap = new Map<string, {
      customerId?: string;
      customerName: string;
      customerPhone: string;
      customerCompany: string;
      customerAddress: string;
      customerGst?: string;
      totalPendingCases: number;
      totalPendingAmount: number;
      totalRequiredCases: number;
      totalUsedCases: number;
      performasCount: number;
      performaNumbers: string[];
      items: Array<{
        performaId: string;
        performaNumber: string;
        performaDate: string;
        productId?: string;
        productName: string;
        productCode: string;
        category: string;
        companyName: string;
        requiredCases: number;
        usedCases: number;
        remainingCases: number;
        rate: number;
        pktPerUnit: number;
        remainingAmount: number;
      }>;
    }>();

    // Company aggregation map (strictly for explicitly selected supplier/manufacturer companies)
    const companyMap = new Map<string, {
      companyName: string;
      companyId?: string;
      address?: string;
      gstin?: string;
      avatarLetter?: string;
      avatarBg?: string;
      avatarColor?: string;
      totalStockCases: number;
      totalGivenCases: number;
      totalBalanceCases: number;
      totalStockAmount: number;
      totalGivenAmount: number;
      totalBalanceAmount: number;
      deliveryPercentage: number;
      totalPendingCases: number;
      totalPendingAmount: number;
      customersWaiting: Set<string>;
      productSummaries: Map<string, {
        productName: string;
        productCode: string;
        category: string;
        totalStockCases: number;
        totalGivenCases: number;
        totalBalanceCases: number;
        totalRemainingCases: number;
        totalRequiredCases: number;
        totalUsedCases: number;
        rate: number;
        balanceAmount: number;
        totalStockAmount: number;
        estimatedAmount: number;
        customers: Array<{
          customerName: string;
          customerPhone: string;
          performaNumber: string;
          orderedCases: number;
          givenCases: number;
          balanceCases: number;
          remainingCases: number;
          date: string;
        }>;
      }>;
      items: Array<{
        performaId: string;
        performaNumber: string;
        performaDate: string;
        customerName: string;
        customerPhone: string;
        productId?: string;
        productName: string;
        productCode: string;
        category: string;
        orderedCases: number;
        givenCases: number;
        balanceCases: number;
        remainingCases: number;
        requiredCases: number;
        usedCases: number;
        rate: number;
        balanceAmount: number;
        remainingAmount: number;
      }>;
    }>();

    let grandTotalPendingCases = 0;
    let grandTotalPendingAmount = 0;

    for (const perf of performas) {
      const custName = (perf.customerSnapshot?.name || 'Unknown Customer').trim();
      const custKey = custName.toLowerCase();
      const custShopName = (perf.customerSnapshot?.companyName || '').trim().toLowerCase();

      if (!customerMap.has(custKey)) {
        customerMap.set(custKey, {
          customerId: perf.customerId ? String(perf.customerId) : undefined,
          customerName: custName,
          customerPhone: perf.customerSnapshot?.phone || '',
          customerCompany: perf.customerSnapshot?.companyName || '',
          customerAddress: perf.customerSnapshot?.address || '',
          customerGst: perf.customerSnapshot?.gst || '',
          totalPendingCases: 0,
          totalPendingAmount: 0,
          totalRequiredCases: 0,
          totalUsedCases: 0,
          performasCount: 0,
          performaNumbers: [],
          items: [],
        });
      }

      const custEntry = customerMap.get(custKey)!;
      if (!custEntry.performaNumbers.includes(perf.performaNumber)) {
        custEntry.performaNumbers.push(perf.performaNumber);
        custEntry.performasCount++;
      }

      for (const item of (perf.products || [])) {
        const remainingCases = Math.max(0, Number(item.remainingCases) || 0);
        const rate = Math.max(0, Number(item.rate) || 0);
        const remainingAmt = item.remainingAmount ? Number(item.remainingAmount) : remainingCases * rate;
        const requiredCases = Math.max(0, Number(item.requiredCases) || 0);
        const usedCases = Math.max(0, Number(item.usedCases) || 0);
        const prodName = item.productSnapshot?.productName || 'Unknown Product';
        const prodCode = item.productSnapshot?.productCode || '';
        const category = item.productSnapshot?.category || '';

        // Determine explicit supplier/manufacturer company
        const rawItemCompany = (item.productSnapshot?.companyName || '').trim();
        const rawPerfCompany = (perf.companyName || '').trim();
        let itemSupplierCompany = '';

        if (rawItemCompany && rawItemCompany.toLowerCase() !== 'general') {
          // If product explicitly has a company, use it (unless it literally equals customer personal name AND is not a registered company)
          if (rawItemCompany.toLowerCase() !== custKey || companyMetaMap.has(rawItemCompany.toLowerCase())) {
            itemSupplierCompany = rawItemCompany;
          }
        }

        if (!itemSupplierCompany && rawPerfCompany && rawPerfCompany.toLowerCase() !== 'general') {
          if (rawPerfCompany.toLowerCase() !== custKey || companyMetaMap.has(rawPerfCompany.toLowerCase())) {
            // If performa has comma-separated companies, take first one or clean name
            itemSupplierCompany = rawPerfCompany.split(',')[0].trim();
          }
        }

        // Check if matches registered company metadata to normalize naming
        if (itemSupplierCompany) {
          const matched = companyMetaMap.get(itemSupplierCompany.toLowerCase());
          if (matched && matched.name) {
            itemSupplierCompany = matched.name;
          }
        }

        const displayCompany = itemSupplierCompany || (rawItemCompany && rawItemCompany.toLowerCase() !== 'general' ? rawItemCompany : (rawPerfCompany || 'General'));

        if (remainingCases > 0) {
          grandTotalPendingCases += remainingCases;
          grandTotalPendingAmount += remainingAmt;
          custEntry.totalPendingCases += remainingCases;
          custEntry.totalPendingAmount += remainingAmt;
        }

        // Add to customer entry
        custEntry.totalRequiredCases += requiredCases;
        custEntry.totalUsedCases += usedCases;
        custEntry.items.push({
          performaId: String(perf._id),
          performaNumber: perf.performaNumber,
          performaDate: perf.date,
          productId: item.productId ? String(item.productId) : undefined,
          productName: prodName,
          productCode: prodCode,
          category,
          companyName: displayCompany,
          requiredCases,
          usedCases,
          remainingCases,
          rate,
          pktPerUnit: Number(item.pktPerUnit) || 1,
          remainingAmount: remainingAmt,
        });

        // Add to Company Cases if a valid supplier company was specified
        if (itemSupplierCompany && itemSupplierCompany.toLowerCase() !== 'general') {
          const compKey = itemSupplierCompany.toLowerCase();
          const totalStockAmt = requiredCases * rate;
          const givenAmt = usedCases * rate;
          const balanceAmt = remainingAmt;

          if (!companyMap.has(compKey)) {
            const matchedComp = companyMetaMap.get(compKey);
            companyMap.set(compKey, {
              companyName: matchedComp?.name || itemSupplierCompany,
              companyId: matchedComp?._id ? String(matchedComp._id) : undefined,
              address: matchedComp?.address || '',
              gstin: matchedComp?.gstin || '',
              avatarLetter: matchedComp?.avatarLetter || itemSupplierCompany.charAt(0).toUpperCase(),
              avatarBg: matchedComp?.avatarBg || '#DBEAFE',
              avatarColor: matchedComp?.avatarColor || '#0B4DB7',
              totalStockCases: 0,
              totalGivenCases: 0,
              totalBalanceCases: 0,
              totalStockAmount: 0,
              totalGivenAmount: 0,
              totalBalanceAmount: 0,
              deliveryPercentage: 0,
              totalPendingCases: 0,
              totalPendingAmount: 0,
              customersWaiting: new Set<string>(),
              productSummaries: new Map(),
              items: [],
            });
          }

          const compEntry = companyMap.get(compKey)!;
          compEntry.totalStockCases += requiredCases;
          compEntry.totalGivenCases += usedCases;
          compEntry.totalBalanceCases += remainingCases;
          compEntry.totalStockAmount += totalStockAmt;
          compEntry.totalGivenAmount += givenAmt;
          compEntry.totalBalanceAmount += balanceAmt;
          compEntry.totalPendingCases += remainingCases;
          compEntry.totalPendingAmount += balanceAmt;
          if (remainingCases > 0) {
            compEntry.customersWaiting.add(custName);
          }

          // Product summary under company
          const prodKey = `${prodName.toLowerCase()}___${prodCode.toLowerCase()}`;
          if (!compEntry.productSummaries.has(prodKey)) {
            compEntry.productSummaries.set(prodKey, {
              productName: prodName,
              productCode: prodCode,
              category,
              totalStockCases: 0,
              totalGivenCases: 0,
              totalBalanceCases: 0,
              totalRemainingCases: 0,
              totalRequiredCases: 0,
              totalUsedCases: 0,
              rate,
              balanceAmount: 0,
              totalStockAmount: 0,
              estimatedAmount: 0,
              customers: [],
            });
          }
          const prodSummary = compEntry.productSummaries.get(prodKey)!;
          prodSummary.totalStockCases += requiredCases;
          prodSummary.totalGivenCases += usedCases;
          prodSummary.totalBalanceCases += remainingCases;
          prodSummary.totalRemainingCases += remainingCases;
          prodSummary.totalRequiredCases += requiredCases;
          prodSummary.totalUsedCases += usedCases;
          prodSummary.totalStockAmount += totalStockAmt;
          prodSummary.balanceAmount += balanceAmt;
          prodSummary.estimatedAmount += balanceAmt;
          prodSummary.customers.push({
            customerName: custName,
            customerPhone: perf.customerSnapshot?.phone || '',
            performaNumber: perf.performaNumber,
            orderedCases: requiredCases,
            givenCases: usedCases,
            balanceCases: remainingCases,
            remainingCases: remainingCases,
            date: perf.date,
          });

          // Raw item under company
          compEntry.items.push({
            performaId: String(perf._id),
            performaNumber: perf.performaNumber,
            performaDate: perf.date,
            customerName: custName,
            customerPhone: perf.customerSnapshot?.phone || '',
            productId: item.productId ? String(item.productId) : undefined,
            productName: prodName,
            productCode: prodCode,
            category,
            orderedCases: requiredCases,
            givenCases: usedCases,
            balanceCases: remainingCases,
            remainingCases: remainingCases,
            requiredCases: requiredCases,
            usedCases: usedCases,
            rate,
            balanceAmount: balanceAmt,
            remainingAmount: balanceAmt,
          });
        }
      }
    }

    // Process Particulars bills (direct deliveries/bills created by admin)
    const partFilter: any = {};
    if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      partFilter.customerName = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }
    if (companyName && typeof companyName === 'string' && companyName.trim() !== '' && companyName.toLowerCase() !== 'all') {
      partFilter.companyName = { $regex: new RegExp(`^${escapeRegex(companyName.trim())}$`, 'i') };
    }
    const particulars = await Particular.find(partFilter).sort({ date: -1, createdAt: -1 }).lean();

    for (const part of particulars) {
      // If this particular was already linked to a performa, it is already counted above
      if (part.performaNumber || part.performaId) {
        continue;
      }

      const pCustName = (part.customerName || 'Unknown Customer').trim();
      const pCustKey = pCustName.toLowerCase();
      const rawComp = (part.companyName || '').trim();

      if (!rawComp || rawComp.toLowerCase() === 'general' || rawComp.toLowerCase() === pCustKey) {
        continue;
      }

      let pCompany = rawComp;
      const matched = companyMetaMap.get(rawComp.toLowerCase());
      if (matched && matched.name) {
        pCompany = matched.name;
      }

      const compKey = pCompany.toLowerCase();
      if (!companyMap.has(compKey)) {
        const matchedComp = companyMetaMap.get(compKey);
        companyMap.set(compKey, {
          companyName: matchedComp?.name || pCompany,
          companyId: matchedComp?._id ? String(matchedComp._id) : undefined,
          address: matchedComp?.address || '',
          gstin: matchedComp?.gstin || '',
          avatarLetter: matchedComp?.avatarLetter || pCompany.charAt(0).toUpperCase(),
          avatarBg: matchedComp?.avatarBg || '#DBEAFE',
          avatarColor: matchedComp?.avatarColor || '#0B4DB7',
          totalStockCases: 0,
          totalGivenCases: 0,
          totalBalanceCases: 0,
          totalStockAmount: 0,
          totalGivenAmount: 0,
          totalBalanceAmount: 0,
          deliveryPercentage: 0,
          totalPendingCases: 0,
          totalPendingAmount: 0,
          customersWaiting: new Set<string>(),
          productSummaries: new Map(),
          items: [],
        });
      }

      const compEntry = companyMap.get(compKey)!;

      // Extract products from particular
      const prodList = (part.products && part.products.length > 0)
        ? part.products
        : [{
            particular: 'Crackers Items',
            quantity: part.caseCount || '1',
            rate: part.amount || '0',
            amount: part.total || part.amount || '0',
          }];

      for (const p of prodList) {
        const cases = Math.max(0, parseFloat(String((p as any).quantity || part.caseCount || '1').replace(/[^0-9.]/g, '')) || 1);
        const rate = Math.max(0, parseFloat(String((p as any).rate || '0').replace(/[^0-9.]/g, '')) || 0);
        const amt = Math.max(0, parseFloat(String((p as any).amount || '0').replace(/[^0-9.]/g, '')) || (cases * rate));
        const pName = (p as any).particular || 'Product Item';

        compEntry.totalStockCases += cases;
        compEntry.totalGivenCases += cases; // Stock given to customer!
        compEntry.totalStockAmount += amt;
        compEntry.totalGivenAmount += amt;

        // Product summary under company
        const prodKey = pName.toLowerCase();
        if (!compEntry.productSummaries.has(prodKey)) {
          compEntry.productSummaries.set(prodKey, {
            productName: pName,
            productCode: '',
            category: '',
            totalStockCases: 0,
            totalGivenCases: 0,
            totalBalanceCases: 0,
            totalRemainingCases: 0,
            totalRequiredCases: 0,
            totalUsedCases: 0,
            rate,
            balanceAmount: 0,
            totalStockAmount: 0,
            estimatedAmount: 0,
            customers: [],
          });
        }
        const prodSummary = compEntry.productSummaries.get(prodKey)!;
        prodSummary.totalStockCases += cases;
        prodSummary.totalGivenCases += cases;
        prodSummary.totalRequiredCases += cases;
        prodSummary.totalUsedCases += cases;
        prodSummary.totalStockAmount += amt;
        prodSummary.customers.push({
          customerName: pCustName,
          customerPhone: '',
          performaNumber: part.billNo ? `Bill #${part.billNo}` : 'Particular Bill',
          orderedCases: cases,
          givenCases: cases,
          balanceCases: 0,
          remainingCases: 0,
          date: part.date,
        });

        // Item under company
        compEntry.items.push({
          performaId: String(part._id),
          performaNumber: part.billNo ? `Bill #${part.billNo}` : 'Particular Bill',
          performaDate: part.date,
          customerName: pCustName,
          customerPhone: '',
          productId: undefined,
          productName: pName,
          productCode: '',
          category: '',
          orderedCases: cases,
          givenCases: cases,
          balanceCases: 0,
          remainingCases: 0,
          requiredCases: cases,
          usedCases: cases,
          rate,
          balanceAmount: 0,
          remainingAmount: 0,
        });

        // Also track under customer map
        if (!customerMap.has(pCustKey)) {
          customerMap.set(pCustKey, {
            customerId: undefined,
            customerName: pCustName,
            customerPhone: '',
            customerCompany: '',
            customerAddress: '',
            customerGst: '',
            totalPendingCases: 0,
            totalPendingAmount: 0,
            totalRequiredCases: 0,
            totalUsedCases: 0,
            performasCount: 0,
            performaNumbers: [],
            items: [],
          });
        }
        const custEntry = customerMap.get(pCustKey)!;
        custEntry.totalRequiredCases += cases;
        custEntry.totalUsedCases += cases;
        custEntry.items.push({
          performaId: String(part._id),
          performaNumber: part.billNo ? `Bill #${part.billNo}` : 'Particular Bill',
          performaDate: part.date,
          productName: pName,
          productCode: '',
          category: '',
          companyName: pCompany,
          requiredCases: cases,
          usedCases: cases,
          remainingCases: 0,
          rate,
          pktPerUnit: 1,
          remainingAmount: 0,
        });
      }
    }

    // Customer cases array (customers with pending, ordered, or delivered cases)
    let customerCases = Array.from(customerMap.values())
      .filter((c) => c.totalPendingCases > 0 || c.totalRequiredCases > 0 || c.totalUsedCases > 0)
      .sort((a, b) => (b.totalPendingCases - a.totalPendingCases) || (b.totalUsedCases - a.totalUsedCases));

    // Company cases array (companies with stock ordered, given, or pending)
    let companyCases = Array.from(companyMap.values())
      .filter((c) => c.totalBalanceCases > 0 || c.totalStockCases > 0 || c.totalGivenCases > 0)
      .map((c) => ({
        companyName: c.companyName,
        companyId: c.companyId,
        address: c.address,
        gstin: c.gstin,
        avatarLetter: c.avatarLetter,
        avatarBg: c.avatarBg,
        avatarColor: c.avatarColor,
        totalStockCases: c.totalStockCases,
        totalGivenCases: c.totalGivenCases,
        totalBalanceCases: c.totalBalanceCases,
        totalStockAmount: c.totalStockAmount,
        totalGivenAmount: c.totalGivenAmount,
        totalBalanceAmount: c.totalBalanceAmount,
        deliveryPercentage: c.totalStockCases > 0 ? Math.round((c.totalGivenCases / c.totalStockCases) * 100) : (c.totalGivenCases > 0 ? 100 : 0),
        totalPendingCases: c.totalBalanceCases,
        totalPendingAmount: c.totalBalanceAmount,
        customersCount: c.customersWaiting.size,
        customersWaitingNames: Array.from(c.customersWaiting),
        productSummaries: Array.from(c.productSummaries.values()).sort(
          (a, b) => (b.totalBalanceCases - a.totalBalanceCases) || (b.totalStockCases - a.totalStockCases)
        ),
        items: c.items.sort((a, b) => (b.balanceCases - a.balanceCases) || (b.givenCases - a.givenCases)),
      }))
      .sort((a, b) => (b.totalBalanceCases - a.totalBalanceCases) || (b.totalStockCases - a.totalStockCases));

    // Filter by search term if provided
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      customerCases = customerCases.filter((c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.toLowerCase().includes(q) ||
        c.customerCompany.toLowerCase().includes(q) ||
        c.items.some((item) =>
          item.productName.toLowerCase().includes(q) ||
          item.productCode.toLowerCase().includes(q) ||
          item.companyName.toLowerCase().includes(q) ||
          item.performaNumber.toLowerCase().includes(q)
        )
      );

      companyCases = companyCases.filter((c) =>
        c.companyName.toLowerCase().includes(q) ||
        c.productSummaries.some((p) => p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q)) ||
        c.items.some((i) => i.customerName.toLowerCase().includes(q) || i.performaNumber.toLowerCase().includes(q))
      );
    }

    res.status(200).json({
      success: true,
      summary: {
        totalPendingCases: grandTotalPendingCases,
        totalPendingAmount: grandTotalPendingAmount,
        totalCustomersWithPending: customerCases.length,
        totalCompaniesWithPending: companyCases.length,
      },
      customerCases,
      companyCases,
    });
  } catch (error: any) {
    next(error);
  }
};
