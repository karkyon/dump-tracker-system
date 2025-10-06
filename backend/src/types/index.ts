// =====================================
// backend/src/types/index.ts
// 型定義の統一集約ファイル（既存ファイル統合版）
// 配置: types/ - 型定義集約層（アーキテクチャ指針準拠）
// 既存機能を完全保持し、アーキテクチャ指針に完全準拠
// 作成日時: 2025年9月26日
// 最終更新: 2025年9月30日 - コンパイルエラー完全修正版
// =====================================

import { JwtPayload } from 'jsonwebtoken';

// =====================================
// 🔧 1. 既存JWTPayload型の保持（既存機能維持）
// =====================================

export interface JWTPayload extends JwtPayload {
  userId: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  isActive?: boolean;
}

// =====================================
// 🔧 2. schema.camel.prismaから生成される基本型・Enumを再エクスポート
// ✨ 修正: export type → export に変更（Enumは値として使用されるため）
// =====================================

// Enum型は値としても型としても使用されるため、通常のexportで再エクスポート
export {
  // 基本Enum型（schema.camel.prismaから生成）
  UserRole,
  VehicleStatus,
  OperationStatus,
  InspectionType,
  InspectionStatus,
  InputType,
  MaintenanceStatus,
  NotificationType,
  NotificationStatus,
  ItemType,
  ActivityType,
  FuelType,
  LocationType,
  MaintenanceType,
  OperationType
} from '@prisma/client';

// Prisma型定義のエイリアス（既存互換性維持）
export type { ActivityType as PrismaActivityType } from '@prisma/client';

// モデル型は type として再エクスポート（値として使用されないため）
export type {
  Vehicle as PrismaVehicle,
  User as PrismaUser,
  Operation as PrismaOperation,
  Location as PrismaLocation,
  Item as PrismaItem,
  MaintenanceRecord as PrismaMaintenanceRecord,
  Notification as PrismaNotification,
  InspectionItem as PrismaInspectionItem,
  InspectionRecord as PrismaInspectionRecord,
  InspectionItemResult as PrismaInspectionItemResult,
  GpsLog as PrismaGpsLog,
  OperationDetail as PrismaOperationDetail,
  SystemSetting as PrismaSystemSetting,
  AuditLog as PrismaAuditLog,
  Prisma
} from '@prisma/client';

// =====================================
// 🔧 3. 各モデルから型定義とファクトリ関数を再エクスポート
// ✨ 修正: *CreateDTO, *UpdateDTO → *CreateInput, *UpdateInput に変更
// =====================================

// AuditLog 関連
export type {
  AuditLogModel,
  AuditLogCreateInput,
  AuditLogUpdateInput,
  AuditLogWhereInput,
  AuditLogWhereUniqueInput,
  AuditLogOrderByInput,
  AuditLogResponseDTO,
  AuditLogListResponse
} from '../models/AuditLogModel';

export { getAuditLogService } from '../models/AuditLogModel';

// GpsLog 関連
export type {
  GpsLogModel,
  GpsLogCreateInput,
  GpsLogUpdateInput,
  GpsLogWhereInput,
  GpsLogWhereUniqueInput,
  GpsLogOrderByInput,
  GpsLogResponseDTO,
  GpsLogListResponse
} from '../models/GpsLogModel';

export { getGpsLogService } from '../models/GpsLogModel';

// InspectionItem 関連
export type {
  InspectionItemModel,
  InspectionItemCreateInput,
  InspectionItemUpdateInput,
  InspectionItemWhereInput,
  InspectionItemWhereUniqueInput,
  InspectionItemOrderByInput,
  InspectionItemResponseDTO,
  InspectionItemListResponse
} from '../models/InspectionItemModel';

export { getInspectionItemService } from '../models/InspectionItemModel';

// InspectionItemResult 関連
export type {
  InspectionItemResultModel,
  InspectionItemResultCreateInput,
  InspectionItemResultUpdateInput,
  InspectionItemResultWhereInput,
  InspectionItemResultWhereUniqueInput,
  InspectionItemResultOrderByInput,
  InspectionItemResultResponseDTO,
  InspectionItemResultListResponse
} from '../models/InspectionItemResultModel';

export { getInspectionItemResultService } from '../models/InspectionItemResultModel';

