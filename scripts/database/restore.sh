#!/bin/bash
# データベースリストアスクリプト

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "使用方法: $0 <backup_file.sql or backup_file.sql.gz>"
    echo ""
    echo "例:"
    echo "  $0 /path/to/dump_tracker_dev_full_20240101_120000.sql"
    echo "  $0 /path/to/dump_tracker_dev_full_20240101_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="dump_tracker_dev"
DB_USER="dump_tracker_user"
DB_PASSWORD="development_password"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ ファイルが見つかりません: $BACKUP_FILE"
    exit 1
fi

echo "⚠️ 警告: データベース '$DB_NAME' のデータが削除されます"
read -p "続行しますか？ (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "リストアをキャンセルしました"
    exit 0
fi

echo "📄 データベースリストアを開始..."

# ファイルが圧縮されている場合の処理
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "📦 圧縮ファイルを展開中..."
    zcat "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME"
else
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE"
fi

echo "✅ リストア完了"
echo "🔗 データベース接続確認:"
echo "  PGPASSWORD='$DB_PASSWORD' psql -h localhost -U $DB_USER -d $DB_NAME"
