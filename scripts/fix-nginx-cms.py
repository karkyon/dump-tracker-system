#!/usr/bin/env python3
import subprocess, sys
conf = "/etc/nginx/sites-enabled/dump-tracker"
try:
    content = open(conf).read()
except Exception as e:
    print(f"設定ファイル読み込み失敗: {e}")
    sys.exit(0)
if "listen 3003" not in content:
    print("CMS listen 3003 ブロックなし")
    sys.exit(0)
cms_part = content.split("listen 3003")[1]
if "proxy_pass http://localhost:3001" in cms_part:
    print("Nginx CMS /api/ プロキシ設定済み - スキップ")
    sys.exit(0)
api_block = """
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120;
        proxy_connect_timeout 120;
    }
    location /docs/ {
        proxy_pass http://localhost:3001/docs/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120;
    }
"""
marker = "    location / {\n        root /home/karkyon_dump/projects/dump-tracker/frontend/cms/dist;"
if marker not in content:
    print("マーカー不一致")
    sys.exit(0)
idx = content.rfind(marker)
content = content[:idx] + api_block + content[idx:]
open(conf, "w").write(content)
print("Nginx CMS /api/ プロキシ追加完了")
r = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
print(r.stdout + r.stderr)
