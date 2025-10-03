// =====================================
// backend/src/types/common.ts
// アプリケーション共通型定義 - エラー修正完全版
// Phase 1-A-4完全改修版 + エラーログ対応
// 作成日時: 2025年9月27日18:30
// 最終更新: 2025年10月1日 - バリデーション型修正・Date型統一
// =====================================

// ⚠️ Phase 1-A-4 修正: AuthenticatedRequest再export追加
// auth.tsで定義されているAuthenticatedRequestを再export
export type { AuthenticatedRequest } from './auth';

// =====================================
// 📋 1. ページネーション関連型（既存完全保持・拡張）
// =====================================

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =====================================
// 📋 2. API レスポンス関連型（models/層統合対応）
// =====================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

// ✨ models/層で使用される統一リストメタデータ型
export interface ListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ✨ models/層統合: ApiListResponse完全実装版
export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  meta: ListMeta;
  message?: string;
  timestamp: string;
  // 🎯 models/層統合: 統計・集計情報サポート
  summary?: Record<string, any>;
  statistics?: Record<string, any>;
  analysis?: Record<string, any>;
}

// 既存互換性維持: PaginatedResponse型
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// =====================================
// 📋 3. 検索・フィルタリング関連型（models/層統合）
// =====================================

export interface SearchQuery {
  search?: string;
  filters?: Record<string, any>;
}

export interface SortOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ✨ models/層統合: 高度な検索機能サポート
export interface AdvancedSearchQuery extends SearchQuery {
  fields?: string[]; // 検索対象フィールド指定
  operator?: 'AND' | 'OR'; // 検索演算子
  fuzzy?: boolean; // あいまい検索
  caseSensitive?: boolean; // 大文字小文字区別
}

// =====================================
// 📋 4. 日付範囲関連型（既存保持・拡張）
// =====================================

export interface DateRange {
  startDate?: string | Date;
  endDate?: string | Date;
}

// ✨ models/層統合: 時間範囲検索サポート
export interface TimeRange extends DateRange {
  startTime?: string;
  endTime?: string;
  timezone?: string;
}

// =====================================
// 📋 5. 汎用的なID・タイムスタンプ関連型
// =====================================

export interface WithId {
  id: string;
}

export interface WithTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface WithSoftDelete extends WithTimestamps {
  deletedAt?: Date | null;
}

// =====================================
// 📋 6. 操作結果関連型（Phase 1基盤統合・ジェネリック化）
// =====================================

// ✨ Phase 1-A-4: OperationResultをジェネリック化（models/層統合）
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[]; // ✅ 修正: error → errors に統一
  warnings?: string[];
  metadata?: {
    duration?: number;
    timestamp: Date;
    operation: string;
  };
}

// ✨ models/層統合: 一括操作結果型
export interface BulkOperationResult<T = any> {
  success: boolean;
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    id: string;
    success: boolean;
    data?: T;
    error?: string;
  }>;
  errors?: ValidationError[];
  metadata?: {
    duration: number;
    timestamp: Date;
  };
}

// =====================================
// 📋 7. 統計・分析関連型（models/層統合）
// =====================================

// ✨ models/層統合: 統計情報基底インターフェース
export interface StatisticsBase {
  period: {
    start: Date;
    end: Date;
  };
  generatedAt: Date;
}

// ✨ models/層統合: 使用状況統計
export interface UsageStatistics extends StatisticsBase {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  utilizationRate: number;
  trends?: {
    date: string;
    count: number;
    change: number;
  }[];
}

// ✨ models/層統合: 位置情報統計（LocationModelで使用）
export interface LocationStatistics extends StatisticsBase {
  totalLocations: number;
  activeLocations: number;
  totalVisits: number; // ✅ 追加: LocationModelのエラー対応
  byType: Record<string, number>;
  topLocations: Array<{
    id: string;
    name: string;
    visitCount: number;
  }>;
}

// ✨ models/層統合: 車両統計（VehicleModelで使用）
export interface VehicleStatistics extends StatisticsBase {
  totalVehicles: number;
  activeVehicles: number;
  utilizationRate: number;
  byStatus: Record<string, number>;
  maintenanceScheduled: number;
  averageAge: number;
}

// =====================================
// 📋 8. 選択肢・オプション関連型（完全実装）
// =====================================

export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
  icon?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface SelectOptionGroup<T = string> {
  label: string;
  options: SelectOption<T>[];
  collapsible?: boolean;
  collapsed?: boolean;
}

