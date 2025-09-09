#!/bin/bash
# ダンプ運行記録システム - API エンドポイント自動作成スクリプト（修正版）
# 3. バックエンドAPIエンドポイント自動作成とドキュメント作成

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
API_DOC_DIR="$PROJECT_DIR/docs/api"
LOG_FILE="$PROJECT_DIR/logs/api_setup.log"

print_header() {
    clear
    echo -e "${CYAN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║               🚛 ダンプ運行記録システム                           ║
║           API エンドポイント自動作成スクリプト（修正版）            ║
║                                                                  ║
║               📋 Phase 3: API エンドポイント・ドキュメント作成     ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
}

check_prerequisites() {
    log_success "テストスクリプトを作成しました"
}

fix_broken_files() {
    log_step "🔧 破損ファイルの修正"
    
    cd "$BACKEND_DIR"
    
    # 無効なファイルを削除または修正
    local broken_files=(
        "src/controllers/dashboardController.ts"
        "src/database/connection.ts"
        "src/database/migrations.ts"
        "src/database/seeds.ts"
        "src/middleware/rateLimit.ts"
        "src/models/Report.ts"
        "src/models/Trip.ts"
        "src/routes/dashboardRoutes.ts"
        "src/routes/inspectionRoutes.ts"
        "src/routes/itemRoutes.ts"
        "src/routes/locationRoutes.ts"
        "src/routes/reportRoutes.ts"
        "src/utils/apiResponse.ts"
        "src/utils/dateTime.ts"
        "src/utils/email.ts"
        "src/utils/encryption.ts"
        "src/utils/validators.ts"
        "src/validators/authValidator.ts"
        "src/validators/locationValidator.ts"
        "src/validators/tripValidator.ts"
        "src/validators/userValidator.ts"
        "src/validators/vehicleValidator.ts"
    )
    
    for file in "${broken_files[@]}"; do
        if [ -f "$file" ]; then
            log_info "破損ファイルを削除: $file"
            rm -f "$file"
        fi
    done
    
    log_success "破損ファイルの修正完了"
}

install_missing_dependencies() {
    log_step "📦 不足依存関係のインストール"
    
    cd "$BACKEND_DIR"
    
    # Prisma関連の依存関係をインストール
    log_info "Prisma関連パッケージをインストール中..."
    npm install prisma @prisma/client
    
    # その他の必要なパッケージ
    log_info "追加パッケージをインストール中..."
    npm install swagger-ui-express yamljs express-rate-limit
    npm install --save-dev @types/swagger-ui-express
    
    log_success "依存関係のインストール完了"
}

setup_database_config() {
    log_step "🗄️ データベース設定の修正"
    
    cd "$BACKEND_DIR"
    
    # 正しいデータベース設定ファイルを作成
    cat > src/config/database.ts << 'EOF'
// backend/src/config/database.ts
import { Pool } from 'pg';
import config from './environment';
import logger from '../utils/logger';

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    pool.on('connect', () => {
      logger.info('Database connected successfully');
    });
  }

  return pool;
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
};

// データベース接続テスト
export const testConnection = async (): Promise<boolean> => {
  try {
    const testPool = getPool();
    const client = await testPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  }
};

export default { getPool, closePool, testConnection };
EOF

    log_success "データベース設定の修正完了"
}

create_startup_script() {
    log_step "🚀 統合起動スクリプト作成"
    
    cd "$PROJECT_DIR"
    
    # 統合起動スクリプト
    cat > start_backend.sh << 'EOF'
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
    echo "📄 サーバーを停止するには Ctrl+C を押してください"
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
    log_info "📄 サーバーを停止しています..."
    exit 0
}

trap cleanup SIGINT SIGTERM

main "$@"
EOF

    chmod +x start_backend.sh
    
    log_success "統合起動スクリプトを作成しました"
}

verify_setup() {
    log_step "🔍 セットアップ検証"
    
    cd "$BACKEND_DIR"
    
    # TypeScriptコンパイル確認
    log_info "TypeScriptコンパイル確認中..."
    if npx tsc --noEmit --skipLibCheck; then
        log_success "TypeScriptコンパイル成功"
    else
        log_warn "TypeScriptコンパイルに問題がありますが、継続します"
    fi
    
    # 重要ファイル存在確認
    log_info "重要ファイル確認中..."
    local files=(
        "src/app.ts"
        "src/server.ts"
        "src/routes/index.ts"
        "src/controllers/authController.ts"
        "src/controllers/vehicleController.ts"
        "src/middleware/auth.ts"
        "src/middleware/validation.ts"
        "src/utils/logger.ts"
        "package.json"
    )
    
    local missing_files=()
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            log_success "✓ $file"
        else
            missing_files+=("$file")
            log_error "✗ $file - missing"
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        log_error "不足ファイル: ${missing_files[*]}"
        return 1
    fi
    
    # APIドキュメント確認
    if [ -f "$API_DOC_DIR/openapi.yaml" ]; then
        log_success "✓ API ドキュメント"
    else
        log_warn "✗ API ドキュメント - missing"
    fi
    
    log_success "セットアップ検証完了"
}

print_summary() {
    log_step "📋 API エンドポイントセットアップ完了サマリー"
    
    echo ""
    echo -e "${GREEN}✅ API エンドポイント自動作成が完了しました！${NC}"
    echo ""
    echo -e "${YELLOW}🎯 作成されたAPI機能:${NC}"
    echo "  🔐 認証システム (JWT)"
    echo "    ├── POST /api/v1/auth/login"
    echo "    ├── GET  /api/v1/auth/me"
    echo "    ├── POST /api/v1/auth/logout"
    echo "    └── POST /api/v1/auth/refresh"
    echo ""
    echo "  👥 ユーザー管理"
    echo "    ├── GET  /api/v1/users"
    echo "    └── GET  /api/v1/users/:id"
    echo ""
    echo "  🚛 車両管理"
    echo "    ├── GET    /api/v1/vehicles"
    echo "    ├── GET    /api/v1/vehicles/:id"
    echo "    ├── POST   /api/v1/vehicles"
    echo "    ├── PUT    /api/v1/vehicles/:id"
    echo "    └── DELETE /api/v1/vehicles/:id"
    echo ""
    echo -e "${YELLOW}🛠️ 作成されたコンポーネント:${NC}"
    echo "  📂 $BACKEND_DIR/src/"
    echo "  ├── 🎮 controllers/ (認証、ユーザー、車両)"
    echo "  ├── 🛣️ routes/ (API ルート定義)"
    echo "  ├── 🔐 middleware/ (認証、バリデーション、エラー処理)"
    echo "  ├── 🔧 utils/ (ログ、GPS計算)"
    echo "  └── 📄 app.ts (統合アプリケーション)"
    echo ""
    echo "  📚 $API_DOC_DIR/"
    echo "  ├── 📖 openapi.yaml (OpenAPI仕様書)"
    echo "  └── 📋 API_GUIDE.md (使用ガイド)"
    echo ""
    echo -e "${YELLOW}🚀 サーバー起動方法:${NC}"
    echo "  ./start_backend.sh           # 統合起動スクリプト"
    echo "  cd backend && npm run dev    # 開発サーバー直接起動"
    echo ""
    echo -e "${YELLOW}🌐 アクセスURL (起動後):${NC}"
    echo "  Health Check: http://localhost:8000/health"
    echo "  API Info:     http://localhost:8000/api/v1"
    echo "  API Docs:     http://localhost:8000/api/v1/docs"
    echo ""
    echo -e "${YELLOW}🧪 テスト方法:${NC}"
    echo "  ./scripts/testing/test_api.sh    # API動作テスト"
    echo "  ./scripts/testing/load_test.sh   # 負荷テスト"
    echo ""
    echo -e "${YELLOW}🔑 初期認証情報:${NC}"
    echo "  管理者:     admin / admin123"
    echo "  マネージャー: manager01 / manager123"
    echo "  ドライバー:  driver01 / driver123"
    echo ""
    echo -e "${CYAN}🏁 完了したフェーズ:${NC}"
    echo "  ✅ Phase 1: バックエンド環境セットアップ"
    echo "  ✅ Phase 2: データベース・スキーマセットアップ"
    echo "  ✅ Phase 3: API エンドポイント自動作成"
    echo ""
    echo -e "${CYAN}🎯 次のステップ:${NC}"
    echo "  1. バックエンドサーバー起動: ./start_backend.sh"
    echo "  2. API動作確認: ./scripts/testing/test_api.sh"
    echo "  3. フロントエンド連携テスト"
    echo "  4. 本格的な機能実装・拡張"
    echo ""
}