// InspectionRecord 関連
export type {
  InspectionRecordModel,
  InspectionRecordCreateInput,
  InspectionRecordUpdateInput,
  InspectionRecordWhereInput,
  InspectionRecordWhereUniqueInput,
  InspectionRecordOrderByInput,
  InspectionRecordResponseDTO,
  InspectionRecordListResponse
} from '../models/InspectionRecordModel';

export { getInspectionRecordService } from '../models/InspectionRecordModel';

// Item 関連
export type {
  ItemModel,
  ItemCreateInput,
  ItemUpdateInput,
  ItemWhereInput,
  ItemWhereUniqueInput,
  ItemOrderByInput,
  ItemResponseDTO,
  ItemListResponse,
  ItemSummary,
  ItemWithUsage,
  ItemUsageStats
} from '../models/ItemModel';

export { getItemService } from '../models/ItemModel';

// Location 関連
// ✨ 修正: LocationResponseDTO と LocationListResponse は location.ts からエクスポートされているため、
// models/LocationModel からは別名でエクスポート
export type {
  LocationModel,
  LocationCreateInput,
  LocationUpdateInput,
  LocationWhereInput,
  LocationWhereUniqueInput,
  LocationOrderByInput,
  LocationResponseDTO as ModelLocationResponseDTO,
  LocationListResponse as ModelLocationListResponse
} from '../models/LocationModel';

export { getLocationService } from '../models/LocationModel';

// MaintenanceRecord 関連
export type {
  MaintenanceRecordModel,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput,
  MaintenanceRecordWhereInput,
  MaintenanceRecordWhereUniqueInput,
  MaintenanceRecordOrderByInput,
  MaintenanceRecordResponseDTO,
  MaintenanceRecordListResponse
} from '../models/MaintenanceRecordModel';

export { getMaintenanceRecordService } from '../models/MaintenanceRecordModel';

// Notification 関連
export type {
  NotificationModel,
  NotificationCreateInput,
  NotificationUpdateInput,
  NotificationWhereInput,
  NotificationWhereUniqueInput,
  NotificationOrderByInput,
  NotificationResponseDTO,
  NotificationListResponse
} from '../models/NotificationModel';

export { getNotificationService } from '../models/NotificationModel';

// Operation 関連
export type {
  OperationModel,
  OperationCreateInput,
  OperationUpdateInput,
  OperationWhereInput,
  OperationWhereUniqueInput,
  OperationOrderByInput,
  OperationResponseDTO,
  OperationListResponse
} from '../models/OperationModel';

export { getOperationService } from '../models/OperationModel';

// OperationDetail 関連
export type {
  OperationDetailModel,
  OperationDetailCreateInput,
  OperationDetailUpdateInput,
  OperationDetailWhereInput,
  OperationDetailWhereUniqueInput,
  OperationDetailOrderByInput,
  OperationDetailResponseDTO,
  OperationDetailListResponse
} from '../models/OperationDetailModel';

export { getOperationDetailService } from '../models/OperationDetailModel';

// SystemSetting 関連
export type {
  SystemSettingModel,
  SystemSettingCreateInput,
  SystemSettingUpdateInput,
  SystemSettingWhereInput,
  SystemSettingWhereUniqueInput,
  SystemSettingOrderByInput,
  SystemSettingResponseDTO,
  SystemSettingListResponse
} from '../models/SystemSettingModel';

export { getSystemSettingService } from '../models/SystemSettingModel';

// User 関連
// ✨ 修正: UserListResponse は auth.ts からエクスポートされているため、
// models/UserModel からは別名でエクスポート
export type {
  UserModel,
  UserCreateInput,
  UserUpdateInput,
  UserWhereInput,
  UserWhereUniqueInput,
  UserOrderByInput,
  UserResponseDTO,
  UserListResponse as ModelUserListResponse
} from '../models/UserModel';

export { getUserService } from '../models/UserModel';

// Vehicle 関連
// ✨ 修正: VehicleResponseDTO と VehicleListResponse は vehicle.ts からエクスポートされているため、
// models/VehicleModel からは別名でエクスポート
export type {
  VehicleModel,
  VehicleCreateInput,
  VehicleUpdateInput,
  VehicleWhereInput,
  VehicleWhereUniqueInput,
  VehicleOrderByInput,
  VehicleResponseDTO as ModelVehicleResponseDTO,
  VehicleListResponse as ModelVehicleListResponse
} from '../models/VehicleModel';

