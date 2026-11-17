import { Router } from 'express';
import {
  login,
  getMe,
  getAdminAccount,
  updateAdminAccount,
  getCustomerLogin,
  setCustomerLogin,
  customerChangePassword,
} from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.get('/me', getMe);

// Super Admin: Admin Account Credentials
router.get('/admin-account', getAdminAccount);
router.put('/admin-account', updateAdminAccount);

// Admin & Super Admin: Customer Login Management
router.get('/customer-login/:customerId', getCustomerLogin);
router.post('/customer-login', setCustomerLogin);

// Customer: Self Password Change
router.post('/customer-change-password', customerChangePassword);

export default router;
