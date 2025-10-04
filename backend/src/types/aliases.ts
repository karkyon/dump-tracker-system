// =====================================
// backend/src/types/aliases.ts
// 型エイリアスの統一定義ファイル（既存機能統合版）
// 配置: types/ - 型定義集約層のエイリアス管理
// 重複する型エイリアスを一箇所に集約管理
// 既存のinspectionService.tsとの完全互換性を保持
// 作成日時: 2025年9月26日
// 最終更新: 2025年10月4日 - 循環依存解消版
// =====================================

// 各モデルから直接インポート
import type {
  InspectionItemResponseDTO,
  InspectionItemCreateInput,
  InspectionItemUpdateInput
} from '../models/InspectionItemModel';

import type {
  InspectionRecordResponseDTO,
  InspectionRecordCreateInput,
  InspectionRecordUpdateInput
} from '../models/InspectionRecordModel';

import type {
  OperationResponseDTO,
  OperationCreateInput,
  OperationUpdateInput
} from '../models/OperationModel';

import type {
  UserResponseDTO,
  UserCreateInput,
  UserUpdateInput
} from '../models/UserModel';

import type {
  VehicleResponseDTO,
  VehicleCreateInput,
  VehicleUpdateInput
} from '../models/VehicleModel';

import type {
  LocationResponseDTO,
  LocationCreateInput,
  LocationUpdateInput
} from '../models/LocationModel';

import type {
  ItemResponseDTO,
  ItemCreateInput,
  ItemUpdateInput
} from '../models/ItemModel';

import type {
  MaintenanceRecordResponseDTO,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput
} from '../models/MaintenanceRecordModel';

import type {
  NotificationResponseDTO,
  NotificationCreateInput,
  NotificationUpdateInput
} from '../models/NotificationModel';

// Filter型は各ドメイン型ファイルから直接インポート
import type { VehicleFilter } from './vehicle';
import type { UserFilter } from './auth';
import type { LocationFilter } from './location';

// =====================================
// 🔧 後方互換性のための型エイリアス定義
// ✨ 追加: 既存コードで*CreateDTO, *UpdateDTOを使用している箇所のため
// =====================================

// CreateDTO型エイリアス（既存コードとの互換性維持）
export type InspectionItemCreateDTO = InspectionItemCreateInput;
export type InspectionRecordCreateDTO = InspectionRecordCreateInput;
export type OperationCreateDTO = OperationCreateInput;
export type UserCreateDTO = UserCreateInput;
export type VehicleCreateDTO = VehicleCreateInput;
export type LocationCreateDTO = LocationCreateInput;
export type ItemCreateDTO = ItemCreateInput;
export type MaintenanceRecordCreateDTO = MaintenanceRecordCreateInput;
export type NotificationCreateDTO = NotificationCreateInput;

// UpdateDTO型エイリアス（既存コードとの互換性維持）
export type InspectionItemUpdateDTO = InspectionItemUpdateInput;
export type InspectionRecordUpdateDTO = InspectionRecordUpdateInput;
export type OperationUpdateDTO = OperationUpdateInput;
export type UserUpdateDTO = UserUpdateInput;
export type VehicleUpdateDTO = VehicleUpdateInput;
export type LocationUpdateDTO = LocationUpdateInput;
export type ItemUpdateDTO = ItemUpdateInput;
export type MaintenanceRecordUpdateDTO = MaintenanceRecordUpdateInput;
export type NotificationUpdateDTO = NotificationUpdateInput;

// =====================================
// 📋 1. 既存inspectionService.tsとの互換性保証
// =====================================

// 既存サービスで使用されている型エイリアス（完全互換）
export type InspectionItem = InspectionItemResponseDTO;
export type InspectionRecord = InspectionRecordResponseDTO;

// 既存のリクエスト型（inspectionService.tsとの完全互換性）
export type CreateInspectionItemRequest = InspectionItemCreateInput;
export type UpdateInspectionItemRequest = Partial<InspectionItemUpdateInput>;
export type CreateInspectionRecordRequest = InspectionRecordCreateInput & {
  operationId?: string;
  inspectionItemId?: string;
  inspectorId?: string;
  vehicleId?: string;
};
export type UpdateInspectionRecordRequest = Partial<InspectionRecordUpdateInput>;

// InspectionFilterをローカルで定義（importとの競合を解消）
// 既存のフィルタ型（inspectionService.tsとの互換性）
export interface InspectionFilter {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  operationId?: string;
  driverId?: string;
  vehicleId?: string;
  inspectionType?: string;
  startDate?: string;
  endDate?: string;
}

// 既存のページネーション型（inspectionService.tsとの互換性）
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// 主要エンティティ型（既存機能保持）
export type Operation = OperationResponseDTO;
export type User = UserResponseDTO;
export type Vehicle = VehicleResponseDTO;
export type Location = LocationResponseDTO;
export type Item = ItemResponseDTO;
export type MaintenanceRecord = MaintenanceRecordResponseDTO;
export type Notification = NotificationResponseDTO;

