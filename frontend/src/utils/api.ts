import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_BASE_URL, STORAGE_KEYS, ERROR_MESSAGES } from './constants';
import { ApiResponse } from '../types';

// Axios インスタンスの作成
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 認証エラーの場合、ローカルストレージをクリアしてログイン画面へ
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

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
      return this.handleError(error);
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
      return this.handleError(error);
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
      return this.handleError(error);
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
      return this.handleError(error);
    }
  },

  // エラーハンドリング
  handleError(error: any): ApiResponse<never> {
    let message = ERROR_MESSAGES.SERVER_ERROR;

    if (error.response) {
      // サーバーからのレスポンスがある場合
      switch (error.response.status) {
        case 400:
          message = error.response.data?.message || ERROR_MESSAGES.VALIDATION_ERROR;
          break;
        case 401:
          message = ERROR_MESSAGES.AUTH_FAILED;
          break;
        case 403:
          message = ERROR_MESSAGES.ACCESS_DENIED;
          break;
        case 404:
          message = ERROR_MESSAGES.NOT_FOUND;
          break;
        case 500:
          message = ERROR_MESSAGES.SERVER_ERROR;
          break;
        default:
          message = error.response.data?.message || ERROR_MESSAGES.SERVER_ERROR;
      }
    } else if (error.request) {
      // リクエストが送信されたがレスポンスがない場合
      message = ERROR_MESSAGES.NETWORK_ERROR;
    } else {
      // その他のエラー
      message = error.message || ERROR_MESSAGES.SERVER_ERROR;
    }

    return {
      success: false,
      error: message,
    };
  },
};

// 認証関連API
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    apiClient.post('/auth/login', credentials),
  
  logout: () =>
    apiClient.post('/auth/logout'),
  
  refreshToken: () =>
    apiClient.post('/auth/refresh'),
  
  getProfile: () =>
    apiClient.get('/auth/profile'),
};

// ユーザー管理API
export const userAPI = {
  getUsers: (params?: any) =>
    apiClient.get('/users', { params }),
  
  getUser: (id: string) =>
    apiClient.get(`/users/${id}`),
  
  createUser: (userData: any) =>
    apiClient.post('/users', userData),
  
  updateUser: (id: string, userData: any) =>
    apiClient.put(`/users/${id}`, userData),
  
  deleteUser: (id: string) =>
    apiClient.delete(`/users/${id}`),
};

// 車両管理API
export const vehicleAPI = {
  getVehicles: (params?: any) =>
    apiClient.get('/vehicles', { params }),
  
  getVehicle: (id: string) =>
    apiClient.get(`/vehicles/${id}`),
  
  createVehicle: (vehicleData: any) =>
    apiClient.post('/vehicles', vehicleData),
  
  updateVehicle: (id: string, vehicleData: any) =>
    apiClient.put(`/vehicles/${id}`, vehicleData),
  
  deleteVehicle: (id: string) =>
    apiClient.delete(`/vehicles/${id}`),
};

// 点検項目API
export const inspectionAPI = {
  getInspectionItems: (params?: any) =>
    apiClient.get('/inspection-items', { params }),
  
  createInspectionItem: (itemData: any) =>
    apiClient.post('/inspection-items', itemData),
  
  updateInspectionItem: (id: string, itemData: any) =>
    apiClient.put(`/inspection-items/${id}`, itemData),
  
  deleteInspectionItem: (id: string) =>
    apiClient.delete(`/inspection-items/${id}`),
  
  updateOrder: (items: { id: string; order: number }[]) =>
    apiClient.put('/inspection-items/order', { items }),
};

// 場所管理API
export const locationAPI = {
  getLocations: (params?: any) =>
    apiClient.get('/locations', { params }),
  
  createLocation: (locationData: any) =>
    apiClient.post('/locations', locationData),
  
  updateLocation: (id: string, locationData: any) =>
    apiClient.put(`/locations/${id}`, locationData),
  
  deleteLocation: (id: string) =>
    apiClient.delete(`/locations/${id}`),
};

// 品目管理API
export const cargoTypeAPI = {
  getCargoTypes: (params?: any) =>
    apiClient.get('/cargo-types', { params }),
  
  createCargoType: (cargoData: any) =>
    apiClient.post('/cargo-types', cargoData),
  
  updateCargoType: (id: string, cargoData: any) =>
    apiClient.put(`/cargo-types/${id}`, cargoData),
  
  deleteCargoType: (id: string) =>
    apiClient.delete(`/cargo-types/${id}`),
  
  updateOrder: (items: { id: string; order: number }[]) =>
    apiClient.put('/cargo-types/order', { items }),
};

// 運行記録API
export const operationAPI = {
  getOperations: (params?: any) =>
    apiClient.get('/operations', { params }),
  
  getOperation: (id: string) =>
    apiClient.get(`/operations/${id}`),
  
  updateOperation: (id: string, operationData: any) =>
    apiClient.put(`/operations/${id}`, operationData),
  
  deleteOperation: (id: string) =>
    apiClient.delete(`/operations/${id}`),
  
  exportCSV: (params?: any) =>
    apiClient.get('/operations/export/csv', { params, responseType: 'blob' }),
};

// GPS監視API
export const gpsAPI = {
  getCurrentLocations: () =>
    apiClient.get('/gps/current'),
  
  getLocationHistory: (vehicleId: string, params?: any) =>
    apiClient.get(`/gps/history/${vehicleId}`, { params }),
};

// 帳票API
export const reportAPI = {
  generateDailyReport: (params: any) =>
    apiClient.post('/reports/daily', params, { responseType: 'blob' }),
  
  generateAnnualReport: (params: any) =>
    apiClient.post('/reports/annual', params, { responseType: 'blob' }),
};

// システム設定API
export const settingsAPI = {
  getSettings: () =>
    apiClient.get('/settings'),
  
  updateSettings: (settingsData: any) =>
    apiClient.put('/settings', settingsData),
  
  getLogs: (params?: any) =>
    apiClient.get('/logs', { params }),
  
  exportLogs: (params?: any) =>
    apiClient.get('/logs/export', { params, responseType: 'blob' }),
  
  clearLogs: () =>
    apiClient.delete('/logs'),
};

export default api;
