#!/usr/bin/env python3
"""
DeveloperTools.tsx:
  1. ServerLogLevelTab 残存ダーク色を完全ライト化
  2. ServerStatusTab ポートラベル・期待値を staging 実態に合わせて正確化
実行: python3 ~/projects/dump-tracker/fix_light_and_ports.py
"""
import os, subprocess, sys, re

BASE = os.path.expanduser("~/projects/dump-tracker")
FILE = os.path.join(BASE, "frontend/cms/src/pages/DeveloperTools.tsx")

def run(cmd, cwd=BASE):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()

with open(FILE, encoding='utf-8') as f:
    src = f.read()

# ══════════════════════════════════════════════════════
# 1. ServerLogLevelTab: 残存ダーク色を全部ライトに置換
# ══════════════════════════════════════════════════════

# LogLv選択ボタン アクティブ色: bg-blue-900/40 → bg-blue-100
src = src.replace(
    "'border-blue-500 bg-blue-900/40' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'",
    "'border-blue-500 bg-blue-100'     : 'border-gray-300 bg-white hover:bg-gray-50'"
)

# 現在のセッション設定テキスト: text-blue-300 → text-blue-700
src = src.replace(
    '<span className="text-blue-300 font-mono">{currentLevel || \'（変更なし）\'}</span>',
    '<span className="text-blue-700 font-mono font-bold">{currentLevel || \'（変更なし）\'}</span>'
)

# ログ管理設定の残存ダーク
src = src.replace(
    '<div className="text-xs text-gray-400 mb-4 space-y-1">\n'
    '          <p>アーカイブ世代数・自動退避閾値を設定します。</p>\n'
    '          <p className="text-red-400">\n'
    '            ⚠️ 現在 <code className="bg-gray-700 px-1 rounded text-gray-200">combined.log</code> は\n'
    '            <strong> 自動ローテーションなし</strong>の単一ファイル蓄積です。\n'
    '            本番前に自動退避を有効にするか <code className="bg-gray-700 px-1 rounded text-gray-200">winston-daily-rotate-file</code> を実装してください。\n'
    '          </p>\n'
    '        </div>',
    '<div className="text-xs text-gray-600 mb-4 space-y-1">\n'
    '          <p>アーカイブ世代数・自動退避閾値を設定します。</p>\n'
    '          <p className="text-red-600">\n'
    '            ⚠️ 現在 <code className="bg-gray-100 px-1 rounded text-gray-700">combined.log</code> は\n'
    '            <strong> 自動ローテーションなし</strong>の単一ファイル蓄積です。\n'
    '            本番前に自動退避を有効にするか <code className="bg-gray-100 px-1 rounded text-gray-700">winston-daily-rotate-file</code> を実装してください。\n'
    '          </p>\n'
    '        </div>'
)

# label text-gray-300 → text-gray-700
src = src.replace(
    '<label className="text-xs text-gray-300 block mb-1">最大アーカイブ世代数</label>',
    '<label className="text-xs text-gray-700 block mb-1">最大アーカイブ世代数</label>'
)
src = src.replace(
    '<label className="text-xs text-gray-300 block mb-1">ログ保持期間（日）</label>',
    '<label className="text-xs text-gray-700 block mb-1">ログ保持期間（日）</label>'
)
src = src.replace(
    '<label className="text-xs text-gray-300 block mb-1">最大ファイルサイズ (MB)</label>',
    '<label className="text-xs text-gray-700 block mb-1">最大ファイルサイズ (MB)</label>'
)
src = src.replace(
    '<label className="text-xs text-gray-300 block mb-1">自動退避閾値 (MB)</label>',
    '<label className="text-xs text-gray-700 block mb-1">自動退避閾値 (MB)</label>'
)

# ログLv 説明 text-gray-400 のうち残ったもの
src = src.replace(
    '<div className="text-xs text-gray-400 mb-2 space-y-1">',
    '<div className="text-xs text-gray-600 mb-2 space-y-1">'
)

# ══════════════════════════════════════════════════════
# 2. ServerStatusTab: ポートラベルとlogLv色・期待値修正
#    staging実態:
#      3000 = Backend (Node.js内部ポート) → nginx経由のためCLOSED=正常
#      3001 = CMS dev (omega-devのみ) → stagingではCLOSED=正常
#      3002 = Mobile dev (omega-devのみ) → stagingではCLOSED=正常
#      3003 = CMS prod (nginx) → OPEN=正常
#      5432 = PostgreSQL → OPEN=正常
# ══════════════════════════════════════════════════════

