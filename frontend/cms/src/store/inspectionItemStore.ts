// frontend/cms/src/store/inspectionItemStore.ts - 完全新規作成
// 🎯 Vehicle/UserStoreと完全に統一されたパターン
// ✅ 独自機能: 順序変更（updateOrder）
// ✅ すべての標準機能を実装
// 🐛 修正: type → inputType, 大文字変換

import { create } from 'zustand';
import { InspectionItem, FilterOptions } from '../types';
import { inspectionItemAPI } from '../utils/api';

// ==========================================
// エラーメッセージ定数
// ==========================================
const ERROR_MESSAGES = {
  NETWORK: 'ネットワークエラーが発生しました',
  FETCH_LIST: '点検項目一覧の取得に失敗しました',
  FETCH_DETAIL: '点検項目情報の取得に失敗しました',
  CREATE: '点検項目の作成に失敗しました',
  UPDATE: '点検項目の更新に失敗しました',
  DELETE: '点検項目の削除に失敗しました',
  UPDATE_ORDER: '点検項目の順序更新に失敗しました',
  NOT_FOUND: '点検項目が見つかりません',
} as const;

// ==========================================
// 型定義
// ==========================================
interface InspectionItemState {
  // 状態
  items: InspectionItem[];
  selectedItem: InspectionItem | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: FilterOptions & {
    category?: 'pre' | 'post';
  };

  // アクション
  fetchItems: (filters?: FilterOptions) => Promise<void>;
  fetchItem: (id: string) => Promise<void>;
  createItem: (itemData: Partial<InspectionItem>) => Promise<boolean>;
  updateItem: (id: string, itemData: Partial<InspectionItem>) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  updateOrder: (updates: Array<{ id: string; order: number }>) => Promise<boolean>;
  setFilters: (filters: Partial<FilterOptions & { category?: 'pre' | 'post' }>) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  clearSelectedItem: () => void;
}

// ==========================================
// データ変換ヘルパー関数
// ==========================================

/**
 * バックエンドレスポンスをフロントエンド形式に変換
 * 将来的にAPIのフィールド名が変更された場合に対応するための変換層
 * 
 * @param item - バックエンドからの生データ
 * @returns 正規化された点検項目データ
 */
const normalizeInspectionItem = (item: any): InspectionItem => {
  return {
    ...item,
    // 現時点では変換不要だが、拡張性のために関数を用意
    // order のデフォルト値を設定
    order: item.order ?? 0,
    isRequired: item.isRequired ?? true,
    inputType: item.inputType || item.type || 'CHECKBOX',  // 🐛 修正: type対応
    category: item.category || 'pre',
  };
};

/**
 * フロントエンドからバックエンドへのデータ変換
 * フロントエンドの型定義をバックエンドのAPIリクエスト形式に変換
 * 
 * @param item - フロントエンドの点検項目データ
 * @returns バックエンドAPI用のデータ
 * 
 * 🐛 修正内容:
 * - type → inputType への変換
 * - 値を大文字に変換: 'checkbox' → 'CHECKBOX', 'input' → 'TEXT'
 * - order → displayOrder への変換（バックエンドのフィールド名に合わせる）
 */
const denormalizeInspectionItem = (item: Partial<InspectionItem>): any => {
  const backendData: any = {};
  
  // name
  if (item.name !== undefined) {
    backendData.name = item.name;
  }
  
  // description
  if (item.description !== undefined) {
    backendData.description = item.description;
  }
  
  // 🐛 修正: inputType (大文字変換)
  if (item.inputType !== undefined) {
    backendData.inputType = typeof item.inputType === 'string' 
      ? item.inputType.toUpperCase() 
      : item.inputType;
  } else if (item.type !== undefined) {
    // 🐛 修正: type → inputType への変換（互換性のため）
    backendData.inputType = typeof item.type === 'string' 
      ? item.type.toUpperCase() 
      : item.type;
  }
  
  // category
  if (item.category !== undefined) {
    backendData.category = item.category;
  }
  
  // 🐛 修正: order → displayOrder への変換
  if (item.order !== undefined) {
    backendData.displayOrder = item.order;
  }
  
  // isRequired
  if (item.isRequired !== undefined) {
    backendData.isRequired = item.isRequired;
  }
  
  // isActive
  if (item.isActive !== undefined) {
    backendData.isActive = item.isActive;
  }
  
  console.log('[denormalizeInspectionItem] 変換結果:', {
    input: item,
    output: backendData
  });
  
  return backendData;
};

