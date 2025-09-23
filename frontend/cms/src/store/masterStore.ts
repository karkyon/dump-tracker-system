import { create } from 'zustand';
import { InspectionItem, Location, CargoType, FilterOptions } from '../types';
import { inspectionAPI, locationAPI, cargoTypeAPI } from '../utils/api';

interface MasterState {
  // 点検項目
  inspectionItems: InspectionItem[];
  inspectionLoading: boolean;
  inspectionError: string | null;

  // 場所
  locations: Location[];
  locationLoading: boolean;
  locationError: string | null;

  // 品目
  cargoTypes: CargoType[];
  cargoLoading: boolean;
  cargoError: string | null;

  // アクション - 点検項目
  fetchInspectionItems: (filters?: FilterOptions) => Promise<void>;
  createInspectionItem: (itemData: Partial<InspectionItem>) => Promise<boolean>;
  updateInspectionItem: (id: string, itemData: Partial<InspectionItem>) => Promise<boolean>;
  deleteInspectionItem: (id: string) => Promise<boolean>;
  updateInspectionOrder: (items: { id: string; order: number }[]) => Promise<boolean>;

  // アクション - 場所
  fetchLocations: (filters?: FilterOptions) => Promise<void>;
  createLocation: (locationData: Partial<Location>) => Promise<boolean>;
  updateLocation: (id: string, locationData: Partial<Location>) => Promise<boolean>;
  deleteLocation: (id: string) => Promise<boolean>;

  // アクション - 品目
  fetchCargoTypes: (filters?: FilterOptions) => Promise<void>;
  createCargoType: (cargoData: Partial<CargoType>) => Promise<boolean>;
  updateCargoType: (id: string, cargoData: Partial<CargoType>) => Promise<boolean>;
  deleteCargoType: (id: string) => Promise<boolean>;
  updateCargoOrder: (items: { id: string; order: number }[]) => Promise<boolean>;

  // エラークリア
  clearErrors: () => void;
}

