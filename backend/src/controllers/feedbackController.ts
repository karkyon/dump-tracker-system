// backend/src/controllers/feedbackController.ts
import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendError, sendNotFound } from '../utils/response';
import { feedbackService, FeedbackFilter, FeedbackStatus, BacklogWebhookPayload } from '../services/feedbackService';
import logger from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

// noUncheckedIndexedAccess: true のため req.params[key] は string|undefined
// 明示的に string 確定させるヘルパー
function str(v: string | undefined): string { return v ?? ''; }

// req.user は optional なので chain で undefined になりうる → String() で確定
function actor(req: AuthenticatedRequest): string {
  return String(req.user?.username ?? req.user?.userId ?? 'unknown');
}

export const listFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const filter: FeedbackFilter = {
    app: (req.query['app'] as any) || undefined,
    reportType: str(req.query['reportType'] as string | undefined) || undefined,
    severity: req.query['severity'] !== undefined ? Number(req.query['severity']) : undefined,
    status: (req.query['status'] as FeedbackStatus) || undefined,
    dateFrom: str(req.query['dateFrom'] as string | undefined) || undefined,
    dateTo: str(req.query['dateTo'] as string | undefined) || undefined,
    keyword: str(req.query['keyword'] as string | undefined) || undefined,
    page: req.query['page'] ? Number(req.query['page']) : 1,
    limit: req.query['limit'] ? Number(req.query['limit']) : 20,
    sortBy: (req.query['sortBy'] as any) || 'createdAt',
    sortOrder: (req.query['sortOrder'] as any) || 'desc',
  };
  logger.info('フィードバック一覧取得', { filter, userId: req.user?.userId });
  const result = await feedbackService.list(filter);
  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: filter.page, limit: filter.limit, stats: result.stats },
    message: 'フィードバック一覧を取得しました',
  });
});

export const getFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  logger.info('フィードバック詳細取得', { id, userId: req.user?.userId });
  const fb = await feedbackService.getById(id);
  if (!fb) { sendNotFound(res, 'Feedback'); return; }
  res.json({ success: true, data: fb, message: 'フィードバック詳細を取得しました' });
});

export const updateFeedbackStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  const { status } = req.body as { status: string };
  if (!['new', 'in_progress', 'resolved', 'wontfix'].includes(status)) {
    sendError(res, '無効なステータス値です', 400, 'INVALID_STATUS');
    return;
  }
  const changedBy = actor(req);
  logger.info('フィードバック ステータス更新', { id, status, changedBy });
  await feedbackService.updateStatus(id, status as FeedbackStatus, changedBy);
  res.json({ success: true, message: `ステータスを「${status}」に更新しました` });
});

export const updateFeedbackNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  const { notes } = req.body as { notes: string };
  const updatedBy = actor(req);
  logger.info('フィードバック メモ更新', { id, updatedBy });
  await feedbackService.updateNotes(id, notes || '', updatedBy);
  res.json({ success: true, message: '管理者メモを保存しました' });
});

export const linkBacklog = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  const { title, body } = req.body as { title?: string; body?: string };
  const linkedBy = actor(req);
  logger.info('Backlog起票', { id, linkedBy });
  const result = await feedbackService.linkBacklog(id, linkedBy, title, body);
  res.json({ success: true, data: result, message: `Backlog チケット ${result.issueKey} を起票しました` });
});

export const unlinkBacklog = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  logger.info('Backlog連携解除', { id, userId: req.user?.userId });
  await feedbackService.unlinkBacklog(id);
  res.json({ success: true, message: 'Backlog連携を解除しました' });
});


export const handleBacklogWebhook = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  logger.info('🔔 [feedbackController] handleBacklogWebhook 受信', {
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body || {}),
  });

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ success: false, message: '無効なWebhookペイロード' });
    return;
  }

  try {
    const result = await feedbackService.processBacklogWebhook(payload);
    logger.info('🔔 [feedbackController] Webhook処理完了', result);
    res.json({ success: true, ...result });
  } catch (e: any) {
    logger.error('🔔 [feedbackController] Webhook処理エラー', { error: String(e) });
    // Backlogへは200を返す（再送防止）
    res.json({ success: false, message: String(e) });
  }
});
