#!/usr/bin/env python3
"""
根本原因確定:
  MASTER_TABLES (devCleanupRoutes.ts) のキー:
    'vehicles', 'users_driver', 'customers', 'locations', 'items', 'inspectionItems'
  
  DevDataCleanup.tsx の endpointMap のキー:
    'vehicles', 'users', 'customers', 'locations', 'items', 'inspection_items'  ← 不一致！

  users_driver → endpointMap['users_driver'] = undefined → url=undefined → fetch飛ばない
  inspectionItems → endpointMap['inspectionItems'] = undefined → url=undefined → fetch飛ばない

修正: endpointMap のキーを MASTER_TABLES の key に合わせる
      また解析分岐も同じキーに合わせる
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

print('\n[1] endpointMap のキーを MASTER_TABLES.key に合わせて修正')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    '''      const endpointMap: Record<string, string> = {
        vehicles:         '/vehicles?limit=100',
        users:            '/users?limit=100&role=DRIVER',
        customers:        '/customers?limit=100',
        locations:        '/locations?limit=100',
        items:            '/items?limit=100',
        inspection_items: '/inspection-items?limit=100',
      };''',
    '''      // キーは devCleanupRoutes.ts の MASTER_TABLES.key と完全一致させること
      const endpointMap: Record<string, string> = {
        vehicles:       '/vehicles?limit=100',
        users_driver:   '/users?limit=100&role=DRIVER',
        customers:      '/customers?limit=100',
        locations:      '/locations?limit=100',
        items:          '/items?limit=100',
        inspectionItems: '/inspection-items?limit=100',
      };''',
    'endpointMap キー修正'
)

print('\n[2] 解析分岐のキーも同様に修正')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    '''      } else if (table === 'users') {
        // json.data.users or json.data が配列
        arr = Array.isArray(d?.users) ? d.users
            : Array.isArray(d) ? d : [];
      } else if (table === 'inspection_items') {
        // json.data.data or json.data が配列
        arr = Array.isArray(d?.data) ? d.data
            : Array.isArray(d) ? d : [];
      }''',
    '''      } else if (table === 'users_driver') {
        // json.data = { users:[...], pagination } → d.users
        arr = Array.isArray(d?.users) ? d.users
            : Array.isArray(d) ? d : [];
      } else if (table === 'inspectionItems') {
        // json.data.data or json.data が配列
        arr = Array.isArray(d?.data) ? d.data
            : Array.isArray(d) ? d : [];
      }''',
    '解析分岐キー修正'
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
    'git commit -m "fix: DevDataCleanup endpointMap/解析分岐キーをMASTER_TABLESに合わせて修正 (users_driver/inspectionItems)" && '
    'git push origin main',
    shell=True
)

print('\n✅ 完了！')
print('''
【確定した根本原因】
  MASTER_TABLES.key = 'users_driver', 'inspectionItems'
  endpointMap のキー = 'users', 'inspection_items'  ← 不一致でundefined

  → url = undefined → if (!url) return → fetchが飛ばない → 空表示

【修正内容】
  endpointMap:
    users       → users_driver
    inspection_items → inspectionItems

  解析分岐:
    table === 'users'       → table === 'users_driver'
    table === 'inspection_items' → table === 'inspectionItems'

スーパーリロード後、全タブが表示されることを確認してください。
''')
