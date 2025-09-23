import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from './constants';
import { ApiResponse, LoginCredentials, User } from '../types';

// =====================================
// デバッグ・ログ機能強化
// =====================================

const LOG_COLORS = {
  INFO: 'color: #2563eb; font-weight: bold',
  SUCCESS: 'color: #16a34a; font-weight: bold', 
  WARNING: 'color: #ea580c; font-weight: bold',
  ERROR: 'color: #dc2626; font-weight: bold',
  DEBUG: 'color: #7c3aed; font-weight: bold'
};

const logger = {
  info: (message: string, data?: any) => {
    console.log(`%c[API INFO] ${message}`, LOG_COLORS.INFO, data || '');
  },
  success: (message: string, data?: any) => {
    console.log(`%c[API SUCCESS] ${message}`, LOG_COLORS.SUCCESS, data || '');
  },
  warning: (message: string, data?: any) => {
    console.warn(`%c[API WARNING] ${message}`, LOG_COLORS.WARNING, data || '');
  },
  error: (message: string, data?: any) => {
    console.error(`%c[API ERROR] ${message}`, LOG_COLORS.ERROR, data || '');
  },
  debug: (message: string, data?: any) => {
    console.log(`%c[API DEBUG] ${message}`, LOG_COLORS.DEBUG, data || '');
  }
};

// =====================================
// エラーメッセージ定数（強化版）
// =====================================

const ERROR_MESSAGES = {
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  SERVER_ERROR: 'サーバーエラーが発生しました',
  UNAUTHORIZED: '認証が必要です',
  FORBIDDEN: 'アクセス権限がありません',
  NOT_FOUND: 'リソースが見つかりません',
  VALIDATION_ERROR: '入力値にエラーがあります',
  LOGIN_FAILED: 'ログインに失敗しました',
  TOKEN_EXPIRED: 'セッションが期限切れです',
  TIMEOUT_ERROR: 'リクエストがタイムアウトしました',
  SSL_ERROR: 'SSL証明書エラーが発生しました',
  CONNECTION_REFUSED: 'サーバーに接続できません',
  CORS_ERROR: 'CORS エラーが発生しました'
};

// =====================================
// 詳細なエラー分析関数
// =====================================

const analyzeError = (error: any) => {
  const analysis = {
    type: 'UNKNOWN',
    status: null,
    message: '',
    details: {},
    timestamp: new Date().toISOString()
  };

  if (error.response) {
    // サーバーからのレスポンスがある場合
    analysis.type = 'SERVER_RESPONSE';
    analysis.status = error.response.status;
    analysis.message = error.response.data?.message || error.message;
    analysis.details = {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      baseURL: error.config?.baseURL,
      headers: error.config?.headers,
      data: error.response.data,
      statusText: error.response.statusText
    };
  } else if (error.request) {
    // リクエストは送信されたがレスポンスが受信されない場合
    analysis.type = 'NETWORK_ERROR';
    analysis.message = 'サーバーからのレスポンスがありません';
    analysis.details = {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      baseURL: error.config?.baseURL,
      timeout: error.config?.timeout,
      request: error.request
    };
  } else {
    // リクエストの設定中にエラーが発生した場合
    analysis.type = 'REQUEST_SETUP';
    analysis.message = error.message;
    analysis.details = {
      stack: error.stack,
      config: error.config
    };
  }

  return analysis;
};

// =====================================
// Axios インスタンスの作成（強化版）
// =====================================

logger.info('🚀 API クライアント初期化開始', {
  baseURL: API_BASE_URL,
  timestamp: new Date().toISOString()
});

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  // HTTPS自己署名証明書対応（開発環境）
  validateStatus: (status) => {
    logger.debug(`レスポンスステータス: ${status}`);
    return status >= 200 && status < 300;
  }
});

// =====================================
// リクエストインターセプター（強化版）
// =====================================

