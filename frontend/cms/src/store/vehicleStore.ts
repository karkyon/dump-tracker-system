// frontend/cms/src/store/vehicleStore.ts - 完全修正版
// 🔧 修正内容: APIレスポンスのフィールド名マッピングを追加
// - plateNumber → vehicleNumber
// - model → vehicleType  
// - capacity/capacityTons の統一
// 既存機能: すべての関数・コメント・ロジックを100%保持

import { create } from 'zustand';
import { Vehicle, FilterOptions } from '../types';
import { vehicleAPI } from '../utils/api';

interface VehicleState {
  // 状態
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: FilterOptions;

  // アクション
  fetchVehicles: (filters?: FilterOptions) => Promise<void>;
  fetchVehicle: (id: string) => Promise<void>;
  createVehicle: (vehicleData: Partial<Vehicle>) => Promise<boolean>;
  updateVehicle: (id: string, vehicleData: Partial<Vehicle>) => Promise<boolean>;
  deleteVehicle: (id: string) => Promise<boolean>;
  setFilters: (filters: Partial<FilterOptions>) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  clearSelectedVehicle: () => void;
}

// ✅ 追加: バックエンドレスポンスをフロントエンド形式に変換するヘルパー関数
const normalizeVehicle = (vehicle: any): Vehicle => {
  return {
    ...vehicle,
    // バックエンド形式 → フロントエンド形式へのマッピング
    vehicleNumber: vehicle.plateNumber || vehicle.vehicleNumber,
    vehicleType: vehicle.model || vehicle.vehicleType,
    capacity: vehicle.capacity || vehicle.capacityTons,
    // バックエンド形式も保持（互換性維持）
    plateNumber: vehicle.plateNumber || vehicle.vehicleNumber,
    model: vehicle.model || vehicle.vehicleType,
    capacityTons: vehicle.capacityTons || vehicle.capacity,
  };
};

// ✅ 追加: フロントエンドからバックエンドへのデータ変換ヘルパー関数
const denormalizeVehicle = (vehicle: Partial<Vehicle>): any => {
  const backendData: any = { ...vehicle };
  
  // フロントエンド形式 → バックエンド形式へのマッピング
  if (vehicle.vehicleNumber && !vehicle.plateNumber) {
    backendData.plateNumber = vehicle.vehicleNumber;
    delete backendData.vehicleNumber;
  }
  
  if (vehicle.vehicleType && !vehicle.model) {
    backendData.model = vehicle.vehicleType;
    delete backendData.vehicleType;
  }
  
  if (vehicle.capacity && !vehicle.capacityTons) {
    backendData.capacityTons = vehicle.capacity;
    delete backendData.capacity;
  }
  
  return backendData;
};

