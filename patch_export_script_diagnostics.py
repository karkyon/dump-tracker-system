#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/export-operation-debug-week.sh のエラー可視化修正パッチ
- curl に -S を追加（エラーメッセージを表示）
- ログイン/接続失敗時に原因がわかるよう明示的にHTTPステータスを表示
- 事前に /health で疎通確認してから処理を始める

実行方法（omega-dev上、リポジトリルートで実行）:
  cd ~/projects/dump-tracker
  python3 patch_export_script_diagnostics.py
"""

import subprocess
import sys
import os
import stat

REPO_ROOT = os.getcwd()
EXPORT_SCRIPT_FILE = os.path.join(REPO_ROOT, "scripts", "export-operation-debug-week.sh")

EXPORT_SCRIPT_CONTENT = """#!/usr/bin/env bash
# =====================================================================
# scripts/export-operation-debug-week.sh
# 過去N日分（既定7日）の運行について、開発者ツール「運行・点検デバッグ」の
# 生データ（GET /debug/operations/:id/full）と同じ内容を一括取得し、
# 1つのJSONファイルに集約して backend/exports/ に出力する。
#
# 出力先のファイルは Developer Tools > 運行・点検デバッグ タブの
# 「エクスポートファイル一覧」からブラウザでダウンロードできる。
#
# 使い方:
#   cd ~/projects/dump-tracker
#   API_USERNAME=admin API_PASSWORD=xxxx ./scripts/export-operation-debug-week.sh
#
# 環境変数:
#   BASE_URL      API ベースURL（既定: https://localhost:8443/api/v1）
#   DAYS          対象日数（既定: 7）
#   API_TOKEN     既にアクセストークンを持っている場合はこれを指定（ログイン不要）
#   API_USERNAME  API_TOKEN未指定時のログインユーザー名
#   API_PASSWORD  API_TOKEN未指定時のログインパスワード
#   EXPORT_DIR    出力先ディレクトリ（既定: backend/exports、リポジトリルートからの相対パス）
#   OUT_FILE      出力ファイルパス（既定: $EXPORT_DIR/operation_debug_<timestamp>.json）
# =====================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost:8443/api/v1}"
DAYS="${DAYS:-7}"
EXPORT_DIR="${EXPORT_DIR:-backend/exports}"
OUT_FILE="${OUT_FILE:-${EXPORT_DIR}/operation_debug_$(date +%Y%m%d_%H%M%S).json}"

command -v jq >/dev/null 2>&1 || { echo "❌ jq が必要です（apt install jq 等でインストールしてください）" >&2; exit 1; }

mkdir -p "$EXPORT_DIR"

HEALTH_URL="${BASE_URL%/api/v1}/health"
echo "🔍 接続確認中: ${HEALTH_URL} ..."
HEALTH_CODE=$(curl -skS -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>&1) || HEALTH_CODE="000"
if [ "$HEALTH_CODE" != "200" ]; then
  echo "❌ APIサーバーに接続できません（HTTPステータス: ${HEALTH_CODE}） BASE_URL=${BASE_URL}" >&2
  echo "   ポート/プロトコルが違う場合は BASE_URL を指定してください。例:" >&2
  echo "   BASE_URL=http://localhost:8000/api/v1 API_USERNAME=admin API_PASSWORD=xxxx $0" >&2
  exit 1
fi
echo "✅ 接続確認OK"

# --- 認証 ---
if [ -z "${API_TOKEN:-}" ]; then
  if [ -z "${API_USERNAME:-}" ] || [ -z "${API_PASSWORD:-}" ]; then
    echo "❌ 環境変数 API_TOKEN か、API_USERNAME と API_PASSWORD のいずれかを設定してください" >&2
    echo "   例: API_USERNAME=admin API_PASSWORD=xxxx ./scripts/export-operation-debug-week.sh" >&2
    exit 1
  fi
  echo "🔑 ログイン中..."
  HTTP_RES=$(curl -skS -w '\\n%{http_code}' -X POST "$BASE_URL/auth/login" \\
    -H "Content-Type: application/json" \\
    -d "{\\"username\\":\\"$API_USERNAME\\",\\"password\\":\\"$API_PASSWORD\\"}") || {
      echo "❌ ログインAPIへの接続に失敗しました（BASE_URL=$BASE_URL）" >&2
      exit 1
    }
  HTTP_CODE=$(echo "$HTTP_RES" | tail -n1)
  LOGIN_RES=$(echo "$HTTP_RES" | sed '$d')
  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
    echo "❌ ログイン失敗（HTTP ${HTTP_CODE}）: $LOGIN_RES" >&2
    exit 1
  fi
  API_TOKEN=$(echo "$LOGIN_RES" | jq -r '.data.accessToken // empty')
  if [ -z "$API_TOKEN" ]; then
    echo "❌ レスポンスに accessToken が含まれていません: $LOGIN_RES" >&2
    exit 1
  fi
  echo "✅ ログイン成功"
fi

AUTH_HEADER="Authorization: Bearer $API_TOKEN"

# --- 対象期間（過去N日〜本日） ---
if date -v-1d >/dev/null 2>&1; then
  START_DATE=$(date -v-"${DAYS}"d +%Y-%m-%d)   # macOS / BSD date
