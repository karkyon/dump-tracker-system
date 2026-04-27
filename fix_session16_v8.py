#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session 16 v8
根本原因: fetchDetailActivities でNOTEをfilterで除去してから
detailActivitiesに保存 → getCustomerAtTimeがNOTE参照できない

修正:
1. detailAllActivities（NOTE含む全件）を別stateで保持
2. 表示用は NOTE/OTHER を除いた detailActivities のまま
3. getCustomerAtTime は detailAllActivities を参照
"""
import subprocess, sys, os

REPO = os.path.expanduser("~/dump-tracker")
FILE = os.path.join(REPO, "frontend/mobile/src/pages/OperationRecord.tsx")

def run(cmd, cwd=None):
    r = subprocess.run(cmd, shell=True, cwd=cwd or REPO, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"[ERROR] {cmd}\nSTDOUT: {r.stdout}\nSTDERR: {r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

def patch(filepath, old, new, desc=""):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    if old not in content:
        print(f"[SKIP] {desc}")
        return False
    content = content.replace(old, new, 1)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK] {desc}")
    return True

# ============================================================
# 1. detailAllActivities ステートを追加（NOTE含む全件保持用）
# ============================================================
print("\n=== 1. detailAllActivities ステート追加 ===")

patch(FILE,
    "  // ✅ BUG-051完全修正: APIレスポンスの運行客先名を保持（storeのcustomerNameに依存しない）\n  const [detailOperationCustomerName, setDetailOperationCustomerName] = useState<string | null>(null);",
    "  // ✅ BUG-051完全修正: APIレスポンスの運行客先名を保持（storeのcustomerNameに依存しない）\n  const [detailOperationCustomerName, setDetailOperationCustomerName] = useState<string | null>(null);\n  // ✅ BUG-051最終修正: NOTE含む全アクティビティ（客先変更履歴参照用）\n  const [detailAllActivities, setDetailAllActivities] = useState<any[]>([]);",
    "detailAllActivities ステート追加"
)

# ============================================================
# 2. fetchDetailActivities: NOTE除去前の全件も保存する
# ============================================================
print("\n=== 2. fetchDetailActivities: 全件保存追加 ===")

patch(FILE,
    """      // ✅ BUG-051完全修正: 運行全体の客先名をstateに保存（storeのcustomerNameに依存しない）
      if (detail?.customerName) {
        setDetailOperationCustomerName(detail.customerName);
      }
      if (detail?.activities && Array.isArray(detail.activities)) {
        setDetailActivities(detail.activities.filter((a: any) =>
          !['NOTE', 'OTHER'].includes(a.activityType || '')
        ));
      }""",
    """      // ✅ BUG-051完全修正: 運行全体の客先名をstateに保存（storeのcustomerNameに依存しない）
      if (detail?.customerName) {
        setDetailOperationCustomerName(detail.customerName);
      }
      if (detail?.activities && Array.isArray(detail.activities)) {
        // ✅ BUG-051最終修正: NOTE含む全件を保存（客先変更履歴の参照用）
        setDetailAllActivities(detail.activities);
        // 表示用はNOTE/OTHERを除く
        setDetailActivities(detail.activities.filter((a: any) =>
          !['NOTE', 'OTHER'].includes(a.activityType || '')
        ));
      }""",
    "fetchDetailActivities: NOTE含む全件をdetailAllActivitiesに保存"
)

# ============================================================
# 3. getCustomerAtTime を detailActivities → detailAllActivities 参照に変更
#    v6コードの内側2か所を修正
# ============================================================
print("\n=== 3. getCustomerAtTime の参照先を detailAllActivities に変更 ===")

# 1か所目（条件判定用の外側関数）
patch(FILE,
    """                            for (const a of [...detailActivities].sort(
                              (x: any, y: any) => (x.sequenceNumber ?? 0) - (y.sequenceNumber ?? 0)
                            )) {
                              if ((a.activityType === 'NOTE' || a.activityType === 'OTHER') && a.notes) {
                                // "客先変更: XXX → YYY" パターンを解析
                                const m = String(a.notes).match(/客先変更[:：]\\s*.+?[→\\-]+\\s*(.+)/);
                                if (m && m[1]) {
                                  changeHistory.push({ seq: a.sequenceNumber ?? 0, to: m[1].trim() });
                                }
                              }
                            }""",
    """                            for (const a of [...detailAllActivities].sort(
                              (x: any, y: any) => (x.sequenceNumber ?? 0) - (y.sequenceNumber ?? 0)
                            )) {
                              if ((a.activityType === 'NOTE' || a.activityType === 'OTHER') && a.notes) {
                                // "客先変更: XXX → YYY" パターンを解析
                                const m = String(a.notes).match(/客先変更[:：]\\s*.+?[→\\-]+\\s*(.+)/);
                                if (m && m[1]) {
                                  changeHistory.push({ seq: a.sequenceNumber ?? 0, to: m[1].trim() });
                                }
                              }
                            }""",
    "getCustomerAtTime (1): detailAllActivities参照に変更"
)

# 2か所目（表示用の内側関数）
patch(FILE,
    """                              for (const a of [...detailActivities].sort(
                                (x: any, y: any) => (x.sequenceNumber ?? 0) - (y.sequenceNumber ?? 0)
                              )) {
                                if ((a.activityType === 'NOTE' || a.activityType === 'OTHER') && a.notes) {
                                  const m = String(a.notes).match(/客先変更[:：]\\s*.+?[→\\-]+\\s*(.+)/);
                                  if (m && m[1]) {
                                    changeHistory.push({ seq: a.sequenceNumber ?? 0, to: m[1].trim() });
                                  }
                                }
                              }""",
    """                              for (const a of [...detailAllActivities].sort(
                                (x: any, y: any) => (x.sequenceNumber ?? 0) - (y.sequenceNumber ?? 0)
                              )) {
                                if ((a.activityType === 'NOTE' || a.activityType === 'OTHER') && a.notes) {
                                  const m = String(a.notes).match(/客先変更[:：]\\s*.+?[→\\-]+\\s*(.+)/);
                                  if (m && m[1]) {
                                    changeHistory.push({ seq: a.sequenceNumber ?? 0, to: m[1].trim() });
                                  }
                                }
                              }""",
    "getCustomerAtTime (2): detailAllActivities参照に変更"
)

# ============================================================
# コンパイルチェック
# ============================================================
print("\n=== コンパイルチェック ===")
for name, cwd in [
    ("Backend", os.path.join(REPO, "backend")),
    ("Mobile",  os.path.join(REPO, "frontend/mobile")),
    ("CMS",     os.path.join(REPO, "frontend/cms")),
]:
    r = subprocess.run("npx tsc --noEmit", shell=True, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"[FAIL] {name} TSC:\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    print(f"{name} TSC: ✅ 0エラー")

print("\n=== Git push ===")
run("git add -A")
run('git commit -m "fix(session16-v8): ⑤detailAllActivitiesでNOTE含む全件保持→客先変更履歴が正確に参照可能"')
run("git push origin main")
print("\n✅ Session 16 v8 完了 & push済み")
