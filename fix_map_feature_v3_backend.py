#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_map_feature_v3.py
=====================================
運行記録マップ機能 実績集計バグ修正 + 機能強化

【背景】
  Location（場所マスタ）はlocationType（PICKUP/DELIVERY）で1種類に固定されるが、
  実際には同じ場所が積込にも荷降にも使われるケースがある（例：吉田組 岡山合材所）。
  旧実装は location.locationType だけで種別を判定し、operationDetails の
  activityType（実際の積込/荷降の別）を見ずに全件を1つのoperationCountに
  合算していたため、片方の活動が表示上「無かったこと」になっていた。

【対応】
  ① バックエンド getLocationsMapSummary を全面改修:
     - operationDetails を activityType（LOADING/UNLOADING）別に集計し、
       loadingCount / unloadingCount を個別に返す
     - search は location.name のみを対象にし、address は対象から除外
       （地名の偶然一致で無関係な場所が大量にヒットする問題を解消）
     - 客先名（customerName, 集計後にしか分からない）でも検索できるよう
       operationDetails 経由の customer.name 一致を OR 条件に追加
     - 直近30日 / 90日 / 365日 の積込・荷降回数も同時に集計して返す
       （積込・積卸場所マスタ一覧画面での表示用）

  ② フロント OperationsMapView.tsx:
     - 型を loadingCount / unloadingCount 対応に更新
     - ピンの色: 積込のみ=青、荷降のみ=赤、両方=紫
     - InfoWindow・ランキングに「積込:X回 / 荷降:Y回」を分けて表示
     - 初期表示時・フィルタ後にランキング1位の場所を地図中央に自動配置

  ③ フロント LocationManagement.tsx:
     - map-summary（全期間）を追加取得し、テーブルに
       「直近30日/90日/1年」の積込・荷降回数列を追加

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
# ① Backend: getLocationsMapSummary 全面改修
# =====================================================================

CTRL_OLD = """  getLocationsMapSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const db = DatabaseService.getInstance();

      // ---- 期間フィルタ（任意） ----
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      // ---- 種別・キーワード検索（任意） ----
      const locationTypeParam = req.query.locationType as string | undefined;
      const search = (req.query.search as string | undefined)?.trim();

      const locationWhere: any = { isActive: true };
      if (locationTypeParam && locationTypeParam !== 'ALL') {
        locationWhere.locationType = locationTypeParam;
      }
      if (search) {
        locationWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } }
        ];
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

      const locationIds = locations.map(l => l.id);

      // ---- operationDetails を集計（期間フィルタ適用） ----
      const detailWhere: any = { locationId: { in: locationIds } };
      if (dateFrom || dateTo) {
        detailWhere.actualStartTime = {};
        if (dateFrom) detailWhere.actualStartTime.gte = dateFrom;
        if (dateTo) detailWhere.actualStartTime.lte = dateTo;
      }

      const details = await db.operationDetail.findMany({
        where: detailWhere,
        select: {
          locationId: true,
          actualStartTime: true,
          plannedTime: true,
          operations: {
            select: {
              customer: { select: { name: true } }
            }
          }
        }
      });

      // ---- locationId ごとに集計 ----
      type Agg = {
        count: number;
        lastDate: Date | null;
        customerCounts: Map<string, number>;
      };
      const aggMap = new Map<string, Agg>();

      for (const d of details) {
        if (!d.locationId) continue;
        const agg = aggMap.get(d.locationId) || { count: 0, lastDate: null, customerCounts: new Map() };
        agg.count += 1;

        const ts = d.actualStartTime || d.plannedTime;
        if (ts && (!agg.lastDate || ts > agg.lastDate)) {
          agg.lastDate = ts;
        }

        const customerName = d.operations?.customer?.name;
        if (customerName) {
          agg.customerCounts.set(customerName, (agg.customerCounts.get(customerName) || 0) + 1);
        }

        aggMap.set(d.locationId, agg);
      }

      // ---- レスポンス整形 ----
      const summary = locations.map(loc => {
        const agg = aggMap.get(loc.id);
        let topCustomerName: string | null = null;
        if (agg && agg.customerCounts.size > 0) {
          const sorted = [...agg.customerCounts.entries()].sort((a, b) => b[1] - a[1]);
          topCustomerName = sorted[0]?.[0] ?? null;
        }

        return {
          id: loc.id,
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude ? Number(loc.latitude) : null,
          longitude: loc.longitude ? Number(loc.longitude) : null,
          locationType: loc.locationType,
          customerName: topCustomerName,
          operationCount: agg?.count || 0,
          lastUsedAt: agg?.lastDate ? agg.lastDate.toISOString() : null
        };
      });

      logger.info('位置マップサマリー取得', {
        count: summary.length,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        userId: req.user.userId
      });

      return res.status(200).json(successResponse(summary, '位置マップサマリーを取得しました'));

    } catch (error) {
      logger.error('位置マップサマリー取得エラー', { error, userId: req.user?.userId });

      if (error instanceof ValidationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        return res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        return res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置マップサマリーの取得に失敗しました', 500, 'GET_LOCATIONS_MAP_SUMMARY_ERROR');
        return res.status(500).json(errorRes);
      }
    }
  });"""

