import { Router } from 'express';
import * as gpsController from '../controllers/gpsController';
import { authenticateToken } from '../middleware/auth';
import { validateGPSData } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// GPS位置データ送信
router.post('/', validateGPSData, gpsController.recordGPSLocation);

// 車両の位置履歴取得
router.get('/vehicle/:vehicleId', gpsController.getVehicleLocationHistory);

// 運行中の車両位置取得
router.get('/active', gpsController.getActiveVehicleLocations);

// GPS統計取得
router.get('/statistics/:vehicleId', gpsController.getGPSStatistics);

export default router;
