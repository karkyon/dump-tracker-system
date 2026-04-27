#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session 16 v5
⑤ 積込客先名: storeのcustomerName依存を完全廃止
   → detailOperationCustomerName（APIレスポンスの運行客先名）をfallbackとして使用
   → 客先変更しても過去の積込履歴は変わらない
スクロール: 詳細パネルのリストにスクロール設定追加
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
        key = old.strip()[:60]
        idx = content.find(key)
        if idx >= 0:
            print(f"  ヒント: {idx}文字目付近")
        return False
    content = content.replace(old, new, 1)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK] {desc}")
    return True

FILE = "frontend/mobile/src/pages/OperationRecord.tsx"

# ============================================================
# 1. detailOperationCustomerName ステート追加
# ============================================================
print("\n=== 1. detailOperationCustomerName ステート追加 ===")

STATE_OLD = """  const [detailCustomers, setDetailCustomers] = useState<{ id: string; name: string }[]>([]);
  const [detailItems, setDetailItems] = useState<{ id: string; name: string }[]>([]);
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);"""

STATE_NEW = """  const [detailCustomers, setDetailCustomers] = useState<{ id: string; name: string }[]>([]);
  const [detailItems, setDetailItems] = useState<{ id: string; name: string }[]>([]);
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);
  // ✅ BUG-051完全修正: APIレスポンスの運行客先名を保持（storeのcustomerNameに依存しない）
  const [detailOperationCustomerName, setDetailOperationCustomerName] = useState<string | null>(null);"""

patch(FILE, STATE_OLD, STATE_NEW, "detailOperationCustomerName ステート追加")

# ============================================================
# 2. fetchDetailActivities で detail.customerName を保存
# ============================================================
print("\n=== 2. fetchDetailActivities で customerName 保存 ===")

FETCH_OLD = """      const res = await (apiService as any).getOperationDetail(opId);
      const detail = res?.data ?? res;
      if (detail?.activities && Array.isArray(detail.activities)) {
        setDetailActivities(detail.activities.filter((a: any) =>
          !['NOTE', 'OTHER'].includes(a.activityType || '')
        ));
      }"""

FETCH_NEW = """      const res = await (apiService as any).getOperationDetail(opId);
      const detail = res?.data ?? res;
      // ✅ BUG-051完全修正: 運行全体の客先名をstateに保存（storeのcustomerNameに依存しない）
      if (detail?.customerName) {
        setDetailOperationCustomerName(detail.customerName);
      }
      if (detail?.activities && Array.isArray(detail.activities)) {
        setDetailActivities(detail.activities.filter((a: any) =>
          !['NOTE', 'OTHER'].includes(a.activityType || '')
        ));
      }"""

patch(FILE, FETCH_OLD, FETCH_NEW, "fetchDetailActivities: detailOperationCustomerName 保存")

# ============================================================
# 3. 積込表示: storeのcustomerNameを削除→detailOperationCustomerNameをfallback
# ============================================================
print("\n=== 3. 積込client表示: store依存廃止 ===")

DISPLAY_OLD = """                      {isL && (act.customerName || customerName || act.itemName) && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          {/* ✅ BUG-051修正: act.customerName を優先。なければ運行全体のcustomerName（store）をfallback */}
                          {act.customerName || customerName || ''}"""

DISPLAY_NEW = """                      {isL && (act.customerName || detailOperationCustomerName || act.itemName) && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          {/* ✅ BUG-051完全修正: act.customerNameを優先、なければAPIの運行客先名をfallback（storeは使わない） */}
                          {act.customerName || detailOperationCustomerName || ''}"""

patch(FILE, DISPLAY_OLD, DISPLAY_NEW, "積込表示: store依存廃止→detailOperationCustomerNameに変更")

# ============================================================
# 4. 詳細パネルのリストコンテナにスクロール設定追加
#    現在の構造: <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
#    → 既にoverflowY: 'auto'があるはず、モーダル外側にも maxHeight 確認が必要
#    詳細パネルのモーダル全体に maxHeight + overflowY を設定
# ============================================================
print("\n=== 4. 詳細パネル: スクロール設定確認・修正 ===")

# 詳細パネルモーダルのコンテナ（×ボタンのある上部ヘッダー直前）
SCROLL_OLD = """            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 2000,
              display: 'flex', alignItems: 'flex-end'
            }}>
              <div style={{
                background: '#fff', borderRadius: '16px 16px 0 0',
                width: '100%', maxHeight: '85vh',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
              }}>"""

SCROLL_NEW = """            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 2000,
              display: 'flex', alignItems: 'flex-end'
            }}>
              <div style={{
                background: '#fff', borderRadius: '16px 16px 0 0',
                width: '100%', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
              }}>"""

r1 = patch(FILE, SCROLL_OLD, SCROLL_NEW, "詳細パネル: maxHeight 85vh→90vh に拡張")

# リストコンテナのスクロール確認（flex:1 + overflowY:'auto' があれば OK）
# 念のためリストdivを明示的にスクロール可能に設定
LISTSCROLL_OLD = """            <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#6b7280', padding: '5px 10px 2px', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '0.5px solid #e5e7eb' }}>運行内容 — タップで編集</div>"""

LISTSCROLL_NEW = """            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#fff', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#6b7280', padding: '5px 10px 2px', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '0.5px solid #e5e7eb' }}>運行内容 — タップで編集</div>"""

patch(FILE, LISTSCROLL_OLD, LISTSCROLL_NEW, "詳細パネルリスト: iOS用 -webkit-overflow-scrolling 追加")

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
run('git commit -m "fix(session16-v5): ⑤積込客先名store依存完全廃止+スクロール修正"')
run("git push origin main")
print("\n✅ Session 16 v5 完了 & push済み")
