#!/bin/bash
# テスト実行スクリプト

cd "$(dirname "$0")/../.."
cd backend

echo "🧪 テストを実行中..."

# TypeScript コンパイルチェック
echo "📋 TypeScript コンパイルチェック..."
if npx tsc --noEmit; then
    echo "✅ TypeScript コンパイル: OK"
else
    echo "❌ TypeScript コンパイルエラー"
    exit 1
fi

# 単体テスト
echo "📋 単体テスト実行..."
npm run test

# テストカバレッジ
echo "📊 カバレッジレポート作成..."
npm run test:coverage

echo "✅ テスト完了"
