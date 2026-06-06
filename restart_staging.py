import subprocess, sys

BASE = "/home/karkyon/projects/dump-tracker"

# fix_consolelog.py ゴミファイル削除
import os, glob
for f in glob.glob(f"{BASE}/fix_*.py"):
    os.remove(f)
    print(f"DELETE: {f}")

# ゴミファイルがあればgitから削除してpush
r = subprocess.run(["git","status","--short"], cwd=BASE, capture_output=True, text=True)
if r.stdout.strip():
    subprocess.run(["git","add","-A"], cwd=BASE)
    subprocess.run(["git","commit","-m","chore: ゴミファイル削除"], cwd=BASE, capture_output=True)
    subprocess.run(["git","push","origin","main"], cwd=BASE, capture_output=True)
    print("OK: ゴミファイルをgitから削除してpush")
else:
    print("INFO: ゴミファイルなし")

# stagingサーバーに直接SSH接続してbackend再起動
STAGING_HOST = "dumptracker-s.ddns.net"
STAGING_USER = "karkyon"
SSH_KEY = "/home/karkyon/.ssh/staging_key"

cmd = [
    "ssh", "-o", "StrictHostKeyChecking=no",
    "-i", SSH_KEY,
    f"{STAGING_USER}@{STAGING_HOST}",
    "sudo systemctl restart dump-tracker-backend && sleep 2 && sudo systemctl is-active dump-tracker-backend && sudo nginx -s reload && echo 'ALL_OK'"
]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
print("SSH STDOUT:", r.stdout.strip())
print("SSH STDERR:", r.stderr.strip())
print("SSH RC:", r.returncode)
