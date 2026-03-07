// frontend/mobile/src/App.tsx
// =====================================
// App.tsx - 起動時運行状態復元機能追加版 + 運行履歴・設定画面対応
// 🆕 運行中の状態を復元してOperationRecord画面に遷移
// 🔧 修正: Home画面 = /home （ダッシュボード）
// 🆕 追加: 運行履歴画面 = /operation-history
// 🆕 追加: 設定画面 = /settings
// =====================================

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { useOperationStore } from './stores/operationStore';


// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import VehicleInfo from './pages/VehicleInfo';
import PreDepartureInspection from './pages/PreDepartureInspection';
import PostTripInspection from './pages/PostTripInspection';  // 🆕 D8: 乗車後点検画面
import OperationRecord from './pages/OperationRecord';
import RefuelRecord from './pages/RefuelRecord';
import LoadingInput from './pages/LoadingInput';
import LoadingConfirmation from './pages/LoadingConfirmation';
import OperationHistory from './pages/OperationHistory';  // 🆕 運行履歴画面
import OperationHistoryDetail from './pages/OperationHistoryDetail';  // 🆕 D9a: 運行記録詳細画面
import Settings from './pages/Settings';                  // 🆕 設定画面

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

    // 🆕 運行関連画面にいる場合はスキップ（D3, D7, D8など）
    const operationRelatedPaths = [
      '/pre-departure-inspection',  // D3: 乗車前点検
      '/loading-input',             // D4: 積載入力
      '/unloading-input',           // D5: 降載入力
      '/loading-confirmation',      // D6: 積載確認
      '/refuel-record',             // D7: 給油記録
      '/post-trip-inspection',      // D8: 乗車後点検
    ];
    
    if (operationRelatedPaths.includes(location.pathname)) {
      console.log('[StateRestorer] ⏭️ 運行関連画面にいるため処理をスキップ:', location.pathname);
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
      
      // ✅ Home画面（/home）に遷移
      if (location.pathname !== '/home') {
        setTimeout(() => {
          navigate('/home', { replace: true });
        }, 100);
      }
      
    } else {
      // その他のステータス（IDLE, INSPECTING等）
      console.log('[StateRestorer] ℹ️ ステータス:', status, '- 通常フロー');
    }
    
  }, [isAuthenticated, location.pathname]);

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
              isAuthenticated ? <Navigate to="/home" replace /> : <Login />
            } 
          />

          {/* ✅ Home画面（ダッシュボード） */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* 🆕 運行履歴画面 */}
          <Route
            path="/operation-history"
            element={
              <ProtectedRoute>
                <OperationHistory />
              </ProtectedRoute>
            }
          />

          {/* 🆕 D9a: 運行記録詳細画面 */}
          <Route
            path="/operation-history/:id"
            element={
              <ProtectedRoute>
                <OperationHistoryDetail />
              </ProtectedRoute>
            }
          />
          
          {/* 🆕 設定画面（D9a） */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* D2: 車両選択画面 */}
          <Route
            path="/vehicle-info"
            element={
              <ProtectedRoute>
                <VehicleInfo />
              </ProtectedRoute>
            }
          />

          {/* D3: 出発前点検画面 */}
          <Route
            path="/pre-departure-inspection"
            element={
              <ProtectedRoute>
                <PreDepartureInspection />
              </ProtectedRoute>
            }
          />

          {/* 🆕 D8: 乗車後点検画面 */}
          <Route
            path="/post-trip-inspection"
            element={
              <ProtectedRoute>
                <PostTripInspection />
              </ProtectedRoute>
            }
          />

          {/* D4: 運行記録画面 */}
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

          {/* ✅ デフォルトルート: /home にリダイレクト */}
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

          {/* ✅ 404ルート: /home に自動リダイレクト */}
          <Route
            path="*"
            element={
              <Navigate to={isAuthenticated ? '/home' : '/login'} replace />
            }
          />
        </Routes>
      </OperationStateRestorer>
    </Router>
  );
};

export default App;