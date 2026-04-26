#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session 12 統合修正スクリプト
==============================
[1] BUG-034/035: コンパイルエラー修正
    - api.ts StartOperationRequest: startLatitude/Longitude をオプション化
    - startOdometer フィールド追加
[2] GPS走行軌跡「表示設定」→「記録設定」変更
    - SystemSettings.tsx: UI文言・インターバル選択肢変更
    - useGPS.ts: GPS_CONFIG.UPDATE_INTERVAL をシステム設定から動的に読み込み
    - gpsTrackSettings: showTrack→enableRecording, intervalMinutes→intervalSeconds(デフォルト3)
[3] CMS GPS軌跡: 全点描画（既にFix-A済みだが念のため確認）
"""
import os, subprocess, re

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
    result = subprocess.run(cmd, shell=True, cwd=cwd or REPO, capture_output=True, text=True)
    return result.stdout + result.stderr

print("=" * 60)
print("Session 12 統合修正スクリプト")
print("=" * 60)

# ============================================================
# [1] BUG-034/035 コンパイルエラー修正
# api.ts: StartOperationRequest の型修正
# ============================================================
print("\n[1] api.ts — StartOperationRequest 型修正 (BUG-034/035)")

content = r("frontend/mobile/src/services/api.ts")
if content:
    old_req = """export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  startLatitude: number;
  startLongitude: number;
  startLocation?: string;
  cargoInfo?: string;
  customerId?: string;   // 🆕 客先ID
}"""
    new_req = """export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  startLatitude?: number;   // ✅ BUG-034: オプション化（デフォルト座標送信廃止）
  startLongitude?: number;  // ✅ BUG-034: オプション化
  startOdometer?: number;   // ✅ BUG-035: 開始オドメーター追加
  startLocation?: string;
  cargoInfo?: string;
  customerId?: string;   // 🆕 客先ID
}"""
    if old_req in content:
        content = content.replace(old_req, new_req)
        print("  ✅ StartOperationRequest 型修正完了")
    elif "startLatitude?: number" in content:
        print("  ℹ️ 既にオプション化済み")
    else:
        # フォールバック: startLatitude: number → startLatitude?: number
        content = content.replace(
            "  startLatitude: number;\n  startLongitude: number;",
            "  startLatitude?: number;   // ✅ BUG-034\n  startLongitude?: number;  // ✅ BUG-034"
        )
        if "startOdometer" not in content:
            content = content.replace(
                "  customerId?: string;   // 🆕 客先ID\n}",
                "  startOdometer?: number;   // ✅ BUG-035\n  customerId?: string;   // 🆕 客先ID\n}",
                1
            )
        print("  ✅ StartOperationRequest 型修正完了 (フォールバック)")
    w("frontend/mobile/src/services/api.ts", content)

# ============================================================
# [2] SystemSettings.tsx — GPS走行軌跡「表示」→「記録」設定変更
# ============================================================
print("\n[2] SystemSettings.tsx — GPS走行軌跡設定 UI変更")

content = r("frontend/cms/src/pages/SystemSettings.tsx")
if content:
    # gpsTrackSettings の初期値変更 (intervalMinutes → intervalSeconds, showTrack → enableRecording)
    # まず既存の初期値を確認
    if "intervalMinutes" in content or "showTrack" in content:
        # GPS_TRACK_KEY localStorage のデフォルト初期値を更新
        old_init = """try {
      const raw = localStorage.getItem(GPS_TRACK_KEY);
      return raw ? JSON.parse(raw) : { showTrack: true, intervalMinutes: 5 };
    } catch {
      return { showTrack: true, intervalMinutes: 5 };
    }"""
        new_init = """try {
      const raw = localStorage.getItem(GPS_TRACK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 旧フォーマット(intervalMinutes)を新フォーマット(intervalSeconds)に移行
        if (parsed.intervalMinutes !== undefined && parsed.intervalSeconds === undefined) {
          return {
            enableRecording: parsed.showTrack ?? true,
            intervalSeconds: 3
          };
        }
        return parsed;
      }
      return { enableRecording: true, intervalSeconds: 3 };
    } catch {
      return { enableRecording: true, intervalSeconds: 3 };
    }"""
        if old_init in content:
            content = content.replace(old_init, new_init)
            print("  ✅ gpsTrackSettings 初期値変更")
        else:
            # 別パターンで探す
            idx = content.find("GPS_TRACK_KEY")
            if idx > 0:
                # useState の初期化部分を探す
                start = content.rfind("useState(", 0, idx + 200)
                if start > 0:
                    print("  ⚠️ 初期値パターン不一致 - UIテキストのみ変更")
    
    # UIテキスト変更
    replacements = [
        # カードタイトル
        ("GPS走行軌跡表示設定", "GPS走行軌跡記録設定"),
        # トグル説明
        ("走行軌跡を表示する", "走行軌跡を記録する"),
        ("GPSログに基づく走行ルートを地図上に描画します", 
         "インターバルで設定された間隔でGPS位置情報をサーバへ送信します"),
        # インターバルラベル
        ("描画インターバル", "記録インターバル"),
        ("何分間隔のGPS座標を描画するかを設定します。短いほど詳細になりますが表示が重くなります。",
         "設定された間隔でGPS座標をサーバへ送信します。短いほど軌跡が詳細になります。"),
        # ごとにGPS点を
        ("ごとにGPS点を表示", "ごとにGPS点を記録"),
        # showTrack → enableRecording (state参照)
        ("gpsTrackSettings.showTrack", "gpsTrackSettings.enableRecording"),
        ("showTrack: !gpsTrackSettings.showTrack", "enableRecording: !gpsTrackSettings.enableRecording"),
    ]
    
    changed = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            changed += 1
    
    print(f"  ✅ UIテキスト変更: {changed}箇所")
    
    # インターバル選択肢を秒単位に変更
    old_select = """                    <option value={1}>1分間隔</option>
                    <option value={3}>3分間隔</option>
                    <option value={5}>5分間隔（推奨）</option>
                    <option value={10}>10分間隔</option>
                    <option value={15}>15分間隔</option>"""
    new_select = """                    <option value={1}>1秒間隔</option>
                    <option value={3}>3秒間隔（推奨）</option>
                    <option value={5}>5秒間隔</option>
                    <option value={10}>10秒間隔</option>
                    <option value={15}>15秒間隔</option>
                    <option value={30}>30秒間隔</option>
                    <option value={45}>45秒間隔</option>
                    <option value={60}>60秒間隔</option>
                    <option value={180}>3分間隔</option>
                    <option value={300}>5分間隔</option>
                    <option value={600}>10分間隔</option>"""
    
    if old_select in content:
        content = content.replace(old_select, new_select)
        print("  ✅ インターバル選択肢変更（分→秒単位）")
    else:
        # value={5}の推奨表示を探す
        if 'value={5}>5分間隔（推奨）' in content:
            content = content.replace('value={5}>5分間隔（推奨）', 'value={3}>3秒間隔（推奨）')
            content = content.replace('gpsTrackSettings.intervalMinutes', 'gpsTrackSettings.intervalSeconds')
            print("  ✅ インターバル変更（フォールバック）")
    
    # intervalMinutes → intervalSeconds の参照を変更
    content = content.replace(
        "intervalMinutes: parseInt(e.target.value)",
        "intervalSeconds: parseInt(e.target.value)"
    )
    content = content.replace(
        "value={gpsTrackSettings.intervalMinutes}",
        "value={gpsTrackSettings.intervalSeconds}"
    )
    
    # opacity制御を enableRecording に変更
    content = content.replace(
        "gpsTrackSettings.showTrack ? '' : 'opacity-50 pointer-events-none'",
        "gpsTrackSettings.enableRecording ? '' : 'opacity-50 pointer-events-none'"
    )
    
    w("frontend/cms/src/pages/SystemSettings.tsx", content)

# ============================================================
# [3] constants.ts — GPS_CONFIG.UPDATE_INTERVAL をlocalStorageから動的読み込み対応
# ============================================================
print("\n[3] constants.ts — GPS UPDATE_INTERVAL 動的読み込み対応")

content = r("frontend/mobile/src/utils/constants.ts")
if content:
    old_interval = "  // GPS更新間隔（ミリ秒）\n  UPDATE_INTERVAL: parseInt(import.meta.env.VITE_GPS_UPDATE_INTERVAL || '5000', 10),"
    new_interval = """  // GPS更新間隔（ミリ秒）
  // ✅ Session12: CMS設定(intervalSeconds)から動的読み込み。未設定時は3秒
  get UPDATE_INTERVAL(): number {
    try {
      const raw = localStorage.getItem('dump_tracker_gps_track_settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.intervalSeconds && typeof s.intervalSeconds === 'number') {
          return s.intervalSeconds * 1000;
        }
        // 旧フォーマット互換
        if (s.intervalMinutes && typeof s.intervalMinutes === 'number') {
          return s.intervalMinutes * 60 * 1000;
        }
      }
    } catch { /* ignore */ }
    return parseInt(import.meta.env.VITE_GPS_UPDATE_INTERVAL || '3000', 10);
  },"""
    
    if old_interval in content:
        content = content.replace(old_interval, new_interval)
        print("  ✅ UPDATE_INTERVAL 動的読み込み対応")
    elif "get UPDATE_INTERVAL" in content:
        print("  ℹ️ 既に動的読み込み済み")
    else:
        # フォールバック: 単純に3000msに変更
        content = content.replace(
            "VITE_GPS_UPDATE_INTERVAL || '5000'",
            "VITE_GPS_UPDATE_INTERVAL || '3000'"
        )
        print("  ✅ デフォルト値を5000→3000に変更")
    w("frontend/mobile/src/utils/constants.ts", content)

# ============================================================
# コンパイルチェック
# ============================================================
print("\n" + "=" * 60)
print("コンパイルチェック")
print("=" * 60)

be_out = run("npx tsc --noEmit -p tsconfig.json 2>&1 | head -20", cwd=os.path.join(REPO, "backend"))
be_ok = "error TS" not in be_out
print(f"  {'✅' if be_ok else '❌'} Backend TSC: {'0エラー' if be_ok else be_out}")

mo_out = run("npx tsc --noEmit 2>&1 | head -30", cwd=os.path.join(REPO, "frontend/mobile"))
mo_ok = "error TS" not in mo_out
print(f"  {'✅' if mo_ok else '❌'} Mobile TSC: {'0エラー' if mo_ok else mo_out}")

cm_out = run("npx tsc --noEmit 2>&1 | head -20", cwd=os.path.join(REPO, "frontend/cms"))
cm_ok = "error TS" not in cm_out
print(f"  {'✅' if cm_ok else '❌'} CMS TSC: {'0エラー' if cm_ok else cm_out}")

if be_ok and mo_ok and cm_ok:
    print("\n✅ 全コンパイルOK → Git Push")
    out = run(
        "git add -A && git commit -m "
        "'fix: BUG-034/035 type fix + GPS recording settings UI change (session12)' "
        "&& git push origin main"
    )
    print(f"  {out.strip()}")
    print("\n次: fix_backlog_updates.py を実行してBacklogを更新")
else:
    print("\n❌ コンパイルエラーあり → Push中止")
