// frontend/mobile/src/types/index.ts
// アプリケーション全体で使用する型定義 - 修正版

// ============================================================================
// ユーザー・認証関連
// ============================================================================

export interface User {
  id: string;
  userId: string;
  name: string;
  role: 'DRIVER' | 'MANAGER' | 'ADMIN';
  vehicleId: string;
  email?: string;
  phoneNumber?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// 車両関連
// ============================================================================

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  currentMileage: number;
  status: 'active' | 'inactive' | 'maintenance';
  lastDriver?: string;
  lastOperationDate?: string;
}

// ============================================================================
// 運行記録関連
// ============================================================================

export type OperationStatus = 
  | 'PREPARING'      // 準備中
  | 'IN_PROGRESS'    // 運行中
  | 'LOADING'        // 積込中
  | 'UNLOADING'      // 積降中
  | 'RESTING'        // 休憩中
  | 'REFUELING'      // 給油中
  | 'COMPLETED'      // 完了
  | 'CANCELLED';     // キャンセル

export interface OperationInfo {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime?: string;
  status: OperationStatus;
  loadingLocation?: string;
  unloadingLocation?: string;
  cargoInfo?: string;
  startMileage: number;
  endMileage?: number;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  vehicle?: Vehicle;
  driver?: User;
  actions?: OperationAction[];
}

export interface OperationAction {
  id: string;
  operationId: string;
  actionType: 'LOADING' | 'UNLOADING' | 'REST' | 'REFUEL' | 'OTHER';
  latitude: number;
  longitude: number;
  location?: string;
  notes?: string;
  timestamp: string;
}

// ============================================================================
// GPS・位置情報関連
// ============================================================================

// ✅ 追加: Position型定義
export interface Position {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    speed?: number;
    heading?: number;
  };
  timestamp: number;
}

// ✅ GPSPosition型はPositionのエイリアスとして定義
export type GPSPosition = Position;

export interface GPSLogData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
  operationId?: string;
  vehicleId?: string;
}

export interface LocationInfo {
  id: string;
  name: string;
  locationType: 'LOADING' | 'UNLOADING' | 'REST_AREA' | 'GAS_STATION' | 'GARAGE';
  latitude: number;
  longitude: number;
  address?: string;
  notes?: string;
}

// ============================================================================
// 点検関連
// ============================================================================

export interface InspectionItem {
  id: string;
  label: string;
  category: 'PRE_DEPARTURE' | 'POST_DEPARTURE';
  checked: boolean;
  required: boolean;
  order: number;
}

export interface InspectionRecord {
  id: string;
  operationId: string;
  inspectionType: 'PRE_DEPARTURE' | 'POST_DEPARTURE';
  items: InspectionItem[];
  completedAt: string;
  notes?: string;
}

// ============================================================================
// API レスポンス関連
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
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

// ============================================================================
// フォーム関連
// ============================================================================

export interface FormErrors {
  [key: string]: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

// ============================================================================
// 状態管理関連
// ============================================================================

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
}

// ============================================================================
// ユーティリティ型
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// 🆕 Home画面関連 - 今日の運行サマリー
// ============================================================================

/**
 * 今日の運行サマリー
 */
export interface TodaysSummary {
  operationCount: number;        // 今日の運行回数
  totalDistance: number;         // 今日の総走行距離 (km)
  totalDuration: number;         // 今日の総運行時間 (分)
  lastOperationEndTime?: string; // 最終運行終了時刻 (ISO 8601形式)
}