api.interceptors.request.use(
  (config) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    config.metadata = { requestId, startTime: Date.now() };

    logger.info(`🚀 リクエスト送信 [${requestId}]`, {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      headers: config.headers,
      data: config.data ? { ...config.data, password: config.data.password ? '[HIDDEN]' : undefined } : undefined,
      params: config.params,
      timeout: config.timeout
    });

    // 認証トークンを追加
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      logger.debug(`認証トークン追加 [${requestId}]`, {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 10) + '...'
      });
    } else {
      logger.warning(`認証トークンなし [${requestId}]`);
    }
    
    return config;
  },
  (error) => {
    logger.error('リクエスト設定エラー', analyzeError(error));
    return Promise.reject(error);
  }
);

// =====================================
// レスポンスインターセプター（強化版）
// =====================================

api.interceptors.response.use(
  (response: AxiosResponse) => {
    const requestId = response.config.metadata?.requestId || 'unknown';
    const duration = response.config.metadata?.startTime 
      ? Date.now() - response.config.metadata.startTime 
      : 0;

    logger.success(`✅ レスポンス受信 [${requestId}]`, {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      url: response.config.url,
      dataSize: JSON.stringify(response.data).length,
      headers: response.headers,
      data: response.data
    });
    
    return response;
  },
  (error) => {
    const requestId = error.config?.metadata?.requestId || 'unknown';
    const duration = error.config?.metadata?.startTime 
      ? Date.now() - error.config.metadata.startTime 
      : 0;

    const errorAnalysis = analyzeError(error);
    
    logger.error(`❌ レスポンスエラー [${requestId}]`, {
      ...errorAnalysis,
      duration: `${duration}ms`,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    // 特定のエラーに対する詳細分析
    if (error.code === 'ECONNREFUSED' || error.message.includes('ERR_CONNECTION_REFUSED')) {
      logger.error('🔥 接続拒否エラー - サーバーが起動していない可能性', {
        baseURL: API_BASE_URL,
        suggestedCheck: 'バックエンドサーバーの起動状態を確認してください'
      });
    }

    if (error.code === 'ENOTFOUND' || error.message.includes('ERR_NAME_NOT_RESOLVED')) {
      logger.error('🔥 DNS解決エラー - ホスト名が見つからない', {
        hostname: new URL(API_BASE_URL).hostname,
        suggestedCheck: 'ネットワーク接続とホスト名を確認してください'
      });
    }

    if (error.response?.status === 404) {
      logger.error('🔥 404 Not Found - エンドポイントが存在しない', {
        requestedURL: error.config?.url,
        fullURL: `${error.config?.baseURL}${error.config?.url}`,
        method: error.config?.method?.toUpperCase(),
        suggestedCheck: 'APIエンドポイントのパスとメソッドを確認してください'
      });
    }

    if (error.response?.status === 401) {
      logger.warning('🔐 認証エラー - 自動ログアウト実行');
      
      // 認証エラーの場合、自動的にログアウト
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_LOGIN);
      
      // ログインページでない場合のみリダイレクト
      if (!window.location.pathname.includes('/login')) {
        logger.info('ログインページにリダイレクト');
        window.location.href = '/login';
      }
    }

    if (error.message.includes('certificate') || error.message.includes('SSL')) {
      logger.error('🔐 SSL証明書エラー', {
        message: '自己署名証明書が原因の可能性があります',
        solution: 'ブラウザで https://10.1.119.244:8443 にアクセスして証明書を許可してください'
      });
    }
    
    return Promise.reject(error);
  }
);

// =====================================
// 強化されたエラーハンドリング関数
// =====================================

const handleError = (error: any): ApiResponse<any> => {
  const errorAnalysis = analyzeError(error);
  
  logger.error('🔥 API エラーハンドラー実行', errorAnalysis);

  if (error.response) {
    // サーバーからのエラーレスポンス
    const status = error.response.status;
    const data = error.response.data;
    
    const errorMapping: Record<number, any> = {
      400: {
        error: data.error || 'VALIDATION_ERROR',
        message: data.message || ERROR_MESSAGES.VALIDATION_ERROR
      },
      401: {
        error: data.error || 'UNAUTHORIZED',
        message: data.message || ERROR_MESSAGES.UNAUTHORIZED
      },
      403: {
        error: data.error || 'FORBIDDEN',
        message: data.message || ERROR_MESSAGES.FORBIDDEN
      },
      404: {
        error: data.error || 'NOT_FOUND',
        message: data.message || ERROR_MESSAGES.NOT_FOUND
      },
      500: {
        error: data.error || 'SERVER_ERROR',
        message: data.message || ERROR_MESSAGES.SERVER_ERROR
      }
    };

    const errorInfo = errorMapping[status] || {
      error: data.error || 'SERVER_ERROR',
      message: data.message || ERROR_MESSAGES.SERVER_ERROR
    };

    return {
      success: false,
      ...errorInfo
    };
  } else if (error.request) {
    // ネットワークエラー
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'CONNECTION_REFUSED',
        message: ERROR_MESSAGES.CONNECTION_REFUSED
      };
    }
    
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'TIMEOUT_ERROR',
        message: ERROR_MESSAGES.TIMEOUT_ERROR
      };
    }

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

