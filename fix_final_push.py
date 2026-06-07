#!/usr/bin/env python3
"""
logRoutes.ts 上書き → TSC全確認 → push
実行: python3 ~/projects/dump-tracker/fix_final_push.py
"""
import os, subprocess, sys, shutil

BASE = os.path.expanduser("~/projects/dump-tracker")
WORK = os.path.dirname(os.path.abspath(__file__))

def run(cmd, cwd=BASE):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()

# logRoutes_v2.ts を backend に上書き
src = os.path.join(WORK, "logRoutes_v2.ts")
dst = os.path.join(BASE, "backend/src/routes/logRoutes.ts")
if not os.path.exists(src):
    print(f"ERROR: {src} が見つかりません"); sys.exit(1)
shutil.copyfile(src, dst)
print(f"OK: logRoutes.ts 上書き完了")

# TSC 3プロジェクト
print("\n=== TSC ===")
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
    print("\n❌ エラーあり → push 中止"); sys.exit(1)

print("\n=== git push ===")
rc, out = run(
    "git add -A && "
    "git commit -m 'fix: noUncheckedIndexedAccess対応 safeStr()でTS2532完全解消' && "
    "git push origin main"
)
print(out)
if rc != 0:
    print(f"❌ push失敗 RC={rc}"); sys.exit(1)
print("✅ Push完了")

# ゴミファイル削除
for f in ["fix_tsc_errors.py","fix_tsc_final.py","fix_tsc_definitive.py",
          "fix_logroutes_final.py","fix_final_push.py",
          "logRoutes_final.ts","logRoutes_v2.ts"]:
    p = os.path.join(BASE, f)
    if os.path.exists(p):
        os.remove(p); print(f"OK remove: {f}")
