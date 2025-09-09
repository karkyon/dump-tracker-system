# 🚛 ダンプ運行記録日報システム (Dump Tracker System)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## 📋 プロジェクト概要

ダンプ運転手の日報をアプリ化してペーパーレス化を実現し、運行データを一元管理するシステムです。GPS追跡、リアルタイム監視、自動レポート生成機能を提供します。

### 🎯 主な目的
- 紙の日報廃止による事務処理時間削減
- 正確なデータ蓄積による輸送実績報告の効率化  
- GPS位置情報によるリアルタイム運行管理
- 自動マスタ登録による入力負担軽減
- データ一元管理による業務効率化

## ✨ 主な機能

### 🚛 運転手向けモバイルアプリ
- ✅ ユーザー認証・ログイン
- ✅ 車両情報入力・管理
- ✅ 乗車前・乗車後点検記録
- ✅ リアルタイムGPS追跡
- ✅ 積込・積降場所記録
- ✅ 給油記録・燃費管理
- ✅ 運行履歴確認・検索
- ✅ オフライン対応・自動同期

### 💼 管理者向けCMS
- ✅ ユーザー・権限管理
- ✅ 車両マスタ管理
- ✅ 運行記録・データ管理
- ✅ リアルタイムGPSモニタリング
- ✅ 日報・実績報告書出力
- ✅ 各種マスタデータ管理
- ✅ 統計・分析ダッシュボード

## 🏗️ 技術スタック

### フロントエンド
- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Maps:** Leaflet + React-Leaflet
- **Testing:** Vitest + Playwright
- **PWA:** Service Worker対応

### バックエンド
- **Runtime:** Node.js 20+
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL (PostGIS拡張)
- **Cache:** Redis
- **ORM:** Prisma
- **Authentication:** JWT + bcryptjs
- **Validation:** Joi/Zod
- **File Upload:** Multer + Sharp
- **Real-time:** Socket.io
- **Logging:** Winston
- **Testing:** Jest + Supertest

### インフラ・DevOps
- **Containerization:** Docker + Docker Compose
- **Cloud:** AWS/GCP対応
- **Web Server:** Nginx
- **Database Extensions:** PostGIS (地理空間データ)
- **Process Management:** PM2
- **Monitoring:** システムログ + パフォーマンス監視

## 📁 プロジェクト構成

```
dump-tracker-system/
├── frontend/                  # Reactフロントエンド
│   ├── src/
│   │   ├── components/        # UIコンポーネント
│   │   │   ├── common/        # 共通コンポーネント
│   │   │   ├── forms/         # フォームコンポーネント
│   │   │   ├── layout/        # レイアウトコンポーネント
│   │   │   ├── maps/          # 地図コンポーネント
│   │   │   └── ui/            # UIプリミティブ
│   │   ├── pages/             # ページコンポーネント
│   │   │   ├── auth/          # 認証関連
│   │   │   ├── dashboard/     # ダッシュボード
│   │   │   ├── reports/       # レポート
│   │   │   ├── routes/        # 運行記録
│   │   │   ├── settings/      # 設定
│   │   │   └── trucks/        # 車両管理
│   │   ├── hooks/             # カスタムフック
│   │   ├── services/          # APIサービス
│   │   ├── stores/            # 状態管理
│   │   ├── types/             # TypeScript型定義
│   │   └── utils/             # ユーティリティ関数
│   ├── public/                # 静的ファイル
│   ├── tests/                 # テストファイル
│   └── package.json
├── backend/                   # Express.jsバックエンド
│   ├── src/
│   │   ├── controllers/       # コントローラー
│   │   ├── middleware/        # ミドルウェア
│   │   ├── models/            # データモデル
│   │   ├── routes/            # APIルート
│   │   ├── services/          # ビジネスロジック
│   │   ├── types/             # TypeScript型定義
│   │   ├── utils/             # ユーティリティ
│   │   └── validators/        # バリデーター
│   ├── prisma/                # Prismaスキーマ
│   ├── tests/                 # テストファイル
│   ├── data/                  # データファイル
│   ├── logs/                  # ログファイル
│   └── package.json
├── database/                  # データベース関連
│   ├── migrations/            # マイグレーション
│   ├── seeds/                 # シードデータ
│   ├── schemas/               # スキーマ定義
│   ├── functions/             # ストアドファンクション
│   ├── triggers/              # トリガー
│   └── backups/               # バックアップ
├── docs/                      # ドキュメント
│   ├── api/                   # API仕様書
│   └── database/              # データベース設計
└── scripts/                   # 各種スクリプト
    ├── database/              # DB関連スクリプト
    ├── development/           # 開発用スクリプト
    └── testing/               # テスト用スクリプト
```

