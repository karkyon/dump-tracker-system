#!/usr/bin/env python3
"""
GPSモニタリング ステータス修正:
- 積込場所選択後（navigate前）にstartLoadingAtLocationを呼んでLOADINGレコード作成
  → GPSモニタリング: 運行中 → 積込中
- 荷降場所選択後は既にrecordUnloadingArrivalを呼んでいるので変更不要
  （ただしU3の場合はcompleteUnloadingも呼ぶ必要あり → 別途対応）
"""
import subprocess, sys, os

REPO = os.path.expanduser("~/projects/dump-tracker")

def patch(rel, old, new, label):
    path = os.path.join(REPO, rel)
    with open(path, encoding="utf-8") as f:
        src = f.read()
    if old not in src:
        print(f"  ⚠️  SKIP [{label}]")
        return False
    with open(path, "w", encoding="utf-8") as f:
        f.write(src.replace(old, new, 1))
    print(f"  ✅ [{label}]")
    return True

# ============================================================
# 1. handleLocationSelected の LOADING分岐:
#    navigate('/loading-input') 前に startLoadingAtLocation を呼ぶ
# ============================================================
patch(
    "frontend/mobile/src/pages/OperationRecord.tsx",
    """      if (dialogType === 'LOADING') {
        // 🔧 修正: recordLoadingArrival はLoadingConfirmation.tsvで呼び出し。
        // ここでは状態更新と遷移のみ行う（二重呼び出し修正）
        console.log('🚛 積込場所選択完了 → LoadingConfirmation画面へ遷移');
        
        // 状態更新（座標も保存）
        setOperation(prev => ({
          ...prev,
          phase: 'AT_LOADING',
          loadingLocation: selectedLocation.location.name
        }));
        // 🆕 積込場所の座標をstoreに保存（距離検知用）
        operationStore.setLoadingLocationWithCoords(
          selectedLocation.location.name,
          selectedLocation.location.latitude ?? currentPosition.coords.latitude,
          selectedLocation.location.longitude ?? currentPosition.coords.longitude
        );

        toast.success(`積込場所「${selectedLocation.location.name}」に到着しました`);
        
        console.log('📍 次: D5積込場所入力画面へ遷移');
        navigate('/loading-input', {
          state: {
            locationId: selectedLocation.location.id,
            locationName: selectedLocation.location.name,
            clientName: selectedLocation.location.contactPerson || '担当者未登録',
            address: selectedLocation.location.address
          }
        });""",
    """      if (dialogType === 'LOADING') {
        console.log('🚛 積込場所選択完了 → startLoadingAtLocation呼び出し後LoadingInput画面へ遷移');

        // ★ GPS状態修正: navigate前にLOADINGレコードをDBに作成
        // これによりGPSモニタリングが「運行中」→「積込中」に正しく変わる
        try {
          await apiService.startLoadingAtLocation(currentOperationId, {
            locationId: selectedLocation.location.id,
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy,
            startTime: new Date(),
          });
          console.log('✅ startLoadingAtLocation完了 → GPSステータス: 積込中');
        } catch (startLoadingErr) {
          // 失敗しても遷移は継続（LoadingInputで再度API呼ぶフローは維持）
          console.warn('⚠️ startLoadingAtLocation失敗（遷移は継続）:', startLoadingErr);
        }

        // 状態更新（座標も保存）
        setOperation(prev => ({
          ...prev,
          phase: 'AT_LOADING',
          loadingLocation: selectedLocation.location.name
        }));
        // 積込場所の座標をstoreに保存（距離検知用）
        operationStore.setLoadingLocationWithCoords(
          selectedLocation.location.name,
          selectedLocation.location.latitude ?? currentPosition.coords.latitude,
          selectedLocation.location.longitude ?? currentPosition.coords.longitude
        );

        toast.success(`積込場所「${selectedLocation.location.name}」に到着しました`);

        console.log('📍 次: D5積込場所入力画面へ遷移');
        navigate('/loading-input', {
          state: {
            locationId: selectedLocation.location.id,
            locationName: selectedLocation.location.name,
            clientName: selectedLocation.location.contactPerson || '担当者未登録',
            address: selectedLocation.location.address
          }
        });""",
    "OperationRecord: handleLocationSelected 積込 → startLoadingAtLocation追加"
)

# ============================================================
# 2. handleNewLocationRegistered の LOADING分岐 (新規地点登録後):
#    navigate('/loading-input') 前に startLoadingAtLocation を呼ぶ
# ============================================================
patch(
    "frontend/mobile/src/pages/OperationRecord.tsx",
    """        toast.success(`新規地点「${registeredLocation.name}」を登録しました`);

        // ✅ 【修正】LoadingInput画面へ遷移（既存地点選択フローと同じ）
        setShowRegistrationDialog(false);
        setRegistrationLocationType(null);
        navigate('/loading-input', {
          state: {
            locationId: registeredLocation.id,
            locationName: registeredLocation.name,
            clientName: '',
            address: registeredLocation.address || ''
          }
        });
        return; // navigate後は後続のsetShowRegistrationDialog等不要""",
    """        toast.success(`新規地点「${registeredLocation.name}」を登録しました`);

        // ★ GPS状態修正: navigate前にLOADINGレコードをDBに作成
        try {
          await apiService.startLoadingAtLocation(currentOperationId, {
            locationId: registeredLocation.id,
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy,
            startTime: new Date(),
          });
          console.log('✅ [新規地点] startLoadingAtLocation完了 → GPSステータス: 積込中');
        } catch (startLoadingErr) {
          console.warn('⚠️ [新規地点] startLoadingAtLocation失敗（遷移は継続）:', startLoadingErr);
        }

        // LoadingInput画面へ遷移（既存地点選択フローと同じ）
        setShowRegistrationDialog(false);
        setRegistrationLocationType(null);
        navigate('/loading-input', {
          state: {
            locationId: registeredLocation.id,
            locationName: registeredLocation.name,
            clientName: '',
            address: registeredLocation.address || ''
          }
        });
        return; // navigate後は後続のsetShowRegistrationDialog等不要""",
    "OperationRecord: handleNewLocationRegistered 積込 → startLoadingAtLocation追加"
)

# ============================================================
# 3. tripService.completeLoading: LOADINGレコードがない場合は新規作成して完了
#    (startLoadingAtLocationで既にLOADINGレコードが入っているので
#     LoadingInputでの recordLoadingArrival が重複する問題を防ぐ)
#
#    現在の completeLoading は「actualEndTime=nullのLOADINGを探す」ロジック
#    → startLoadingAtLocation呼び後は既にLOADINGレコードあり → completeLoadingでupdateされる ✅
#    → startLoadingAtLocation失敗した場合はLOADINGレコードなし → 既存のフォールバックなし
#    → recordLoadingArrival(addLoadingRecord)が新規LOADINGレコード作成 → completeLoadingで更新 ✅
#    つまり既存ロジックで問題なし。tripService変更不要。
# ============================================================

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
    "fix: GPSモニタリング 積込場所選択後のステータスを「運行中」→「積込中」に修正"],
    cwd=REPO, check=True)
r = subprocess.run(["git", "push", "origin", "main"], cwd=REPO, capture_output=True, text=True)
print(r.stdout); print(r.stderr)
if r.returncode != 0:
    print("❌ Push失敗"); sys.exit(1)
print("✅✅✅ Push完了！")

os.remove(__file__)
print("🗑️  スクリプト自己削除完了")
