#!/bin/bash
# データベースセットアップスクリプト

cd "$(dirname "$0")/../.."
cd backend

echo "🗄️ データベースセットアップを開始..."

# PostgreSQL確認
if ! command -v psql >/dev/null 2>&1; then
    echo "❌ PostgreSQLがインストールされていません"
    echo "Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "macOS: brew install postgresql"
    exit 1
fi

# PostgreSQL サービス確認
if ! pg_isready -q; then
    echo "⚠️  PostgreSQLサービスが起動していません"
    echo "起動方法: sudo systemctl start postgresql"
    echo "または: brew services start postgresql"
fi

# データベース作成
echo "📊 データベースを作成中..."
npm run db:create

# マイグレーション実行
echo "🔄 マイグレーションを実行中..."
npm run db:migrate

# シードデータ投入
echo "🌱 シードデータを投入中..."
npm run db:seed

echo "✅ データベースセットアップ完了"
