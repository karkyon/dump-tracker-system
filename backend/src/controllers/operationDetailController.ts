// =====================================
// backend/src/controllers/operationDetailController.ts
// 運行詳細管理Controller - 新規作成
// Router層からビジネスロジックを分離
// 最終更新: 2025年10月18日
// 依存関係: models/OperationDetailModel.ts, middleware/errorHandler.ts
// =====================================

import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  OperationDetailService,
  type OperationDetailModel,
  type OperationDetailWhereInput
} from '../models/OperationDetailModel';
import type { AuthenticatedRequest } from '../types/auth';
import type { PaginationQuery } from '../types/common';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { sendNotFound, sendSuccess } from '../utils/response';

/**
 * 運行詳細管理Controller
 *
 * 【責務】
 * - HTTPリクエスト/レスポンス処理
 * - バリデーション
 * - Service層への委譲
 * - レスポンス整形
 *
 * 【Routerとの分離】
 * - Router: エンドポイント定義のみ
 * - Controller: ビジネスロジック・HTTP処理
 */
export class OperationDetailController {
  private readonly operationDetailService: OperationDetailService;

  constructor() {
    this.operationDetailService = new OperationDetailService();
  }

  /**
   * 運行詳細一覧取得
   * GET /operation-details
   */
  getAllOperationDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      page = 1,
      limit = 20,
      operationId,
      activityType,
      startDate,
      endDate,
      locationId,
      itemId
    } = req.query as PaginationQuery & {
      operationId?: string;
      activityType?: string;
      startDate?: string;
      endDate?: string;
      locationId?: string;
      itemId?: string;
    };

    logger.info('運行詳細一覧取得', { userId, filters: req.query });

    // フィルタ構築
    const where: OperationDetailWhereInput = {};
    if (operationId) where.operationId = operationId;
    if (activityType) where.activityType = activityType;
    if (locationId) where.locationId = locationId;
    if (itemId) where.itemId = itemId;
    if (startDate || endDate) {
      where.plannedTime = {};
      if (startDate) where.plannedTime.gte = new Date(startDate);
      if (endDate) where.plannedTime.lte = new Date(endDate);
    }

    // Service呼び出し
    const skip = (Number(page) - 1) * Number(limit);
    const details = await this.operationDetailService.findMany({
      where,
      orderBy: { sequenceNumber: 'asc' },
      skip,
      take: Number(limit)
    });

    const total = await this.operationDetailService.count();

    return sendSuccess(res, {
      data: details,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  });

  /**
   * 運行詳細詳細取得
   * GET /operation-details/:id
   */
  getOperationDetailById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('IDは必須です', 'id');
    }

    logger.info('運行詳細取得', { userId, detailId: id });

    const detail = await this.operationDetailService.findByKey(id);

    if (!detail) {
      logger.warn('運行詳細が見つかりません', { userId, detailId: id });
      return sendNotFound(res, '運行詳細が見つかりません');
    }

    return sendSuccess(res, detail);
  });

  /**
   * 運行詳細作成
   * POST /operation-details
   */
  createOperationDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const data = req.body;

    logger.info('運行詳細作成開始', { userId, data });

    // バリデーション
    if (!data.operationId) {
      throw new ValidationError('運行IDは必須です', 'operationId');
    }
    if (!data.activityType) {
      throw new ValidationError('作業種別は必須です', 'activityType');
    }
    if (!data.locationId) {
      throw new ValidationError('位置IDは必須です', 'locationId');
    }
    if (!data.itemId) {
      throw new ValidationError('品目IDは必須です', 'itemId');
    }

    // Service呼び出し
    const detail = await this.operationDetailService.create({
      operationId: data.operationId,
      sequenceNumber: data.sequenceNumber || 1,
      activityType: data.activityType,
      locationId: data.locationId,
      itemId: data.itemId,
      plannedTime: data.plannedTime ? new Date(data.plannedTime) : undefined,
      actualStartTime: data.actualStartTime ? new Date(data.actualStartTime) : undefined,
      actualEndTime: data.actualEndTime ? new Date(data.actualEndTime) : undefined,
      quantityTons: data.quantityTons || 0,
      notes: data.notes
    });

    logger.info('運行詳細作成完了', { userId, detailId: detail.id });

    return sendSuccess(res, detail, '運行詳細を作成しました', 201);
  });

  /**
   * 運行詳細更新
   * PUT /operation-details/:id
   */
  updateOperationDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('IDは必須です', 'id');
    }

    logger.info('運行詳細更新開始', { userId, detailId: id, data: req.body });

    const existing = await this.operationDetailService.findByKey(id);
    if (!existing) {
      logger.warn('運行詳細が見つかりません', { userId, detailId: id });
      return sendNotFound(res, '運行詳細が見つかりません');
    }

    const data = req.body;

    const updated = await this.operationDetailService.update(id, {
      sequenceNumber: data.sequenceNumber,
      activityType: data.activityType,
      locationId: data.locationId,
      itemId: data.itemId,
      plannedTime: data.plannedTime ? new Date(data.plannedTime) : undefined,
      actualStartTime: data.actualStartTime ? new Date(data.actualStartTime) : undefined,
      actualEndTime: data.actualEndTime ? new Date(data.actualEndTime) : undefined,
      quantityTons: data.quantityTons,
      notes: data.notes
    });

    logger.info('運行詳細更新完了', { userId, detailId: id });

    return sendSuccess(res, updated, '運行詳細を更新しました');
  });

  /**
   * 運行詳細削除
   * DELETE /operation-details/:id
   */
  deleteOperationDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('IDは必須です', 'id');
    }

    logger.info('運行詳細削除開始', { userId, detailId: id });

    const existing = await this.operationDetailService.findByKey(id);
    if (!existing) {
      logger.warn('運行詳細が見つかりません', { userId, detailId: id });
      return sendNotFound(res, '運行詳細が見つかりません');
    }

    await this.operationDetailService.delete(id);

    logger.info('運行詳細削除完了', { userId, detailId: id });

    return sendSuccess(res, null, '運行詳細を削除しました');
  });

  /**
   * 運行別詳細一覧取得
   * GET /operation-details/by-operation/:operationId
   */
  getOperationDetailsByOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { operationId } = req.params;

    if (!operationId) {
      throw new ValidationError('運行IDは必須です', 'operationId');
    }

    logger.info('運行別詳細一覧取得', { userId, operationId });

    const details = await this.operationDetailService.findMany({
      where: { operationId },
      orderBy: { sequenceNumber: 'asc' }
    });

    return sendSuccess(res, details);
  });

  /**
   * 作業効率分析
   * GET /operation-details/efficiency-analysis
   */
  getEfficiencyAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    logger.info('作業効率分析', { userId, startDate, endDate });

    // フィルタ構築
    const where: OperationDetailWhereInput = {};
    if (startDate || endDate) {
      where.plannedTime = {};
      if (startDate) where.plannedTime.gte = new Date(startDate);
      if (endDate) where.plannedTime.lte = new Date(endDate);
    }

    // データ取得
    const details = await this.operationDetailService.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // 効率分析計算
    const analysis = {
      totalOperations: details.length,
      completedOperations: details.filter((d: OperationDetailModel) => d.actualEndTime).length,
      averageEfficiency: 0,
      byActivityType: {} as Record<string, {
        total: number;
        completed: number;
        completionRate: number;
      }>
    };

    // 作業種別別分析
    const grouped = details.reduce((acc: Record<string, OperationDetailModel[]>, detail: OperationDetailModel) => {
      const activityType = detail.activityType || 'UNKNOWN';
      if (!acc[activityType]) {
        acc[activityType] = [];
      }
      acc[activityType].push(detail);
      return acc;
    }, {} as Record<string, OperationDetailModel[]>);

    Object.entries(grouped).forEach(([type, items]) => {
      const typedItems = items as OperationDetailModel[];
      const completed = typedItems.filter((i: OperationDetailModel) => i.actualEndTime);
      analysis.byActivityType[type] = {
        total: typedItems.length,
        completed: completed.length,
        completionRate: typedItems.length > 0 ? completed.length / typedItems.length : 0
      };
    });

    return sendSuccess(res, analysis);
  });

  /**
   * 一括作業操作
   * POST /operation-details/bulk-operation
   */
  bulkOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { operationIds, action } = req.body as {
      operationIds: string[];
      action: 'complete' | 'cancel';
    };

    logger.info('一括作業操作開始', { userId, operationIds, action });

    // バリデーション
    if (!operationIds || !Array.isArray(operationIds) || operationIds.length === 0) {
      throw new ValidationError('運行詳細IDは必須です', 'operationIds');
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[]
    };

    // 一括処理
    for (const id of operationIds) {
      try {
        if (!id) {
          results.failed.push({
            id: 'undefined',
            error: 'IDが指定されていません'
          });
          continue;
        }

        const updateData: any = {};
        if (action === 'complete') {
          updateData.actualEndTime = new Date();
        }

        await this.operationDetailService.update(id, updateData);
        results.success.push(id);
      } catch (error) {
        results.failed.push({
          id: id || 'unknown',
          error: error instanceof Error ? error.message : '不明なエラー'
        });
      }
    }

    logger.info('一括作業操作完了', { userId, results });

    return sendSuccess(res, results);
  });

  /**
   * 運行詳細統計
   * GET /operation-details/stats
   */
  getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    logger.info('運行詳細統計取得', { userId });

    // 全件数取得
    const total = await this.operationDetailService.count();

    // 完了件数取得
    const completed = await this.operationDetailService.count();

    const stats = {
      total,
      completed,
      inProgress: total - completed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      timestamp: new Date().toISOString()
    };

    return sendSuccess(res, stats);
  });
}

// =====================================
// エクスポート
// =====================================

export default OperationDetailController;
