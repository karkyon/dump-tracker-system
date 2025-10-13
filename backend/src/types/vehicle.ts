// =====================================
// backend/src/types/vehicle.ts
// 車両関連型定義 - Phase 1-A-2 完全修正版（既存機能100%保持）
// 配置: types/ - 型定義集約層（アーキテクチャ指針準拠）
// Phase 1-A-2: Enum import修正・削除型定義の完全復元
// 作成日時: 2025年9月26日
// 最終更新: 2025年9月30日
// =====================================

// ✨ Phase 1完成基盤との統合
import type {
  ApiResponse,
  ApiListResponse,
  PaginationQuery,
  SearchQuery,
  BulkOperationResult,
  VehicleStatistics as BaseVehicleStatistics,
  TimeRange,
  OperationResult,
  DateRange
} from './common';

// ✨ Prisma型定義との統合
// 🔧 Phase 1-A-2修正: import type → import に変更（Enumは値として使用されるため）
import { VehicleStatus, FuelType, UserRole } from '@prisma/client';

import type {
  Operation as OperationModel,
  MaintenanceRecord as MaintenanceRecordModel,
  GpsLog as GpsLogModel
} from '@prisma/client';

// =====================================
// 🚗 1. 基本車両情報型（既存保持・models/統合）
// =====================================

/**
 * 車両基本情報
 */
export interface VehicleInfo {
  id: string;
  plateNumber: string;
  model: string;
  manufacturer: string;
  year?: number;
  capacity?: number;
  fuelType?: FuelType;
  status: VehicleStatus;
  assignedDriverId?: string;
  currentMileage?: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 車両詳細情報（models/VehicleModel統合）
 */
export interface VehicleWithDetails extends VehicleInfo {
  assignedDriver?: {
    id: string;
    name?: string;
    email: string;
    role: UserRole;
    licenseNumber?: string;
    licenseExpiration?: Date;
  };
  isActive: VehicleInfo['isActive']; // ✅ 追加: VehicleWithDetailsに必須
  recentOperations?: OperationModel[];
  maintenanceHistory?: MaintenanceRecordModel[];
  gpsLogs?: GpsLogModel[];
  statistics?: VehicleStatistics;
  availability?: VehicleAvailability;
  fuelRecords?: VehicleFuelRecord[];
  costAnalysis?: VehicleCostAnalysis;
  specifications?: VehicleSpecifications;
  insurance?: VehicleInsurance;
  tags?: string[];
  metadata?: Record<string, any>;
}

// =====================================
// 🚗 2. リクエスト・レスポンス型（models/統合強化）
// =====================================

/**
 * 車両作成リクエスト
 */
export interface CreateVehicleRequest {
  plateNumber: string;
  model: string;
  manufacturer: string;
  year?: number;
  capacity?: number;
  fuelType?: FuelType;
  assignedDriverId?: string;
  currentMileage?: number;
  notes?: string;
  specifications?: VehicleSpecifications;
  insurance?: VehicleInsurance;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * 車両更新リクエスト
 */
export interface UpdateVehicleRequest extends Partial<CreateVehicleRequest> {
  status?: VehicleStatus;
  isActive?: boolean;
}

/**
 * 車両レスポンスDTO（models/VehicleModel統合）
 * 🔧 Phase 1-A-2修正: createdAt/updatedAtをDate型に統一
 */
export interface VehicleResponseDTO {
  id: string;
  plateNumber: string;
  model: string;
  manufacturer: string;
  year?: number;
  capacity?: number;
  fuelType?: FuelType;
  status: VehicleStatus;
  assignedDriverId?: string;
  currentMileage?: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;  // 🔧 修正: Date型に統一
  updatedAt: Date;  // 🔧 修正: Date型に統一

