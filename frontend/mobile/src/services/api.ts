// src/services/api.ts - 完全機能版モバイルAPIクライアント

import axios, { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import { toast } from 'react-hot-toast';
import type { 
  User, 
  OperationInfo, 
  Position, 
  GPSLogData, 
  APIResponse 
} from '../types';

// =============================================================================
// 設定とタイプ定義
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1';
const API_TIMEOUT = 30000;
const OFFLINE_RETRY_ATTEMPTS = 3;
const OFFLINE_RETRY_DELAY = 1000;

// 認証関連の型定義
interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
  refreshToken?: string;
}

// 運行管理の型定義
interface StartOperationRequest {
  vehicleId: string;
  startTime?: string;
  startLocation?: Position;
  loadingLocation: string;
  notes?: string;
}

interface RecordActionRequest {
  operationId: string;
  actionType: string;
  itemId?: string;
  locationId?: string;
  quantity?: number;
  unit?: string;
  location?: Position;
  timestamp?: string;
  notes?: string;
}

interface EndOperationRequest {
  operationId: string;
  endTime?: string;
  finalLocation?: Position;
  totalDistance?: number;
  fuelUsed?: number;
  notes?: string;
}

// GPS関連の型定義
interface GPSLogRequest {
  operationId?: string;
  vehicleId?: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speedKmh?: number;
  heading?: number;
  accuracyMeters?: number;
  timestamp: string;
}

// ネットワーク状態の型定義
interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'online' | 'offline' | 'slow' | 'unknown';
}

// オフラインデータの型定義
interface OfflineDataEntry {
  id: string;
  type: 'gps' | 'action' | 'operation';
  data: any;
  timestamp: number;
  retryCount: number;
}

// =============================================================================
// ネットワーク監視クラス
// =============================================================================

class NetworkMonitor {
  private isOnline: boolean = navigator.onLine;
  private listeners: ((status: NetworkStatus) => void)[] = [];

  constructor() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notifyListeners({ isOnline: true, connectionType: 'online' });
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notifyListeners({ isOnline: false, connectionType: 'offline' });
  };

  private notifyListeners(status: NetworkStatus) {
    this.listeners.forEach(listener => listener(status));
  }

  public subscribe(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public getStatus(): NetworkStatus {
    return {
      isOnline: this.isOnline,
      connectionType: this.isOnline ? 'online' : 'offline'
    };
  }

  public destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners = [];
  }
}

// =============================================================================
// オフラインデータ管理クラス
// =============================================================================

class OfflineDataManager {
  private readonly STORAGE_KEY = 'mobile_offline_data';
  private readonly MAX_ENTRIES = 1000;
  private readonly MAX_AGE = 24 * 60 * 60 * 1000; // 24時間

  public save(type: OfflineDataEntry['type'], data: any): string {
    try {
      const entry: OfflineDataEntry = {
        id: crypto.randomUUID(),
        type,
        data,
        timestamp: Date.now(),
        retryCount: 0
      };

      const entries = this.getAll();
      entries.push(entry);

      // 古いエントリと過多なエントリを削除
      const cleanedEntries = this.cleanEntries(entries);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cleanedEntries));
      return entry.id;
    } catch (error) {
      console.error('Failed to save offline data:', error);
      return '';
    }
  }

  public getAll(): OfflineDataEntry[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get offline data:', error);
      return [];
    }
  }

  public remove(id: string): void {
    try {
      const entries = this.getAll().filter(entry => entry.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to remove offline data:', error);
    }
  }

  public incrementRetry(id: string): void {
    try {
      const entries = this.getAll().map(entry => 
        entry.id === id ? { ...entry, retryCount: entry.retryCount + 1 } : entry
      );
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to increment retry count:', error);
    }
  }

  private cleanEntries(entries: OfflineDataEntry[]): OfflineDataEntry[] {
    const now = Date.now();
    
    // 古いエントリを削除
    const validEntries = entries.filter(entry => 
      now - entry.timestamp < this.MAX_AGE && 
      entry.retryCount < OFFLINE_RETRY_ATTEMPTS
    );

    // 最新のエントリのみ保持
    return validEntries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.MAX_ENTRIES);
  }

  public clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }

  public getCount(): number {
    return this.getAll().length;
  }
}

