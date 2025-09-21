# 最終修正：src/index.ts の25行目のみ変更

cd ~/dump-tracker/backend

# バックアップ作成
cp src/index.ts src/index.ts.before_final_fix_$(date +%Y%m%d_%H%M%S)

# 25行目のscriptSrcを修正（'unsafe-inline'を追加）
sed -i '25s/scriptSrc: \['\''self'\''\]/scriptSrc: ["'\''self'\''", "'\''unsafe-inline'\''"]/' src/index.ts

# 修正結果確認
echo "=== 修正後のCSP設定確認 ==="
sed -n '20,30p' src/index.ts

echo ""
echo "=== 修正完了 ==="
echo "変更内容："
echo "修正前: scriptSrc: [\"'self'\"]"
echo "修正後: scriptSrc: [\"'self'\", \"'unsafe-inline'\"]"
echo ""
echo "次のステップ："
echo "1. npm run dev でサーバー再起動"
echo "2. http://10.1.119.244:8000/docs でSwagger UI確認"