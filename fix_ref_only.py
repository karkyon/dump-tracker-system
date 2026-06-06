import subprocess, sys

BASE = "/home/karkyon/projects/dump-tracker"

f1 = f"{BASE}/frontend/mobile/src/pages/OperationRecord.tsx"
with open(f1, 'r') as f:
    c1 = f.read()

# isSubmittingRef が未定義なので追加
# const [isSubmitting, setIsSubmitting] = useState(false); の次行に挿入
TARGET = "  const [isSubmitting, setIsSubmitting] = useState(false);"

if TARGET not in c1:
    print("ERROR: isSubmitting state が見つかりません")
    sys.exit(1)

if "isSubmittingRef" in c1 and "useRef(false)" in c1:
    print("INFO: isSubmittingRef 既に定義済み")
else:
    NEW_TARGET = (
        "  const [isSubmitting, setIsSubmitting] = useState(false);\n"
        "  const isSubmittingRef = React.useRef(false);"
    )
    c1 = c1.replace(TARGET, NEW_TARGET, 1)
    print("OK: isSubmittingRef 定義追加")

# React import に useRef があるか確認（React.useRef で使うので不要だが念のため）
# React.useRef はデフォルトで使えるのでimport不要

with open(f1, 'w') as f:
    f.write(c1)
print("OK: OperationRecord.tsx 保存")

# TSCチェック
for pkg, d in [("mobile","frontend/mobile"),("CMS","frontend/cms"),("backend","backend")]:
    r = subprocess.run(["./node_modules/.bin/tsc","--noEmit"],
        cwd=f"{BASE}/{d}", capture_output=True, text=True)
    print(f"TSC {pkg} RC:", r.returncode)
    if r.returncode != 0:
        print(r.stdout[:3000])
        print(r.stderr[:1000])
        print("TSCエラー - pushしません"); sys.exit(1)

print("TSC全RC=0 - git commit & push")
subprocess.run(["git","add","-A"],cwd=BASE)
r=subprocess.run(["git","commit","-m",
    "fix: OperationRecord isSubmittingRef定義追加 - handleBreakEnd二重実行防止"],
    cwd=BASE,capture_output=True,text=True)
print("Commit:",r.stdout.strip())
rp=subprocess.run(["git","push","origin","main"],cwd=BASE,capture_output=True,text=True)
print("Push STDERR:",rp.stderr.strip())
print("Push RC:",rp.returncode)
