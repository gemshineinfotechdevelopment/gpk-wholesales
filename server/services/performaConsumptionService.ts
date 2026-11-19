import mongoose from 'mongoose';
import { Performa, type IPerforma } from '../models/Performa';
import { PerformaAudit } from '../models/PerformaAudit';
import { Customer } from '../models/Customer';
import { Particular } from '../models/Particular';
import { AccountLedger } from '../models/AccountLedger';
import { Company } from '../models/Company';
import { escapeRegex, recalculateCustomerBalance } from '../utils/ledgerUtils';

export interface BillProductInput {
  particular: string;
  quantity: string;
  rate: string;
  pktUnit?: string;
  amount: string;
}

export interface ConsumptionResultItem {
  performaId: string;
  performaNumber: string;
  productId?: string;
  productName: string;
  casesConsumed: number;
  amountConsumed: number;
  remainingCasesInPerforma: number;
}

export interface BillConsumptionResult {
  consumed: boolean;
  totalCasesConsumed: number;
  totalAmountConsumed: number;
  items: ConsumptionResultItem[];
  warnings: string[];
  remainingCustomerAdvance: number;
}

export const cleanNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

/**
 * Accurately calculate the final Net Total of a Particular bill
 * Net Total = (Sub Total - Discount) + Packing Charge + Tax
 * Matches the exact Net Total displayed in the Particulars Details page
 */
export const getParticularNetTotal = (p: any): number => {
  if (!p) return 0;

  // 1. Direct stored total check (from Particulars details / DB)
  const storedTotal = cleanNumber(p.total);

  // 2. Subtotal calculation
  const prodSubtotal = (p.products || []).reduce((acc: number, item: any) => {
    const a = cleanNumber(item.amount);
    const q = cleanNumber(item.quantity);
    const r = cleanNumber(item.rate);
    const u = cleanNumber(item.pktUnit || item.pktPerUnit) || 1;
    return acc + (a > 0 ? a : q * r * u);
  }, 0);

  const subtotal = prodSubtotal > 0 ? prodSubtotal : cleanNumber(p.amount);

  // 3. Discount calculation (supports % like 5% or 5, or fixed amount)
  let discountAmt = 0;
  const discStr = String(p.discount || '0').trim();
  const discNum = cleanNumber(discStr);
  const isDiscFlat = discStr.startsWith('₹') || discStr.toLowerCase().includes('rs');
  if (discStr.includes('%') || (!isDiscFlat && discNum > 0 && discNum <= 100)) {
    discountAmt = (subtotal * discNum) / 100;
  } else {
    discountAmt = discNum;
  }

  const baseAfterDisc = Math.max(0, subtotal - discountAmt);

  // 4. Packing charge calculation (supports % like 5% or 5, or fixed amount)
  let packingAmt = 0;
  const packStr = String(p.packing || '0').trim();
  const packNum = cleanNumber(packStr);
  const isPackFlat = packStr.startsWith('₹') || packStr.toLowerCase().includes('rs');
  if (packStr.includes('%') || (!isPackFlat && packNum > 0 && packNum <= 100)) {
    packingAmt = (baseAfterDisc * packNum) / 100;
  } else {
    packingAmt = packNum;
  }

  // 5. Tax calculation (fixed amount or percentage)
  const taxAmt = cleanNumber(p.tax);

  // 6. Net Total formula: (Sub Total - Discount) + Packing + Tax
  const calculatedNet = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);

  // If stored total is present and positive, use it as the source of truth
  if (storedTotal > 0) {
    return Number(storedTotal.toFixed(2));
  }

  return Number(calculatedNet.toFixed(2));
};

/**
 * Find customer's single master Performa
 */
export const getCustomerMasterPerforma = async (
  customerIdentifier: string
): Promise<IPerforma | null> => {
  if (!customerIdentifier || customerIdentifier.trim() === '' || customerIdentifier.toLowerCase() === 'all') {
    return null;
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(customerIdentifier);
  let customer: any = null;
  if (isObjectId) {
    customer = await Customer.findById(customerIdentifier);
  }
  if (!customer) {
    const escaped = escapeRegex(customerIdentifier.trim());
    customer = await Customer.findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });
  }

  const customerName = customer ? customer.name : customerIdentifier.trim();
  const customerId = customer ? customer._id : null;

  const query: any = {
    $or: [{ 'customerSnapshot.name': { $regex: new RegExp(`^${escapeRegex(customerName)}$`, 'i') } }],
  };
  if (customerId) {
    query.$or.push({ customerId });
  }

  // Return the first/master Performa
  return await Performa.findOne(query).sort({ createdAt: 1, _id: 1 });
};

/**
 * Add credit payment to customer's account and Master Performa
 */
