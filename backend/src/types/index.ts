// =====================================
// 統合型定義ファイル
// 全モデルの型定義を集約
// =====================================

// 各モデルの型とサービスをエクスポート

// Auth 関連型
export type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthJWTPayload,
  AuthenticatedRequest,
  AuthResponseDTO,
  AuthCreateDTO,
  AuthUpdateDTO,
  // 互換性のための型エイリアス
  LoginRequest,
  LoginResponse,
  JWTPayload
} from '../models/AuthModel';

export {
  // Authサービスが必要な場合は後で追加
} from '../models/AuthModel';

// AuditLog 関連型定義
export type {
  AuditLogModel,
  AuditLogCreateInput,
  AuditLogUpdateInput,
  AuditLogWhereInput,
  AuditLogWhereUniqueInput,
  AuditLogOrderByInput,
  AuditLogResponseDTO,
  AuditLogListResponse,
  AuditLogCreateDTO,
  AuditLogUpdateDTO
} from '../models/AuditLogModel';

// GpsLog 関連型定義
export type {
  GpsLogModel,
  GpsLogCreateInput,
  GpsLogUpdateInput,
  GpsLogWhereInput,
  GpsLogWhereUniqueInput,
  GpsLogOrderByInput,
  GpsLogResponseDTO,
  GpsLogListResponse,
  GpsLogCreateDTO,
  GpsLogUpdateDTO
} from '../models/GpsLogModel';

// InspectionItem 関連型定義
export type {
  InspectionItemModel,
  InspectionItemCreateInput,
  InspectionItemUpdateInput,
  InspectionItemWhereInput,
  InspectionItemWhereUniqueInput,
  InspectionItemOrderByInput,
  InspectionItemResponseDTO,
  InspectionItemListResponse,
  InspectionItemCreateDTO,
  InspectionItemUpdateDTO
} from '../models/InspectionItemModel';

// InspectionItemResult 関連型定義
export type {
  InspectionItemResultModel,
  InspectionItemResultCreateInput,
  InspectionItemResultUpdateInput,
  InspectionItemResultWhereInput,
  InspectionItemResultWhereUniqueInput,
  InspectionItemResultOrderByInput,
  InspectionItemResultResponseDTO,
  InspectionItemResultListResponse,
  InspectionItemResultCreateDTO,
  InspectionItemResultUpdateDTO
} from '../models/InspectionItemResultModel';

// InspectionRecord 関連型定義
export type {
  InspectionRecordModel,
  InspectionRecordCreateInput,
  InspectionRecordUpdateInput,
  InspectionRecordWhereInput,
  InspectionRecordWhereUniqueInput,
  InspectionRecordOrderByInput,
  InspectionRecordResponseDTO,
  InspectionRecordListResponse,
  InspectionRecordCreateDTO,
  InspectionRecordUpdateDTO
} from '../models/InspectionRecordModel';

// Item 関連型定義
export type {
  ItemModel,
  ItemCreateInput,
  ItemUpdateInput,
  ItemWhereInput,
  ItemWhereUniqueInput,
  ItemOrderByInput,
  ItemResponseDTO,
  ItemListResponse,
  ItemCreateDTO,
  ItemUpdateDTO
} from '../models/ItemModel';

// Location 関連型定義
export type {
  LocationModel,
  LocationCreateInput,
  LocationUpdateInput,
  LocationWhereInput,
  LocationWhereUniqueInput,
  LocationOrderByInput,
  LocationResponseDTO,
  LocationListResponse,
  LocationCreateDTO,
  LocationUpdateDTO
} from '../models/LocationModel';

// MaintenanceRecord 関連型定義
export type {
  MaintenanceRecordModel,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput,
  MaintenanceRecordWhereInput,
  MaintenanceRecordWhereUniqueInput,
  MaintenanceRecordOrderByInput,
  MaintenanceRecordResponseDTO,
  MaintenanceRecordListResponse,
  MaintenanceRecordCreateDTO,
  MaintenanceRecordUpdateDTO
} from '../models/MaintenanceRecordModel';

// Notification 関連型定義
export type {
  NotificationModel,
  NotificationCreateInput,
  NotificationUpdateInput,
  NotificationWhereInput,
  NotificationWhereUniqueInput,
  NotificationOrderByInput,
  NotificationResponseDTO,
  NotificationListResponse,
  NotificationCreateDTO,
  NotificationUpdateDTO
} from '../models/NotificationModel';

// Operation 関連型定義
export type {
  OperationModel,
  OperationCreateInput,
  OperationUpdateInput,
  OperationWhereInput,
  OperationWhereUniqueInput,
  OperationOrderByInput,
  OperationResponseDTO,
  OperationListResponse,
  OperationCreateDTO,
  OperationUpdateDTO
} from '../models/OperationModel';

// OperationDetail 関連型定義
export type {
  OperationDetailModel,
  OperationDetailCreateInput,
  OperationDetailUpdateInput,
  OperationDetailWhereInput,
  OperationDetailWhereUniqueInput,
  OperationDetailOrderByInput,
  OperationDetailResponseDTO,
  OperationDetailListResponse,
  OperationDetailCreateDTO,
  OperationDetailUpdateDTO
} from '../models/OperationDetailModel';

