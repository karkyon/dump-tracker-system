import { Router } from 'express';
import * as vehicleController from '../controllers/vehicleController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateVehicle, validateVehicleUpdate } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 車両一覧取得
router.get('/', vehicleController.getAllVehicles);

// 車両詳細取得
router.get('/:id', vehicleController.getVehicleById);

// 車両新規作成（管理者・マネージャーのみ）
router.post('/', 
  requireRole(['ADMIN', 'MANAGER']),
  validateVehicle,
  vehicleController.createVehicle
);

// 車両情報更新（管理者・マネージャーのみ）
router.put('/:id',
  requireRole(['ADMIN', 'MANAGER']),
  validateVehicleUpdate,
  vehicleController.updateVehicle
);

// 車両削除（管理者のみ）
router.delete('/:id',
  requireRole(['ADMIN']),
  vehicleController.deleteVehicle
);

// 車両統計取得
router.get('/:id/statistics', vehicleController.getVehicleStatistics);

export default router;
