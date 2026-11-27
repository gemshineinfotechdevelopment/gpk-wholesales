import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId?: mongoose.Types.ObjectId | string;
  slNo?: number;
  productName: string;
  code?: string;
  company?: string;
  category?: string;
  caseCount?: number;
  rate: number;
  pktUnit?: string;
  quantity: number;
  total: number;
}

export type OrderStatus = 'PENDING' | 'SEEN' | 'VERIFIED' | 'SENT' | 'APPROVED' | 'COMPLETED' | 'REJECTED';

export interface ICustomerOrder extends Document {
  orderNumber: string;
  customerId?: mongoose.Types.ObjectId | string;
  customerName: string;
  customerMobile?: string;
  customerAddress?: string;
  companyName?: string;
  products: IOrderItem[];
  totalCases: number;
  totalAmount: number;
  status: OrderStatus;
  date: string;
  notes?: string;
  performaId?: string;
  performaNumber?: string;
  isApproved?: boolean;
  approvedForAdmin?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema: Schema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  slNo: { type: Number, default: 0 },
  productName: { type: String, required: true, trim: true },
  code: { type: String, trim: true, default: '' },
  company: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: '' },
  caseCount: { type: Number, default: 0 },
  rate: { type: Number, required: true, default: 0 },
  pktUnit: { type: String, trim: true, default: '1' },
  quantity: { type: Number, required: true, min: 1 },
  total: { type: Number, required: true, default: 0 },
});

const CustomerOrderSchema: Schema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true, trim: true },
    customerMobile: { type: String, trim: true, default: '' },
    customerAddress: { type: String, trim: true, default: '' },
    companyName: { type: String, trim: true, default: '' },
    products: { type: [OrderItemSchema], default: [] },
    totalCases: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'SEEN', 'VERIFIED', 'SENT', 'APPROVED', 'COMPLETED', 'REJECTED'],
      default: 'PENDING',
    },
    date: { type: String, required: true },
    notes: { type: String, trim: true, default: '' },
    performaId: { type: String, trim: true, default: '' },
    performaNumber: { type: String, trim: true, default: '' },
    isApproved: { type: Boolean, default: false, index: true },
    approvedForAdmin: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const CustomerOrder = mongoose.model<ICustomerOrder>('CustomerOrder', CustomerOrderSchema);