// SystemSetting 関連型定義
export type {
  SystemSettingModel,
  SystemSettingCreateInput,
  SystemSettingUpdateInput,
  SystemSettingWhereInput,
  SystemSettingWhereUniqueInput,
  SystemSettingOrderByInput,
  SystemSettingResponseDTO,
  SystemSettingListResponse,
  SystemSettingCreateDTO,
  SystemSettingUpdateDTO
} from '../models/SystemSettingModel';

// User 関連型定義
export type {
  UserModel,
  UserCreateInput,
  UserUpdateInput,
  UserWhereInput,
  UserWhereUniqueInput,
  UserOrderByInput,
  UserResponseDTO,
  UserListResponse,
  UserCreateDTO,
  UserUpdateDTO
} from '../models/UserModel';

// Vehicle 関連型定義
export type {
  VehicleModel,
  VehicleCreateInput,
  VehicleUpdateInput,
  VehicleWhereInput,
  VehicleWhereUniqueInput,
  VehicleOrderByInput,
  VehicleResponseDTO,
  VehicleListResponse,
  VehicleCreateDTO,
  VehicleUpdateDTO
} from '../models/VehicleModel';

// サービスクラスのエクスポート
export { AuditLogService } from '../models/AuditLogModel';
export { GpsLogService } from '../models/GpsLogModel';
export { InspectionItemService } from '../models/InspectionItemModel';
export { InspectionItemResultService } from '../models/InspectionItemResultModel';
export { InspectionRecordService } from '../models/InspectionRecordModel';
export { ItemService as ItemModelService } from '../models/ItemModel';
export { LocationService as LocationModelService } from '../models/LocationModel';
export { MaintenanceRecordService } from '../models/MaintenanceRecordModel';
export { NotificationService } from '../models/NotificationModel';
export { OperationService } from '../models/OperationModel';
export { OperationDetailService } from '../models/OperationDetailModel';
export { SystemSettingService } from '../models/SystemSettingModel';
export { UserService as UserModelService } from '../models/UserModel';
export { VehicleService as VehicleModelService } from '../models/VehicleModel';
export { getInspectionItemService } from '../models/InspectionItemModel';
export { getInspectionItemResultService } from '../models/InspectionItemResultModel';
export { getInspectionRecordService } from '../models/InspectionRecordModel';

// =====================================
// 共通インターフェース
// =====================================

// ページネーション、ソート、フィルタリングのクエリパラメータ
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 汎用APIレスポンス型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// リストレスポンスのメタ情報
export interface ListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// リストレスポンス型
export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  meta: ListMeta;
  timestamp: string;
}

// =====================================
// 汎用ユーティリティ型
// =====================================

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OmitTimestamps<T> = Omit<T, 'createdAt' | 'updatedAt'>;

// =====================================
// モデルレジストリ
// =====================================

import * as AuditLog from '../models/AuditLogModel';
import * as GpsLog from '../models/GpsLogModel';
import * as InspectionItem from '../models/InspectionItemModel';
import * as InspectionItemResult from '../models/InspectionItemResultModel';
import * as InspectionRecord from '../models/InspectionRecordModel';
import * as Item from '../models/ItemModel';
import * as Location from '../models/LocationModel';
import * as MaintenanceRecord from '../models/MaintenanceRecordModel';
import * as Notification from '../models/NotificationModel';
import * as Operation from '../models/OperationModel';
import * as OperationDetail from '../models/OperationDetailModel';
import * as SystemSetting from '../models/SystemSettingModel';
import * as User from '../models/UserModel';
import * as Vehicle from '../models/VehicleModel';
import * as Auth from '../models/AuthModel';

// 各モデルの型を集約したインターフェース
export interface ModelRegistry {
  AuditLog: AuditLog.AuditLogModel;
  GpsLog: GpsLog.GpsLogModel;
  InspectionItem: InspectionItem.InspectionItemModel;
  InspectionItemResult: InspectionItemResult.InspectionItemResultModel;
  InspectionRecord: InspectionRecord.InspectionRecordModel;
  Item: Item.ItemModel;
  Location: Location.LocationModel;
  MaintenanceRecord: MaintenanceRecord.MaintenanceRecordModel;
  Notification: Notification.NotificationModel;
  Operation: Operation.OperationModel;
  OperationDetail: OperationDetail.OperationDetailModel;
  SystemSetting: SystemSetting.SystemSettingModel;
  User: User.UserModel;
  Vehicle: Vehicle.VehicleModel;
  Auth: Auth.AuthenticatedRequest; // Authモデルの型
}

export type ModelNames = keyof ModelRegistry;
export type ModelType<T extends ModelNames> = ModelRegistry[T];

// =====================================
// 既存のauth.tsとの互換性維持
// =====================================

// Trip関連の型定義（Operation移行用）
export type Trip = Operation.OperationModel;
export type TripDetail = OperationDetail.OperationDetailModel;
export type TripCreateDTO = Operation.OperationCreateDTO;
export type TripDetailCreateDTO = OperationDetail.OperationDetailCreateDTO;
export type TripUpdateDTO = Operation.OperationUpdateDTO;
export type TripDetailUpdateDTO = OperationDetail.OperationDetailUpdateDTO;