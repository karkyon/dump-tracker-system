#!/usr/bin/env python3
"""
loadingPattern/unloadingPattern 型追加 + デバッグログ全削除
"""
import subprocess, sys, os

REPO = os.path.expanduser("~/projects/dump-tracker")

def patch(rel, old, new, label):
    path = os.path.join(REPO, rel)
    with open(path, encoding="utf-8") as f:
        src = f.read()
    if old not in src:
        print(f"  ⚠️  SKIP [{label}]")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(src.replace(old, new, 1))
    print(f"  ✅ [{label}]")

# ============================================================
# 1. Vehicle 型に loadingPattern/unloadingPattern 追加
# ============================================================
patch(
    "frontend/cms/src/types/index.ts",
    "  // 🆕 P4-03: 管轄区域（地方運輸局）実績報告書の地域別集計に使用\n  region?: TransportRegion | null;\n}",
    "  // 🆕 P4-03: 管轄区域（地方運輸局）実績報告書の地域別集計に使用\n  region?: TransportRegion | null;\n  // 🆕 オペレーションパターン\n  loadingPattern?: number;\n  unloadingPattern?: number;\n}",
    "cms/types/index.ts: Vehicle に loadingPattern/unloadingPattern 追加"
)

# ============================================================
# 2. vehicleController.ts デバッグログ削除
# ============================================================
patch(
    "backend/src/controllers/vehicleController.ts",
    """      logger.info('🔑🔑🔑 [vehicleController.updateVehicle] リクエスト受信完全ダンプ', {
        vehicleId,
        requestBody: JSON.stringify(req.body),
        loadingPattern: (req.body as any).loadingPattern,
        loadingPatternType: typeof (req.body as any).loadingPattern,
        unloadingPattern: (req.body as any).unloadingPattern,
        unloadingPatternType: typeof (req.body as any).unloadingPattern,
      });

""",
    "",
    "vehicleController: updateVehicle デバッグログ削除（受信）"
)

patch(
    "backend/src/controllers/vehicleController.ts",
    """      logger.info('🔑🔑🔑 [vehicleController.updateVehicle] 更新完了 完全ダンプ', {
        vehicleId,
        plateNumber: updatedVehicle.plateNumber,
        loadingPattern: (updatedVehicle as any).loadingPattern,
        unloadingPattern: (updatedVehicle as any).unloadingPattern,
        updatedVehicleFull: JSON.stringify(updatedVehicle),
        updatedBy: userId,
        userRole
      });

""",
    "",
    "vehicleController: updateVehicle デバッグログ削除（完了）"
)

# ============================================================
# 3. vehicleService.ts デバッグログ削除
# ============================================================
patch(
    "backend/src/services/vehicleService.ts",
    """      logger.info('🔑🔑🔑 [vehicleService.updateVehicle] 更新開始 完全ダンプ', {
        vehicleId,
        updateDataFull: JSON.stringify(updateData),
        loadingPattern: (updateData as any).loadingPattern,
        loadingPatternType: typeof (updateData as any).loadingPattern,
        unloadingPattern: (updateData as any).unloadingPattern,
        unloadingPatternType: typeof (updateData as any).unloadingPattern,
        context
      });

""",
    "",
    "vehicleService: updateVehicle 開始デバッグログ削除"
)

patch(
    "backend/src/services/vehicleService.ts",
    """        logger.info('🔑🔑🔑 [vehicleService] Prisma update 直前 updateDataPrepared 完全ダンプ', {
          updateDataPreparedFull: JSON.stringify(updateDataPrepared),
          loadingPattern: updateDataPrepared.loadingPattern,
          unloadingPattern: updateDataPrepared.unloadingPattern,
        });
""",
    "",
    "vehicleService: Prisma update 直前デバッグログ削除"
)

patch(
    "backend/src/services/vehicleService.ts",
    """        logger.info('🔑🔑🔑 [vehicleService] Prisma update 完了 完全ダンプ', {
          vehicleFull: JSON.stringify(vehicle),
          loadingPattern: (vehicle as any).loadingPattern,
          unloadingPattern: (vehicle as any).unloadingPattern,
        });

""",
    "",
    "vehicleService: Prisma update 完了デバッグログ削除"
)

