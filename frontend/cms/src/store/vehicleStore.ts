// frontend/cms/src/store/vehicleStore.ts - 完全改善版
// 🔧 改善内容:
// 1. ✅ 二重ネスト構造解決ロジックを追加（UserStoreから採用）
// 2. ✅ Paginationの多段階フォールバックを強化（UserStoreから採用）
// 3. ✅ setFilters/setPageにuseEffect連携の明示的コメント追加
// 4. ✅ エラーメッセージの統一と定数化
// 5. ✅ すべての既存機能・コメント・ロジックを100%保持

import { create } from 'zustand';
import { Vehicle, FilterOptions } from '../types';
import { vehicleAPI } from '../utils/api';

// ==========================================
// エラーメッセージ定数
// ==========================================
const ERROR_MESSAGES = {
  NETWORK: 'ネットワークエラーが発生しました',
  FETCH_LIST: '車両一覧の取得に失敗しました',
  FETCH_DETAIL: '車両情報の取得に失敗しました',
  CREATE: '車両の作成に失敗しました',
  UPDATE: '車両の更新に失敗しました',
  DELETE: '車両の削除に失敗しました',
  NOT_FOUND: '車両が見つかりません',
} as const;

// ==========================================
// 型定義
// ==========================================
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
  hardDeleteVehicle: (id: string) => Promise<boolean>;
  setFilters: (filters: Partial<FilterOptions>) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  clearSelectedVehicle: () => void;
}

// ==========================================
// データ変換ヘルパー関数
// ==========================================

/**
 * バックエンドレスポンスをフロントエンド形式に変換
 * APIレスポンスのフィールド名をフロントエンドの型定義に合わせる
 * 
 * マッピングルール:
 * - plateNumber → vehicleNumber
 * - model → vehicleType
 * - capacityTons → capacity
 * 
 * @param vehicle - バックエンドからの生データ
 * @returns 正規化された車両データ
 */
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

/**
 * フロントエンドからバックエンドへのデータ変換
 * フロントエンドの型定義をバックエンドのAPIリクエスト形式に変換
 * 
 * マッピングルール:
 * - vehicleNumber → plateNumber
 * - vehicleType → model
 * - capacity → capacityTons
 * 
 * @param vehicle - フロントエンドの車両データ
 * @returns バックエンドAPI用のデータ
 */
const denormalizeVehicle = (vehicle: Partial<Vehicle>): any => {
  const backendData: any = { ...vehicle };
  
  if (vehicle.vehicleNumber && !vehicle.plateNumber) {
    backendData.plateNumber = vehicle.vehicleNumber;
    delete backendData.vehicleNumber;
  }
  
  if (vehicle.vehicleType && !vehicle.model) {
    backendData.model = vehicle.vehicleType;
    delete backendData.vehicleType;
  }
  
  if (vehicle.capacity && !vehicle.capacityTons) {
    // ✅ FIX: capacityTons も追加するが、capacity は削除しない
    // バックエンドの UpdateVehicleRequest は capacity フィールドを期待する
    // vehicleService.ts 側で capacityTons: updateData.capacity ?? capacityTons の両方参照に対応
    backendData.capacityTons = vehicle.capacity;
    // delete backendData.capacity; ← 削除: これにより updateData.capacity が undefined になっていた
  }
  
  return backendData;
};

