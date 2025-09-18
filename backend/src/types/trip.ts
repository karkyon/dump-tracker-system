// =====================================
// types/trip.ts
// 運行（Trip）関連型定義 - 完全版
// Operation モデルをベースとした運行管理用型
// =====================================

import type { 
  OperationModel, 
  OperationCreateInput, 
  OperationUpdateInput,
  OperationDetailModel,
  OperationDetailCreateInput 
} from './index';

// =====================================
// 基本Trip型定義
// =====================================

// 運行作成リクエスト型
export interface CreateTripRequest {
  vehicleId: string;
  driverId?: string;
  startTime: Date | string;
  notes?: string;
}

// 運行更新リクエスト型
export interface UpdateTripRequest {
  status?: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
}

// Trip型（Operationモデルのエイリアス + 拡張）
export interface Trip extends OperationModel {
  // 必要に応じて拡張プロパティを追加
}

// =====================================
// フィルター・検索関連型
// =====================================

export interface TripFilter {
  driverId?: string;
  vehicleId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// =====================================
// レスポンス型定義
// =====================================

export interface PaginatedTripResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =====================================
// Activity（作業）関連型定義
// =====================================

// アクティビティタイプ（schema.camel.prismaと整合）
export type ActivityType = 'LOADING' | 'UNLOADING' | 'BREAK' | 'FUEL';

// 運行詳細作成リクエスト型
export interface CreateTripDetailRequest {
  locationId: string;
  itemId: string;
  quantity: number;
  activityType: ActivityType;
  startTime: Date;
  endTime?: Date;
  notes?: string;
}

// =====================================
// 燃料記録関連型定義
// =====================================

export interface CreateFuelRecordRequest {
  fuelAmount: number;
  fuelCost: number;
  location?: string;
  timestamp: Date;
  notes?: string;
}

// =====================================
// 統計・レポート関連型定義
// =====================================

export interface TripStatistics {
  totalTrips: number;
  totalQuantity: number;
  totalActivities: number;
  period: {
    startDate?: string;
    endDate?: string;
  };
}

// =====================================
// ステータス関連型定義
// =====================================

export type TripStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// =====================================
// VehicleStatus適切な管理
// =====================================

// Prismaスキーマの正確なVehicleStatus型（schema.camel.prismaより）
export type PrismaVehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | 'RETIRED';

// ビジネスロジック用のVehicleStatus（アプリケーション内部で使用）
export type BusinessVehicleStatus = 'AVAILABLE' | 'IN_OPERATION' | 'MAINTENANCE' | 'UNAVAILABLE';

// 運行管理におけるVehicleOperationStatus（運行コンテキスト専用）
export type VehicleOperationStatus = 'AVAILABLE' | 'IN_OPERATION' | 'MAINTENANCE' | 'UNAVAILABLE';

// =====================================
// VehicleStatusヘルパー関数・ユーティリティ
// =====================================

export const vehicleStatusHelper = {
  /**
   * 車両が利用可能かどうかをチェック
   * @param status Prismaから取得したVehicleStatus
   * @returns 利用可能かどうか
   */
  isAvailable: (status: PrismaVehicleStatus): boolean => {
    return status === 'ACTIVE';
  },

  /**
   * 運行開始時に設定すべきステータスを取得
   * @returns 運行中を表すPrismaVehicleStatus
   */
  getOperatingStatus: (): PrismaVehicleStatus => {
    return 'MAINTENANCE';  // 運行中はMAINTENANCEとして扱う
  },

  /**
   * 運行終了時に設定すべきステータスを取得
   * @returns 利用可能状態を表すPrismaVehicleStatus
   */
  getAvailableStatus: (): PrismaVehicleStatus => {
    return 'ACTIVE';  // 利用可能状態に復旧
  },

  /**
   * PrismaのVehicleStatusをビジネスロジック用ステータスに変換
   * @param prismaStatus PrismaのVehicleStatus
   * @returns ビジネスロジック用のVehicleStatus
   */
  toBusinessStatus: (prismaStatus: PrismaVehicleStatus): BusinessVehicleStatus => {
    const statusMap: Record<PrismaVehicleStatus, BusinessVehicleStatus> = {
      'ACTIVE': 'AVAILABLE',
      'MAINTENANCE': 'MAINTENANCE',
      'INACTIVE': 'UNAVAILABLE',
      'RETIRED': 'UNAVAILABLE'
    };
    return statusMap[prismaStatus];
  },

  /**
   * ビジネスロジック用ステータスをPrismaのVehicleStatusに変換
   * @param businessStatus ビジネスロジック用のVehicleStatus
   * @returns PrismaのVehicleStatus
   */
  toPrismaStatus: (businessStatus: BusinessVehicleStatus): PrismaVehicleStatus => {
    const statusMap: Record<BusinessVehicleStatus, PrismaVehicleStatus> = {
      'AVAILABLE': 'ACTIVE',
      'IN_OPERATION': 'MAINTENANCE',  // 運行中は一時的にMAINTENANCEとして扱う
      'MAINTENANCE': 'MAINTENANCE',
      'UNAVAILABLE': 'INACTIVE'
    };
    return statusMap[businessStatus];
  },

  /**
   * 運行管理用ステータスをPrismaのVehicleStatusに変換
   * @param operationStatus 運行管理用のVehicleStatus
   * @returns PrismaのVehicleStatus
   */
  fromOperationStatus: (operationStatus: VehicleOperationStatus): PrismaVehicleStatus => {
    const statusMap: Record<VehicleOperationStatus, PrismaVehicleStatus> = {
      'AVAILABLE': 'ACTIVE',
      'IN_OPERATION': 'MAINTENANCE',
      'MAINTENANCE': 'MAINTENANCE',
      'UNAVAILABLE': 'INACTIVE'
    };
    return statusMap[operationStatus];
  },

  /**
   * 全ての利用可能なPrismaVehicleStatus値を取得
   * @returns PrismaVehicleStatusの配列
   */
  getAllPrismaStatuses: (): PrismaVehicleStatus[] => {
    return ['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'RETIRED'];
  },

  /**
   * 全ての利用可能なBusinessVehicleStatus値を取得
   * @returns BusinessVehicleStatusの配列
   */
  getAllBusinessStatuses: (): BusinessVehicleStatus[] => {
    return ['AVAILABLE', 'IN_OPERATION', 'MAINTENANCE', 'UNAVAILABLE'];
  },

  /**
   * ステータスの日本語表示名を取得
   * @param status PrismaVehicleStatus
   * @returns 日本語表示名
   */
  getDisplayName: (status: PrismaVehicleStatus): string => {
    const displayNames: Record<PrismaVehicleStatus, string> = {
      'ACTIVE': '利用可能',
      'MAINTENANCE': 'メンテナンス中・運行中',
      'INACTIVE': '非アクティブ',
      'RETIRED': '退役'
    };
    return displayNames[status];
  },

  /**
   * ステータス変更が可能かどうかをチェック
   * @param currentStatus 現在のステータス
   * @param newStatus 変更先のステータス
   * @returns 変更可能かどうか
   */
  canTransition: (currentStatus: PrismaVehicleStatus, newStatus: PrismaVehicleStatus): boolean => {
    // 退役済みの車両は他のステータスに変更不可
    if (currentStatus === 'RETIRED') {
      return false;
    }
    
    // 同じステータスへの変更は無意味だが、エラーではない
    if (currentStatus === newStatus) {
      return true;
    }
    
    // その他の変更は基本的に可能
    return true;
  },

  /**
   * 運行可能な車両のステータス一覧を取得
   * @returns 運行可能なPrismaVehicleStatus配列
   */
  getOperableStatuses: (): PrismaVehicleStatus[] => {
    return ['ACTIVE'];  // 運行可能なのはACTIVEのみ
  },

  /**
   * 車両ステータスの色分け情報を取得（UI用）
   * @param status PrismaVehicleStatus
   * @returns 色分け情報オブジェクト
   */
  getStatusColorInfo: (status: PrismaVehicleStatus): { color: string; bgColor: string; text: string } => {
    const colorMap: Record<PrismaVehicleStatus, { color: string; bgColor: string; text: string }> = {
      'ACTIVE': { color: 'text-green-700', bgColor: 'bg-green-100', text: '利用可能' },
      'MAINTENANCE': { color: 'text-yellow-700', bgColor: 'bg-yellow-100', text: 'メンテナンス中' },
      'INACTIVE': { color: 'text-gray-700', bgColor: 'bg-gray-100', text: '非アクティブ' },
      'RETIRED': { color: 'text-red-700', bgColor: 'bg-red-100', text: '退役' }
    };
    return colorMap[status];
  }
};

// =====================================
// VehicleStatus関連の定数
// =====================================

export const VEHICLE_STATUS_CONSTANTS = {
  // デフォルトステータス
  DEFAULT_STATUS: 'ACTIVE' as PrismaVehicleStatus,
  
  // 運行管理用ステータス
  OPERATION_STATUS: 'MAINTENANCE' as PrismaVehicleStatus,
  
  // 利用可能ステータス
  AVAILABLE_STATUS: 'ACTIVE' as PrismaVehicleStatus,
  
  // ステータス優先度（数値が小さいほど優先度が高い）
  STATUS_PRIORITY: {
    'ACTIVE': 1,
    'MAINTENANCE': 2,
    'INACTIVE': 3,
    'RETIRED': 4
  } as Record<PrismaVehicleStatus, number>
} as const;

// =====================================
// 運行詳細型（OperationDetailのエイリアス）
// =====================================

export interface TripDetail extends OperationDetailModel {
  // 必要に応じて拡張プロパティを追加
}

// =====================================
// 型ガード関数
// =====================================

/**
 * PrismaVehicleStatusの型ガード
 * @param value チェック対象の値
 * @returns PrismaVehicleStatusかどうか
 */
export const isPrismaVehicleStatus = (value: any): value is PrismaVehicleStatus => {
  return typeof value === 'string' && 
         vehicleStatusHelper.getAllPrismaStatuses().includes(value as PrismaVehicleStatus);
};

/**
 * BusinessVehicleStatusの型ガード
 * @param value チェック対象の値
 * @returns BusinessVehicleStatusかどうか
 */
export const isBusinessVehicleStatus = (value: any): value is BusinessVehicleStatus => {
  return typeof value === 'string' && 
         vehicleStatusHelper.getAllBusinessStatuses().includes(value as BusinessVehicleStatus);
};

// =====================================
// エクスポート（互換性のため）
// =====================================

// 既存コードとの互換性を保つためのエイリアス
export type VehicleStatus = PrismaVehicleStatus;

// 運行管理のコンテキストで使用するステータス管理クラス
export class TripVehicleStatusManager {
  /**
   * 運行開始時の車両ステータス処理
   * @param currentStatus 現在の車両ステータス
   * @returns 処理結果
   */
  static startTrip(currentStatus: PrismaVehicleStatus): { 
    canStart: boolean; 
    newStatus: PrismaVehicleStatus; 
    message: string 
  } {
    if (!vehicleStatusHelper.isAvailable(currentStatus)) {
      return {
        canStart: false,
        newStatus: currentStatus,
        message: `車両ステータスが${vehicleStatusHelper.getDisplayName(currentStatus)}のため、運行を開始できません`
      };
    }
    
    return {
      canStart: true,
      newStatus: vehicleStatusHelper.getOperatingStatus(),
      message: '運行を開始しました'
    };
  }
  
  /**
   * 運行終了時の車両ステータス処理
   * @param currentStatus 現在の車両ステータス
   * @returns 処理結果
   */
  static endTrip(currentStatus: PrismaVehicleStatus): {
    canEnd: boolean;
    newStatus: PrismaVehicleStatus;
    message: string
  } {
    return {
      canEnd: true,
      newStatus: vehicleStatusHelper.getAvailableStatus(),
      message: '運行を終了し、車両を利用可能状態に戻しました'
    };
  }
}