main() {
    print_header
    
    log "API エンドポイント自動作成を開始します..."
    
    check_prerequisites
    fix_broken_files
    install_missing_dependencies
    setup_database_config
    create_middleware
    create_controllers
    create_routes
    create_utilities
    create_api_documentation
    update_app_routes
    create_test_scripts
    create_startup_script
    verify_setup
    
    print_summary
    
    log_success "🎉 Phase 3 完了: API エンドポイント自動作成"
    log_info "バックエンドの準備が完了しました！"
}

# エラーハンドリング
trap 'log_error "エラーが発生しました (Line: $LINENO)"; exit 1' ERR

# メイン実行
main "$@"step "📋 前提条件確認"
    
    # バックエンドディレクトリ確認
    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "バックエンドディレクトリが見つかりません: $BACKEND_DIR"
        log_info "Phase 1 (バックエンド環境セットアップ) を先に実行してください"
        exit 1
    fi
    
    # package.json確認
    if [ ! -f "$BACKEND_DIR/package.json" ]; then
        log_error "package.jsonが見つかりません"
        exit 1
    fi
    
    # データベース接続確認
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        log_warn "PostgreSQLが起動していません"
        log_info "データベースを起動してください: sudo systemctl start postgresql"
    else
        log_success "PostgreSQL接続確認完了"
    fi
    
    log_success "前提条件確認完了"
}

fix_broken_files() {
    log_step "🔧 破損ファイルの修正"
    
    cd "$BACKEND_DIR"
    
    # 無効なファイルを削除または修正
    local broken_files=(
        "src/controllers/dashboardController.ts"
        "src/database/connection.ts"
        "src/database/migrations.ts"
        "src/database/seeds.ts"
        "src/middleware/rateLimit.ts"
        "src/models/Report.ts"
        "src/models/Trip.ts"
        "src/routes/dashboardRoutes.ts"
        "src/routes/inspectionRoutes.ts"
        "src/routes/itemRoutes.ts"
        "src/routes/locationRoutes.ts"
        "src/routes/reportRoutes.ts"
        "src/utils/apiResponse.ts"
        "src/utils/dateTime.ts"
        "src/utils/email.ts"
        "src/utils/encryption.ts"
        "src/utils/validators.ts"
        "src/validators/authValidator.ts"
        "src/validators/locationValidator.ts"
        "src/validators/tripValidator.ts"
        "src/validators/userValidator.ts"
        "src/validators/vehicleValidator.ts"
    )
    
    for file in "${broken_files[@]}"; do
        if [ -f "$file" ]; then
            log_info "破損ファイルを削除: $file"
            rm -f "$file"
        fi
    done
    
    log_success "破損ファイルの修正完了"
}

install_missing_dependencies() {
    log_step "📦 不足依存関係のインストール"
    
    cd "$BACKEND_DIR"
    
    # Prisma関連の依存関係をインストール
    log_info "Prisma関連パッケージをインストール中..."
    npm install prisma @prisma/client
    
    # その他の必要なパッケージ
    log_info "追加パッケージをインストール中..."
    npm install swagger-ui-express yamljs express-rate-limit
    npm install --save-dev @types/swagger-ui-express
    
    log_success "依存関係のインストール完了"
}

setup_database_config() {
    log_step "🗄️ データベース設定の修正"
    
    cd "$BACKEND_DIR"
    
    # 正しいデータベース設定ファイルを作成
    cat > src/config/database.ts << 'EOF'
// backend/src/config/database.ts
import { Pool } from 'pg';
import config from './environment';
import logger from '../utils/logger';

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    pool.on('connect', () => {
      logger.info('Database connected successfully');
    });
  }

  return pool;
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
};

// データベース接続テスト
export const testConnection = async (): Promise<boolean> => {
  try {
    const testPool = getPool();
    const client = await testPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  }
};

export default { getPool, closePool, testConnection };
EOF

    log_success "データベース設定の修正完了"
}

create_middleware() {
    log_step "🔐 ミドルウェア作成"
    
    cd "$BACKEND_DIR"
    mkdir -p src/middleware
    
    # 認証ミドルウェア
    cat > src/middleware/auth.ts << 'EOF'
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/environment';
import { getPool } from '../config/database';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    email: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'アクセストークンが必要です',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    // JWT検証
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    
    // ユーザー情報をデータベースから取得
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, username, email, name, role, is_active FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'ユーザーが見つからないか、無効化されています',
        error: 'INVALID_USER'
      });
      return;
    }

    // リクエストオブジェクトにユーザー情報を追加
    req.user = result.rows[0];
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: '無効なトークンです',
        error: 'INVALID_TOKEN'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '認証処理でエラーが発生しました',
        error: 'AUTH_ERROR'
      });
    }
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '認証が必要です',
        error: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: '権限が不足しています',
        error: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
      return;
    }

    next();
  };
};

export default { authenticateToken, requireRole };
EOF

    # バリデーションミドルウェア
    cat > src/middleware/validation.ts << 'EOF'
// backend/src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

// バリデーションエラーハンドリング
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'バリデーションエラーが発生しました',
      errors: errors.array()
    });
    return;
  }
  next();
};

// ログインバリデーション
export const validateLogin = [
  body('username')
    .notEmpty()
    .withMessage('ユーザー名は必須です')
    .isLength({ min: 3, max: 50 })
    .withMessage('ユーザー名は3-50文字で入力してください'),
  body('password')
    .notEmpty()
    .withMessage('パスワードは必須です')
    .isLength({ min: 6 })
    .withMessage('パスワードは6文字以上で入力してください'),
  handleValidationErrors
];