export const useMasterStore = create<MasterState>((set, get) => ({
  // 初期状態
  inspectionItems: [],
  inspectionLoading: false,
  inspectionError: null,
  
  locations: [],
  locationLoading: false,
  locationError: null,
  
  cargoTypes: [],
  cargoLoading: false,
  cargoError: null,

  // 点検項目一覧取得
  fetchInspectionItems: async (filters = {}) => {
    set({ inspectionLoading: true, inspectionError: null });

    try {
      const response = await inspectionAPI.getInspectionItems(filters);

      if (response.success && response.data) {
        set({
          inspectionItems: response.data,
          inspectionLoading: false,
        });
      } else {
        set({
          inspectionError: response.error || '点検項目の取得に失敗しました',
          inspectionLoading: false,
        });
      }
    } catch (error) {
      set({
        inspectionError: 'ネットワークエラーが発生しました',
        inspectionLoading: false,
      });
    }
  },

  // 点検項目作成
  createInspectionItem: async (itemData: Partial<InspectionItem>) => {
    set({ inspectionLoading: true, inspectionError: null });

    try {
      const response = await inspectionAPI.createInspectionItem(itemData);

      if (response.success) {
        await get().fetchInspectionItems();
        set({ inspectionLoading: false });
        return true;
      } else {
        set({
          inspectionError: response.error || '点検項目の作成に失敗しました',
          inspectionLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        inspectionError: 'ネットワークエラーが発生しました',
        inspectionLoading: false,
      });
      return false;
    }
  },

  // 点検項目更新
  updateInspectionItem: async (id: string, itemData: Partial<InspectionItem>) => {
    set({ inspectionLoading: true, inspectionError: null });

    try {
      const response = await inspectionAPI.updateInspectionItem(id, itemData);

      if (response.success) {
        await get().fetchInspectionItems();
        set({ inspectionLoading: false });
        return true;
      } else {
        set({
          inspectionError: response.error || '点検項目の更新に失敗しました',
          inspectionLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        inspectionError: 'ネットワークエラーが発生しました',
        inspectionLoading: false,
      });
      return false;
    }
  },

  // 点検項目削除
  deleteInspectionItem: async (id: string) => {
    set({ inspectionLoading: true, inspectionError: null });

    try {
      const response = await inspectionAPI.deleteInspectionItem(id);

      if (response.success) {
        await get().fetchInspectionItems();
        set({ inspectionLoading: false });
        return true;
      } else {
        set({
          inspectionError: response.error || '点検項目の削除に失敗しました',
          inspectionLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        inspectionError: 'ネットワークエラーが発生しました',
        inspectionLoading: false,
      });
      return false;
    }
  },

  // 点検項目順序更新
  updateInspectionOrder: async (items: { id: string; order: number }[]) => {
    set({ inspectionLoading: true, inspectionError: null });

    try {
      const response = await inspectionAPI.updateOrder(items);

      if (response.success) {
        await get().fetchInspectionItems();
        set({ inspectionLoading: false });
        return true;
      } else {
        set({
          inspectionError: response.error || '表示順の更新に失敗しました',
          inspectionLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        inspectionError: 'ネットワークエラーが発生しました',
        inspectionLoading: false,
      });
      return false;
    }
  },

  // 場所一覧取得
  fetchLocations: async (filters = {}) => {
    set({ locationLoading: true, locationError: null });

    try {
      const response = await locationAPI.getLocations(filters);

      if (response.success && response.data) {
        set({
          locations: response.data,
          locationLoading: false,
        });
      } else {
        set({
          locationError: response.error || '場所の取得に失敗しました',
          locationLoading: false,
        });
      }
    } catch (error) {
      set({
        locationError: 'ネットワークエラーが発生しました',
        locationLoading: false,
      });
    }
  },

  // 場所作成
  createLocation: async (locationData: Partial<Location>) => {
    set({ locationLoading: true, locationError: null });

    try {
      const response = await locationAPI.createLocation(locationData);

      if (response.success) {
        await get().fetchLocations();
        set({ locationLoading: false });
        return true;
      } else {
        set({
          locationError: response.error || '場所の作成に失敗しました',
          locationLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        locationError: 'ネットワークエラーが発生しました',
        locationLoading: false,
      });
      return false;
    }
  },

  // 場所更新
  updateLocation: async (id: string, locationData: Partial<Location>) => {
    set({ locationLoading: true, locationError: null });

    try {
      const response = await locationAPI.updateLocation(id, locationData);

      if (response.success) {
        await get().fetchLocations();
        set({ locationLoading: false });
        return true;
      } else {
        set({
          locationError: response.error || '場所の更新に失敗しました',
          locationLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        locationError: 'ネットワークエラーが発生しました',
        locationLoading: false,
      });
      return false;
    }
  },

  // 場所削除
  deleteLocation: async (id: string) => {
    set({ locationLoading: true, locationError: null });

    try {
      const response = await locationAPI.deleteLocation(id);

      if (response.success) {
        await get().fetchLocations();
        set({ locationLoading: false });
        return true;
      } else {
        set({
          locationError: response.error || '場所の削除に失敗しました',
          locationLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        locationError: 'ネットワークエラーが発生しました',
        locationLoading: false,
      });
      return false;
    }
  },

  // 品目一覧取得
  fetchCargoTypes: async (filters = {}) => {
    set({ cargoLoading: true, cargoError: null });

    try {
      const response = await cargoTypeAPI.getCargoTypes(filters);

      if (response.success && response.data) {
        set({
          cargoTypes: response.data,
          cargoLoading: false,
        });
      } else {
        set({
          cargoError: response.error || '品目の取得に失敗しました',
          cargoLoading: false,
        });
      }
    } catch (error) {
      set({
        cargoError: 'ネットワークエラーが発生しました',
        cargoLoading: false,
      });
    }
  },

  // 品目作成
  createCargoType: async (cargoData: Partial<CargoType>) => {
    set({ cargoLoading: true, cargoError: null });

    try {
      const response = await cargoTypeAPI.createCargoType(cargoData);

      if (response.success) {
        await get().fetchCargoTypes();
        set({ cargoLoading: false });
        return true;
      } else {
        set({
          cargoError: response.error || '品目の作成に失敗しました',
          cargoLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        cargoError: 'ネットワークエラーが発生しました',
        cargoLoading: false,
      });
      return false;
    }
  },

  // 品目更新
  updateCargoType: async (id: string, cargoData: Partial<CargoType>) => {
    set({ cargoLoading: true, cargoError: null });

    try {
      const response = await cargoTypeAPI.updateCargoType(id, cargoData);

      if (response.success) {
        await get().fetchCargoTypes();
        set({ cargoLoading: false });
        return true;
      } else {
        set({
          cargoError: response.error || '品目の更新に失敗しました',
          cargoLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        cargoError: 'ネットワークエラーが発生しました',
        cargoLoading: false,
      });
      return false;
    }
  },

  // 品目削除
  deleteCargoType: async (id: string) => {
    set({ cargoLoading: true, cargoError: null });

    try {
      const response = await cargoTypeAPI.deleteCargoType(id);

      if (response.success) {
        await get().fetchCargoTypes();
        set({ cargoLoading: false });
        return true;
      } else {
        set({
          cargoError: response.error || '品目の削除に失敗しました',
          cargoLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        cargoError: 'ネットワークエラーが発生しました',
        cargoLoading: false,
      });
      return false;
    }
  },

  // 品目順序更新
  updateCargoOrder: async (items: { id: string; order: number }[]) => {
    set({ cargoLoading: true, cargoError: null });

    try {
      const response = await cargoTypeAPI.updateOrder(items);

      if (response.success) {
        await get().fetchCargoTypes();
        set({ cargoLoading: false });
        return true;
      } else {
        set({
          cargoError: response.error || '表示順の更新に失敗しました',
          cargoLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        cargoError: 'ネットワークエラーが発生しました',
        cargoLoading: false,
      });
      return false;
    }
  },

  // エラークリア
  clearErrors: () => set({ 
    inspectionError: null, 
    locationError: null, 
    cargoError: null 
  }),
}));