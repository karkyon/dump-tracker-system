// frontend/mobile/src/stores/authStore.ts
// 完全修正版: accessToken対応 + token プロパティ追加 + すべての機能保持

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

// User型定義
export interface User {
  id: string;
  userId: string;
  name: string;
  role: string;
  vehicleId: string;
}

// ✅ 修正: AuthState に token プロパティを追加
export interface AuthState {
  // State properties
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;  // ✅ 追加
  loading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  checkServerConnection: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Create the auth store
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      token: null,  // ✅ 追加
      loading: false,
      error: null,

      // Actions
      login: async (credentials) => {
        set({ loading: true, error: null });
        
        try {
          console.log('[Auth Store] Login attempt started');
          
          const response = await apiService.login(credentials);
          
          if (response.success && response.data) {
            // 🔧 修正: バックエンドは accessToken を返す
            const { user, accessToken } = response.data;
            
            // Store token in localStorage
            localStorage.setItem('auth_token', accessToken);
            localStorage.setItem('user_data', JSON.stringify(user));
            
            // ✅ 修正: accessToken を token として state に保存
            set({
              isAuthenticated: true,
              user,
              token: accessToken,
              loading: false,
              error: null
            });
            // toast.success はLogin.tsx handleSubmitが担当（多重toast防止）
            console.log('[Auth Store] Login successful:', user);
          } else {
            throw new Error(response.error || response.message || 'ログインに失敗しました');
          }
        } catch (error: any) {
          console.error('[Auth Store] Login error:', error);
          
          let errorMessage = 'ログインに失敗しました';
          
          if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            if (status === 401) {
              errorMessage = 'ユーザー名またはパスワードが正しくありません';
            } else if (status === 403) {
              errorMessage = 'アクセスが拒否されました';
            } else if (data?.message) {
              errorMessage = data.message;
            }
          } else if (error.message) {
            if (error.message.includes('Network Error') || error.message.includes('ERR_CERT')) {
              errorMessage = 'サーバーに接続できません。HTTPS証明書を確認してください。';
            } else {
              errorMessage = error.message;
            }
          }
          
          set({
            isAuthenticated: false,
            user: null,
            token: null,  // ✅ 追加
            loading: false,
            error: errorMessage
          });
          // toast.error はLogin.tsx useEffect(error)が一元担当するためここでは出さない
          throw new Error(errorMessage);
        }
      },

      logout: () => {
        // Clear token from localStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('remember_login');
        
        set({
          isAuthenticated: false,
          user: null,
          token: null,  // ✅ 追加
          loading: false,
          error: null
        });
        
        toast.success('ログアウトしました');
        console.log('[Auth Store] User logged out');
      },

      checkServerConnection: async () => {
        set({ loading: true, error: null });
        
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        // ✅ 修正: トークンがない場合のみ未認証にする
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null, loading: false, error: null });
          console.log('[Auth Store] No token found, user not authenticated');
          return;
        }

        // ✅ 修正: トークンがある場合はまず認証状態を維持（ネット一時断でリセットしない）
        // localStorage に user_data があれば即時復元する
        if (userData) {
          try {
            const user = JSON.parse(userData);
            set({ isAuthenticated: true, user, token, loading: false, error: null });
          } catch (_) {}
        }

        // バックグラウンドでサーバー検証（失敗してもトークンがある限り認証状態を維持）
        try {
          const response = await apiService.getMe();
          
          if (response.success && response.data) {
            const user = userData ? JSON.parse(userData) : response.data;
            set({ isAuthenticated: true, user, token, loading: false, error: null });
            console.log('[Auth Store] ✅ Server connection verified, user authenticated');
          } else {
            // サーバーが明示的に401/失敗を返した場合のみトークン破棄
            // ※ネットワークエラーはここに来ない（catchで処理）
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            set({ isAuthenticated: false, user: null, token: null, loading: false, error: null });
            console.log('[Auth Store] Token explicitly rejected by server → logout');
          }
        } catch (error: any) {
          // ✅ 修正: ネットワークエラー（一時断、Fortigate遮断等）では認証状態を維持
          // トークンは削除しない。ユーザーは運行継続可能。
          const isNetworkError = error.message?.includes('Network Error')
            || error.message?.includes('ERR_NETWORK')
            || error.message?.includes('timeout')
            || error.code === 'ERR_NETWORK'
            || error.code === 'ECONNABORTED'
            || !error.response; // レスポンスなし = ネットワーク到達不可
          
          if (isNetworkError) {
            console.warn('[Auth Store] ⚠️ Network error during server check → keeping auth state (token preserved)');
            set({ loading: false, error: null }); // 認証状態は変更しない
          } else {
            // 証明書エラー等: 状態はそのまま、エラーメッセージのみ表示
            let errorMessage = '';
            if (error.message?.includes('certificate') || error.message?.includes('ERR_CERT')) {
              errorMessage = 'HTTPS証明書エラー: サーバー証明書を確認してください';
            }
            console.error('[Auth Store] Server connection check failed (non-network):', error);
            set({ loading: false, error: errorMessage }); // isAuthenticated は変更しない
          }
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      setError: (error) => {
        set({ error });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token  // ✅ 追加: persist対象に含める
      })
    }
  )
);