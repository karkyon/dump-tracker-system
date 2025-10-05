// =====================================
// backend/src/types/report.ts
// レポート関連型定義 - 完全統合版
// 配置: types/ - 型定義集約層
// 作成日時: 2025年10月5日
// 最終更新: 2025年10月5日
// =====================================

// Prisma生成型のインポート
import {
  Report as PrismaReport,
  ReportType as PrismaReportType,
  ReportFormat as PrismaReportFormat,
  ReportGenerationStatus,
  Prisma,
  UserRole
} from '@prisma/client';

// Enum値をエクスポート（値として使用可能）
export {
  ReportType,
  ReportFormat,
  ReportGenerationStatus
} from '@prisma/client';

// 共通型のインポート
import type {
  ApiResponse,
  ApiListResponse,
  PaginationQuery,
  SearchQuery,
  DateRange,
  TimeRange
} from './common';

// 他のエンティティ型のインポート
import type {
  OperationResponseDTO,
  VehicleResponseDTO,
  InspectionRecordResponseDTO,
  UserResponseDTO
} from './index';

// =====================================
// 1. 基本レポート型定義
// =====================================

/**
 * レポート基本情報
 */
export interface ReportInfo extends PrismaReport {
  user?: UserResponseDTO;
}

/**
 * レポート作成リクエスト
 */
export interface CreateReportRequest {
  reportType: PrismaReportType;
  format: PrismaReportFormat;
  title: string;
  description?: string;
  parameters?: Record<string, any>;
  startDate?: Date | string;
  endDate?: Date | string;
  tags?: string[];
  isPublic?: boolean;
  sharedWith?: string[];
}

/**
 * レポート更新リクエスト
 */
export interface UpdateReportRequest {
  title?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  sharedWith?: string[];
}

/**
 * レポートレスポンスDTO
 */
export interface ReportResponseDTO extends ReportInfo {
  _count?: {
    [key: string]: number;
  };
}

/**
 * レポート一覧レスポンス
 */
