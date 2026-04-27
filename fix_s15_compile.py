#!/usr/bin/env python3
"""
Session 15 コンパイルエラー修正:
  - dailyFormat/setDailyFormat が未使用 → state削除 + PDF固定定数に変更
"""
import subprocess, sys, os

BASE = os.path.expanduser("~/dump-tracker")

def read_file(p):
    with open(p, "r", encoding="utf-8") as f: return f.read()

def write_file(p, c):
    with open(p, "w", encoding="utf-8") as f: f.write(c)
    print(f"  ✅ Written: {p}")

def run_tsc(label, cwd):
    r = subprocess.run(["npx", "tsc", "--noEmit", "-p", "tsconfig.json"],
                       cwd=cwd, capture_output=True, text=True)
    errs = (r.stdout + r.stderr).strip()
    if r.returncode == 0:
        print(f"  ✅ {label} TSC: 0エラー"); return True
    print(f"  ❌ {label} TSC: エラーあり")
    for l in errs.splitlines()[:20]: print(f"    {l}")
    return False

CMS_PATH = f"{BASE}/frontend/cms/src/pages/ReportOutput.tsx"

content = read_file(CMS_PATH)

# dailyFormat state削除 → PDF固定定数に
old_state = "  const [dailyFormat, setDailyFormat] = useState<ReportFormat>('PDF');"
new_state = "  // ② 出力形式はPDF固定（state不要）\n  const dailyFormat: ReportFormat = 'PDF';"
if old_state in content:
    content = content.replace(old_state, new_state)
    print("  ✅ dailyFormat stateを定数に変更（setDailyFormat削除）")
else:
    print("  ⚠️  dailyFormat state パターン未発見")

write_file(CMS_PATH, content)

print("\n" + "="*60)
print("コンパイルチェック")
print("="*60)
b = run_tsc("Backend", f"{BASE}/backend")
m = run_tsc("Mobile",  f"{BASE}/frontend/mobile")
c = run_tsc("CMS",     f"{BASE}/frontend/cms")

if b and m and c:
    cmds = [
        ["git", "add", "-A"],
        ["git", "commit", "-m", "feat: report output improvements - vehicle filter, PDF only, history columns+filter, PDF fixes (session15)"],
        ["git", "push", "origin", "main"],
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
        out = (r.stdout + r.stderr).strip()
        if r.returncode != 0:
            print(f"  ❌ {' '.join(cmd)}: {out}"); sys.exit(1)
        print(f"  ✅ {' '.join(cmd)}")
        if out: print(f"    {out}")
    print("\n✅ 全修正完了・Git Push済み")
    print("▶️  dt-restart必要（reportService.ts変更あり）")
else:
    print("\n❌ コンパイルエラーあり → Push中止")
    sys.exit(1)
