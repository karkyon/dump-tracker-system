#!/usr/bin/env python3
path = 'frontend/mobile/src/pages/VehicleInfo.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """interface VehicleData {
  id: string;  // UUID形式
  plateNumber: string;
  vehicleType: string;
  model: string;
  manufacturer: string;
  currentMileage: number;
  status: string;
  notes?: string;
}"""

new = """interface VehicleData {
  id: string;  // UUID形式
  plateNumber: string;
  vehicleType: string;
  model: string;
  manufacturer: string;
  currentMileage: number;
  capacity?: number;         // REQ-004: 積載量
  capacityTons?: number;     // REQ-004: 積載量(別名)
  inspectionExpiry?: string; // REQ-007: 車検期限
  status: string;
  notes?: string;
}"""

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('[OK] VehicleData に capacity/capacityTons/inspectionExpiry 追加')
else:
    print('[FAIL] マッチしません — VehicleData インターフェースを確認してください')
