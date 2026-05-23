#!/bin/bash
# BUG-025修正: SQLスクリプトの冪等チェック
# コメント行(--で始まる行)を除外してキーワード判定することで
# コメント内キーワードによる誤判定を防ぐ
#
# 旧実装（誤判定発生）:
#   grep -E "(ALTER TYPE|ADD COLUMN|CREATE TABLE)" "$file"
#
# 修正後（コメント行除外）:
#   grep -v "^\s*--" "$file" | grep -E "(ALTER TYPE|ADD COLUMN|CREATE TABLE)"

set -e

check_file() {
  local file="$1"
  # コメント行(-- ...)と空行を除外した上でキーワードチェック
  local hits
  hits=$(grep -v "^[[:space:]]*--" "$file" \
         | grep -v "^[[:space:]]*#" \
         | grep -v "^[[:space:]]*$" \
         | grep -cE "(ALTER TYPE|ADD COLUMN|CREATE TABLE|DROP COLUMN)" || true)
  echo "$hits"
}

TARGET_DIR="${1:-.}"
echo "=== 冪等チェック開始: $TARGET_DIR ==="

found=0
for sql_file in "$TARGET_DIR"/**/*.sql "$TARGET_DIR"/*.sql; do
  [ -f "$sql_file" ] || continue
  count=$(check_file "$sql_file")
  if [ "$count" -gt 0 ]; then
    echo "[WARN] $sql_file: 非冪等キーワード $count 件検出"
    found=$((found + 1))
  fi
done

if [ "$found" -eq 0 ]; then
  echo "=== OK: 非冪等キーワードなし ==="
fi
exit 0
