#!/bin/bash
# 開発環境起動スクリプト（堅牢版）

set -e

echo "🚀 開発環境を起動しています..."

# 現在のディレクトリをバックエンドディレクトリに設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

echo "📁 作業ディレクトリ: $BACKEND_DIR"

# 環境変数読み込み
if [ -f .env ]; then
    echo "📋 環境変数を読み込み中..."
    export $(cat .env | grep -v '^#' | grep -v '^#!/bin/bash
# ダンプ運行記録システム - APIエントリポイント実装・統合スクリプト v4
# 堅牢版：エラー解消と完全動作保証

set -euo pipefail

# カラー定義
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m'

# ログ機能
log() { echo -e "${WHITE}[$(date +'%H:%M:%S')]${NC} $1"; }
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${PURPLE}[STEP]${NC} $1"; }

# 設定変数
PROJECT_NAME="dump-tracker"
PROJECT_DIR="$HOME/${PROJECT_NAME}"
BACKEND_DIR="$PROJECT_DIR/backend"
LOG_FILE="$PROJECT_DIR/logs/api_setup.log"

# エラーハンドリング
handle_error() {
    local line_number=$1
    local error_code=$2
    log_error "Line $line_number: エラーが発生しました (Exit code: $error_code)"
    log_error "詳細なログは $LOG_FILE をご確認ください"
    exit $error_code
}

trap 'handle_error $LINENO $?' ERR

# ディレクトリ存在確認
check_directories() {
    log_step "📁 ディレクトリ構造確認"
    
    if [[ ! -d "$PROJECT_DIR" ]]; then
        log_error "プロジェクトディレクトリが見つかりません: $PROJECT_DIR"
        exit 1
    fi
    
    if [[ ! -d "$BACKEND_DIR" ]]; then
        log_error "バックエンドディレクトリが見つかりません: $BACKEND_DIR"
        exit 1
    fi
    
    # ログディレクトリ作成
    mkdir -p "$PROJECT_DIR/logs"
    exec 1> >(tee -a "$LOG_FILE")
    exec 2> >(tee -a "$LOG_FILE" >&2)
    
    log_success "ディレクトリ構造確認完了"
}

# 既存ファイル構造の詳細確認
analyze_existing_structure() {
    log_step "🔍 既存ファイル構造の詳細分析"
    
    cd "$BACKEND_DIR"
    
    # 実際のコントローラーファイルを確認
    log_info "実際のコントローラーファイル:"
    if [[ -d "src/controllers" ]]; then
        find src/controllers -name "*.ts" -type f | sort | while read -r file; do
            local basename=$(basename "$file")
            log_info "  ✓ $basename"
        done
    else
        log_warn "src/controllersディレクトリが存在しません"
    fi
    
    # 実際のルートファイルを確認
    log_info "実際のルートファイル:"
    if [[ -d "src/routes" ]]; then
        find src/routes -name "*.ts" -type f | sort | while read -r file; do
            local basename=$(basename "$file")
            log_info "  ✓ $basename"
        done
    else
        log_warn "src/routesディレクトリが存在しません"
    fi
    
    log_success "ファイル構造分析完了"
}

# 必要なディレクトリ作成
create_required_directories() {
    log_step "📁 必要ディレクトリ作成"
    
    cd "$BACKEND_DIR"
    
    # 必須ディレクトリを作成
    mkdir -p src/{middleware,utils,config,types}
    mkdir -p logs uploads/{avatars,photos,documents} temp
    mkdir -p scripts
    
    log_success "必要ディレクトリ作成完了"
}

# 型定義ファイル作成
create_type_definitions() {
    log_step "📝 型定義ファイル作成"
    
    cd "$BACKEND_DIR"
    
    # 基本型定義
    cat > src/types/index.ts << 'EOF'
// backend/src/types/index.ts

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  model: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trip {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: Date;
  endTime?: Date;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: 'LOADING' | 'UNLOADING' | 'BOTH';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Item {
  id: string;
  name: string;
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Inspection {
  id: string;
  vehicleId: string;
  inspectorId: string;
  inspectionType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'SPECIAL';
  status: 'PASS' | 'FAIL' | 'PENDING';
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any[];
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}
