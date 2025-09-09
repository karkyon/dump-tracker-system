import { Router } from 'express';
import * as locationController from '../controllers/locationController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateLocation } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 場所一覧取得
router.get('/', locationController.getAllLocations);

// 場所詳細取得
router.get('/:id', locationController.getLocationById);

// 場所新規作成
router.post('/', 
  requireRole(['ADMIN', 'MANAGER']),
  validateLocation,
  locationController.createLocation
);

// 場所情報更新
router.put('/:id',
  requireRole(['ADMIN', 'MANAGER']),
  locationController.updateLocation
);

// 積込場所一覧取得
router.get('/loading/list', locationController.getLoadingLocations);

// 積降場所一覧取得
router.get('/unloading/list', locationController.getUnloadingLocations);

// 近隣場所検索
router.get('/nearby/:latitude/:longitude', 
  locationController.getNearbyLocations
);

export default router;
