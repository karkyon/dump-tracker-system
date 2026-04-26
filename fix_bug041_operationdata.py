#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_bug041_operationdata.py
BUG-041補足: operationService.ts の operationData に startOdometer が含まれていない
"""
import subprocess, sys, os

REPO = os.path.expanduser("~/dump-tracker")

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ Written: {path}")

def patch_operationService():
    """operationService.ts の operationData に startOdometer + customerId 追加"""
    path = f"{REPO}/backend/src/services/operationService.ts"
    content = read(path)

    # 現在のoperationDataパターン（LINE 14前後）
    old = """      const operationData = {
        operationNumber,
        vehicleId: request.vehicleId,
        driverId: request.driverId,
        status: 'IN_PROGRESS' as OperationStatus,
        plannedStartTime: request.plannedStartTime || new Date(),
        actualStartTime: new Date(),
        plannedEndTime: request.plannedEndTime,
        notes: request.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      };"""

    new = """      const operationData = {
        operationNumber,
        vehicleId: request.vehicleId,
        driverId: request.driverId,
        customerId: (request as any).customerId,          // ✅ BUG-041補足: 客先ID
        status: 'IN_PROGRESS' as OperationStatus,
        plannedStartTime: request.plannedStartTime || new Date(),
        actualStartTime: new Date(),
        plannedEndTime: request.plannedEndTime,
        notes: request.notes,
        startOdometer: (request as any).startOdometer,   // ✅ BUG-041補足: startOdometerをDB保存
        createdAt: new Date(),
        updatedAt: new Date()
      };"""

    if "BUG-041補足" in content:
        print("  ⚠️ operationService.ts 既に修正済み — スキップ")
        return True
    if old not in content:
        print("  ❌ operationData パターン未発見")
        # デバッグ用: 近傍コードを表示
        idx = content.find("const operationData = {")
        if idx >= 0:
            print("  📍 近傍コード:")
            print(content[idx:idx+400])
        return False

    content = content.replace(old, new, 1)
    write(path, content)
    print("  ✅ operationService.ts operationData に startOdometer + customerId 追加")
    return True

def patch_operationModel_type():
    """OperationModel.ts StartTripOperationRequest型にstartOdometer追加（未適用確認）"""
    path = f"{REPO}/backend/src/models/OperationModel.ts"
    content = read(path)

    # BUG-041修正が適用されているか確認
    if "startOdometer?: number; // ✅ BUG-041修正" in content:
        print("  ✅ OperationModel.ts 既に修正済み")
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
        # 既に別パターンで修正済みか確認
        if "startOdometer" in content and "StartTripOperationRequest" in content:
            print("  ✅ OperationModel.ts StartTripOperationRequest に startOdometer 既存")
            return True
        print("  ❌ StartTripOperationRequest パターン未発見")
        return False

    content = content.replace(old, new, 1)
    write(path, content)
    print("  ✅ OperationModel.ts StartTripOperationRequest に startOdometer 追加")
    return True

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
        ["git", "commit", "-m", "fix: BUG-041 operationData startOdometer DB save (session13)"],
        cwd=REPO, capture_output=True, text=True
    )
    print(f"  {r.stdout.strip()}")
    r2 = subprocess.run(["git", "push", "origin", "main"], cwd=REPO, capture_output=True, text=True)
    if r2.returncode == 0:
        print("  ✅ Git Push 完了")
    else:
        print(f"  ❌ Push失敗: {r2.stderr}")
    print("\n▶️  次: dt-restart を実行してください")

print("="*60)
print("BUG-041補足: operationService.ts operationData startOdometer追加")
print("="*60)

print("\n[1] operationService.ts — operationData に startOdometer 追加")
ok1 = patch_operationService()
print("\n[2] OperationModel.ts — StartTripOperationRequest startOdometer 確認")
ok2 = patch_operationModel_type()

if ok1 and ok2:
    ok = tsc_check()
    if ok:
        print("\n✅ 全コンパイルOK → Git Push")
        git_push()
    else:
        print("\n❌ コンパイルエラーあり → Push中止")
        sys.exit(1)
else:
    print("\n❌ パッチ適用失敗 → Push中止")
    sys.exit(1)
