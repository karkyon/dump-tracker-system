# ===== DB状態確認スクリプト実行 =====
cd ~/dump-tracker/backend

# 環境変数確認
echo "=== 環境変数確認 ==="
cat .env | grep DATABASE_URL
echo "NODE_ENV: $NODE_ENV"

# PostgreSQL接続確認
echo "=== 接続確認 ==="
pg_isready -h localhost -p 5432
if [ $? -ne 0 ]; then
    echo "❌ DB接続失敗 - 作業中断"
    exit 1
fi
echo "✅ DB接続成功"