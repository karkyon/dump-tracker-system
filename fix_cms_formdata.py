#!/usr/bin/env python3
"""
VehicleManagement.tsx の2つの問題を修正:
1. formData state に inspectionExpiry フィールド追加
2. vehicleModelOptions 未使用変数を削除
"""
import sys

path = 'frontend/cms/src/pages/VehicleManagement.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

errors = []

# --- 修正1: formData state に inspectionExpiry を追加 ---
# region の直前に挿入（notes の次の行）
old1 = "    notes: '',\n    region: '' as TransportRegion | '',  // 🆕 P4-03"
new1 = "    notes: '',\n    inspectionExpiry: '',  // REQ-007: 車検期限\n    region: '' as TransportRegion | '',  // 🆕 P4-03"

if "inspectionExpiry: ''," in content and old1.replace("    notes: '',\n", "") in content:
    # inspectionExpiry が state に既にある → スキップ
    print('[SKIP] formData inspectionExpiry — 既に存在')
elif old1 in content:
    content = content.replace(old1, new1, 1)
    print('[OK]   formData に inspectionExpiry 追加')
else:
    print('[FAIL] formData の region 行が見つかりません')
    errors.append('formData inspectionExpiry')

# --- 修正2: vehicleModelOptions 未使用変数を削除 ---
old2 = """  // 車種のオプション
  const vehicleModelOptions = [
    { value: 'エルフ', label: 'エルフ (いすゞ)' },
    { value: 'プロフィア', label: 'プロフィア (日野)' },
    { value: 'ファイター', label: 'ファイター (三菱ふそう)' },
    { value: 'デュトロ', label: 'デュトロ (日野)' },
    { value: 'GIGA', label: 'GIGA (いすゞ)' },
  ];

  // 製造元のオプション"""
new2 = """  // REQ-005/006: Select→Input化により vehicleModelOptions は削除済み
  // 製造元のオプション（検索フィルター用）"""

if 'vehicleModelOptions' not in content:
    print('[SKIP] vehicleModelOptions — 既に削除済み')
elif old2 in content:
    content = content.replace(old2, new2, 1)
    print('[OK]   vehicleModelOptions 削除')
else:
    # 別パターンで試行
    import re
    content = re.sub(
        r'  // 車種のオプション\n  const vehicleModelOptions = \[.*?\];\n\n  // 製造元のオプション',
        '  // REQ-005/006: vehicleModelOptions削除済み\n  // 製造元のオプション（検索フィルター用）',
        content, flags=re.DOTALL
    )
    if 'vehicleModelOptions' not in content:
        print('[OK]   vehicleModelOptions 削除（regex）')
    else:
        print('[FAIL] vehicleModelOptions 削除失敗')
        errors.append('vehicleModelOptions')

# --- 修正3: resetForm に inspectionExpiry を追加 ---
old3 = "      notes: '',\n      region: '',  // 🆕 P4-03\n    });\n    setFormErrors({});"
new3 = "      notes: '',\n      inspectionExpiry: '',  // REQ-007\n      region: '',  // 🆕 P4-03\n    });\n    setFormErrors({});"

if "inspectionExpiry: ''," in content and "setFormErrors" in content:
    print('[SKIP] resetForm inspectionExpiry — 既に存在')
elif old3 in content:
    content = content.replace(old3, new3, 1)
    print('[OK]   resetForm に inspectionExpiry 追加')
else:
    print('[FAIL] resetForm の region 行が見つかりません')
    errors.append('resetForm inspectionExpiry')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print()
if errors:
    print(f'失敗: {errors}')
    sys.exit(1)
else:
    print('全修正完了！')
    sys.exit(0)