// =====================================
// 📋 9. バリデーション関連型（完全実装 + エラー修正）
// =====================================

// ✅ 修正: ValidationErrorの構造を完全統一
export interface ValidationError {
  field: string; // ✅ 修正: field は必須（optional から required に変更）
  message: string;
  code?: string;
  value?: any;
  constraints?: Record<string, any>;
}

// ✅ 修正: ValidationResultに後方互換性を追加
export interface ValidationResult {
  valid: boolean;
  // ✅ 追加: 後方互換性のためのエイリアス（既存コードで isValid を使用）
  isValid?: boolean; // valid と同じ値を持つエイリアスプロパティ
  errors?: ValidationError[];
  warnings?: Array<{
    field: string;
    message: string;
  }>;
  metadata?: {
    validatedAt: Date;
    validator: string;
    duration: number;
  };
}

// ✅ 追加: ValidationResultヘルパー関数型定義
export type CreateValidationResult = (
  valid: boolean,
  errors?: ValidationError[],
  warnings?: Array<{ field: string; message: string }>
) => ValidationResult;

// ✨ ValidationResultヘルパー関数（後方互換性確保）
export const createValidationResult: CreateValidationResult = (valid, errors, warnings) => ({
  valid,
  isValid: valid, // ✅ isValid を valid と同期
  errors,
  warnings
});

export interface FieldValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'url' | 'date';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
  [fieldName: string]: FieldValidationRule;
}

// =====================================
// 📋 10. エラーハンドリング関連型（Phase 1基盤統合）
// =====================================

// ✨ Phase 1基盤統合: utils/errors.ts連携
export interface ErrorDetails {
  code: string;
  message: string;
  field?: string;
  value?: any;
  context?: Record<string, any>;
}

export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
  details?: ErrorDetails[];
  timestamp: string;
  requestId?: string;
}

// =====================================
// 📋 11. 汎用ユーティリティ型（完全実装）
// =====================================

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OmitTimestamps<T> = Omit<T, 'createdAt' | 'updatedAt'>;
export type OmitId<T> = Omit<T, 'id'>;
export type CreateInput<T> = OmitTimestamps<OmitId<T>>;
export type UpdateInput<T> = Partial<CreateInput<T>>;

// ✨ models/層統合: 高度なユーティリティ型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type NonNullable<T> = T extends null | undefined ? never : T;

// ✅ 追加: Date型の統一ユーティリティ型（Prismaとの整合性）
// Prismaは Date | null を使用するため、これを標準とする
export type DateNullable = Date | null;
export type DateOptional = Date | undefined;
export type DateFlexible = Date | null | undefined;

// ✨ Date型変換ヘルパー型
export type ToNullableDate<T> = T extends Date ? DateNullable : T;
export type ToOptionalDate<T> = T extends Date ? DateOptional : T;

// =====================================
// 📋 12. 並行処理・非同期関連型（Phase 1基盤統合）
// =====================================

// ✨ Phase 1基盤統合: utils/asyncHandler.ts連携
export interface AsyncOperationOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
}

export interface AsyncOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
  retryCount?: number;
}

// =====================================
// 📋 13. ファイル・アップロード関連型（完全実装）
// =====================================

