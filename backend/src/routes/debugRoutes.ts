// =====================================
// backend/src/routes/debugRoutes.ts
// デバッグ専用APIルート
// 作成日: 2025年12月29日
// 目的: 開発・デバッグモード専用の詳細データ取得エンドポイント
// =====================================

import { Response, Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { getDebugService } from '../services/debugService';
import type { AuthenticatedRequest } from '../types/auth';
import logger from '../utils/logger';
import { sendError, sendSuccess } from '../utils/response';

const router = Router();
const debugService = getDebugService();

/**
 * 🔍 [GET] /api/debug/operations/recent
 * 最近の運行ID一覧取得（デバッグ用）
 *
 * @query limit - 取得件数（デフォルト: 20）
 * @access ADMIN only
 */
router.get(
  '/operations/recent',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      logger.info(`🔍 [DEBUG API] 最近の運行ID一覧取得`, {
        limit,
        requestedBy: req.user?.userId
      });

      const result = await debugService.getRecentOperationIds(limit);

      return sendSuccess(res, result.data, '運行ID一覧を取得しました');
    } catch (error) {
      logger.error(`❌ [DEBUG API] 運行ID一覧取得エラー`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return sendError(
        res,
        error instanceof Error ? error.message : '運行ID一覧の取得に失敗しました',
        500
      );
    }
  }
);

/**
 * 🔍 [GET] /api/debug/operations/:operationId/inspection-items
 * 点検項目詳細取得
 *
 * @param operationId - 運行ID
 * @access ADMIN only
 */
router.get(
  '/operations/:operationId/inspection-items',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { operationId } = req.params;

      if (!operationId) {
        return sendError(res, '運行IDが指定されていません', 400);
      }

      logger.info(`🔍 [DEBUG API] 点検項目詳細取得`, {
        operationId,
        requestedBy: req.user?.userId
      });

      const result = await debugService.getInspectionItemDetails(operationId);

      return sendSuccess(res, result.data, '点検項目詳細を取得しました');
    } catch (error) {
      logger.error(`❌ [DEBUG API] 点検項目詳細取得エラー`, {
        operationId: req.params.operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      return sendError(
        res,
        error instanceof Error ? error.message : '点検項目詳細の取得に失敗しました',
        500
      );
    }
  }
);

/**
 * 🔍 [GET] /api/debug/operations/:operationId/detail
 * 運行・点検統合詳細取得
 *
 * @param operationId - 運行ID
 * @access ADMIN only
 */
router.get(
  '/operations/:operationId/detail',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { operationId } = req.params;

      if (!operationId) {
        return sendError(res, '運行IDが指定されていません', 400);
      }

      logger.info(`🔍 [DEBUG API] 運行・点検統合詳細取得`, {
        operationId,
        requestedBy: req.user?.userId
      });

      const result = await debugService.getOperationInspectionDetail(operationId);

      return sendSuccess(res, result.data, '運行・点検統合詳細を取得しました');
    } catch (error) {
      logger.error(`❌ [DEBUG API] 運行・点検統合詳細取得エラー`, {
        operationId: req.params.operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      return sendError(
        res,
        error instanceof Error ? error.message : '運行・点検統合詳細の取得に失敗しました',
        500
      );
    }
  }
);

/**
 * 🔍 [GET] /api/debug/operations/:operationId/full
 * 運行履歴完全デバッグ情報取得
 *
 * @param operationId - 運行ID
 * @access ADMIN only
 */
router.get(
  '/operations/:operationId/full',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { operationId } = req.params;

      if (!operationId) {
        return sendError(res, '運行IDが指定されていません', 400);
      }

      logger.info(`🔍 [DEBUG API] 運行履歴完全デバッグ情報取得`, {
        operationId,
        requestedBy: req.user?.userId
      });

      const result = await debugService.getOperationDebugInfo(operationId);

      return sendSuccess(res, result.data, '運行履歴完全デバッグ情報を取得しました');
    } catch (error) {
      logger.error(`❌ [DEBUG API] 運行履歴完全デバッグ情報取得エラー`, {
        operationId: req.params.operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      return sendError(
        res,
        error instanceof Error ? error.message : '運行履歴完全デバッグ情報の取得に失敗しました',
        500
      );
    }
  }
);

export default router;
