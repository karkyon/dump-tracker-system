// frontend/mobile/src/services/api.ts
// 運行記録API完全統合版 - バックエンドmobileController完全対応
// ✅ HTTPS対応修正版 + 点検項目API追加
// 🆕 D5/D6/D7機能対応: recordLoadingArrival, recordUnloadingArrival, getNearbyLocationsメソッド追加（2025年12月7日）
// 🆕 新規地点登録機能追加: createQuickLocationメソッド追加（2025年12月7日）
// 🆕🆕🆕 休憩管理・給油記録機能追加: startBreak, endBreak, recordFuelメソッド追加（2025年12月28日）

import axios, { AxiosInstance, AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import type { GPSLogData,TodaysSummary } from '../types/index';

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
  accessToken: string;
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
  startLatitude?: number;   // ✅ BUG-034: オプション化（デフォルト座標送信廃止）
  startLongitude?: number;  // ✅ BUG-034: オプション化
  startOdometer?: number;   // ✅ BUG-035: 開始オドメーター追加
  startLocation?: string;
  cargoInfo?: string;
  customerId?: string;   // 🆕 客先ID
}

export interface EndOperationRequest {
  endTime?: Date;
  endPosition?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  endOdometer?: number;     // ✅ 変更: endMileage → endOdometer
  endFuelLevel?: number;    // ✅ 追加: 終了燃料レベル
  notes?: string;
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

// 🆕 D5/D6機能: 積込記録リクエスト
export interface RecordLoadingArrivalRequest {
  locationId: string;        // 積込場所ID（近隣地点検知で取得）
  latitude: number;          // GPS緯度
  longitude: number;         // GPS経度
  accuracy?: number;         // GPS測位精度（メートル）
  arrivalTime?: Date | string; // 到着時刻（省略時は現在時刻）
  itemId?: string;           // 品目ID（オプション）
  quantity?: number;         // 積載量（オプション）
  notes?: string;            // メモ（オプション）
}

// 🆕 D5/D6機能: 積降記録リクエスト
export interface RecordUnloadingArrivalRequest {
  locationId: string;        // 積降場所ID（近隣地点検知で取得）
  latitude: number;          // GPS緯度
  longitude: number;         // GPS経度
  accuracy?: number;         // GPS測位精度（メートル）
  arrivalTime?: Date | string; // 到着時刻（省略時は現在時刻）
  itemId?: string;           // 品目ID（オプション）
  quantity?: number;         // 積降量（オプション）
  notes?: string;            // メモ（オプション）
}

/**
 * 🆕 積降開始リクエスト
 */
export interface StartUnloadingRequest {
  locationId: string;        // 積降場所ID
  latitude: number;          // GPS緯度
  longitude: number;         // GPS経度
  accuracy?: number;         // GPS測位精度（メートル）
  startTime?: Date | string; // 開始時刻（省略時は現在時刻）
  notes?: string;            // メモ（オプション）
}

/**
 * 🆕 積降完了リクエスト
 */
export interface CompleteUnloadingRequest {
  locationId?: string;       // 🔧 積降場所ID（追加）
  itemId?: string;           // 品目ID（省略時は積込品目を使用）
  quantity?: number;         // 積降量（オプション）
  endTime?: Date | string;   // 終了時刻（省略時は現在時刻）
  latitude?: number;         // 🆕 GPS緯度
  longitude?: number;        // 🆕 GPS経度
  accuracy?: number;         // 🆕 GPS測位精度（メートル）
  notes?: string;            // メモ（オプション）
}

/**
 * 🆕 積込開始リクエスト
 */
export interface StartLoadingRequest {
  locationId: string;        // 積込場所ID
  latitude: number;          // GPS緯度
  longitude: number;         // GPS経度
  accuracy?: number;         // GPS測位精度（メートル）
  startTime?: Date | string; // 開始時刻（省略時は現在時刻）
  notes?: string;            // メモ（オプション）
}

/**
 * 🆕 積込完了リクエスト
 */
export interface CompleteLoadingRequest {
  itemId: string;            // 品目ID（必須）
  quantity?: number;         // 積載量（オプション）
  endTime?: Date | string;   // 終了時刻（省略時は現在時刻）
  notes?: string;            // メモ（オプション）
}

// 🆕 D5/D6機能: 積込・積降記録レスポンス
export interface ActivityRecordResponse {
  id: string;                // 記録ID
  locationId: string;        // 場所ID
  latitude: number;          // 記録されたGPS緯度
  longitude: number;         // 記録されたGPS経度
  accuracy?: number;         // GPS精度
  arrivalTime: string;       // 到着時刻
  activityType: 'LOADING' | 'UNLOADING'; // 活動種別
  createdAt: string;         // 作成日時
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
      async (error: AxiosError<any>) => {
        console.error('[API] Response error:', error);
        
        if (error.response) {
          const status = error.response.status;
          const message = error.response.data?.message || error.message;
          
          if (status === 401) {
            // BUG-021修正: 401受信時はまずrefreshTokenで再認証を試みる
            // operationStoreのデータを保持したまま再ログイン誘導する
            const originalRequest = error.config;
            const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
            const storedRefreshToken = localStorage.getItem('refresh_token');

            if (!isRefreshRequest && storedRefreshToken) {
              try {
                console.warn('[API] 401検知 → refreshToken試行中...');
                const refreshResponse = await this.axiosInstance.post(
                  '/mobile/auth/refresh',
                  { refreshToken: storedRefreshToken }
                );
                const newAccessToken = refreshResponse.data?.data?.accessToken;
                if (newAccessToken) {
                  this.setToken(newAccessToken);
                  if (refreshResponse.data?.data?.refreshToken) {
                    localStorage.setItem('refresh_token', refreshResponse.data.data.refreshToken);
                  }
                  console.log('[API] ✅ refreshToken成功 → 元のリクエストをリトライ');
                  if (originalRequest) {
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return await this.axiosInstance(originalRequest);
                  }
                }
              } catch (refreshError) {
                console.error('[API] refreshToken失敗:', refreshError);
              }
            }

            // refreshToken失敗 または なし → operationStoreを保持したままログイン画面へ
            // ※ operation-store(localStorage)はクリアしない。ログイン後に運行継続できるようにする。
            console.error('[API] 認証失敗 → ログイン画面へ (operationStore保持)');
            toast.error('セッションの有効期限が切れました。再ログインが必要です。', { duration: 5000 });
            this.clearToken();
            setTimeout(() => { window.location.href = '/login'; }, 1200);
          } else if (status === 403) {
            toast.error('権限エラー: この操作は許可されていません');
          } else if (status === 404) {
            toast.error('リソースが見つかりません');
          } else if (status >= 500) {
            const errorCode: string = (error.response.data?.error as string) || '';
            const isRetryable = isRetryableServerError(status, errorCode);
            if (isRetryable) {
              toast.error(
                '⚠️ 一時的なサーバーエラーです。しばらくしてから再試行してください',
                { duration: 6000 }
              );
            } else {
              const displayCode = errorCode || `HTTP_${status}`;
              toast.error(
                `❌ 処理に失敗しました（エラー: ${displayCode}）。管理者に連絡してください`,
                { duration: Infinity }
              );
            }
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
      
      if (response.data.success && response.data.data?.accessToken) {
        this.setToken(response.data.data.accessToken);
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

  /**
   * 🆕 今日の運行サマリーを取得
   * @returns {Promise<APIResponse<TodaysSummary>>} 今日の運行サマリー
   */
  async getTodaysSummary(): Promise<APIResponse<TodaysSummary>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<TodaysSummary>>(
        '/mobile/summary/today'
      );
      return response.data;
    } catch (error) {
      console.error('今日の運行サマリー取得エラー:', error);
      // エラー時はデフォルト値を返す
      return {
        success: false,
        data: {
          operationCount: 0,
          totalDistance: 0,
          totalDuration: 0
        },
        message: '運行サマリーの取得に失敗しました'
      };
    }
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
   * 現在の運行状況取得
   * GET /api/v1/mobile/operations/current
   */
  async getCurrentOperation(): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(
        '/mobile/operations/current'
      );
      return response.data;
    } catch (error: any) {
      console.error('Get current operation error:', error);
      
      // 404エラー（運行なし）の場合は正常系として扱う
      if (error?.response?.status === 404) {
        return {
          success: true,
          data: null,
          message: '進行中の運行はありません'
        };
      }
      
      throw error;
    }
  }
  
  /**
   * 運行終了
   * POST /api/v1/mobile/operations/:id/end
   */
  async endOperation(operationId: string, data: EndOperationRequest): Promise<APIResponse<OperationInfo>> {
    try {
      console.log('[API] 🏁 運行終了API呼び出し:', { operationId, data });
      
      const response = await this.axiosInstance.post<APIResponse<OperationInfo>>(
        `/mobile/operations/${operationId}/end`,
        data
      );
      
      console.log('[API] ✅ 運行終了API成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] ❌ 運行終了エラー:', error);
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

  /**
   * 運行記録詳細取得（D9a用）
   * GET /api/v1/mobile/operations/:id
   * 
   * @param operationId - 運行記録ID
   * @returns 運行詳細情報
   */
  async getOperationDetail(operationId: string): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(
        `/mobile/operations/${operationId}`
      );
      return response.data;
    } catch (error: any) {
      console.error('[API] 運行詳細取得エラー:', error);
      throw error;
    }
  }

  // =============================================================================
  // 🆕🆕🆕 D5/D6機能: 積込・積降記録API
  // =============================================================================

  /**
   * 🆕 D5機能: 積込場所到着記録
   * POST /api/v1/trips/:tripId/loading
   * 
   * 【使用例】
   * ```typescript
   * const result = await apiService.recordLoadingArrival('trip-123', {
   *   locationId: 'loc-456',
   *   latitude: 35.6812,
   *   longitude: 139.7671,
   *   accuracy: 10.5,
   *   arrivalTime: new Date()
   * });
   * ```
   * 
   * @param tripId - 運行記録ID
   * @param data - 積込記録データ
   * @returns 積込記録レスポンス
   */
  async recordLoadingArrival(
    tripId: string,
    data: RecordLoadingArrivalRequest
  ): Promise<APIResponse<ActivityRecordResponse>> {
    try {
      console.log('🚛 積込場所到着記録:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<ActivityRecordResponse>>(
        `/trips/${tripId}/loading`,
        data
      );
      
      console.log('✅ 積込記録成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 積込記録エラー:', error);
      throw error;
    }
  }

  /**
   * 🆕 D6機能: 積降場所到着記録
   * POST /api/v1/trips/:tripId/unloading
   * 
   * 【使用例】
   * ```typescript
   * const result = await apiService.recordUnloadingArrival('trip-123', {
   *   locationId: 'loc-789',
   *   latitude: 35.6895,
   *   longitude: 139.6917,
   *   accuracy: 8.2,
   *   arrivalTime: new Date()
   * });
   * ```
   * 
   * @param tripId - 運行記録ID
   * @param data - 積降記録データ
   * @returns 積降記録レスポンス
   */
  async recordUnloadingArrival(
    tripId: string,
    data: RecordUnloadingArrivalRequest
  ): Promise<APIResponse<ActivityRecordResponse>> {
    try {
      console.log('🚛 積降場所到着記録:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<ActivityRecordResponse>>(
        `/trips/${tripId}/unloading`,
        data
      );
      
      console.log('✅ 積降記録成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 積降記録エラー:', error);
      throw error;
    }
  }

  /**
   * 🆕 積降開始
   * POST /api/v1/trips/:tripId/unloading/start
   * 
   * 【使用例】
   * ```typescript
   * const result = await apiService.startUnloadingAtLocation('trip-123', {
   *   locationId: 'loc-789',
   *   latitude: 35.6895,
   *   longitude: 139.6917,
   *   accuracy: 8.2
   * });
   * ```
   * 
   * @param tripId - 運行記録ID
   * @param data - 積降開始データ
   * @returns 積降開始レスポンス
   */
  async startUnloadingAtLocation(
    tripId: string,
    data: StartUnloadingRequest
  ): Promise<APIResponse<ActivityRecordResponse>> {
    try {
      console.log('📦 積降開始:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<ActivityRecordResponse>>(
        `/trips/${tripId}/unloading/start`,
        data
      );
      
      console.log('✅ 積降開始成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 積降開始エラー:', error);
      throw error;
    }
  }

  /**
   * 🆕 積降完了
   * POST /api/v1/trips/:tripId/unloading/complete
   * 
   * 【使用例】
   * ```typescript
   * const result = await apiService.completeUnloadingAtLocation('trip-123', {
   *   itemId: 'item-456',
   *   quantity: 5.5,
   *   notes: '積降完了'
   * });
   * ```
   * 
   * @param tripId - 運行記録ID
   * @param data - 積降完了データ
   * @returns 積降完了レスポンス
   */
  async completeUnloadingAtLocation(
    tripId: string,
    data: CompleteUnloadingRequest
  ): Promise<APIResponse<ActivityRecordResponse>> {
    try {
      console.log('📦 積降完了:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<ActivityRecordResponse>>(
        `/trips/${tripId}/unloading/complete`,
        data
      );
      
      console.log('✅ 積降完了成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 積降完了エラー:', error);
      throw error;
    }
  }

  /**
   * 🆕 積込開始
   * POST /api/v1/trips/:tripId/loading/start
   * 
   * @param tripId - 運行記録ID
   * @param data - 積込開始データ
   * @returns 積込開始レスポンス
   */
  async startLoadingAtLocation(
    tripId: string,
    data: StartLoadingRequest
  ): Promise<APIResponse<ActivityRecordResponse>> {
    try {
      console.log('🚛 積込開始:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<ActivityRecordResponse>>(
        `/trips/${tripId}/loading/start`,
        data
      );
      
      console.log('✅ 積込開始成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 積込開始エラー:', error);
      throw error;
    }
  }

  /**
   * 🆕 積込完了
   * POST /api/v1/trips/:tripId/loading/complete
   * 
   * @param tripId - 運行記録ID
   * @param data - 積込完了データ
   * @returns 積込完了レスポンス
   */
  async completeLoadingAtLocation(
    tripId: string,
    data: CompleteLoadingRequest
  ): Promise<APIResponse<ActivityRecordResponse>> {
    try {
      console.log('🚛 積込完了:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<ActivityRecordResponse>>(
        `/trips/${tripId}/loading/complete`,
        data
      );
      
      console.log('✅ 積込完了成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 積込完了エラー:', error);
      throw error;
    }
  }

  // =============================================================================
  // 🆕🆕🆕 休憩管理API（2025年12月28日追加）
  // =============================================================================

  /**
   * 🆕 休憩開始（2025年12月28日新規追加）
   * POST /api/v1/trips/:tripId/break/start
   * 
   * 【機能概要】
   * - 運行中に休憩を開始
   * - operation_detailsテーブルにBREAK_STARTレコード追加
   * - GPS座標と開始時刻を記録
   * 
   * 【パラメータ】
   * @param tripId - 運行記録ID
   * @param data - 休憩開始データ
   * @param data.latitude - GPS緯度（オプション）
   * @param data.longitude - GPS経度（オプション）
   * @param data.location - 休憩場所名（オプション）
   * @param data.notes - メモ（オプション）
   * 
   * 【レスポンス】
   * - operation_detailsレコード（activityType: BREAK_START）
   * 
   * 【使用例】
   * ```typescript
   * const result = await apiService.startBreak('trip-123', {
   *   latitude: 35.6812,
   *   longitude: 139.7671,
   *   location: '○○パーキングエリア',
   *   notes: '昼食休憩'
   * });
   * ```
   */
  async startBreak(
    tripId: string,
    data?: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      location?: string;
      notes?: string;
    }
  ): Promise<APIResponse<any>> {
    try {
      console.log('☕ 休憩開始API呼び出し:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<any>>(
        `/trips/${tripId}/break/start`,
        data || {}
      );
      
      console.log('✅ 休憩開始成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 休憩開始エラー:', error);
      throw error;
    }
  }