export const addCustomerCreditToMasterPerforma = async (params: {
  customerId?: string;
  customerName: string;
  companyName?: string;
  creditAmount: number | string;
  date?: string;
  paymentMode?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
}): Promise<{ ledgerEntry: any; auditEntry: any; masterPerforma: IPerforma | null; summary: any }> => {
  const {
    customerId,
    customerName,
    companyName = '',
    creditAmount,
    date = new Date().toISOString().split('T')[0],
    paymentMode = 'Bank',
    reference = '',
    notes = 'Additional customer advance via Add Credit',
    createdBy = 'Admin',
  } = params;

  const parsedCredit = parseFloat(String(creditAmount).replace(/,/g, '')) || 0;
  if (parsedCredit <= 0) {
    throw new Error('Valid credit amount greater than 0 is required');
  }

  // Resolve Customer
  let validCustomerId = customerId;
  let finalCustomerName = customerName.trim();
  if (validCustomerId && mongoose.Types.ObjectId.isValid(validCustomerId)) {
    const cust = await Customer.findById(validCustomerId);
    if (cust) finalCustomerName = cust.name.trim();
  } else {
    const cust = await Customer.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(finalCustomerName)}$`, 'i') },
    });
    if (cust) {
      validCustomerId = String(cust._id);
      finalCustomerName = cust.name.trim();
    }
  }

  // Find Master Performa
  const masterPerforma = await getCustomerMasterPerforma(validCustomerId || finalCustomerName);

  if (masterPerforma) {
    const prevAddl = Number(masterPerforma.additionalCredits) || 0;
    const initAdv = Number(masterPerforma.advanceAmount) || 0;
    masterPerforma.additionalCredits = Number((prevAddl + parsedCredit).toFixed(2));
    masterPerforma.totalAdvanceReceived = Number((initAdv + masterPerforma.additionalCredits).toFixed(2));
    const usedAmt = Number(masterPerforma.advanceUsedAmount) || 0;
    masterPerforma.remainingAdvanceAmount = Math.max(
      0,
      Number((masterPerforma.totalAdvanceReceived - usedAmt).toFixed(2))
    );
    if (masterPerforma.status === 'COMPLETED' && masterPerforma.totalRemainingCases > 0) {
      masterPerforma.status = 'PARTIALLY_USED';
    }
    await masterPerforma.save();
  }

  // Create PerformaAudit entry
  const auditEntry = await PerformaAudit.create({
    customerId: validCustomerId ? new mongoose.Types.ObjectId(validCustomerId) : masterPerforma?.customerId,
    customerName: finalCustomerName,
    performaId: masterPerforma?._id,
    performaNumber: masterPerforma?.performaNumber || '',
    amount: parsedCredit,
    type: 'ADVANCE_RECEIVED',
    date,
    paymentMode,
    reference: reference || (masterPerforma ? `Credit for ${masterPerforma.performaNumber}` : 'Customer Credit'),
    notes,
    createdBy,
  });

  // Create AccountLedger entry
  const ledgerEntry = await AccountLedger.create({
    billNo: masterPerforma?.performaNumber || '',
    performaId: masterPerforma ? String(masterPerforma._id) : undefined,
    performaNumber: masterPerforma?.performaNumber || '',
    customerName: finalCustomerName,
    companyName: companyName || masterPerforma?.companyName || 'General',
    date,
    debit: '0.00',
    credit: parsedCredit.toFixed(2),
    balance: '0.00',
    paymentMode,
    reference: reference || (masterPerforma ? `Credit for ${masterPerforma.performaNumber}` : ''),
    notes,
    type: 'CREDIT',
  });

  await recalculateCustomerBalance(finalCustomerName);

  const summary = await getCustomerPerformaSummary(validCustomerId || finalCustomerName);

  return {
    ledgerEntry,
    auditEntry,
    masterPerforma,
    summary,
  };
};

/**
 * Consume actual bill against customer's Master Performa
 */
export const consumeBillAgainstPerforma = async (
  particularId: string,
  billNo: string,
  customerName: string,
  billDate: string,
  products: BillProductInput[],
  billTotal: number
): Promise<BillConsumptionResult> => {
  const result: BillConsumptionResult = {
    consumed: false,
    totalCasesConsumed: 0,
    totalAmountConsumed: 0,
    items: [],
    warnings: [],
    remainingCustomerAdvance: 0,
  };

  if (!customerName || !products || products.length === 0) {
    return result;
  }

  try {
    const escapedCustomerName = escapeRegex(customerName.trim());
    const customer = await Customer.findOne({
      name: { $regex: new RegExp(`^${escapedCustomerName}$`, 'i') },
    });

    const masterPerforma = await getCustomerMasterPerforma(customer ? String(customer._id) : customerName);

    if (!masterPerforma) {
      return result;
    }

    // Try fetching the actual Particular document to guarantee exact Net Total calculation
    let actualParticular: any = null;
    if (particularId && mongoose.Types.ObjectId.isValid(particularId)) {
      actualParticular = await Particular.findById(particularId).lean();
    }

    // Calculate total product subtotal vs final bill Net Total (inclusive of Tax, Packing, Discount)
    const totalBillSubtotal = products.reduce(
      (acc, p) => acc + (cleanNumber(p.amount) || 0),
      0
    );
    const billNetTotal = actualParticular
      ? getParticularNetTotal(actualParticular)
      : (cleanNumber(billTotal) || totalBillSubtotal);

    const scaleRatio = totalBillSubtotal > 0 && billNetTotal > 0 ? billNetTotal / totalBillSubtotal : 1;

    let totalBillAmountConsumed = 0;

    for (const billItem of products) {
      const billedCases = cleanNumber(billItem.quantity);
      const itemAmount = cleanNumber(billItem.amount);
      const itemRate = cleanNumber(billItem.rate);
      const billedNameNormalized = billItem.particular.trim().toLowerCase();

      if (billedCases <= 0) continue;

      let remainingCasesToConsume = billedCases;

      for (const pProd of masterPerforma.products) {
        if (remainingCasesToConsume <= 0) break;

        const pName = pProd.productSnapshot.productName.trim().toLowerCase();
        const pCode = (pProd.productSnapshot.productCode || '').trim().toLowerCase();

        // Match by SKU or Name
        if (pName === billedNameNormalized || (pCode && pCode === billedNameNormalized)) {
          const availableCases = pProd.remainingCases || 0;
          if (availableCases <= 0) continue;

          const casesToConsume = Math.min(remainingCasesToConsume, availableCases);
          if (casesToConsume <= 0) continue;

          // Consume bill item amount proportionally scaled by Net Total (including Tax & Packing)
          let rawItemConsumed = 0;
          if (billedCases > 0 && itemAmount > 0) {
            rawItemConsumed = (casesToConsume / billedCases) * itemAmount;
          } else {
            rawItemConsumed = casesToConsume * itemRate;
          }
          const consumedAmount = Number((rawItemConsumed * scaleRatio).toFixed(2));

          pProd.usedCases = Number((pProd.usedCases + casesToConsume).toFixed(2));
          pProd.caseOut = Number((pProd.caseOut + casesToConsume).toFixed(2));
          pProd.remainingCases = Math.max(0, Number((pProd.requiredCases - pProd.usedCases).toFixed(2)));
          pProd.usedAmount = Number((pProd.usedAmount + consumedAmount).toFixed(2));
          pProd.remainingAmount = Math.max(0, Number((pProd.allocatedAmount - pProd.usedAmount).toFixed(2)));

          totalBillAmountConsumed += consumedAmount;

          // Record audit log for product case consumption with net total share
          await PerformaAudit.create({
            customerId: customer?._id || masterPerforma.customerId,
            customerName: customerName.trim(),
            performaId: masterPerforma._id,
            performaNumber: masterPerforma.performaNumber,
            particularId: new mongoose.Types.ObjectId(particularId),
            billNo: billNo,
            productId: pProd.productId,
            productName: pProd.productSnapshot.productName,
            cases: casesToConsume,
            amount: consumedAmount,
            type: 'PERFORMA_CONSUMED',
            date: billDate,
            reference: `Bill #${billNo}`,
            notes: `Consumed ${casesToConsume} cases (₹${consumedAmount.toFixed(2)}) for bill #${billNo}`,
            createdBy: 'System',
          });

          result.consumed = true;
          result.totalCasesConsumed += casesToConsume;
          result.totalAmountConsumed += consumedAmount;
          result.items.push({
            performaId: String(masterPerforma._id),
            performaNumber: masterPerforma.performaNumber,
            productId: pProd.productId ? String(pProd.productId) : undefined,
            productName: pProd.productSnapshot.productName,
            casesConsumed: casesToConsume,
            amountConsumed: consumedAmount,
            remainingCasesInPerforma: pProd.remainingCases,
          });

          remainingCasesToConsume -= casesToConsume;
        }
      }
    }

    // Check for additional products or items marked as additional outside performa quotation
    for (const billItem of products) {
      const billedCases = cleanNumber(billItem.quantity);
      const billedNameNormalized = billItem.particular.replace(/\s*\(additional\)/i, '').trim().toLowerCase();
      const pProd = masterPerforma.products.find((p) => {
        const pName = p.productSnapshot.productName.trim().toLowerCase();
        const pCode = (p.productSnapshot.productCode || '').trim().toLowerCase();
        return pName === billedNameNormalized || (pCode && pCode === billedNameNormalized);
      });

      const isExplicitAdditional = (billItem as any).isAdditional === true;
      if (!pProd || isExplicitAdditional) {
        await PerformaAudit.create({
          customerId: customer?._id || masterPerforma.customerId,
          customerName: customerName.trim(),
          performaId: masterPerforma._id,
          performaNumber: masterPerforma.performaNumber,
          particularId: new mongoose.Types.ObjectId(particularId),
          billNo: billNo,
          productName: billItem.particular,
          cases: billedCases,
          amount: cleanNumber(billItem.amount),
          type: 'ADDITIONAL_PRODUCT_BILLED',
          date: billDate,
          reference: `Bill #${billNo}`,
          notes: `Additional product: ${billItem.particular} (${billedCases} cases) billed outside quotation`,
          createdBy: 'System',
        });
      }
    }

    // Always calculate customer's total used advance from all customer Particulars Net Totals
    const allCustomerBills = await Particular.find({
      customerName: { $regex: new RegExp(`^${escapedCustomerName}$`, 'i') },
    }).lean();

    const totalBillsNetTotal = Number(
      allCustomerBills.reduce((sum, b) => sum + getParticularNetTotal(b), 0).toFixed(2)
    );

    // Compute all customer credits (initial advance + all Add Credits) from AccountLedger
    const allCredits = await AccountLedger.find({
      customerName: { $regex: new RegExp(`^${escapedCustomerName}$`, 'i') },
      $or: [{ type: 'CREDIT' }, { type: 'ADVANCE' }],
    }).lean();
    const totalCreditsAmount = Number(
      allCredits.reduce((sum, c) => sum + (parseFloat(String(c.credit || '0').replace(/,/g, '')) || 0), 0).toFixed(2)
    );

    const initAdv = Number(masterPerforma.advanceAmount) || 0;
    const totalAdvReceived = totalCreditsAmount > 0 ? totalCreditsAmount : Math.max(initAdv, (masterPerforma.totalAdvanceReceived || 0));
    const additionalCreds = Math.max(0, Number((totalAdvReceived - initAdv).toFixed(2)));

    masterPerforma.additionalCredits = additionalCreds;
    masterPerforma.totalAdvanceReceived = totalAdvReceived;
    masterPerforma.totalUsedCases = Number(
      masterPerforma.products.reduce((acc, curr) => acc + curr.usedCases, 0).toFixed(2)
    );
    masterPerforma.totalRemainingCases = Math.max(
      0,
      Number((masterPerforma.totalRequiredCases - masterPerforma.totalUsedCases).toFixed(2))
    );
    masterPerforma.advanceUsedAmount = totalBillsNetTotal > 0 ? totalBillsNetTotal : Number((masterPerforma.advanceUsedAmount + (result.consumed ? billNetTotal : 0)).toFixed(2));
    masterPerforma.remainingAdvanceAmount = Math.max(
      0,
      Number((totalAdvReceived - masterPerforma.advanceUsedAmount).toFixed(2))
    );
    masterPerforma.totalUsedAmount = masterPerforma.advanceUsedAmount;
    masterPerforma.totalRemainingAmount = Math.max(
      0,
      Number((masterPerforma.totalAllocatedAmount - masterPerforma.totalUsedAmount).toFixed(2))
    );

    const allItemsFulfilled = masterPerforma.products.every((p) => p.remainingCases <= 0);
    if (allItemsFulfilled) {
      masterPerforma.status = 'COMPLETED';
    } else if (masterPerforma.totalUsedCases > 0) {
      masterPerforma.status = 'PARTIALLY_USED';
    }

    await masterPerforma.save();

    const summary = await getCustomerPerformaSummary(customerName);
    result.remainingCustomerAdvance = summary.availableAmount;

    return result;
  } catch (err) {
    console.error(`[Performa Consumption Error for Bill ${billNo}]:`, err);
    return result;
  }
};

