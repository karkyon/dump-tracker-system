#!/bin/bash

echo "🚀 Dump Tracker Backend 開発サーバー起動中..."

# 現在のディレクトリ確認
if [[ ! -f "package.json" ]]; then
    echo "❌ package.json が見つかりません。正しいディレクトリで実行してください。"
    exit 1
fi

# 環境変数確認
if [[ ! -f ".env.local" ]]; then
    echo "❌ .env.local ファイルが見つかりません。"
    echo "💡 .env.example をコピーして .env.local を作成してください："
    echo "   cp .env.example .env.local"
    exit 1
fi

# ポート使用確認
if netstat -tlnp 2>/dev/null | grep -q :3000; then
    echo "⚠️ ポート3000は既に使用されています。"
    echo "🔧 使用中のプロセスを確認："
    netstat -tlnp 2>/dev/null | grep :3000
    echo ""
    read -p "プロセスを終了して続行しますか？ [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pkill -f "node.*3000" || true
        sleep 2
    else
        echo "開発サーバー起動をキャンセルしました"
        exit 1
    fi
fi

# 依存関係チェック
if [[ ! -d "node_modules" ]]; then
    echo "📦 依存関係をインストール中..."
    npm install
fi

echo "✅ 開発サーバーを起動します..."
echo "🌐 URL: http://localhost:3000"
echo "🏥 Health: http://localhost:3000/health"
echo ""
echo "🛑 停止するには Ctrl+C を押してください"
echo ""

npm run dev
