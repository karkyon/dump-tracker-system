import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from './constants';
import { ApiResponse, LoginCredentials, User } from '../types';

// エラーメッセージ定数
const ERROR_MESSAGES = {
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  SERVER_ERROR: 'サーバーエラーが発生しました',
  UNAUTHORIZED: '認証が必要です',
  FORBIDDEN: 'アクセス権限がありません',
  NOT_FOUND: 'リソースが見つかりません',
  VALIDATION_ERROR: '入力値にエラーがあります',
  LOGIN_FAILED: 'ログインに失敗しました',
  TOKEN_EXPIRED: 'セッションが期限切れです'
};

// Axios インスタンスの作成
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
api.interceptors.request.use(
  (config) => {
    // リクエストログ
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
      baseURL: config.baseURL,
      data: config.data,
      params: config.params
    });

    // 認証トークンを追加
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // レスポンスログ
    console.log(`[API Response] ${response.status}`, {
      url: response.config.url,
      data: response.data
    });
    
    return response;
  },
  (error) => {
    console.error('[API Response Error]', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      data: error.response?.data
    });

    // 認証エラーの場合、自動的にログアウト
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_LOGIN);
      
      // ログインページでない場合のみリダイレクト
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// エラーハンドリング用ヘルパー関数
const handleError = (error: any): ApiResponse<any> => {
  console.error('[API Error Handler]', error);

  if (error.response) {
    // サーバーからのエラーレスポンス
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 400:
        return {
          success: false,
          error: data.error || 'VALIDATION_ERROR',
          message: data.message || ERROR_MESSAGES.VALIDATION_ERROR
        };
      case 401:
        return {
          success: false,
          error: data.error || 'UNAUTHORIZED',
          message: data.message || ERROR_MESSAGES.UNAUTHORIZED
        };
      case 403:
        return {
          success: false,
          error: data.error || 'FORBIDDEN',
          message: data.message || ERROR_MESSAGES.FORBIDDEN
        };
      case 404:
        return {
          success: false,
          error: data.error || 'NOT_FOUND',
          message: data.message || ERROR_MESSAGES.NOT_FOUND
        };
      case 500:
        return {
          success: false,
          error: data.error || 'SERVER_ERROR',
          message: data.message || ERROR_MESSAGES.SERVER_ERROR
        };
      default:
        return {
          success: false,
          error: data.error || 'SERVER_ERROR',
          message: data.message || ERROR_MESSAGES.SERVER_ERROR
        };
    }
  } else if (error.request) {
    // ネットワークエラー
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.NETWORK_ERROR
    };
  } else {
    // その他のエラー
    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: error.message || '予期しないエラーが発生しました'
    };
  }
};

// API関数群
export const apiClient = {
  // 基本的なHTTPメソッド
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await api.get(url, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return handleError(error);
    }
  },

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await api.post(url, data, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return handleError(error);
    }
  },

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await api.put(url, data, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return handleError(error);
    }
  },

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await api.delete(url, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return handleError(error);
    }
  },

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await api.patch(url, data, config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return handleError(error);
    }
  }
};

// ===================================
// 認証関連API
// ===================================

