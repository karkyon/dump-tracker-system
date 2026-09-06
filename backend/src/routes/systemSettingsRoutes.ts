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
  saveBacklogSettings,
  deleteBacklogSettings,
} from '../controllers/systemSettingsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken(), getSystemSettings);
router.put('/', authenticateToken(), updateSystemSettings);

router.get('/integration',             authenticateToken(), requireAdmin, getIntegrationSettings);
router.put('/integration/firebase',    authenticateToken(), requireAdmin, saveFirebaseSettings);
router.delete('/integration/firebase', authenticateToken(), requireAdmin, deleteFirebaseSettings);
router.put('/integration/google-routes',    authenticateToken(), requireAdmin, saveGoogleRoutesSettings);
router.delete('/integration/google-routes', authenticateToken(), requireAdmin, deleteGoogleRoutesSettings);
router.put('/integration/backlog',    authenticateToken(), requireAdmin, saveBacklogSettings);
router.delete('/integration/backlog', authenticateToken(), requireAdmin, deleteBacklogSettings);

export default router;
