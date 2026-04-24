#!/usr/bin/env python3
"""
車検期限DB保存・表示の完全修正:
1. vehicleService.ts updateDataPrepared に inspectionExpiry 追加
2. vehicleService.ts mapVehicleToResponseDTO に inspectionExpiry を返す
3. vehicleStore.ts (CMS) Vehicle型に inspectionExpiry 追加
"""
import sys

errors = []

# ============================================================
# 修正1: vehicleService.ts updateDataPrepared に inspectionExpiry 追加
# ============================================================
path1 = 'backend/src/services/vehicleService.ts'
with open(path1, 'r', encoding='utf-8') as f:
    c = f.read()

old1 = """          currentMileage: updateData.currentMileage,
          region:        (updateData as any).region !== undefined
                          ? ((updateData as any).region || null)
                          : undefined,"""

new1 = """          currentMileage: updateData.currentMileage,
          inspectionExpiry: (updateData as any).inspectionExpiry !== undefined
                          ? ((updateData as any).inspectionExpiry ? new Date((updateData as any).inspectionExpiry) : null)
                          : undefined,  // REQ-007: 車検期限
          region:        (updateData as any).region !== undefined
                          ? ((updateData as any).region || null)
                          : undefined,"""

if new1 in c:
    print('[SKIP] vehicleService updateDataPrepared inspectionExpiry — 既に存在')
elif old1 in c:
    c = c.replace(old1, new1, 1)
    print('[OK]   vehicleService updateDataPrepared に inspectionExpiry 追加')
else:
    print('[FAIL] vehicleService updateDataPrepared マッチ失敗')
    errors.append('updateDataPrepared')

# ============================================================
# 修正2: mapVehicleToResponseDTO に inspectionExpiry を返す
# nextMaintenanceDate の行の後に inspectionExpiry を追加
# ============================================================
old2 = "      nextMaintenanceDate: vehicle.inspectionExpiry,"
new2 = "      inspectionExpiry: vehicle.inspectionExpiry,  // REQ-007: 車検期限\n      nextMaintenanceDate: vehicle.inspectionExpiry,"

if 'inspectionExpiry: vehicle.inspectionExpiry,  // REQ-007' in c:
    print('[SKIP] mapVehicleToResponseDTO inspectionExpiry — 既に存在')
elif old2 in c:
    c = c.replace(old2, new2, 1)
    print('[OK]   mapVehicleToResponseDTO に inspectionExpiry 追加')
else:
    print('[FAIL] mapVehicleToResponseDTO nextMaintenanceDate 行が見つかりません')
    errors.append('mapVehicleToResponseDTO')

with open(path1, 'w', encoding='utf-8') as f:
    f.write(c)

# ============================================================
# 修正3: CMS vehicleStore.ts の Vehicle 型に inspectionExpiry 追加
# ============================================================
path2 = 'frontend/cms/src/store/vehicleStore.ts'
with open(path2, 'r', encoding='utf-8') as f:
    c2 = f.read()

# Vehicle型 (interface) に inspectionExpiry を追加
# region フィールドの後に追加
old3 = "  region?: string;\n}"
new3 = "  region?: string;\n  inspectionExpiry?: string;  // REQ-007: 車検期限\n}"

if 'inspectionExpiry?: string;' in c2:
    print('[SKIP] vehicleStore Vehicle型 inspectionExpiry — 既に存在')
elif old3 in c2:
    c2 = c2.replace(old3, new3, 1)
    print('[OK]   vehicleStore Vehicle型に inspectionExpiry 追加')
else:
    # region フィールドを探す別パターン
    import re
    # interface Vehicle の中に region があるか確認
    if 'region?' in c2 and 'interface Vehicle' in c2:
        # interface 終了の } の前に追加
        c2 = re.sub(
            r'(\s+region\?[^\n]*\n)(})',
            r'\1  inspectionExpiry?: string;  // REQ-007: 車検期限\n\2',
            c2, count=1
        )
        if 'inspectionExpiry?' in c2:
            print('[OK]   vehicleStore Vehicle型に inspectionExpiry 追加（regex）')
        else:
            print('[FAIL] vehicleStore Vehicle型の修正失敗')
            errors.append('vehicleStore Vehicle type')
    else:
        print('[FAIL] vehicleStore Vehicle型が見つかりません')
        errors.append('vehicleStore Vehicle type')

with open(path2, 'w', encoding='utf-8') as f:
    f.write(c2)

print()
if errors:
    print(f'失敗: {errors}')
    sys.exit(1)
else:
    print('全修正完了！')
    sys.exit(0)
