#!/bin/bash

# ===============================================
# Dump Tracker フロントエンドファイル一括配置スクリプト
# Google Drive から作成済みファイルを適切な位置に配置
# ===============================================

set -euo pipefail

# =============================================================================
# グローバル変数・設定
# =============================================================================

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="$HOME/dump_tracker_deploy_$(date +%Y%m%d_%H%M%S).log"
readonly PROJECT_DIR="$(pwd)/dump-tracker"
readonly FRONTEND_DIR="$PROJECT_DIR/frontend"
readonly GDRIVE_SOURCE="gdrive:Work/frontend"
readonly TEMP_DIR="/tmp/dump_tracker_deploy_$(date +%Y%m%d_%H%M%S)"
readonly SCRIPT_START_TIME=$(date +%s)

# カラー定義
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly PURPLE='\033[0;35m'
readonly NC='\033[0m'

# 配置状況記録
declare -A DEPLOYED_FILES=()
declare -a CLEANUP_COMMANDS=()

# ログ設定
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

# =============================================================================
# ユーティリティ関数
# =============================================================================

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { 
    echo ""
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${BLUE}[STEP] $1${NC}"
    echo -e "${BLUE}===========================================${NC}"
}
log_substep() { echo -e "${CYAN}  ➤${NC} $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }

# エラーハンドラー
error_handler() {
    local exit_code=$1
    local line_number=$2
    log_error "スクリプトがライン $line_number で失敗しました (終了コード: $exit_code)"
    log_error "詳細ログ: $LOG_FILE"
    
    # クリーンアップ実行
    if [[ ${#CLEANUP_COMMANDS[@]} -gt 0 ]]; then
        log_warning "クリーンアップを実行しています..."
        for cmd in "${CLEANUP_COMMANDS[@]}"; do
            eval "$cmd" || true
        done
    fi
    
    exit "$exit_code"
}

trap 'error_handler $? $LINENO' ERR

# =============================================================================
# 前提条件チェック
# =============================================================================

check_prerequisites() {
    log_step "前提条件チェック"
    
    # rclone確認
    if ! command -v rclone >/dev/null 2>&1; then
        log_error "rcloneがインストールされていません。"
        exit 1
    fi
    
    log_info "✅ rclone: $(rclone version | head -1)"
    
    # Google Drive接続確認
    if ! rclone lsd gdrive: >/dev/null 2>&1; then
        log_error "Google Drive (gdrive) への接続に失敗しました。rclone config を確認してください。"
        exit 1
    fi
    
    log_info "✅ Google Drive接続: 正常"
    
    # ソースディレクトリ確認
    if ! rclone lsd "$GDRIVE_SOURCE" >/dev/null 2>&1; then
        log_error "ソースディレクトリ $GDRIVE_SOURCE が見つかりません。"
        exit 1
    fi
    
    log_info "✅ ソースディレクトリ: $GDRIVE_SOURCE"
    
    # プロジェクトディレクトリ確認
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        log_error "フロントエンドディレクトリ $FRONTEND_DIR が見つかりません。"
        log_error "先にフロントエンド環境構築スクリプトを実行してください。"
        exit 1
    fi
    
    log_info "✅ フロントエンドディレクトリ: $FRONTEND_DIR"
    
    # 一時ディレクトリ作成
    mkdir -p "$TEMP_DIR"
    CLEANUP_COMMANDS+=("rm -rf '$TEMP_DIR'")
    
    log_success "前提条件チェック完了"
}

# =============================================================================
# Google Driveからファイルダウンロード
# =============================================================================

download_frontend_files() {
    log_step "Google Driveからファイルダウンロード"
    
    log_substep "ファイル一覧取得中..."
    
    # Google Driveのファイル構造を表示
    echo ""
    echo -e "${BLUE}📁 Google Drive ソース構造:${NC}"
    rclone tree "$GDRIVE_SOURCE" || rclone ls "$GDRIVE_SOURCE" | head -20
    echo ""
    
    log_substep "ファイルダウンロード中..."
    
    # Google DriveからTempディレクトリにダウンロード
    if rclone copy "$GDRIVE_SOURCE" "$TEMP_DIR" --progress; then
        log_success "ファイルダウンロード完了"
    else
        log_error "ファイルダウンロードに失敗しました"
        exit 1
    fi
    
    # ダウンロードされたファイル確認
    log_substep "ダウンロードファイル確認..."
    echo ""
    echo -e "${BLUE}📁 ダウンロードされたファイル:${NC}"
    find "$TEMP_DIR" -type f | head -20
    echo ""
    
    local file_count=$(find "$TEMP_DIR" -type f | wc -l)
    log_info "ダウンロードファイル数: $file_count"
}

# =============================================================================
# 既存ファイルのバックアップ
# =============================================================================

backup_existing_files() {
    log_step "既存ファイルのバックアップ"
    
    local backup_dir="$HOME/.dump_tracker_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    CLEANUP_COMMANDS+=("echo 'バックアップ保存先: $backup_dir'")
    
    cd "$FRONTEND_DIR"
    
    # バックアップ対象ファイル・ディレクトリ
    local backup_targets=(
        "src/App.tsx"
        "src/main.tsx"
        "src/pages"
        "src/components"
        "src/store"
        "src/utils"
        "src/types"
        "public/index.html"
        "package.json"
        "vite.config.ts"
        "tailwind.config.js"
        "postcss.config.js"
        ".env.example"
        "tsconfig.json"
    )
    
    for target in "${backup_targets[@]}"; do
        if [[ -e "$target" ]]; then
            log_substep "バックアップ: $target"
            mkdir -p "$backup_dir/$(dirname "$target")"
            cp -r "$target" "$backup_dir/$target"
        fi
    done
    
    log_success "既存ファイルバックアップ完了: $backup_dir"
}

# =============================================================================
# ファイル配置処理
# =============================================================================

deploy_files() {
    log_step "ファイル配置処理"
    
    cd "$FRONTEND_DIR"
    
    # ルートレベルファイル配置
    log_substep "ルートレベルファイル配置中..."
    local root_files=(
        "package.json"
        "vite.config.ts"
        "tailwind.config.js"
        "postcss.config.js"
        ".env.example"
        "tsconfig.json"
        "filelist.txt"
    )
    
    for file in "${root_files[@]}"; do
        if [[ -f "$TEMP_DIR/$file" ]]; then
            log_substep "配置: $file"
            cp "$TEMP_DIR/$file" "./"
            DEPLOYED_FILES["$file"]="ルート"
        fi
    done
    
    # publicディレクトリ配置
    log_substep "publicディレクトリ配置中..."
    if [[ -d "$TEMP_DIR/public" ]]; then
        if [[ -f "$TEMP_DIR/public/index.html" ]]; then
            log_substep "配置: public/index.html"
            cp "$TEMP_DIR/public/index.html" "public/"
            DEPLOYED_FILES["public/index.html"]="public"
        fi
    fi
    
    # srcディレクトリ配置
    log_substep "srcディレクトリ配置中..."
    
    # src直下のファイル
    local src_files=(
        "App.tsx"
        "main.tsx"
        "indexs.css"
    )
    
    for file in "${src_files[@]}"; do
        if [[ -f "$TEMP_DIR/src/$file" ]]; then
            log_substep "配置: src/$file"
            cp "$TEMP_DIR/src/$file" "src/"
            DEPLOYED_FILES["src/$file"]="src"
        fi
    done
    
    # srcサブディレクトリ配置
    local src_dirs=(
        "pages"
        "components"
        "store"
        "utils"
        "types"
    )
    
    for dir in "${src_dirs[@]}"; do
        if [[ -d "$TEMP_DIR/src/$dir" ]]; then
            log_substep "配置: src/$dir/"
            
            # ディレクトリが存在しない場合は作成
            mkdir -p "src/$dir"
            
            # ディレクトリ内容をコピー
            cp -r "$TEMP_DIR/src/$dir"/* "src/$dir/"
            
            # 配置されたファイル数をカウント
            local file_count=$(find "$TEMP_DIR/src/$dir" -type f | wc -l)
            DEPLOYED_FILES["src/$dir"]="$file_count ファイル"
            log_substep "  └─ $file_count ファイル配置完了"
        fi
    done
    
    log_success "ファイル配置処理完了"
}

# =============================================================================
# ファイル整合性チェック
# =============================================================================

verify_deployment() {
    log_step "ファイル整合性チェック"
    
    cd "$FRONTEND_DIR"
    
    # 重要ファイルの存在確認
    local critical_files=(
        "package.json"
        "vite.config.ts"
        "src/main.tsx"
        "src/App.tsx"
        "src/pages/Login.tsx"
        "src/pages/Dashboard.tsx"
        "src/components/Layout/Layout.tsx"
        "src/components/Layout/Sidebar.tsx"
        "src/components/Layout/Header.tsx"
        "src/store/authStore.ts"
        "src/utils/api.ts"
        "src/types/index.ts"
        "public/index.html"
    )
    
    local missing_files=()
    local existing_files=()
    
    for file in "${critical_files[@]}"; do
        if [[ -f "$file" ]]; then
            existing_files+=("$file")
            log_substep "✅ $file"
        else
            missing_files+=("$file")
            log_substep "❌ $file (未発見)"
        fi
    done
    
    echo ""
    log_info "存在ファイル: ${#existing_files[@]}/${#critical_files[@]}"
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        log_warning "以下のファイルが見つかりません:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
    fi
    
    # package.json の依存関係確認
    log_substep "package.json 依存関係確認..."
    if [[ -f "package.json" ]]; then
        if grep -q "react" package.json && grep -q "vite" package.json; then
            log_success "package.json: 必要な依存関係が含まれています"
        else
            log_warning "package.json: 一部の依存関係が不足している可能性があります"
        fi
    fi
    
    log_success "ファイル整合性チェック完了"
}

# =============================================================================
# 依存関係インストールと初期設定
# =============================================================================

setup_and_install() {
    log_step "依存関係インストールと初期設定"
    
    cd "$FRONTEND_DIR"
    
    # .env.local作成
    log_substep ".env.local作成中..."
    if [[ -f ".env.example" ]]; then
        if [[ ! -f ".env.local" ]]; then
            cp ".env.example" ".env.local"
            log_success ".env.local作成完了"
        else
            log_info ".env.local は既に存在します"
        fi
    fi
    
    # 依存関係インストール
    log_substep "npm依存関係インストール中..."
    
    # package-lock.jsonがある場合は削除して新規インストール
    if [[ -f "package-lock.json" ]]; then
        rm package-lock.json
    fi
    
    if npm install; then
        log_success "依存関係インストール完了"
    else
        log_error "依存関係インストールに失敗しました"
        log_warning "手動でインストールしてください: cd $FRONTEND_DIR && npm install"
    fi
    
    # TypeScriptコンパイルチェック
    log_substep "TypeScriptコンパイルチェック..."
    if npm run type-check >/dev/null 2>&1; then
        log_success "TypeScriptコンパイルチェック: 正常"
    else
        log_warning "TypeScriptコンパイルチェック: エラーがある可能性があります"
        log_info "詳細確認: cd $FRONTEND_DIR && npm run type-check"
    fi
}

# =============================================================================
# 開発サーバー起動確認
# =============================================================================

test_dev_server() {
    log_step "開発サーバー起動確認"
    
    cd "$FRONTEND_DIR"
    
    log_substep "開発サーバー起動テスト中..."
    
    # バックグラウンドで開発サーバーを起動
    npm run dev &
    local dev_server_pid=$!
    
    # 起動待機
    sleep 10
    
    # サーバーが起動しているかチェック
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        log_success "開発サーバー起動確認: 正常"
        log_info "アクセス可能: http://localhost:3000"
        log_info "ネットワークアクセス: http://10.1.119.244:3000"
    else
        log_warning "開発サーバーへの接続に失敗しました"
        log_info "手動確認: cd $FRONTEND_DIR && npm run dev"
    fi
    
    # 開発サーバー停止
    kill $dev_server_pid 2>/dev/null || true
    sleep 2
    
    log_success "開発サーバー起動確認完了"
}

# =============================================================================
# 完了処理
# =============================================================================

complete_deployment() {
    log_step "配置完了処理"
    
    # 実行時間計算
    local script_end_time=$(date +%s)
    local total_duration=$((script_end_time - SCRIPT_START_TIME))
    local minutes=$((total_duration / 60))
    local seconds=$((total_duration % 60))
    
    echo ""
    echo -e "${GREEN}🎉 フロントエンドファイル配置が完了しました！${NC}"
    echo -e "${GREEN}=================================================${NC}"
    echo ""
    echo -e "${BLUE}📊 配置サマリー:${NC}"
    for file in "${!DEPLOYED_FILES[@]}"; do
        echo -e "   • ${file}: ${DEPLOYED_FILES[$file]}"
    done
    echo ""
    echo -e "${BLUE}⏱️ 処理時間: ${minutes}分${seconds}秒${NC}"
    echo ""
    echo -e "${BLUE}🚀 次のアクション:${NC}"
    echo -e "   1. ${YELLOW}cd $FRONTEND_DIR${NC}"
    echo -e "   2. ${YELLOW}npm run dev${NC} - 開発サーバー起動"
    echo -e "   3. ${YELLOW}http://localhost:3000${NC} - ローカルアクセス"
    echo -e "   4. ${YELLOW}http://10.1.119.244:3000${NC} - ネットワークアクセス"
    echo ""
    echo -e "${BLUE}🔧 開発コマンド:${NC}"
    echo -e "   • ${CYAN}npm run dev${NC} - 開発サーバー起動"
    echo -e "   • ${CYAN}npm run build${NC} - 本番ビルド"
    echo -e "   • ${CYAN}npm run type-check${NC} - TypeScriptチェック"
    echo -e "   • ${CYAN}npm run lint${NC} - コードリント"
    echo ""
    echo -e "${GREEN}✨ 配置ログ: $LOG_FILE${NC}"
    echo ""
    
    # アプリケーション画面について
    echo -e "${BLUE}📱 期待される表示:${NC}"
    echo -e "   • ログイン画面が表示されます"
    echo -e "   • ユーザー名・パスワード入力フィールド"
    echo -e "   • 「ダンプ運行記録アプリ」のタイトル"
    echo -e "   • レスポンシブデザインに対応"
    echo ""
}

# =============================================================================
# メイン処理
# =============================================================================

main() {
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}  Dump Tracker フロントエンドファイル配置${NC}"
    echo -e "${BLUE}  バージョン: $SCRIPT_VERSION${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo ""
    
    # 確認プロンプト
    echo -e "${YELLOW}⚠️  実行内容:${NC}"
    echo -e "   • Google Drive ($GDRIVE_SOURCE) からファイルをダウンロード"
    echo -e "   • 既存ファイルをバックアップ"
    echo -e "   • ダンプ運行記録アプリのファイルを配置"
    echo -e "   • 依存関係をインストール"
    echo -e "   • 動作確認"
    echo ""
    echo -e "${BLUE}配置先: $FRONTEND_DIR${NC}"
    echo ""
    
    read -p "続行しますか？ (y/N): " REPLY
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "配置をキャンセルしました。"
        exit 0
    fi
    
    echo ""
    log_info "🚀 フロントエンドファイル配置を開始します..."
    echo ""
    
    # メイン処理実行
    check_prerequisites
    download_frontend_files
    backup_existing_files
    deploy_files
    verify_deployment
    setup_and_install
    test_dev_server
    complete_deployment
}

# スクリプト実行
main "$@"