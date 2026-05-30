#!/bin/bash
# ============================================================
#  Dump Tracker - 全体コンパイル / TypeCheck / Build & Push
#  対象: backend / frontend/cms / frontend/mobile
#  配置先: scripts/ フォルダ
#  実行: bash scripts/compile_and_push.sh
# ============================================================

set -e

# ---- カラー定義 ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${CYAN}🔍 $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
head() { echo -e "\n${BOLD}${BLUE}========================================${NC}"
         echo -e "${BOLD}${BLUE} $1${NC}"
         echo -e "${BOLD}${BLUE}========================================${NC}"; }

# ---- パス解決: スクリプトの場所に関わらずプロジェクトルートを特定 ----
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# scripts/ の親がプロジェクトルート
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# プロジェクトルート確認
if [ ! -d "$REPO_ROOT/backend" ] || [ ! -d "$REPO_ROOT/frontend/cms" ] || [ ! -d "$REPO_ROOT/frontend/mobile" ]; then
  err "プロジェクトルートが特定できません: $REPO_ROOT"
  err "backend / frontend/cms / frontend/mobile が見つかりません"
  exit 1
fi

BACKEND_DIR="$REPO_ROOT/backend"
CMS_DIR="$REPO_ROOT/frontend/cms"
MOBILE_DIR="$REPO_ROOT/frontend/mobile"

TOTAL_ERRORS=0
declare -A RESULTS

head "Dump Tracker 全体チェック & Push"
echo "📁 REPO:    $REPO_ROOT"
echo "📁 BACKEND: $BACKEND_DIR"
echo "📁 CMS:     $CMS_DIR"
echo "📁 MOBILE:  $MOBILE_DIR"
echo "🕐 開始: $(date '+%Y-%m-%d %H:%M:%S')"

# ============================================================
# 関数: TypeScript typecheck
# ============================================================
run_typecheck() {
  local name="$1"
  local dir="$2"
  info "$name - TypeCheck (tsc --noEmit)..."
  cd "$dir"
  local output
  if output=$(npx tsc --noEmit 2>&1); then
    ok "$name TypeCheck: エラー 0件"
    RESULTS["$name.typecheck"]="✅ OK"
  else
    err "$name TypeCheck: エラーあり"
    echo "$output"
    RESULTS["$name.typecheck"]="❌ FAIL"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
  fi
}

# ============================================================
# 関数: Build
# ============================================================
run_build() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  info "$name - Build ($cmd)..."
  cd "$dir"
  local output
  if output=$(eval "$cmd" 2>&1); then
    ok "$name Build: 成功"
    RESULTS["$name.build"]="✅ OK"
  else
    err "$name Build: 失敗"
    echo "$output"
    RESULTS["$name.build"]="❌ FAIL"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
  fi
}

# ============================================================
# 1. Backend
# ============================================================
head "1/3  Backend"
run_typecheck "Backend" "$BACKEND_DIR"
run_build     "Backend" "$BACKEND_DIR" "npx tsc"

# ============================================================
# 2. Frontend CMS
# ============================================================
head "2/3  Frontend / CMS"
run_typecheck "CMS" "$CMS_DIR"
run_build     "CMS" "$CMS_DIR" "npm run build"

# ============================================================
# 3. Frontend Mobile
# ============================================================
head "3/3  Frontend / Mobile"
run_typecheck "Mobile" "$MOBILE_DIR"
run_build     "Mobile" "$MOBILE_DIR" "npm run build"

# ============================================================
# 結果サマリー
# ============================================================
head "結果サマリー"
echo ""
printf "%-25s %s\n" "チェック項目" "結果"
printf "%-25s %s\n" "-------------------------" "-------"
for key in "Backend.typecheck" "Backend.build" "CMS.typecheck" "CMS.build" "Mobile.typecheck" "Mobile.build"; do
  printf "%-25s %s\n" "$key" "${RESULTS[$key]:-⚠️  スキップ}"
done
echo ""

if [ "$TOTAL_ERRORS" -gt 0 ]; then
  err "エラー ${TOTAL_ERRORS}件 → Push 中止"
  exit 1
fi

ok "全チェック通過 (エラー 0件)"

# ============================================================
# Git Push
# ============================================================
head "GitHub Push"
cd "$REPO_ROOT"

CHANGED=$(git status --porcelain 2>/dev/null)
if [ -n "$CHANGED" ]; then
  warn "未コミットの変更を検出 → 自動コミットします"
  echo "$CHANGED"
  git add -A
  FILES=$(git diff --cached --name-only | head -10 | tr '\n' ' ')
  git commit -m "fix: 全体チェック通過後の自動コミット

変更ファイル: $FILES
チェック済み: Backend/CMS/Mobile typecheck+build 全6項目
$(date '+%Y-%m-%d %H:%M:%S')"
  ok "コミット完了"
else
  info "未コミットの変更なし (既にコミット済み)"
fi

info "git push origin main ..."
git push origin main
ok "Push 完了！"

echo ""
echo "🕐 完了: $(date '+%Y-%m-%d %H:%M:%S')"
head "完了"