patch(
    "backend/src/services/vehicleService.ts",
    """    logger.info('🔑🔑🔑 [vehicleService.mapVehicleToResponseDTO] 変換前 vehicle 完全ダンプ', {
      vehicleFull: JSON.stringify(vehicle),
      loadingPattern: vehicle.loadingPattern,
      unloadingPattern: vehicle.unloadingPattern,
    });
""",
    "",
    "vehicleService: mapVehicleToResponseDTO デバッグログ削除"
)

# ============================================================
# 4. vehicleStore.ts デバッグログ削除
# ============================================================
patch(
    "frontend/cms/src/store/vehicleStore.ts",
    """      console.log('[VehicleStore] 🔑 送信データ完全ダンプ:', JSON.stringify(backendData, null, 2));
      console.log('[VehicleStore] 🔑 loadingPattern送信値:', backendData.loadingPattern, 'typeof:', typeof backendData.loadingPattern);
      console.log('[VehicleStore] 🔑 unloadingPattern送信値:', backendData.unloadingPattern, 'typeof:', typeof backendData.unloadingPattern);

""",
    "",
    "vehicleStore: updateVehicle 送信ダンプログ削除"
)

patch(
    "frontend/cms/src/store/vehicleStore.ts",
    """      console.log('[VehicleStore] updateVehicle APIレスポンス:', response);
      console.log('[VehicleStore] 🔑 APIレスポンス完全ダンプ:', JSON.stringify(response, null, 2));
      console.log('[VehicleStore] 🔑 レスポンス loadingPattern:', (response as any)?.data?.loadingPattern);
      console.log('[VehicleStore] 🔑 レスポンス unloadingPattern:', (response as any)?.data?.unloadingPattern);

""",
    "",
    "vehicleStore: updateVehicle レスポンスダンプログ削除"
)

patch(
    "frontend/cms/src/store/vehicleStore.ts",
    """      console.log('[VehicleStore] 🔑 送信データ完全ダンプ:', JSON.stringify(backendData, null, 2));
      console.log('[VehicleStore] 🔑 loadingPattern送信値:', backendData.loadingPattern, 'typeof:', typeof backendData.loadingPattern);
      console.log('[VehicleStore] 🔑 unloadingPattern送信値:', backendData.unloadingPattern, 'typeof:', typeof backendData.unloadingPattern);

      const response = await vehicleAPI.createVehicle(backendData);""",
    "      const response = await vehicleAPI.createVehicle(backendData);",
    "vehicleStore: createVehicle 送信ダンプログ削除（もし存在すれば）"
)

# ============================================================
# 5. VehicleManagement.tsx の (vehicle as any) を Vehicle 型フィールドで置換
# ============================================================
# handleEdit 内
patch(
    "frontend/cms/src/pages/VehicleManagement.tsx",
    "      loadingPattern: (vehicle as any).loadingPattern ?? 2,    // 🆕\n      unloadingPattern: (vehicle as any).unloadingPattern ?? 2, // 🆕",
    "      loadingPattern: vehicle.loadingPattern ?? 2,\n      unloadingPattern: vehicle.unloadingPattern ?? 2,",
    "VehicleManagement: handleEdit の as any キャスト除去"
)

print("\n修正完了。コンパイル確認を実行します...")

ok = True
for proj in ["backend", "frontend/cms", "frontend/mobile"]:
    print(f"==== TSC: {proj} ====")
    r = subprocess.run(
        ["./node_modules/.bin/tsc", "--noEmit"],
        cwd=os.path.join(REPO, proj),
        capture_output=True, text=True
    )
    if r.returncode == 0:
        print(f"  ✅ コンパイルOK: {proj}")
    else:
        print(f"  ❌ コンパイルエラー: {proj}")
        print(r.stdout[-3000:])
        print(r.stderr[-1000:])
        ok = False

if not ok:
    print("❌ コンパイルエラーあり。Push中止。")
    sys.exit(1)

print("==== Git commit & push ====")
subprocess.run(["git", "add", "-A"], cwd=REPO, check=True)
subprocess.run(["git", "commit", "-m",
    "refactor: Vehicle型にloadingPattern/unloadingPattern追加、デバッグログ全削除"],
    cwd=REPO, check=True)
r = subprocess.run(["git", "push", "origin", "main"], cwd=REPO, capture_output=True, text=True)
print(r.stdout); print(r.stderr)
if r.returncode != 0:
    print("❌ Push失敗"); sys.exit(1)
print("✅✅✅ Push完了！")

os.remove(__file__)
print("🗑️  スクリプト自己削除完了")
