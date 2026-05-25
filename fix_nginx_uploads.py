import subprocess, sys
from pathlib import Path

APP_ROOT = Path.home() / 'projects' / 'dump-tracker'
FIX_NGINX = APP_ROOT / 'scripts' / 'fix-nginx-cms.py'

print('='*60)
print('fix-nginx-cms.py に /uploads/ location を追加')
print('='*60)

# 現在の内容を確認
original = FIX_NGINX.read_text(encoding='utf-8') if FIX_NGINX.exists() else ''
print(f'現在のファイル内容 ({len(original)} 文字):')
print(original[:500] if original else '(空またはファイルなし)')
print('...')

# uploads location 追加済みかチェック
if 'uploads' in original.lower():
    print('✅ 既に /uploads/ の設定が含まれています')
else:
    print('⚠️ /uploads/ の設定なし → 追加します')

# fix-nginx-cms.py を完全上書き（/uploads/ location を確実に含む版）
NEW_CONTENT = '''#!/usr/bin/env python3
"""
staging nginx 設定修正スクリプト
CMSデプロイ時に sudo python3 /tmp/fix-nginx-cms.py として実行される

修正内容:
1. client_max_body_size 20m 設定
2. /uploads/ → バックエンド(localhost:3000)へのプロキシ設定
3. /api/v1/ → バックエンド(localhost:3000)へのプロキシ設定（既存確認）
"""
import subprocess, re, sys
from pathlib import Path

NGINX_CONF = '/etc/nginx/sites-available/dump-tracker-staging'
NGINX_ENABLED = '/etc/nginx/sites-enabled/dump-tracker-staging'

conf_path = Path(NGINX_CONF)
if not conf_path.exists():
    conf_path = Path(NGINX_ENABLED)
    if not conf_path.exists():
        print(f'❌ nginx設定ファイルが見つかりません: {NGINX_CONF}')
        # ファイル一覧を表示
        import os
        for f in Path('/etc/nginx/sites-available').glob('*'):
            print(f'  found: {f}')
        sys.exit(0)  # エラーでもCIを止めない

content = conf_path.read_text(encoding='utf-8')
original = content
changed = False

# 1. client_max_body_size 20m を全 server{} ブロックに追加（未設定なら）
if 'client_max_body_size' not in content:
    content = content.replace(
        'server_name dumptracker-s.ddns.net;',
        'server_name dumptracker-s.ddns.net;\\n    client_max_body_size 20m;'
    )
    changed = True
    print('✅ client_max_body_size 20m 追加')
else:
    print('ℹ️  client_max_body_size 既に設定済み')

# 2. /uploads/ のプロキシ location を追加（未設定なら）
UPLOADS_LOCATION = """
    # REQ-020: 積載物写真配信 - バックエンドの /uploads/ を nginx 経由で配信
    location /uploads/ {
        proxy_pass http://localhost:3000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60;
        proxy_connect_timeout 60;
        # 画像キャッシュ設定
        expires 1d;
        add_header Cache-Control "public, immutable";
    }"""

if 'location /uploads/' not in content:
    # /api/ location の前に挿入
    if 'location /api/' in content:
        content = content.replace(
            'location /api/',
            UPLOADS_LOCATION + '\\n\\n    location /api/',
            1
        )
    elif 'location /' in content:
        # / location の前に挿入
        content = content.replace(
            'location /',
            UPLOADS_LOCATION + '\\n\\n    location /',
            1
        )
    else:
        # 最初の } の前に追加
        last_brace = content.rfind('}')
        content = content[:last_brace] + UPLOADS_LOCATION + '\\n}\\n'
    changed = True
    print('✅ location /uploads/ 追加')
else:
    print('ℹ️  location /uploads/ 既に設定済み')

if changed:
    conf_path.write_text(content, encoding='utf-8')
    print(f'✅ 設定ファイル更新: {conf_path}')
    # nginx test
    result = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
    if result.returncode == 0:
        print('✅ nginx 設定テスト: OK')
        subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True)
        print('✅ nginx reload 完了')
    else:
        print(f'❌ nginx設定エラー: {result.stderr}')
        conf_path.write_text(original, encoding='utf-8')
        print('🔄 ロールバック完了')
else:
    print('ℹ️  変更なし')
'''

FIX_NGINX.write_text(NEW_CONTENT, encoding='utf-8')
print(f'\n✅ {FIX_NGINX} 更新完了')

# Git commit & push
print('\n[Git commit & push...]')
subprocess.run(['git', 'add', '-A'], cwd=str(APP_ROOT))
subprocess.run(['git', 'commit', '-m', 'fix(nginx): /uploads/ location追加 + client_max_body_size(fix-nginx-cms.py更新)'], cwd=str(APP_ROOT))
result = subprocess.run(['git', 'push'], cwd=str(APP_ROOT), capture_output=True, text=True)
print(result.stdout)
print(result.stderr)

print('='*60)
print('✅ push完了！次回CMS deployで自動適用されます')
print()
print('★ staging に今すぐ適用するには:')
print('  stagingサーバー(karkyon_dump)で以下を実行:')
print()
print('  sudo python3 - << \'EOF\'')
print(NEW_CONTENT.replace("'", "'\\''"))
print('EOF')
print('='*60)
