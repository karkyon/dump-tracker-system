cd ~/projects/dump-tracker && git status --short | head -5 && echo "---HEAD---" && git log -1 --oneline && cat > fix_operation_resume_sync_v2.py << 'PYEOF'
import re, sys

def patch(path, old, new, label):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    if new in src:
        print(f"SKIP(既に適用済み) [{label}]")
        return True
    cnt = src.count(old)
    if cnt == 1:
        src = src.replace(old, new)
        with open(path, "w", encoding="utf-8") as f:
            f.write(src)
        print(f"OK [{label}]")
        return True
    print(f"NG [{label}]: count={cnt}  ← アンカー不一致。診断情報を出力します")
    return False

def dump_context(path, marker, label, before=5, after=40):
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if marker in line:
            start = max(0, i - before)
            end = min(len(lines), i + after)
            print(f"\n===== [{label}] {path} の {marker!r} 周辺（{start+1}〜{end}行目）実際の内容 =====")
            for j in range(start, end):
                print(f"{j+1:5d}| {lines[j]}", end='')
            print(f"===== ここまで [{label}] =====\n")
            return
    print(f"⚠️ [{label}] マーカー {marker!r} 自体が {path} に見つかりません")

pA = "backend/src/controllers/mobileController.ts"
pB = "frontend/mobile/src/pages/OperationMain.tsx"

ok_a = patch(pA,
"""      const mobileResponse = {
        tripId: currentTrip.id,
        status: currentTrip.status,
        startTime: startTime || new Date(),
        duration: duration || 0,
        totalDistance: currentTrip.totalDistanceKm ? Number(currentTrip.totalDistanceKm) : 0,
        vehicleInfo: currentTrip.vehicle ? {
          id: currentTrip.vehicle.id,
          plateNumber: currentTrip.vehicle.plateNumber,
          model: currentTrip.vehicle.model
        } : undefined,
        driverInfo: currentTrip.driver ? {
          id: currentTrip.driver.id,
          name: currentTrip.driver.name
        } : undefined
      };""",
"""      const mobileResponse = {
        tripId: currentTrip.id,
        status: currentTrip.status,
        startTime: startTime || new Date(),
        duration: duration || 0,
        totalDistance: currentTrip.totalDistanceKm ? Number(currentTrip.totalDistanceKm) : 0,
        // ✅ 修正【根本原因】: 運行再開時にフロントがローカルの古いstartMileageを
        // サーバーの正しい値で補正できるよう、この運行開始時点の走行距離を返す
        startOdometer: (currentTrip as any).startOdometer !== null && (currentTrip as any).startOdometer !== undefined
          ? Number((currentTrip as any).startOdometer)
          : undefined,
        vehicleInfo: currentTrip.vehicle ? {
          id: currentTrip.vehicle.id,
          plateNumber: currentTrip.vehicle.plateNumber,
          model: currentTrip.vehicle.model,
          // ✅ 修正【根本原因】: 車両マスタの最新オペレーションパターンを
          // 運行再開のたびに返し、モバイル側キャッシュとのズレを補正可能にする
          loadingPattern: (currentTrip.vehicle as any).loadingPattern ?? 2,
          unloadingPattern: (currentTrip.vehicle as any).unloadingPattern ?? 2,
        } : undefined,
        driverInfo: currentTrip.driver ? {
          id: currentTrip.driver.id,
          name: currentTrip.driver.name
        } : undefined
      };""",
"backend: getCurrentOperationレスポンス拡張")

if not ok_a:
    dump_context(pA, "public getCurrentOperation = asyncHandler", "backend-A")

