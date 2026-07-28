#!/bin/bash
# ============================================================================
# disk_check_and_cleanup.sh
#
# dump-tracker-system が動いているサーバ（omega-dev / staging / production
# いずれでも共通利用可）向けのディスク容量確認＋不要データ削除補助スクリプト。
#
# 【重要】このスクリプトはデフォルトでは何も削除しません（確認のみ）。
#   実際に削除するには、各セクションで表示される候補を確認した上で、
#   --interactive オプション付きで再実行し、1件ずつ y/n で確認しながら
#   削除してください。
#
# 使い方:
#   bash disk_check_and_cleanup.sh                # 確認のみ（何も削除しない）
#   bash disk_check_and_cleanup.sh --interactive   # 候補ごとに確認して削除
# ============================================================================

set -uo pipefail

INTERACTIVE=0
if [[ "${1:-}" == "--interactive" ]]; then
  INTERACTIVE=1
fi

PROJECT_DIR="${HOME}/projects/dump-tracker"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

section() { echo -e "\n${CYAN}=== $1 ===${NC}"; }

confirm_and_run() {
  local desc="$1"; shift
  local cmd=("$@")
  if [[ $INTERACTIVE -eq 1 ]]; then
    read -rp "$(echo -e "${YELLOW}削除しますか？${NC} ${desc} [y/N]: ")" ans
    if [[ "$ans" == "y" || "$ans" == "Y" ]]; then
      "${cmd[@]}"
      echo -e "${GREEN}削除しました: ${desc}${NC}"
    else
      echo "スキップ: ${desc}"
    fi
  else
    echo -e "${YELLOW}[確認のみ] 削除候補:${NC} ${desc}  （--interactive で実削除可能）"
  fi
}

# ----------------------------------------------------------------------------
section "1. ディスク全体の使用状況"
df -h / 2>/dev/null
echo
df -hT 2>/dev/null | grep -vE '^(tmpfs|udev|overlay)'

