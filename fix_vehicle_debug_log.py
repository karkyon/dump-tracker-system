#!/usr/bin/env python3
"""
全経路詳細ログ追加 + loadingPattern/unloadingPattern 確実保存修正
対象:
1. VehicleManagement.tsx: handleSubmitEdit で送信値を完全ログ
2. vehicleStore.ts: updateVehicle で送信・レスポンスを完全ログ
3. vehicleController.ts: PUT ハンドラーで受信値・保存値をログ
4. vehicleService.ts: updateDataPrepared の loadingPattern 値をログ
5. mapVehicleToResponseDTO にログ追加
"""
import os, sys, subprocess

BASE = '/home/karkyon/projects/dump-tracker'

def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def patch(path, old, new, label):
    content = read(path)
    if old not in content:
        print(f'  ⚠️  SKIP [{label}]')
        return False
    write(path, content.replace(old, new, 1))
    print(f'  ✅ [{label}]')
    return True

# ============================================================
# 1. VehicleManagement.tsx: handleSubmitEdit の送信payload完全ログ
# ============================================================
CMS_VM = f'{BASE}/frontend/cms/src/pages/VehicleManagement.tsx'

patch(
    CMS_VM,
    '''    const payload = {
      ...formData,
      capacity: _capE,
      currentMileage: _milE,
      region: formData.region || null,
      inspectionExpiry: formData.inspectionExpiry || undefined,
      loadingPattern: formData.loadingPattern ?? 2,    // 🆕
      unloadingPattern: formData.unloadingPattern ?? 2, // 🆕
    };''',
    '''    const payload = {
      ...formData,
      capacity: _capE,
      currentMileage: _milE,
      region: formData.region || null,
      inspectionExpiry: formData.inspectionExpiry || undefined,
      loadingPattern: Number(formData.loadingPattern ?? 2),
      unloadingPattern: Number(formData.unloadingPattern ?? 2),
    };
    console.log('🚛🚛🚛 [VehicleManagement] handleSubmitEdit payload完全ダンプ:', JSON.stringify(payload, null, 2));
    console.log('🚛 [VehicleManagement] loadingPattern送信値:', payload.loadingPattern, 'typeof:', typeof payload.loadingPattern);
    console.log('🚛 [VehicleManagement] unloadingPattern送信値:', payload.unloadingPattern, 'typeof:', typeof payload.unloadingPattern);''',
    'VehicleManagement: handleSubmitEdit payload完全ログ追加'
)

# ============================================================
# 2. vehicleStore.ts: updateVehicle の送信・レスポンス完全ログ
# ============================================================
STORE = f'{BASE}/frontend/cms/src/store/vehicleStore.ts'

patch(
    STORE,
    '''      console.log('[VehicleStore] バックエンドに送信するデータ:', backendData);

      const response = await vehicleAPI.updateVehicle(id, backendData);

      console.log('[VehicleStore] updateVehicle APIレスポンス:', response);''',
    '''      console.log('[VehicleStore] バックエンドに送信するデータ:', backendData);
      console.log('[VehicleStore] 🔑 送信データ完全ダンプ:', JSON.stringify(backendData, null, 2));
      console.log('[VehicleStore] 🔑 loadingPattern送信値:', backendData.loadingPattern, 'typeof:', typeof backendData.loadingPattern);
      console.log('[VehicleStore] 🔑 unloadingPattern送信値:', backendData.unloadingPattern, 'typeof:', typeof backendData.unloadingPattern);

      const response = await vehicleAPI.updateVehicle(id, backendData);

      console.log('[VehicleStore] updateVehicle APIレスポンス:', response);
      console.log('[VehicleStore] 🔑 APIレスポンス完全ダンプ:', JSON.stringify(response, null, 2));
      console.log('[VehicleStore] 🔑 レスポンス loadingPattern:', (response as any)?.data?.loadingPattern);
      console.log('[VehicleStore] 🔑 レスポンス unloadingPattern:', (response as any)?.data?.unloadingPattern);''',
    'vehicleStore: updateVehicle 完全ログ追加'
)

# ============================================================
# 3. vehicleController.ts: PUT ハンドラーで受信値完全ログ
# ============================================================
CTRL = f'{BASE}/backend/src/controllers/vehicleController.ts'

