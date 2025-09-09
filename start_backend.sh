#!/bin/bash
# ダンプ運行記録システム バックエンド統合起動スクリプト

set -euo pipefail

# カラー定義
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

PROJECT_DIR="$HOME/dump-tracker"
BACKEND_DIR="$PROJECT_DIR/backend"

print_header() {
    clear
    echo -e "${BLUE}"
    cat << 'HEADER'
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║               🚛 ダンプ運行記録システム                           ║
║                    バックエンド起動                              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
HEADER
    echo -e "${NC}"
    echo ""
}

check_dependencies() {
    log_info "📋 依存関係確認中..."
    
    # Node.js確認
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.jsがインストールされていません"
        exit 1
    fi
    
    # PostgreSQL確認
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        log_warn "PostgreSQLが起動していません。起動中..."
        sudo systemctl start postgresql
        sleep 3
        
        if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
            log_error "PostgreSQLの起動に失敗しました"
            exit 1
        fi
    fi
    
    log_success "依存関係確認完了"
}

setup_environment() {
    log_info "🔧 環境設定確認中..."
    
    cd "$BACKEND_DIR"
    
    # .envファイル確認
    if [ ! -f .env ]; then
        log_warn ".envファイルが見つかりません。.env.exampleからコピーします..."
        cp .env.example .env
        log_info "📝 .envファイルを編集してデータベース設定を確認してください"
    fi
    
    # node_modules確認
    if [ ! -d node_modules ]; then
        log_info "📦 依存関係をインストール中..."
        npm install
    fi
    
    log_success "環境設定完了"
}

check_database() {
    log_info "🗄️ データベース接続確認中..."
    
    # データベース接続テスト
    if PGPASSWORD="development_password" psql -h localhost -U dump_tracker_user -d dump_tracker_dev -c '\q' >/dev/null 2>&1; then
        log_success "データベース接続確認完了"
    else
        log_error "データベースに接続できません"
        log_info "Phase 2 (データベースセットアップ) を実行してください"
        exit 1
    fi
}

start_server() {
    log_info "🚀 バックエンドサーバーを起動中..."
    
    cd "$BACKEND_DIR"
    
    echo ""
    log_success "🌟 サーバー起動完了"
    echo ""
    echo "📋 アクセス情報:"
    echo "  🌐 Health Check: http://localhost:8000/health"
    echo "  📖 API Info:     http://localhost:8000/api/v1"
    echo "  📚 API Docs:     http://localhost:8000/api/v1/docs"
    echo ""
    echo "🔑 初期ログイン情報:"
    echo "  管理者:     admin / admin123"
    echo "  マネージャー: manager01 / manager123"
    echo "  ドライバー:  driver01 / driver123"
    echo ""
    echo "🛠️ 便利なコマンド:"
    echo "  npm run dev          # 開発サーバー再起動"
    echo "  npm run build        # 本番ビルド"
    echo "  npm run test         # テスト実行"
    echo ""
    echo "🔄 サーバーを停止するには Ctrl+C を押してください"
    echo ""
    
    # 開発サーバー起動
    npm run dev
}

# メイン実行
main() {
    print_header
    check_dependencies
    setup_environment
    check_database
    start_server
}

# トラップでクリーンアップ
cleanup() {
    log_info "🔄 サーバーを停止しています..."
    exit 0
}

trap cleanup SIGINT SIGTERM

main "$@"
