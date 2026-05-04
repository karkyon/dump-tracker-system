// =====================================
// backend/src/controllers/operationDetailController.ts
// 運行詳細管理Controller - 完全拡張版
// ✅ 運行開始/終了・点検イベント統合対応
// ✅ TypeScriptエラー完全修正
// ✅ DatabaseService統一（new PrismaClient() → DatabaseService.getInstance()）
// 🆕 積込/積降サブイベント展開対応（到着・完了を個別イベントとして返却）
// 最終更新: 2026-04-09
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
// ✅ 修正: new PrismaClient() → DatabaseService.getInstance() に統一
// ✅ 理由: new PrismaClient() は snake_case スキーマのクライアントを生成するが、
//          本プロジェクトは schema.camel.prisma の camelCase クライアントを使用する。
//          DatabaseService.getInstance() が正しい camelCase クライアントを返す。
import { DatabaseService } from '../utils/database';
import { LocationService } from '../models/LocationModel';

/**
 * 統合タイムラインイベント型定義
 * 🆕 積込/積降サブイベントタイプを追加
 */
interface TimelineEvent {
  id: string;
  sequenceNumber: number;
  eventType: 'TRIP_START' | 'TRIP_END' | 'PRE_INSPECTION' | 'POST_INSPECTION' |
             'LOADING' | 'UNLOADING' | 'TRANSPORTING' | 'WAITING' |
             'MAINTENANCE' | 'REFUELING' | 'BREAK' | 'OTHER' |
             // 🆕 積込サブイベント（モバイルの loading/start → loading/complete フローに対応）
             'LOADING_ARRIVED' | 'LOADING_COMPLETED' |
             // 🆕 積降サブイベント（モバイルの unloading/start → unloading/complete フローに対応）
             'UNLOADING_ARRIVED' | 'UNLOADING_COMPLETED';
  timestamp: Date | null;
  customerId?: string | null;
  customerName?: string | null;
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
  // ✅ 給油専用フィールド
  fuelCostYen?: number | null;
  // ✅ 複数品目リスト
  detailItems?: Array<{
    id: string;
    itemId: string;
    itemName: string;
    quantityTons: number;
    sequenceOrder: number;
  }> | null;
  // ✅ 点検・後点検用フィールド
  overallNotes?: string | null;
  totalDistanceKm?: number | null;
  fuelConsumedLiters?: number | null;
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
  private readonly locationService: LocationService;

  constructor() {
    this.operationDetailService = new OperationDetailService();
    this.locationService = new LocationService();
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
   *
   * 🆕 LOADING → LOADING_ARRIVED + LOADING_COMPLETED に展開
   * 🆕 UNLOADING → UNLOADING_ARRIVED + UNLOADING_COMPLETED に展開
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
      // ✅ 修正: DatabaseService.getInstance() を使用（camelCase スキーマ対応）
      const db = DatabaseService.getInstance();

      // =====================================
      // 1. 運行基本情報を取得
      // ✅ 修正: prisma.operation (singular camelCase) を使用
      // =====================================
      const operation = await db.operation.findUnique({
        where: { id: operationId as string },
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true,
          customer: { select: { id: true, name: true } }
        }
      });

      if (!operation) {
        return sendNotFound(res, '運行が見つかりません');
      }

      // =====================================
      // 2. 点検記録を取得
      // ✅ 修正: db.inspectionRecord (camelCase) を使用
      // =====================================
      const inspectionRecords = await db.inspectionRecord.findMany({
        where: { operationId: operationId as string },
        include: {
          inspectionItemResults: true
        },
        orderBy: { startedAt: 'asc' }
      });