else
  START_DATE=$(date -d "-${DAYS} days" +%Y-%m-%d)  # GNU date (Linux)
fi
END_DATE=$(date +%Y-%m-%d)
echo "📅 対象期間: ${START_DATE} 〜 ${END_DATE}"

# --- 対象運行IDをページネーションで全件取得 ---
ALL_IDS_FILE=$(mktemp)
trap 'rm -f "$ALL_IDS_FILE"' EXIT

PAGE=1
TOTAL_PAGES=1
while [ "$PAGE" -le "$TOTAL_PAGES" ]; do
  RES=$(curl -skS -H "$AUTH_HEADER" \\
    "${BASE_URL}/operations?startDate=${START_DATE}&endDate=${END_DATE}&page=${PAGE}&limit=100") || {
      echo "❌ 運行一覧の取得に失敗しました（page=${PAGE}）" >&2
      exit 1
    }
  echo "$RES" | jq -r '.data.data[]?.id // empty' >> "$ALL_IDS_FILE"
  TP=$(echo "$RES" | jq -r '.data.pagination.totalPages // 1')
  TOTAL_PAGES="${TP:-1}"
  echo "  📄 ページ ${PAGE}/${TOTAL_PAGES} 取得"
  PAGE=$((PAGE + 1))
done

COUNT=$(wc -l < "$ALL_IDS_FILE" | tr -d ' ')
echo "🔍 対象運行: ${COUNT}件"

if [ "$COUNT" -eq 0 ]; then
  echo "[]" > "$OUT_FILE"
  echo "⚠️ 該当する運行がありませんでした: ${OUT_FILE}"
  exit 0
fi

echo "📦 生データ取得中..."

{
  echo "["
  FIRST=true
  while IFS= read -r OPID; do
    [ -z "$OPID" ] && continue
    DETAIL=$(curl -skS -H "$AUTH_HEADER" "${BASE_URL}/debug/operations/${OPID}/full") || {
      echo "❌ 生データ取得失敗: ${OPID}" >&2
      continue
    }
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      echo ","
    fi
    echo "$DETAIL" | jq '.data // .'
    echo "  ✅ ${OPID}" >&2
  done < "$ALL_IDS_FILE"
  echo "]"
} > "$OUT_FILE"

echo "🎉 完了: ${OUT_FILE}（${COUNT}件）"
echo "   Developer Tools > 運行・点検デバッグ > エクスポートファイル一覧 からダウンロードできます"
"""


def fail(msg: str):
    print(f"❌ {msg}")
    self_delete()
    sys.exit(1)


def apply_patch():
    os.makedirs(os.path.dirname(EXPORT_SCRIPT_FILE), exist_ok=True)
    with open(EXPORT_SCRIPT_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(EXPORT_SCRIPT_CONTENT)
    st = os.stat(EXPORT_SCRIPT_FILE)
    os.chmod(EXPORT_SCRIPT_FILE, st.st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    print(f"✅ 修正版を書き込みました: {EXPORT_SCRIPT_FILE}")


def run_tsc(subdir: str) -> int:
    path_ = os.path.join(REPO_ROOT, subdir)
    tsc_bin = os.path.join(path_, "node_modules", ".bin", "tsc")
    if not os.path.isfile(tsc_bin):
        fail(f"tsc が見つかりません: {tsc_bin}")
    print(f"🔎 コンパイルチェック中: {subdir} ...")
    result = subprocess.run([tsc_bin, "--noEmit"], cwd=path_, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"--- {subdir} コンパイルエラー ---")
        print(result.stdout)
        print(result.stderr)
    return result.returncode


def self_delete():
    try:
        os.remove(__file__)
        print(f"🧹 パッチスクリプトを自己削除しました: {__file__}")
    except Exception as e:
        print(f"⚠️ 自己削除に失敗しました（手動削除してください）: {e}")


def main():
    apply_patch()

    targets = ["backend", "frontend/cms", "frontend/mobile"]
    rc_total = 0
    for t in targets:
        rc = run_tsc(t)
        print(f"  → {t}: RC={rc}")
        rc_total += rc

    if rc_total != 0:
        print("❌ コンパイルエラーが残っているため push を中止しました。")
        self_delete()
        sys.exit(1)

    print("✅ 全プロジェクトでコンパイルエラー0件を確認しました。")

    commit_msg = "fix(scripts): export-operation-debug-week.sh のエラー可視化（接続失敗時に原因を表示）"

    subprocess.run(["git", "add", "-A"], cwd=REPO_ROOT, check=True)
    commit = subprocess.run(["git", "commit", "-m", commit_msg], cwd=REPO_ROOT, capture_output=True, text=True)
    print(commit.stdout)
    print(commit.stderr)

    push = subprocess.run(["git", "push"], cwd=REPO_ROOT, capture_output=True, text=True)
    print(push.stdout)
    print(push.stderr)

    if push.returncode != 0:
        print("❌ git push に失敗しました。手動で確認してください（コミット自体は作成済みです）。")
        self_delete()
        sys.exit(1)

    print("🚀 GitHubへのpushが完了しました。")
    self_delete()


if __name__ == "__main__":
    main()
