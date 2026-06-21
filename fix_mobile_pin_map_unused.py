#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ActivityAddSheet.tsx: MobileLocationPinMap の accentColor 未使用エラー修正
（TS6133）ヒントテキストの色に accentColor を使うことで解消する

実行場所: ~/projects/dump-tracker/ (リポジトリルート)
  $ cd ~/projects/dump-tracker
  $ python3 fix_mobile_pin_map_unused.py
"""

import os
import subprocess
import sys

ROOT = os.getcwd()

def fail(msg):
    print(f"❌ {msg}")
    sys.exit(1)

def read(path):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        fail(f"ファイルが見つかりません: {path}")
    with open(full, "r", encoding="utf-8") as f:
        return f.read()

def write(path, content):
    full = os.path.join(ROOT, path)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)

def patch(path, old, new, desc):
    content = read(path)
    count = content.count(old)
    if count == 0:
        fail(f"アンカー文字列が見つかりません [{desc}] in {path}\n--- 期待した文字列 ---\n{old}\n----------------------")
    if count > 1:
        fail(f"アンカー文字列が複数箇所に一致しました（{count}箇所）[{desc}] in {path}")
    content = content.replace(old, new, 1)
    write(path, content)
    print(f"✅ {desc}")

TARGET = "frontend/mobile/src/components/ActivityAddSheet.tsx"

print("==================================================")
print(" accentColor 未使用エラー修正パッチ適用開始")
print("==================================================")

patch(
    TARGET,
    """      <div ref={mapRef} style={{ width: '100%', height: 180, borderRadius: 7, overflow: 'hidden', background: '#e5e7eb' }} />
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
        {ready ? '📍 地図をタップ、またはピンをドラッグして位置を指定' : '地図を読み込み中...'}
      </div>""",
    """      <div ref={mapRef} style={{ width: '100%', height: 180, borderRadius: 7, overflow: 'hidden', background: '#e5e7eb', border: `1px solid ${accentColor}33` }} />
      <div style={{ fontSize: 10, color: accentColor, marginTop: 3 }}>
        {ready ? '📍 地図をタップ、またはピンをドラッグして位置を指定' : '地図を読み込み中...'}
      </div>""",
    "MobileLocationPinMap: accentColorを枠線・ヒントテキストに使用"
)

print("")
print("==================================================")
print(" パッチ適用完了。3プロジェクトをコンパイル確認します")
print("==================================================")

def run_tsc(subdir, label):
    cwd = os.path.join(ROOT, subdir)
    if not os.path.isdir(cwd):
        fail(f"ディレクトリが見つかりません: {subdir}")
    tsc_bin = os.path.join(cwd, "node_modules", ".bin", "tsc")
    if not os.path.exists(tsc_bin):
        fail(f"tsc が見つかりません: {tsc_bin}")
    print(f"--- {label} (tsc --noEmit) ---")
    result = subprocess.run([tsc_bin, "--noEmit"], cwd=cwd, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr)
    return result.returncode

rc_backend = run_tsc("backend", "backend")
rc_cms = run_tsc("frontend/cms", "frontend/cms")
rc_mobile = run_tsc("frontend/mobile", "frontend/mobile")

print("")
print(f"backend       RC={rc_backend}")
print(f"frontend/cms  RC={rc_cms}")
print(f"frontend/mobile RC={rc_mobile}")

if rc_backend == 0 and rc_cms == 0 and rc_mobile == 0:
    print("")
    print("✅ 3プロジェクトすべてコンパイルエラー0件。git push を実行します。")
    subprocess.run(["git", "add", "-A"], cwd=ROOT, check=True)
    commit_msg = "feat: イベント追加機能を改善（種別フィルタ・地図ピッカー・手入力品目・数量デフォルト）"
    commit_result = subprocess.run(["git", "commit", "-m", commit_msg], cwd=ROOT)
    if commit_result.returncode != 0:
        print("⚠️ git commit に失敗しました（差分なし、または他の要因）。push はスキップします。")
    else:
        push_result = subprocess.run(["git", "push"], cwd=ROOT)
        if push_result.returncode == 0:
            print("✅ git push 完了")
        else:
            fail("git push に失敗しました。手動で確認してください（コミットは作成済みです）")
else:
    print("")
    print("❌ コンパイルエラーが残っているため push しません。")

try:
    os.remove(__file__)
    print("")
    print("🗑️  パッチスクリプト自身を削除しました")
except Exception as e:
    print(f"⚠️ スクリプトの自己削除に失敗: {e}")
