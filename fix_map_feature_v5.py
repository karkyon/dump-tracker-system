#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_map_feature_v5.py
=====================================
運行記録マップ機能 4点修正（マーカー削除バグが①③④の共通の根本原因）

【真因】
  OperationsMapView.tsx のマーカー削除処理が
    markersRef.current.forEach(m => { m.map = null; });
  となっていたが、これは AdvancedMarkerElement 用のプロパティであり、
  実際に生成しているのは従来の google.maps.Marker （new window.google.maps.Marker(...)）。
  従来Markerでは m.map = null は何も起こさず、削除されない。
  そのため検索・フィルタを変更しても古いマーカーが地図上に残り続け、
  「ランキングは1件なのに地図には他のマーカーが残っている」状態になっていた。

① 地図上のマーカーが絞り込みに連動しない
   → m.map = null を m.setMap(null) に修正（これで解消）

③ 積込のみ/荷降のみでフィルタするとリストが空になる
   → バックエンドの getLocationsMapSummary が locationType を
     「マスタの固定属性」で事前フィルタしていたため、マスタ上 PICKUP registered の場所で
     実際には UNLOADING の実績がある場合に「荷降のみ」フィルタで除外されてしまっていた。
     集計後（loadingCount/unloadingCountが算出された後）にフィルタする方式に変更する。

④ 表記統一: サイドバーメニュー「積込・積下場所管理」→「積込・荷降場所管理」
            LocationManagement.tsx のページ見出し「積込・積降場所マスタ」→「積込・荷降場所マスタ」

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
# ① OperationsMapView.tsx: マーカー削除バグ修正（最重要）
# =====================================================================

MAPVIEW_OLD = """    // 既存マーカーを削除
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];"""

MAPVIEW_NEW = """    // 既存マーカーを削除
    // ✅ 修正: 生成しているのは従来の google.maps.Marker のため setMap(null) で削除する。
    //    m.map = null は AdvancedMarkerElement 用のプロパティで、Marker には効かず
    //    古いマーカーが地図上に残り続けるバグの原因だった。
    markersRef.current.forEach(m => { m.setMap(null); });
    markersRef.current = [];"""


# =====================================================================
# ③ Backend: locationType フィルタを集計後判定に変更
# =====================================================================

CTRL_OLD = """      // ---- 期間フィルタ（任意） ----
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      // ---- 種別・キーワード検索（任意） ----
      const locationTypeParam = req.query.locationType as string | undefined;
      const search = (req.query.search as string | undefined)?.trim();

      const locationWhere: any = { isActive: true };
      if (locationTypeParam && locationTypeParam !== 'ALL') {
        locationWhere.locationType = locationTypeParam;
      }
      // ✅ 修正: search は場所名（location.name）のみで判定する。
      //    address や客先名（operationDetails経由）まで対象にすると、
      //    検索語と無関係な場所が大量にヒットしてしまうため（例:「エヌエス日進」という
      //    客先が他の現場でも取引していると、その現場まで表示されてしまう）。
      //    「場所・客先名で検索」という入力欄の見た目通り、場所名で絞り込む動作に統一する。
      if (search) {
        locationWhere.name = { contains: search, mode: 'insensitive' };
      }

      // ---- 場所マスタ取得 ----
      const locations = await db.location.findMany({
        where: locationWhere,
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          locationType: true
        },
        orderBy: { name: 'asc' }
      });

      if (locations.length === 0) {
        return res.status(200).json(successResponse([], '位置マップサマリーを取得しました'));
      }

      const locationIds = locations.map(l => l.id);"""

CTRL_NEW = """      // ---- 期間フィルタ（任意） ----
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      // ---- 種別・キーワード検索（任意） ----
      // ✅ 修正: locationType は「マスタの固定属性」では事前フィルタしない。
      //    同一場所が積込・荷降の両方で使われるケースがあり、マスタ上 PICKUP 登録でも
      //    実際には UNLOADING の実績がある場合があるため、ここで除外すると
      //    「荷降のみ」フィルタで実績があるのに表示されない不具合が起きる。
      //    集計（loadingCount/unloadingCount算出）後に、実績ベースでフィルタする。
      const locationTypeParam = req.query.locationType as string | undefined;
      const search = (req.query.search as string | undefined)?.trim();

      const locationWhere: any = { isActive: true };
      // ✅ search は場所名（location.name）のみで判定する。
      //    address や客先名まで対象にすると、検索語と無関係な場所が大量にヒットしてしまうため。
      if (search) {
        locationWhere.name = { contains: search, mode: 'insensitive' };
      }

      // ---- 場所マスタ取得（locationType による事前フィルタなし） ----
      const locations = await db.location.findMany({
        where: locationWhere,
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          locationType: true
        },
        orderBy: { name: 'asc' }
      });

      if (locations.length === 0) {
        return res.status(200).json(successResponse([], '位置マップサマリーを取得しました'));
      }

      const locationIds = locations.map(l => l.id);"""


CTRL_RESPONSE_OLD = """      // ---- レスポンス整形 ----
      const summary = locations.map(loc => {
        const agg = aggMap.get(loc.id);
        let topCustomerName: string | null = null;
        if (agg && agg.customerCounts.size > 0) {
          const sorted = [...agg.customerCounts.entries()].sort((a, b) => b[1] - a[1]);
          topCustomerName = sorted[0]?.[0] ?? null;
        }

        const loadingCount = agg?.loadingCount || 0;
        const unloadingCount = agg?.unloadingCount || 0;

        return {
          id: loc.id,
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude ? Number(loc.latitude) : null,
          longitude: loc.longitude ? Number(loc.longitude) : null,
          locationType: loc.locationType,
          customerName: topCustomerName,
          loadingCount,
          unloadingCount,
          operationCount: loadingCount + unloadingCount,
          lastUsedAt: agg?.lastDate ? agg.lastDate.toISOString() : null
        };
      });

      logger.info('位置マップサマリー取得', {
        count: summary.length,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        userId: req.user.userId
      });

      return res.status(200).json(successResponse(summary, '位置マップサマリーを取得しました'));"""

