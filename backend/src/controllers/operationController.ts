// =====================================
// backend/src/controllers/operationController.ts
// 運行管理Controller - tripController.tsパターン準拠・Service分離版
// Router層からビジネスロジックを分離
// 最終更新: 2025-12-24 - operationService統合
// 依存関係: services/operationService.ts, middleware/errorHandler.ts
// =====================================

import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../types/auth';
import type { PaginationQuery } from '../types/common';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { sendSuccess } from '../utils/response';

// 🎯 operationService統合（ビジネスロジック分離）
import { operationService } from '../services/operationService';

/**
 * 運行管理Controller
 *
 * 【責務】
 * - HTTPリクエスト/レスポンス処理
 * - バリデーション
 * - Service層への委譲
 * - レスポンス整形
 *
 * 【Routerとの分離】
 * - Router: エンドポイント定義のみ
 * - Controller: HTTP処理・バリデーション
 * - Service: ビジネスロジック・DB操作
 *
 * 【参考実装】
 * - tripController.ts: 運行記録管理（完成済み）
 * - operationDetailController.ts: 運行詳細管理（完成済み）
 */
export class OperationController {
  /**
   * 運行一覧取得
   * GET /operations
   */
  getAllOperations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      page = 1,
      limit = 20,
      status,
      vehicleId,
      startDate,
      endDate
    } = req.query as PaginationQuery & {
      status?: string;
      vehicleId?: string;
      startDate?: string;
      endDate?: string;
    };

    logger.info('運行一覧取得', { userId, page, limit, status, vehicleId });

    // WHERE句構築
    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.actualStartTime = {};
      if (startDate) where.actualStartTime.gte = new Date(startDate);
      if (endDate) where.actualStartTime.lte = new Date(endDate);
    }

    // ✅ Service層に委譲
    const result = await operationService.findManyWithPagination({
      where,
      page: Number(page),
      pageSize: Number(limit)
    });

    logger.info('運行一覧取得完了', {
      userId,
      count: result.data.length,
      total: result.total
    });

    return sendSuccess(res, result, '運行一覧を取得しました');
  });

  /**
   * 運行詳細取得
   * GET /operations/:id
   */
  getOperationById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    logger.info('運行詳細取得', { userId, operationId: id });

    // ✅ Service層に委譲
    const operation = await operationService.findWithRelations(id);

    logger.info('運行詳細取得完了', { userId, operationId: id });

    return sendSuccess(res, operation, '運行詳細を取得しました');
  });

  /**
   * 運行開始
   * POST /operations/start
   */
  startOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { vehicleId, driverId, startLocation } = req.body;

    logger.info('運行開始', { userId, vehicleId, driverId });

    // バリデーション
    if (!vehicleId) {
      throw new ValidationError('車両IDは必須です');
    }

    // ✅ Service層に委譲
    const operation = await operationService.startTrip({
      vehicleId,
      driverId: driverId || userId,
      plannedStartTime: new Date(),
      notes: startLocation ? `出発地: ${startLocation}` : undefined
    });

    logger.info('運行開始完了', { userId, operationId: operation.id });

    return sendSuccess(res, operation, '運行を開始しました', 201);
  });

  /**
   * 運行終了
   * POST /operations/end
   */
  endOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { operationId, endLocation, endOdometer } = req.body;

    logger.info('運行終了', { userId, operationId });

    // バリデーション
    if (!operationId) {
      throw new ValidationError('運行IDは必須です');
    }

    // ✅ Service層に委譲
    const operation = await operationService.endTrip(operationId, {
      endTime: new Date(),
      endOdometer,
      notes: endLocation ? `到着地: ${endLocation}` : undefined
    });

    logger.info('運行終了完了', { userId, operationId });

    return sendSuccess(res, operation, '運行を終了しました');
  });

  /**
   * 車両別運行ステータス取得
   * GET /operations/status/:vehicleId
   */
  getOperationStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { vehicleId } = req.params;
    const userId = req.user!.userId;

    logger.info('車両別運行ステータス取得', { userId, vehicleId });

    // ✅ Service層に委譲
    const operations = await operationService.findByVehicleId(vehicleId, 1);

    const status = {
      vehicleId,
      currentOperation: operations.length > 0 ? operations[0] : null,
      status: operations.length > 0 && operations[0].status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'IDLE',
      lastOperationEndTime: operations.length > 0 ? operations[0].actualEndTime : null
    };

    return sendSuccess(res, status, '運行ステータスを取得しました');
  });

  /**
   * アクティブな運行一覧取得
   * GET /operations/active
   */
  getActiveOperations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    logger.info('アクティブ運行一覧取得', { userId });

    // ✅ Service層に委譲
    const activeOperations = await operationService.findByStatus('IN_PROGRESS');

    const result = {
      data: activeOperations,
      total: activeOperations.length
    };

    return sendSuccess(res, result, 'アクティブな運行一覧を取得しました');
  });

  /**
   * 運行効率分析
   * GET /operations/efficiency
   */
  getOperationEfficiency = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query;

    logger.info('運行効率分析', { userId, startDate, endDate });

    const filter: any = {};
    if (startDate) filter.startDate = new Date(startDate as string);
    if (endDate) filter.endDate = new Date(endDate as string);

    // ✅ Service層に委譲
    const statistics = await operationService.getStatistics(filter);

    const efficiency = {
      averageDuration: statistics.averageDuration,
      totalDistance: statistics.totalDistance,
      utilizationRate: statistics.completedOperations / (statistics.totalOperations || 1),
      period: {
        startDate: startDate || new Date(),
        endDate: endDate || new Date()
      }
    };

    return sendSuccess(res, efficiency, '運行効率を分析しました');
  });

  /**
   * 運行統計
   * GET /operations/stats
   */
  getOperationStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    logger.info('運行統計取得', { userId });

    // ✅ Service層に委譲
    const statistics = await operationService.getStatistics();

    return sendSuccess(res, statistics, '運行統計を取得しました');
  });

  /**
   * 運行作成
   * POST /operations
   */
  createOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const data = req.body;

    logger.info('運行作成', { userId, data });

    // バリデーション
    if (!data.vehicleId) {
      throw new ValidationError('車両IDは必須です');
    }

    // ✅ Service層に委譲
    const operation = await operationService.startTrip({
      vehicleId: data.vehicleId,
      driverId: data.driverId || userId,
      plannedStartTime: data.plannedStartTime ? new Date(data.plannedStartTime) : new Date(),
      plannedEndTime: data.plannedEndTime ? new Date(data.plannedEndTime) : undefined,
      notes: data.notes
    });

    logger.info('運行作成完了', { userId, operationId: operation.id });

    return sendSuccess(res, operation, '運行を作成しました', 201);
  });

  /**
   * 運行更新
   * PUT /operations/:id
   */
  updateOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const data = req.body;

    logger.info('運行更新', { userId, operationId: id });

    // ✅ Service層に委譲
    const operation = await operationService.update({ id }, data);

    logger.info('運行更新完了', { userId, operationId: id });

    return sendSuccess(res, operation, '運行を更新しました');
  });

  /**
   * 運行削除
   * DELETE /operations/:id
   */
  deleteOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    logger.info('運行削除', { userId, operationId: id });

    // ✅ Service層に委譲
    await operationService.delete({ id });

    logger.info('運行削除完了', { userId, operationId: id });

    return sendSuccess(res, null, '運行を削除しました');
  });
}

