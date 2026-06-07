#!/usr/bin/env python3
"""
DeveloperTools.tsx と LogViewer.tsx のデフォルトテーマをLightに変更
実行: python3 ~/projects/dump-tracker/fix_default_light.py
"""
import os, subprocess, sys

BASE = os.path.expanduser("~/projects/dump-tracker")

def read(rel):
    with open(os.path.join(BASE, rel), encoding='utf-8') as f:
        return f.read()

def write(rel, c):
    with open(os.path.join(BASE, rel), 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"OK: {rel}")

def run(cmd, cwd=BASE):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()

# ── DeveloperTools.tsx: LogViewerTab の dark デフォルトを false に ──
dt = read("frontend/cms/src/pages/DeveloperTools.tsx")

# LogViewerTab内の useState(true) → useState(false)
# 「dark」state だけを対象にする（他のbooleanと区別するため前後の文脈ごと置換）
dt = dt.replace(
    "  const [dark, setDark] = useState(true);\n"
    "  const todayJST",
    "  const [dark, setDark] = useState(false);\n"
    "  const todayJST"
)

# ServerLogLevelTab と ServerStatusTab は Tailwind の bg-gray-900 などダーク色を使っている
# これらをライト系に書き換える
# bg-gray-900 → bg-white / bg-gray-50
# border-gray-700 → border-gray-200
# text-gray-400 → text-gray-600
# text-white → text-gray-900
# text-gray-200 → text-gray-700
# text-gray-300 → text-gray-600
# bg-gray-800 → bg-gray-50
# text-gray-500 → text-gray-500 (そのまま)

