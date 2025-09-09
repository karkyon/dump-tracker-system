import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginCredentials } from '../types';
import { authAPI } from '../utils/api';
import { STORAGE_KEYS } from '../utils/constants';

interface AuthState {
  // 状態
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // アクション
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  getProfile: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初期状態
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // ログイン
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authAPI.login(credentials);

          if (response.success && response.data) {
            const { token, user } = response.data;

            // トークンを保存
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);

            // 「ログイン状態を保持する」がチェックされている場合
            if (credentials.rememberMe) {
              localStorage.setItem(STORAGE_KEYS.REMEMBER_LOGIN, 'true');
            }

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            return true;
          } else {
            set({
              isLoading: false,
              error: response.error || 'ログインに失敗しました',
            });
            return false;
          }
        } catch (error) {
          set({
            isLoading: false,
            error: 'ネットワークエラーが発生しました',
          });
          return false;
        }
      },

      // ログアウト
      logout: () => {
        // サーバーにログアウト要求を送信（エラーは無視）
        authAPI.logout().catch(() => {});

        // ローカルストレージをクリア
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        localStorage.removeItem(STORAGE_KEYS.REMEMBER_LOGIN);

        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // トークンリフレッシュ
      refreshToken: async () => {
        try {
          const response = await authAPI.refreshToken();

          if (response.success && response.data) {
            const { token } = response.data;
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
            return true;
          } else {
            get().logout();
            return false;
          }
        } catch (error) {
          get().logout();
          return false;
        }
      },

      // プロフィール取得
      getProfile: async () => {
        set({ isLoading: true });

        try {
          const response = await authAPI.getProfile();

          if (response.success && response.data) {
            set({
              user: response.data,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            get().logout();
          }
        } catch (error) {
          get().logout();
        }
      },

      // エラークリア
      clearError: () => set({ error: null }),

      // ローディング状態設定
      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// 自動ログインチェック
export const initializeAuth = async () => {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const rememberLogin = localStorage.getItem(STORAGE_KEYS.REMEMBER_LOGIN);

  if (token && rememberLogin) {
    // トークンが存在し、「ログイン状態を保持する」が有効な場合
    // プロフィールを取得して認証状態を確認
    await useAuthStore.getState().getProfile();
  } else if (token) {
    // トークンは存在するが「ログイン状態を保持する」が無効な場合
    // セッション有効期限をチェック
    const isValid = await useAuthStore.getState().refreshToken();
    if (isValid) {
      await useAuthStore.getState().getProfile();
    }
  }
};