ok_b = patch(pB,
"""      // ✅ BUG-NEW: operationStore に既存operationId(IN_PROGRESS)がある場合はAPIスキップして復元
      const storedOperationId = operationStore.operationId;
      const storedStatus = operationStore.status;
      if (storedOperationId && storedStatus === 'IN_PROGRESS') {
        console.log('✅ [OperationMain] operationStore に既存IN_PROGRESS運行あり → 復元のみ実行', {
          operationId: storedOperationId
        });
        // sessionStorage の inspection_completed を復元
        if (!sessionStorage.getItem('inspection_completed')) {
          // inspection_completed はoperationStore.inspectionCompletedで管理（sessionStorage廃止）
        }
        setOperation(prev => ({
          ...prev,
          id: storedOperationId,
          status: 'running'
        }));
        setIsInitializing(false);
        // 運行記録画面へ遷移
        navigate('/operation-record', { replace: true });
        return;
      }""",
"""      // ✅ BUG-NEW: operationStore に既存operationId(IN_PROGRESS)がある場合はAPIスキップして復元
      const storedOperationId = operationStore.operationId;
      const storedStatus = operationStore.status;
      if (storedOperationId && storedStatus === 'IN_PROGRESS') {
        console.log('✅ [OperationMain] operationStore に既存IN_PROGRESS運行あり → 復元のみ実行', {
          operationId: storedOperationId
        });
        // sessionStorage の inspection_completed を復元
        if (!sessionStorage.getItem('inspection_completed')) {
          // inspection_completed はoperationStore.inspectionCompletedで管理（sessionStorage廃止）
        }
        // ✅ 修正【根本原因】: ショートカット復元時も、ローカルの
        // startMileage / loadingPattern / unloadingPattern がサーバー側の
        // 正しい値とズレていないか必ず確認・補正する。
        try {
          const syncRes = await apiService.getCurrentOperation();
          const syncData: any = syncRes?.data;
          if (syncRes?.success && syncData && syncData.tripId === storedOperationId) {
            const updates: { startMileage?: number; loadingPattern?: number; unloadingPattern?: number } = {};
            if (syncData.startOdometer !== undefined && syncData.startOdometer !== null) {
              const serverStartOdo = Number(syncData.startOdometer);
              if (serverStartOdo !== operationStore.startMileage) {
                updates.startMileage = serverStartOdo;
              }
            }
            if (syncData.vehicleInfo?.loadingPattern !== undefined && syncData.vehicleInfo.loadingPattern !== null) {
              const serverLp = Number(syncData.vehicleInfo.loadingPattern);
              if (serverLp !== operationStore.loadingPattern) {
                updates.loadingPattern = serverLp;
              }
            }
            if (syncData.vehicleInfo?.unloadingPattern !== undefined && syncData.vehicleInfo.unloadingPattern !== null) {
              const serverUp = Number(syncData.vehicleInfo.unloadingPattern);
              if (serverUp !== operationStore.unloadingPattern) {
                updates.unloadingPattern = serverUp;
              }
            }
            if (Object.keys(updates).length > 0) {
              console.warn('⚠️ [OperationMain] startMileage/オペレーションパターンのズレを検知し補正', {
                local: {
                  startMileage: operationStore.startMileage,
                  loadingPattern: operationStore.loadingPattern,
                  unloadingPattern: operationStore.unloadingPattern,
                },
                server: syncData,
                updates,
                operationId: storedOperationId
              });
              operationStore.setVehicleInfo({
                vehicleId: operationStore.vehicleId || '',
                vehicleNumber: operationStore.vehicleNumber || '',
                vehicleType: operationStore.vehicleType || '',
                startMileage: updates.startMileage ?? (operationStore.startMileage ?? 0),
                capacity: operationStore.vehicleCapacity ?? undefined,
                loadingPattern: updates.loadingPattern ?? operationStore.loadingPattern,
                unloadingPattern: updates.unloadingPattern ?? operationStore.unloadingPattern,
              });
            }
          }
        } catch (syncErr) {
          console.warn('⚠️ [OperationMain] startMileage/パターン同期チェック失敗（継続。既存ローカル値のまま復元）', syncErr);
        }
        setOperation(prev => ({
          ...prev,
          id: storedOperationId,
          status: 'running'
        }));
        setIsInitializing(false);
        // 運行記録画面へ遷移
        navigate('/operation-record', { replace: true });
        return;
      }""",
"frontend: 復元ショートカット同期処理追加")

if not ok_b:
    dump_context(pB, "BUG-NEW: operationStore に既存operationId", "frontend-B")

print("\n=== 結果: backend=%s, frontend=%s ===" % (ok_a, ok_b))
if not (ok_a and ok_b):
    print("⚠️ 上記の診断情報（実際のファイル内容）をそのまま貼り戻してください。次で確実に当てます。")
    sys.exit(1)
print("✅ 両方成功。コンパイル確認へ進んでください。")
PYEOF
python3 fix_operation_resume_sync_v2.py
