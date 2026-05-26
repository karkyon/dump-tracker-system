#!/usr/bin/env python3
"""
修正: devCleanupRoutes を app.ts の個別登録から routes/index.ts へ移動
理由: app.ts で /api/v1/dev/cleanup を登録しても、
      routes/index.ts の 404ハンドラー(router.use('*',...)) が
      /api/v1 プレフィックスルーターの末尾にあるため、
      app.ts の登録順序に関係なくindex.ts内の404に捕まる。
解決: routes/index.ts の404ハンドラー直前に devCleanupRoutes を追加
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

# ============================================================
# [1] routes/index.ts: 404ハンドラー直前に devCleanupRoutes 追加
# ============================================================
print('\n[1] routes/index.ts - devCleanupRoutes を404ハンドラー前に追加')
patch(
    'backend/src/routes/index.ts',
    '''// =====================================
// 最終的な404・エラーハンドリング（統合版）
// =====================================''',
    '''// =====================================
// 🛠️ UAT準備 データクリーンアップAPI（ADMIN専用）
// =====================================
safeImportAndRegisterRoute('devCleanupRoutes', '/dev/cleanup', router, {
  priority: 'normal',
  requireAuth: false,  // ルート内でauthenticateToken()+requireAdmin適用
  description: 'UAT準備データクリーンアップ（ADMIN専用）'
});

// =====================================
// 最終的な404・エラーハンドリング（統合版）
// =====================================''',
    'devCleanupRoutes を404前に追加'
)

# ============================================================
# [2] app.ts: devCleanupRoutes の個別登録を削除（二重登録防止）
# ============================================================
print('\n[2] app.ts - devCleanupRoutes の個別登録を削除')
patch(
    'backend/src/app.ts',
    '''    // 🛠️ UAT準備 データクリーンアップAPI（ADMIN専用）
    try {
      const devCleanupRoutes = require('./routes/devCleanupRoutes').default || require('./routes/devCleanupRoutes');
      this.app.use('/api/v1/dev/cleanup', devCleanupRoutes);
      logger.info('✅ DevCleanup APIルート登録完了: /api/v1/dev/cleanup');
    } catch (error) {
      logger.error('❌ devCleanupRoutes 読み込み失敗', error);
    }

    // ログビューアAPI（管理者専用）''',
    '''    // ログビューアAPI（管理者専用）''',
    'app.ts devCleanupRoutes個別登録削除'
)

# ============================================================
# TypeScript コンパイルチェック
# ============================================================
print('\n[TypeScript コンパイルチェック - Backend]')
r1 = subprocess.run(
    'cd ~/projects/dump-tracker/backend && npx tsc --noEmit 2>&1',
    shell=True, capture_output=True, text=True
)
be_errors = [l for l in (r1.stdout+r1.stderr).splitlines() if 'error TS' in l]

print('\n[TypeScript コンパイルチェック - CMS]')
r2 = subprocess.run(
    'cd ~/projects/dump-tracker/frontend/cms && npx tsc --noEmit 2>&1',
    shell=True, capture_output=True, text=True
)
cms_errors = [l for l in (r2.stdout+r2.stderr).splitlines() if 'error TS' in l]

if be_errors or cms_errors:
    print('❌ TSエラー:')
    for e in be_errors + cms_errors:
        print(' ', e)
    exit(1)

print('✅ TypeScript: エラー 0件')

print('\n[Git commit & push...]')
subprocess.run(
    'cd ~/projects/dump-tracker && git add -A && '
    'git commit -m "fix: devCleanupRoutes を routes/index.ts の404前に移動 (404問題解消)" && '
    'git push origin main',
    shell=True
)

print('\n✅ 修正・push完了！')
print('''
【原因】
  app.ts で this.app.use("/api/v1/dev/cleanup", ...) を登録しても、
  routes/index.ts の router.use("*", 404handler) が
  /api/v1 プレフィックスルーターの末尾で動作するため、
  先にindex.tsの404ハンドラーに捕まっていた。

【修正】
  routes/index.ts の404ハンドラー直前に
  safeImportAndRegisterRoute("devCleanupRoutes", "/dev/cleanup", ...) を追加
  → /api/v1/dev/cleanup/* が正常にルーティングされる

【確認】
  dt-restart でバックエンドを再起動後:
  https://10.1.119.244:3001/dev/data-cleanup にアクセスして動作確認
''')
