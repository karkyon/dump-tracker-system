// backend/src/controllers/feedbackController.ts
// フィードバック管理 API コントローラー

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError, sendNotFound } from '../utils/response';
import { feedbackService, FeedbackFilter, FeedbackStatus } from '../services/feedbackService';
import logger from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

// ------------------------------------------
// GET /api/v1/feedback
// フィードバック一覧取得
// ------------------------------------------
export const listFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const filter: FeedbackFilter = {
    app: req.query.app as any || undefined,
    reportType: req.query.reportType as string || undefined,
    severity: req.query.severity !== undefined ? Number(req.query.severity) : undefined,
    status: req.query.status as FeedbackStatus || undefined,
    dateFrom: req.query.dateFrom as string || undefined,
    dateTo: req.query.dateTo as string || undefined,
    keyword: req.query.keyword as string || undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
    sortBy: (req.query.sortBy as any) || 'createdAt',
    sortOrder: (req.query.sortOrder as any) || 'desc',
  };

  logger.info('フィードバック一覧取得', { filter, userId: req.user?.userId });

  const result = await feedbackService.list(filter);

  res.json({
    success: true,
    data: result.items,
    meta: {
      total: result.total,
      page: filter.page,
      limit: filter.limit,
      stats: result.stats,
    },
    message: 'フィードバック一覧を取得しました',
  });
});

// ------------------------------------------
// GET /api/v1/feedback/:id
// フィードバック詳細取得
// ------------------------------------------
export const getFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  logger.info('フィードバック詳細取得', { id, userId: req.user?.userId });

  const fb = await feedbackService.getById(id);
  if (!fb) {
    sendNotFound(res, 'Feedback', `フィードバック ID=${id} が見つかりません`);
    return;
  }

  res.json({ success: true, data: fb, message: 'フィードバック詳細を取得しました' });
});

// ------------------------------------------
// PATCH /api/v1/feedback/:id/status
// ステータス更新
// ------------------------------------------
export const updateFeedbackStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  const changedBy = req.user?.username || req.user?.userId || 'unknown';

  if (!['new', 'in_progress', 'resolved', 'wontfix'].includes(status)) {
    sendError(res, '無効なステータス値です', 400, 'INVALID_STATUS');
    return;
  }

  logger.info('フィードバック ステータス更新', { id, status, changedBy });
  await feedbackService.updateStatus(id, status as FeedbackStatus, changedBy);

  res.json({ success: true, message: `ステータスを「${status}」に更新しました` });
});

// ------------------------------------------
// PATCH /api/v1/feedback/:id/notes
// 管理者メモ更新
// ------------------------------------------
export const updateFeedbackNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { notes } = req.body;
  const updatedBy = req.user?.username || req.user?.userId || 'unknown';

  logger.info('フィードバック メモ更新', { id, updatedBy });
  await feedbackService.updateNotes(id, notes || '', updatedBy);

  res.json({ success: true, message: '管理者メモを保存しました' });
});

// ------------------------------------------
// POST /api/v1/feedback/:id/backlog
// Backlogチケット起票
// ------------------------------------------
export const linkBacklog = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, body } = req.body;
  const linkedBy = req.user?.username || req.user?.userId || 'unknown';

  logger.info('Backlog起票', { id, linkedBy });
  const result = await feedbackService.linkBacklog(id, linkedBy, title, body);

  res.json({
    success: true,
    data: result,
    message: `Backlog チケット ${result.issueKey} を起票しました`,
  });
});

// ------------------------------------------
// DELETE /api/v1/feedback/:id/backlog
// Backlog連携解除
// ------------------------------------------
export const unlinkBacklog = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  logger.info('Backlog連携解除', { id, userId: req.user?.userId });
  await feedbackService.unlinkBacklog(id);

  res.json({ success: true, message: 'Backlog連携を解除しました' });
});
