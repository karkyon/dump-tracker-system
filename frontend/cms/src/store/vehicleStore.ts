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

    try {
      const currentFilters = { ...get().filters, ...filters };
      const params = {
        ...currentFilters,
        page: get().pagination.page,
        pageSize: get().pagination.pageSize,
      };

      const response = await vehicleAPI.getVehicles(params);

      if (response.success && response.data) {
        const apiData = response.data as any;
        set({
          vehicles: apiData.vehicles || apiData.data || [],
          pagination: {
            page: apiData.page || 1,
            pageSize: apiData.limit || apiData.pageSize || 10,
            total: apiData.total || 0,
            totalPages: Math.ceil((apiData.total || 0) / (apiData.limit || apiData.pageSize || 10)),
          },
          filters: currentFilters,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || '車両一覧の取得に失敗しました',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: 'ネットワークエラーが発生しました',
        isLoading: false,
      });
    }
  },

  // 単一車両取得
  fetchVehicle: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const vehicle = get().vehicles.find(v => v.id === id);
      if (vehicle) {
        set({ selectedVehicle: vehicle, isLoading: false });
      } else {
        await get().fetchVehicles();
        const updatedVehicle = get().vehicles.find(v => v.id === id);
        set({ selectedVehicle: updatedVehicle || null, isLoading: false });
      }
    } catch (error) {
      set({
        error: 'ネットワークエラーが発生しました',
        isLoading: false,
      });
    }
  },

  // 車両作成
  createVehicle: async (vehicleData: Partial<Vehicle>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await vehicleAPI.createVehicle(vehicleData);

      if (response.success) {
        await get().fetchVehicles();
        set({ isLoading: false });
        return true;
      } else {
        set({
          error: response.error || '車両の作成に失敗しました',
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
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

    try {
      const response = await vehicleAPI.updateVehicle(id, vehicleData);

      if (response.success) {
        await get().fetchVehicles();
        
        if (get().selectedVehicle?.id === id) {
          await get().fetchVehicle(id);
        }
        
        set({ isLoading: false });
        return true;
      } else {
        set({
          error: response.error || '車両の更新に失敗しました',
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
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

    try {
      const response = await vehicleAPI.deleteVehicle(id);

      if (response.success) {
        await get().fetchVehicles();
        
        if (get().selectedVehicle?.id === id) {
          set({ selectedVehicle: null });
        }
        
        set({ isLoading: false });
        return true;
      } else {
        set({
          error: response.error || '車両の削除に失敗しました',
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        error: 'ネットワークエラーが発生しました',
        isLoading: false,
      });
      return false;
    }
  },

  // フィルター設定
  setFilters: (filters: Partial<FilterOptions>) => {
    set({
      filters: { ...get().filters, ...filters },
      pagination: { ...get().pagination, page: 1 },
    });
  },

  // ページ設定
  setPage: (page: number) => {
    set({
      pagination: { ...get().pagination, page },
    });
  },

  // エラークリア
  clearError: () => set({ error: null }),

  // 選択車両クリア
  clearSelectedVehicle: () => set({ selectedVehicle: null }),
}));