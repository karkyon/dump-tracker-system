// frontend/mobile/src/services/api.ts
// 運行記録API完全統合版 - バックエンドmobileController完全対応
// ✅ HTTPS対応修正版

import axios, { AxiosInstance, AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import type { GPSLogData } from '../types/index';

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
    // ✅ HTTPSに修正（デフォルト値も含む）
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1';
    
    console.log('🔧 API Service初期化:', {
      baseURL,
      environment: import.meta.env.VITE_APP_ENV
    });
    
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 10000, // ✅ 10秒に延長
      headers: {
        'Content-Type': 'application/json',
      },
      // ✅ HTTPS証明書の検証を緩和（開発環境用）
      // 本番環境では適切な証明書を使用してください
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
        } else if (error.code === 'ECONNABORTED') {
          toast.error('リクエストがタイムアウトしました');
        } else if (error.message === 'Network Error') {
          toast.error('ネットワークエラー: サーバーに接続できません');
        }
        
        return Promise.reject(error);
      }
    );
  }

  // =============================================================================
  // トークン管理
  // =============================================================================

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // =============================================================================
  // 認証API
  // =============================================================================

  /**
   * ログイン
   * POST /api/v1/mobile/auth/login
   */
  async login(credentials: LoginRequest): Promise<APIResponse<LoginResponse>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<LoginResponse>>(
        '/mobile/auth/login',
        credentials
      );
      
      if (response.data.success && response.data.data?.token) {
        this.setToken(response.data.data.token);
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * ユーザー情報取得
   * GET /api/v1/mobile/auth/me
   */
  async getMe(): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(
        '/mobile/auth/me'
      );
      return response.data;
    } catch (error) {
      console.error('Get me error:', error);
      throw error;
    }
  }

  /**
   * ログアウト
   */
  logout(): void {
    this.clearToken();
  }

  // =============================================================================
  // 運行記録API
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
   * POST /api/v1/mobile/operations/end
   */
  async endOperation(data: EndOperationRequest): Promise<APIResponse<OperationInfo>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<OperationInfo>>(
        '/mobile/operations/end',
        data
      );
      return response.data;
    } catch (error) {
      console.error('End operation error:', error);
      throw error;
    }
  }

  /**
   * アクション記録（積込・積下）
   * POST /api/v1/mobile/operations/action
   */
  async recordAction(data: RecordActionRequest): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<any>>(
        '/mobile/operations/action',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Record action error:', error);
      throw error;
    }
  }

  /**
   * 運行一覧取得
   * GET /api/v1/mobile/operations
   */
  async getOperations(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<APIResponse<OperationInfo[]>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<OperationInfo[]>>(
        '/mobile/operations',
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Get operations error:', error);
      throw error;
    }
  }

  // =============================================================================
  // GPS位置情報API
  // =============================================================================

  /**
   * GPS位置情報送信（単一）
   * POST /api/v1/mobile/gps
   */
  async sendGPSLog(data: GPSLogRequest): Promise<APIResponse<GPSLogResponse>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<GPSLogResponse>>(
        '/mobile/gps',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Send GPS log error:', error);
      throw error;
    }
  }

  /**
   * GPS位置情報バッチ送信
   * POST /api/v1/mobile/gps/batch
   */
  async sendGPSLogBatch(data: GPSLogRequest[]): Promise<APIResponse<GPSLogResponse>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<GPSLogResponse>>(
        '/mobile/gps/batch',
        { logs: data }
      );
      return response.data;
    } catch (error) {
      console.error('Send GPS log batch error:', error);
      throw error;
    }
  }

  // =============================================================================
  // 位置・場所管理API
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

  /**
   * GPS位置更新ログ
   * POST /api/v1/mobile/gps/log
   */
  async updateGPSLocation(data: GPSLogData): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<any>>(
        '/mobile/gps/log',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Update GPS location error:', error);
      throw error;
    }
  }

  // =============================================================================
  // 車両情報API
  // =============================================================================

  /**
   * 車両情報取得（リトライ機能付き）
   * GET /api/v1/mobile/vehicle
   */
  async getVehicleInfo(retryCount: number = 3): Promise<APIResponse<any>> {
    let lastError: any;
    
    for (let i = 0; i < retryCount; i++) {
      try {
        console.log(`🚗 車両情報取得試行 ${i + 1}/${retryCount}...`);
        
        const response = await this.axiosInstance.get<APIResponse<any>>(
          '/mobile/vehicle',
          {
            timeout: 60000, // 個別に60秒設定
          }
        );
        
        console.log('✅ 車両情報取得成功:', response.data);
        return response.data;
        
      } catch (error: any) {
        lastError = error;
        console.error(`❌ 車両情報取得エラー (試行 ${i + 1}/${retryCount}):`, {
          code: error.code,
          message: error.message,
          status: error.response?.status
        });
        
        // タイムアウトまたはネットワークエラーの場合のみリトライ
        if (
          error.code === 'ECONNABORTED' || 
          error.code === 'ETIMEDOUT' ||
          error.message?.includes('timeout') ||
          error.message?.includes('Network Error')
        ) {
          if (i < retryCount - 1) {
            const waitTime = Math.min(1000 * Math.pow(2, i), 5000); // 指数バックオフ
            console.log(`⏳ ${waitTime}ms後に再試行します...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // その他のエラーはすぐに throw
        throw error;
      }
    }
    
    console.error('❌ 全ての試行が失敗しました');
    throw lastError;
  }

  /**
   * 車両ステータス更新
   * PUT /api/v1/mobile/vehicle/status
   */
  async updateVehicleStatus(data: {
    status: string;
    notes?: string;
  }): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.put<APIResponse<any>>(
        '/mobile/vehicle/status',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Update vehicle status error:', error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
const apiService = new APIServiceClass();

// ✅ デフォルトエクスポートと名前付きエクスポートの両方を提供
export { apiService };           // 名前付きエクスポート
export default apiService;       // デフォルトエクスポート