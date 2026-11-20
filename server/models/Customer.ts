import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  idCode?: string;
  name: string;
  avatarLetter?: string;
  avatarBg?: string;
  avatarColor?: string;
  address: string;
  mobile: string;
  gst: string;
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
    avatarBg: { type: String, default: '#D1FAE5' },
    avatarColor: { type: String, default: '#047857' },
    address: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    gst: { type: String, required: true, trim: true },
    isLoginEnabled: { type: Boolean, default: true },
    loginPassword: { type: String, trim: true },
    hasCustomPassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
