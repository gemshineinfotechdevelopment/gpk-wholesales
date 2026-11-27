import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { CustomerOrder, type IOrderItem } from '../models/CustomerOrder';
import { Customer } from '../models/Customer';
import { Performa, type IPerformaProductItem } from '../models/Performa';
import { escapeRegex } from '../utils/ledgerUtils';

export const getOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userRole = ((req.headers['x-user-role'] as string) || '').toLowerCase();
    const headerCustName = (req.headers['x-customer-name'] as string) || '';
    const { customerName, status } = req.query;

    const filter: any = {};

    const targetCustomer = (customerName as string) || headerCustName || '';

    if (userRole === 'user' || (targetCustomer && targetCustomer !== 'ALL')) {
      if (targetCustomer && targetCustomer !== 'ALL') {
        const trimmed = targetCustomer.trim();
        const cleanDigits = trimmed.replace(/[^0-9]/g, '');
        let targetName = trimmed;
        if (cleanDigits.length >= 7) {
          const matchedCust = await Customer.findOne({ mobile: { $regex: cleanDigits, $options: 'i' } });
          if (matchedCust) {
            targetName = matchedCust.name;
          }
        }
        filter.$or = [
          { customerName: { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') } },
          { customerMobile: { $regex: cleanDigits || escapeRegex(targetName), $options: 'i' } },
        ];
      }
    }

    if (status && typeof status === 'string' && status.trim() && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    // Regular admin should ONLY see orders approved by Super Admin
    if (userRole === 'admin') {
      filter.approvedForAdmin = true;
    }

    const orders = await CustomerOrder.find(filter).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const order = await CustomerOrder.findById(req.params.id).lean();
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      customerName,
      customerMobile = '',
      customerAddress = '',
      companyName = '',
      products = [],
      date,
      notes = '',
    } = req.body;

    const finalCustomerName = (customerName || (req.headers['x-customer-name'] as string) || 'Customer').trim();

    // Filter valid products with quantity > 0
    const validItems: IOrderItem[] = [];
    let calculatedTotalCases = 0;
    let calculatedTotalAmount = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const qty = parseFloat(p.quantity) || 0;
      if (qty > 0) {
        const rate = parseFloat(p.rate) || 0;
        const pktUnit = p.pktUnit !== undefined && p.pktUnit !== null && String(p.pktUnit).trim() !== '' ? String(p.pktUnit).trim() : '1';
        const pktNum = parseFloat(pktUnit) || 1;
        const lineTotal = Number((qty * rate * pktNum).toFixed(2));

        calculatedTotalCases += qty;
        calculatedTotalAmount += lineTotal;

        validItems.push({
          productId: p.productId || p._id || p.id,
          slNo: p.slNo || validItems.length + 1,
          productName: (p.productName || p.name || 'Product').trim(),
          code: (p.code || '').trim(),
          company: (p.company || p.companyName || companyName || '').trim(),
          category: (p.category || '').trim(),
          caseCount: parseFloat(p.caseCount || p.case || 0) || 0,
          rate: rate,
          pktUnit: pktUnit,
          quantity: qty,
          total: lineTotal,
        });
      }
    }

    if (validItems.length === 0) {
      res.status(400).json({ success: false, error: 'Please enter a valid quantity for at least one product' });
      return;
    }

    // Generate unique Order Number
    const lastOrder = await CustomerOrder.findOne().sort({ createdAt: -1 }).select('orderNumber').lean();
    let maxNum = 0;
    if (lastOrder && lastOrder.orderNumber) {
      const match = lastOrder.orderNumber.match(/\d+/);
      if (match) maxNum = parseInt(match[0], 10);
    }
    const orderNumber = `ORD-${(maxNum + 1).toString().padStart(6, '0')}`;

    // Lookup customer in DB
    let customerDoc = await Customer.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(finalCustomerName)}$`, 'i') },
    }).lean();

    const finalMobile = customerMobile || customerDoc?.mobile || '';
    const finalAddress = customerAddress || customerDoc?.address || '';
    const finalDate = date || new Date().toISOString().split('T')[0];

    // Create the CustomerOrder record
    const newOrder = await CustomerOrder.create({
      orderNumber,
      customerId: customerDoc?._id,
      customerName: finalCustomerName,
      customerMobile: finalMobile,
      customerAddress: finalAddress,
      companyName: companyName || (validItems[0]?.company || ''),
      products: validItems,
      totalCases: calculatedTotalCases,
      totalAmount: Number(calculatedTotalAmount.toFixed(2)),
      status: 'PENDING',
      isApproved: false,
      approvedForAdmin: false,
      date: finalDate,
      notes: notes || `Online Order submitted by ${finalCustomerName}`,
    });

    // Also automatically create an ACTIVE Performa so it seamlessly integrates with Superadmin's All Performa, Pending Cases & Billing
    try {
      const allPerformas = await Performa.find({}, 'performaNumber');
      let maxPfNum = 0;
      for (const p of allPerformas) {
        if (p.performaNumber) {
          const match = p.performaNumber.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxPfNum) maxPfNum = num;
          }
        }
      }
      const performaNumber = `PF-${(maxPfNum + 1).toString().padStart(6, '0')}`;

      const performaProducts: IPerformaProductItem[] = validItems.map((item) => {
        const pktNum = parseFloat(item.pktUnit || '1') || 1;
        return {
          productId: item.productId && mongoose.Types.ObjectId.isValid(String(item.productId)) ? item.productId : undefined,
          productSnapshot: {
            productCode: item.code || '',
            productName: item.productName,
            companyName: item.company || companyName || '',
            category: item.category || '',
          },
          requiredCases: item.quantity,
          usedCases: 0,
          remainingCases: item.quantity,
          caseOut: 0,
          rate: item.rate,
          pktPerUnit: pktNum,
          allocatedAmount: item.total,
          usedAmount: 0,
          remainingAmount: item.total,
        };
      });

      const performaDoc = await Performa.create({
        performaNumber,
        customerId: customerDoc?._id || new mongoose.Types.ObjectId(),
        companyName: companyName || (validItems[0]?.company || ''),
        customerSnapshot: {
          name: finalCustomerName,
          phone: finalMobile,
          companyName: companyName || customerDoc?.name || '',
          address: finalAddress,
          gst: customerDoc?.gst || 'N/A',
        },
        advanceAmount: 0,
        advanceUsedAmount: 0,
        remainingAdvanceAmount: 0,
        products: performaProducts,
        totalRequiredCases: calculatedTotalCases,
        totalUsedCases: 0,
        totalRemainingCases: calculatedTotalCases,
        subtotal: Number(calculatedTotalAmount.toFixed(2)),
        discount: '0',
        discountAmount: 0,
        packing: '0',
        packingAmount: 0,
        tax: '0',
        taxAmount: 0,
        totalAllocatedAmount: Number(calculatedTotalAmount.toFixed(2)),
        totalUsedAmount: 0,
        totalRemainingAmount: Number(calculatedTotalAmount.toFixed(2)),
        status: 'ACTIVE',
        isApproved: false,
        approvedForAdmin: false,
        date: finalDate,
        notes: `Customer Online Order #${orderNumber}`,
        createdBy: 'Customer Order',
      });

      newOrder.performaId = String(performaDoc._id);
      newOrder.performaNumber = performaNumber;
      await newOrder.save();
    } catch (pfErr) {
      console.warn('Auto-creating performa from customer order warning:', pfErr);
    }

    res.status(201).json({
      success: true,
      message: `Order #${orderNumber} placed successfully!`,
      data: newOrder,
    });
  } catch (error: any) {
    console.error('Create Order Error:', error);
    res.status(400).json({ success: false, error: error?.message || 'Failed to place order' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'SEEN', 'VERIFIED', 'SENT', 'APPROVED', 'COMPLETED', 'REJECTED'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid order status' });
      return;
    }

    const isRejectedStatus = status === 'REJECTED';

    const order = await CustomerOrder.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    order.status = status;
    if (isRejectedStatus) {
      order.approvedForAdmin = false;
      order.isApproved = false;
    }
    await order.save();

    // Sync approval state to linked performa
    if (order.performaId) {
      if (isRejectedStatus) {
        await Performa.findByIdAndUpdate(order.performaId, { isApproved: false, approvedForAdmin: false, status: 'CANCELLED' }).catch(() => {});
      } else if (order.approvedForAdmin) {
        await Performa.findByIdAndUpdate(order.performaId, { isApproved: true, approvedForAdmin: true, status: 'ACTIVE' }).catch(() => {});
      }
    }

    res.status(200).json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    next(error);
  }
};

export const updateOrderApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { approvedForAdmin } = req.body;
    const isApproved = Boolean(approvedForAdmin);
    const order = await CustomerOrder.findByIdAndUpdate(
      req.params.id,
      {
        approvedForAdmin: isApproved,
        isApproved: isApproved,
      },
      { new: true }
    );

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    if (order.performaId) {
      await Performa.findByIdAndUpdate(order.performaId, {
        isApproved: isApproved,
        approvedForAdmin: isApproved,
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: isApproved ? 'Order approved for Admin view' : 'Admin view permission revoked',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const order = await CustomerOrder.findByIdAndDelete(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    // Optionally also remove linked performa if pending
    if (order.performaId) {
      await Performa.findByIdAndDelete(order.performaId).catch(() => {});
    }

    res.status(200).json({ success: true, message: 'Order deleted successfully', data: {} });
  } catch (error) {
    next(error);
  }
};
