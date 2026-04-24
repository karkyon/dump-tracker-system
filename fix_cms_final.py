#!/usr/bin/env python3
"""
VehicleManagement.tsx 残存エラー3件を修正:
1. resetForm の setFormData に inspectionExpiry がない
2. handleSubmitCreate の inspectionExpiry: null → undefined
3. handleSubmitEdit の inspectionExpiry: null → undefined
"""
import sys

path = 'frontend/cms/src/pages/VehicleManagement.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

errors = []

# --- 修正1: resetForm の setFormData に inspectionExpiry 追加 ---
# fuelType: 'DIESEL' のリテラル型なし版（resetForm内）
targets1 = [
    # パターンA: inspectionExpiry なし、region あり
    (
        "      notes: '',\n      region: '',  // 🆕 P4-03\n    });\n    setFormErrors({});",
        "      notes: '',\n      inspectionExpiry: '',  // REQ-007\n      region: '',  // 🆕 P4-03\n    });\n    setFormErrors({});"
    ),
]
fixed1 = False
# 既に存在チェック
if "      inspectionExpiry: '',  // REQ-007\n      region: '',  // 🆕 P4-03\n    });\n    setFormErrors({});" in content:
    print('[SKIP] resetForm inspectionExpiry — 既に存在')
    fixed1 = True
else:
    for old, new in targets1:
        if old in content:
            content = content.replace(old, new, 1)
            print('[OK]   resetForm に inspectionExpiry 追加')
            fixed1 = True
            break
    if not fixed1:
        print('[FAIL] resetForm の対象行が見つかりません')
        errors.append('resetForm')

# --- 修正2: handleSubmitCreate inspectionExpiry: null → undefined ---
old2 = "      inspectionExpiry: formData.inspectionExpiry || null,  // REQ-007: 空文字を null に変換\n    };\n    const success = await createVehicle(payload);"
new2 = "      inspectionExpiry: formData.inspectionExpiry || undefined,  // REQ-007: 空文字を undefined に変換\n    };\n    const success = await createVehicle(payload);"

if "createVehicle" in content and "undefined" in content and "inspectionExpiry: formData.inspectionExpiry || undefined" in content:
    # createVehicle 側が既に undefined
    pass

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('[OK]   handleSubmitCreate inspectionExpiry null→undefined')
elif new2 in content:
    print('[SKIP] handleSubmitCreate — 既に undefined')
else:
    print('[FAIL] handleSubmitCreate の inspectionExpiry 行が見つかりません')
    errors.append('handleSubmitCreate')

# --- 修正3: handleSubmitEdit inspectionExpiry: null → undefined ---
old3 = "      inspectionExpiry: formData.inspectionExpiry || null,  // REQ-007: 空文字を null に変換\n    };\n    const success = await updateVehicle(selectedVehicleId, payload);"
new3 = "      inspectionExpiry: formData.inspectionExpiry || undefined,  // REQ-007: 空文字を undefined に変換\n    };\n    const success = await updateVehicle(selectedVehicleId, payload);"

if old3 in content:
    content = content.replace(old3, new3, 1)
    print('[OK]   handleSubmitEdit inspectionExpiry null→undefined')
elif new3 in content:
    print('[SKIP] handleSubmitEdit — 既に undefined')
else:
    print('[FAIL] handleSubmitEdit の inspectionExpiry 行が見つかりません')
    errors.append('handleSubmitEdit')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print()
if errors:
    print(f'失敗: {errors}')
    sys.exit(1)
else:
    print('全修正完了！')
    sys.exit(0)
