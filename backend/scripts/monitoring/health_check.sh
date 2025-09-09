#!/bin/bash

API_URL="http://localhost:3000"
HEALTH_ENDPOINT="$API_URL/health"

echo "🏥 Dump Tracker Backend ヘルスチェック"
echo "🔗 URL: $HEALTH_ENDPOINT"
echo ""

response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null)

if [ $? -eq 0 ]; then
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    case "$http_code" in
        200)
            echo "✅ API サーバーは正常に動作しています"
            echo "📊 レスポンス:"
            echo "$body" | jq . 2>/dev/null || echo "$body"
            ;;
        *)
            echo "⚠️ API サーバーでエラーが発生しています (HTTP $http_code)"
            echo "📊 レスポンス:"
            echo "$body"
            ;;
    esac
else
    echo "❌ API サーバーに接続できません"
fi