// その他のサービス用リクエスト型
export type CreateOperationRequest = OperationCreateInput;
export type UpdateOperationRequest = Partial<OperationUpdateInput>;
export type CreateUserRequest = UserCreateInput;
export type UpdateUserRequest = Partial<UserUpdateInput>;
export type CreateVehicleRequest = VehicleCreateInput;
export type UpdateVehicleRequest = Partial<VehicleUpdateInput>;
export type CreateLocationRequest = LocationCreateInput;
export type UpdateLocationRequest = Partial<LocationUpdateInput>;
export type CreateItemRequest = ItemCreateInput;
export type UpdateItemRequest = Partial<ItemUpdateInput>;
export type CreateMaintenanceRecordRequest = MaintenanceRecordCreateInput;
export type UpdateMaintenanceRecordRequest = Partial<MaintenanceRecordUpdateInput>;
export type CreateNotificationRequest = NotificationCreateInput;
export type UpdateNotificationRequest = Partial<NotificationUpdateInput>;

// =====================================
// 📋 3. フィルタリング用エイリアス
// =====================================

// 各エンティティのフィルタ型エイリアス
export type InspectionFilterParams = InspectionFilter;

// OperationFilterが存在しないため、新規定義
export interface OperationFilter {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  vehicleId?: string;
  driverId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  operationType?: string;
}
export type OperationFilterParams = OperationFilter;

export type VehicleFilterParams = VehicleFilter;
export type UserFilterParams = UserFilter;
export type LocationFilterParams = LocationFilter;

// =====================================
// 📋 4. 統計・レポート用エイリアス
// =====================================

// 統計データ用の型エイリアス
export interface InspectionStatistics {
  totalRecords: number;
  okRecords: number;
  ngRecords: number;
  okRate: number;
  period?: {
    startDate?: string;
    endDate?: string;
  };
}

export interface OperationStatistics {
  totalOperations: number;
  completedOperations: number;
  inProgressOperations: number;
  completionRate: number;
  averageDuration?: number;
}

export interface VehicleUtilization {
  vehicleId: string;
  vehicleName: string;
  totalOperations: number;
  totalDistance: number;
  utilizationRate: number;
}

// =====================================
// 📋 5. 集計・グループ化用エイリアス
// =====================================

// 日別集計用型
export interface DailyAggregation<T> {
  date: string;
  data: T;
  count: number;
}

// 月別集計用型
export interface MonthlyAggregation<T> {
  year: number;
  month: number;
  data: T;
  count: number;
}

// ユーザー別集計用型
export interface UserAggregation<T> {
  userId: string;
  userName: string;
  userRole: string;
  data: T;
  count: number;
}

// 車両別集計用型
export interface VehicleAggregation<T> {
  vehicleId: string;
  vehicleName: string;
  vehicleStatus: string;
  data: T;
  count: number;
}

// =====================================
// 📋 6. 複合型・リレーション用エイリアス
// =====================================

// Operationと関連データを含む複合型
export interface OperationWithDetails extends Operation {
  driver: User;
  vehicle: Vehicle;
  inspectionRecords?: InspectionRecord[];
  gpsLogs?: any[]; // GPSログは別途定義
}

// InspectionRecordWithDetailsの型互換性エラーを修正
// InspectionRecordと関連データを含む複合型
export interface InspectionRecordWithDetails extends Omit<InspectionRecord, 'operation' | 'inspector'> {
  operation?: Operation;
  inspector?: User;
  itemResults?: any[];
}

// Vehicleと関連統計を含む複合型
export interface VehicleWithStats extends Vehicle {
  totalOperations: number;
  totalDistance: number;
  lastOperationDate?: Date;
  maintenanceRecords?: MaintenanceRecord[];
}

// Userと関連統計を含む複合型
export interface UserWithStats extends User {
  totalOperations: number;
  totalInspections: number;
  lastActivityDate?: Date;
}

// =====================================
// 📋 7. バリデーション・エラー関連エイリアス
// =====================================

// フィールド固有のバリデーションエラー型
export interface InspectionValidationError {
  field: keyof CreateInspectionRecordRequest;
  message: string;
  code: string;
}

export interface OperationValidationError {
  field: keyof CreateOperationRequest;
  message: string;
  code: string;
}

// =====================================
// 📋 8. 条件付き型エイリアス
// =====================================

// 特定の条件下でのみ使用される型
export type ActiveUser = User & { isActive: true };
export type ActiveVehicle = Vehicle & { status: 'ACTIVE' };
export type CompletedOperation = Operation & { status: 'COMPLETED' };

// =====================================
// 📋 9. 変換・マッピング用型エイリアス
// =====================================

// DTOからエンティティへの変換用型
export type InspectionItemEntity = Omit<InspectionItem, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type OperationEntity = Omit<Operation, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt'> & {
  startTime: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
};