// ==========================================
// Zustand Store定義
// ==========================================
export const useInspectionItemStore = create<InspectionItemState>((set, get) => ({
  // ==========================================
  // 初期状態
  // ==========================================
  items: [],
  selectedItem: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 100, // 点検項目は通常数が少ないため大きめに設定
    total: 0,
    totalPages: 0,
  },
  filters: {},

  // ==========================================
  // 点検項目一覧取得
  // ==========================================
  fetchItems: async (filters = {}) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] fetchItems 開始', { filters });

    try {
      const currentFilters = { ...get().filters, ...filters };
      const params = {
        ...currentFilters,
        page: get().pagination.page,
        pageSize: get().pagination.pageSize,
      };

      console.log('[InspectionItemStore] API呼び出しパラメータ:', params);

      const response = await inspectionItemAPI.getInspectionItems(params);

      console.log('[InspectionItemStore] APIレスポンス全体:', response);

      if (response.success && response.data) {
        let apiData = response.data as any;
        
        console.log('[InspectionItemStore] response.data の内容:', apiData);
        console.log('[InspectionItemStore] response.data の型:', typeof apiData);

        // 二重ネスト構造を解決
        if (apiData.success && apiData.data) {
          console.log('[InspectionItemStore] 二重ネスト構造を検出、内側のdataを取得');
          apiData = apiData.data;
          console.log('[InspectionItemStore] 解決後のapiData:', apiData);
        }

        // APIレスポンスから点検項目配列を抽出（複数パターンに対応）
        let rawItems: any[] = [];
        let paginationInfo: any = {};
        
        console.log('[InspectionItemStore] apiDataは配列か?', Array.isArray(apiData));
        
        if (Array.isArray(apiData)) {
          // パターン1: apiDataが直接配列の場合
          rawItems = apiData;
          paginationInfo = {
            page: get().pagination.page,
            pageSize: get().pagination.pageSize,
            total: apiData.length,
            totalPages: Math.ceil(apiData.length / get().pagination.pageSize),
          };
          console.log('[InspectionItemStore] パターン1: 直接配列');
        } else if (apiData.items && Array.isArray(apiData.items)) {
          // パターン2: apiData.items が配列の場合
          rawItems = apiData.items;
          paginationInfo = apiData.pagination || {
            page: apiData.page || get().pagination.page,
            pageSize: apiData.pageSize || get().pagination.pageSize,
            total: apiData.total || rawItems.length,
            totalPages: apiData.totalPages || Math.ceil(rawItems.length / get().pagination.pageSize),
          };
          console.log('[InspectionItemStore] パターン2: items配列');
        } else if (apiData.data && Array.isArray(apiData.data)) {
          // パターン3: apiData.data が配列の場合
          rawItems = apiData.data;
          paginationInfo = apiData.pagination || {
            page: apiData.page || get().pagination.page,
            pageSize: apiData.pageSize || get().pagination.pageSize,
            total: apiData.total || rawItems.length,
            totalPages: apiData.totalPages || Math.ceil(rawItems.length / get().pagination.pageSize),
          };
          console.log('[InspectionItemStore] パターン3: data配列');
        } else {
          console.error('[InspectionItemStore] 未知のレスポンス構造:', apiData);
          throw new Error('レスポンス構造が不正です');
        }

        console.log('[InspectionItemStore] 抽出したrawItems:', rawItems);
        console.log('[InspectionItemStore] rawItems長さ:', rawItems.length);

        // データを正規化
        const normalizedItems = rawItems.map(normalizeInspectionItem);
        
        console.log('[InspectionItemStore] 正規化後のitems:', normalizedItems);

        set({
          items: normalizedItems,
          pagination: paginationInfo,
          isLoading: false,
          error: null,
        });

        console.log('[InspectionItemStore] fetchItems 成功', {
          itemsCount: normalizedItems.length,
          pagination: paginationInfo,
        });
      } else {
        console.error('[InspectionItemStore] APIレスポンス失敗:', response);
        set({
          error: response.error || ERROR_MESSAGES.FETCH_LIST,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[InspectionItemStore] fetchItems ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
    }
  },

  // ==========================================
  // 点検項目詳細取得
  // 🐛 修正: getInspectionItem → getInspectionItems に変更
  // ==========================================
  fetchItem: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] fetchItem 開始', { id });

    try {
      // 🐛 修正: getInspectionItems を使用し、IDでフィルタリング
      const response = await inspectionItemAPI.getInspectionItems({ id });

      console.log('[InspectionItemStore] fetchItem APIレスポンス:', response);

      if (response.success && response.data) {
        let apiData = response.data as any;
        
        // 二重ネスト構造を解決
        if (apiData.success && apiData.data) {
          apiData = apiData.data;
        }

        // 配列から最初の要素を取得
        let item: any = null;
        if (Array.isArray(apiData)) {
          item = apiData.find((i: any) => i.id === id) || apiData[0];
        } else if (apiData.items && Array.isArray(apiData.items)) {
          item = apiData.items.find((i: any) => i.id === id) || apiData.items[0];
        } else if (apiData.data && Array.isArray(apiData.data)) {
          item = apiData.data.find((i: any) => i.id === id) || apiData.data[0];
        } else if (apiData.id) {
          // 単一オブジェクトの場合
          item = apiData;
        }

        if (item) {
          const normalizedItem = normalizeInspectionItem(item);
          
          set({
            selectedItem: normalizedItem,
            isLoading: false,
          });

          console.log('[InspectionItemStore] fetchItem 成功:', normalizedItem);
        } else {
          console.error('[InspectionItemStore] 点検項目が見つかりません:', id);
          set({
            error: ERROR_MESSAGES.NOT_FOUND,
            isLoading: false,
          });
        }
      } else {
        console.error('[InspectionItemStore] fetchItem 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.FETCH_DETAIL,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[InspectionItemStore] fetchItem ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
    }
  },

  // ==========================================
  // 点検項目作成
  // ==========================================
  createItem: async (itemData: Partial<InspectionItem>) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] createItem 開始', { itemData });

    try {
      // フロントエンド形式 → バックエンド形式に変換
      const backendData = denormalizeInspectionItem(itemData);
      
      console.log('[InspectionItemStore] バックエンドに送信するデータ:', backendData);

      const response = await inspectionItemAPI.createInspectionItem(backendData);

      console.log('[InspectionItemStore] createItem APIレスポンス:', response);

      if (response.success) {
        // 作成成功後、一覧を再取得
        await get().fetchItems();
        set({ isLoading: false });
        console.log('[InspectionItemStore] createItem 成功');
        return true;
      } else {
        console.error('[InspectionItemStore] createItem 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.CREATE,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[InspectionItemStore] createItem ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return false;
    }
  },

  // ==========================================
  // 点検項目更新
  // ==========================================
  updateItem: async (id: string, itemData: Partial<InspectionItem>) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] updateItem 開始', { id, itemData });

    try {
      // フロントエンド形式 → バックエンド形式に変換
      const backendData = denormalizeInspectionItem(itemData);
      
      console.log('[InspectionItemStore] バックエンドに送信するデータ:', backendData);

      const response = await inspectionItemAPI.updateInspectionItem(id, backendData);

      console.log('[InspectionItemStore] updateItem APIレスポンス:', response);

      if (response.success) {
        // 更新成功後、一覧を再取得
        await get().fetchItems();
        
        // 現在選択中の項目が更新対象だった場合、詳細も再取得
        if (get().selectedItem?.id === id) {
          await get().fetchItem(id);
        }
        
        set({ isLoading: false });
        console.log('[InspectionItemStore] updateItem 成功');
        return true;
      } else {
        console.error('[InspectionItemStore] updateItem 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.UPDATE,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[InspectionItemStore] updateItem ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return false;
    }
  },

  // ==========================================
  // 点検項目削除
  // ==========================================
  deleteItem: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] deleteItem 開始', { id });

    try {
      const response = await inspectionItemAPI.deleteInspectionItem(id);

      console.log('[InspectionItemStore] deleteItem APIレスポンス:', response);

      if (response.success) {
        // 削除成功後、一覧を再取得
        await get().fetchItems();
        
        // 削除された項目が選択中だった場合、選択をクリア
        if (get().selectedItem?.id === id) {
          set({ selectedItem: null });
        }
        
        set({ isLoading: false });
        console.log('[InspectionItemStore] deleteItem 成功');
        return true;
      } else {
        console.error('[InspectionItemStore] deleteItem 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.DELETE,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[InspectionItemStore] deleteItem ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return false;
    }
  },

  // ==========================================
  // 点検項目順序更新（独自機能）
  // ==========================================
  updateOrder: async (updates: Array<{ id: string; order: number }>) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] updateOrder 開始', { updates });

    try {
      const response = await inspectionItemAPI.updateOrder(updates);

      console.log('[InspectionItemStore] updateOrder APIレスポンス:', response);

      if (response.success) {
        // 順序更新成功後、一覧を再取得
        await get().fetchItems();
        set({ isLoading: false });
        console.log('[InspectionItemStore] updateOrder 成功');
        return true;
      } else {
        console.error('[InspectionItemStore] updateOrder 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.UPDATE_ORDER,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[InspectionItemStore] updateOrder ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return false;
    }
  },

  // ==========================================
  // フィルター設定
  // ==========================================
  setFilters: (filters: Partial<FilterOptions & { category?: 'pre' | 'post' }>) => {
    console.log('[InspectionItemStore] setFilters', { filters });
    
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
    
    // フィルター変更時は自動的に一覧を再取得
    get().fetchItems();
  },

  // ==========================================
  // ページ変更
  // ==========================================
  setPage: (page: number) => {
    console.log('[InspectionItemStore] setPage', { page });
    
    set((state) => ({
      pagination: { ...state.pagination, page },
    }));
    
    // ページ変更時は自動的に一覧を再取得
    get().fetchItems();
  },

  // ==========================================
  // エラークリア
  // ==========================================
  clearError: () => {
    console.log('[InspectionItemStore] clearError');
    set({ error: null });
  },

  // ==========================================
  // 選択項目クリア
  // ==========================================
  clearSelectedItem: () => {
    console.log('[InspectionItemStore] clearSelectedItem');
    set({ selectedItem: null });
  },
}));