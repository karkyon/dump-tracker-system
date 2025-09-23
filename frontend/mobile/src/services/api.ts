// frontend/mobile/src/services/api.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';

// API設定
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1';

// 型定義
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface LoginRequest {
  userId: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    userId: string;
    name: string;
    role: string;
    vehicleId: string;
  };
}

interface StartOperationRequest {
  vehicleId: string;
  startTime: string;
  startLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface OperationInfo {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  loadingLocation?: string;
  unloadingLocation?: string;
  cargoInfo?: string;
  status: string;
}

interface EndOperationRequest {
  endTime: string;
  totalDistance: number;
  finalLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface RecordActionRequest {
  operationId: string;
  action: string;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface GPSLogRequest {
  operationId: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speedKmh?: number | null;
  heading?: number | null;
  accuracyMeters?: number | null;
  timestamp: string;
}

// Axiosインスタンス作成
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // モバイル環境を考慮して長めに設定
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // リクエストインターセプター（認証トークン自動付与）
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      console.error('Request error:', error);
      return Promise.reject(error);
    }
  );

  // レスポンスインターセプター（エラーハンドリング）
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error) => {
      console.error('Response error:', error);

      // 認証エラーの場合はログアウト処理
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        toast.error('認証が無効です。再度ログインしてください。');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // ネットワークエラーの場合
      if (!error.response) {
        toast.error('ネットワークエラーが発生しました。接続を確認してください。');
        return Promise.reject(error);
      }

      // その他のエラー
      const message = error.response?.data?.message || 'APIエラーが発生しました';
      toast.error(message);
      
      return Promise.reject(error);
    }
  );

  return instance;
};

// APIインスタンス
const api = createApiInstance();

// 認証API
export const authApi = {
  /**
   * ログイン
   */
  login: async (data: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    try {
      const response = await api.post('/mobile/auth/login', data);
      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
      
      // 開発中はダミーデータを返す
      if (process.env.NODE_ENV === 'development' || !navigator.onLine) {
        console.warn('開発モード: ダミーログインデータを使用');
        return {
          success: true,
          data: {
            token: 'dummy_jwt_token_' + Date.now(),
            user: {
              id: data.userId,
              userId: data.userId,
              name: 'テスト運転手',
              role: 'driver',
              vehicleId: 'vehicle_1'
            }
          }
        };
      }
      
      throw error;
    }
  },

  /**
   * ログアウト
   */
  logout: async (): Promise<ApiResponse> => {
    try {
      const response = await api.post('/mobile/auth/logout');
      return response.data;
    } catch (error) {
      console.error('Logout error:', error);
      // ログアウトはローカルでも実行
      return { success: true };
    }
  }
};

