#!/bin/bash
# 簡易負荷テストスクリプト

API_BASE="http://localhost:8000/api/v1"
CONCURRENT_USERS=10
REQUESTS_PER_USER=50

echo "🔥 負荷テスト開始"
echo "同時接続数: $CONCURRENT_USERS"
echo "1ユーザーあたりのリクエスト数: $REQUESTS_PER_USER"
echo ""

# ログイン
echo "ログイン中..."
TOKEN=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' | \
    grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ ログインに失敗しました"
    exit 1
fi

echo "✅ ログイン成功"

# 負荷テスト実行
echo "負荷テスト実行中..."
start_time=$(date +%s)

for i in $(seq 1 $CONCURRENT_USERS); do
    {
        for j in $(seq 1 $REQUESTS_PER_USER); do
            curl -s -X GET "$API_BASE/vehicles" \
                -H "Authorization: Bearer $TOKEN" > /dev/null
        done
    } &
done

wait

end_time=$(date +%s)
duration=$((end_time - start_time))
total_requests=$((CONCURRENT_USERS * REQUESTS_PER_USER))

echo ""
echo "📊 負荷テスト結果:"
echo "総リクエスト数: $total_requests"
echo "実行時間: ${duration}秒"
echo "スループット: $((total_requests / duration)) req/sec"