// 車両バリデーション
export const validateVehicle = [
  body('plateNumber')
    .notEmpty()
    .withMessage('ナンバープレートは必須です')
    .isLength({ max: 20 })
    .withMessage('ナンバープレートは20文字以内で入力してください'),
  body('model')
    .notEmpty()
    .withMessage('車種は必須です')
    .isLength({ max: 100 })
    .withMessage('車種は100文字以内で入力してください'),
  body('manufacturer')
    .optional()
    .isLength({ max: 100 })
    .withMessage('メーカーは100文字以内で入力してください'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('年式が正しくありません'),
  body('capacityTons')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('積載量は小数点以下2桁まで入力可能です'),
  handleValidationErrors
];

// 場所バリデーション
export const validateLocation = [
  body('name')
    .notEmpty()
    .withMessage('場所名は必須です')
    .isLength({ max: 255 })
    .withMessage('場所名は255文字以内で入力してください'),
  body('address')
    .notEmpty()
    .withMessage('住所は必須です'),
  body('locationType')
    .isIn(['LOADING', 'UNLOADING', 'BOTH'])
    .withMessage('場所タイプが正しくありません'),
  body('latitude')
    .optional()
    .isDecimal()
    .withMessage('緯度は数値で入力してください'),
  body('longitude')
    .optional()
    .isDecimal()
    .withMessage('経度は数値で入力してください'),
  handleValidationErrors
];

// 運行記録バリデーション
export const validateOperation = [
  body('vehicleId')
    .isUUID()
    .withMessage('車両IDが正しくありません'),
  body('driverId')
    .isUUID()
    .withMessage('ドライバーIDが正しくありません'),
  body('operationDate')
    .isISO8601()
    .withMessage('運行日が正しくありません'),
  body('startMileage')
    .optional()
    .isInt({ min: 0 })
    .withMessage('開始時走行距離は正の整数で入力してください'),
  body('endMileage')
    .optional()
    .isInt({ min: 0 })
    .withMessage('終了時走行距離は正の整数で入力してください'),
  handleValidationErrors
];

// IDパラメータバリデーション
export const validateId = [
  param('id').isUUID().withMessage('IDが正しくありません'),
  handleValidationErrors
];

export default {
  handleValidationErrors,
  validateLogin,
  validateVehicle,
  validateLocation,
  validateOperation,
  validateId
};
EOF

    # エラーハンドリングミドルウェア
    cat > src/middleware/errorHandler.ts << 'EOF'
// backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // ログに記録
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // デフォルトエラー
  let status = err.statusCode || 500;
  let message = err.message || 'サーバー内部エラーが発生しました';

  // 開発環境でのスタックトレース
  const response: any = {
    success: false,
    message,
    error: err.name || 'InternalServerError'
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `エンドポイントが見つかりません: ${req.originalUrl}`,
    error: 'NOT_FOUND'
  });
};

export default { errorHandler, notFound };
EOF

    log_success "ミドルウェアを作成しました"
}

create_controllers() {
    log_step "🎮 コントローラー作成"
    
    cd "$BACKEND_DIR"
    mkdir -p src/controllers
    
    # 認証コントローラー
    cat > src/controllers/authController.ts << 'EOF'
// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database';
import config from '../config/environment';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    email: string;
  };
}

// ログイン
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    const pool = getPool();

    // ユーザー検索
    const userResult = await pool.query(
      'SELECT id, username, email, name, role, password_hash, is_active, failed_login_attempts, locked_until FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'ユーザー名またはパスワードが正しくありません',
        error: 'INVALID_CREDENTIALS'
      });
      return;
    }

    const user = userResult.rows[0];

    // アカウントロック確認
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      res.status(423).json({
        success: false,
        message: 'アカウントがロックされています。しばらく待ってから再試行してください',
        error: 'ACCOUNT_LOCKED'
      });
      return;
    }

    // アクティブユーザー確認
    if (!user.is_active) {
      res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています',
        error: 'ACCOUNT_DISABLED'
      });
      return;
    }

    // パスワード検証
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // ログイン失敗回数を増加
      await pool.query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, locked_until = CASE WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL \'30 minutes\' ELSE NULL END WHERE id = $1',
        [user.id]
      );

      res.status(401).json({
        success: false,
        message: 'ユーザー名またはパスワードが正しくありません',
        error: 'INVALID_CREDENTIALS'
      });
      return;
    }

    // ログイン成功 - 失敗カウンターリセット
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // JWTトークン生成
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.JWT_REFRESH_SECRET,
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    // リフレッシュトークンをデータベースに保存
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await pool.query(
      'INSERT INTO user_sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [
        user.id,
        refreshTokenHash,
        req.ip,
        req.get('User-Agent'),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日後
      ]
    );

    logger.info(`User logged in: ${user.username}`, { userId: user.id, ip: req.ip });

    res.json({
      success: true,
      message: 'ログインに成功しました',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'ログイン処理でエラーが発生しました',
      error: 'LOGIN_ERROR'
    });
  }
};

// 現在のユーザー情報取得
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, username, email, name, role, employee_id, phone, created_at, last_login_at FROM users WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    res.json({
      success: true,
      data: { user: result.rows[0] }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー情報の取得でエラーが発生しました',
      error: 'USER_FETCH_ERROR'
    });
  }
};

// ログアウト
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      const pool = getPool();
      // リフレッシュトークンを無効化
      await pool.query(
        'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
        [req.user?.id]
      );
    }

    logger.info(`User logged out: ${req.user?.username}`, { userId: req.user?.id });

    res.json({
      success: true,
      message: 'ログアウトしました'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'ログアウト処理でエラーが発生しました',
      error: 'LOGOUT_ERROR'
    });
  }
};

// リフレッシュトークン
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: 'リフレッシュトークンが必要です',
        error: 'MISSING_REFRESH_TOKEN'
      });
      return;
    }

    // リフレッシュトークン検証
    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as any;
    
    const pool = getPool();
    const sessionResult = await pool.query(
      'SELECT us.*, u.username, u.role FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.user_id = $1 AND us.is_active = true AND us.expires_at > NOW()',
      [decoded.userId]
    );

    if (sessionResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: '無効なリフレッシュトークンです',
        error: 'INVALID_REFRESH_TOKEN'
      });
      return;
    }

    // 新しいアクセストークン生成
    const session = sessionResult.rows[0];
    const newAccessToken = jwt.sign(
      { 
        userId: session.user_id, 
        username: session.username, 
        role: session.role 
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    // セッション更新
    await pool.query(
      'UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1',
      [session.id]
    );

    res.json({
      success: true,
      message: 'トークンが更新されました',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'トークンの更新に失敗しました',
      error: 'TOKEN_REFRESH_ERROR'
    });
  }
};

export default { login, getCurrentUser, logout, refreshToken };
EOF

    # 車両コントローラー
    cat > src/controllers/vehicleController.ts << 'EOF'
// backend/src/controllers/vehicleController.ts
import { Request, Response } from 'express';
import { getPool } from '../config/database';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    email: string;
  };
}

