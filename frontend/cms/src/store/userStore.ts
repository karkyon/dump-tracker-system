// frontend/cms/src/store/userStore.ts - 完全改善版
// 🔧 改善内容:
// 1. ✅ データ変換ヘルパー関数を追加（将来的なフィールド名変更対応）
// 2. ✅ エラーメッセージの統一と定数化
// 3. ✅ setFilters/setPageのコメントをより明確に
// 4. ✅ normalizeUser/denormalizeUser関数を追加（VehicleStoreから採用）
// 5. ✅ すべての既存機能・コメント・ロジックを100%保持

import { create } from 'zustand';
import { User, FilterOptions } from '../types';
import { userAPI } from '../utils/api';

// ==========================================
// エラーメッセージ定数
// ==========================================
const ERROR_MESSAGES = {
  NETWORK: 'ネットワークエラーが発生しました',
  FETCH_LIST: 'ユーザー一覧の取得に失敗しました',
  FETCH_DETAIL: 'ユーザー情報の取得に失敗しました',
  CREATE: 'ユーザーの作成に失敗しました',
  UPDATE: 'ユーザーの更新に失敗しました',
  DELETE: 'ユーザーの削除に失敗しました',
  NOT_FOUND: 'ユーザーが見つかりません',
} as const;

// ==========================================
// 型定義
// ==========================================
interface UserState {
  // 状態
  users: User[];
  selectedUser: User | null;
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
  fetchUsers: (filters?: FilterOptions) => Promise<void>;
  fetchUser: (id: string) => Promise<void>;
  createUser: (userData: Partial<User>) => Promise<{ success: boolean; fieldErrors?: Record<string, string> }>;
  updateUser: (id: string, userData: Partial<User>) => Promise<{ success: boolean; fieldErrors?: Record<string, string> }>;
  toggleUserStatus: (id: string) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  setFilters: (filters: Partial<FilterOptions>) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  clearSelectedUser: () => void;
}

// ==========================================
// データ変換ヘルパー関数
// ==========================================

/**
 * ✅ 改善1: バックエンドレスポンスをフロントエンド形式に変換
 * 将来的にAPIのフィールド名が変更された場合に対応するための変換層
 * 
 * 現在は変換不要だが、拡張性のために関数を用意
 * 例: バックエンドが username → userName に変更された場合に対応
 * 
 * @param user - バックエンドからの生データ
 * @returns 正規化されたユーザーデータ
 */
const normalizeUser = (user: any): User => {
  return {
    ...user,
    // 現時点では変換不要
    // 将来的なフィールド名マッピング用のプレースホルダー
    // 例: userName: user.username || user.userName,
  };
};

/**
 * ✅ 改善1: フロントエンドからバックエンドへのデータ変換
 * フロントエンドの型定義をバックエンドのAPIリクエスト形式に変換
 * 
 * 現在は変換不要だが、拡張性のために関数を用意
 * 例: フロントエンドの userName → バックエンドの username に変換
 * 
 * @param user - フロントエンドのユーザーデータ
 * @returns バックエンドAPI用のデータ
 */
const denormalizeUser = (user: Partial<User>): any => {
  const backendData: any = { ...user };
  
  // 現時点では変換不要
  // 将来的なフィールド名マッピング用のプレースホルダー
  // 例:
  // if (user.userName && !user.username) {
  //   backendData.username = user.userName;
  //   delete backendData.userName;
  // }
  
  return backendData;
};

/**
 * バックエンドのバリデーションエラーレスポンスを
 * フォームフィールド別エラーに変換する
 *
 * バックエンドの sendValidationError は以下の形式でレスポンスを返す:
 * {
 *   success: false,
 *   error: 'VALIDATION_ERROR',
 *   message: '...',
 *   errors: [{ field: 'username', message: '...' }]  // ← これを解析
 * }
 */
const parseBackendFieldErrors = (response: any): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};
 
  // response.errors 配列がある場合（sendValidationError の形式）
  if (Array.isArray(response.errors)) {
    response.errors.forEach((e: { field: string; message: string }) => {
      if (e.field && e.message && e.field !== 'user') {
        // 'user' フィールドは汎用エラーなのでスキップ
        fieldErrors[e.field] = e.message;
      }
    });
  }
 
  return fieldErrors;
};

