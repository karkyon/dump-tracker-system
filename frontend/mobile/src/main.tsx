import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Services and stores
import apiService from './services/api';
import { useAuthStore } from './stores/authStore';

// =============================================================================
// 型定義
// =============================================================================

interface InitializationResult {
  apiConnection: boolean;
  authStatus: boolean;
  certificateIssue: boolean;
  errors: string[];
}

// =============================================================================
// 証明書エラーハンドリング
// =============================================================================

class CertificateErrorHandler {
  private hasShownHelp = false;

  public handleCertificateError(): void {
    if (this.hasShownHelp) return;

    console.warn('⚠️ HTTPS証明書の問題が検出されました');
    console.group('🔧 証明書信頼の手順:');
    console.log('1. 新しいタブで https://10.1.119.244:8443 にアクセス');
    console.log('2. 「詳細設定」または「Advanced」をクリック');
    console.log('3. 「10.1.119.244に進む（安全ではありません）」をクリック');
    console.log('4. ページが表示されたらこのアプリを再読み込み');
    console.groupEnd();

    this.hasShownHelp = true;
    localStorage.setItem('certificateHelpShown', 'true');
  }

  public isCertificateError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || error.toString();
    return message.includes('certificate') ||
           message.includes('ERR_CERT_AUTHORITY_INVALID') ||
           message.includes('ERR_CERT_COMMON_NAME_INVALID') ||
           message.includes('ERR_CERT_INVALID') ||
           message.includes('SSL') ||
           message.includes('ENOTFOUND') ||
           message.includes('ECONNREFUSED');
  }
}

// =============================================================================
// アプリケーション初期化管理
// =============================================================================

class ApplicationInitializer {
  private certificateHandler = new CertificateErrorHandler();

  public async initialize(): Promise<InitializationResult> {
    const result: InitializationResult = {
      apiConnection: false,
      authStatus: false,
      certificateIssue: false,
      errors: []
    };

    console.log('🚀 DumpTracker Mobile アプリ初期化開始...');

    try {
      // エラーハンドリングセットアップ
      this.setupGlobalErrorHandling();

      // API接続テスト
      result.apiConnection = await this.testApiConnection();
      
      // 認証状態確認
      result.authStatus = await this.initializeAuth();

      console.log('✅ アプリ初期化完了:', result);
      return result;

    } catch (error: any) {
      console.error('❌ 初期化中にエラーが発生:', error);
      result.errors.push(error.message || 'Unknown initialization error');
      
      if (this.certificateHandler.isCertificateError(error)) {
        result.certificateIssue = true;
        this.certificateHandler.handleCertificateError();
      }

      return result;
    }
  }

  private setupGlobalErrorHandling(): void {
    // Promise rejection エラー
    window.addEventListener('unhandledrejection', (event) => {
      console.error('❌ Unhandled Promise Rejection:', event.reason);
      
      if (this.certificateHandler.isCertificateError(event.reason)) {
        this.certificateHandler.handleCertificateError();
        event.preventDefault();
      }
    });

    // 一般的なJavaScriptエラー
    window.addEventListener('error', (event) => {
      console.error('❌ Global Error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });

      // ネットワークエラーの検出
      if (event.error && this.isNetworkError(event.error)) {
        console.group('🔍 ネットワークエラー診断:');
        console.log('- バックエンドサーバーの起動状況を確認');
        console.log('- HTTPS証明書の信頼設定を確認');
        console.log('- ファイアウォール設定を確認');
        console.groupEnd();
      }
    });

    // Service Worker エラー（存在する場合）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('error', (event) => {
        console.error('❌ Service Worker Error:', event);
      });
    }
  }

  private isNetworkError(error: any): boolean {
    const message = error.message || error.toString();
    return message.includes('Failed to fetch') ||
           message.includes('NetworkError') ||
           message.includes('ERR_NETWORK') ||
           message.includes('ERR_INTERNET_DISCONNECTED');
  }

  private async testApiConnection(): Promise<boolean> {
    try {
      console.log('🔌 API接続テスト開始...');
      
      const isConnected = await apiService.testConnection();
      
      if (isConnected) {
        console.log('✅ API接続テスト成功');
        return true;
      } else {
        console.warn('⚠️ API接続テスト失敗: サーバーに接続できません');
        return false;
      }
    } catch (error: any) {
      console.error('❌ API接続テストエラー:', error);
      
      if (this.certificateHandler.isCertificateError(error)) {
        this.certificateHandler.handleCertificateError();
      }
      
      return false;
    }
  }

  private async initializeAuth(): Promise<boolean> {
    try {
      const token = apiService.getToken();
      
      if (!token) {
        console.log('📍 認証トークンが見つかりません');
        return false;
      }

      console.log('🔑 既存の認証トークンを検証中...');
      
      // auth storeのcheckServerConnectionメソッドが存在する場合のみ実行
      const authStore = useAuthStore.getState();
      if (typeof authStore.checkServerConnection === 'function') {
        await authStore.checkServerConnection();
        console.log('✅ 認証状態確認完了');
        return true;
      }

      // フォールバック: 直接APIで確認
      const userResponse = await apiService.getCurrentUser();
      if (userResponse.success) {
        console.log('✅ 認証状態確認完了（直接API確認）');
        return true;
      } else {
        console.log('⚠️ 認証トークンが無効です');
        apiService.clearToken();
        return false;
      }

    } catch (error: any) {
      console.error('❌ 認証初期化エラー:', error);
      
      // 無効なトークンの場合はクリア
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        apiService.clearToken();
        console.log('🗑️ 無効な認証トークンを削除しました');
      }
      
      return false;
    }
  }
}

