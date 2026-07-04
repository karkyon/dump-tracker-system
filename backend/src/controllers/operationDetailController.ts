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
import { ValidationError, AuthorizationError } from '../utils/errors';
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
  imageUrl?: string | null;  // REQ-020
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
  // ✅ 手入力品目名（マスタにない品目、notesの[手入力品目:xxx]タグから抽出）
  customItemName?: string | null;
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
          // ✅ 修正②: 積込/荷降1件ごとの客先（operation_details.customerId）を
          // タイムライン表示で使うために取得する
          customers: { select: { id: true, name: true } },
                    operationDetailItems: {  // ✅ 複数品目を取得
            include: { items: true },
            orderBy: { sequenceOrder: 'asc' }
          }
        },
        orderBy: [
          { actualStartTime: 'asc' },
          { plannedTime: 'asc' },
          { sequenceNumber: 'asc' }
        ]
      });

      // ✅ 修正【自己修復・根本対応】: 「積込〜荷降は1セットで同じ客先」を
      // タイムライン取得の"その都度"必ず検査し、既存データ（過去に作成されたもの、
      // 何らかの理由でずれてしまったもの含む）であっても自動で修正する。
      // 積込〜荷降が何回目のペアであっても、sequenceNumber順に見て
      // 直前の積込の客先を正として、荷降側が異なっていればDBごと更新する。
      {
        const sortedForPairing = [...operationDetails].sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber);
        let currentLoading: any = null;
        for (const d of sortedForPairing) {
          if (d.activityType === 'LOADING') {
            currentLoading = d;
          } else if (d.activityType === 'UNLOADING') {
            if (currentLoading && currentLoading.customerId && d.customerId !== currentLoading.customerId) {
              await db.operationDetail.update({
                where: { id: d.id },
                data: { customerId: currentLoading.customerId }
              });
              (d as any).customerId = currentLoading.customerId;
              (d as any).customers = currentLoading.customers ?? null;
              logger.info('✅ [getAllOperationDetails] 自己修復: 荷降の客先を直前の積込に合わせて修正', {
                unloadingId: d.id, loadingId: currentLoading.id, customerId: currentLoading.customerId
              });
            }
          }
        }
      }

      // =====================================
      // 4. GPSログを取得（走行軌跡用）
      // ✅ take上限撤廃 → 全件取得 + 可変間引き
      // =====================================
      const allGpsLogs = await db.gpsLog.findMany({
        where: { operationId: operationId as string },
        orderBy: { recordedAt: 'asc' },
        select: {
          latitude: true,
          longitude: true,
          recordedAt: true,
          speedKmh: true
        }
      });

      // =====================================
      // 4b. 可変間引き: 目標描画点数ベース
      //   < 500件   → 全件描画
      //   < 2000件  → 目標500点
      //   < 5000件  → 目標1000点
      //   < 10000件 → 目標1500点
      //   < 20000件 → 目標2000点
      //   20000以上 → 目標2500点
      // イベントタイムスタンプ±30秒のGPS点は強制保持
      // =====================================
      const totalGpsCount = allGpsLogs.length;

      const eventTimestamps: number[] = [];
      if (operation.actualStartTime) eventTimestamps.push(new Date(operation.actualStartTime).getTime());
      if (operation.actualEndTime)   eventTimestamps.push(new Date(operation.actualEndTime).getTime());
      operationDetails.forEach((d: any) => {
        if (d.actualStartTime) eventTimestamps.push(new Date(d.actualStartTime).getTime());
        if (d.actualEndTime)   eventTimestamps.push(new Date(d.actualEndTime).getTime());
      });
      inspectionRecords.forEach((ir: any) => {
        if (ir.startedAt)   eventTimestamps.push(new Date(ir.startedAt).getTime());
        if (ir.completedAt) eventTimestamps.push(new Date(ir.completedAt).getTime());
      });
      const EVENT_PROTECT_MS = 30 * 1000;

      const isProtected = (recordedAt: Date): boolean => {
        const t = new Date(recordedAt).getTime();
        return eventTimestamps.some(et => Math.abs(t - et) <= EVENT_PROTECT_MS);
      };

      let targetPoints: number;
      if (totalGpsCount < 500)        targetPoints = totalGpsCount;
      else if (totalGpsCount < 2000)  targetPoints = 500;
      else if (totalGpsCount < 5000)  targetPoints = 1000;
      else if (totalGpsCount < 10000) targetPoints = 1500;
      else if (totalGpsCount < 20000) targetPoints = 2000;
      else                            targetPoints = 2500;

      const thinInterval = targetPoints >= totalGpsCount
        ? 1
        : Math.ceil(totalGpsCount / targetPoints);

      const gpsLogs = thinInterval <= 1
        ? allGpsLogs
        : allGpsLogs.filter((log: any, idx: number) => {
            if (idx === 0 || idx === allGpsLogs.length - 1) return true;
            if (isProtected(log.recordedAt)) return true;
            return idx % thinInterval === 0;
          });

      logger.info('🗺️ GPS間引き', {
        operationId,
        totalGpsCount,
        targetPoints,
        thinInterval,
        sampledCount: gpsLogs.length
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
          // ✅ 修正①②: 「運行開始」の定型文言は廃止。運行開始/終了には
          // ユーザーが入力する備考欄が存在しないため notes は null とする。
          notes: null
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
            // ✅ 修正①: 「運行前点検 (PENDING)」等の定型文言を廃止。
            // 実際の点検メモは overallNotes フィールドで別途保持・表示する。
            notes: null
          });
        });

      // 5-3. 運行詳細イベント（積込/積降/給油/休憩など）
      // 🆕 LOADING → LOADING_ARRIVED + LOADING_COMPLETED に展開
      //    モバイルの loading/start（actualStartTime=到着時刻）と
      //    loading/complete（actualEndTime=積込完了時刻）を個別イベントとして返却
      // 🆕 UNLOADING → UNLOADING_ARRIVED + UNLOADING_COMPLETED に展開
      //    モバイルの unloading/start（actualStartTime=到着時刻）と
      //    unloading/complete（actualEndTime=積降完了時刻）を個別イベントとして返却
      // ✅ 修正③: notesに埋め込まれた「[タグ名: 値]」形式のタグ値を抽出するヘルパー
      // （mobileController.ts の parseNoteTag と同じロジック。給油所名・手入力品目名で使用）
      const parseTimelineNoteTag = (notes: string | null | undefined, tag: string): { value: string | undefined; rest: string } => {
        if (!notes) return { value: undefined, rest: '' };
        const openTag = '[' + tag + ':';
        const startIdx = notes.indexOf(openTag);
        if (startIdx === -1) return { value: undefined, rest: notes };
        const endIdx = notes.indexOf(']', startIdx);
        if (endIdx === -1) return { value: undefined, rest: notes };
        const value = notes.slice(startIdx + openTag.length, endIdx).trim();
        const rest = (notes.slice(0, startIdx) + notes.slice(endIdx + 1)).trim();
        return { value, rest };
      };

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
          // ✅ FIX: 品目なし・完了なし（到着のみ離脱）の空LOADINGは非表示
          const _isEmptyLoading = !detail.actualEndTime && !detail.itemId
            && (Number(detail.quantityTons) === 0 || detail.quantityTons == null)
            && !(detail.operationDetailItems?.length > 0);
          if (!_isEmptyLoading) {
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
            // ✅ 修正②: この積込1件ごとの客先(detail.customerId)を優先し、
            // 未設定の場合のみ運行全体の客先にフォールバックする
            customerId: detail.customerId ?? operation?.customerId ?? null,
            customerName: (detail as any).customers?.name ?? (operation as any)?.customer?.name ?? null,
          });

          // 🆕 積込: 積込完了イベント
          //    モバイルの積込は1画面完結のため actualEndTime が null のケースがある
          //    → actualEndTime が null でも quantityTons > 0 または itemId があれば完了とみなす
          //    timestamp: actualEndTime があればそれ、なければ actualStartTime を使用
          const loadingHasContent = Number(detail.quantityTons) > 0 || detail.itemId;
          const loadingCompletedTime = detail.actualEndTime || (loadingHasContent ? (detail.actualStartTime || detail.plannedTime) : null);
          if (loadingCompletedTime) {
            // ✅ 修正③: notesに埋め込まれた「[手入力品目: xxx]」タグを分離し、
            // customItemNameとして返す（CMSタイムラインに表示するため）
            const { value: loadCustomItemName, rest: loadNotesRest } = parseTimelineNoteTag(detail.notes, '手入力品目');
            timeline.push({
              id: `${detail.id}-completed`,
              sequenceNumber: ++sequenceCounter,
              eventType: 'LOADING_COMPLETED',
              timestamp: loadingCompletedTime,
              location: locationData,
              gpsLocation: null,
              quantityTons: Number(detail.quantityTons) || 0,
              items: itemsData,
              imageUrl: detail.imageUrl || null,  // REQ-020: 積載物写真URL
              // ✅ 修正②: この積込1件ごとの客先(detail.customerId)を優先
              customerId: detail.customerId ?? operation?.customerId ?? null,
              customerName: (detail as any).customers?.name ?? (operation as any)?.customer?.name ?? null,
              detailItems: (detail.operationDetailItems || []).map((di: any) => ({
                id: di.id,
                itemId: di.itemId,
                itemName: di.items?.name ?? '',
                quantityTons: Number(di.quantityTons),
                sequenceOrder: di.sequenceOrder,
              })),
              customItemName: loadCustomItemName || null,
              notes: loadNotesRest || null
            });
          }
          } // ✅ FIX: 空LOADING非表示 if(!_isEmptyLoading) の閉じ

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
            // ✅ 修正②: この荷降1件ごとの客先(detail.customerId)を優先
            customerId: detail.customerId ?? operation?.customerId ?? null,
            customerName: (detail as any).customers?.name ?? (operation as any)?.customer?.name ?? null,
          });

          // 🆕 積降: 積降完了イベント（actualEndTime = 積降完了時刻）
          //    モバイルの POST /trips/:id/unloading/complete に対応
          //    actualEndTime が設定されている場合のみ生成
          if (detail.actualEndTime) {
            // ✅ 修正③: 荷降でもLOADINGと同様に手入力品目名タグと複数品目リストを返す
            const { value: unlCustomItemName, rest: unlNotesRest } = parseTimelineNoteTag(detail.notes, '手入力品目');
            timeline.push({
              id: `${detail.id}-completed`,
              sequenceNumber: ++sequenceCounter,
              eventType: 'UNLOADING_COMPLETED',
              timestamp: detail.actualEndTime,
              location: locationData,
              gpsLocation: null,
              quantityTons: Number(detail.quantityTons) || 0,
              items: itemsData,
              // ✅ 修正②: この荷降1件ごとの客先(detail.customerId)を優先
              customerId: detail.customerId ?? operation?.customerId ?? null,
              customerName: (detail as any).customers?.name ?? (operation as any)?.customer?.name ?? null,
              detailItems: (detail.operationDetailItems || []).map((di: any) => ({
                id: di.id,
                itemId: di.itemId,
                itemName: di.items?.name ?? '',
                quantityTons: Number(di.quantityTons),
                sequenceOrder: di.sequenceOrder,
              })),
              customItemName: unlCustomItemName || null,
              notes: (unlNotesRest && unlNotesRest !== '積降完了') ? unlNotesRest : null
            });
          }

        } else {
          // ─────────────────────────────────────────
          // その他（FUELING, BREAK_START, BREAK_END,
          //         TRANSPORTING, WAITING, MAINTENANCE,
          //         REFUELING, OTHER）は既存動作を維持
          // ─────────────────────────────────────────
          // ✅ 修正①: 給油は記録時にスタンド名を notes へ「[給油所: xxx] 本文」の形で
          // タグ埋め込み保存している（tripService.addFuelRecord）。CMSの備考欄に
          // このタグがそのまま表示されてしまう不具合を防ぐため、ここで分離する。
          // スタンド名は location.name として渡し、notesはユーザー入力の本文のみにする。
          let otherLocationData = locationData;
          let otherNotes: string | null = detail.notes ?? null;
          if ((detail.activityType === 'FUELING' || detail.activityType === 'REFUELING') && detail.notes) {
            const fuelTagMatch = detail.notes.match(/^\[給油所:\s*([^\]]*)\]\s*([\s\S]*)$/);
            if (fuelTagMatch) {
              const stationName = (fuelTagMatch[1] ?? '').trim();
              const restNotes = (fuelTagMatch[2] ?? '').trim();
              if (stationName) {
                otherLocationData = { id: '', name: stationName, address: '', latitude: 0, longitude: 0 };
              }
              otherNotes = restNotes || null;
            }
          }
          timeline.push({
            id: detail.id,
            sequenceNumber: ++sequenceCounter,
            eventType: detail.activityType as any,
            timestamp: detail.actualStartTime || detail.plannedTime,
            location: otherLocationData,
            gpsLocation: gpsLocationData,
            quantityTons: Number(detail.quantityTons) || 0,
            items: itemsData,
            fuelCostYen: detail.fuelCostYen ? Number(detail.fuelCostYen) : null,  // ✅ 給油金額
            notes: otherNotes
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
            // ✅ 修正①: 「運行後点検 (PENDING)」等の定型文言を廃止。
            // 実際の点検メモは overallNotes、走行距離・燃料は totalDistanceKm/fuelConsumedLiters で別途保持する。
            notes: null
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
          // ✅ 修正④: 運行終了イベントの編集で走行距離を扱えるようにtotalDistanceKmを含める
          totalDistanceKm: (operation as any).totalDistanceKm ? Number((operation as any).totalDistanceKm) : null,
          // ✅ 修正②: 「運行終了」の定型文言を廃止
          notes: null
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
        // ✅ 走行軌跡用GPSログ（間引き済み）
        // totalGpsCount=DB実件数, routeGpsLogs.length=描画点数
        routeGpsLogs: gpsLogs.map((log: any) => ({
          latitude: Number(log.latitude),
          longitude: Number(log.longitude),
          recordedAt: log.recordedAt,
          speedKmh: log.speedKmh ? Number(log.speedKmh) : null
        })),
        totalGpsCount
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
   * 🆕 運行履歴「イベント追加」機能: sequenceNumber未指定時は自動採番、
   *    日時文字列をDateに変換、複数品目(selectedItemIds)はoperation_detail_itemsへ保存
   */
  createOperationDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const data = req.body;

    logger.info('運行詳細作成', { userId, data });

    // ✅ 新機能: イベントとイベントの間に挿入する場合（運行履歴編集画面の「+」マーカーからの追加）
    // insertAfterSequenceNumber で指定された値より大きい sequenceNumber を持つ既存レコードを
    // すべて+1して後ろへずらし、空いた位置(insertAfterSequenceNumber+1)に新規レコードを挿入する。
    if (data.insertAfterSequenceNumber !== undefined && data.operationId) {
      const insertAfter = Number(data.insertAfterSequenceNumber);
      const db = DatabaseService.getInstance();
      const toShift = await db.operationDetail.findMany({
        where: { operationId: data.operationId, sequenceNumber: { gt: insertAfter } },
        orderBy: { sequenceNumber: 'desc' },
        select: { id: true, sequenceNumber: true }
      });
      // ✅ 大きい番号から順にずらすことで一意制約(operationId, sequenceNumber)に抵触しない
      for (const rec of toShift) {
        await db.operationDetail.update({
          where: { id: rec.id },
          data: { sequenceNumber: rec.sequenceNumber + 1 }
        });
      }
      data.sequenceNumber = insertAfter + 1;
      logger.info('✅ [createOperationDetail] 位置指定挿入: 既存レコードをシフト', {
        insertAfter, shiftedCount: toShift.length, newSequenceNumber: data.sequenceNumber
      });
    }

    // 🆕 sequenceNumber未指定の場合は運行内最大値+1で自動採番
    if (data.sequenceNumber === undefined && data.operationId) {
      const existingForSeq = await this.operationDetailService.findMany({
        where: { operationId: data.operationId },
        orderBy: { sequenceNumber: 'desc' },
        take: 1
      });
      const seqArr = Array.isArray(existingForSeq) ? existingForSeq : [];
      const maxSeq = seqArr[0]?.sequenceNumber ?? 0;
      data.sequenceNumber = maxSeq + 1;
    }

    // ✅ 手入力の場所名（登録リスト未選択時）は既存の場所マスタから名前一致で解決する
    // （updateOperationDetailの挙動と統一。一致しない場合はlocationIdなしで作成される）
    if (data.locationName && !data.locationId) {
      try {
        const locs = await this.locationService.findMany({ where: { name: data.locationName } });
        const arr = Array.isArray(locs) ? locs : (locs as any)?.data || [];
        if (arr[0]?.id) data.locationId = arr[0].id;
      } catch { /* 継続 */ }
      delete data.locationName;
    }

    // 🆕 日時文字列をDateに変換
    if (data.actualStartTime && typeof data.actualStartTime === 'string') {
      data.actualStartTime = new Date(data.actualStartTime);
    }
    if (data.actualEndTime && typeof data.actualEndTime === 'string') {
      data.actualEndTime = new Date(data.actualEndTime);
    }

    const operationDetail = await this.operationDetailService.create(data);

    // ✅ 修正: 「積込〜荷降は1セットで同じ客先」の仕様をイベント作成時にも強制する。
    // フロント側の直近積込客先の推測（画面上のタイムライン再取得タイミング次第）に
    // 頼るだけでは古いデータを参照してしまう可能性があるため、作成直後にDBの実データを
    // 基準として確実にペアへ反映・継承する（updateOperationDetailのカスケード処理と同じ考え方）。
    if (operationDetail && (operationDetail.activityType === 'LOADING' || operationDetail.activityType === 'UNLOADING') && operationDetail.operationId) {
      try {
        const dbForPair = DatabaseService.getInstance();
        const siblings = await dbForPair.operationDetail.findMany({
          where: { operationId: operationDetail.operationId },
          orderBy: { sequenceNumber: 'asc' },
          select: { id: true, activityType: true, sequenceNumber: true, customerId: true }
        });
        const myIndex = siblings.findIndex((s: any) => s.id === operationDetail.id);
        if (myIndex !== -1) {
          if (operationDetail.activityType === 'UNLOADING') {
            // ✅ 修正【根本原因】: 「積込〜荷降は1セットで同じ客先」は例外のない業務ルールのため、
            // フロントから送られてきたcustomerId（古い/誤ったデフォルト値の可能性がある）の
            // 有無に関わらず、常に直前の積込（間に別の荷降が無い範囲）の客先で強制的に上書きする。
            for (let k = myIndex - 1; k >= 0; k--) {
              const s = siblings[k];
              if (!s) continue;
              if (s.activityType === 'UNLOADING') break;
              if (s.activityType === 'LOADING') {
                if (s.customerId && s.customerId !== (operationDetail as any).customerId) {
                  await dbForPair.operationDetail.update({ where: { id: operationDetail.id }, data: { customerId: s.customerId } });
                  (operationDetail as any).customerId = s.customerId;
                  logger.info('✅ [createOperationDetail] 荷降の客先を直前の積込に強制的に合わせた', { unloadingId: operationDetail.id, loadingId: s.id, customerId: s.customerId });
                }
                break;
              }
            }
          } else if (operationDetail.activityType === 'LOADING' && (operationDetail as any).customerId) {
            // 直後の荷降（間に別の積込が無い範囲）に客先が未設定なら継承させる
            for (let k = myIndex + 1; k < siblings.length; k++) {
              const s = siblings[k];
              if (!s) continue;
              if (s.activityType === 'LOADING') break;
              if (s.activityType === 'UNLOADING') {
                if (!s.customerId) {
                  await dbForPair.operationDetail.update({ where: { id: s.id }, data: { customerId: (operationDetail as any).customerId } });
                  logger.info('✅ [createOperationDetail] 直後の荷降へ積込の客先を継承', { loadingId: operationDetail.id, unloadingId: s.id, customerId: (operationDetail as any).customerId });
                }
                break;
              }
            }
          }
        }
      } catch (e) {
        logger.warn('積込〜荷降ペアへの客先自動継承に失敗（本体の作成は成功済み）', { id: operationDetail.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // 🆕 複数品目（積込/積降の selectedItemIds）を operation_detail_items に保存
    if (Array.isArray(data.selectedItemIds) && data.selectedItemIds.length > 0) {
      const db = DatabaseService.getInstance();
      for (let i = 0; i < data.selectedItemIds.length; i++) {
        await db.operationDetailItem.create({
          data: {
            operationDetailId: operationDetail.id,
            itemId: data.selectedItemIds[i],
            quantityTons: Number(data.quantityTons ?? 0),
            sequenceOrder: i
          }
        });
      }
      logger.info('✅ [createOperationDetail] operationDetailItems保存完了', { count: data.selectedItemIds.length });
    }

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

    // ✅ 修正: 以前はここで運行全体(operations.customerId)を即座に書き換えており、
    // 1つの積込の客先を変更しただけで運行中の他の積込・荷降まで巻き込んで変わってしまうバグの原因だった。
    // PATTERN 3/4 側で operation_details.customer_id に個別保存するのでここでのグローバル更新は廃止する。
    const applyCustomerCascade = async (detailId: string, activityType: string, customerId: string) => {
      try {
        const target = await db.operationDetail.findUnique({ where: { id: detailId }, select: { operationId: true } });
        if (!target) return;
        const siblings = await db.operationDetail.findMany({
          where: { operationId: target.operationId },
          orderBy: { sequenceNumber: 'asc' },
          select: { id: true, activityType: true, sequenceNumber: true }
        });
        const myIndex = siblings.findIndex((s: any) => s.id === detailId);
        let pairedId: string | null = null;
        if (myIndex !== -1) {
          if (activityType === 'LOADING') {
            for (let k = myIndex + 1; k < siblings.length; k++) {
              const s = siblings[k];
              if (!s) continue;
              if (s.activityType === 'LOADING') break;
              if (s.activityType === 'UNLOADING') { pairedId = s.id; break; }
            }
          } else if (activityType === 'UNLOADING') {
            for (let k = myIndex - 1; k >= 0; k--) {
              const s = siblings[k];
              if (!s) continue;
              if (s.activityType === 'UNLOADING') break;
              if (s.activityType === 'LOADING') { pairedId = s.id; break; }
            }
          }
        }
        if (pairedId) {
          await db.operationDetail.update({ where: { id: pairedId }, data: { customerId } });
          logger.info('積込〜荷降ペアへの客先反映完了（CMS）', { detailId, pairedId, customerId });
        }
      } catch (e) {
        logger.warn('積込〜荷降ペアへの客先反映失敗（CMS）', { detailId, error: e instanceof Error ? e.message : String(e) });
      }
    };

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
      // ✅ 修正④: 運行終了イベント編集画面から走行距離を修正できるようにする
      if (rawData.totalDistanceKm !== undefined) data.totalDistanceKm = parseFloat(String(rawData.totalDistanceKm));
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
      if (rawData.customerId !== undefined) data.customerId = rawData.customerId;
      // ✅ 修正③: 登録リストから選択した場合はlocationIdが直接送られてくる。
      // 以前はこのケースが一切処理されず、場所を変更する手段が実質なかった。
      if (rawData.locationId !== undefined) {
        data.locationId = rawData.locationId;
      } else if (rawData.locationName) {
        try {
          const locs = await this.locationService.findMany({ where: { name: rawData.locationName } });
          const arr = Array.isArray(locs) ? locs : (locs as any)?.data || [];
          if (arr[0]?.id) data.locationId = arr[0].id;
        } catch { /* 継続 */ }
      }
      const updated = await this.operationDetailService.update(detailId, data);
      if (!updated) return sendNotFound(res, '運行詳細が見つかりません');
      if (data.customerId !== undefined) {
        await applyCustomerCascade(detailId, (updated as any).activityType, data.customerId);
      }
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
      if (rawData.customerId !== undefined) data.customerId = rawData.customerId;
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
      if (data.customerId !== undefined) {
        await applyCustomerCascade(detailId, (updated as any).activityType, data.customerId);
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
    const allowedFields = ['sequenceNumber', 'activityType', 'locationId', 'itemId', 'customerId',
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
    const userRole = req.user!.role;
    const { id } = req.params;
    const rawData = req.body;

    if (!id) {
      throw new ValidationError('ID\u306f\u5fc5\u9808\u3067\u3059');
    }

    const _db = DatabaseService.getInstance();
    const _existingDetail = await _db.operationDetail.findUnique({
      where: { id },
      include: { operations: { select: { driverId: true, actualStartTime: true, plannedStartTime: true } } }
    });

    // REQ-021: DRIVER は自分の運行の記録のみ修正可
    if (userRole === 'DRIVER') {
      if (_existingDetail) {
        if (_existingDetail.operations?.driverId !== userId) {
          throw new AuthorizationError('この記録を修正する権限がありません');
        }
        // ✅ 修正: 当日限定チェックはJST変換ロジックに不具合があり、
        //   同日の記録編集まで誤って権限エラーにしていたため削除。
        //   所有者チェック（driverId一致）のみで十分なため、日付制限は撤廃する。
      }
    }

    logger.info('\u904b\u884c\u8a73\u7d30\u66f4\u65b0', { userId, id, rawData });

    // ================================================================
    // \u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u304b\u3089\u9001\u3089\u308c\u308b\u4e0d\u6b63\u30d5\u30a3\u30fc\u30eb\u30c9\u3092\u9664\u53bb\u3057\u3066\u5b89\u5168\u306aDTO\u3092\u69cb\u7bc9
    // locationName \u306f Prisma\u30b9\u30ad\u30fc\u30de\u306b\u5b58\u5728\u3057\u306a\u3044\u305f\u3081\u9664\u53bb\uff08\u5225\u9014 notes \u30bf\u30b0\u3078\u5909\u63db\uff09
    // actualStartTime/actualEndTime \u306f\u6587\u5b57\u5217\u2192Date\u306b\u5909\u63db
    // ================================================================
    const allowedFields = [
      'sequenceNumber', 'activityType', 'locationId', 'itemId', 'customerId',
      'plannedTime', 'actualStartTime', 'actualEndTime',
      'quantityTons', 'notes', 'imageUrl',  // REQ-020
      'fuelCostYen', 'odometerKm',          // \u7d66\u6cb9\u91d1\u984d\u30fb\u7d66\u6cb9\u6642\u8d70\u884c\u8ddd\u96e2\uff08\u30e2\u30d0\u30a4\u30eb\u7de8\u96c6\u30b7\u30fc\u30c8\u5bfe\u5fdc\uff09
      'latitude', 'longitude', 'altitude', 'gpsAccuracyMeters', 'gpsRecordedAt'
    ];

    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (rawData[key] !== undefined) {
        data[key] = rawData[key];
      }
    }

    // ISO\u6587\u5b57\u5217 \u2192 Date \u5909\u63db
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

    // \u73fe\u5728\u306e notes \u3092\u30d9\u30fc\u30b9\u306b\u30bf\u30b0\u57cb\u3081\u8fbc\u307f\u3092\u30de\u30fc\u30b8\u3059\u308b\u30d8\u30eb\u30d1\u30fc
    const mergeNoteTag = (baseNotes: string, tag: string, value: string): string => {
      const openTag = '[' + tag + ':';
      const startIdx = baseNotes.indexOf(openTag);
      let rest = baseNotes;
      if (startIdx !== -1) {
        const endIdx = baseNotes.indexOf(']', startIdx);
        if (endIdx !== -1) {
          rest = (baseNotes.slice(0, startIdx) + baseNotes.slice(endIdx + 1)).trim();
        }
      }
      const tagged = openTag + ' ' + value + ']';
      return rest ? `${tagged} ${rest}` : tagged;
    };

    const currentActivityType = (rawData.activityType as string | undefined)
      || _existingDetail?.activityType
      || '';
    const currentNotesBase = (typeof data.notes === 'string' ? data.notes : (_existingDetail?.notes || '')) as string;
    let notesWorking = currentNotesBase;

    // locationName \u304c\u9001\u3089\u308c\u305f\u5834\u5408: \u5834\u6240\u30de\u30b9\u30bf\u3092 name \u3067\u691c\u7d22\u3057\u3066 locationId \u306b\u5909\u63db
    // \uff08\u30d5\u30ed\u30f3\u30c8\u3067\u767b\u9332\u30ea\u30b9\u30c8\u304b\u3089\u9078\u629e\u3055\u308c locationId \u304c\u76f4\u63a5\u9001\u3089\u308c\u305f\u5834\u5408\u306f\u3053\u306e\u51e6\u7406\u306f\u4e0d\u8981\uff09
    if (rawData.locationName && !rawData.locationId) {
      if (currentActivityType === 'FUELING') {
        // \u7d66\u6cb9: \u5834\u6240\u30de\u30b9\u30bf\u3067\u306f\u306a\u304f\u30b9\u30bf\u30f3\u30c9\u540d\u3068\u3057\u3066 notes \u30bf\u30b0\u306b\u4fdd\u5b58
        notesWorking = mergeNoteTag(notesWorking, '\u7d66\u6cb9\u6240', String(rawData.locationName));
      } else {
        try {
          const locs = await this.locationService.findMany({
            where: { name: rawData.locationName }
          });
          const locArr = Array.isArray(locs) ? locs : (locs as any)?.data || [];
          if (locArr.length > 0 && locArr[0]?.id) {
            data.locationId = locArr[0].id;
          } else {
            // \u30de\u30b9\u30bf\u306b\u4e00\u81f4\u304c\u306a\u3044\u81ea\u7531\u5165\u529b\u5834\u6240\u540d\u306f notes \u30bf\u30b0\u306b\u4fdd\u5b58
            notesWorking = mergeNoteTag(notesWorking, '\u5834\u6240\u540d', String(rawData.locationName));
          }
        } catch (e) {
          logger.warn('locationName \u2192 locationId \u89e3\u6c7a\u5931\u6557', { locationName: rawData.locationName });
          notesWorking = mergeNoteTag(notesWorking, '\u5834\u6240\u540d', String(rawData.locationName));
        }
      }
    }

    // customItemName \u304c\u9001\u3089\u308c\u305f\u5834\u5408: notes \u30bf\u30b0\u306b\u30de\u30fc\u30b8\uff08\u624b\u5165\u529b\u54c1\u76ee\u540d\uff09
    if (rawData.customItemName) {
      notesWorking = mergeNoteTag(notesWorking, '\u624b\u5165\u529b\u54c1\u76ee', String(rawData.customItemName));
    }

    if (notesWorking !== currentNotesBase || data.notes !== undefined) {
      data.notes = notesWorking;
    }

    const operationDetail = await this.operationDetailService.update(id, data);

    if (!operationDetail) {
      return sendNotFound(res, '\u904b\u884c\u8a73\u7d30\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093');
    }

    // \u2705 \u8907\u6570\u54c1\u76ee: selectedItemIds \u304c\u9001\u3089\u308c\u305f\u5834\u5408\u306f operation_detail_items \u3092\u5168\u4ef6\u4f5c\u308a\u76f4\u3059
    if (Array.isArray(rawData.selectedItemIds) && rawData.selectedItemIds.length > 0) {
      await _db.operationDetailItem.deleteMany({ where: { operationDetailId: id } });
      const qty = data.quantityTons !== undefined ? Number(data.quantityTons) : 0;
      for (let idx = 0; idx < rawData.selectedItemIds.length; idx++) {
        const sid = rawData.selectedItemIds[idx];
        if (sid) {
          await _db.operationDetailItem.create({
            data: { operationDetailId: id, itemId: sid, quantityTons: qty, sequenceOrder: idx }
          });
        }
      }
      logger.info('\u2705 [updateOperationDetail] operationDetailItems\u518d\u4fdd\u5b58\u5b8c\u4e86', { id, count: rawData.selectedItemIds.length });
    }

    // 積込～荷降しは1サイクルにつき1つの客先という要件のため、
    // customerId が変更された場合はペアとなる積込/荷降にも同じ客先を反映する
    if (data.customerId !== undefined && (currentActivityType === 'LOADING' || currentActivityType === 'UNLOADING')) {
      try {
        const opIdForPair = _existingDetail?.operationId;
        if (opIdForPair) {
          const siblings = await _db.operationDetail.findMany({
            where: { operationId: opIdForPair },
            orderBy: { sequenceNumber: 'asc' },
            select: { id: true, activityType: true, sequenceNumber: true }
          });
          const myIndex = siblings.findIndex((s: any) => s.id === id);
          let pairedId: string | null = null;
          if (myIndex !== -1) {
            if (currentActivityType === 'LOADING') {
              for (let k = myIndex + 1; k < siblings.length; k++) {
                const s = siblings[k];
                if (!s) continue;
                if (s.activityType === 'LOADING') break;
                if (s.activityType === 'UNLOADING') { pairedId = s.id; break; }
              }
            } else {
              for (let k = myIndex - 1; k >= 0; k--) {
                const s = siblings[k];
                if (!s) continue;
                if (s.activityType === 'UNLOADING') break;
                if (s.activityType === 'LOADING') { pairedId = s.id; break; }
              }
            }
          }
          if (pairedId) {
            await _db.operationDetail.update({
              where: { id: pairedId },
              data: { customerId: data.customerId }
            });
            logger.info('積込〜荷降ペアへの客先反映完了', { id, pairedId, customerId: data.customerId });
          }
        }
      } catch (e) {
        logger.warn('積込〜荷降ペアへの客先反映に失敗（本体の更新は成功済み）', { id, error: e instanceof Error ? e.message : String(e) });
      }
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
   * REQ-020: 積載物写真アップロード
   * POST /operation-details/:id/image
   * multer imageUpload.single('image') で処理済み
   */
  uploadImage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) throw new ValidationError('IDは必須です');
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) throw new ValidationError('画像ファイルが必要です');

    // ファイルのURLパスを生成（/uploads/images/ 以下の相対パス）
    const imageUrl = `/uploads/images/${file.filename}`;

    logger.info('REQ-020 積載物写真アップロード', { id, filename: file.filename, imageUrl });

    const updated = await this.operationDetailService.update(id, { imageUrl } as any);
    if (!updated) return sendNotFound(res, '運行詳細が見つかりません');

    return sendSuccess(res, { imageUrl }, '写真をアップロードしました');
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
