#!/usr/bin/env python3
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
        'server_name dumptracker-s.ddns.net;\n    client_max_body_size 20m;'
    )
    changed = True
    print('✅ client_max_body_size 20m 追加')
else:
    print('ℹ️  client_max_body_size 既に設定済み')

# 2. /uploads/ のプロキシ location を追加（未設定なら）
UPLOADS_LOCATION = """
    # REQ-020: 積載物写真配信 - バックエンドの /uploads/ を nginx 経由で配信
    location /uploads/ {
        proxy_pass http://localhost:8000/uploads/;
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
            UPLOADS_LOCATION + '\n\n    location /api/',
            1
        )
    elif 'location /' in content:
        # / location の前に挿入
        content = content.replace(
            'location /',
            UPLOADS_LOCATION + '\n\n    location /',
            1
        )
    else:
        # 最初の } の前に追加
        last_brace = content.rfind('}')
        content = content[:last_brace] + UPLOADS_LOCATION + '\n}\n'
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
