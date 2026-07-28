// frontend/mobile/src/main.tsx
// アプリケーションのエントリーポイント

import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 開発環境での詳細ログ
if (import.meta.env.DEV) {
  console.log('🚀 ダンプ運行記録モバイルアプリ起動中...');
  console.log('📋 環境変数:');
  console.log('- API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('- NODE_ENV:', import.meta.env.MODE);
}

// エラーハンドリング
window.addEventListener('error', (event) => {
  console.error('❌ グローバルエラー:', event.error);
  
  // 証明書エラーの処理
  if (event.error?.message?.includes('certificate')) {
    console.log('🔐 証明書エラーが検出されました');
    console.log('💡 解決方法:');
    console.log('1. ブラウザでバックエンドURL (https://192.168.1.12:8443) にアクセス');
    console.log('2. 「詳細設定」→「安全でないサイトに進む」をクリック');
    console.log('3. ページをリロード');
  }
});

// 未処理のPromise拒否のハンドリング
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ 未処理のPromise拒否:', event.reason);
  
  if (event.reason?.message?.includes('NetworkError')) {
    console.log('🌐 ネットワークエラーが発生しました');
    console.log('🔍 確認事項:');
    console.log('- バックエンドサーバーが起動しているか');
    console.log('- HTTPS証明書が信頼されているか');
    console.log('- CORSが正しく設定されているか');
  }
});

// DOM要素の確認
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container missing in index.html');
}

const root = ReactDOM.createRoot(container);

// React Strict Modeでレンダリング
root.render(<App />);

// Service Worker登録(PWA対応)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker登録成功:', registration.scope);
      })
      .catch((error) => {
        console.error('❌ Service Worker登録失敗:', error);
      });
  });
}

// 開発環境での追加情報
if (import.meta.env.DEV) {
  console.log('✅ アプリケーション起動完了');
  console.log('📱 モバイルアプリケーションが正常に起動しました');
  console.log('🌐 アクセスURL: https://localhost:3002');
}