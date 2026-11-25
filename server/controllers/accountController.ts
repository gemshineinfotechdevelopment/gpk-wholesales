import type { Request, Response, NextFunction } from 'express';
import { AccountLedger } from '../models/AccountLedger';
import { escapeRegex, recalculateCustomerBalance, syncMissingBillLedgers } from '../utils/ledgerUtils';

export const getAccountDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName } = req.query;
    const filter: any = {};
    let targetName: string | undefined;

    if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      const trimmed = customerName.trim();
      const cleanDigits = trimmed.replace(/[^0-9]/g, '');
      targetName = trimmed;
      if (cleanDigits.length >= 7) {
        const { Customer } = await import('../models/Customer');
        const matchedCust = await Customer.findOne({ mobile: { $regex: cleanDigits, $options: 'i' } });
        if (matchedCust) {
          targetName = matchedCust.name;
        }
      }
      filter.customerName = { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') };
    }

    // Auto-heal / synchronize any particular bills that might be missing from AccountLedger
    await syncMissingBillLedgers(targetName);

    const accounts = await AccountLedger.find(filter).sort({ createdAt: -1, _id: -1 });
    res.status(200).json({ success: true, count: accounts.length, data: accounts });
  } catch (error) {
    next(error);
  }
};

export const addCredit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.headers['x-user-role'] === 'user') {
      res.status(403).json({ success: false, error: 'Access denied. Customers are not allowed to add credits.' });
      return;
    }
    const { customerName, companyName, creditAmount, date, paymentMode, depositAccount, reference, notes } = req.body;

    const parsedCredit = parseFloat(String(creditAmount).replace(/,/g, '')) || 0;
    if (parsedCredit <= 0) {
      res.status(400).json({ success: false, error: 'Valid credit amount greater than 0 is required' });
      return;
    }

    const finalCustomerName = (customerName || 'General').trim();
    const finalPaymentMode = paymentMode && String(paymentMode).trim() ? String(paymentMode).trim() : 'Bank';
    const finalDepositAccount = depositAccount && String(depositAccount).trim() ? String(depositAccount).trim() : 'GPK Main Current A/C';

    const ledgerEntry = await AccountLedger.create({
      billNo: reference ? String(reference).trim() : '',
      customerName: finalCustomerName,
      companyName: companyName ? String(companyName).trim() : 'General',
      date: date || new Date().toISOString().split('T')[0],
      debit: '0.00',
      credit: parsedCredit.toFixed(2),
      balance: '0.00',
      paymentMode: finalPaymentMode,
      depositAccount: finalDepositAccount,
      reference: reference ? String(reference).trim() : '',
      notes: notes || `Payment received via ${finalPaymentMode} deposited to ${finalDepositAccount}`,
      type: 'CREDIT',
    });

    await recalculateCustomerBalance(finalCustomerName);

    res.status(201).json({
      success: true,
      message: 'Credit added successfully',
      data: ledgerEntry,
    });
  } catch (error: any) {
    console.error('[Add Credit Error]:', error);
    res.status(400).json({ success: false, error: error?.message || 'Failed to add credit' });
  }
};

export const deleteAccountEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.headers['x-user-role'] === 'user') {
      res.status(403).json({ success: false, error: 'Access denied. Customers are not allowed to delete account records.' });
      return;
    }
    const entry = await AccountLedger.findById(req.params.id);
    if (!entry) {
      res.status(404).json({ success: false, error: 'Account ledger entry not found' });
      return;
    }

    const customerName = entry.customerName;

    // If this entry was created from a particular bill, delete the corresponding particular bill as well
    const { Particular } = await import('../models/Particular');
    if (entry.particularId) {
      await Particular.findByIdAndDelete(entry.particularId);
    } else if (entry.billNo && entry.billNo.trim() !== '' && entry.type === 'BILL' && entry.customerName) {
      await Particular.findOneAndDelete({
        billNo: entry.billNo.trim(),
        customerName: { $regex: new RegExp(`^${escapeRegex(entry.customerName.trim())}$`, 'i') },
      });
    } else if (entry.type === 'BILL') {
      const matchCond: any = {
        customerName: { $regex: new RegExp(`^${escapeRegex(entry.customerName.trim())}$`, 'i') },
        date: entry.date,
      };
      if (entry.companyName && entry.companyName.trim() !== '') {
        matchCond.companyName = { $regex: new RegExp(`^${escapeRegex(entry.companyName.trim())}$`, 'i') };
      }
      await Particular.findOneAndDelete(matchCond);
    }

    await AccountLedger.findByIdAndDelete(req.params.id);

    // Recalculate running balances for this customer
    await recalculateCustomerBalance(customerName);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
