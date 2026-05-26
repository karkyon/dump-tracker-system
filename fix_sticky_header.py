#!/usr/bin/env python3
"""
CMS全一覧画面 テーブルヘッダー固定スクロール 完全修正
根本原因: Table.tsx の外側divがoverflow-x-autoのみ → sticky top-0が機能しない
解決策: overflow-x-autoの内側にoverflow-y-auto + max-heightのdivを追加
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
    print(f'  ✅ [{label}] 修正完了')
    return True

errors = []

# ============================================================
# [1] Table.tsx
# 修正: overflow-x-auto の div の中に overflow-y-auto + max-height の div を追加
# thead の sticky top-0 は overflow-y-auto なスクロールコンテナの中でしか機能しない
# ============================================================
print('\n[1] Table.tsx - スクロールコンテナ修正')
TABLE_OLD = '''  return (
    <div className={`bg-white shadow overflow-x-auto sm:rounded-md ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">'''

TABLE_NEW = '''  return (
    <div className={`bg-white shadow sm:rounded-md overflow-hidden ${className}`}>
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">'''

TABLE_CLOSE_OLD = '''      </table>
    </div>
  );
}'''

TABLE_CLOSE_NEW = '''      </table>
      </div>
    </div>
  );
}'''

ok1 = patch('frontend/cms/src/components/common/Table.tsx', TABLE_OLD, TABLE_NEW, 'Table wrapper div')
ok2 = patch('frontend/cms/src/components/common/Table.tsx', TABLE_CLOSE_OLD, TABLE_CLOSE_NEW, 'Table close div')
if not (ok1 and ok2):
    errors.append('Table.tsx')

# ============================================================
# [2] AccidentRecordManagement.tsx
# ============================================================
print('\n[2] AccidentRecordManagement.tsx - スクロールコンテナ修正')
ACC_OLD = '''      {/* テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">'''

ACC_NEW = '''      {/* テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">'''

ACC_CLOSE_OLD = '''          </tbody>
        </table>
      </div>
      {(() => {
        const _accList = records ?? [];'''

ACC_CLOSE_NEW = '''          </tbody>
        </table>
        </div>
      </div>
      {(() => {
        const _accList = records ?? [];'''

ok1 = patch('frontend/cms/src/pages/AccidentRecordManagement.tsx', ACC_OLD, ACC_NEW, 'AccidentRecord wrapper')
ok2 = patch('frontend/cms/src/pages/AccidentRecordManagement.tsx', ACC_CLOSE_OLD, ACC_CLOSE_NEW, 'AccidentRecord close')
if not (ok1 and ok2):
    errors.append('AccidentRecordManagement.tsx')

# ============================================================
# [3] FeedbackList.tsx
# ============================================================
print('\n[3] FeedbackList.tsx - スクロールコンテナ修正')
FB_OLD = '''        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">'''

FB_NEW = '''        ) : (
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide sticky top-0 z-10">'''

if not patch('frontend/cms/src/pages/FeedbackList.tsx', FB_OLD, FB_NEW, 'FeedbackList wrapper'):
    errors.append('FeedbackList.tsx')

# ============================================================
# [4] OperationRecords.tsx
# ============================================================
print('\n[4] OperationRecords.tsx - スクロールコンテナ修正')
OP_OLD = '''        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">'''

OP_NEW = '''        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">'''

if not patch('frontend/cms/src/pages/OperationRecords.tsx', OP_OLD, OP_NEW, 'OperationRecords wrapper'):
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
    'git commit -m "fix: CMS全一覧 テーブルヘッダー固定スクロール完全修正 - overflow-y-auto+max-height追加" && '
    'git push origin main',
    shell=True
)

print('\n' + '='*60)
if errors:
    print(f'⚠️  一部パターン未発見: {", ".join(errors)}')
else:
    print('✅ 修正・push完了！')
print('''【修正内容】
  Table.tsx:
    外側div: overflow-hidden（角丸・影保持）
    内側div(新規): overflow-x-auto overflow-y-auto max-height:calc(100vh-280px)
    thead: sticky top-0 z-20（内側スクロールコンテナ基準でsticky）
  AccidentRecordManagement.tsx:
    テーブルdiv内にoverflow-y-auto+max-height追加、thead sticky追加
  FeedbackList.tsx:
    overflow-x-auto → overflow-x-auto overflow-y-auto max-height追加、thead sticky追加
  OperationRecords.tsx:
    同様修正
''')
