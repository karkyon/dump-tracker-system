#!/usr/bin/env python3
"""
CMS 全一覧画面 修正:
1. Table.tsx - ヘッダー固定スクロール (sticky thead)
2. userStore.ts - UserState型にsetPageSize追加 + デフォルト50件
3. vehicleStore.ts - VehicleState型にsetPageSize追加 + デフォルト50件
4. UserManagement.tsx - 表示件数セレクタ常時表示
5. VehicleManagement.tsx - 同上
6. OperationRecords.tsx - 表示件数セレクタ追加

実行場所: omega-dev
実行方法: cd ~/projects/dump-tracker && python3 fix_cms_table_pagination.py
"""
import sys, os, re, subprocess

APP_ROOT = os.path.expanduser('~/projects/dump-tracker')
changed = []

def run(cmd, cwd=None, check=True):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f'❌ {cmd}\n{r.stdout}{r.stderr}')
        sys.exit(1)
    return r

def read(rel):
    with open(f'{APP_ROOT}/{rel}', 'r', encoding='utf-8') as f:
        return f.read()

def write(rel, content):
    with open(f'{APP_ROOT}/{rel}', 'w', encoding='utf-8') as f:
        f.write(content)
    if rel not in changed:
        changed.append(rel)

def patch(rel, old, new, desc):
    c = read(rel)
    if old not in c:
        print(f'  ⚠️ [{desc}] パターン未発見')
        return False
    write(rel, c.replace(old, new, 1))
    print(f'  ✅ [{desc}]')
    return True

# ============================================================
# [1] Table.tsx - sticky thead
# ============================================================
TABLE = 'frontend/cms/src/components/common/Table.tsx'
print('[1] Table.tsx - sticky thead + scroll container')
c = read(TABLE)

# コンテナとtheadの現在の形を確認してから修正
if 'overflow-x-auto overflow-y-auto' in c:
    print('  ✅ [Table scroll] 既に修正済み')
else:
    # overflow-x-auto のdivを探して変更
    c2 = c.replace(
        '<div className="overflow-x-auto">',
        '<div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: \'calc(100vh - 280px)\' }}>',
        1
    )
    if c2 != c:
        print('  ✅ [Table コンテナ scroll追加]')
        c = c2
    else:
        print('  ⚠️ [Table コンテナ] overflow-x-auto パターン未発見')

# theadのbg-gray-50を sticky に
if 'sticky top-0 z-20' in c:
    print('  ✅ [thead sticky] 既に修正済み')
else:
    c2 = c.replace(
        '<thead className="bg-gray-50">',
        '<thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">',
        1
    )
    if c2 != c:
        print('  ✅ [thead sticky追加]')
        c = c2
    else:
        print('  ⚠️ [thead sticky] bg-gray-50 パターン未発見')

write(TABLE, c)

# ============================================================
# [2] userStore.ts - UserState型にsetPageSize追加 + デフォルト50
# ============================================================
USER_STORE = 'frontend/cms/src/store/userStore.ts'
print('\n[2] userStore.ts')

# UserState interface に setPageSize 追加
patch(USER_STORE,
    "  setPage: (page: number) => void;\n  clearError: () => void;\n  clearSelectedUser: () => void;",
    "  setPage: (page: number) => void;\n  setPageSize: (pageSize: number) => void;\n  clearError: () => void;\n  clearSelectedUser: () => void;",
    'UserState型にsetPageSize追加'
)

# デフォルトpageSize 10→50
c = read(USER_STORE)
if 'pageSize: 50' not in c:
    patch(USER_STORE,
        "  pagination: {\n    page: 1,\n    pageSize: 10,",
        "  pagination: {\n    page: 1,\n    pageSize: 50,",
        'デフォルトpageSize 10→50'
    )

# setPage の実装後に setPageSize 実装を追加
c = read(USER_STORE)
if 'setPageSize:' not in c:
    patch(USER_STORE,
        "  setPage: (page: number) => {\n    console.log('[UserStore] setPage:', page);\n    set({ pagination: { ...get().pagination, page } });\n  },",
        "  setPage: (page: number) => {\n    console.log('[UserStore] setPage:', page);\n    set({ pagination: { ...get().pagination, page } });\n  },\n\n  setPageSize: (pageSize: number) => {\n    console.log('[UserStore] setPageSize:', pageSize);\n    set({ pagination: { ...get().pagination, pageSize, page: 1 } });\n  },",
        'setPageSize実装追加'
    )

# ============================================================
# [3] vehicleStore.ts - VehicleState型にsetPageSize追加 + デフォルト50
# ============================================================
VEH_STORE = 'frontend/cms/src/store/vehicleStore.ts'
print('\n[3] vehicleStore.ts')