/**
 * Reverse bill consumption on update or deletion
 */
export const reverseBillConsumption = async (particularId: string): Promise<void> => {
  if (!particularId) return;

  try {
    const consumedAudits = await PerformaAudit.find({
      particularId: new mongoose.Types.ObjectId(particularId),
      type: 'PERFORMA_CONSUMED',
    });

    if (consumedAudits.length === 0) return;

    for (const audit of consumedAudits) {
      if (!audit.performaId) continue;

      const performa = await Performa.findById(audit.performaId);
      if (!performa) continue;

      const auditCases = audit.cases || 0;
      const auditAmount = audit.amount || 0;

      const pProd = performa.products.find((p) => {
        if (audit.productId && p.productId) {
          return String(p.productId) === String(audit.productId);
        }
        return (
          p.productSnapshot.productName.trim().toLowerCase() ===
          (audit.productName || '').trim().toLowerCase()
        );
      });

      if (pProd) {
        pProd.usedCases = Math.max(0, Number((pProd.usedCases - auditCases).toFixed(2)));
        pProd.caseOut = Math.max(0, Number((pProd.caseOut - auditCases).toFixed(2)));
        pProd.remainingCases = Math.min(
          pProd.requiredCases,
          Number((pProd.requiredCases - pProd.usedCases).toFixed(2))
        );
        pProd.usedAmount = Math.max(0, Number((pProd.usedAmount - auditAmount).toFixed(2)));
        pProd.remainingAmount = Math.min(
          pProd.allocatedAmount,
          Number((pProd.allocatedAmount - pProd.usedAmount).toFixed(2))
        );
      }

      performa.totalUsedCases = Number(
        performa.products.reduce((acc, curr) => acc + curr.usedCases, 0).toFixed(2)
      );
      performa.totalRemainingCases = Math.max(
        0,
        Number((performa.totalRequiredCases - performa.totalUsedCases).toFixed(2))
      );

      // Re-sum remaining customer bills for advanceUsedAmount
      const remainingCustBills = await Particular.find({
        _id: { $ne: new mongoose.Types.ObjectId(particularId) },
        customerName: { $regex: new RegExp(`^${escapeRegex(performa.customerSnapshot?.name || audit.customerName)}$`, 'i') },
      }).lean();

      const remBillsNetTotal = Number(
        remainingCustBills.reduce((sum, b) => sum + getParticularNetTotal(b), 0).toFixed(2)
      );

      performa.advanceUsedAmount = remBillsNetTotal;
      const effectiveAdvance = Number((performa.totalAdvanceReceived || performa.advanceAmount || 0).toFixed(2));
      performa.remainingAdvanceAmount = Math.max(
        0,
        Number((effectiveAdvance - performa.advanceUsedAmount).toFixed(2))
      );
      performa.totalUsedAmount = remBillsNetTotal;
      performa.totalRemainingAmount = Math.max(
        0,
        Number((performa.totalAllocatedAmount - performa.totalUsedAmount).toFixed(2))
      );

      if (performa.status !== 'CANCELLED') {
        if (performa.totalUsedCases === 0 && performa.advanceUsedAmount === 0) {
          performa.status = 'ACTIVE';
        } else if (performa.totalRemainingCases > 0) {
          performa.status = 'PARTIALLY_USED';
        }
      }

      await performa.save();

      // Record reversal audit
      await PerformaAudit.create({
        customerId: audit.customerId,
        customerName: audit.customerName,
        performaId: performa._id,
        performaNumber: performa.performaNumber,
        particularId: new mongoose.Types.ObjectId(particularId),
        billNo: audit.billNo,
        productId: audit.productId,
        productName: audit.productName,
        cases: auditCases,
        amount: auditAmount,
        type: 'PERFORMA_REVERSED',
        date: new Date().toISOString().split('T')[0],
        reference: `Reversal for Bill #${audit.billNo || particularId}`,
        notes: `Reversed ${auditCases} cases upon bill update/deletion`,
        createdBy: 'System',
      });
    }

    await PerformaAudit.deleteMany({
      particularId: new mongoose.Types.ObjectId(particularId),
      type: { $in: ['PERFORMA_CONSUMED', 'ADDITIONAL_PRODUCT_BILLED'] },
    });
  } catch (err) {
    console.error(`[Performa Reversal Error for Particular ${particularId}]:`, err);
  }
};

