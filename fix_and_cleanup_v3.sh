cd ~/projects/dump-tracker

echo "======================================================================"
echo "STEP 0: 誤ってpushされたゴミファイルを削除"
echo "======================================================================"
if [ -f fix_operation_resume_sync_v2_apply.sh ]; then
  git rm -f fix_operation_resume_sync_v2_apply.sh
  git commit -m "chore: 誤ってpushされたパッチスクリプトファイルを削除"
  echo "✅ ゴミファイルをコミット削除しました（この後まとめてpushします）"
else
  echo "ℹ️ ゴミファイルは既にありません"
fi

echo ""
echo "======================================================================"
echo "STEP 1: 現在のHEADとブランチ確認"
echo "======================================================================"
git log -1 --oneline
git status --short

echo ""
echo "======================================================================"
echo "STEP 2: パッチ本体を適用（自己診断付き）"
echo "======================================================================"
cat > fix_operation_resume_sync_v3.py << 'PYEOF'
import sys

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
    print(f"NG [{label}]: count={cnt}")
    return False

def dump_context(path, marker, label, before=5, after=40):
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if marker in line:
            start = max(0, i - before)
            end = min(len(lines), i + after)
            print(f"\n===== [{label}] {path} の {marker!r} 周辺（{start+1}〜{end}行目） =====")
            for j in range(start, end):
                print(f"{j+1:5d}| {lines[j]}", end='')
            print(f"===== ここまで [{label}] =====\n")
            return
    print(f"⚠️ [{label}] マーカー {marker!r} 自体が見つかりません")

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

print("\n=== PATCH_RESULT backend=%s frontend=%s ===" % (ok_a, ok_b))
sys.exit(0 if (ok_a and ok_b) else 1)
PYEOF

python3 fix_operation_resume_sync_v3.py
PATCH_STATUS=$?

echo ""
echo "======================================================================"
echo "STEP 3: パッチ用スクリプトの後片付け（ゴミファイルとして残さない）"
echo "======================================================================"
rm -f fix_operation_resume_sync_v3.py
echo "✅ 削除済み"

if [ $PATCH_STATUS -ne 0 ]; then
  echo ""
  echo "❌ パッチが適用できませんでした。上の診断出力（実際のファイル内容）をそのまま貼り戻してください。"
  echo "   ここで処理を中断します。コンパイル・commit・pushは実行しません。"
  exit 1
fi

echo ""
echo "======================================================================"
echo "STEP 4: 3プロジェクトのコンパイル確認"
echo "======================================================================"
cd backend && ./node_modules/.bin/tsc --noEmit && echo "BACKEND_OK" || { echo "❌ BACKEND コンパイルエラー。中断します"; exit 1; }
cd ..
cd frontend/cms && ./node_modules/.bin/tsc --noEmit && echo "CMS_OK" || { echo "❌ CMS コンパイルエラー。中断します"; exit 1; }
cd ../..
cd frontend/mobile && ./node_modules/.bin/tsc --noEmit && echo "MOBILE_OK" || { echo "❌ MOBILE コンパイルエラー。中断します"; exit 1; }
cd ../..

echo ""
echo "======================================================================"
echo "STEP 5: コンパイル0件を確認できたのでcommit & push"
echo "======================================================================"
git add -A
git commit -m "fix: 運行再開時にstartMileage・積込/荷降パターンをサーバー側の最新値と同期・補正する処理を追加"
git push origin main

echo ""
echo "======================================================================"
echo "完了。この後GitHub Actionsの「Deploy to Staging」を手動実行してください。"
echo "======================================================================"