// ==========================================
// Zustand Store定義
// ==========================================
export const useUserStore = create<UserState>((set, get) => ({
  // ==========================================
  // 初期状態
  // ==========================================
  users: [],
  selectedUser: null,
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
  // ユーザー一覧取得
  // ==========================================
  fetchUsers: async (filters = {}) => {
    set({ isLoading: true, error: null });

    try {
      const currentFilters = { ...get().filters, ...filters };
      const params = {
        ...currentFilters,
        page: get().pagination.page,
        pageSize: get().pagination.pageSize,
      };

      console.log('[UserStore] fetchUsers called with params:', params);

      const response = await userAPI.getUsers(params);

      console.log('[UserStore] API response:', response);

      if (response.success && response.data) {
        let apiData = response.data as any;
        
        console.log('[UserStore] Raw response.data type:', typeof apiData);
        console.log('[UserStore] Raw response.data:', apiData);
        
        // ✅ 既存機能維持: 二重ネスト構造を解決
        // バックエンドが successResponse() を使っているため、
        // response.data が { success: true, data: {...} } 構造になっている場合がある
        if (apiData.success && apiData.data) {
          console.log('[UserStore] Double-nested structure detected, unwrapping...');
          apiData = apiData.data;  // ← 内側のdataを取得
          console.log('[UserStore] Unwrapped apiData:', apiData);
        }
        
        console.log('[UserStore] Is apiData an array?', Array.isArray(apiData));
        
        // ✅ 既存機能維持: 複数のレスポンス構造パターンに対応
        let users: any[] = [];
        let paginationInfo: any = {};
        
        // パターン1: { users: [...], pagination: {...} }
        if (apiData.users && Array.isArray(apiData.users)) {
          console.log('[UserStore] Pattern 1: apiData.users detected');
          users = apiData.users;
          paginationInfo = apiData.pagination || {};
        }
        // パターン2: { data: [...], pagination: {...} }
        else if (apiData.data && Array.isArray(apiData.data)) {
          console.log('[UserStore] Pattern 2: apiData.data detected');
          users = apiData.data;
          paginationInfo = apiData.pagination || {};
        }
        // パターン3: 直接配列 [...]
        else if (Array.isArray(apiData)) {
          console.log('[UserStore] Pattern 3: Direct array detected');
          users = apiData;
          // paginationは response の外側にある可能性
          paginationInfo = (response as any).pagination || {};
        }
        
        console.log('[UserStore] Extracted users count:', users.length);
        console.log('[UserStore] Extracted pagination:', paginationInfo);
        
        // ✅ 改善1: 各ユーザーデータを正規化（VehicleStoreから採用）
        const normalizedUsers = users.map((u: any) => normalizeUser(u));
        
        console.log('[UserStore] Normalized users:', normalizedUsers);
        
        // ✅ 既存機能維持: paginationオブジェクトから値を取得（多段階フォールバック）
        // APIレスポンス → リクエストパラメータ → デフォルト値 の順でフォールバック
        const page = paginationInfo.page || params.page || 1;
        const limit = paginationInfo.limit || paginationInfo.pageSize || params.pageSize || 10;
        const total = paginationInfo.total || normalizedUsers.length;
        const totalPages = paginationInfo.totalPages || Math.ceil(total / limit);

        console.log('[UserStore] Final pagination values:', {
          page,
          limit,
          total,
          totalPages
        });

        set({
          users: normalizedUsers,
          pagination: {
            page,
            pageSize: limit,
            total,
            totalPages,
          },
          filters: currentFilters,
          isLoading: false,
        });

        console.log('[UserStore] fetchUsers success:', {
          userCount: normalizedUsers.length,
          pagination: { page, limit, total, totalPages }
        });
      } else {
        set({
          error: response.error || ERROR_MESSAGES.FETCH_LIST,
          isLoading: false,
        });
        console.error('[UserStore] fetchUsers error:', response.error);
      }
    } catch (error) {
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      console.error('[UserStore] fetchUsers exception:', error);
    }
  },

  // ==========================================
  // 単一ユーザー取得
  // ==========================================
  fetchUser: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[UserStore] fetchUser 開始', { id });

    try {
      // まずキャッシュから検索
      const user = get().users.find(u => u.id === id);
      
      if (user) {
        console.log('[UserStore] キャッシュからユーザー取得:', user);
        set({ selectedUser: user, isLoading: false });
      } else {
        // ユーザーが見つからない場合は fetchUsers してから再度検索
        console.log('[UserStore] キャッシュになし、fetchUsers呼び出し');
        await get().fetchUsers();
        const updatedUser = get().users.find(u => u.id === id);
        console.log('[UserStore] 再取得後のユーザー:', updatedUser);
        set({ 
          selectedUser: updatedUser || null, 
          isLoading: false,
          error: updatedUser ? null : ERROR_MESSAGES.NOT_FOUND
        });
      }
    } catch (error) {
      console.error('[UserStore] fetchUser エラー:', error);
      set({
        error: ERROR_MESSAGES.FETCH_DETAIL,
        isLoading: false,
      });
    }
  },

  // ==========================================
  // ユーザー作成
  // ==========================================
  createUser: async (userData: Partial<User>) => {
    set({ isLoading: true, error: null });
 
    console.log('[UserStore] createUser 開始', { userData });
 
    try {
      const backendData = denormalizeUser(userData);
      console.log('[UserStore] バックエンドに送信するデータ:', backendData);
 
      const response = await userAPI.createUser(backendData);
 
      console.log('[UserStore] createUser APIレスポンス:', response);
 
      if (response.success) {
        await get().fetchUsers();
        set({ isLoading: false });
        console.log('[UserStore] createUser 成功');
        return { success: true };
      } else {
        console.error('[UserStore] createUser 失敗:', response.error, response.message);
 
        // ✅ バックエンドのエラーメッセージを優先表示（response.error はエラーコード）
        const displayMessage = response.message || response.error || ERROR_MESSAGES.CREATE;
        set({
          error: displayMessage,
          isLoading: false,
        });
 
        // ✅ バックエンドのフィールド別エラーを解析して返す
        const fieldErrors = parseBackendFieldErrors(response);
 
        return { success: false, fieldErrors };
      }
    } catch (error) {
      console.error('[UserStore] createUser ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return { success: false };
    }
  },

  // ==========================================
  // ユーザー更新
  // ==========================================
  updateUser: async (id: string, userData: Partial<User>) => {
    set({ isLoading: true, error: null });
 
    console.log('[UserStore] updateUser 開始', { id, userData });
 
    try {
      const backendData = denormalizeUser(userData);
      console.log('[UserStore] バックエンドに送信するデータ:', backendData);
 
      const response = await userAPI.updateUser(id, backendData);
 
      console.log('[UserStore] updateUser APIレスポンス:', response);
 
      if (response.success) {
        await get().fetchUsers();
        if (get().selectedUser?.id === id) {
          await get().fetchUser(id);
        }
        set({ isLoading: false });
        console.log('[UserStore] updateUser 成功');
        return { success: true };
      } else {
        console.error('[UserStore] updateUser 失敗:', response.error, response.message);
        const displayMessage = response.message || response.error || ERROR_MESSAGES.UPDATE;
        set({
          error: displayMessage,
          isLoading: false,
        });
        const fieldErrors = parseBackendFieldErrors(response);
        return { success: false, fieldErrors };
      }
    } catch (error) {
      console.error('[UserStore] updateUser ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return { success: false };
    }
  },

  // ==========================================
  // ユーザー削除
  // ==========================================
  deleteUser: async (id: string) => {
    set({ isLoading: true, error: null });

    console.log('[UserStore] deleteUser 開始', { id });

    try {
      const response = await userAPI.deleteUser(id);

      console.log('[UserStore] deleteUser APIレスポンス:', response);

      if (response.success) {
        // 削除成功後、一覧を再取得
        await get().fetchUsers();
        
        // 削除されたユーザーが選択中だった場合、選択をクリア
        if (get().selectedUser?.id === id) {
          set({ selectedUser: null });
        }
        
        set({ isLoading: false });
        console.log('[UserStore] deleteUser 成功');
        return true;
      } else {
        console.error('[UserStore] deleteUser 失敗:', response.error);
        set({
          error: response.error || ERROR_MESSAGES.DELETE,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[UserStore] deleteUser ネットワークエラー:', error);
      set({
        error: ERROR_MESSAGES.NETWORK,
        isLoading: false,
      });
      return false;
    }
  },

  // ==========================================
  // ユーザーステータス切替
  // ==========================================
  toggleUserStatus: async (id: string) => {
    set({ isLoading: true, error: null });
 
    console.log('[UserStore] toggleUserStatus 開始', { id });
 
    try {
      const response = await userAPI.toggleUserStatus(id);
 
      console.log('[UserStore] toggleUserStatus APIレスポンス:', response);
 
      if (response.success) {
        // 切替成功後、一覧を再取得して最新状態を反映
        await get().fetchUsers();
        set({ isLoading: false });
        console.log('[UserStore] toggleUserStatus 成功');
        return true;
      } else {
        console.error('[UserStore] toggleUserStatus 失敗:', response.error);
        const displayMessage = response.message || response.error || 'ステータスの変更に失敗しました';
        set({
          error: displayMessage,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error('[UserStore] toggleUserStatus ネットワークエラー:', error);
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
   * ⚠️ 重要: このメソッドは状態のみを更新し、fetchUsers()を呼び出しません
   * 
   * 理由:
   * - コンポーネント側のuseEffectがfiltersの変更を監視している
   * - useEffectが自動的にfetchUsers()を実行する
   * - ここで呼ぶと二重実行になる
   * 
   * 使用例:
   * ```typescript
   * // UserManagementコンポーネント
   * useEffect(() => {
   *   fetchUsers(); // filtersが変更されたら自動実行
   * }, [filters, fetchUsers]);
   * ```
   */
  setFilters: (newFilters: Partial<FilterOptions>) => {
    const currentFilters = get().filters;
    const updatedFilters = { ...currentFilters, ...newFilters };
    
    console.log('[UserStore] setFilters:', {
      current: currentFilters,
      new: newFilters,
      updated: updatedFilters
    });
    
    set({
      filters: updatedFilters,
      // ✅ 改善3: フィルター変更時はページを1にリセット（VehicleStoreから採用）
      pagination: { ...get().pagination, page: 1 }
    });
    
    console.log('[UserStore] setFilters完了 (fetchUsersはuseEffectが実行)');
  },

  // ==========================================
  // ページ設定
  // ==========================================
  /**
   * ⚠️ 重要: このメソッドは状態のみを更新し、fetchUsers()を呼び出しません
   * 
   * 理由:
   * - コンポーネント側のuseEffectがpaginationの変更を監視している
   * - useEffectが自動的にfetchUsers()を実行する
   * - ここで呼ぶと二重実行になる
   * 
   * 使用例:
   * ```typescript
   * // UserManagementコンポーネント
   * useEffect(() => {
   *   fetchUsers(); // paginationが変更されたら自動実行
   * }, [pagination.page, fetchUsers]);
   * ```
   */
  setPage: (page: number) => {
    console.log('[UserStore] setPage:', page);
    
    set({
      pagination: {
        ...get().pagination,
        page,
      },
    });
    
    console.log('[UserStore] setPage完了 (fetchUsersはuseEffectが実行)');
  },

  // ==========================================
  // エラークリア
  // ==========================================
  /**
   * エラーメッセージをクリアする
   * エラー通知を閉じる際に使用
   */
  clearError: () => {
    console.log('[UserStore] clearError');
    set({ error: null });
  },

  // ==========================================
  // 選択ユーザークリア
  // ==========================================
  /**
   * 選択中のユーザーをクリアする
   * 詳細画面を閉じる際や一覧に戻る際に使用
   */
  clearSelectedUser: () => {
    console.log('[UserStore] clearSelectedUser');
    set({ selectedUser: null });
  },
}));