// ==========================================
// Zustand Store定義
// ==========================================
export const useVehicleStore = create<VehicleState>((set, get) => ({
  // ==========================================
  // 初期状態
  // ==========================================
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

  // ==========================================
  // 車両一覧取得
  // ==========================================
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
        let apiData = response.data as any;
        
        console.log('[VehicleStore] response.data の内容:', apiData);
        console.log('[VehicleStore] response.data の型:', typeof apiData);

        // ✅ 改善1: 二重ネスト構造を解決（UserStoreから採用）
        // バックエンドが successResponse() を使っているため、
        // response.data が { success: true, data: {...} } 構造になっている場合がある
        if (apiData.success && apiData.data) {
          console.log('[VehicleStore] 二重ネスト構造を検出、内側のdataを取得');
          apiData = apiData.data;
          console.log('[VehicleStore] 解決後のapiData:', apiData);
        }

        // ✅ 既存機能維持: APIレスポンスから車両配列を抽出（複数パターンに対応）
        let rawVehicles: any[] = [];
        let paginationInfo: any = {};
        
        console.log('[VehicleStore] apiDataは配列か?', Array.isArray(apiData));
        
        // パターン1: 直接配列 [...]
        if (Array.isArray(apiData)) {
          console.log('[VehicleStore] パターン1: 直接配列を検出');
          rawVehicles = apiData;
          // paginationは response の外側にある可能性
          paginationInfo = (response as any).pagination || {};
        }
        // パターン2: { vehicles: [...], pagination: {...} }
        else if (Array.isArray(apiData.vehicles)) {
          console.log('[VehicleStore] パターン2: apiData.vehicles を検出');
          rawVehicles = apiData.vehicles;
          paginationInfo = apiData.pagination || {};
        }
        // パターン3: { data: [...], pagination: {...} }
        else if (Array.isArray(apiData.data)) {
          console.log('[VehicleStore] パターン3: apiData.data を検出');
          rawVehicles = apiData.data;
          paginationInfo = apiData.pagination || {};
        }

        console.log('[VehicleStore] 抽出した生の車両データ:', rawVehicles);
        console.log('[VehicleStore] 抽出したpagination情報:', paginationInfo);

        // ✅ 既存機能維持: 各車両データをフロントエンド形式に変換
        const normalizedVehicles = rawVehicles.map((v: any) => normalizeVehicle(v));

        console.log('[VehicleStore] 正規化後の車両データ:', normalizedVehicles);

        // ✅ 改善2: Paginationの多段階フォールバック強化（UserStoreから採用）
        // APIレスポンス → リクエストパラメータ → デフォルト値 の順でフォールバック
        const page = paginationInfo.page || params.page || 1;
        const limit = paginationInfo.limit || paginationInfo.pageSize || params.pageSize || 10;
        const total = paginationInfo.total || normalizedVehicles.length;
        const totalPages = paginationInfo.totalPages || Math.ceil(total / limit);

        console.log('[VehicleStore] 最終的なpagination値:', {
          page,
          limit,
          total,
          totalPages
        });

        set({
          vehicles: normalizedVehicles,
          pagination: {
            page,
            pageSize: limit,
            total,
            totalPages,
          },
          filters: currentFilters,
          isLoading: false,
        });

        console.log('[VehicleStore] fetchVehicles 成功:', {
          vehiclesCount: normalizedVehicles.length,
          pagination: { page, limit, total, totalPages }
        });
      } else {
        console.error('[VehicleStore] APIレスポンスエラー:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.FETCH_LIST,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('[VehicleStore] ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
    }
  },

  // ==========================================
  // 単一車両取得
  // ==========================================
  fetchVehicle: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] fetchVehicle 開始', { id });

    try {
      // まずキャッシュから検索
      const vehicle = get().vehicles.find(v => v.id === id);
      
      if (vehicle) {
        console.log('[VehicleStore] キャッシュから車両取得:', vehicle);
        set({ selectedVehicle: vehicle, isLoading: false });
      } else {
        // キャッシュになければ全車両を取得してから再検索
        console.log('[VehicleStore] キャッシュになし、fetchVehicles呼び出し');
        await get().fetchVehicles();
        const updatedVehicle = get().vehicles.find(v => v.id === id);
        console.log('[VehicleStore] 再取得後の車両:', updatedVehicle);
        set({ 
          selectedVehicle: updatedVehicle || null,
          isLoading: false,
          error: updatedVehicle ? null : ERROR_MESSAGES.NOT_FOUND
        });
      }
    } catch (error) {
      console.error('[VehicleStore] fetchVehicle エラー:', error);
      set({
        error: ERROR_MESSAGES.FETCH_DETAIL,
        isLoading: false,
      });
    }
  },

  // ==========================================
  // 車両作成
  // ==========================================
  createVehicle: async (vehicleData: Partial<Vehicle>) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] createVehicle 開始', { vehicleData });

    try {
      // ✅ 既存機能維持: フロントエンド形式 → バックエンド形式に変換
      const backendData = denormalizeVehicle(vehicleData);
      
      console.log('[VehicleStore] バックエンドに送信するデータ:', backendData);

      const response = await vehicleAPI.createVehicle(backendData);

      console.log('[VehicleStore] createVehicle APIレスポンス:', response);

      if (response.success) {
        // 作成成功後、一覧を再取得して最新状態を反映
        await get().fetchVehicles();
        set({ isLoading: false });
        console.log('[VehicleStore] createVehicle 成功');
        return true;
      } else {
        console.error('[VehicleStore] createVehicle 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.CREATE,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[VehicleStore] createVehicle ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return false;
    }
  },

  // ==========================================
  // 車両更新
  // ==========================================
  updateVehicle: async (id: string, vehicleData: Partial<Vehicle>) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] updateVehicle 開始', { id, vehicleData });

    try {
      // ✅ 既存機能維持: フロントエンド形式 → バックエンド形式に変換
      const backendData = denormalizeVehicle(vehicleData);
      
      console.log('[VehicleStore] バックエンドに送信するデータ:', backendData);

      const response = await vehicleAPI.updateVehicle(id, backendData);

      console.log('[VehicleStore] updateVehicle APIレスポンス:', response);

      if (response.success) {
        // 更新成功後、一覧を再取得
        await get().fetchVehicles();
        
        // 現在選択中の車両が更新対象だった場合、詳細も再取得
        if (get().selectedVehicle?.id === id) {
          await get().fetchVehicle(id);
        }
        
        set({ isLoading: false });
        console.log('[VehicleStore] updateVehicle 成功');
        return true;
      } else {
        console.error('[VehicleStore] updateVehicle 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.UPDATE,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[VehicleStore] updateVehicle ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return false;
    }
  },

  // ==========================================
  // 車両削除
  // ==========================================
  deleteVehicle: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[VehicleStore] deleteVehicle 開始', { id });

    try {
      const response = await vehicleAPI.deleteVehicle(id);

      console.log('[VehicleStore] deleteVehicle APIレスポンス:', response);

      if (response.success) {
        // 削除成功後、一覧を再取得
        await get().fetchVehicles();
        
        // 削除された車両が選択中だった場合、選択をクリア
        if (get().selectedVehicle?.id === id) {
          set({ selectedVehicle: null });
        }
        
        set({ isLoading: false });
        console.log('[VehicleStore] deleteVehicle 成功');
        return true;
      } else {
        console.error('[VehicleStore] deleteVehicle 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.DELETE,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[VehicleStore] deleteVehicle ネットワークエラー:', error);
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
   * ⚠️ 重要: このメソッドは状態のみを更新し、fetchVehicles()を呼び出しません
   * 
   * 理由:
   * - コンポーネント側のuseEffectがfiltersの変更を監視している
   * - useEffectが自動的にfetchVehicles()を実行する
   * - ここで呼ぶと二重実行になる
   * 
   * 使用例:
   * ```typescript
   * // VehicleManagementコンポーネント
   * useEffect(() => {
   *   fetchVehicles(); // filtersが変更されたら自動実行
   * }, [filters, fetchVehicles]);
   * ```
   */
  setFilters: (newFilters: Partial<FilterOptions>) => {
    const currentFilters = get().filters;
    const updatedFilters = { ...currentFilters, ...newFilters };
    
    console.log('[VehicleStore] setFilters:', {
      current: currentFilters,
      new: newFilters,
      updated: updatedFilters
    });
    
    set({
      filters: updatedFilters,
      // ✅ 改善3: フィルター変更時はページを1にリセット
      pagination: { ...get().pagination, page: 1 }
    });
    
    console.log('[VehicleStore] setFilters完了 (fetchVehiclesはuseEffectが実行)');
  },

  // ==========================================
  // ページ設定
  // ==========================================
  /**
   * ⚠️ 重要: このメソッドは状態のみを更新し、fetchVehicles()を呼び出しません
   * 
   * 理由:
   * - コンポーネント側のuseEffectがpaginationの変更を監視している
   * - useEffectが自動的にfetchVehicles()を実行する
   * - ここで呼ぶと二重実行になる
   * 
   * 使用例:
   * ```typescript
   * // VehicleManagementコンポーネント
   * useEffect(() => {
   *   fetchVehicles(); // paginationが変更されたら自動実行
   * }, [pagination.page, fetchVehicles]);
   * ```
   */
  setPage: (page: number) => {
    console.log('[VehicleStore] setPage:', page);
    
    set({
      pagination: {
        ...get().pagination,
        page,
      },
    });
    
    console.log('[VehicleStore] setPage完了 (fetchVehiclesはuseEffectが実行)');
  },

  // ==========================================
  // エラークリア
  // ==========================================
  /**
   * エラーメッセージをクリアする
   * エラー通知を閉じる際に使用
   */
  hardDeleteVehicle: async (id: string) => {
    const { fetchVehicles } = get();
    console.log('[VehicleStore] hardDeleteVehicle 開始', { id });
    try {
      const response = await vehicleAPI.hardDeleteVehicle(id);
      if (response.success) {
        console.log('[VehicleStore] hardDeleteVehicle 成功');
        await fetchVehicles();
        return true;
      } else {
        console.error('[VehicleStore] hardDeleteVehicle 失敗:', response.error);
        set({ error: response.message || '物理削除に失敗しました' });
        return false;
      }
    } catch (error) {
      console.error('[VehicleStore] hardDeleteVehicle ネットワークエラー:', error);
      set({ error: 'ネットワークエラーが発生しました' });
      return false;
    }
  },

  clearError: () => {
    console.log('[VehicleStore] clearError');
    set({ error: null });
  },

  // ==========================================
  // 選択車両クリア
  // ==========================================
  /**
   * 選択中の車両をクリアする
   * 詳細画面を閉じる際や一覧に戻る際に使用
   */
  clearSelectedVehicle: () => {
    console.log('[VehicleStore] clearSelectedVehicle');
    set({ selectedVehicle: null });
  },
}));