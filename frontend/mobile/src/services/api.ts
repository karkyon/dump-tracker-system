// frontend/mobile/src/services/api.ts
// 運行記録API完全統合版 - バックエンドmobileController完全対応

import axios, { AxiosInstance, AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

// =============================================================================
// 型定義
// =============================================================================

// API共通レスポンス
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

// 認証関連
export interface LoginRequest {
  username: string;
  password: string;
  deviceInfo?: {
    platform: string;
    userAgent: string;
  };
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    userId: string;
    name: string;
    role: string;
    vehicleId: string;
  };
  mobileConfig: {
    offlineMode: boolean;
    gpsTracking: boolean;
    syncInterval: number;
    dataCompression: boolean;
  };
}

// 運行関連
export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  startLatitude: number;
  startLongitude: number;
  startLocation?: string;
  cargoInfo?: string;
}

export interface EndOperationRequest {
  operationId: string;
  endLatitude: number;
  endLongitude: number;
  endLocation?: string;
  totalDistance: number;
}

export interface RecordActionRequest {
  operationId: string;
  actionType: string;
  latitude: number;
  longitude: number;
  location?: string;
  notes?: string;
}

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
  totalDistanceKm?: number;
  vehicle?: {
    id: string;
    plateNumber: string;
    model: string;
  };
}

// GPS関連
export interface GPSLogRequest {
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

export interface GPSLogResponse {
  saved: number;
  lastPosition?: any;
  sync?: {
    uploaded: boolean;
    timestamp: string;
    nextSync: string;
  };
}

// 位置関連
export interface LocationInfo {
  id: string;
  name: string;
  locationType: string;
  latitude: number;
  longitude: number;
  address?: string;
  notes?: string;
}

// =============================================================================
// APIサービスクラス
// =============================================================================

class APIServiceClass {
  private axiosInstance: AxiosInstance;
  private token: string | null = null;

  constructor() {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://10.1.119.244:8000/api/v1';
    
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // リクエストインターセプター
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log(`[API] Response:`, response.data);
        return response;
      },
      (error: AxiosError<any>) => {
        console.error('[API] Response error:', error);
        
        if (error.response) {
          const status = error.response.status;
          const message = error.response.data?.message || error.message;
          
          if (status === 401) {
            toast.error('認証エラー: 再ログインが必要です');
            this.clearToken();
            window.location.href = '/login';
          } else if (status === 403) {
            toast.error('権限エラー: この操作は許可されていません');
          } else if (status === 404) {
            toast.error('リソースが見つかりません');
          } else if (status >= 500) {
            toast.error('サーバーエラーが発生しました');
          } else {
            toast.error(message || 'エラーが発生しました');
          }
        } else if (error.request) {
          toast.error('ネットワークエラー: サーバーに接続できません');
        }
        
        return Promise.reject(error);
      }
    );

