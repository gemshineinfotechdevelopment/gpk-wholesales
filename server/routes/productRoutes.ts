import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkCreateProducts,
} from '../controllers/productController';

const router = Router();

router.route('/').get(getProducts).post(createProduct);
router.post('/bulk', bulkCreateProducts);
router.route('/:id').get(getProductById).put(updateProduct).delete(deleteProduct);

export default router;
