#!/usr/bin/env python3
"""
課題C 修正スクリプト v2
operationDetailRoutes.ts の PUT /:id を DRIVER に開放
requireRole が import されていなかった問題を直接修正
"""
import subprocess, sys

BASE = '/home/karkyon/dump-tracker'
DETAIL_ROUTES = f'{BASE}/backend/src/routes/operationDetailRoutes.ts'

# ファイル読み込み
with open(DETAIL_ROUTES, 'r', encoding='utf-8') as f:
    content = f.read()

# --- import に requireRole を追加（実際のファイル状態を確認してから）---
if 'requireRole' not in content:
    # requireManager の import に requireRole を追加
    old_import = "  authenticateToken,\n  requireAdmin,\n  requireManager\n} from '../middleware/auth';"
    new_import = "  authenticateToken,\n  requireAdmin,\n  requireManager,\n  requireRole\n} from '../middleware/auth';"
    if old_import in content:
        content = content.replace(old_import, new_import, 1)
        print('[OK] requireRole import 追加')
    else:
        print('[ERROR] import ブロックが見つかりません')
        sys.exit(1)
else:
    print('[SKIP] requireRole は既に import 済み')

# --- PUT /:id の requireManager → requireRole(['DRIVER','MANAGER','ADMIN']) ---
old_put = "router.put('/:id', requireManager, validateId, operationDetailController.updateOperationDetail);"
new_put = "router.put('/:id', requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as any), validateId, operationDetailController.updateOperationDetail);"

if new_put in content:
    print('[SKIP] PUT /:id は既に修正済み')
elif old_put in content:
    content = content.replace(old_put, new_put, 1)
    print('[OK] PUT /:id を DRIVER ロールに開放')
else:
    print('[ERROR] PUT /:id の行が見つかりません')
    sys.exit(1)

# ファイル書き込み
with open(DETAIL_ROUTES, 'w', encoding='utf-8') as f:
    f.write(content)

# バックエンド コンパイルチェック
print('バックエンド コンパイルチェック...')
r = subprocess.run(
    ['npx', 'tsc', '--noEmit'],
    cwd=f'{BASE}/backend',
    capture_output=True, text=True
)
if r.returncode != 0:
    print(f'[ERROR] コンパイルエラー:\n{r.stdout}{r.stderr}')
    sys.exit(1)
print('[OK] バックエンド コンパイル エラー0')

# Git Push
print('\n✅ 修正完了。GitHub Pushを実行します...')
cmds = [
    ['git', 'add', 'backend/src/routes/operationDetailRoutes.ts'],
    ['git', 'commit', '-m',
     'fix: PUT /operation-details/:id を DRIVER ロールに開放（403解消）'],
    ['git', 'push', 'origin', 'main'],
]
for cmd in cmds:
    print('$', ' '.join(cmd))
    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
    if r.stdout: print(r.stdout)
    if r.stderr: print(r.stderr)
    if r.returncode != 0 and 'nothing to commit' not in (r.stdout + r.stderr):
        print(f'[ERROR] コマンド失敗')
        sys.exit(1)

print('\n🚀 Push完了！dt-restart → アクティビティ編集で403が解消することを確認してください。')
