import type { Request, Response, NextFunction } from 'express';
import { Setting } from '../models/Setting';
import { isCloudinaryConfigured, uploadToCloudinary } from '../config/cloudinary';

export const getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        companyName: 'GPK Crackers',
        tagline: 'Wholesales • Sivakasi',
        email: 'info@gpkcrackers.com',
        address: 'Sivakasi, Tamil Nadu',
        city: 'Sivakasi',
      });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting();
    }

    const {
      companyName,
      tagline,
      logoUrl,
      phone,
      email,
      address,
      city,
      pincode,
      gstin,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      upiId,
      billTerms,
    } = req.body;

    if (companyName !== undefined) settings.companyName = String(companyName).trim();
    if (tagline !== undefined) settings.tagline = String(tagline).trim();
    if (logoUrl !== undefined) settings.logoUrl = String(logoUrl).trim();
    if (phone !== undefined) settings.phone = String(phone).trim();
    if (email !== undefined) settings.email = String(email).trim();
    if (address !== undefined) settings.address = String(address).trim();
    if (city !== undefined) settings.city = String(city).trim();
    if (pincode !== undefined) settings.pincode = String(pincode).trim();
    if (gstin !== undefined) settings.gstin = String(gstin).trim();
    if (bankName !== undefined) settings.bankName = String(bankName).trim();
    if (accountNumber !== undefined) settings.accountNumber = String(accountNumber).trim();
    if (ifscCode !== undefined) settings.ifscCode = String(ifscCode).trim();
    if (branchName !== undefined) settings.branchName = String(branchName).trim();
    if (upiId !== undefined) settings.upiId = String(upiId).trim();
    if (billTerms !== undefined) settings.billTerms = String(billTerms).trim();

    await settings.save();
    res.status(200).json({ success: true, message: 'Settings updated successfully', data: settings });
  } catch (error) {
    next(error);
  }
};

export const uploadLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      res.status(400).json({ success: false, error: 'No image data provided' });
      return;
    }

    let finalUrl = imageBase64;
    if (isCloudinaryConfigured()) {
      try {
        const uploadRes = await uploadToCloudinary(imageBase64, 'gpk_crackers/branding', 'logo');
        finalUrl = uploadRes.secure_url;
      } catch (cloudErr) {
        console.warn('[Logo Upload] Cloudinary upload failed, storing directly:', cloudErr);
      }
    }

    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting();
    }
    settings.logoUrl = finalUrl;
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      data: { logoUrl: finalUrl },
    });
  } catch (error) {
    next(error);
  }
};
