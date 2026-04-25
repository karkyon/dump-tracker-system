#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_store_dedup.py
operationStore.ts の totalDistanceKm 重複を行番号ベースで確実除去
→ コンパイルエラー0件確認後 Git Push
"""
import os, re, subprocess

REPO = os.path.expanduser("~/dump-tracker")

def r(p):
    with open(os.path.join(REPO, p), encoding='utf-8') as f: return f.read()

def w(p, c):
    with open(os.path.join(REPO, p), 'w', encoding='utf-8') as f: f.write(c)
    print(f"  ✅ Written: {p}")

def tsc(d, label):
    res = subprocess.run(["npx","tsc","--noEmit"],
        cwd=os.path.join(REPO,d), capture_output=True, text=True, timeout=120)
    if res.returncode==0: print(f"  ✅ {label} TSC: 0エラー"); return True
    print(f"  ❌ {label} TSC:\n{(res.stdout+res.stderr)[:3000]}"); return False

print("="*60)
print("operationStore.ts 重複除去（行番号ベース）")
print("="*60)

path = "frontend/mobile/src/stores/operationStore.ts"
s = r(path)
lines = s.split('\n')

# ---- 現在の状態を表示 ----
print("\n現在の totalDistanceKm 関連行:")
for i, line in enumerate(lines, 1):
    if 'totalDistanceKm' in line:
        print(f"  行{i:3d}: {line}")

# ---- totalDistanceKm を含む行を全列挙 ----
tdkm_lines = [(i, line) for i, line in enumerate(lines) if 'totalDistanceKm' in line]

# ---- 種類別に分類 ----
# type1: インターフェース宣言 "totalDistanceKm: number | null"  (?: も含む)
# type2: アクション宣言      "setTotalDistanceKm"
# type3: 初期値              "totalDistanceKm: null,"
# type4: 実装                "setTotalDistanceKm: (km)"  <- 実装行
# type5: partialize          "totalDistanceKm: state.totalDistanceKm"
# type6: resetOperation内    "totalDistanceKm: null"

groups = {
    'interface': [],  # インターフェース宣言 (?: か :)
    'action_decl': [],  # setTotalDistanceKm: (km: number) => void  (アクション型宣言)
    'init_null': [],    # 初期値 totalDistanceKm: null
    'impl': [],         # setTotalDistanceKm: (km) => { ... }  (実装)
    'partialize': [],   # state.totalDistanceKm
    'other': [],
}

for idx, (lineno, line) in enumerate(tdkm_lines):
    stripped = line.strip()
    if re.search(r'totalDistanceKm\??:\s*(number|string)', stripped):
        groups['interface'].append((lineno, line, idx))
    elif 'setTotalDistanceKm' in stripped and '=>' in stripped and 'void' in stripped and 'state' not in stripped:
        groups['action_decl'].append((lineno, line, idx))
    elif 'setTotalDistanceKm' in stripped and '(km)' in stripped:
        groups['impl'].append((lineno, line, idx))
    elif 'state.totalDistanceKm' in stripped:
        groups['partialize'].append((lineno, line, idx))
    elif re.search(r'totalDistanceKm:\s*null', stripped):
        groups['init_null'].append((lineno, line, idx))
    else:
        groups['other'].append((lineno, line, idx))

print("\n分類結果:")
for k, v in groups.items():
    print(f"  {k}: {len(v)}件")
    for lineno, line, _ in v:
        print(f"    行{lineno+1:3d}: {line[:80]}")

# ---- 削除すべき行番号を決定 ----
# 各グループで2件以上ある場合、1件だけ残して残りを削除
# 「残す」基準: Fix-S11-8 コメント付き を優先、なければ最後のものを残す
lines_to_remove = set()

def pick_keep(group_items):
    """残すべきインデックス(lines配列上)を返す"""
    if len(group_items) <= 1:
        return set()
    remove_set = set()
    # Fix-S11-8 コメント付きを探す
    preferred = [lineno for lineno, line, _ in group_items if 'Fix-S11-8' in line]
    if preferred:
        keep = preferred[0]
    else:
        # 最後のものを残す
        keep = group_items[-1][0]
    for lineno, line, _ in group_items:
        if lineno != keep:
            remove_set.add(lineno)
    return remove_set

lines_to_remove |= pick_keep(groups['interface'])
lines_to_remove |= pick_keep(groups['action_decl'])
lines_to_remove |= pick_keep(groups['init_null'])
lines_to_remove |= pick_keep(groups['partialize'])

# interface の直前コメント行も削除対象に（コメントなしの宣言を削除する場合）
# → 削除行の直前がコメント行なら一緒に削除
extra_remove = set()
for lineno in lines_to_remove:
    prev = lineno - 1
    if prev >= 0 and lines[prev].strip().startswith('//'):
        extra_remove.add(prev)
lines_to_remove |= extra_remove

if lines_to_remove:
    print(f"\n削除対象行: {sorted([l+1 for l in lines_to_remove])}")
    new_lines = [l for i, l in enumerate(lines) if i not in lines_to_remove]
    s = '\n'.join(new_lines)
    w(path, s)
    
    # 確認
    s2 = r(path)
    remaining = [(i+1, l) for i, l in enumerate(s2.split('\n')) if 'totalDistanceKm' in l]
    print("\n修正後の totalDistanceKm 関連行:")
    for lineno, line in remaining:
        print(f"  行{lineno:3d}: {line}")
else:
    print("\n  ℹ️ 重複なし — ファイル変更不要")
    # それでもエラーが出ている場合はファイルをダンプして確認
    print("\n  ⚠️ エラーが続く場合は29行目・49行目周辺を確認:")
    for i, line in enumerate(lines[25:55], 26):
        print(f"    {i:3d}: {line}")

# ---- コンパイルチェック & Push ----
print("\n" + "="*60)
print("コンパイルチェック")
print("="*60)

be = tsc("backend", "Backend")
mo = tsc("frontend/mobile", "Mobile")
cm = tsc("frontend/cms", "CMS")

if be and mo and cm:
    print("\n✅ 全コンパイルOK → Git Push")
    subprocess.run(["git","add","-A"], cwd=REPO, capture_output=True)
    rc = subprocess.run(
        ["git","commit","-m",
         "fix: dedup totalDistanceKm in operationStore (session11)"],
        cwd=REPO, capture_output=True, text=True)
    print(f"  commit: {rc.stdout.strip()}")
    rp = subprocess.run(["git","push","origin","main"],
        cwd=REPO, capture_output=True, text=True)
    print("  ✅ Push完了" if rp.returncode==0 else f"  ❌ Push失敗: {rp.stderr[:200]}")
else:
    print("\n❌ まだエラーあり")
    print("上の 'totalDistanceKm 関連行' の出力を貼り付けて報告してください")