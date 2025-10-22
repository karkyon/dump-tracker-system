# ダンプ運行記録モバイルアプリ

ダンプトラック運行記録・GPS追跡・運行管理システムのモバイルアプリケーションです。

## 📱 アプリ概要

### 実装済み機能

#### ✅ D1: ログイン画面
- ユーザーID/パスワード認証
- 次回ログインIDを記録機能
- バリデーション機能
- モダンなグラデーションUI
- エラーハンドリング

#### ✅ D2: 車両情報画面
- 車番選択(ドロップダウン)
- 車種自動表示
- 開始距離入力(前回終了距離自動表示)
- 運転手名自動表示(ログインユーザー情報から)
- 前回運転手名・最終運行日表示

#### ✅ D3: 乗車前点検画面
- 点検項目チェックリスト(10項目)
- 全てチェック機能
- 積込情報表示(客先名、積込場所、品目)
- 積荷確認チェックボックス
- 進捗状況バー
- アニメーション付きUI

#### ✅ D4: 運行中画面
- リアルタイムGPS追跡
- 運行経過時間表示(HH:MM:SS)
- GPS状態表示(取得中/未取得)
- 位置情報表示(緯度・経度・精度)
- 簡易マップ表示(プレースホルダー)
- 操作ボタン群:
  - 積込場所到着
  - 積降場所到着
  - 休憩・荷待ち(トグル)
  - 給油
  - 車庫到着

### 技術スタック
- **React 18** + **TypeScript**
- **Vite** - 高速ビルドツール
- **Tailwind CSS** - ユーティリティファーストCSS
- **Zustand** - 軽量状態管理
- **React Router DOM** - SPAルーティング
- **Axios** - HTTPクライアント
- **React Hot Toast** - 通知UI
- **PWA (Vite Plugin)** - プログレッシブWebアプリ対応

## 🚀 セットアップ手順

### 1. 前提条件
```bash
# Node.js バージョン確認
node --version  # v16以上必要
npm --version   # v7以上必要
```

### 2. ファイル配置

以下のファイルを適切なディレクトリに配置してください:

```
frontend/mobile/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── .env
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── VehicleInfo.tsx
│   │   ├── PreDepartureInspection.tsx
│   │   └── OperationMain.tsx
│   ├── stores/
│   │   └── authStore.ts
│   ├── services/
│   │   └── api.ts
│   ├── hooks/
│   │   └── useGPS.ts
│   ├── types/
│   │   └── index.ts
│   └── components/
│       └── (必要に応じて追加)
└── public/
    ├── icons/
    │   ├── icon-192.png
    │   └── icon-512.png
    └── manifest.json
```

### 3. 依存関係インストール

```bash
cd frontend/mobile
npm install
```

### 4. 環境変数設定

`.env`ファイルを編集して、バックエンドAPIのURLを設定:

```bash
# バックエンドAPIのベースURL
VITE_API_BASE_URL=http://10.1.119.244:8000/api/v1

# Google Maps API キー (実際のキーに置き換え)
VITE_GOOGLE_MAPS_API_KEY=YOUR_ACTUAL_API_KEY
```

### 5. 開発サーバー起動

```bash
npm run dev
```

アクセス先: `http://localhost:3002`

## 📱 画面遷移フロー

```
ログイン画面(D1)
    ↓ [ログイン成功]
車両情報画面(D2)
    ↓ [車両選択・進む]
乗車前点検画面(D3)
    ↓ [点検完了・運行開始]
運行中画面(D4)
    ↓ [各種操作ボタン]
    └→ 積込場所到着
    └→ 積降場所到着
    └→ 休憩・荷待ち
    └→ 給油
    └→ 車庫到着
```

## 🔐 テストアカウント

バックエンドAPIに応じて以下のようなテストアカウントを使用:

```
ユーザーID: test_driver
パスワード: test123
```

## 📊 バックエンドAPI連携

### 使用APIエンドポイント

- `POST /api/v1/mobile/auth/login` - ログイン
- `GET /api/v1/mobile/auth/me` - ユーザー情報取得
- `GET /api/v1/mobile/vehicle` - 車両情報取得
- `POST /api/v1/mobile/operations/start` - 運行開始
- `POST /api/v1/mobile/gps/log` - GPS位置記録
- `GET /api/v1/mobile/operations/current` - 現在の運行状況取得

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

## 📱 モバイル対応

### 対応デバイス
- iOS Safari (iOS 13以降)
- Android Chrome (Android 8以降)
- その他モダンブラウザ

### PWA機能
- オフライン対応
- ホーム画面追加
- プッシュ通知(将来実装)

## 🔧 カスタマイズ

### APIエンドポイント変更
`.env`ファイルを編集:
```bash
VITE_API_BASE_URL=https://your-server.com/api/v1
```

### GPS更新間隔変更
`.env`ファイルを編集:
```bash
VITE_GPS_UPDATE_INTERVAL=5000  # ミリ秒
```

### アプリ名・アイコン変更
1. `public/manifest.json`を編集
2. `public/icons/`内のアイコンを置き換え

## 🐛 トラブルシューティング

### GPS取得エラー
**原因**: 位置情報許可が拒否されている  
**解決**: ブラウザ設定で位置情報を許可

### API接続エラー
**原因**: バックエンドサーバーが起動していない  
**解決**: バックエンドディレクトリでサーバーを起動

### ビルドエラー
**原因**: 依存関係の不整合  
**解決**: `node_modules`を削除して再インストール
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📋 今後の実装予定

- [ ] D5: 積込場所入力画面
- [ ] D6: 積降場所入力画面
- [ ] D7: 給油記録画面
- [ ] D8: 乗車後点検画面
- [ ] D9: 運行履歴確認画面
- [ ] Google Maps統合
- [ ] オフライン同期機能
- [ ] プッシュ通知機能

## 📄 ライセンス

このプロジェクトは社内専用です。

## 👥 開発チーム

- フロントエンド開発: [開発チーム名]
- バックエンド開発: [開発チーム名]
- UI/UXデザイン: [デザインチーム名]

## 📞 サポート

問題が発生した場合は、以下にお問い合わせください:
- Email: support@example.com
- Slack: #dump-tracker-support

---

**Version 1.0.0** - 2025-01-07

**© 2025 Dump Tracker System. All rights reserved.**