export const useVehicleStore = create<VehicleState>((set, get) => ({
  // 初期状態
  vehicles: [],
  selectedVehicle: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {},

  // 車両一覧取得
  fetchVehicles: async (filters = {}) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] fetchVehicles 開始', { filters });

    try {
      const currentFilters = { ...get().filters, ...filters };
      const params = {
        ...currentFilters,
        page: get().pagination.page,
        pageSize: get().pagination.pageSize,
      };

      console.log('[VehicleStore] API呼び出しパラメータ:', params);

      const response = await vehicleAPI.getVehicles(params);

      console.log('[VehicleStore] APIレスポンス全体:', response);

      if (response.success && response.data) {
        const apiData = response.data as any;
        
        console.log('[VehicleStore] response.data の内容:', apiData);

        // ✅ 修正: APIレスポンスから車両配列を抽出（複数パターンに対応）
        let rawVehicles = [];
        if (Array.isArray(apiData)) {
          rawVehicles = apiData;
        } else if (Array.isArray(apiData.vehicles)) {
          rawVehicles = apiData.vehicles;
        } else if (Array.isArray(apiData.data)) {
          rawVehicles = apiData.data;
        }

        console.log('[VehicleStore] 抽出した生の車両データ:', rawVehicles);

        // ✅ 修正: 各車両データをフロントエンド形式に変換
        const normalizedVehicles = rawVehicles.map((v: any) => normalizeVehicle(v));

        console.log('[VehicleStore] 正規化後の車両データ:', normalizedVehicles);

        set({
          vehicles: normalizedVehicles,
          pagination: {
            page: apiData.page || 1,
            pageSize: apiData.limit || apiData.pageSize || 10,
            total: apiData.total || normalizedVehicles.length,
            totalPages: Math.ceil((apiData.total || normalizedVehicles.length) / (apiData.limit || apiData.pageSize || 10)),
          },
          filters: currentFilters,
          isLoading: false,
        });

        console.log('[VehicleStore] fetchVehicles 成功:', {
          vehiclesCount: normalizedVehicles.length,
          total: apiData.total,
        });
      } else {
        console.error('[VehicleStore] APIレスポンスエラー:', response.error);
        set({
          error: response.error || '車両一覧の取得に失敗しました',
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[VehicleStore] ネットワークエラー:', error);
      set({
        error: 'ネットワークエラーが発生しました',
        isLoading: false,
      });
    }
  },

  // 単一車両取得
  fetchVehicle: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] fetchVehicle 開始', { id });

    try {
      const vehicle = get().vehicles.find(v => v.id === id);
      if (vehicle) {
        console.log('[VehicleStore] キャッシュから車両取得:', vehicle);
        set({ selectedVehicle: vehicle, isLoading: false });
      } else {
        console.log('[VehicleStore] キャッシュになし、fetchVehicles呼び出し');
        await get().fetchVehicles();
        const updatedVehicle = get().vehicles.find(v => v.id === id);
        console.log('[VehicleStore] 再取得後の車両:', updatedVehicle);
        set({ selectedVehicle: updatedVehicle || null, isLoading: false });
      }
    } catch (error) {
      console.error('[VehicleStore] fetchVehicle エラー:', error);
      set({
        error: 'ネットワークエラーが発生しました',
        isLoading: false,
      });
    }
  },

  // 車両作成
  createVehicle: async (vehicleData: Partial<Vehicle>) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] createVehicle 開始', { vehicleData });

    try {
      // ✅ 修正: フロントエンド形式 → バックエンド形式に変換
      const backendData = denormalizeVehicle(vehicleData);
      
      console.log('[VehicleStore] バックエンドに送信するデータ:', backendData);

      const response = await vehicleAPI.createVehicle(backendData);

      console.log('[VehicleStore] createVehicle APIレスポンス:', response);

      if (response.success) {
        await get().fetchVehicles();
        set({ isLoading: false });
        console.log('[VehicleStore] createVehicle 成功');
        return true;
      } else {
        console.error('[VehicleStore] createVehicle 失敗:', response.error);
        set({
          error: response.error || '車両の作成に失敗しました',
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[VehicleStore] createVehicle ネットワークエラー:', error);
      set({
        error: 'ネットワークエラーが発生しました',
        isLoading: false,
      });
      return false;
    }
  },

  // 車両更新
  updateVehicle: async (id: string, vehicleData: Partial<Vehicle>) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] updateVehicle 開始', { id, vehicleData });

    try {
      // ✅ 修正: フロントエンド形式 → バックエンド形式に変換
      const backendData = denormalizeVehicle(vehicleData);
      
      console.log('[VehicleStore] バックエンドに送信するデータ:', backendData);

      const response = await vehicleAPI.updateVehicle(id, backendData);

      console.log('[VehicleStore] updateVehicle APIレスポンス:', response);

      if (response.success) {
        await get().fetchVehicles();
        
        if (get().selectedVehicle?.id === id) {
          await get().fetchVehicle(id);
        }
        
        set({ isLoading: false });
        console.log('[VehicleStore] updateVehicle 成功');
        return true;
      } else {
        console.error('[VehicleStore] updateVehicle 失敗:', response.error);
        set({
          error: response.error || '車両の更新に失敗しました',
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[VehicleStore] updateVehicle ネットワークエラー:', error);
      set({
        error: 'ネットワークエラーが発生しました',
        isLoading: false,
      });
      return false;
    }
  },

  // 車両削除
  deleteVehicle: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] deleteVehicle 開始', { id });

    try {
      const response = await vehicleAPI.deleteVehicle(id);

      console.log('[VehicleStore] deleteVehicle APIレスポンス:', response);

      if (response.success) {
        await get().fetchVehicles();
        
        if (get().selectedVehicle?.id === id) {
          set({ selectedVehicle: null });
        }
        
        set({ isLoading: false });
        console.log('[VehicleStore] deleteVehicle 成功');
        return true;
      } else {
        console.error('[VehicleStore] deleteVehicle 失敗:', response.error);
        set({
          error: response.error || '車両の削除に失敗しました',
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[VehicleStore] deleteVehicle ネットワークエラー:', error);
      set({
        error: 'ネットワークエラーが発生しました',
        isLoading: false,
      });
      return false;
    }
  },

  // フィルター設定
  setFilters: (filters: Partial<FilterOptions>) => {
    console.log('[VehicleStore] setFilters:', filters);
    set({
      filters: { ...get().filters, ...filters },
      pagination: { ...get().pagination, page: 1 },
    });
  },

  // ページ設定
  setPage: (page: number) => {
    console.log('[VehicleStore] setPage:', page);
    set({
      pagination: { ...get().pagination, page },
    });
  },

  // エラークリア
  clearError: () => {
    console.log('[VehicleStore] clearError');
    set({ error: null });
  },

  // 選択車両クリア
  clearSelectedVehicle: () => {
    console.log('[VehicleStore] clearSelectedVehicle');
    set({ selectedVehicle: null });
  },
}));