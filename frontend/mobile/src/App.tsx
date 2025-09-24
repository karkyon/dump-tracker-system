import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { apiService as apiUtils } from './services/api';
import Login from './pages/Login';
import OperationRecord from './pages/OperationRecord';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  const { isAuthenticated, login, logout } = useAuthStore();

  // アプリ起動時の認証状態復元
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      if (token && userData) {
        try {
          const user = JSON.parse(userData);
          
          // トークンの有効性チェック
          const response = await apiUtils.getCurrentUser();
          const isValidAuth = response.success;
          
          if (isValidAuth) {
            await login({ username: user.username, password: '' });
            
            // オフラインデータがあれば同期
            await apiUtils.forceSyncOfflineData();
          } else {
            // 無効なトークンの場合はログアウト
            logout();
          }
        } catch (error) {
          console.error('認証初期化エラー:', error);
          logout();
        }
      }
    };

    initializeAuth();
  }, [login, logout]);

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* ログインページ */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
                <Navigate to="/operation" replace /> : 
                <Login />
            } 
          />
          
          {/* 運行記録ページ（保護されたルート） */}
          <Route 
            path="/operation" 
            element={
              <ProtectedRoute>
                <OperationRecord />
              </ProtectedRoute>
            } 
          />
          
          {/* デフォルトルート */}
          <Route 
            path="/" 
            element={
              <Navigate 
                to={isAuthenticated ? "/operation" : "/login"} 
                replace 
              />
            } 
          />
          
          {/* 404ページ */}
          <Route 
            path="*" 
            element={
              <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-800 mb-4">ページが見つかりません</h1>
                  <p className="text-gray-600 mb-6">指定されたページは存在しません。</p>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ホームに戻る
                  </button>
                </div>
              </div>
            } 
          />
        </Routes>

        {/* グローバルトースト通知 */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
              maxWidth: '350px',
              fontSize: '14px',
            },
            success: {
              duration: 2000,
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </Router>
  );
};

export default App;