      // =====================================
      // 3. 運行詳細を取得（積込/積降/給油/休憩など）
      // ✅ 修正: db.operationDetail (camelCase) を使用
      // =====================================
      const operationDetails = await db.operationDetail.findMany({
        where: { operationId: operationId as string },
        include: {
          locations: true,
          items: true,
                    operationDetailItems: {  // ✅ 複数品目を取得
            include: { items: true },
            orderBy: { sequenceOrder: 'asc' }
          }
            orderBy: { sequenceOrder: 'asc' }
          }
        },
        orderBy: [
          { actualStartTime: 'asc' },
          { plannedTime: 'asc' },
          { sequenceNumber: 'asc' }
        ]
      });

      // =====================================
      // 4. GPSログを取得（走行軌跡用）
      // ✅ 修正: db.gpsLog (camelCase) を使用
      // =====================================
      const gpsLogs = await db.gpsLog.findMany({
        where: { operationId: operationId as string },
        orderBy: { recordedAt: 'asc' },
        take: 500
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
      // ✅ 修正: inspectionRecord.latitude/longitude を直接使用
      inspectionRecords
        .filter((ir: any) => ir.inspectionType === 'PRE_TRIP')
        .forEach((inspection: any) => {
          // ✅ 修正: inspectionItemResults の集計
          const totalItems = inspection.inspectionItemResults.length;
          const passedItems = inspection.inspectionItemResults.filter((r: any) => r.isPassed === true).length;
          const failedItems = inspection.inspectionItemResults.filter((r: any) => r.isPassed === false).length;

          timeline.push({
            id: inspection.id,
            sequenceNumber: ++sequenceCounter,
            eventType: 'PRE_INSPECTION',
            timestamp: inspection.startedAt || inspection.createdAt,
            // ✅ overall_notes を含める
            overallNotes: inspection.overallNotes ?? null,
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
      // 🆕 LOADING → LOADING_ARRIVED + LOADING_COMPLETED に展開
      //    モバイルの loading/start（actualStartTime=到着時刻）と
      //    loading/complete（actualEndTime=積込完了時刻）を個別イベントとして返却
      // 🆕 UNLOADING → UNLOADING_ARRIVED + UNLOADING_COMPLETED に展開
      //    モバイルの unloading/start（actualStartTime=到着時刻）と
      //    unloading/complete（actualEndTime=積降完了時刻）を個別イベントとして返却
      operationDetails.forEach((detail: any) => {
        // 共通: 場所情報
        const locationData = detail.locations ? {
          id: detail.locations.id,
          name: detail.locations.name,
          address: detail.locations.address || '',
          latitude: Number(detail.locations.latitude),
          longitude: Number(detail.locations.longitude)
        } : null;

        // 共通: GPS位置情報
        const gpsLocationData = (detail.latitude && detail.longitude) ? {
          latitude: Number(detail.latitude),
          longitude: Number(detail.longitude),
          recordedAt: detail.gpsRecordedAt || detail.actualStartTime || detail.plannedTime || new Date()
        } : null;

        // 共通: 品目情報
        const itemsData = detail.items ? {  // ✅ 修正: 正しいリレーション名
          id: detail.items.id,
          name: detail.items.name,
          unit: detail.items.unit
        } : null;

        if (detail.activityType === 'LOADING') {
          // ─────────────────────────────────────────
          // 🆕 積込: 到着イベント（actualStartTime = 積込場所到着時刻）
          //    モバイルの POST /trips/:id/loading/start に対応
          // ─────────────────────────────────────────
          timeline.push({
            id: `${detail.id}-arrived`,
            sequenceNumber: ++sequenceCounter,
            eventType: 'LOADING_ARRIVED',
            timestamp: detail.actualStartTime || detail.plannedTime,
            location: locationData,
            gpsLocation: gpsLocationData,
            quantityTons: 0,
            items: null,
            notes: detail.notes || null,
            customerId: operation?.customerId ?? null,
            customerName: (operation as any)?.customer?.name ?? null,
          });

          // 🆕 積込: 積込完了イベント
          //    モバイルの積込は1画面完結のため actualEndTime が null のケースがある
          //    → actualEndTime が null でも quantityTons > 0 または itemId があれば完了とみなす
          //    timestamp: actualEndTime があればそれ、なければ actualStartTime を使用
          const loadingHasContent = Number(detail.quantityTons) > 0 || detail.itemId;
          const loadingCompletedTime = detail.actualEndTime || (loadingHasContent ? (detail.actualStartTime || detail.plannedTime) : null);
          if (loadingCompletedTime) {
            timeline.push({
              id: `${detail.id}-completed`,
              sequenceNumber: ++sequenceCounter,
              eventType: 'LOADING_COMPLETED',
              timestamp: loadingCompletedTime,
              location: locationData,
              gpsLocation: null,
              quantityTons: Number(detail.quantityTons) || 0,
              items: itemsData,
              detailItems: (detail.operationDetailItems || []).map((di: any) => ({
                id: di.id,
                itemId: di.itemId,
                itemName: di.items?.name ?? '',
                quantityTons: Number(di.quantityTons),
                sequenceOrder: di.sequenceOrder,
              })),
              notes: detail.notes || null
            });
          }

        } else if (detail.activityType === 'UNLOADING') {
          // ─────────────────────────────────────────
          // 🆕 積降: 到着イベント（actualStartTime = 積降場所到着時刻）
          //    モバイルの POST /trips/:id/unloading/start に対応
          // ─────────────────────────────────────────
          timeline.push({
            id: `${detail.id}-arrived`,
            sequenceNumber: ++sequenceCounter,
            eventType: 'UNLOADING_ARRIVED',
            timestamp: detail.actualStartTime || detail.plannedTime,
            location: locationData,
            gpsLocation: gpsLocationData,
            quantityTons: 0,
            items: null,
            notes: detail.notes || null,
            customerId: operation?.customerId ?? null,
            customerName: (operation as any)?.customer?.name ?? null,
          });

          // 🆕 積降: 積降完了イベント（actualEndTime = 積降完了時刻）
          //    モバイルの POST /trips/:id/unloading/complete に対応
          //    actualEndTime が設定されている場合のみ生成
          if (detail.actualEndTime) {
            timeline.push({
              id: `${detail.id}-completed`,
              sequenceNumber: ++sequenceCounter,
              eventType: 'UNLOADING_COMPLETED',
              timestamp: detail.actualEndTime,
              location: locationData,
              gpsLocation: null,
              quantityTons: Number(detail.quantityTons) || 0,
              items: itemsData,
              notes: detail.notes || '積降完了'
            });
          }

        } else {
          // ─────────────────────────────────────────
          // その他（FUELING, BREAK_START, BREAK_END,
          //         TRANSPORTING, WAITING, MAINTENANCE,
          //         REFUELING, OTHER）は既存動作を維持
          // ─────────────────────────────────────────
          timeline.push({
            id: detail.id,
            sequenceNumber: ++sequenceCounter,
            eventType: detail.activityType as any,
            timestamp: detail.actualStartTime || detail.plannedTime,
            location: locationData,
            gpsLocation: gpsLocationData,
            quantityTons: Number(detail.quantityTons) || 0,
            items: itemsData,
            fuelCostYen: detail.fuelCostYen ? Number(detail.fuelCostYen) : null,  // ✅ 給油金額
            notes: detail.notes
          });
        }
      });

      // 5-4. 運行後点検イベント
      // ✅ 修正: inspectionRecord.latitude/longitude を直接使用
      inspectionRecords
        .filter((ir: any) => ir.inspectionType === 'POST_TRIP')
        .forEach((inspection: any) => {
          // ✅ 修正: inspectionItemResults の集計
          const totalItems = inspection.inspectionItemResults.length;
          const passedItems = inspection.inspectionItemResults.filter((r: any) => r.isPassed === true).length;
          const failedItems = inspection.inspectionItemResults.filter((r: any) => r.isPassed === false).length;

          timeline.push({
            id: inspection.id,
            sequenceNumber: ++sequenceCounter,
            eventType: 'POST_INSPECTION',
            timestamp: inspection.startedAt || inspection.createdAt,
            // ✅ 正しいフィールドをタイムラインイベントに含める
            overallNotes: inspection.overallNotes ?? null,
            totalDistanceKm: (operation as any).totalDistanceKm ?? null,
            fuelConsumedLiters: (operation as any).fuelConsumedLiters ?? null,
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
        routeGpsLogs: gpsLogs.map((log: any) => ({
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
   * ✅ タイムラインイベント統合更新
   * PUT /operation-details/timeline-event/:eventId
   * eventIdパターン別にoperations/inspection_records/operation_detailsを更新
   */
  updateTimelineEvent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { eventId } = req.params;
    const rawData = req.body;
    if (!eventId) throw new ValidationError('eventIdは必須です');
    logger.info('タイムラインイベント統合更新', { eventId, rawData });
    const db = DatabaseService.getInstance();
    const toDate = (v: any) => (v && typeof v === 'string') ? new Date(v) : (v instanceof Date ? v : undefined);

    // PATTERN 0: 客先変更（全イベント共通で rawData.customerId があれば operations を更新）
    if (rawData.customerId && rawData._updateCustomer) {
      const { operationId: opIdForCust } = rawData;
      if (opIdForCust) {
        await db.operation.update({ where: { id: opIdForCust }, data: { customerId: rawData.customerId } });
        logger.info('客先変更完了', { operationId: opIdForCust, customerId: rawData.customerId });
      }
    }

    // PATTERN 1: trip-start-{opId} → operations.actualStartTime
    if (eventId.startsWith('trip-start-')) {
      const opId = eventId.replace('trip-start-', '');
      const data: any = {};
      if (rawData.actualStartTime) data.actualStartTime = toDate(rawData.actualStartTime);
      if (rawData.notes) data.notes = rawData.notes;
      if (rawData.customerId) data.customerId = rawData.customerId;
      const updated = await db.operation.update({ where: { id: opId }, data });
      return sendSuccess(res, { eventId, ...updated });
    }

    // PATTERN 2: trip-end-{opId} → operations.actualEndTime
    if (eventId.startsWith('trip-end-')) {
      const opId = eventId.replace('trip-end-', '');
      const data: any = {};
      if (rawData.actualStartTime) data.actualEndTime = toDate(rawData.actualStartTime);
      if (rawData.notes) data.notes = rawData.notes;
      const updated = await db.operation.update({ where: { id: opId }, data });
      return sendSuccess(res, { eventId, ...updated });
    }

    // PATTERN 3: {uuid}-arrived → operation_details.actualStartTime
    if (eventId.endsWith('-arrived')) {
      const detailId = eventId.replace(/-arrived$/, '');
      const data: any = {};
      if (rawData.actualStartTime) data.actualStartTime = toDate(rawData.actualStartTime);
      if (rawData.latitude !== undefined) data.latitude = rawData.latitude;
      if (rawData.longitude !== undefined) data.longitude = rawData.longitude;
      if (rawData.notes !== undefined) data.notes = rawData.notes;
      if (rawData.locationName && !rawData.locationId) {
        try {
          const locs = await this.locationService.findMany({ where: { name: rawData.locationName } });
          const arr = Array.isArray(locs) ? locs : (locs as any)?.data || [];
          if (arr[0]?.id) data.locationId = arr[0].id;
        } catch { /* 継続 */ }
      }
      const updated = await this.operationDetailService.update(detailId, data);
      if (!updated) return sendNotFound(res, '運行詳細が見つかりません');
      return sendSuccess(res, updated);
    }

    // PATTERN 4: {uuid}-completed → operation_details + operationDetailItems
    if (eventId.endsWith('-completed')) {
      const detailId = eventId.replace(/-completed$/, '');
      const data: any = {};
      const endTime = rawData.actualEndTime || rawData.actualStartTime;
      if (endTime) data.actualEndTime = toDate(endTime);
      if (rawData.itemId !== undefined) data.itemId = rawData.itemId;  // 後方互換
      if (rawData.quantityTons !== undefined) data.quantityTons = rawData.quantityTons;
      if (rawData.notes !== undefined) data.notes = rawData.notes;
      if (rawData.latitude !== undefined) data.latitude = rawData.latitude;
      if (rawData.longitude !== undefined) data.longitude = rawData.longitude;
      const updated = await this.operationDetailService.update(detailId, data);
      if (!updated) return sendNotFound(res, '運行詳細が見つかりません');
      // ✅ 複数品目: selectedItemIds が送られた場合は operationDetailItems を再構築
      if (Array.isArray(rawData.selectedItemIds) && rawData.selectedItemIds.length > 0) {
        await db.operationDetailItem.deleteMany({ where: { operationDetailId: detailId } });
        for (let i = 0; i < rawData.selectedItemIds.length; i++) {
          const itemId = rawData.selectedItemIds[i];
          const qty = Number(rawData.quantityTons ?? 0);
          await db.operationDetailItem.create({
            data: { operationDetailId: detailId, itemId, quantityTons: qty, sequenceOrder: i }
          });
        }
        logger.info('✅ operationDetailItems 更新完了', { detailId, count: rawData.selectedItemIds.length });
      }
      return sendSuccess(res, updated);
    }

    // PATTERN 5: 純UUID → inspection_records or operation_details
    try {
      const insp = await db.inspectionRecord.findUnique({ where: { id: eventId } });
      if (insp) {
        const data: any = {};
        if (rawData.actualStartTime) data.startedAt = toDate(rawData.actualStartTime);
        // ✅ 正しいカラムに保存
        if (rawData.overallNotes !== undefined) data.overallNotes = rawData.overallNotes;
        // 後点検: 走行距離・燃料は operations テーブルに保存
        if (rawData.totalDistanceKm !== undefined || rawData.fuelConsumedLiters !== undefined) {
          const opId = insp.operationId;
          if (opId) {
            const opUpdate: any = {};
            if (rawData.totalDistanceKm !== undefined) opUpdate.totalDistanceKm = parseFloat(String(rawData.totalDistanceKm));
            if (rawData.fuelConsumedLiters !== undefined) opUpdate.fuelConsumedLiters = parseFloat(String(rawData.fuelConsumedLiters));
            await db.operation.update({ where: { id: opId }, data: opUpdate });
            logger.info('後点検: operations更新完了', { opId, opUpdate });
          }
        }
        const updated = await db.inspectionRecord.update({ where: { id: eventId }, data });
        return sendSuccess(res, { eventId, ...updated });
      }
    } catch { /* 次へ */ }

    // operation_details
    const allowedFields = ['sequenceNumber', 'activityType', 'locationId', 'itemId',
      'plannedTime', 'actualStartTime', 'actualEndTime', 'quantityTons', 'notes',
      'latitude', 'longitude', 'altitude', 'gpsAccuracyMeters', 'gpsRecordedAt'];
    const data: any = {};
    for (const k of allowedFields) {
      if (rawData[k] !== undefined) data[k] = rawData[k];
    }
    if (data.actualStartTime) data.actualStartTime = toDate(data.actualStartTime);
    if (data.actualEndTime)   data.actualEndTime   = toDate(data.actualEndTime);
    if (rawData.locationName && !rawData.locationId) {
      try {
        const locs = await this.locationService.findMany({ where: { name: rawData.locationName } });
        const arr = Array.isArray(locs) ? locs : (locs as any)?.data || [];
        if (arr[0]?.id) data.locationId = arr[0].id;
      } catch { /* 継続 */ }
    }
    const updated = await this.operationDetailService.update(eventId, data);
    if (!updated) return sendNotFound(res, 'イベントが見つかりません');
    return sendSuccess(res, updated);
  });

  /**
   * 運行詳細更新
   * PUT /operation-details/:id
   */
  updateOperationDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const rawData = req.body;

    if (!id) {
      throw new ValidationError('IDは必須です');
    }

    logger.info('運行詳細更新', { userId, id, rawData });

    // ================================================================
    // フロントエンドから送られる不正フィールドを除去して安全なDTOを構築
    // locationName は Prismaスキーマに存在しないため除去
    // actualStartTime/actualEndTime は文字列→Dateに変換
    // ================================================================
    const allowedFields = [
      'sequenceNumber', 'activityType', 'locationId', 'itemId',
      'plannedTime', 'actualStartTime', 'actualEndTime',
      'quantityTons', 'notes',
      'latitude', 'longitude', 'altitude', 'gpsAccuracyMeters', 'gpsRecordedAt'
    ];

    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (rawData[key] !== undefined) {
        data[key] = rawData[key];
      }
    }

    // ISO文字列 → Date 変換
    if (data.actualStartTime && typeof data.actualStartTime === 'string') {
      data.actualStartTime = new Date(data.actualStartTime);
    }
    if (data.actualEndTime && typeof data.actualEndTime === 'string') {
      data.actualEndTime = new Date(data.actualEndTime);
    }
    if (data.plannedTime && typeof data.plannedTime === 'string') {
      data.plannedTime = new Date(data.plannedTime);
    }
    if (data.gpsRecordedAt && typeof data.gpsRecordedAt === 'string') {
      data.gpsRecordedAt = new Date(data.gpsRecordedAt);
    }

    // locationName が送られた場合: 場所マスタを name で検索して locationId に変換
    if (rawData.locationName && !rawData.locationId) {
      try {
        const locs = await this.locationService.findMany({
          where: { name: rawData.locationName }
        });
        const locArr = Array.isArray(locs) ? locs : (locs as any)?.data || [];
        if (locArr.length > 0 && locArr[0]?.id) {
          data.locationId = locArr[0].id;
        }
      } catch (e) {
        // locationName の解決に失敗しても更新は継続
        logger.warn('locationName → locationId 解決失敗', { locationName: rawData.locationName });
      }
    }

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
    const { id } = req.params;

    // ✅ 修正: undefinedチェック追加
    if (!id) {
      throw new ValidationError('IDは必須です');
    }

    logger.info('運行詳細削除', { userId, id });

    await this.operationDetailService.delete(id);

    return sendSuccess(res, { id });
  });

  /**
   * 運行別詳細一覧取得
   * GET /operation-details/by-operation/:operationId
   * ✅ operationDetailRoutes.ts が参照するため必須メソッド
   */
  getOperationDetailsByOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { operationId } = req.params;

    if (!operationId) {
      throw new ValidationError('運行IDは必須です');
    }

    logger.info('運行別詳細一覧取得', { userId, operationId });

    const operationDetails = await this.operationDetailService.findMany({
      where: { operationId }
    });

    // シーケンス番号でソート
    const sorted = Array.isArray(operationDetails)
      ? operationDetails.sort((a: any, b: any) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
      : [];

    return sendSuccess(res, sorted);
  });

  /**
   * 作業効率分析
   * GET /operation-details/efficiency-analysis
   */
  getEfficiencyAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    logger.info('作業効率分析取得', { userId, startDate, endDate });

    // ✅ 修正: DatabaseService.getInstance() を使用
    const db = DatabaseService.getInstance();

    // フィルター条件の構築
    const filter: any = {};
    if (startDate) {
      filter.actualStartTime = { gte: new Date(startDate) };
    }
    if (endDate) {
      filter.actualEndTime = { ...filter.actualEndTime, lte: new Date(endDate) };
    }

    // 作業種別別集計
    const details = await db.operationDetail.findMany({
      where: filter,
      select: {
        activityType: true,
        actualStartTime: true,
        actualEndTime: true,
        plannedTime: true
      }
    });

    // 種別ごとに集計
    const byActivityType: Record<string, {
      total: number;
      completed: number;
      completionRate: number;
      avgDurationMinutes: number;
    }> = {};

    details.forEach((d: any) => {
      const type = d.activityType || 'UNKNOWN';
      if (!byActivityType[type]) {
        byActivityType[type] = { total: 0, completed: 0, completionRate: 0, avgDurationMinutes: 0 };
      }
      byActivityType[type].total++;
      if (d.actualEndTime) {
        byActivityType[type].completed++;
        if (d.actualStartTime) {
          const durationMs = new Date(d.actualEndTime).getTime() - new Date(d.actualStartTime).getTime();
          byActivityType[type].avgDurationMinutes += durationMs / 60000;
        }
      }
    });

    // 完了率・平均時間を計算
    Object.keys(byActivityType).forEach(type => {
      const entry = byActivityType[type];
      if (!entry) return;
      entry.completionRate = entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0;
      entry.avgDurationMinutes = entry.completed > 0 ? Math.round(entry.avgDurationMinutes / entry.completed) : 0;
    });

    const result = {
      totalOperations: details.length,
      completedOperations: details.filter((d: any) => d.actualEndTime).length,
      byActivityType
    };

    return sendSuccess(res, result);
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

    if (!Array.isArray(operationIds) || operationIds.length === 0) {
      throw new ValidationError('運行詳細IDの配列は必須です');
    }
    if (!['complete', 'cancel'].includes(action)) {
      throw new ValidationError('アクションは complete または cancel のいずれかです');
    }

    logger.info('一括作業操作', { userId, operationIds, action });

    const results: { success: string[]; failed: { id: string; error: string }[] } = {
      success: [],
      failed: []
    };

    for (const id of operationIds) {
      try {
        const updateData: any = {};
        if (action === 'complete') {
          updateData.actualEndTime = new Date();
        } else if (action === 'cancel') {
          updateData.notes = 'キャンセル';
        }
        await this.operationDetailService.update(id, updateData);
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
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };

    return sendSuccess(res, stats);
  });
}

export default OperationDetailController;
