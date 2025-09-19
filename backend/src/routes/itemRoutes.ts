// backend/src/routes/itemRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const getItemController = () => {
  try {
    const controller = require('../controllers/itemController');
    return controller.default || controller;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('itemController not found or invalid:', message);
    return null;
  }
};

const itemController = getItemController();

if (itemController) {
  router.use(authenticateToken);
  
  if (itemController.getAllItems) {
    router.get('/', asyncHandler(itemController.getAllItems));
  }
  
  if (itemController.getItemById) {
    router.get('/:id', validateId, asyncHandler(itemController.getItemById));
  }
  
  console.log('✓ 品目ルート登録完了');
} else {
  router.use(authenticateToken);
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: '品目機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  console.log('⚠️ 品目コントローラーが見つからないため、フォールバックルートを設定しました');
}

export default router;
