// ============================================================================
// 基本型定義
// ============================================================================

// ユーザー情報
export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager' | 'driver';
  isActive: boolean;
  vehicleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 車両情報
export interface Vehicle {
  id: string;
  vehicleNumber: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  capacity: number;
  isActive: boolean;
  currentDriverId?: string;
  currentStatus: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  createdAt: Date;
  updatedAt: Date;
}

// 位置情報
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

// ============================================================================
// 運行記録関連型定義
// ============================================================================

// 運行情報

export interface OperationInfo {
  id: string;
  operationNumber: string;
  vehicleId: string;
  driverId: string;
  status: 'waiting' | 'loading' | 'in_transit' | 'unloading' | 'completed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  startLocation: string;
  endLocation?: string;
  loadingLocation: string;
  unloadingLocation?: string;
  totalDistance?: number;
  fuelUsed?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 運行詳細情報
export interface OperationDetail {
  id: string;
  operationId: string;
  sequenceNumber: number;
  actionType: 'start_loading' | 'end_loading' | 'start_transit' | 'arrive_unloading' | 'start_unloading' | 'end_unloading' | 'complete_operation';
  itemId?: string;
  locationId?: string;
  quantity?: number;
  unit?: string;
  timestamp: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// GPSログデータ
export interface GPSLogData {
  id: string;
  operationId?: string;
  vehicleId?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number;
  speed: number;
  timestamp: Date;
  createdAt?: Date;
}

// ============================================================================
// アイテム・場所関連型定義
// ============================================================================

// アイテム情報
export interface Item {
  id: string;
  itemName: string;
  category: string;
  unit: string;
  density?: number;
  pricePerUnit?: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 場所情報
export interface Location {
  id: string;
  locationName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contactPerson?: string;
  contactPhone?: string;
  locationType: 'loading_site' | 'unloading_site' | 'depot' | 'other';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API関連型定義
// ============================================================================

// ログインリクエスト
export interface LoginRequest {
  username: string;
  password: string;
}

// ログインレスポンス
export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
  };
}

// 運行開始リクエスト
export interface StartOperationRequest {
  vehicleId: string;
  loadingLocation: string;
  startLocation?: Position;
}

// 運行開始レスポンス
export interface StartOperationResponse {
  success: boolean;
  message: string;
  data?: OperationInfo;
}

// 運行アクション記録リクエスト
export interface RecordActionRequest {
  operationId: string;
  actionType: string;
  itemId?: string;
  locationId?: string;
  quantity?: number;
  unit?: string;
  location?: Position;
  notes?: string;
}

// 運行アクション記録レスポンス
export interface RecordActionResponse {
  success: boolean;
  message: string;
  data?: OperationDetail;
}

// 運行終了リクエスト
export interface EndOperationRequest {
  operationId: string;
  finalLocation?: Position;
  totalDistance?: number;
  fuelUsed?: number;
  notes?: string;
}

// 運行終了レスポンス
export interface EndOperationResponse {
  success: boolean;
  message: string;
  data?: OperationInfo;
}

// GPS位置情報更新リクエスト
export interface GPSUpdateRequest {
  operationId?: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number;
  speed: number;
}

// 汎用APIレスポンス型
export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// ============================================================================
// UI状態管理型定義
// ============================================================================

// アプリ全体の状態
export interface AppState {
  isAuthenticated: boolean;
  user: User | null;
  currentOperation: OperationInfo | null;
  isGPSEnabled: boolean;
  isOnline: boolean;
  theme: 'light' | 'dark';
  language: 'ja' | 'en';
}

// 
export interface FormState {
  isLoading: boolean;
  errors: Record<string, string>;
  values: Record<string, any>;
}

// ============================================================================
// ユーティリティ型定義
// ============================================================================

export type OperationStatus = OperationInfo['status'];
export type ActionType = OperationDetail['actionType'];
export type UserRole = User['role'];
export type VehicleStatus = Vehicle['currentStatus'];
export type LocationType = Location['locationType'];

// React Hook フォーム用の型定義
export interface LoginFormData {
  username: string;
  password: string;
}

// 運行開始フォームデータ
export interface OperationFormData {
  vehicleId: string;
  loadingLocation: string;
  notes?: string;
}

// 
export interface ActionFormData {
  actionType: ActionType;
  itemId?: string;
  locationId?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

// 汎用APIレスポンス型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}