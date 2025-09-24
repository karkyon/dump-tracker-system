# ダンプ運行記録モバイルアプリ

ダンプトラック運行記録・GPS追跡・運行管理システムのモバイルアプリケーションです。

## 📱 アプリ概要

### 主要機能
- **ログイン認証** - 運転手ごとの個別認証
- **リアルタイムGPS追跡** - 高精度な位置情報記録
- **運行記録** - 積込・積降・休憩・給油などのアクション記録
- **マップ表示** - Google Maps WebGL Vector Map対応
- **オフライン対応** - ネットワーク断絶時の継続記録
- **PWA対応** - アプリライクな操作性

### 技術スタック
- **React 18** + **TypeScript**
- **Vite** - 高速ビルドツール
- **Tailwind CSS** - ユーティリティファーストCSS
- **Zustand** - 軽量状態管理
- **React Router DOM** - SPA ルーティング
- **Axios** - HTTP クライアント
- **React Hot Toast** - 通知UI
- **Google Maps API** - マップ表示
- **PWA (Vite Plugin)** - プログレッシブWebアプリ対応

## 🚀 セットアップ手順

### 1. 前提条件
```bash
# Node.js バージョン確認
node --version  # v16以上必要
npm --version   # v7以上必要
```

### 2. プロジェクト構築

#### 既存HTMLファイルの削除
```bash
# 古いHTMLファイルを削除
rm -f frontend/mobile/login.html
rm -f frontend/mobile/operation.html
```

#### ディレクトリ構造作成
```bash
# モバイルアプリディレクトリ作成
mkdir -p frontend/mobile/src/{components,pages,services,stores,types,utils,hooks}
mkdir -p frontend/mobile/src/components/common
mkdir -p frontend/mobile/public

# 適切なディレクトリ構造に移動
cd frontend/mobile
```

#### package.json作成
```bash
cat > package.json << 'EOF'
{
  "name": "dump-tracker-mobile",
  "displayName": "ダンプ運行記録モバイル",
  "description": "ダンプトラック運行記録・GPS追跡・運行管理モバイルアプリ",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3002 --host",
    "build": "tsc && vite build",
    "preview": "vite preview --port 3002 --host",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "type-check": "tsc --noEmit",
    "pwa:build": "vite build && workbox generateSW workbox-config.js"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.30.1",
    "react-hot-toast": "^2.4.0",
    "axios": "^1.11.0",
    "zustand": "^4.5.7",
    "lucide-react": "^0.263.1",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.28",
    "@types/react-dom": "^18.0.11",
    "@typescript-eslint/eslint-plugin": "^5.57.1",
    "@typescript-eslint/parser": "^5.57.1",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.4.14",
    "eslint": "^8.38.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.3.4",
    "postcss": "^8.4.23",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.2",
    "vite": "^4.3.2",
    "vite-plugin-pwa": "^0.16.4",
    "workbox-cli": "^7.0.0"
  }
}
EOF
```

#### 依存関係インストール
```bash
npm install
```

### 3. 設定ファイル作成

#### vite.config.ts
```bash
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}']
      },
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ダンプ運行記録アプリ',
        short_name: 'ダンプ運行記録',
        description: 'ダンプトラック運行記録・GPS追跡・運行管理システム',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 3002,
    host: true,
    proxy: {
      '/api': {
        target: 'http://10.1.119.244:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
EOF
```

#### tailwind.config.js
```bash
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Hiragino Sans', 'Yu Gothic UI', 'system-ui', 'sans-serif'],
      },
      screens: {
        'mobile': {'max': '414px'},
      },
    },
  },
  plugins: [],
}
EOF
```

#### tsconfig.json
```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF
```

#### 環境変数設定
```bash
cat > .env << 'EOF'
# API Base URL
VITE_API_BASE_URL=http://10.1.119.244:8000/api/v1

# Google Maps API Key (実際のキーに置き換えてください)
VITE_GOOGLE_MAPS_API_KEY=AIzaSyC1LrD7xMN_sLZ5iELaLpPzXPeQeEoH6pY

# App Environment
VITE_APP_ENV=development

# GPS Update Interval (milliseconds)
VITE_GPS_UPDATE_INTERVAL=5000
EOF

cp .env .env.example
```

### 4. HTMLテンプレート作成

#### public/index.html
```bash
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#2563eb" />
  <meta name="description" content="ダンプトラック運行記録・GPS追跡・運行管理システム" />
  
  <!-- PWA対応 -->
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/png" href="/icon-192.png" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  
  <!-- iOS対応 -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="ダンプ運行記録" />
  
  <title>ダンプ運行記録アプリ</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
EOF
```

