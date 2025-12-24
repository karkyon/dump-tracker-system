import { create } from 'zustand';
import { InspectionItem, Location, Item, FilterOptions } from '../types';
import { inspectionItemAPI, locationAPI, itemAPI } from '../utils/api';

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
  items: Item[];
  itemLoading: boolean;
  itemError: string | null;

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
  fetchItems: (filters?: FilterOptions) => Promise<void>;
  createItem: (itemData: Partial<Item>) => Promise<boolean>;
  updateItem: (id: string, itemData: Partial<Item>) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  updateItemOrder: (items: { id: string; order: number }[]) => Promise<boolean>;

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
  
  items: [],
  itemLoading: false,
  itemError: null,

  // 点検項目一覧取得
  fetchInspectionItems: async (filters = {}) => {
    set({ inspectionLoading: true, inspectionError: null });

    try {
      const response = await inspectionItemAPI.getInspectionItems(filters);

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
      const response = await inspectionItemAPI.createInspectionItem(itemData);

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
      const response = await inspectionItemAPI.updateInspectionItem(id, itemData);

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
      const response = await inspectionItemAPI.deleteInspectionItem(id);

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
      const response = await inspectionItemAPI.updateOrder(items);

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
      console.log('[masterStore] fetchLocations 開始', filters);
      const response = await locationAPI.getLocations(filters);
      console.log('[masterStore] APIレスポンス:', response);

      if (response.success && response.data) {
        // 二重ネスト構造の確認
        let locationsData: Location[];
        
        if (Array.isArray(response.data)) {
          // response.dataが直接配列の場合
          locationsData = response.data;
          console.log('[masterStore] パターン1: 直接配列', locationsData.length);
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // response.data.dataが配列の場合（二重ネスト）
          locationsData = response.data.data;
          console.log('[masterStore] パターン2: 二重ネスト', locationsData.length);
        } else {
          console.error('[masterStore] 予期しないデータ構造:', response.data);
          locationsData = [];
        }

        set({
          locations: locationsData,
          locationLoading: false,
        });
      } else {
        set({
          locationError: response.error || '場所の取得に失敗しました',
          locationLoading: false,
        });
      }
    } catch (error) {
      console.error('[masterStore] fetchLocations エラー:', error);
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
  fetchItems: async (filters = {}) => {
    set({ itemLoading: true, itemError: null });

    try {
      console.log('[masterStore] fetchItems 開始', filters);
      const response = await itemAPI.getItems(filters);
      console.log('[masterStore] APIレスポンス:', response);

      if (response.success && response.data) {
        // 二重ネスト構造の確認
        let itemsData: Item[];
        
        if (Array.isArray(response.data)) {
          // response.dataが直接配列の場合
          itemsData = response.data;
          console.log('[masterStore] パターン1: 直接配列', itemsData.length);
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // response.data.dataが配列の場合（二重ネスト）
          itemsData = response.data.data;
          console.log('[masterStore] パターン2: 二重ネスト', itemsData.length);
        } else {
          console.error('[masterStore] 予期しないデータ構造:', response.data);
          itemsData = [];
        }

        set({
          items: itemsData,
          itemLoading: false,
        });
      } else {
        set({
          itemError: response.error || '品目の取得に失敗しました',
          itemLoading: false,
        });
      }
    } catch (error) {
      console.error('[masterStore] fetchItems エラー:', error);
      set({
        itemError: 'ネットワークエラーが発生しました',
        itemLoading: false,
      });
    }
  },

  // 品目作成
  createItem: async (itemData: Partial<Item>) => {
    set({ itemLoading: true, itemError: null });

    try {
      const response = await itemAPI.createItem(itemData);

      if (response.success) {
        await get().fetchItems();
        set({ itemLoading: false });
        return true;
      } else {
        set({
          itemError: response.error || '品目の作成に失敗しました',
          itemLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        itemError: 'ネットワークエラーが発生しました',
        itemLoading: false,
      });
      return false;
    }
  },

  // 品目更新
  updateItem: async (id: string, itemData: Partial<Item>) => {
    set({ itemLoading: true, itemError: null });

    try {
      const response = await itemAPI.updateItem(id, itemData);

      if (response.success) {
        await get().fetchItems();
        set({ itemLoading: false });
        return true;
      } else {
        set({
          itemError: response.error || '品目の更新に失敗しました',
          itemLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        itemError: 'ネットワークエラーが発生しました',
        itemLoading: false,
      });
      return false;
    }
  },

  // 品目削除
  deleteItem: async (id: string) => {
    set({ itemLoading: true, itemError: null });

    try {
      const response = await itemAPI.deleteItem(id);

      if (response.success) {
        await get().fetchItems();
        set({ itemLoading: false });
        return true;
      } else {
        set({
          itemError: response.error || '品目の削除に失敗しました',
          itemLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        itemError: 'ネットワークエラーが発生しました',
        itemLoading: false,
      });
      return false;
    }
  },

  // 品目順序更新
  updateItemOrder: async (items: { id: string; order: number }[]) => {
    set({ itemLoading: true, itemError: null });

    try {
      const response = await itemAPI.updateOrder(items);

      if (response.success) {
        await get().fetchItems();
        set({ itemLoading: false });
        return true;
      } else {
        set({
          itemError: response.error || '表示順の更新に失敗しました',
          itemLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        itemError: 'ネットワークエラーが発生しました',
        itemLoading: false,
      });
      return false;
    }
  },

  // エラークリア
  clearErrors: () => set({ 
    inspectionError: null, 
    locationError: null, 
    itemError: null 
  }),
}));