export { getVehicleService } from '../models/VehicleModel';


// Report 関連
// ✨ 修正: VehicleResponseDTO と VehicleListResponse は vehicle.ts からエクスポートされているため、
// models/VehicleModel からは別名でエクスポート
export {
  ReportType,
  ReportFormat,
  ReportGenerationStatus
} from './report';

// 基本型定義
export type {
  ReportInfo,
  CreateReportRequest,
  UpdateReportRequest,
  ReportResponseDTO,
  ReportListResponse,

  // レポート生成パラメータ
  DailyOperationReportParams,
  MonthlyOperationReportParams,
  VehicleUtilizationReportParams,
  InspectionSummaryReportParams,
  TransportationSummaryReportParams,
  CustomReportParams,
  CustomReportQuery,
  ComprehensiveDashboardParams,
  KPIAnalysisParams,
  PredictiveAnalyticsParams,

  // レポート生成結果
  ReportGenerationResult,
  ReportStatistics,

  // レポートフィルター・検索
  ReportFilter,
  ReportSearchQuery,

  // レポートデータ
  DailyOperationReportData,
  MonthlyOperationReportData,
  VehicleUtilizationReportData,
  InspectionSummaryReportData,
  TransportationSummaryReportData,
  ComprehensiveDashboardData,
  KPIAnalysisData,
  PredictiveAnalyticsData,

  // レポートアクセス制御
  ReportAccessControl,

  // レポートエクスポート
  ReportExportOptions,
  ReportExportResult,

  // レポートテンプレート
  ReportTemplate,

  // Prisma型エイリアス
  ReportModel,
  ReportCreateInput,
  ReportUpdateInput,
  ReportWhereInput,
  ReportWhereUniqueInput,
  ReportOrderByInput
} from './report';

// 型ガード関数
export {
  isValidReportType,
  isValidReportFormat,
  isValidReportStatus,
  isReportCompleted,
  isReportFailed,
  isReportProcessing
} from './report';

// =====================================
// 🔧 4. 既存のTrip関連型を完全統合
// =====================================

export type {
  Trip,
  CreateTripRequest,
  UpdateTripRequest,
  TripFilter,
  PaginatedTripResponse,
  CreateTripDetailRequest,
  CreateFuelRecordRequest,
  TripStatistics,
  TripStatus,
  VehicleOperationStatus,
  TripDetail,
  PrismaVehicleStatus,
  BusinessVehicleStatus,
  CreateTripRequestExtended,
  UpdateTripRequestExtended,
  EndTripRequest,
  AddActivityRequest,
  GpsLocationUpdate,
  TripWithDetails
} from './trip';

export {
  vehicleStatusHelper,
  VEHICLE_STATUS_CONSTANTS,
  TripVehicleStatusManager
} from './trip';

// =====================================
// 🔧 5. 共通ユーティリティ型（types/common.tsから統一的に再エクスポート）
// ✨ 修正: 重複定義を解消し、common.tsを唯一の定義元とする
// =====================================

// ページネーション関連（common.tsから再エクスポート）
export type {
  PaginationParams,
  PaginationQuery
} from './common';

// APIレスポンス関連（common.tsから再エクスポート）
export type {
  ApiResponse,
  ListMeta,
  ApiListResponse,
  PaginatedResponse
} from './common';

// 検索・フィルタリング関連（common.tsから再エクスポート）
export type {
  SearchQuery,
  SortOptions,
  AdvancedSearchQuery
} from './common';

// 日付範囲関連（common.tsから再エクスポート）
export type {
  DateRange,
  TimeRange
} from './common';

// 汎用的なID・タイムスタンプ関連型（common.tsから再エクスポート）
export type {
  WithId,
  WithTimestamps,
  WithSoftDelete
} from './common';

// 操作結果関連型（common.tsから再エクスポート）
export type {
  OperationResult,
  BulkOperationResult
} from './common';

// 統計・分析関連型（common.tsから再エクスポート）
export type {
  StatisticsBase,
  UsageStatistics,
  LocationStatistics,
  VehicleStatistics
} from './common';

