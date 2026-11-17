import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Performa, type IPerformaProductItem } from '../models/Performa';
import { PerformaAudit } from '../models/PerformaAudit';
import { Customer } from '../models/Customer';
import { Company } from '../models/Company';
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
      filter['customerSnapshot.name'] = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
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

      existing.totalRequiredCases = totalReq;
      existing.totalRemainingCases = Math.max(0, totalReq - existing.totalUsedCases);
      existing.subtotal = Number(totalSub.toFixed(2));
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

    // Company aggregation map
    const companyMap = new Map<string, {
      companyName: string;
      companyId?: string;
      address?: string;
      gstin?: string;
      avatarLetter?: string;
      avatarBg?: string;
      avatarColor?: string;
      totalPendingCases: number;
      totalPendingAmount: number;
      customersWaiting: Set<string>;
      productSummaries: Map<string, {
        productName: string;
        productCode: string;
        category: string;
        totalRemainingCases: number;
        totalRequiredCases: number;
        totalUsedCases: number;
        rate: number;
        estimatedAmount: number;
        customers: Array<{
          customerName: string;
          customerPhone: string;
          performaNumber: string;
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
        remainingCases: number;
        requiredCases: number;
        usedCases: number;
        rate: number;
        remainingAmount: number;
      }>;
    }>();

    let grandTotalPendingCases = 0;
    let grandTotalPendingAmount = 0;

    for (const perf of performas) {
      const custName = (perf.customerSnapshot?.name || 'Unknown Customer').trim();
      const custKey = custName.toLowerCase();

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
        if (remainingCases <= 0) continue;

        const rate = Math.max(0, Number(item.rate) || 0);
        const remainingAmt = item.remainingAmount ? Number(item.remainingAmount) : remainingCases * rate;
        const requiredCases = Math.max(0, Number(item.requiredCases) || 0);
        const usedCases = Math.max(0, Number(item.usedCases) || 0);
        const prodName = item.productSnapshot?.productName || 'Unknown Product';
        const prodCode = item.productSnapshot?.productCode || '';
        const category = item.productSnapshot?.category || '';
        const itemCompany = (item.productSnapshot?.companyName?.trim() || perf.companyName?.trim() || 'General');

        grandTotalPendingCases += remainingCases;
        grandTotalPendingAmount += remainingAmt;

        // Add to customer entry
        custEntry.totalPendingCases += remainingCases;
        custEntry.totalPendingAmount += remainingAmt;
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
          companyName: itemCompany,
          requiredCases,
          usedCases,
          remainingCases,
          rate,
          pktPerUnit: Number(item.pktPerUnit) || 1,
          remainingAmount: remainingAmt,
        });

        // Add to company entry
        const compKey = itemCompany.toLowerCase();
        if (!companyMap.has(compKey)) {
          const matchedComp = companyMetaMap.get(compKey);
          companyMap.set(compKey, {
            companyName: matchedComp?.name || itemCompany,
            companyId: matchedComp?._id ? String(matchedComp._id) : undefined,
            address: matchedComp?.address || '',
            gstin: matchedComp?.gstin || '',
            avatarLetter: matchedComp?.avatarLetter || itemCompany.charAt(0).toUpperCase(),
            avatarBg: matchedComp?.avatarBg || '#DBEAFE',
            avatarColor: matchedComp?.avatarColor || '#0B4DB7',
            totalPendingCases: 0,
            totalPendingAmount: 0,
            customersWaiting: new Set<string>(),
            productSummaries: new Map(),
            items: [],
          });
        }

        const compEntry = companyMap.get(compKey)!;
        compEntry.totalPendingCases += remainingCases;
        compEntry.totalPendingAmount += remainingAmt;
        compEntry.customersWaiting.add(custName);

        // Product summary under company
        const prodKey = `${prodName.toLowerCase()}___${prodCode.toLowerCase()}`;
        if (!compEntry.productSummaries.has(prodKey)) {
          compEntry.productSummaries.set(prodKey, {
            productName: prodName,
            productCode: prodCode,
            category,
            totalRemainingCases: 0,
            totalRequiredCases: 0,
            totalUsedCases: 0,
            rate,
            estimatedAmount: 0,
            customers: [],
          });
        }
        const prodSummary = compEntry.productSummaries.get(prodKey)!;
        prodSummary.totalRemainingCases += remainingCases;
        prodSummary.totalRequiredCases += requiredCases;
        prodSummary.totalUsedCases += usedCases;
        prodSummary.estimatedAmount += remainingAmt;
        prodSummary.customers.push({
          customerName: custName,
          customerPhone: perf.customerSnapshot?.phone || '',
          performaNumber: perf.performaNumber,
          remainingCases,
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
          remainingCases,
          requiredCases,
          usedCases,
          rate,
          remainingAmount: remainingAmt,
        });
      }
    }

    // Customer cases array (only customers with pending cases)
    let customerCases = Array.from(customerMap.values())
      .filter((c) => c.totalPendingCases > 0)
      .sort((a, b) => b.totalPendingCases - a.totalPendingCases);

    // Company cases array (only companies with pending cases)
    let companyCases = Array.from(companyMap.values())
      .filter((c) => c.totalPendingCases > 0)
      .map((c) => ({
        companyName: c.companyName,
        companyId: c.companyId,
        address: c.address,
        gstin: c.gstin,
        avatarLetter: c.avatarLetter,
        avatarBg: c.avatarBg,
        avatarColor: c.avatarColor,
        totalPendingCases: c.totalPendingCases,
        totalPendingAmount: c.totalPendingAmount,
        customersCount: c.customersWaiting.size,
        customersWaitingNames: Array.from(c.customersWaiting),
        productSummaries: Array.from(c.productSummaries.values()).sort(
          (a, b) => b.totalRemainingCases - a.totalRemainingCases
        ),
        items: c.items.sort((a, b) => b.remainingCases - a.remainingCases),
      }))
      .sort((a, b) => b.totalPendingCases - a.totalPendingCases);

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
