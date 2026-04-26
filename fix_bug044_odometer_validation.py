#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_bug044_odometer_validation.py
BUG-044: PostTripInspection.tsx — endOdometer が startMileage を下回る場合のフロントバリデーション未実装
修正内容:
  1. handleComplete() に startMileage > endOdometer の逆転チェック追加
  2. 入力フィールドに開始時距離を表示（参考情報）
  3. リアルタイム入力バリデーション（onChange時に警告表示）
  4. バックエンドも同様に startOdometer との逆転チェック追加（mobileController.ts）
"""
import subprocess, sys, os

REPO = os.path.expanduser("~/dump-tracker")

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ Written: {path}")

def patch_postTripInspection():
    path = f"{REPO}/frontend/mobile/src/pages/PostTripInspection.tsx"
    content = read(path)

    if "BUG-044" in content:
        print("  ⚠️ 既に修正済み — スキップ")
        return True

    # 1. startMileage を useOperationStore から取得に追加
    old_store = """  const { 
    operationId,
    vehicleId, 
    vehicleNumber, 
    vehicleType,
    driverId,
    resetOperation,
    // ✅ Fix-S11-8: フロント累積走行距離をendOperation送信に含める
    totalDistanceKm: storedTotalDistanceKm
  } = useOperationStore();"""

    new_store = """  const { 
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
  } = useOperationStore();"""

    if old_store not in content:
        print("  ❌ useOperationStore destructuring パターン未発見")
        return False
    content = content.replace(old_store, new_store, 1)
    print("  ✅ startMileage 取得追加")

    # 2. 逆転チェックをhandleComplete内の必須チェック直後に追加
    old_validate = """      if (!endOdometer) {
        toast.error('運行終了時の走行距離を入力してください');
        return;
      }

      // ✅ TypeScript修正: vehicleId/driverId/operationIdのnullチェック"""

    new_validate = """      if (!endOdometer) {
        toast.error('運行終了時の走行距離を入力してください');
        return;
      }

      // ✅ BUG-044: 開始時走行距離との逆転チェック
      if (startMileage !== null && startMileage !== undefined && endOdometer <= startMileage) {
        toast.error(
          `終了時の走行距離（${endOdometer} km）が開始時（${startMileage} km）以下です。\\n正しい値を入力してください。`,
          { duration: 6000 }
        );
        console.error('[D8] ❌ BUG-044: オドメーター逆転検知', {
          startMileage,
          endOdometer,
          diff: endOdometer - startMileage
        });
        return;
      }

      // ✅ TypeScript修正: vehicleId/driverId/operationIdのnullチェック"""

    if old_validate not in content:
        print("  ❌ handleComplete バリデーションパターン未発見")
        return False
    content = content.replace(old_validate, new_validate, 1)
    print("  ✅ handleComplete 逆転チェック追加")

    # 3. 入力フィールドに開始時距離の参考表示を追加
    old_input_label = """          <label className="flex items-center space-x-2 mb-3">
            <Gauge className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-bold text-gray-800">
              <span className="text-red-600">*</span> 運行終了時の走行距離 (km)
            </span>
          </label>
          <input
            type="number"
            step="0.1"
            value={endOdometer || ''}
            onChange={(e) => setEndOdometer(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="例: 12567.5"
            className="w-full px-4 py-3 text-lg font-semibold border-2 border-amber-300 rounded-lg
              focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200
              transition-all duration-200"
          />
          <p className="text-xs text-gray-600 mt-2">
            ※ 開始時からの走行距離を自動計算するため、正確な値を入力してください
          </p>"""

    new_input_label = """          <label className="flex items-center space-x-2 mb-3">
            <Gauge className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-bold text-gray-800">
              <span className="text-red-600">*</span> 運行終了時の走行距離 (km)
            </span>
          </label>
          {/* ✅ BUG-044: 開始時距離の参考表示 */}
          {startMileage !== null && startMileage !== undefined && (
            <div className="mb-2 px-3 py-2 bg-amber-100 rounded-lg text-sm text-amber-800 font-medium">
              📍 運行開始時の走行距離: <strong>{startMileage.toLocaleString()} km</strong>
              　→ 終了時はこの値より大きい値を入力してください
            </div>
          )}
          <input
            type="number"
            step="0.1"
            value={endOdometer || ''}
            onChange={(e) => {
              const val = e.target.value ? parseFloat(e.target.value) : null;
              setEndOdometer(val);
            }}
            placeholder={startMileage ? `${startMileage} より大きい値` : '例: 12567.5'}
            className={`w-full px-4 py-3 text-lg font-semibold border-2 rounded-lg
              focus:outline-none focus:ring-2 transition-all duration-200
              ${endOdometer !== null && startMileage !== null && startMileage !== undefined && endOdometer <= startMileage
                ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50'
                : 'border-amber-300 focus:border-amber-500 focus:ring-amber-200'
              }`}
          />
          {/* ✅ BUG-044: リアルタイム逆転エラー表示 */}
          {endOdometer !== null && startMileage !== null && startMileage !== undefined && endOdometer <= startMileage && (
            <p className="text-xs text-red-600 font-bold mt-1">
              ⚠️ 終了距離（{endOdometer} km）が開始距離（{startMileage} km）以下です！正しい値を入力してください。
            </p>
          )}
          {endOdometer !== null && startMileage !== null && startMileage !== undefined && endOdometer > startMileage && (
            <p className="text-xs text-green-600 font-bold mt-1">
              ✅ 走行距離: {(endOdometer - startMileage).toFixed(1)} km
            </p>
          )}
          <p className="text-xs text-gray-600 mt-2">
            ※ 開始時からの走行距離を自動計算するため、正確な値を入力してください
          </p>"""

    if old_input_label not in content:
        print("  ❌ input フィールドパターン未発見")
        return False
    content = content.replace(old_input_label, new_input_label, 1)
    print("  ✅ 入力フィールドに開始時距離参考表示 + リアルタイムバリデーション追加")

    # 4. 運行終了ボタンのdisabled条件にも逆転チェックを追加
    old_btn = """            disabled={isLoading || !allChecked || !endOdometer}"""
    new_btn = """            disabled={isLoading || !allChecked || !endOdometer || (startMileage !== null && startMileage !== undefined && endOdometer !== null && endOdometer <= startMileage)}"""

    if old_btn not in content:
        print("  ⚠️ ボタンdisabled パターン未発見 — スキップ")
    else:
        content = content.replace(old_btn, new_btn, 1)
        print("  ✅ 運行終了ボタン disabled 条件に逆転チェック追加")

    write(path, content)
    return True