/**
 * Get comprehensive customer master Performa summary and financial state
 */
export const getCustomerPerformaSummary = async (customerIdentifier: string): Promise<any> => {
  if (!customerIdentifier || customerIdentifier.trim() === '' || customerIdentifier.toLowerCase() === 'all') {
    return {
      customerId: null,
      customerName: '',
      hasMasterPerforma: false,
      masterPerforma: null,
      initialAdvance: 0,
      additionalCredits: 0,
      totalAdvanceReceived: 0,
      totalAdvanceUsed: 0,
      totalUsedByBills: 0,
      availableAdvance: 0,
      availableAmount: 0,
      totalAllocatedCases: 0,
      totalUsedCases: 0,
      totalRemainingCases: 0,
      ledgerTotalCredit: 0,
      ledgerTotalDebit: 0,
      ledgerCreditBalance: 0,
      transactionHistory: [],
    };
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(customerIdentifier);
  let customer: any = null;
  if (isObjectId) {
    customer = await Customer.findById(customerIdentifier);
  }
  if (!customer) {
    const escaped = escapeRegex(customerIdentifier.trim());
    customer = await Customer.findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });
  }

  const customerName = customer ? customer.name : customerIdentifier.trim();
  const customerId = customer ? customer._id : null;

  const masterPerforma = await getCustomerMasterPerforma(customerId ? String(customerId) : customerName);

  // Get all ledger entries for this customer
  const ledgerEntries = await AccountLedger.find({
    customerName: { $regex: new RegExp(`^${escapeRegex(customerName)}$`, 'i') },
  }).sort({ date: 1, createdAt: 1, _id: 1 }).lean();

  let ledgerTotalCredit = 0;
  let ledgerTotalDebit = 0;
  for (const entry of ledgerEntries) {
    const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
    const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
    ledgerTotalCredit += cred;
    ledgerTotalDebit += deb;
  }
  const ledgerCreditBalance = Number((ledgerTotalCredit - ledgerTotalDebit).toFixed(2));

  // Get all audits for this customer
  const auditQuery: any = {
    $or: [{ customerName: { $regex: new RegExp(`^${escapeRegex(customerName)}$`, 'i') } }],
  };
  if (customerId) auditQuery.$or.push({ customerId });

  const audits = await PerformaAudit.find(auditQuery).sort({ date: 1, createdAt: 1, _id: 1 }).lean();

  // Get all Particular bills for this customer
  const customerParticulars = await Particular.find({
    customerName: { $regex: new RegExp(`^${escapeRegex(customerName)}$`, 'i') },
  }).lean();

  const particularMapById = new Map<string, any>();
  const particularMapByBillNo = new Map<string, any>();
  for (const p of customerParticulars) {
    const net = getParticularNetTotal(p);
    particularMapById.set(String(p._id), { ...p, netTotal: net });
    if (p.billNo) {
      particularMapByBillNo.set(String(p.billNo).trim().toLowerCase(), { ...p, netTotal: net });
    }
  }

  // Calculate Initial Advance vs Additional Credits
  let initialAdvance = 0;
  let additionalCredits = 0;
  let totalUsedByBills = 0;

  // Calculate Used Amount = SUM of Net Total of all customer's Particulars bills or AccountLedger totalDebit
  if (customerParticulars.length > 0) {
    totalUsedByBills = customerParticulars.reduce((sum, p) => sum + getParticularNetTotal(p), 0);
  } else {
    totalUsedByBills = 0;
  }
  totalUsedByBills = Math.max(Number(totalUsedByBills.toFixed(2)), Number(ledgerTotalDebit.toFixed(2)));

  // Determine total credits from ledger
  const advanceAudits = audits.filter(
    (a) => a.type === 'ADVANCE_RECEIVED' || a.type === 'PERFORMA_ADVANCE'
  );
  const totalAuditCredits = advanceAudits.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const masterAdv = masterPerforma ? (Number(masterPerforma.advanceAmount) || 0) : 0;
  const masterAddl = masterPerforma ? (Number(masterPerforma.additionalCredits) || 0) : 0;
  const effectiveTotalCredits = Math.max(
    Number(ledgerTotalCredit.toFixed(2)),
    Number(totalAuditCredits.toFixed(2)),
    Number((masterAdv + masterAddl).toFixed(2)),
    masterAdv
  );

  if (masterPerforma) {
    if (masterAdv > 0) {
      initialAdvance = masterAdv;
      additionalCredits = Math.max(0, Number((effectiveTotalCredits - masterAdv).toFixed(2)));
    } else if (advanceAudits.length > 0) {
      initialAdvance = Number(advanceAudits[0].amount) || 0;
      additionalCredits = Math.max(0, Number((effectiveTotalCredits - initialAdvance).toFixed(2)));
    } else {
      initialAdvance = 0;
      additionalCredits = effectiveTotalCredits;
    }
  } else {
    additionalCredits = effectiveTotalCredits;
  }

  const totalAdvanceReceived = Number(effectiveTotalCredits.toFixed(2));
  const availableAmount = Math.max(0, Number((totalAdvanceReceived - totalUsedByBills).toFixed(2)));
  const balanceAmount = Number((totalAdvanceReceived - totalUsedByBills).toFixed(2));
  const customerPendingAmount = balanceAmount < 0 ? Math.abs(balanceAmount) : 0;
  const performaTotalVal = masterPerforma ? (masterPerforma.totalAllocatedAmount || 0) : 0;
  const performaRemainingAmount = Math.max(0, Number((performaTotalVal - totalAdvanceReceived).toFixed(2)));

  // Keep Master Performa updated
  if (masterPerforma) {
    let changed = false;
    const computedRemainingCases = (masterPerforma.products || []).reduce(
      (sum, p) =>
        sum +
        Math.max(
          0,
          p.remainingCases !== undefined && p.remainingCases !== null
            ? Number(p.remainingCases) || 0
            : (Number(p.requiredCases) || 0) - (Number(p.usedCases) || 0)
        ),
      0
    );
    if (masterPerforma.totalRemainingCases !== computedRemainingCases) {
      masterPerforma.totalRemainingCases = computedRemainingCases;
      changed = true;
    }
    if (masterPerforma.additionalCredits !== additionalCredits) {
      masterPerforma.additionalCredits = additionalCredits;
      changed = true;
    }
    if (masterPerforma.totalAdvanceReceived !== totalAdvanceReceived) {
      masterPerforma.totalAdvanceReceived = totalAdvanceReceived;
      changed = true;
    }
    if (masterPerforma.advanceUsedAmount !== totalUsedByBills) {
      masterPerforma.advanceUsedAmount = totalUsedByBills;
      changed = true;
    }
    if (masterPerforma.remainingAdvanceAmount !== availableAmount) {
      masterPerforma.remainingAdvanceAmount = availableAmount;
      changed = true;
    }
    if (changed) {
      await masterPerforma.save();
    }
  }

  // Build Chronological Transaction History with running balance
  const transactionHistory: any[] = [];
  let runningBal = 0;

  for (const a of audits) {
    let typeLabel = 'TRANSACTION';
    let delta = 0;
    let displayAmount = Number(a.amount) || 0;

    if (a.type === 'ADVANCE_RECEIVED' && (a.reference?.includes('Initial Advance') || a.notes?.includes('Initial'))) {
      typeLabel = 'INITIAL ADVANCE';
      delta = displayAmount;
    } else if (a.type === 'ADVANCE_RECEIVED' || a.type === 'PERFORMA_ADVANCE') {
      typeLabel = 'ADDITIONAL CREDIT';
      delta = displayAmount;
    } else if (a.type === 'PERFORMA_CONSUMED') {
      typeLabel = 'BILL CONSUMPTION';
      // Use bill's Net Total if linked to Particular
      const pDoc = (a.particularId && particularMapById.get(String(a.particularId))) ||
        (a.billNo && particularMapByBillNo.get(String(a.billNo).trim().toLowerCase()));
      if (pDoc && pDoc.netTotal > 0) {
        displayAmount = pDoc.netTotal;
      }
      delta = -displayAmount;
    } else if (a.type === 'PERFORMA_REVERSED') {
      typeLabel = 'BILL REVERSAL';
      const pDoc = (a.particularId && particularMapById.get(String(a.particularId))) ||
        (a.billNo && particularMapByBillNo.get(String(a.billNo).trim().toLowerCase()));
      if (pDoc && pDoc.netTotal > 0) {
        displayAmount = pDoc.netTotal;
      }
      delta = displayAmount;
    } else if (a.type === 'PERFORMA_CANCELLED') {
      typeLabel = 'CANCELLED';
      delta = 0;
    } else if (a.type === 'ADDITIONAL_PRODUCT_BILLED') {
      typeLabel = 'ADDITIONAL PRODUCT';
      delta = 0;
    }

    runningBal += delta;

    transactionHistory.push({
      _id: String(a._id),
      date: a.date,
      type: typeLabel,
      rawType: a.type,
      amount: displayAmount,
      delta,
      balance: Number(runningBal.toFixed(2)),
      reference: a.reference || a.performaNumber || '',
      billNo: a.billNo || '',
      paymentMode: a.paymentMode || 'Bank',
      notes: a.notes || '',
      createdBy: a.createdBy || 'Admin',
      createdAt: a.createdAt,
    });
  }

  return {
    customerId: customerId ? String(customerId) : null,
    customerName,
    idCode: customer?.idCode || '',
    phone: customer?.mobile || masterPerforma?.customerSnapshot?.phone || '',
    address: customer?.address || masterPerforma?.customerSnapshot?.address || '',
    gst: customer?.gst || masterPerforma?.customerSnapshot?.gst || '',
    hasMasterPerforma: !!masterPerforma,
    masterPerforma: masterPerforma
      ? {
          _id: String(masterPerforma._id),
          performaNumber: masterPerforma.performaNumber,
          date: masterPerforma.date,
          status: masterPerforma.status,
          companyName: masterPerforma.companyName,
          initialAdvance: Number(initialAdvance.toFixed(2)),
          additionalCredits: Number(additionalCredits.toFixed(2)),
          totalAdvanceReceived,
          totalUsedByBills,
          availableAmount,
          totalRequiredCases: masterPerforma.totalRequiredCases,
          totalUsedCases: masterPerforma.totalUsedCases,
          totalRemainingCases: masterPerforma.totalRemainingCases,
          products: masterPerforma.products.map((p) => ({
            productId: p.productId ? String(p.productId) : undefined,
            productCode: p.productSnapshot.productCode,
            productName: p.productSnapshot.productName,
            companyName: p.productSnapshot.companyName,
            category: p.productSnapshot.category,
            requiredCases: p.requiredCases,
            usedCases: p.usedCases,
            remainingCases: p.remainingCases,
            rate: p.rate,
            pktPerUnit: p.pktPerUnit,
            allocatedAmount: p.allocatedAmount,
            usedAmount: p.usedAmount,
            remainingAmount: p.remainingAmount,
          })),
        }
      : null,
    initialAdvance: Number(initialAdvance.toFixed(2)),
    additionalCredits: Number(additionalCredits.toFixed(2)),
    totalAdvanceReceived,
    totalAdvanceUsed: totalUsedByBills,
    totalUsedByBills,
    availableAdvance: availableAmount,
    availableAmount,
    balanceAmount,
    customerPendingAmount,
    performaTotalValue: performaTotalVal,
    performaRemainingAmount,
    totalAllocatedCases: masterPerforma?.totalRequiredCases || 0,
    totalUsedCases: masterPerforma?.totalUsedCases || 0,
    totalRemainingCases: masterPerforma?.totalRemainingCases || 0,
    ledgerTotalCredit: Number(ledgerTotalCredit.toFixed(2)),
    ledgerTotalDebit: Number(ledgerTotalDebit.toFixed(2)),
    ledgerCreditBalance,
    customerBills: customerParticulars.map((p) => ({
      _id: String(p._id),
      billNo: p.billNo,
      date: p.date,
      companyName: p.companyName || '-',
      caseCount: p.caseCount || '0',
      amount: p.amount,
      discount: p.discount,
      packing: p.packing,
      tax: p.tax,
      total: p.total,
      netTotal: getParticularNetTotal(p),
      products: p.products || [],
    })),
    transactionHistory: transactionHistory.reverse(), // most recent first for UI tables
  };
};