### 5. ファイル作成スクリプト

#### setup-files.sh (自動ファイル作成)
```bash
cat > setup-files.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 モバイルアプリファイル作成中..."

# 型定義ファイル
cat > src/types/index.ts << 'TYPES_EOF'
export interface User {
  id: string;
  userId: string;
  name: string;
  role: string;
  vehicleId: string;
}

export interface Position {
  coords: {
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    accuracy: number;
  };
  timestamp: number;
}

export interface OperationInfo {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime?: string;
  loadingLocation?: string;
  unloadingLocation?: string;
  cargoInfo?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
TYPES_EOF

# メインCSSファイル
cat > src/index.css << 'CSS_EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: 'Hiragino Sans', 'Yu Gothic UI', system-ui, sans-serif;
  }
  body {
    @apply bg-gray-50 text-gray-900;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  .mobile-container {
    @apply max-w-sm mx-auto min-h-screen bg-white;
  }
}
CSS_EOF

echo "✅ ファイル作成完了"
echo "📁 以下のファイルが作成されました:"
echo "   - src/types/index.ts"
echo "   - src/index.css"
echo ""
echo "⚠️  注意: 以下のファイルを手動で作成/配置してください:"
echo "   - 全ての .tsx ファイル (Login.tsx, OperationRecord.tsx, App.tsx, main.tsx)"
echo "   - サービスファイル (src/services/api.ts)"
echo "   - ストアファイル (src/stores/authStore.ts)"
echo "   - フックファイル (src/hooks/*.ts)"
echo "   - ユーティリティファイル (src/utils/*.ts)"
EOF

chmod +x setup-files.sh
./setup-files.sh
```

### 6. 開発サーバー起動

```bash
# 開発サーバー起動
npm run dev

# アクセス先
# http://localhost:3002
```

## 🏗️ ビルドとデプロイ

### 本番ビルド
```bash
npm run build
```

### プレビュー
```bash
npm run preview
```

### PWAビルド
```bash
npm run pwa:build
```

## 📱 動作確認手順

### 1. ログイン機能
1. `http://localhost:3002/login` にアクセス
2. テストユーザーでログイン:
   - ユーザーID: `test_driver`
   - パスワード: `test123`
3. 「ログイン状態を保持する」をチェック可能

### 2. GPS追跡機能
1. ログイン後、自動的に運行記録画面に遷移
2. ブラウザの位置情報許可を承認
3. GPSマーカーが地図上に表示される
4. 移動すると軌跡が記録される

### 3. 運行記録機能
1. 「積込場所到着」ボタンをクリック
2. 「積降場所到着」ボタンが有効になる
3. 「休憩・荷待ち」「給油」ボタンで各種記録
4. 各アクションがサーバーに送信される

### 4. オフライン対応
1. ネットワークを切断
2. 運行記録は継続される
3. ネットワーク復旧時に自動同期

## 🐛 トラブルシューティング

### よくあるエラー

#### GPS取得エラー
```
原因: 位置情報許可が拒否されている
解決: ブラウザ設定で位置情報を許可
```

#### API接続エラー
```
原因: バックエンドサーバーが起動していない
解決: backend/ ディレクトリでサーバーを起動
```

#### Google Maps表示エラー
```
原因: APIキーが無効または未設定
解決: .env ファイルの VITE_GOOGLE_MAPS_API_KEY を確認
```

### ログ確認
```bash
# ブラウザ開発者ツール > Console
# GPS状態、API通信、エラー情報を確認
```

## 🔧 カスタマイズ

### APIエンドポイント変更
```bash
# .env ファイルを編集
VITE_API_BASE_URL=http://your-server:port/api/v1
```

### GPS更新間隔変更
```bash
# .env ファイルを編集
VITE_GPS_UPDATE_INTERVAL=3000  # 3秒間隔
```

### アプリ名・アイコン変更
1. `public/manifest.json` を編集
2. `public/icon-*.png` を置き換え
3. `vite.config.ts` の PWA設定を更新

## 📚 開発者向け情報

