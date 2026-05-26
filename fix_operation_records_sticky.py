#!/usr/bin/env python3
"""
OperationRecords.tsx テーブルスクロール修正
Table.tsx は修正済み。OperationRecordsは<Table>コンポーネントを使用しているため
Table.tsx内のmax-heightが既に適用される。
ただし、Table.tsx のmax-height上書き機能をclassNameで渡す対応が必要。
→ Table.tsx の内側スクロールdivにもclassNameを引き継げるよう修正する。
"""
import os, subprocess

ROOT = os.path.expanduser('~/projects/dump-tracker')

def patch(path, old, new, label):
    full = os.path.join(ROOT, path)
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'  ❌ [{label}] パターン未発見')
        # デバッグ: 近い行を出力
        for i, line in enumerate(content.splitlines(), 1):
            if 'overflow-x-auto' in line or 'filteredRecords' in line or 'Table columns' in line:
                print(f'    L{i}: {line.rstrip()}')
        return False
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'  ✅ [{label}] 修正完了')
    return True

errors = []

# ============================================================
# OperationRecords.tsx
# 実際のコード:
#   <Table columns={columns} data={filteredRecords} />
#   Table.tsxのmax-heightはcalc(100vh-280px)
#   OperationRecordsはフィルタエリアが多いのでcalc(100vh-340px)が適切
#   → Tableのclassname propで内側divのスタイルを制御できるようにする
#
# 修正方針:
#   Table.tsx の内側スクロールdivに scrollClassName prop を追加
#   各ページから必要に応じてmax-heightを渡せるようにする
# ============================================================

print('\n[1] Table.tsx - scrollClassName prop追加')

# TableProps に scrollClassName を追加
TPROPS_OLD = '''  className?: string;
}'''
TPROPS_NEW = '''  className?: string;
  scrollClassName?: string;
}'''

TABLE_FILE = 'frontend/cms/src/components/common/Table.tsx'
full = os.path.join(ROOT, TABLE_FILE)
with open(full, 'r') as f:
    content = f.read()

# 既に追加済みチェック
if 'scrollClassName' not in content:
    if TPROPS_OLD in content:
        content = content.replace(TPROPS_OLD, TPROPS_NEW, 1)
        print('  ✅ [TableProps scrollClassName追加]')
    else:
        print('  ❌ [TableProps] パターン未発見')
        errors.append('Table.tsx(props)')
else:
    print('  ✅ [scrollClassName既に存在]')

# 関数引数に scrollClassName を追加
TARG_OLD = '''  className = '',
}: TableProps<T>) {'''
TARG_NEW = '''  className = '',
  scrollClassName = '',
}: TableProps<T>) {'''

if 'scrollClassName = \'\'' not in content:
    if TARG_OLD in content:
        content = content.replace(TARG_OLD, TARG_NEW, 1)
        print('  ✅ [関数引数 scrollClassName追加]')
    else:
        print('  ❌ [関数引数] パターン未発見')
        errors.append('Table.tsx(args)')
else:
    print('  ✅ [引数 scrollClassName既に存在]')

# 内側スクロールdivにscrollClassNameを適用
TSCROLL_OLD = '      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: \'calc(100vh - 280px)\' }}>'
TSCROLL_NEW = '      <div className={`overflow-x-auto overflow-y-auto ${scrollClassName}`} style={{ maxHeight: scrollClassName ? undefined : \'calc(100vh - 280px)\' }}>'

if 'scrollClassName ? undefined' not in content:
    if TSCROLL_OLD in content:
        content = content.replace(TSCROLL_OLD, TSCROLL_NEW, 1)
        print('  ✅ [スクロールdiv scrollClassName適用]')
    else:
        print('  ❌ [スクロールdiv] パターン未発見')
        errors.append('Table.tsx(div)')
else:
    print('  ✅ [スクロールdiv 既に修正済み]')

with open(full, 'w') as f:
    f.write(content)

# ============================================================
# OperationRecords.tsx
# <Table columns={columns} data={filteredRecords} />
# → scrollClassName で高さを調整
# ============================================================
print('\n[2] OperationRecords.tsx - Table scrollClassName追加')

OP_OLD = '<Table columns={columns} data={filteredRecords} />'
OP_NEW = '<Table columns={columns} data={filteredRecords} scrollClassName="max-h-[calc(100vh-340px)]" />'

if not patch('frontend/cms/src/pages/OperationRecords.tsx', OP_OLD, OP_NEW, 'OperationRecords Table scrollClassName'):
    errors.append('OperationRecords.tsx')

# ============================================================
# TypeScript コンパイルチェック
# ============================================================
print('\n[TypeScript コンパイルチェック...]')
result = subprocess.run(
    'cd ~/projects/dump-tracker/frontend/cms && npx tsc --noEmit 2>&1',
    shell=True, capture_output=True, text=True
)
ts_out = result.stdout + result.stderr
ts_errors = [l for l in ts_out.splitlines() if 'error TS' in l]

if ts_errors:
    print('❌ CMS TSエラー:')
    for e in ts_errors:
        print(' ', e)
    exit(1)
else:
    print('✅ TypeScript: エラー 0件')

# ============================================================
# Git commit & push
# ============================================================
print('\n[Git commit & push...]')
subprocess.run(
    'cd ~/projects/dump-tracker && git add -A && '
    'git commit -m "fix: OperationRecords sticky header + Table scrollClassName prop追加" && '
    'git push origin main',
    shell=True
)

print('\n' + '='*60)
if errors:
    print(f'⚠️  一部パターン未発見: {", ".join(errors)}')
else:
    print('✅ 修正・push完了！')
print('''【修正内容】
  Table.tsx: scrollClassName prop追加
    → 各ページから内側スクロールdivのmax-heightを上書き可能に
    → scrollClassName未指定時はデフォルト calc(100vh-280px)
  OperationRecords.tsx:
    → <Table scrollClassName="max-h-[calc(100vh-340px)]"> に変更
    → フィルタエリアが多いため高さを340px分確保
''')