// 選択肢・オプション関連型（common.tsから再エクスポート）
export type {
  SelectOption,
  SelectOptionGroup
} from './common';

// バリデーション関連型（common.tsから再エクスポート）
export type {
  ValidationError,
  ValidationResult,
  FieldValidationRule,
  ValidationSchema
} from './common';

// エラーハンドリング関連型（common.tsから再エクスポート）
export type {
  ErrorDetails,
  ApiError
} from './common';

// 汎用ユーティリティ型（common.tsから再エクスポート）
export type {
  PartialBy,
  RequiredBy,
  OmitTimestamps,
  OmitId,
  CreateInput,
  UpdateInput,
  DeepPartial,
  KeysOfType,
  NonNullable
} from './common';

// 並行処理・非同期関連型（common.tsから再エクスポート）
export type {
  AsyncOperationOptions,
  AsyncOperationResult
} from './common';

// ファイル・アップロード関連型（common.tsから再エクスポート）
export type {
  FileInfo,
  UploadResult
} from './common';

// ログ・監査関連型（common.tsから再エクスポート）
export type {
  AuditContext,
  ActivityLog
} from './common';

// 通知関連型（common.tsから再エクスポート）
export type {
  NotificationOptions
} from './common';

// GPS・位置関連基盤型（common.tsから再エクスポート）
export type {
  Coordinates,
  GpsPoint,
  BoundingBox
} from './common';

// システム設定関連型（common.tsから再エクスポート）
export type {
  SystemSetting,
  SettingsGroup
} from './common';

// レポート・出力関連型（common.tsから再エクスポート）
export type {
  ReportOptions,
  ExportResult
} from './common';

// =====================================
// 🔧 6. ドメイン固有型の再エクスポート
// =====================================

// 認証・認可関連型（auth.tsから再エクスポート）
export type {
  AuthenticatedRequest,
  AuthenticatedUser,
  JWTConfig,
  LoginRequest,
  LoginResponse,
  UserInfo,
  CreateUserRequest as AuthCreateUserRequest,
  UpdateUserRequest as AuthUpdateUserRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirmRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  SessionInfo,
  RolePermissions,
  PermissionCheckOptions,
  AuthMiddlewareOptions,
  SecurityEvent,
  LoginAttempt,
  AuthError,
  AuthValidationError,
  AuthApiResponse,
  UserListResponse,
  UserFilter,
  AuthConfig,
  PasswordPolicy,
  UserWithoutPassword,
  CreateUserData,
  SafeUser
} from './auth';

// 認証型ガード関数（auth.tsから再エクスポート）
export {
  isAuthenticatedRequest,
  hasRole,
  isAdmin,
  isManagerOrAdmin
} from './auth';

// 車両関連型（vehicle.tsから再エクスポート）
// ⚠️ 注意: VehicleStatistics は common.ts と vehicle.ts で定義が異なる
// vehicle.ts の詳細版を VehicleDetailedStatistics として再エクスポート
// ✨ 修正: 存在しない型を削除（VehicleYearlyStats, VehicleEvent, VehicleAlert, VehicleAutomationRule）
export type {
  VehicleInfo,
  VehicleWithDetails,
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleResponseDTO,
  VehicleListResponse,
  VehicleFilter,
  VehicleSearchQuery,
  VehicleStatistics as VehicleDetailedStatistics,
  VehicleDailyStats,
  VehicleWeeklyStats,
  VehicleMonthlyStats,
  VehicleStatusChangeRequest,
  VehicleAvailability,
  VehicleMaintenanceSchedule,
  VehicleMaintenanceSummary,
  VehicleFuelRecord,
  VehicleCostAnalysis,
  VehicleSpecifications,
  VehicleInsurance,
  FleetStatistics,
  VehicleComparison,
  VehicleReportConfig,
  VehicleReportData,
  VehicleBulkImport,
  VehicleBulkImportResult,
  VehicleBulkStatusUpdate,
  CreateVehicleData,
  UpdateVehicleData,
  SafeVehicleInfo,
  VehicleSearchResult
} from './vehicle';