## 🚀 開発環境セットアップ

### 前提条件
- Node.js 20.0.0+
- npm 8.0.0+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### セットアップ手順

```bash
# 1. リポジトリクローン
git clone https://github.com/YOUR_USERNAME/dump-tracker-system.git
cd dump-tracker-system

# 2. 依存関係インストール
cd frontend && npm install
cd ../backend && npm install

# 3. 環境変数設定
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# .envファイルを編集して各種設定を行う

# 4. Dockerを使用する場合（推奨）
cd backend
docker-compose up -d

# 5. データベースセットアップ
cd backend
npx prisma migrate dev
npx prisma db seed

# 6. 開発サーバー起動
# バックエンド（別ターミナル）
cd backend && npm run dev

# フロントエンド（別ターミナル）
cd frontend && npm run dev
```

### ローカル開発URL
- **フロントエンド:** http://localhost:3000
- **バックエンドAPI:** http://localhost:3001
- **API文書:** http://localhost:3001/api-docs

## 🧪 テスト

```bash
# フロントエンドテスト
cd frontend
npm run test              # 単体テスト
npm run test:e2e          # E2Eテスト

# バックエンドテスト
cd backend
npm run test              # 単体テスト
npm run test:integration  # 統合テスト
npm run test:e2e          # E2Eテスト
```

## 📊 開発状況

### Phase 1: 社内向け初期リリース (進行中)
- [x] 要件定義・仕様策定
- [x] UI/UX設計・プロトタイプ
- [x] プロジェクト基盤構築
- [x] 開発環境セットアップ
- [ ] 認証・認可システム
- [ ] 車両・ユーザー管理機能
- [ ] 運行記録・GPS追跡機能
- [ ] 日報・レポート機能
- [ ] モバイル最適化
- [ ] テスト・品質保証
- [ ] デプロイ・運用環境構築

### Phase 2: 外部提供・商用化 (計画中)
- [ ] マルチテナント対応
- [ ] ネイティブアプリ化
- [ ] 高度な分析機能
- [ ] API外部連携
- [ ] 商用展開・スケーリング

## 🏆 期待される効果

- ✅ **効率化**: 紙の日報廃止による事務処理時間70%削減
- ✅ **正確性**: 自動データ収集による入力ミス95%削減
- ✅ **可視化**: リアルタイム位置情報による運行状況把握
- ✅ **自動化**: マスタ自動登録による入力負担軽減
- ✅ **一元化**: データ統合による業務効率化

## 🔐 セキュリティ

- JWT認証によるセキュアなAPI通信
- HTTPS通信の強制
- 入力データバリデーション
- SQLインジェクション対策
- XSS攻撃対策
- CORS設定

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 👥 開発チーム

- **プロジェクトマネージャー:** [名前]
- **フロントエンド開発:** [名前]
- **バックエンド開発:** [名前]
- **UI/UX デザイン:** [名前]
- **DevOps:** [名前]

## 📞 サポート

- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/dump-tracker-system/issues)
- **Discussions:** [GitHub Discussions](https://github.com/YOUR_USERNAME/dump-tracker-system/discussions)
- **Email:** support@example.com

---

**🎯 リリース目標:** 2026年6月末（Phase1）

**📈 最終更新:** 2025年9月9日
