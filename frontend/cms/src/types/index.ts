// frontend/cms/src/types/index.ts - 完全修正版
// 🔧 修正内容: 
// 1. Vehicle型に plateNumber, model, capacity を追加（既存フィールドも100%保持）
// 2. FilterOptionsに manufacturer を追加
// 既存機能: すべての型定義を完全保持

// =====================================
// 認証関連
// =====================================
export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  status?: 'active' | 'inactive';
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  lastLoginAt?: string;
  employeeId?: string;
  phone?: string;
  password?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// =====================================
// 車両関連
// ✅ 修正: バックエンドとフロントエンドの両方に対応できるよう完全統一
// =====================================
export interface Vehicle {
  id: string;
  
  // ✅ バックエンド形式（優先）
  plateNumber?: string;       // バックエンド: ナンバープレート
  model?: string;             // バックエンド: 車種・モデル
  manufacturer?: string;      // バックエンド: 製造元
  capacity?: number;          // バックエンド: 積載量（capacityTons の省略形）
  capacityTons?: number;      // バックエンド: 積載量（完全形）
  
  // ✅ フロントエンド形式（互換性維持）
  vehicleNumber?: string;     // フロントエンド: 車番（plateNumber のエイリアス）
  vehicleType?: string;       // フロントエンド: 車種（model のエイリアス）
  
  // ✅ 共通フィールド
  year?: number;
  fuelType?: 'GASOLINE' | 'DIESEL' | 'HYBRID' | 'ELECTRIC';
  currentMileage?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  purchaseDate?: string;
  insuranceExpiry?: string;
  inspectionExpiry?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// =====================================
// 点検項目関連
// =====================================
export interface InspectionItem {
  id: string;
  name: string;
  description?: string;
  category?: 'pre' | 'post';
  type?: string;
  order?: number;
  isRequired?: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================================
// 場所関連
// =====================================
export interface Location {
  id: string;
  name: string;
  locationName?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  gpsLatitude?: number;
  gpsLongitude?: number;
  locationType?: 'loading' | 'unloading' | 'both';
  type?: 'pickup' | 'delivery';
  clientName?: string;
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================================
// 品目関連
// =====================================
export interface CargoType {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  standardPrice?: number;
  displayOrder?: number;
  order?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================================
// 運行記録関連
// =====================================
export interface OperationRecord {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime?: string;
  startLocation: string;
  endLocation?: string;
  cargoTypeId: string;
  loadWeight?: number;
  status: 'ongoing' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // ✅ 追加: 表示用プロパティ（APIレスポンスまたはフロントエンドで計算）
  date?: string;                    // 運行日
  driverName?: string;              // 運転手名
  vehicleNumber?: string;           // 車両番号
  clientName?: string;              // 客先名
  loadingLocation?: string;         // 積込場所名
  unloadingLocation?: string;       // 積下場所名
  cargoType?: string;               // 荷物種別名
  distance?: number;                // 走行距離
  operationTime?: string;           // 運行時間
}

// =====================================
// GPS関連
// =====================================
export interface GPSLocation {
  id: string;
  vehicleId: string;
  vehicleNumber?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
  status?: 'moving' | 'stopped' | 'idle';
}

// =====================================
// 帳票関連
// =====================================
export interface ReportFilter {
  startDate: string;
  endDate: string;
  vehicleIds?: string[];
  driverIds?: string[];
  cargoTypeIds?: string[];
  status?: string[];
  format?: 'pdf' | 'excel';
}

// =====================================
// API レスポンス
// =====================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// =====================================
// システム設定
// =====================================
export interface SystemSettings {
  companyName: string;
  systemName: string;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
}

// =====================================
// フィルター・検索 (完全版)
// =====================================
export interface FilterOptions {
  search?: string;
  searchTerm?: string;  // UserManagement, VehicleManagement用
  category?: string;
  role?: string;  // UserManagement用
  status?: string;  // UserManagement, VehicleManagement用
  vehicleType?: string;  // VehicleManagement用
  manufacturer?: string;  // ✅ 追加: VehicleManagement用（製造元フィルター）
  isActive?: boolean;
  page?: number;
  limit?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =====================================
// テーブル関連
// =====================================
export interface Column<T> {
  key: string;
  header: string;
  label?: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

// =====================================
// マスタストア関連
// =====================================
export interface MasterState {
  locations: Location[];
  locationLoading: boolean;
  locationError: string | null;

  cargoTypes: CargoType[];
  cargoTypeLoading: boolean;
  cargoTypeError: string | null;
  loading: boolean;  // CargoTypeManagement用

  fetchLocations: () => Promise<void>;
  createLocation: (data: Partial<Location>) => Promise<boolean>;
  updateLocation: (id: string, data: Partial<Location>) => Promise<boolean>;
  deleteLocation: (id: string) => Promise<boolean>;

  fetchCargoTypes: () => Promise<void>;
  addCargoType: (data: Partial<CargoType>) => Promise<boolean>;  // CargoTypeManagement用
  createCargoType: (data: Partial<CargoType>) => Promise<boolean>;
  updateCargoType: (id: string, data: Partial<CargoType>) => Promise<boolean>;
  deleteCargoType: (id: string) => Promise<boolean>;

  clearErrors: () => void;
}

// =====================================
// オペレーションストア関連
// =====================================
export interface OperationState {
  operations: OperationRecord[];
  records: OperationRecord[];  // OperationRecords用
  selectedOperation: OperationRecord | null;
  
  gpsLocations: GPSLocation[];
  currentLocations: GPSLocation[];
  
  isLoading: boolean;
  loading: boolean;  // OperationRecords用
  error: string | null;
  
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  
  filters: FilterOptions;

  fetchOperations: (filters?: FilterOptions) => Promise<void>;
  fetchRecords: (filters?: FilterOptions) => Promise<void>;  // OperationRecords用
  createOperation: (data: Partial<OperationRecord>) => Promise<boolean>;
  updateOperation: (id: string, data: Partial<OperationRecord>) => Promise<boolean>;
  deleteOperation: (id: string) => Promise<boolean>;
  exportRecords: (filters?: FilterOptions) => Promise<void>;  // OperationRecords用
  
  fetchGpsLocations: (vehicleId?: string) => Promise<void>;
  setFilters: (filters: Partial<FilterOptions>) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  clearSelectedOperation: () => void;
}