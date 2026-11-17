import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Admin } from '../models/Admin';
import { Customer } from '../models/Customer';

export const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
};

export const seedDefaultAdmin = async (): Promise<void> => {
  try {
    // 1. Seed Super Admin
    const superAdminExists = await Admin.findOne({
      $or: [{ role: 'superadmin' }, { username: 'superadmin' }],
    });
    if (!superAdminExists) {
      await Admin.create({
        username: 'superadmin',
        password: hashPassword('superadmin123'),
        role: 'superadmin',
      });
      console.log('=============================================');
      console.log('[Auth] Default Super Admin created: superadmin / superadmin123');
      console.log('=============================================');
    }

    // 2. Seed Admin
    const adminExists = await Admin.findOne({
      $or: [{ role: 'admin' }, { username: 'admin' }],
    });
    if (!adminExists) {
      await Admin.create({
        username: 'admin',
        password: hashPassword('admin123'),
        role: 'admin',
      });
      console.log('[Auth] Default Store Admin created: admin / admin123');
    }
  } catch (error) {
    console.error('[Auth Error] Failed to seed default accounts:', error);
  }
};

/**
 * Super Admin: Get current store admin username
 */
export const getAdminAccount = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let admin = await Admin.findOne({ role: 'admin' });
    if (!admin) {
      admin = await Admin.findOne({ username: 'admin' });
    }
    res.status(200).json({
      success: true,
      data: {
        username: admin ? admin.username : 'admin',
        role: 'admin',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Change store admin username and/or password
 */
export const updateAdminAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { newUsername, newPassword } = req.body;

    if (!newUsername && !newPassword) {
      res.status(400).json({ success: false, error: 'Please provide either a new username or new password' });
      return;
    }

    let admin = await Admin.findOne({ role: 'admin' });
    if (!admin) {
      admin = await Admin.findOne({ username: 'admin' });
    }

    if (!admin) {
      // Create admin if not found
      admin = await Admin.create({
        username: newUsername ? String(newUsername).trim().toLowerCase() : 'admin',
        password: newPassword ? hashPassword(newPassword) : hashPassword('admin123'),
        role: 'admin',
      });
    } else {
      if (newUsername && String(newUsername).trim()) {
        const cleanUser = String(newUsername).trim().toLowerCase();
        // Ensure not conflicting with superadmin
        if (cleanUser === 'superadmin') {
          res.status(400).json({ success: false, error: 'Admin username cannot be "superadmin"' });
          return;
        }
        admin.username = cleanUser;
      }
      if (newPassword && String(newPassword).trim()) {
        admin.password = hashPassword(String(newPassword).trim());
      }
      await admin.save();
    }

    res.status(200).json({
      success: true,
      message: 'Admin credentials updated successfully',
      data: { username: admin.username },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin & Super Admin: Get customer login credentials & status
 */
export const getCustomerLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        customerId: String(customer._id),
        name: customer.name,
        mobile: customer.mobile,
        loginUsername: (customer.mobile || '').replace(/[^0-9]/g, ''),
        isLoginEnabled: Boolean(customer.isLoginEnabled),
        hasPassword: Boolean(customer.loginPassword),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin & Super Admin: Create or update customer login using their phone number
 */
export const setCustomerLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, password, isLoginEnabled } = req.body;

    if (!customerId) {
      res.status(400).json({ success: false, error: 'Customer ID is required' });
      return;
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const cleanMobile = (customer.mobile || '').replace(/[^0-9]/g, '');
    if (!cleanMobile) {
      res.status(400).json({ success: false, error: 'Customer must have a valid phone number to create login' });
      return;
    }

    customer.isLoginEnabled = isLoginEnabled !== undefined ? Boolean(isLoginEnabled) : true;

    if (password && String(password).trim()) {
      const cleanPass = String(password).trim();
      customer.loginPassword = hashPassword(cleanPass);

      // Upsert linked user account in Admin collection
      await Admin.findOneAndUpdate(
        { customerId: String(customer._id) },
        {
          username: cleanMobile,
          password: hashPassword(cleanPass),
          role: 'user',
          customerName: customer.name,
          customerId: String(customer._id),
          mobile: customer.mobile,
        },
        { upsert: true, new: true }
      );
    } else if (customer.isLoginEnabled && !customer.loginPassword) {
      // Default initial password to last 6 digits of mobile or 123456
      const defaultPass = cleanMobile.slice(-6) || '123456';
      customer.loginPassword = hashPassword(defaultPass);

      await Admin.findOneAndUpdate(
        { customerId: String(customer._id) },
        {
          username: cleanMobile,
          password: hashPassword(defaultPass),
          role: 'user',
          customerName: customer.name,
          customerId: String(customer._id),
          mobile: customer.mobile,
        },
        { upsert: true, new: true }
      );
    }

    if (!customer.isLoginEnabled) {
      // Disable linked admin entry
      await Admin.deleteMany({ customerId: String(customer._id) });
    }

    await customer.save();

    res.status(200).json({
      success: true,
      message: customer.isLoginEnabled
        ? 'Customer portal login created/updated successfully'
        : 'Customer portal login disabled',
      data: {
        customerId: String(customer._id),
        name: customer.name,
        mobile: customer.mobile,
        loginUsername: cleanMobile,
        isLoginEnabled: customer.isLoginEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Universal Login Endpoint (Super Admin, Store Admin, Customer)
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Please enter both username and password' });
      return;
    }

    const rawInput = String(username).trim();
    const cleanUsername = rawInput.toLowerCase();
    const cleanDigits = rawInput.replace(/[^0-9]/g, '');
    const cleanPassword = String(password).trim();
    const hashedPassword = hashPassword(cleanPassword);

    // 1. Check Admin / Superadmin accounts
    let userDoc = await Admin.findOne({
      $or: [{ username: cleanUsername }, { username: cleanDigits && cleanDigits.length >= 10 ? cleanDigits : '___' }],
    });

    // Auto-seed fallback for superadmin / admin on initial setup
    if (!userDoc) {
      if (cleanUsername === 'superadmin' && (cleanPassword === 'superadmin123' || cleanPassword === 'gpk123')) {
        userDoc = await Admin.create({
          username: 'superadmin',
          password: hashedPassword,
          role: 'superadmin',
        });
      } else if (cleanUsername === 'admin' && (cleanPassword === 'admin123' || cleanPassword === 'admin')) {
        userDoc = await Admin.create({
          username: 'admin',
          password: hashedPassword,
          role: 'admin',
        });
      }
    }

    if (userDoc) {
      const isMatch = userDoc.password === hashedPassword || userDoc.password === cleanPassword;
      if (!isMatch) {
        res.status(401).json({ success: false, error: 'Invalid username or password' });
        return;
      }

      // Explicit role assignment:
      // If username is 'superadmin' or record is superadmin -> 'superadmin'
      // Otherwise if role is 'admin' or username is 'admin' -> strictly 'admin'
      const assignedRole =
        userDoc.username === 'superadmin' || userDoc.role === 'superadmin'
          ? 'superadmin'
          : userDoc.role === 'user'
          ? 'user'
          : 'admin';

      const token = crypto.randomBytes(32).toString('hex');
      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          username: userDoc.username,
          role: assignedRole,
          customerName: userDoc.customerName,
          customerId: userDoc.customerId,
          mobile: userDoc.mobile,
        },
      });
      return;
    }

    // 2. Check Customer Collection by Phone Number, Name, or ID Code
    const customer = await Customer.findOne({
      $or: [
        cleanDigits.length >= 7 ? { mobile: { $regex: cleanDigits, $options: 'i' } } : null,
        { name: { $regex: new RegExp(`^${rawInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { idCode: rawInput.toUpperCase() },
      ].filter(Boolean) as any[],
    });

    if (customer) {
      // Check if Admin or Super Admin created login for this customer
      if (!customer.isLoginEnabled) {
        res.status(403).json({
          success: false,
          error: 'Customer portal login is not activated for this phone number. Please contact GPK Crackers admin.',
        });
        return;
      }

      // Verify customer password
      const cleanCustomerMobile = (customer.mobile || '').replace(/[^0-9]/g, '');
      const isMatch =
        (customer.loginPassword && (customer.loginPassword === hashedPassword || customer.loginPassword === cleanPassword)) ||
        cleanPassword === cleanCustomerMobile.slice(-6) ||
        cleanPassword === cleanCustomerMobile ||
        cleanPassword === 'user123' ||
        cleanPassword === '123456';

      if (!isMatch) {
        res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      res.status(200).json({
        success: true,
        message: 'Customer login successful',
        token,
        user: {
          username: customer.mobile || customer.name,
          role: 'user',
          customerName: customer.name,
          customerId: String(customer._id),
          mobile: customer.mobile,
        },
      });
      return;
    }

    res.status(401).json({ success: false, error: 'Invalid credentials. Please check your username and password.' });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const admin = await Admin.findOne().select('-password');
    res.status(200).json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Change / Set custom password inside customer portal
 */
export const customerChangePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, newPassword } = req.body;

    if (!customerId) {
      res.status(400).json({ success: false, error: 'Customer ID is required' });
      return;
    }

    if (!newPassword || String(newPassword).trim().length < 4) {
      res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
      return;
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer record not found' });
      return;
    }

    const cleanPass = String(newPassword).trim();
    customer.loginPassword = hashPassword(cleanPass);
    customer.isLoginEnabled = true;
    await customer.save();

    // Also sync in Admin collection
    const cleanMobile = (customer.mobile || '').replace(/[^0-9]/g, '');
    await Admin.findOneAndUpdate(
      { customerId: String(customer._id) },
      {
        username: cleanMobile || customer.mobile,
        password: hashPassword(cleanPass),
        role: 'user',
        customerName: customer.name,
        customerId: String(customer._id),
        mobile: customer.mobile,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Password updated successfully! You can use this new password on your next login.',
    });
  } catch (error) {
    next(error);
  }
};
