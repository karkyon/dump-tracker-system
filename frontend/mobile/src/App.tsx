// frontend/mobile/src/App.tsx
// アプリケーションのメインコンポーネント - ルーティング設定
// Home画面対応版 - 構文エラー修正版

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import VehicleInfo from './pages/VehicleInfo';
import PreDepartureInspection from './pages/PreDepartureInspection';
import OperationRecord from './pages/OperationRecord';
import RefuelRecord from './pages/RefuelRecord';
import LoadingInput from './pages/LoadingInput';
import LoadingConfirmation from './pages/LoadingConfirmation';

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

      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <Login />
            )
          } 
        />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vehicle-info"
          element={
            <ProtectedRoute>
              <VehicleInfo />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pre-departure-inspection"
          element={
            <ProtectedRoute>
              <PreDepartureInspection />
            </ProtectedRoute>
          }
        />

        <Route
          path="/operation-record"
          element={
            <ProtectedRoute>
              <OperationRecord />
            </ProtectedRoute>
          }
        />

        <Route
          path="/refuel-record"
          element={
            <ProtectedRoute>
              <RefuelRecord />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/loading-input" 
          element={
            <ProtectedRoute>
              <LoadingInput />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/loading-confirmation" 
          element={
            <ProtectedRoute>
              <LoadingConfirmation />
            </ProtectedRoute>
          }
        />

        <Route
          path="/operation-history"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-50 flex flex-col">
                <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                  <div className="max-w-md mx-auto px-6 py-5">
                    <h1 className="text-xl font-bold">運行履歴</h1>
                  </div>
                </header>
                <main className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center max-w-md">
                    <div className="mb-6">
                      <svg className="w-24 h-24 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">運行履歴画面</h2>
                    <p className="text-gray-600 mb-6">この画面は現在開発中です</p>
                    <button 
                      onClick={() => window.history.back()}
                      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      戻る
                    </button>
                  </div>
                </main>
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-50 flex flex-col">
                <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                  <div className="max-w-md mx-auto px-6 py-5">
                    <h1 className="text-xl font-bold">設定</h1>
                  </div>
                </header>
                <main className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center max-w-md">
                    <div className="mb-6">
                      <svg className="w-24 h-24 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">設定画面</h2>
                    <p className="text-gray-600 mb-6">この画面は現在開発中です</p>
                    <button 
                      onClick={() => window.history.back()}
                      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      戻る
                    </button>
                  </div>
                </main>
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-blue-600 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-8">ページが見つかりません</p>
                <a
                  href={isAuthenticated ? '/home' : '/login'}
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