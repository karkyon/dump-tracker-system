// backend/src/routes/inspectionRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const getInspectionController = () => {
  try {
    const controller = require('../controllers/inspectionController');
    return controller.default || controller;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('inspectionController not found or invalid:', message);
    return null;
  }
};

const inspectionController = getInspectionController();

if (inspectionController) {
  router.use(authenticateToken);
  
  if (inspectionController.getAllInspections) {
    router.get('/', asyncHandler(inspectionController.getAllInspections));
  }
  
  if (inspectionController.getInspectionById) {
    router.get('/:id', validateId, asyncHandler(inspectionController.getInspectionById));
  }
  
  console.log('✓ 点検ルート登録完了');
} else {
  router.use(authenticateToken);
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: '点検機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  console.log('⚠️ 点検コントローラーが見つからないため、フォールバックルートを設定しました');
}

export default router;
