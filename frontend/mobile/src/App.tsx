// frontend/mobile/src/App.tsx
// アプリケーションのメインコンポーネント - ルーティング設定

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';

// Pages
import Login from './pages/Login';
import VehicleInfo from './pages/VehicleInfo';
import PreDepartureInspection from './pages/PreDepartureInspection';
import OperationRecord from './pages/OperationRecord'; // Google Maps対応版
import RefuelRecord from './pages/RefuelRecord'; // 給油記録画面
import LoadingInput from './pages/LoadingInput';  // 積載入力画面
import LoadingConfirmation from './pages/LoadingConfirmation';  // 積載確認画面

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated, checkServerConnection } = useAuthStore();

  // アプリ起動時にサーバー接続確認
  useEffect(() => {
    checkServerConnection();
  }, [checkServerConnection]);

  return (
    <Router>
      {/* Toast通知 */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            padding: '16px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            maxWidth: '90vw',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
            duration: 4000,
          },
        }}
      />

      {/* ルーティング設定 */}
      <Routes>
        {/* パブリックルート */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/vehicle-info" replace /> : <Login />
          } 
        />

        {/* プロテクトルート */}
        <Route
          path="/vehicle-info"
          element={
            <ProtectedRoute>
              <VehicleInfo />
            </ProtectedRoute>
          }
        />

        {/* 🆕 出発前点検画面 */}
        <Route
          path="/pre-departure-inspection"
          element={
            <ProtectedRoute>
              <PreDepartureInspection />
            </ProtectedRoute>
          }
        />

        {/* 🆕 運行記録画面 */}
        <Route
          path="/operation-record"
          element={
            <ProtectedRoute>
              <OperationRecord />
            </ProtectedRoute>
          }
        />

        {/* 🆕 給油記録画面 */}
        <Route
          path="/refuel-record"
          element={
            <ProtectedRoute>
              <RefuelRecord />
            </ProtectedRoute>
          }
        />

        {/* 🆕 積載入力画面 */}
        <Route 
          path="/loading-input" 
          element={
            <ProtectedRoute>
              <LoadingInput />
            </ProtectedRoute>
          }
        />

        {/* 🆕 積載確認画面 */}
        <Route 
          path="/loading-confirmation" 
          element={
            <ProtectedRoute>
              <LoadingConfirmation />
            </ProtectedRoute>
          }
        />

        {/* デフォルトルート */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/vehicle-info" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* 404ルート */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-blue-600 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-8">ページが見つかりません</p>
                <a
                  href={isAuthenticated ? '/vehicle-info' : '/login'}
                  className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold 
                    rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {isAuthenticated ? 'ホームへ戻る' : 'ログインへ'}
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;