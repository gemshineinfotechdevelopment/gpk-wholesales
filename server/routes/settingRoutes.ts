import { Router } from 'express';
import { getSettings, updateSettings, uploadLogo } from '../controllers/settingController';

const router = Router();

router.get('/', getSettings);
router.put('/', updateSettings);
router.post('/logo', uploadLogo);

export default router;
