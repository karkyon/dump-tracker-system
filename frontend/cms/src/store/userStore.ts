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
    pageSize: 20,
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

      console.log('[UserStore] Full API response:', response);

      if (response.success && response.data) {
        // ✅ FIX: バックエンドのレスポンス構造を処理
        // パターン1: { success: true, data: { users: [...], pagination: {...} } }
        // パターン2: { success: true, data: [...], meta: {...} }
        
        const backendData = (response.data as any).data || response.data;
        
        console.log('[UserStore] Extracted backend data:', backendData);

        const users = backendData?.users || (Array.isArray(backendData) ? backendData : []);
        const paginationData = backendData?.pagination || response.meta || {};

        console.log('[UserStore] fetchUsers success:', {
          usersCount: users.length,
          pagination: paginationData
        });

        set({
          users: users,
          pagination: {
            page: paginationData.page || params.page || 1,
            pageSize: paginationData.limit || paginationData.pageSize || params.pageSize || 20,
            total: paginationData.total || 0,
            totalPages: paginationData.totalPages || Math.ceil((paginationData.total || 0) / (paginationData.limit || paginationData.pageSize || params.pageSize || 20)),
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
      console.error('[UserStore] fetchUsers error:', error);
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
      const user = get().users.find(u => u.id === id);
      if (user) {
        set({ selectedUser: user, isLoading: false });
      } else {
        await get().fetchUsers();
        const updatedUser = get().users.find(u => u.id === id);
        set({ selectedUser: updatedUser || null, isLoading: false });
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
      console.log('[UserStore] createUser called with:', userData);

      const response = await userAPI.createUser(userData);

      console.log('[UserStore] createUser response:', response);

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
      console.error('[UserStore] createUser error:', error);
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
      console.log('[UserStore] updateUser called:', { id, userData });

      const response = await userAPI.updateUser(id, userData);

      console.log('[UserStore] updateUser response:', response);

      if (response.success) {
        await get().fetchUsers();
        
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
      console.error('[UserStore] updateUser error:', error);
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
    console.log('[UserStore] setFilters called:', filters);
    set({
      filters: { ...get().filters, ...filters },
    });
  },

  // ページ設定
  setPage: (page: number) => {
    console.log('[UserStore] setPage called:', page);
    set({
      pagination: { ...get().pagination, page },
    });
  },

  // エラークリア
  clearError: () => set({ error: null }),

  // 選択ユーザークリア
  clearSelectedUser: () => set({ selectedUser: null }),
}));