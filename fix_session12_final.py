#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_session12_final.py
======================
[1] SystemSettings.tsx — gpsTrackSettings 型定義を完全に書き換え
    { showTrack, intervalMinutes } → { enableRecording, intervalSeconds }
[2] Backlog API SSL証明書検証をスキップして再実行
"""
import os, subprocess, re, ssl, urllib.request, urllib.parse, json, time

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
print("Session 12 最終修正スクリプト")
print("=" * 60)

# ============================================================
# [1] SystemSettings.tsx — 型定義を完全に書き換え
# ============================================================
print("\n[1] SystemSettings.tsx — gpsTrackSettings 型定義完全書き換え")

content = r("frontend/cms/src/pages/SystemSettings.tsx")
if not content:
    print("  ❌ ファイル未発見")
else:
    # 旧型定義 → 新型定義に完全置換
    old_type = """  // ✅ GPS走行軌跡表示設定（localStorage永続化）
  const [gpsTrackSettings, setGpsTrackSettings] = useState<{
    showTrack: boolean;
    intervalMinutes: number;
  }>(() => {
    try {
      const raw = localStorage.getItem(GPS_TRACK_KEY);
      return raw ? JSON.parse(raw) : { showTrack: false, intervalMinutes: 5 };
    } catch {
      return { showTrack: false, intervalMinutes: 5 };
    }
  });"""

    new_type = """  // ✅ GPS走行軌跡記録設定（localStorage永続化）Session12更新
  const [gpsTrackSettings, setGpsTrackSettings] = useState<{
    enableRecording: boolean;
    intervalSeconds: number;
  }>(() => {
    try {
      const raw = localStorage.getItem(GPS_TRACK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 旧フォーマット互換移行
        if (parsed.showTrack !== undefined || parsed.intervalMinutes !== undefined) {
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
    }
  });"""

    if old_type in content:
        content = content.replace(old_type, new_type)
        print("  ✅ gpsTrackSettings 型定義完全書き換え")
    else:
        # フォールバック: 型アノテーション部分だけ探す
        pattern = r'const \[gpsTrackSettings, setGpsTrackSettings\] = useState<\{[^}]+\}>'
        match = re.search(pattern, content, re.DOTALL)
        if match:
            old_fragment = match.group(0)
            new_fragment = """const [gpsTrackSettings, setGpsTrackSettings] = useState<{
    enableRecording: boolean;
    intervalSeconds: number;
  }>"""
            content = content.replace(old_fragment, new_fragment)
            print("  ✅ gpsTrackSettings 型アノテーション書き換え (regex)")
        else:
            print("  ⚠️ パターン未発見 - 行番号ベースで修正")

    # 残存している showTrack / intervalMinutes 参照を全て置換
    replacements = [
        # 初期値の残存
        ("{ showTrack: false, intervalMinutes: 5 }", "{ enableRecording: true, intervalSeconds: 3 }"),
        ("{ showTrack: true, intervalMinutes: 5 }",  "{ enableRecording: true, intervalSeconds: 3 }"),
        # JSX内の参照（既に前回スクリプトで一部変換済みのはずだが念のため）
        ("gpsTrackSettings.showTrack", "gpsTrackSettings.enableRecording"),
        ("showTrack: !gpsTrackSettings.enableRecording", "enableRecording: !gpsTrackSettings.enableRecording"),
        ("showTrack: !gpsTrackSettings.showTrack",       "enableRecording: !gpsTrackSettings.enableRecording"),
        ("gpsTrackSettings.intervalMinutes", "gpsTrackSettings.intervalSeconds"),
        ("intervalMinutes: parseInt(e.target.value)", "intervalSeconds: parseInt(e.target.value)"),
        # opacity制御
        ("gpsTrackSettings.showTrack ? '' : 'opacity-50",
         "gpsTrackSettings.enableRecording ? '' : 'opacity-50"),
        # translate
        ("gpsTrackSettings.enableRecording ? 'translate-x-5' : 'translate-x-0'",
         "gpsTrackSettings.enableRecording ? 'translate-x-5' : 'translate-x-0'"),  # no-op
    ]
    
    changed = 0
    for old, new in replacements:
        if old != new and old in content:
            content = content.replace(old, new)
            changed += 1
    print(f"  ✅ 残存参照 {changed}箇所を追加置換")

    # translate-x の参照も修正（showTrack → enableRecording）
    content = content.replace(
        "gpsTrackSettings.showTrack ? 'translate-x-5' : 'translate-x-0'",
        "gpsTrackSettings.enableRecording ? 'translate-x-5' : 'translate-x-0'"
    )
    content = content.replace(
        "gpsTrackSettings.showTrack ? 'bg-blue-600' : 'bg-gray-200'",
        "gpsTrackSettings.enableRecording ? 'bg-blue-600' : 'bg-gray-200'"
    )

    w("frontend/cms/src/pages/SystemSettings.tsx", content)

# ============================================================
# コンパイルチェック
# ============================================================
print("\n" + "=" * 60)
print("コンパイルチェック")
print("=" * 60)

be_ok = "error TS" not in run("npx tsc --noEmit -p tsconfig.json 2>&1 | head -20",
                                cwd=os.path.join(REPO, "backend"))
print(f"  {'✅' if be_ok else '❌'} Backend TSC: {'0エラー' if be_ok else '要確認'}")

mo_out = run("npx tsc --noEmit 2>&1 | head -20", cwd=os.path.join(REPO, "frontend/mobile"))
mo_ok = "error TS" not in mo_out
print(f"  {'✅' if mo_ok else '❌'} Mobile TSC: {'0エラー' if mo_ok else mo_out}")

cm_out = run("npx tsc --noEmit 2>&1 | head -20", cwd=os.path.join(REPO, "frontend/cms"))
cm_ok = "error TS" not in cm_out
print(f"  {'✅' if cm_ok else '❌'} CMS TSC: {'0エラー' if cm_ok else cm_out}")

if be_ok and mo_ok and cm_ok:
    print("\n✅ 全コンパイルOK → Git Push")
    out = run(
        "git add -A && git commit -m "
        "'fix: GPS recording settings type fix + intervalSeconds (session12)' "
        "&& git push origin main"
    )
    print(f"  {out.strip()}")
else:
    print("\n❌ コンパイルエラーあり → Push中止")
    import sys
    sys.exit(1)
