// =====================================
// backend/src/routes/routeSegmentRoutes.ts
// 運行区間距離（GPS実測/Routes API推定）API
// 作成日: 2026-08-05
// =====================================

import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import logger from '../utils/logger';
import type { AuthenticatedRequest } from '../types';
import { computeAndSaveRouteSegments, getRouteSegments } from '../services/routeDistanceService';

const router = Router();

/**
 * GET /api/v1/route-segments/:operationId
 * 運行の区間距離一覧（実測/推定の別・ポリライン含む）を取得
 */
router.get(
  '/:operationId',
  authenticateToken(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { operationId } = req.params as { operationId: string };
    const segments = await getRouteSegments(operationId);
    return sendSuccess(res, segments, '運行区間距離を取得しました');
  })
);

/**
 * POST /api/v1/route-segments/:operationId/compute
 * 運行の区間距離を再計算
 */
router.post(
  '/:operationId/compute',
  authenticateToken(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { operationId } = req.params as { operationId: string };
    logger.info('運行区間距離の再計算リクエスト', { operationId, userId: req.user?.userId });
    const segments = await computeAndSaveRouteSegments(operationId);
    return sendSuccess(res, segments, '運行区間距離を再計算しました');
  })
);

export default router;