patch(
    CTRL,
    '''      const vehicleId = req.params.id;
      const updateData: VehicleUpdateInput = req.body;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!vehicleId) {
        throw new ValidationError('車両IDが指定されていません');
      }

      // 権限チェック
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new AuthorizationError('車両更新権限がありません');
      }

      // services層（前回完成）でのビジネスロジック処理
      const updatedVehicle = await this.vehicleService.updateVehicle(vehicleId, updateData, {''',
    '''      const vehicleId = req.params.id;
      const updateData: VehicleUpdateInput = req.body;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      logger.info('🔑🔑🔑 [vehicleController.updateVehicle] リクエスト受信完全ダンプ', {
        vehicleId,
        requestBody: JSON.stringify(req.body),
        loadingPattern: (req.body as any).loadingPattern,
        loadingPatternType: typeof (req.body as any).loadingPattern,
        unloadingPattern: (req.body as any).unloadingPattern,
        unloadingPatternType: typeof (req.body as any).unloadingPattern,
      });

      if (!vehicleId) {
        throw new ValidationError('車両IDが指定されていません');
      }

      // 権限チェック
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new AuthorizationError('車両更新権限がありません');
      }

      // services層（前回完成）でのビジネスロジック処理
      const updatedVehicle = await this.vehicleService.updateVehicle(vehicleId, updateData, {''',
    'vehicleController: updateVehicle 受信値完全ログ追加'
)

# レスポンスのログも追加
patch(
    CTRL,
    '''      logger.info('車両更新完了', {
        vehicleId,
        plateNumber: updatedVehicle.plateNumber,
        updatedBy: userId,
        userRole
      });

      // ✅ FIX: sendSuccessを使わず、res.json()で直接レスポンスを返す
      res.status(200).json({
        success: true,
        data: updatedVehicle,
        message: '車両情報を更新しました',
        timestamp: new Date().toISOString()
      });''',
    '''      logger.info('🔑🔑🔑 [vehicleController.updateVehicle] 更新完了 完全ダンプ', {
        vehicleId,
        plateNumber: updatedVehicle.plateNumber,
        loadingPattern: (updatedVehicle as any).loadingPattern,
        unloadingPattern: (updatedVehicle as any).unloadingPattern,
        updatedVehicleFull: JSON.stringify(updatedVehicle),
        updatedBy: userId,
        userRole
      });

      // ✅ FIX: sendSuccessを使わず、res.json()で直接レスポンスを返す
      res.status(200).json({
        success: true,
        data: updatedVehicle,
        message: '車両情報を更新しました',
        timestamp: new Date().toISOString()
      });''',
    'vehicleController: updateVehicle レスポンス完全ログ追加'
)

# ============================================================
# 4. vehicleService.ts: updateDataPrepared の loadingPattern ログ追加
# ============================================================
SVC = f'{BASE}/backend/src/services/vehicleService.ts'

patch(
    SVC,
    '''          // 🆕 オペレーションパターン（DBカラム: loading_pattern / unloading_pattern）
          loadingPattern:   (updateData as any).loadingPattern !== undefined
                          ? Number((updateData as any).loadingPattern)
                          : undefined,
          unloadingPattern: (updateData as any).unloadingPattern !== undefined
                          ? Number((updateData as any).unloadingPattern)
                          : undefined,''',
    '''          // 🆕 オペレーションパターン（DBカラム: loading_pattern / unloading_pattern）
          loadingPattern:   (updateData as any).loadingPattern !== undefined
                          ? Number((updateData as any).loadingPattern)
                          : undefined,
          unloadingPattern: (updateData as any).unloadingPattern !== undefined
                          ? Number((updateData as any).unloadingPattern)
                          : undefined,''',
    'vehicleService: updateDataPrepared パターン（変更なし確認用）'
)

# サービス層の詳細ログ
patch(
    SVC,
    '''      logger.info('車両更新開始', { vehicleId, updateData, context });''',
    '''      logger.info('🔑🔑🔑 [vehicleService.updateVehicle] 更新開始 完全ダンプ', {
        vehicleId,
        updateDataFull: JSON.stringify(updateData),
        loadingPattern: (updateData as any).loadingPattern,
        loadingPatternType: typeof (updateData as any).loadingPattern,
        unloadingPattern: (updateData as any).unloadingPattern,
        unloadingPatternType: typeof (updateData as any).unloadingPattern,
        context
      });''',
    'vehicleService: updateVehicle 開始時完全ログ追加'
)

