import { Router } from 'express';
import * as itemController from '../controllers/itemController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateItem } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 品目一覧取得
router.get('/', itemController.getAllItems);

// 品目詳細取得
router.get('/:id', itemController.getItemById);

// 品目新規作成（管理者・マネージャーのみ）
router.post('/', 
  requireRole(['ADMIN', 'MANAGER']),
  validateItem,
  itemController.createItem
);

// 品目情報更新
router.put('/:id',
  requireRole(['ADMIN', 'MANAGER']),
  itemController.updateItem
);

// 品目使用統計取得
router.get('/:id/statistics', itemController.getItemStatistics);

export default router;