// =====================================
// API関数群（強化版）
// =====================================

export const apiClient = {
  // 基本的なHTTPメソッド
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.info(`GET リクエスト準備: ${url}`);
    try {
      const response = await api.get(url, config);
      logger.success(`GET成功: ${url}`, response.data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      logger.error(`GET失敗: ${url}`, error);
      return handleError(error);
    }
  },

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.info(`POST リクエスト準備: ${url}`, data ? { ...data, password: data.password ? '[HIDDEN]' : undefined } : undefined);
    try {
      const response = await api.post(url, data, config);
      logger.success(`POST成功: ${url}`, response.data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      logger.error(`POST失敗: ${url}`, error);
      return handleError(error);
    }
  },

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.info(`PUT リクエスト準備: ${url}`);
    try {
      const response = await api.put(url, data, config);
      logger.success(`PUT成功: ${url}`, response.data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      logger.error(`PUT失敗: ${url}`, error);
      return handleError(error);
    }
  },

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.info(`DELETE リクエスト準備: ${url}`);
    try {
      const response = await api.delete(url, config);
      logger.success(`DELETE成功: ${url}`, response.data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      logger.error(`DELETE失敗: ${url}`, error);
      return handleError(error);
    }
  },

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    logger.info(`PATCH リクエスト準備: ${url}`);
    try {
      const response = await api.patch(url, data, config);
      logger.success(`PATCH成功: ${url}`, response.data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      logger.error(`PATCH失敗: ${url}`, error);
      return handleError(error);
    }
  }
};

// =====================================
// 認証関連API（強化版）
// =====================================