// =============================================================================
// 開発モード機能
// =============================================================================

class DevelopmentMode {
  public static setup(): void {
    if (!import.meta.env.DEV) return;

    console.group('🔧 開発モード情報:');
    console.log('Node環境:', import.meta.env.MODE);
    console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
    console.log('GPS更新間隔:', import.meta.env.VITE_GPS_UPDATE_INTERVAL);
    console.log('Google Maps API:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? '設定済み' : '未設定');
    console.groupEnd();

    // 開発用のグローバルヘルパー
    (window as any).dumpTracker = {
      apiService,
      clearAuth: () => {
        apiService.clearToken();
        console.log('🗑️ 認証情報をクリアしました');
      },
      testConnection: () => apiService.testConnection(),
      getToken: () => apiService.getToken(),
      isAuthenticated: () => apiService.isAuthenticated(),
      healthCheck: () => apiService.healthCheck()
    };

    console.log('🛠️ 開発用ヘルパーが window.dumpTracker で利用可能です');
  }
}

// =============================================================================
// React Wrapperコンポーネント
// =============================================================================

interface AppWrapperProps {
  initResult: InitializationResult;
  children: React.ReactNode;
}

const AppWrapper: React.FC<AppWrapperProps> = ({ initResult, children }) => {
  React.useEffect(() => {
    // 初期化結果に基づく処理
    if (initResult.certificateIssue) {
      console.warn('⚠️ 証明書の問題が検出されました。ヘルプを確認してください。');
    }

    if (!initResult.apiConnection) {
      console.warn('⚠️ API接続に失敗しました。オフラインモードで動作します。');
    }

    // 認証状態の確認
    if (initResult.authStatus) {
      console.log('✅ 認証済みユーザーです');
    } else {
      console.log('📍 未認証状態です');
    }

  }, [initResult]);

  return <React.StrictMode>{children}</React.StrictMode>;
};

// =============================================================================
// エラーフォールバックコンポーネント
// =============================================================================

const ErrorFallback: React.FC<{ error?: string; onRetry?: () => void }> = ({ 
  error, 
  onRetry 
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        アプリケーションエラー
      </h2>
      
      <p className="text-sm text-gray-600 mb-4">
        アプリケーションの初期化中にエラーが発生しました。
        {error && (
          <span className="block mt-2 text-xs text-red-600 font-mono bg-red-50 p-2 rounded">
            {error}
          </span>
        )}
      </p>
      
      <div className="space-y-3">
        <a
          href="https://10.1.119.244:8443"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          証明書を信頼する
        </a>
        
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            再試行
          </button>
        )}
        
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
        >
          ページ再読み込み
        </button>
      </div>
    </div>
  </div>
);

// =============================================================================
// メイン実行部分
// =============================================================================

const bootstrap = async (): Promise<void> => {
  // DOM要素の確認
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root container missing in index.html');
  }

  // 開発モードセットアップ
  DevelopmentMode.setup();

  // Reactルートの作成
  const root = createRoot(container);

  try {
    // アプリケーション初期化
    const initializer = new ApplicationInitializer();
    const initResult = await initializer.initialize();

    // アプリケーションレンダリング
    root.render(
      <AppWrapper initResult={initResult}>
        <App />
      </AppWrapper>
    );

    console.log('🎉 アプリケーション起動完了');

  } catch (error: any) {
    console.error('❌ アプリケーション起動失敗:', error);

    // エラー時でもフォールバックUIを表示
    root.render(
      <ErrorFallback 
        error={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }
};

// Service Worker登録（本番環境のみ）
const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered:', registration);
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }
};

// =============================================================================
// アプリケーション開始
// =============================================================================

// 非同期でアプリケーションを起動
(async () => {
  try {
    // Service Worker登録
    await registerServiceWorker();
    
    // メインアプリケーション起動
    await bootstrap();
  } catch (error) {
    console.error('❌ Critical startup error:', error);
    
    // 緊急時フォールバック
    const container = document.getElementById('root');
    if (container) {
      const root = createRoot(container);
      root.render(
        <ErrorFallback 
          error="Critical initialization failure"
          onRetry={() => window.location.reload()}
        />
      );
    }
  }
})();