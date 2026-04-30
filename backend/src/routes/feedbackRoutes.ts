// backend/src/routes/feedbackRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  listFeedback,
  getFeedback,
  updateFeedbackStatus,
  updateFeedbackNotes,
  linkBacklog,
  unlinkBacklog,
  handleBacklogWebhook,
} from '../controllers/feedbackController';

const router = Router();

// Backlog Webhook（認証不要 - Backlogからのコールバック）
router.post('/webhook/backlog', handleBacklogWebhook);

// 以降のエンドポイント: 認証必須 + ADMIN権限
router.use(authenticateToken());
router.use(requireAdmin);

router.get('/', listFeedback);
router.get('/:id', getFeedback);
router.patch('/:id/status', updateFeedbackStatus);
router.patch('/:id/notes', updateFeedbackNotes);
router.post('/:id/backlog', linkBacklog);
router.delete('/:id/backlog', unlinkBacklog);

export default router;
