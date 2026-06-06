import subprocess, sys

BASE = "/home/karkyon/projects/dump-tracker"
f = f"{BASE}/frontend/cms/src/pages/LogViewer.tsx"
with open(f, 'r') as fp:
    c = fp.read()

c = c.replace(
    "const HEADER_H = 44;\nconst FILTER_H = 36;\nconst TOTAL_FIXED_H = HEADER_H + FILTER_H;",
    "const HEADER_H = 44;\nconst FILTER_H = 36;"
)
with open(f, 'w') as fp:
    fp.write(c)
print("OK: TOTAL_FIXED_H削除")

for pkg, d in [("CMS","frontend/cms"),("mobile","frontend/mobile"),("backend","backend")]:
    r = subprocess.run(["./node_modules/.bin/tsc","--noEmit"], cwd=f"{BASE}/{d}", capture_output=True, text=True)
    print(f"TSC {pkg} RC:", r.returncode)
    if r.returncode != 0:
        print(r.stdout[:2000]); sys.exit(1)

subprocess.run(["git","add","-A"], cwd=BASE)
r = subprocess.run(["git","commit","-m","fix: LogViewer TSC未使用変数エラー解消"], cwd=BASE, capture_output=True, text=True)
print(r.stdout.strip())
rp = subprocess.run(["git","push","origin","main"], cwd=BASE, capture_output=True, text=True)
print("Push RC:", rp.returncode, rp.stderr.strip())
