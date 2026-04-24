#!/usr/bin/env python3
"""
REQ-004〜007 一括修正スクリプト
REQ-004: LoadingInput 数量デフォルト = 車両積載量
REQ-005: CMS 製造元フィールド Select → Input
REQ-006: CMS モデルフィールド Select → Input
REQ-007: CMS 車検期限フィールド追加 + モバイル車両選択時警告
"""

import re, sys

def apply_patch(path, old, new, label):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        if new.split('\n')[0].strip() in content or (len(new) > 20 and new[:40] in content):
            print(f"[SKIP] {label} — 既に適用済み")
            return True
        print(f"[FAIL] {label} — マッチしません")
        print(f"  探しているテキスト(先頭80文字): {repr(old[:80])}")
        return False
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"[OK]   {label}")
    return True

errors = []

# ============================================================
# REQ-004: operationStore.ts に vehicleCapacity フィールド追加
# ============================================================
STORE_PATH = 'frontend/mobile/src/stores/operationStore.ts'

# 1) OperationState interface に vehicleCapacity 追加
r = apply_patch(
    STORE_PATH,
    '  vehicleId: string | null;\n  vehicleNumber: string | null;\n  vehicleType: string | null;',
    '  vehicleId: string | null;\n  vehicleNumber: string | null;\n  vehicleType: string | null;\n  vehicleCapacity: number | null;  // REQ-004: 車両積載量',
    'REQ-004 OperationState vehicleCapacity フィールド追加'
)
if not r: errors.append('REQ-004 state field')

# 2) setVehicleInfo の info 型に capacity 追加
r = apply_patch(
    STORE_PATH,
    '  setVehicleInfo: (info: {\n    vehicleId: string;\n    vehicleNumber: string;\n    vehicleType: string;\n    startMileage: number;\n  }) => void;',
    '  setVehicleInfo: (info: {\n    vehicleId: string;\n    vehicleNumber: string;\n    vehicleType: string;\n    startMileage: number;\n    capacity?: number;  // REQ-004\n  }) => void;',
    'REQ-004 setVehicleInfo 型定義に capacity 追加'
)
if not r: errors.append('REQ-004 setVehicleInfo type')

# 3) 初期状態に vehicleCapacity: null 追加
r = apply_patch(
    STORE_PATH,
    '      vehicleId: null,\n      vehicleNumber: null,\n      vehicleType: null,\n      driverId: null,',
    '      vehicleId: null,\n      vehicleNumber: null,\n      vehicleType: null,\n      vehicleCapacity: null,  // REQ-004\n      driverId: null,',
    'REQ-004 初期状態 vehicleCapacity: null'
)
if not r: errors.append('REQ-004 initial state')

# 4) setVehicleInfo アクションで capacity を保存
r = apply_patch(
    STORE_PATH,
    "        set({\n          vehicleId: info.vehicleId,\n          vehicleNumber: info.vehicleNumber,\n          vehicleType: info.vehicleType,\n          startMileage: info.startMileage,\n          status: 'IDLE'\n        });",
    "        set({\n          vehicleId: info.vehicleId,\n          vehicleNumber: info.vehicleNumber,\n          vehicleType: info.vehicleType,\n          startMileage: info.startMileage,\n          vehicleCapacity: info.capacity ?? null,  // REQ-004\n          status: 'IDLE'\n        });",
    'REQ-004 setVehicleInfo アクションで vehicleCapacity 保存'
)
if not r: errors.append('REQ-004 action')

# 5) resetOperation に vehicleCapacity: null 追加
r = apply_patch(
    STORE_PATH,
    "          operationId: null,\n          vehicleId: null,\n          vehicleNumber: null,\n          vehicleType: null,\n          driverId: null,",
    "          operationId: null,\n          vehicleId: null,\n          vehicleNumber: null,\n          vehicleType: null,\n          vehicleCapacity: null,  // REQ-004\n          driverId: null,",
    'REQ-004 resetOperation vehicleCapacity リセット'
)
if not r: errors.append('REQ-004 reset')

# 6) partialize に vehicleCapacity 追加（vehicleType の次）
r = apply_patch(
    STORE_PATH,
    '          vehicleType: state.vehicleType,\n          driverId: state.driverId,',
    '          vehicleType: state.vehicleType,\n          vehicleCapacity: state.vehicleCapacity,  // REQ-004\n          driverId: state.driverId,',
    'REQ-004 partialize vehicleCapacity 永続化'
)
if not r: errors.append('REQ-004 partialize')

# ============================================================
# REQ-004: VehicleInfo.tsx — saveVehicleToStore に capacity 渡す
# VehicleDisplay に capacity フィールド追加
# ============================================================
VEHICLE_INFO_PATH = 'frontend/mobile/src/pages/VehicleInfo.tsx'

