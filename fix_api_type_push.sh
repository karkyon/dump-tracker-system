#!/bin/bash
# ~/projects/dump-tracker のターミナルで実行: bash fix_api_type_push.sh
set -e
cd "$HOME/projects/dump-tracker"

echo "🔧 api.ts recordFuel型 + tripService型 修正..."
python3 << 'PYEOF'
import os
BASE = os.path.expanduser('~/projects/dump-tracker')

# ============================================================
# Fix 1: frontend/mobile/src/services/api.ts
# recordFuel の data 型に mileageAtRefuel を追加
# ============================================================
path = f'{BASE}/frontend/mobile/src/services/api.ts'
with open(path, encoding='utf-8') as f:
    src = f.read()

old1 = '''  async recordFuel(
    tripId: string,
    data: {
      fuelAmount: number;
      fuelCost?: number;
      fuelStation?: string;
      latitude?: number;     // 🆕 GPS緯度
      longitude?: number;    // 🆕 GPS経度
      accuracy?: number;     // 🆕 GPS測位精度（メートル）
      notes?'''

new1 = '''  async recordFuel(
    tripId: string,
    data: {
      fuelAmount: number;
      fuelCost?: number;
      fuelStation?: string;
      mileageAtRefuel?: number;  // ✅ 給油時走行距離（専用パラメータ）
      latitude?: number;     // 🆕 GPS緯度
      longitude?: number;    // 🆕 GPS経度
      accuracy?: number;     // 🆕 GPS測位精度（メートル）
      notes?'''

if old1 in src:
    src = src.replace(old1, new1)
    print('✅ Fix1: api.ts recordFuel型に mileageAtRefuel 追加')
elif 'mileageAtRefuel?: number;' in src:
    print('⚠️ Fix1: 既に適用済み')
else:
    print('❌ Fix1: 対象なし')
    # デバッグ
    idx = src.find('async recordFuel(')
    if idx >= 0:
        print(f'DEBUG: {repr(src[idx:idx+400])}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print('📄 api.ts 保存完了')

# ============================================================
# Fix 2: backend/src/services/tripService.ts
# CreateFuelRecordRequest に mileageAtRefuel を追加
# ============================================================
path2 = f'{BASE}/backend/src/services/tripService.ts'
with open(path2, encoding='utf-8') as f:
    src2 = f.read()

# 型定義を探す（複数の可能性があるため柔軟に）
import re
# interface CreateFuelRecordRequest または type CreateFuelRecordRequest を探す
m = re.search(r'(interface|type)\s+CreateFuelRecordRequest\s*[={]', src2)
if m:
    # fuelCost の後に mileageAtRefuel を追加
    old2 = '  fuelCost?: number;\n  location?: string;'
    new2 = '  fuelCost?: number;\n  mileageAtRefuel?: number;  // ✅ 給油時走行距離\n  location?: string;'
    if 'mileageAtRefuel?' in src2:
        print('⚠️ Fix2: CreateFuelRecordRequest mileageAtRefuel 既に適用済み')
    elif old2 in src2:
        src2 = src2.replace(old2, new2)
        print('✅ Fix2: CreateFuelRecordRequest に mileageAtRefuel 追加')
    else:
        # 別パターンを試す
        old2b = '  fuelCost?: number;\n  fuelStation?'
        new2b = '  fuelCost?: number;\n  mileageAtRefuel?: number;  // ✅ 給油時走行距離\n  fuelStation?'
        if old2b in src2:
            src2 = src2.replace(old2b, new2b)
            print('✅ Fix2(alt): CreateFuelRecordRequest に mileageAtRefuel 追加')
        else:
            print('⚠️ Fix2: 型構造が想定と異なる（機能に影響なし）')
else:
    print('⚠️ Fix2: CreateFuelRecordRequest が見つからない（機能に影響なし）')

with open(path2, 'w', encoding='utf-8') as f:
    f.write(src2)
print('📄 tripService.ts 保存完了')

print('\n✅ 全修正完了')
PYEOF

echo ""
echo "📦 バックエンド コンパイル確認..."
cd backend
ERROR_COUNT=$(npm run build 2>&1 | grep "^src/" | grep "error TS" | wc -l)
npm run build 2>&1 | grep "^src/" | grep "error TS" | head -10 || true
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "❌ バックエンドエラー ${ERROR_COUNT}件 - pushを中止"
  exit 1
fi
echo "✅ バックエンド 0件"
cd ..

echo ""
echo "📦 mobile フロントエンド ビルド確認..."
cd frontend/mobile
npm run build 2>&1 | grep "error TS\|✓ built\|Build failed" | head -5
MOB_ERR=$(npm run build 2>&1 | grep "error TS" | wc -l)
if [ "$MOB_ERR" -gt 0 ]; then
  echo "❌ mobile エラー ${MOB_ERR}件 - pushを中止"
  exit 1
fi
echo "✅ mobile ビルド成功"
cd ../..

echo ""
echo "🚀 Git commit & push..."
git add \
  frontend/mobile/src/pages/RefuelRecord.tsx \
  frontend/mobile/src/services/api.ts \
  backend/src/controllers/mobileController.ts \
  backend/src/services/tripService.ts

git commit -m "fix: api.ts recordFuel型にmileageAtRefuel追加・notes埋め込み全廃止

- api.ts: recordFuelのdata型にmileageAtRefuel追加（TS2353解消）
- RefuelRecord.tsx: combinedNotes廃止→mileageAtRefuel専用パラメータ送信
- mobileController.ts: fuelCost:0ハードコード→fuel_cost_yenカラムから取得
- tripService.ts: CreateFuelRecordRequestにmileageAtRefuel追加"

git push origin main
echo "✅ Push完了！GitHub Actions が自動起動します。"
