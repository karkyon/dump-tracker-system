#!/bin/bash
# =====================================================================
# 7/5〜7/7 (JST) の運行履歴を production(dump_tracker_prod) から
# staging(dump_tracker_staging) へインポートするスクリプト
#
# 【重要】
# - 「本番 → ステージング」への一方向コピーです。ステージング以外
#   (特に本番)を上書き先に絶対にしないでください。
# - COPY自体はON CONFLICTを扱えないため、各テーブルとも
#   「ステージング側の作業用スキーマにCOPY → INSERT ... ON CONFLICT
#   DO NOTHING で本テーブルへ差分反映」という冪等な方式にしています。
#   何度実行しても同じIDの行は重複挿入されません。
# - 依存関係の都合上、先にマスタ系テーブル(users/vehicles/customers/
#   locations/items)を同期し、その後に対象期間の operations と
#   その子テーブルをコピーします。
#
# 【接続情報】環境に合わせて書き換えてください（.pgpass推奨、平文PW埋め込み非推奨）
# =====================================================================
set -euo pipefail

# --- 本番DB接続情報 (source) ---
PROD_HOST="${PROD_HOST:-127.0.0.1}"
PROD_PORT="${PROD_PORT:-5432}"
PROD_DB="${PROD_DB:-dump_tracker_prod}"
PROD_USER="${PROD_USER:-karkyon_dump}"

# --- ステージングDB接続情報 (target) ---
STG_HOST="${STG_HOST:-127.0.0.1}"
STG_PORT="${STG_PORT:-5432}"
STG_DB="${STG_DB:-dump_tracker_staging}"
STG_USER="${STG_USER:-karkyon_dump}"

# --- 対象期間 (JST 7/5 00:00:00 〜 7/8 00:00:00 = 7/5,6,7を含む) ---
RANGE_START="2026-07-05 00:00:00+09"
RANGE_END="2026-07-08 00:00:00+09"

PROD_CONN=(-h "${PROD_HOST}" -p "${PROD_PORT}" -d "${PROD_DB}" -U "${PROD_USER}")
STG_CONN=(-h "${STG_HOST}" -p "${STG_PORT}" -d "${STG_DB}" -U "${STG_USER}")

# operations 抽出条件（reportServiceの日付判定ロジックと同一の優先順位）
# 1. actual_start_time があればそれで判定
# 2. 無ければ planned_start_time
# 3. どちらも無ければ actual_end_time
OPERATIONS_WHERE="
  (actual_start_time IS NOT NULL
    AND actual_start_time >= '${RANGE_START}'::timestamptz
    AND actual_start_time <  '${RANGE_END}'::timestamptz)
  OR
  (actual_start_time IS NULL AND planned_start_time IS NOT NULL
    AND planned_start_time >= '${RANGE_START}'::timestamptz
    AND planned_start_time <  '${RANGE_END}'::timestamptz)
  OR
  (actual_start_time IS NULL AND planned_start_time IS NULL
    AND actual_end_time IS NOT NULL
    AND actual_end_time >= '${RANGE_START}'::timestamptz
    AND actual_end_time <  '${RANGE_END}'::timestamptz)
"

psql "${STG_CONN[@]}" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS _import_staging;"

# 汎用: 「本番の任意SELECT結果」を「ステージングの指定テーブルへ
# 冪等コピー(ON CONFLICT DO NOTHING)」する関数。
# ステージング側の永続スキーマ(_import_staging)を作業領域として使うため、
# 複数回のpsql起動をまたいでも問題なく動作する。
copy_idempotent() {
  local select_sql="$1"    # 本番側で実行するSELECT文（列順はテーブル定義順であること）
  local target_table="$2"  # ステージング側のコピー先テーブル名
  local landing="_import_staging.landing_${target_table}"

  echo "--- ${target_table} ---"
  psql "${STG_CONN[@]}" -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS ${landing};"
  psql "${STG_CONN[@]}" -v ON_ERROR_STOP=1 -c "CREATE TABLE ${landing} (LIKE ${target_table} INCLUDING ALL);"

  psql "${PROD_CONN[@]}" -v ON_ERROR_STOP=1 -c "\\copy (${select_sql}) TO STDOUT" \
    | psql "${STG_CONN[@]}" -v ON_ERROR_STOP=1 -c "\\copy ${landing} FROM STDIN"

  psql "${STG_CONN[@]}" -v ON_ERROR_STOP=1 -c \
    "INSERT INTO ${target_table} SELECT * FROM ${landing} ON CONFLICT DO NOTHING;"
  psql "${STG_CONN[@]}" -v ON_ERROR_STOP=1 -c "DROP TABLE ${landing};"
}

echo "======================================================"
echo " 1) マスタ系テーブルの同期 (全件・冪等)"
echo "======================================================"
copy_idempotent "SELECT * FROM users"     "users"
copy_idempotent "SELECT * FROM vehicles"  "vehicles"
copy_idempotent "SELECT * FROM customers" "customers"
copy_idempotent "SELECT * FROM locations" "locations"
copy_idempotent "SELECT * FROM items"     "items"

echo "======================================================"
echo " 2) 対象期間(7/5-7/7 JST)の operations をコピー"
echo "======================================================"
copy_idempotent "SELECT * FROM operations WHERE ${OPERATIONS_WHERE}" "operations"

echo "======================================================"
echo " 3) 対象 operations にぶら下がる子テーブルをコピー"
echo "======================================================"
OP_ID_SUBQUERY="(SELECT id FROM operations WHERE ${OPERATIONS_WHERE})"

copy_idempotent \
  "SELECT * FROM operation_details WHERE operation_id IN ${OP_ID_SUBQUERY}" \
  "operation_details"

copy_idempotent \
  "SELECT odi.* FROM operation_detail_items odi
     JOIN operation_details od ON od.id = odi.operation_detail_id
    WHERE od.operation_id IN ${OP_ID_SUBQUERY}" \
  "operation_detail_items"

copy_idempotent \
  "SELECT * FROM gps_logs WHERE operation_id IN ${OP_ID_SUBQUERY}" \
  "gps_logs"

copy_idempotent \
  "SELECT * FROM inspection_records WHERE operation_id IN ${OP_ID_SUBQUERY}" \
  "inspection_records"

copy_idempotent \
  "SELECT iir.* FROM inspection_item_results iir
     JOIN inspection_records ir ON ir.id = iir.inspection_record_id
    WHERE ir.operation_id IN ${OP_ID_SUBQUERY}" \
  "inspection_item_results"

copy_idempotent \
  "SELECT * FROM accident_records WHERE operation_id IN ${OP_ID_SUBQUERY}" \
  "accident_records" || true

psql "${STG_CONN[@]}" -c "DROP SCHEMA IF EXISTS _import_staging CASCADE;"

echo "======================================================"
echo " ✅ インポート完了 (7/5-7/7 JST 分の運行履歴をステージングへ反映)"
echo "======================================================"
