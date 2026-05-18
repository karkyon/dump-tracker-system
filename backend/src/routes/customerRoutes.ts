// backend/src/routes/customerRoutes.ts
// 客先マスタ ルート

import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
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

// REQ-017: 客先作成は DRIVER も可能（モバイルから新規登録対応）
router.post('/', requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]), createCustomer);
// 更新・削除は MANAGER / ADMIN のみ
router.put('/:id', requireRole(['MANAGER', 'ADMIN'] as UserRole[]), updateCustomer);
router.delete('/:id', requireRole(['MANAGER', 'ADMIN'] as UserRole[]), deleteCustomer);

export default router;