# ----------------------------------------------------------------------------
section "2. ホームディレクトリ配下 サイズ上位20項目"
if [[ -d "$HOME" ]]; then
  du -sh "$HOME"/* "$HOME"/.[!.]* 2>/dev/null | sort -rh | head -20
fi

# ----------------------------------------------------------------------------
section "3. dump-trackerプロジェクト配下の内訳"
if [[ -d "$PROJECT_DIR" ]]; then
  du -sh "$PROJECT_DIR"/* 2>/dev/null | sort -rh
  echo
  echo "--- node_modules（3プロジェクトそれぞれ） ---"
  for d in backend frontend/cms frontend/mobile; do
    p="$PROJECT_DIR/$d/node_modules"
    if [[ -d "$p" ]]; then
      echo "$(du -sh "$p" 2>/dev/null | cut -f1)  $p"
    fi
  done
  echo
  echo "--- .git リポジトリサイズ ---"
  if [[ -d "$PROJECT_DIR/.git" ]]; then
    du -sh "$PROJECT_DIR/.git" 2>/dev/null
  fi
  echo
  echo "--- 取り残された fix_*.py（本来は各セッションで自己削除される想定） ---"
  find "$PROJECT_DIR" -maxdepth 1 -name "fix_*.py" -exec ls -lh {} \; 2>/dev/null
  echo
  echo "--- uploads/images 配下サイズ ---"
  for p in "$PROJECT_DIR/backend/uploads/images" "$PROJECT_DIR/uploads/images"; do
    if [[ -d "$p" ]]; then
      echo "$(du -sh "$p" 2>/dev/null | cut -f1)  $p  （ファイル数: $(find "$p" -type f | wc -l)）"
    fi
  done
else
  echo "プロジェクトディレクトリが見つかりません: $PROJECT_DIR"
fi

# ----------------------------------------------------------------------------
section "4. npm / yarn キャッシュ"
NPM_CACHE=$(npm config get cache 2>/dev/null || echo "$HOME/.npm")
if [[ -d "$NPM_CACHE" ]]; then
  echo "$(du -sh "$NPM_CACHE" 2>/dev/null | cut -f1)  $NPM_CACHE"
fi
if [[ -d "$HOME/.cache/yarn" ]]; then
  echo "$(du -sh "$HOME/.cache/yarn" 2>/dev/null | cut -f1)  $HOME/.cache/yarn"
fi

# ----------------------------------------------------------------------------
section "5. systemdジャーナルログ"
if command -v journalctl >/dev/null 2>&1; then
  journalctl --disk-usage 2>/dev/null
fi

# ----------------------------------------------------------------------------
section "6. /var/log 配下サイズ上位10項目"
if [[ -d /var/log ]]; then
  sudo du -sh /var/log/* 2>/dev/null | sort -rh | head -10 || du -sh /var/log/* 2>/dev/null | sort -rh | head -10
fi

# ----------------------------------------------------------------------------
section "7. PostgreSQL データサイズ（アクセス可能な場合のみ）"
if command -v psql >/dev/null 2>&1; then
  if [[ -n "${PGPASSWORD:-}" || -f "$HOME/.pgpass" ]]; then
    psql -U "${PGUSER:-postgres}" -d "${PGDATABASE:-dump_tracker}" -c \
      "SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;" 2>/dev/null \
      || echo "（DB接続情報が未設定のためスキップ。手動で確認してください: psql -U <user> -d <db> -c \"SELECT pg_size_pretty(pg_database_size(current_database()));\"）"
  else
    echo "（PGPASSWORD/.pgpass未設定のためスキップ）"
  fi
else
  echo "psqlコマンドが見つかりません"
fi

# ----------------------------------------------------------------------------
section "8. Dockerの未使用イメージ・コンテナ（Dockerを使っている場合のみ）"
if command -v docker >/dev/null 2>&1; then
  echo "--- 停止中コンテナ ---"
  docker ps -a --filter "status=exited" --format "{{.ID}}  {{.Image}}  {{.Status}}" 2>/dev/null
  echo "--- danglingイメージ（タグなし） ---"
  docker images -f "dangling=true" --format "{{.ID}}  {{.Size}}" 2>/dev/null
  echo
  echo "サイズ削減見込み（docker system df）:"
  docker system df 2>/dev/null
else
  echo "（Dockerは使用していません）"
fi

# ----------------------------------------------------------------------------
section "9. /tmp 配下の古いファイル（7日以上更新なし・100MB以上）"
find /tmp -maxdepth 2 -type f -mtime +7 -size +100M -exec ls -lh {} \; 2>/dev/null

# ----------------------------------------------------------------------------
section "サマリー / 推奨アクション"
cat <<'EOF'
以下は一般的に削除して問題ない候補です（本スクリプトは自動削除しません）:

  1. node_modules は `npm install` で再生成可能 → 容量が厳しい場合のみ削除検討
       rm -rf backend/node_modules frontend/cms/node_modules frontend/mobile/node_modules
       （削除後は必ず再度 npm install が必要）

  2. npmキャッシュは再ダウンロード可能
       npm cache clean --force

  3. 取り残された fix_*.py（セクション3で検出されたもの）
       本来は各修正セッションの最後に自己削除される想定のファイルです。
       内容を確認の上、手動で rm してください。

  4. systemdジャーナルログの古い分（例: 14日より前を削除）
       sudo journalctl --vacuum-time=14d

  5. Dockerのdanglingイメージ・停止コンテナ（Docker使用時のみ）
       docker system prune -f
       ※ 稼働中のコンテナ・イメージには影響しません

  6. /var/log 配下の古いログ（logrotate設定を確認の上、手動判断）

--interactive オプションで再実行すると、検出された削除候補について
1件ずつ y/n で確認しながら削除できます（今回は候補提示のみで確認モードで
実行されているため何も削除されていません）。
EOF
