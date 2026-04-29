// backend/src/controllers/feedbackController.ts
import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendError, sendNotFound } from '../utils/response';
import { feedbackService, FeedbackFilter, FeedbackStatus } from '../services/feedbackService';
import logger from '../utils/logger';
import type { AuthenticatedRequest } from '../types';

function str(v: string | undefined): string { return v ?? ''; }
function actor(req: AuthenticatedRequest): string {
  return String(req.user?.username ?? req.user?.userId ?? 'unknown');
}

// Firebase接続タイムアウト付きラッパー（10秒）
async function withFirebaseTimeout<T>(fn: () => Promise<T>, label: string): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Firebase タイムアウト (10秒): ${label}`)), 10000)
    ),
  ]);
}

const EMPTY_STATS = { total: 0, new: 0, in_progress: 0, resolved: 0, wontfix: 0 };

export const listFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  logger.info('📋 [feedbackController] listFeedback 開始', { userId: req.user?.userId });

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

  logger.info('📋 [feedbackController] filter確定、Firebase呼び出し開始', { filter });

  let result;
  try {
    result = await withFirebaseTimeout(
      () => feedbackService.list(filter),
      'feedbackService.list'
    );
    logger.info('📋 [feedbackController] Firebase取得成功', { total: result.total });
  } catch (e: any) {
    logger.error('📋 [feedbackController] Firebase取得失敗', { error: String(e), stack: e?.stack });
    // エラーでも空リストを返してUIをブロックしない
    res.json({
      success: true,
      data: [],
      meta: { total: 0, page: filter.page, limit: filter.limit, stats: EMPTY_STATS },
      message: `Firebase接続エラー: ${e.message || String(e)}`,
    });
    return;
  }

  res.json({
    success: true,
    data: result.items,
    meta: { total: result.total, page: filter.page, limit: filter.limit, stats: result.stats },
    message: 'フィードバック一覧を取得しました',
  });
});

export const getFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  logger.info('📋 [feedbackController] getFeedback', { id });
  let fb;
  try {
    fb = await withFirebaseTimeout(() => feedbackService.getById(id), 'getById');
  } catch (e: any) {
    logger.error('📋 [feedbackController] getById失敗', { error: String(e) });
    sendNotFound(res, 'Feedback');
    return;
  }
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
  await feedbackService.updateStatus(id, status as FeedbackStatus, actor(req));
  res.json({ success: true, message: `ステータスを「${status}」に更新しました` });
});

export const updateFeedbackNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  const { notes } = req.body as { notes: string };
  await feedbackService.updateNotes(id, notes || '', actor(req));
  res.json({ success: true, message: '管理者メモを保存しました' });
});

export const linkBacklog = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  const { title, body } = req.body as { title?: string; body?: string };
  const result = await feedbackService.linkBacklog(id, actor(req), title, body);
  res.json({ success: true, data: result, message: `Backlog チケット ${result.issueKey} を起票しました` });
});

export const unlinkBacklog = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = str(req.params['id']);
  await feedbackService.unlinkBacklog(id);
  res.json({ success: true, message: 'Backlog連携を解除しました' });
});