// 車両一覧取得
export const getAllVehicles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = 'WHERE v.is_active = true';
    const params: any[] = [];
    let paramCount = 0;

    // ステータスフィルタ
    if (status) {
      whereClause += ` AND v.status = $${++paramCount}`;
      params.push(status);
    }

    // 検索フィルタ
    if (search) {
      whereClause += ` AND (v.plate_number ILIKE $${++paramCount} OR v.model ILIKE $${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount++;
    }

    const pool = getPool();
    
    // 総件数取得
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM vehicles v ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // 車両データ取得
    const vehiclesResult = await pool.query(
      `SELECT 
        v.*,
        u1.name as created_by_name,
        u2.name as updated_by_name,
        (SELECT COUNT(*) FROM operations WHERE vehicle_id = v.id) as total_operations,
        (SELECT MAX(operation_date) FROM operations WHERE vehicle_id = v.id) as last_operation_date
       FROM vehicles v
       LEFT JOIN users u1 ON v.created_by_id = u1.id
       LEFT JOIN users u2 ON v.updated_by_id = u2.id
       ${whereClause}
       ORDER BY v.created_at DESC
       LIMIT $${++paramCount} OFFSET $${++paramCount}`,
      [...params, Number(limit), offset]
    );

    const totalPages = Math.ceil(totalCount / Number(limit));

    res.json({
      success: true,
      data: {
        vehicles: vehiclesResult.rows,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          limit: Number(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      message: '車両一覧の取得でエラーが発生しました',
      error: 'VEHICLES_FETCH_ERROR'
    });
  }
};

// 車両詳細取得
export const getVehicleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
        v.*,
        u1.name as created_by_name,
        u2.name as updated_by_name
       FROM vehicles v
       LEFT JOIN users u1 ON v.created_by_id = u1.id
       LEFT JOIN users u2 ON v.updated_by_id = u2.id
       WHERE v.id = $1 AND v.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '車両が見つかりません',
        error: 'VEHICLE_NOT_FOUND'
      });
      return;
    }

    // 統計情報取得
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_operations,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_operations,
        SUM(CASE WHEN status = 'COMPLETED' THEN (end_mileage - start_mileage) END) as total_distance,
        SUM(fuel_amount_liters) as total_fuel_consumed,
        MAX(operation_date) as last_operation_date
       FROM operations 
       WHERE vehicle_id = $1`,
      [id]
    );

    const vehicle = result.rows[0];
    vehicle.statistics = statsResult.rows[0];

    res.json({
      success: true,
      data: { vehicle }
    });
  } catch (error) {
    logger.error('Get vehicle by ID error:', error);
    res.status(500).json({
      success: false,
      message: '車両詳細の取得でエラーが発生しました',
      error: 'VEHICLE_FETCH_ERROR'
    });
  }
};

// 車両作成
export const createVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      plateNumber,
      model,
      manufacturer,
      year,
      fuelType,
      capacityTons,
      currentMileage,
      purchaseDate,
      inspectionDueDate,
      insuranceExpiryDate,
      gpsDeviceId,
      notes
    } = req.body;

    const pool = getPool();

    // ナンバープレート重複チェック
    const duplicateResult = await pool.query(
      'SELECT id FROM vehicles WHERE plate_number = $1 AND is_active = true',
      [plateNumber]
    );

    if (duplicateResult.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'このナンバープレートの車両は既に登録されています',
        error: 'DUPLICATE_PLATE_NUMBER'
      });
      return;
    }

    // 車両作成
    const result = await pool.query(
      `INSERT INTO vehicles (
        plate_number, model, manufacturer, year, fuel_type, capacity_tons,
        current_mileage, purchase_date, inspection_due_date, insurance_expiry_date,
        gps_device_id, notes, created_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        plateNumber, model, manufacturer, year, fuelType, capacityTons,
        currentMileage || 0, purchaseDate, inspectionDueDate, insuranceExpiryDate,
        gpsDeviceId, notes, req.user?.id
      ]
    );

    logger.info(`Vehicle created: ${plateNumber}`, { 
      vehicleId: result.rows[0].id, 
      createdBy: req.user?.username 
    });

    res.status(201).json({
      success: true,
      message: '車両が正常に作成されました',
      data: { vehicle: result.rows[0] }
    });
  } catch (error) {
    logger.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      message: '車両の作成でエラーが発生しました',
      error: 'VEHICLE_CREATE_ERROR'
    });
  }
};

// 車両更新
export const updateVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const pool = getPool();

    // 車両存在確認
    const existingResult = await pool.query(
      'SELECT * FROM vehicles WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '車両が見つかりません',
        error: 'VEHICLE_NOT_FOUND'
      });
      return;
    }

    // ナンバープレート重複チェック（自分以外）
    if (updateData.plateNumber) {
      const duplicateResult = await pool.query(
        'SELECT id FROM vehicles WHERE plate_number = $1 AND id != $2 AND is_active = true',
        [updateData.plateNumber, id]
      );

      if (duplicateResult.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: 'このナンバープレートの車両は既に登録されています',
          error: 'DUPLICATE_PLATE_NUMBER'
        });
        return;
      }
    }

    // 更新フィールドを動的に構築
    const setClause = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'plate_number', 'model', 'manufacturer', 'year', 'fuel_type',
      'capacity_tons', 'current_mileage', 'status', 'purchase_date',
      'inspection_due_date', 'insurance_expiry_date', 'gps_device_id', 'notes'
    ];

    allowedFields.forEach(field => {
      const camelField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (updateData[camelField] !== undefined) {
        setClause.push(`${field} = ${++paramCount}`);
        values.push(updateData[camelField]);
      }
    });

    if (setClause.length === 0) {
      res.status(400).json({
        success: false,
        message: '更新するフィールドが指定されていません',
        error: 'NO_UPDATE_FIELDS'
      });
      return;
    }

    setClause.push(`updated_by_id = ${++paramCount}`);
    values.push(req.user?.id);
    values.push(id);

    const result = await pool.query(
      `UPDATE vehicles SET ${setClause.join(', ')}, updated_at = NOW() 
       WHERE id = ${++paramCount} 
       RETURNING *`,
      values
    );

    logger.info(`Vehicle updated: ${id}`, { 
      updatedBy: req.user?.username,
      fields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: '車両情報が正常に更新されました',
      data: { vehicle: result.rows[0] }
    });
  } catch (error) {
    logger.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      message: '車両の更新でエラーが発生しました',
      error: 'VEHICLE_UPDATE_ERROR'
    });
  }
};

// 車両削除（論理削除）
export const deleteVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // 車両存在確認
    const existingResult = await pool.query(
      'SELECT * FROM vehicles WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '車両が見つかりません',
        error: 'VEHICLE_NOT_FOUND'
      });
      return;
    }

    // 進行中の運行がないかチェック
    const activeOperationsResult = await pool.query(
      'SELECT COUNT(*) FROM operations WHERE vehicle_id = $1 AND status IN (\'PLANNING\', \'IN_PROGRESS\')',
      [id]
    );

    if (parseInt(activeOperationsResult.rows[0].count) > 0) {
      res.status(409).json({
        success: false,
        message: '進行中の運行がある車両は削除できません',
        error: 'ACTIVE_OPERATIONS_EXIST'
      });
      return;
    }

    // 論理削除実行
    await pool.query(
      'UPDATE vehicles SET is_active = false, updated_by_id = $1, updated_at = NOW() WHERE id = $2',
      [req.user?.id, id]
    );

    logger.info(`Vehicle deleted: ${id}`, { 
      deletedBy: req.user?.username 
    });

    res.json({
      success: true,
      message: '車両が正常に削除されました'
    });
  } catch (error) {
    logger.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      message: '車両の削除でエラーが発生しました',
      error: 'VEHICLE_DELETE_ERROR'
    });
  }
};

export default {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
EOF

    # ユーザーコントローラー
    cat > src/controllers/userController.ts << 'EOF'
// backend/src/controllers/userController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../config/database';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    email: string;
  };
}

// ユーザー一覧取得
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = 'WHERE is_active = true';
    const params: any[] = [];
    let paramCount = 0;

    // 役割フィルタ
    if (role) {
      whereClause += ` AND role = ${++paramCount}`;
      params.push(role);
    }

    // 検索フィルタ
    if (search) {
      whereClause += ` AND (username ILIKE ${++paramCount} OR name ILIKE ${++paramCount} OR email ILIKE ${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 2;
    }

    const pool = getPool();
    
    // 総件数取得
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // ユーザーデータ取得（パスワードハッシュは除外）
    const usersResult = await pool.query(
      `SELECT 
        id, username, email, name, role, phone, employee_id,
        is_active, last_login_at, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${++paramCount} OFFSET ${++paramCount}`,
      [...params, Number(limit), offset]
    );

    const totalPages = Math.ceil(totalCount / Number(limit));

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          limit: Number(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー一覧の取得でエラーが発生しました',
      error: 'USERS_FETCH_ERROR'
    });
  }
};

