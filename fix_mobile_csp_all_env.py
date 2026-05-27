#!/usr/bin/env python3
"""
frontend/mobile/index.html の CSP connect-src を全環境対応に修正

現在（問題あり）:
  connect-src 'self'
    https://dumptracker-s.ddns.net   ← stagingのみ
    https://tlog-apex.ddns.net
    https://maps.googleapis.com
    https://firebaseapp.com
    wss:

修正後（全環境対応）:
  connect-src 'self'
    https://10.1.119.244:8443        ← 開発環境バックエンド (HTTPS)
    https://10.1.119.244:8000        ← 開発環境バックエンド (HTTP→HTTPS redirect)
    https://localhost:3001           ← 開発環境CMS
    https://localhost:3002           ← 開発環境Mobile(自己参照)
    https://dumptracker-s.ddns.net   ← staging
    https://dumptracker.ddns.net     ← production ← 追加
    https://tlog-apex.ddns.net
    https://maps.googleapis.com
    https://firebaseapp.com
    wss:

理由:
- 開発(omega-dev): アクセスURL localhost:3002、バックエンドは 10.1.119.244:8443
- staging: dumptracker-s.ddns.net でリバースプロキシ → backend同一オリジン → 'self'でOKだが明示しておく
- production: dumptracker.ddns.net が未追加 → ログイン不可バグ（本番デプロイ前に必ず必要）
- CMS(index.html): CSP metaタグなし → バックエンドhelmetが担当 → 問題なし（修正不要）
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
# [1] Mobile index.html - CSP connect-src 全環境対応
# ============================================================
print('\n[1] frontend/mobile/index.html - CSP connect-src 全環境対応修正')
patch(
    'frontend/mobile/index.html',
    # 旧CSP全体（1行）
    '''<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://tlog-apex.ddns.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com; connect-src 'self' https://dumptracker-s.ddns.net https://tlog-apex.ddns.net https://maps.googleapis.com https://firebaseapp.com wss:; font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'none';" />''',
    # 新CSP（全環境対応）
    '''<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://tlog-apex.ddns.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com; connect-src 'self' https://10.1.119.244:8443 https://10.1.119.244:8000 https://localhost:3001 https://localhost:3002 https://localhost:8443 https://dumptracker-s.ddns.net https://dumptracker.ddns.net https://tlog-apex.ddns.net https://maps.googleapis.com https://firebaseapp.com wss:; font-src 'self' data: https://fonts.gstatic.com; frame-ancestors 'none';" />''',
    'CSP connect-src 全環境対応'
)

print('\n[TypeScript コンパイルチェック - Mobile]')
r = subprocess.run(
    'cd ~/projects/dump-tracker/frontend/mobile && npx tsc --noEmit 2>&1',
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
    'git commit -m "fix: Mobile CSP connect-src 全環境対応 (dev/staging/production + localhost)" && '
    'git push origin main',
    shell=True
)

print('\n✅ 完了！')
print('''
【CSP修正内容】
  追加したオリジン:
    https://10.1.119.244:8443    開発バックエンド(HTTPS)
    https://10.1.119.244:8000    開発バックエンド(HTTPリダイレクト)
    https://localhost:3001       開発CMS
    https://localhost:3002       開発Mobile自己参照
    https://localhost:8443       開発バックエンドlocalhost経由
    https://dumptracker.ddns.net ★production（未追加だった）
    https://cdnjs.cloudflare.com スクリプトソースにも追加(html2canvas等)

【CMS index.html について】
  CSP metaタグなし → バックエンドのhelmet(connectSrc: https:)が担当
  → 全https接続を許可しているため問題なし → 修正不要

【環境別 動作見込み】
  開発(omega-dev):  10.1.119.244:8443 を追加 → ログイン可能 ✅
  staging:          dumptracker-s.ddns.net は 'self' でカバー → 変わらずOK ✅
  production:       dumptracker.ddns.net を追加 → デプロイ後ログイン可能 ✅

Vite が自動リロードするのでそのままログインを試してください。
''')
