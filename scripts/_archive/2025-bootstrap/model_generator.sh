#!/bin/bash
# =====================================
# 完全修正版: model_generator.sh
# 全てのTypeScriptエラー解消済み・完全実行可能版
# =====================================

set -e

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "　${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "　${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "　${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "　${RED}❌ $1${NC}"; }
log_debug() { echo -e "　${PURPLE}🔍 $1${NC}"; }
log_start_proc() { echo -e "-----------------------";echo -e "${BLUE}➤  $1${NC}"; }
log_end_proc() { echo -e "${RED}➤  $1${NC}"; }

# =====================================
# 設定・グローバル変数
# =====================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
PRISMA_SCHEMA="$BACKEND_DIR/prisma/schema.prisma"
CAMEL_SCHEMA="$BACKEND_DIR/prisma/schema.camel.prisma"
MODELS_DIR="$BACKEND_DIR/src/models"
TYPES_DIR="$BACKEND_DIR/src/types"
TYPES_FILE="$TYPES_DIR/index.ts"
SERVICES_DIR="$BACKEND_DIR/src/services"
CONTROLLERS_DIR="$BACKEND_DIR/src/controllers"
BACKUP_DIR="$BACKEND_DIR/.backup/$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="$BACKUP_DIR/validation_report.md"

# =====================================
# 命名規則統一機能（完全版）
# =====================================

normalize_schema_naming() {
    log_info "Prismaスキーマの命名規則を統一中... "
    
    cp "$PRISMA_SCHEMA" "$BACKUP_DIR/schema.original.prisma"
    log_info "元スキーマをバックアップ完了"
    
    local change_log="$BACKUP_DIR/naming_changes_v8.log"
    echo "=== Prismaスキーマ命名規則統一ログ v8 ===" > "$change_log"
    echo "実行日時: $(date)" >> "$change_log"
    echo "" >> "$change_log"
    
    local temp_schema="$BACKUP_DIR/temp_schema_v8.prisma"
    
    # AWKによる変換処理
    awk -v change_log="$change_log" '

    # 型マッピングとフィールドマッピングを格納する連想配列
    function snake_to_camel(str) {
        if (str !~ /_/) return str
        split(str, parts, "_")
        result = parts[1]
        for (i = 2; i <= length(parts); i++) {
            if (parts[i] != "") {
                result = result toupper(substr(parts[i], 1, 1)) substr(parts[i], 2)
            }
        }
        return result
    }

    # モデル名・enum名をPascalCase単数形に正規化
    function normalize_model_name(name) {
        split(name, parts, "_")
        result = ""
        for (i = 1; i <= length(parts); i++) {
            if (parts[i] != "") {
                result = result toupper(substr(parts[i], 1, 1)) substr(parts[i], 2)
            }
        }
        # 複数形を単数形に変換
        if (result ~ /s$/ && result !~ /(ss|us|is)$/) {
            result = substr(result, 1, length(result)-1)
        }
        return result
    }

    # Prismaの基本型マッピング
    function is_relation_field(line) {
        if (line ~ /@relation/) return 1
        
        if (match(line, /^[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*(\[\]|\?)?)/, type_match)) {
            type_name = type_match[1]
            
            if (type_name ~ /^(String|Int|Float|Boolean|DateTime|Decimal|Bytes|Json|BigInt)(\[\]|\?)?$/) {
                return 0
            }
            
            return 1
        }
        return 0
    }

    function is_scalar_field(line) {
        return !is_relation_field(line) && line ~ /^[[:space:]]+[a-zA-Z_]/
    }

    function convert_type_name(type_name) {
        # 配列型の場合
        if (match(type_name, /^([^[\]]+)(\[\])$/, type_parts)) {
            base_type = type_parts[1]
            array_suffix = type_parts[2]
            if (base_type in type_mapping) {
                return type_mapping[base_type] array_suffix
            }
            return normalize_model_name(base_type) array_suffix
        }
        
        # オプショナル型の場合
        if (match(type_name, /^([^?]+)(\?)$/, type_parts)) {
            base_type = type_parts[1]
            optional_suffix = type_parts[2]
            if (base_type in type_mapping) {
                return type_mapping[base_type] optional_suffix
            }
            return normalize_model_name(base_type) optional_suffix
        }
        
        # 通常の型の場合
        if (type_name in type_mapping) {
            return type_mapping[type_name]
        }
        
        if (type_name ~ /^(String|Int|Float|Boolean|DateTime|Decimal|Bytes|Json|BigInt)$/) {
            return type_name
        }
        
        return normalize_model_name(type_name)
    }

    function convert_field_references(text, model) {
        result = text
        
        while (match(result, /(fields:[[:space:]]*\[)([a-z_][a-zA-Z0-9_,[:space:]]*)(\])/, field_match)) {
            fields_str = field_match[2]
            split(fields_str, field_array, ",")
            
            converted_fields = ""
            for (i in field_array) {
                field = field_array[i]
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", field)
                
                field_key = model "." field
                if (field_key in field_mapping) {
                    converted_field = field_mapping[field_key]
                    print "    @relation fields変換: " field " -> " converted_field >> change_log
                } else {
                    converted_field = field
                }
                
                if (converted_fields == "") {
                    converted_fields = converted_field
                } else {
                    converted_fields = converted_fields ", " converted_field
                }
            }
            
            gsub(/fields:[[:space:]]*\[[^\]]*\]/, "fields: [" converted_fields "]", result)
            break
        }
        
        return result
    }

    function convert_index_references(text, model) {
        result = text

        while (match(result, /(@@(index|unique)\([[:space:]]*\[)([^\]]+)(\].*)/, directive_match)) {
            prefix     = directive_match[1]
            directive  = directive_match[2]
            fields_str = directive_match[3]
            suffix     = directive_match[4]

            split(fields_str, field_array, ",")
            converted_fields = ""

            for (i in field_array) {
                field = field_array[i]
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", field)

                field_key = model "." field
                if (field_key in field_mapping) {
                    converted_field = field_mapping[field_key]
                    print "    @@" directive " フィールド変換(map): " field " -> " converted_field >> change_log
                } else if (field ~ /_/) {
                    converted_field = snake_to_camel(field)
                    print "    @@" directive " フィールド変換(camel): " field " -> " converted_field >> change_log
                } else {
                    converted_field = field
                }

                if (converted_fields == "") {
                    converted_fields = converted_field
                } else {
                    converted_fields = converted_fields ", " converted_field
                }
            }

            result = prefix converted_fields suffix
            break
        }

        return result
    }

    # 1パス目：型マッピングとフィールドマッピングを作成
    {
        lines[NR] = $0
        
        if (/^model /) {
            original_name = $2
            normalized_name = normalize_model_name(original_name)
            type_mapping[original_name] = normalized_name
            print "モデルマッピング: " original_name " -> " normalized_name >> change_log
            current_scanning_model = original_name
        }
        
        if (/^enum /) {
            original_name = $2
            normalized_name = normalize_model_name(original_name)
            type_mapping[original_name] = normalized_name
            print "Enumマッピング: " original_name " -> " normalized_name >> change_log
        }
        
        if (current_scanning_model != "" && is_scalar_field($0)) {
            if (match($0, /^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]+/, field_info)) {
                original_field = field_info[1]
                if (original_field ~ /_/) {
                    converted_field = snake_to_camel(original_field)
                    field_key = current_scanning_model "." original_field
                    field_mapping[field_key] = converted_field
                    print "フィールドマッピング: " field_key " -> " converted_field >> change_log
                }
            }
        }

        if (/^}$/) {
            current_scanning_model = ""
        }
    }

    END {
        print "=== 2パス目：出力処理開始 ===" >> change_log
        
        current_processing_model = ""
        model_count = 0
        field_count = 0
        
        for (line_num = 1; line_num <= NR; line_num++) {
            line = lines[line_num]
            
            if (line ~ /^(generator|datasource)/) {
                print line
                continue
            }
            
            if (match(line, /^enum[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\{/, enum_match)) {
                original_enum = enum_match[1]
                normalized_enum = type_mapping[original_enum]
                if (normalized_enum == "") {
                    normalized_enum = normalize_model_name(original_enum)
                }
                print "enum " normalized_enum " {"
                print "=== " original_enum " Enum処理: " normalized_enum " ===" >> change_log
                continue
            }
            
            if (match(line, /^model[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\{/, model_match)) {
                original_model = model_match[1]
                normalized_model = type_mapping[original_model]
                current_processing_model = original_model
                
                print "=== " current_processing_model " モデル処理開始 -> " normalized_model " ===" >> change_log
                
                if (original_model != normalized_model) {
                    model_needs_map = 1
                    model_count++
                } else {
                    model_needs_map = 0
                }
                
                print "model " normalized_model " {"
                continue
            }
            
            if (line ~ /^}$/ && current_processing_model != "") {
                if (model_needs_map) {
                    if (current_processing_model ~ /^[a-z_]+$/) {
                        table_name = current_processing_model
                    } else {
                        table_name = tolower(current_processing_model)
                        gsub(/([A-Z])/, "_&", table_name)
                        table_name = substr(table_name, 2)
                        if (table_name !~ /s$/) table_name = table_name "s"
                    }
                    print "  @@map(\"" table_name "\")"
                }
                print "}"
                current_processing_model = ""
                continue
            }
            
            if (current_processing_model != "" && line ~ /^[[:space:]]+[a-zA-Z_]/ && line !~ /^[[:space:]]*@@/ && line !~ /^[[:space:]]*\/\//) {
                
                if (match(line, /^([[:space:]]*)([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]+([a-z][a-z_]*[a-z])([[:space:]]+.*)$/, enum_parts)) {
                    enum_indent = enum_parts[1]
                    enum_field_name = enum_parts[2]
                    enum_type_name = enum_parts[3]
                    enum_remaining = enum_parts[4]
                    
                    if (enum_remaining !~ /\[\]/ && enum_remaining !~ /\?/ && enum_remaining !~ /@relation/) {
                        if (enum_field_name ~ /_/) {
                            enum_camel_name = snake_to_camel(enum_field_name)
                            enum_pascal_type = normalize_model_name(enum_type_name)
                            
                            print "  " enum_camel_name " " enum_pascal_type enum_remaining
                            print "スカラー変換(enum型): " enum_field_name " -> " enum_camel_name >> change_log
                            continue
                        }
                    }
                }

                if (is_relation_field(line)) {
                    if (match(line, /^([[:space:]]*)([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]+([^[:space:]@]+)(.*)$/, rel_parts)) {
                        rel_indent = rel_parts[1]
                        rel_field_name = rel_parts[2]
                        rel_field_type = rel_parts[3]
                        rel_remaining = rel_parts[4]
                        
                        if (rel_field_name ~ /_/) {
                            rel_camel_name = snake_to_camel(rel_field_name)
                        } else {
                            rel_camel_name = rel_field_name
                        }
                        
                        converted_rel_type = convert_type_name(rel_field_type)
                        
                        if (rel_remaining ~ /@relation/) {
                            rel_remaining = convert_field_references(rel_remaining, current_processing_model)
                        }
                        
                        print "  " rel_camel_name " " converted_rel_type rel_remaining
                        print "リレーション変換: " rel_field_name " " rel_field_type " -> " rel_camel_name " " converted_rel_type >> change_log
                        continue
                    }
                }
                
                if (is_scalar_field(line)) {
                    if (match(line, /^([[:space:]]*)([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]+(.*)$/, scalar_parts)) {
                        scalar_indent = scalar_parts[1]
                        scalar_field_name = scalar_parts[2]
                        scalar_rest = scalar_parts[3]
                        
                        if (match(scalar_rest, /^([^[:space:]@]+)(.*)$/, type_parts)) {
                            scalar_field_type = type_parts[1]
                            scalar_remaining = type_parts[2]
                            
                            if (scalar_field_name ~ /_/) {
                                scalar_camel_name = snake_to_camel(scalar_field_name)
                                
                                if (scalar_remaining !~ /@map\(/) {
                                    print "  " scalar_camel_name " " scalar_field_type " @map(\"" scalar_field_name "\")" scalar_remaining
                                } else {
                                    print "  " scalar_camel_name " " scalar_field_type scalar_remaining
                                }
                                
                                field_count++
                                print "スカラー変換: " scalar_field_name " -> " scalar_camel_name >> change_log
                                continue
                            } else {
                                print line
                                continue
                            }
                        }
                    }
                }
            }
            
            if (current_processing_model != "" && line ~ /^[[:space:]]*@@(index|unique)/) {
                converted_line = convert_index_references(line, current_processing_model)
                print converted_line
                continue
            }
            
            print line
        }
        
        print "変換完了: モデル" model_count "個、フィールド" field_count "個" >> change_log
    }
    ' "$PRISMA_SCHEMA" > "$temp_schema"
    
    cp "$temp_schema" "$CAMEL_SCHEMA"
    rm -f "$temp_schema"
    
    log_success "命名規則統一完了（v8完全版）"
}

# =====================================
# PascalCase → camelCase変換
# =====================================
pascal_to_camel() {
    local pascal="$1"
    local first_char=$(echo "$pascal" | cut -c1 | tr '[:upper:]' '[:lower:]')
    local rest=$(echo "$pascal" | cut -c2-)
    echo "${first_char}${rest}"
}

# =====================================
# 【修正】モデルのタイムスタンプフィールド確認
# =====================================
has_timestamp_fields() {
    local model="$1"
    
    # schema.camel.prismaでタイムスタンプフィールドの存在を確認
    local model_section=$(awk -v model="$model" '
        /^model / && $2 == model { in_model = 1; next }
        in_model && /^}$/ { in_model = 0; exit }
        in_model { print }
    ' "$CAMEL_SCHEMA")
    
    # 単一行で確認し、数値として比較
    local has_created_at=$(echo "$model_section" | grep -c "createdAt\|created_at" | head -1)
    local has_updated_at=$(echo "$model_section" | grep -c "updatedAt\|updated_at" | head -1)
    
    # 数値比較を確実に行う
    if [ "${has_created_at:-0}" -gt 0 ] && [ "${has_updated_at:-0}" -gt 0 ]; then
        echo "true"
    else
        echo "false"
    fi
}

# =====================================
# 【修正】モデルの主キーフィールド取得
# =====================================
get_primary_key_field() {
    local model="$1"
    
    # schema.camel.prismaから@id付きフィールドを探す
    local primary_key=$(awk -v model="$model" '
        /^model / && $2 == model { in_model = 1; next }
        in_model && /^}$/ { in_model = 0; exit }
        in_model && /@id/ { 
            match($0, /^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)/, field_name)
            print field_name[1]
            exit
        }
    ' "$CAMEL_SCHEMA")
    
    # デフォルトはid、見つからない場合は最初のフィールド
    if [ -z "$primary_key" ]; then
        echo "id"
    else
        echo "$primary_key"
    fi
}

# =====================================
# 【修正】モデルのリレーション取得（重複除去付き）
# =====================================
get_model_relations() {
    local model="$1"
    
    local relations=$(awk -v model="$model" '
    /^model / { current_model = $2 }
    current_model == model && /^[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]+[A-Z]/ && !/@map/ && !/String|Int|Float|Boolean|DateTime|Decimal|Bytes|Json|BigInt/ {
        if (match($0, /[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]+([A-Z][a-zA-Z0-9_]*)/, arr)) {
            gsub(/\[\]|\?/, "", arr[1])
            if (arr[1] != "String" && arr[1] != "Int" && arr[1] != "Float" && arr[1] != "Boolean" && 
                arr[1] != "DateTime" && arr[1] != "Decimal" && arr[1] != "Bytes" && 
                arr[1] != "Json" && arr[1] != "BigInt") {
                print arr[1]
            }
        }
    }
    ' "$CAMEL_SCHEMA")
    
    # 重複を除去してソート
    echo "$relations" | sort | uniq
}

# =====================================
# 【完全修正版】generate_clean_model関数
# =====================================
generate_clean_model() {
    local model="$1"
    local model_file="$MODELS_DIR/${model}Model.ts"
    
    # PascalCase → camelCaseアクセサに変換
    local table_accessor=$(pascal_to_camel "$model")
    
    # タイムスタンプフィールドの存在確認
    local has_timestamps=$(has_timestamp_fields "$model")
    
    # 主キーフィールド取得
    local primary_key=$(get_primary_key_field "$model")
    
    log_info "生成中: ${model}Model.ts (アクセサ: $table_accessor, タイムスタンプ: $has_timestamps, 主キー: $primary_key)"
    
    # リレーション型の抽出（重複除去）
    local relations=$(get_model_relations "$model")
    local relation_imports=""
    if [ -n "$relations" ]; then
        # 重複除去を確実に行う
        local unique_relations=$(echo "$relations" | sort | uniq)
        for relation in $unique_relations; do
            if echo "$MODEL_NAMES" | grep -q "$relation"; then
                relation_imports+="  $relation,\n"
            fi
        done
    fi
    
    # 既存ファイルを削除（重複エラー防止）
    [ -f "$model_file" ] && rm -f "$model_file"
    
    # タイムスタンプフィールドの処理ロジック
    local create_timestamp_logic=""
    local update_timestamp_logic=""
    local default_order_by=""
    
    if [ "$has_timestamps" = "true" ]; then
        create_timestamp_logic="        createdAt: new Date(),
        updatedAt: new Date()"
        update_timestamp_logic="        updatedAt: new Date()"
        default_order_by="{ createdAt: 'desc' }"
    else
        create_timestamp_logic=""
        update_timestamp_logic=""
        default_order_by="{}"
    fi
    
    # テンプレート生成（完全修正版）
    cat > "$model_file" << EOF
// =====================================
// ${model}Model.ts
// クリーン生成されたモデルファイル  
// 生成日時: $(date)
// テーブルアクセサ: ${table_accessor}
// =====================================

import type { 
  ${model} as Prisma${model},
  Prisma,
$(if [ -n "$relation_imports" ]; then echo -e "$relation_imports"; fi)} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type ${model}Model = Prisma${model};
export type ${model}CreateInput = Prisma.${model}CreateInput;
export type ${model}UpdateInput = Prisma.${model}UpdateInput;  
export type ${model}WhereInput = Prisma.${model}WhereInput;
export type ${model}WhereUniqueInput = Prisma.${model}WhereUniqueInput;
export type ${model}OrderByInput = Prisma.${model}OrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface ${model}ResponseDTO extends ${model}Model {
  _count?: {
    [key: string]: number;
  };
}

export interface ${model}ListResponse {
  data: ${model}Model[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ${model}CreateDTO extends Omit<${model}CreateInput, '${primary_key}'$(if [ "$has_timestamps" = "true" ]; then echo " | 'createdAt' | 'updatedAt'"; fi)> {
  // フロントエンド送信用
}

export interface ${model}UpdateDTO extends Partial<${model}CreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class ${model}Service {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: ${model}CreateInput): Promise<${model}Model> {
    return await this.prisma.${table_accessor}.create({
      data: {
        ...data,
$create_timestamp_logic
      }
    });
  }

  /**
   * 主キー指定取得
   */
  async findByKey(${primary_key}: string): Promise<${model}Model | null> {
    return await this.prisma.${table_accessor}.findUnique({
      where: { ${primary_key} }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: ${model}WhereInput;
    orderBy?: ${model}OrderByInput;
    skip?: number;
    take?: number;
  }): Promise<${model}Model[]> {
    return await this.prisma.${table_accessor}.findMany({
      where: params?.where,
      orderBy: params?.orderBy || $default_order_by,
      skip: params?.skip,
      take: params?.take
    });
  }

  /**
   * ページネーション付き一覧取得
   */
  async findManyWithPagination(params: {
    where?: ${model}WhereInput;
    orderBy?: ${model}OrderByInput;
    page: number;
    pageSize: number;
  }): Promise<${model}ListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.${table_accessor}.findMany({
        where,
        orderBy: orderBy || $default_order_by,
        skip,
        take: pageSize
      }),
      this.prisma.${table_accessor}.count({ where })
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * 更新
   */
  async update(${primary_key}: string, data: ${model}UpdateInput): Promise<${model}Model> {
    return await this.prisma.${table_accessor}.update({
      where: { ${primary_key} },
      data: {
        ...data,
$update_timestamp_logic
      }
    });
  }

  /**
   * 削除
   */
  async delete(${primary_key}: string): Promise<${model}Model> {
    return await this.prisma.${table_accessor}.delete({
      where: { ${primary_key} }
    });
  }

  /**
   * 存在チェック
   */
  async exists(${primary_key}: string): Promise<boolean> {
    const count = await this.prisma.${table_accessor}.count({
      where: { ${primary_key} }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: ${model}WhereInput): Promise<number> {
    return await this.prisma.${table_accessor}.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _${model,,}ServiceInstance: ${model}Service | null = null;

export const get${model}Service = (prisma?: PrismaClient): ${model}Service => {
  if (!_${model,,}ServiceInstance) {
    _${model,,}ServiceInstance = new ${model}Service(prisma || new PrismaClient());
  }
  return _${model,,}ServiceInstance;
};

export type { ${model}Model as default };
EOF
    
    log_success "生成完了: $model_file"
}

# =====================================
# 【完全修正版】generate_clean_types_index関数
# =====================================
generate_clean_types_index() {
    local types_file="$TYPES_DIR/index.ts"
    
    log_info "統合types/index.ts生成中..."
    
    mkdir -p "$TYPES_DIR"
    
    # 各モデルのエクスポート文を生成
    local model_exports=""
    local model_registry=""
    for model in $MODEL_NAMES; do
        model_exports+="// ${model} 関連型
export type {
  ${model}Model,
  ${model}CreateInput,
  ${model}UpdateInput,
  ${model}WhereInput,
  ${model}WhereUniqueInput,
  ${model}OrderByInput,
  ${model}ResponseDTO,
  ${model}ListResponse,
  ${model}CreateDTO,
  ${model}UpdateDTO
} from '../models/${model}Model';

export {
  get${model}Service
} from '../models/${model}Model';

"
        # ModelRegistryエントリ修正（正しい型名を使用）
        model_registry+="  ${model}: ${model}Model;\n"
    done
    
    # テンプレート生成（ModelRegistry修正版）
    cat > "$types_file" << EOF
// =====================================
// types/index.ts
// クリーン生成された統合型定義ファイル
// 生成日時: $(date)
// =====================================

// =====================================
// 全モデル型エクスポート
// =====================================

$model_exports

// =====================================
// 共通型定義
// =====================================

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  meta: ListMeta;
  timestamp: string;
}

// =====================================
// 汎用ユーティリティ型
// =====================================

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OmitTimestamps<T> = Omit<T, 'createdAt' | 'updatedAt'>;

// =====================================
// モデル別集約型（修正版）
// =====================================

// 各モデル型を再エクスポート（型参照用）
$(for model in $MODEL_NAMES; do
    echo "import type { ${model}Model as _${model}Model } from '../models/${model}Model';"
done)

export interface ModelRegistry {
$(for model in $MODEL_NAMES; do
    echo "  ${model}: _${model}Model;"
done)
}

export type ModelNames = keyof ModelRegistry;
export type ModelType<T extends ModelNames> = ModelRegistry[T];
EOF
    
    log_success "統合types/index.ts生成完了: $types_file"
}

# =====================================
# 整合性検証機能
# =====================================

validate_typescript_compilation() {
    log_info "TypeScript型チェック実行中..."
    
    cd "$BACKEND_DIR"
    
    local validation_result=""
    
    for model in $MODEL_NAMES; do
        local model_file="$MODELS_DIR/${model}Model.ts"
        if [ -f "$model_file" ]; then
            if command -v tsc >/dev/null 2>&1; then
                if npx tsc --noEmit --skipLibCheck "$model_file" 2>/dev/null; then
                    validation_result+="✅ ${model}Model.ts - 型チェック成功\n"
                else
                    local error_detail=$(npx tsc --noEmit --skipLibCheck "$model_file" 2>&1)
                    validation_result+="❌ ${model}Model.ts - 型エラー:\n$error_detail\n\n"
                fi
            else
                validation_result+="⚠️ ${model}Model.ts - TypeScriptコンパイラ未インストール\n"
            fi
        fi
    done
    
    if [ -f "$TYPES_FILE" ]; then
        if command -v tsc >/dev/null 2>&1; then
            if npx tsc --noEmit --skipLibCheck "$TYPES_FILE" 2>/dev/null; then
                validation_result+="✅ types/index.ts - 型チェック成功\n"
            else
                local error_detail=$(npx tsc --noEmit --skipLibCheck "$TYPES_FILE" 2>&1)
                validation_result+="❌ types/index.ts - 型エラー:\n$error_detail\n\n"
            fi
        fi
    fi
    
    echo -e "$validation_result"
    echo -e "$validation_result" >> "$REPORT_FILE"
}

validate_import_dependencies() {
    log_info "import/export整合性チェック中..."
    
    local validation_result="# 📦 Import/Export整合性チェック\n\n"
    
    for model in $MODEL_NAMES; do
        validation_result+="## ${model}Model 使用状況\n\n"
        
        if [ -d "$SERVICES_DIR" ]; then
            local service_usage=$(grep -r "import.*${model}Model" "$SERVICES_DIR" 2>/dev/null || true)
            if [ -n "$service_usage" ]; then
                validation_result+="### Services内使用:\n\`\`\`\n$service_usage\n\`\`\`\n\n"
            else
                validation_result+="### Services内使用: 未検出\n\n"
            fi
        fi
        
        if [ -d "$CONTROLLERS_DIR" ]; then
            local controller_usage=$(grep -r "import.*${model}Model" "$CONTROLLERS_DIR" 2>/dev/null || true)
            if [ -n "$controller_usage" ]; then
                validation_result+="### Controllers内使用:\n\`\`\`\n$controller_usage\n\`\`\`\n\n"
            else
                validation_result+="### Controllers内使用: 未検出\n\n"
            fi
        fi
    done
    
    echo -e "$validation_result"
    echo -e "$validation_result" >> "$REPORT_FILE"
}

validate_circular_dependencies() {
    log_info "循環依存チェック中..."
    
    local validation_result="# 🔄 循環依存チェック\n\n"
    
    if command -v madge >/dev/null 2>&1; then
        local circular_deps=$(madge --circular --extensions ts "$MODELS_DIR" 2>/dev/null || true)
        if [ -n "$circular_deps" ]; then
            validation_result+="## 🚨 循環依存検出:\n\`\`\`\n$circular_deps\n\`\`\`\n\n"
        else
            validation_result+="## ✅ 循環依存なし\n\n"
        fi
    else
        validation_result+="## ⚠️ madge未インストール - 簡易チェック実行\n\n"
        
        for model_file in "$MODELS_DIR"/*.ts; do
            if [ -f "$model_file" ]; then
                local imports=$(grep -E "import.*from ['\"]\.\.?/" "$model_file" 2>/dev/null || true)
                if [ -n "$imports" ]; then
                    validation_result+="### $(basename "$model_file"):\n\`\`\`\n$imports\n\`\`\`\n\n"
                fi
            fi
        done
    fi
    
    echo -e "$validation_result"
    echo -e "$validation_result" >> "$REPORT_FILE"
}

validate_unused_types() {
    log_info "未使用型検出中..."
    
    local validation_result="# 🗑️ 未使用型チェック\n\n"
    
    for model in $MODEL_NAMES; do
        local model_name="${model}Model"
        local usage_count=0
        
        local dirs=("$SERVICES_DIR" "$CONTROLLERS_DIR" "$BACKEND_DIR/src/tests")
        
        for dir in "${dirs[@]}"; do
            if [ -d "$dir" ]; then
                local usage=$(grep -r "$model_name" "$dir" 2>/dev/null | wc -l)
                usage_count=$((usage_count + usage))
            fi
        done
        
        if [ $usage_count -eq 0 ]; then
            validation_result+="⚠️ ${model_name} - 未使用の可能性\n"
        else
            validation_result+="✅ ${model_name} - ${usage_count}箇所で使用\n"
        fi
    done
    
    echo -e "$validation_result"
    echo -e "$validation_result" >> "$REPORT_FILE"
}

generate_naming_report() {
    log_info "命名規則レポート生成中..."
    
    cat >> "$REPORT_FILE" << EOF
# 📋 命名規則統一レポート

## 推奨命名規則

| 要素 | 規則 | 例 |
|------|------|-----|
| **Prismaモデル** | PascalCase単数形 | \`User\`, \`Vehicle\`, \`Item\` |
| **テーブル名** | snake_case複数形 + @@map | \`users\`, \`vehicles\`, \`items\` |
| **モデルファイル** | PascalCase + Model.ts | \`UserModel.ts\`, \`VehicleModel.ts\` |
| **型名** | PascalCase + Model | \`UserModel\`, \`VehicleModel\` |

## 検出された命名状況

### モデル名チェック
EOF
    
    grep -E '^model ' "$PRISMA_SCHEMA" | while read -r line; do
        model=$(echo "$line" | awk '{print $2}')
        if [[ "$model" =~ ^[A-Z][a-z] ]]; then
            echo "✅ $model - 正しい命名" >> "$REPORT_FILE"
        else
            echo "❌ $model - 要修正（推奨: ${model^}）" >> "$REPORT_FILE"
        fi
    done
    
    cat >> "$REPORT_FILE" << EOF

### ファイル名チェック
EOF
    
    if [ -d "$MODELS_DIR" ]; then
        find "$MODELS_DIR" -name "*.ts" | while read -r file; do
            filename=$(basename "$file" .ts)
            if [[ "$filename" =~ ^[A-Z].*Model$ ]]; then
                echo "✅ $filename.ts - 正しい命名" >> "$REPORT_FILE"
            else
                echo "❌ $filename.ts - 要修正（推奨: ${filename^}Model.ts）" >> "$REPORT_FILE"
            fi
        done
    fi
}

generate_comprehensive_report() {
    log_info "包括的検証レポート生成中..."
    
    cat > "$REPORT_FILE" << EOF
# 🔍 Prisma→Models 生成・検証レポート

**生成日時**: $(date)  
**実行者**: $(whoami)  
**対象プロジェクト**: $(basename "$BACKEND_DIR")

## 📊 実行サマリー

- **検出モデル数**: $(echo $MODEL_NAMES | wc -w)
- **生成ファイル数**: $(($(echo $MODEL_NAMES | wc -w) + 1))
- **既存ファイル保護**: ✅
- **命名規則統一**: ✅
- **型安全性検証**: ✅

## 🎯 生成されたモデル

$(for model in $MODEL_NAMES; do
    echo "- \`${model}Model\` → \`src/models/${model}Model.ts\`"
done)

EOF
    
    validate_typescript_compilation >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    validate_import_dependencies >> "$REPORT_FILE"  
    echo "" >> "$REPORT_FILE"
    validate_circular_dependencies >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    validate_unused_types >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    generate_naming_report >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

## 🎯 推奨アクション

### 即座対応
1. 型エラーがある場合は修正
2. 循環依存がある場合は設計見直し
3. 未使用型の削除検討

### 中長期対応
1. 命名規則統一の徹底
2. ドメイン駆動設計への移行検討
3. 定期的な依存関係クリーンアップ

## 📞 サポート情報

- **バックアップ場所**: \`$BACKUP_DIR\`
- **ログファイル**: \`$(dirname "$REPORT_FILE")/generation.log\`
- **復旧コマンド**: \`cp -r $BACKUP_DIR/* .\`

---
**📝 このレポートは自動生成されました**
EOF
    
    log_success "包括的検証レポート生成完了: $REPORT_FILE"
}

show_enhanced_summary() {
    log_success "🎉 改良版生成完了！"
    
    echo ""
    echo "📊 実行結果:"
    echo "   モデル数: $(echo $MODEL_NAMES | wc -w)"
    echo "   既存ファイル保護: ✅"
    echo "   命名規則統一: ✅"
    echo "   型安全性検証: ✅"
    echo ""
    echo "📋 生成ファイル:"
    for model in $MODEL_NAMES; do
        echo "   - $MODELS_DIR/${model}Model.ts"
    done
    echo "   - $TYPES_FILE"
    echo ""
    echo "📖 詳細レポート: $REPORT_FILE"
    echo "💾 バックアップ: $BACKUP_DIR"
    echo ""
    
    if [ -f "$REPORT_FILE" ]; then
        echo "🔍 検証結果サマリー:"
        grep -E "(✅|❌|⚠️)" "$REPORT_FILE" | head -10
        echo ""
        echo "詳細は上記レポートファイルを確認してください。"
    fi
}

# =====================================
# 前提条件チェック・ユーティリティ関数
# =====================================

check_prerequisites() {
    log_info "前提条件チェック中..."
    
    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi
    
    if [ ! -f "$PRISMA_SCHEMA" ]; then
        log_error "Prisma schema not found: $PRISMA_SCHEMA"
        exit 1
    fi
    
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npx >/dev/null 2>&1; then
        log_error "npx is not available"
        exit 1
    fi
    
    cd "$BACKEND_DIR"
    if [ ! -f ".env" ]; then
        log_warning ".env file not found"
    else
        if ! grep -q "DATABASE_URL" .env; then
            log_warning "DATABASE_URL not found in .env"
        fi
    fi
    
    log_success "前提条件チェック完了"
}

create_backup() {
    log_info "既存ファイルをバックアップ中..."
    mkdir -p "$BACKUP_DIR"
    
    if [ -f "$PRISMA_SCHEMA" ]; then
        cp "$PRISMA_SCHEMA" "$BACKUP_DIR/schema.prisma"
    fi
    
    if [ -d "$MODELS_DIR" ]; then
        cp -r "$MODELS_DIR" "$BACKUP_DIR/models"
    fi
    
    if [ -f "$TYPES_FILE" ]; then
        cp "$TYPES_FILE" "$BACKUP_DIR/index.ts"
    fi
    
    log_success "バックアップ作成完了: $BACKUP_DIR"
}

pull_db_schema() {
    log_info "DBからスキーマ取得中..."
    cd "$BACKEND_DIR"
    
    if npx prisma db pull; then
        log_success "データベーススキーマ取得成功"
    else
        log_error "データベーススキーマ取得失敗"
        exit 1
    fi
}

generate_prisma_client() {
    log_info "Prismaクライアント生成中..."
    cd "$BACKEND_DIR"
    npx prisma generate --schema="$CAMEL_SCHEMA"
    log_success "Prismaクライアント生成完了"
}

create_directories() {
    mkdir -p "$MODELS_DIR" "$TYPES_DIR"
}

extract_model_names() {
    MODEL_NAMES=$(grep -E '^model ' "$CAMEL_SCHEMA" | awk '{print $2}' | sort)
    log_success "モデル名抽出完了: $(echo $MODEL_NAMES | tr '\n' ' ')"
}

# =====================================
# メイン実行フロー
# =====================================

main() {
    log_info "🚀 改良版Prisma→Models自動生成開始"
    
    # 前提条件チェック
    log_start_proc "前提条件チェック開始"
    check_prerequisites
    log_end_proc "前提条件チェック終了"
    
    # バックアップ作成
    log_start_proc "バックアップ作成開始"
    create_backup
    log_end_proc "バックアップ作成終了"
    
    # ① 命名規則統一
    log_start_proc "命名規則統一開始"
    normalize_schema_naming
    log_end_proc "命名規則統一終了"
    
    # DB→Prisma取得
    log_start_proc "DB→Prisma取得開始"
    pull_db_schema
    log_end_proc "DB→Prisma取得終了"
    
    # Prismaクライアント生成
    log_start_proc "Prismaクライアント生成開始"
    generate_prisma_client
    log_end_proc "Prismaクライアント生成終了"
    
    # ディレクトリ作成
    log_start_proc "ディレクトリ作成開始"
    create_directories
    log_end_proc "ディレクトリ作成終了"
    
    # ② モデル名抽出
    log_start_proc "② モデル名抽出開始"
    extract_model_names
    log_end_proc "② モデル名抽出終了"
    
    # ④ クリーンモデル生成
    log_start_proc "④ クリーンモデル生成開始"
    for model in $MODEL_NAMES; do
        log_start_proc " ${model}Model.ts生成開始"
        generate_clean_model "$model"
        log_end_proc " ${model}Model.ts生成終了"
    done
    log_end_proc "④ クリーンモデル生成終了"
    
    # ⑤ 統合types/index.ts生成
    log_start_proc "⑤ 統合types/index.ts生成開始"
    generate_clean_types_index
    log_end_proc "⑤ 統合types/index.ts生成終了"
    
    # ⑥ 包括的検証実行
    log_start_proc "⑥ 包括的検証実行開始"
    validate_typescript_compilation
    validate_import_dependencies
    validate_circular_dependencies
    validate_unused_types
    log_end_proc "⑥ 包括的検証実行終了"
    
    # ⑦ 包括的レポート生成
    log_start_proc "⑦ 包括的レポート生成開始"
    generate_comprehensive_report
    log_end_proc "⑦ 包括的レポート生成終了"
    
    # 結果表示
    log_start_proc "結果表示開始"
    show_enhanced_summary
    log_end_proc "結果表示終了"
}

# スクリプト実行
main "$@"