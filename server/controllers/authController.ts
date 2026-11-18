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
      customer.hasCustomPassword = true;

      // Upsert linked user account in Admin collection
      await Admin.findOneAndUpdate(
        { customerId: String(customer._id) },
        {
          username: cleanMobile.slice(-10) || cleanMobile,
          password: hashPassword(cleanPass),
          role: 'user',
          customerName: customer.name,
          customerId: String(customer._id),
          mobile: customer.mobile,
        },
        { upsert: true, new: true }
      );
    } else if (customer.isLoginEnabled && !customer.loginPassword) {
      // Default initial password to the mobile number
      const defaultPass = cleanMobile.slice(-10) || cleanMobile;
      customer.loginPassword = hashPassword(defaultPass);
      customer.hasCustomPassword = false;

      await Admin.findOneAndUpdate(
        { customerId: String(customer._id) },
        {
          username: cleanMobile.slice(-10) || cleanMobile,
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
    const clean10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    const cleanPassword = String(password).trim();
    const hashedPassword = hashPassword(cleanPassword);

    // 1. Check Super Admin & Admin accounts first
    let adminDoc = await Admin.findOne({
      $or: [
        { username: cleanUsername, role: { $in: ['superadmin', 'admin'] } },
        { role: 'superadmin', username: 'superadmin' },
      ],
    });

    // Auto-seed fallback for superadmin / admin on initial setup
    if (!adminDoc) {
      if (cleanUsername === 'superadmin' && (cleanPassword === 'superadmin123' || cleanPassword === 'gpk123')) {
        adminDoc = await Admin.create({
          username: 'superadmin',
          password: hashedPassword,
          role: 'superadmin',
        });
      } else if (cleanUsername === 'admin' && (cleanPassword === 'admin123' || cleanPassword === 'admin')) {
        adminDoc = await Admin.create({
          username: 'admin',
          password: hashedPassword,
          role: 'admin',
        });
      }
    }

    if (adminDoc && (cleanUsername === adminDoc.username || cleanUsername === 'superadmin' || cleanUsername === 'admin')) {
      const isMatch = adminDoc.password === hashedPassword || adminDoc.password === cleanPassword;
      if (!isMatch) {
        res.status(401).json({ success: false, error: 'Invalid username or password' });
        return;
      }

      const assignedRole = adminDoc.role === 'superadmin' || adminDoc.username === 'superadmin' ? 'superadmin' : 'admin';
      const token = crypto.randomBytes(32).toString('hex');
      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          username: adminDoc.username,
          role: assignedRole,
        },
      });
      return;
    }

    // 2. Customer Authentication: Search in Customer Collection
    // Match by 10-digit mobile, full mobile digits, exact customer name, or idCode
    const customer = await Customer.findOne({
      $or: [
        clean10.length >= 7 ? { mobile: { $regex: clean10 } } : null,
        cleanDigits.length >= 7 ? { mobile: { $regex: cleanDigits } } : null,
        { name: { $regex: new RegExp(`^${rawInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { idCode: rawInput.toUpperCase() },
      ].filter(Boolean) as any[],
    });

    if (customer) {
      const customerCleanPhone = (customer.mobile || '').replace(/\D/g, '');
      const customerClean10 = customerCleanPhone.slice(-10);

      // Check password:
      // If customer has set their own password (hasCustomPassword === true):
      // Only that password is accepted!
      // If first-time login (!hasCustomPassword):
      // The password MUST be their registered mobile number!
      const hasCustom = Boolean(customer.hasCustomPassword);

      let isMatch = false;
      if (hasCustom) {
        isMatch = customer.loginPassword === hashedPassword || customer.loginPassword === cleanPassword;
      } else {
        const matchesMobile =
          cleanPassword === customerClean10 ||
          cleanPassword === customerCleanPhone ||
          cleanPassword === customer.mobile.trim() ||
          (customer.loginPassword && (customer.loginPassword === hashedPassword || customer.loginPassword === cleanPassword));

        isMatch = Boolean(matchesMobile);
      }

      if (!isMatch) {
        if (!hasCustom) {
          res.status(401).json({
            success: false,
            error: 'Invalid password. For first-time login, please enter your registered 10-digit mobile number as password.',
          });
        } else {
          res.status(401).json({
            success: false,
            error: 'Invalid password. Please enter the password you set.',
          });
        }
        return;
      }

      // Auto-enable customer login state
      customer.isLoginEnabled = true;
      if (!customer.loginPassword) {
        customer.loginPassword = hashPassword(customerClean10 || customerCleanPhone);
      }
      await customer.save();

      // Sync into Admin collection for unified session
      await Admin.findOneAndUpdate(
        { $or: [{ customerId: String(customer._id) }, { username: customerClean10 }] },
        {
          username: customerClean10 || customer.mobile,
          password: customer.loginPassword,
          role: 'user',
          customerName: customer.name,
          customerId: String(customer._id),
          mobile: customer.mobile,
        },
        { upsert: true, new: true }
      );

      const token = crypto.randomBytes(32).toString('hex');
      res.status(200).json({
        success: true,
        message: 'Customer login successful',
        token,
        user: {
          username: customerClean10 || customer.mobile,
          role: 'user',
          customerName: customer.name,
          customerId: String(customer._id),
          mobile: customer.mobile,
        },
      });
      return;
    }

    res.status(401).json({ success: false, error: 'Invalid credentials. Mobile number not registered or incorrect password.' });
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
    const { customerId, mobile, newPassword } = req.body;

    if (!newPassword || String(newPassword).trim().length < 4) {
      res.status(400).json({ success: false, error: 'Password must be at least 4 characters long' });
      return;
    }

    let customer = null;
    if (customerId) {
      customer = await Customer.findById(customerId);
    }
    if (!customer && mobile) {
      const cleanDigits = String(mobile).replace(/\D/g, '');
      const clean10 = cleanDigits.slice(-10);
      customer = await Customer.findOne({
        $or: [
          clean10.length >= 7 ? { mobile: { $regex: clean10 } } : null,
          { name: String(mobile).trim() }
        ].filter(Boolean) as any[]
      });
    }

    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer record not found. Please log in again.' });
      return;
    }

    const cleanPass = String(newPassword).trim();
    customer.loginPassword = hashPassword(cleanPass);
    customer.hasCustomPassword = true;
    customer.isLoginEnabled = true;
    await customer.save();

    // Also sync in Admin collection
    const cleanCustomerMobile = (customer.mobile || '').replace(/[^0-9]/g, '');
    const clean10 = cleanCustomerMobile.slice(-10);
    await Admin.findOneAndUpdate(
      { $or: [{ customerId: String(customer._id) }, { username: clean10 }] },
      {
        username: clean10 || customer.mobile,
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
      message: 'Password updated successfully! Please use this new password on your next login.',
      customerId: String(customer._id),
    });
  } catch (error) {
    next(error);
  }
};