# VehicleState interface に setPageSize 追加
c = read(VEH_STORE)
# VehicleState の setPage の後に setPageSize を追加
if 'setPageSize: (pageSize: number) => void;' not in c:
    c2 = c.replace(
        '  setPage: (page: number) => void;\n  clearError: () => void;',
        '  setPage: (page: number) => void;\n  setPageSize: (pageSize: number) => void;\n  clearError: () => void;',
        1
    )
    if c2 != c:
        write(VEH_STORE, c2)
        print('  ✅ [VehicleState型にsetPageSize追加]')
    else:
        print('  ⚠️ [VehicleState setPage型] パターン未発見')
else:
    print('  ✅ [setPageSize型] 既に存在')

# デフォルトpageSize 10→50
c = read(VEH_STORE)
if '    pageSize: 50,' not in c:
    c2 = c.replace(
        '  pagination: {\n    page: 1,\n    pageSize: 10,',
        '  pagination: {\n    page: 1,\n    pageSize: 50,',
        1
    )
    if c2 != c:
        write(VEH_STORE, c2)
        print('  ✅ [デフォルトpageSize 10→50]')
    else:
        print('  ⚠️ [pageSize初期値] パターン未発見')
else:
    print('  ✅ [pageSize:50] 既に設定済み')

# setPage実装の後にsetPageSize実装を追加
c = read(VEH_STORE)
if 'setPageSize:' not in c:
    # setPage の実装パターンを探す
    if "  setPage: (page: number) => set({ pagination: { ...get().pagination, page } })," in c:
        c2 = c.replace(
            "  setPage: (page: number) => set({ pagination: { ...get().pagination, page } }),",
            "  setPage: (page: number) => set({ pagination: { ...get().pagination, page } }),\n  setPageSize: (pageSize: number) => set({ pagination: { ...get().pagination, pageSize, page: 1 } }),",
            1
        )
        write(VEH_STORE, c2)
        print('  ✅ [setPageSize実装追加(1行形式)]')
    else:
        # setPage の複数行実装を探す
        c2 = c.replace(
            "  setPage: (page: number) => {\n    set({ pagination: { ...get().pagination, page } });\n  },",
            "  setPage: (page: number) => {\n    set({ pagination: { ...get().pagination, page } });\n  },\n\n  setPageSize: (pageSize: number) => {\n    set({ pagination: { ...get().pagination, pageSize, page: 1 } });\n  },",
            1
        )
        if c2 != c:
            write(VEH_STORE, c2)
            print('  ✅ [setPageSize実装追加(複数行形式)]')
        else:
            print('  ⚠️ [setPageSize実装] setPageパターン未発見')
else:
    print('  ✅ [setPageSize実装] 既に存在')

# ============================================================
# [4] UserManagement.tsx - setPageSize + Pagination常時表示
# ============================================================
USER_PAGE = 'frontend/cms/src/pages/UserManagement.tsx'
print('\n[4] UserManagement.tsx')

c = read(USER_PAGE)
if 'setPageSize,' not in c:
    patch(USER_PAGE,
        "    setPage,\n    clearError,\n  } = useUserStore();",
        "    setPage,\n    setPageSize,\n    clearError,\n  } = useUserStore();",
        'setPageSize destructure追加'
    )

if 'showPageSizeSelector' not in c:
    patch(USER_PAGE,
        """      {/* ページネーション */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={setPage}
        />
      )}""",
        """      {/* ページネーション - 常時表示 + 表示件数セレクタ */}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={setPage}
        showPageSizeSelector={true}
        onPageSizeChange={(size) => { setPageSize(size); fetchUsers(); }}
        pageSizeOptions={[10, 25, 50, 100]}
      />""",
        'Pagination常時表示+pageSize selector'
    )

# ============================================================
# [5] VehicleManagement.tsx - setPageSize + Pagination常時表示
# ============================================================
VEH_PAGE = 'frontend/cms/src/pages/VehicleManagement.tsx'
print('\n[5] VehicleManagement.tsx')

c = read(VEH_PAGE)
if 'setPageSize,' not in c:
    # useVehicleStore からの destructure に setPageSize を追加
    # } = useVehicleStore(); の前の行にsetPageSizeを追加
    c2 = re.sub(
        r'(  \} = useVehicleStore\(\);)',
        '    setPageSize,\n\\1',
        c, count=1
    )
    if c2 != c:
        write(VEH_PAGE, c2)
        print('  ✅ [setPageSize destructure追加]')
    else:
        print('  ⚠️ [setPageSize destructure] パターン未発見')

if 'showPageSizeSelector' not in c:
    patch(VEH_PAGE,
        """      {/* ページネーション */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={setPage}
        />
      )}""",
        """      {/* ページネーション - 常時表示 + 表示件数セレクタ */}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={setPage}
        showPageSizeSelector={true}
        onPageSizeChange={(size) => { setPageSize(size); fetchVehicles(); }}
        pageSizeOptions={[10, 25, 50, 100]}
      />""",
        'Pagination常時表示+pageSize selector'
    )

