#!/usr/bin/env python3
"""
車両パターン保存バグ修正
原因: vehicleService.ts の updateVehicle で Prisma updateDataPrepared に
     loadingPattern / unloadingPattern が含まれていないため DB に反映されない
修正: updateDataPrepared に両フィールドを追加
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
# Fix: vehicleService.ts updateVehicle の updateDataPrepared に
#      loadingPattern / unloadingPattern を追加
# ============================================================
SERVICE = f'{BASE}/backend/src/services/vehicleService.ts'

patch(
    SERVICE,
    '''          region:        (updateData as any).region !== undefined
                          ?''',
    '''          // 🆕 オペレーションパターン（DBカラム: loading_pattern / unloading_pattern）
          loadingPattern:   (updateData as any).loadingPattern !== undefined
                          ? Number((updateData as any).loadingPattern)
                          : undefined,
          unloadingPattern: (updateData as any).unloadingPattern !== undefined
                          ? Number((updateData as any).unloadingPattern)
                          : undefined,
          region:        (updateData as any).region !== undefined
                          ?''',
    'vehicleService: updateVehicle に loadingPattern/unloadingPattern 追加'
)

# vehicleService.ts の createVehicle にも追加（新規登録時）
patch(
    SERVICE,
    '''          notes: vehicleData.notes,
          region: (vehicleData as any).region ?? null,
        };''',
    '''          notes: vehicleData.notes,
          region: (vehicleData as any).region ?? null,
          // 🆕 オペレーションパターン
          loadingPattern:   (vehicleData as any).loadingPattern !== undefined
                          ? Number((vehicleData as any).loadingPattern)
                          : 2,
          unloadingPattern: (vehicleData as any).unloadingPattern !== undefined
                          ? Number((vehicleData as any).unloadingPattern)
                          : 2,
        };''',
    'vehicleService: createVehicle に loadingPattern/unloadingPattern 追加'
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
run('git commit -m "fix: vehicleService updateVehicle/createVehicle に loadingPattern/unloadingPattern 追加\n\nCMSで変更したパターンがDBに保存されなかったバグを修正"')
rc = run('git push origin main')
if rc == 0:
    print('\n✅✅✅ Push完了！CI/CDが起動します。')
else:
    print('\n❌ Push失敗')

os.remove(__file__)
print('🗑️  スクリプト自己削除完了')
