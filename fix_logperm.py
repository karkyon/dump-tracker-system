import subprocess, sys

BASE = "/home/karkyon/projects/dump-tracker"

# staging-deploy.yml に chown を追加
yml = f"{BASE}/.github/workflows/staging-deploy.yml"
with open(yml, 'r') as f:
    c = f.read()

old = ('            sudo systemctl restart dump-tracker-backend\n'
       '            sleep 3\n'
       '            sudo systemctl is-active dump-tracker-backend && echo "OK"')
new = ('            sudo systemctl restart dump-tracker-backend\n'
       '            sleep 3\n'
       '            sudo systemctl is-active dump-tracker-backend && echo "OK"\n'
       '            # ログファイルのオーナーを修正（rootになる場合がある）\n'
       '            sudo chown -R karkyon_dump:karkyon_dump ~/projects/dump-tracker/backend/logs/ 2>/dev/null || true')

if old in c:
    c = c.replace(old, new)
    with open(yml, 'w') as f:
        f.write(c)
    print("OK: staging-deploy.yml chown追加")
elif 'chown' in c and 'logs' in c:
    print("INFO: chown既に設定済み")
else:
    print("WARNING: パターン見つからず")

for pkg, d in [("backend","backend"),("mobile","frontend/mobile"),("CMS","frontend/cms")]:
    r = subprocess.run(["./node_modules/.bin/tsc","--noEmit"],
        cwd=f"{BASE}/{d}", capture_output=True, text=True)
    print(f"TSC {pkg} RC:", r.returncode)
    if r.returncode != 0:
        print(r.stdout[:2000]); sys.exit(1)

subprocess.run(["git","add","-A"],cwd=BASE)
r=subprocess.run(["git","commit","-m",
    "fix: CI/CD後にlogs/chownでpermission denied解消"],
    cwd=BASE,capture_output=True,text=True)
print("Commit:",r.stdout.strip())
rp=subprocess.run(["git","push","origin","main"],cwd=BASE,capture_output=True,text=True)
print("Push STDERR:",rp.stderr.strip())
print("Push RC:",rp.returncode)
