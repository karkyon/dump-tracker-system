#!/usr/bin/env python3
"""
根本原因修正: mapVehicleToResponseDTO に loadingPattern/unloadingPattern 追加
DBに保存されてもAPIレスポンスに含まれないため編集フォームに反映されなかった
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
# Fix: vehicleService.ts mapVehicleToResponseDTO に
#      loadingPattern / unloadingPattern を追加
# ============================================================
SERVICE = f'{BASE}/backend/src/services/vehicleService.ts'

patch(
    SERVICE,
    '''      region: vehicle.region ?? null,
      inspectionExpiry: vehicle.inspectionExpiry,  // REQ-007: 車検期限
      nextMaintenanceDate: vehicle.inspectionExpiry,
      maintenanceStatus: this.getMaintenanceStatus(vehicle)
    };
  }''',
    '''      region: vehicle.region ?? null,
      inspectionExpiry: vehicle.inspectionExpiry,  // REQ-007: 車検期限
      nextMaintenanceDate: vehicle.inspectionExpiry,
      maintenanceStatus: this.getMaintenanceStatus(vehicle),
      // 🆕 オペレーションパターン（DBから直接返す）
      loadingPattern: vehicle.loadingPattern ?? 2,
      unloadingPattern: vehicle.unloadingPattern ?? 2,
    };
  }''',
    'vehicleService: mapVehicleToResponseDTO に loadingPattern/unloadingPattern 追加'
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
run('git commit -m "fix: mapVehicleToResponseDTO に loadingPattern/unloadingPattern 追加\n\nDBに保存済みでもAPIレスポンスに含まれず編集フォームに反映されなかったバグを修正"')
rc = run('git push origin main')
if rc == 0:
    print('\n✅✅✅ Push完了！')
else:
    print('\n❌ Push失敗')

os.remove(__file__)
print('🗑️  スクリプト自己削除完了')
