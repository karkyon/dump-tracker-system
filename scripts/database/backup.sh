#!/bin/bash
# データベースバックアップスクリプト

set -euo pipefail

BACKUP_DIR="$HOME/dump-tracker/database/backups"
DB_NAME="dump_tracker_dev"
DB_USER="dump_tracker_user"
DB_PASSWORD="development_password"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

echo "🗄️ データベースバックアップを開始..."

# スキーマ + データのバックアップ
PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" \
    -f "$BACKUP_DIR/${DB_NAME}_full_${TIMESTAMP}.sql" \
    --verbose --clean --if-exists

# スキーマのみのバックアップ
PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" \
    -f "$BACKUP_DIR/${DB_NAME}_schema_${TIMESTAMP}.sql" \
    --schema-only --verbose

# 圧縮バックアップ
gzip "$BACKUP_DIR/${DB_NAME}_full_${TIMESTAMP}.sql"

echo "✅ バックアップ完了: $BACKUP_DIR"
echo "📊 バックアップファイル:"
ls -la "$BACKUP_DIR"/*_${TIMESTAMP}*

# 古いバックアップを削除（30日以上前）
find "$BACKUP_DIR" -name "*.sql*" -type f -mtime +30 -delete
echo "🧹 古いバックアップを削除しました（30日以上前）"
