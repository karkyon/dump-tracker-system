#!/usr/bin/env bash
# omega-dev (~/projects/dump-tracker) で実行すること
# backend/frontend/cms/frontend/mobile を全てフルコンパイルし、
# 3プロジェクト全てエラー0の場合のみ commit + push する。
set -uo pipefail
cd ~/projects/dump-tracker || { echo "[ERROR] リポジトリルートが見つかりません"; exit 1; }

FAIL=0

echo "=== [1/3] backend: Prismaクライアント再生成 + フルコンパイル ==="
cd backend || exit 1
npx prisma generate --schema=prisma/schema.camel.prisma
./node_modules/.bin/tsc --noEmit
BACKEND_RC=$?
[ $BACKEND_RC -ne 0 ] && FAIL=1
cd ..

echo "=== [2/3] frontend/cms: フルコンパイル ==="
cd frontend/cms || exit 1
./node_modules/.bin/tsc --noEmit
CMS_RC=$?
[ $CMS_RC -ne 0 ] && FAIL=1
cd ../..

echo "=== [3/3] frontend/mobile: フルコンパイル ==="
cd frontend/mobile || exit 1
./node_modules/.bin/tsc --noEmit
MOBILE_RC=$?
[ $MOBILE_RC -ne 0 ] && FAIL=1
cd ../..

echo ""
echo "=== コンパイル結果 ==="
echo "backend       : $([ $BACKEND_RC -eq 0 ] && echo 'OK(0件)' || echo 'エラーあり')"
echo "frontend/cms  : $([ $CMS_RC -eq 0 ]     && echo 'OK(0件)' || echo 'エラーあり')"
echo "frontend/mobile: $([ $MOBILE_RC -eq 0 ] && echo 'OK(0件)' || echo 'エラーあり')"

if [ $FAIL -ne 0 ]; then
  echo ""
  echo "[STOP] エラーが残っているため commit/push は実行しません。上記ログを確認してください。"
  exit 1
fi

echo ""
echo "=== 全プロジェクトでエラー0を確認。commit + push を実行します ==="
git add -A
git commit -m "fix: 日報タイムラインの積込/荷降ペアリング修正、明細ごとの客先切替反映、帳票出力の車両フィルタ(運行なし車両選択可)バグ修正"
git push origin main
echo "[DONE] push完了"
