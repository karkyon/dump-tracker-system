// frontend/mobile/src/stores/authStore.ts
// 完全修正版: token プロパティ追加 + すべての機能保持

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
            // バックエンドの正しいレスポンス構造
            const { user, token } = response.data;
            
            // Store token in localStorage
            localStorage.setItem('auth_token', token);
            localStorage.setItem('user_data', JSON.stringify(user));
            
            // ✅ 修正: token を state に保存
            set({
              isAuthenticated: true,
              user,
              token,  // ✅ 追加
              loading: false,
              error: null
            });
            
            toast.success('ログインに成功しました');
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
          
          toast.error(errorMessage);
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
        
        try {
          // Check if we have a stored token
          const token = localStorage.getItem('auth_token');
          const userData = localStorage.getItem('user_data');
          
          if (token && userData) {
            // Verify the token with the server
            const response = await apiService.getMe();
            
            if (response.success && response.data) {
              const user = JSON.parse(userData);
              
              set({
                isAuthenticated: true,
                user,
                token,  // ✅ 追加
                loading: false,
                error: null
              });
              console.log('[Auth Store] Server connection verified, user authenticated');
            } else {
              // Token is invalid, clear it
              localStorage.removeItem('auth_token');
              localStorage.removeItem('user_data');
              set({
                isAuthenticated: false,
                user: null,
                token: null,  // ✅ 追加
                loading: false,
                error: null
              });
              console.log('[Auth Store] Token invalid, user logged out');
            }
          } else {
            set({
              isAuthenticated: false,
              user: null,
              token: null,  // ✅ 追加
              loading: false,
              error: null
            });
            console.log('[Auth Store] No token found, user not authenticated');
          }
        } catch (error: any) {
          console.error('[Auth Store] Server connection check failed:', error);
          
          let errorMessage = '';
          
          if (error.message && (error.message.includes('certificate') || error.message.includes('ERR_CERT'))) {
            errorMessage = 'HTTPS証明書エラー: https://10.1.119.244:8443 に直接アクセスして証明書を信頼してください';
          } else if (error.message && error.message.includes('Network Error')) {
            errorMessage = 'ネットワークエラー: サーバーに接続できません';
          }
          
          set({
            isAuthenticated: false,
            user: null,
            token: null,  // ✅ 追加
            loading: false,
            error: errorMessage
          });
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