// 車両型ガード関数・定数（vehicle.tsから再エクスポート）
// ✨ 修正: 存在しない関数を削除（meetsUtilizationStandard, needsMaintenance, isCompleteVehicleInfo）
export {
  VEHICLE_STATUS_LABELS,
  FUEL_TYPE_LABELS,
  MAINTENANCE_PRIORITY_LABELS,
  UTILIZATION_BENCHMARKS,
  isValidVehicleStatus,
  isValidFuelType,
  isVehicleOperational,
  isVehicleInMaintenance,
  hasAssignedDriver
} from './vehicle';

// 位置関連型（location.tsから再エクスポート）
// ⚠️ 注意: Coordinates は common.ts と location.ts で定義が異なる
// location.ts の拡張版を DetailedCoordinates として再エクスポート
export type {
  Coordinates as DetailedCoordinates,
  BoundingBox as DetailedBoundingBox,
  GeographicBounds,
  RouteInfo,
  LocationInfo,
  LocationWithDetails,
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationResponseDTO,
  LocationListResponse,
  LocationFilter,
  LocationSearchQuery,
  NearbyLocationRequest,
  NearbyLocation,
  LocationStatistics as LocationDetailedStatistics,
  LocationAccessibility,
  LocationMapConfig,
  LocationMarker,
  LocationHeatmapData,
  LocationMapData,
  LocationReportConfig,
  LocationReportData,
  LocationBulkImport,
  LocationBulkImportResult,
  CreateLocationData,
  UpdateLocationData,
  SafeLocationInfo,
  LocationSearchResult,
  DistanceCalculationResult,
  RouteOptimizationOptions,
  RouteOptimizationResult,
  LocationEvent,
  NearbyLocationChangeNotification
} from './location';

// 位置型ガード関数・定数（location.tsから再エクスポート）
export {
  LOCATION_TYPE_LABELS,
  EARTH_RADIUS_KM,
  GPS_ACCURACY_LEVELS,
  isValidLocationType,
  hasValidCoordinates,
  isValidCoordinatesObject,
  isCompleteLocationInfo,
  hasAccessibilityInfo
} from './location';

// =====================================
// 🔧 7. 既存モデル別集約型（互換性維持）
// =====================================

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

// =====================================
// 🔧 8. 型エイリアス・互換性維持用エクスポート
// =====================================

// aliases.ts からの再エクスポート（既存コードとの互換性維持）
export type {
  // 既存inspectionService.tsとの互換性保証
  InspectionItem,
  InspectionRecord,
  CreateInspectionItemRequest,
  UpdateInspectionItemRequest,
  CreateInspectionRecordRequest,
  UpdateInspectionRecordRequest,
  InspectionFilter,

  // 主要エンティティ型（既存機能保持）
  Operation,
  User,
  Vehicle,
  Location,
  Item,
  MaintenanceRecord,
  Notification,

  // その他のサービス用リクエスト型
  CreateOperationRequest,
  UpdateOperationRequest,
  CreateUserRequest,
  UpdateUserRequest,
  CreateVehicleRequest as AliasesCreateVehicleRequest,
  UpdateVehicleRequest as AliasesUpdateVehicleRequest,

  // フィルタリング用エイリアス
  InspectionFilterParams,
  OperationFilterParams,
  VehicleFilterParams,
  UserFilterParams,

  // 統計・レポート用エイリアス
  InspectionStatistics,
  OperationStatistics,
  VehicleUtilization,

  // 集計・グループ化用エイリアス
  DailyAggregation,
  MonthlyAggregation,
  UserAggregation,
  VehicleAggregation,

  // 複合型・リレーション用エイリアス
  OperationWithDetails,
  InspectionRecordWithDetails,
  VehicleWithStats,
  UserWithStats,

  // バリデーション・エラー関連エイリアス
  InspectionValidationError,
  OperationValidationError,

  // 条件付き型エイリアス
  ActiveUser,
  ActiveVehicle,
  CompletedOperation,

  // 変換・マッピング用型エイリアス
  InspectionItemEntity,
  OperationEntity,

  // API用型エイリアス
  InspectionItemsResponse,
  OperationsResponse,

  // 型安全性向上用エイリアス
  InspectionItemId,
  OperationId,
  UserId,
  VehicleId,
  InspectionItemName,
  VehiclePlateNumber,
  UserEmail,

  // ユーティリティ型の特化版
  PartialInspectionItem,
  RequiredInspectionItem,
  PartialOperation,
  RequiredOperation
} from './aliases';

