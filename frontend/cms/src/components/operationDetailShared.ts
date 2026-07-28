// frontend/cms/src/components/operationDetailShared.ts
// OperationDetailDialog.tsx から分割された共通型定義・判定ヘルパー関数
// （このファイルはコンポーネントを持たない。型・純粋関数のみ）


export interface OperationDetail {
  id: string;
  operationNumber: string;
  vehicleId: string;
  driverId: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedStartTime: string | null;
  actualStartTime: string | null;
  plannedEndTime: string | null;
  actualEndTime: string | null;
  totalDistanceKm: number | null;
  fuelConsumedLiters: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicles?: {
    id: string;
    plateNumber: string;
    model: string;
    manufacturer: string;
  };
  usersOperationsDriverIdTousers?: {
    id: string;
    name: string;
    username: string;
  };
}

/**
 * 運行詳細（積込・積下）のインターフェース
 */
export interface OperationActivity {
  id: string;
  operationId: string;
  sequenceNumber: number;
  activityType: 'LOADING' | 'UNLOADING' | 'FUELING' | 'REFUELING' | 'BREAK' | 'MAINTENANCE' | 
                'BREAK_START' | 'BREAK_END' | 'TRIP_START' | 'TRIP_END' | 
                'TRANSPORTING' | 'WAITING' | 'PRE_INSPECTION' | 'POST_INSPECTION' | 'OTHER';
  locationId: string;
  itemId: string;
  plannedTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  quantityTons: number | null;
  notes: string | null;
  locations?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  items?: {
    id: string;
    name: string;
    unit: string;
  };
}

/**
 * GPS記録のインターフェース
 */
export interface GpsRecord {
  id: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh?: number;
}

/**
 * 点検記録のインターフェース
 */
export interface InspectionRecord {
  id: string;
  vehicleId: string;
  inspectorId: string;
  inspectionType: 'PRE_TRIP' | 'POST_TRIP';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string | null;
  completedAt: string | null;
  overallResult: 'PASS' | 'FAIL' | 'WARNING';
  latitude?: number;
  longitude?: number;
  locationName?: string;
  weatherCondition?: string;
  temperature?: number;
  overallNotes?: string;
  defectsFound?: number;
  vehicles?: {
    plateNumber: string;
    model: string;
  };
  users?: {
    name: string;
    email: string;
  };
  inspectionItemResults?: Array<{
    id: string;
    inspectionItemId: string;
    resultValue: string;
    isPassed: boolean;
    notes?: string;
    defectLevel?: string;
    photoUrls?: string[];
    inspectionItems?: {
      name: string;
      description?: string;
      category?: string;
    };
  }>;
}

/**
 * タイムラインイベントの統合型定義
 */
export interface TimelineEvent {
  id: string;
  type: 'activity' | 'inspection';
  timestamp: Date;
  sequenceNumber?: number;
  data: OperationActivity | InspectionRecord;
}

/**
 * ✅ OperationDebug統合タイムラインイベント型
 */
export interface OperationDebugTimelineEvent {
  id: string;
  sequenceNumber: number;
  eventType: 'TRIP_START' | 'TRIP_END' | 'PRE_INSPECTION' | 'POST_INSPECTION' | 
             'LOADING' | 'UNLOADING' | 'TRANSPORTING' | 'WAITING' | 
             'MAINTENANCE' | 'REFUELING' | 'FUELING' | 
             'BREAK' | 'BREAK_START' | 'BREAK_END' | 'OTHER' |
             'LOADING_ARRIVED' | 'LOADING_COMPLETED' |
             'UNLOADING_ARRIVED' | 'UNLOADING_COMPLETED' |
             'CARGO_WORK_START' | 'CARGO_WORK_END' |
             'WAITING_START' | 'WAITING_END';
  timestamp: string | null;
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
    recordedAt: string;
  } | null;
  notes?: string | null;
  quantityTons?: number;
  items?: {
    id: string;
    name: string;
    unit: string;
  } | null;
  inspectionDetails?: {
    inspectionRecordId: string;
    status: string;
    totalItems: number;
    passedItems: number;
    failedItems: number;
  } | null;
  // ✅ 休憩統合編集用（mobileのpairId方式と同じ）: ペアとなる休憩終了レコードの情報
  pairedEndId?: string | null;
  pairedEndTimestamp?: string | null;
  // ✅ 複数品目・手入力品目名・点検メモ・給油関連（カード表示用）
  detailItems?: Array<{ id: string; itemId: string; itemName: string; quantityTons: number; sequenceOrder: number }> | null;
  customItemName?: string | null;
  overallNotes?: string | null;
  totalDistanceKm?: number | null;
  fuelConsumedLiters?: number | null;
  fuelCostYen?: number | null;
  customerId?: string | null;
  customerName?: string | null;
}

/**
 * ✅ OperationDebug点検項目詳細型
 */
export interface InspectionItemDetail {
  inspectionRecordId: string;
  inspectionType: string;
  inspectionStatus: string;
  inspectionStartedAt: string | null;
  inspectionCompletedAt: string | null;
  inspectionItemId: string;
  inspectionItemName: string;
  inspectionItemDescription: string | null;
  inspectionItemCategory: string | null;
  resultValue: string | null;
  isPassed: boolean | null;
  notes: string | null;
  defectLevel: string | null;
  photoUrls: string[];
  checkedAt: string;
  operationId: string | null;
  vehicleId: string;
  vehiclePlateNumber: string | null;
  inspectorId: string;
  inspectorName: string | null;
}

export interface OperationDetailDialogProps {
  operationId: string;
  isOpen: boolean;
  onClose: () => void;
  initialOperation?: any;  // 一覧から渡される初期データ（vehicles/driver補完用）
}

