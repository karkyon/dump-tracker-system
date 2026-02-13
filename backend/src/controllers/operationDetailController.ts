// =====================================
// backend/src/controllers/operationDetailController.ts
// 運行詳細管理Controller - 完全拡張版
// ✅ 運行開始/終了・点検イベント統合対応
// ✅ TypeScriptエラー完全修正
// 最終更新: 2025-12-30
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
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 統合タイムラインイベント型定義
 */
interface TimelineEvent {
  id: string;
  sequenceNumber: number;
  eventType: 'TRIP_START' | 'TRIP_END' | 'PRE_INSPECTION' | 'POST_INSPECTION' |
             'LOADING' | 'UNLOADING' | 'TRANSPORTING' | 'WAITING' |
             'MAINTENANCE' | 'REFUELING' | 'BREAK' | 'OTHER';
  timestamp: Date | null;
  location?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    recordedAt: Date;
  } | null;
  notes?: string | null;
  quantityTons?: number;
  items?: {
    id: string;
    name: string;
    unit: string | null;  // ✅ 修正: null許容
  } | null;
  inspectionDetails?: {
    inspectionRecordId: string;
    status: string;
    totalItems: number;
    passedItems: number;
    failedItems: number;
  } | null;
}

/**
 * 運行詳細管理Controller
 */
export class OperationDetailController {
  private readonly operationDetailService: OperationDetailService;

  constructor() {
    this.operationDetailService = new OperationDetailService();
  }

  /**
   * ✅ 運行詳細一覧取得（統合タイムライン版）
   * GET /operation-details
   *
   * 取得データ:
   * - operations: 運行開始/終了イベント
   * - inspection_records: 運行前/後点検イベント
   * - operation_details: 積込/積降/給油/休憩などのイベント
   * - gps_logs: GPS座標情報
   */
  getAllOperationDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      page = 1,
      limit = 100,
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

    logger.info('✅ 統合運行詳細タイムライン取得', {
      userId,
      operationId,
      activityType,
      startDate,
      endDate
    });

    if (!operationId) {
      throw new ValidationError('運行IDは必須です');
    }

