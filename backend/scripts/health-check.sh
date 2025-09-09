#!/bin/bash
# ヘルスチェックスクリプト

PORT=${PORT:-8000}
HOST=${HOST:-localhost}

echo "🔍 サーバーヘルスチェック実行中..."

# ヘルスチェック実行
if curl -f -s "http://$HOST:$PORT/health" > /dev/null; then
    echo "✅ サーバーは正常に動作しています"
    echo "📋 詳細情報:"
    curl -s "http://$HOST:$PORT/health" | jq . 2>/dev/null || curl -s "http://$HOST:$PORT/health"
    exit 0
else
    echo "❌ サーバーが応答しません"
    echo "🔍 ポート確認:"
    if command -v lsof >/dev/null 2>&1; then
        lsof -i :$PORT || echo "ポート $PORT でリスンしているプロセスはありません"
    else
        echo "lsof コマンドが見つかりません"
    fi
    exit 1
fi
