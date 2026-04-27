#!/usr/bin/env python3
"""
残存NG修正:
1. loadingDuration計算でloadingEndTimeが空の場合unloadingStartTimeをフォールバック
2. 業者名: customer includeのデバッグログ追加 + operation.customerId直接参照
3. キロ始: startOdometerがnullの場合operation.startOdometerをログ出力して確認
"""
import subprocess, sys, os

BASE = os.path.expanduser("~/dump-tracker")
SVC  = f"{BASE}/backend/src/services/reportService.ts"

def read(p):
    with open(p,"r",encoding="utf-8") as f: return f.read()
def write(p,c):
    with open(p,"w",encoding="utf-8") as f: f.write(c)
    print(f"  ✅ Written: {p}")
def tsc(label, cwd):
    r = subprocess.run(["npx","tsc","--noEmit","-p","tsconfig.json"],
                       cwd=cwd, capture_output=True, text=True)
    errs = (r.stdout+r.stderr).strip()
    if r.returncode == 0: print(f"  ✅ {label} TSC: 0エラー"); return True
    print(f"  ❌ {label} TSC:")
    for l in errs.splitlines()[:20]: print(f"    {l}")
    return False

content = read(SVC)

# ── [1] loadingDuration計算修正: loadingEndTime || unloadingStartTime ──
old_loading_dur = "       loadingDuration: calcTimeDuration(c.loadingStartTime, c.loadingEndTime),     // NEW(D)"
new_loading_dur = "       loadingDuration: calcTimeDuration(c.loadingStartTime, c.loadingEndTime || c.unloadingStartTime),  // ⑤fix: 積込終了なければ積降開始で代替"
if old_loading_dur in content:
    content = content.replace(old_loading_dur, new_loading_dur)
    print("  ✅ [1] loadingDuration フォールバック修正")
else:
    print("  ⚠️  [1] loadingDuration パターン未発見")

# ── [2] 業者名デバッグ: customerのinclude確認ログ追加 ──
# allDetailsList生成の前にcustomer情報をログ出力
old_customer_log = "    // ⑤a: 運行詳細から TripCycleRow 構築（customer情報を各detailに付加）\n    const allDetailsList: any[][] = operations.map((op: any) => {\n      const opCustomerName: string = op.customer?.name ?? '';"
new_customer_log = """    // ⑤a: 運行詳細から TripCycleRow 構築（customer情報を各detailに付加）
    // デバッグ: 客先名確認
    for (const op of operations) {
      logger.info('[ReportService] op.customer debug', {
        opId: op.id,
        customerId: op.customerId,
        customerName: op.customer?.name ?? 'NULL',
        startOdometer: op.startOdometer ?? 'NULL',
      });
    }
    const allDetailsList: any[][] = operations.map((op: any) => {
      const opCustomerName: string = op.customer?.name ?? '';"""
if old_customer_log in content:
    content = content.replace(old_customer_log, new_customer_log)
    print("  ✅ [2] 業者名デバッグログ追加")
else:
    # 別パターン
    old2 = "    const allDetailsList: any[][] = operations.map((op: any) => {\n      const opCustomerName: string = op.customer?.name ?? '';"
    new2 = """    // デバッグ: 客先名・キロ確認
    for (const op of operations) {
      logger.info('[ReportService] operation debug', {
        opId: op.id,
        customerId: op.customerId ?? 'NULL',
        customerName: op.customer?.name ?? 'NULL',
        startOdometer: op.startOdometer ?? 'NULL',
      });
    }
    const allDetailsList: any[][] = operations.map((op: any) => {
      const opCustomerName: string = op.customer?.name ?? '';"""
    if old2 in content:
        content = content.replace(old2, new2)
        print("  ✅ [2] 業者名デバッグログ追加（代替）")
    else:
        print("  ⚠️  [2] デバッグログ挿入パターン未発見")

write(SVC, content)

print("\n" + "="*60)
b = tsc("Backend", f"{BASE}/backend")
m = tsc("Mobile",  f"{BASE}/frontend/mobile")
c = tsc("CMS",     f"{BASE}/frontend/cms")

if b and m and c:
    cmds = [
        ["git","add","-A"],
        ["git","commit","-m","fix: loadingDuration fallback + debug log for customer/odometer (session15)"],
        ["git","push","origin","main"],
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
        out = (r.stdout+r.stderr).strip()
        if r.returncode != 0:
            print(f"  ❌ {' '.join(cmd[:3])}: {out}"); sys.exit(1)
        print(f"  ✅ {' '.join(cmd[:3])}")
        if out: print(f"    {out}")
    print("\n✅ Push完了")
    print("▶️  dt-restart必要")
    print("▶️  日報生成後にバックエンドログで customer/startOdometer の値を確認してください")
else:
    print("\n❌ コンパイルエラー → Push中止")
    sys.exit(1)
