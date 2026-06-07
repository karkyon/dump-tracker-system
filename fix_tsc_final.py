#!/usr/bin/env python3
"""
残存TSCエラー全修正
実行: python3 ~/projects/dump-tracker/fix_tsc_final.py
"""
import os, re

BASE = os.path.expanduser("~/projects/dump-tracker")

def read(rel):
    with open(os.path.join(BASE, rel), encoding='utf-8') as f:
        return f.read()

def write(rel, c):
    with open(os.path.join(BASE, rel), 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"OK: {rel}")

def patch(rel, old, new, label):
    c = read(rel)
    if old not in c:
        print(f"WARN not found [{label}]: {rel}")
        return False
    write(rel, c.replace(old, new, 1))
    print(f"OK [{label}]: {rel}")
    return True

# ─────────────────────────────────────────────────────
# 1. logRoutes.ts(317-319): dfOut 配列要素が undefined の可能性
#    split() の結果は string[] なので要素は string | undefined
#    → (dfOut as string[])[n] でも駄目なので as string でキャスト
# ─────────────────────────────────────────────────────
patch(
    "backend/src/routes/logRoutes.ts",
    "    diskInfo = { total: dfOut[1] || '?', used: dfOut[2] || '?', free: dfOut[3] || '?', usedPercent: dfOut[4] || '?' };",
    "    diskInfo = {\n"
    "      total:       (dfOut[1] as string) || '?',\n"
    "      used:        (dfOut[2] as string) || '?',\n"
    "      free:        (dfOut[3] as string) || '?',\n"
    "      usedPercent: (dfOut[4] as string) || '?',\n"
    "    };",
    "dfOut cast"
)

# ─────────────────────────────────────────────────────
# 2. SystemSettings.tsx(447): activityLoading 未使用
#    state 宣言と呼び出しを削除
# ─────────────────────────────────────────────────────
ss = read("frontend/cms/src/pages/SystemSettings.tsx")

# 未使用 state 宣言を削除
ss = ss.replace(
    "  const [activityLoading, setActivityLoading] = React.useState(false);\n",
    ""
)
# setActivityLoading(true) 削除
ss = ss.replace("    setActivityLoading(true);\n", "")
# .finally(() => setActivityLoading(false)) → .finally(() => {})
ss = ss.replace(
    "      .finally(() => setActivityLoading(false));\n",
    "      .finally(() => {});\n"
)
write("frontend/cms/src/pages/SystemSettings.tsx", ss)
print("OK [activityLoading removed]: frontend/cms/src/pages/SystemSettings.tsx")

# ─────────────────────────────────────────────────────
# 3. SystemSettings.tsx: displayedLogs の型に id/category/ip が存在しない
#    テンプレート内の参照を修正
# ─────────────────────────────────────────────────────

# log.id → key={idx}
patch(
    "frontend/cms/src/pages/SystemSettings.tsx",
    "                  {displayedLogs.map(log => (\n"
    "                    <tr key={log.id} className=\"hover:bg-gray-50\">",
    "                  {displayedLogs.map((log, idx) => (\n"
    "                    <tr key={idx} className=\"hover:bg-gray-50\">",
    "log.id→idx"
)

# log.category → ハイフン表示
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

# log.ip → ハイフン表示
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

# ─────────────────────────────────────────────────────
# 4. mobile/App.tsx(276,280): MapTest削除時に残った壊れたJSX
#    "//" コメントは JSX の return 内では使えない → {/* */} に修正
# ─────────────────────────────────────────────────────
app = read("frontend/mobile/src/App.tsx")

# パターンA: コメント記法が // のまま残っている
BAD_COMMENT  = "          // MapTest / MapLibreTest は削除済み (Vector Map調査完了) */"
GOOD_COMMENT = "          {/* MapTest / MapLibreTest は削除済み (Vector Map調査完了) */}"

if BAD_COMMENT in app:
    app = app.replace(BAD_COMMENT, GOOD_COMMENT)
    write("frontend/mobile/src/App.tsx", app)
    print("OK [App.tsx comment fix A]: frontend/mobile/src/App.tsx")
else:
    # パターンB: 行全体を探して状況確認
    lines = app.split('\n')
    print("INFO: App.tsx 270-285行を確認:")
    for i, l in enumerate(lines[269:285], 270):
        print(f"  {i}: {repr(l)}")

    # 壊れた Route タグが残っている可能性を別パターンで探す
    if '<Route path="/map-test"' in app or '<Route path="/map-libre"' in app:
        app = re.sub(r'\s*<Route path="/map-test"[^/]*/>\s*', '\n', app)
        app = re.sub(r'\s*<Route path="/map-libre"[^/]*/>\s*', '\n', app)
        write("frontend/mobile/src/App.tsx", app)
        print("OK [App.tsx stale Route removed]: frontend/mobile/src/App.tsx")
    elif '// MapTest / MapLibreTest' in app:
        # // コメントが JSX の return ブロック内にある → {/* */} に変換
        app = re.sub(
            r'(\s*)// (MapTest / MapLibreTest[^\n]*)',
            r'\1{/* \2 */}',
            app
        )
        write("frontend/mobile/src/App.tsx", app)
        print("OK [App.tsx comment fix B]: frontend/mobile/src/App.tsx")

print("\n=== 完了 ===")
print("cd ~/projects/dump-tracker/backend  && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
print("cd ~/projects/dump-tracker/frontend/cms && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
print("cd ~/projects/dump-tracker/frontend/mobile && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5")
