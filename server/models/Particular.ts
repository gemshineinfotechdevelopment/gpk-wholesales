import mongoose, { Schema, Document } from 'mongoose';

export interface IParticularProductItem {
  particular: string;
  quantity: string;
  rate: string;
  pktUnit: string;
  amount: string;
  isAdditional?: boolean;
}

export interface IParticular extends Document {
  customerName: string;
  phone?: string;
  preparedBy?: string;
  caseCount: string;
  companyName?: string;
  discount: string;
  transport: string;
  packing: string;
  billNo: string;
  tax: string;
  amount: string;
  total: string;
  date: string;
  pdfData?: string;
  pdfName?: string;
  pdfPublicId?: string;
  products: IParticularProductItem[];
  performaId?: mongoose.Types.ObjectId | string;
  performaNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ParticularProductItemSchema: Schema = new Schema({
  particular: { type: String, required: true },
  quantity: { type: String, default: '' },
  rate: { type: String, default: '' },
  pktUnit: { type: String, default: '' },
  amount: { type: String, default: '' },
  isAdditional: { type: Boolean, default: false },
});

const ParticularSchema: Schema = new Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    preparedBy: { type: String, default: '', trim: true },
    caseCount: { type: String, default: '0' },
    companyName: { type: String, default: '', trim: true },
    discount: { type: String, default: '' },
    transport: { type: String, default: '' },
    packing: { type: String, default: '' },
    billNo: { type: String, required: true, trim: true },
    tax: { type: String, default: '' },
    amount: { type: String, default: '0.00' },
    total: { type: String, default: '0.00' },
    date: { type: String, required: true },
    pdfData: { type: String, default: '' },
    pdfName: { type: String, default: '' },
    pdfPublicId: { type: String, default: '' },
    performaId: { type: Schema.Types.ObjectId, ref: 'Performa', default: null },
    performaNumber: { type: String, default: '', trim: true },
    products: [ParticularProductItemSchema],
  },
  { timestamps: true }
);

export const Particular = mongoose.model<IParticular>('Particular', ParticularSchema);
