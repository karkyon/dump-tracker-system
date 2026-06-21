#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_map_feature_v4.py
=====================================
運行記録マップ機能 3点修正

① 表記修正: LocationManagement.tsx の「荷」表記を「降」に統一
   （積込/荷降実績列の表示が「積0 荷1」となっていたのを「積0 降1」に修正）

② リスト幅拡大: LocationManagement.tsx の「積込/荷降実績」列の幅を
   230px → 320px に拡大（3行が詰まって見えていた問題を解消）

③ 実績表示の検索フィルタ修正（最重要）: getLocationsMapSummary の search が
   「場所名 OR 客先名（operationDetails経由）」のOR条件になっていたため、
   "エヌエス日進" のような客先名が偶然他の場所でも取引履歴があると、
   無関係な場所まで大量にヒットしてしまっていた。
   ユーザーが期待する動作（「場所・客先名で検索」の実態としては「場所名で絞る」）
   に合わせて、search は location.name のみで判定するように変更する。

完了後:
  - backend / frontend/cms / frontend/mobile の3パッケージで tsc --noEmit を実行
  - 全て RC=0 の場合のみ git add/commit/push を実行
  - 本スクリプト自身を自動削除
=====================================
"""
import subprocess
import sys
import os

ROOT = os.path.expanduser("~/projects/dump-tracker")


def patch(filepath, old, new, label):
    full = os.path.join(ROOT, filepath)
    if not os.path.exists(full):
        print(f"❌ [{label}] ファイルが存在しません: {full}")
        sys.exit(1)
    with open(full, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(old)
    if count == 0:
        print(f"❌ [{label}] 置換対象が見つかりません: {filepath}")
        sys.exit(1)
    if count > 1:
        print(f"❌ [{label}] 置換対象が複数({count}件)見つかりました。一意になるよう調整してください: {filepath}")
        sys.exit(1)
    content = content.replace(old, new)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ [{label}] パッチ適用完了: {filepath}")


def run(cmd, cwd=None, label=""):
    print(f"\n▶ 実行: {cmd} (cwd={cwd or ROOT})")
    result = subprocess.run(
        cmd, shell=True, cwd=cwd or ROOT,
        capture_output=True, text=True
    )
    print(result.stdout[-4500:] if result.stdout else "")
    if result.returncode != 0:
        print(f"❌ [{label}] 失敗 (RC={result.returncode})")
        print(result.stderr[-4500:] if result.stderr else "")
    else:
        print(f"✅ [{label}] 成功 (RC=0)")
    return result.returncode


# =====================================================================
# ③ Backend: search を場所名のみに限定（最重要）
# =====================================================================

CTRL_OLD = """      // ✅ 修正: address は検索対象から除外（地名の偶然一致による過剰ヒットを防止）。
      //    場所名 または その場所で実際に使われた客先名（operationDetails経由）で検索する。
      if (search) {
        locationWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { operationDetails: { some: { operations: { customer: { name: { contains: search, mode: 'insensitive' } } } } } }
        ];
      }"""

CTRL_NEW = """      // ✅ 修正: search は場所名（location.name）のみで判定する。
      //    address や客先名（operationDetails経由）まで対象にすると、
      //    検索語と無関係な場所が大量にヒットしてしまうため（例:「エヌエス日進」という
      //    客先が他の現場でも取引していると、その現場まで表示されてしまう）。
      //    「場所・客先名で検索」という入力欄の見た目通り、場所名で絞り込む動作に統一する。
      if (search) {
        locationWhere.name = { contains: search, mode: 'insensitive' };
      }"""


# =====================================================================
# ①② Frontend: LocationManagement.tsx の表記修正・幅拡大
# =====================================================================

LM_OLD = """    {
      key: 'usageStats',
      header: '積込/荷降実績',
      width: '230px',
      render: (_value: string, row: any) => {
        const stats = usageStatsMap[row.id];
        if (usageStatsLoading && !stats) {
          return <span className="text-xs text-gray-400">読込中...</span>;
        }
        if (!stats) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        const Cell = ({ label, s }: { label: string; s: UsageStat }) => (
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-gray-500 w-9">{label}</span>
            <span className="font-bold text-blue-700">積{s.loading}</span>
            <span className="font-bold text-red-700">荷{s.unloading}</span>
          </div>
        );
        return (
          <div className="space-y-0.5">
            <Cell label="30日" s={stats.last30Days} />
            <Cell label="90日" s={stats.last90Days} />
            <Cell label="1年" s={stats.last365Days} />
          </div>
        );
      },
    },"""

LM_NEW = """    {
      key: 'usageStats',
      header: '積込/荷降実績',
      width: '320px',
      render: (_value: string, row: any) => {
        const stats = usageStatsMap[row.id];
        if (usageStatsLoading && !stats) {
          return <span className="text-xs text-gray-400">読込中...</span>;
        }
        if (!stats) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        const Cell = ({ label, s }: { label: string; s: UsageStat }) => (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-gray-500 w-10">{label}</span>
            <span className="font-bold text-blue-700">積{s.loading}</span>
            <span className="font-bold text-red-700">降{s.unloading}</span>
          </div>
        );
        return (
          <div className="space-y-0.5">
            <Cell label="30日" s={stats.last30Days} />
            <Cell label="90日" s={stats.last90Days} />
            <Cell label="1年" s={stats.last365Days} />
          </div>
        );
      },
    },"""


def main():
    print("=" * 70)
    print("運行記録マップ機能 3点修正スクリプト 開始")
    print("=" * 70)

    patch(
        "backend/src/controllers/locationController.ts",
        CTRL_OLD,
        CTRL_NEW,
        "locationController.ts: search を場所名のみに限定"
    )
    patch(
        "frontend/cms/src/pages/LocationManagement.tsx",
        LM_OLD,
        LM_NEW,
        "LocationManagement.tsx: 「荷」→「降」表記修正 + 列幅拡大"
    )

    print("\n" + "=" * 70)
    print("パッチ適用完了。TypeScriptコンパイルチェックを実行します。")
    print("=" * 70)

    rc_backend = run(
        "./node_modules/.bin/tsc --noEmit",
        cwd=os.path.join(ROOT, "backend"),
        label="backend tsc"
    )
    rc_cms = run(
        "npx tsc --noEmit",
        cwd=os.path.join(ROOT, "frontend/cms"),
        label="frontend/cms tsc"
    )
    rc_mobile = run(
        "npx tsc --noEmit",
        cwd=os.path.join(ROOT, "frontend/mobile"),
        label="frontend/mobile tsc"
    )

    print("\n" + "=" * 70)
    print(f"コンパイル結果: backend={rc_backend} / cms={rc_cms} / mobile={rc_mobile}")
    print("=" * 70)

    if rc_backend == 0 and rc_cms == 0 and rc_mobile == 0:
        print("\n✅ 全パッケージ コンパイルエラー0件。GitHubへPushします。")
        run("git add -A", label="git add")
        commit_msg = (
            "fix: 実績表示の検索フィルタ修正 + 表記/レイアウト調整\\n\\n"
            "- fix: getLocationsMapSummary の search を場所名のみで判定するように変更。\\n"
            "  客先名（operationDetails経由）も検索対象だったため、検索語と無関係な\\n"
            "  場所まで大量にヒットしてしまう不具合を解消\\n"
            "- fix: LocationManagement.tsx の積込/荷降実績表示で「荷」表記を「降」に統一\\n"
            "- fix: 積込/荷降実績列の幅を230px→320pxに拡大（3行が詰まって見える問題を解消）"
        )
        run(f'git commit -m "{commit_msg}"', label="git commit")
        rc_push = run("git push", label="git push")
        if rc_push == 0:
            print("\n✅✅✅ GitHubへのPushが完了しました。")
        else:
            print("\n⚠️ git push に失敗しました。手動で確認してください。")
    else:
        print("\n❌❌❌ コンパイルエラーが残っています。GitHubへはPushしません。")
        print("上記のtscエラー出力を確認し、修正が必要です。")

    self_path = os.path.abspath(__file__)
    try:
        os.remove(self_path)
        print(f"\n🗑 スクリプト自身を削除しました: {self_path}")
    except Exception as e:
        print(f"\n⚠️ スクリプト自身の削除に失敗: {e}")


if __name__ == "__main__":
    main()
