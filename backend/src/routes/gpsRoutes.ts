// backend/src/routes/gpsRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// 動的にコントローラーをimport
const getController = () => {
  try {
    return require('../controllers/gpsController');
  } catch (error) {
    console.warn('gpsController not found');
    return null;
  }
};

const gpsController = getController();

if (gpsController) {
  // 全てのルートで認証が必要
  router.use(authenticateToken);

  // GPS位置情報取得
  if (gpsController.getLocation || gpsController.getCurrentLocation) {
    router.get('/location/:vehicleId', gpsController.getLocation || gpsController.getCurrentLocation);
  }

  // GPS履歴取得
  if (gpsController.getHistory || gpsController.getLocationHistory) {
    router.get('/history/:vehicleId', gpsController.getHistory || gpsController.getLocationHistory);
  }

  // リアルタイム位置更新
  if (gpsController.updateLocation) {
    router.post('/update', gpsController.updateLocation);
  }
}

export default router;