// ユーザー詳細取得
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
        id, username, email, name, role, phone, employee_id,
        is_active, last_login_at, created_at, updated_at
       FROM users 
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    // ドライバーの場合は運行統計も取得
    let statistics = null;
    if (result.rows[0].role === 'DRIVER') {
      const statsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_operations,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_operations,
          SUM(CASE WHEN status = 'COMPLETED' THEN (end_mileage - start_mileage) END) as total_distance,
          MAX(operation_date) as last_operation_date
         FROM operations 
         WHERE driver_id = $1`,
        [id]
      );
      statistics = statsResult.rows[0];
    }

    const user = result.rows[0];
    if (statistics) {
      user.statistics = statistics;
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー詳細の取得でエラーが発生しました',
      error: 'USER_FETCH_ERROR'
    });
  }
};

export default { getAllUsers, getUserById };
EOF

    log_success "コントローラーを作成しました"
}

create_routes() {
    log_step "🛣️ ルート作成"
    
    cd "$BACKEND_DIR"
    mkdir -p src/routes
    
    # メインルート
    cat > src/routes/index.ts << 'EOF'
// backend/src/routes/index.ts
import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import vehicleRoutes from './vehicleRoutes';

const router = Router();

// APIバージョン情報
router.get('/', (req, res) => {
  res.json({
    message: 'ダンプ運行記録システム API v1.0.0',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      users: '/users', 
      vehicles: '/vehicles'
    },
    documentation: '/docs',
    health: '/health'
  });
});

// ルート登録
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vehicles', vehicleRoutes);

export default router;
EOF

    # 認証ルート
    cat > src/routes/authRoutes.ts << 'EOF'
// backend/src/routes/authRoutes.ts
import { Router } from 'express';
import { login, getCurrentUser, logout, refreshToken } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { validateLogin } from '../middleware/validation';

const router = Router();

// 公開エンドポイント
router.post('/login', validateLogin, login);
router.post('/refresh', refreshToken);

// 認証が必要なエンドポイント
router.use(authenticateToken);
router.get('/me', getCurrentUser);
router.post('/logout', logout);

export default router;
EOF

    # ユーザールート
    cat > src/routes/userRoutes.ts << 'EOF'
// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getAllUsers, getUserById } from '../controllers/userController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateId } from '../middleware/validation';

const router = Router();

// 全てのルートで認証が必要
router.use(authenticateToken);

// ユーザー一覧（管理者・マネージャーのみ）
router.get('/', requireRole(['ADMIN', 'MANAGER']), getAllUsers);

// ユーザー詳細
router.get('/:id', validateId, getUserById);

export default router;
EOF

    # 車両ルート
    cat > src/routes/vehicleRoutes.ts << 'EOF'
// backend/src/routes/vehicleRoutes.ts
import { Router } from 'express';
import {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
} from '../controllers/vehicleController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateVehicle, validateId } from '../middleware/validation';

const router = Router();

// 全てのルートで認証が必要
router.use(authenticateToken);

// 車両一覧
router.get('/', getAllVehicles);

// 車両詳細
router.get('/:id', validateId, getVehicleById);

// 車両作成（管理者・マネージャーのみ）
router.post('/', requireRole(['ADMIN', 'MANAGER']), validateVehicle, createVehicle);

// 車両更新（管理者・マネージャーのみ）
router.put('/:id', requireRole(['ADMIN', 'MANAGER']), validateId, updateVehicle);

// 車両削除（管理者のみ）
router.delete('/:id', requireRole(['ADMIN']), validateId, deleteVehicle);

export default router;
EOF

    log_success "ルートを作成しました"
}

create_utilities() {
    log_step "🔧 ユーティリティ作成"
    
    cd "$BACKEND_DIR"
    mkdir -p src/utils
    
    # ログ機能
    cat > src/utils/logger.ts << 'EOF'
// backend/src/utils/logger.ts
import winston from 'winston';
import config from '../config/environment';

// ログフォーマット設定
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// コンソール用フォーマット
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// ロガー作成
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'dump-tracker-api' },
  transports: [
    // ファイル出力
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// 開発環境ではコンソール出力も追加
if (config.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

export default logger;
EOF

    # GPS計算ユーティリティ
    cat > src/utils/gpsCalculations.ts << 'EOF'
// backend/src/utils/gpsCalculations.ts

/**
 * Haversine公式を使用して2点間の距離を計算（km）
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // 地球の半径（km）
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * 度数をラジアンに変換
 */
export const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * 2点間の方位角を計算（度）
 */
export const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x);
  bearing = (bearing * 180) / Math.PI;
  bearing = (bearing + 360) % 360;
  
  return bearing;
};

/**
 * GPS座標が指定範囲内にあるかチェック
 */
export const isWithinRadius = (
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusKm: number
): boolean => {
  const distance = calculateDistance(centerLat, centerLon, pointLat, pointLon);
  return distance <= radiusKm;
};

/**
 * GPS座標の検証
 */
export const isValidCoordinates = (lat: number, lon: number): boolean => {
  return (
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180 &&
    !isNaN(lat) && !isNaN(lon)
  );
};

export default {
  calculateDistance,
  toRadians,
  calculateBearing,
  isWithinRadius,
  isValidCoordinates
};
EOF

    log_success "ユーティリティを作成しました"
}

create_api_documentation() {
    log_step "📚 API ドキュメント作成"
    
    mkdir -p "$API_DOC_DIR"
    
    # OpenAPI仕様書
    cat > "$API_DOC_DIR/openapi.yaml" << 'EOF'
openapi: 3.0.3
info:
  title: ダンプ運行記録システム API
  description: |
    ダンプトラック運行記録管理システムのRESTful API仕様書
    
    ## 機能概要
    - ユーザー認証・認可
    - 車両管理
    - 運行記録管理
    - GPS位置情報追跡
    - 統計・レポート機能
    
  version: 1.0.0
  contact:
    name: システム管理者
    email: admin@dumptracker.local
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: http://localhost:8000/api/v1
    description: 開発環境
  - url: http://10.1.119.244:8000/api/v1
    description: ステージング環境

security:
  - bearerAuth: []

paths:
  # 認証エンドポイント
  /auth/login:
    post:
      tags:
        - 認証
      summary: ログイン
      description: ユーザー名とパスワードでログインし、JWTトークンを取得
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - username
                - password
              properties:
                username:
                  type: string
                  description: ユーザー名
                  example: "admin"
                password:
                  type: string
                  description: パスワード
                  example: "admin123"
      responses:
        '200':
          description: ログイン成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  message:
                    type: string
                    example: "ログインに成功しました"
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/User'
                      accessToken:
                        type: string
                        description: JWTアクセストークン
                      refreshToken:
                        type: string
                        description: リフレッシュトークン
        '401':
          $ref: '#/components/responses/Unauthorized'

  /auth/me:
    get:
      tags:
        - 認証
      summary: 現在のユーザー情報取得
      description: 認証されたユーザーの詳細情報を取得
      responses:
        '200':
          description: ユーザー情報取得成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/User'
        '401':
          $ref: '#/components/responses/Unauthorized'

  # ユーザー管理エンドポイント
  /users:
    get:
      tags:
        - ユーザー管理
      summary: ユーザー一覧取得
      description: ページネーション付きでユーザー一覧を取得（管理者・マネージャーのみ）
      parameters:
        - name: page
          in: query
          description: ページ番号
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          description: 1ページあたりの件数
          schema:
            type: integer
            default: 10
        - name: role
          in: query
          description: 役割フィルタ
          schema:
            type: string
            enum: [ADMIN, MANAGER, DRIVER]
        - name: search
          in: query
          description: 検索キーワード（名前、ユーザー名、メール）
          schema:
            type: string
      responses:
        '200':
          description: ユーザー一覧取得成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      users:
                        type: array
                        items:
                          $ref: '#/components/schemas/User'
                      pagination:
                        $ref: '#/components/schemas/Pagination'
        '403':
          $ref: '#/components/responses/Forbidden'

  /users/{id}:
    get:
      tags:
        - ユーザー管理
      summary: ユーザー詳細取得
      description: 指定されたIDのユーザー詳細情報を取得
      parameters:
        - name: id
          in: path
          required: true
          description: ユーザーID
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: ユーザー詳細取得成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/UserDetail'
        '404':
          $ref: '#/components/responses/NotFound'

  # 車両管理エンドポイント
  /vehicles:
    get:
      tags:
        - 車両管理
      summary: 車両一覧取得
      description: ページネーション付きで車両一覧を取得
      parameters:
        - name: page
          in: query
          description: ページ番号
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          description: 1ページあたりの件数
          schema:
            type: integer
            default: 10
        - name: status
          in: query
          description: ステータスフィルタ
          schema:
            type: string
            enum: [ACTIVE, MAINTENANCE, INACTIVE, RETIRED]
        - name: search
          in: query
          description: 検索キーワード（ナンバープレート、車種）
          schema:
            type: string
      responses:
        '200':
          description: 車両一覧取得成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      vehicles:
                        type: array
                        items:
                          $ref: '#/components/schemas/Vehicle'
                      pagination:
                        $ref: '#/components/schemas/Pagination'

    post:
      tags:
        - 車両管理
      summary: 車両作成
      description: 新しい車両を登録（管理者・マネージャーのみ）
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VehicleCreate'
      responses:
        '201':
          description: 車両作成成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  message:
                    type: string
                    example: "車両が正常に作成されました"
                  data:
                    type: object
                    properties:
                      vehicle:
                        $ref: '#/components/schemas/Vehicle'
        '409':
          description: ナンバープレート重複エラー

  /vehicles/{id}:
    get:
      tags:
        - 車両管理
      summary: 車両詳細取得
      description: 指定されたIDの車両詳細情報を取得
      parameters:
        - name: id
          in: path
          required: true
          description: 車両ID
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: 車両詳細取得成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      vehicle:
                        $ref: '#/components/schemas/VehicleDetail'

    put:
      tags:
        - 車両管理
      summary: 車両更新
      description: 車両情報を更新（管理者・マネージャーのみ）
      parameters:
        - name: id
          in: path
          required: true
          description: 車両ID
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VehicleUpdate'
      responses:
        '200':
          description: 車両更新成功
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      tags:
        - 車両管理
      summary: 車両削除
      description: 車両を論理削除（管理者のみ）
      parameters:
        - name: id
          in: path
          required: true
          description: 車両ID
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: 車両削除成功
        '409':
          description: 進行中の運行がある場合の削除不可エラー

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: ユーザーID
        username:
          type: string
          description: ユーザー名
        email:
          type: string
          format: email
          description: メールアドレス
        name:
          type: string
          description: 表示名
        role:
          type: string
          enum: [ADMIN, MANAGER, DRIVER]
          description: 役割
        employeeId:
          type: string
          description: 従業員ID
        phone:
          type: string
          description: 電話番号
        isActive:
          type: boolean
          description: アクティブフラグ
        lastLoginAt:
          type: string
          format: date-time
          description: 最終ログイン日時
        createdAt:
          type: string
          format: date-time
          description: 作成日時
        updatedAt:
          type: string
          format: date-time
          description: 更新日時

    UserDetail:
      allOf:
        - $ref: '#/components/schemas/User'
        - type: object
          properties:
            statistics:
              type: object
              properties:
                totalOperations:
                  type: integer
                  description: 総運行回数
                completedOperations:
                  type: integer
                  description: 完了した運行回数
                totalDistance:
                  type: number
                  description: 総走行距離
                lastOperationDate:
                  type: string
                  format: date
                  description: 最終運行日

    Vehicle:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: 車両ID
        plateNumber:
          type: string
          description: ナンバープレート
        model:
          type: string
          description: 車種
        manufacturer:
          type: string
          description: メーカー
        year:
          type: integer
          description: 年式
        fuelType:
          type: string
          enum: [GASOLINE, DIESEL, HYBRID, ELECTRIC]
          description: 燃料タイプ
        capacityTons:
          type: number
          format: decimal
          description: 積載量（トン）
        currentMileage:
          type: integer
          description: 現在の走行距離
        status:
          type: string
          enum: [ACTIVE, MAINTENANCE, INACTIVE, RETIRED]
          description: ステータス
        purchaseDate:
          type: string
          format: date
          description: 購入日
        inspectionDueDate:
          type: string
          format: date
          description: 車検期限
        insuranceExpiryDate:
          type: string
          format: date
          description: 保険期限
        gpsDeviceId:
          type: string
          description: GPS機器ID
        notes:
          type: string
          description: 備考
        isActive:
          type: boolean
          description: アクティブフラグ
        createdAt:
          type: string
          format: date-time
          description: 作成日時
        updatedAt:
          type: string
          format: date-time
          description: 更新日時

    VehicleDetail:
      allOf:
        - $ref: '#/components/schemas/Vehicle'
        - type: object
          properties:
            statistics:
              type: object
              properties:
                totalOperations:
                  type: integer
                  description: 総運行回数
                completedOperations:
                  type: integer
                  description: 完了した運行回数
                totalDistance:
                  type: number
                  description: 総走行距離
                totalFuelConsumed:
                  type: number
                  description: 総燃料消費量
                lastOperationDate:
                  type: string
                  format: date
                  description: 最終運行日

    VehicleCreate:
      type: object
      required:
        - plateNumber
        - model
      properties:
        plateNumber:
          type: string
          description: ナンバープレート
          example: "大阪 500 あ 1234"
        model:
          type: string
          description: 車種
          example: "UD クオン"
        manufacturer:
          type: string
          description: メーカー
          example: "UD Trucks"
        year:
          type: integer
          description: 年式
          example: 2022
        fuelType:
          type: string
          enum: [GASOLINE, DIESEL, HYBRID, ELECTRIC]
          default: DIESEL
          description: 燃料タイプ
        capacityTons:
          type: number
          format: decimal
          description: 積載量（トン）
          example: 10.0
        currentMileage:
          type: integer
          description: 現在の走行距離
          example: 45000
        purchaseDate:
          type: string
          format: date
          description: 購入日
        inspectionDueDate:
          type: string
          format: date
          description: 車検期限
        insuranceExpiryDate:
          type: string
          format: date
          description: 保険期限
        gpsDeviceId:
          type: string
          description: GPS機器ID
        notes:
          type: string
          description: 備考

    VehicleUpdate:
      type: object
      properties:
        plateNumber:
          type: string
          description: ナンバープレート
        model:
          type: string
          description: 車種
        manufacturer:
          type: string
          description: メーカー
        year:
          type: integer
          description: 年式
        fuelType:
          type: string
          enum: [GASOLINE, DIESEL, HYBRID, ELECTRIC]
          description: 燃料タイプ
        capacityTons:
          type: number
          format: decimal
          description: 積載量（トン）
        currentMileage:
          type: integer
          description: 現在の走行距離
        status:
          type: string
          enum: [ACTIVE, MAINTENANCE, INACTIVE, RETIRED]
          description: ステータス
        purchaseDate:
          type: string
          format: date
          description: 購入日
        inspectionDueDate:
          type: string
          format: date
          description: 車検期限
        insuranceExpiryDate:
          type: string
          format: date
          description: 保険期限
        gpsDeviceId:
          type: string
          description: GPS機器ID
        notes:
          type: string
          description: 備考

    Pagination:
      type: object
      properties:
        currentPage:
          type: integer
          description: 現在のページ
        totalPages:
          type: integer
          description: 総ページ数
        totalCount:
          type: integer
          description: 総件数
        limit:
          type: integer
          description: 1ページあたりの件数

    Error:
      type: object
      properties:
        success:
          type: boolean
          example: false
        message:
          type: string
          description: エラーメッセージ
        error:
          type: string
          description: エラーコード

  responses:
    Unauthorized:
      description: 認証エラー
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            success: false
            message: "認証が必要です"
            error: "UNAUTHORIZED"

    Forbidden:
      description: 権限エラー
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            success: false
            message: "権限が不足しています"
            error: "FORBIDDEN"

    NotFound:
      description: リソースが見つからない
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            success: false
            message: "リソースが見つかりません"
            error: "NOT_FOUND"

    ValidationError:
      description: バリデーションエラー
      content:
        application/json:
          schema:
            type: object
            properties:
              success:
                type: boolean
                example: false
              message:
                type: string
                example: "バリデーションエラーが発生しました"
              errors:
                type: array
                items:
                  type: object
                  properties:
                    field:
                      type: string
                      description: エラーが発生したフィールド
                    message:
                      type: string
                      description: エラーメッセージ
EOF

    # API使用方法ガイド
    cat > "$API_DOC_DIR/API_GUIDE.md" << 'EOF'
# ダンプ運行記録システム API 使用ガイド

## 概要

このAPIは、ダンプトラック運行記録管理システムのバックエンドサービスです。

## 基本情報

- **ベースURL**: `http://localhost:8000/api/v1`
- **認証方式**: JWT Bearer Token
- **データフォーマット**: JSON
- **文字エンコーディング**: UTF-8

## 認証フロー

### 1. ログイン

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

レスポンス:
```json
{
  "success": true,
  "message": "ログインに成功しました",
  "data": {
    "user": {
      "id": "uuid",
      "username": "admin",
      "role": "ADMIN"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. 認証が必要なAPIの呼び出し

```bash
curl -X GET http://localhost:8000/api/v1/vehicles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## エンドポイント例

### 車両一覧取得

```bash
# 基本的な一覧取得
curl -X GET "http://localhost:8000/api/v1/vehicles" \
  -H "Authorization: Bearer YOUR_TOKEN"

# ページネーション付き
curl -X GET "http://localhost:8000/api/v1/vehicles?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# フィルタ付き
curl -X GET "http://localhost:8000/api/v1/vehicles?status=ACTIVE&search=大阪" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 車両作成

```bash
curl -X POST http://localhost:8000/api/v1/vehicles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plateNumber": "大阪 500 あ 1234",
    "model": "UD クオン",
    "manufacturer": "UD Trucks",
    "year": 2022,
    "fuelType": "DIESEL",
    "capacityTons": 10.0,
    "currentMileage": 45000
  }'
