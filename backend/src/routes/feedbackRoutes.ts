// backend/src/routes/feedbackRoutes.ts
// フィードバック管理 API ルート定義
// ADMIN / MANAGER 専用

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  listFeedback,
  getFeedback,
  updateFeedbackStatus,
  updateFeedbackNotes,
  linkBacklog,
  unlinkBacklog,
} from '../controllers/feedbackController';

const router = Router();

// 全エンドポイント: 認証必須 + ADMIN/MANAGER 権限
router.use(authenticateToken());
router.use(requireAdmin);

// 一覧取得
router.get('/', listFeedback);

// 詳細取得
router.get('/:id', getFeedback);

// ステータス更新
router.patch('/:id/status', updateFeedbackStatus);

// 管理者メモ更新
router.patch('/:id/notes', updateFeedbackNotes);

// Backlog起票
router.post('/:id/backlog', linkBacklog);

// Backlog連携解除
router.delete('/:id/backlog', unlinkBacklog);

export default router;
