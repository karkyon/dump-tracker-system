import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Services and stores
import apiService from './services/api';
import { useAuthStore } from './stores/authStore';

// =============================================================================
// アプリケーション初期化
// =============================================================================

class ApplicationInitializer {
  async initialize() {
    console.log('🚀 DumpTracker Mobile アプリ初期化開始...');
    
    const result = {
      apiConnection: false,
      authStatus: false,
      certificateIssue: false,
      errors: [] as string[]
    };

    try {
      // API接続テスト（修正版）
      result.apiConnection = await this.testApiConnection();
      
      // 認証状態の復元
      result.authStatus = await this.restoreAuthState();
      
    } catch (error) {
      console.error('初期化エラー:', error);
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    console.log('✅ アプリ初期化完了:', result);
    return result;
  }

  async testApiConnection(): Promise<boolean> {
    console.log('🔌 API接続テスト開始...');
    
    try {
      // ✅ 修正: healthCheck()メソッドを使用
      const response = await apiService.healthCheck();
      
      if (response.success) {
        console.log('✅ API接続成功');
        return true;
      } else {
        console.warn('⚠️ API接続失敗:', response);
        return false;
      }
    } catch (error: any) {
      console.error('❌ API接続テストエラー:', error.message);
      
      if (error.message?.includes('certificate') || error.message?.includes('ERR_CERT')) {
        console.warn('⚠️ HTTPS証明書エラーが検出されました');
      }
      
      return false;
    }
  }

  async restoreAuthState(): Promise<boolean> {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (!token || !userData) {
      console.log('📍 認証トークンが見つかりません');
      return false;
    }

    try {
      const response = await apiService.getCurrentUser();
      
      if (response.success) {
        console.log('✅ 認証状態を復元しました');
        return true;
      } else {
        console.log('⚠️ トークンが無効です。ログアウトします。');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        return false;
      }
    } catch (error) {
      console.error('❌ 認証状態復元エラー:', error);
      return false;
    }
  }
}

// =============================================================================
// 開発モード情報
// =============================================================================

if (import.meta.env.DEV) {
  console.log('🔧 開発モード情報:');
  console.log('Node環境:', import.meta.env.MODE);
  console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('GPS更新間隔:', import.meta.env.VITE_GPS_UPDATE_INTERVAL);
  console.log('Google Maps API:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? '設定済み' : '未設定');
  
  // 開発用ヘルパーをグローバルに公開
  (window as any).dumpTracker = {
    apiService,
    useAuthStore,
    clearStorage: () => {
      localStorage.clear();
      console.log('✅ ローカルストレージをクリアしました');
    },
    testApi: async () => {
      try {
        const response = await apiService.healthCheck();
        console.log('API Test Result:', response);
        return response;
      } catch (error) {
        console.error('API Test Error:', error);
        return { success: false, error };
      }
    }
  };
  
  console.log('🛠️ 開発用ヘルパーが window.dumpTracker で利用可能です');
}

// =============================================================================
// アプリケーション起動
// =============================================================================

async function bootstrap() {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // アプリケーション初期化
  const initializer = new ApplicationInitializer();
  const initResult = await initializer.initialize();

  // React アプリケーションをマウント
  const root = createRoot(rootElement);
  
  root.render(
    <App />
  );

  // 初期化結果に基づいて警告を表示
  if (!initResult.apiConnection) {
    console.warn('⚠️ API接続に失敗しました。オフラインモードで動作します。');
  }

  if (!initResult.authStatus) {
    console.log('📍 未認証状態です');
  }

  console.log('🎉 アプリケーション起動完了');
}

// アプリケーション起動
bootstrap().catch((error) => {
  console.error('💥 アプリケーション起動エラー:', error);
  
  // エラー時もアプリを表示
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
});

// エラーハンドリング
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});