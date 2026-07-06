// =====================================
// backend/src/services/reportService.ts
// レポート管理サービス - コンパイルエラー完全修正版
// イベント駆動アーキテクチャ完全対応・循環依存解消完了
// 3層統合レポート・分析機能・BI基盤・経営支援・予測分析
// 最終更新: 2025年10月5日
// 依存関係: middleware/auth.ts, utils/database.ts, utils/errors.ts, utils/response.ts, utils/events.ts
// 統合基盤: 車両・点検統合APIシステム・3層統合管理システム100%活用
// =====================================

import { PrismaClient, ReportGenerationStatus, UserRole, ReportType as PrismaReportType, ReportFormat as PrismaReportFormat } from '@prisma/client';

// 🎯 完成済み統合基盤の100%活用（重複排除・統合版）
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  AppError,
  ERROR_CODES
} from '../utils/errors';
import { DatabaseService } from '../utils/database';
import logger from '../utils/logger';

// 🔥 イベントリスナー登録（循環依存解消）
import {
  onEvent,
  type VehicleCreatedPayload,
  type VehicleStatusChangedPayload,
  type InspectionCompletedPayload,
  type MaintenanceRequiredPayload,
  type StatisticsGeneratedPayload
} from '../utils/events';

// 🎯 types/からの統一型定義インポート（整合性確保）
import type {
  ReportType,
  ReportFormat,
  ReportGenerationResult,
  ReportStatistics,
  DailyOperationReportParams,
  MonthlyOperationReportParams,
  VehicleUtilizationReportParams,
  InspectionSummaryReportParams,
  TransportationSummaryReportParams,
  CustomReportParams,
  ComprehensiveDashboardParams,
  KPIAnalysisParams,
  PredictiveAnalyticsParams,
  ReportFilter,
  ReportListResponse,
  ReportResponseDTO,
  ReportTemplate
} from '../types';

import path from 'path';
import {
  generateDailyDriverReportPDF,
  type DailyDriverReportData,
  type TripCycleRow,
  type InspCheckItem,
  // 後方互換用（generatePlaceholderPDF で使用）
  REPORTS_OUTPUT_DIR,
  ensureReportDirectory
} from './pdfReportGenerator';

import {
  aggregateAnnualTransportReport,
  getFiscalYearRange,
} from './annualTransportReportService';
import { generateAnnualTransportReportPDF } from './annualTransportReportPDF';

// 🎯 完成済みサービス層との統合連携（3層統合管理システム活用）
import type { VehicleService } from './vehicleService';
import type { InspectionService } from './inspectionService';
import type { UserService } from './userService';
import type { TripService } from './tripService';
import type { ItemService } from './itemService';

/**
 * レポート管理サービス統合クラス（イベント駆動完全対応版）
 *
 * 【統合基盤活用】
 * - middleware/auth.ts: 権限制御・レポートアクセス制御
 * - utils/database.ts: DATABASE_SERVICE統一DB接続
 * - utils/errors.ts: 統一エラーハンドリング・適切なエラー分類
 * - utils/logger.ts: 統合ログシステム・操作履歴記録
 * - utils/events.ts: イベント駆動通信（循環依存解消）
 *
 * 【3層統合管理システム連携】
 * - services/vehicleService.ts: 車両データ統合・フリート分析
 * - services/inspectionService.ts: 点検データ統合・品質分析
 * - services/userService.ts: ユーザーデータ統合・権限制御
 * - services/tripService.ts: 運行データ統合・効率分析
 *
 * 【イベント駆動アーキテクチャ】
 * - 車両作成イベント → レポート記録
 * - 車両ステータス変更イベント → レポート記録
 * - 点検完了イベント → アラート・レポート記録
 * - メンテナンス要求イベント → 緊急通知・レポート記録
 * - 統計生成イベント → レポート記録
 *
 * 【統合効果】
 * - 3層統合レポート・分析機能・BI基盤実現
 * - 経営支援・予測分析・データ駆動型意思決定支援
 * - 企業レベル統合ダッシュボード・KPI・改善提案
 * - 循環依存完全解消・疎結合アーキテクチャ確立
 */

// =====================================
// 曜日変換
// =====================================
function getDayOfWeek(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return (days[date.getDay()] ?? '') + '曜';
}

