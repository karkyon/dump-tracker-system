#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_gps_critical.py
新規発見 重大バグ修正

BUG-031【最重大】OperationRecord.tsx の useGPS() に
  enableLogging/operationId/vehicleId が渡されておらず
  GPS位置情報がバックエンドに1件も送信されていない

BUG-032【重大】OperationMain.tsx が独自GPS送信ループを持ちフィルタなし
  → App.tsx のルーティングで使われていないなら影響なし。念のため修正

BUG-033【中】PostTripInspection.tsx GPS取得で maximumAge:5000（旧値）
  → GPS_CONFIG.MAXIMUM_AGE(=0) を使うよう修正
"""
import os, subprocess

REPO = os.path.expanduser("~/dump-tracker")

def r(p):
    with open(os.path.join(REPO, p), encoding='utf-8') as f: return f.read()

def w(p, c):
    with open(os.path.join(REPO, p), 'w', encoding='utf-8') as f: f.write(c)
    print(f"  ✅ Written: {p}")

def tsc(d, label):
    res = subprocess.run(["npx","tsc","--noEmit"],
        cwd=os.path.join(REPO,d), capture_output=True, text=True, timeout=120)
    if res.returncode==0: print(f"  ✅ {label} TSC: 0エラー"); return True
    print(f"  ❌ {label} TSC:\n{(res.stdout+res.stderr)[:3000]}"); return False

print("="*60)
print("重大GPS修正スクリプト")
print("="*60)

# ============================================================
# BUG-031【最重大】OperationRecord.tsx — useGPS に
#   enableLogging/operationId/vehicleId を渡す
# ============================================================
print("\n[BUG-031] OperationRecord.tsx — useGPS にオプション追加")

op_path = "frontend/mobile/src/pages/OperationRecord.tsx"
op = r(op_path)

# useGPS() の呼び出し箇所を修正
# 現在: useGPS() オプションなし
# 修正: enableLogging:true, operationId, vehicleId を渡す
# さらに updateOptions でoperationId変化時に再設定するuseEffectを追加

OLD_USE_GPS = """  const {
    currentPosition,
    isTracking,
    startTracking,
    heading,
    speed: _gpsSpeed,
    totalDistance
  } = useGPS();"""

NEW_USE_GPS = """  // ✅ BUG-031修正: enableLogging/operationId/vehicleId を useGPS に渡す
  // これがないと sendGPSData の先頭ガードで常に return してGPS未送信になる
  const {
    currentPosition,
    isTracking,
    startTracking,
    heading,
    speed: _gpsSpeed,
    totalDistance,
    updateOptions: updateGPSOptions
  } = useGPS({
    enableLogging: true,
    operationId: operationStore.operationId || undefined,
    vehicleId: operationStore.vehicleId || undefined,
  });"""

if "BUG-031" in op:
    print("  ✅ BUG-031: 既に修正済み")
elif OLD_USE_GPS in op:
    op = op.replace(OLD_USE_GPS, NEW_USE_GPS, 1)
    print("  ✅ BUG-031: useGPS にオプション追加")
else:
    # 別パターンを確認
    if "} = useGPS();" in op:
        op = op.replace(
            "} = useGPS();",
            """  } = useGPS({
    enableLogging: true,
    operationId: operationStore.operationId || undefined,
    vehicleId: operationStore.vehicleId || undefined,
  });""",
            1
        )
        print("  ✅ BUG-031: useGPS() → useGPS({...}) 修正（別パターン）")
    else:
        print("  ⚠️ BUG-031: パターン不一致 — 手動確認必要")

# operationId が変化した時に updateGPSOptions で再設定する useEffect を追加
# （operationStore.operationId がマウント時にはまだ null の可能性があるため）
OLD_OPID_EFFECT = """  // operationStoreから運行IDを取得して状態に反映
  // 🔧 修正: 運行ID未設定時の処理を改善（エラー抑制）
  useEffect(() => {
    if (operationStore.operationId) {
      setOperation(prev => ({
        ...prev,
        id: operationStore.operationId
      }));
      console.log('✅ 運行ID設定完了:', operationStore.operationId);
      return undefined; // 明示的にundefinedを返す（TypeScriptエラー回避）
    }"""

NEW_OPID_EFFECT = """  // ✅ BUG-031補足: operationId が確定したら useGPS のオプションを更新
  // （初回マウント時に operationId が null の場合の対応）
  useEffect(() => {
    if (operationStore.operationId && operationStore.vehicleId) {
      updateGPSOptions({
        enableLogging: true,
        operationId: operationStore.operationId,
        vehicleId: operationStore.vehicleId,
      });
      console.log('✅ [BUG-031] useGPS オプション更新:', {
        operationId: operationStore.operationId,
        vehicleId: operationStore.vehicleId
      });
    }
  }, [operationStore.operationId, operationStore.vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // operationStoreから運行IDを取得して状態に反映
  // 🔧 修正: 運行ID未設定時の処理を改善（エラー抑制）
  useEffect(() => {
    if (operationStore.operationId) {
      setOperation(prev => ({
        ...prev,
        id: operationStore.operationId
      }));
      console.log('✅ 運行ID設定完了:', operationStore.operationId);
      return undefined; // 明示的にundefinedを返す（TypeScriptエラー回避）
    }"""

if "BUG-031補足" in op:
    print("  ✅ BUG-031補足: updateGPSOptions useEffect 既存")
elif OLD_OPID_EFFECT in op:
    op = op.replace(OLD_OPID_EFFECT, NEW_OPID_EFFECT, 1)
    print("  ✅ BUG-031補足: updateGPSOptions useEffect 追加")
else:
    print("  ⚠️ BUG-031補足: パターン不一致")

w(op_path, op)

# ============================================================
# BUG-032: OperationMain.tsx — 独自GPS送信にaccuracyフィルタ追加
# (App.tsxでルーティングされていなくても念のため修正)
# ============================================================
print("\n[BUG-032] OperationMain.tsx — sendGPSToBackend にaccuracyフィルタ追加")

main_path = "frontend/mobile/src/pages/OperationMain.tsx"
main = r(main_path)

OLD_SEND_GPS = """  // バックエンドにGPS位置を送信
  const sendGPSToBackend = async (position: GPSPosition) => {
    try {
      await apiService.updateGPSLocation({
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        timestamp: position.timestamp.toISOString(),
        operationId: operation.id || undefined,
        vehicleId: sessionStorage.getItem('selected_vehicle_id') || undefined
      });
    } catch (error) {
      console.error('GPS送信エラー:', error);
    }
  };"""

NEW_SEND_GPS = """  // バックエンドにGPS位置を送信
  const sendGPSToBackend = async (position: GPSPosition) => {
    // ✅ BUG-032修正: accuracy フィルタ追加（useGPS.ts の Fix-4A/4B と同一閾値）
    if (position.accuracy > 100) {
      console.warn(`⚠️ [BUG-032] GPS送信スキップ: accuracy=${position.accuracy.toFixed(0)}m > 100m`);
      return;
    }
    try {
      await apiService.updateGPSLocation({
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        timestamp: position.timestamp.toISOString(),
        operationId: operation.id || undefined,
        vehicleId: sessionStorage.getItem('selected_vehicle_id') || undefined
      });
    } catch (error) {
      console.error('GPS送信エラー:', error);
    }
  };"""

if "BUG-032" in main:
    print("  ✅ BUG-032: 既に修正済み")
elif OLD_SEND_GPS in main:
    main = main.replace(OLD_SEND_GPS, NEW_SEND_GPS, 1)
    print("  ✅ BUG-032: sendGPSToBackend にaccuracyフィルタ追加")
else:
    print("  ⚠️ BUG-032: パターン不一致 — スキップ")

# OperationMain の watchPosition options にも maximumAge:0 を適用
OLD_WATCH_OPTS = """    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    };"""
NEW_WATCH_OPTS = """    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,          // ✅ BUG-032: 15秒に延長
      maximumAge: 0            // ✅ BUG-032: キャッシュ無効（Fix-5A と同一設定）
    };"""

if OLD_WATCH_OPTS in main:
    main = main.replace(OLD_WATCH_OPTS, NEW_WATCH_OPTS, 1)
    print("  ✅ BUG-032: watchPosition options 更新")

w(main_path, main)

# ============================================================
# BUG-033: PostTripInspection.tsx — GPS取得の maximumAge を修正
# ============================================================
print("\n[BUG-033] PostTripInspection.tsx — GPS取得 maximumAge:5000 → 0")

pti_path = "frontend/mobile/src/pages/PostTripInspection.tsx"
pti = r(pti_path)

OLD_MAX_AGE = """        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
          });
        });"""

NEW_MAX_AGE = """        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,   // ✅ BUG-033: GPS_CONFIG.TIMEOUT と同一値
            maximumAge: 0     // ✅ BUG-033: キャッシュ無効（Fix-5A と同一設定）
          });
        });"""

if "BUG-033" in pti:
    print("  ✅ BUG-033: 既に修正済み")
elif OLD_MAX_AGE in pti:
    pti = pti.replace(OLD_MAX_AGE, NEW_MAX_AGE, 1)
    print("  ✅ BUG-033: maximumAge:5000 → 0 修正")
else:
    print("  ⚠️ BUG-033: パターン不一致")

w(pti_path, pti)

# ============================================================
# コンパイルチェック & Push
# ============================================================
print("\n" + "="*60)
print("コンパイルチェック")
print("="*60)

be = tsc("backend", "Backend")
mo = tsc("frontend/mobile", "Mobile")
cm = tsc("frontend/cms", "CMS")

if be and mo and cm:
    print("\n✅ 全コンパイルOK → Git Push")
    subprocess.run(["git","add","-A"], cwd=REPO, capture_output=True)
    rc = subprocess.run(
        ["git","commit","-m",
         "fix: BUG-031 enableLogging/operationId in useGPS, BUG-032/033 GPS options (session11)"],
        cwd=REPO, capture_output=True, text=True)
    print(f"  commit: {rc.stdout.strip()}")
    rp = subprocess.run(["git","push","origin","main"],
        cwd=REPO, capture_output=True, text=True)
    print("  ✅ Push完了" if rp.returncode==0 else f"  ❌ Push失敗: {rp.stderr[:300]}")
else:
    print("\n❌ コンパイルエラーあり → Push中止")
    print("エラー内容を貼り付けて報告してください")