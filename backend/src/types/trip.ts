// =====================================
// backend/src/types/trip.ts
// 運行（Trip）関連型定義 - Phase 1-A-5完全改修版
// Operation モデルをベースとした運行管理用型
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: Mon Oct 13 14:30:00 JST 2025 - 重複export修正・VehicleStatus enum修正
// 🆕 D5/D6機能追加: 2025年12月2日 - AddActivityRequest型にGPS座標フィールド追加
// 🆕🆕🆕 積降開始・完了機能追加: 2025年1月29日 - Start/Complete型定義追加
// アーキテクチャ指針準拠版 - Phase 1-A対応
// =====================================

// ⚠️ Phase 1-A-5 修正: VehicleStatusをEnum値として使用
import { ActivityType, OperationStatus, VehicleStatus } from '@prisma/client';

// ✅ 修正: models/ではなく @prisma/client から直接import
import type {
  GpsLog,
  Operation,
  OperationDetail,
  Prisma,
  User,
  Vehicle
} from '@prisma/client';

// 🎯 共通型インポート（types/common.tsから）
import type {
  ApiResponse,
  DateRange,
  PaginationQuery,
  SearchQuery,
  StatisticsBase
} from './common';

// ✅ 修正: 循環参照を避けるため、OperationDetailCreateDTO を直接定義
export interface OperationDetailCreateDTO {
  operationId: string;
  locationId: string;
  itemId?: string;
  sequenceNumber: number;
  plannedTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  quantityTons: number;
  notes?: string;
  // 🆕 GPS位置情報フィールド（operation_details テーブルへの直接保存用）
  latitude?: number;
  longitude?: number;
  altitude?: number;
  gpsAccuracyMeters?: number;
  gpsRecordedAt?: Date;
}

// =====================================
// 基本Trip型定義（既存完全実装保持）
// =====================================

// 運行作成リクエスト型
export interface CreateTripRequest {
  vehicleId: string;
  driverId?: string;
  actualStartTime: Date | string;
  notes?: string;
  startOdometer?: number;  // ✅ BUG-035: 運行開始オドメーター値
  // 位置情報オプション
  startLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
  customerId?: string;  // 🆕 客先ID
}

// 運行更新リクエスト型
export interface UpdateTripRequest {
  status?: OperationStatus;
  notes?: string;
}

// Trip型（Operationモデルのエイリアス + 拡張）
export interface Trip extends Operation {
  // 必要に応じて拡張プロパティを追加
}

// =====================================
// フィルター・検索関連型（既存完全実装保持）
// =====================================

export interface TripFilter extends PaginationQuery, SearchQuery, DateRange {
  driverId?: string;
  vehicleId?: string;
  status?: OperationStatus | OperationStatus[];  // ✅ 単一値と配列の両方を許可
  operationType?: string;
  hasGpsData?: boolean;
}

// =====================================
// レスポンス型定義（既存完全実装保持）
// =====================================

