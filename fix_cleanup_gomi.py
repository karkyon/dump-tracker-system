import subprocess, os

repo = '/home/karkyon/projects/dump-tracker'

# 削除対象ゴミファイル
gomi_files = [
    'fix_event_logging.py',
    'fix_event_log2.py',
    'fix_custom_item.py',
    'fix_light_ports_final.py',
    'fix_light_and_ports.py',
]

deleted = []
for f in gomi_files:
    p = os.path.join(repo, f)
    if os.path.exists(p):
        os.remove(p)
        deleted.append(f)
        print(f'OK remove: {f}')
    else:
        print(f'SKIP (not found): {f}')

if deleted:
    subprocess.run(['git', 'add', '-A'], cwd=repo)
    r = subprocess.run(['git', 'commit', '-m', 'chore: fix_*.py ゴミファイル削除'], cwd=repo, capture_output=True, text=True)
    print(r.stdout.strip())
    r2 = subprocess.run(['git', 'push', 'origin', 'main'], cwd=repo, capture_output=True, text=True)
    print(r2.stdout.strip() or r2.stderr.strip())
    print('✅ 完了')
else:
    print('削除対象なし')
