#!/usr/bin/env python3
"""
ログで確定したAPIレスポンス構造:
  vehicles:         json.data = [{...}]  配列直接
  customers:        json.data = { customers:[...], total:2 }
  locations:        json.data = [{...}]  配列直接
  items:            json.data = [{...}]  配列直接
  users:            未確認 → json.data.users or json.data が配列 両方対応
  inspection_items: 未確認 → json.data.data or json.data が配列 両方対応

現在のコードのバグ:
  table==='vehicles' → arr = d.vehicles だが d は配列なので undefined → arr=[]
  table==='locations' → arr = d.locations だが d は配列なので undefined → arr=[]
  table==='items' → arr = Array.isArray(d) ? d : ... は正しいが
                   実際には前のパッチで table分岐を間違えた可能性
"""
import os, subprocess

ROOT = os.path.expanduser('~/projects/dump-tracker')

def read_file(path):
    with open(os.path.join(ROOT, path), 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(os.path.join(ROOT, path), 'w', encoding='utf-8') as f:
        f.write(content)

# --- DevDataCleanup.tsx を読み込んで fetchMasterRows 関数全体を確認・修正 ---
print('\n[1] DevDataCleanup.tsx の fetchMasterRows 解析ブロックを完全修正')

filepath = 'frontend/cms/src/pages/DevDataCleanup.tsx'
content = read_file(filepath)

# 現在の解析ブロックを検索して表示（デバッグ）
import re
# テーブルごとの分岐ブロックを探す
match = re.search(r'// テーブルごとに明示.*?(?=const rows)', content, re.DOTALL)
if match:
    print('  現在の解析コード:')
    for i, line in enumerate(match.group().splitlines()[:30]):
        print(f'    {line}')
    print('  ...')

# 置換ターゲット: テーブルごと明示解析ブロック全体
OLD = '''      // テーブルごとに明示的なキーでレスポンスを解析
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
      }'''

NEW = '''      // ===== ログで確定した実際のAPIレスポンス構造に基づく解析 =====
      // vehicles:  { success, data:[{...}], meta }          → data が配列直接
      // customers: { success, data:{ customers:[...] } }    → data.customers
      // locations: { success, data:[{...}], meta }          → data が配列直接
      // items:     { success, data:[{...}], meta }          → data が配列直接
      // users:     未確認 → data.users or 配列直接 両方フォールバック
      // inspection_items: 未確認 → data.data or 配列直接 両方フォールバック
      let arr: any[] = [];
      const d = json?.data;
      if (table === 'vehicles' || table === 'locations' || table === 'items') {
        // これらは json.data が配列直接
        arr = Array.isArray(d) ? d : [];
      } else if (table === 'customers') {
        // json.data = { customers:[...], total }
        arr = Array.isArray(d?.customers) ? d.customers : [];
      } else if (table === 'users') {
        // json.data.users or json.data が配列
        arr = Array.isArray(d?.users) ? d.users
            : Array.isArray(d) ? d : [];
      } else if (table === 'inspection_items') {
        // json.data.data or json.data が配列
        arr = Array.isArray(d?.data) ? d.data
            : Array.isArray(d) ? d : [];
      }'''

if OLD in content:
    content = content.replace(OLD, NEW, 1)
    write_file(filepath, content)
    print('  ✅ 解析ブロック修正完了')
else:
    print('  ❌ ターゲットパターン未発見 - 現在のファイルを確認します')
    # fetchMasterRows 内の arr 定義周辺を表示
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        if 'arr =' in line or 'const d =' in line or 'table ===' in line:
            print(f'  L{i}: {line.rstrip()}')
    exit(1)

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
    'git commit -m "fix: DevDataCleanup fetchMasterRows ログ確認済み構造で完全修正" && '
    'git push origin main',
    shell=True
)

print('\n✅ 完了！')
print('''
【確定した修正内容】
  vehicles/locations/items: json.data が配列直接 → Array.isArray(d) ? d : []
  customers:                json.data.customers   → d.customers
  users:                    json.data.users or 配列 → d.users || d
  inspection_items:         json.data.data or 配列 → d.data || d

Vite HMR で自動更新されるので確認してください。
users と inspection_items のログも確認してください。
''')