  /**
   * 🆕 休憩終了（2025年12月28日新規追加）
   * POST /api/v1/trips/:tripId/break/end
   * 
   * 【機能概要】
   * - 休憩を終了
   * - operation_detailsテーブルにBREAK_ENDレコード追加
   * - 休憩時間を自動計算
   * 
   * 【パラメータ】
   * @param tripId - 運行記録ID
   * @param data - 休憩終了データ
   * @param data.notes - メモ（オプション）
   * 
   * 【レスポンス】
   * - operation_detailsレコード（activityType: BREAK_END）
   * 
   * 【使用例】
   * ```typescript
   * const result = await apiService.endBreak('trip-123', {
   *   notes: '休憩終了'
   * });
   * ```
   */
  async endBreak(
    tripId: string,
    data?: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      notes?: string;
    }
  ): Promise<APIResponse<any>> {
    try {
      console.log('⏱️ 休憩終了API呼び出し:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<any>>(
        `/trips/${tripId}/break/end`,
        data || {}
      );
      
      console.log('✅ 休憩終了成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 休憩終了エラー:', error);
      throw error;
    }
  }

  // =============================================================================
  // 🆕🆕🆕 給油記録API（2025年12月28日追加）
  // =============================================================================

  /**
   * 🆕 給油記録保存（2025年12月28日新規追加）
   * POST /api/v1/trips/:tripId/fuel
   * 
   * 【機能概要】
   * - 給油記録を保存
   * - operation_detailsテーブルにFUELINGレコード追加
   * 
   * 【パラメータ】
   * @param tripId - 運行記録ID
   * @param data - 給油記録データ
   * @param data.fuelAmount - 給油量（リットル）（必須）
   * @param data.fuelCost - 給油金額（円）（必須）
   * @param data.fuelStation - 給油所名（オプション）
   * @param data.notes - メモ（オプション）
   * 
   * 【レスポンス】
   * - operation_detailsレコード（activityType: FUELING）
   * 
   * 【使用例】
   * ```typescript
   * const result = await apiService.recordFuel('trip-123', {
   *   fuelAmount: 50.5,
   *   fuelCost: 8000,
   *   fuelStation: 'ENEOS ○○店',
   *   notes: '満タン給油'
   * });
   * ```
   */
  async recordFuel(
    tripId: string,
    data: {
      fuelAmount: number;
      fuelCost?: number;
      fuelStation?: string;
      latitude?: number;     // 🆕 GPS緯度
      longitude?: number;    // 🆕 GPS経度
      accuracy?: number;     // 🆕 GPS測位精度（メートル）
      notes?: string;
    }
  ): Promise<APIResponse<any>> {
    try {
      console.log('⛽ 給油記録API呼び出し:', { tripId, data });
      
      const response = await this.axiosInstance.post<APIResponse<any>>(
        `/trips/${tripId}/fuel`,
        data
      );
      
      console.log('✅ 給油記録成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 給油記録エラー:', error);
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
   * 🆕 D5/D6機能: 近隣地点検索（運行中専用）
   * POST /api/v1/mobile/operations/nearby-locations
   * 
   * 【使用シーン】
   * - 積込場所到着ボタンクリック時
   * - 積降場所到着ボタンクリック時
   * 
   * 【レスポンス】
   * - locations: 近隣地点の配列（距離順ソート済み）
   * - searchCriteria: 検索条件
   * - timestamp: 検索実行時刻
   * 
   * @param data - 検索条件
   * @returns 近隣地点リスト
   */
  async getNearbyLocations(data: {
    operationId?: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    phase: 'TO_LOADING' | 'AT_LOADING' | 'TO_UNLOADING' | 'AT_UNLOADING' | 'BREAK' | 'REFUEL';
  }): Promise<APIResponse<{
    locations: Array<{
      location: {
        id: string;
        name: string;
        address: string;
        locationType: string;
        latitude: number;
        longitude: number;
        contactPerson?: string;
        contactPhone?: string;
      };
      distance: number;
      bearing: number;
    }>;
    searchCriteria: {
      latitude: number;
      longitude: number;
      radiusMeters: number;
      phase: string;
      locationType?: string[];
    };
    timestamp: string;
  }>> {
    try {
      console.log('🔍 近隣地点検索API呼び出し:', data);
      
      const response = await this.axiosInstance.post<APIResponse<any>>(
        '/mobile/operations/nearby-locations',
        data
      );
      
      console.log('✅ 近隣地点検索成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 近隣地点検索エラー:', error);
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
   * 🆕 新規地点登録（クイック登録）
   * POST /api/v1/mobile/locations/quick
   * 
   * 【機能概要】
   * - 近隣地点が見つからない場合に新規地点を登録
   * - GPS座標と地点名を指定して登録
   * - 住所は自動取得（Geocoding API）またはクライアント側で取得
   * 
   * 【パラメータ】
   * @param data.name - 地点名（必須、2文字以上）
   * @param data.latitude - GPS緯度（必須）
   * @param data.longitude - GPS経度（必須）
   * @param data.locationType - 地点種別（必須: 'DEPOT'=積込場所, 'DESTINATION'=積降場所）
   * @param data.address - 住所（オプション）
   * 
   * 【戻り値】
   * LocationInfo型のレスポンス（登録された地点情報）
   * 
   * 【エラーハンドリング】
   * - ネットワークエラー時は再試行を促す
   * - バリデーションエラーはtoast表示
   * - 登録成功時は登録済みlocationIdを返却
   * 
   * 【使用例】
   * ```typescript
   * const response = await apiService.createQuickLocation({
   *   name: '○○建材センター',
   *   latitude: 34.7993,
   *   longitude: 135.6388,
   *   locationType: 'DEPOT',
   *   address: '大阪府○○市...'
   * });
   * ```
   * 
   * 【作成日】2025年12月7日
   */
  async createQuickLocation(data: {
    name: string;
    latitude: number;
    longitude: number;
    locationType: 'PICKUP' | 'DELIVERY';
    address?: string;
  }): Promise<APIResponse<LocationInfo>> {
    try {
      console.log('🆕 新規地点登録API呼び出し:', data);

      const response = await this.axiosInstance.post<APIResponse<LocationInfo>>(
        '/mobile/locations/quick',
        {
          name: data.name,
          latitude: data.latitude,
          longitude: data.longitude,
          locationType: data.locationType,
          address: data.address || ''
        }
      );

      console.log('✅ 新規地点登録成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 新規地点登録エラー:', error);
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

  // =============================================================================
  // ✅ 追加: 車両一覧取得API
  // =============================================================================

  /**
   * 車両一覧取得
   * GET /api/v1/mobile/vehicles
   */

  async getVehicleById(vehicleId: string): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(`/vehicles/${vehicleId}`);
      return response.data;
    } catch (error: any) {
      console.error('[API] getVehicleById エラー:', error);
      throw error;
    }
  }

  async getVehicles(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(
        '/mobile/vehicles',
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Get vehicles error:', error);
      throw error;
    }
  }
// =============================================================================
  // ✅ 追加: 品目一覧取得API
  // =============================================================================

  /**
   * 品目一覧取得
   * GET /api/v1/items
   */
  async getItems(params?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(
        '/items',
        { params: { isActive: true, limit: 100, ...params } }
      );
      return response.data;
    } catch (error) {
      console.error('Get items error:', error);
      throw error;
    }
  }
  
  // =============================================================================
  // ✅ 追加: 点検項目管理API
  // =============================================================================

  /**
   * 点検項目一覧取得（乗車前/乗車後でフィルタ）
   * GET /api/v1/inspections/items?inspectionType=PRE_TRIP
   * 🔧 デバッグ出力追加版
   */
  async getInspectionItems(params?: {
    inspectionType?: 'PRE_TRIP' | 'POST_TRIP';
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<APIResponse<any>> {
    try {
      // 🔧🔧🔧 デバッグ1: メソッド開始
      console.log('🔧🔧🔧 [DEBUG-api.ts] getInspectionItems メソッド開始', {
        params,
        timestamp: new Date().toISOString()
      });

      // 🔧🔧🔧 デバッグ2: axiosInstance設定確認
      console.log('🔍🔍🔍 [DEBUG-api.ts] axiosInstance設定', {
        baseURL: this.axiosInstance.defaults.baseURL,
        timeout: this.axiosInstance.defaults.timeout,
        headers: this.axiosInstance.defaults.headers,
        timestamp: new Date().toISOString()
      });

      // ✅ 修正: 正しいエンドポイントに変更
      const fullURL = `${this.axiosInstance.defaults.baseURL}/inspection-items`;
      console.log('🔍🔍🔍 [DEBUG-api.ts] リクエストURL', {
        fullURL,
        params,
        timestamp: new Date().toISOString()
      });

      // 🔧🔧🔧 デバッグ4: トークン確認
      const token = this.getToken();
      console.log('🔍🔍🔍 [DEBUG-api.ts] 認証トークン', {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'なし',
        timestamp: new Date().toISOString()
      });

      // 🔧🔧🔧 デバッグ5: axios.get実行前
      console.log('🔍🔍🔍 [DEBUG-api.ts] axios.get実行開始', {
        endpoint: '/inspection-items',
        params,
        timestamp: new Date().toISOString()
      });

      // ✅✅✅ 修正: エンドポイントパスを変更
      const response = await this.axiosInstance.get<APIResponse<any>>(
        '/inspection-items',
        { params }
      );

      // 🔧🔧🔧 デバッグ6: axios.get実行後
      console.log('🔍🔍🔍 [DEBUG-api.ts] axios.get実行完了', {
        status: response.status,
        statusText: response.statusText,
        dataKeys: Object.keys(response.data || {}),
        timestamp: new Date().toISOString()
      });

      // 🔧🔧🔧 デバッグ7: レスポンスデータ詳細
      console.log('🔍🔍🔍 [DEBUG-api.ts] レスポンスデータ詳細', {
        success: response.data?.success,
        dataLength: response.data?.data?.length,
        message: response.data?.message,
        timestamp: new Date().toISOString()
      });

      return response.data;
    } catch (error: any) {
      // 🔧🔧🔧 デバッグ8: エラー詳細
      console.error('❌❌❌ [DEBUG-api.ts] getInspectionItems エラー（詳細）', {
        errorType: error?.constructor?.name,
        code: error?.code,
        message: error?.message,
        response: {
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          data: error?.response?.data
        },
        request: {
          url: error?.config?.url,
          method: error?.config?.method,
          baseURL: error?.config?.baseURL,
          timeout: error?.config?.timeout
        },
        stack: error?.stack,
        timestamp: new Date().toISOString()
      });

      console.error('Get inspection items error:', error);
      throw error;
    }
  }

  /**
   * 点検記録作成
   * POST /api/v1/inspections/records
   */
  async createInspectionRecord(data: {
    vehicleId: string;
    inspectorId: string;
    inspectionType: 'PRE_TRIP' | 'POST_TRIP';
    results: Array<{
      inspectionItemId: string;
      resultValue: string;
      isPassed: boolean;
      notes?: string;
    }>;
    operationId?: string;
    notes?: string;
  }): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.post<APIResponse<any>>(
        '/inspections',
        data
      );
      return response.data;
    } catch (error) {
      console.error('Create inspection record error:', error);
      throw error;
    }
  }

  // =============================================================================
  // 🆕 客先マスタAPI
  // =============================================================================

  /**
   * 客先一覧取得
   * GET /api/v1/customers
   */
  async updateActivityRecord(activityId: string, body: Record<string, any>): Promise<any> {
    try {
      const response = await this.axiosInstance.put(
        `/operation-details/${activityId}`,
        body
      );
      return response.data;
    } catch (error) {
      console.error('updateActivityRecord error:', error);
      throw error;
    }
  }

  async getCustomers(): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.get<APIResponse<any>>(
        '/customers',
        { params: { isActive: 'true', limit: 200 } }
      );
      return response.data;
    } catch (error) {
      console.error('客先一覧取得エラー:', error);
      return { success: false, data: { customers: [] }, message: '客先の取得に失敗しました' };
    }
  }

  /**
   * 客先変更（運行中）
   * PATCH /api/v1/mobile/operations/:id/customer
   * REQ-011: 別客先へ切替
   */
  async changeOperationCustomer(operationId: string, customerId: string): Promise<APIResponse<any>> {
    try {
      const response = await this.axiosInstance.patch<APIResponse<any>>(
        `/mobile/operations/${operationId}/customer`,
        { customerId }
      );
      return response.data;
    } catch (error) {
      console.error('客先変更エラー:', error);
      return { success: false, data: null, message: '客先の変更に失敗しました' };
    }
  }

}

// =============================================================================
// BUG-022: 500系エラー種別判定ヘルパー
// =============================================================================

/**
 * サーバーエラーがリトライ可能（一時的）かを判定する
 * バックエンド errorHandler.ts が返す errorCode フィールドを活用
 *
 * リトライ可能（一時的）:
 *   - 503 Service Unavailable
 *   - DATABASE_CONNECTION_FAILED （DB接続タイムアウト）
 *   - EXTERNAL_SERVICE_UNAVAILABLE（外部サービス停止）
 *   - REQUEST_TIMEOUT             （リクエストタイムアウト）
 *
 * リトライ不可（恒久的）:
 *   - DATABASE_ERROR, DUPLICATE_ENTRY, CONFLICT_ERROR,
 *     VALIDATION_ERROR, CONFIGURATION_ERROR, その他500
 */

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
  label = 'API'
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isNetworkErr = !err.response || err.code === 'ECONNABORTED' || err.message?.includes('Network Error');
      const isRetryable = isNetworkErr || err.response?.status === 503;
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[${label}] 試行${attempt}失敗、${delay}ms後にリトライ:`, err.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

function isRetryableServerError(status: number, errorCode: string): boolean {
  if (status === 503) return true;
  const retryableCodes: string[] = [
    'DATABASE_CONNECTION_FAILED',
    'EXTERNAL_SERVICE_UNAVAILABLE',
    'REQUEST_TIMEOUT',
  ];
  return retryableCodes.includes(errorCode);
}

// シングルトンインスタンスをエクスポート
const apiService = new APIServiceClass();

// ✅ デフォルトエクスポートと名前付きエクスポートの両方を提供
export { apiService };           // 名前付きエクスポート
export default apiService;       // デフォルトエクスポート

// =============================================================================
// 🆕🆕🆕 休憩管理・給油記録API追加サマリー（2025年12月28日）
// =============================================================================

/**
 * 【2025年12月28日追加内容】
 *
 * ✅ 追加メソッド:
 * 1. startBreak(tripId, data)
 *    - POST /api/v1/trips/:tripId/break/start
 *    - 休憩開始記録
 *    - GPS座標と休憩場所を記録（オプション）
 *
 * 2. endBreak(tripId, data)
 *    - POST /api/v1/trips/:tripId/break/end
 *    - 休憩終了記録
 *    - 休憩時間を自動計算
 *
 * 3. recordFuel(tripId, data)
 *    - POST /api/v1/trips/:tripId/fuel
 *    - 給油記録保存
 *    - 給油量・金額・給油所名を記録
 *
 * ✅ 既存機能との関係:
 * - recordLoadingArrival()メソッドは既存のまま保持
 * - recordUnloadingArrival()メソッドは既存のまま保持
 * - すべての既存メソッドとコメントを100%保持
 *
 * 📱 使用フロー:
 * 1. 休憩開始ボタンクリック → startBreak() 呼び出し
 * 2. 休憩終了ボタンクリック → endBreak() 呼び出し
 * 3. 給油記録保存ボタンクリック → recordFuel() 呼び出し
 */