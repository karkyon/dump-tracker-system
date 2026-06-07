#!/usr/bin/env python3
"""
TSCエラー修正スクリプト
実行: python3 ~/projects/dump-tracker/fix_tsc_errors.py

修正対象:
  1. logRoutes.ts(317-319): dfOut[1-4] が undefined の可能性 → optional chaining
  2. SystemSettings.tsx(447): activityLoading 未使用 → 削除
  3. SystemSettings.tsx(1160,1168,1174): id/category/ip が存在しない → 型修正 + テンプレ修正
  4. mobile/App.tsx(276,280): JSX構文エラー → MapTest削除時の残骸修正
"""
import os, re

BASE = os.path.expanduser("~/projects/dump-tracker")

def read(rel):
    with open(os.path.join(BASE, rel), 'r', encoding='utf-8') as f:
        return f.read()

def write(rel, content):
    with open(os.path.join(BASE, rel), 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"OK: {rel}")

def patch(rel, old, new, label=""):
    c = read(rel)
    if old not in c:
        print(f"WARN not found [{label}]: {rel}")
        return False
    write(rel, c.replace(old, new, 1))
    print(f"OK patch [{label}]: {rel}")
    return True

# ============================================================
# 1. logRoutes.ts: dfOut[n] は split の結果で undefined の可能性
#    → diskInfo を try の中で安全に取り出す
# ============================================================
patch(
    "backend/src/routes/logRoutes.ts",
    """    const dfOut = execSync("df -h / | tail -1").toString().trim().split(/\\s+/);
    diskInfo = { total: dfOut[1] || '?', used: dfOut[2] || '?', free: dfOut[3] || '?', usedPercent: dfOut[4] || '?' };""",
    """    const dfRaw = execSync("df -h / | tail -1").toString().trim().split(/\\s+/);
    diskInfo = {
      total:       dfRaw[1] ?? '?',
      used:        dfRaw[2] ?? '?',
      free:        dfRaw[3] ?? '?',
      usedPercent: dfRaw[4] ?? '?',
    };""",
    "dfOut undefined"
)

# ============================================================
# 2. SystemSettings.tsx: activityLoading 未使用 → 削除
# ============================================================
patch(
    "frontend/cms/src/pages/SystemSettings.tsx",
    "  const [activityLoading, setActivityLoading] = React.useState(false);\n",
    "  // activityLoading 削除（未使用）\n",
    "activityLoading unused"
)
# setActivityLoading の呼び出しも削除
patch(
    "frontend/cms/src/pages/SystemSettings.tsx",
    "      .finally(() => setActivityLoading(false));\n",
    "      .finally(() => {});\n",
    "setActivityLoading call"
)
patch(
    "frontend/cms/src/pages/SystemSettings.tsx",
    "    setActivityLoading(true);\n",
    "",
    "setActivityLoading(true)"
)

# ============================================================
# 3. SystemSettings.tsx: displayedLogs の型が {timestamp,level,message} になった
#    → テンプレート内の .id / .category / .ip を修正
#    元のテンプレートで mockLogs の各フィールドを参照している行を修正
# ============================================================

# log.id → index をキーに使う
patch(
    "frontend/cms/src/pages/SystemSettings.tsx",
    "                  {displayedLogs.map(log => (\n"
    "                    <tr key={log.id} className=\"hover:bg-gray-50\">",
    "                  {displayedLogs.map((log, idx) => (\n"
    "                    <tr key={idx} className=\"hover:bg-gray-50\">",
    "log.id → idx"
)

# log.category → (log as any).category || '—'
patch(
    "frontend/cms/src/pages/SystemSettings.tsx",
    "                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">\n"
    "                        {log.category}\n"
    "                      </td>",
    "                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">\n"
    "                        —\n"
    "                      </td>",
    "log.category"
)

# log.ip → '—'
patch(
    "frontend/cms/src/pages/SystemSettings.tsx",
    "                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">\n"
    "                        {log.ip}\n"
    "                      </td>",
    "                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">\n"
    "                        —\n"
    "                      </td>",
    "log.ip"
)

# ============================================================
# 4. mobile/App.tsx: MapTest削除時のコメント置換が不完全で JSX 壊れた
#    → MapTest/MapLibreTest のルートが残っていたかもしれない
#    → App.tsx を読んで問題箇所を確認・修正
# ============================================================
app_content = read("frontend/mobile/src/App.tsx")

# パターン1: コメントに化けたルートが残っている場合
if "// MapTest / MapLibreTest は削除済み (Vector Map調査完了) */" in app_content:
    # JSX内のコメントは {/* ... */} 形式でないといけない
    app_content = app_content.replace(
        "          // MapTest / MapLibreTest は削除済み (Vector Map調査完了) */",
        "          {/* MapTest / MapLibreTest は削除済み (Vector Map調査完了) */}"
    )
    write("frontend/mobile/src/App.tsx", app_content)
    print("OK patch [App.tsx JSX comment]: frontend/mobile/src/App.tsx")
else:
    print("INFO: App.tsx JSX comment pattern not found, checking for other issues...")
    # 276行前後を確認して問題を特定
    lines = app_content.split('\n')
    start = max(0, 270)
    end = min(len(lines), 285)
    print(f"  Lines 271-284:")
    for i, l in enumerate(lines[start:end], start=start+1):
        print(f"    {i}: {repr(l)}")

print("\n=== 修正完了 ===")
print("次のステップ:")
print("  cd ~/projects/dump-tracker/backend && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
print("  cd ~/projects/dump-tracker/frontend/cms && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
print("  cd ~/projects/dump-tracker/frontend/mobile && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
print("  # RC=0確認後:")
print('  cd ~/projects/dump-tracker && git add -A && git commit -m "fix: TSCエラー全解消" && git push origin main')
print("  rm ~/projects/dump-tracker/fix_tsc_errors.py")
