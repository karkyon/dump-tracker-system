#!/usr/bin/env python3
"""
セッション5 修正スクリプト
課題A: UNLOADING locationId が NULL になる問題（既存地点選択フロー）
課題C: PUT /operation-details/:id → DRIVER に 403 Forbidden
"""
import subprocess, sys

BASE = '/home/karkyon/dump-tracker'
MOBILE_PAGES = f'{BASE}/frontend/mobile/src/pages/OperationRecord.tsx'
DETAIL_ROUTES = f'{BASE}/backend/src/routes/operationDetailRoutes.ts'

errors = []

def apply(label, path, old, new):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if new.strip()[:60] in content:
        print(f'[SKIP] {label} は適用済みです')
        return
    if old not in content:
        print(f'[ERROR] {label} — OLD文字列が見つかりません')
        errors.append(label)
        return
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'[OK] {label}')

# ============================================================
# 課題A-1: handleLocationSelected 内 既存積降地点選択フロー
#   operationStore.setUnloadingLocation(selectedLocation.location.name);
#   → locationId を渡す
# ============================================================
apply(
    '課題A-1: handleLocationSelected setUnloadingLocation locationId追加',
    MOBILE_PAGES,
    "        operationStore.setUnloadingLocation(selectedLocation.location.name);\n        operationStore.setPhase('AT_UNLOADING');",
    "        operationStore.setUnloadingLocation(selectedLocation.location.name, selectedLocation.location.id);\n        operationStore.setPhase('AT_UNLOADING');"
)

# ============================================================
# 課題A-2: handleNewLocationRegistered 内 新規積降地点登録フロー
#   operationStore.setUnloadingLocation(registeredLocation.name);
#   → locationId を渡す
# ============================================================
apply(
    '課題A-2: handleNewLocationRegistered setUnloadingLocation locationId追加',
    MOBILE_PAGES,
    "          operationStore.setUnloadingLocation(registeredLocation.name);\n          operationStore.setPhase('AT_UNLOADING');",
    "          operationStore.setUnloadingLocation(registeredLocation.name, registeredLocation.id);\n          operationStore.setPhase('AT_UNLOADING');"
)

# ============================================================
# 課題C: operationDetailRoutes.ts の PUT /:id を requireManager → requireRole(['DRIVER','MANAGER','ADMIN'])
#   1) import に requireRole を追加
#   2) router.put('/:id', requireManager, ...) を変更
# ============================================================
apply(
    '課題C-1: operationDetailRoutes import に requireRole 追加',
    DETAIL_ROUTES,
    "import {\n  authenticateToken,\n  requireAdmin,\n  requireManager\n} from '../middleware/auth';",
    "import {\n  authenticateToken,\n  requireAdmin,\n  requireManager,\n  requireRole\n} from '../middleware/auth';"
)

apply(
    '課題C-2: PUT /:id を DRIVER ロールに開放',
    DETAIL_ROUTES,
    "router.put('/:id', requireManager, validateId, operationDetailController.updateOperationDetail);",
    "router.put('/:id', requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as any), validateId, operationDetailController.updateOperationDetail);"
)

# ============================================================
# エラー確認
# ============================================================
if errors:
    print(f'\n[FAILED] 以下の修正でエラーが発生しました:')
    for e in errors:
        print(f'  - {e}')
    sys.exit(1)

# ============================================================
# フロントエンド コンパイルチェック
# ============================================================
print('\nフロントエンド コンパイルチェック...')
r = subprocess.run(
    ['npx', 'tsc', '--noEmit'],
    cwd=f'{BASE}/frontend/mobile',
    capture_output=True, text=True
)
if r.returncode != 0:
    print(f'[ERROR] フロントエンド コンパイルエラー:\n{r.stdout}{r.stderr}')
    sys.exit(1)
print('[OK] フロントエンド コンパイル エラー0')

# ============================================================
# バックエンド コンパイルチェック
# ============================================================
print('バックエンド コンパイルチェック...')
r = subprocess.run(
    ['npx', 'tsc', '--noEmit'],
    cwd=f'{BASE}/backend',
    capture_output=True, text=True
)
if r.returncode != 0:
    print(f'[ERROR] バックエンド コンパイルエラー:\n{r.stdout}{r.stderr}')
    sys.exit(1)
print('[OK] バックエンド コンパイル エラー0')

# ============================================================
# Git Push
# ============================================================
print('\n✅ 全修正完了。GitHub Pushを実行します...')
cmds = [
    ['git', 'add',
     'frontend/mobile/src/pages/OperationRecord.tsx',
     'backend/src/routes/operationDetailRoutes.ts'],
    ['git', 'commit', '-m',
     'fix: UNLOADING locationId完全修正 + DRIVER 403エラー解消\n'
     '- OperationRecord: handleLocationSelected/handleNewLocationRegistered で\n'
     '  setUnloadingLocation に locationId を渡す（既存地点・新規地点 両フロー）\n'
     '- operationDetailRoutes: PUT /:id を DRIVER ロールに開放（403解消）'],
    ['git', 'push', 'origin', 'main'],
]
for cmd in cmds:
    print('$', ' '.join(cmd))
    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
    if r.stdout: print(r.stdout)
    if r.stderr: print(r.stderr)
    if r.returncode != 0 and 'nothing to commit' not in (r.stdout + r.stderr):
        print(f'[ERROR] コマンド失敗: {r.returncode}')
        sys.exit(1)

print('\n🚀 GitHub Push完了！CI/CDが自動デプロイします。')
print('\n次の確認手順:')
print('  dt-restart')
print('  # モバイルで既存地点を選択して積降完了')
print("  psql 'postgresql://dump_tracker_user:DumpTracker2025!@localhost:5432/dump_tracker_dev' \\")
print("    -c \"SELECT activity_type, location_id FROM operation_details ORDER BY created_at DESC LIMIT 5;\"")
