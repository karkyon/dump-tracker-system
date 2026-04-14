// =====================================
// frontend/cms/src/store/authStore.ts
// 認証状態管理ストア
// 修正: 2026-04-04
//   - partialize から isAuthenticated を除外
//     （トークンが消えても isAuthenticated:true が残存する問題を解消）
//   - onRehydrateStorage でリハイドレーション後にトークン存在確認
//   - auth:unauthorized カスタムイベントで 401 を受け取りログアウト実行
//     （api.ts との循環インポートを避けるため CustomEvent を使用）
//   - initializeAuth でトークンなし時に明示的に状態リセット
// =====================================

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
            const { accessToken, user } = response.data;

            // トークンを保存
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);

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
      // ※ このメソッドは api.ts の auth:unauthorized イベントからも呼ばれる
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
          isLoading: false,  // ✅ 修正: getProfile失敗→logout時にisLoadingがtrueのまま残る問題を解消
          error: null,
        });
      },

      // トークンリフレッシュ
      refreshToken: async () => {
        try {
          const response = await authAPI.refreshToken();

          if (response.success && response.data) {
            const { accessToken } = response.data;
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, accessToken);
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
            set({ isLoading: false });  // ✅ 修正: logout前にisLoadingを解除
            get().logout();
          }
        } catch (error) {
          set({ isLoading: false });  // ✅ 修正: logout前にisLoadingを解除
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

      // ✅ 修正: isAuthenticated を永続化しない
      // 問題: トークン削除後も isAuthenticated:true が localStorage に残存し、
      //        コンポーネントが認証済みと誤判断してAPIコールを継続していた。
      // 解決: user のみ保存し、isAuthenticated は起動時にトークン存在で動的に判断する。
      partialize: (state) => ({
        user: state.user,
      }),

      // ✅ 追加: リハイドレーション後にトークン存在確認
      // persist からの復元完了時に必ず実行される。
      // - トークンなし → user/isAuthenticated をリセット（不整合を防ぐ）
      // - トークンあり → user が存在すれば isAuthenticated:true に設定
      onRehydrateStorage: () => (state) => {
        if (state) {
          const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
          if (!token) {
            state.user = null;
            state.isAuthenticated = false;
          } else {
            state.isAuthenticated = !!state.user;
          }
        }
      },
    }
  )
);

// =====================================
// ✅ 追加: auth:unauthorized イベントリスナー（モジュールレベル・1回のみ登録）
//
// api.ts の 401 ハンドラから直接 authStore をインポートすると循環依存になるため、
// CustomEvent ('auth:unauthorized') を経由して通知を受け取る。
//
// フロー:
//   api.ts の 401 受信
//     → window.dispatchEvent(new CustomEvent('auth:unauthorized'))
//       → ここで受け取り logout() を実行
//         → localStorage クリア + Zustand 状態リセット + ログインページへリダイレクト
// =====================================
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().logout();
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  });
}

// =====================================
// 自動ログインチェック（アプリ起動時に呼ばれる）
// =====================================
export const initializeAuth = async () => {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const rememberLogin = localStorage.getItem(STORAGE_KEYS.REMEMBER_LOGIN);

  // ✅ 追加: トークンなしの場合は即座にリセットして終了
  if (!token) {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    return;
  }

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