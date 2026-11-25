const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cleanNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const getParticularNetTotal = (p) => {
  if (!p) return 0;
  const storedTotal = cleanNumber(p.total);

  const prodSubtotal = (p.products || []).reduce((acc, item) => {
    const a = cleanNumber(item.amount);
    const q = cleanNumber(item.quantity);
    const r = cleanNumber(item.rate);
    const u = cleanNumber(item.pktUnit || item.pktPerUnit) || 1;
    return acc + (a > 0 ? a : q * r * u);
  }, 0);

  const subtotal = prodSubtotal > 0 ? prodSubtotal : cleanNumber(p.amount);

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

  let packingAmt = 0;
  const packStr = String(p.packing || '0').trim();
  const packNum = cleanNumber(packStr);
  const isPackFlat = packStr.startsWith('₹') || packStr.toLowerCase().includes('rs');
  if (packStr.includes('%') || (!isPackFlat && packNum > 0 && packNum <= 100)) {
    packingAmt = (baseAfterDisc * packNum) / 100;
  } else {
    packingAmt = packNum;
  }

  let taxAmt = 0;
  const taxStr = String(p.tax || '0').trim();
  const taxNum = cleanNumber(taxStr);
  const isTaxFlat = taxStr.startsWith('₹') || taxStr.toLowerCase().includes('rs');
  if (taxStr.includes('%') || (!isTaxFlat && taxNum > 0 && taxNum <= 100)) {
    const totalCases = cleanNumber(p.caseCount) || (Array.isArray(p.products) ? p.products.reduce((acc, item) => acc + cleanNumber(item.quantity), 0) : 0);
    taxAmt = (2500 * totalCases * taxNum) / 100;
  } else {
    taxAmt = taxNum;
  }

  const calculatedNet = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);
  if (storedTotal > 0) {
    return Number(storedTotal.toFixed(2));
  }
  return Number(calculatedNet.toFixed(2));
};

async function syncAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const particularsCol = mongoose.connection.db.collection('particulars');
  const ledgersCol = mongoose.connection.db.collection('accountledgers');

  const allParticulars = await particularsCol.find().toArray();
  console.log('Total particulars in DB:', allParticulars.length);

  const affectedCustomers = new Set();

  for (const p of allParticulars) {
    const total = getParticularNetTotal(p);
    if (total <= 0) continue;

    const existing = await ledgersCol.findOne({
      $or: [
        { particularId: String(p._id) },
        { 
          billNo: String(p.billNo).trim(),
          customerName: { $regex: new RegExp('^' + p.customerName.trim() + '$', 'i') },
          type: 'BILL'
        }
      ]
    });

    if (!existing) {
      console.log(`[SYNC] Creating missing ledger for Bill: #${p.billNo}, Customer: ${p.customerName}, Debit: ₹${total.toFixed(2)}`);
      await ledgersCol.insertOne({
        particularId: String(p._id),
        billNo: p.billNo || '',
        customerName: p.customerName,
        companyName: p.companyName || 'General',
        date: p.date,
        debit: total.toFixed(2),
        credit: '0.00',
        balance: '0.00',
        paymentMode: 'Bank',
        reference: '',
        notes: '',
        type: 'BILL',
        createdAt: p.createdAt || new Date(),
        updatedAt: new Date()
      });
      affectedCustomers.add(p.customerName);
    } else {
      if (!existing.particularId) {
        await ledgersCol.updateOne({ _id: existing._id }, { $set: { particularId: String(p._id) } });
      }
    }
  }

  // Recalculate balances for all affected customers
  for (const custName of affectedCustomers) {
    const entries = await ledgersCol.find({
      customerName: { $regex: new RegExp('^' + custName.trim() + '$', 'i') }
    }).sort({ createdAt: 1, _id: 1 }).toArray();

    let currentBalance = 0;
    for (const entry of entries) {
      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
      currentBalance = currentBalance + cred - deb;
      await ledgersCol.updateOne({ _id: entry._id }, { $set: { balance: currentBalance.toFixed(2) } });
    }
    console.log(`[BALANCE] Updated running balance for ${custName}: ₹${currentBalance.toFixed(2)}`);
  }

  // Also verify Heamanth ledger now
  const heamanthLedger = await ledgersCol.find({
    customerName: /Heamanth/i
  }).sort({ createdAt: 1 }).toArray();

  console.log('\n--- Heamanth Ledgers in DB after sync ---');
  heamanthLedger.forEach((l, idx) => {
    console.log(`${idx + 1}. Date: ${l.date} | BillNo: #${l.billNo || '-'} | Type: ${l.type} | Debit: ₹${l.debit} | Credit: ₹${l.credit} | Balance: ₹${l.balance}`);
  });

  process.exit(0);
}

syncAll().catch(e => { console.error(e); process.exit(1); });
