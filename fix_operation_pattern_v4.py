#!/usr/bin/env python3
"""
最終コンパイルエラー修正 v4
問題: api.ts の StartUnloadingRequest.latitude/longitude が number（必須）
     handleUnloadingStart で currentPosition?.coords.latitude を渡すと number|undefined になる
解決: api.ts の StartUnloadingRequest.latitude/longitude を optional (number?) に変更
"""
import os, sys, subprocess

BASE = '/home/karkyon/projects/dump-tracker'

def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def patch(path, old, new, label):
    content = read(path)
    if old not in content:
        print(f'  ⚠️  SKIP [{label}] アンカーが見つかりません')
        return False
    write(path, content.replace(old, new, 1))
    print(f'  ✅ [{label}]')
    return True

# ============================================================
# Fix: api.ts の StartUnloadingRequest の latitude/longitude を optional に変更
# バックエンド(backend/src/types/trip.ts)は既に optional なので整合性も取れる
# ============================================================
API_TS = f'{BASE}/frontend/mobile/src/services/api.ts'

patch(
    API_TS,
    '''/**
 * 🆕 積降開始リクエスト
 */
export interface StartUnloadingRequest {
  locationId: string;        // 積降場所ID
  latitude: number;          // GPS緯度
  longitude: number;         // GPS経度
  accuracy?: number;         // GPS測位精度（メートル）
  startTime?: Date | string; // 開始時刻（省略時は現在時刻）
  notes?: string;            // メモ（オプション）
}''',
    '''/**
 * 🆕 積降開始リクエスト
 */
export interface StartUnloadingRequest {
  locationId: string;        // 積降場所ID
  latitude?: number;         // GPS緯度（オプション）
  longitude?: number;        // GPS経度（オプション）
  accuracy?: number;         // GPS測位精度（メートル）
  startTime?: Date | string; // 開始時刻（省略時は現在時刻）
  notes?: string;            // メモ（オプション）
}''',
    'api.ts: StartUnloadingRequest latitude/longitude を optional に変更'
)

# ============================================================
# コンパイル確認 → Push
# ============================================================
print('\n修正完了。コンパイル確認を実行します...')

errors = 0
for proj in ['backend', 'frontend/cms', 'frontend/mobile']:
    print(f'\n==== TSC: {proj} ====')
    r = subprocess.run(
        './node_modules/.bin/tsc --noEmit',
        shell=True, cwd=f'{BASE}/{proj}',
        capture_output=True, text=True
    )
    if r.stdout: print(r.stdout[-3000:])
    if r.stderr: print(r.stderr[-500:])
    if r.returncode != 0:
        errors += 1
        print(f'  ❌ コンパイルエラー: {proj}')
    else:
        print(f'  ✅ コンパイルOK: {proj}')

if errors > 0:
    print(f'\n❌ {errors}件のコンパイルエラー → Push中止')
    sys.exit(1)

print('\n==== Git commit & push ====')
def run(cmd):
    r = subprocess.run(cmd, shell=True, cwd=BASE, capture_output=True, text=True)
    if r.stdout: print(r.stdout[-2000:])
    if r.stderr: print(r.stderr[-500:], file=sys.stderr)
    return r.returncode

run('git add -A')
run('''git commit -m "feat: 車両別オペレーションパターン設定機能追加 (P1/P2/P3 + U1/U2/U3)

- vehiclesテーブルにloading_pattern/unloading_pattern追加
- モバイル: 車両選択時にパターンをStoreに保存
- OperationRecord: パターン別ボタン表示分岐
- LoadingInput: P3で即TO_UNLOADING(S=E同時記録)
- UNLOADING_IN_PROGRESSフェーズ追加(U1専用)
- CMS: 車両管理フォームにパターン選択追加
- api.ts: StartUnloadingRequest latitude/longitude をoptionalに修正"''')
rc = run('git push origin main')
if rc == 0:
    print('\n✅✅✅ Push完了！CI/CDが起動します。')
else:
    print('\n❌ Push失敗')

os.remove(__file__)
print('🗑️  スクリプト自己削除完了')
