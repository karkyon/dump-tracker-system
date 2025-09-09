#!/bin/bash
# データベースリセットスクリプト

set -euo pipefail

DB_NAME="dump_tracker_dev"
DB_USER="dump_tracker_user"
DB_PASSWORD="development_password"

echo "⚠️ 警告: データベース '$DB_NAME' が完全にリセットされます"
echo "すべてのデータが削除され、初期状態に戻ります"
read -p "続行しますか？ (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "リセットをキャンセルしました"
    exit 0
fi

echo "📄 データベースリセットを開始..."

# データベース削除・再作成
sudo -u postgres psql << EOSQL
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\q
EOSQL

echo "✅ データベースリセット完了"
echo "📋 次のステップ: Phase 2 を再実行してスキーマを作成してください"
echo "  ./2_database_schema_setup.sh"
