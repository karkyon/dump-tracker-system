// backend/src/routes/systemSettingsRoutes.ts
import { Router } from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
  getIntegrationSettings,
  saveFirebaseSettings,
  deleteFirebaseSettings,
  saveGoogleRoutesSettings,
  deleteGoogleRoutesSettings,
} from '../controllers/systemSettingsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// 既存ルート（保持）
router.get('/', authenticateToken(), getSystemSettings);
router.put('/', authenticateToken(), updateSystemSettings);

// 連携設定ルート（ADMIN専用）
router.get('/integration',             authenticateToken(), requireAdmin, getIntegrationSettings);
router.put('/integration/firebase',    authenticateToken(), requireAdmin, saveFirebaseSettings);
router.delete('/integration/firebase', authenticateToken(), requireAdmin, deleteFirebaseSettings);
router.put('/integration/google-routes',    authenticateToken(), requireAdmin, saveGoogleRoutesSettings);
router.delete('/integration/google-routes', authenticateToken(), requireAdmin, deleteGoogleRoutesSettings);

export default router;
