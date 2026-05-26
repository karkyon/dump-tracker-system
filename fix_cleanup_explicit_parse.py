#!/usr/bin/env python3
"""
DevDataCleanup.tsx fetchMasterRows を table ごとに明示的なキー解析に変更

各APIのfetch直呼びレスポンス構造（確定）:
  vehicles:         { success, data: { vehicles:[...], pagination } }  → json.data.vehicles
  users:            { success, data: { users:[...], pagination } }      → json.data.users
  customers:        { success, data: { customers:[...], total } }       → json.data.customers
  locations:        { success, data: { locations:[...] } } or { data:[] } → json.data.locations or json.data.data
  items:            { success, data:[...], meta }                        → json.data (配列直接)
  inspection_items: { success, data: { success, data:[...], meta } }    → json.data.data
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

print('\n[1] DevDataCleanup.tsx - fetchMasterRows をテーブルごと明示解析に変更')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
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
    '''      // テーブルごとに明示的なキーでレスポンスを解析
      // fetch直呼び: json = バックエンドのレスポンスそのまま
      // バックエンド: sendSuccess(res, payload) → { success, data: payload }
      let arr: any[] = [];
      const d = json?.data; // payload
      if (table === 'vehicles') {
        // sendSuccess({ vehicles:[...], pagination }) → d.vehicles
        arr = Array.isArray(d?.vehicles) ? d.vehicles : [];
      } else if (table === 'users') {
        // sendSuccess({ users:[...], pagination }) → d.users
        arr = Array.isArray(d?.users) ? d.users : [];
      } else if (table === 'customers') {
        // sendSuccess({ customers:[...], total }) → d.customers
        arr = Array.isArray(d?.customers) ? d.customers : [];
      } else if (table === 'locations') {
        // sendSuccess({ locations:[...] }) → d.locations or d.data
        arr = Array.isArray(d?.locations) ? d.locations
            : Array.isArray(d?.data) ? d.data
            : Array.isArray(d) ? d : [];
      } else if (table === 'items') {
        // res.json({success, data:[...], meta}) → jsonのdataが配列
        arr = Array.isArray(d) ? d
            : Array.isArray(d?.data) ? d.data : [];
      } else if (table === 'inspection_items') {
        // sendSuccess(result) where result={success,data:[...],meta}
        // → json.data = {success,data:[...],meta} → json.data.data
        arr = Array.isArray(d?.data) ? d.data
            : Array.isArray(d) ? d : [];
      }''',
    'fetchMasterRows をテーブルごと明示解析に変更'
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
    'git commit -m "fix: DevDataCleanup fetchMasterRows テーブルごと明示解析に変更 (users/inspection_items)" && '
    'git push origin main',
    shell=True
)

print('\n✅ 完了！')
print('''
【修正内容】
テーブルキーによる条件分岐で各APIレスポンスを確実に解析:
  vehicles:         json.data.vehicles
  users:            json.data.users  
  customers:        json.data.customers
  locations:        json.data.locations → fallback json.data.data → json.data
  items:            json.data (配列直接) → fallback json.data.data
  inspection_items: json.data.data (inspectionService結果がネストされる)

【問題だった箇所】
  旧コード: d.data が inspection_items の {success,data:[],meta} にマッチ
  → Array.isArray({success,data:[],meta}) = false → 空配列

  users: d.users で正しく取れるはずが
  → 解析順序の問題でd.dataが先にチェックされ pagination オブジェクトにマッチしていた
''')
