// backend/src/routes/vehicleRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateVehicle, validateId } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 安全なコントローラーimport
const getVehicleController = () => {
  try {
    const controller = require('../controllers/vehicleController');
    return controller.default || controller;
  } catch (error) {
    console.warn('vehicleController not found or invalid:', error.message);
    return null;
  }
};

const vehicleController = getVehicleController();

if (vehicleController) {
  // 全てのルートで認証が必要
  router.use(authenticateToken);

  // 車両一覧
  if (vehicleController.getAllVehicles) {
    router.get('/', asyncHandler(vehicleController.getAllVehicles));
  }

  // 車両詳細
  if (vehicleController.getVehicleById) {
    router.get('/:id', validateId, asyncHandler(vehicleController.getVehicleById));
  }

  // 車両作成（管理者・マネージャーのみ）
  if (vehicleController.createVehicle) {
    router.post('/', requireRole(['ADMIN', 'MANAGER']), validateVehicle, asyncHandler(vehicleController.createVehicle));
  }

  // 車両更新（管理者・マネージャーのみ）
  if (vehicleController.updateVehicle) {
    router.put('/:id', requireRole(['ADMIN', 'MANAGER']), validateId, asyncHandler(vehicleController.updateVehicle));
  }

  // 車両削除（管理者のみ）
  if (vehicleController.deleteVehicle) {
    router.delete('/:id', requireRole(['ADMIN']), validateId, asyncHandler(vehicleController.deleteVehicle));
  }
  
  console.log('✓ 車両ルート登録完了');
} else {
  // フォールバックルート
  router.use(authenticateToken);
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: '車両管理機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  console.log('⚠️ 車両コントローラーが見つからないため、フォールバックルートを設定しました');
}

export default router;
