import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  idCode?: string;
  name: string;
  avatarLetter?: string;
  avatarBg?: string;
  avatarColor?: string;
  address: string;
  state?: string;
  mobile: string;
  gst: string;
  taxIdType?: string;
  taxIdNumber?: string;
  isLoginEnabled?: boolean;
  loginPassword?: string;
  hasCustomPassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema = new Schema(
  {
    idCode: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    avatarLetter: { type: String, trim: true },
    avatarBg: { type: String, default: '#BAE6FD' },
    avatarColor: { type: String, default: '#1D4ED8' },
    address: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    mobile: { type: String, required: true, trim: true },
    gst: { type: String, default: 'N/A', trim: true },
    taxIdType: { type: String, trim: true, default: 'GSTIN' },
    taxIdNumber: { type: String, trim: true, default: '' },
    isLoginEnabled: { type: Boolean, default: true },
    loginPassword: { type: String, trim: true },
    hasCustomPassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
