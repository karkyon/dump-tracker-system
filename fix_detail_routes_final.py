#!/usr/bin/env python3
"""
課題C 最終修正スクリプト
operationDetailRoutes.ts の PUT /:id を DRIVER に開放
requireDriverOrHigher は auth.ts で既にエクスポートされており
operationDetailRoutes.ts に import 追加が必要
→ 最もシンプルな解決: requireRole を直接 import に追加（コメントの誤判定を回避）
"""
import subprocess, sys, re

BASE = '/home/karkyon/dump-tracker'
DETAIL_ROUTES = f'{BASE}/backend/src/routes/operationDetailRoutes.ts'

with open(DETAIL_ROUTES, 'r', encoding='utf-8') as f:
    content = f.read()

changed = False

# --- import ブロックに requireRole を追加（コメント内の出現は無視して正確に判定）---
# 実際の import 文に requireRole があるか正規表現で確認
import_block_match = re.search(
    r"import \{\s*authenticateToken,\s*requireAdmin,\s*requireManager(?:,\s*requireRole)?\s*\} from '../middleware/auth';",
    content
)

if import_block_match and 'requireRole' not in import_block_match.group(0):
    # requireRole がまだ import されていない → 追加
    old_import = import_block_match.group(0)
    new_import = old_import.replace(
        "requireManager\n} from '../middleware/auth';",
        "requireManager,\n  requireRole\n} from '../middleware/auth';"
    )
    if old_import != new_import:
        content = content.replace(old_import, new_import, 1)
        print('[OK] requireRole を import に追加')
        changed = True
    else:
        print('[ERROR] import 置換失敗')
        sys.exit(1)
elif import_block_match and 'requireRole' in import_block_match.group(0):
    print('[SKIP] requireRole は既に import 済み（import文で確認）')
else:
    # フォールバック: より単純な文字列置換
    old_imp = "  requireAdmin,\n  requireManager\n} from '../middleware/auth';"
    new_imp = "  requireAdmin,\n  requireManager,\n  requireRole\n} from '../middleware/auth';"
    if old_imp in content:
        content = content.replace(old_imp, new_imp, 1)
        print('[OK] requireRole を import に追加（フォールバック）')
        changed = True
    else:
        print('[ERROR] import ブロックが見つかりません。手動確認が必要です。')
        sys.exit(1)

# --- PUT /:id の修正 ---
old_put = "router.put('/:id', requireManager, validateId, operationDetailController.updateOperationDetail);"
new_put = "router.put('/:id', requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as any), validateId, operationDetailController.updateOperationDetail);"

if new_put in content:
    print('[SKIP] PUT /:id は既に修正済み')
elif old_put in content:
    content = content.replace(old_put, new_put, 1)
    print('[OK] PUT /:id を DRIVER ロールに開放')
    changed = True
else:
    print('[ERROR] PUT /:id の行が見つかりません')
    sys.exit(1)

if changed:
    with open(DETAIL_ROUTES, 'w', encoding='utf-8') as f:
        f.write(content)

# --- バックエンド コンパイルチェック ---
print('バックエンド コンパイルチェック...')
r = subprocess.run(['npx', 'tsc', '--noEmit'], cwd=f'{BASE}/backend', capture_output=True, text=True)
if r.returncode != 0:
    print(f'[ERROR] コンパイルエラー:\n{r.stdout}{r.stderr}')
    sys.exit(1)
print('[OK] バックエンド コンパイル エラー0')

# --- Git Push ---
print('\n✅ 修正完了。GitHub Pushを実行します...')
cmds = [
    ['git', 'add', 'backend/src/routes/operationDetailRoutes.ts'],
    ['git', 'commit', '-m', 'fix: operationDetailRoutes PUT /:id を DRIVER ロールに開放（403解消）\n- requireRole import 追加\n- PUT /:id: requireManager → requireRole([DRIVER,MANAGER,ADMIN])'],
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

print('\n🚀 Push完了！dt-restart → アクティビティ編集で403が解消します。')