# PORT_LABELS を実態に合わせて更新
src = src.replace(
    "const PORT_LABELS: Record<number, string> = { 3000: 'Backend API', 3001: 'CMS dev', 3002: 'Mobile dev', 3003: 'CMS prod', 5432: 'PostgreSQL' };",
    "const PORT_LABELS: Record<number, string> = { 3000: 'Backend内部(nginx経由)', 3001: 'CMS dev(開発専用)', 3002: 'Mobile dev(開発専用)', 3003: 'CMS prod(nginx)', 5432: 'PostgreSQL' };\n"
    "  // staging での期待状態: 3003/5432=OPEN, 3000/3001/3002=CLOSED(正常)\n"
    "  const PORT_EXPECTED_OPEN: Record<number, boolean> = { 3000: false, 3001: false, 3002: false, 3003: true, 5432: true };"
)

# badge の使い方: OPEN/CLOSEDを期待値で色付け
# 現在: badge(open, 'OPEN', 'CLOSED') → 期待値と一致するかで green/red
src = src.replace(
    "                    {badge(open, 'OPEN', 'CLOSED')}",
    "                    {(() => { const exp = PORT_EXPECTED_OPEN[Number(port)]; const ok = open === exp; return <span className={`px-2 py-0.5 rounded text-xs font-bold border ${ ok ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300' }`}>{open ? '✅ OPEN' : '❌ CLOSED'}{!ok ? ' ⚠️' : ''}</span>; })()}"
)

# ログLv 色: text-blue-300 → text-blue-700
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">ログLv</span><span className="text-blue-300 font-mono">{status.logLevel}</span></div>',
    '<div className="flex justify-between"><span className="text-gray-600">ログLv</span><span className="text-blue-700 font-mono font-bold">{status.logLevel}</span></div>'
)

# 残存 text-gray-400 の label を text-gray-600 に（ServerStatus内）
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">コア数</span>',
    '<div className="flex justify-between"><span className="text-gray-600">コア数</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">Load (1m)</span>',
    '<div className="flex justify-between"><span className="text-gray-600">Load (1m)</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">Load (5m)</span>',
    '<div className="flex justify-between"><span className="text-gray-600">Load (5m)</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">Load (15m)</span>',
    '<div className="flex justify-between"><span className="text-gray-600">Load (15m)</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">使用率</span>',
    '<div className="flex justify-between"><span className="text-gray-600">使用率</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">使用/総計</span>',
    '<div className="flex justify-between"><span className="text-gray-600">使用/総計</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">Node Heap</span>',
    '<div className="flex justify-between"><span className="text-gray-600">Node Heap</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">Node RSS</span>',
    '<div className="flex justify-between"><span className="text-gray-600">Node RSS</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">使用率</span>',
    '<div className="flex justify-between"><span className="text-gray-600">使用率</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">使用/総計</span>',
    '<div className="flex justify-between"><span className="text-gray-600">使用/総計</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">空き</span>',
    '<div className="flex justify-between"><span className="text-gray-600">空き</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">ログファイル</span>',
    '<div className="flex justify-between"><span className="text-gray-600">ログファイル</span>'
)
src = src.replace(
    '<div className="flex justify-between items-center">\n'
    '                <span className="text-gray-600">Backend systemd</span>',
    '<div className="flex justify-between items-center">\n'
    '                <span className="text-gray-700 font-medium">Backend systemd</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">稼働時間</span>',
    '<div className="flex justify-between"><span className="text-gray-600">稼働時間</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">PID</span>',
    '<div className="flex justify-between"><span className="text-gray-600">PID</span>'
)
src = src.replace(
    '<div className="flex justify-between"><span className="text-gray-400">Node.js</span>',
    '<div className="flex justify-between"><span className="text-gray-600">Node.js</span>'
)

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)
print("OK: DeveloperTools.tsx")

# ══════════════════════════════════════════════════════
# TSC 3プロジェクト
# ══════════════════════════════════════════════════════
print("\n=== TSC ===")
projects = [
    ("backend",         os.path.join(BASE, "backend")),
    ("frontend/cms",    os.path.join(BASE, "frontend/cms")),
    ("frontend/mobile", os.path.join(BASE, "frontend/mobile")),
]
all_ok = True
for name, cwd in projects:
    rc, out = run("./node_modules/.bin/tsc --noEmit 2>&1 | tail -8", cwd=cwd)
    errors = [l for l in out.splitlines() if "error TS" in l]
    if errors:
        print(f"❌ {name}:")
        for e in errors: print(f"   {e}")
        all_ok = False
    else:
        print(f"✅ {name}: RC=0")

if not all_ok:
    print("❌ エラーあり → push 中止"); sys.exit(1)

print("\n=== git push ===")
rc, out = run(
    "git add -A && "
    "git commit -m 'fix: ServerLogLvタブ完全ライト化・ポートラベル/期待値を実態に合わせ修正' && "
    "git push origin main"
)
print(out)
if rc != 0:
    print("❌ push失敗"); sys.exit(1)
print("✅ Push完了")
os.remove(os.path.join(BASE, "fix_light_and_ports.py"))
print("OK remove: fix_light_and_ports.py")
