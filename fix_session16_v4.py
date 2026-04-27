#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session 16 v4
  ⑤ 積込客先名消失バグ: act.customerName が空の場合 operationStore の customerName を fallback
     （v1でcustomerNameを完全除去したが、APIが customerName を返さないケースがあるため復元）
  ③ ヘッダーの🚛アイコン削除
"""
import subprocess, sys, os

REPO = os.path.expanduser("~/dump-tracker")

def run(cmd, cwd=None):
    r = subprocess.run(cmd, shell=True, cwd=cwd or REPO, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"[ERROR] {cmd}\nSTDOUT: {r.stdout}\nSTDERR: {r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

def patch(filepath, old, new, desc=""):
    full = os.path.join(REPO, filepath)
    with open(full, "r", encoding="utf-8") as f:
        content = f.read()
    if old not in content:
        print(f"[SKIP] {desc} — パターンが見つかりません")
        idx = content.find(old[:40].strip())
        if idx >= 0:
            print(f"  ヒント: '{old[:40]}' は{idx}文字目付近にある")
        return False
    content = content.replace(old, new, 1)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK] {desc}")
    return True

# ============================================================
# ⑤ 積込客先名: act.customerName を優先しつつ、
#    空の場合は operationStore の customerName を fallback に戻す
#    （BUG-051の正しい修正: 全件連動ではなく、各act優先 + store fallback）
# ============================================================
print("\n=== ⑤ 積込客先名: act優先 + store fallback に修正 ===")

# v1修正後の状態（act.customerNameのみ）→ 正しい形に戻す
CUSTOMER_OLD = """                      {isL && (act.customerName || act.itemName) && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          {/* ✅ BUG-051修正: act.customerName を優先。なければ空文字（全件共有のcustomerNameは使わない） */}
                          {act.customerName || ''}"""

CUSTOMER_NEW = """                      {isL && (act.customerName || customerName || act.itemName) && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          {/* ✅ BUG-051修正: act.customerName を優先。なければ運行全体のcustomerName（store）をfallback */}
                          {act.customerName || customerName || ''}"""

patch(
    "frontend/mobile/src/pages/OperationRecord.tsx",
    CUSTOMER_OLD, CUSTOMER_NEW,
    "⑤ act.customerName優先 + operationStore fallback（BUG-051正式修正）"
)

# ============================================================
# ③ ヘッダーの🚛アイコン削除
#    現在: `🚛 {operation.vehicleName ...}` → `{operation.vehicleName ...}`
# ============================================================
print("\n=== ③ ヘッダーアイコン🚛削除 ===")

ICON_OLD = """          <span style={{ fontSize: '18px', fontWeight: 'bold', opacity: 1.0 }}>
            🚛 {operation.vehicleName || operationStore.vehicleNumber || ''}
          </span>"""

ICON_NEW = """          <span style={{ fontSize: '18px', fontWeight: 'bold', opacity: 1.0 }}>
            {operation.vehicleName || operationStore.vehicleNumber || ''}
          </span>"""

patch(
    "frontend/mobile/src/pages/OperationRecord.tsx",
    ICON_OLD, ICON_NEW,
    "③ ヘッダーの🚛アイコン削除"
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

# Git push
print("\n=== Git push ===")
run("git add -A")
run('git commit -m "fix(session16-v4): ⑤積込客先名act優先+store fallback修正 ③ヘッダーアイコン削除"')
run("git push origin main")
print("\n✅ Session 16 v4 修正完了 & push済み")