def patch_mobileController_backend():
    """バックエンド: mobileController.ts に startOdometer との逆転チェック追加"""
    path = f"{REPO}/backend/src/controllers/mobileController.ts"
    content = read(path)

    if "BUG-044" in content:
        print("  ⚠️ mobileController.ts 既に修正済み — スキップ")
        return True

    old = """      // ✅ BUG-043修正: endOdometer のバリデーション（マイナスや文字列を除外）
      const rawEndOdometer = req.body.endOdometer;
      const validEndOdometer = rawEndOdometer !== undefined && rawEndOdometer !== null
        && !isNaN(Number(rawEndOdometer)) && Number(rawEndOdometer) > 0
        ? Number(rawEndOdometer)
        : undefined;
      if (rawEndOdometer !== undefined && validEndOdometer === undefined) {
        logger.warn('🛣️ [BUG-043] endOdometer が無効値のためスキップ', {
          rawEndOdometer, tripId
        });
      }"""

    new = """      // ✅ BUG-043修正: endOdometer のバリデーション（マイナスや文字列を除外）
      const rawEndOdometer = req.body.endOdometer;
      const validEndOdometer = rawEndOdometer !== undefined && rawEndOdometer !== null
        && !isNaN(Number(rawEndOdometer)) && Number(rawEndOdometer) > 0
        ? Number(rawEndOdometer)
        : undefined;
      if (rawEndOdometer !== undefined && validEndOdometer === undefined) {
        logger.warn('🛣️ [BUG-043] endOdometer が無効値のためスキップ', {
          rawEndOdometer, tripId
        });
      }

      // ✅ BUG-044: バックエンド側でも startOdometer との逆転チェック
      // フロント未通過の場合（API直接呼び出し等）の防衛コード
      if (validEndOdometer !== undefined) {
        const currentOp = await (async () => {
          try {
            const prisma = (this as any).tripService?.operationService?.prisma
              || require('../utils/database').DatabaseService.getInstance();
            return await prisma.operation.findUnique({
              where: { id: tripId },
              select: { startOdometer: true }
            });
          } catch { return null; }
        })();
        if (currentOp?.startOdometer !== null && currentOp?.startOdometer !== undefined) {
          const startOdo = Number(currentOp.startOdometer);
          if (validEndOdometer <= startOdo) {
            logger.warn('🛣️ [BUG-044] ❌ endOdometer が startOdometer 以下のため拒否', {
              startOdometer: startOdo, endOdometer: validEndOdometer, tripId
            });
            sendError(res,
              `終了走行距離(${validEndOdometer}km)が開始走行距離(${startOdo}km)以下です。正しい値を入力してください。`,
              400, 'ODOMETER_REVERSED'
            );
            return;
          }
        }
      }"""

    if old not in content:
        print("  ❌ mobileController BUG-043パターン未発見")
        return False
    content = content.replace(old, new, 1)
    write(path, content)
    print("  ✅ mobileController.ts バックエンド逆転チェック追加")
    return True

