#!/bin/bash

echo "🔄 Dump Tracker Backend リセット開始..."

# Node.js プロセス停止
echo "🛑 Node.js プロセス停止中..."
pkill -f "node.*3000" || true
pkill -f "ts-node" || true

# 依存関係クリア
echo "🧹 依存関係クリア中..."
rm -rf node_modules package-lock.json

# ログ・キャッシュクリア
echo "📝 ログ・キャッシュクリア中..."
rm -rf logs/* dist/*

# 依存関係再インストール
echo "📦 依存関係再インストール中..."
npm install

echo "✅ バックエンドリセット完了!"
echo ""
echo "🚀 開発サーバー起動: npm run dev"