export interface ReportListResponse {
  data: ReportResponseDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =====================================
// 2. レポート生成パラメータ型定義
// =====================================

/**
 * 日次運行レポートパラメータ
 */
export interface DailyOperationReportParams {
  date: Date | string;
  driverId?: string;
  vehicleId?: string;
  format?: PrismaReportFormat;
  includeStatistics?: boolean;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * 月次運行レポートパラメータ
 */
export interface MonthlyOperationReportParams {
  year: number;
  month: number;
  driverId?: string;
  vehicleId?: string;
  format?: PrismaReportFormat;
  includeStatistics?: boolean;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * 車両稼働レポートパラメータ
 */
export interface VehicleUtilizationReportParams {
  startDate?: Date | string;
  endDate?: Date | string;
  vehicleIds?: string[];
  format?: PrismaReportFormat;
  groupBy?: 'DAY' | 'WEEK' | 'MONTH';
  includeMaintenanceRecords?: boolean;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * 点検サマリーレポートパラメータ
 */
export interface InspectionSummaryReportParams {
  startDate?: Date | string;
  endDate?: Date | string;
  vehicleIds?: string[];
  inspectionTypes?: string[];
  format?: PrismaReportFormat;
  groupBy?: 'VEHICLE' | 'TYPE' | 'DATE';
  includeFailedItems?: boolean;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * 輸送サマリーレポートパラメータ
 */
export interface TransportationSummaryReportParams {
  startDate?: Date | string;
  endDate?: Date | string;
  driverIds?: string[];
  vehicleIds?: string[];
  itemIds?: string[];
  locationIds?: string[];
  format?: PrismaReportFormat;
  groupBy?: 'DRIVER' | 'VEHICLE' | 'ITEM' | 'LOCATION' | 'DATE';
  includeGpsData?: boolean;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * カスタムレポートパラメータ
 */
export interface CustomReportParams {
  title: string;
  description?: string;
  queries: CustomReportQuery[];
  format?: PrismaReportFormat;
  groupBy?: string;
  orderBy?: string;
  limit?: number;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * カスタムレポートクエリ
 */
export interface CustomReportQuery {
  entity: 'operation' | 'vehicle' | 'inspection' | 'user' | 'item' | 'location';
  fields: string[];
  filters?: Record<string, any>;
  aggregations?: {
    field: string;
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  }[];
}

/**
 * 総合ダッシュボードパラメータ
 */
export interface ComprehensiveDashboardParams {
  startDate?: Date | string;
  endDate?: Date | string;
  metrics?: string[];
  vehicleIds?: string[];
  driverIds?: string[];
  includeCharts?: boolean;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * KPI分析パラメータ
 */
export interface KPIAnalysisParams {
  startDate?: Date | string;
  endDate?: Date | string;
  kpiMetrics?: string[];
  comparisonPeriod?: 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR' | 'CUSTOM';
  customComparisonStart?: Date | string;
  customComparisonEnd?: Date | string;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * 予測分析パラメータ
 */
export interface PredictiveAnalyticsParams {
  targetMetric: string;
  historicalPeriodMonths?: number;
  forecastPeriodMonths?: number;
  confidenceLevel?: number;
  includeSeasonality?: boolean;
  vehicleIds?: string[];
  requesterId: string;
  requesterRole: UserRole;
}

// =====================================
// 3. レポート生成結果型定義
// =====================================

/**
 * レポート生成結果
 */
export interface ReportGenerationResult {
  reportId: string;
  reportType: PrismaReportType;
  format: PrismaReportFormat;
  status: ReportGenerationStatus;
  title: string;
  description?: string;
  filePath?: string;
  fileSize?: number;
  resultData?: Record<string, any>;
  generatedAt?: Date;
  generatedBy: string;
  expiresAt?: Date;
  downloadUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * レポート統計情報
 */
export interface ReportStatistics {
  totalReports: number;
  reportsByType: Record<PrismaReportType, number>;
  reportsByFormat: Record<PrismaReportFormat, number>;
  reportsByStatus: Record<ReportGenerationStatus, number>;
  averageGenerationTime?: number;
  totalFileSize?: number;
  recentReports?: ReportResponseDTO[];
}

// =====================================
// 4. レポートフィルター・検索型定義
// =====================================

/**
 * レポートフィルター
 */
export interface ReportFilter extends PaginationQuery, SearchQuery, DateRange {
  reportType?: PrismaReportType | PrismaReportType[];
  format?: PrismaReportFormat | PrismaReportFormat[];
  status?: ReportGenerationStatus | ReportGenerationStatus[];
  generatedBy?: string;
  tags?: string[];
  isPublic?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * レポート検索クエリ
 */
export interface ReportSearchQuery extends SearchQuery {
  title?: string;
  description?: string;
  tags?: string[];
}

// =====================================
// 5. レポートデータ型定義
// =====================================

/**
 * 日次運行レポートデータ
 */
export interface DailyOperationReportData {
  date: string;
  driver?: UserResponseDTO;
  vehicle?: VehicleResponseDTO;
  operations: OperationResponseDTO[];
  statistics: {
    totalTrips: number;
    totalDistance: number;
    totalDuration: number;
    totalQuantity: number;
    averageSpeed?: number;
    fuelConsumption?: number;
  };
  timeline?: {
    time: string;
    activity: string;
    location?: string;
  }[];
}

/**
 * 月次運行レポートデータ
 */
export interface MonthlyOperationReportData {
  year: number;
  month: number;
  driver?: UserResponseDTO;
  vehicle?: VehicleResponseDTO;
  operations: OperationResponseDTO[];
  statistics: {
    totalDays: number;
    totalTrips: number;
    totalDistance: number;
    totalDuration: number;
    totalQuantity: number;
    averageTripsPerDay: number;
    averageDistancePerDay: number;
    fuelConsumption?: number;
    maintenanceCosts?: number;
  };
  dailyBreakdown?: {
    date: string;
    trips: number;
    distance: number;
    duration: number;
  }[];
}

/**
 * 車両稼働レポートデータ
 */
export interface VehicleUtilizationReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  vehicles: {
    vehicle: VehicleResponseDTO;
    utilizationRate: number;
    totalDistance: number;
    totalDuration: number;
    totalTrips: number;
    averageSpeed?: number;
    fuelEfficiency?: number;
    maintenanceRecords?: number;
  }[];
  overallStatistics: {
    totalVehicles: number;
    averageUtilization: number;
    mostUtilizedVehicle?: VehicleResponseDTO;
    leastUtilizedVehicle?: VehicleResponseDTO;
  };
}

/**
 * 点検サマリーレポートデータ
 */
export interface InspectionSummaryReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  inspections: InspectionRecordResponseDTO[];
  statistics: {
    totalInspections: number;
    passedInspections: number;
    failedInspections: number;
    passRate: number;
    byType?: Record<string, number>;
    byVehicle?: Record<string, number>;
  };
  failedItems?: {
    item: string;
    count: number;
    vehicles: string[];
  }[];
}

/**
 * 輸送サマリーレポートデータ
 */
export interface TransportationSummaryReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  statistics: {
    totalQuantity: number;
    totalTrips: number;
    totalDistance: number;
    totalDuration: number;
    byDriver?: Record<string, number>;
    byVehicle?: Record<string, number>;
    byItem?: Record<string, number>;
    byLocation?: Record<string, number>;
  };
  topPerformers?: {
    drivers?: UserResponseDTO[];
    vehicles?: VehicleResponseDTO[];
  };
}

/**
 * 総合ダッシュボードデータ
 */
export interface ComprehensiveDashboardData {
  period: {
    startDate: string;
    endDate: string;
  };
  kpis: {
    totalRevenue?: number;
    totalCosts?: number;
    totalProfit?: number;
    totalTrips: number;
    totalDistance: number;
    totalQuantity: number;
    averageUtilization: number;
    customerSatisfaction?: number;
  };
  charts?: {
    [key: string]: any;
  };
  alerts?: {
    type: 'warning' | 'error' | 'info';
    message: string;
    severity: 'high' | 'medium' | 'low';
  }[];
}

/**
 * KPI分析データ
 */
export interface KPIAnalysisData {
  period: {
    startDate: string;
    endDate: string;
  };
  currentPeriod: Record<string, number>;
  comparisonPeriod?: Record<string, number>;
  changes?: Record<string, {
    absolute: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  recommendations?: string[];
}

/**
 * 予測分析データ
 */
export interface PredictiveAnalyticsData {
  targetMetric: string;
  historical: {
    date: string;
    value: number;
  }[];
  forecast: {
    date: string;
    predicted: number;
    confidenceLower?: number;
    confidenceUpper?: number;
  }[];
  accuracy?: {
    rmse?: number;
    mape?: number;
    r2?: number;
  };
  insights?: string[];
}

// =====================================
// 6. レポートアクセス制御型定義
// =====================================

/**
 * レポートアクセス権限
 */
export interface ReportAccessControl {
  reportId: string;
  isPublic: boolean;
  owner: string;
  sharedWith: string[];
  canView: (userId: string, userRole: UserRole) => boolean;
  canEdit: (userId: string, userRole: UserRole) => boolean;
  canDelete: (userId: string, userRole: UserRole) => boolean;
}

// =====================================
// 7. レポートエクスポート型定義
// =====================================

/**
 * レポートエクスポートオプション
 */
export interface ReportExportOptions {
  format: PrismaReportFormat;
  includeCharts?: boolean;
  includeRawData?: boolean;
  compression?: boolean;
  password?: string;
  watermark?: string;
}

/**
 * レポートエクスポート結果
 */
export interface ReportExportResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  downloadUrl?: string;
  expiresAt?: Date;
  error?: string;
}

// =====================================
// 8. 型ガード・ユーティリティ型
// =====================================

/**
 * レポートタイプ判定
 */
export function isValidReportType(type: string): type is PrismaReportType {
  return Object.values(PrismaReportType).includes(type as PrismaReportType);
}

/**
 * レポートフォーマット判定
 */
export function isValidReportFormat(format: string): format is PrismaReportFormat {
  return Object.values(PrismaReportFormat).includes(format as PrismaReportFormat);
}

/**
 * レポート生成ステータス判定
 */
export function isValidReportStatus(status: string): status is ReportGenerationStatus {
  return Object.values(ReportGenerationStatus).includes(status as ReportGenerationStatus);
}

/**
 * レポート完了判定
 */
export function isReportCompleted(report: ReportInfo): boolean {
  return report.status === ReportGenerationStatus.COMPLETED;
}

/**
 * レポート失敗判定
 */
export function isReportFailed(report: ReportInfo): boolean {
  return report.status === ReportGenerationStatus.FAILED;
}

/**
 * レポート処理中判定
 */
export function isReportProcessing(report: ReportInfo): boolean {
  return report.status === ReportGenerationStatus.PROCESSING;
}

// =====================================
// 9. レポートテンプレート型定義
// =====================================

/**
 * レポートテンプレート
 */
export interface ReportTemplate {
  id: string;
  name: string;
  reportType: PrismaReportType;
  description?: string;
  defaultFormat: PrismaReportFormat;
  requiredParameters: string[];
  optionalParameters?: string[];
  supportedRoles: UserRole[];
  exampleParameters?: Record<string, any>;
}

// =====================================
// 10. Prisma型定義のエイリアス
// =====================================

export type ReportModel = PrismaReport;
export type ReportCreateInput = Prisma.ReportCreateInput;
export type ReportUpdateInput = Prisma.ReportUpdateInput;
export type ReportWhereInput = Prisma.ReportWhereInput;
export type ReportWhereUniqueInput = Prisma.ReportWhereUniqueInput;
export type ReportOrderByInput = Prisma.ReportOrderByWithRelationInput;

// =====================================
// ✅ types/report.ts 完全実装完了
// =====================================