export const authAPI = {
  /**
   * ログイン
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>> {
    console.log('[Auth API] Login attempt', { username: credentials.username });
    
    try {
      const response = await api.post('/auth/login', {
        username: credentials.username,
        password: credentials.password
      });

      console.log('[Auth API] Login response received', response.data);

      // レスポンス構造の確認と正規化
      if (response.data.success && response.data.data) {
        const { user, accessToken, refreshToken } = response.data.data;
        
        return {
          success: true,
          data: {
            user,
            accessToken,
            refreshToken
          },
          message: response.data.message || 'ログインに成功しました'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'LOGIN_FAILED',
          message: response.data.message || ERROR_MESSAGES.LOGIN_FAILED
        };
      }
    } catch (error: any) {
      console.error('[Auth API] Login error', error);
      return handleError(error);
    }
  },

  /**
   * ログアウト
   */
  async logout(): Promise<ApiResponse<void>> {
    console.log('[Auth API] Logout attempt');
    
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const response = await api.post('/auth/logout', { refreshToken });
      
      return {
        success: true,
        data: undefined,
        message: response.data.message || 'ログアウトしました'
      };
    } catch (error: any) {
      console.error('[Auth API] Logout error', error);
      return handleError(error);
    }
  },

  /**
   * 現在のユーザー情報取得
   */
  async getProfile(): Promise<ApiResponse<User>> {
    console.log('[Auth API] Get profile attempt');
    
    try {
      const response = await api.get('/auth/me');
      
      if (response.data.success && response.data.data) {
        return {
          success: true,
          data: response.data.data.user,
          message: response.data.message
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'USER_FETCH_ERROR',
          message: response.data.message || 'ユーザー情報の取得に失敗しました'
        };
      }
    } catch (error: any) {
      console.error('[Auth API] Get profile error', error);
      return handleError(error);
    }
  },

  /**
   * トークンリフレッシュ
   */
  async refreshToken(): Promise<ApiResponse<{ accessToken: string; refreshToken?: string }>> {
    console.log('[Auth API] Token refresh attempt');
    
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        return {
          success: false,
          error: 'NO_REFRESH_TOKEN',
          message: 'リフレッシュトークンがありません'
        };
      }

      const response = await api.post('/auth/refresh', { refreshToken });
      
      if (response.data.success && response.data.data) {
        const newAccessToken = response.data.data.accessToken;
        const newRefreshToken = response.data.data.refreshToken;
        
        // トークンを更新
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }
        
        return {
          success: true,
          data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
          },
          message: response.data.message || 'トークンをリフレッシュしました'
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'TOKEN_REFRESH_FAILED',
          message: response.data.message || 'トークンリフレッシュに失敗しました'
        };
      }
    } catch (error: any) {
      console.error('[Auth API] Token refresh error', error);
      return handleError(error);
    }
  },

  /**
   * パスワード変更
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    console.log('[Auth API] Password change attempt');
    
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      
      return {
        success: true,
        data: undefined,
        message: response.data.message || 'パスワードを変更しました'
      };
    } catch (error: any) {
      console.error('[Auth API] Password change error', error);
      return handleError(error);
    }
  }
};

// ===================================
// ユーザー関連API
// ===================================

export const userAPI = {
  /**
   * ユーザー一覧取得
   * 
   * ✅✅✅ 修正: バックエンドのレスポンス構造に合わせて型定義を修正
   * バックエンドレスポンス: { success: true, data: { users: [...], pagination: {...} } }
   * 
   * ✅✅✅ 修正追加: pageSize → limit 変換処理を追加（バックエンド互換性）
   */
  async getUsers(params?: { 
    page?: number; 
    limit?: number; 
    pageSize?: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<ApiResponse<{ 
    users: User[]; 
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  }>> {
    console.log('[User API] Get users attempt', params);
    
    // ✅ 修正: pageSizeをlimitに変換（バックエンド互換性のため）
    // バックエンドは limit パラメータを期待しているが、
    // フロントエンドのuserStoreは pageSize を送信するため変換が必要
    const apiParams = params ? { ...params } : {};
    if (apiParams.pageSize && !apiParams.limit) {
      apiParams.limit = apiParams.pageSize;
      delete apiParams.pageSize;
    }
    
    console.log('[User API] Converted params (pageSize→limit):', apiParams);
    
    return apiClient.get('/users', { params: apiParams });
  },

  /**
   * ユーザー作成
   */
  async createUser(userData: Partial<User>): Promise<ApiResponse<User>> {
    return apiClient.post('/users', userData);
  },

  /**
   * ユーザー更新
   */
  async updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return apiClient.put(`/users/${id}`, userData);
  },

  /**
   * ユーザー削除
   */
  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/users/${id}`);
  }
};

// ===================================
// 車両関連API
// ===================================

export const vehicleAPI = {
  /**
   * 車両一覧取得
   */
  async getVehicles(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<any>> {
    return apiClient.get('/vehicles', { params });
  },

  /**
   * 車両作成
   */
  async createVehicle(vehicleData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/vehicles', vehicleData);
  },

  /**
   * 車両更新
   */
  async updateVehicle(id: string, vehicleData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/vehicles/${id}`, vehicleData);
  },

  /**
   * 車両削除
   */
  async deleteVehicle(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/vehicles/${id}`);
  }
};

// ===================================
// ヘルスチェックAPI
// ===================================

export const healthAPI = {
  /**
   * ヘルスチェック
   */
  async check(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return apiClient.get('/health');
  }
};

// ===================================
// 点検項目関連API
// ===================================

export const inspectionItemAPI = {
  /**
   * 点検項目一覧取得
   */
  async getInspectionItems(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/inspection-items', { params });
  },

  /**
   * 点検項目作成
   */
  async createInspectionItem(itemData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/inspection-items', itemData);
  },

  /**
   * 点検項目更新
   */
  async updateInspectionItem(id: string, itemData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/inspection-items/${id}`, itemData);
  },

  /**
   * 点検項目削除
   */
  async deleteInspectionItem(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/inspection-items/${id}`);
  },

  /**
   * 表示順更新
   */
  async updateOrder(items: { id: string; order: number }[]): Promise<ApiResponse<void>> {
    return apiClient.post('/inspection-items/update-order', { items });
  }
};

// ===================================
// 場所関連API
// ===================================

export const locationAPI = {
  /**
   * 場所一覧取得
   */
  async getLocations(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/locations', { params });
  },

  /**
   * 場所作成
   */
  async createLocation(locationData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/locations', locationData);
  },

  /**
   * 場所更新
   */
  async updateLocation(id: string, locationData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/locations/${id}`, locationData);
  },

  /**
   * 場所削除
   */
  async deleteLocation(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/locations/${id}`);
  }
};

// ===================================
// 品目関連API
// ===================================

export const itemAPI = {
  /**
   * 品目一覧取得
   */
  async getItems(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/items', { params });
  },

  /**
   * 品目作成
   */
  async createItem(cargoData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/items', cargoData);
  },

  /**
   * 品目更新
   */
  async updateItem(id: string, cargoData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/items/${id}`, cargoData);
  },

  /**
   * 品目削除
   */
  async deleteItem(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/items/${id}`);
  },

  /**
   * 表示順更新
   */
  async updateOrder(items: { id: string; order: number }[]): Promise<ApiResponse<void>> {
    return apiClient.post('/items/update-order', { items });
  }
};

// ===================================
// 運行記録関連API
// ===================================

export const operationAPI = {
  /**
   * 運行記録一覧取得
   */
  async getOperations(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/operations', { params });
  },

  /**
   * 運行記録作成
   */
  async createOperation(operationData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/operations', operationData);
  },

  /**
   * 運行記録更新
   */
  async updateOperation(id: string, operationData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/operations/${id}`, operationData);
  },

  /**
   * 運行記録削除
   */
  async deleteOperation(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/operations/${id}`);
  },

  /**
   * 運行記録詳細取得
   */
  async getOperation(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/operations/${id}`);
  },

  /**
   * 運行記録ステータス更新
   */
  async updateStatus(id: string, status: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/operations/${id}/status`, { status });
  }
};

// ===================================
// GPS関連API
// ===================================

export const gpsAPI = {
  /**
   * GPS位置情報取得
   */
  async getGpsLocations(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/gps/locations', { params });
  },

  /**
   * リアルタイム位置情報取得
   */
  async getRealTimeLocation(vehicleId: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/gps/vehicles/${vehicleId}/location`);
  },

  /**
   * GPS履歴取得
   */
  async getGpsHistory(vehicleId: string, params?: any): Promise<ApiResponse<any>> {
    return apiClient.get(`/gps/vehicles/${vehicleId}/history`, { params });
  },

  /**
   * GPS設定更新
   */
  async updateGpsSettings(vehicleId: string, settings: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/gps/vehicles/${vehicleId}/settings`, settings);
  }
};

// ===================================
// レポート関連API
// ===================================

export const reportAPI = {
  /**
   * 日報取得
   */
  async getDailyReport(date: string, params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/reports/daily', { params: { date, ...params } });
  },

  /**
   * 月報取得
   */
  async getMonthlyReport(year: number, month: number, params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/reports/monthly', { params: { year, month, ...params } });
  },

  /**
   * 年報取得
   */
  async getAnnualReport(year: number, params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/reports/annual', { params: { year, ...params } });
  },

  /**
   * カスタムレポート取得
   */
  async getCustomReport(filters: any): Promise<ApiResponse<any>> {
    return apiClient.post('/reports/custom', filters);
  },

  /**
   * PDF出力
   */
  async exportPdf(reportType: string, params: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/reports/export/pdf`, { reportType, ...params }, {
      responseType: 'blob'
    });
  },

  /**
   * Excel出力
   */
  async exportExcel(reportType: string, params: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/reports/export/excel`, { reportType, ...params }, {
      responseType: 'blob'
    });
  }
};

// デフォルトエクスポート
export default api;