export interface PendingCasesData {
  grandTotalPendingCases: number;
  grandTotalPendingAmount: number;
  customerPendingMap: Map<string, number>;
  customerDeliveredMap: Map<string, number>;
  customerCompanyPendingMap: Map<string, number>;
  performaPendingMap: Map<string, number>;
  customerCases: any[];
  companyCases: any[];
}

/**
 * Unified calculation of Pending Cases across all active Performas.
 * Guarantees exact case count synchronization between the Pending Cases Dashboard
 * and the Pending Cases column in the Particular Details table.
 */
export const calculatePendingCasesData = async (options?: {
  customerName?: string;
  companyName?: string;
  search?: string;
}): Promise<PendingCasesData> => {
  const { customerName, companyName, search } = options || {};

  // Fetch all non-cancelled performas
  const filter: any = {
    status: { $nin: ['CANCELLED', 'cancelled'] },
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

  const registeredCompanies = await Company.find({}).lean();
  const companyMetaMap = new Map<string, any>();
  for (const comp of registeredCompanies) {
    if (comp.name) {
      companyMetaMap.set(comp.name.trim().toLowerCase(), comp);
    }
  }

  const customerMap = new Map<string, any>();
  const companyMap = new Map<string, any>();
  const customerPendingMap = new Map<string, number>();
  const customerDeliveredMap = new Map<string, number>();
  const customerCompanyPendingMap = new Map<string, number>();
  const performaPendingMap = new Map<string, number>();

  let grandTotalPendingCases = 0;
  let grandTotalPendingAmount = 0;

  for (const perf of performas) {
    const rawCustName = (perf.customerSnapshot?.name || (perf as any).customerName || 'Unknown Customer').trim();
    const custKey = rawCustName.toLowerCase();
    const custPhone = (perf.customerSnapshot?.phone || '').trim();
    const custId = perf.customerId ? String(perf.customerId).trim() : '';

    if (!customerMap.has(custKey)) {
      customerMap.set(custKey, {
        customerId: custId || undefined,
        customerName: rawCustName,
        customerPhone: custPhone,
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
    if (perf.performaNumber && !custEntry.performaNumbers.includes(perf.performaNumber)) {
      custEntry.performaNumbers.push(perf.performaNumber);
      custEntry.performasCount++;
    }

    let perfTotalPending = 0;

    for (const item of (perf.products || [])) {
      const reqCases = Math.max(0, Number(item.requiredCases) || 0);
      const usedCases = Math.max(0, Number(item.usedCases) || 0);
      let remainingCases = 0;
      if (item.remainingCases !== undefined && item.remainingCases !== null && !isNaN(Number(item.remainingCases))) {
        remainingCases = Math.max(0, Number(item.remainingCases));
      } else {
        remainingCases = Math.max(0, reqCases - usedCases);
      }

      if (remainingCases <= 0) continue;

      perfTotalPending += remainingCases;
      grandTotalPendingCases += remainingCases;

      const rate = Math.max(0, Number(item.rate) || 0);
      const remainingAmt = item.remainingAmount ? Number(item.remainingAmount) : remainingCases * rate;
      grandTotalPendingAmount += remainingAmt;

      const prodName = item.productSnapshot?.productName || 'Unknown Product';
      const prodCode = item.productSnapshot?.productCode || '';
      const category = item.productSnapshot?.category || '';
      const itemCompany = (
        item.productSnapshot?.companyName?.trim() ||
        (item as any).companyName?.trim() ||
        (item as any).company?.trim() ||
        (item as any).brand?.trim() ||
        perf.companyName?.trim() ||
        (perf as any).company?.trim() ||
        'General'
      );

      // If filtering by specific companyName, ignore items from other companies
      if (companyName && typeof companyName === 'string' && companyName.trim() !== '' && companyName.toLowerCase() !== 'all') {
        if (itemCompany.toLowerCase() !== companyName.trim().toLowerCase()) {
          continue;
        }
      }

      // Update customer entry
      custEntry.totalPendingCases += remainingCases;
      custEntry.totalPendingAmount += remainingAmt;
      custEntry.totalRequiredCases += reqCases;
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
        requiredCases: reqCases,
        usedCases,
        remainingCases,
        rate,
        pktPerUnit: Number(item.pktPerUnit) || 1,
        remainingAmount: remainingAmt,
      });

      // Customer-Company map
      const compKey = itemCompany.toLowerCase();
      const custCompKey = `${custKey}___${compKey}`;
      customerCompanyPendingMap.set(custCompKey, (customerCompanyPendingMap.get(custCompKey) || 0) + remainingCases);

      // Company entry
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
          totalRequiredCases: 0,
          totalUsedCases: 0,
          totalStockAmount: 0,
          totalGivenAmount: 0,
          customersWaiting: new Set<string>(),
          productSummaries: new Map(),
          items: [],
        });
      }

      const compEntry = companyMap.get(compKey)!;
      compEntry.totalPendingCases += remainingCases;
      compEntry.totalPendingAmount += remainingAmt;
      compEntry.totalRequiredCases = (compEntry.totalRequiredCases || 0) + reqCases;
      compEntry.totalUsedCases = (compEntry.totalUsedCases || 0) + usedCases;
      compEntry.totalStockAmount = (compEntry.totalStockAmount || 0) + (reqCases * rate);
      compEntry.totalGivenAmount = (compEntry.totalGivenAmount || 0) + (usedCases * rate);
      compEntry.customersWaiting.add(rawCustName);

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
          totalStockCases: 0,
          totalGivenCases: 0,
          totalBalanceCases: 0,
          rate,
          estimatedAmount: 0,
          balanceAmount: 0,
          customers: [],
        });
      }
      const prodSummary = compEntry.productSummaries.get(prodKey)!;
      prodSummary.totalRemainingCases += remainingCases;
      prodSummary.totalBalanceCases += remainingCases;
      prodSummary.totalRequiredCases += reqCases;
      prodSummary.totalStockCases += reqCases;
      prodSummary.totalUsedCases += usedCases;
      prodSummary.totalGivenCases += usedCases;
      prodSummary.estimatedAmount += remainingAmt;
      prodSummary.balanceAmount += remainingAmt;
      prodSummary.customers.push({
        customerName: rawCustName,
        customerPhone: custPhone,
        performaNumber: perf.performaNumber,
        remainingCases,
        balanceCases: remainingCases,
        requiredCases: reqCases,
        givenCases: usedCases,
        date: perf.date,
      });

      // Raw item under company
      compEntry.items.push({
        performaId: String(perf._id),
        performaNumber: perf.performaNumber,
        performaDate: perf.date,
        customerName: rawCustName,
        customerPhone: custPhone,
        productId: item.productId ? String(item.productId) : undefined,
        productName: prodName,
        productCode: prodCode,
        category,
        remainingCases,
        requiredCases: reqCases,
        usedCases,
        orderedCases: reqCases,
        givenCases: usedCases,
        balanceCases: remainingCases,
        rate,
        remainingAmount: remainingAmt,
        balanceAmount: remainingAmt,
      });
    }

    // Set performa mapping
    performaPendingMap.set(String(perf._id), perfTotalPending);
    if (perf.performaNumber) {
      performaPendingMap.set(perf.performaNumber.trim().toUpperCase(), perfTotalPending);
      performaPendingMap.set(perf.performaNumber.trim().toLowerCase(), perfTotalPending);
      performaPendingMap.set(perf.performaNumber.trim(), perfTotalPending);
    }
  }

  // Populate customerPendingMap and customerDeliveredMap with various customer aliases (name, digits, id)
  for (const [cKey, cEntry] of customerMap.entries()) {
    customerPendingMap.set(cKey, cEntry.totalPendingCases);
    customerDeliveredMap.set(cKey, cEntry.totalUsedCases);
    if (cEntry.customerPhone) {
      const cleanPhone = cEntry.customerPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length >= 7) {
        customerPendingMap.set(cleanPhone, cEntry.totalPendingCases);
        customerDeliveredMap.set(cleanPhone, cEntry.totalUsedCases);
      }
    }
    const cleanNameDigits = cEntry.customerName.replace(/[^0-9]/g, '');
    if (cleanNameDigits.length >= 7) {
      customerPendingMap.set(cleanNameDigits, cEntry.totalPendingCases);
      customerDeliveredMap.set(cleanNameDigits, cEntry.totalUsedCases);
    }
    if (cEntry.customerId) {
      customerPendingMap.set(cEntry.customerId, cEntry.totalPendingCases);
      customerDeliveredMap.set(cEntry.customerId, cEntry.totalUsedCases);
    }
  }

  // Customer cases array (only customers with pending cases)
  let customerCases = Array.from(customerMap.values())
    .filter((c) => c.totalPendingCases > 0)
    .sort((a, b) => b.totalPendingCases - a.totalPendingCases);

  // Company cases array (only companies with pending cases)
  let companyCases = Array.from(companyMap.values())
    .filter((c) => c.totalPendingCases > 0)
    .map((c) => {
      const stockCases = c.totalRequiredCases || (c.totalPendingCases + (c.totalUsedCases || 0));
      const givenCases = c.totalUsedCases || 0;
      const balanceCases = c.totalPendingCases;
      const stockAmt = c.totalStockAmount || (c.totalPendingAmount + (c.totalGivenAmount || 0));
      const givenAmt = c.totalGivenAmount || 0;
      const balanceAmt = c.totalPendingAmount;
      const pct = stockCases > 0 ? Math.round((givenCases / stockCases) * 100) : 0;

      return {
        companyName: c.companyName,
        companyId: c.companyId,
        address: c.address,
        gstin: c.gstin,
        avatarLetter: c.avatarLetter,
        avatarBg: c.avatarBg,
        avatarColor: c.avatarColor,
        totalStockCases: stockCases,
        totalGivenCases: givenCases,
        totalBalanceCases: balanceCases,
        totalStockAmount: stockAmt,
        totalGivenAmount: givenAmt,
        totalBalanceAmount: balanceAmt,
        deliveryPercentage: pct,
        totalPendingCases: c.totalPendingCases,
        totalPendingAmount: c.totalPendingAmount,
        customersCount: c.customersWaiting.size,
        customersWaitingNames: Array.from(c.customersWaiting),
        productSummaries: Array.from(c.productSummaries.values()).sort(
          (a: any, b: any) => b.totalRemainingCases - a.totalRemainingCases
        ),
        items: c.items.sort((a: any, b: any) => b.remainingCases - a.remainingCases),
      };
    })
    .sort((a: any, b: any) => b.totalPendingCases - a.totalPendingCases);

  // Filter by search term if provided
  if (search && typeof search === 'string' && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    customerCases = customerCases.filter((c) =>
      c.customerName.toLowerCase().includes(q) ||
      c.customerPhone.toLowerCase().includes(q) ||
      c.customerCompany.toLowerCase().includes(q) ||
      c.items.some((item: any) =>
        item.productName.toLowerCase().includes(q) ||
        item.productCode.toLowerCase().includes(q) ||
        item.companyName.toLowerCase().includes(q) ||
        item.performaNumber.toLowerCase().includes(q)
      )
    );

    companyCases = companyCases.filter((c) =>
      c.companyName.toLowerCase().includes(q) ||
      c.productSummaries.some((p: any) => p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q)) ||
      c.items.some((i: any) => i.customerName.toLowerCase().includes(q) || i.performaNumber.toLowerCase().includes(q))
    );
  }

  return {
    grandTotalPendingCases,
    grandTotalPendingAmount,
    customerPendingMap,
    customerDeliveredMap,
    customerCompanyPendingMap,
    performaPendingMap,
    customerCases,
    companyCases,
  };
};

