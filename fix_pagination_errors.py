#!/usr/bin/env python3
"""
TSエラー修正:
1. InspectionItemManagement.tsx - Paginationがimportされているが使われていない
   → TableにPaginationを追加してsliceも適用
2. CustomerManagement.tsx - Paginationがimportされているが使われていない
   → TableにPaginationを追加
3. FeedbackList.tsx - setLimitが存在しない
   → limitは const [limit] = useState(20) で setter なし → _fbPageSizeのみで管理

実行: cd ~/projects/dump-tracker && python3 fix_pagination_errors.py
"""
import sys, os, subprocess

APP_ROOT = os.path.expanduser('~/projects/dump-tracker')
changed = []

def run(cmd, cwd=None, check=True):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f'❌ {r.stderr}'); sys.exit(1)
    return r

def read(rel):
    with open(f'{APP_ROOT}/{rel}', 'r', encoding='utf-8') as f: return f.read()

def write(rel, c):
    with open(f'{APP_ROOT}/{rel}', 'w', encoding='utf-8') as f: f.write(c)
    if rel not in changed: changed.append(rel)

# ============================================================
# [1] InspectionItemManagement.tsx
# Paginationを実際に使う: Tableのdata をslice + 下にPaginationを追加
# ============================================================
PAGE1 = 'frontend/cms/src/pages/InspectionItemManagement.tsx'
print('[1] InspectionItemManagement.tsx')
c = read(PAGE1)

OLD = """      {isLoading ? (
        <SectionLoading />
      ) : (
        <div className="bg-white rounded-lg shadow">
          <Table
            columns={columns}
            data={filteredAndSortedItems}
            loading={isLoading}
            emptyMessage="点検項目が見つかりません"
            // 🐛 修正6: pagination プロパティを削除（Tableコンポーネントに存在しないため）
          />
        </div>
      )}"""

NEW = """      {isLoading ? (
        <SectionLoading />
      ) : (
        <div className="bg-white rounded-lg shadow">
          <Table
            columns={columns}
            data={filteredAndSortedItems.slice((_page - 1) * _pageSize, _page * _pageSize)}
            loading={isLoading}
            emptyMessage="点検項目が見つかりません"
          />
          <Pagination
            currentPage={_page}
            totalPages={Math.max(1, Math.ceil(filteredAndSortedItems.length / _pageSize))}
            totalItems={filteredAndSortedItems.length}
            pageSize={_pageSize}
            onPageChange={_setPage}
            showPageSizeSelector={true}
            onPageSizeChange={(size) => { _setPageSize(size); _setPage(1); }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      )}"""

if OLD in c:
    write(PAGE1, c.replace(OLD, NEW, 1))
    print('  ✅ Table+Pagination追加完了')
else:
    print('  ⚠️ パターン未発見 - 現在のTableブロック確認:')
    for i, line in enumerate(c.split('\n'), 1):
        if 'filteredAndSortedItems' in line or 'SectionLoading' in line:
            print(f'    L{i}: {line}')

# ============================================================
# [2] CustomerManagement.tsx
# TableにPaginationを追加
# ============================================================
PAGE2 = 'frontend/cms/src/pages/CustomerManagement.tsx'
print('\n[2] CustomerManagement.tsx')
c = read(PAGE2)

OLD2 = "      <Table data={filteredCustomers} columns={columns} loading={customerLoading} emptyMessage=\"客先が見つかりません\" />"
NEW2 = """      <div className="bg-white rounded-lg shadow">
        <Table
          data={filteredCustomers.slice((_custPage - 1) * _custPageSize, _custPage * _custPageSize)}
          columns={columns}
          loading={customerLoading}
          emptyMessage="客先が見つかりません"
        />
        <Pagination
          currentPage={_custPage}
          totalPages={Math.max(1, Math.ceil(filteredCustomers.length / _custPageSize))}
          totalItems={filteredCustomers.length}
          pageSize={_custPageSize}
          onPageChange={_setCustPage}
          showPageSizeSelector={true}
          onPageSizeChange={(size) => { _setCustPageSize(size); _setCustPage(1); }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>"""

if OLD2 in c:
    write(PAGE2, c.replace(OLD2, NEW2, 1))
    print('  ✅ Table+Pagination追加完了')
else:
    print('  ⚠️ パターン未発見 - 現在のTableブロック:')
    for i, line in enumerate(c.split('\n'), 1):
        if '<Table' in line or 'filteredCustomers' in line:
            print(f'    L{i}: {line}')

# ============================================================
# [3] FeedbackList.tsx
# setLimit が存在しない → onPageSizeChange から setLimit を除去
# FeedbackListはAPIページングなのでlimitを変えてfetchDataを呼ぶ
# ============================================================
PAGE3 = 'frontend/cms/src/pages/FeedbackList.tsx'
print('\n[3] FeedbackList.tsx')
c = read(PAGE3)

# setLimit を使っている onPageSizeChange を修正
OLD3 = "        onPageSizeChange={(size) => { _setFbPageSize(size); setLimit(size); _setFbPage(1); setPage(1); }}"
NEW3 = "        onPageSizeChange={(size) => { _setFbPageSize(size); _setFbPage(1); setPage(1); fetchData(1); }}"

if OLD3 in c:
    write(PAGE3, c.replace(OLD3, NEW3, 1))
    print('  ✅ setLimit削除完了')
else:
    # const [limit] を const [limit, setLimit] に変更する別アプローチ
    OLD3B = "  const [limit] = useState(20);"
    NEW3B = "  const [limit, setLimit] = useState(20);"
    if OLD3B in c:
        write(PAGE3, c.replace(OLD3B, NEW3B, 1))
        print('  ✅ limit にsetter追加')
    else:
        print('  ⚠️ パターン未発見')
        for i, line in enumerate(c.split('\n'), 1):
            if 'setLimit' in line or 'limit' in line.lower() and 'useState' in line:
                print(f'    L{i}: {line}')

# ============================================================
# TypeScript コンパイルチェック
# ============================================================
print('\n[TypeScript コンパイルチェック...]')
r = run('npx tsc --noEmit 2>&1', cwd=f'{APP_ROOT}/frontend/cms', check=False)
if r.returncode != 0:
    print(f'❌ CMS TSエラー:\n{r.stdout}'); sys.exit(1)
print('✅ CMS TypeScript: エラー 0件')

# ============================================================
# Git push
# ============================================================
print('\n[Git commit & push...]')
for f in changed:
    run(f'git -C {APP_ROOT} add {f}')
r = run(
    f'git -C {APP_ROOT} commit -m "fix: CMS一覧 TSエラー修正 - InspectionItem/Customer Pagination追加 + FeedbackList setLimit修正"',
    check=False
)
if r.returncode != 0 and 'nothing to commit' not in r.stdout + r.stderr:
    print(f'❌ commit失敗: {r.stderr}'); sys.exit(1)
run(f'git -C {APP_ROOT} push origin main')
print()
print('=' * 60)
print('✅ 完了！ TSエラー0件で push完了')
print('=' * 60)
