// frontend/mobile/src/App.tsx
// 完全修正版: 無限ループ解消 + すべての機能保持
// 修正日時: 2025-10-22
// 修正内容:
//  1. useEffect無限ループ修正（依存配列を空に）
//  2. getCurrentUser()呼び出し削除（バックエンドハング防止）
//  3. 空パスワードログイン削除（不適切な実装）
//  4. forceSyncOfflineData()削除（存在しないメソッド）
//  5. 認証復元ロジック簡素化（localStorage直接読み込み）

import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import OperationRecord from './pages/OperationRecord';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  
  // ✅ 修正1: 初回実行フラグ（無限ループ防止）
  const hasInitialized = useRef(false);

  // ✅ 修正2: アプリ起動時の認証状態復元（初回のみ実行）
  useEffect(() => {
    // 既に初期化済みならスキップ
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const restoreAuthState = () => {
      try {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        
        if (token && userData) {
          // ✅ 修正3: API呼び出しなしで認証状態を復元
          // トークンとユーザーデータがあれば有効とみなす
          // （実際のトークン検証は各画面で必要に応じて実行）
          const user = JSON.parse(userData);
          
          // Zustand storeに直接状態を設定
          // ✅ 修正4: token プロパティを含める（authStore.ts 修正版に対応）
          useAuthStore.setState({
            isAuthenticated: true,
            user: user,
            token: token,
            loading: false,
            error: null
          });
          
          console.log('✅ 認証状態を復元しました:', user.name);
          
          // ✅ 保持: オフラインデータ同期は将来的に実装予定
          // 注意: forceSyncOfflineData()は現在未実装のため、
          // 実装時に以下のコメントを解除してください
          // 
          // try {
          //   await apiUtils.forceSyncOfflineData();
          //   console.log('✅ オフラインデータを同期しました');
          // } catch (syncError) {
          //   console.warn('⚠️ オフラインデータ同期エラー:', syncError);
          //   // 同期エラーは無視（認証には影響しない）
          // }
          
        } else {
          console.log('ℹ️ 保存された認証情報がありません');
        }
      } catch (error) {
        console.error('❌ 認証復元エラー:', error);
        
        // エラー時はローカルストレージをクリア
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        
        // 状態をリセット
        useAuthStore.setState({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false,
          error: null
        });
      }
    };

    restoreAuthState();
    
    // ✅ 修正5: 依存配列を空にして初回のみ実行（無限ループ防止）
  }, []);

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