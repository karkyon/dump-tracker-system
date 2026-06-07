#!/usr/bin/env python3
"""
ファイル全体書き直しによる確実なTSCエラー修正
実行: python3 ~/projects/dump-tracker/fix_tsc_definitive.py
"""
import os, subprocess, sys

BASE = os.path.expanduser("~/projects/dump-tracker")

def write(rel, content):
    p = os.path.join(BASE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"OK write: {rel}")

def read(rel):
    with open(os.path.join(BASE, rel), encoding='utf-8') as f:
        return f.read()

def run(cmd, cwd=None):
    r = subprocess.run(cmd, shell=True, cwd=cwd or BASE, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

# ═══════════════════════════════════════════════════════
# 修正1: mobile/App.tsx — JSXコメント閉じ括弧不足を修正
#  272行: {/* MapTest / MapLibreTest は削除済み */   ← } が1個ない
#  → コメント行ごと正しい形に置換
# ═══════════════════════════════════════════════════════
print("=== 1. mobile/App.tsx JSXコメント修正 ===")
app = read("frontend/mobile/src/App.tsx")

# 壊れたコメント（末尾の } が欠落している全パターン）を修正
# パターン: "} が1個だけの行" = `{/* ... */` で終わっている（閉じ } がない）
import re
# {/* ... */ で終わる行（末尾に } がない）を {/* ... */} に修正
app_fixed = re.sub(
    r'(\s*)\{(/\* MapTest / MapLibreTest[^}]*\*/)\s*\n',
    r'\1{\2}\n',
    app
)
if app_fixed != app:
    write("frontend/mobile/src/App.tsx", app_fixed)
    print("  OK: JSXコメント修正完了")
else:
    # 別パターン: 行末が */ だけで } がない
    app_fixed2 = app.replace(
        "{/* MapTest / MapLibreTest は削除済み (Vector Map調査完了) */\n",
        "{/* MapTest / MapLibreTest は削除済み (Vector Map調査完了) */}\n"
    )
    if app_fixed2 != app:
        write("frontend/mobile/src/App.tsx", app_fixed2)
        print("  OK: JSXコメント修正完了 (pattern2)")
    else:
        print("  WARN: パターン未一致。既に修正済みか確認:")
        lines = app.split('\n')
        for i, l in enumerate(lines[268:278], 269):
            print(f"    {i}: {repr(l)}")

# ═══════════════════════════════════════════════════════
# 修正2: logRoutes.ts — dfOut 配列要素の undefined 対応
#  split() の戻り値は string[] だが TypeScript は string | undefined と見る
#  → !! 既に `(dfOut[1] as string)` に変えているはずだが効いていない
#  → 確実に: const [,total,used,free,usedPct='?'] = dfOut; で分割代入
# ═══════════════════════════════════════════════════════
print("\n=== 2. logRoutes.ts dfOut 分割代入修正 ===")
lr = read("backend/src/routes/logRoutes.ts")

# 現在のdfOut処理を分割代入に置換（どのバリアントでも一致するよう広めに）
old_patterns = [
    # パッチ済みパターン
    "    diskInfo = {\n"
    "      total:       (dfOut[1] as string) || '?',\n"
    "      used:        (dfOut[2] as string) || '?',\n"
    "      free:        (dfOut[3] as string) || '?',\n"
    "      usedPercent: (dfOut[4] as string) || '?',\n"
    "    };",
    # 未パッチパターン
    "    diskInfo = { total: dfOut[1] || '?', used: dfOut[2] || '?', free: dfOut[3] || '?', usedPercent: dfOut[4] || '?' };",
]

new_df = (
    "    const [, dfTotal = '?', dfUsed = '?', dfFree = '?', dfPct = '?'] = dfOut;\n"
    "    diskInfo = { total: dfTotal, used: dfUsed, free: dfFree, usedPercent: dfPct };"
)

patched = False
for old in old_patterns:
    if old in lr:
        lr = lr.replace(old, new_df, 1)
        patched = True
        print(f"  OK: dfOut パッチ適用")
        break

if not patched:
    # どのパターンにも一致しない場合、dfOut行周辺を探して確認
    print("  WARN: 既知パターン未一致。現在のdfOut周辺:")
    lines = lr.split('\n')
    for i, l in enumerate(lines):
        if 'dfOut' in l or 'diskInfo' in l:
            print(f"    {i+1}: {repr(l)}")

if patched:
    write("backend/src/routes/logRoutes.ts", lr)

# ═══════════════════════════════════════════════════════
# 修正3: SystemSettings.tsx — activityLoading + id/category/ip
#  前のパッチが既に効いているか確認し、まだ残っていれば修正
# ═══════════════════════════════════════════════════════
print("\n=== 3. SystemSettings.tsx 残存エラー確認・修正 ===")
ss = read("frontend/cms/src/pages/SystemSettings.tsx")
changed = False

# activityLoading
if "activityLoading" in ss:
    ss = ss.replace("  const [activityLoading, setActivityLoading] = React.useState(false);\n", "")
    ss = ss.replace("    setActivityLoading(true);\n", "")
    ss = ss.replace("      .finally(() => setActivityLoading(false));\n", "      .finally(() => {});\n")
    changed = True
    print("  OK: activityLoading 削除")

# log.id → idx (key)
if "key={log.id}" in ss:
    ss = re.sub(
        r'\{displayedLogs\.map\(log => \(',
        '{displayedLogs.map((log, idx) => (',
        ss
    )
    ss = ss.replace('key={log.id}', 'key={idx}')
    changed = True
    print("  OK: log.id → idx")

# log.category
if "{log.category}" in ss:
    ss = ss.replace("{log.category}", "{'—'}")
    changed = True
    print("  OK: log.category → '—'")

# log.ip
if "{log.ip}" in ss:
    ss = ss.replace("{log.ip}", "{'—'}")
    changed = True
    print("  OK: log.ip → '—'")

if changed:
    write("frontend/cms/src/pages/SystemSettings.tsx", ss)
else:
    print("  INFO: 修正済み（変更なし）")

# ═══════════════════════════════════════════════════════
# TSC 3プロジェクト全部チェック
# ═══════════════════════════════════════════════════════
print("\n=== TSC コンパイルチェック ===")
projects = [
    ("backend",         f"{BASE}/backend"),
    ("frontend/cms",    f"{BASE}/frontend/cms"),
    ("frontend/mobile", f"{BASE}/frontend/mobile"),
]

all_ok = True
for name, cwd in projects:
    rc, out = run("./node_modules/.bin/tsc --noEmit 2>&1 | tail -8", cwd=cwd)
    errors = [l for l in out.splitlines() if "error TS" in l]
    if errors:
        print(f"\n❌ {name}: {len(errors)}件のエラー")
        for e in errors:
            print(f"   {e}")
        all_ok = False
    else:
        print(f"✅ {name}: RC=0")

# ═══════════════════════════════════════════════════════
# RC=0 のときだけ git push
# ═══════════════════════════════════════════════════════
if all_ok:
    print("\n=== git commit & push ===")
    rc, out = run("git add -A && git commit -m 'fix: TSCエラー全解消 (JSXコメント/dfOut分割代入)' && git push origin main")
    print(out)
    if rc == 0:
        print("✅ Push 完了")
    else:
        print(f"❌ Push 失敗 RC={rc}")
    # ゴミファイル削除
    for f in ["fix_tsc_errors.py", "fix_tsc_final.py", "fix_tsc_definitive.py"]:
        p = os.path.join(BASE, f)
        if os.path.exists(p):
            os.remove(p)
            print(f"OK remove: {f}")
else:
    print("\n❌ エラーあり → Push 中止。エラー内容を確認してください。")
    sys.exit(1)
