#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_ts2532.py
=====================================
locationController.ts の TS2532エラー修正

エラー内容:
  src/controllers/locationController.ts(652,29): error TS2532: Object is possibly 'undefined'.

原因:
  getLocationsMapSummary 内の以下の行で、sort後の配列[0]の型が
  「要素が存在しない可能性がある」とTypeScriptに判定されたため。

    topCustomerName = [...agg.customerCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

修正:
  sorted[0]?.[0] ?? null の形でオプショナルチェーンを使用し、安全にアクセスする。

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
    print(result.stdout[-4000:] if result.stdout else "")
    if result.returncode != 0:
        print(f"❌ [{label}] 失敗 (RC={result.returncode})")
        print(result.stderr[-4000:] if result.stderr else "")
    else:
        print(f"✅ [{label}] 成功 (RC=0)")
    return result.returncode


OLD = """        let topCustomerName: string | null = null;
        if (agg && agg.customerCounts.size > 0) {
          topCustomerName = [...agg.customerCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }"""

NEW = """        let topCustomerName: string | null = null;
        if (agg && agg.customerCounts.size > 0) {
          const sorted = [...agg.customerCounts.entries()].sort((a, b) => b[1] - a[1]);
          topCustomerName = sorted[0]?.[0] ?? null;
        }"""


def main():
    print("=" * 70)
    print("TS2532エラー修正スクリプト 開始")
    print("=" * 70)

    patch(
        "backend/src/controllers/locationController.ts",
        OLD,
        NEW,
        "locationController.ts: TS2532修正（topCustomerName安全アクセス）"
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
            "feat: 運行記録マップ表示機能の追加\\n\\n"
            "- locationController.ts: getLocationsMapSummary 追加（場所別実績回数集計API）\\n"
            "- locationRoutes.ts: GET /locations/map-summary ルート追加\\n"
            "- OperationsMapView.tsx: 新規作成（積込/積下場所ピン表示・実績回数・詳細ジャンプ）\\n"
            "- OperationRecords.tsx: 「一覧表示/マップ表示」タブ切替UIを統合\\n"
            "- fix: TS2532（topCustomerName取得時の配列安全アクセス）"
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
