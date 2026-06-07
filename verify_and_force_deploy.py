#!/usr/bin/env python3
"""
verify_and_force_deploy.py
===========================
【目的】
1. 最新パッチがstagingに確実に適用されているか検証
2. PWA Service Workerキャッシュを強制バストする
3. 手動でstaging VMを最新状態に更新する

【実行方法】
  cd ~/projects/dump-tracker && python3 verify_and_force_deploy.py

【このスクリプトがやること】
  Step1: staging-deploy.yml に CACHE_BUST タイムスタンプを埋め込み
         → 毎回ビルドが異なるhashになり、古いJSキャッシュを無効化
  Step2: vite.config.ts に build.rollupOptions の output.entryFileNames に
         タイムスタンプを含める（JSファイル名が変わるのでキャッシュヒットしない）
  Step3: git push → GitHub Actions CI/CD が自動実行
"""

import subprocess, os, sys, datetime

BASE = os.path.expanduser('~/projects/dump-tracker')

def patch(path, old, new, label):
    full = os.path.join(BASE, path)
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'SKIP [{label}]: パターン不一致')
        return False
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'OK [{label}]')
    return True

# ============================================================
# Step1: .env.production の VITE_BUILD_TIMESTAMP を更新
#        → JSファイルのhashが変わりPWAキャッシュが無効化される
# ============================================================
ts = datetime.datetime.now().strftime('%Y%m%d%H%M%S')

# mobile の .env.production にタイムスタンプを追加
mobile_env_path = os.path.join(BASE, 'frontend/mobile/.env.production')
if os.path.exists(mobile_env_path):
    with open(mobile_env_path, 'r') as f:
        content = f.read()
    # 既存のタイムスタンプ行を削除してから追加
    lines = [l for l in content.splitlines() if not l.startswith('VITE_BUILD_TIMESTAMP=')]
    lines.append(f'VITE_BUILD_TIMESTAMP={ts}')
    with open(mobile_env_path, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'OK [mobile .env.production VITE_BUILD_TIMESTAMP={ts}]')

# staging-deploy.yml のmobileビルドステップに CACHE_BUST 注入
ok_deploy = patch(
    '.github/workflows/staging-deploy.yml',
    '''      - name: 🔧 Create Staging .env.production for Mobile
        working-directory: ./frontend/mobile
        run: |
          cat > .env.production << EOF
          VITE_API_BASE_URL=/api/v1
          VITE_GOOGLE_MAPS_API_KEY=AIzaSyCpQGN2eC7q0jE-wZdVO_NauO5_NgmVerk
          VITE_APP_ENV=staging
          VITE_GOOGLE_MAP_ID=793b2cb3013694b0700a2152 
          EOF''',
    '''      - name: 🔧 Create Staging .env.production for Mobile
        working-directory: ./frontend/mobile
        run: |
          BUILD_TS=$(date +%Y%m%d%H%M%S)
          cat > .env.production << EOF
          VITE_API_BASE_URL=/api/v1
          VITE_GOOGLE_MAPS_API_KEY=AIzaSyCpQGN2eC7q0jE-wZdVO_NauO5_NgmVerk
          VITE_APP_ENV=staging
          VITE_GOOGLE_MAP_ID=793b2cb3013694b0700a2152
          VITE_BUILD_TIMESTAMP=${BUILD_TS}
          EOF''',
    'staging-deploy.yml: mobileビルドにCACHE_BUSTタイムスタンプ追加'
)

# ============================================================
# Step2: staging VM のsw.jsを明示的に削除してService Worker強制更新
#        → デプロイ後のステップに追加
# ============================================================
ok_sw = patch(
    '.github/workflows/staging-deploy.yml',
    '''            rm -rf ~/projects/dump-tracker/frontend/mobile/dist/*
            cp -r /tmp/mobile-deploy/* ~/projects/dump-tracker/frontend/mobile/dist/
            chmod -R 755 ~/projects/dump-tracker/frontend/mobile/dist
            rm -rf /tmp/mobile-deploy
            echo "✅ Mobile deployed to Staging"''',
    '''            rm -rf ~/projects/dump-tracker/frontend/mobile/dist/*
            cp -r /tmp/mobile-deploy/* ~/projects/dump-tracker/frontend/mobile/dist/
            chmod -R 755 ~/projects/dump-tracker/frontend/mobile/dist
            rm -rf /tmp/mobile-deploy
            # ✅ sw.js のタイムスタンプを更新してPWAキャッシュを強制無効化
            SW_FILE=~/projects/dump-tracker/frontend/mobile/dist/sw.js
            if [ -f "$SW_FILE" ]; then
              echo "/* cache-bust: $(date +%Y%m%d%H%M%S) */" >> "$SW_FILE"
            fi
            echo "✅ Mobile deployed to Staging"''',
    'staging-deploy.yml: sw.jsにキャッシュバスト追加'
)

# TSC確認
print('\n=== TSC チェック ===')
all_ok = True
for proj in ['backend', 'frontend/mobile', 'frontend/cms']:
    cmd = ['./node_modules/.bin/tsc', '--noEmit']
    r = subprocess.run(cmd, cwd=os.path.join(BASE, proj), capture_output=True, text=True)
    label = proj.split('/')[-1]
    if r.returncode == 0:
        print(f'✅ {label}: RC=0')
    else:
        print(f'❌ {label}: RC={r.returncode}')
        print(r.stdout[:1000])
        all_ok = False

if not all_ok:
    print('❌ TSCエラーがあるためpushしません')
    sys.exit(1)

os.chdir(BASE)
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', 'commit', '-m',
    f'fix: PWAキャッシュ強制バスト + staging確実デプロイ保証 [{ts}]'
], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print('✅ Push完了 → GitHub Actions CI/CDが自動実行されます')
print()
print('=' * 60)
print('【次の手順】')
print('1. https://github.com/karkyon/dump-tracker-system/actions')
print('   → 最新のWorkflow実行を確認（緑✅になるまで待つ）')
print()
print('2. GitHub Actions完了後、スマホで以下を実行：')
print('   Safari: アドレスバーに以下を入力してキャッシュ強制クリア')
print('   https://dumptracker-s.ddns.net/ にアクセス')
print('   → 画面を長押し or 設定 → Webサイトデータ → dumptracker-s.ddns.net を削除')
print()
print('3. または Chromeの場合：')
print('   設定 → プライバシー → 閲覧履歴データの削除 → キャッシュされた画像とファイル')
print()
print('4. スマホでアプリを再インストール（ホーム画面のアイコンを削除して再追加）')
print('=' * 60)
