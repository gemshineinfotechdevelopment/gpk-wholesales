import { Router } from 'express';
import {
  login,
  getMe,
  getSuperAdminAccount,
  updateSuperAdminAccount,
  getAdminAccount,
  updateAdminAccount,
  getCustomerLogin,
  setCustomerLogin,
  customerChangePassword,
} from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.get('/me', getMe);

// Super Admin: Super Admin Account Credentials
router.get('/superadmin-account', getSuperAdminAccount);
router.put('/superadmin-account', updateSuperAdminAccount);

// Super Admin: Admin Account Credentials
router.get('/admin-account', getAdminAccount);
router.put('/admin-account', updateAdminAccount);

// Admin & Super Admin: Customer Login Management
router.get('/customer-login/:customerId', getCustomerLogin);
router.post('/customer-login', setCustomerLogin);

// Customer: Self Password Change
router.post('/customer-change-password', customerChangePassword);

export default router;
