#!/usr/bin/env python3
"""
1. タブクリック時に直接 fetchMasterRows を呼ぶように変更（useEffect依存に頼らない）
2. fetchMasterRows の先頭と末尾にも詳細ログ追加
3. users と inspection_items のレスポンス構造を確実に確認できるようにする
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

# [1] fetchMasterRows の先頭にログ追加（関数エントリ確認）
print('\n[1] fetchMasterRows 関数エントリにログ追加')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    '''  const fetchMasterRows = useCallback(async (table: string) => {
    setMasterLoading(true);
    setSelectedIds(new Set());
    try {''',
    '''  const fetchMasterRows = useCallback(async (table: string) => {
    console.log(`🔥 [DevCleanup] fetchMasterRows 呼び出し開始 table=${table}`);
    setMasterLoading(true);
    setSelectedIds(new Set());
    try {''',
    'fetchMasterRows エントリログ'
)

# [2] fetchMasterRows の末尾（arr確定後）にログ追加
print('\n[2] arr確定後にログ追加')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    '''      const rows: MasterRow[] = arr.map((r: any) => ({
        id: r.id,
        label: r.plateNumber || r.name || r.username || '(不明)',
        sub: r.model || r.role || r.address || r.unit || r.inspectionType || '',
      }));
      setMasterRows(rows);''',
    '''      console.log(`✅ [DevCleanup] arr確定 table=${table} 件数=${arr.length}`, arr.slice(0,2));
      const rows: MasterRow[] = arr.map((r: any) => ({
        id: r.id,
        label: r.plateNumber || r.name || r.username || '(不明)',
        sub: r.model || r.role || r.address || r.unit || r.inspectionType || '',
      }));
      console.log(`✅ [DevCleanup] setMasterRows 件数=${rows.length}`, rows);
      setMasterRows(rows);''',
    'arr確定後ログ'
)

# [3] タブクリック時に直接 fetchMasterRows を呼ぶ（useEffectに頼らず確実に発火）
print('\n[3] タブクリックで直接fetchMasterRows呼び出し')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    '''            onClick={() => setActiveTable(t.key)}''',
    '''            onClick={() => {
                console.log(`🖱️ [DevCleanup] タブクリック key=${t.key} phase=${phase}`);
                setActiveTable(t.key);
                fetchMasterRows(t.key);
              }}''',
    'タブクリック直接fetchMasterRows呼び出し'
)

# [4] useEffect にもログ追加
print('\n[4] useEffect にログ追加')
patch(
    'frontend/cms/src/pages/DevDataCleanup.tsx',
    '''  useEffect(() => {
    if (phase === 'master') fetchMasterRows(activeTable);
  }, [phase, activeTable, fetchMasterRows]);''',
    '''  useEffect(() => {
    console.log(`⚡ [DevCleanup] useEffect発火 phase=${phase} activeTable=${activeTable}`);
    if (phase === 'master') {
      console.log(`⚡ [DevCleanup] useEffect → fetchMasterRows(${activeTable}) 呼び出し`);
      fetchMasterRows(activeTable);
    }
  }, [phase, activeTable, fetchMasterRows]);''',
    'useEffectログ追加'
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
    'git commit -m "debug: fetchMasterRows タブクリック直接呼出し + 全箇所にログ追加" && '
    'git push origin main',
    shell=True
)

print('''
✅ push完了！

【確認手順】
1. スーパーリロード（Ctrl+Shift+R）
2. 「マスタ整理へ」ボタン押す
3. Console に ⚡ useEffect発火 が出ることを確認
4. 「ユーザー(DRIVER)」タブをクリック
   → 🖱️ タブクリック key=users_driver
   → 🔥 fetchMasterRows 呼び出し開始 table=users_driver  
   → [DevCleanup] fetchMasterRows table=users_driver のデバッググループ
   → ✅ arr確定 件数=X
5. 「点検項目マスタ」タブをクリック
   → 同様のログ table=inspectionItems
6. 両方のログ内容をそのまま貼り付けてください
''')
