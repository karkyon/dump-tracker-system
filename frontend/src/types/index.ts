// 認証関連
export interface User {
  id: string;
  userId: string;
  name: string;
  role: string;
  vehicleId: string;
}

// ログイン情報
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// 車両関連
export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  manufacturer: string;
  year: number;
  fuelType: 'GASOLINE' | 'DIESEL' | 'HYBRID' | 'ELECTRIC';
  capacityTons: number;
  currentMileage: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  purchaseDate?: string;
  insuranceExpiry?: string;
  inspectionExpiry?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// 点検項目関連
export interface InspectionItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  order: number;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 場所関連
export interface Location {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: 'loading' | 'unloading' | 'both';
  clientName?: string;
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 品目関連
export interface CargoType {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  standardPrice?: number;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 運行記録関連
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
}

// GPS関連
export interface GPSLocation {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
}

// 帳票関連
export interface ReportFilter {
  startDate: string;
  endDate: string;
  vehicleIds?: string[];
  driverIds?: string[];
  cargoTypeIds?: string[];
  status?: string[];
}

// 地図関連
export interface Position {
  coords: {
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    accuracy: number;
  };
  timestamp: number;
}

// 運行情報関連
export interface OperationInfo {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime?: string;
  loadingLocation?: string;
  unloadingLocation?: string;
  cargoInfo?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  totalDistance?: number;
}

// GPS ログデータ
export interface GPSLogData {
  operationId: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speedKmh?: number | null;
  heading?: number | null;
  accuracyMeters?: number | null;
  timestamp: string;
}

// API レスポンス
export interface ApiResponse<T = any> {
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

// システム設定
export interface SystemSettings {
  companyName: string;
  systemName: string;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
}

// フィルター・検索
export interface FilterOptions {
  search?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}