CTRL_RESPONSE_NEW = """      // ---- レスポンス整形 ----
      let summary = locations.map(loc => {
        const agg = aggMap.get(loc.id);
        let topCustomerName: string | null = null;
        if (agg && agg.customerCounts.size > 0) {
          const sorted = [...agg.customerCounts.entries()].sort((a, b) => b[1] - a[1]);
          topCustomerName = sorted[0]?.[0] ?? null;
        }

        const loadingCount = agg?.loadingCount || 0;
        const unloadingCount = agg?.unloadingCount || 0;

        return {
          id: loc.id,
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude ? Number(loc.latitude) : null,
          longitude: loc.longitude ? Number(loc.longitude) : null,
          locationType: loc.locationType,
          customerName: topCustomerName,
          loadingCount,
          unloadingCount,
          operationCount: loadingCount + unloadingCount,
          lastUsedAt: agg?.lastDate ? agg.lastDate.toISOString() : null
        };
      });

      // ✅ 修正: locationType フィルタは集計後（実績ベース）で適用する。
      //    PICKUP指定 → loadingCount > 0 の場所のみ／DELIVERY指定 → unloadingCount > 0 の場所のみ。
      //    実績がまだ無い場所は、マスタの登録種別で判定してフィルタに含める。
      if (locationTypeParam && locationTypeParam !== 'ALL') {
        summary = summary.filter(loc => {
          const hasAnyRecord = loc.loadingCount > 0 || loc.unloadingCount > 0;
          if (locationTypeParam === 'PICKUP') {
            return hasAnyRecord ? loc.loadingCount > 0 : loc.locationType === 'PICKUP';
          }
          if (locationTypeParam === 'DELIVERY') {
            return hasAnyRecord ? loc.unloadingCount > 0 : loc.locationType === 'DELIVERY';
          }
          return true;
        });
      }

      logger.info('位置マップサマリー取得', {
        count: summary.length,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        userId: req.user.userId
      });

      return res.status(200).json(successResponse(summary, '位置マップサマリーを取得しました'));"""


# =====================================================================
# ④ 表記統一: 「積下」→「荷降」
# =====================================================================

CONSTANTS_OLD = """  {
    id: 'locations',
    name: '積込・積下場所管理',
    path: '/locations',
    icon: 'MapPin'
  },"""

CONSTANTS_NEW = """  {
    id: 'locations',
    name: '積込・荷降場所管理',
    path: '/locations',
    icon: 'MapPin'
  },"""

LM_OLD = """          <h1 className="text-2xl font-bold text-gray-900">積込・積降場所マスタ</h1>
          <p className="mt-2 text-sm text-gray-700">
            積込場所・積降場所の登録・編集・削除を行います
          </p>"""

LM_NEW = """          <h1 className="text-2xl font-bold text-gray-900">積込・荷降場所マスタ</h1>
          <p className="mt-2 text-sm text-gray-700">
            積込場所・荷降場所の登録・編集・削除を行います
          </p>"""


def main():
    print("=" * 70)
    print("運行記録マップ機能 4点修正スクリプト 開始")
    print("=" * 70)

    # ① マーカー削除バグ修正（最重要）
    patch(
        "frontend/cms/src/components/OperationsMapView.tsx",
        MAPVIEW_OLD,
        MAPVIEW_NEW,
        "OperationsMapView.tsx: マーカー削除バグ修正（setMap(null)）"
    )

    # ③ バックエンド: locationType を集計後フィルタに変更
    patch(
        "backend/src/controllers/locationController.ts",
        CTRL_OLD,
        CTRL_NEW,
        "locationController.ts: locationType事前フィルタを撤廃"
    )
    patch(
        "backend/src/controllers/locationController.ts",
        CTRL_RESPONSE_OLD,
        CTRL_RESPONSE_NEW,
        "locationController.ts: locationTypeを集計後フィルタに変更"
    )

    # ④ 表記統一
    patch(
        "frontend/cms/src/utils/constants.ts",
        CONSTANTS_OLD,
        CONSTANTS_NEW,
        "constants.ts: サイドバーメニュー表記修正"
    )
    patch(
        "frontend/cms/src/pages/LocationManagement.tsx",
        LM_OLD,
        LM_NEW,
        "LocationManagement.tsx: ページ見出し表記修正"
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
            "fix: マーカー削除バグ修正 + 種別フィルタを実績ベースに変更 + 表記統一\\n\\n"
            "- fix: OperationsMapView.tsx のマーカー削除処理を m.setMap(null) に修正。\\n"
            "  従来の google.maps.Marker に対し AdvancedMarkerElement 用の m.map=null を\\n"
            "  使っていたため何も削除されず、フィルタ変更後も古いマーカーが\\n"
            "  地図上に残り続けるバグを解消（ランキングと地図表示の不一致の根本原因）\\n"
            "- fix: getLocationsMapSummary の locationType フィルタを、マスタの固定属性での\\n"
            "  事前フィルタから、集計後（loadingCount/unloadingCount）の実績ベース判定に変更。\\n"
            "  「積込のみ」「荷降のみ」で絞り込むと実績があるのに0件になる不具合を解消\\n"
            "- feat: サイドバーメニュー・ページ見出しの「積込・積下場所管理」表記を\\n"
            "  「積込・荷降場所管理」に統一"
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
