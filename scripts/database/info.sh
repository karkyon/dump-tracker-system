#!/bin/bash
# データベース情報表示スクリプト

set -euo pipefail

DB_NAME="dump_tracker_dev"
DB_USER="dump_tracker_user"
DB_PASSWORD="development_password"

echo "📊 データベース情報"
echo "===================="
echo "データベース: $DB_NAME"
echo "ユーザー: $DB_USER"
echo "ホスト: localhost:5432"
echo ""

echo "📋 テーブル一覧:"
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
"

echo ""
echo "📊 データ統計:"
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    'ユーザー' as テーブル,
    COUNT(*) as 件数
FROM users
UNION ALL
SELECT 
    '車両' as テーブル,
    COUNT(*) as 件数
FROM vehicles
UNION ALL
SELECT 
    '場所' as テーブル,
    COUNT(*) as 件数
FROM locations
UNION ALL
SELECT 
    '品目' as テーブル,
    COUNT(*) as 件数
FROM items
UNION ALL
SELECT 
    '運行記録' as テーブル,
    COUNT(*) as 件数
FROM operations;
"

echo ""
echo "🔗 接続コマンド:"
echo "  PGPASSWORD='$DB_PASSWORD' psql -h localhost -U $DB_USER -d $DB_NAME"
