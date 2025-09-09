// backend/src/routes/operationRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// 動的にコントローラーをimport
const getController = () => {
  try {
    return require('../controllers/operationController');
  } catch (error) {
    console.warn('operationController not found');
    return null;
  }
};

const operationController = getController();

if (operationController) {
  // 全てのルートで認証が必要
  router.use(authenticateToken);

  // 運行開始
  if (operationController.startOperation) {
    router.post('/start', operationController.startOperation);
  }

  // 運行終了
  if (operationController.endOperation) {
    router.post('/end', operationController.endOperation);
  }

  // 運行状況取得
  if (operationController.getOperationStatus) {
    router.get('/status/:vehicleId', operationController.getOperationStatus);
  }

  // アクティブな運行一覧
  if (operationController.getActiveOperations) {
    router.get('/active', operationController.getActiveOperations);
  }
}

export default router;
