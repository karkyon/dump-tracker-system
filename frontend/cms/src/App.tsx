// frontend/src/App.tsx - 完全修正版: 既存機能保持 + Layout統合
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Layout Components
import Layout from './components/Layout/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import VehicleManagement from './pages/VehicleManagement';
import InspectionItemManagement from './pages/InspectionItemManagement';
import LocationManagement from './pages/LocationManagement';
import CargoTypeManagement from './pages/CargoTypeManagement';
import OperationRecords from './pages/OperationRecords';
import GPSMonitoring from './pages/GPSMonitoring';
import ReportOutput from './pages/ReportOutput';
import SystemSettings from './pages/SystemSettings';

// エラーバウンダリコンポーネント
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ React Error Boundary caught an error:', error, errorInfo);
    
    // HTTPS証明書エラーのチェック
    if (error.message.includes('certificate') || error.message.includes('ERR_CERT_AUTHORITY_INVALID')) {
      console.log('🔐 HTTPS証明書エラーが検出されました');
      console.log('🔧 解決手順:');
      console.log('1. https://10.1.119.244:8443 に直接アクセス');
      console.log('2. 証明書の警告を許可');
      console.log('3. ページを再読み込み');
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">アプリケーションエラー</h2>
              <p className="text-sm text-gray-600 mb-4">
                アプリケーションでエラーが発生しました。HTTPS証明書の問題の可能性があります。
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => window.location.href = 'https://10.1.119.244:8443'}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  バックエンドで証明書を信頼
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm"
                >
                  ページを再読み込み
                </button>
              </div>
              {this.state.error && import.meta.env.DEV && (
                <details className="mt-4 text-left">
                  <summary className="text-xs text-gray-500 cursor-pointer">エラー詳細 (開発モード)</summary>
                  <pre className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ローディングコンポーネント
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-sm text-gray-600">読み込み中...</p>
    </div>
  </div>
);

// ネットワークエラーコンポーネント
const NetworkError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">ネットワークエラー</h2>
        <p className="text-sm text-gray-600 mb-4">
          サーバーに接続できません。HTTPS証明書を信頼する必要がある可能性があります。
        </p>
        <div className="space-y-2">
          <a
            href="https://10.1.119.244:8443"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            新しいタブでサーバーにアクセス
          </a>
          <button
            onClick={onRetry}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm"
          >
            再試行
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Private Route Component
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, error } = useAuthStore();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error && error.includes('certificate')) {
    return <NetworkError onRetry={() => window.location.reload()} />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route Component (redirect if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, error } = useAuthStore();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error && error.includes('certificate')) {
    return <NetworkError onRetry={() => window.location.reload()} />;
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

const App: React.FC = () => {
  const { clearError } = useAuthStore();

  // アプリケーション起動時の初期化
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 アプリケーション初期化開始...');
        // 既存のエラーをクリア
        clearError();
      } catch (error) {
        console.error('❌ アプリケーション初期化エラー:', error);
      }
    };

    initializeApp();
  }, [clearError]);

  // ページ可視性の変更時の処理
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📍 ページが再び表示されました');
        // 必要に応じて状態をリフレッシュ
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />

            {/* Private Routes - Layout統合 */}
            <Route 
              path="/*"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              {/* ダッシュボード */}
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* ユーザー管理 */}
              <Route path="users" element={<UserManagement />} />
              
              {/* 車両マスタ */}
              <Route path="vehicles" element={<VehicleManagement />} />
              
              {/* 点検項目マスタ */}
              <Route path="inspection-items" element={<InspectionItemManagement />} />
              
              {/* 積込・積下場所マスタ */}
              <Route path="locations" element={<LocationManagement />} />
              
              {/* 品目マスタ管理 */}
              <Route path="cargo-types" element={<CargoTypeManagement />} />
              
              {/* 運行記録 */}
              <Route path="operations" element={<OperationRecords />} />
              
              {/* GPSモニタリング */}
              <Route path="gps-monitoring" element={<GPSMonitoring />} />
              
              {/* 帳票出力 */}
              <Route path="reports" element={<ReportOutput />} />
              
              {/* システム設定 */}
              <Route path="settings" element={<SystemSettings />} />

              {/* デフォルトリダイレクト */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* 404 Page */}
              <Route 
                path="*" 
                element={
                  <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                      <p className="text-lg text-gray-600 mb-8">ページが見つかりません</p>
                      <a 
                        href="/dashboard" 
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        ダッシュボードに戻る
                      </a>
                    </div>
                  </div>
                } 
              />
            </Route>
          </Routes>

          {/* Global Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              style: {
                background: '#363636',
                color: '#fff',
                fontSize: '14px',
              },
              success: {
                style: {
                  background: '#10B981',
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#10B981',
                },
              },
              error: {
                style: {
                  background: '#EF4444',
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#EF4444',
                },
              },
              loading: {
                style: {
                  background: '#3B82F6',
                },
              },
            }}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;