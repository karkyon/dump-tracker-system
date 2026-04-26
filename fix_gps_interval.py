#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_gps_interval.py
====================
問題: CMS設定3秒にしているのに数十秒間隔でしか送信されない
原因: watchPosition はブラウザが位置更新を通知するタイミング依存
     室内・低速時は更新頻度が落ちるため lastGPSUpdateRef の比較が意味をなさない
修正: setInterval を使って確実に設定インターバルでGPS送信をトリガーする
     watchPosition は位置情報の最新値を維持するだけに専念
     sendGPSData は setInterval から呼び出す
"""
import os, subprocess

REPO = os.path.expanduser("~/dump-tracker")

def r(p):
    fp = os.path.join(REPO, p)
    return open(fp, encoding='utf-8').read() if os.path.exists(fp) else None

def w(p, content):
    fp = os.path.join(REPO, p)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, 'w', encoding='utf-8').write(content)
    print(f"  ✅ Written: {p}")

def run(cmd, cwd=None):
    res = subprocess.run(cmd, shell=True, cwd=cwd or REPO, capture_output=True, text=True)
    return res.stdout + res.stderr

print("=" * 60)
print("GPS送信インターバル確実実装")
print("=" * 60)

content = r("frontend/mobile/src/hooks/useGPS.ts")
if not content:
    print("❌ useGPS.ts 未発見"); exit(1)

# ============================================================
# [1] sendGPSIntervalRef の追加（useRef定義の直後）
# ============================================================
print("\n[1] useGPS.ts — setInterval方式GPS送信実装")

old_wake = "  // BUG-020: iOS バックグラウンド復帰時のGPS再開用ref\n  const wakeLockRef = useRef<WakeLockSentinel | null>(null);"
new_wake = """  // BUG-020: iOS バックグラウンド復帰時のGPS再開用ref
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // ✅ Session12: setIntervalでGPS送信を確実にインターバル制御
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 最新のGPS位置とmetadataを保持するref（setInterval内で参照するためref必須）
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const latestMetadataRef = useRef<GPSMetadata | null>(null);"""

if old_wake in content:
    content = content.replace(old_wake, new_wake)
    print("  ✅ gpsIntervalRef / latestPositionRef 追加")
else:
    print("  ⚠️ wakeLockRef 箇所未発見")

# ============================================================
# [2] handlePositionUpdate 内: lastGPSUpdateRef比較を削除し
#     最新位置をrefに保存するだけにする
# ============================================================
old_interval_check = """    if (now - lastGPSUpdateRef.current > GPS_CONFIG.UPDATE_INTERVAL) {
      setGpsLogs(prev => [...prev, gpsLog]);
      sendGPSData(position, metadata);
      lastGPSUpdateRef.current = now;
    }"""

new_interval_check = """    // ✅ Session12: 最新位置・metadataをrefに保存（setIntervalから参照）
    latestPositionRef.current = position;
    latestMetadataRef.current = metadata;
    // GPS Logはローカル配列に追加（表示用）
    setGpsLogs(prev => {
      const next = [...prev, gpsLog];
      return next.slice(-500); // 最大500件保持
    });
    // ※ 実際の送信は startGPSInterval の setInterval が担当"""

if old_interval_check in content:
    content = content.replace(old_interval_check, new_interval_check)
    print("  ✅ handlePositionUpdate 内のインターバルチェック削除・ref保存に変更")
else:
    print("  ⚠️ インターバルチェック箇所未発見")

# ============================================================
# [3] startTracking の直前に startGPSInterval / stopGPSInterval を追加
# ============================================================
old_start_tracking = "  const startTracking = useCallback(async (): Promise<void> => {"

new_start_tracking = """  // ✅ Session12: setInterval方式でGPS送信を確実制御
  const startGPSInterval = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
    }
    const intervalMs = GPS_CONFIG.UPDATE_INTERVAL; // getterなので毎回最新値
    console.log(`⏱️ [GPS-INTERVAL] GPS送信インターバル開始: ${intervalMs}ms (${intervalMs/1000}秒)`);
    gpsIntervalRef.current = setInterval(() => {
      const pos = latestPositionRef.current;
      const meta = latestMetadataRef.current;
      if (pos && meta) {
        sendGPSData(pos, meta);
      }
    }, intervalMs);
  }, []);

  const stopGPSInterval = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
      console.log('⏹️ [GPS-INTERVAL] GPS送信インターバル停止');
    }
  }, []);

  const startTracking = useCallback(async (): Promise<void> => {"""

if old_start_tracking in content:
    content = content.replace(old_start_tracking, new_start_tracking)
    print("  ✅ startGPSInterval / stopGPSInterval 追加")
else:
    print("  ⚠️ startTracking 箇所未発見")

