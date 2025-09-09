# 🚛 Dump Tracker Backend

ダンプ運行記録管理システムのバックエンドAPI

## 🚀 クイックスタート

### 1. 依存関係インストール
```bash
npm install
```

### 2. 環境変数設定
```bash
cp .env.example .env.local
# .env.localを編集してデータベース接続情報を設定
```

### 3. 開発サーバー起動
```bash
# 推奨方法（チェック機能付き）
./scripts/development/start_dev.sh

# または手動起動
npm run dev
```

### 4. ヘルスチェック
```bash
curl http://localhost:3000/health
```

## 🛠️ 開発用コマンド

```bash
# テスト実行
npm test

# コード品質チェック
npm run lint
npm run format:check

# ビルド
npm run build

# 環境診断
./scripts/monitoring/system_check.sh
```

## 🔧 運用スクリプト

```bash
# 開発環境リセット
./scripts/development/reset.sh

# Docker開発環境
./scripts/development/docker_dev.sh start

# ヘルスチェック
./scripts/monitoring/health_check.sh
```

## 🏗️ アーキテクチャ

- **フレームワーク**: Express.js + TypeScript
- **データベース**: PostgreSQL + Prisma ORM
- **キャッシュ**: Redis
- **認証**: JWT
- **テスト**: Jest + Supertest
- **コンテナ**: Docker + Docker Compose
- **Webサーバー**: Nginx (リバースプロキシ)

## 📦 インストール済みパッケージ

### システムレベル
- ✅ Docker & Docker Compose
- ✅ Nginx
- ✅ PostgreSQL 16
- ✅ Redis 7
- ✅ Node.js 20
- ✅ UFW Firewall
- ✅ fail2ban

### Node.js グローバル
- ✅ TypeScript
- ✅ ts-node
- ✅ nodemon
- ✅ pm2
- ✅ prettier
- ✅ eslint
- ✅ prisma

## 🔐 セキュリティ

- UFW ファイアウォール有効化済み
- fail2ban によるブルートフォース攻撃対策
- Helmet によるセキュリティヘッダー設定
- CORS 設定
- レート制限

## 🐳 Docker使用方法

```bash
# 開発環境起動
./scripts/development/docker_dev.sh start

# ログ確認
./scripts/development/docker_dev.sh logs

# 環境停止
./scripts/development/docker_dev.sh stop
```

## 📞 サポート情報

- **ヘルスチェック**: http://localhost:3000/health
- **ログファイル**: `./logs/`
- **環境診断**: `./scripts/monitoring/system_check.sh`

## 🎯 次のステップ

```bash
# 1. 開発サーバー起動
./scripts/development/start_dev.sh

# 2. ヘルスチェック確認
curl http://localhost:3000/health

# 3. 環境診断実行
./scripts/monitoring/system_check.sh
```

---

**Dump Tracker Development Team**
