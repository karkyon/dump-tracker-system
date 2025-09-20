#!/bin/bash

echo "=== Dump Tracker Backend - Prisma問題解決スクリプト ==="

echo "1. 現在の状況確認..."
echo "スキーマファイルの検索:"
find . -name "*.prisma" -type f

echo ""
echo "2. prismaディレクトリの内容:"
ls -la prisma/ 2>/dev/null || echo "prismaディレクトリが存在しません"

echo ""
echo "3. 現在のPrismaクライアントの型確認:"
grep -c "AuditLog\|auditLog" node_modules/.prisma/client/index.d.ts 2>/dev/null || echo "AuditLog型が見つかりません"

echo ""
echo "4. package.jsonのprisma設定確認:"
grep -A 5 -B 1 "prisma" package.json 2>/dev/null || echo "prisma設定が見つかりません"

echo ""
echo "=== 推奨対処法 ==="
echo "A. schema.camel.prismaが見つかった場合:"
echo "   cp [見つかったパス] prisma/schema.prisma"
echo "   npx prisma generate"

echo ""
echo "B. スキーマファイルが見つからない場合:"
echo "   代替実装のAuditLogModelを使用してください"

echo ""
echo "C. 既存のschema.prismaを使用する場合:"
echo "   npx prisma generate"
echo "   grep -n 'AuditLog\\|auditLog' node_modules/.prisma/client/index.d.ts"