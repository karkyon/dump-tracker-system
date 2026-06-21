#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GPSMonitoring.tsx 修正パッチ
- 地図/車両一覧エリアの高さを750px固定化（現状はmin-height可変）
- 車両一覧の表示順をステータス別に固定ソート

実行方法（omega-dev上、リポジトリルートで実行）:
  cd ~/projects/dump-tracker
  python3 patch_gps_monitoring_height_sort.py

成功条件: backend / frontend/cms / frontend/mobile の3プロジェクトすべてが
tsc --noEmit でコンパイルエラー0件の場合のみ、自動で git push する。
失敗時はファイル変更は残すが push は行わない。
本スクリプトは実行後（成功・失敗いずれも）自己削除する。
"""

import subprocess
import sys
import os

REPO_ROOT = os.getcwd()
TARGET_FILE = os.path.join(REPO_ROOT, "frontend", "cms", "src", "pages", "GPSMonitoring.tsx")

PATCHES = []

# --- パッチ1: 外側コンテナの高さを750px固定 ---
PATCHES.append((
    """      {/* メインコンテンツ: 地図(広く) + 右側車両一覧 */}
      <div className="flex gap-4" style={{ minHeight: '600px' }}>""",
    """      {/* メインコンテンツ: 地図(広く) + 右側車両一覧 */}
      <div className="flex gap-4" style={{ height: '750px' }}>"""
))

# --- パッチ2: 地図エリア内側のmin-heightを撤去（外側固定高にflex-1で追従させる） ---
PATCHES.append((
    """            <div className="relative rounded-lg overflow-hidden flex-1" style={{ minHeight: '550px' }}>
              <div ref={mapRef} className="w-full h-full bg-gray-100" style={{ minHeight: '550px' }} />""",
    """            <div className="relative rounded-lg overflow-hidden flex-1">
              <div ref={mapRef} className="w-full h-full bg-gray-100" />"""
))

# --- パッチ3: 車両一覧のソート順を固定化 ---
PATCHES.append((
    """  // =====================================
  // フィルタリング & 集計
  // =====================================

  const filteredVehicles = vehicles.filter(vehicle => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      vehicle.vehicleNumber.toLowerCase().includes(q) ||
      vehicle.driverName.toLowerCase().includes(q) ||
      vehicle.currentAddress.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || vehicle.status === statusFilter;
    return matchesSearch && matchesStatus;
  });""",
    """  // =====================================
  // フィルタリング & 集計
  // =====================================

  // 表示順: 運行中 → 運行中(オフライン) → 積込中 → 荷降中 → 休憩中 → 給油中 → オフライン
  const STATUS_SORT_ORDER: Record<VehicleLocation['status'], number> = {
    in_operation: 0,
    in_op_offline: 1,
    loading: 2,
    unloading: 3,
    break: 4,
    refueling: 5,
    offline: 6,
  };

  const filteredVehicles = vehicles
    .filter(vehicle => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        vehicle.vehicleNumber.toLowerCase().includes(q) ||
        vehicle.driverName.toLowerCase().includes(q) ||
        vehicle.currentAddress.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || vehicle.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99));"""
))


def fail(msg: str):
    print(f"❌ {msg}")
    self_delete()
    sys.exit(1)


def apply_patches():
    if not os.path.isfile(TARGET_FILE):
        fail(f"対象ファイルが見つかりません: {TARGET_FILE}")

    with open(TARGET_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    for i, (old, new) in enumerate(PATCHES, start=1):
        count = content.count(old)
        if count == 0:
            fail(f"パッチ{i}: アンカー文字列が見つかりません。ファイルが想定と異なる可能性があります。修正を中断しました。")
        if count > 1:
            fail(f"パッチ{i}: アンカー文字列が複数箇所にマッチしました（{count}件）。一意になるよう確認してください。")
        content = content.replace(old, new)

    with open(TARGET_FILE, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"✅ {len(PATCHES)}件のパッチを適用しました: {TARGET_FILE}")


def run_tsc(subdir: str) -> int:
    path = os.path.join(REPO_ROOT, subdir)
    tsc_bin = os.path.join(path, "node_modules", ".bin", "tsc")
    if not os.path.isfile(tsc_bin):
        fail(f"tsc が見つかりません: {tsc_bin}")
    print(f"🔎 コンパイルチェック中: {subdir} ...")
    result = subprocess.run(
        [tsc_bin, "--noEmit"],
        cwd=path,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"--- {subdir} コンパイルエラー ---")
        print(result.stdout)
        print(result.stderr)
    return result.returncode


def self_delete():
    try:
        os.remove(__file__)
        print(f"🧹 パッチスクリプトを自己削除しました: {__file__}")
    except Exception as e:
        print(f"⚠️ 自己削除に失敗しました（手動削除してください）: {e}")


def main():
    apply_patches()

    targets = ["backend", "frontend/cms", "frontend/mobile"]
    rc_total = 0
    for t in targets:
        rc = run_tsc(t)
        print(f"  → {t}: RC={rc}")
        rc_total += rc

    if rc_total != 0:
        print("❌ コンパイルエラーが残っているため push を中止しました。")
        print("   ファイルへの修正は適用済みです。エラー内容を確認し再修正してください。")
        self_delete()
        sys.exit(1)

    print("✅ 全プロジェクト（backend / frontend/cms / frontend/mobile）でコンパイルエラー0件を確認しました。")

    commit_msg = "fix(GPSMonitoring): 地図/車両一覧の高さを750px固定化し、車両一覧の表示順をステータス別に固定"

    subprocess.run(["git", "add", "-A"], cwd=REPO_ROOT, check=True)
    commit = subprocess.run(["git", "commit", "-m", commit_msg], cwd=REPO_ROOT, capture_output=True, text=True)
    print(commit.stdout)
    print(commit.stderr)

    push = subprocess.run(["git", "push"], cwd=REPO_ROOT, capture_output=True, text=True)
    print(push.stdout)
    print(push.stderr)

    if push.returncode != 0:
        print("❌ git push に失敗しました。手動で確認してください（コミット自体は作成済みです）。")
        self_delete()
        sys.exit(1)

    print("🚀 GitHubへのpushが完了しました。")
    self_delete()


if __name__ == "__main__":
    main()