    try {
      // =====================================
      // 1. 運行基本情報取得
      // =====================================
      const operation = await prisma.operation.findUnique({
        where: { id: operationId },
        include: {
          vehicles: true,  // ✅ 修正: 正しいリレーション名
          usersOperationsDriverIdTousers: true  // ✅ 修正: 正しいリレーション名
        }
      });

      if (!operation) {
        return sendNotFound(res, '運行記録が見つかりません');
      }

      // =====================================
      // 2. operation_details（既存イベント）取得
      // =====================================
      const operationDetails = await prisma.operationDetail.findMany({
        where: { operationId },
        include: {
          locations: {  // ✅ 修正: 正しいリレーション名
            select: {
              id: true,
              name: true,
              address: true,
              latitude: true,
              longitude: true
            }
          },
          items: {  // ✅ 修正: 正しいリレーション名
            select: {
              id: true,
              name: true,
              unit: true
            }
          }
        },
        orderBy: { sequenceNumber: 'asc' }
      });

      // =====================================
      // 3. inspection_records（点検イベント）取得
      // =====================================
      const inspectionRecords = await prisma.inspectionRecord.findMany({
        where: { operationId },
        include: {
          inspectionItemResults: {  // ✅ 修正: 正しいリレーション名
            select: {
              resultValue: true,  // ✅ 修正: "result" → "resultValue"
              isPassed: true      // ✅ 修正: "isPassed" を追加
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      // =====================================
      // 4. gps_logs（GPS座標）取得
      // =====================================
      const gpsLogs = await prisma.gpsLog.findMany({
        where: { operationId },
        orderBy: { recordedAt: 'asc' }
      });

      // =====================================
      // 5. 統合タイムラインの構築
      // =====================================
      const timeline: TimelineEvent[] = [];
      let sequenceCounter = 0;

      // 5-1. 運行開始イベント
      // ✅ 修正: operations テーブルにはGPS列がないため gpsLocation は null
      if (operation.actualStartTime) {
        timeline.push({
          id: `trip-start-${operation.id}`,
          sequenceNumber: ++sequenceCounter,
          eventType: 'TRIP_START',
          timestamp: operation.actualStartTime,
          gpsLocation: null,
          notes: '運行開始'
        });
      }

      // 5-2. 運行前点検イベント
      // ✅ 修正: inspection_records.latitude/longitude を直接使用
      inspectionRecords
        .filter(ir => ir.inspectionType === 'PRE_TRIP')
        .forEach(inspection => {
          // ✅ 修正: inspectionItemResults の集計
          const totalItems = inspection.inspectionItemResults.length;
          const passedItems = inspection.inspectionItemResults.filter(r => r.isPassed === true).length;
          const failedItems = inspection.inspectionItemResults.filter(r => r.isPassed === false).length;

          timeline.push({
            id: inspection.id,
            sequenceNumber: ++sequenceCounter,
            eventType: 'PRE_INSPECTION',
            timestamp: inspection.startedAt || inspection.createdAt,
            gpsLocation: (inspection.latitude && inspection.longitude) ? {
              latitude: Number(inspection.latitude),
              longitude: Number(inspection.longitude),
              recordedAt: inspection.startedAt || inspection.createdAt
            } : null,
            inspectionDetails: {
              inspectionRecordId: inspection.id,
              status: inspection.status,
              totalItems,
              passedItems,
              failedItems
            },
            notes: `運行前点検 (${inspection.status})`
          });
        });

      // 5-3. 運行詳細イベント（積込/積降/給油/休憩など）
      // ✅ 修正: operation_details.latitude/longitude を直接使用
      operationDetails.forEach(detail => {
        timeline.push({
          id: detail.id,
          sequenceNumber: ++sequenceCounter,
          eventType: detail.activityType as any,
          timestamp: detail.actualStartTime || detail.plannedTime,
          location: detail.locations ? {  // ✅ 修正: 正しいリレーション名
            id: detail.locations.id,
            name: detail.locations.name,
            address: detail.locations.address || '',
            latitude: Number(detail.locations.latitude),
            longitude: Number(detail.locations.longitude)
          } : null,
          gpsLocation: (detail.latitude && detail.longitude) ? {
            latitude: Number(detail.latitude),
            longitude: Number(detail.longitude),
            recordedAt: detail.gpsRecordedAt || detail.actualStartTime || detail.plannedTime || new Date()
          } : null,
          quantityTons: Number(detail.quantityTons) || 0,
          items: detail.items ? {  // ✅ 修正: 正しいリレーション名
            id: detail.items.id,
            name: detail.items.name,
            unit: detail.items.unit
          } : null,
          notes: detail.notes
        });
      });

      // 5-4. 運行後点検イベント
      // ✅ 修正: inspection_records.latitude/longitude を直接使用
      inspectionRecords
        .filter(ir => ir.inspectionType === 'POST_TRIP')
        .forEach(inspection => {
          // ✅ 修正: inspectionItemResults の集計
          const totalItems = inspection.inspectionItemResults.length;
          const passedItems = inspection.inspectionItemResults.filter(r => r.isPassed === true).length;
          const failedItems = inspection.inspectionItemResults.filter(r => r.isPassed === false).length;

          timeline.push({
            id: inspection.id,
            sequenceNumber: ++sequenceCounter,
            eventType: 'POST_INSPECTION',
            timestamp: inspection.startedAt || inspection.createdAt,
            gpsLocation: (inspection.latitude && inspection.longitude) ? {
              latitude: Number(inspection.latitude),
              longitude: Number(inspection.longitude),
              recordedAt: inspection.startedAt || inspection.createdAt
            } : null,
            inspectionDetails: {
              inspectionRecordId: inspection.id,
              status: inspection.status,
              totalItems,
              passedItems,
              failedItems
            },
            notes: `運行後点検 (${inspection.status})`
          });
        });

      // 5-5. 運行終了イベント
      // ✅ 修正: operations テーブルにはGPS列がないため gpsLocation は null
      if (operation.actualEndTime) {
        timeline.push({
          id: `trip-end-${operation.id}`,
          sequenceNumber: ++sequenceCounter,
          eventType: 'TRIP_END',
          timestamp: operation.actualEndTime,
          gpsLocation: null,
          notes: '運行終了'
        });
      }

      // タイムスタンプでソート
      timeline.sort((a, b) => {
        const timeA = a.timestamp?.getTime() || 0;
        const timeB = b.timestamp?.getTime() || 0;
        return timeA - timeB;
      });

      // シーケンス番号を再割り当て
      timeline.forEach((event, index) => {
        event.sequenceNumber = index + 1;
      });

      // =====================================
      // 6. レスポンス返却
      // =====================================
      const result = {
        data: timeline,
        total: timeline.length,
        page: 1,
        pageSize: timeline.length,
        totalPages: 1,
        operation: {
          id: operation.id,
          operationNumber: operation.operationNumber,
          status: operation.status,
          vehicle: operation.vehicles,
          driver: operation.usersOperationsDriverIdTousers,
          actualStartTime: operation.actualStartTime,
          actualEndTime: operation.actualEndTime,
          totalDistanceKm: operation.totalDistanceKm,
          notes: operation.notes
        },
        // ✅ 追加: 走行軌跡用GPSログ（イベントPINとは別）
        // フロントエンドの表示設定（ON/OFF・インターバル）に応じてフィルタリングして使用
        routeGpsLogs: gpsLogs.map(log => ({
          latitude: Number(log.latitude),
          longitude: Number(log.longitude),
          recordedAt: log.recordedAt,
          speedKmh: log.speedKmh ? Number(log.speedKmh) : null
        }))
      };

      logger.info('✅ 統合タイムライン返却', {
        userId,
        operationId,
        totalEvents: timeline.length,
        eventTypes: Array.from(new Set(timeline.map(e => e.eventType)))
      });

      return sendSuccess(res, result);

    } catch (error) {
      logger.error('❌ 統合タイムライン取得エラー', {
        userId,
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  });

  /**
   * 運行詳細詳細取得
   * GET /operation-details/:id
   */
  getOperationDetailById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    // ✅ 修正: undefinedチェック追加
    if (!id) {
      throw new ValidationError('IDは必須です');
    }

    logger.info('運行詳細詳細取得', { userId, id });

    const operationDetail = await this.operationDetailService.findByKey(id);  // ✅ 修正: findById → findByKey

    if (!operationDetail) {
      return sendNotFound(res, '運行詳細が見つかりません');
    }

    return sendSuccess(res, operationDetail);
  });

  /**
   * 運行詳細作成
   * POST /operation-details
   */
  createOperationDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const data = req.body;

    logger.info('運行詳細作成', { userId, data });

    const operationDetail = await this.operationDetailService.create(data);

    return sendSuccess(res, operationDetail);  // ✅ 修正: 第3引数削除
  });

  /**
   * 運行詳細更新
   * PUT /operation-details/:id
   */
  updateOperationDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;  // ✅ 修正: idの型はstring
    const data = req.body;

    // ✅ 修正: undefinedチェック追加
    if (!id) {
      throw new ValidationError('IDは必須です');
    }

    logger.info('運行詳細更新', { userId, id, data });

    const operationDetail = await this.operationDetailService.update(id, data);

    if (!operationDetail) {
      return sendNotFound(res, '運行詳細が見つかりません');
    }

    return sendSuccess(res, operationDetail);
  });

