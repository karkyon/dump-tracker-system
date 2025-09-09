// backend/src/routes/tripRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateTrip, validateId } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 安全なコントローラーimport
const getTripController = () => {
  try {
    const controller = require('../controllers/tripController');
    return controller.default || controller;
  } catch (error) {
    console.warn('tripController not found or invalid:', error.message);
    return null;
  }
};

const tripController = getTripController();

if (tripController) {
  // 全てのルートで認証が必要
  router.use(authenticateToken);

  // 運行記録一覧
  if (tripController.getAllTrips) {
    router.get('/', asyncHandler(tripController.getAllTrips));
  }

  // 運行記録詳細
  if (tripController.getTripById) {
    router.get('/:id', validateId, asyncHandler(tripController.getTripById));
  }

  // 運行記録作成
  if (tripController.createTrip) {
    router.post('/', validateTrip, asyncHandler(tripController.createTrip));
  }

  // 運行記録更新
  if (tripController.updateTrip) {
    router.put('/:id', validateId, asyncHandler(tripController.updateTrip));
  }

  // 運行記録削除（管理者・マネージャーのみ）
  if (tripController.deleteTrip) {
    router.delete('/:id', requireRole(['ADMIN', 'MANAGER']), validateId, asyncHandler(tripController.deleteTrip));
  }
  
  console.log('✓ 運行記録ルート登録完了');
} else {
  // フォールバックルート
  router.use(authenticateToken);
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: '運行記録機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  console.log('⚠️ 運行記録コントローラーが見つからないため、フォールバックルートを設定しました');
}

export default router;
