#!/usr/bin/env python3
import subprocess, sys, os

PROJ = os.path.expanduser('~/projects/dump-tracker')
TARGET = os.path.join(PROJ, 'backend/src/services/reportService.ts')

with open(TARGET, 'r', encoding='utf-8') as f:
    src = f.read()

# エラー1,2: cur?.loadingLocation / cur?.itemName → null チェック付きに修正
OLD1 = "        loadingLocation: locName || cur?.loadingLocation || '',\n        unloadingLocation: '',\n        itemName: itemName || cur?.itemName || '',"
NEW1 = "        loadingLocation: locName || (cur != null ? cur.loadingLocation : '') || '',\n        unloadingLocation: '',\n        itemName: itemName || (cur != null ? cur.itemName : '') || '',"

# エラー3: cur.customerName → contractorName で存在チェック
OLD2 = "        if (!cur.customerName && customerName) (cur as any).contractorName = customerName;"
NEW2 = "        if (!cur.contractorName && customerName) cur.contractorName = customerName;"

ok = True
if OLD1 in src:
    src = src.replace(OLD1, NEW1)
    print('✅ cur?.loadingLocation / cur?.itemName 修正完了')
else:
    print('❌ anchor1 not found')
    ok = False

if OLD2 in src:
    src = src.replace(OLD2, NEW2)
    print('✅ cur.customerName → cur.contractorName 修正完了')
else:
    print('❌ anchor2 not found')
    ok = False

if not ok:
    sys.exit(1)

with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(src)
print(f'✅ Written: {TARGET}')

def compile_project(name, subdir):
    cwd = os.path.join(PROJ, subdir)
    result = subprocess.run(
        ['./node_modules/.bin/tsc', '--noEmit'],
        capture_output=True, text=True, cwd=cwd
    )
    if result.returncode == 0:
        print(f'✅ {name} OK')
        return True
    else:
        print(f'❌ {name} compile error')
        print(result.stdout[:3000])
        return False

print('🔧 backend compile...')
ok_be = compile_project('backend', 'backend')
if not ok_be:
    sys.exit(1)

print('🔧 frontend/cms compile...')
ok_cms = compile_project('frontend/cms', 'frontend/cms')

print('🔧 frontend/mobile compile...')
ok_mob = compile_project('frontend/mobile', 'frontend/mobile')

if ok_be and ok_cms and ok_mob:
    print('🚀 git commit & push...')
    subprocess.run(['git', 'add', '-A'], cwd=PROJ)
    msg = ('fix: 日報PDF LOADING/UNLOADING ARRIVEDとCOMPLETEDのペアリングバグ修正\n'
           '- LOADING_ARRIVED->LOADING_COMPLETEDを同一サイクルにマージ（積込終了時刻空白修正）\n'
           '- UNLOADING_ARRIVED->UNLOADING_COMPLETEDを同一サイクルにマージ（荷降場所/品名ブランク・行重複修正）\n'
           '- TSコンパイルエラー修正（Partial<RawCycle>型安全化・customerName→contractorName）')
    r = subprocess.run(['git', 'commit', '-m', msg], capture_output=True, text=True, cwd=PROJ)
    print(r.stdout)
    if r.returncode != 0 and 'nothing to commit' not in r.stdout:
        print(r.stderr); sys.exit(1)
    r2 = subprocess.run(['git', 'push'], capture_output=True, text=True, cwd=PROJ)
    print(r2.stdout)
    if r2.returncode != 0:
        print(r2.stderr); sys.exit(1)
    print('✅ DONE')
else:
    print('❌ コンパイルエラーのため push 中止')
    sys.exit(1)