// =============================================================================
// APIクライアントクラス
// =============================================================================

class APIServiceClass {
  private api: AxiosInstance;
  private token: string | null = null;
  private networkMonitor: NetworkMonitor;
  private offlineManager: OfflineDataManager;
  private syncInProgress: boolean = false;

  constructor() {
    this.networkMonitor = new NetworkMonitor();
    this.offlineManager = new OfflineDataManager();
    this.token = localStorage.getItem('auth_token');
    this.api = this.createAxiosInstance();
    this.setupNetworkListener();
  }

  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // リクエストインターセプター
    instance.interceptors.request.use(
      (config) => {
        const token = this.token || localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // デバッグログ
        if (import.meta.env.DEV) {
          console.log('[API Request]', config.method?.toUpperCase(), config.url, config.data);
        }

        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    instance.interceptors.response.use(
      (response: AxiosResponse) => {
        if (import.meta.env.DEV) {
          console.log('[API Response]', response.status, response.config.url, response.data);
        }
        return response;
      },
      async (error: AxiosError) => {
        console.error('[API Response Error]', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          data: error.response?.data
        });

        // 認証エラー処理
        if (error.response?.status === 401) {
          this.handleAuthError();
          return Promise.reject(error);
        }

        // ネットワークエラー処理
        if (!error.response && error.code === 'NETWORK_ERROR') {
          console.warn('[API] Network error detected, switching to offline mode');
        }

        return Promise.reject(error);
      }
    );

    return instance;
  }

  private setupNetworkListener(): void {
    this.networkMonitor.subscribe(async (status) => {
      if (status.isOnline && !this.syncInProgress) {
        await this.syncOfflineData();
      }
    });
  }

  private handleAuthError(): void {
    this.clearToken();
    toast.error('認証が無効です。再度ログインしてください。');
    
    // 認証エラー時はログイン画面にリダイレクト
    setTimeout(() => {
      window.location.href = '/login';
    }, 1500);
  }

