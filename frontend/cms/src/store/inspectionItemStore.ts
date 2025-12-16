// frontend/cms/src/store/inspectionItemStore.ts - 完全版（599行相当）
// 🎯 Vehicle/UserStoreと完全に統一されたパターン
// ✅ 独自機能: 順序変更（updateOrder）
// ✅ すべての標準機能を実装
// 🐛 修正: type → inputType, INPUT → TEXT, order → displayOrder

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
    // order のデフォルト値を設定（バックエンドではdisplayOrder）
    order: item.displayOrder ?? item.order ?? 0,
    isRequired: item.isRequired ?? true,
    inputType: item.inputType || item.type || 'CHECKBOX',
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
  
  // 🐛 修正: inputType (大文字変換、TEXT値使用)
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
  
  console.log('[denormalizeInspectionItem] 変換結果:', backendData);
  
  return backendData;
};

// ==========================================
// Zustand Store
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
    pageSize: 100,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: '',
    isActive: true,
    category: 'pre',
  },

  // ==========================================
  // 点検項目一覧取得
  // ==========================================
  fetchItems: async (filters?: FilterOptions) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] fetchItems 開始', { filters });

    try {
      const currentFilters = filters || get().filters;
      const currentPagination = get().pagination;

      // APIパラメータ構築
      const params = {
        page: currentPagination.page,
        pageSize: currentPagination.pageSize,
        search: currentFilters.search,
        isActive: currentFilters.isActive,
        category: currentFilters.category,
      };

      console.log('[InspectionItemStore] API呼び出しパラメータ:', params);

      const response = await inspectionItemAPI.getInspectionItems(params);

      console.log('[InspectionItemStore] APIレスポンス全体:', response);
      console.log('[InspectionItemStore] response.data の内容:', response.data);
      console.log('[InspectionItemStore] response.data の型:', typeof response.data);

      if (response.success && response.data) {
        // 🔧 2重ネスト構造を解決
        let apiData = response.data;
        
        // response.data が { data: [...] } の構造の場合、内側のdataを取得
        if (typeof apiData === 'object' && 'data' in apiData && apiData.data !== undefined) {
          console.log('[InspectionItemStore] 二重ネスト構造を検出、内側のdataを取得');
          apiData = apiData.data;
        }
        
        console.log('[InspectionItemStore] 解決後のapiData:', apiData);
        console.log('[InspectionItemStore] apiDataは配列か?', Array.isArray(apiData));

        // データと pagination の抽出
        let rawItems: any[] = [];
        let paginationInfo: any = {};

        if (Array.isArray(apiData)) {
          // パターン1: 直接配列
          console.log('[InspectionItemStore] パターン1: 直接配列を検出');
          rawItems = apiData;
          paginationInfo = response.data?.pagination || response.data?.meta || {};
        } else if (apiData.items && Array.isArray(apiData.items)) {
          // パターン2: { items: [...], pagination: {...} }
          console.log('[InspectionItemStore] パターン2: apiData.items を検出');
          rawItems = apiData.items;
          paginationInfo = apiData.pagination || apiData.meta || {};
        } else if (apiData.inspectionItems && Array.isArray(apiData.inspectionItems)) {
          // パターン3: { inspectionItems: [...], pagination: {...} }
          console.log('[InspectionItemStore] パターン3: apiData.inspectionItems を検出');
          rawItems = apiData.inspectionItems;
          paginationInfo = apiData.pagination || apiData.meta || {};
        } else if (apiData.data && Array.isArray(apiData.data)) {
          // パターン4: { data: [...], pagination: {...} }
          console.log('[InspectionItemStore] パターン4: apiData.data を検出');
          rawItems = apiData.data;
          paginationInfo = apiData.pagination || apiData.meta || {};
        }

        console.log('[InspectionItemStore] 抽出した生の点検項目データ:', rawItems);
        console.log('[InspectionItemStore] 抽出したpagination情報:', paginationInfo);

        // 正規化
        const normalizedItems = rawItems.map(normalizeInspectionItem);

        console.log('[InspectionItemStore] 正規化後の点検項目データ:', normalizedItems);

        // ページネーション情報の設定
        const totalItems = paginationInfo.total ?? 
                          paginationInfo.totalCount ?? 
                          normalizedItems.length;
        const currentPageSize = paginationInfo.pageSize ?? 
                               paginationInfo.limit ?? 
                               params.pageSize;
        const totalPages = paginationInfo.totalPages ?? 
                          Math.ceil(totalItems / currentPageSize);

        console.log('[InspectionItemStore] 最終的なpagination値:', {
          page: paginationInfo.page ?? params.page,
          pageSize: currentPageSize,
          total: totalItems,
          totalPages: totalPages,
        });

        set({
          items: normalizedItems,
          pagination: {
            page: paginationInfo.page ?? params.page,
            pageSize: currentPageSize,
            total: totalItems,
            totalPages: totalPages,
          },
          isLoading: false,
        });

        console.log('[InspectionItemStore] fetchItems 成功:', {
          itemCount: normalizedItems.length,
          pagination: get().pagination,
        });
      } else {
        console.error('[InspectionItemStore] fetchItems APIエラー:', response.error);
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
  // ==========================================
  fetchItem: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] fetchItem 開始', { id });

    try {
      const response = await inspectionItemAPI.getInspectionItem(id);

      console.log('[InspectionItemStore] fetchItem APIレスポンス:', response);

      if (response.success && response.data) {
        // 正規化
        const normalizedItem = normalizeInspectionItem(response.data);

        set({
          selectedItem: normalizedItem,
          isLoading: false,
        });

        console.log('[InspectionItemStore] fetchItem 成功');
      } else {
        console.error('[InspectionItemStore] fetchItem APIエラー:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.NOT_FOUND,
          selectedItem: null,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[InspectionItemStore] fetchItem エラー:', error);
      set({
        error: ERROR_MESSAGES.FETCH_DETAIL,
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
        // 作成成功後、一覧を再取得して最新状態を反映
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
  // 点検項目の順序更新（独自機能）
  // ==========================================
  /**
   * 複数の点検項目の順序を一括更新
   * 
   * @param updates - 更新する項目のID配列とorder値
   * @returns 成功時true、失敗時false
   * 
   * 使用例:
   * ```typescript
   * updateOrder([
   *   { id: 'item1', order: 1 },
   *   { id: 'item2', order: 2 },
   * ]);
   * ```
   */
  updateOrder: async (updates: Array<{ id: string; order: number }>) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] updateOrder 開始', { updates });

    try {
      const response = await inspectionItemAPI.updateOrder(updates);

      console.log('[InspectionItemStore] updateOrder APIレスポンス:', response);

      if (response.success) {
        // 順序更新成功後、一覧を再取得してソート順を反映
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
  /**
   * ⚠️ 重要: このメソッドは状態のみを更新し、fetchItems()を呼び出しません
   * 
   * 理由:
   * - コンポーネント側のuseEffectがfiltersの変更を監視している
   * - useEffectが自動的にfetchItems()を実行する
   * - ここで呼ぶと二重実行になる
   * 
   * 使用例:
   * ```typescript
   * // InspectionItemManagementコンポーネント
   * useEffect(() => {
   *   fetchItems(); // filtersが変更されたら自動実行
   * }, [filters, fetchItems]);
   * ```
   */
  setFilters: (newFilters: Partial<FilterOptions & { category?: 'pre' | 'post' }>) => {
    const currentFilters = get().filters;
    const updatedFilters = { ...currentFilters, ...newFilters };
    
    console.log('[InspectionItemStore] setFilters:', {
      current: currentFilters,
      new: newFilters,
      updated: updatedFilters
    });
    
    set({
      filters: updatedFilters,
      // フィルター変更時はページを1にリセット
      pagination: { ...get().pagination, page: 1 }
    });
    
    console.log('[InspectionItemStore] setFilters完了 (fetchItemsはuseEffectが実行)');
  },

  // ==========================================
  // ページ設定
  // ==========================================
  /**
   * ⚠️ 重要: このメソッドは状態のみを更新し、fetchItems()を呼び出しません
   * 
   * 理由:
   * - コンポーネント側のuseEffectがpaginationの変更を監視している
   * - useEffectが自動的にfetchItems()を実行する
   * - ここで呼ぶと二重実行になる
   * 
   * 使用例:
   * ```typescript
   * // InspectionItemManagementコンポーネント
   * useEffect(() => {
   *   fetchItems(); // paginationが変更されたら自動実行
   * }, [pagination.page, fetchItems]);
   * ```
   */
  setPage: (page: number) => {
    console.log('[InspectionItemStore] setPage:', page);
    
    set({
      pagination: {
        ...get().pagination,
        page,
      },
    });
    
    console.log('[InspectionItemStore] setPage完了 (fetchItemsはuseEffectが実行)');
  },

  // ==========================================
  // エラークリア
  // ==========================================
  /**
   * エラーメッセージをクリアする
   * エラー通知を閉じる際に使用
   */
  clearError: () => {
    console.log('[InspectionItemStore] clearError');
    set({ error: null });
  },

  // ==========================================
  // 選択項目クリア
  // ==========================================
  /**
   * 選択中の点検項目をクリアする
   * 詳細画面を閉じる際や一覧に戻る際に使用
   */
  clearSelectedItem: () => {
    console.log('[InspectionItemStore] clearSelectedItem');
    set({ selectedItem: null });
  },
}));