#!/usr/bin/env python3
"""
logRoutes.ts を完全正解版で上書き → TSC → push
実行: python3 ~/projects/dump-tracker/fix_logroutes_final.py
"""
import os, subprocess, sys, shutil

BASE   = os.path.expanduser("~/projects/dump-tracker")
WORK   = os.path.dirname(os.path.abspath(__file__))
DEST   = os.path.join(BASE, "backend/src/routes/logRoutes.ts")
SRC    = os.path.join(WORK, "logRoutes_final.ts")

# SRC が同ディレクトリにあればそちらを使い、なければ inline で書く
if os.path.exists(SRC):
    shutil.copyfile(SRC, DEST)
    print(f"OK: logRoutes.ts を {SRC} で上書き")
else:
    print(f"ERROR: {SRC} が見つかりません")
    sys.exit(1)

def run(cmd, cwd=BASE):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()

# TSC 3プロジェクト
print("\n=== TSC チェック ===")
projects = [
    ("backend",         os.path.join(BASE, "backend")),
    ("frontend/cms",    os.path.join(BASE, "frontend/cms")),
    ("frontend/mobile", os.path.join(BASE, "frontend/mobile")),
]
all_ok = True
for name, cwd in projects:
    rc, out = run("./node_modules/.bin/tsc --noEmit 2>&1 | tail -8", cwd=cwd)
    errors = [l for l in out.splitlines() if "error TS" in l]
    if errors:
        print(f"❌ {name}:")
        for e in errors: print(f"   {e}")
        all_ok = False
    else:
        print(f"✅ {name}: RC=0")

if not all_ok:
    print("\n❌ TSCエラーあり → push 中止")
    sys.exit(1)

print("\n=== git commit & push ===")
rc, out = run(
    "git add -A && "
    "git commit -m 'fix: logRoutes.ts dfOut String()変換でTS2532解消' && "
    "git push origin main"
)
print(out)
if rc == 0:
    print("✅ Push 完了")
    for f in ["fix_tsc_errors.py", "fix_tsc_final.py", "fix_tsc_definitive.py",
              "fix_logroutes_final.py", "logRoutes_final.ts"]:
        p = os.path.join(BASE, f)
        if os.path.exists(p):
            os.remove(p)
            print(f"OK remove: {f}")
else:
    print(f"❌ Push 失敗 RC={rc}")
    sys.exit(1)
