// =====================================
// App.tsx - 起動時運行状態復元機能追加版
// 🆕 運行中の状態を復元してOperationRecord画面に遷移
// =====================================

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useOperationStore } from './stores/operationStore'; // 🆕 追加

// Pages
import Login from './pages/Login';
import VehicleInfo from './pages/VehicleInfo';
import PreDepartureInspection from './pages/PreDepartureInspection';
import OperationRecord from './pages/OperationRecord';
import RefuelRecord from './pages/RefuelRecord';
import LoadingInput from './pages/LoadingInput';
import LoadingConfirmation from './pages/LoadingConfirmation';

// 🆕 運行状態復元コンポーネント
const OperationStateRestorer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const operationStore = useOperationStore();
  
  useEffect(() => {
    // 認証されていない場合は何もしない
    if (!isAuthenticated) {
      console.log('[StateRestorer] 🔒 未認証のため状態復元をスキップ');
      return;
    }

    // すでに運行記録画面にいる場合はスキップ
    if (location.pathname === '/operation-record') {
      console.log('[StateRestorer] ⏭️ すでに運行記録画面にいるため処理をスキップ');
      return;
    }

    // operationStoreから状態を取得
    const { operationId, status, vehicleId, driverId } = operationStore;

    console.log('[StateRestorer] 📋 運行状態チェック:', {
      operationId,
      status,
      vehicleId,
      driverId,
      currentPath: location.pathname
    });

    // 運行IDがない場合は通常のフローに従う
    if (!operationId) {
      console.log('[StateRestorer] ℹ️ 運行IDなし - 通常フロー');
      return;
    }

    // ステータスに応じて処理を分岐
    if (status === 'IN_PROGRESS') {
      // 🆕 運行中の場合: 運行記録画面に遷移
      console.log('[StateRestorer] 🚛 運行中状態を検出 - 運行記録画面に遷移');
      console.log('[StateRestorer] 📍 復元データ:', {
        operationId,
        vehicleId,
        driverId,
        phase: operationStore.phase,
        loadingLocation: operationStore.loadingLocation,
        unloadingLocation: operationStore.unloadingLocation
      });
      
      // 運行記録画面に遷移
      setTimeout(() => {
        navigate('/operation-record', { replace: true });
      }, 100);
      
    } else if (status === 'COMPLETED') {
      // 🆕 運行完了済みの場合: stateをクリアしてHome画面表示
      console.log('[StateRestorer] ✅ 運行完了状態を検出 - stateをクリア');
      operationStore.resetOperation();
      
      // Home画面（vehicle-info）に遷移
      if (location.pathname !== '/vehicle-info') {
        setTimeout(() => {
          navigate('/vehicle-info', { replace: true });
        }, 100);
      }
      
    } else {
      // その他のステータス（IDLE, INSPECTING等）
      console.log('[StateRestorer] ℹ️ ステータス:', status, '- 通常フロー');
    }
    
  }, [isAuthenticated, location.pathname]); // operationStoreは依存配列に含めない（無限ループ防止）

  return <>{children}</>;
};

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
    console.log('🚀 ダンプ運行記録モバイルアプリ起動中...');
    console.log('📋 環境変数:');
    console.log(`  - API_BASE_URL: ${import.meta.env.VITE_API_BASE_URL || '未設定'}`);
    console.log(`  - NODE_ENV: ${import.meta.env.MODE}`);
    
    checkServerConnection();
    
    console.log('✅ アプリケーション起動完了');
  }, [checkServerConnection]);

  return (
    <Router>
      {/* 🆕 運行状態復元機能をラップ */}
      <OperationStateRestorer>
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

          {/* 出発前点検画面 */}
          <Route
            path="/pre-departure-inspection"
            element={
              <ProtectedRoute>
                <PreDepartureInspection />
              </ProtectedRoute>
            }
          />

          {/* 運行記録画面 */}
          <Route
            path="/operation-record"
            element={
              <ProtectedRoute>
                <OperationRecord />
              </ProtectedRoute>
            }
          />

          {/* 給油記録画面 */}
          <Route
            path="/refuel-record"
            element={
              <ProtectedRoute>
                <RefuelRecord />
              </ProtectedRoute>
            }
          />

          {/* 積載入力画面 */}
          <Route 
            path="/loading-input" 
            element={
              <ProtectedRoute>
                <LoadingInput />
              </ProtectedRoute>
            }
          />

          {/* 積載確認画面 */}
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
      </OperationStateRestorer>
    </Router>
  );
};

export default App;

// =====================================
// 実装内容:
// 
// 1. OperationStateRestorer コンポーネント追加
//    - アプリ起動時に operationStore の状態をチェック
//    - status === 'IN_PROGRESS' なら /operation-record に遷移
//    - status === 'COMPLETED' なら stateをクリアして /vehicle-info に遷移
// 
// 2. OperationStateRestorer を Router内にラップ
//    - すべてのルートに対して状態復元ロジックが適用される
// 
// 3. 詳細なデバッグログ出力
//    - 運行状態チェックのプロセスを追跡可能
// 
// 使用方法:
// - この App.tsx を frontend/mobile/src/App.tsx と置き換える
// - 必要なimportが追加済み: useOperationStore
// =====================================