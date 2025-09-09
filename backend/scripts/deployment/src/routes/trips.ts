import { Router } from 'express';
import * as tripController from '../controllers/tripController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateTrip, validateGPSLocation } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 運行記録一覧取得
router.get('/', tripController.getAllTrips);

// 運行記録詳細取得
router.get('/:id', tripController.getTripById);

// 運行開始
router.post('/', validateTrip, tripController.startTrip);

// 運行終了
router.patch('/:id/end', tripController.endTrip);

// GPS位置情報更新
router.patch('/:id/gps', 
  validateGPSLocation,
  tripController.updateGPSLocation
);

// 給油記録追加
router.post('/:id/fuel', tripController.addFuelRecord);

// 積込記録追加
router.post('/:id/loading', tripController.addLoadingRecord);

// 積下記録追加
router.post('/:id/unloading', tripController.addUnloadingRecord);

export default router;
