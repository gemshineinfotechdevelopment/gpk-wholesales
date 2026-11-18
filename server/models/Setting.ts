import mongoose, { Schema, Document } from 'mongoose';

export interface ISetting extends Document {
  companyName: string;
  tagline: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  gstin?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
  billTerms?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingSchema: Schema = new Schema(
  {
    companyName: { type: String, default: 'GPK Crackers', trim: true },
    tagline: { type: String, default: 'Wholesales • Sivakasi', trim: true },
    logoUrl: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: 'info@gpkcrackers.com', trim: true },
    address: { type: String, default: 'Sivakasi, Tamil Nadu', trim: true },
    city: { type: String, default: 'Sivakasi', trim: true },
    pincode: { type: String, default: '', trim: true },
    gstin: { type: String, default: '', trim: true },
    bankName: { type: String, default: '', trim: true },
    accountNumber: { type: String, default: '', trim: true },
    ifscCode: { type: String, default: '', trim: true },
    branchName: { type: String, default: '', trim: true },
    upiId: { type: String, default: '', trim: true },
    billTerms: {
      type: String,
      default: '1. Goods once sold cannot be taken back.\n2. Subject to Sivakasi Jurisdiction.',
      trim: true,
    },
  },
  { timestamps: true }
);

export const Setting = mongoose.model<ISetting>('Setting', SettingSchema);
