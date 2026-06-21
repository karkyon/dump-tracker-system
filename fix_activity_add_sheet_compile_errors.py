#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ActivityAddSheet.tsx コンパイルエラー修正パッチ
- TS6133: 未使用の step/setStep を削除
- TS18048: cfg が undefined になりうる問題を、デフォルト値で確実に解消

実行場所: ~/projects/dump-tracker/ (リポジトリルート)
  $ cd ~/projects/dump-tracker
  $ python3 fix_activity_add_sheet_compile_errors.py
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
        fail(f"アンカー文字列が見つかりません [{desc}] in {path}\n"
             f"--- 期待した文字列 ---\n{old}\n----------------------")
    if count > 1:
        fail(f"アンカー文字列が複数箇所に一致しました（{count}箇所）[{desc}] in {path}")
    content = content.replace(old, new, 1)
    write(path, content)
    print(f"✅ {desc}")


TARGET = "frontend/mobile/src/components/ActivityAddSheet.tsx"

print("==================================================")
print(" ActivityAddSheet.tsx コンパイルエラー修正パッチ適用開始")
print("==================================================")

# 1. 未使用の step/setStep を削除（TS6133）
patch(
    TARGET,
    """  const [eventType, setEventType] = useState('LOADING');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [locQuery, setLocQuery] = useState('');""",
    """  const [eventType, setEventType] = useState('LOADING');

  const [locQuery, setLocQuery] = useState('');""",
    "未使用の step/setStep state を削除"
)

# 2. DEFAULT_EVENT_CFG を追加（cfg を確実に非undefined型にする）
patch(
    TARGET,
    """const ADD_EVENT_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'LOADING', label: '積込', color: '#1565C0' },
  { value: 'UNLOADING', label: '荷降', color: '#2E7D32' },
  { value: 'FUELING', label: '給油', color: '#E65100' },
  { value: 'BREAK_START', label: '休憩開始', color: '#6A1B9A' },
  { value: 'BREAK_END', label: '休憩終了', color: '#6A1B9A' },
];""",
    """const ADD_EVENT_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'LOADING', label: '積込', color: '#1565C0' },
  { value: 'UNLOADING', label: '荷降', color: '#2E7D32' },
  { value: 'FUELING', label: '給油', color: '#E65100' },
  { value: 'BREAK_START', label: '休憩開始', color: '#6A1B9A' },
  { value: 'BREAK_END', label: '休憩終了', color: '#6A1B9A' },
];

const DEFAULT_EVENT_CFG: { value: string; label: string; color: string } = ADD_EVENT_TYPES[0] ?? { value: 'LOADING', label: '積込', color: '#1565C0' };""",
    "DEFAULT_EVENT_CFG 定数を追加"
)

# 3. cfg の定義を ?? DEFAULT_EVENT_CFG に変更（TS18048対策）
patch(
    TARGET,
    "  const cfg = ADD_EVENT_TYPES.find(t => t.value === eventType) || ADD_EVENT_TYPES[0];",
    "  const cfg = ADD_EVENT_TYPES.find(t => t.value === eventType) ?? DEFAULT_EVENT_CFG;",
    "cfg を ?? DEFAULT_EVENT_CFG で確実に非undefined型に修正"
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
    commit_msg = "feat: 運行履歴詳細にイベント追加機能（記録漏れの後追い登録）を実装"
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
