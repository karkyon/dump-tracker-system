#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_bug039_040_041_gps_critical.py
BUG-039: OperationRecord.tsx — handleOperationEnd で stopTracking 未呼出
BUG-040: useGPS.ts — stopTracking 内に stopGPSInterval() 未呼出
BUG-041: operationService.ts / OperationModel.ts — startOdometer が DB に保存されない
"""

import subprocess, sys, os, re

REPO = os.path.expanduser("~/dump-tracker")

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ Written: {path}")

# ============================================================
# BUG-040: useGPS.ts — stopTracking に stopGPSInterval() 追加
# ============================================================
def patch_bug040():
    print("\n[BUG-040] useGPS.ts — stopTracking に stopGPSInterval() 追加")
    path = f"{REPO}/frontend/mobile/src/hooks/useGPS.ts"
    content = read(path)

    old = "  const stopTracking = useCallback(() => {\n    if (watchIdRef.current !== null) {"
    new = "  const stopTracking = useCallback(() => {\n    // ✅ BUG-040修正: setIntervalも確実に停止する\n    stopGPSInterval();\n    if (watchIdRef.current !== null) {"

    if "BUG-040修正" in content:
        print("  ⚠️ 既に修正済み — スキップ")
        return True
    if old not in content:
        print("  ❌ パターン未発見")
        return False
    content = content.replace(old, new, 1)
    write(path, content)
    print("  ✅ stopTracking に stopGPSInterval() 追加完了")
    return True

# ============================================================
# BUG-039: OperationRecord.tsx — stopTracking 取得 + 呼出
# ============================================================
def patch_bug039():
    print("\n[BUG-039] OperationRecord.tsx — handleOperationEnd に stopTracking 追加")
    path = f"{REPO}/frontend/mobile/src/pages/OperationRecord.tsx"
    content = read(path)

    # 1. destructuring に stopTracking 追加
    old_dest = """  const {
    currentPosition,
    isTracking,
    startTracking,
    heading,
    speed: _gpsSpeed,
    totalDistance,
    updateOptions: updateGPSOptions
  } = useGPS({"""
    new_dest = """  const {
    currentPosition,
    isTracking,
    startTracking,
    stopTracking,    // ✅ BUG-039修正: GPS停止用
    heading,
    speed: _gpsSpeed,
    totalDistance,
    updateOptions: updateGPSOptions
  } = useGPS({"""

    if "BUG-039修正" in content:
        print("  ⚠️ 既に修正済み — スキップ")
        return True

    if old_dest not in content:
        print("  ❌ useGPS destructuring パターン未発見")
        return False
    content = content.replace(old_dest, new_dest, 1)
    print("  ✅ stopTracking destructuring 追加")

    # 2. handleOperationEnd で stopTracking() 呼出
    old_end = """  const handleOperationEnd = () => {
    if (!window.confirm('降車時点検を実施します。よろしいですか?')) {
      return;
    }
    // 降車時点検画面に遷移
    navigate('/post-trip-inspection');
  };"""
    new_end = """  const handleOperationEnd = () => {
    if (!window.confirm('降車時点検を実施します。よろしいですか?')) {
      return;
    }
    // ✅ BUG-039修正: 降車時点検に遷移する前にGPS追跡を完全停止
    // stopTracking()内でstopGPSInterval()+clearWatch()+isTrackingRef=false が実行される
    stopTracking();
    console.log('🛑 [BUG-039] 運行終了前GPS追跡停止完了');
    // 降車時点検画面に遷移
    navigate('/post-trip-inspection');
  };"""

    if old_end not in content:
        print("  ❌ handleOperationEnd パターン未発見")
        return False
    content = content.replace(old_end, new_end, 1)
    write(path, content)
    print("  ✅ handleOperationEnd に stopTracking() 追加完了")
    return True

# ============================================================
# BUG-041: operationService.ts — StartOperationRequest型 + startTrip に startOdometer追加
# ============================================================
def patch_bug041_operationService():
    print("\n[BUG-041-A] operationService.ts — StartOperationRequest型 + startTrip startOdometer追加")
    path = f"{REPO}/backend/src/services/operationService.ts"
    content = read(path)

    if "BUG-041" in content:
        print("  ⚠️ 既に修正済み — スキップ")
        return True

    # 1. StartOperationRequest型にstartOdometer追加
    old_type = """export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  notes?: string;
}"""
    new_type = """export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  notes?: string;
  startOdometer?: number;  // ✅ BUG-041修正: startOdometerをDB保存するため追加
  customerId?: string;     // ✅ BUG-041修正: customerId型定義追加
}"""

    if old_type not in content:
        print("  ❌ StartOperationRequest型 パターン未発見")
        return False
    content = content.replace(old_type, new_type, 1)
    print("  ✅ StartOperationRequest に startOdometer 追加")

    # 2. startTrip内のprisma.operation.createにstartOdometerを追加
    # operationService.ts のstartTripは超詳細ログ版のため、prisma.operationをgrepして確認
    # create(operationData) を呼ぶ部分を特定
    # OperationCreateInput経由でcreate()を呼んでいるため、startTripRequestからマッピングする
    
    # startTrip内でoperationService(this)のcreate()を呼ぶ部分を探す
    # 実際の処理はoperationService.startTripで直接prisma.operation.createをしていない
    # → this.prisma.operation.create({data: { ... }}) を呼ぶ部分へstartOdometer追加
    
    # superDetailedログ版なのでprisma.operation.createを探す
    old_create = """      const operation = await this.prisma.operation.create({
        data: {
          vehicleId: request.vehicleId,
          driverId: request.driverId,
          status: 'IN_PROGRESS',
          plannedStartTime: request.plannedStartTime || new Date(),
          actualStartTime: new Date(),"""
    
    if old_create in content:
        new_create = """      const operation = await this.prisma.operation.create({
        data: {
          vehicleId: request.vehicleId,
          driverId: request.driverId,
          customerId: (request as any).customerId,   // ✅ BUG-041修正
          status: 'IN_PROGRESS',
          plannedStartTime: request.plannedStartTime || new Date(),
          actualStartTime: new Date(),
          startOdometer: request.startOdometer,     // ✅ BUG-041修正: startOdometerをDB保存"""
        content = content.replace(old_create, new_create, 1)
        print("  ✅ operationService.startTrip prisma.create に startOdometer 追加")
    else:
        # 別パターンで探す（超詳細ログ版の場合）
        # operationNumberを使ったcreateパターン
        old_create2 = """        const operationData: any = {
          operationNumber:"""
        if old_create2 in content:
            # operationDataオブジェクトにstartOdometerを追加するパターン
            old_notes = "          notes: request.notes,\n          createdAt: new Date(),\n          updatedAt: new Date()"
            new_notes = "          notes: request.notes,\n          startOdometer: request.startOdometer,  // ✅ BUG-041修正\n          customerId: (request as any).customerId,  // ✅ BUG-041修正\n          createdAt: new Date(),\n          updatedAt: new Date()"
            if old_notes in content:
                content = content.replace(old_notes, new_notes, 1)
                print("  ✅ operationData に startOdometer 追加")
            else:
                print("  ⚠️ prisma.create パターン特定できず — 手動確認要")
        else:
            print("  ⚠️ create パターン特定できず — 手動確認要")

    write(path, content)
    return True

# ============================================================
# BUG-041: OperationModel.ts — StartTripOperationRequest型にstartOdometer追加
# ============================================================
def patch_bug041_operationModel():
    print("\n[BUG-041-B] OperationModel.ts — StartTripOperationRequest型にstartOdometer追加")
    path = f"{REPO}/backend/src/models/OperationModel.ts"
    content = read(path)

    if "BUG-041" in content:
        print("  ⚠️ 既に修正済み — スキップ")
        return True

    old = """export interface StartTripOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  expectedDistance?: number;
  plannedRoute?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
  customerId?: string;  // 🆕 客先ID
}"""
    new = """export interface StartTripOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  expectedDistance?: number;
  plannedRoute?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
  customerId?: string;    // 🆕 客先ID
  startOdometer?: number; // ✅ BUG-041修正: startOdometerをDB保存するため追加
}"""

    if old not in content:
        print("  ❌ StartTripOperationRequest パターン未発見")
        return False
    content = content.replace(old, new, 1)

    # OperationModel.ts の startTrip operationData にも startOdometer を追加
    old_opdata = """      const operationData = {
        operationNumber: operationNumber,  // ✅ 修正: 生成した運行番号を明示的に指定
        vehicleId: request.vehicleId,      // ✅ 修正: 直接IDを指定
        driverId: request.driverId,        // ✅ 修正: 直接IDを指定
        status: 'IN_PROGRESS' as const,
        plannedStartTime: request.plannedStartTime || new Date(),
        actualStartTime: new Date(),       // ✅ 追加: 実際の開始時刻を設定
        plannedEndTime: request.plannedEndTime,
        notes: request.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      };"""
    new_opdata = """      const operationData = {
        operationNumber: operationNumber,  // ✅ 修正: 生成した運行番号を明示的に指定
        vehicleId: request.vehicleId,      // ✅ 修正: 直接IDを指定
        driverId: request.driverId,        // ✅ 修正: 直接IDを指定
        customerId: request.customerId,    // ✅ BUG-041修正: 客先ID
        status: 'IN_PROGRESS' as const,
        plannedStartTime: request.plannedStartTime || new Date(),
        actualStartTime: new Date(),       // ✅ 追加: 実際の開始時刻を設定
        plannedEndTime: request.plannedEndTime,
        notes: request.notes,
        startOdometer: request.startOdometer, // ✅ BUG-041修正: startOdometerをDB保存
        createdAt: new Date(),
        updatedAt: new Date()
      };"""

    if old_opdata not in content:
        print("  ⚠️ operationData パターン未発見 — StartTripOperationRequest型のみ修正")
    else:
        content = content.replace(old_opdata, new_opdata, 1)
        print("  ✅ operationData に startOdometer + customerId 追加")

    write(path, content)
    print("  ✅ OperationModel.ts 修正完了")
    return True

# ============================================================
# コンパイルチェック
# ============================================================
def tsc_check():
    print("\n" + "="*60)
    print("コンパイルチェック")
    print("="*60)
    all_ok = True
    for name, cwd in [
        ("Backend",  f"{REPO}/backend"),
        ("Mobile",   f"{REPO}/frontend/mobile"),
        ("CMS",      f"{REPO}/frontend/cms"),
    ]:
        r = subprocess.run(["npx", "tsc", "--noEmit"], cwd=cwd, capture_output=True, text=True)
        ok = r.returncode == 0
        if not ok: all_ok = False
        mark = "✅" if ok else "❌"
        print(f"  {mark} {name} TSC: {'0エラー' if ok else 'エラーあり'}")
        if not ok:
            for line in (r.stdout + r.stderr).strip().splitlines()[:8]:
                print(f"    {line}")
    return all_ok

def git_push():
    subprocess.run(["git", "add", "-A"], cwd=REPO)
    r = subprocess.run(
        ["git", "commit", "-m", "fix: BUG-039/040/041 GPS stop + startOdometer DB save (session13)"],
        cwd=REPO, capture_output=True, text=True
    )
    print(f"  {r.stdout.strip()}")
    r2 = subprocess.run(["git", "push", "origin", "main"], cwd=REPO, capture_output=True, text=True)
    if r2.returncode == 0:
        print("  ✅ Git Push 完了")
    else:
        print(f"  ❌ Push失敗: {r2.stderr}")
    print("\n▶️  次: dt-restart を実行してください")

# ============================================================
# メイン
# ============================================================
print("="*60)
print("BUG-039/040/041 GPS停止漏れ + startOdometer DB保存修正")
print("="*60)

ok40 = patch_bug040()
ok39 = patch_bug039()
ok41a = patch_bug041_operationService()
ok41b = patch_bug041_operationModel()

if ok39 and ok40 and ok41a and ok41b:
    ok = tsc_check()
    if ok:
        print("\n✅ 全コンパイルOK → Git Push")
        git_push()
    else:
        print("\n❌ コンパイルエラーあり → Push中止。エラー内容を確認してください")
        sys.exit(1)
else:
    print("\n❌ パッチ適用に失敗した項目があります")
    sys.exit(1)