def tsc_check():
    print("\n" + "="*60)
    print("コンパイルチェック")
    print("="*60)
    all_ok = True
    for name, cwd in [
        ("Backend",  f"{REPO}/backend"),
        ("Mobile",   f"{REPO}/frontend/mobile"),
        ("CMS",      f"{REPO}/frontend/cms"),
    ]:
        r = subprocess.run(["npx", "tsc", "--noEmit"], cwd=cwd, capture_output=True, text=True)
        ok = r.returncode == 0
        if not ok: all_ok = False
        mark = "✅" if ok else "❌"
        print(f"  {mark} {name} TSC: {'0エラー' if ok else 'エラーあり'}")
        if not ok:
            for line in (r.stdout + r.stderr).strip().splitlines()[:10]:
                print(f"    {line}")
    return all_ok

def git_push():
    subprocess.run(["git", "add", "-A"], cwd=REPO)
    r = subprocess.run(
        ["git", "commit", "-m",
         "fix: BUG-044 endOdometer > startOdometer validation frontend+backend (session13)"],
        cwd=REPO, capture_output=True, text=True
    )
    print(f"  {r.stdout.strip()}")
    r2 = subprocess.run(["git", "push", "origin", "main"], cwd=REPO, capture_output=True, text=True)
    if r2.returncode == 0:
        print("  ✅ Git Push 完了")
    else:
        print(f"  ❌ Push失敗: {r2.stderr}")
    print("\n▶️  次: dt-restart を実行してください")

print("="*60)
print("BUG-044: オドメーター逆転バリデーション（フロント+バックエンド）")
print("="*60)
print("\n[1] PostTripInspection.tsx — フロントバリデーション追加")
ok1 = patch_postTripInspection()
print("\n[2] mobileController.ts — バックエンド逆転チェック追加")
ok2 = patch_mobileController_backend()

if ok1 and ok2:
    ok = tsc_check()
    if ok:
        print("\n✅ 全コンパイルOK → Git Push")
        git_push()
    else:
        print("\n❌ コンパイルエラーあり → Push中止")
        sys.exit(1)
else:
    print("\n❌ パッチ適用失敗")
    sys.exit(1)
