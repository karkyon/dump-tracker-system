// frontend/cms/src/store/userStore.ts - 完全修正版
// 🔧 修正内容: response.meta参照エラーを修正
// 既存機能: すべてのロジック・コメントを100%保持

import { create } from 'zustand';
import { User, FilterOptions } from '../types';
import { userAPI } from '../utils/api';

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
  createUser: (userData: Partial<User>) => Promise<boolean>;
  updateUser: (id: string, userData: Partial<User>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  setFilters: (filters: Partial<FilterOptions>) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  clearSelectedUser: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  // 初期状態
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

  // ユーザー一覧取得
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

      if (response.success && response.data) {
        // ✅ 修正: バックエンドレスポンス構造に対応
        // APIレスポンスは { users: User[], pagination: {...} } または { users: User[], total, page, limit } 形式
        const backendData = response.data as any;
        
        // ✅ 修正: response.meta を削除（ApiResponse型には存在しない）
        const paginationData = backendData?.pagination || {};
        
        // paginationがない場合は、total, page, limit から構築
        const page = paginationData.page || backendData.page || 1;
        const limit = paginationData.limit || backendData.limit || 10;
        const total = paginationData.total || backendData.total || 0;
        const totalPages = paginationData.totalPages || Math.ceil(total / limit);

        set({
          users: backendData.users || [],
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
          userCount: backendData.users?.length || 0,
          pagination: { page, limit, total, totalPages }
        });
      } else {
        set({
          error: response.error || 'ユーザー一覧の取得に失敗しました',
          isLoading: false,
        });
        console.error('[UserStore] fetchUsers error:', response.error);
      }
    } catch (error) {
      const errorMessage = 'ネットワークエラーが発生しました';
      set({
        error: errorMessage,
        isLoading: false,
      });
      console.error('[UserStore] fetchUsers exception:', error);
    }
  },

  // 単一ユーザー取得
  fetchUser: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const user = get().users.find(u => u.id === id);
      
      if (user) {
        set({ selectedUser: user, isLoading: false });
      } else {
        // ユーザーが見つからない場合は fetchUsers してから再度検索
        await get().fetchUsers();
        const updatedUser = get().users.find(u => u.id === id);
        set({ 
          selectedUser: updatedUser || null, 
          isLoading: false,
          error: updatedUser ? null : 'ユーザーが見つかりません'
        });
      }
    } catch (error) {
      set({
        error: 'ユーザー情報の取得に失敗しました',
        isLoading: false,
      });
    }
  },

  // ユーザー作成
  createUser: async (userData: Partial<User>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await userAPI.createUser(userData);

      if (response.success) {
        await get().fetchUsers();
        set({ isLoading: false });
        return true;
      } else {
        set({
          error: response.error || 'ユーザーの作成に失敗しました',
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

  // ユーザー更新
  updateUser: async (id: string, userData: Partial<User>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await userAPI.updateUser(id, userData);

      if (response.success) {
        await get().fetchUsers();
        set({ isLoading: false });
        return true;
      } else {
        set({
          error: response.error || 'ユーザーの更新に失敗しました',
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

  // ユーザー削除
  deleteUser: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await userAPI.deleteUser(id);

      if (response.success) {
        await get().fetchUsers();
        set({ isLoading: false });
        return true;
      } else {
        set({
          error: response.error || 'ユーザーの削除に失敗しました',
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

  // ✅ 修正: フィルター設定（状態のみ更新、fetchは呼ばない）
  setFilters: (newFilters: Partial<FilterOptions>) => {
    const currentFilters = get().filters;
    const updatedFilters = { ...currentFilters, ...newFilters };
    
    console.log('[UserStore] setFilters:', {
      current: currentFilters,
      new: newFilters,
      updated: updatedFilters
    });
    
    set({ filters: updatedFilters });
    // ✅ fetchUsersは呼ばない - UserManagement側のuseEffectが検知して呼ぶ
  },

  // ✅ 修正: ページ設定（状態のみ更新、fetchは呼ばない）
  setPage: (page: number) => {
    console.log('[UserStore] setPage:', page);
    
    set({
      pagination: {
        ...get().pagination,
        page,
      },
    });
    // ✅ fetchUsersは呼ばない - UserManagement側のuseEffectが検知して呼ぶ
  },

  // エラークリア
  clearError: () => {
    set({ error: null });
  },

  // 選択ユーザークリア
  clearSelectedUser: () => {
    set({ selectedUser: null });
  },
}));