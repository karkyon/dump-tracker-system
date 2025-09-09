#!/bin/bash
# 本番環境起動スクリプト（堅牢版）

set -e

echo "🚀 本番環境を起動しています..."

# 現在のディレクトリをバックエンドディレクトリに設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

echo "📁 作業ディレクトリ: $BACKEND_DIR"

# 環境変数確認
if [ -z "$NODE_ENV" ]; then
    export NODE_ENV=production
    echo "🌍 NODE_ENV を production に設定しました"
fi

if [ -z "$PORT" ]; then
    export PORT=8000
    echo "🚪 PORT を 8000 に設定しました"
fi

# 依存関係インストール（本番用）
echo "📦 本番依存関係インストール中..."
npm ci --only=production --silent
echo "✅ 依存関係インストール完了"

# 必要ディレクトリ作成
echo "📁 必要ディレクトリ作成中..."
mkdir -p logs uploads/{avatars,photos,documents} temp
echo "✅ ディレクトリ作成完了"

# ビルド
echo "🔨 アプリケーションビルド中..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ ビルド完了"
else
    echo "❌ ビルドエラー"
    exit 1
fi

# dist ディレクトリ確認
if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
    echo "❌ ビルド成果物が見つかりません"
    exit 1
fi

echo "✅ ビルド成果物確認完了"

# サーバー起動
echo "🎯 本番サーバー起動中..."
echo "📋 ポート: $PORT"
echo "🌍 環境: $NODE_ENV"
echo ""

npm start
