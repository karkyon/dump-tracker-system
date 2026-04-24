#!/usr/bin/env python3
"""
2点修正:
1. vehicleService.ts updateVehicle に inspectionExpiry を追加 (車検期限保存)
2. VehicleManagement.tsx 「製造元」ラベルを「メーカー」に変更 (REQ-005 UI修正)
"""
import sys

errors = []

# ============================================================
# 修正1: backend vehicleService.ts に inspectionExpiry 追加
# ============================================================
path1 = 'backend/src/services/vehicleService.ts'
with open(path1, 'r', encoding='utf-8') as f:
    content1 = f.read()

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

if old1 in content1:
    content1 = content1.replace(old1, new1, 1)
    with open(path1, 'w', encoding='utf-8') as f:
        f.write(content1)
    print('[OK]   vehicleService.ts updateDataPrepared に inspectionExpiry 追加')
elif 'inspectionExpiry' in content1 and 'updateData' in content1:
    # 既に追加済みか確認
    if '(updateData as any).inspectionExpiry' in content1:
        print('[SKIP] vehicleService.ts inspectionExpiry — 既に存在')
    else:
        print('[FAIL] vehicleService.ts — マッチしません')
        errors.append('vehicleService inspectionExpiry')
else:
    print('[FAIL] vehicleService.ts — マッチしません')
    errors.append('vehicleService inspectionExpiry')

# ============================================================
# 修正2: VehicleManagement.tsx 「製造元」→「メーカー」ラベル変更
# ============================================================
path2 = 'frontend/cms/src/pages/VehicleManagement.tsx'
with open(path2, 'r', encoding='utf-8') as f:
    content2 = f.read()

# 新規作成モーダルの製造元ラベル
content2 = content2.replace(
    'label="製造元"\n            type="text"\n            value={formData.manufacturer}\n            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}\n            error={formErrors.manufacturer}\n            placeholder="例: いすゞ、日野、三菱ふそう"\n            required\n          />\n\n          <Input\n            label="年式"',
    'label="メーカー"\n            type="text"\n            value={formData.manufacturer}\n            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}\n            error={formErrors.manufacturer}\n            placeholder="例: いすゞ、日野、三菱ふそう"\n            required\n          />\n\n          <Input\n            label="年式"',
)

# カウントで確認
manufacturer_label_count = content2.count('label="製造元"')
maker_label_count = content2.count('label="メーカー"')

if maker_label_count >= 2:
    print('[SKIP] メーカーラベル — 既に変更済み')
elif maker_label_count >= 1:
    # 残り1つ（編集モーダル）も変換
    content2 = content2.replace('label="製造元"', 'label="メーカー"')
    print('[OK]   全「製造元」ラベルを「メーカー」に変更')
elif manufacturer_label_count == 0 and maker_label_count == 0:
    print('[FAIL] 製造元/メーカーラベルが見つかりません')
    errors.append('manufacturer label')
else:
    content2 = content2.replace('label="製造元"', 'label="メーカー"')
    print('[OK]   「製造元」ラベルを「メーカー」に変更')

with open(path2, 'w', encoding='utf-8') as f:
    f.write(content2)

print()
if errors:
    print(f'失敗: {errors}')
    sys.exit(1)
else:
    print('全修正完了！')
    sys.exit(0)