    // ローカルストレージからトークン復元
    this.token = localStorage.getItem('auth_token');
  }

  // =============================================================================
  // 認証API
  // =============================================================================

  /**
   * ログイン
   * POST /api/v1/mobile/auth/login
   */
  async login(data: LoginRequest): Promise<APIResponse<LoginResponse>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<LoginResponse>>(
        '/mobile/auth/login',
        {
          ...data,
          deviceInfo: {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
          },
        }
      );
      
      if (response.data.success && response.data.data) {
        this.setToken(response.data.data.token);
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * ログアウト
   * POST /api/v1/auth/logout
   */
  async logout(): Promise<APIResponse> {
    try {
      const response = await this.axiosInstance.post<APIResponse>('/auth/logout');
      this.clearToken();
      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      this.clearToken();
      throw error;
    }
  }

  /**
   * 現在のユーザー情報取得
   * GET /api/v1/mobile/auth/me
   */
  async getCurrentUser(): Promise<APIResponse<LoginResponse['user']>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<LoginResponse['user']>>(
        '/mobile/auth/me'
      );
      return response.data;
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  // =============================================================================
  // 運行管理API
  // =============================================================================

  /**
   * 運行開始
   * POST /api/v1/mobile/operations/start
   */
  async startOperation(data: StartOperationRequest): Promise<APIResponse<OperationInfo>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<OperationInfo>>(
        '/mobile/operations/start',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Start operation error:', error);
      throw error;
    }
  }

  /**
   * 運行終了
   * POST /api/v1/mobile/operations/:id/end
   */
  async endOperation(data: EndOperationRequest): Promise<APIResponse> {
    try {
      const { operationId, ...endData } = data;
      const response = await this.axiosInstance.post<APIResponse>(
        `/mobile/operations/${operationId}/end`,
        endData
      );
      return response.data;
    } catch (error) {
      console.error('End operation error:', error);
      throw error;
    }
  }

  /**
   * 現在の運行状況取得
   * GET /api/v1/mobile/operations/current
   */
  async getCurrentOperation(): Promise<APIResponse<OperationInfo>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<OperationInfo>>(
        '/mobile/operations/current'
      );
      return response.data;
    } catch (error) {
      console.error('Get current operation error:', error);
      throw error;
    }
  }

  /**
   * アクション記録（積込到着・積降到着・休憩・給油等）
   * POST /api/v1/mobile/operations/action
   */
  async recordAction(data: RecordActionRequest): Promise<APIResponse> {
    try {
      // Note: バックエンドAPIに応じて適切なエンドポイントを使用
      // 現在は汎用的なアクション記録として実装
      const response = await this.axiosInstance.post<APIResponse>(
        '/mobile/operations/action',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Record action error:', error);
      throw error;
    }
  }

  // =============================================================================
  // GPS位置記録API
  // =============================================================================

  /**
   * GPS位置ログ記録
   * POST /api/v1/mobile/gps/log
   */
  async updateGPSLocation(data: GPSLogRequest): Promise<APIResponse<GPSLogResponse>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<GPSLogResponse>>(
        '/mobile/gps/log',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Update GPS location error:', error);
      throw error;
    }
  }

  /**
   * GPS位置ログ一括記録
   * POST /api/v1/mobile/gps/log (配列形式)
   */
  async logGPSBulk(data: GPSLogRequest[]): Promise<APIResponse<GPSLogResponse>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<GPSLogResponse>>(
        '/mobile/gps/log',
        { coordinates: data }
      );
      return response.data;
    } catch (error) {
      console.error('Bulk GPS log error:', error);
      throw error;
    }
  }

  /**
   * GPS履歴取得
   * GET /api/v1/trips/:id/gps
   */
  async getGPSHistory(operationId: string): Promise<APIResponse<any[]>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any[]>>(
        `/trips/${operationId}/gps`
      );
      return response.data;
    } catch (error) {
      console.error('Get GPS history error:', error);
      throw error;
    }
  }

  // =============================================================================
  // 位置情報API
  // =============================================================================

  /**
   * 位置一覧取得
   * GET /api/v1/mobile/locations
   */
  async getLocations(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<APIResponse<LocationInfo[]>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<LocationInfo[]>>(
        '/mobile/locations',
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Get locations error:', error);
      throw error;
    }
  }

  /**
   * クイック位置登録
   * POST /api/v1/mobile/locations/quick
   */
  async quickAddLocation(data: {
    name: string;
    latitude: number;
    longitude: number;
    locationType?: string;
    address?: string;
    notes?: string;
  }): Promise<APIResponse<LocationInfo>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<LocationInfo>>(
        '/mobile/locations/quick',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Quick add location error:', error);
      throw error;
    }
  }

  // =============================================================================
  // 車両情報API
  // =============================================================================

  /**
   * 車両情報取得
   * GET /api/v1/mobile/vehicle
   */
  async getVehicleInfo(): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(
        '/mobile/vehicle'
      );
      return response.data;
    } catch (error) {
      console.error('Get vehicle info error:', error);
      throw error;
    }
  }

  /**
   * 車両ステータス更新
   * PUT /api/v1/mobile/vehicle/status
   */
  async updateVehicleStatus(data: {
    status: string;
    notes?: string;
  }): Promise<APIResponse> {
    try {
      const response = await this.axiosInstance.put<APIResponse>(
        '/mobile/vehicle/status',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Update vehicle status error:', error);
      throw error;
    }
  }

  // =============================================================================
  // ヘルスチェックAPI
  // =============================================================================

  /**
   * モバイルAPIヘルスチェック
   * GET /api/v1/mobile/health
   */
  async healthCheck(): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(
        '/mobile/health'
      );
      return response.data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  }

  // =============================================================================
  // トークン管理
  // =============================================================================

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('auth_token');
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  getBaseURL(): string {
    return this.axiosInstance.defaults.baseURL || '';
  }
}

// =============================================================================
// シングルトンインスタンス
// =============================================================================

export const apiService = new APIServiceClass();

// 個別のAPI関数（後方互換性のため）
export const authApi = {
  login: (data: LoginRequest) => apiService.login(data),
  logout: () => apiService.logout(),
  getCurrentUser: () => apiService.getCurrentUser(),
};

export const operationApi = {
  start: (data: StartOperationRequest) => apiService.startOperation(data),
  getCurrent: () => apiService.getCurrentOperation(),
  recordAction: (data: RecordActionRequest) => apiService.recordAction(data),
  end: (data: EndOperationRequest) => apiService.endOperation(data),
};

export const gpsApi = {
  log: (data: GPSLogRequest) => apiService.updateGPSLocation(data),
  logBulk: (data: GPSLogRequest[]) => apiService.logGPSBulk(data),
  getHistory: (operationId: string) => apiService.getGPSHistory(operationId),
};

export const locationApi = {
  getList: (params?: any) => apiService.getLocations(params),
  quickAdd: (data: any) => apiService.quickAddLocation(data),
};

// デフォルトエクスポート
export default apiService;