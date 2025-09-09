import { create } from 'zustand';
import { User, FilterOptions, PaginatedResponse } from '../types';
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

      const response = await userAPI.getUsers(params);

      if (response.success && response.data) {
        const data = response.data as PaginatedResponse<User>;
        set({
          users: data.items,
          pagination: {
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            totalPages: data.totalPages,
          },
          filters: currentFilters,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || 'ユーザー一覧の取得に失敗しました',
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

  // 単一ユーザー取得
  fetchUser: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await userAPI.getUser(id);

      if (response.success && response.data) {
        set({
          selectedUser: response.data,
          isLoading: false,
        });
      } else {
        set({
          error: response.error || 'ユーザー情報の取得に失敗しました',
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

  // ユーザー作成
  createUser: async (userData: Partial<User>) => {
    set({ isLoading: true, error: null });

    try {
      const response = await userAPI.createUser(userData);

      if (response.success) {
        // ユーザー一覧を再取得
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
        // ユーザー一覧を再取得
        await get().fetchUsers();
        
        // 選択中のユーザーが更新対象の場合、再取得
        if (get().selectedUser?.id === id) {
          await get().fetchUser(id);
        }
        
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
        // ユーザー一覧を再取得
        await get().fetchUsers();
        
        // 選択中のユーザーが削除対象の場合、クリア
        if (get().selectedUser?.id === id) {
          set({ selectedUser: null });
        }
        
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

  // フィルター設定
  setFilters: (filters: Partial<FilterOptions>) => {
    set({
      filters: { ...get().filters, ...filters },
      pagination: { ...get().pagination, page: 1 }, // ページをリセット
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

  // 選択ユーザークリア
  clearSelectedUser: () => set({ selectedUser: null }),
}));