export interface FileInfo {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  url?: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

export interface UploadResult {
  success: boolean;
  files: FileInfo[];
  errors?: Array<{
    filename: string;
    error: string;
  }>;
}

// =====================================
// 📋 14. ログ・監査関連型（Phase 1基盤統合）
// =====================================

// ✨ Phase 1基盤統合: models/AuditLogModel.ts連携
export interface AuditContext {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// =====================================
// 📋 15. 通知関連型（基盤実装）
// =====================================

export interface NotificationOptions {
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  recipientId?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

// =====================================
// 📋 16. GPS・位置関連基盤型（models/層統合）
// =====================================

// ✨ models/LocationModel.ts統合
export interface Coordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

export interface GpsPoint extends Coordinates {
  timestamp: Date;
  speed?: number;
  heading?: number;
}

export interface BoundingBox {
  northEast: Coordinates;
  southWest: Coordinates;
}

// =====================================
// 📋 17. システム設定関連型（models/層統合）
// =====================================

// ✨ models/SystemSettingModel.ts統合
export interface SystemSetting {
  key: string;
  value: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  category?: string;
  description?: string;
  isPublic: boolean;
  updatedAt: Date;
  updatedBy?: string;
}

export interface SettingsGroup {
  category: string;
  settings: SystemSetting[];
  description?: string;
}

// =====================================
// 📋 18. レポート・出力関連型（models/層統合）
// =====================================

export interface ReportOptions {
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
  dateRange?: DateRange;
  filters?: Record<string, any>;
  groupBy?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeCharts?: boolean;
  includeRawData?: boolean;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  filepath?: string;
  url?: string;
  format: string;
  size: number;
  recordCount: number;
  generatedAt: Date;
  expiresAt?: Date;
}

// =====================================
// 📋 19. フィルター拡張型（models/層統合・エラー対応）
// =====================================

// ✅ 追加: 各Modelで共通して使用されるFilter拡張プロパティ
export interface ExtendedFilterOptions {
  sortBy?: string; // ✅ NotificationFilter, MaintenanceFilter, ItemFilterで必要
  sortOrder?: 'asc' | 'desc'; // ✅ NotificationFilter, MaintenanceFilter, ItemFilterで必要
  page?: number; // ✅ MaintenanceFilter, ItemFilterで必要
  pageSize?: number; // ✅ MaintenanceFilter, ItemFilterで必要
}

// ✅ 追加: 統計拡張プロパティ（models/層で必要）
export interface ExtendedStatistics {
  summary?: Record<string, any>; // ✅ MaintenanceStatistics, ItemStatisticsで必要
  pagination?: ListMeta; // ✅ ItemListResponseで必要
}

// =====================================
// 📋 20. 型安全性強化ユーティリティ（新規追加）
// =====================================

// ✨ 型安全なキー抽出
export type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

// ✨ 必須プロパティのみ抽出
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

// ✨ オプショナルプロパティのみ抽出
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// ✅ 追加: Prisma互換の型変換ヘルパー
export type ToPrismaInput<T> = {
  [K in keyof T]: T[K] extends Date | undefined 
    ? Date | null 
    : T[K] extends Date 
    ? Date | null 
    : T[K];
};

// =====================================
// 📋 21. 後方互換性エイリアス（既存コード対応）
// =====================================

// ✅ 追加: middleware/validation.ts互換性
export interface FieldValidation {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

// ✅ ValidationError → FieldValidation 変換ヘルパー
export const toFieldValidation = (error: ValidationError): FieldValidation => ({
  field: error.field,
  message: error.message,
  value: error.value,
  constraint: error.code
});

// ✅ FieldValidation → ValidationError 変換ヘルパー
export const toValidationError = (field: FieldValidation): ValidationError => ({
  field: field.field,
  message: field.message,
  value: field.value,
  code: field.constraint
});

// =====================================
// エクスポート完全性チェック
// =====================================

/**
 * このファイルからエクスポートされるすべての型：
 * 
 * ✅ ページネーション: PaginationQuery, PaginationParams
 * ✅ APIレスポンス: ApiResponse, ListMeta, ApiListResponse, PaginatedResponse
 * ✅ 検索: SearchQuery, SortOptions, AdvancedSearchQuery
 * ✅ 日付: DateRange, TimeRange, DateNullable, DateOptional, DateFlexible
 * ✅ 基本: WithId, WithTimestamps, WithSoftDelete
 * ✅ 操作結果: OperationResult, BulkOperationResult
 * ✅ 統計: StatisticsBase, UsageStatistics, LocationStatistics, VehicleStatistics
 * ✅ 選択肢: SelectOption, SelectOptionGroup
 * ✅ バリデーション: ValidationError, ValidationResult, FieldValidationRule, ValidationSchema
 * ✅ エラー: ErrorDetails, ApiError
 * ✅ ユーティリティ型: PartialBy, RequiredBy, OmitTimestamps, OmitId, CreateInput, UpdateInput
 * ✅ 高度なユーティリティ: DeepPartial, KeysOfType, NonNullable
 * ✅ 非同期: AsyncOperationOptions, AsyncOperationResult
 * ✅ ファイル: FileInfo, UploadResult
 * ✅ 監査: AuditContext, ActivityLog
 * ✅ 通知: NotificationOptions
 * ✅ GPS: Coordinates, GpsPoint, BoundingBox
 * ✅ システム: SystemSetting, SettingsGroup
 * ✅ レポート: ReportOptions, ExportResult
 * ✅ 拡張: ExtendedFilterOptions, ExtendedStatistics
 * ✅ 型安全性: KeysMatching, RequiredKeys, OptionalKeys, ToPrismaInput
 * ✅ 互換性: FieldValidation, toFieldValidation, toValidationError
 * ✅ ヘルパー: createValidationResult, ToNullableDate, ToOptionalDate
 */