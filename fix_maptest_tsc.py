import subprocess, sys, os
BASE = os.path.expanduser('~/projects/dump-tracker')
f = f'{BASE}/frontend/mobile/src/pages/MapTest.tsx'
with open(f, 'r', encoding='utf-8') as fp: c = fp.read()

c = c.replace('    let mapInstance: any = null;\n    let markerInstance: any = null;\n', '')
c = c.replace('        mapInstance = map;\n', '')
c = c.replace('        markerInstance = marker;\n', '')

with open(f, 'w', encoding='utf-8') as fp: fp.write(c)
print('OK: 未使用変数削除')

for proj, path in [('mobile','frontend/mobile'),('cms','frontend/cms'),('backend','backend')]:
    r = subprocess.run(['./node_modules/.bin/tsc','--noEmit'], cwd=f'{BASE}/{path}', capture_output=True, text=True)
    print(f'TSC {proj} RC: {r.returncode}')
    if r.returncode != 0:
        print(r.stdout[-1000:]); print(r.stderr[-500:])
        sys.exit(1)

print('TSC全RC=0 - git commit & push')
subprocess.run(['git','add','-A'], cwd=BASE)
r = subprocess.run(['git','commit','-m','fix: MapTest TSC未使用変数エラー解消'], cwd=BASE, capture_output=True, text=True)
print(r.stdout.strip())
r = subprocess.run(['git','push','origin','main'], cwd=BASE, capture_output=True, text=True)
print(f'Push RC: {r.returncode}')
