// backend/src/routes/customerRoutes.ts
// 客先マスタ ルート

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController';

const router = Router();

// 全ルートに認証を適用
router.use(authenticateToken());

// 一覧・詳細（全ロール）
router.get('/', getCustomers);
router.get('/:id', getCustomerById);

// 作成・更新・削除（ADMIN / MANAGER のみ）
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