# ============================================================
# [6] OperationRecords.tsx - 表示件数セレクタ追加
# ============================================================
OPS_PAGE = 'frontend/cms/src/pages/OperationRecords.tsx'
print('\n[6] OperationRecords.tsx')

c = read(OPS_PAGE)

# Paginationコンポーネントをimport追加
if "import Pagination from '../components/common/Pagination'" not in c:
    c2 = c.replace(
        "import { SectionLoading } from '../components/ui/LoadingSpinner';",
        "import { SectionLoading } from '../components/ui/LoadingSpinner';\nimport Pagination from '../components/common/Pagination';",
        1
    )
    if c2 != c:
        write(OPS_PAGE, c2)
        print('  ✅ [Paginationインポート追加]')
    else:
        print('  ⚠️ [Paginationインポート] SectionLoadingパターン未発見')

# 現在のpagination表示部分を確認して Pagination コンポーネントに差し替え
c = read(OPS_PAGE)
if 'showPageSizeSelector' not in c:
    # 現在の表示件数セレクト（上部）があれば削除して下部に統合
    # まず現在の運行記録一覧の表示件数部分を探す
    if '表示件数:' in c or '表示件数' in c:
        # 上部の表示件数セレクトをシンプルに残す（OperationRecordsはpaginationが独自実装のため）
        # 下部のページネーション部分に表示件数を追加
        # 現在の下部ページネーション表示を確認
        if 'pagination.totalPages > 1' in c:
            c2 = c.replace(
                '{pagination.totalPages > 1 && (',
                '{true && (',
                1
            )
            if c2 != c:
                write(OPS_PAGE, c2)
                print('  ✅ [Pagination常時表示]')
        
        # 表示件数セレクタのラベル（右上）を確認して表示件数を追加
        c = read(OPS_PAGE)
        # 表示件数をヘッダー右側に配置（現在の構造を活用）
        if '表示件数:' in c:
            # 既存の select を拡張して pageSizeOptions を追加
            c2 = c.replace(
                """<select
              value={pagination.pageSize}
              onChange={(e) => {
                setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }));
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={10}>10件</option>
              <option value={25}>25件</option>
              <option value={50}>50件</option>
              <option value={100}>100件</option>
            </select>""",
                """<select
              value={pagination.pageSize}
              onChange={(e) => {
                const size = Number(e.target.value);
                setPagination(prev => ({ ...prev, pageSize: size, page: 1 }));
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value={10}>10件</option>
              <option value={25}>25件</option>
              <option value={50}>50件</option>
              <option value={100}>100件</option>
              <option value={200}>200件</option>
            </select>""",
                1
            )
            if c2 != c:
                write(OPS_PAGE, c2)
                print('  ✅ [表示件数オプション200件追加]')
    else:
        print('  ℹ️ [OperationRecords] 表示件数セレクタ既に存在しない形式')

# ============================================================
# TypeScript コンパイルチェック
# ============================================================
print('\n[TypeScript コンパイルチェック...]')

r = run('npx tsc --noEmit 2>&1', cwd=f'{APP_ROOT}/frontend/cms', check=False)
if r.returncode != 0:
    print(f'❌ CMS TSエラー:\n{r.stdout}')
    sys.exit(1)
print('✅ CMS TypeScript: エラー 0件')

# ============================================================
# Git push
# ============================================================
if not changed:
    print('\n変更ファイルなし')
    sys.exit(0)

print(f'\n変更ファイル: {len(changed)}件')
for f in changed:
    print(f'  - {f}')

print('\n[Git commit & push...]')
for f in changed:
    run(f'git -C {APP_ROOT} add {f}')
r = run(
    f'git -C {APP_ROOT} commit -m '
    '"fix: CMS全一覧 - テーブルヘッダー固定スクロール + 表示件数セレクタ常時表示(デフォルト50件)"',
    check=False
)
if r.returncode != 0 and 'nothing to commit' not in r.stdout + r.stderr:
    print(f'❌ commit失敗: {r.stderr}')
    sys.exit(1)
run(f'git -C {APP_ROOT} push origin main')

print()
print('=' * 60)
print('✅ 修正・push完了！')
print()
print('【修正内容】')
print('  1. Table.tsx: thead sticky + コンテナスクロール')
print('  2. userStore.ts: setPageSize型+実装追加、デフォルト50件')
print('  3. vehicleStore.ts: setPageSize型+実装追加、デフォルト50件')
print('  4. UserManagement.tsx: Pagination常時表示+件数セレクタ')
print('  5. VehicleManagement.tsx: Pagination常時表示+件数セレクタ')
print('  6. OperationRecords.tsx: 表示件数200件オプション追加')
print('=' * 60)