# ============================================================
# [4] startTracking 内: watchId設定後に startGPSInterval 呼び出し
#     "🛰️ GPS追跡開始 - Watch ID:" のログの後に追加
# ============================================================
old_watchid_log = """    watchIdRef.current = watchId;
    setIsTracking(true);
    isTrackingRef.current = true;
    startTimeRef.current = Date.now();"""

new_watchid_log = """    watchIdRef.current = watchId;
    setIsTracking(true);
    isTrackingRef.current = true;
    startTimeRef.current = Date.now();
    // ✅ Session12: setInterval GPS送信開始
    startGPSInterval();"""

if old_watchid_log in content:
    content = content.replace(old_watchid_log, new_watchid_log)
    print("  ✅ startTracking 内に startGPSInterval() 呼び出し追加")
else:
    # フォールバック: watchIdRef.current = watchId の後を探す
    # logger行を含むパターンで探す
    alt_pattern = "    watchIdRef.current = watchId;"
    idx = content.find(alt_pattern)
    if idx >= 0:
        # 行の終わりを探して挿入
        line_end = content.find('\n', idx) + 1
        # 数行後にstartTimeRef.current = Date.now() があるか確認
        next_200 = content[idx:idx+200]
        if 'startTimeRef.current = Date.now()' in next_200:
            insert_after = content.find('    startTimeRef.current = Date.now();', idx)
            end_of_line = content.find('\n', insert_after) + 1
            content = content[:end_of_line] + '    // ✅ Session12: setInterval GPS送信開始\n    startGPSInterval();\n' + content[end_of_line:]
            print("  ✅ startTracking 内に startGPSInterval() 追加 (フォールバック)")
        else:
            print("  ⚠️ watchIdRef 挿入位置未確定")
    else:
        print("  ⚠️ watchIdRef 行未発見")

# ============================================================
# [5] stopTracking 内に stopGPSInterval 追加
# ============================================================
old_stop = """  const stopTracking = useCallback((): void => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }"""

new_stop = """  const stopTracking = useCallback((): void => {
    // ✅ Session12: setInterval停止
    stopGPSInterval();
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }"""

if old_stop in content:
    content = content.replace(old_stop, new_stop)
    print("  ✅ stopTracking 内に stopGPSInterval() 追加")
else:
    # フォールバック
    alt = "  const stopTracking = useCallback((): void => {"
    idx = content.find(alt)
    if idx >= 0:
        end = content.find('\n', idx) + 1
        content = content[:end] + '    stopGPSInterval();\n' + content[end:]
        print("  ✅ stopTracking 内に stopGPSInterval() 追加 (フォールバック)")
    else:
        print("  ⚠️ stopTracking 箇所未発見")

# ============================================================
# [6] useEffect クリーンアップにも stopGPSInterval 追加
# ============================================================
old_cleanup = """    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }"""

new_cleanup = """    return () => {
      stopGPSInterval(); // ✅ Session12
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }"""

if old_cleanup in content:
    content = content.replace(old_cleanup, new_cleanup)
    print("  ✅ useEffect クリーンアップに stopGPSInterval() 追加")
else:
    print("  ⚠️ useEffect クリーンアップ箇所未発見 - スキップ")

w("frontend/mobile/src/hooks/useGPS.ts", content)

# ============================================================
# コンパイルチェック
# ============================================================
print("\n" + "=" * 60)
print("コンパイルチェック")
print("=" * 60)

be_ok = "error TS" not in run("npx tsc --noEmit -p tsconfig.json 2>&1 | head -5", cwd=os.path.join(REPO, "backend"))
print(f"  {'✅' if be_ok else '❌'} Backend TSC: {'0エラー' if be_ok else '要確認'}")

mo_out = run("npx tsc --noEmit 2>&1 | head -40", cwd=os.path.join(REPO, "frontend/mobile"))
mo_ok = "error TS" not in mo_out
print(f"  {'✅' if mo_ok else '❌'} Mobile TSC: {'0エラー' if mo_ok else mo_out}")

cm_ok = "error TS" not in run("npx tsc --noEmit 2>&1 | head -5", cwd=os.path.join(REPO, "frontend/cms"))
print(f"  {'✅' if cm_ok else '❌'} CMS TSC: {'0エラー' if cm_ok else '要確認'}")

if be_ok and mo_ok and cm_ok:
    print("\n✅ 全コンパイルOK → Git Push + dt-restart")
    out = run(
        "git add -A && git commit -m "
        "'fix: GPS setInterval polling - reliable interval control (session12)' "
        "&& git push origin main"
    )
    print(f"  {out.strip()}")
    print("\n▶️  次: dt-restart を実行してください")
else:
    print("\n❌ コンパイルエラーあり → Push中止")