/**
 * 運行記録詳細ダイアログコンポーネント
 * 
 * @description
 * 仕様書A7「運行記録 > 詳細画面（ダイアログ）」に準拠した完全実装
 * ✅ Google Maps実装追加
 * ✅ routeGpsLogs 走行軌跡を常時描画（localStorage依存を排除）
 */

// =====================================================================
// ✅ CmsGpsPinMap - CMSタイムライン編集用 GPS ピン調整マップ
// =====================================================================
export interface CmsEditEvent {
  id: string;
  realDetailId: string;
  eventType: string;
  timestamp: string | null;
  // ✅ 積込・荷降統合編集用: 完了時刻（到着時刻は timestamp）
  completionTimestamp?: string | null;
  // ✅ 休憩統合編集用: ペアとなる休憩終了レコードのID
  pairedEndId?: string | null;
  // ✅ 複数品目リスト（LOADING/UNLOADING_COMPLETED用）
  detailItems?: Array<{
    id: string;
    itemId: string;
    itemName: string;
    quantityTons: number;
    sequenceOrder: number;
  }> | null;
  // ✅ 給油金額専用フィールド
  fuelCostYen?: number | null;
  notes?: string | null;
  quantityTons?: number;
  locationName?: string;
  locationId?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  itemId?: string | null;
  itemName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  preinspMemo?: string | null;
  // ✅ 運行後点検編集用: 点検メモ・走行距離・燃料消費量の再編集時の初期値
  overallNotes?: string | null;
  totalDistanceKm?: number | null;
  fuelConsumedLiters?: number | null;
  // ✅ 手入力品目名（マスタにない品目）
  customItemName?: string | null;
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  LOADING: '積込', LOADING_ARRIVED: '積込(到着)', LOADING_COMPLETED: '積込(完了)',
  UNLOADING: '荷降', UNLOADING_ARRIVED: '積降(到着)', UNLOADING_COMPLETED: '積降(完了)',
  FUELING: '給油', REFUELING: '給油',
  BREAK_START: '休憩・待機開始', BREAK_END: '休憩・待機終了', BREAK: '休憩・待機',
  TRIP_START: '運行開始', TRIP_END: '運行終了',
  PRE_INSPECTION: '運行前点検', POST_INSPECTION: '運行後点検',
  TRANSPORTING: '運搬中', WAITING: '待機',
  WAITING_START: '待機開始', WAITING_END: '待機終了',
  CARGO_WORK_START: '荷役開始', CARGO_WORK_END: '荷役終了',
};

export const isLoadEvt  = (t: string) => ['LOADING','LOADING_ARRIVED','LOADING_COMPLETED'].includes(t);
// ✅ 積込・荷降統合編集（mobile ActivityEditSheetと同じ単一レコード編集）用の判定
export const isLoadGroupEvt = (t: string) => t === 'LOADING';
export const isUnlGroupEvt  = (t: string) => t === 'UNLOADING';
// ✅ 休憩統合編集（mobile ActivityEditSheetのpairId方式と同じ）用の判定
export const isBreakGroupEvt = (t: string) => t === 'BREAK';
// ✅ 過去に自動生成されていた「休憩開始」「休憩終了」という定型文をnotesから除去する。
//    mobile側 ActivityEditSheet.tsx の stripBreakAutoNotes と同じロジック（廃止前の旧データ対策）。
export const stripBreakAutoNotes = (raw: string): string => {
  if (!raw) return '';
  let s = raw.trim();
  if (s.startsWith('休憩開始') || s.startsWith('休憩終了')) {
    const dashIdx = s.indexOf(' - ');
    s = dashIdx !== -1 ? s.slice(dashIdx + 3).trim() : '';
  }
  return s;
};
// isUnlEvt: 個別分岐済み
// const isUnlEvt = (t: string) => ['UNLOADING','UNLOADING_ARRIVED','UNLOADING_COMPLETED'].includes(t);
export const isFuelEvt  = (t: string) => ['FUELING','REFUELING'].includes(t);
export const isBreakEvt = (t: string) => ['BREAK','BREAK_START','BREAK_END'].includes(t);

export const toHM = (iso: string | null): string => {
  if (!iso) return '';
  try {
    // ✅ JST変換（+9h）
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${String(jst.getUTCHours()).padStart(2,'0')}:${String(jst.getUTCMinutes()).padStart(2,'0')}`;
  } catch { return ''; }
};

export const mergeHM = (base: string | null, hhmm: string): string => {
  if (!hhmm) return base ?? new Date().toISOString();
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const baseDate = base ? new Date(base) : new Date();
  const jstOff = 9 * 60 * 60 * 1000;
  const jstBase = new Date(baseDate.getTime() + jstOff);
  const y = jstBase.getUTCFullYear();
  const mo = jstBase.getUTCMonth();
  const day = jstBase.getUTCDate();
  const utcMs = Date.UTC(y, mo, day, h, m, 0, 0) - jstOff;
  return new Date(utcMs).toISOString();
};

// ヘルパー: イベント種別判定
export const isInspEvt  = (t: string) => ['PRE_INSPECTION','POST_INSPECTION'].includes(t);
export const isTripEvt  = (t: string) => ['TRIP_START','TRIP_END'].includes(t);
export const isPostInsp = (t: string) => t === 'POST_INSPECTION';
export const isDeletable = (t: string) => !isInspEvt(t) && !isTripEvt(t);
export const isBreakStart = (t: string) => t === 'BREAK_START';
export const isBreakEnd   = (t: string) => t === 'BREAK_END';

