#!/bin/bash
# =====================================
# source_only_typecheck.sh
# ソースファイル限定TypeScriptチェック
# 生成ファイル・テストファイル除外版
# =====================================

set -e

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# =====================================
# パス設定
# =====================================

CURRENT_DIR="$(pwd)"

if [[ "$CURRENT_DIR" == */backend ]]; then
    BACKEND_DIR="$CURRENT_DIR"
    PROJECT_ROOT="$(dirname "$CURRENT_DIR")"
elif [[ -d "$CURRENT_DIR/backend" ]]; then
    PROJECT_ROOT="$CURRENT_DIR"
    BACKEND_DIR="$PROJECT_ROOT/backend"
else
    log_error "プロジェクトルートまたはbackendディレクトリで実行してください"
    exit 1
fi

SRC_DIR="$BACKEND_DIR/src"
REPORT_DIR="$BACKEND_DIR/.typecheck_reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/source_only_report_$TIMESTAMP.md"

# オプション解析
VERBOSE_MODE=false
QUICK_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose) VERBOSE_MODE=true; shift ;;
        -q|--quick) QUICK_MODE=true; shift ;;
        -h|--help)
            echo "使用方法: $0 [OPTIONS]"
            echo "オプション:"
            echo "  -v, --verbose  詳細ログを表示"
            echo "  -q, --quick    簡易チェックのみ"
            echo "  -h, --help     このヘルプを表示"
            exit 0
            ;;
        *) log_error "不明なオプション: $1"; exit 1 ;;
    esac
done

# =====================================
# ソースファイル限定リスト生成
# =====================================

