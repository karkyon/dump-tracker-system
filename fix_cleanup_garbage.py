import subprocess, sys, os
BASE = os.path.expanduser('~/projects/dump-tracker')

deleted = []
for f in ['fix_maptest_tsc.py', 'fix_maptest_webgl.py', 'fix_maptest_legacy.py',
          'fix_maptest_v2.py', 'fix_maptest_page.py']:
    p = f'{BASE}/{f}'
    if os.path.exists(p):
        os.remove(p)
        deleted.append(f)
        print(f'DELETE: {p}')

if not deleted:
    print('ゴミファイルなし')

# git status確認
r = subprocess.run(['git','status','--short'], cwd=BASE, capture_output=True, text=True)
print(r.stdout)

subprocess.run(['git','add','-A'], cwd=BASE)
r = subprocess.run(['git','commit','-m','chore: ゴミファイル全削除'], cwd=BASE, capture_output=True, text=True)
print(r.stdout.strip())
r = subprocess.run(['git','push','origin','main'], cwd=BASE, capture_output=True, text=True)
print(f'Push RC: {r.returncode}')
print(r.stderr.strip())