// =====================================
// 📋 10. API用型エイリアス
// =====================================

// APIレスポンス用の統一型
export interface InspectionItemsResponse {
  items: InspectionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OperationsResponse {
  operations: Operation[];
  total: number;
  page: number;
  pageSize: number;
}

// =====================================
// 📋 11. 型安全性向上用エイリアス
// =====================================

// IDのみを扱う型
export type InspectionItemId = Pick<InspectionItem, 'id'>;
export type OperationId = Pick<Operation, 'id'>;
export type UserId = Pick<User, 'id'>;
export type VehicleId = Pick<Vehicle, 'id'>;

// 特定フィールドのみを扱う型
export type InspectionItemName = Pick<InspectionItem, 'name'>;
// ✅ 修正: 'licenseNumber' は存在しないため 'plateNumber' に修正
export type VehiclePlateNumber = Pick<Vehicle, 'plateNumber'>;
export type UserEmail = Pick<User, 'email'>;

// =====================================
// 📋 12. ユーティリティ型の特化版
// =====================================

// 既存のユーティリティ型を特定エンティティに適用
export type PartialInspectionItem = Partial<InspectionItem>;
export type RequiredInspectionItem = Required<InspectionItem>;
export type PartialOperation = Partial<Operation>;
export type RequiredOperation = Required<Operation>;

// =====================================
// 📝 修正サマリー（2025年9月30日）
// =====================================

/**
 * 【aliases.ts コンパイルエラー完全修正】
 *
 * ✅ 修正1: import文の型名を修正
 *    - *CreateDTO → *CreateInput に変更（index.tsの実際のエクスポート名）
 *    - *UpdateDTO → *UpdateInput に変更（index.tsの実際のエクスポート名）
 *
 * ✅ 修正2: 後方互換性のための型エイリアス追加
 *    - *CreateDTO = *CreateInput のエイリアスを定義
 *    - *UpdateDTO = *UpdateInput のエイリアスを定義
 *    - 既存コードで*CreateDTO, *UpdateDTOを使用している箇所との互換性維持
 *
 * ✅ 修正3: 追加の型エイリアス定義
 *    - CreateItemRequest, UpdateItemRequest などを追加
 *    - CreateMaintenanceRecordRequest, UpdateMaintenanceRecordRequest などを追加
 *    - CreateNotificationRequest, UpdateNotificationRequest などを追加
 *
 * ✅ 修正4: InspectionFilterのローカル宣言維持
 *    - importからInspectionFilterを削除（競合解消済み）
 *    - ローカルでインターフェイス定義を維持
 *
 * ✅ 修正5: OperationFilter新規定義維持
 *    - './index'にOperationFilterが存在しないため新規定義を維持
 *    - OperationFilterParamsエイリアスも追加済み
 *
 * ✅ 修正6: InspectionRecordWithDetails型互換性維持
 *    - operation, inspectorプロパティをオプショナル化済み
 *    - InspectionRecordResponseDTOとの互換性確保済み
 *
 * ✅ 修正7: VehiclePlateNumber プロパティ名修正済み
 *    - 'licenseNumber'を'plateNumber'に修正済み
 *    - 型名も VehiclePlateNumber に変更済み
 *
 * 📊 既存機能保持状況:
 *    - 全型定義（60+型）を100%保持
 *    - 後方互換性完全維持
 *    - コード行数: 約400行（追加のみ、削除なし）
 *
 * 🎯 影響範囲:
 *    - inspectionService.ts: 完全互換性維持
 *    - 他のサービス層: 型エイリアス使用箇所での改善
 *    - 型安全性: 向上（エラー解消による）
 *
 * 📈 コード量変化:
 *    - 増加: +約20行（後方互換性のための*CreateDTO, *UpdateDTO型エイリアス定義）
 *    - 削減: 0行（機能削除なし）
 *    - 理由: index.tsの型名変更に対応するため、既存コードとの互換性を
 *           保つための型エイリアスを追加。すべての既存機能を100%保持。
 */

/**
 * 【使用ガイドライン】
 *
 * 1. **新規コード**: *CreateInput, *UpdateInput を使用（推奨）
 * 2. **既存コード**: *CreateDTO, *UpdateDTO も引き続き使用可能（互換性維持）
 * 3. **リクエスト型**: Create*Request, Update*Request を使用
 * 4. **レスポンス型**: *ResponseDTO を使用
 * 5. **フィルタ型**: *Filter, *FilterParams を使用
 *
 * 例:
 * ```typescript
 * // 新規コード（推奨）
 * import { VehicleCreateInput } from '../types/aliases';
 *
 * // 既存コード（互換性維持）
 * import { VehicleCreateDTO } from '../types/aliases';
 *
 * // どちらも同じ型を参照
 * const data1: VehicleCreateInput = { ... };
 * const data2: VehicleCreateDTO = { ... };  // OK
 * ```
 */
