// =====================================
// types/index.ts
// クリーン生成された統合型定義ファイル
// 生成日時: Sat Sep 13 10:52:23 PM JST 2025
// =====================================

// =====================================
// 全モデル型エクスポート
// =====================================

// AuditLog 関連型
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

export {
  getAuditLogService
} from '../models/AuditLogModel';

// GpsLog 関連型
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

export {
  getGpsLogService
} from '../models/GpsLogModel';

// InspectionItem 関連型
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

export {
  getInspectionItemService
} from '../models/InspectionItemModel';

// InspectionItemResult 関連型
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

export {
  getInspectionItemResultService
} from '../models/InspectionItemResultModel';

// InspectionRecord 関連型
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

export {
  getInspectionRecordService
} from '../models/InspectionRecordModel';

// Item 関連型
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

export {
  getItemService
} from '../models/ItemModel';

// Location 関連型
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

export {
  getLocationService
} from '../models/LocationModel';

// MaintenanceRecord 関連型
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

export {
  getMaintenanceRecordService
} from '../models/MaintenanceRecordModel';

// Notification 関連型
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

export {
  getNotificationService
} from '../models/NotificationModel';

// Operation 関連型
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

export {
  getOperationService
} from '../models/OperationModel';

// OperationDetail 関連型
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

export {
  getOperationDetailService
} from '../models/OperationDetailModel';

// SystemSetting 関連型
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

export {
  getSystemSettingService
} from '../models/SystemSettingModel';

// User 関連型
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

export {
  getUserService
} from '../models/UserModel';

// Vehicle 関連型
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

export {
  getVehicleService
} from '../models/VehicleModel';



// =====================================
// 共通型定義
// =====================================

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

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
// モデル別集約型（修正版）
// =====================================

// 各モデル型を再エクスポート（型参照用）
import type { AuditLogModel as _AuditLogModel } from '../models/AuditLogModel';
import type { GpsLogModel as _GpsLogModel } from '../models/GpsLogModel';
import type { InspectionItemModel as _InspectionItemModel } from '../models/InspectionItemModel';
import type { InspectionItemResultModel as _InspectionItemResultModel } from '../models/InspectionItemResultModel';
import type { InspectionRecordModel as _InspectionRecordModel } from '../models/InspectionRecordModel';
import type { ItemModel as _ItemModel } from '../models/ItemModel';
import type { LocationModel as _LocationModel } from '../models/LocationModel';
import type { MaintenanceRecordModel as _MaintenanceRecordModel } from '../models/MaintenanceRecordModel';
import type { NotificationModel as _NotificationModel } from '../models/NotificationModel';
import type { OperationModel as _OperationModel } from '../models/OperationModel';
import type { OperationDetailModel as _OperationDetailModel } from '../models/OperationDetailModel';
import type { SystemSettingModel as _SystemSettingModel } from '../models/SystemSettingModel';
import type { UserModel as _UserModel } from '../models/UserModel';
import type { VehicleModel as _VehicleModel } from '../models/VehicleModel';

export interface ModelRegistry {
  AuditLog: _AuditLogModel;
  GpsLog: _GpsLogModel;
  InspectionItem: _InspectionItemModel;
  InspectionItemResult: _InspectionItemResultModel;
  InspectionRecord: _InspectionRecordModel;
  Item: _ItemModel;
  Location: _LocationModel;
  MaintenanceRecord: _MaintenanceRecordModel;
  Notification: _NotificationModel;
  Operation: _OperationModel;
  OperationDetail: _OperationDetailModel;
  SystemSetting: _SystemSettingModel;
  User: _UserModel;
  Vehicle: _VehicleModel;
}

export type ModelNames = keyof ModelRegistry;
export type ModelType<T extends ModelNames> = ModelRegistry[T];