// モバイル運行API
export const mobileApi = {
  /**
   * 運行開始
   */
  startOperation: async (data: StartOperationRequest): Promise<ApiResponse<OperationInfo>> => {
    try {
      const response = await api.post('/mobile/operations/start', data);
      return response.data;
    } catch (error) {
      console.error('Start operation error:', error);
      
      // 開発中はダミーデータを返す
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          data: {
            id: 'operation_' + Date.now(),
            vehicleId: data.vehicleId,
            driverId: 'driver_1',
            startTime: data.startTime,
            loadingLocation: '○○建設資材置場',
            unloadingLocation: '△△工事現場',
            cargoInfo: '砂利 12t',
            status: 'IN_PROGRESS'
          }
        };
      }
      
      throw error;
    }
  },

  /**
   * 現在の運行取得
   */
  getCurrentOperation: async (): Promise<ApiResponse<OperationInfo>> => {
    try {
      const response = await api.get('/mobile/operations/current');
      return response.data;
    } catch (error) {
      console.error('Get current operation error:', error);
      throw error;
    }
  },

  /**
   * 運行終了
   */
  endOperation: async (operationId: string, data: EndOperationRequest): Promise<ApiResponse> => {
    try {
      const response = await api.put(`/mobile/operations/${operationId}/end`, data);
      return response.data;
    } catch (error) {
      console.error('End operation error:', error);
      
      // 開発中は成功を返す
      if (process.env.NODE_ENV === 'development') {
        return { success: true, message: '運行を終了しました' };
      }
      
      throw error;
    }
  },

  /**
   * 運行アクション記録
   */
  recordAction: async (data: RecordActionRequest): Promise<ApiResponse> => {
    try {
      const response = await api.post('/mobile/operations/action', data);
      return response.data;
    } catch (error) {
      console.error('Record action error:', error);
      
      // 開発中は成功を返す
      if (process.env.NODE_ENV === 'development') {
        console.log('Action recorded (dev mode):', data);
        return { success: true, message: 'アクションを記録しました' };
      }
      
      throw error;
    }
  },

  /**
   * GPS位置情報記録
   */
  logGPS: async (data: GPSLogRequest): Promise<ApiResponse> => {
    try {
      const response = await api.post('/mobile/gps/log', data);
      return response.data;
    } catch (error) {
      console.error('GPS log error:', error);
      
      // 開発中は成功を返す（GPSデータは継続記録）
      if (process.env.NODE_ENV === 'development') {
        console.log('GPS logged (dev mode):', data);
        return { success: true, message: 'GPS位置情報を記録しました' };
      }
      
      // GPS記録エラーは継続を妨げない
      return { success: false, message: 'GPS記録に失敗しましたが、運行は継続します' };
    }
  },

  /**
   * GPS位置情報一括記録
   */
  logGPSBulk: async (gpsData: GPSLogRequest[]): Promise<ApiResponse> => {
    try {
      const response = await api.post('/mobile/gps/bulk', { gpsData });
      return response.data;
    } catch (error) {
      console.error('GPS bulk log error:', error);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('GPS bulk logged (dev mode):', gpsData.length, 'records');
        return { success: true, message: 'GPS位置情報を一括記録しました' };
      }
      
      return { success: false, message: 'GPS一括記録に失敗しました' };
    }
  },

  /**
   * GPS履歴取得
   */
  getGPSHistory: async (operationId: string): Promise<ApiResponse<GPSLogRequest[]>> => {
    try {
      const response = await api.get(`/mobile/gps/history/${operationId}`);
      return response.data;
    } catch (error) {
      console.error('Get GPS history error:', error);
      throw error;
    }
  },

  /**
   * ヘルスチェック
   */
  healthCheck: async (): Promise<ApiResponse> => {
    try {
      const response = await api.get('/mobile/health');
      return response.data;
    } catch (error) {
      console.error('Health check error:', error);
      return { 
        success: false, 
        message: 'サーバーに接続できません。オフラインモードで動作します。' 
      };
    }
  }
};

// エクスポート
export default api;

// ユーティリティ関数
export const apiUtils = {
  /**
   * 接続状態チェック
   */
  checkConnection: async (): Promise<boolean> => {
    try {
      const result = await mobileApi.healthCheck();
      return result.success;
    } catch {
      return false;
    }
  },

  /**
   * 認証状態チェック
   */
  checkAuth: (): boolean => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    return Boolean(token && userData);
  },

  /**
   * オフラインデータ保存
   */
  saveOfflineData: (key: string, data: any): void => {
    try {
      const offlineData = JSON.parse(localStorage.getItem('offline_data') || '{}');
      offlineData[key] = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem('offline_data', JSON.stringify(offlineData));
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  },

  /**
   * オフラインデータ取得
   */
  getOfflineData: (key: string): any => {
    try {
      const offlineData = JSON.parse(localStorage.getItem('offline_data') || '{}');
      return offlineData[key]?.data || null;
    } catch (error) {
      console.error('Failed to get offline data:', error);
      return null;
    }
  },

  /**
   * オフラインデータ同期
   */
  syncOfflineData: async (): Promise<void> => {
    try {
      const offlineData = JSON.parse(localStorage.getItem('offline_data') || '{}');
      
      for (const [key, value] of Object.entries(offlineData)) {
        const data = (value as any).data;
        const timestamp = (value as any).timestamp;
        
        // 24時間以内のデータのみ同期
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          if (key.startsWith('gps_')) {
            await mobileApi.logGPSBulk(data);
          } else if (key.startsWith('action_')) {
            await mobileApi.recordAction(data);
          }
        }
      }
      
      // 同期完了後はオフラインデータをクリア
      localStorage.removeItem('offline_data');
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }
};