# VehicleDisplay に capacity 追加
r = apply_patch(
    VEHICLE_INFO_PATH,
    'interface VehicleDisplay {\n  id: string;\n  vehicleNumber: string;  // 表示用(車番)\n  vehicleType: string;\n  currentMileage: number;\n  status: string;          // 🆕 車両ステータス追加 (ACTIVE / MAINTENANCE / INACTIVE / RETIRED)',
    'interface VehicleDisplay {\n  id: string;\n  vehicleNumber: string;  // 表示用(車番)\n  vehicleType: string;\n  currentMileage: number;\n  capacity?: number;       // REQ-004: 積載量\n  status: string;          // 🆕 車両ステータス追加 (ACTIVE / MAINTENANCE / INACTIVE / RETIRED)',
    'REQ-004 VehicleDisplay に capacity フィールド追加'
)
if not r: errors.append('REQ-004 VehicleDisplay')

# fetchVehicles の vehicleList マップに capacity 追加
r = apply_patch(
    VEHICLE_INFO_PATH,
    "            id: v.id,  // ✅ UUID形式のIDをそのまま使用\n            vehicleNumber: v.plateNumber,  // 車番(ナンバープレート)\n            vehicleType: v.vehicleType || v.model || '未設定',  // 🆕 フォールバック追加\n            currentMileage: v.currentMileage,\n            status: v.status,  // 🆕 ステータスをそのまま保持",
    "            id: v.id,  // ✅ UUID形式のIDをそのまま使用\n            vehicleNumber: v.plateNumber,  // 車番(ナンバープレート)\n            vehicleType: v.vehicleType || v.model || '未設定',  // 🆕 フォールバック追加\n            currentMileage: v.currentMileage,\n            capacity: v.capacity ?? v.capacityTons ?? undefined,  // REQ-004\n            status: v.status,  // 🆕 ステータスをそのまま保持",
    'REQ-004 fetchVehicles マップに capacity 追加'
)
if not r: errors.append('REQ-004 fetchVehicles map')

# saveVehicleToStore 呼び出しに capacity 追加
r = apply_patch(
    VEHICLE_INFO_PATH,
    '      saveVehicleToStore({\n        vehicleId: selectedVehicleId,\n        vehicleNumber: vehicleInfo.vehicleNumber,\n        vehicleType: vehicleInfo.vehicleType,\n        startMileage: parseInt(startMileage)\n      });',
    '      saveVehicleToStore({\n        vehicleId: selectedVehicleId,\n        vehicleNumber: vehicleInfo.vehicleNumber,\n        vehicleType: vehicleInfo.vehicleType,\n        startMileage: parseInt(startMileage),\n        capacity: vehicleInfo.capacity,  // REQ-004: 積載量をStoreに保存\n      });',
    'REQ-004 saveVehicleToStore に capacity 追加'
)
if not r: errors.append('REQ-004 saveVehicleToStore call')

# ============================================================
# REQ-007: VehicleInfo.tsx — 車検期限60日以内警告
# handleVehicleChange で vehicleInfo 設定後に警告チェック
# ============================================================

# VehicleDisplay に inspectionExpiry 追加
r = apply_patch(
    VEHICLE_INFO_PATH,
    '  capacity?: number;       // REQ-004: 積載量\n  status: string;          // 🆕 車両ステータス追加 (ACTIVE / MAINTENANCE / INACTIVE / RETIRED)',
    '  capacity?: number;       // REQ-004: 積載量\n  inspectionExpiry?: string; // REQ-007: 車検期限 (ISO date string)\n  status: string;          // 🆕 車両ステータス追加 (ACTIVE / MAINTENANCE / INACTIVE / RETIRED)',
    'REQ-007 VehicleDisplay に inspectionExpiry フィールド追加'
)
if not r: errors.append('REQ-007 VehicleDisplay inspectionExpiry')

# fetchVehicles マップに inspectionExpiry 追加
r = apply_patch(
    VEHICLE_INFO_PATH,
    '            capacity: v.capacity ?? v.capacityTons ?? undefined,  // REQ-004\n            status: v.status,  // 🆕 ステータスをそのまま保持',
    '            capacity: v.capacity ?? v.capacityTons ?? undefined,  // REQ-004\n            inspectionExpiry: v.inspectionExpiry ?? undefined,  // REQ-007\n            status: v.status,  // 🆕 ステータスをそのまま保持',
    'REQ-007 fetchVehicles マップに inspectionExpiry 追加'
)
if not r: errors.append('REQ-007 fetchVehicles inspectionExpiry')

