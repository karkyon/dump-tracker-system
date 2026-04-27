#!/usr/bin/env python3
"""
根本修正:
operationService.ts の StartOperationRequest型に customerId/startOdometer を追加し
startTrip内の (request as any) キャストを削除して型安全に修正
"""
import subprocess, sys, os

BASE = os.path.expanduser("~/dump-tracker")
SVC  = f"{BASE}/backend/src/services/operationService.ts"

def read(p):
    with open(p,"r",encoding="utf-8") as f: return f.read()
def write(p,c):
    with open(p,"w",encoding="utf-8") as f: f.write(c)
    print(f"  ✅ Written: {p}")
def tsc(label, cwd):
    r = subprocess.run(["npx","tsc","--noEmit","-p","tsconfig.json"],
                       cwd=cwd, capture_output=True, text=True)
    errs = (r.stdout+r.stderr).strip()
    if r.returncode == 0: print(f"  ✅ {label} TSC: 0エラー"); return True
    print(f"  ❌ {label} TSC:")
    for l in errs.splitlines()[:20]: print(f"    {l}")
    return False

content = read(SVC)

# ── [1] StartOperationRequest型にcustomerId/startOdometer確認・追加 ──
old_req_type = """export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  notes?: string;
  startOdometer?: number;  // ✅ BUG-041修正: startOdometerをDB保存するため追加
  customerId?: string;     // ✅ BUG-041修正: customerId型定義追加
}"""

if 'startOdometer?: number;' in content and 'customerId?: string;' in content:
    print("  ✅ [1] StartOperationRequest型 既にcustomerId/startOdometer定義済み")
else:
    # 型定義に追加
    old_type_without = """export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  notes?: string;
}"""
    new_type_with = """export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  notes?: string;
  startOdometer?: number;  // 客先ID保存
  customerId?: string;     // 開始走行距離保存
}"""
    if old_type_without in content:
        content = content.replace(old_type_without, new_type_with)
        print("  ✅ [1] StartOperationRequest型にcustomerId/startOdometer追加")
    else:
        print("  ⚠️  [1] StartOperationRequest型パターン未発見（既存の可能性）")

# ── [2] startTrip内の (request as any) を request に変更 ──
# customerId
old_cast_customer = "        customerId: (request as any).customerId,          // ✅ BUG-041補足: 客先ID"
new_cast_customer = "        customerId: request.customerId,          // 客先ID"
if old_cast_customer in content:
    content = content.replace(old_cast_customer, new_cast_customer)
    print("  ✅ [2a] customerId の (request as any) キャスト除去")
else:
    # 別パターン
    old_cast2 = "        customerId: (request as any).customerId,"
    new_cast2  = "        customerId: request.customerId,"
    if old_cast2 in content:
        content = content.replace(old_cast2, new_cast2)
        print("  ✅ [2a] customerId キャスト除去（代替パターン）")
    else:
        print("  ⚠️  [2a] customerId キャストパターン未発見")

# startOdometer
old_cast_odo = "        startOdometer: (request as any).startOdometer,   // ✅ BUG-041補足: startOdometerをDB保存"
new_cast_odo = "        startOdometer: request.startOdometer,   // 開始走行距離"
if old_cast_odo in content:
    content = content.replace(old_cast_odo, new_cast_odo)
    print("  ✅ [2b] startOdometer の (request as any) キャスト除去")
else:
    old_cast_odo2 = "        startOdometer: (request as any).startOdometer,"
    new_cast_odo2  = "        startOdometer: request.startOdometer,"
    if old_cast_odo2 in content:
        content = content.replace(old_cast_odo2, new_cast_odo2)
        print("  ✅ [2b] startOdometer キャスト除去（代替パターン）")
    else:
        print("  ⚠️  [2b] startOdometer キャストパターン未発見")

# ── [3] startTrip内に customerId/startOdometer のデバッグログ追加 ──
old_op_data_log = "      logger.info('✅ [LINE 15] 運行データ準備完了', { operationData });"
new_op_data_log = """      logger.info('✅ [LINE 15] 運行データ準備完了', {
        operationData,
        customerId: request.customerId ?? 'UNDEFINED',
        startOdometer: request.startOdometer ?? 'UNDEFINED',
      });"""
if old_op_data_log in content and 'customerId: request.customerId ?? ' not in content:
    content = content.replace(old_op_data_log, new_op_data_log)
    print("  ✅ [3] 運行データデバッグログ追加")
else:
    print("  ⚠️  [3] デバッグログ既存またはパターン未発見")

write(SVC, content)

# reportService.ts の loadingDuration フォールバック修正も確認
RSVC = f"{BASE}/backend/src/services/reportService.ts"
rcontent = read(RSVC)

old_loading_dur = "       loadingDuration: calcTimeDuration(c.loadingStartTime, c.loadingEndTime),     // NEW(D)"
new_loading_dur = "       loadingDuration: calcTimeDuration(c.loadingStartTime, c.loadingEndTime || c.unloadingStartTime),  // fix: 積込終了なければ積降開始で代替"
if old_loading_dur in rcontent:
    rcontent = rcontent.replace(old_loading_dur, new_loading_dur)
    write(RSVC, rcontent)
    print("  ✅ [4] reportService loadingDuration フォールバック修正")
elif 'c.loadingEndTime || c.unloadingStartTime' in rcontent:
    print("  ⚠️  [4] loadingDuration フォールバック既存スキップ")
else:
    print("  ⚠️  [4] loadingDuration パターン未発見")

print("\n" + "="*60)
b = tsc("Backend", f"{BASE}/backend")
m = tsc("Mobile",  f"{BASE}/frontend/mobile")
c = tsc("CMS",     f"{BASE}/frontend/cms")

if b and m and c:
    cmds = [
        ["git","add","-A"],
        ["git","commit","-m","fix: remove (as any) cast in startTrip - customerId/startOdometer now saved to DB correctly (session15)"],
        ["git","push","origin","main"],
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
        out = (r.stdout+r.stderr).strip()
        if r.returncode != 0:
            print(f"  ❌ {' '.join(cmd[:3])}: {out}"); sys.exit(1)
        print(f"  ✅ {' '.join(cmd[:3])}")
        if out: print(f"    {out}")
    print("\n✅ Push完了")
    print("▶️  dt-restart必要")
    print("▶️  新規運行を記録してから日報生成すると業者名・キロ始が正しく表示されます")
else:
    print("\n❌ コンパイルエラー → Push中止")
    sys.exit(1)