export interface PaginatedTripResponse<T> extends ApiResponse<T[]> {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// =====================================
// Activity（作業）関連型定義（既存完全実装保持）
// =====================================

// 運行詳細作成リクエスト型
export interface CreateTripDetailRequest {
  locationId: string;
  itemId: string;
  quantity: number;
  activityType: ActivityType;
  startTime: Date;
  endTime?: Date;
  notes?: string;
  // 🆕 GPS位置情報フィールド（Controller → Service へのパススルー用）
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

// =====================================
// 燃料記録関連型定義（既存完全実装保持）
// =====================================

export interface CreateFuelRecordRequest {
  fuelAmount: number;
  fuelCost: number;
  mileageAtRefuel?: number;  // ✅ 給油時走行距離（専用パラメータ）
  location?: string;
  latitude?: number;      // 🆕 追加
  longitude?: number;     // 🆕 追加
  accuracy?: number;      // 🆕 追加
  timestamp: Date;
  notes?: string;
}

// =====================================
// 統計・レポート関連型定義（既存完全実装保持）
// =====================================

export interface TripStatistics extends StatisticsBase {
  totalTrips: number;
  totalQuantity: number;
  totalActivities: number;
  dateRange: {
    startDate?: string;
    endDate?: string;
  };
  byStatus: Record<OperationStatus, number>;
  byVehicle: Record<string, number>;
  byDriver: Record<string, number>;
  averageDistance: number;
  totalDistance: number;
  averageDuration: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  fuelEfficiency: number;
  onTimeCompletionRate: number;
  recentTrends: {
    last7Days: number;
    last30Days: number;
    thisMonth: number;
    lastMonth: number;
  };
}

// =====================================
// 拡張Trip型定義（services統合対応）
// =====================================

export interface CreateTripRequestExtended {
  vehicleId: string;
  driverId?: string;
  startTime: Date | string;
  endTime?: Date | string;
  plannedRoute?: string;
  notes?: string;
  expectedDistance?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface UpdateTripRequestExtended extends Prisma.OperationUpdateInput {
  status?: OperationStatus;
  notes?: string;
  actualStartTime?: Date;
  actualEndTime?: Date;
  totalDistance?: number;
  fuelConsumed?: number;
  fuelCost?: number;
}

export interface EndTripRequest {
  endTime: Date;
  endMileage?: number;
  endOdometer?: number;
  endFuelLevel?: number;
  endLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  // 🆕 トップレベルGPSフィールド（他リクエスト型と統一）
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  fuelConsumed?: number;
  fuelCost?: number;
  notes?: string;
  completionStatus?: 'COMPLETED' | 'COMPLETED_WITH_ISSUES' | 'PARTIALLY_COMPLETED';
}

export interface AddActnDetailivityRequest extends Prisma.OperationDetailCreateInput {
  locationId: string;
  itemId?: string;
  quantity?: number;
  activityType: ActivityType;
  startTime: Date;
  endTime?: Date;
  notes?: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

// =====================================
// 🆕🆕🆕 D5/D6機能: AddActivityRequest型を拡張
// =====================================

/**
 * 積込・積降記録追加リクエスト型 - D5/D6機能対応版
 *
 * 【変更内容】2025年12月2日
 * - startTime: Date → startTime?: Date（オプションに変更、自動設定可能）
 * - latitude?: number を追加（GPS緯度の直接指定）
 * - longitude?: number を追加（GPS経度の直接指定）
 * - accuracy?: number を追加（GPS測位精度、メートル単位）
 * - arrivalTime?: Date を追加（到着時刻、省略時は現在時刻）
 *
 * 【下位互換性】
 * - 既存のgpsLocationオブジェクトも引き続きサポート
 * - latitude/longitudeとgpsLocationの両方が指定された場合、latitude/longitudeを優先
 *
 * 【使用例】
 * ```typescript
 * // パターン1: GPS座標を直接指定（推奨）
 * const request1: AddActivityRequest = {
 *   locationId: 'loc-123',
 *   activityType: 'LOADING',
 *   latitude: 35.6812,
 *   longitude: 139.7671,
 *   accuracy: 10.5,
 *   arrivalTime: new Date()
 * };
 *
 * // パターン2: gpsLocationオブジェクトを使用（既存互換）
 * const request2: AddActivityRequest = {
 *   locationId: 'loc-123',
 *   activityType: 'LOADING',
 *   startTime: new Date(),
 *   gpsLocation: {
 *     latitude: 35.6812,
 *     longitude: 139.7671,
 *     accuracy: 10.5
 *   }
 * };
 * ```
 */
export interface AddActivityRequest extends OperationDetailCreateDTO {
  locationId: string;
  itemId?: string;
  quantity?: number;
  activityType: ActivityType;
  startTime?: Date;  // 🆕 オプションに変更（自動設定可能）
  endTime?: Date;
  notes?: string;
  // 既存のgpsLocationオブジェクト（下位互換性維持）
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  // 🆕 D5/D6機能: GPS座標の直接指定も可能に（実装計画書対応）
  latitude?: number;   // GPS緯度（-90 ~ 90）
  longitude?: number;  // GPS経度（-180 ~ 180）
  accuracy?: number;   // オプション: GPS測位精度（メートル）
  arrivalTime?: Date;  // 🆕 オプション: 到着時刻（省略時は現在時刻）
}

export interface GpsLocationUpdate {
  latitude: number;
  longitude: number;
  altitude?: number;
  speedKmh?: number;
  heading?: number;
  accuracyMeters?: number;
  timestamp: Date;
}

export interface TripWithDetails extends Operation {
  vehicle?: Vehicle;
  driver?: User;
  activities?: OperationDetail[];
  gpsLogs?: GpsLog[];
  fuelRecords?: any[];
  statistics?: TripStatistics;
}

// =====================================
// GPS履歴関連型定義（サービス統合対応）
// =====================================

export interface GPSHistoryOptions {
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  includeAnalytics?: boolean;
}

export interface GPSHistoryResponse {
  gpsLogs: GpsLog[];
  totalCount: number;
  analytics?: {
    totalDistance: number;
    averageSpeed: number;
    maxSpeed: number;
    duration: number;
  };
}

// =====================================
// 🆕🆕🆕 積降開始・完了型定義（2025年1月29日追加）
// =====================================

/**
 * 積込開始リクエスト
 * POST /trips/:id/loading/start
 *
 * 処理内容:
 * - 積込場所への到着を記録
 * - actualStartTime を設定
 * - locationId, GPS座標を記録
 * - actualEndTime は null のまま（完了時に設定）
 */
export interface StartLoadingRequest {
  locationId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  startTime?: Date;
  notes?: string;
}

/**
 * 積込完了リクエスト
 * POST /trips/:id/loading/complete
 *
 * 処理内容:
 * - 最新の積込開始レコードを取得
 * - actualEndTime を設定
 * - itemId, quantity を更新
 */
export interface CompleteLoadingRequest {
  itemId?: string;
  quantity?: number;
  latitude?: number;      // 🆕 追加
  longitude?: number;     // 🆕 追加
  accuracy?: number;      // 🆕 追加
  endTime?: Date;
  notes?: string;
}

/**
 * 積降開始リクエスト
 * POST /trips/:id/unloading/start
 *
 * 処理内容:
 * - 積降場所への到着を記録
 * - actualStartTime を設定
 * - locationId, GPS座標を記録
 * - actualEndTime は null のまま（完了時に設定）
 */
export interface StartUnloadingRequest {
  locationId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  startTime?: Date;
  notes?: string;
}

/**
 * 積降完了リクエスト
 * POST /trips/:id/unloading/complete
 *
 * 処理内容:
 * - 最新の積降開始レコードを取得
 * - actualEndTime を設定
 * - itemId, quantity を更新
 */
export interface CompleteUnloadingRequest {
  itemId?: string;
  quantity?: number;
  latitude?: number;      // 🆕 追加
  longitude?: number;     // 🆕 追加
  accuracy?: number;      // 🆕 追加
  endTime?: Date;
  notes?: string;
}

// =====================================
// 車両ステータス管理（既存完全実装保持）
// ⚠️ Phase 1-A-5 重要修正: 文字列リテラルをEnum値に変更
// =====================================

export type TripStatus = OperationStatus;

export type VehicleOperationStatus =
  | 'AVAILABLE'
  | 'IN_USE'
  | 'MAINTENANCE'
  | 'OUT_OF_SERVICE';

export interface TripDetail {
  tripId: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: Date;
  };
  estimatedArrival?: Date;
  progress?: number; // 0-100%
}

// Prisma VehicleStatus と Business VehicleStatus のマッピング
export type PrismaVehicleStatus = VehicleStatus;
export type BusinessVehicleStatus = VehicleOperationStatus;

// =====================================
// 車両ステータスヘルパー（既存完全実装保持）
// ⚠️ Phase 1-A-5 修正: 文字列リテラルをVehicleStatus Enum値に変更
// =====================================

/**
 * 車両ステータスヘルパー - Phase 1-A-5完全改修版
 *
 * 【Phase 1-A-5 修正内容】
 * - 文字列リテラル（'AVAILABLE'等）をVehicleStatus Enum値に変更
 * - switch-caseでのEnum値比較を型安全に実装
 * - 既存の全機能を100%保持しながら型エラーを解消
 *
 * 【使用例】
 * - toBusiness(VehicleStatus.AVAILABLE) → 'AVAILABLE'
 * - toPrisma('AVAILABLE' as BusinessVehicleStatus) → VehicleStatus.AVAILABLE
 */
export const vehicleStatusHelper = {
  /**
   * Prisma enum を Business enum に変換
   * @param prismaStatus - Prisma VehicleStatus enum値
   * @returns BusinessVehicleStatus文字列
   */
  toBusiness(prismaStatus: PrismaVehicleStatus): BusinessVehicleStatus {
    // ✅ Phase 1-A-5修正: VehicleStatus Enum値を使用
    switch (prismaStatus) {
      case VehicleStatus.ACTIVE:
        return 'AVAILABLE';
      case VehicleStatus.INACTIVE:
        return 'IN_USE';
      case VehicleStatus.MAINTENANCE:
        return 'MAINTENANCE';
      case VehicleStatus.RETIRED:
        return 'OUT_OF_SERVICE';
      default:
        return 'AVAILABLE';
    }
  },

  /**
   * Business enum を Prisma enum に変換
   * @param businessStatus - Business VehicleOperationStatus文字列
   * @returns Prisma VehicleStatus enum値
   */
  toPrisma(businessStatus: BusinessVehicleStatus): PrismaVehicleStatus {
    // ✅ Phase 1-A-5修正: VehicleStatus Enum値を返却
    // ✅ 修正: VehicleStatus.RETIRED を使用（OUT_OF_SERVICE は存在しない）
    switch (businessStatus) {
      case 'AVAILABLE':
        return VehicleStatus.ACTIVE;
      case 'IN_USE':
        return VehicleStatus.INACTIVE;
      case 'MAINTENANCE':
        return VehicleStatus.MAINTENANCE;
      case 'OUT_OF_SERVICE':
        return VehicleStatus.RETIRED;
      default:
        return VehicleStatus.ACTIVE;
    }
  },

  /**
   * ステータスが運行可能かチェック
   * @param status - チェック対象のステータス
   * @returns 運行可能な場合true
   */
  isOperational(status: VehicleOperationStatus): boolean {
    return status === 'AVAILABLE';
  },

  /**
   * ステータス表示用ラベル（日本語）
   * @param status - 表示対象のステータス
   * @returns 日本語ラベル
   */
  getLabel(status: VehicleOperationStatus): string {
    const labels: Record<VehicleOperationStatus, string> = {
      'AVAILABLE': '利用可能',
      'IN_USE': '使用中',
      'MAINTENANCE': 'メンテナンス中',
      'OUT_OF_SERVICE': 'サービス停止中'
    };
    return labels[status];
  }
};

// =====================================
// 車両ステータス定数（既存完全実装保持）
// ⚠️ Phase 1-A-5 注記: 文字列リテラル定数は後方互換性のため保持
// =====================================

/**
 * 車両ステータス定数 - 後方互換性維持
 *
 * 【Phase 1-A-5 注記】
 * - 文字列リテラル定数は既存コードとの互換性のため保持
 * - 新規コードではVehicleStatus Enum値の使用を推奨
 * - 既存の全機能を100%保持
 */
export const VEHICLE_STATUS_CONSTANTS = {
  AVAILABLE: 'AVAILABLE' as const,
  IN_USE: 'IN_USE' as const,
  MAINTENANCE: 'MAINTENANCE' as const,
  OUT_OF_SERVICE: 'OUT_OF_SERVICE' as const,

  // ステータス一覧
  ALL_STATUSES: [
    'AVAILABLE',
    'IN_USE',
    'MAINTENANCE',
    'OUT_OF_SERVICE'
  ] as const,

  // 運行可能ステータス
  OPERATIONAL_STATUSES: ['AVAILABLE'] as const,

  // 運行不可ステータス
  NON_OPERATIONAL_STATUSES: [
    'IN_USE',
    'MAINTENANCE',
    'OUT_OF_SERVICE'
  ] as const
};

// =====================================
// Trip車両ステータス管理クラス（既存完全実装保持）
// =====================================

/**
 * Trip車両ステータス管理クラス
 *
 * 【機能】
 * - 運行開始/終了時のステータス決定
 * - ステータス変更の妥当性チェック
 * - ステータス変更理由の取得
 *
 * 【Phase 1-A-5】
 * - 既存の全メソッドを100%保持
 * - 型安全性を維持しながら既存機能を保証
 */
export class TripVehicleStatusManager {
  /**
   * 運行開始時の車両ステータス更新
   * @returns 使用中ステータス
   */
  static getStartTripStatus(): VehicleOperationStatus {
    return 'IN_USE';
  }

