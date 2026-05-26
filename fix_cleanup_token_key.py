#!/usr/bin/env python3
"""
DevDataCleanup.tsx: localStorage.getItem('token') → localStorage.getItem('auth_token') に修正
CMSの正しいキーは STORAGE_KEYS.AUTH_TOKEN = 'auth_token'
"""
import os, subprocess

ROOT = os.path.expanduser('~/projects/dump-tracker')

def patch(path, old, new, label):
    full = os.path.join(ROOT, path)
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'  ❌ [{label}] パターン未発見')
        return False
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'  ✅ [{label}]')
    return True

print('\n[1] DevDataCleanup.tsx - token → auth_token')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    "Authorization: `Bearer ${localStorage.getItem('token') || ''}`,",
    "Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,",
    "localStorage key 'token' → 'auth_token'"
)

print('\n[TypeScript コンパイルチェック - CMS]')
r = subprocess.run(
    'cd ~/projects/dump-tracker/frontend/cms && npx tsc --noEmit 2>&1',
    shell=True, capture_output=True, text=True
)
errors = [l for l in (r.stdout+r.stderr).splitlines() if 'error TS' in l]
if errors:
    print('❌ TSエラー:')
    for e in errors: print(' ', e)
    exit(1)
print('✅ TypeScript: エラー 0件')

print('\n[Git commit & push...]')
subprocess.run(
    'cd ~/projects/dump-tracker && git add -A && '
    'git commit -m "fix: DevDataCleanup localStorage key \'token\'→\'auth_token\' (401修正)" && '
    'git push origin main',
    shell=True
)
print('\n✅ 完了！ Viteが自動リロードするので確認してください。')