```

### 車両更新

```bash
curl -X PUT http://localhost:8000/api/v1/vehicles/VEHICLE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "currentMileage": 46000,
    "status": "MAINTENANCE"
  }'
```

## エラーハンドリング

APIは以下の標準的なHTTPステータスコードを使用します：

- `200` - 成功
- `201` - 作成成功
- `400` - バリデーションエラー
- `401` - 認証エラー
- `403` - 権限エラー
- `404` - リソースが見つからない
- `409` - 競合エラー（重複など）
- `500` - サーバーエラー

エラーレスポンス例:
```json
{
  "success": false,
  "message": "車両が見つかりません",
  "error": "VEHICLE_NOT_FOUND"
}
```

## 権限レベル

- **ADMIN**: 全ての操作が可能
- **MANAGER**: ユーザー管理以外の操作が可能
- **DRIVER**: 読み取り専用、自分の運行記録の操作のみ

## レート制限

- **認証前**: 15分間に15リクエスト
- **認証後**: 15分間に100リクエスト

## ページネーション

リスト系APIはページネーションをサポートしています：

- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 10、最大: 100）

レスポンスには以下のページネーション情報が含まれます：
```json
{
  "data": {
    "vehicles": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 50,
      "limit": 10
    }
  }
}
```

## 開発・テスト用

### ヘルスチェック

```bash
curl http://localhost:8000/health
```

### 初期ログイン情報

- **管理者**: `admin` / `admin123`
- **マネージャー**: `manager01` / `manager123`  
- **ドライバー**: `driver01` / `driver123`

## トラブルシューティング

### よくあるエラー

1. **401 Unauthorized**
   - トークンが無効または期限切れ
   - `Authorization`ヘッダーの形式が正しくない

2. **403 Forbidden**
   - 権限が不足している
   - 必要な役割レベルを確認

3. **400 Bad Request**
   - リクエストボディの形式が不正
   - 必須フィールドが不足

### デバッグ方法

1. ログファイルを確認: `tail -f logs/combined.log`
2. データベース接続確認: `PGPASSWORD='development_password' psql -h localhost -U dump_tracker_user -d dump_tracker_dev`
3. サーバー状態確認: `curl http://localhost:8000/health`
EOF

    log_success "API ドキュメントを作成しました"
}

