// frontend/cms/src/store/inspectionItemStore.ts - 完全新規作成
// 🎯 Vehicle/UserStoreと完全に統一されたパターン
// ✅ 独自機能: 順序変更（updateOrder）
// ✅ すべての標準機能を実装

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
    type: item.type || 'checkbox',
    category: item.category || 'pre',
  };
};

/**
 * フロントエンドからバックエンドへのデータ変換
 * フロントエンドの型定義をバックエンドのAPIリクエスト形式に変換
 * 
 * @param item - フロントエンドの点検項目データ
 * @returns バックエンドAPI用のデータ
 */
const denormalizeInspectionItem = (item: Partial<InspectionItem>): any => {
  const backendData: any = { ...item };
  
  // 現時点では変換不要だが、拡張性のために関数を用意
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
        
        // パターン1: 直接配列 [...]
        if (Array.isArray(apiData)) {
          console.log('[InspectionItemStore] パターン1: 直接配列を検出');
          rawItems = apiData;
          paginationInfo = (response as any).pagination || {};
        }
        // パターン2: { items: [...], pagination: {...} }
        else if (Array.isArray(apiData.items)) {
          console.log('[InspectionItemStore] パターン2: apiData.items を検出');
          rawItems = apiData.items;
          paginationInfo = apiData.pagination || {};
        }
        // パターン3: { inspectionItems: [...], pagination: {...} }
        else if (Array.isArray(apiData.inspectionItems)) {
          console.log('[InspectionItemStore] パターン3: apiData.inspectionItems を検出');
          rawItems = apiData.inspectionItems;
          paginationInfo = apiData.pagination || {};
        }
        // パターン4: { data: [...], pagination: {...} }
        else if (Array.isArray(apiData.data)) {
          console.log('[InspectionItemStore] パターン4: apiData.data を検出');
          rawItems = apiData.data;
          paginationInfo = apiData.pagination || {};
        }

        console.log('[InspectionItemStore] 抽出した生の点検項目データ:', rawItems);
        console.log('[InspectionItemStore] 抽出したpagination情報:', paginationInfo);

        // 各点検項目データをフロントエンド形式に変換
        const normalizedItems = rawItems.map((item: any) => normalizeInspectionItem(item));

        // order でソート（昇順）
        normalizedItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        console.log('[InspectionItemStore] 正規化後の点検項目データ:', normalizedItems);

        // Paginationの多段階フォールバック
        const page = paginationInfo.page || params.page || 1;
        const limit = paginationInfo.limit || paginationInfo.pageSize || params.pageSize || 100;
        const total = paginationInfo.total || normalizedItems.length;
        const totalPages = paginationInfo.totalPages || Math.ceil(total / limit);

        console.log('[InspectionItemStore] 最終的なpagination値:', {
          page,
          limit,
          total,
          totalPages
        });

        set({
          items: normalizedItems,
          pagination: {
            page,
            pageSize: limit,
            total,
            totalPages,
          },
          filters:  currentFilters as FilterOptions & { category?: 'pre' | 'post' },  // ✅ 型アサーション追加
          isLoading: false,
        });

        console.log('[InspectionItemStore] fetchItems 成功:', {
          itemsCount: normalizedItems.length,
          pagination: { page, limit, total, totalPages }
        });
      } else {
        console.error('[InspectionItemStore] APIレスポンスエラー:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.FETCH_LIST,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[InspectionItemStore] ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
    }
  },

  // ==========================================
  // 単一点検項目取得
  // ==========================================
  fetchItem: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[InspectionItemStore] fetchItem 開始', { id });

    try {
      // まずキャッシュから検索
      const item = get().items.find(i => i.id === id);
      
      if (item) {
        console.log('[InspectionItemStore] キャッシュから点検項目取得:', item);
        set({ selectedItem: item, isLoading: false });
      } else {
        // キャッシュになければ全項目を取得してから再検索
        console.log('[InspectionItemStore] キャッシュになし、fetchItems呼び出し');
        await get().fetchItems();
        const updatedItem = get().items.find(i => i.id === id);
        console.log('[InspectionItemStore] 再取得後の点検項目:', updatedItem);
        set({ 
          selectedItem: updatedItem || null,
          isLoading: false,
          error: updatedItem ? null : ERROR_MESSAGES.NOT_FOUND
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