  private async makeRequest<T>(
    requestConfig: AxiosRequestConfig,
    offlineType?: OfflineDataEntry['type'],
    offlineData?: any
  ): Promise<APIResponse<T>> {
    try {
      const response = await this.api.request(requestConfig);
      
      return {
        success: true,
        data: response.data.data || response.data,
        message: response.data.message
      };
    } catch (error: any) {
      // ネットワークエラーまたはオフライン時の処理
      if (!this.networkMonitor.getStatus().isOnline || 
          error.code === 'NETWORK_ERROR' || 
          !error.response) {
        
        // オフラインデータとして保存
        if (offlineType && offlineData) {
          this.offlineManager.save(offlineType, {
            requestConfig,
            data: offlineData
          });
          
          return {
            success: true,
            message: 'オフラインで保存しました。オンライン復帰時に同期されます。',
            data: undefined
          };
        }

        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'ネットワークエラー: オフラインで動作しています'
        };
      }

      // その他のエラー
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'APIエラーが発生しました';

      return {
        success: false,
        error: error.response?.data?.error || 'API_ERROR',
        message: errorMessage
      };
    }
  }

  // =============================================================================
  // 認証API
  // =============================================================================

  async login(credentials: LoginRequest): Promise<APIResponse<{ user: User; accessToken: string; refreshToken?: string }>> {
    try {
      console.log('[API Service] Login attempt', { username: credentials.username });

      const response = await this.makeRequest<LoginResponse>({
        method: 'POST',
        url: '/mobile/auth/login',
        data: credentials
      });

      if (response.success && response.data) {
        const { user, token, accessToken, refreshToken } = response.data as any;
        
        // トークンの設定（複数の可能な形式に対応）
        const authToken = accessToken || token;
        if (authToken) {
          this.setToken(authToken);
        }
        
        console.log('[API Service] Login successful');
        return {
          success: true,
          data: {
            user,
            accessToken: authToken,
            refreshToken
          },
          message: response.message || 'ログインに成功しました'
        };
      }

      throw new Error(response.message || 'ログインに失敗しました');

    } catch (error: any) {
      console.error('[API Service] Login error', error);

      // 開発モード時のフォールバック
      if (import.meta.env.DEV) {
        console.warn('[API Service] Development mode: Using dummy authentication');
        
        const dummyToken = 'dummy_jwt_token_' + Date.now();
        const dummyUser: User = {
          id: 'user_' + Date.now(),
          username: credentials.username,
          email: credentials.username + '@example.com',
          fullName: 'テスト運転手',
          role: 'driver',
          isActive: true,
          vehicleId: 'vehicle_1',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        this.setToken(dummyToken);
        
        return {
          success: true,
          data: {
            user: dummyUser,
            accessToken: dummyToken
          },
          message: 'ログインしました（開発モード）'
        };
      }

      return {
        success: false,
        error: 'LOGIN_FAILED',
        message: error.message || 'ログインに失敗しました'
      };
    }
  }

  async logout(): Promise<APIResponse> {
    try {
      const response = await this.makeRequest({
        method: 'POST',
        url: '/mobile/auth/logout'
      });

      // ローカルストレージをクリア
      this.clearToken();
      this.offlineManager.clear();

      return response;
    } catch (error) {
      // ログアウトは失敗しても問題ない
      this.clearToken();
      
      return { success: true, message: 'ログアウトしました' };
    }
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    return this.makeRequest<User>({
      method: 'GET',
      url: '/mobile/auth/me'
    });
  }

  // =============================================================================
  // 運行管理API
  // =============================================================================

  async startOperation(data: StartOperationRequest): Promise<APIResponse<OperationInfo>> {
    const requestData = {
      ...data,
      startTime: data.startTime || new Date().toISOString(),
      startLocation: data.startLocation || undefined
    };

    return this.makeRequest<OperationInfo>(
      {
        method: 'POST',
        url: '/mobile/operations/start',
        data: requestData
      },
      'operation',
      requestData
    );
  }

  async getCurrentOperation(): Promise<APIResponse<OperationInfo>> {
    return this.makeRequest<OperationInfo>({
      method: 'GET',
      url: '/mobile/operations/current'
    });
  }

  async recordAction(data: RecordActionRequest): Promise<APIResponse> {
    const requestData = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
      location: data.location || undefined
    };

    return this.makeRequest(
      {
        method: 'POST',
        url: '/mobile/operations/action',
        data: requestData
      },
      'action',
      requestData
    );
  }

  async endOperation(data: EndOperationRequest): Promise<APIResponse<OperationInfo>> {
    const requestData = {
      ...data,
      endTime: data.endTime || new Date().toISOString(),
      finalLocation: data.finalLocation || undefined
    };

    return this.makeRequest<OperationInfo>({
      method: 'POST',
      url: `/mobile/operations/${data.operationId}/end`,
      data: requestData
    });
  }

  // =============================================================================
  // GPS関連API
  // =============================================================================

  // GPS位置情報の更新
  async logGPS(data: GPSLogRequest): Promise<APIResponse> {
    const requestData = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    };

    return this.makeRequest(
      {
        method: 'POST',
        url: '/mobile/gps/log',
        data: requestData
      },
      'gps',
      requestData
    );
  }

  // GPS位置情報の更新
  async updateGPSLocation(data: GPSLogRequest): Promise<APIResponse> {
    const requestData = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    };

    return this.makeRequest(
      {
        method: 'POST',
        url: '/mobile/gps/update',
        data: requestData
      },
      'gps',
      requestData
    );
  }

  // GPS位置情報の一括送信
  async logGPSBulk(gpsData: GPSLogRequest[]): Promise<APIResponse> {
    return this.makeRequest({
      method: 'POST',
      url: '/mobile/gps/bulk',
      data: { gpsData }
    });
  }

  // 運行履歴に基づくGPSログの取得
  async getGPSHistory(operationId: string): Promise<APIResponse<GPSLogData[]>> {
    return this.makeRequest<GPSLogData[]>({
      method: 'GET',
      url: `/mobile/gps/history/${operationId}`
    });
  }

  // =============================================================================
  // マスターデータAPI
  // =============================================================================

  async getVehicles(): Promise<APIResponse<any[]>> {
    return this.makeRequest<any[]>({
      method: 'GET',
      url: '/mobile/vehicles'
    });
  }

  async getItems(): Promise<APIResponse<any[]>> {
    return this.makeRequest<any[]>({
      method: 'GET',
      url: '/mobile/items'
    });
  }

  async getLocations(): Promise<APIResponse<any[]>> {
    return this.makeRequest<any[]>({
      method: 'GET',
      url: '/mobile/locations'
    });
  }

  // =============================================================================
  // ヘルスチェック・接続確認
  // =============================================================================

  async healthCheck(): Promise<APIResponse> {
    try {
      const response = await this.api.get('/mobile/health', { timeout: 10000 });
      return {
        success: true,
        data: response.data,
        message: 'サーバー接続正常'
      };
    } catch (error) {
      return {
        success: false,
        error: 'CONNECTION_ERROR',
        message: 'サーバーに接続できません'
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.healthCheck();
      return response.success;
    } catch (error) {
      return false;
    }
  }

  // =============================================================================
  // オフラインデータ同期
  // =============================================================================

  private async syncOfflineData(): Promise<void> {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    const entries = this.offlineManager.getAll();
    
    if (entries.length === 0) {
      this.syncInProgress = false;
      return;
    }

    console.log(`[API Service] Syncing ${entries.length} offline entries`);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of entries) {
      try {
        const { requestConfig } = entry.data;
        await this.api.request(requestConfig);
        
        this.offlineManager.remove(entry.id);
        successCount++;
      } catch (error) {
        console.error(`[API Service] Failed to sync entry ${entry.id}:`, error);
        
        this.offlineManager.incrementRetry(entry.id);
        errorCount++;
        
        // 連続失敗を避けるため少し待機
        await new Promise(resolve => setTimeout(resolve, OFFLINE_RETRY_DELAY));
      }
    }

    console.log(`[API Service] Sync completed: ${successCount} success, ${errorCount} failed`);
    
    if (successCount > 0) {
      toast.success(`${successCount}件のデータを同期しました`);
    }
    
    if (errorCount > 0 && successCount === 0) {
      toast.error('データの同期に失敗しました');
    }

    this.syncInProgress = false;
  }

  // =============================================================================
  // ユーティリティメソッド
  // =============================================================================

  public getNetworkStatus(): NetworkStatus {
    return this.networkMonitor.getStatus();
  }

  public getOfflineDataCount(): number {
    return this.offlineManager.getCount();
  }

  public clearOfflineData(): void {
    this.offlineManager.clear();
    toast.success('オフラインデータを削除しました');
  }

  public async forceSyncOfflineData(): Promise<void> {
    await this.syncOfflineData();
  }

  async checkAuth(): Promise<APIResponse<boolean>> {
    try {
      const response = await this.getCurrentUser();
      return {
        success: response.success,
        data: response.success,
        message: response.message
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        message: '認証チェックに失敗しました'
      };
    }
  }

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
    return API_BASE_URL;
  }

  public destroy(): void {
    this.networkMonitor.destroy();
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
  getCurrentUser: () => apiService.getCurrentUser()
};

export const operationApi = {
  start: (data: StartOperationRequest) => apiService.startOperation(data),
  getCurrent: () => apiService.getCurrentOperation(),
  recordAction: (data: RecordActionRequest) => apiService.recordAction(data),
  end: (data: EndOperationRequest) => apiService.endOperation(data)
};

export const gpsApi = {
  log: (data: GPSLogRequest) => apiService.updateGPSLocation(data),
  logBulk: (data: GPSLogRequest[]) => apiService.logGPSBulk(data),
  getHistory: (operationId: string) => apiService.getGPSHistory(operationId)
};

// デフォルトエクスポート
export default apiService;