# handleVehicleChange に車検期限警告ロジック追加
r = apply_patch(
    VEHICLE_INFO_PATH,
    '    if (selected) {\n      setVehicleInfo(selected);\n      setStartMileage(selected.currentMileage.toString());\n    } else {',
    '''    if (selected) {
      setVehicleInfo(selected);
      setStartMileage(selected.currentMileage.toString());
      // REQ-007: 車検期限60日以内警告
      if (selected.inspectionExpiry) {
        const expiry = new Date(selected.inspectionExpiry);
        const today = new Date();
        const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          toast.error(`⚠️ この車両は車検が切れています（${expiry.toLocaleDateString('ja-JP')}期限）`, { duration: 8000 });
        } else if (diffDays <= 60) {
          toast(`⚠️ 車検期限まで残り${diffDays}日です（${expiry.toLocaleDateString('ja-JP')}期限）`, {
            duration: 6000,
            icon: '🔔',
          });
        }
      }
    } else {''',
    'REQ-007 handleVehicleChange 車検期限警告'
)
if not r: errors.append('REQ-007 warning logic')

# ============================================================
# REQ-004: LoadingInput.tsx — 数量デフォルト値をStoreのcapacityから
# ============================================================
LOADING_INPUT_PATH = 'frontend/mobile/src/pages/LoadingInput.tsx'

# operationStore から vehicleCapacity を取得
r = apply_patch(
    LOADING_INPUT_PATH,
    '  const operationStore = useOperationStore();',
    '  const operationStore = useOperationStore();\n  const vehicleCapacity = operationStore.vehicleCapacity;  // REQ-004',
    'REQ-004 LoadingInput vehicleCapacity 取得'
)
if not r: errors.append('REQ-004 LoadingInput vehicleCapacity get')

# formData の初期値 quantity を vehicleCapacity で設定
r = apply_patch(
    LOADING_INPUT_PATH,
    '    cargoConfirmed: false,\n    quantity: undefined,',
    '    cargoConfirmed: false,\n    quantity: vehicleCapacity ?? undefined,  // REQ-004: 車両積載量をデフォルト値に',
    'REQ-004 LoadingInput formData quantity デフォルト値'
)
if not r: errors.append('REQ-004 LoadingInput quantity default')

# ============================================================
# REQ-005 & REQ-006: VehicleManagement.tsx
# 新規作成モーダル: 製造元 Select → Input、モデル Select → Input
# ============================================================
CMS_VM_PATH = 'frontend/cms/src/pages/VehicleManagement.tsx'

# --- 新規作成モーダル: モデル Select → Input ---
r = apply_patch(
    CMS_VM_PATH,
    '''          <Select
            label="モデル"
            options={[
              { value: '', label: 'モデルを選択してください' },
              ...vehicleModelOptions,
            ]}
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            error={formErrors.model}
            required
          />

          <Select
            label="製造元"
            options={[
              { value: '', label: '製造元を選択してください' },
              ...manufacturerOptions,
            ]}
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            error={formErrors.manufacturer}
            required
          />''',
    '''          <Input
            label="モデル"
            type="text"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            error={formErrors.model}
            placeholder="例: エルフ、プロフィア、ファイター"
            required
          />

          <Input
            label="製造元"
            type="text"
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            error={formErrors.manufacturer}
            placeholder="例: いすゞ、日野、三菱ふそう"
            required
          />''',
    'REQ-005/006 新規作成モーダル 製造元・モデル Select→Input'
)
if not r: errors.append('REQ-005/006 新規作成モーダル')

# --- 編集モーダル: モデル Select → Input ---
# 編集モーダルは options に初期値なし版（vehicleModelOptions のみ）
r = apply_patch(
    CMS_VM_PATH,
    '''          <Select
            label="モデル"
            options={vehicleModelOptions}
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            error={formErrors.model}
            required
          />

          <Select
            label="製造元"
            options={manufacturerOptions}
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            error={formErrors.manufacturer}
            required
          />''',
    '''          <Input
            label="モデル"
            type="text"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            error={formErrors.model}
            placeholder="例: エルフ、プロフィア、ファイター"
            required
          />

          <Input
            label="製造元"
            type="text"
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            error={formErrors.manufacturer}
            placeholder="例: いすゞ、日野、三菱ふそう"
            required
          />''',
    'REQ-005/006 編集モーダル 製造元・モデル Select→Input'
)
if not r: errors.append('REQ-005/006 編集モーダル')

# ============================================================
# REQ-007: VehicleManagement.tsx
# formData に inspectionExpiry 追加
# 新規/編集モーダルに車検期限 DatePicker 追加
# Vehicle 型に inspectionExpiry 追加
# ============================================================