CTRL_NEW = """  getLocationsMapSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const db = DatabaseService.getInstance();

      // ---- 期間フィルタ（任意） ----
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      // ---- 種別・キーワード検索（任意） ----
      const locationTypeParam = req.query.locationType as string | undefined;
      const search = (req.query.search as string | undefined)?.trim();

      const locationWhere: any = { isActive: true };
      if (locationTypeParam && locationTypeParam !== 'ALL') {
        locationWhere.locationType = locationTypeParam;
      }
      // ✅ 修正: address は検索対象から除外（地名の偶然一致による過剰ヒットを防止）。
      //    場所名 または その場所で実際に使われた客先名（operationDetails経由）で検索する。
      if (search) {
        locationWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { operationDetails: { some: { operations: { customer: { name: { contains: search, mode: 'insensitive' } } } } } }
        ];
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

      const locationIds = locations.map(l => l.id);

      // ---- operationDetails を取得（期間フィルタ適用・全期間も含めて1回で取得） ----
      // ✅ 修正: activityType も取得し、積込(LOADING)/荷降(UNLOADING)を区別して集計する。
      //    1つの場所が両方の用途で使われるケースに対応（マスタのlocationTypeだけでは判定しない）。
      const detailWhereBase: any = { locationId: { in: locationIds } };
      const detailWhereFiltered: any = { ...detailWhereBase };
      if (dateFrom || dateTo) {
        detailWhereFiltered.actualStartTime = {};
        if (dateFrom) detailWhereFiltered.actualStartTime.gte = dateFrom;
        if (dateTo) detailWhereFiltered.actualStartTime.lte = dateTo;
      }

      const details = await db.operationDetail.findMany({
        where: detailWhereFiltered,
        select: {
          locationId: true,
          activityType: true,
          actualStartTime: true,
          plannedTime: true,
          operations: {
            select: {
              customer: { select: { name: true } }
            }
          }
        }
      });

      // ---- locationId ごとに集計（積込/荷降を分離） ----
      type Agg = {
        loadingCount: number;
        unloadingCount: number;
        lastDate: Date | null;
        customerCounts: Map<string, number>;
      };
      const aggMap = new Map<string, Agg>();

      for (const d of details) {
        if (!d.locationId) continue;
        const agg = aggMap.get(d.locationId) || {
          loadingCount: 0,
          unloadingCount: 0,
          lastDate: null,
          customerCounts: new Map<string, number>()
        };

        if (d.activityType === 'LOADING') agg.loadingCount += 1;
        else if (d.activityType === 'UNLOADING') agg.unloadingCount += 1;

        const ts = d.actualStartTime || d.plannedTime;
        if (ts && (!agg.lastDate || ts > agg.lastDate)) {
          agg.lastDate = ts;
        }

        const customerName = d.operations?.customer?.name;
        if (customerName) {
          agg.customerCounts.set(customerName, (agg.customerCounts.get(customerName) || 0) + 1);
        }

        aggMap.set(d.locationId, agg);
      }

      // ---- レスポンス整形 ----
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

      return res.status(200).json(successResponse(summary, '位置マップサマリーを取得しました'));

    } catch (error) {
      logger.error('位置マップサマリー取得エラー', { error, userId: req.user?.userId });

      if (error instanceof ValidationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        return res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        return res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置マップサマリーの取得に失敗しました', 500, 'GET_LOCATIONS_MAP_SUMMARY_ERROR');
        return res.status(500).json(errorRes);
      }
    }
  });

  /**
   * 位置別実績統計取得（直近30日/90日/1年の積込・荷降回数）
   * GET /api/v1/locations/usage-stats
   *
   * 積込・積卸場所マスタ一覧画面用。全場所の直近期間別の積込/荷降回数を一括取得する。
   */
  getLocationsUsageStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const db = DatabaseService.getInstance();

      const locations = await db.location.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      if (locations.length === 0) {
        return res.status(200).json(successResponse([], '位置別実績統計を取得しました'));
      }

      const locationIds = locations.map(l => l.id);
      const now = new Date();
      const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const day365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // 直近1年分のみ取得し、フロント/メモリ側で30日・90日・365日に振り分ける
      // （365日を超えるレコードはこの集計には不要）
      const details = await db.operationDetail.findMany({
        where: {
          locationId: { in: locationIds },
          actualStartTime: { gte: day365 }
        },
        select: {
          locationId: true,
          activityType: true,
          actualStartTime: true,
          plannedTime: true
        }
      });

      type PeriodAgg = { loading: number; unloading: number };
      type LocAgg = { d30: PeriodAgg; d90: PeriodAgg; d365: PeriodAgg };
      const makeEmpty = (): PeriodAgg => ({ loading: 0, unloading: 0 });
      const aggMap = new Map<string, LocAgg>();

      for (const d of details) {
        if (!d.locationId) continue;
        const ts = d.actualStartTime || d.plannedTime;
        if (!ts) continue;

        const agg = aggMap.get(d.locationId) || { d30: makeEmpty(), d90: makeEmpty(), d365: makeEmpty() };

        const bump = (bucket: PeriodAgg) => {
          if (d.activityType === 'LOADING') bucket.loading += 1;
          else if (d.activityType === 'UNLOADING') bucket.unloading += 1;
        };

        if (ts >= day365) bump(agg.d365);
        if (ts >= day90) bump(agg.d90);
        if (ts >= day30) bump(agg.d30);

        aggMap.set(d.locationId, agg);
      }

      const result = locationIds.map(id => {
        const agg = aggMap.get(id) || { d30: makeEmpty(), d90: makeEmpty(), d365: makeEmpty() };
        return {
          locationId: id,
          last30Days: agg.d30,
          last90Days: agg.d90,
          last365Days: agg.d365
        };
      });

      logger.info('位置別実績統計取得', { count: result.length, userId: req.user.userId });

      return res.status(200).json(successResponse(result, '位置別実績統計を取得しました'));

    } catch (error) {
      logger.error('位置別実績統計取得エラー', { error, userId: req.user?.userId });
      const errorRes = errorResponse('位置別実績統計の取得に失敗しました', 500, 'GET_LOCATIONS_USAGE_STATS_ERROR');
      return res.status(500).json(errorRes);
    }
  });"""