### プロジェクト構造
```
frontend/mobile/
├── public/                 # 静的ファイル
├── src/
│   ├── components/        # 共通コンポーネント
│   ├── pages/            # ページコンポーネント
│   ├── services/         # API通信層
│   ├── stores/           # 状態管理
│   ├── types/            # TypeScript型定義
│   ├── utils/            # ユーティリティ
│   ├── hooks/            # カスタムフック
│   ├── App.tsx           # メインアプリ
│   ├── main.tsx          # エントリーポイント
│   └── index.css         # グローバルスタイル
├── package.json          # 依存関係
├── vite.config.ts        # ビルド設定
├── tailwind.config.js    # CSS設定
└── tsconfig.json         # TypeScript設定
```

### 重要なファイル
- **Login.tsx**: ログイン画面（認証フォーム）
- **OperationRecord.tsx**: メイン運行記録画面（GPS追跡）
- **api.ts**: バックエンド通信サービス
- **authStore.ts**: 認証状態管理
- **useGPS.ts**: GPS関連カスタムフック

## 🔐 セキュリティ

### 認証
- JWT トークンベース認証
- ローカルストレージに安全に保存
- トークン有効期限チェック

### データ保護
- HTTPS通信推奨
- 位置情報の適切な暗号化
- オフラインデータの定期削除

## 📊 パフォーマンス最適化

### GPS処理
- 平滑化アルゴリズムによる精度向上
- バッファリングによる処理負荷軽減
- 適応的更新間隔

### ネットワーク
- 接続状態の監視
- 自動リトライ機能
- オフライン対応

### メモリ管理
- 不要なGPSデータの自動削除
- 軌跡データの最適化
- メモリリーク防止

## 🚀 デプロイメント

### 本番環境への展開

#### 1. 環境変数設定
```bash
# 本番用 .env.production
VITE_API_BASE_URL=https://your-production-api.com/api/v1
VITE_GOOGLE_MAPS_API_KEY=your_production_google_maps_key
VITE_APP_ENV=production
VITE_DEBUG=false
```

#### 2. ビルド実行
```bash
npm run build
```

#### 3. Nginx設定例
```nginx
server {
    listen 443 ssl;
    server_name dump-tracker-mobile.example.com;
    
    root /var/www/dump-tracker-mobile/dist;
    index index.html;
    
    # PWA対応
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # 静的ファイルキャッシュ
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache";
    }
    
    # API プロキシ
    location /api/ {
        proxy_pass http://backend-server:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🧪 テスト

### 単体テスト
```bash
# テストフレームワーク追加（推奨）
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom

# テスト実行
npm run test
```

### E2Eテスト
```bash
# Playwright追加（推奨）
npm install --save-dev @playwright/test

# E2Eテスト実行
npm run test:e2e
```

### GPS機能テスト
```bash
# GPS シミュレータ使用
# Chrome DevTools > Sensors > Location
# 座標: 34.6937, 135.5023 (大阪)
```

## 📋 チェックリスト

### デプロイ前確認
- [ ] バックエンドAPIが稼働中
- [ ] Google Maps APIキーが有効
- [ ] HTTPS証明書が設定済み
- [ ] 位置情報許可が正常に動作
- [ ] オフライン機能の動作確認
- [ ] PWA機能（ホーム画面追加）
- [ ] 各種ボタン・フォームの動作
- [ ] ログイン・ログアウト
- [ ] GPS追跡・記録機能

### セキュリティチェック
- [ ] 認証トークンの適切な管理
- [ ] HTTPS通信の強制
- [ ] 位置情報の暗号化
- [ ] XSS対策
- [ ] CSRF対策

## 🔄 アップデート手順

### アプリ更新
```bash
# 最新コード取得
git pull origin main

# 依存関係更新
npm install

# ビルド実行
npm run build

# デプロイ
# (デプロイ方法は環境に応じて調整)
```

### PWA更新
```bash
# Service Worker更新
# ユーザーがアプリを再起動すると自動更新
```

## 📞 サポート

### バグレポート
- 発生環境（デバイス、ブラウザ）
- 再現手順
- エラーメッセージ
- GPS取得状況

### 機能要望
- 具体的な使用場面
- 期待する動作
- 現在の課題

### 連絡先
- 開発チーム: dev-team@example.com
- システム管理者: admin@example.com

---

**このモバイルアプリは、従来のHTMLファイル（login.html、operation.html）を完全にReactベースに書き換えた最新版です。**

**主な改善点:**
- 適切なReact + TypeScript構成
- 統一されたディレクトリ構造
- プロジェクトナレッジとの完全な統合
- バックエンドAPIとの正しい連携
- PWA対応による向上したユーザー体験
- オフライン機能による信頼性の向上