export const authAPI = {
  /**
   * ログイン（強化版デバッグ付き）
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>> {
    logger.info('🔐 ログイン処理開始', { 
      username: credentials.username,
      rememberMe: credentials.rememberMe,
      timestamp: new Date().toISOString()
    });
    
    try {
      logger.debug('ログインリクエスト送信中...', {
        endpoint: '/auth/login',
        method: 'POST',
        baseURL: API_BASE_URL,
        fullURL: `${API_BASE_URL}/auth/login`
      });

      const response = await api.post('/auth/login', {
        username: credentials.username,
        password: credentials.password
      });

      logger.success('✅ ログインレスポンス受信', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: Object.keys(response.data || {}),
        responseStructure: {
          success: response.data?.success,
          hasUser: !!response.data?.data?.user,
          hasAccessToken: !!response.data?.data?.accessToken,
          hasRefreshToken: !!response.data?.data?.refreshToken
        }
      });

      // レスポンス構造の詳細確認
      if (response.data.success && response.data.data) {
        const { user, accessToken, refreshToken } = response.data.data;
        
        logger.success('🎉 ログイン成功 - トークン取得完了', {
          userId: user?.id,
          username: user?.username,
          role: user?.role,
          tokenLength: accessToken?.length,
          hasRefreshToken: !!refreshToken
        });
        
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
        logger.warning('⚠️ ログイン失敗 - レスポンス構造異常', {
          responseData: response.data,
          expectedStructure: 'response.data.success && response.data.data'
        });
        
        return {
          success: false,
          error: response.data.error || 'LOGIN_FAILED',
          message: response.data.message || ERROR_MESSAGES.LOGIN_FAILED
        };
      }
    } catch (error: any) {
      logger.error('❌ ログインエラー', analyzeError(error));
      return handleError(error);
    }
  },

  /**
   * ログアウト（強化版）
   */
  async logout(): Promise<ApiResponse<void>> {
    logger.info('🚪 ログアウト処理開始');
    
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      logger.debug('リフレッシュトークン確認', { hasRefreshToken: !!refreshToken });
      
      const response = await api.post('/auth/logout', { refreshToken });
      
      logger.success('✅ ログアウト成功');
      return {
        success: true,
        data: undefined,
        message: response.data.message || 'ログアウトしました'
      };
    } catch (error: any) {
      logger.error('❌ ログアウトエラー', analyzeError(error));
      return handleError(error);
    }
  },

  /**
   * プロフィール取得（強化版）
   */
  async getProfile(): Promise<ApiResponse<User>> {
    logger.info('👤 プロフィール取得開始');
    
    try {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      logger.debug('認証状態確認', { 
        hasToken: !!token,
        tokenLength: token?.length 
      });
      
      const response = await api.get('/auth/me');
      
      if (response.data.success && response.data.data) {
        logger.success('✅ プロフィール取得成功', {
          userId: response.data.data.user?.id,
          username: response.data.data.user?.username
        });
        
        return {
          success: true,
          data: response.data.data.user,
          message: response.data.message
        };
      } else {
        logger.warning('⚠️ プロフィール取得失敗', response.data);
        
        return {
          success: false,
          error: response.data.error || 'USER_FETCH_ERROR',
          message: response.data.message || 'ユーザー情報の取得に失敗しました'
        };
      }
    } catch (error: any) {
      logger.error('❌ プロフィール取得エラー', analyzeError(error));
      return handleError(error);
    }
  },

  /**
   * トークンリフレッシュ（強化版）
   */
  async refreshToken(): Promise<ApiResponse<{ accessToken: string; refreshToken?: string }>> {
    logger.info('🔄 トークンリフレッシュ開始');
    
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        logger.warning('⚠️ リフレッシュトークンなし');
        return {
          success: false,
          error: 'NO_REFRESH_TOKEN',
          message: 'リフレッシュトークンがありません'
        };
      }

      logger.debug('リフレッシュトークン送信中...', {
        tokenLength: refreshToken.length
      });

      const response = await api.post('/auth/refresh', { refreshToken });
      
      if (response.data.success && response.data.data) {
        const newAccessToken = response.data.data.accessToken;
        const newRefreshToken = response.data.data.refreshToken;
        
        logger.success('✅ トークンリフレッシュ成功', {
          newAccessTokenLength: newAccessToken?.length,
          hasNewRefreshToken: !!newRefreshToken
        });
        
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
        logger.warning('⚠️ トークンリフレッシュ失敗', response.data);
        
        return {
          success: false,
          error: response.data.error || 'TOKEN_REFRESH_FAILED',
          message: response.data.message || 'トークンリフレッシュに失敗しました'
        };
      }
    } catch (error: any) {
      logger.error('❌ トークンリフレッシュエラー', analyzeError(error));
      return handleError(error);
    }
  },

  /**
   * パスワード変更（強化版）
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    logger.info('🔑 パスワード変更開始');
    
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      
      logger.success('✅ パスワード変更成功');
      return {
        success: true,
        data: undefined,
        message: response.data.message || 'パスワードを変更しました'
      };
    } catch (error: any) {
      logger.error('❌ パスワード変更エラー', analyzeError(error));
      return handleError(error);
    }
  }
};

// =====================================
// その他のAPI（従来通り）
// =====================================

export const userAPI = {
  async getUsers(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<{ users: User[]; total: number; page: number; limit: number }>> {
    return apiClient.get('/users', { params });
  },
  async createUser(userData: Partial<User>): Promise<ApiResponse<User>> {
    return apiClient.post('/users', userData);
  },
  async updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return apiClient.put(`/users/${id}`, userData);
  },
  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/users/${id}`);
  }
};

export const vehicleAPI = {
  async getVehicles(params?: { page?: number; limit?: number; search?: string }): Promise<ApiResponse<any>> {
    return apiClient.get('/vehicles', { params });
  },
  async createVehicle(vehicleData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/vehicles', vehicleData);
  },
  async updateVehicle(id: string, vehicleData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/vehicles/${id}`, vehicleData);
  },
  async deleteVehicle(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/vehicles/${id}`);
  }
};

export const healthAPI = {
  async check(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return apiClient.get('/health');
  }
};

export const inspectionAPI = {
  async getInspectionItems(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/inspection-items', { params });
  },
  async createInspectionItem(itemData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/inspection-items', itemData);
  },
  async updateInspectionItem(id: string, itemData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/inspection-items/${id}`, itemData);
  },
  async deleteInspectionItem(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/inspection-items/${id}`);
  },
  async updateOrder(items: { id: string; order: number }[]): Promise<ApiResponse<void>> {
    return apiClient.post('/inspection-items/update-order', { items });
  }
};

export const locationAPI = {
  async getLocations(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/locations', { params });
  },
  async createLocation(locationData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/locations', locationData);
  },
  async updateLocation(id: string, locationData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/locations/${id}`, locationData);
  },
  async deleteLocation(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/locations/${id}`);
  }
};

export const cargoTypeAPI = {
  async getCargoTypes(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/cargo-types', { params });
  },
  async createCargoType(cargoData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/cargo-types', cargoData);
  },
  async updateCargoType(id: string, cargoData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/cargo-types/${id}`, cargoData);
  },
  async deleteCargoType(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/cargo-types/${id}`);
  },
  async updateOrder(items: { id: string; order: number }[]): Promise<ApiResponse<void>> {
    return apiClient.post('/cargo-types/update-order', { items });
  }
};

export const operationAPI = {
  async getOperations(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/operations', { params });
  },
  async createOperation(operationData: any): Promise<ApiResponse<any>> {
    return apiClient.post('/operations', operationData);
  },
  async updateOperation(id: string, operationData: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/operations/${id}`, operationData);
  },
  async deleteOperation(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/operations/${id}`);
  },
  async getOperation(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/operations/${id}`);
  },
  async updateStatus(id: string, status: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/operations/${id}/status`, { status });
  }
};

export const gpsAPI = {
  async getGpsLocations(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/gps/locations', { params });
  },
  async getRealTimeLocation(vehicleId: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/gps/vehicles/${vehicleId}/location`);
  },
  async getGpsHistory(vehicleId: string, params?: any): Promise<ApiResponse<any>> {
    return apiClient.get(`/gps/vehicles/${vehicleId}/history`, { params });
  },
  async updateGpsSettings(vehicleId: string, settings: any): Promise<ApiResponse<any>> {
    return apiClient.put(`/gps/vehicles/${vehicleId}/settings`, settings);
  }
};

export const reportAPI = {
  async getDailyReport(date: string, params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/reports/daily', { params: { date, ...params } });
  },
  async getMonthlyReport(year: number, month: number, params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/reports/monthly', { params: { year, month, ...params } });
  },
  async getAnnualReport(year: number, params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/reports/annual', { params: { year, ...params } });
  },
  async getCustomReport(filters: any): Promise<ApiResponse<any>> {
    return apiClient.post('/reports/custom', filters);
  },
  async exportPdf(reportType: string, params: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/reports/export/pdf`, { reportType, ...params }, {
      responseType: 'blob'
    });
  },
  async exportExcel(reportType: string, params: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/reports/export/excel`, { reportType, ...params }, {
      responseType: 'blob'
    });
  }
};

// =====================================
// 初期化完了ログ
// =====================================

logger.success('🎉 API クライアント初期化完了', {
  baseURL: API_BASE_URL,
  timeout: '30秒',
  interceptors: 'リクエスト・レスポンス',
  errorHandling: '詳細分析対応',
  debugging: '強化版ログ出力',
  timestamp: new Date().toISOString()
});

// =====================================
// デフォルトエクスポート
// =====================================

export default api;