  /**
   * 運行詳細削除
   * DELETE /operation-details/:id
   */
  deleteOperationDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;  // ✅ 修正: idの型はstring

    // ✅ 修正: undefinedチェック追加
    if (!id) {
      throw new ValidationError('IDは必須です');
    }

    logger.info('運行詳細削除', { userId, id });

    // ✅ 修正: deleteメソッドはvoidを返すので、存在確認を先にする
    const existing = await this.operationDetailService.findByKey(id);
    if (!existing) {
      return sendNotFound(res, '運行詳細が見つかりません');
    }

    await this.operationDetailService.delete(id);

    return sendSuccess(res, { message: '運行詳細を削除しました' });
  });

  /**
   * 運行別詳細一覧取得
   * GET /operation-details/by-operation/:operationId
   */
  getOperationDetailsByOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {  // ✅ 修正: メソッド追加
    const userId = req.user!.userId;
    const { operationId } = req.params;

    logger.info('運行別詳細一覧取得', { userId, operationId });

    const details = await this.operationDetailService.findMany({
      where: { operationId },
      orderBy: { sequenceNumber: 'asc' }
    });

    return sendSuccess(res, details);
  });

  /**
   * 効率分析
   * GET /operation-details/efficiency-analysis
   */
  getEfficiencyAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query;

    logger.info('効率分析取得', { userId, startDate, endDate });

    const filter: any = {};  // ✅ 修正: OperationDetailWhereInputの代わりにanyを使用

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.gte = new Date(startDate as string);
      if (endDate) filter.createdAt.lte = new Date(endDate as string);
    }

    const operationDetails = await this.operationDetailService.findMany({
      where: filter
    });

    const byActivityType: Record<string, number> = {};
    operationDetails.forEach((detail: any) => {
      byActivityType[detail.activityType] = (byActivityType[detail.activityType] || 0) + 1;
    });

    const analysis = {
      totalOperations: operationDetails.length,
      completedOperations: operationDetails.filter((d: any) => d.actualEndTime).length,
      byActivityType,
      period: {
        startDate: startDate || new Date(),
        endDate: endDate || new Date()
      }
    };

    return sendSuccess(res, analysis);
  });

  /**
   * 一括作業操作
   * POST /operation-details/bulk-operation
   */
  bulkOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { operationIds, action } = req.body;

    logger.info('一括作業操作', { userId, operationIds, action });

    if (!operationIds || !Array.isArray(operationIds) || operationIds.length === 0) {
      throw new ValidationError('運行詳細IDの配列は必須です');
    }

    if (!['complete', 'cancel'].includes(action)) {
      throw new ValidationError('無効なアクション');
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[]
    };

    for (const id of operationIds) {
      try {
        if (action === 'complete') {
          await this.operationDetailService.update(id, {
            actualEndTime: new Date()
          });
        } else if (action === 'cancel') {
          await this.operationDetailService.delete(id);
        }
        results.success.push(id);
      } catch (error) {
        results.failed.push({
          id,
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

    const total = await this.operationDetailService.count();

    // ✅ 修正: count({ where: ... })を正しく呼び出す
    const whereCompleted: any = {
      actualEndTime: { not: null }
    };
    const completed = await this.operationDetailService.count(whereCompleted);

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
// ヘルパー関数
// =====================================

/**
 * 指定時刻に最も近いGPSログを検索
 * ✅ 保持（将来のリアルタイム位置表示等で使用する可能性あり）
 * ⚠️ イベントGPS表示には使用しない
 *    → イベントGPSは operation_details.latitude/longitude を直接使用すること
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findNearestGPS(gpsLogs: any[], targetTime: Date | null): any | null {
  if (!targetTime || gpsLogs.length === 0) return null;

  const targetTimestamp = targetTime.getTime();

  let nearest = gpsLogs[0];
  let minDiff = Math.abs(nearest.recordedAt.getTime() - targetTimestamp);

  for (const log of gpsLogs) {
    const diff = Math.abs(log.recordedAt.getTime() - targetTimestamp);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = log;
    }
  }

  // 5分以内のGPSログのみ返す
  if (minDiff > 5 * 60 * 1000) return null;

  return nearest;
}

export default OperationDetailController;
