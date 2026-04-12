// backend/src/routes/systemSettingsRoutes.ts
import { Router } from 'express';
import { getSystemSettings, updateSystemSettings } from '../controllers/systemSettingsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken(), getSystemSettings);
router.put('/', authenticateToken(), updateSystemSettings);

export default router;
