import subprocess, sys

# ===================================================
# ファイル1: DeveloperTools.tsx
# ===================================================
fe_path = '/home/karkyon/projects/dump-tracker/frontend/cms/src/pages/DeveloperTools.tsx'
with open(fe_path, 'r', encoding='utf-8') as f:
    src = f.read()

orig = src

# 1. ServerLogLevelTab外枠: bg-gray-900 → bg-amber-50, border-yellow-800/60 → border-yellow-300
src = src.replace(
    '<div className="bg-gray-900 rounded-xl p-5 border border-yellow-800/60">',
    '<div className="bg-amber-50 rounded-xl p-5 border border-yellow-300">'
)

# 2. 開発者専用バッジ inside ServerLogLevelTab: bg-yellow-900/60 text-yellow-400 border-yellow-700
src = src.replace(
    'className="px-2 py-0.5 bg-yellow-900/60 text-yellow-400 text-xs font-bold rounded border border-yellow-700"',
    'className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded border border-yellow-300"'
)

# 3. strong text-yellow-300 → text-yellow-700
src = src.replace(
    '<strong className="text-yellow-300">書き込むログの種類</strong>',
    '<strong className="text-yellow-700">書き込むログの種類</strong>'
)

# 4. 更新ボタン bg-gray-700 → bg-blue-600 (ServerStatusTab)
src = src.replace(
    'className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded disabled:opacity-50"',
    'className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50"'
)

# 5. CPU cores text-white → text-gray-900
src = src.replace(
    '<span className="text-white">{status.cpu.cores}</span>',
    '<span className="text-gray-900 font-medium">{status.cpu.cores}</span>'
)

# 6. ポートラベル修正 (3001/3002 → 80/443)
src = src.replace(
    "const PORT_LABELS: Record<number, string> = { 3000: 'Backend内部(nginx経由)', 3001: 'CMS dev(開発専用)', 3002: 'Mobile dev(開発専用)', 3003: 'CMS prod(nginx)', 5432: 'PostgreSQL' };",
    "const PORT_LABELS: Record<number, string> = { 80: 'HTTP (nginx→HTTPS redirect)', 443: 'HTTPS (Mobile/CMS nginx)', 3000: 'Backend内部 (nginxがproxy)', 3003: 'CMS prod (nginx)', 5432: 'PostgreSQL' };"
)

# 7. ポート期待状態修正
src = src.replace(
    "const PORT_EXPECTED_OPEN: Record<number, boolean> = { 3000: false, 3001: false, 3002: false, 3003: true, 5432: true };",
    "const PORT_EXPECTED_OPEN: Record<number, boolean> = { 80: true, 443: true, 3000: false, 3003: true, 5432: true };"
)

# 8. ステータスバッジ dark → light
src = src.replace(
    "'bg-green-900/50 text-green-400 border border-green-700' : 'bg-red-900/50 text-red-400 border border-red-700'",
    "'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'"
)

changes = []
if src != orig:
    if 'bg-amber-50' in src: changes.append('ServerLogLv外枠ライト化')
    if 'bg-yellow-100 text-yellow-700' in src and 'border-yellow-300"' in src: changes.append('開発者専用バッジライト化')
    if 'text-yellow-700">書き込む' in src: changes.append('strong text-yellow-700')
    if 'bg-blue-600 hover:bg-blue-700' in src: changes.append('更新ボタンblue')
    if 'text-gray-900 font-medium' in src: changes.append('CPU cores text-gray-900')
    if "80: 'HTTP" in src: changes.append('ポートラベル80/443追加')
    if '80: true, 443: true' in src: changes.append('ポート期待値修正')
    if "bg-green-100 text-green-700 border border-green-300'" in src: changes.append('バッジライト化')
    for c in changes: print(f'OK [{c}]: DeveloperTools.tsx')
else:
    print('WARNING: DeveloperTools.tsx 変更なし')

with open(fe_path, 'w', encoding='utf-8') as f:
    f.write(src)

# ===================================================
# ファイル2: logRoutes.ts — ポートチェックリスト修正
# ===================================================
be_path = '/home/karkyon/projects/dump-tracker/backend/src/routes/logRoutes.ts'
with open(be_path, 'r', encoding='utf-8') as f:
    bsrc = f.read()

borig = bsrc

# checkPorts: [3000, 3001, 3002, 3003, 5432] → [80, 443, 3000, 3003, 5432]
bsrc = bsrc.replace(
    'const checkPorts = [3000, 3001, 3002, 3003, 5432];',
    'const checkPorts = [80, 443, 3000, 3003, 5432];'
)

if bsrc != borig:
    print('OK [ポートチェックリスト 80/443追加]: logRoutes.ts')
    with open(be_path, 'w', encoding='utf-8') as f:
        f.write(bsrc)
else:
    print('WARNING: logRoutes.ts 変更なし')

# ===================================================
# TSC チェック → 全RC=0ならgit push
# ===================================================
print('\n=== TSC チェック ===')
results = []
for pkg, wd in [
    ('backend', '/home/karkyon/projects/dump-tracker/backend'),
    ('frontend/cms', '/home/karkyon/projects/dump-tracker/frontend/cms'),
    ('frontend/mobile', '/home/karkyon/projects/dump-tracker/frontend/mobile'),
]:
    r = subprocess.run(
        ['./node_modules/.bin/tsc', '--noEmit'],
        cwd=wd, capture_output=True, text=True
    )
    if r.returncode == 0:
        print(f'✅ {pkg}: RC=0')
        results.append(True)
    else:
        print(f'❌ {pkg}:')
        for line in (r.stdout + r.stderr).strip().splitlines()[-10:]:
            print(f'   {line}')
        results.append(False)

if all(results):
    print('\n=== git push ===')
    repo = '/home/karkyon/projects/dump-tracker'
    subprocess.run(['git', 'add', '-A'], cwd=repo)
    r = subprocess.run(
        ['git', 'commit', '-m', 'fix: ServerLogLvタブ完全ライト化・ポート修正(80/443追加・3001/3002削除)'],
        cwd=repo, capture_output=True, text=True
    )
    print(r.stdout.strip())
    r2 = subprocess.run(['git', 'push', 'origin', 'main'], cwd=repo, capture_output=True, text=True)
    print(r2.stdout.strip() or r2.stderr.strip())
    print('✅ Push完了')
else:
    print('❌ TSCエラーあり → push中止')
