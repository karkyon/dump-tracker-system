#!/usr/bin/env bash
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

# --- 認証 ---
if [ -z "${API_TOKEN:-}" ]; then
  if [ -z "${API_USERNAME:-}" ] || [ -z "${API_PASSWORD:-}" ]; then
    echo "❌ 環境変数 API_TOKEN か、API_USERNAME と API_PASSWORD のいずれかを設定してください" >&2
    echo "   例: API_USERNAME=admin API_PASSWORD=xxxx ./scripts/export-operation-debug-week.sh" >&2
    exit 1
  fi
  echo "🔑 ログイン中..."
  LOGIN_RES=$(curl -sk -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$API_USERNAME\",\"password\":\"$API_PASSWORD\"}")
  API_TOKEN=$(echo "$LOGIN_RES" | jq -r '.data.accessToken // empty')
  if [ -z "$API_TOKEN" ]; then
    echo "❌ ログイン失敗: $LOGIN_RES" >&2
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
  RES=$(curl -sk -H "$AUTH_HEADER" \
    "${BASE_URL}/operations?startDate=${START_DATE}&endDate=${END_DATE}&page=${PAGE}&limit=100")
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
    DETAIL=$(curl -sk -H "$AUTH_HEADER" "${BASE_URL}/debug/operations/${OPID}/full")
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