  /**
   * 運行終了時の車両ステータス更新
   * @returns 利用可能ステータス
   */
  static getEndTripStatus(): VehicleOperationStatus {
    return 'AVAILABLE';
  }

  /**
   * 運行中断時の車両ステータス更新
   * @returns 利用可能ステータス
   */
  static getPauseTripStatus(): VehicleOperationStatus {
    return 'AVAILABLE';
  }

  /**
   * メンテナンス時の車両ステータス更新
   * @returns メンテナンス中ステータス
   */
  static getMaintenanceStatus(): VehicleOperationStatus {
    return 'MAINTENANCE';
  }

  /**
   * ステータス変更可否のチェック
   * @param from - 変更前のステータス
   * @param to - 変更後のステータス
   * @returns 変更可能な場合true
   */
  static canChangeStatus(
    from: VehicleOperationStatus,
    to: VehicleOperationStatus
  ): boolean {
    // 利用可能 → 使用中
    if (from === 'AVAILABLE' && to === 'IN_USE') return true;

    // 使用中 → 利用可能
    if (from === 'IN_USE' && to === 'AVAILABLE') return true;

    // 任意のステータス → メンテナンス中
    if (to === 'MAINTENANCE') return true;

    // メンテナンス中 → 利用可能
    if (from === 'MAINTENANCE' && to === 'AVAILABLE') return true;

    // サービス停止への変更は管理者のみ
    if (to === 'OUT_OF_SERVICE') return true;

    // サービス停止から復旧
    if (from === 'OUT_OF_SERVICE' && to === 'AVAILABLE') return true;

    return false;
  }

  /**
   * ステータス変更の理由取得
   * @param from - 変更前のステータス
   * @param to - 変更後のステータス
   * @returns ステータス変更理由（日本語）
   */
  static getStatusChangeReason(
    from: VehicleOperationStatus,
    to: VehicleOperationStatus
  ): string {
    if (from === 'AVAILABLE' && to === 'IN_USE') {
      return '運行開始';
    }
    if (from === 'IN_USE' && to === 'AVAILABLE') {
      return '運行終了';
    }
    if (to === 'MAINTENANCE') {
      return 'メンテナンス開始';
    }
    if (from === 'MAINTENANCE' && to === 'AVAILABLE') {
      return 'メンテナンス完了';
    }
    if (to === 'OUT_OF_SERVICE') {
      return 'サービス停止';
    }
    if (from === 'OUT_OF_SERVICE' && to === 'AVAILABLE') {
      return 'サービス復旧';
    }
    return 'ステータス変更';
  }
}