# formData 型定義 (state) に inspectionExpiry を追加
# resetForm に inspectionExpiry: '' を追加
r = apply_patch(
    CMS_VM_PATH,
    "    notes: '',\n    region: '',  // 🆕 P4-03",
    "    notes: '',\n    inspectionExpiry: '',  // REQ-007: 車検期限\n    region: '',  // 🆕 P4-03",
    'REQ-007 resetForm に inspectionExpiry 追加'
)
if not r: errors.append('REQ-007 resetForm')

# handleEdit に inspectionExpiry 追加
r = apply_patch(
    CMS_VM_PATH,
    "      notes: vehicle.notes || '',\n      region: (vehicle.region as TransportRegion) || '',  // 🆕 P4-03\n    });\n    setCapacityInput(String(vehicle.capacity ?? ''));",
    "      notes: vehicle.notes || '',\n      inspectionExpiry: vehicle.inspectionExpiry ? (typeof vehicle.inspectionExpiry === 'string' ? vehicle.inspectionExpiry.split('T')[0] : new Date(vehicle.inspectionExpiry).toISOString().split('T')[0]) : '',  // REQ-007\n      region: (vehicle.region as TransportRegion) || '',  // 🆕 P4-03\n    });\n    setCapacityInput(String(vehicle.capacity ?? ''));",
    'REQ-007 handleEdit に inspectionExpiry 追加'
)
if not r: errors.append('REQ-007 handleEdit')

# 新規作成モーダルの備考フィールドの前に車検期限を追加（新規作成）
r = apply_patch(
    CMS_VM_PATH,
    '''          <div className="md:col-span-2">
            <Input
              label="備考"
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="備考を入力してください（任意）"
            />
          </div>
        </div>
      </FormModal>

      {/* 編集モーダル */}''',
    '''          <Input
            label="車検期限"
            type="date"
            value={formData.inspectionExpiry}
            onChange={(e) => setFormData({ ...formData, inspectionExpiry: e.target.value })}
            placeholder="車検期限を選択（任意）"
          />

          <div className="md:col-span-2">
            <Input
              label="備考"
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="備考を入力してください（任意）"
            />
          </div>
        </div>
      </FormModal>

      {/* 編集モーダル */}''',
    'REQ-007 新規作成モーダルに車検期限フィールド追加'
)
if not r: errors.append('REQ-007 新規作成モーダル inspectionExpiry')

# 編集モーダルの備考フィールドの前に車検期限を追加
r = apply_patch(
    CMS_VM_PATH,
    '''          <div className="md:col-span-2">
            <Input
              label="備考"
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
      </FormModal>

      {/* 非稼働確認ダイアログ */}''',
    '''          <Input
            label="車検期限"
            type="date"
            value={formData.inspectionExpiry}
            onChange={(e) => setFormData({ ...formData, inspectionExpiry: e.target.value })}
          />

          <div className="md:col-span-2">
            <Input
              label="備考"
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
      </FormModal>

      {/* 非稼働確認ダイアログ */}''',
    'REQ-007 編集モーダルに車検期限フィールド追加'
)
if not r: errors.append('REQ-007 編集モーダル inspectionExpiry')

# handleSubmitCreate payload に inspectionExpiry を含める
r = apply_patch(
    CMS_VM_PATH,
    "    const payload = {\n      ...formData,\n      region: formData.region || null,  // 🆕 P4-03: 空文字を null に変換\n    };\n    const success = await createVehicle(payload);",
    "    const payload = {\n      ...formData,\n      region: formData.region || null,  // 🆕 P4-03: 空文字を null に変換\n      inspectionExpiry: formData.inspectionExpiry || null,  // REQ-007: 空文字を null に変換\n    };\n    const success = await createVehicle(payload);",
    'REQ-007 handleSubmitCreate payload に inspectionExpiry 追加'
)
if not r: errors.append('REQ-007 handleSubmitCreate payload')

# handleSubmitEdit payload に inspectionExpiry を含める
r = apply_patch(
    CMS_VM_PATH,
    "    const payload = {\n      ...formData,\n      region: formData.region || null,  // 🆕 P4-03: 空文字を null に変換\n    };\n    const success = await updateVehicle(selectedVehicleId, payload);",
    "    const payload = {\n      ...formData,\n      region: formData.region || null,  // 🆕 P4-03: 空文字を null に変換\n      inspectionExpiry: formData.inspectionExpiry || null,  // REQ-007: 空文字を null に変換\n    };\n    const success = await updateVehicle(selectedVehicleId, payload);",
    'REQ-007 handleSubmitEdit payload に inspectionExpiry 追加'
)
if not r: errors.append('REQ-007 handleSubmitEdit payload')

# ============================================================
# 結果サマリー
# ============================================================
print('\n===== 修正結果 =====')
if errors:
    print(f'失敗: {len(errors)} 件')
    for e in errors:
        print(f'  - {e}')
    sys.exit(1)
else:
    print('全パッチ適用成功！')
    sys.exit(0)