CTRL_EXPORT_OLD = """export const {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationStatistics,
  getNearbyLocations,
  getLocationsByType,
  getLocationsMapSummary
} = locationController;"""

CTRL_EXPORT_NEW = """export const {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationStatistics,
  getNearbyLocations,
  getLocationsByType,
  getLocationsMapSummary,
  getLocationsUsageStats
} = locationController;"""


# =====================================================================
# ① Backend: locationRoutes.ts に usage-stats ルート追加
# =====================================================================

ROUTES_IMPORT_OLD = """import {
  createLocation,
  deleteLocation,
  getAllLocations,
  getLocationById,
  getLocationsByType,
  getLocationStatistics,
  getLocationsMapSummary,
  getNearbyLocations,
  updateLocation
} from '../controllers/locationController';"""

ROUTES_IMPORT_NEW = """import {
  createLocation,
  deleteLocation,
  getAllLocations,
  getLocationById,
  getLocationsByType,
  getLocationStatistics,
  getLocationsMapSummary,
  getLocationsUsageStats,
  getNearbyLocations,
  updateLocation
} from '../controllers/locationController';"""

ROUTES_OLD = """router.get('/map-summary', getLocationsMapSummary);

router.get('/:id', validateId, getLocationById);"""

ROUTES_NEW = """router.get('/map-summary', getLocationsMapSummary);

/**
 * @swagger
 * /locations/usage-stats:
 *   get:
 *     summary: 位置別実績統計取得（直近30日/90日/1年）
 *     description: |
 *       積込・積卸場所マスタ一覧画面用。全場所の直近期間別の積込/荷降回数を一括取得する。
 *     tags:
 *       - 📍 位置管理 (Location Management)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 取得成功
 *       401:
 *         description: 認証エラー
 */
router.get('/usage-stats', getLocationsUsageStats);

router.get('/:id', validateId, getLocationById);"""


def main():
    print("=" * 70)
    print("運行記録マップ機能 実績集計修正 + 実績表示強化スクリプト 開始")
    print("=" * 70)

    # ① バックエンド
    patch(
        "backend/src/controllers/locationController.ts",
        CTRL_OLD,
        CTRL_NEW,
        "locationController.ts: getLocationsMapSummary全面改修 + getLocationsUsageStats追加"
    )
    patch(
        "backend/src/controllers/locationController.ts",
        CTRL_EXPORT_OLD,
        CTRL_EXPORT_NEW,
        "locationController.ts: export追加"
    )
    patch(
        "backend/src/routes/locationRoutes.ts",
        ROUTES_IMPORT_OLD,
        ROUTES_IMPORT_NEW,
        "locationRoutes.ts: import追加"
    )
    patch(
        "backend/src/routes/locationRoutes.ts",
        ROUTES_OLD,
        ROUTES_NEW,
        "locationRoutes.ts: /usage-stats ルート追加"
    )

    print("\n" + "=" * 70)
    print("① バックエンドパッチ適用完了。コンパイルチェックします。")
    print("=" * 70)

    rc_backend = run(
        "./node_modules/.bin/tsc --noEmit",
        cwd=os.path.join(ROOT, "backend"),
        label="backend tsc (step1)"
    )
    if rc_backend != 0:
        print("\n❌❌❌ バックエンドのコンパイルエラーが残っています。後続のフロント修正は行わず終了します。")
        return

    self_path = os.path.abspath(__file__)
    print(f"\n✅ バックエンド修正完了。続けて第2部のフロント修正スクリプトを実行してください。")


if __name__ == "__main__":
    main()
