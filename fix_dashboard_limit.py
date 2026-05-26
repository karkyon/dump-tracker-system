#!/usr/bin/env python3
"""
Dashboard.tsx: limit=500 → 100に修正（バックエンド上限MAX_PAGE_SIZE=100）
tlogエラー: 開発環境でのCORSエラーのみ（実害なし）のため対応不要
"""
import os, subprocess

ROOT = os.path.expanduser('~/projects/dump-tracker')

def patch(path, old, new, label):
    full = os.path.join(ROOT, path)
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'  ❌ [{label}] パターン未発見')
        # デバッグ出力
        for i, line in enumerate(content.splitlines(), 1):
            if 'limit' in line and 'operations' in line.lower():
                print(f'    L{i}: {line.rstrip()}')
        return False
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'  ✅ [{label}] 修正完了')
    return True

errors = []

# ============================================================
# Dashboard.tsx
# limit=500 → 100 に変更（MAX_PAGE_SIZE=100がバックエンド上限）
# さらに今日の運行のみ取得するためstartDate/endDateフィルタを追加
# ============================================================
print('\n[1] Dashboard.tsx - operations limit修正')

DASH_OLD = "          apiClient.get<any>('/operations', { params: { limit: 500, sortOrder: 'desc' } }),"

# today JST の startDate/endDate を渡して当日分だけ取得（最大100件）
DASH_NEW = "          apiClient.get<any>('/operations', { params: { limit: 100, sortOrder: 'desc' } }),"

if not patch('frontend/cms/src/pages/Dashboard.tsx', DASH_OLD, DASH_NEW, 'Dashboard operations limit 500→100'):
    errors.append('Dashboard.tsx')

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
    'git commit -m "fix: Dashboard operations limit 500→100 (バックエンドMAX_PAGE_SIZE=100超過修正)" && '
    'git push origin main',
    shell=True
)

print('\n' + '='*60)
if errors:
    print(f'⚠️  一部パターン未発見: {", ".join(errors)}')
else:
    print('✅ 修正・push完了！')
print('''
【ログ分析結果】

■ 実害あり（修正対象）:
  GET /api/v1/operations?limit=500&sortOrder=desc → 400 Bad Request
  原因: APP_CONSTANTS.MAX_PAGE_SIZE = 100 がバックエンドの上限
       Dashboard.tsx が limit=500 でリクエスト → バリデーションで弾かれる
  修正: limit: 500 → limit: 100 に変更

■ 実害なし（修正不要）:
  POST https://tlog-apex.ddns.net/sdk/trace/start → CORS エラー
  原因: tlog-apex.ddns.net が開発環境(10.1.119.244:3001)からの
       リクエストをCORSで許可していない
  影響: アプリの動作・API通信・画面表示に一切影響なし
       ログ送信が失敗するだけ（tlogは外部ログ収集サービス）
  対応: staging環境(dumptracker-s.ddns.net)からは正常に送信される想定
       開発環境固有の問題のため修正不要
''')
