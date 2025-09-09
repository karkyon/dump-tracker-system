#!/bin/bash
# ERD生成スクリプト（postgresql-autodoc使用）

set -euo pipefail

DB_NAME="dump_tracker_dev"
DB_USER="dump_tracker_user"
DB_PASSWORD="development_password"
OUTPUT_DIR="$HOME/dump-tracker/docs/database"

echo "📊 ERD生成を開始..."

# postgresql-autodoc の確認
if ! command -v postgresql_autodoc >/dev/null 2>&1; then
    echo "⚠️ postgresql-autodoc がインストールされていません"
    echo "インストール方法:"
    echo "  sudo apt install postgresql-autodoc"
    echo "  # または"
    echo "  sudo yum install postgresql-autodoc"
    exit 1
fi

# ERD生成
PGPASSWORD="$DB_PASSWORD" postgresql_autodoc \
    -d "$DB_NAME" \
    -u "$DB_USER" \
    -h localhost \
    --file "$OUTPUT_DIR/dump_tracker_erd" \
    --type=html,dot

echo "✅ ERD生成完了"
echo "📄 HTML形式: $OUTPUT_DIR/dump_tracker_erd.html"
echo "🎨 DOT形式: $OUTPUT_DIR/dump_tracker_erd.dot"

# Graphviz でPNG生成（オプション）
if command -v dot >/dev/null 2>&1; then
    dot -Tpng "$OUTPUT_DIR/dump_tracker_erd.dot" -o "$OUTPUT_DIR/dump_tracker_erd.png"
    echo "🖼️ PNG形式: $OUTPUT_DIR/dump_tracker_erd.png"
fi