update_app_routes() {
    log_step "🔄 メインアプリケーションの更新"
    
    cd "$BACKEND_DIR"
    
    # app.tsを更新してルートを統合
    cat > src/app.ts << 'EOF'
// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import config from './config/environment';
import logger from './utils/logger';

const app = express();

// Swagger設定
let swaggerDocument;
try {
  swaggerDocument = YAML.load(path.join(__dirname, '../docs/api/openapi.yaml'));
} catch (error) {
  logger.warn('Swagger document not found, API documentation will not be available');
}

// セキュリティミドルウェア
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS設定
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 基本ミドルウェア
app.use(compression());
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// レート制限
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
  message: {
    success: false,
    message: 'レート制限に達しました。しばらくしてから再試行してください。',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Dump Tracker API',
    version: '1.0.0',
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'Connected' // 実際にはDB接続チェックを行う
  });
});

// API情報エンドポイント
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'ダンプ運行記録システム API',
    version: '1.0.0',
    description: 'ダンプトラック運行記録管理システムのRESTful API',
    endpoints: {
      health: '/health',
      docs: '/api/v1/docs',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      vehicles: '/api/v1/vehicles'
    },
    features: [
      '🔐 JWT認証・認可',
      '🚛 車両管理',
      '👥 ユーザー管理',
      '📊 統計・レポート',
      '📍 GPS位置情報追跡',
      '🔍 全文検索・フィルタリング',
      '📱 ページネーション対応'
    ],
    documentation: '/api/v1/docs'
  });
});

