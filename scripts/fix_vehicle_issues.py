#!/usr/bin/env python3
"""
2つの問題を一括修正:
1. mobileController.ts: getVehiclesList の limit が vehicleService に渡されていない
2. VehicleInfo.tsx: APIレスポンス解析ミスで vehicleId に plateNumber が入る
"""
import sys, os

BACKEND = '/home/karkyon/projects/dump-tracker/backend/src/controllers/mobileController.ts'
FRONTEND = '/home/karkyon/projects/dump-tracker/frontend/mobile/src/pages/VehicleInfo.tsx'

fixes = 0

# ============================================================
# Fix 1: mobileController.ts - limit を vehicleService に渡す
# ============================================================
with open(BACKEND, 'r') as f:
    content = f.read()

OLD1 = '''      const paginationQuery: PaginationQuery = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
      };

      const filter: VehicleFilter = {
        status: req.query.status ? [req.query.status as string] as any[] : undefined,
        manufacturer: req.query.search as string
      };

      const result = await this.vehicleService.getVehicleList(filter, {
        userId: req.user.userId,
        userRole: req.user.role,
        includeStatistics: false,
        includeCurrentLocation: false
      });'''

NEW1 = '''      const paginationQuery: PaginationQuery = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 100  // ✅ 修正: デフォルト100件（モバイル車両選択用）
      };

      const filter: VehicleFilter = {
        status: req.query.status ? [req.query.status as string] as any[] : undefined,
        manufacturer: req.query.search as string,
        page: paginationQuery.page,   // ✅ 修正: pageをfilterに渡す
        limit: paginationQuery.limit  // ✅ 修正: limitをfilterに渡す
      };

      const result = await this.vehicleService.getVehicleList(filter, {
        userId: req.user.userId,
        userRole: req.user.role,
        includeStatistics: false,
        includeCurrentLocation: false
      });'''

if OLD1 in content:
    content = content.replace(OLD1, NEW1, 1)
    fixes += 1
    print('✅ Fix 1: mobileController.ts - limit=100 & filterに渡すよう修正')
else:
    print('⚠️  Fix 1: 対象文字列が見つかりません')

with open(BACKEND, 'w') as f:
    f.write(content)

# ============================================================
# Fix 2: VehicleInfo.tsx - APIレスポンス解析を修正
# ============================================================
with open(FRONTEND, 'r') as f:
    content = f.read()

OLD2 = '''      if (response.data.success && response.data.data) {
        // ✅ バックエンドからのデータを変換
        const apiVehicles = response.data.data.vehicles || response.data.data;'''

NEW2 = '''      if (response.data.success && response.data.data) {
        // ✅ バックエンドからのデータを変換
        // mobileController: sendSuccess → { success, data: { vehicles:[...], pagination:{} } }
        const apiVehicles = response.data.data.vehicles
          || (Array.isArray(response.data.data) ? response.data.data : null);'''

if OLD2 in content:
    content = content.replace(OLD2, NEW2, 1)
    fixes += 1
    print('✅ Fix 2: VehicleInfo.tsx - APIレスポンス解析修正（vehiclesキー優先）')
else:
    print('⚠️  Fix 2: 対象文字列が見つかりません')
    # フォールバック確認
    if 'response.data.data.vehicles || response.data.data' in content:
        print('   → 別パターンで修正を試みます')
        content = content.replace(
            'response.data.data.vehicles || response.data.data',
            'response.data.data.vehicles || (Array.isArray(response.data.data) ? response.data.data : null)',
            1
        )
        fixes += 1
        print('✅ Fix 2 (fallback): VehicleInfo.tsx - APIレスポンス解析修正')

with open(FRONTEND, 'w') as f:
    f.write(content)

print(f'\n合計 {fixes} 件修正完了')
if fixes < 2:
    print('⚠️  一部修正できていません。手動確認が必要です')
    sys.exit(1)

print('\n次のステップ:')
print('  cd ~/projects/dump-tracker && bash scripts/compile_and_push.sh')
