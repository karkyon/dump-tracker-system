# ===== 現在のスキーマ状態保存 =====
echo "=== 現在のスキーマ保存 ==="

# Prismaスキーマから現在の状態取得
npx prisma db pull --print > current_schema_$(date +%Y%m%d_%H%M%S).prisma

# DB構造直接取得
psql $DATABASE_URL -c "\d+" > current_db_structure_$(date +%Y%m%d_%H%M%S).txt

# テーブル一覧取得
psql $DATABASE_URL -c "
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
" > current_tables_$(date +%Y%m%d_%H%M%S).txt

echo "✅ スキーマ状態保存完了"

# ===== データ整合性確認SQL実行 =====
echo "=== データ整合性チェック ==="

psql $DATABASE_URL << 'EOF'
-- 全テーブルレコード数確認
\echo '=== テーブルレコード数 ==='
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL SELECT 'items', COUNT(*) FROM items
UNION ALL SELECT 'locations', COUNT(*) FROM locations
UNION ALL SELECT 'operations', COUNT(*) FROM operations
UNION ALL SELECT 'operation_details', COUNT(*) FROM operation_details
UNION ALL SELECT 'gps_logs', COUNT(*) FROM gps_logs
UNION ALL SELECT 'maintenance_records', COUNT(*) FROM maintenance_records
UNION ALL SELECT 'inspection_records', COUNT(*) FROM inspection_records
UNION ALL SELECT 'inspection_items', COUNT(*) FROM inspection_items
UNION ALL SELECT 'inspection_item_results', COUNT(*) FROM inspection_item_results
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;

-- 外部キー整合性確認
\echo '=== 外部キー整合性チェック ==='
SELECT 'operations' as table_name, COUNT(*) as orphaned_records
FROM operations o
LEFT JOIN users u ON o.driver_id = u.id
LEFT JOIN vehicles v ON o.vehicle_id = v.id
WHERE u.id IS NULL OR v.id IS NULL;

-- 重複データ確認
\echo '=== 重複データチェック ==='
SELECT username, COUNT(*) as duplicate_count
FROM users GROUP BY username HAVING COUNT(*) > 1;

SELECT plate_number, COUNT(*) as duplicate_count
FROM vehicles GROUP BY plate_number HAVING COUNT(*) > 1;
EOF

echo "✅ データ整合性チェック完了"