  assignedDriver?: {
    id: string;
    name?: string;
    email: string;
    role: UserRole;
  };
  operationCount?: number;
  lastOperationDate?: Date;
  nextMaintenanceDate?: Date;
  maintenanceStatus?: 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE';
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
    address?: string;
  };
  utilizationRate?: number;
  fuelEfficiency?: number;
}

/**
 * 車両リストレスポンス
 */
export interface VehicleListResponse extends ApiListResponse<VehicleResponseDTO> {
  data: VehicleResponseDTO[];
}

// =====================================
// 🚗 3. Prisma型エイリアス（models/VehicleModel.ts用）
// 🔧 Phase 1-A-2追加: 削除してしまったPrisma型のエイリアス
// =====================================

/**
 * 車両作成入力（Prisma用）
 * models/VehicleModel.tsからexportされる
 */
export type VehicleCreateInput = CreateVehicleRequest;

/**
 * 車両更新入力（Prisma用）
 * models/VehicleModel.tsからexportされる
 */
export type VehicleUpdateInput = UpdateVehicleRequest;

// =====================================
// 🚗 4. 検索・フィルター型
// =====================================

/**
 * 車両フィルター
 */
export interface VehicleFilter {
  status?: VehicleStatus | VehicleStatus[];
  fuelType?: FuelType | FuelType[];
  assignedDriverId?: string;
  manufacturer?: string;
  yearFrom?: number;
  yearTo?: number;
  capacityMin?: number;
  capacityMax?: number;
  mileageMin?: number;
  mileageMax?: number;
  isActive?: boolean;
  hasAssignedDriver?: boolean;
  maintenanceStatus?: 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE';
  tags?: string[];
  createdFrom?: Date;
  createdTo?: Date;
  location?: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
}

/**
 * 車両検索クエリ
 */
export interface VehicleSearchQuery extends SearchQuery {
  filter?: VehicleFilter;
  includeStatistics?: boolean;
  includeOperations?: boolean;
  includeMaintenance?: boolean;
  includeDriver?: boolean;
  includeLocation?: boolean;
}

// =====================================
// 🚗 5. 統計・分析型
// =====================================

/**
 * 車両統計（詳細版）
 */
export interface VehicleStatistics {
  totalOperations: number;
  completedOperations: number;    // ✅ 追加
  ongoingOperations: number;      // ✅ 追加
  totalDistance: number;
  averageDistance: number;
  totalOperationTime: number;
  averageOperationTime: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  averageFuelEfficiency: number;
  fuelCostPerKm: number;
  operationDays: number;
  utilizationRate: number;
  availabilityRate: number;
  maintenanceCount: number;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  maintenanceCost: number;
  downtime: number;
  costPerKm: number;
  revenuePerKm?: number;
  profitMargin?: number;
  co2Emissions?: number;
  safetyScore?: number;
  periodStats?: {
    daily: VehicleDailyStats[];
    weekly: VehicleWeeklyStats[];
    monthly: VehicleMonthlyStats[];
  };
}

/**
 * 日別車両統計
 */
export interface VehicleDailyStats {
  date: Date;
  distance: number;
  fuelConsumed: number;
  operationCount: number;
  utilizationHours: number;
  revenue?: number;
  cost?: number;
}

/**
 * 週別車両統計
 */
export interface VehicleWeeklyStats {
  weekStart: Date;
  weekEnd: Date;
  totalDistance: number;
  totalFuel: number;
  operationCount: number;
  averageUtilization: number;
  maintenanceEvents: number;
}

/**
 * 月別車両統計
 */
export interface VehicleMonthlyStats {
  year: number;
  month: number;
  totalDistance: number;
  totalFuel: number;
  operationCount: number;
  averageUtilization: number;
  maintenanceCost: number;
  fuelCost: number;
  revenue?: number;
}

/**
 * フリート統計
 */
export interface FleetStatistics {
  totalVehicles: number;
  activeVehicles: number;
  utilizationRate: number;
  averageFuelEfficiency: number;
  totalDistance: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalRevenue?: number;
  operationalVehicles: number;
  maintenanceVehicles: number;
  retiredVehicles: number;
  totalFleetValue?: number;
}

// =====================================
// 🚗 6. 車両ステータス・可用性型
// 🔧 Phase 1-A-2追加: 削除してしまったVehicleStatusUpdateRequest
// =====================================

/**
 * 車両ステータス更新リクエスト
 * 🔧 既存コード（vehicleService.ts/vehicleController.ts）で使用
 */
export interface VehicleStatusUpdateRequest {
  status: VehicleStatus;
  reason?: string;
  scheduledDate?: Date;
  estimatedDuration?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTechnician?: string;
  estimatedCost?: number;
  notes?: string;
  notifyDriver?: boolean;
  notifyManager?: boolean;
}

/**
 * 車両ステータス変更リクエスト（エイリアス）
 */
export interface VehicleStatusChangeRequest extends VehicleStatusUpdateRequest {}

/**
 * 車両可用性
 */
export interface VehicleAvailability {
  isAvailable: boolean;
  currentStatus: VehicleStatus;
  nextAvailableTime?: Date;
  restrictionReason?: string;
  scheduledMaintenance?: Date;
  estimatedDowntime?: number;
  canAssignDriver: boolean;
  canStartOperation: boolean;
}

// =====================================
// 🚗 7. 車両割り当て型
// 🔧 Phase 1-A-2追加: 削除してしまったVehicleAssignmentRequest
// =====================================

/**
 * 車両割り当てリクエスト
 * 🔧 vehicleService.ts/vehicleController.tsで使用
 */
export interface VehicleAssignmentRequest {
  driverId: string;
  scheduleDate?: Date;
  scheduledEndDate?: Date;
  assignmentType?: 'PERMANENT' | 'TEMPORARY' | 'SCHEDULED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  notes?: string;
  notifyDriver?: boolean;
  notifyManager?: boolean;
  validateDriverLicense?: boolean;
  checkConflicts?: boolean;
}

// =====================================
// 🚗 8. メンテナンス関連型
// 🔧 Phase 1-A-2追加: 削除してしまったVehicleMaintenanceRequest
// =====================================

/**
 * 車両メンテナンスリクエスト
 * 🔧 vehicleService.tsで使用（VehicleMaintenanceScheduleとは別物）
 */
export interface VehicleMaintenanceRequest {
  vehicleId: string;
  maintenanceType: 'ROUTINE' | 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION' | 'EMERGENCY';
  scheduledDate: Date;
  estimatedDuration?: number;
  estimatedCost?: number;
  description: string;
  maintenanceItems?: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedMechanic?: string;
  assignedTechnician?: string;
  facilityLocation?: string;
  parts?: string[];
  notes?: string;
  notifyDriver?: boolean;
  notifyManager?: boolean;
  createWorkOrder?: boolean;
}

/**
 * メンテナンススケジュール
 */
export interface VehicleMaintenanceSchedule {
  vehicleId: string;
  scheduleId?: string;
  nextMaintenanceDate: Date;
  maintenanceType: 'ROUTINE' | 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION' | 'EMERGENCY';
  maintenanceItems: string[];
  estimatedCost?: number;
  estimatedDuration?: number;
  recurring?: {
    interval: number;
    mileageInterval?: number;
    lastPerformed?: Date;
  };
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTechnician?: string;
  facilityLocation?: string;
  notes?: string;
  reminders?: {
    email: boolean;
    sms: boolean;
    daysBeforeNotification: number[];
  };
  scheduledBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * メンテナンス履歴サマリー
 */
export interface VehicleMaintenanceSummary {
  vehicleId: string;
  totalMaintenanceCount: number;
  totalMaintenanceCost: number;
  lastMaintenanceDate?: Date;
  averageMaintenanceInterval: number;
  averageMaintenanceCost: number;
  upcomingMaintenance?: VehicleMaintenanceSchedule[];
  overdueMaintenanceCount: number;
  maintenanceByType: Record<string, {
    count: number;
    totalCost: number;
    averageCost: number;
    lastPerformed?: Date;
    averageInterval?: number;
  }>;
  maintenanceTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  costEfficiency: number;
  recommendedActions: string[];
}

// =====================================
// 🚗 9. 燃料・コスト関連型
// =====================================

/**
 * 燃料記録
 */
export interface VehicleFuelRecord {
  id: string;
  vehicleId: string;
  operationId?: string;
  fuelAmount: number;
  fuelCost: number;
  pricePerLiter: number;
  fuelType: FuelType;
  odometer?: number;
  fuelStation?: string;
  fuelStationLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  efficiency?: number;
  recordedAt: Date;
  recordedBy: string;
  receiptNumber?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'CORPORATE_ACCOUNT';
  notes?: string;
  attachments?: string[];
}

/**
 * 燃料効率分析
 */
export interface FuelEfficiencyAnalysis {
  vehicleId: string;
  period: TimeRange;
  averageEfficiency: number;
  bestEfficiency: number;
  worstEfficiency: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  totalFuelConsumed: number;
  totalCost: number;
  costPerKm: number;
  recommendations?: string[];
}

/**
 * コスト分析
 */
export interface VehicleCostAnalysis {
  vehicleId: string;
  period: TimeRange;
  fuelCost: number;
  maintenanceCost: number;
  insuranceCost: number;
  registrationCost: number;
  depreciationCost: number;
  otherCosts: number;
  totalCost: number;
  costPerKm: number;
  costPerDay: number;
  revenue?: number;
  profit?: number;
  roi?: number;
}

// =====================================
// 🚗 10. 車両仕様・保険型
// =====================================

/**
 * 車両仕様
 */
export interface VehicleSpecifications {
  engineCapacity?: number;
  horsepower?: number;
  torque?: number;
  transmission?: 'MANUAL' | 'AUTOMATIC' | 'CVT';
  driveType?: '2WD' | '4WD' | 'AWD';
  fuelTankCapacity?: number;
  loadCapacity?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    wheelbase: number;
  };
  weight?: {
    curb: number;
    gross: number;
  };
  tireSize?: string;
  color?: string;
  vin?: string;
}

/**
 * 車両保険
 */
export interface VehicleInsurance {
  provider: string;
  policyNumber: string;
  startDate: Date;
  endDate: Date;
  premium: number;
  coverage: {
    liability?: number;
    collision?: number;
    comprehensive?: number;
    uninsured?: number;
  };
  deductible?: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
}

// =====================================
// 🚗 11. レポート・分析型
// 🔧 Phase 1-A-2追加: 削除してしまった高度な分析型
// =====================================

/**
 * 車両稼働率レポート
 * 🔧 vehicleService.tsで使用
 */
export interface VehicleUtilizationReport {
  vehicleId: string;
  vehicle: VehicleResponseDTO;
  period: DateRange;
  totalOperationTime: number;
  totalAvailableTime: number;
  utilizationRate: number;
  dailyUtilization: Array<{
    date: Date;
    operationTime: number;
    utilizationRate: number;
  }>;
  peakUsageHours: Array<{
    hour: number;
    operationCount: number;
  }>;
  downtimeAnalysis: {
    totalDowntime: number;
    maintenanceDowntime: number;
    unscheduledDowntime: number;
    reasons: Array<{
      reason: string;
      duration: number;
      count: number;
    }>;
  };
  recommendations: string[];
  comparisonToFleetAverage: number;
}

/**
 * 車両パフォーマンス指標
 * 🔧 vehicleService.tsで使用
 */
export interface VehiclePerformanceMetrics {
  vehicleId: string;
  vehicle: VehicleResponseDTO;
  period: DateRange;
  efficiency: {
    fuelEfficiency: number;
    fuelEfficiencyTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    distancePerOperation: number;
    timePerOperation: number;
  };
  reliability: {
    breakdownCount: number;
    maintenanceFrequency: number;
    averageRepairTime: number;
    reliabilityScore: number;
  };
  cost: {
    totalOperatingCost: number;
    costPerKm: number;
    costPerHour: number;
    fuelCostRatio: number;
    maintenanceCostRatio: number;
  };
  productivity: {
    totalDistance: number;
    totalOperations: number;
    averageLoadUtilization: number;
    revenuePerKm?: number;
  };
  safety: {
    accidentCount: number;
    inspectionFailures: number;
    safetyScore: number;
  };
  comparison: {
    fleetAverage: {
      efficiency: number;
      cost: number;
      reliability: number;
    };
    ranking: number;
    percentile: number;
  };
  recommendations: string[];
}

/**
 * フリート最適化レポート
 * 🔧 vehicleService.tsで使用
 */
export interface FleetOptimizationReport {
  period: DateRange;
  summary: {
    totalVehicles: number;
    activeVehicles: number;
    underutilizedVehicles: number;
    overutilizedVehicles: number;
    fleetUtilizationRate: number;
  };
  vehicles: Array<{
    vehicle: VehicleResponseDTO;
    utilizationRate: number;
    efficiency: number;
    costPerKm: number;
    status: 'OPTIMAL' | 'UNDERUTILIZED' | 'OVERUTILIZED' | 'INEFFICIENT';
    recommendations: string[];
  }>;
  optimization: {
    potentialCostSavings: number;
    recommendedRetirements: string[];
    recommendedAcquisitions: number;
    redistributionSuggestions: Array<{
      vehicleId: string;
      currentUsage: string;
      suggestedUsage: string;
      expectedImprovement: number;
    }>;
  };
  financialImpact: {
    currentTotalCost: number;
    optimizedTotalCost: number;
    projectedSavings: number;
    roi: number;
  };
  generatedAt: Date;
  generatedBy: string;
}

/**
 * 予防保全アラート
 * 🔧 vehicleService.tsで使用
 */
export interface PredictiveMaintenanceAlert {
  id: string;
  vehicleId: string;
  vehicle: VehicleResponseDTO;
  alertType: 'PREVENTIVE' | 'PREDICTIVE' | 'URGENT' | 'WARNING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  component: string;
  predictedFailureDate?: Date;
  confidenceLevel: number;
  indicators: Array<{
    name: string;
    currentValue: number;
    thresholdValue: number;
    trend: 'NORMAL' | 'DEGRADING' | 'CRITICAL';
  }>;
  recommendedActions: Array<{
    action: string;
    priority: number;
    estimatedCost?: number;
    estimatedDuration?: number;
  }>;
  potentialImpact: {
    downtime: number;
    cost: number;
    safetyRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/**
 * 車両効率分析
 * 🔧 vehicleService.tsで使用
 */
export interface VehicleEfficiencyAnalysis {
  vehicleId: string;
  vehicle: VehicleResponseDTO;
  period: DateRange;
  fuelEfficiency: {
    current: number;
    historical: Array<{
      period: string;
      value: number;
    }>;
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    comparison: {
      fleetAverage: number;
      industryBenchmark: number;
      modelAverage: number;
    };
  };
  operationalEfficiency: {
    averageSpeedCompliance: number;
    idleTimeRatio: number;
    routeEfficiency: number;
    loadFactorOptimization: number;
  };
  maintenanceEfficiency: {
    plannedMaintenanceRatio: number;
    unplannedBreakdownRatio: number;
    maintenanceTimeliness: number;
  };
  driverBehavior: {
    averageDriverScore: number;
    fuelEfficientDrivingScore: number;
    safetyComplianceScore: number;
  };
  recommendations: Array<{
    category: string;
    recommendation: string;
    expectedImprovement: number;
    implementationCost?: number;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  generatedAt: Date;
}

/**
 * フリート比較レポート
 * 🔧 vehicleService.tsで使用
 */
export interface FleetComparisonReport {
  period: DateRange;
  vehicles: VehicleResponseDTO[];
  metrics: {
    utilization: Array<{
      vehicleId: string;
      value: number;
      rank: number;
    }>;
    fuelEfficiency: Array<{
      vehicleId: string;
      value: number;
      rank: number;
    }>;
    cost: Array<{
      vehicleId: string;
      value: number;
      rank: number;
    }>;
    reliability: Array<{
      vehicleId: string;
      value: number;
      rank: number;
    }>;
    revenue: Array<{
      vehicleId: string;
      value: number;
      rank: number;
    }>;
  };
  topPerformers: {
    utilization: VehicleResponseDTO[];
    efficiency: VehicleResponseDTO[];
    costEffectiveness: VehicleResponseDTO[];
    reliability: VehicleResponseDTO[];
  };
  underperformers: {
    utilization: VehicleResponseDTO[];
    efficiency: VehicleResponseDTO[];
    costEffectiveness: VehicleResponseDTO[];
    reliability: VehicleResponseDTO[];
  };
  insights: Array<{
    category: string;
    insight: string;
    affectedVehicles: string[];
    recommendedAction: string;
  }>;
  generatedAt: Date;
  generatedBy: string;
}

// =====================================
// 🚗 12. 比較・レポート型
// =====================================

/**
 * 車両比較
 */
export interface VehicleComparison {
  vehicles: VehicleResponseDTO[];
  metrics: {
    utilizationRate: number[];
    fuelEfficiency: number[];
    maintenanceCost: number[];
    totalCost: number[];
    revenue?: number[];
    profitMargin?: number[];
  };
  rankings: {
    byUtilization: string[];
    byEfficiency: string[];
    byCost: string[];
    byRevenue?: string[];
  };
  recommendations?: {
    vehicleId: string;
    recommendation: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
}

/**
 * 車両レポート設定
 */
export interface VehicleReportConfig {
  title: string;
  vehicleIds?: string[];
  dateRange: {
    from: Date;
    to: Date;
  };
  includeStatistics: boolean;
  includeMaintenance: boolean;
  includeFuelRecords: boolean;
  includeOperations: boolean;
  includeCostAnalysis: boolean;
  includeComparison: boolean;
  groupBy?: 'vehicle' | 'driver' | 'status' | 'fuelType' | 'date' | 'month';
  sortBy?: 'distance' | 'fuel' | 'cost' | 'utilization' | 'efficiency';
  format: 'PDF' | 'CSV' | 'EXCEL' | 'JSON';
  charts: {
    utilizationChart: boolean;
    fuelEfficiencyChart: boolean;
    costAnalysisChart: boolean;
    maintenanceChart: boolean;
  };
  filters: VehicleFilter;
}

/**
 * 車両レポートデータ
 */
export interface VehicleReportData {
  config: VehicleReportConfig;
  summary: {
    totalVehicles: number;
    reportPeriod: string;
    totalDistance: number;
    totalFuelConsumed: number;
    totalFuelCost: number;
    totalOperations: number;
    averageUtilization: number;
    fleetEfficiency: number;
  };
  vehicles: Array<{
    vehicle: VehicleResponseDTO;
    statistics: VehicleStatistics;
    operations?: OperationModel[];
    fuelRecords?: VehicleFuelRecord[];
    maintenance?: MaintenanceRecordModel[];
    costAnalysis?: VehicleCostAnalysis;
  }>;
  fleetStatistics: FleetStatistics;
  comparison?: VehicleComparison;
  charts?: {
    utilizationChart: any[];
    fuelEfficiencyChart: any[];
    costAnalysisChart: any[];
    maintenanceChart: any[];
  };
  generatedAt: Date;
  generatedBy: string;
}

// =====================================
// 🚗 13. バルク操作型
// =====================================

/**
 * 車両バルクインポート
 */
export interface VehicleBulkImport {
  vehicles: CreateVehicleRequest[];
  options: {
    skipDuplicates: boolean;
    validatePlateNumbers: boolean;
    autoAssignStatuses: boolean;
    defaultStatus?: VehicleStatus;
    defaultIsActive?: boolean;
    notifyDrivers?: boolean;
  };
}

/**
 * バルクインポート結果
 */
export interface VehicleBulkImportResult extends BulkOperationResult {
  createdVehicles: VehicleResponseDTO[];
  skippedVehicles: Array<{
    index: number;
    vehicle: CreateVehicleRequest;
    reason: string;
  }>;
  validationErrors: Array<{
    index: number;
    field: string;
    message: string;
    value: any;
  }>;
  duplicatePlateNumbers: string[];
}

/**
 * バルクステータス更新
 */
export interface VehicleBulkStatusUpdate {
  vehicleIds: string[];
  status: VehicleStatus;
  reason?: string;
  scheduledDate?: Date;
  notifyDrivers?: boolean;
  notifyManagers?: boolean;
}

// =====================================
// 🚗 14. ユーティリティ型（internal processing）
// =====================================

/**
 * 車両作成データ（内部処理用）
 */
export type CreateVehicleData = CreateVehicleRequest & {
  status: VehicleStatus;
  createdBy: string;
  initialMileage?: number;
  registrationDate?: Date;
};

/**
 * 車両更新データ（内部処理用）
 */
export type UpdateVehicleData = UpdateVehicleRequest & {
  updatedBy: string;
  lastModified: Date;
  changeReason?: string;
};

/**
 * 安全な車両情報（センシティブ情報除外）
 */
export type SafeVehicleInfo = Omit<VehicleInfo, 'notes' | 'assignedDriverId'>;

/**
 * 車両検索結果（内部処理用）
 */
export interface VehicleSearchResult {
  vehicle: VehicleResponseDTO;
  relevanceScore: number;
  matchedFields: string[];
  distance?: number;
}

// =====================================
// 🚗 15. 定数・ENUM拡張（既存保持・強化）
// =====================================

/**
 * 車両ステータス表示用定数
 */
export const VEHICLE_STATUS_LABELS = {
  ACTIVE: '稼働中',
  INACTIVE: '非稼働',
  MAINTENANCE: 'メンテナンス中',
  OUT_OF_SERVICE: '運用停止',
  RETIRED: '廃車'
} as const;

/**
 * 燃料タイプ表示用定数
 */
export const FUEL_TYPE_LABELS = {
  GASOLINE: 'ガソリン',
  DIESEL: 'ディーゼル',
  HYBRID: 'ハイブリッド',
  ELECTRIC: '電気',
  LPG: 'LPG',
  CNG: 'CNG'
} as const;

/**
 * メンテナンス優先度定数
 */
export const MAINTENANCE_PRIORITY_LABELS = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急'
} as const;

/**
 * 稼働率基準値
 */
export const UTILIZATION_BENCHMARKS = {
  EXCELLENT: 85,
  GOOD: 70,
  AVERAGE: 50,
  POOR: 30
} as const;

// =====================================
// 🚗 16. 型ガード関数（validation helpers）
// 🔧 Phase 1-A-2修正: Enumを値として使用可能に
// =====================================

/**
 * 車両ステータスの型ガード
 * 🔧 修正: VehicleStatusを値として使用
 */
export function isValidVehicleStatus(status: any): status is VehicleStatus {
  return Object.values(VehicleStatus).includes(status);
}

/**
 * 燃料タイプの型ガード
 * 🔧 修正: FuelTypeを値として使用
 */
export function isValidFuelType(fuelType: any): fuelType is FuelType {
  return Object.values(FuelType).includes(fuelType);
}

/**
 * 車両が稼働可能かチェック
 * 🔧 修正: VehicleStatus.ACTIVEを値として使用
 */
export function isVehicleOperational(vehicle: VehicleInfo): boolean {
  return vehicle.isActive && vehicle.status === VehicleStatus.ACTIVE;
}

/**
 * 車両がメンテナンス中かチェック
 * 🔧 修正: VehicleStatus.MAINTENANCEを値として使用
 */
export function isVehicleInMaintenance(vehicle: VehicleInfo): boolean {
  return vehicle.status === VehicleStatus.MAINTENANCE;
}

/**
 * 車両が運転手にアサインされているかチェック
 */
export function hasAssignedDriver(vehicle: VehicleInfo): boolean {
  return !!vehicle.assignedDriverId && vehicle.assignedDriverId.trim().length > 0;
}

/**
 * 車両が運用停止中かチェック
 * 🔧 修正: VehicleStatus.OUT_OF_SERVICEを値として使用
 */
export function isVehicleOutOfService(vehicle: VehicleInfo): boolean {
  return vehicle.status === VehicleStatus.INACTIVE;
}

/**
 * 車両が廃車済みかチェック
 * 🔧 修正: VehicleStatus.RETIREDを値として使用
 */
export function isVehicleRetired(vehicle: VehicleInfo): boolean {
  return vehicle.status === VehicleStatus.RETIRED;
}

/**
 * 車両に運行を割り当て可能かチェック
 */
export function canAssignOperation(vehicle: VehicleInfo): boolean {
  return (
    vehicle.isActive &&
    vehicle.status === VehicleStatus.ACTIVE &&
    !!vehicle.assignedDriverId
  );
}

/**
 * メンテナンスが期限切れかチェック
 */
export function isMaintenanceOverdue(
  lastMaintenanceDate: Date | undefined,
  maintenanceIntervalDays: number = 90
): boolean {
  if (!lastMaintenanceDate) return true;
  const daysSinceLastMaintenance = Math.floor(
    (Date.now() - lastMaintenanceDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceLastMaintenance > maintenanceIntervalDays;
}

/**
 * 燃料効率が基準を満たしているかチェック
 */
export function hasSufficientFuelEfficiency(
  efficiency: number,
  fuelType: FuelType,
  benchmarkMultiplier: number = 0.8
): boolean {
  const benchmarks: Record<FuelType, number> = {
    GASOLINE: 10,
    DIESEL: 12,
    HYBRID: 20,
    ELECTRIC: 100
  };
  return efficiency >= benchmarks[fuelType] * benchmarkMultiplier;
}