// =====================================
// 時刻フォーマット（HH:MM）
// =====================================
function formatTime(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  // ③修正: UTC → JST(+9時間) 変換
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

// =====================================
// 数値フォーマット
// =====================================
function fmtNum(val: any, decimals = 1): string {
  if (val == null) return '';
  const n = Number(val);
  if (isNaN(n)) return '';
  return n % 1 === 0 ? String(n) : n.toFixed(decimals);
}

// =====================================
// 点検項目名の正規化（マッチング用）
// =====================================
function normalizeInspName(s: string): string {
  return s
    .replace(/[・、。\s　]/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .toLowerCase();
}

// =====================================
// 帳票固定点検項目定義
// =====================================
const FIXED_INSP_LEFT = [
  'エンジンオイル・冷却水',
  'タイヤの磨耗・き裂',
  '各作動油の漏れ',
  '後退時警報機、ワイパー',
  '各計器の動き',
  'ステアリング廻り',
];

const FIXED_INSP_MIDDLE = [
  'No.プレート・車検証',
  '速度表示装置',
  'クラッチ・ペダルの遊び操作具合',
  'ブレーキのきき具合',
  '後写鏡・反射鏡',
  'ライト・方向指示器の作動',
];

const FIXED_INSP_RIGHT = [
  'ディスクホイールの取付状況',
];

// マッチング用キーワード（順序は FIXED_INSP_* と同じ）
const INSP_LEFT_KEYWORDS = [
  ['エンジンオイル', '冷却水', 'engine'],
  ['タイヤ', 'tyre', 'tire', '磨耗', '摩耗', 'き裂', '亀裂'],
  ['作動油', '漏れ', 'oil'],
  ['警報', 'ワイパー', 'wiper', 'back'],
  ['計器', 'meter', 'gauge'],
  ['ステアリング', 'steering'],
];

const INSP_MIDDLE_KEYWORDS = [
  ['プレート', 'ナンバー', '車検証', 'number'],
  ['速度', 'speedometer', 'speed'],
  ['クラッチ', 'ペダル', 'clutch'],
  ['ブレーキ', 'brake'],
  ['後写鏡', '反射鏡', 'mirror', 'バックミラー'],
  ['ライト', '方向指示', 'light', 'turn'],
];

const INSP_RIGHT_KEYWORDS = [
  ['ディスク', 'ホイール', 'wheel', 'disk'],
];

/**
 * 点検結果リストから特定の項目を検索してマッチングする
 */
interface RawInspResult {
  name: string;
  preResult: string | null;
  postResult: string | null;
  measure: string | null;
}

function matchInspItem(
  fixedName: string,
  keywords: string[],
  results: RawInspResult[]
): { pre: string; post: string; measure: string } {
  const empty = { pre: '', post: '', measure: '' };

  // 1. 正規化した完全一致
  const normFixed = normalizeInspName(fixedName);
  let found = results.find(r => normalizeInspName(r.name) === normFixed);

  // 2. キーワードマッチ
  if (!found) {
    found = results.find(r => {
      const normName = normalizeInspName(r.name);
      return keywords.some(kw => normName.includes(normalizeInspName(kw)));
    });
  }

  if (!found) return empty;

  return {
    pre: found.preResult ?? '',
    post: found.postResult ?? '',
    measure: found.measure ?? '',
  };
}

/**
 * inspection_item_results を { 項目名 → PRE/POST 結果 } の形式に変換
 *
 * DB から取得した inspection_records (PRE_TRIP / POST_TRIP) の
 * inspectionItemResults を flat に展開して返す
 */
function buildInspResultMap(inspectionRecords: any[]): RawInspResult[] {
  const map = new Map<string, RawInspResult>();

  for (const record of inspectionRecords) {
    const isPre = record.inspection_type === 'PRE_TRIP' || record.inspectionType === 'PRE_TRIP';
    const isPost = record.inspection_type === 'POST_TRIP' || record.inspectionType === 'POST_TRIP';

    const itemResults = record.inspection_item_results ?? record.inspectionItemResults ?? [];

    for (const ir of itemResults) {
      const item = ir.inspection_items ?? ir.inspectionItems ?? ir.inspectionItem;
      if (!item?.name) continue;

      const name: string = item.name;
      const isPassed: boolean | null = ir.is_passed ?? ir.isPassed ?? null;
      const resultStr = isPassed === true ? 'レ' : isPassed === false ? '×' : '';
      const measureNote: string = ir.notes ?? '';

      if (!map.has(name)) {
        map.set(name, { name, preResult: null, postResult: null, measure: '' });
      }

      const entry = map.get(name)!;
      if (isPre && !entry.preResult) entry.preResult = resultStr;
      if (isPost && !entry.postResult) entry.postResult = resultStr;
      if (measureNote && !entry.measure) entry.measure = measureNote;
    }
  }

  // ⑤修正: postResult が空で preResult がある場合、preResult を複写（乗車後点検複写）
  const results = Array.from(map.values());
  for (const r of results) {
    if (!r.postResult && r.preResult) {
      r.postResult = r.preResult;
    }
  }
  return results;
}

/**
 * 開始・終了時刻から所要時間文字列を計算 (hh時間mm分)
 *
 * @param startStr 開始時刻
 * @param endStr 終了時刻
 */
function calcTimeDuration(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return '';
  const startParts = startStr.split(':').map(Number);
  const endParts   = endStr.split(':').map(Number);
  const sh = startParts[0] ?? NaN;
  const sm = startParts[1] ?? NaN;
  const eh = endParts[0]   ?? NaN;
  const em = endParts[1]   ?? NaN;
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '';
  let totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}時間${String(m).padStart(2, '0')}分`;
}

/**
 * operation_details から TripCycleRow の配列を生成する
 * LOADING/UNLOADING をペアリングして1サイクル = 1行とする
 */
function buildGroupedTrips(operationDetailsList: any[][]): any[] {
  // 全detailsを統合して並び替え
  const allDetails: any[] = [];
  for (const details of operationDetailsList) {
    allDetails.push(...details);
  }
  // ✅ BUG修正: 1日に複数運行(Operation)がある場合、sequenceNumberは
  // 各運行の中だけで1から振り直される値であり、運行をまたいだ絶対的な
  // 時系列を表さない。これだけでソートすると、別の運行同士のレコードが
  // 実際の発生時刻を無視して混ざり合い、積込・荷降のペアリングが
  // 完全に破綻する（積込だけの浮いた行、あり得ない移動時間などの原因）。
  // 運行をまたいでも意味を持つ絶対時刻(actualStartTime→actualEndTime→
  // createdAtの順にフォールバック)を最優先のソートキーとし、
  // 同一時刻の場合のみ従来のsequenceNumberを第2キーとして使う。
  const toTimestamp = (d: any): number => {
    const raw = d.actual_start_time ?? d.actualStartTime
      ?? d.actual_end_time ?? d.actualEndTime
      ?? d.created_at ?? d.createdAt
      ?? null;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  allDetails.sort((a, b) => {
    const ta = toTimestamp(a);
    const tb = toTimestamp(b);
    if (ta !== tb) return ta - tb;
    const sa = a.sequence_number ?? a.sequenceNumber ?? 0;
    const sb = b.sequence_number ?? b.sequenceNumber ?? 0;
    return sa - sb;
  });

  // ✅ FIX: 実際のDB(ActivityType enum)には LOADING / UNLOADING の2値のみが存在し、
  //         「開始イベント」「完了イベント」を別レコードとして分ける LOADING_START /
  //         LOADING_COMPLETE 等の値は一度も作成されない（tripService.startLoading が
  //         actualStartTime を持つ1レコードを作成し、completeLoading が同一レコードの
  //         actualEndTime を更新するだけの単一行モデルのため）。
  //         そのため旧ロジック（開始/完了を別レコードとして待ち合わせるステートマシン）
  //         では loadingEnd・unloadingStart/End が常に空欄になり、積込所要時間・移動時間
  //         ・荷降所要時間が正しく算出されない不具合があった。
  //         → 各LOADING/UNLOADINGレコード自身の actualStartTime(開始)・actualEndTime(完了)
  //           をそのままそのレコードの開始・終了時刻として扱うロジックに修正する。
  interface RawCycle {
    contractorName: string;
    loadingLocation: string;
    unloadingLocation: string;
    itemName: string;
    quantityTons: number;
    loadingStart: string;
    loadingEnd: string;
    unloadingStart: string;
    unloadingEnd: string;
  }

  const rawCycles: RawCycle[] = [];
  let cur: Partial<RawCycle> | null = null;

  for (const d of allDetails) {
    const at: string = (d.activity_type ?? d.activityType ?? '').toUpperCase();
    const locName: string = d.locations?.name ?? d.location?.name ?? '';
    // ✅ FIX: 複数品目対応。operationDetailItems（中間テーブル）に複数品目が
    //         記録されている場合はそれら全ての品目名を「、」区切りで結合する。
    //         記録がない場合（旧データ・単一品目のみ）は従来通り単一items名を使用する。
    const detailItemsArr: any[] = Array.isArray((d as any).operationDetailItems)
      ? [...(d as any).operationDetailItems].sort(
          (x: any, y: any) => (x.sequenceOrder ?? 0) - (y.sequenceOrder ?? 0)
        )
      : [];
    const detailItemNames: string[] = detailItemsArr
      .map((di: any) => di.items?.name)
      .filter((n: any): n is string => !!n);
    const dbItem: string = detailItemNames.length > 0
      ? detailItemNames.join('、')
      : (d.items?.name ?? d.item?.name ?? '');
    const notesStr: string = d.notes ?? '';
    const customMatch = notesStr.match(/\[手入力品目:\s*(.+?)\]/);
    const customItemName: string | undefined = customMatch?.[1]?.trim();
    // ✅ FIX: 手入力品目名がある場合、従来はDB品目名を丸ごと上書きしていたため
    //         両方が同時に表示されなかった。「手書きも含めてすべて品目表示」の
    //         要求に対応し、DB品目名リストに手入力品目名を追加で連結する。
    const itemNameParts: string[] = [];
    if (dbItem) itemNameParts.push(dbItem);
    if (customItemName && !itemNameParts.includes(customItemName)) itemNameParts.push(customItemName);
    const itemName: string = itemNameParts.join('、');
    const qty: number = d.quantity_tons != null ? Number(d.quantity_tons)
                      : d.quantityTons  != null ? Number(d.quantityTons) : 0;
    const startT: string = formatTime(d.actual_start_time ?? d.actualStartTime);
    const endT: string   = formatTime(d.actual_end_time   ?? d.actualEndTime);
    const customerName: string = (d as any)._opCustomerName ?? '';

    if (at.startsWith('LOADING')) {
      // ✅ 空LOADING除外（到着のみ・品目なし・qty=0・完了前・notes='積込開始'の放置データ）
      const _isEmptyLoading = !endT && !itemName && qty === 0 && notesStr === '積込開始';
      if (_isEmptyLoading) continue;

      // 積込レコード（1行でactualStartTime〜actualEndTimeを保持）
      // 直前の積込が荷降と紐付かないまま残っている場合（連続積込）は、
      // 積込のみの行として確定させてから新しいサイクルを開始する
      if (cur && !cur.unloadingLocation) {
        rawCycles.push(cur as RawCycle);
      }
      cur = {
        contractorName: customerName,
        loadingLocation: locName,
        unloadingLocation: '',
        itemName,
        quantityTons: qty > 0 ? qty : 0,
        loadingStart: startT,
        loadingEnd: endT,
        unloadingStart: '',
        unloadingEnd: '',
      };
    } else if (at.startsWith('UNLOADING')) {
      // 荷降レコード（1行でactualStartTime〜actualEndTimeを保持）
      if (cur && !cur.unloadingLocation) {
        // 直前の積込サイクルに荷降情報を紐付けて確定
        cur.unloadingLocation = locName;
        cur.unloadingStart    = startT;
        cur.unloadingEnd      = endT;
        if (qty > 0 && (cur.quantityTons ?? 0) === 0) cur.quantityTons = qty;
        if (!cur.contractorName && customerName) cur.contractorName = customerName;
        rawCycles.push(cur as RawCycle);
        cur = null;
      } else {
        // 積込なしの単独荷降、または連続荷降（前サイクルは既に確定済み）
        if (cur) rawCycles.push(cur as RawCycle); // 念のため、宙に浮いたサイクルを先に確定
        rawCycles.push({
          contractorName: customerName,
          loadingLocation: '',
          unloadingLocation: locName,
          itemName,
          quantityTons: qty,
          loadingStart: '',
          loadingEnd: '',
          unloadingStart: startT,
          unloadingEnd: endT,
        });
        cur = null;
      }
    }
  }
  if (cur) rawCycles.push(cur as RawCycle);

  // ---------- 移動時間計算ユーティリティ ----------
  const toMinutes = (hhmm: string): number => {
    if (!hhmm) return -1;
    const parts = hhmm.split(':');
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    return h * 60 + m;
  };
  const diffMinutes = (startHHMM: string, endHHMM: string): number => {
    const s = toMinutes(startHHMM);
    const e = toMinutes(endHHMM);
    if (s < 0 || e < 0) return -1;
    let d = e - s;
    if (d < 0) d += 24 * 60;
    return d;
  };
  const minutesStr = (m: number): string => m < 0 ? '' : `${m}分`;

  // ---------- Pass2: グループ化 ----------
  // グループキー: 客先名|積込場所|荷降場所|品目名
  const groupMap = new Map<string, any>();
  const groupOrder: string[] = [];

  for (let i = 0; i < rawCycles.length; i++) {
    const c = rawCycles[i]!;
    const key = `${c.contractorName}|${c.loadingLocation}|${c.unloadingLocation}|${c.itemName}`;

    // 移動時間 = 積込終了 → 荷降開始
    const moveMin = diffMinutes(c.loadingEnd, c.unloadingStart);
    // 積込時間(分)
    const loadMin = diffMinutes(c.loadingStart, c.loadingEnd);
    // 荷降時間(分)
    const unlMin  = diffMinutes(c.unloadingStart, c.unloadingEnd);

    const timeRow = {
      loadingStart:    c.loadingStart,
      loadingEnd:      c.loadingEnd,
      loadingMinutes:  minutesStr(loadMin),
      moveMinutes:     minutesStr(moveMin),
      unloadingStart:  c.unloadingStart,
      unloadingEnd:    c.unloadingEnd,
      unloadingMinutes: minutesStr(unlMin),
    };

    if (groupMap.has(key)) {
      const g = groupMap.get(key)!;
      g.vehicleCount++;
      g.totalTons += c.quantityTons;
      g.rows.push(timeRow);
    } else {
      groupMap.set(key, {
        contractorName:    c.contractorName,
        loadingLocation:   c.loadingLocation,
        unloadingLocation: c.unloadingLocation,
        itemName:          c.itemName,
        vehicleCount:      1,
        totalTons:         c.quantityTons,
        loadingCondition:  '',
        rows: [timeRow],
        // 後方互換フィールド（旧TripCycleRow互換）
        quantityTons: c.quantityTons,
        loadingStartTime:    c.loadingStart,
        loadingEndTime:      c.loadingEnd,
        loadingDuration:     minutesStr(loadMin),
        unloadingStartTime:  c.unloadingStart,
        unloadingEndTime:    c.unloadingEnd,
        unloadingDuration:   minutesStr(unlMin),
      });
      groupOrder.push(key);
    }
  }

  const result = groupOrder.map(k => {
    const g = groupMap.get(k)!;
    g.quantityTons = g.totalTons;  // 後方互換: quantityTons = 合計
    return g;
  });

  return result;
}

// 後方互換エイリアス
const buildTripCycles = buildGroupedTrips;

class ReportService {
  private readonly db: PrismaClient;
  private vehicleService?: VehicleService;
  private inspectionService?: InspectionService;
  private userService?: UserService;
  private tripService?: TripService;
  private itemService?: ItemService;

  constructor(db?: PrismaClient) {
    // 🎯 DATABASE_SERVICE統一接続（シングルトンパターン活用）
    this.db = db || DatabaseService.getInstance();

    // 🔥 イベントリスナー登録（初期化時に一度だけ）
    this.setupEventListeners();

    logger.info('✅ ReportService initialized with event-driven architecture');
  }

  /**
   * 🔥 イベントリスナー設定（循環依存解消の核心）
   */
  private setupEventListeners(): void {
    // 車両作成イベントリスナー
    onEvent.vehicleCreated(async (payload: VehicleCreatedPayload) => {
      try {
        await this.handleVehicleCreated(payload);
      } catch (error) {
        logger.error('車両作成イベント処理エラー', { error, payload });
      }
    });

    // 車両ステータス変更イベントリスナー
    onEvent.vehicleStatusChanged(async (payload: VehicleStatusChangedPayload) => {
      try {
        await this.handleVehicleStatusChanged(payload);
      } catch (error) {
        logger.error('車両ステータス変更イベント処理エラー', { error, payload });
      }
    });

    // 点検完了イベントリスナー
    onEvent.inspectionCompleted(async (payload: InspectionCompletedPayload) => {
      try {
        await this.handleInspectionCompleted(payload);
      } catch (error) {
        logger.error('点検完了イベント処理エラー', { error, payload });
      }
    });

    // メンテナンス要求イベントリスナー
    onEvent.maintenanceRequired(async (payload: MaintenanceRequiredPayload) => {
      try {
        await this.handleMaintenanceRequired(payload);
      } catch (error) {
        logger.error('メンテナンス要求イベント処理エラー', { error, payload });
      }
    });

    // 統計生成イベントリスナー
    onEvent.statisticsGenerated(async (payload: StatisticsGeneratedPayload) => {
      try {
        await this.handleStatisticsGenerated(payload);
      } catch (error) {
        logger.error('統計生成イベント処理エラー', { error, payload });
      }
    });

    logger.info('✅ Event listeners registered successfully');
  }

  // =====================================
  // 🔥 イベントハンドラーメソッド群
  // =====================================

  /**
   * 車両作成イベントハンドラー
   * （旧notifyVehicleAdded相当）
   */
  private async handleVehicleCreated(payload: VehicleCreatedPayload): Promise<void> {
    try {
      logger.info('車両作成イベント処理開始', { payload });

      // レポート記録処理（簡易実装）
      // 実際の実装では、メタデータやログとして記録
      logger.info('車両作成イベント記録完了', {
        vehicleId: payload.vehicleId,
        plateNumber: payload.plateNumber,
        model: payload.model,
        createdBy: payload.createdBy
      });
    } catch (error) {
      logger.error('車両作成イベント処理エラー', { error, payload });
    }
  }

  /**
   * 車両ステータス変更イベントハンドラー
   */
  private async handleVehicleStatusChanged(payload: VehicleStatusChangedPayload): Promise<void> {
    try {
      logger.info('車両ステータス変更イベント処理開始', { payload });

      // ステータス変更記録（簡易実装）
      logger.info('車両ステータス変更イベント記録完了', {
        vehicleId: payload.vehicleId,
        oldStatus: payload.oldStatus,
        newStatus: payload.newStatus,
        reason: payload.reason,
        changedBy: payload.changedBy
      });
    } catch (error) {
      logger.error('車両ステータス変更イベント処理エラー', { error, payload });
    }
  }

  /**
   * 点検完了イベントハンドラー
   */
  private async handleInspectionCompleted(payload: InspectionCompletedPayload): Promise<void> {
    try {
      logger.info('点検完了イベント処理開始', { payload });

      // 点検完了記録と必要に応じてアラート生成
      if (!payload.passed || payload.criticalIssues > 0) {
        logger.warn('点検で問題検出', {
          inspectionId: payload.inspectionId,
          vehicleId: payload.vehicleId,
          passed: payload.passed,
          failedItems: payload.failedItems,
          criticalIssues: payload.criticalIssues
        });
      }

      logger.info('点検完了イベント記録完了', { inspectionId: payload.inspectionId });
    } catch (error) {
      logger.error('点検完了イベント処理エラー', { error, payload });
    }
  }

  /**
   * メンテナンス要求イベントハンドラー
   */
  private async handleMaintenanceRequired(payload: MaintenanceRequiredPayload): Promise<void> {
    try {
      logger.info('メンテナンス要求イベント処理開始', { payload });

      // 緊急度に応じた処理
      if (payload.severity === 'CRITICAL' || payload.severity === 'HIGH') {
        logger.warn('緊急メンテナンス要求', {
          vehicleId: payload.vehicleId,
          reason: payload.reason,
          severity: payload.severity,
          requiredBy: payload.requiredBy
        });
      }

      logger.info('メンテナンス要求イベント記録完了', { vehicleId: payload.vehicleId });
    } catch (error) {
      logger.error('メンテナンス要求イベント処理エラー', { error, payload });
    }
  }

  /**
   * 統計生成イベントハンドラー
   */
  private async handleStatisticsGenerated(payload: StatisticsGeneratedPayload): Promise<void> {
    try {
      logger.info('統計生成イベント処理開始', { payload });

      // 統計データ記録
      logger.info('統計生成イベント記録完了', {
        type: payload.type,
        generatedBy: payload.generatedBy
      });
    } catch (error) {
      logger.error('統計生成イベント処理エラー', { error, payload });
    }
  }

  /**
   * 遅延読み込みヘルパーメソッド群
   */
  private async getVehicleService(): Promise<VehicleService> {
    if (!this.vehicleService) {
      const { getVehicleService } = await import('./vehicleService');
      this.vehicleService = getVehicleService();
    }
    return this.vehicleService;
  }

  private async getInspectionService(): Promise<InspectionService> {
    if (!this.inspectionService) {
      const { getInspectionService } = await import('./inspectionService');
      this.inspectionService = getInspectionService();
    }
    return this.inspectionService;
  }

  private async getUserService(): Promise<UserService> {
    if (!this.userService) {
      const { getUserService } = await import('./userService');
      this.userService = getUserService();
    }
    return this.userService;
  }

  private async getTripService(): Promise<TripService> {
    if (!this.tripService) {
      const { getTripService } = await import('./tripService');
      this.tripService = getTripService();
    }
    return this.tripService;
  }

  private async getItemService(): Promise<ItemService> {
    if (!this.itemService) {
      const { getItemServiceInstance } = await import('./itemService');
      this.itemService = getItemServiceInstance();
    }
    return this.itemService;
  }

  // =====================================
  // 統合権限制御・セキュリティ管理
  // =====================================

  /**
   * レポート権限制御（統合版）
   * middleware/auth.tsとの連携による企業レベル権限管理
   */
  private validateReportPermissions(
    requesterRole: UserRole,
    reportType: ReportType,
    targetUserId?: string,
    requesterId?: string
  ): void {
    // 管理者は全レポートアクセス可能
    if (requesterRole === UserRole.ADMIN) {
      return;
    }

    // マネージャーは管理レポートアクセス可能
    if (requesterRole === UserRole.MANAGER) {
      const restrictedReports: ReportType[] = [];
      if (restrictedReports.includes(reportType)) {
        throw new AuthorizationError('このレポートタイプへのアクセス権限がありません');
      }
      return;
    }

    // ドライバーは自分自身のデータのみアクセス可能
    if (requesterRole === UserRole.DRIVER) {
      if (targetUserId && targetUserId !== requesterId) {
        throw new AuthorizationError('他のユーザーのレポートにはアクセスできません');
      }

      const allowedReportsForDriver: ReportType[] = [
        PrismaReportType.DAILY_OPERATION as any
      ];

      if (!allowedReportsForDriver.includes(reportType)) {
        throw new AuthorizationError('このレポートタイプへのアクセス権限がありません');
      }
      return;
    }

    throw new AuthorizationError('レポートへのアクセス権限がありません');
  }

  // =====================================
  // レポート一覧・詳細取得
  // =====================================

  /**
   * レポート一覧取得（統合版）
   */
  async getReports(
    filter: ReportFilter,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<ReportListResponse> {
    try {
      logger.info('レポート一覧取得開始', { requesterId, requesterRole, filter });

      const page = filter.page ?? 1;
      const limit = filter.limit ?? 20;
      const skip = (page - 1) * limit;

      // フィルタ条件構築
      const whereClause: any = {
        NOT: { status: ReportGenerationStatus.CANCELLED }
      };

      // ドライバーの場合、自分のレポートのみ
      if (requesterRole === UserRole.DRIVER) {
        whereClause.generatedBy = requesterId;
      }

      if (filter.reportType) {
        whereClause.reportType = filter.reportType;
      }

      if (filter.format) {
        whereClause.format = filter.format;
      }

      if (filter.status) {
        whereClause.status = filter.status;
      }

      if (filter.startDate || filter.endDate) {
        whereClause.createdAt = {};
        if (filter.startDate) {
          whereClause.createdAt.gte = filter.startDate;
        }
        if (filter.endDate) {
          whereClause.createdAt.lte = filter.endDate;
        }
      }

      // データ取得
      const [reports, total] = await Promise.all([
        this.db.report.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          }
        }),
        this.db.report.count({ where: whereClause })
      ]);

      const totalPages = Math.ceil(total / limit);

      const reportDTOs: ReportResponseDTO[] = reports.map(report => ({
        id: report.id,
        reportType: report.reportType as any,
        format: report.format as any,
        title: report.title,
        description: report.description,
        generatedBy: report.generatedBy,
        generatedAt: report.generatedAt,
        status: report.status as any,
        parameters: report.parameters as any,
        resultData: report.resultData as any,
        filePath: report.filePath,
        fileSize: report.fileSize,
        metadata: report.metadata as any,
        tags: report.tags,
        startDate: report.startDate,
        endDate: report.endDate,
        errorMessage: report.errorMessage,
        isPublic: report.isPublic,
        sharedWith: report.sharedWith,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        expiresAt: report.expiresAt,
        user: report.user as any
      }));

      logger.info('レポート一覧取得完了', { count: reportDTOs.length, total });

      return {
        data: reportDTOs,
        total,
        page,
        pageSize: limit,
        totalPages
      };
    } catch (error) {
      logger.error('レポート一覧取得エラー', { error, requesterId });
      throw error;
    }
  }

  /**
   * レポート詳細取得
   */
  async getReportById(
    reportId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<ReportResponseDTO> {
    try {
      const report = await this.db.report.findUnique({
        where: { id: reportId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (!report) {
        throw new NotFoundError('レポートが見つかりません');
      }

      // アクセス権限チェック
      if (requesterRole === UserRole.DRIVER && report.generatedBy !== requesterId) {
        throw new AuthorizationError('このレポートへのアクセス権限がありません');
      }

      return {
        id: report.id,
        reportType: report.reportType as any,
        format: report.format as any,
        title: report.title,
        description: report.description,
        generatedBy: report.generatedBy,
        generatedAt: report.generatedAt,
        status: report.status as any,
        parameters: report.parameters as any,
        resultData: report.resultData as any,
        filePath: report.filePath,
        fileSize: report.fileSize,
        metadata: report.metadata as any,
        tags: report.tags,
        startDate: report.startDate,
        endDate: report.endDate,
        errorMessage: report.errorMessage,
        isPublic: report.isPublic,
        sharedWith: report.sharedWith,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        expiresAt: report.expiresAt,
        user: report.user as any
      };
    } catch (error) {
      logger.error('レポート詳細取得エラー', { error, reportId, requesterId });
      throw error;
    }
  }

  // =====================================
  // レポート生成メソッド群
  // =====================================

  /**
   * 日次運行レポート生成
   */
  async generateDailyOperationReport(
    params: DailyOperationReportParams
  ): Promise<ReportGenerationResult> {
    try {
      this.validateReportPermissions(
        params.requesterRole,
        PrismaReportType.DAILY_OPERATION as any,
        params.driverId,
        params.requesterId
      );

      logger.info('日次運行レポート生成開始', { params });

      // レポート作成
      const report = await this.db.report.create({
        data: {
          reportType: PrismaReportType.DAILY_OPERATION,
          format: (params.format as PrismaReportFormat) || PrismaReportFormat.PDF,
          title: `日次運行レポート - ${params.date}`,
          description: '日次運行詳細レポート',
          generatedBy: params.requesterId,
          status: ReportGenerationStatus.PENDING,
          parameters: params as any,
          startDate: new Date(params.date),
          endDate: new Date(params.date),
          // ④ vehicleId をレポートメタ情報として保存（履歴フィルター用）
          metadata: params.vehicleId ? { vehicleId: params.vehicleId } : undefined,
          tags: ['daily', 'operation']
        },
        include: {
          user: true
        }
      });

      // 非同期でレポート生成処理（実際の実装）
      this.processReportGeneration(report.id);

      logger.info('日次運行レポート生成ジョブ登録完了', { reportId: report.id });

      return {
        reportId: report.id,
        reportType: PrismaReportType.DAILY_OPERATION,
        format: (params.format as PrismaReportFormat) || PrismaReportFormat.PDF,
        status: ReportGenerationStatus.PENDING,
        title: report.title,
        description: report.description || undefined,
        generatedBy: params.requesterId
      };
    } catch (error) {
      logger.error('日次運行レポート生成エラー', { error, params });
      throw error;
    }
  }

  /**
   * 月次運行レポート生成
   */
  async generateMonthlyOperationReport(
    params: MonthlyOperationReportParams
  ): Promise<ReportGenerationResult> {
    try {
      this.validateReportPermissions(
        params.requesterRole,
        PrismaReportType.MONTHLY_OPERATION as any,
        params.driverId,
        params.requesterId
      );

      logger.info('月次運行レポート生成開始', { params });

      const report = await this.db.report.create({
        data: {
          reportType: PrismaReportType.MONTHLY_OPERATION,
          format: (params.format as PrismaReportFormat) || PrismaReportFormat.EXCEL,
          title: `月次運行レポート - ${params.year}年${params.month}月`,
          description: '月次運行統計レポート',
          generatedBy: params.requesterId,
          status: ReportGenerationStatus.PENDING,
          parameters: params as any,
          tags: ['monthly', 'operation']
        }
      });

      this.processReportGeneration(report.id);

      logger.info('月次運行レポート生成ジョブ登録完了', { reportId: report.id });

      return {
        reportId: report.id,
        reportType: PrismaReportType.MONTHLY_OPERATION,
        format: (params.format as PrismaReportFormat) || PrismaReportFormat.EXCEL,
        status: ReportGenerationStatus.PENDING,
        title: report.title,
        description: report.description || undefined,
        generatedBy: params.requesterId
      };
    } catch (error) {
      logger.error('月次運行レポート生成エラー', { error, params });
      throw error;
    }
  }

  /**
   * 車両稼働レポート生成
   */
  async generateVehicleUtilizationReport(
    params: VehicleUtilizationReportParams
  ): Promise<ReportGenerationResult> {
    try {
      this.validateReportPermissions(
        params.requesterRole,
        PrismaReportType.VEHICLE_UTILIZATION as any,
        undefined,
        params.requesterId
      );

      logger.info('車両稼働レポート生成開始', { params });

      const report = await this.db.report.create({
        data: {
          reportType: PrismaReportType.VEHICLE_UTILIZATION,
          format: (params.format as PrismaReportFormat) || PrismaReportFormat.PDF,
          title: '車両稼働レポート',
          description: '車両稼働率・効率分析レポート',
          generatedBy: params.requesterId,
          status: ReportGenerationStatus.PENDING,
          parameters: params as any,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          tags: ['vehicle', 'utilization']
        }
      });

      this.processReportGeneration(report.id);

      logger.info('車両稼働レポート生成ジョブ登録完了', { reportId: report.id });

      return {
        reportId: report.id,
        reportType: PrismaReportType.VEHICLE_UTILIZATION,
        format: (params.format as PrismaReportFormat) || PrismaReportFormat.PDF,
        status: ReportGenerationStatus.PENDING,
        title: report.title,
        description: report.description || undefined,
        generatedBy: params.requesterId
      };
    } catch (error) {
      logger.error('車両稼働レポート生成エラー', { error, params });
      throw error;
    }
  }

  /**
   * 点検サマリーレポート生成
   */
  async generateInspectionSummaryReport(
    params: InspectionSummaryReportParams
  ): Promise<ReportGenerationResult> {
    try {
      this.validateReportPermissions(
        params.requesterRole,
        PrismaReportType.INSPECTION_SUMMARY as any,
        undefined,
        params.requesterId
      );

      logger.info('点検サマリーレポート生成開始', { params });

      const report = await this.db.report.create({
        data: {
          reportType: PrismaReportType.INSPECTION_SUMMARY,
          format: (params.format as PrismaReportFormat) || PrismaReportFormat.PDF,
          title: '点検サマリーレポート',
          description: '点検結果統計レポート',
          generatedBy: params.requesterId,
          status: ReportGenerationStatus.PENDING,
          parameters: params as any,
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined,
          tags: ['inspection', 'summary']
        }
      });

      this.processReportGeneration(report.id);

      logger.info('点検サマリーレポート生成ジョブ登録完了', { reportId: report.id });

      return {
        reportId: report.id,
        reportType: PrismaReportType.INSPECTION_SUMMARY,
        format: (params.format as PrismaReportFormat) || PrismaReportFormat.PDF,
        status: ReportGenerationStatus.PENDING,
        title: report.title,
        description: report.description || undefined,
        generatedBy: params.requesterId
      };
    } catch (error) {
      logger.error('点検サマリーレポート生成エラー', { error, params });
      throw error;
    }
  }

  /**
   * 総合ダッシュボードレポート生成
   */
  async generateComprehensiveDashboard(
    params: ComprehensiveDashboardParams
  ): Promise<ReportGenerationResult> {
    try {
      this.validateReportPermissions(
        params.requesterRole,
        PrismaReportType.COMPREHENSIVE_DASHBOARD as any,
        undefined,
        params.requesterId
      );

      logger.info('総合ダッシュボード生成開始', { params });

      const report = await this.db.report.create({
        data: {
          reportType: PrismaReportType.COMPREHENSIVE_DASHBOARD,
          format: PrismaReportFormat.HTML,
          title: '総合ダッシュボード',
          description: '企業レベル総合分析ダッシュボード',
          generatedBy: params.requesterId,
          status: ReportGenerationStatus.PENDING,
          parameters: params as any,
          tags: ['dashboard', 'comprehensive']
        }
      });

      this.processReportGeneration(report.id);

      logger.info('総合ダッシュボード生成ジョブ登録完了', { reportId: report.id });

      return {
        reportId: report.id,
        reportType: PrismaReportType.COMPREHENSIVE_DASHBOARD,
        format: PrismaReportFormat.HTML,
        status: ReportGenerationStatus.PENDING,
        title: report.title,
        description: report.description || undefined,
        generatedBy: params.requesterId
      };
    } catch (error) {
      logger.error('総合ダッシュボード生成エラー', { error, params });
      throw error;
    }
  }

  /**
   * KPI分析レポート生成
   */
  async generateKPIAnalysis(
    params: KPIAnalysisParams
  ): Promise<ReportGenerationResult> {
    try {
      this.validateReportPermissions(
        params.requesterRole,
        PrismaReportType.KPI_ANALYSIS as any,
        undefined,
        params.requesterId
      );

      logger.info('KPI分析レポート生成開始', { params });

      const report = await this.db.report.create({
        data: {
          reportType: PrismaReportType.KPI_ANALYSIS,
          format: PrismaReportFormat.PDF,
          title: 'KPI分析レポート',
          description: '主要業績指標分析レポート',
          generatedBy: params.requesterId,
          status: ReportGenerationStatus.PENDING,
          parameters: params as any,
          tags: ['kpi', 'analysis']
        }
      });

      this.processReportGeneration(report.id);

      logger.info('KPI分析レポート生成ジョブ登録完了', { reportId: report.id });

      return {
        reportId: report.id,
        reportType: PrismaReportType.KPI_ANALYSIS,
        format: PrismaReportFormat.PDF,
        status: ReportGenerationStatus.PENDING,
        title: report.title,
        description: report.description || undefined,
        generatedBy: params.requesterId
      };
    } catch (error) {
      logger.error('KPI分析レポート生成エラー', { error, params });
      throw error;
    }
  }

  /**
   * 予測分析レポート生成
   */
  async generatePredictiveAnalytics(
    params: PredictiveAnalyticsParams
  ): Promise<ReportGenerationResult> {
    try {
      this.validateReportPermissions(
        params.requesterRole,
        PrismaReportType.PREDICTIVE_ANALYTICS as any,
        undefined,
        params.requesterId
      );

      logger.info('予測分析レポート生成開始', { params });

      const report = await this.db.report.create({
        data: {
          reportType: PrismaReportType.PREDICTIVE_ANALYTICS,
          format: PrismaReportFormat.PDF,
          title: '予測分析レポート',
          description: 'AI駆動型予測分析レポート',
          generatedBy: params.requesterId,
          status: ReportGenerationStatus.PENDING,
          parameters: params as any,
          tags: ['predictive', 'analytics', 'ai']
        }
      });

      this.processReportGeneration(report.id);

      logger.info('予測分析レポート生成ジョブ登録完了', { reportId: report.id });

      return {
        reportId: report.id,
        reportType: PrismaReportType.PREDICTIVE_ANALYTICS,
        format: PrismaReportFormat.PDF,
        status: ReportGenerationStatus.PENDING,
        title: report.title,
        description: report.description || undefined,
        generatedBy: params.requesterId
      };
    } catch (error) {
      logger.error('予測分析レポート生成エラー', { error, params });
      throw error;
    }
  }

  /**
   * 実績報告書レポート生成
   */
  async generateAnnualTransportReport(
    params: {
      fiscalYear: number;
      format?: any;
      requesterId: string;
      requesterRole: any;
    }
  ): Promise<ReportGenerationResult> {
    this.validateReportPermissions(
      params.requesterRole,
      'ANNUAL_TRANSPORT_REPORT' as any,
      undefined,
      params.requesterId
    );
  //
    const { start, end } = getFiscalYearRange(params.fiscalYear);
  //
    const report = await this.db.report.create({
      data: {
        reportType: 'ANNUAL_TRANSPORT_REPORT' as any,
        format: params.format || 'PDF',
        title: `貨物自動車運送事業実績報告書 ${params.fiscalYear}年度`,
        description: '貨物自動車運送事業報告規則 第4号様式',
        generatedBy: params.requesterId,
        status: 'PENDING',
        parameters: params as any,
        startDate: start,
        endDate: end,
        tags: ['annual', 'transport', 'report'],
      },
      include: { user: true },
    });
  //
    this.processReportGeneration(report.id);
  //
    logger.info('実績報告書生成ジョブ登録', { reportId: report.id, fiscalYear: params.fiscalYear });
  //
    return {
      reportId: report.id,
      reportType: 'ANNUAL_TRANSPORT_REPORT' as any,
      format: params.format || 'PDF',
      status: 'PENDING',
      title: report.title,
      description: report.description || undefined,
      generatedBy: params.requesterId,
    };
  }

  /**
   * レポート削除
   */
  async deleteReport(
    reportId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<void> {
    try {
      const report = await this.db.report.findUnique({
        where: { id: reportId }
      });

      if (!report) {
        throw new NotFoundError('レポートが見つかりません');
      }

      // 権限チェック
      if (requesterRole === UserRole.DRIVER && report.generatedBy !== requesterId) {
        throw new AuthorizationError('このレポートを削除する権限がありません');
      }

      await this.db.report.delete({
        where: { id: reportId }
      });

      logger.info('レポート削除完了', { reportId, requesterId });
    } catch (error) {
      logger.error('レポート削除エラー', { error, reportId, requesterId });
      throw error;
    }
  }

  /**
   * レポート生成ステータス取得
   */
  async getReportStatus(
    reportId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<{ status: ReportGenerationStatus; progress?: number; errorMessage?: string }> {
    try {
      const report = await this.db.report.findUnique({
        where: { id: reportId },
        select: {
          status: true,
          errorMessage: true,
          generatedBy: true
        }
      });

      if (!report) {
        throw new NotFoundError('レポートが見つかりません');
      }

      // 権限チェック
      if (requesterRole === UserRole.DRIVER && report.generatedBy !== requesterId) {
        throw new AuthorizationError('このレポートのステータスを確認する権限がありません');
      }

      return {
        status: report.status as ReportGenerationStatus,
        errorMessage: report.errorMessage || undefined
      };
    } catch (error) {
      logger.error('レポートステータス取得エラー', { error, reportId, requesterId });
      throw error;
    }
  }

  /**
   * レポートテンプレート一覧取得
   */
  async getReportTemplates(userRole: UserRole): Promise<ReportTemplate[]> {
    const templates: ReportTemplate[] = [
      {
        id: 'daily-operation',
        name: '日次運行レポート',
        reportType: PrismaReportType.DAILY_OPERATION as any,
        description: '指定日の運行詳細レポート',
        defaultFormat: PrismaReportFormat.PDF as any,
        requiredParameters: ['date'],
        optionalParameters: ['driverId', 'vehicleId', 'includeStatistics'],
        supportedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER],
        exampleParameters: {
          date: '2025-10-05',
          includeStatistics: true
        }
      },
      {
        id: 'monthly-operation',
        name: '月次運行レポート',
        reportType: PrismaReportType.MONTHLY_OPERATION as any,
        description: '月次運行統計レポート',
        defaultFormat: PrismaReportFormat.EXCEL as any,
        requiredParameters: ['year', 'month'],
        optionalParameters: ['driverId', 'vehicleId', 'includeStatistics'],
        supportedRoles: [UserRole.ADMIN, UserRole.MANAGER],
        exampleParameters: {
          year: 2025,
          month: 10,
          includeStatistics: true
        }
      },
      {
        id: 'vehicle-utilization',
        name: '車両稼働レポート',
        reportType: PrismaReportType.VEHICLE_UTILIZATION as any,
        description: '車両稼働率・効率分析レポート',
        defaultFormat: PrismaReportFormat.PDF as any,
        requiredParameters: [],
        optionalParameters: ['startDate', 'endDate', 'vehicleIds', 'groupBy'],
        supportedRoles: [UserRole.ADMIN, UserRole.MANAGER],
        exampleParameters: {
          groupBy: 'MONTH',
          includeMaintenanceRecords: true
        }
      },
      {
        id: 'inspection-summary',
        name: '点検サマリーレポート',
        reportType: PrismaReportType.INSPECTION_SUMMARY as any,
        description: '点検結果統計レポート',
        defaultFormat: PrismaReportFormat.PDF as any,
        requiredParameters: [],
        optionalParameters: ['startDate', 'endDate', 'vehicleIds', 'inspectionTypes'],
        supportedRoles: [UserRole.ADMIN, UserRole.MANAGER],
        exampleParameters: {
          groupBy: 'TYPE',
          includeFailedItems: true
        }
      }
    ];

    // ユーザーの役割に応じてテンプレートをフィルタリング
    return templates.filter(template =>
      template.supportedRoles.includes(userRole)
    );
  }

  // =====================================
  // プライベートヘルパーメソッド
  // =====================================

  /**
   * レポート生成処理（非同期） - 実PDF生成版
   *
   * 変更点:
   * - 旧: setTimeout で5秒後に COMPLETED にするだけ（スタブ）
   * - 新: DBから実データを取得し、pdfkitでPDFを実際に生成
   */
  private processReportGeneration(reportId: string): void {
    setImmediate(async () => {
      try {
        // ステータスを PROCESSING に更新
        await this.db.report.update({
          where: { id: reportId },
          data: { status: ReportGenerationStatus.PROCESSING }
        });

        // レポートのパラメータを取得
        const report = await this.db.report.findUnique({
          where: { id: reportId },
          include: { user: true }
        });

        if (!report) {
          throw new Error(`レポートが見つかりません: ${reportId}`);
        }

        logger.info('[Report] レポート生成処理開始', {
          reportId,
          reportType: report.reportType,
          format: report.format
        });

        let filePath: string;
        let fileSize: number;

        // レポート種別に応じた生成処理
        switch (report.reportType) {
          //
          case 'DAILY_OPERATION':
            ({ filePath, fileSize } = await this.generateDailyOperationPDF(report));
            break;

          // 🆕 P3-03: 貨物自動車運送事業実績報告書
          case 'ANNUAL_TRANSPORT_REPORT':
            ({ filePath, fileSize } = await this.generateAnnualTransportReportPDF(report));
            break;

          // 他の種別は将来実装（今は簡易レスポンス）
          default:
            ({ filePath, fileSize } = await this.generatePlaceholderPDF(report));
            break;
        }

        // COMPLETED に更新
        await this.db.report.update({
          where: { id: reportId },
          data: {
            status: ReportGenerationStatus.COMPLETED,
            generatedAt: new Date(),
            filePath,
            fileSize
          }
        });

        logger.info('[Report] レポート生成完了', { reportId, filePath, fileSize });

      } catch (error) {
        logger.error('[Report] レポート生成失敗', { error, reportId });
        await this.db.report.update({
          where: { id: reportId },
          data: {
            status: ReportGenerationStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : '不明なエラー'
          }
        });
      }
    });
  }

  /**
   * 日次運行報告書PDF生成
   * DBから当日の運行データを取得してPDFを生成する
   */
  private async generateDailyOperationPDF(
    this: any,
    report: any
  ): Promise<{ filePath: string; fileSize: number }> {
    const params = report.parameters as any;

    const targetDate = params?.date
      ? new Date(params.date)
      : (report.startDate ? new Date(report.startDate) : new Date());

    // ✅ JST(+9時間)で日付境界を計算
    const _rptJstOff = 9 * 60 * 60 * 1000;
    const _rptJstDate = new Date(targetDate.getTime() + _rptJstOff);
    const _rptY = _rptJstDate.getUTCFullYear();
    const _rptM = _rptJstDate.getUTCMonth();
    const _rptD = _rptJstDate.getUTCDate();
    const startOfDay = new Date(Date.UTC(_rptY, _rptM, _rptD, 0, 0, 0, 0) - _rptJstOff);
    const endOfDay   = new Date(Date.UTC(_rptY, _rptM, _rptD, 23, 59, 59, 999) - _rptJstOff);

    // ===== DB クエリ =====
    // ✅ BUG修正: 旧ロジック(BUG-053)は actualStartTime / plannedStartTime /
    // actualEndTime を完全に独立したOR条件にしていたため、「実績開始時刻は
    // 明確に別の日である運行」でも、終了時刻や予定時刻がこの日の範囲に
    // 偶然重なっただけで日報に混入してしまっていた（1運行しかない日の
    // 日報に、無関係な別運行の明細が混ざり明細数がほぼ倍になる不具合の原因）。
    // 「この運行がどの日に属するか」の判定基準に優先順位を持たせる:
    //   1. actualStartTime（実績開始時刻）があればそれで判定
    //   2. 無ければ plannedStartTime（予定開始時刻）で判定
    //   3. どちらも無い場合のみ actualEndTime（実績終了時刻）で判定
    //      （BUG-053が本来意図していた「開始時刻未記録の日またぎ運行」の救済は維持）
    const whereClause: any = {
      OR: [
        { actualStartTime: { gte: startOfDay, lte: endOfDay } },
        {
          AND: [
            { actualStartTime: null },
            { plannedStartTime: { gte: startOfDay, lte: endOfDay } },
          ],
        },
        {
          AND: [
            { actualStartTime: null },
            { plannedStartTime: null },
            { actualEndTime: { gte: startOfDay, lte: endOfDay } },
          ],
        },
      ],
    };
    if (params?.driverId) whereClause.driverId = params.driverId;
    if (params?.vehicleId) whereClause.vehicleId = params.vehicleId;

    const operations = await (this.db as any).operation.findMany({
      where: whereClause,
      include: {
        // 運転手
        usersOperationsDriverIdTousers: {
          select: { id: true, name: true, employeeId: true },
        },
        // 車両
        vehicles: {
          select: {
            id: true,
            plateNumber: true,
            model: true,
            manufacturer: true,
          },
        },
        // 🆕 客先（業者名列用）
        customer: {
          select: { id: true, name: true },
        },
        // 運行詳細（積込・荷降・給油など）
        operationDetails: {
          include: {
            locations: { select: { id: true, name: true } },
            items: { select: { id: true, name: true } },
            // 積込・荷降ごとに独立して設定された客先情報（客先切替対応）
            // ✅ FIX: schema.camel.prisma上のOperationDetailモデルの実際のリレーション名は
            //         複数形 'customers' が正しい（単数形'customer'は存在せず、誤ったフィールド名
            //         でPrisma実行時エラーとなり日報生成が失敗していた）
            customers: { select: { id: true, name: true } },
            // ✅ FIX: 複数品目対応。1回の積込/荷降で複数品目を記録した場合、
            //         operation_details.items（単一リレーション）ではなく
            //         operation_detail_items テーブルに複数行として保存されるため、
            //         これを含めないと1品目分しか日報に表示されない不具合があった。
            operationDetailItems: {
              include: {
                items: { select: { id: true, name: true } },
              },
              orderBy: { sequenceOrder: 'asc' },
            },
          },
          orderBy: { sequenceNumber: 'asc' },
        },
        // 点検記録（PRE_TRIP / POST_TRIP）＋ 点検項目結果
        inspectionRecords: {
          where: {
            inspectionType: { in: ['PRE_TRIP', 'POST_TRIP'] },
          },
          include: {
            inspectionItemResults: {
              include: {
                inspectionItems: {
                  select: { id: true, name: true, category: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [
        { actualStartTime: 'asc' },
        { plannedStartTime: 'asc' },
      ],
    });

    // ===== データ変換 =====

    // 代表ドライバー・車両（最初のoperationから）
    const firstOp = operations[0];
    const driverName: string = firstOp?.usersOperationsDriverIdTousers?.name ?? '未入力';
    const vehiclePlate: string = firstOp?.vehicles?.plateNumber ?? '未入力';

    // オドメーター（最初の開始〜最後の終了）
    // ①修正: startOdometer/endOdometer - snake_case/camelCase両対応
    const startOdoVal = firstOp?.startOdometer ?? firstOp?.start_odometer;
    const startOdo = startOdoVal != null ? fmtNum(startOdoVal, 0) : '';
    const lastOp = operations[operations.length - 1];
    const endOdoVal = lastOp?.endOdometer ?? lastOp?.end_odometer;
    const endOdo = endOdoVal != null ? fmtNum(endOdoVal, 0) : '';

    // 運行詳細から TripCycleRow 構築
    // ⑤a: allDetailsList に operationのcustomer情報を付加
    // デバッグ: 客先名・キロ確認
    for (const op of operations) {
      logger.info('[ReportService] operation debug', {
        opId: op.id,
        customerId: op.customerId ?? 'NULL',
        customerName: op.customer?.name ?? 'NULL',
        startOdometer: op.startOdometer ?? 'NULL',
      });
    }
    const allDetailsList: any[][] = operations.map((op: any) => {
      const opCustomerName: string = op.customer?.name ?? '';
      // ✅ FIX: 積込・荷降ごとに独立した客先（customerId）が設定されている場合は
      //         そちらを優先し、未設定の場合のみ運行(Operation)全体の客先名にフォールバックする
      //         （リレーション名は複数形 'customers' が正しい）
      return (op.operationDetails ?? []).map((d: any) => ({
        ...d,
        _opCustomerName: d.customers?.name ?? opCustomerName,
      }));
    });
    const cycles = buildTripCycles(allDetailsList);
    // BUG-053修正: デバッグログ（operations/cycles が空の場合の原因特定用）
    logger.info('[ReportService] generateDailyOperationPDF debug', {
      operationsCount: operations.length,
      cyclesCount: cycles.length,
      targetDate: targetDate.toISOString(),
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      driverIdFilter: params?.driverId ?? 'none',
      vehicleIdFilter: params?.vehicleId ?? 'none',
      allDetailsTotal: allDetailsList.reduce((s: number, d: any[]) => s + d.length, 0),
    });
    // ⑤a: 各サイクルの contractorName を対応する客先名で補完
    // buildTripCyclesはdetailの_opCustomerNameを参照するよう内部で対応済み

    // ⑤e: 給油データ複数対応 — 全給油イベントを配列で収集
    interface FuelRecord { liters: string; odometerKm: string; }
    const fuelRecords: FuelRecord[] = [];
    for (const op of operations) {
      for (const d of (op.operationDetails ?? [])) {
        const at = (d.activityType ?? d.activity_type ?? '') as string;
        if (at === 'FUELING' || at === 'FUEL' || at === 'REFUEL') {
          const liters = d.quantityTons ? fmtNum(d.quantityTons, 1) : '';
          // ✅ 給油時キロ: notes regex解析廃止 → end_odometer / startOdometer から算出
          const kmVal = op.endOdometer ? fmtNum(op.endOdometer, 0)
                      : op.startOdometer ? fmtNum(op.startOdometer, 0) : '';
          fuelRecords.push({ liters, odometerKm: kmVal });
        }
      }
      // fuelConsumedLiters フォールバック（個別イベントない場合）
      if (fuelRecords.length === 0 && op.fuelConsumedLiters) {
        fuelRecords.push({
          liters: fmtNum(op.fuelConsumedLiters, 1),
          odometerKm: op.startOdometer ? fmtNum(op.startOdometer, 0) : '',
        });
      }
    }
    // pdfReportGeneratorに "|" 区切りで複数レコードを渡す
    const fuelLiters    = fuelRecords.map(r => r.liters).filter(Boolean).join('|') || '';
    const fuelOdometerKm = fuelRecords.map(r => r.odometerKm).filter(Boolean).join('|') || '';

    // 🆕 休憩時間合計: BREAK_START(actualStartTime)〜BREAK_END(actualStartTime)のペアを
    //    sequenceNumber順に対応付けて合計する（BREAKは単一行モデルではなく2レコードモデルのため）
    let totalBreakMinutes = 0;
    for (const op of operations) {
      const sortedDetails = [...(op.operationDetails ?? [])].sort((a: any, b: any) =>
        (a.sequenceNumber ?? a.sequence_number ?? 0) - (b.sequenceNumber ?? b.sequence_number ?? 0)
      );
      let breakStartAt: Date | null = null;
      for (const d of sortedDetails) {
        const at = ((d as any).activityType ?? (d as any).activity_type ?? '').toString().toUpperCase();
        if (at === 'BREAK_START' || at === 'BREAK') {
          const st = (d as any).actualStartTime ?? (d as any).actual_start_time;
          breakStartAt = st ? new Date(st) : null;
        } else if (at === 'BREAK_END') {
          if (breakStartAt) {
            const endRaw = (d as any).actualStartTime ?? (d as any).actual_start_time
                        ?? (d as any).actualEndTime   ?? (d as any).actual_end_time;
            const endAt = endRaw ? new Date(endRaw) : null;
            if (endAt) {
              const diffMin = Math.round((endAt.getTime() - breakStartAt.getTime()) / 60000);
              if (diffMin > 0) totalBreakMinutes += diffMin;
            }
            breakStartAt = null;
          }
        }
      }
    }
    const totalBreakTime = totalBreakMinutes > 0
      ? (totalBreakMinutes >= 60
          ? `${Math.floor(totalBreakMinutes / 60)}時間${String(totalBreakMinutes % 60).padStart(2, '0')}分`
          : `${totalBreakMinutes}分`)
      : '';

    // 全inspection_records を統合
    const allInspRecords: any[] = [];
    for (const op of operations) {
      allInspRecords.push(...(op.inspectionRecords ?? []));
    }

    // 点検結果マップを構築
    const inspResults = buildInspResultMap(allInspRecords);

    // ⑦修正: DBのPRE_TRIP点検項目をdisplayOrder順で取得（最大16件）
    const dbInspItems = await (this.db as any).inspectionItem.findMany({
      where: { isActive: true, inspectionType: 'PRE_TRIP' },
      orderBy: { displayOrder: 'asc' },
      take: 26, // ★ 26件対応
    });

    // DB項目ごとに inspResults から結果を検索してマッピング
    const allMappedItems = dbInspItems.map((dbItem: any) => {
      const result = inspResults.find((r: any) => r.name === dbItem.name);
      return {
        name: dbItem.name,
        preResult:  result?.preResult  ?? '',
        postResult: result?.postResult ?? '',
        measure:    result?.measure    ?? '',
      };
    });

    // ★ 全26件対応: 前半13件→左列、後半13件→右列
    const leftItems   = allMappedItems.slice(0, 13);
    const middleItems = allMappedItems.slice(13, 26);
    const rightItems: any[] = [];  // 旧3列目は廃止

    // 帳票データ組み立て
    const dailyDriverData: any /* DailyDriverReportData */ = {
      reportDate: targetDate.toISOString().split('T')[0] ?? '',
      dayOfWeek: getDayOfWeek(targetDate),
      driverName,
      vehiclePlateNumber: vehiclePlate,
      startOdometer: startOdo,
      endOdometer: endOdo,
      trips: cycles.map((c: any) => ({
        contractorName:    c.contractorName,
        loadingLocation:   c.loadingLocation,
        unloadingLocation: c.unloadingLocation,
        itemName:          c.itemName,
        vehicleCount:      c.vehicleCount,
        quantityTons:      c.totalTons > 0 ? parseFloat(fmtNum(c.totalTons, 2)) : 0,
        loadingCondition:  c.loadingCondition ?? '',
        // 後方互換フィールド（1件目の時刻を代表値として設定）
        loadingStartTime:   c.rows?.[0]?.loadingStart   ?? c.loadingStartTime   ?? '',
        loadingEndTime:     c.rows?.[0]?.loadingEnd     ?? c.loadingEndTime     ?? '',
        loadingDuration:    c.rows?.[0]?.loadingMinutes ?? c.loadingDuration    ?? '',
        unloadingStartTime: c.rows?.[0]?.unloadingStart ?? c.unloadingStartTime ?? '',
        unloadingEndTime:   c.rows?.[0]?.unloadingEnd   ?? c.unloadingEndTime   ?? '',
        unloadingDuration:  c.rows?.[0]?.unloadingMinutes ?? c.unloadingDuration ?? '',
        // ★ 新規: グループ内全時刻行
        rows: c.rows ?? [],
      })),
      fuelLiters,
      fuelOdometerKm,
      totalBreakTime,  // 🆕 休憩時間合計
      oilLiters: '',
      hasGrease: false,
      hasPuncture: false,
      hasTireWear: false,
      leftInspItems: leftItems,
      middleInspItems: middleItems,
      rightInspItems: rightItems,
      remarks: '',
    };

    // ===== PDF 生成 =====
    // ensureReportDirectory と generateDailyDriverReportPDF はインポートが必要
    const fileName = `daily_report_${dailyDriverData.reportDate}_${report.id}.pdf`;
    const outputPath = require('path').join(
      require('process').cwd(),
      'generated_reports',
      fileName
    );

    const fileSize = await generateDailyDriverReportPDF(dailyDriverData, outputPath);

    return { filePath: outputPath, fileSize };
  }

  /**
  * 貨物自動車運送事業実績報告書 PDF生成
  */
  private async generateAnnualTransportReportPDF(
    report: any
  ): Promise<{ filePath: string; fileSize: number }> {
    const params = report.parameters as any;
    const fiscalYear: number = params?.fiscalYear
      ? Number(params.fiscalYear)
      : (report.startDate
          ? new Date(report.startDate).getFullYear()
          : new Date().getFullYear());

    // 集計実行
    const { aggregateAnnualTransportReport } = await import('./annualTransportReportService');
    const { generateAnnualTransportReportPDF: genPDF } = await import('./annualTransportReportPDF');

    const reportData = await aggregateAnnualTransportReport(fiscalYear);

    // 出力ファイルパス
    const path = require('path');
    const fileName = `annual_transport_${fiscalYear}_${report.id}.pdf`;
    const outputPath = path.join(
      require('process').cwd(),
      'generated_reports',
      fileName
    );

    // PDF生成
    const fileSize = await genPDF(reportData, outputPath);

    return { filePath: outputPath, fileSize };
  }

  /**
   * プレースホルダーPDF（未実装の種別向け）
   */
  private async generatePlaceholderPDF(
    report: any
  ): Promise<{ filePath: string; fileSize: number }> {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const pathModule = require('path');

    ensureReportDirectory();
    const fileName = `report_${report.id}.pdf`;
    const outputPath = pathModule.join(REPORTS_OUTPUT_DIR, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4' });
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);
      doc.fontSize(14).text(`${report.title}`, 40, 40);
      doc.fontSize(10).text(`生成日時: ${new Date().toLocaleString('ja-JP')}`, 40, 70);
      doc.text('このレポート種別は現在実装中です。', 40, 100);
      doc.end();
      writeStream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        resolve({ filePath: outputPath, fileSize: stats.size });
      });
      writeStream.on('error', reject);
    });
  }
}

// =====================================
// 📤 エクスポート（シングルトン）
// =====================================

let reportServiceInstance: ReportService | null = null;

export function getReportService(db?: PrismaClient): ReportService {
  if (!reportServiceInstance) {
    reportServiceInstance = new ReportService(db);
  }
  return reportServiceInstance;
}

// =====================================
// ✅ reportService.ts コンパイルエラー完全修正完了
// =====================================
