// 認証関連
export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'driver';
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// 車両関連
export interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  currentMileage: number;
  lastDriver?: string;
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
}

// 点検項目関連
export interface InspectionItem {
  id: string;
  name: string;
  type: 'checkbox' | 'input';
  category: 'pre' | 'post';
  order: number;
  isRequired: boolean;
}

// 場所関連
export interface Location {
  id: string;
  clientName: string;
  locationName: string;
  address: string;
  type: 'pickup' | 'delivery';
  gpsLatitude?: number;
  gpsLongitude?: number;
  registrationMethod: 'admin' | 'app';
  createdAt: string;
}

// 品目関連
export interface CargoType {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  createdAt: string;
}

// 運行記録関連
export interface OperationRecord {
  id: string;
  operationDate: string;
  driverName: string;
  vehicleNumber: string;
  clientName: string;
  pickupLocation: string;
  deliveryLocation: string;
  cargoType: string;
  startMileage: number;
  endMileage: number;
  totalDistance: number;
  operationTime: string;
  status: 'ongoing' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
}

// GPS関連
export interface GPSLocation {
  vehicleId: string;
  vehicleNumber: string;
  driverName: string;
  latitude: number;
  longitude: number;
  status: 'driving' | 'loading' | 'unloading' | 'resting' | 'refueling' | 'offline';
  lastUpdate: string;
  currentLocation?: string;
}

// 帳票関連
export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  vehicleId?: string;
  driverId?: string;
  format: 'pdf' | 'excel' | 'csv';
}

// API レスポンス
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  searchTerm?: string;
  status?: string;
  role?: string;
  vehicleType?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  page?: number;
  pageSize?: number;
}