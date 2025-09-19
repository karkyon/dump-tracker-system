// backend/src/routes/locationRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const getLocationController = () => {
  try {
    const controller = require('../controllers/locationController');
    return controller.default || controller;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('locationController not found or invalid:', message);
    return null;
  }
};

const locationController = getLocationController();

if (locationController) {
  router.use(authenticateToken);
  
  if (locationController.getAllLocations) {
    router.get('/', asyncHandler(locationController.getAllLocations));
  }
  
  if (locationController.getLocationById) {
    router.get('/:id', validateId, asyncHandler(locationController.getLocationById));
  }
  
  console.log('✓ 場所ルート登録完了');
} else {
  router.use(authenticateToken);
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: '場所機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  console.log('⚠️ 場所コントローラーが見つからないため、フォールバックルートを設定しました');
}

export default router;
