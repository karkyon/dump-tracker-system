import { Router } from 'express';
import * as inspectionController from '../controllers/inspectionController';
import { authenticateToken } from '../middleware/auth';
import { validateInspection } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 点検記録一覧取得
router.get('/', inspectionController.getAllInspections);

// 点検記録詳細取得
router.get('/:id', inspectionController.getInspectionById);

// 乗車前点検記録
router.post('/pre-trip', 
  validateInspection,
  inspectionController.recordPreTripInspection
);

// 定期点検記録
router.post('/periodic', 
  validateInspection,
  inspectionController.recordPeriodicInspection
);

// 点検統計取得
router.get('/statistics/:vehicleId', 
  inspectionController.getInspectionStatistics
);

export default router;
