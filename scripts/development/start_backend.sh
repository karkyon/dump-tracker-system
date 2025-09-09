#!/bin/bash
# バックエンド開発サーバー起動スクリプト

cd "$(dirname "$0")/../.."
cd backend

echo "🚀 バックエンド開発サーバーを起動中..."

# 環境変数確認
if [ ! -f .env ]; then
    echo "⚠️  .envファイルが見つかりません。.env.exampleからコピーしてください"
    cp .env.example .env
    echo "📝 .envファイルを作成しました。必要に応じて編集してください"
fi

# 依存関係確認
if [ ! -d node_modules ]; then
    echo "📦 依存関係をインストール中..."
    npm install
fi

# データベース接続確認
echo "🔍 データベース接続を確認中..."
if ! npm run db:ping 2>/dev/null; then
    echo "⚠️  データベースに接続できません。PostgreSQLが起動していることを確認してください"
fi

# 開発サーバー起動
echo "🎯 開発サーバーを起動します..."
npm run dev
