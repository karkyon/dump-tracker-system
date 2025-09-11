#!/bin/bash
# =====================================
# DB→Prisma自動反映コマンド
# 現在のDB構成をPrismaスキーマに自動反映
# =====================================

echo "🔄 DB構成をPrismaスキーマに自動反映中..."

# 作業ディレクトリ確認・移動
cd "$(dirname "$0")"
if [ -d "backend" ]; then
    cd backend
fi

# 環境確認
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ prisma/schema.prisma が見つかりません"
    exit 1
fi

# 【ステップ1】現在のスキーマをバックアップ
echo "📋 現在のPrismaスキーマをバックアップ中..."
cp prisma/schema.prisma "prisma/schema.prisma.backup.$(date +%Y%m%d_%H%M%S)"

# 【ステップ2】DB構成を自動取得してPrismaスキーマを更新
echo "🔍 データベースから構成を取得中..."
npx prisma db pull

if [ $? -eq 0 ]; then
    echo "✅ DB構成の取得成功"
else
    echo "❌ DB構成の取得失敗"
    echo "バックアップからスキーマを復元中..."
    cp prisma/schema.prisma.backup.* prisma/schema.prisma
    exit 1
fi

# 【ステップ3】スキーマの検証
echo "🔍 更新されたスキーマを検証中..."
npx prisma validate

if [ $? -eq 0 ]; then
    echo "✅ スキーマ検証成功"
else
    echo "❌ スキーマ検証失敗"
    echo "バックアップからスキーマを復元中..."
    cp prisma/schema.prisma.backup.* prisma/schema.prisma
    exit 1
fi

# 【ステップ4】Prismaクライアント再生成
echo "🔧 Prismaクライアントを再生成中..."
npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prismaクライアント再生成成功"
else
    echo "❌ Prismaクライアント再生成失敗"
    exit 1
fi

# 【ステップ5】変更内容の確認
echo "📊 変更内容を確認中..."
echo "=== 変更前後の差分 ==="
if command -v diff > /dev/null; then
    diff -u prisma/schema.prisma.backup.* prisma/schema.prisma || true
fi

# 【ステップ6】テーブル一覧表示
echo ""
echo "🗃️ 現在のテーブル構成:"
psql $DATABASE_URL -c "
SELECT 
    table_name as テーブル名,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as カラム数
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
"

# 【ステップ7】拡張フィールド確認
echo ""
echo "🆕 拡張フィールド確認:"
echo "--- itemsテーブル新規フィールド ---"
psql $DATABASE_URL -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'items' 
    AND table_schema = 'public'
    AND column_name IN (
        'standard_volume', 'hazardous_class', 'handling_instructions',
        'storage_requirements', 'temperature_range', 'is_fragile',
        'is_hazardous', 'requires_special_equipment', 'display_order',
        'photo_urls', 'specification_file_url', 'msds_file_url'
    )
ORDER BY column_name;
"

echo "--- locationsテーブル新規フィールド ---"
psql $DATABASE_URL -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'locations' 
    AND table_schema = 'public'
    AND column_name IN (
        'hazardous_area', 'access_restrictions', 'parking_instructions',
        'unloading_instructions', 'equipment_available', 'photo_urls'
    )
ORDER BY column_name;
"

echo ""
echo "🎉 DB→Prisma自動反映完了！"
echo ""
echo "📝 実行結果:"
echo "  ✅ 現在のDB構成がPrismaスキーマに反映されました"
echo "  ✅ バックアップファイル: prisma/schema.prisma.backup.*"
echo "  ✅ Prismaクライアントが再生成されました"
echo ""
echo "🔧 次のステップ:"
echo "  1. アプリケーションを再起動して動作確認"
echo "  2. 新しい拡張フィールドを使用するコードの実装"
echo "  3. TypeScript型定義の更新（必要に応じて）"