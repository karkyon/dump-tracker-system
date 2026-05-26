#!/usr/bin/env python3
"""
DevDataCleanup.tsx fetchMasterRows のレスポンス解析を各APIの実際の構造に合わせて修正

確認済みレスポンス構造:
  vehicles:         { data: { vehicles: [...] } }  ← vehicleStore.ts パターン2
  users:            { data: { users: [...] } }      ← userStore.ts パターン1
  customers:        { data: { customers: [...], total } }  ← customerController.ts sendSuccess
  locations:        { data: { data: [...] } } or { data: { locations: [...] } }  ← masterStore.ts
  items:            { data: [...] }  ← itemController.ts res.json直接 (data=配列)
  inspection_items: { data: { data: [...], meta } }  ← inspectionItemController sendSuccess(result)
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

print('\n[1] DevDataCleanup.tsx - fetchMasterRows レスポンス解析を全面修正')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    '''      // レスポンス構造の多段階解析
      let arr: any[] = [];
      const d = json?.data;
      if (Array.isArray(d?.data?.vehicles))        arr = d.data.vehicles;
      else if (Array.isArray(d?.data?.users))       arr = d.data.users;
      else if (Array.isArray(d?.data?.customers))   arr = d.data.customers;
      else if (Array.isArray(d?.data?.locations))   arr = d.data.locations;
      else if (Array.isArray(d?.data?.items))       arr = d.data.items;
      else if (Array.isArray(d?.data?.data))        arr = d.data.data;
      else if (Array.isArray(d?.data))              arr = d.data;
      else if (Array.isArray(d))                    arr = d;''',
    '''      // レスポンス構造の多段階解析（各APIの実際の構造に対応）
      let arr: any[] = [];
      const d = json?.data;
      // 二重ネスト解消: APIクライアントが { success, data: <バックエンドレスポンス> } を返す
      // バックエンドは sendSuccess(res, payload) で { success, data: payload } を返す
      // vehicles:   payload = { vehicles: [...] }
      // users:      payload = { users: [...] }
      // customers:  payload = { customers: [...], total }
      // locations:  payload = { locations: [...] } or { data: [...] }
      // items:      res.json直接 → data が配列
      // inspection_items: payload = { data: [...], meta } (inspectionService結果そのまま)
      if (Array.isArray(d?.vehicles))              arr = d.vehicles;
      else if (Array.isArray(d?.users))            arr = d.users;
      else if (Array.isArray(d?.customers))        arr = d.customers;
      else if (Array.isArray(d?.locations))        arr = d.locations;
      else if (Array.isArray(d?.data))             arr = d.data;   // items直接配列 or inspection_items
      else if (Array.isArray(d))                   arr = d;
      // 二重ネスト (APIクライアントが d={success,data:{...}} で返す場合)
      else if (Array.isArray(d?.data?.vehicles))   arr = d.data.vehicles;
      else if (Array.isArray(d?.data?.users))      arr = d.data.users;
      else if (Array.isArray(d?.data?.customers))  arr = d.data.customers;
      else if (Array.isArray(d?.data?.locations))  arr = d.data.locations;
      else if (Array.isArray(d?.data?.data))       arr = d.data.data;
      else if (Array.isArray(d?.data))             arr = d.data;''',
    'fetchMasterRows レスポンス解析修正'
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
    'git commit -m "fix: DevDataCleanup fetchMasterRows レスポンス解析を各API構造に合わせて修正" && '
    'git push origin main',
    shell=True
)

print('\n✅ 完了！')
print('''
【修正内容】
  各APIの実際のレスポンス構造に合わせた解析順序に変更:
    vehicles:         d.vehicles         (vehicleController: sendSuccess({vehicles:[...]})
    users:            d.users            (userController:    sendSuccess({users:[...]})
    customers:        d.customers        (customerController: sendSuccess({customers:[...]})
    locations:        d.locations        (locationController: sendSuccess({locations:[...]})
    items:            d.data             (itemController:    res.json({data:[...],meta})
    inspection_items: d.data             (inspectionItemController: sendSuccess({data:[...],meta})
    → 二重ネスト(APIクライアント経由)のフォールバックも追加

【確認項目】
  ユーザー(DRIVER) 3件 → 表示される
  客先マスタ 2件 → 表示される
  点検項目マスタ 39件 → 表示される
  積込・積降場所マスタ 30件 → 表示される (limit修正済み)
  品目マスタ 10件 → 表示される (limit修正済み)
''')