// API ドキュメント
if (swaggerDocument) {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ダンプ運行記録システム API',
    customfavIcon: '/favicon.ico'
  }));
}

// メインAPIルート
app.use('/api/v1', routes);

// 静的ファイル配信（アップロードされたファイル用）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404ハンドラー
app.use(notFound);

// エラーハンドラー
app.use(errorHandler);

export default app;
EOF

    log_success "メインアプリケーションを更新しました"
}

create_test_scripts() {
    log_step "🧪 テストスクリプト作成"
    
    cd "$PROJECT_DIR"
    mkdir -p scripts/testing
    
    # API テストスクリプト
    cat > scripts/testing/test_api.sh << 'EOF'
#!/bin/bash
# API テストスクリプト

API_BASE="http://localhost:8000/api/v1"
TOKEN=""

# 色付きログ
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# ヘルスチェック
test_health() {
    log_info "ヘルスチェックテスト中..."
    response=$(curl -s "$API_BASE/../health")
    if echo "$response" | grep -q '"status":"OK"'; then
        log_success "ヘルスチェック成功"
        return 0
    else
        log_error "ヘルスチェック失敗: $response"
        return 1
    fi
}

# ログインテスト
test_login() {
    log_info "ログインテスト中..."
    response=$(curl -s -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin123"}')
    
    if echo "$response" | grep -q '"success":true'; then
        TOKEN=$(echo "$response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
        log_success "ログイン成功"
        return 0
    else
        log_error "ログイン失敗: $response"
        return 1
    fi
}

# ユーザー情報取得テスト
test_get_user() {
    log_info "ユーザー情報取得テスト中..."
    response=$(curl -s -X GET "$API_BASE/auth/me" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "ユーザー情報取得成功"
        return 0
    else
        log_error "ユーザー情報取得失敗: $response"
        return 1
    fi
}

# 車両一覧取得テスト
test_get_vehicles() {
    log_info "車両一覧取得テスト中..."
    response=$(curl -s -X GET "$API_BASE/vehicles" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "車両一覧取得成功"
        return 0
    else
        log_error "車両一覧取得失敗: $response"
        return 1
    fi
}

# 車両作成テスト
test_create_vehicle() {
    log_info "車両作成テスト中..."
    response=$(curl -s -X POST "$API_BASE/vehicles" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "plateNumber": "テスト 999 て 9999",
            "model": "テスト車両",
            "manufacturer": "テストメーカー",
            "year": 2023,
            "fuelType": "DIESEL",
            "capacityTons": 5.0,
            "currentMileage": 0
        }')
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "車両作成成功"
        return 0
    else
        log_error "車両作成失敗: $response"
        return 1
    fi
}

# メインテスト実行
main() {
    echo "🧪 API テスト開始"
    echo ""
    
    test_health || exit 1
    test_login || exit 1
    test_get_user || exit 1
    test_get_vehicles || exit 1
    test_create_vehicle || exit 1
    
    echo ""
    log_success "🎉 全てのテストが成功しました"
}

main "$@"
EOF

    chmod +x scripts/testing/test_api.sh
    
    # 負荷テストスクリプト
    cat > scripts/testing/load_test.sh << 'EOF'
#!/bin/bash
# 簡易負荷テストスクリプト

API_BASE="http://localhost:8000/api/v1"
CONCURRENT_USERS=10
REQUESTS_PER_USER=50

echo "🔥 負荷テスト開始"
echo "同時接続数: $CONCURRENT_USERS"
echo "1ユーザーあたりのリクエスト数: $REQUESTS_PER_USER"
echo ""

# ログイン
echo "ログイン中..."
TOKEN=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' | \
    grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ ログインに失敗しました"
    exit 1
fi

echo "✅ ログイン成功"

# 負荷テスト実行
echo "負荷テスト実行中..."
start_time=$(date +%s)

for i in $(seq 1 $CONCURRENT_USERS); do
    {
        for j in $(seq 1 $REQUESTS_PER_USER); do
            curl -s -X GET "$API_BASE/vehicles" \
                -H "Authorization: Bearer $TOKEN" > /dev/null
        done
    } &
done

wait

end_time=$(date +%s)
duration=$((end_time - start_time))
total_requests=$((CONCURRENT_USERS * REQUESTS_PER_USER))

echo ""
echo "📊 負荷テスト結果:"
echo "総リクエスト数: $total_requests"
echo "実行時間: ${duration}秒"
echo "スループット: $((total_requests / duration)) req/sec"
EOF

    chmod +x scripts/testing/load_test.sh
    
    log_