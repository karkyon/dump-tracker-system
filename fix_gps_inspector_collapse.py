#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_gps_inspector_collapse.py
GpsInspector.tsx の「最近の運行一覧」を折り畳み可能にする
"""
import os, subprocess

REPO = os.path.expanduser("~/dump-tracker")

def r(p):
    fp = os.path.join(REPO, p)
    return open(fp, encoding='utf-8').read() if os.path.exists(fp) else None

def w(p, content):
    fp = os.path.join(REPO, p)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, 'w', encoding='utf-8').write(content)
    print(f"  ✅ Written: {p}")

def run(cmd, cwd=None):
    res = subprocess.run(cmd, shell=True, cwd=cwd or REPO, capture_output=True, text=True)
    return res.stdout + res.stderr

print("GpsInspector 運行一覧 折り畳み対応")

content = r("frontend/cms/src/pages/GpsInspector.tsx")
if not content:
    print("❌ ファイル未発見"); exit(1)

# [1] showOpList state を追加
old_state = "  const [showAllLogs, setShowAllLogs] = useState(false);"
new_state = """  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showOpList, setShowOpList] = useState(false); // 運行一覧の折り畳み制御"""

if old_state in content:
    content = content.replace(old_state, new_state)
    print("  ✅ showOpList state 追加")

# [2] 運行一覧セクションを折り畳み対応に変更
old_recent = """        {/* 最近の運行リスト */}
        {recentOps.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">最近の運行一覧（クリックで選択）:</p>
            <div className="overflow-x-auto">"""

new_recent = """        {/* 最近の運行リスト — 折り畳み対応 */}
        {recentOps.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowOpList(prev => !prev)}
              className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-800 mb-2 select-none"
            >
              <span>{showOpList ? '▼' : '▶'}</span>
              <span>最近の運行一覧（クリックで選択）: {recentOps.length}件</span>
              <span className="text-gray-400">{showOpList ? '（クリックで閉じる）' : '（クリックで開く）'}</span>
            </button>
            {showOpList && <div className="overflow-x-auto">"""

if old_recent in content:
    content = content.replace(old_recent, new_recent)
    print("  ✅ 運行一覧ヘッダー折り畳みボタンに変更")

    # テーブルの閉じタグ部分を修正（余分な </div> を追加）
    # 元の構造: </div> (overflow-x-auto) </div> (mt-3) )}
    old_table_close = """            </div>
          </div>
        )}"""
    new_table_close = """            </div>}
          </div>
        )}"""
    if old_table_close in content:
        content = content.replace(old_table_close, new_table_close, 1)
        print("  ✅ テーブル折り畳みclose処理追加")
else:
    print("  ⚠️ 運行一覧ヘッダー パターン未発見 — 別パターン試行")
    # フォールバック: テキストだけ変更
    content = content.replace(
        '<p className="text-xs text-gray-500 mb-2">最近の運行一覧（クリックで選択）:</p>',
        '<button onClick={() => setShowOpList(p=>!p)} className="text-xs font-medium text-blue-600 hover:text-blue-800 mb-2">{showOpList?"▼ ":"▶ "}最近の運行一覧（{recentOps.length}件）{showOpList?" — 閉じる":" — 開く"}</button>'
    )

w("frontend/cms/src/pages/GpsInspector.tsx", content)

# コンパイルチェック
print("\nコンパイルチェック...")
cm_out = run("npx tsc --noEmit 2>&1 | head -20", cwd=os.path.join(REPO, "frontend/cms"))
cm_ok = "error TS" not in cm_out
print(f"  {'✅ CMS 0エラー' if cm_ok else '❌ ' + cm_out}")

be_ok = "error TS" not in run("npx tsc --noEmit -p tsconfig.json 2>&1 | head -5", cwd=os.path.join(REPO, "backend"))
mo_ok = "error TS" not in run("npx tsc --noEmit 2>&1 | head -5", cwd=os.path.join(REPO, "frontend/mobile"))
print(f"  {'✅' if be_ok else '❌'} Backend  {'✅' if mo_ok else '❌'} Mobile")

if be_ok and mo_ok and cm_ok:
    out = run("git add -A && git commit -m 'feat: GPS Inspector op-list collapsible (session12)' && git push origin main")
    print(f"  ✅ Push完了: {out.split('main -> main')[0].split('commit')[-1].strip()[:20] if 'main -> main' in out else out[:60]}")
else:
    print("  ❌ エラーあり → Push中止")
