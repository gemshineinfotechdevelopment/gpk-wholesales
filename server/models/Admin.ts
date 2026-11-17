import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  username: string;
  password: string;
  role: 'superadmin' | 'admin' | 'user';
  customerName?: string;
  customerId?: string;
  mobile?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'admin', 'user'], default: 'admin' },
    customerName: { type: String, trim: true },
    customerId: { type: String, trim: true },
    mobile: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Admin = mongoose.model<IAdmin>('Admin', AdminSchema);