// =====================================
// エクスポート
// =====================================

export default OperationController;

// =====================================
// ✅ controllers/operationController.ts Service分離完了
// =====================================

/**
 * 【実装内容】
 *
 * ✅ tripController.tsパターン完全適用
 *    - asyncHandlerでラップ
 *    - req.user.userId を使用
 *    - sendSuccess でレスポンス
 *    - ValidationError使用
 *    - logger.info でログ出力
 *
 * ✅ operationService完全統合
 *    - operationServiceをインポート
 *    - 全メソッドでService層に委譲
 *    - ビジネスロジックは一切含まない
 *    - HTTP処理とバリデーションのみ
 *
 * ✅ レイヤー責務の明確化
 *    - Controller: HTTP処理・バリデーション
 *    - Service: ビジネスロジック・DB操作
 *    - Model: データ構造定義
 *
 * ✅ 全11エンドポイント対応
 *    - getAllOperations: 運行一覧取得
 *    - getOperationById: 運行詳細取得
 *    - startOperation: 運行開始
 *    - endOperation: 運行終了
 *    - getOperationStatus: 車両別ステータス
 *    - getActiveOperations: アクティブ運行一覧
 *    - getOperationEfficiency: 運行効率分析
 *    - getOperationStats: 運行統計
 *    - createOperation: 運行作成
 *    - updateOperation: 運行更新
 *    - deleteOperation: 運行削除
 */