generate_source_file_list() {
    log_info "ソースファイル検索中（生成ファイル除外）..."
    
    mkdir -p "$REPORT_DIR"
    
    # 実際のソースファイルのみを抽出
    find "$SRC_DIR" -name "*.ts" -type f \
        ! -path "*/generated/*" \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/.prisma/*" \
        ! -name "*.test.ts" \
        ! -name "*.spec.ts" \
        ! -name "*.d.ts" \
        | sort > "$REPORT_DIR/source_files.txt"
    
    local file_count=$(wc -l < "$REPORT_DIR/source_files.txt")
    log_success "ソースファイル $file_count 個を検出"
    
    # カテゴリ別ファイル数表示
    echo "カテゴリ別ファイル数:"
    echo "  Controllers: $(grep -c "/controllers/" "$REPORT_DIR/source_files.txt" || echo 0)"
    echo "  Models:      $(grep -c "/models/" "$REPORT_DIR/source_files.txt" || echo 0)"
    echo "  Services:    $(grep -c "/services/" "$REPORT_DIR/source_files.txt" || echo 0)"
    echo "  Routes:      $(grep -c "/routes/" "$REPORT_DIR/source_files.txt" || echo 0)"
    echo "  Utils:       $(grep -c "/utils/" "$REPORT_DIR/source_files.txt" || echo 0)"
    echo "  Types:       $(grep -c "/types/" "$REPORT_DIR/source_files.txt" || echo 0)"
    echo "  Middleware:  $(grep -c "/middleware/" "$REPORT_DIR/source_files.txt" || echo 0)"
    echo "  Config:      $(grep -c "/config/" "$REPORT_DIR/source_files.txt" || echo 0)"
    echo "  その他:      $(grep -v -E "(controllers|models|services|routes|utils|types|middleware|config)/" "$REPORT_DIR/source_files.txt" | wc -l)"
    
    return $file_count
}

# =====================================
# ディレクトリ別チェック
# =====================================

check_by_category() {
    log_info "カテゴリ別TypeScriptチェック開始..."
    
    cd "$BACKEND_DIR"
    
    # カテゴリ定義
    local categories=(
        "controllers:コントローラー"
        "models:モデル"
        "services:サービス" 
        "routes:ルート"
        "utils:ユーティリティ"
        "types:型定義"
        "middleware:ミドルウェア"
        "config:設定"
    )
    
    local total_errors=0
    local total_success=0
    
    echo "# カテゴリ別TypeScriptチェック結果" > "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "実行日時: $(date)" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    for category_info in "${categories[@]}"; do
        IFS=':' read -r category_name category_display <<< "$category_info"
        
        # カテゴリのファイル取得
        local category_files=$(grep "/$category_name/" "$REPORT_DIR/source_files.txt" || true)
        local file_count=$(echo "$category_files" | grep -v '^$' | wc -l)
        
        if [ "$file_count" -eq 0 ]; then
            continue
        fi
        
        echo ""
        log_info "=== $category_display ($file_count ファイル) ==="
        
        local category_success=0
        local category_errors=0
        
        echo "## $category_display" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        
        while IFS= read -r file; do
            if [ -z "$file" ]; then continue; fi
            
            local filename=$(basename "$file")
            local relative_path=$(echo "$file" | sed "s|$PROJECT_ROOT/||")
            
            printf "  チェック中: %-30s " "$filename"
            
            if npx tsc --noEmit --skipLibCheck "$file" 2> "$REPORT_DIR/temp_error.log"; then
                echo -e "${GREEN}OK${NC}"
                ((category_success++))
                ((total_success++))
                
                if [ "$VERBOSE_MODE" = true ]; then
                    echo "### ✅ $relative_path" >> "$REPORT_FILE"
                    echo "ステータス: 成功" >> "$REPORT_FILE"
                    echo "" >> "$REPORT_FILE"
                fi
            else
                echo -e "${RED}エラー${NC}"
                ((category_errors++))
                ((total_errors++))
                
                echo "### ❌ $relative_path" >> "$REPORT_FILE"
                echo "ステータス: エラー" >> "$REPORT_FILE"
                echo "" >> "$REPORT_FILE"
                echo "\`\`\`" >> "$REPORT_FILE"
                cat "$REPORT_DIR/temp_error.log" >> "$REPORT_FILE"
                echo "\`\`\`" >> "$REPORT_FILE"
                echo "" >> "$REPORT_FILE"
                
                # エラー概要表示
                if [ "$VERBOSE_MODE" = true ]; then
                    echo "    エラー詳細:"
                    head -3 "$REPORT_DIR/temp_error.log" | sed 's/^/      /'
                fi
            fi
            
        done <<< "$category_files"
        
        # カテゴリサマリー
        if [ "$category_errors" -eq 0 ]; then
            log_success "$category_display: 全 $file_count ファイル成功"
        else
            log_warning "$category_display: $category_errors/$file_count ファイルでエラー"
        fi
    done
    
    return $total_errors
}

# =====================================
# 全体チェック（簡易版）
# =====================================

check_all_source_files() {
    if [ "$QUICK_MODE" = true ]; then
        log_info "簡易モード: 全体チェックのみ実行"
        cd "$BACKEND_DIR"
        
        echo ""
        log_info "=== 全ソースファイル一括チェック ==="
        
        local all_files=$(tr '\n' ' ' < "$REPORT_DIR/source_files.txt")
        
        if npx tsc --noEmit --skipLibCheck $all_files 2> "$REPORT_DIR/all_errors.log"; then
            log_success "全ソースファイルチェック成功"
            return 0
        else
            log_error "全ソースファイルチェックでエラー検出"
            echo ""
            echo "エラー詳細（最初の10行）:"
            head -10 "$REPORT_DIR/all_errors.log"
            return 1
        fi
    fi
    
    return 0
}

# =====================================
# 特定ファイルの詳細チェック
# =====================================

check_specific_files() {
    if [ "$VERBOSE_MODE" = true ]; then
        log_info "重要ファイルの詳細チェック..."
        
        # 特に重要なファイル
        local important_files=(
            "src/models/AuditLogModel.ts"
            "src/app.ts"
            "src/index.ts"
        )
        
        for file in "${important_files[@]}"; do
            local full_path="$BACKEND_DIR/$file"
            if [ -f "$full_path" ]; then
                echo ""
                log_info "詳細チェック: $file"
                npx tsc --noEmit --skipLibCheck "$full_path" || true
            fi
        done
    fi
}

# =====================================
# サマリーレポート
# =====================================

generate_summary() {
    local total_files=$(wc -l < "$REPORT_DIR/source_files.txt")
    local error_count=$1
    local success_count=$(( total_files - error_count ))
    
    echo ""
    echo "=============================="
    echo "  TypeScriptチェック完了"
    echo "=============================="
    echo "  総ファイル数: $total_files"
    echo "  成功: $success_count"
    echo "  エラー: $error_count"
    
    if [ "$error_count" -eq 0 ]; then
        echo "  成功率: 100%"
        log_success "全てのソースファイルでコンパイルチェックが成功しました"
    else
        echo "  成功率: $(( success_count * 100 / total_files ))%"
        log_warning "詳細なエラー情報はレポートを確認してください"
        echo "  レポート: $REPORT_FILE"
    fi
    
    # 推奨次ステップ
    if [ "$error_count" -gt 0 ]; then
        echo ""
        echo "推奨次ステップ:"
        echo "1. cat $REPORT_FILE | grep -A 5 '❌' | head -20"
        echo "2. npx tsc --noEmit --skipLibCheck [エラーファイル名]"
        echo "3. 個別ファイルの型エラーを修正"
    fi
}

# =====================================
# メイン実行
# =====================================

main() {
    log_info "🎯 ソースファイル限定TypeScriptチェック開始"
    
    # 前提条件チェック
    if [ ! -d "$SRC_DIR" ]; then
        log_error "ソースディレクトリが見つかりません: $SRC_DIR"
        exit 1
    fi
    
    if ! command -v npx >/dev/null 2>&1; then
        log_error "npx コマンドが見つかりません"
        exit 1
    fi
    
    cd "$BACKEND_DIR"
    
    # ファイルリスト生成
    generate_source_file_list
    local file_count=$?
    
    if [ "$file_count" -eq 0 ]; then
        log_warning "チェック対象のファイルが見つかりませんでした"
        exit 0
    fi
    
    # チェック実行
    local total_errors=0
    
    if [ "$QUICK_MODE" = true ]; then
        check_all_source_files
        total_errors=$?
    else
        check_by_category
        total_errors=$?
        check_specific_files
    fi
    
    # サマリー表示
    generate_summary $total_errors
    
    # クリーンアップ
    rm -f "$REPORT_DIR/temp_error.log"
    
    exit $total_errors
}

# 実行
main "$@"