# Prisma update 直前のログ
patch(
    SVC,
    '''        const vehicle = await tx.vehicle.update({
          where: { id: vehicleId },
          data: updateDataPrepared,
          include: {
            operations: true,
            maintenanceRecords: true
          }
        });''',
    '''        logger.info('🔑🔑🔑 [vehicleService] Prisma update 直前 updateDataPrepared 完全ダンプ', {
          updateDataPreparedFull: JSON.stringify(updateDataPrepared),
          loadingPattern: updateDataPrepared.loadingPattern,
          unloadingPattern: updateDataPrepared.unloadingPattern,
        });
        const vehicle = await tx.vehicle.update({
          where: { id: vehicleId },
          data: updateDataPrepared,
          include: {
            operations: true,
            maintenanceRecords: true
          }
        });
        logger.info('🔑🔑🔑 [vehicleService] Prisma update 完了 完全ダンプ', {
          vehicleFull: JSON.stringify(vehicle),
          loadingPattern: (vehicle as any).loadingPattern,
          unloadingPattern: (vehicle as any).unloadingPattern,
        });''',
    'vehicleService: Prisma update 直前・直後完全ログ追加'
)

# mapVehicleToResponseDTO のログ
patch(
    SVC,
    '''      region: vehicle.region ?? null,
      inspectionExpiry: vehicle.inspectionExpiry,  // REQ-007: 車検期限
      nextMaintenanceDate: vehicle.inspectionExpiry,
      maintenanceStatus: this.getMaintenanceStatus(vehicle),
      // 🆕 オペレーションパターン（DBから直接返す）
      loadingPattern: vehicle.loadingPattern ?? 2,
      unloadingPattern: vehicle.unloadingPattern ?? 2,
    };
  }''',
    '''      region: vehicle.region ?? null,
      inspectionExpiry: vehicle.inspectionExpiry,  // REQ-007: 車検期限
      nextMaintenanceDate: vehicle.inspectionExpiry,
      maintenanceStatus: this.getMaintenanceStatus(vehicle),
      // 🆕 オペレーションパターン（DBから直接返す）
      loadingPattern: vehicle.loadingPattern ?? 2,
      unloadingPattern: vehicle.unloadingPattern ?? 2,
    };
  }''',
    'vehicleService: mapVehicleToResponseDTO（確認用・変更なし）'
)

# mapVehicleToResponseDTO に直接ログ追加（別箇所）
patch(
    SVC,
    '''  private mapVehicleToResponseDTO(vehicle: any): VehicleResponseDTO {
    return {
      id: vehicle.id,''',
    '''  private mapVehicleToResponseDTO(vehicle: any): VehicleResponseDTO {
    logger.info('🔑🔑🔑 [vehicleService.mapVehicleToResponseDTO] 変換前 vehicle 完全ダンプ', {
      vehicleFull: JSON.stringify(vehicle),
      loadingPattern: vehicle.loadingPattern,
      unloadingPattern: vehicle.unloadingPattern,
    });
    return {
      id: vehicle.id,''',
    'vehicleService: mapVehicleToResponseDTO ログ追加'
)

# ============================================================
# コンパイル確認 → Push
# ============================================================
print('\n全ログ追加完了。コンパイル確認を実行します...')

errors = 0
for proj in ['backend', 'frontend/cms', 'frontend/mobile']:
    print(f'\n==== TSC: {proj} ====')
    r = subprocess.run(
        './node_modules/.bin/tsc --noEmit',
        shell=True, cwd=f'{BASE}/{proj}',
        capture_output=True, text=True
    )
    if r.stdout: print(r.stdout[-3000:])
    if r.stderr: print(r.stderr[-500:])
    if r.returncode != 0:
        errors += 1
        print(f'  ❌ コンパイルエラー: {proj}')
    else:
        print(f'  ✅ コンパイルOK: {proj}')

if errors > 0:
    print(f'\n❌ {errors}件のコンパイルエラー → Push中止')
    sys.exit(1)

print('\n==== Git commit & push ====')
def run(cmd):
    r = subprocess.run(cmd, shell=True, cwd=BASE, capture_output=True, text=True)
    if r.stdout: print(r.stdout[-2000:])
    if r.stderr: print(r.stderr[-500:], file=sys.stderr)
    return r.returncode

run('git add -A')
run('git commit -m "debug: loadingPattern/unloadingPattern 全経路詳細ログ追加\n\nフロント送信→Store→API受信→Service→Prisma→レスポンス全経路をconsole/loggerに完全出力"')
rc = run('git push origin main')
if rc == 0:
    print('\n✅✅✅ Push完了！')
else:
    print('\n❌ Push失敗')

os.remove(__file__)
print('🗑️  スクリプト自己削除完了')