# ServerLogLevelTab のダーク固定スタイルをライトに変換
# 対象: ServerLogLevelTab と ServerStatusTab の className 内
# ── ServerLogLevelTab: 外側コンテナ ──
dt = dt.replace(
    '<div className="space-y-6">\n'
    '      {/* ─ サーバーLogLv ─ */}\n'
    '      <div className="bg-gray-900 rounded-xl p-5 border border-yellow-800/60">',
    '<div className="space-y-6">\n'
    '      {/* ─ サーバーLogLv ─ */}\n'
    '      <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-200">'
)
dt = dt.replace(
    '          className="px-2 py-0.5 bg-yellow-900/60 text-yellow-400 text-xs font-bold rounded border border-yellow-700"',
    '          className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded border border-yellow-300"'
)
dt = dt.replace(
    '<h3 className="text-sm font-bold text-yellow-400">サーバーログレベル動的変更</h3>',
    '<h3 className="text-sm font-bold text-yellow-700">サーバーログレベル動的変更</h3>'
)
dt = dt.replace(
    '<p className="text-red-400">⚠️ 再起動するとリセット。永続化は <code className="bg-gray-700 px-1 rounded text-gray-200">backend/.env</code> の <code className="bg-gray-700 px-1 rounded text-gray-200">LOG_LEVEL</code> を変更してください。</p>\n'
    '          <p className="text-gray-500">※ ログビューアの「表示フィルター」とは別物です。表示フィルターは取得データの絞り込みで、書き込みには影響しません。</p>',
    '<p className="text-red-600">⚠️ 再起動するとリセット。永続化は <code className="bg-gray-100 px-1 rounded text-gray-700">backend/.env</code> の <code className="bg-gray-100 px-1 rounded text-gray-700">LOG_LEVEL</code> を変更してください。</p>\n'
    '          <p className="text-gray-500">※ ログビューアの「表示フィルター」とは別物です。表示フィルターは取得データの絞り込みで、書き込みには影響しません。</p>'
)
# LogLvボタン行
dt = dt.replace(
    "              ? 'border-blue-500 bg-blue-900/40'\n"
    "              : 'border-gray-600 bg-gray-800 hover:bg-gray-700'",
    "              ? 'border-blue-500 bg-blue-100'\n"
    "              : 'border-gray-300 bg-white hover:bg-gray-50'"
)
dt = dt.replace(
    '<span className="text-xs font-bold uppercase" style={{color:LEVEL_COLORS[lv]}}>{lv}</span>\n'
    '              <span className="text-xs text-gray-400 mt-1">{LEVEL_DESC[lv]}</span>',
    '<span className="text-xs font-bold uppercase" style={{color:LEVEL_COLORS[lv]}}>{lv}</span>\n'
    '              <span className="text-xs text-gray-600 mt-1">{LEVEL_DESC[lv]}</span>'
)
dt = dt.replace(
    '<p className="text-xs text-gray-500 mt-3">',
    '<p className="text-xs text-gray-500 mt-3" id="svrloglv-current">'
)
# ログファイル管理セクション
dt = dt.replace(
    '      <div className="bg-gray-900 rounded-xl p-5 border border-gray-700">\n'
    '        <div className="flex items-center gap-2 mb-2">\n'
    '          <span className="px-2 py-0.5 bg-yellow-900/60 text-yellow-400 text-xs font-bold rounded border border-yellow-700">\n'
    '            ⚠️ 開発者専用\n'
    '          </span>\n'
    '          <h3 className="text-sm font-bold text-blue-400">ログファイル管理設定</h3>',
    '      <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">\n'
    '        <div className="flex items-center gap-2 mb-2">\n'
    '          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded border border-yellow-300">\n'
    '            ⚠️ 開発者専用\n'
    '          </span>\n'
    '          <h3 className="text-sm font-bold text-blue-700">ログファイル管理設定</h3>'
)
dt = dt.replace(
    '<p className="text-red-400">\n'
    '          ⚠️ 現在 <code className="bg-gray-700 px-1 rounded text-gray-200">combined.log</code> は\n'
    '          <strong> 自動ローテーションなし</strong>の単一ファイル蓄積です。\n'
    '          本番前に自動退避を有効にするか <code className="bg-gray-700 px-1 rounded text-gray-200">winston-daily-rotate-file</code> を実装してください。\n'
    '        </p>',
    '<p className="text-red-600">\n'
    '          ⚠️ 現在 <code className="bg-gray-100 px-1 rounded text-gray-700">combined.log</code> は\n'
    '          <strong> 自動ローテーションなし</strong>の単一ファイル蓄積です。\n'
    '          本番前に自動退避を有効にするか <code className="bg-gray-100 px-1 rounded text-gray-700">winston-daily-rotate-file</code> を実装してください。\n'
    '        </p>'
)
dt = dt.replace(
    '              onChange={e=>setLogConfig({...logConfig,maxArchives:Number(e.target.value)})}\n'
    '              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm"/>',
    '              onChange={e=>setLogConfig({...logConfig,maxArchives:Number(e.target.value)})}\n'
    '              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm"/>'
)
dt = dt.replace(
    '              onChange={e=>setLogConfig({...logConfig,retentionDays:Number(e.target.value)})}\n'
    '              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm"/>',
    '              onChange={e=>setLogConfig({...logConfig,retentionDays:Number(e.target.value)})}\n'
    '              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm"/>'
)
dt = dt.replace(
    '              onChange={e=>setLogConfig({...logConfig,maxFileSizeMB:Number(e.target.value)})}\n'
    '              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm"/>',
    '              onChange={e=>setLogConfig({...logConfig,maxFileSizeMB:Number(e.target.value)})}\n'
    '              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm"/>'
)
dt = dt.replace(
    '              onChange={e=>setLogConfig({...logConfig,autoArchiveThresholdMB:Number(e.target.value)})}\n'
    '              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm"/>',
    '              onChange={e=>setLogConfig({...logConfig,autoArchiveThresholdMB:Number(e.target.value)})}\n'
    '              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm"/>'
)
# label text色
dt = dt.replace(
    '<label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">',
    '<label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">'
)
# ServerStatusTab: bg-gray-900 → bg-white, border-gray-700 → border-gray-200
dt = dt.replace(
    '          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">\n'
    '            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">CPU</h4>',
    '          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">\n'
    '            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">CPU</h4>'
)
dt = dt.replace(
    '          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">\n'
    '            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">メモリ</h4>',
    '          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">\n'
    '            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">メモリ</h4>'
)
dt = dt.replace(
    '          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">\n'
    '            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">ディスク (/)</h4>',
    '          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">\n'
    '            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">ディスク (/)</h4>'
)
dt = dt.replace(
    '          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">\n'
    '            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">サービス・ポート</h4>',
    '          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">\n'
    '            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">サービス・ポート</h4>'
)
# ServerStatus内のテキスト色
dt = dt.replace(
    'className="text-gray-400">{status.cpu.cores}<',
    'className="text-gray-600">{status.cpu.cores}<'
)
dt = dt.replace(
    'className="text-gray-200">{status.cpu.loadAvg5m}<',
    'className="text-gray-700">{status.cpu.loadAvg5m}<'
)
dt = dt.replace(
    'className="text-gray-200">{status.cpu.loadAvg15m}<',
    'className="text-gray-700">{status.cpu.loadAvg15m}<'
)
dt = dt.replace(
    'className="text-gray-200">{status.memory.usedMB} / {status.memory.totalMB} MB<',
    'className="text-gray-700">{status.memory.usedMB} / {status.memory.totalMB} MB<'
)
dt = dt.replace(
    'className="text-gray-200">{status.memory.nodeHeapUsedMB}/{status.memory.nodeHeapTotalMB} MB<',
    'className="text-gray-700">{status.memory.nodeHeapUsedMB}/{status.memory.nodeHeapTotalMB} MB<'
)
dt = dt.replace(
    'className="text-gray-200">{status.memory.nodeRssMB} MB<',
    'className="text-gray-700">{status.memory.nodeRssMB} MB<'
)
dt = dt.replace(
    'className="text-gray-200">{status.disk.used} / {status.disk.total}<',
    'className="text-gray-700">{status.disk.used} / {status.disk.total}<'
)
dt = dt.replace(
    'className="text-gray-200">{status.disk.free}<',
    'className="text-gray-700">{status.disk.free}<'
)
dt = dt.replace(
    'className="text-gray-200">{status.services.nodeUptime}<',
    'className="text-gray-700">{status.services.nodeUptime}<'
)
dt = dt.replace(
    'className="text-gray-200">{status.services.pid}<',
    'className="text-gray-700">{status.services.pid}<'
)
dt = dt.replace(
    'className="text-gray-200">{status.services.nodeVersion}<',
    'className="text-gray-700">{status.services.nodeVersion}<'
)
dt = dt.replace(
    '              <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">',
    '              <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">'
)
dt = dt.replace(
    '                    <span className="text-gray-400 font-mono">:{port} <span className="text-gray-500 text-xs">',
    '                    <span className="text-gray-600 font-mono">:{port} <span className="text-gray-400 text-xs">'
)
# text-gray-400 一括変換（ServerStatus内の label）
# label系
import re
dt = re.sub(
    r'<span className="text-gray-400">([^<]{1,20})</span><span className="(text-(?:green|red|yellow)-\d+)"',
    r'<span className="text-gray-600">\1</span><span className="\2"',
    dt
)

write("frontend/cms/src/pages/DeveloperTools.tsx", dt)

# ── LogViewer.tsx (後方互換ページ) も同様に dark → false ──
lv = read("frontend/cms/src/pages/LogViewer.tsx")
lv = lv.replace(
    "  const [dark, setDark] = useState(true);",
    "  const [dark, setDark] = useState(false);"
)
write("frontend/cms/src/pages/LogViewer.tsx", lv)

# ── TSC 3プロジェクト ──
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
    "git commit -m 'feat: DeveloperTools/LogViewer デフォルトLightモードに変更' && "
    "git push origin main"
)
print(out)
if rc != 0:
    print(f"❌ push失敗"); sys.exit(1)
print("✅ Push完了")
os.remove(os.path.join(BASE, "fix_default_light.py"))
print("OK remove: fix_default_light.py")
