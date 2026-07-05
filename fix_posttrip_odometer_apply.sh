cd ~/projects/dump-tracker

echo "======================================================================"
echo "STEP 1: 現在のHEAD確認"
echo "======================================================================"
git log -1 --oneline
git status --short

echo ""
echo "======================================================================"
echo "STEP 2: パッチ本体を適用（自己診断付き）"
echo "======================================================================"
cat > fix_posttrip_odometer_sync.py << 'PYEOF'
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

p = "frontend/mobile/src/pages/PostTripInspection.tsx"

# ============================================================================
# 【根本原因】
# operationStore.startMileage はZustandの永続化ストアの単一フィールドであり、
# 「今開いている運行」にスコープされていない。別の運行を開始・終了する操作を
# 一度でも挟むと上書きされてしまうため、長期間またがる運行（例: 6/27開始のまま
# 数日後に降車後点検を完了させるケース）では、画面に表示される「運行開始時の
# 走行距離」と、サーバー側が保持する本当の開始時走行距離(operations.startOdometer)
# が食い違ったまま気づけない。
# 前回の修正(OperationMain.tsx)はアプリ再起動時の復元処理のみが対象で、
# アプリを起動したまま画面遷移で降車後点検に到達するケースを一切カバーして
# いなかった。
#
# 対応: PostTripInspection.tsx が画面表示された時点で必ずサーバーへ
# 現在の運行の正しい startOdometer を問い合わせ、ローカルのoperationStore値を
# 使わずサーバー値を優先する。経路に依存せず必ず効く。
# ============================================================================

ok1 = patch(p,
"""  const { 
    operationId,
    vehicleId, 
    vehicleNumber, 
    vehicleType,
    driverId,
    resetOperation,
    // ✅ Fix-S11-8: フロント累積走行距離をendOperation送信に含める
    totalDistanceKm: storedTotalDistanceKm,
    // ✅ BUG-044: 開始時走行距離（逆転チェック用）
    startMileage
  } = useOperationStore();""",
"""  const { 
    operationId,
    vehicleId, 
    vehicleNumber, 
    vehicleType,
    driverId,
    resetOperation,
    // ✅ Fix-S11-8: フロント累積走行距離をendOperation送信に含める
    totalDistanceKm: storedTotalDistanceKm,
    // ✅ BUG-044: 開始時走行距離（逆転チェック用）
    // ✅ 修正【根本原因】: ローカルキャッシュ値は別名で受け取り、
    // サーバーから取得した正しい値で上書きできるようにする
    startMileage: startMileageFromStore
  } = useOperationStore();
  // ✅ 修正【根本原因】: operationStoreのstartMileageは運行ごとにスコープされて
  // おらず、別の運行を挟むと上書きされる。表示・バリデーションともに
  // このローカル状態（初期値はstoreの値、マウント後にサーバー値で上書き）を使う。
  const [startMileage, setStartMileage] = useState<number | null>(startMileageFromStore);""",
"import部: startMileageをローカルstate化")

if not ok1:
    dump_context(p, "startMileage", "state化箇所", before=10, after=10)

ok2 = patch(p,
"""    // BUG-007: vehicleIdのDB存在確認
    const validateVehicleId = async () => {
      try {
        await apiService.getVehicleById(vehicleId);
        fetchInspectionItems();
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 400) {
          console.error('[D8] BUG-007: 不正なvehicleId検出、Storeリセット:', vehicleId);
          toast.error('車両情報が無効です。\\n再度車両を選択してください。', { duration: 6000 });
          resetOperation();
          navigate('/vehicle-info', { replace: true });
        } else {
          console.warn('[D8] BUG-007: vehicleId検証エラー（続行）:', err.message);
          fetchInspectionItems();
        }
      }
    };
    validateVehicleId();
  }, [isAuthenticated, operationId, vehicleId, navigate]);""",
"""    // BUG-007: vehicleIdのDB存在確認
    const validateVehicleId = async () => {
      try {
        await apiService.getVehicleById(vehicleId);
        fetchInspectionItems();
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 400) {
          console.error('[D8] BUG-007: 不正なvehicleId検出、Storeリセット:', vehicleId);
          toast.error('車両情報が無効です。\\n再度車両を選択してください。', { duration: 6000 });
          resetOperation();
          navigate('/vehicle-info', { replace: true });
        } else {
          console.warn('[D8] BUG-007: vehicleId検証エラー（続行）:', err.message);
          fetchInspectionItems();
        }
      }
    };
    validateVehicleId();

    // ✅ 修正【根本原因】: 画面表示のたびに必ずサーバーへ現在の運行の
    // 正しいstartOdometerを問い合わせ、ローカルキャッシュより優先する。
    // アプリ再起動を経由しない画面遷移（OperationRecordから直接「運行終了」を
    // 押すケースなど）でも必ず効くよう、経路に依存しないここで同期する。
    (async () => {
      try {
        const syncRes = await apiService.getCurrentOperation();
        const syncData: any = syncRes?.data;
        if (
          syncRes?.success &&
          syncData &&
          syncData.tripId === operationId &&
          syncData.startOdometer !== undefined &&
          syncData.startOdometer !== null
        ) {
          const serverStartOdo = Number(syncData.startOdometer);
          if (serverStartOdo !== startMileageFromStore) {
            console.warn('⚠️ [D8] startMileageのズレを検知しサーバー値で補正', {
              local: startMileageFromStore,
              server: serverStartOdo,
              operationId
            });
          }
          setStartMileage(serverStartOdo);
        }
      } catch (syncErr) {
        console.warn('⚠️ [D8] startOdometer同期チェック失敗（ローカル値のまま続行）', syncErr);
      }
    })();
  }, [isAuthenticated, operationId, vehicleId, navigate]);""",
"init useEffect: サーバーからstartOdometerを取得しstartMileageを補正")

if not ok2:
    dump_context(p, "validateVehicleId", "init-useEffect", before=5, after=45)

print("\\n=== PATCH_RESULT 1=%s 2=%s ===" % (ok1, ok2))
sys.exit(0 if (ok1 and ok2) else 1)
PYEOF

python3 fix_posttrip_odometer_sync.py
PATCH_STATUS=$?

echo ""
echo "======================================================================"
echo "STEP 3: パッチ用一時ファイルの後片付け"
echo "======================================================================"
rm -f fix_posttrip_odometer_sync.py
echo "✅ 削除済み"

if [ $PATCH_STATUS -ne 0 ]; then
  echo ""
  echo "❌ パッチが適用できませんでした。上の診断出力をそのまま貼り戻してください。"
  echo "   コンパイル・commit・pushは実行しません。"
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
git commit -m "fix: PostTripInspection画面表示時にサーバーから正しいstartOdometerを取得し、アプリ再起動を経由しない画面遷移でも走行距離バリデーション不整合を解消"
git push origin main

echo ""
echo "======================================================================"
echo "完了。この後GitHub Actionsの「Deploy to Staging」を手動実行してください。"
echo "======================================================================"
