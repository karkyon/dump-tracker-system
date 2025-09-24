import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiService as authAPI } from '../services/api';
import { User } from '../types';
import toast from 'react-hot-toast';

// AuthState interface
export interface AuthState {
  // State properties
  isAuthenticated: boolean;
  user: User | null;
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
      loading: false,
      error: null,

      // Actions
      login: async (credentials) => {
        set({ loading: true, error: null });
        
        try {
          console.log('[Auth Store] Login attempt started');
          
          const response = await authAPI.login(credentials);
          
          if (response.success && response.data) {
            const { user, accessToken } = response.data;
            
            // Store token in localStorage
            localStorage.setItem('auth_token', accessToken);
            
            set({
              isAuthenticated: true,
              user,
              loading: false,
              error: null
            });
            
            toast.success('ログインに成功しました');
            console.log('[Auth Store] Login successful');
          } else {
            throw new Error(response.error || response.message || 'ログインに失敗しました');
          }
        } catch (error: any) {
          console.error('[Auth Store] Login error:', error);
          
          let errorMessage = 'ログインに失敗しました';
          
          if (error.message) {
            if (error.message.includes('INVALID_CREDENTIALS')) {
              errorMessage = 'ユーザー名またはパスワードが正しくありません';
            } else if (error.message.includes('Network Error')) {
              errorMessage = 'サーバーに接続できません。HTTPS証明書を確認してください。';
            } else {
              errorMessage = error.message;
            }
          }
          
          set({
            isAuthenticated: false,
            user: null,
            loading: false,
            error: errorMessage
          });
          
          toast.error(errorMessage);
        }
      },

      logout: () => {
        // Clear token from localStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        
        set({
          isAuthenticated: false,
          user: null,
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
          
          if (token) {
            // Verify the token with the server
            const response = await authAPI.getCurrentUser();
            
            if (response.success && response.data) {
              set({
                isAuthenticated: true,
                user: response.data,
                loading: false,
                error: null
              });
              console.log('[Auth Store] Server connection verified, user authenticated');
            } else {
              // Token is invalid, clear it
              localStorage.removeItem('auth_token');
              set({
                isAuthenticated: false,
                user: null,
                loading: false,
                error: null
              });
              console.log('[Auth Store] Token invalid, user logged out');
            }
          } else {
            set({
              isAuthenticated: false,
              user: null,
              loading: false,
              error: null
            });
            console.log('[Auth Store] No token found, user not authenticated');
          }
        } catch (error: any) {
          console.error('[Auth Store] Server connection check failed:', error);
          
          let errorMessage = '';
          
          if (error.message && error.message.includes('certificate')) {
            errorMessage = 'HTTPS証明書エラー: サーバー証明書を信頼する必要があります';
          } else if (error.message && error.message.includes('Network Error')) {
            errorMessage = 'ネットワークエラー: サーバーに接続できません';
          }
          
          set({
            isAuthenticated: false,
            user: null,
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
        user: state.user
      })
    }
  )
);