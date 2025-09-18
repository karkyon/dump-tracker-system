// =====================================
// types/vehicle.ts
// 車両関連の型定義
// =====================================

// ページネーション関連型
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: VehicleStatus;
  model?: string;
  fuelType?: string;
  year?: number;
  manufacturer?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 車両関連のリクエスト型
export interface CreateVehicleRequest {
  plate_number: string;
  model: string;
  manufacturer?: string;
  year?: number;
  capacity?: number;
  fuelType?: string;
}

export interface UpdateVehicleRequest {
  plate_number?: string;
  model?: string;
  manufacturer?: string;
  year?: number;
  capacity?: number;
  fuelType?: string;
  status?: VehicleStatus;
  assignedDriverId?: string;
}

// 車両ステータス型（Prismaのenumに対応）
export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | 'RETIRED';

// ユーザーロール型（Prismaのenumに対応）
export type UserRole = 'ADMIN' | 'MANAGER' | 'DRIVER';

// 車両型（基本）- DTOとして使用
export interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  manufacturer?: string | null;
  year?: number | null;
  capacity?: number | null;
  fuelType?: string | null;
  status?: VehicleStatus | null;
  last_maintenance_date?: Date | null;
  nextMaintenanceDate?: Date | null;
  assignedDriverId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// 車両詳細型（統計情報等を含む）
export interface VehicleWithDetails extends Vehicle {
  lastDriverName?: string | null;
  recentTrips?: any[];
  maintenanceHistory?: any[];
  statistics?: VehicleStatistics;
  tripCount?: number;
}

// 車両統計情報型
export interface VehicleStatistics {
  vehicleInfo: {
    plate_number?: string;
    model?: string;
    manufacturer?: string;
    year?: number | null;
    status?: VehicleStatus;
    fuelType?: string;
    capacity?: number | null;
  };
  statistics: {
    totalTrips: number;
    completedTrips: number;
    totalDistance: number;
    totalFuelCost: number;
    totalFuelConsumed: number;
    averageTripDistance: number;
    averageFuelCost: number;
    fuelEfficiency: number;
    averageFuelCostPerKm: number;
    utilizationRate: number;
    maintenanceCount: number;
    completionRate: string;
  };
}

// 車両燃費分析型
export interface VehicleFuelAnalysis {
  vehicleInfo: {
    plate_number: string;
    model: string;
    manufacturer: string;
  };
  overallStatistics: {
    totalTrips: number;
    totalDistance: string;
    totalFuelConsumed: string;
    totalFuelCost: string;
    averageFuelEfficiency: string;
    averageCostPerKm: string;
  };
  monthlyAnalysis: Array<{
    month: string;
    averageFuelEfficiency: string;
    totalDistance: string;
    totalFuelConsumed: string;
    totalFuelCost: string;
    averageCostPerKm: string;
    tripCount: number;
  }>;
}

// 一括更新結果型
export interface BulkUpdateResult {
  updatedCount: number;
  message: string;
}

// 車両利用率レポート型
export interface VehicleUtilizationReportItem {
  vehicleId: string;
  plate_number: string;
  model: string;
  status?: VehicleStatus;
  totalTrips: number;
  completedTrips: number;
  utilizationRate: string;
  lastTripDate?: Date | null;
}

// 利用可能車両情報型
export interface AvailableVehicle {
  id: string;
  plate_number: string;
  model: string;
  manufacturer: string;
  capacity: number;
  fuelType: string;
}

// 車両検索結果型
export interface VehicleSearchResult {
  id: string;
  plate_number: string;
  model: string;
  manufacturer?: string | null;
  status?: VehicleStatus | null;
  fuelType?: string | null;
}

// メンテナンス記録追加リクエスト型
export interface AddMaintenanceRecordRequest {
  inspectionType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'SPECIAL';
  status: 'PASS' | 'FAIL' | 'PENDING';
  notes?: string;
  nextDue?: Date;
}