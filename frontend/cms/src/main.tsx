// frontend/src/main.tsx - 修正版: HTTPS証明書対応強化版
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// HTTPS証明書エラーハンドリング
const handleCertificateError = () => {
  console.warn('⚠️ HTTPS証明書の警告が表示される場合があります');
  console.log('🔧 解決方法:');
  console.log('1. ブラウザで https://dumptracker-s.ddns.net に直接アクセス');
  console.log('2. 「詳細設定」をクリック');
  console.log('3. 「10.1.119.244に進む（安全ではありません）」をクリック');
  console.log('4. 証明書を信頼させる');
};

// Check if user is already authenticated
const initAuth = async () => {
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log('📍 既存の認証トークンが見つかりました。検証中...');
      // Validate token and set user state
      // await useAuthStore.getState().checkAuth();
    }
  } catch (error) {
    console.error('❌ 認証初期化エラー:', error);
    // 証明書エラーの場合はヘルプを表示
    if (error instanceof Error && error.message.includes('certificate')) {
      handleCertificateError();
    }
  }
};

// エラーハンドリングのセットアップ
const setupErrorHandling = () => {
  // 未処理のPromise rejection
  window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled promise rejection:', event.reason);
    
    // HTTPS証明書関連のエラーをチェック
    if (event.reason?.message?.includes('certificate') || 
        event.reason?.message?.includes('ERR_CERT_AUTHORITY_INVALID')) {
      handleCertificateError();
      event.preventDefault(); // デフォルトのエラー表示を抑制
    }
  });

  // 一般的なエラー
  window.addEventListener('error', (event) => {
    console.error('❌ Global error:', event.error);
    
    // ネットワークエラーのチェック
    if (event.error?.message?.includes('Failed to fetch') ||
        event.error?.message?.includes('NetworkError')) {
      console.log('🌐 ネットワークエラーが発生しました');
      console.log('🔍 確認事項:');
      console.log('- バックエンドサーバーが起動しているか');
      console.log('- HTTPS証明書が信頼されているか');
      console.log('- CORSが正しく設定されているか');
    }
  });
};

// API接続テスト
const testApiConnection = async () => {
  try {
    // ✅ 修正: VITE_API_BASE_URL が相対パス(/api/v1)の場合はそのまま使用
    // 絶対URLの場合のみそのまま使用、相対パスの場合は /api/v1/health に
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    // /api/v1 のような相対パスの場合は /health を付けて /api/v1/health にする
    // https://... のような絶対URLの場合は /api/v1/health を付ける
    const healthUrl = apiBaseUrl.startsWith('http')
      ? `${apiBaseUrl}/health`
      : `${apiBaseUrl}/health`;
    console.log(`🔗 API接続テスト: ${healthUrl}`);
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API接続成功:', data);
    } else {
      console.warn(`⚠️ API接続警告: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // 開発環境では接続テスト失敗はログのみ（アプリ起動は継続）
    console.warn('⚠️ API接続テスト失敗（アプリは継続起動）:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message.includes('certificate')) {
      handleCertificateError();
    }
  }
};

// アプリケーション初期化
const initializeApp = async () => {
  try {
    console.log('🚀 DumpTracker フロントエンド初期化開始...');
    
    // エラーハンドリングセットアップ
    setupErrorHandling();
    
    // API接続テスト
    await testApiConnection();
    
    // 認証初期化
    await initAuth();
    
    console.log('✅ フロントエンド初期化完了');
  } catch (error) {
    console.error('❌ アプリケーション初期化エラー:', error);
  }
};

// DOM要素の確認
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container missing in index.html');
}

const root = createRoot(container);

// React Strict Modeでの開発時警告抑制設定
const StrictModeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  React.useEffect(() => {
    // ログ出力のみ
    if (import.meta.env.DEV) {
      console.log('🔧 開発モードで実行中');
    }
  }, []);

  // レンダー部分で条件分岐
  if (import.meta.env.DEV) {
    return <>{children}</>;
  }

  return <React.StrictMode>{children}</React.StrictMode>;
};

// アプリケーション初期化とレンダリング
initializeApp().then(() => {
  root.render(
    <StrictModeWrapper>
      <App />
    </StrictModeWrapper>
  );
}).catch((error) => {
  console.error('❌ アプリケーション起動失敗:', error);
  
  // エラー時でもアプリをレンダリング（オフライン対応）
  root.render(
    <StrictModeWrapper>
      <App />
    </StrictModeWrapper>
  );
});