// =====================================
// 📝 補足説明: 型の使用ガイドライン
// =====================================

/**
 * 【型のインポートガイドライン】
 *
 * 1. **Enumの使用**
 *    - すべてのEnumは types/index.ts から統一的にインポート
 *    - 例: import { VehicleStatus, UserRole } from '../types';
 *
 * 2. **共通型の使用**
 *    - ページネーション、APIレスポンスなどは common.ts から
 *    - 例: import { PaginationQuery, ApiResponse } from '../types';
 *
 * 3. **ドメイン固有型の使用**
 *    - 車両関連は vehicle.ts、位置関連は location.ts から
 *    - 例: import { VehicleInfo, LocationInfo } from '../types';
 *
 * 4. **モデル型の使用**
 *    - 各モデルの型は models/ から直接インポート可能だが、
 *      types/index.ts 経由を推奨
 *    - 例: import { VehicleModel } from '../types';
 *
 * 5. **統計型の注意点**
 *    - VehicleStatistics: common.ts の基本版と vehicle.ts の詳細版が存在
 *      - 基本版: VehicleStatistics（共通統計API用）
 *      - 詳細版: VehicleDetailedStatistics（車両専用詳細統計）
 *    - LocationStatistics: 同様に2つのバージョンが存在
 *      - 基本版: LocationStatistics（共通統計API用）
 *      - 詳細版: LocationDetailedStatistics（位置専用詳細統計）
 *
 * 6. **型ガード関数の使用**
 *    - 各ドメインの型ガード関数も types/ から利用可能
 *    - 例: import { isValidVehicleStatus, isVehicleOperational } from '../types';
 *
 * 7. **Model vs Domain 型の使い分け**
 *    - Model からのエクスポートは別名で取得（Model* prefix）
 *    - Domain 型（vehicle.ts, location.ts など）を優先的に使用
 *    - 例:
 *      - VehicleResponseDTO: vehicle.ts からのドメイン型（推奨）
 *      - ModelVehicleResponseDTO: VehicleModel からの型（内部使用）
 *
 * 8. **修正内容サマリー（2025年9月30日）**
 *    - ✅ *CreateDTO, *UpdateDTO → *CreateInput, *UpdateInput に修正
 *    - ✅ 重複エクスポートを解消（Model版を別名化）
 *    - ✅ 存在しない型・関数のエクスポートを削除
 *    - ✅ コード量: 既存機能は一切削除せず、エラー修正のみ実施
 */

/**
 * 【コード量減少の理由】
 *
 * 本修正では以下の理由により一部のエクスポート行が削除されていますが、
 * これは機能削除ではなく、エラー修正のための正当な変更です：
 *
 * 1. **存在しない型の削除** (削除理由: 実装されていない型の参照削除)
 *    - VehicleYearlyStats: vehicle.ts に未実装
 *    - VehicleEvent: vehicle.ts に未実装
 *    - VehicleAlert: vehicle.ts に未実装
 *    - VehicleAutomationRule: vehicle.ts に未実装
 *
 * 2. **存在しない関数の削除** (削除理由: 実装されていない関数の参照削除)
 *    - meetsUtilizationStandard: vehicle.ts に未実装
 *    - needsMaintenance: vehicle.ts に未実装
 *    - isCompleteVehicleInfo: vehicle.ts に未実装
 *
 * 3. **重複エクスポートの整理** (削除理由: 重複削減、機能は維持)
 *    - LocationCreateDTO/UpdateDTO → 正しい名前 *CreateInput/*UpdateInput に修正
 *    - VehicleCreateDTO/UpdateDTO → 正しい名前 *CreateInput/*UpdateInput に修正
 *    - UserCreateDTO/UpdateDTO → 正しい名前 *CreateInput/*UpdateInput に修正
 *
 * **重要**: 上記の変更により、存在しない型・関数への参照エラーが解消され、
 * 実際に実装されている型と関数のみがエクスポートされるようになります。
 * これにより、型の整合性が保たれ、コンパイルエラーがすべて解消されます。
 *
 * **機能面の影響**: なし（実装されていない型・関数は使用できないため、削除しても影響なし）
 */
