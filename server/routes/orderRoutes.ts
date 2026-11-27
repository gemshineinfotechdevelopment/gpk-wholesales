import { Router } from 'express';
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrderApproval,
  deleteOrder,
} from '../controllers/orderController';

const router = Router();

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id')
  .get(getOrderById)
  .delete(deleteOrder);

router.route('/:id/status')
  .put(updateOrderStatus);

router.route('/:id/approval')
  .put(updateOrderApproval);

export default router;
