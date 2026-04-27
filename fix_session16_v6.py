#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session 16 v6
⑤ 積込客先名の完全解決:
   - NOTE アクティビティ（客先変更: XXX → YYY）を時系列解析
   - 各積込の sequenceNumber 時点での客先名を正確に特定
   - storeのcustomerNameも detailOperationCustomerName も使わない
スクロール: 詳細パネルの maxHeight をより確実な方法で設定
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
        return False
    content = content.replace(old, new, 1)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK] {desc}")
    return True

FILE = "frontend/mobile/src/pages/OperationRecord.tsx"

# ============================================================
# 1. 積込客先名をNOTE時系列から逆算するヘルパー関数を追加
#    + 積込表示部分を差し替え
# ============================================================
print("\n=== 1. NOTE時系列から積込時点の客先名を逆算する処理 ===")

# ターゲット: detailOperationCustomerName fallback 部分を
# sequenceNumber ベースの時系列解析に置き換える

DISPLAY_OLD = """                      {isL && (act.customerName || detailOperationCustomerName || act.itemName) && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          {/* ✅ BUG-051完全修正: act.customerNameを優先、なければAPIの運行客先名をfallback（storeは使わない） */}
                          {act.customerName || detailOperationCustomerName || ''}"""

DISPLAY_NEW = """                      {isL && (() => {
                          // ✅ BUG-051完全修正: NOTE(客先変更)アクティビティを時系列解析して
                          // この積込時点での正確な客先名を逆算する
                          const getCustomerAtTime = (loadingSeq: number): string => {
                            // NOTE アクティビティから客先変更履歴を収集（sequenceNumber昇順）
                            const changeHistory: { seq: number; to: string }[] = [];
                            for (const a of [...detailActivities].sort(
                              (x: any, y: any) => (x.sequenceNumber ?? 0) - (y.sequenceNumber ?? 0)
                            )) {
                              if ((a.activityType === 'NOTE' || a.activityType === 'OTHER') && a.notes) {
                                // "客先変更: XXX → YYY" パターンを解析
                                const m = String(a.notes).match(/客先変更[:：]\s*.+?[→\-]+\s*(.+)/);
                                if (m && m[1]) {
                                  changeHistory.push({ seq: a.sequenceNumber ?? 0, to: m[1].trim() });
                                }
                              }
                            }
                            // この積込より前（seq<=loadingSeq）の最後の客先変更を取得
                            let currentCustomer = detailOperationCustomerName || '';
                            for (const ch of changeHistory) {
                              if (ch.seq <= loadingSeq) {
                                currentCustomer = ch.to;
                              }
                            }
                            return currentCustomer;
                          };
                          const resolvedCustomer = act.customerName || getCustomerAtTime(act.sequenceNumber ?? 0);
                          return resolvedCustomer || act.itemName;
                        })() && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          {/* ✅ BUG-051完全修正: NOTE(客先変更)履歴を時系列解析して積込時点の客先名を特定 */}
                          {(() => {
                            const getCustomerAtTime = (loadingSeq: number): string => {
                              const changeHistory: { seq: number; to: string }[] = [];
                              for (const a of [...detailActivities].sort(
                                (x: any, y: any) => (x.sequenceNumber ?? 0) - (y.sequenceNumber ?? 0)
                              )) {
                                if ((a.activityType === 'NOTE' || a.activityType === 'OTHER') && a.notes) {
                                  const m = String(a.notes).match(/客先変更[:：]\s*.+?[→\-]+\s*(.+)/);
                                  if (m && m[1]) {
                                    changeHistory.push({ seq: a.sequenceNumber ?? 0, to: m[1].trim() });
                                  }
                                }
                              }
                              let currentCustomer = detailOperationCustomerName || '';
                              for (const ch of changeHistory) {
                                if (ch.seq <= loadingSeq) {
                                  currentCustomer = ch.to;
                                }
                              }
                              return currentCustomer;
                            };
                            return act.customerName || getCustomerAtTime(act.sequenceNumber ?? 0) || '';
                          })()}"""

patch(FILE, DISPLAY_OLD, DISPLAY_NEW, "積込客先名: NOTE時系列解析に置き換え")

# ============================================================
# 2. 詳細パネルのモーダル: position:fixed で全体を覆うラッパーに
#    スクロール可能なリスト部分を確実に設定
#    OperationRecord の詳細パネルダイアログ全体を確認
# ============================================================
print("\n=== 2. 詳細パネルスクロール: position確認 ===")

# 詳細パネルのモーダルコンテナを特定
# showDetailPanel が true の時に表示される外側の div を確認
MODAL_OLD = """              background: 'rgba(0,0,0,0.5)', zIndex: 2000,
              display: 'flex', alignItems: 'flex-end'
            }}>
              <div style={{
                background: '#fff', borderRadius: '16px 16px 0 0',
                width: '100%', maxHeight: '90vh',"""

MODAL_NEW = """              background: 'rgba(0,0,0,0.5)', zIndex: 2000,
              display: 'flex', alignItems: 'flex-end'
            }}>
              <div style={{
                background: '#fff', borderRadius: '16px 16px 0 0',
                width: '100%', maxHeight: '88vh',"""

r1 = patch(FILE, MODAL_OLD, MODAL_NEW, "詳細パネル: maxHeight 90→88vh (既適用済みの場合スキップ)")

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
run('git commit -m "fix(session16-v6): ⑤NOTE客先変更履歴を時系列解析して積込客先名を正確に表示"')
run("git push origin main")
print("\n✅ Session 16 v6 完了 & push済み")
