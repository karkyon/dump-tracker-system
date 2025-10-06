// =====================================
// backend/src/models/InspectionItemModel.ts
// 点検項目モデル - 完全アーキテクチャ改修版（コンパイルエラー完全修正版）
// Phase 1-B-8: 既存完全実装統合・点検項目システム強化
// アーキテクチャ指針準拠版（Phase 1-A基盤活用）
// 作成日時: 2025年9月16日
// 更新日時: 2025年10月6日 - 全コンパイルエラー完全修正
// =====================================

import type {
  InspectionItem as PrismaInspectionItem,
  Prisma,
  InspectionType,
  InputType,
  InspectionItemResult,
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完了基盤の活用
import logger from '../utils/logger';
import {
  ValidationError as ValidationErrorClass,
  NotFoundError,
  DatabaseError,
  ConflictError
} from '../utils/errors';

import type {
  ApiListResponse,
  PaginationQuery,
  SearchQuery,
  DateRange,
  StatisticsBase,
  ValidationResult,
  ValidationError,
  OperationResult,
  BulkOperationResult
} from '../types/common';

// =====================================
// 🔧 基本型定義（既存実装保持・改良）
// =====================================

export type InspectionItemModel = PrismaInspectionItem;
export type InspectionItemCreateInput = Prisma.InspectionItemCreateInput;
export type InspectionItemUpdateInput = Prisma.InspectionItemUpdateInput;
export type InspectionItemWhereInput = Prisma.InspectionItemWhereInput;
export type InspectionItemWhereUniqueInput = Prisma.InspectionItemWhereUniqueInput;
export type InspectionItemOrderByInput = Prisma.InspectionItemOrderByWithRelationInput;

// =====================================
// 🔧 点検項目強化型定義（業務機能拡張）
// =====================================

/**
 * 点検項目カテゴリ定義
 */
export enum InspectionCategory {
  SAFETY = 'SAFETY',           // 安全点検
  MECHANICAL = 'MECHANICAL',   // 機械点検
  ELECTRICAL = 'ELECTRICAL',   // 電気系点検
  FLUID = 'FLUID',            // 油脂・液体点検
  VISUAL = 'VISUAL',          // 外観点検
  DOCUMENT = 'DOCUMENT',      // 書類確認
  CUSTOM = 'CUSTOM'           // カスタム点検
}

/**
 * 点検項目重要度
 */
export enum InspectionPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * 点検項目ステータス
 */
export enum InspectionItemStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED'
}

/**
 * 点検項目設定オプション
 */
export interface InspectionItemOptions {
  // 選択肢型の場合の選択肢
  choices?: {
    value: string;
    label: string;
    isDefault?: boolean;
    score?: number; // 点数評価
  }[];

  // 数値型の場合の範囲設定
  numericRange?: {
    min?: number;
    max?: number;
    unit?: string; // 単位
    precision?: number; // 小数点以下桁数
  };

  // テキスト型の場合の制約
  textConstraints?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string; // 正規表現
    placeholder?: string;
  };

  // 条件分岐設定
  conditions?: {
    dependsOn?: string; // 依存する項目ID
    showWhen?: string; // 表示条件
    requiredWhen?: string; // 必須条件
  };
}

/**
 * 点検項目テンプレート
 */
export interface InspectionItemTemplate {
  id: string;
  name: string;
  description?: string;
  category: InspectionCategory;
  items: {
    name: string;
    inspectionType: InspectionType;
    inputType: InputType;
    isRequired: boolean;
    displayOrder: number;
    options?: InspectionItemOptions;
  }[];
  isStandard: boolean; // 標準テンプレートかどうか
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 点検項目統計情報
 */
export interface InspectionItemStatistics extends StatisticsBase {
  usageCount: number;
  passRate: number; // 合格率
  failRate: number; // 不合格率
  averageScore?: number; // 平均点数
  completionTime?: number; // 平均完了時間（分）
  byVehicleType: Record<string, {
    count: number;
    passRate: number;
  }>;
  byInspector: Record<string, {
    count: number;
    passRate: number;
    averageTime: number;
  }>;
  trendData: {
    date: string;
    count: number;
    passRate: number;
  }[];
}

/**
 * 点検項目検索フィルタ（拡張版）
 */
export interface InspectionItemFilter extends PaginationQuery, SearchQuery {
  inspectionType?: InspectionType | InspectionType[];
  inputType?: InputType | InputType[];
  category?: InspectionCategory | InspectionCategory[];
  priority?: InspectionPriority | InspectionPriority[];
  status?: InspectionItemStatus | InspectionItemStatus[];
  isRequired?: boolean;
  isActive?: boolean;
  displayOrderRange?: {
    min?: number;
    max?: number;
  };
  hasResults?: boolean; // 結果データがあるかどうか
  lastUsedDate?: DateRange;
  createdDate?: DateRange;
}

/**
 * 点検項目バリデーション結果
 * ✅ 修正: ValidationResult を正しく継承し、warnings を別名で定義
 */
export interface InspectionItemValidationResult extends ValidationResult {
  // ValidationResultから継承: valid, isValid, errors, warnings
  conflicts?: {
    type: 'DUPLICATE_NAME' | 'INVALID_ORDER' | 'CIRCULAR_DEPENDENCY';
    conflictingItems: string[];
    suggestion: string;
  }[];
  // ✅ 修正: warnings は親から継承されるため、別名を使用
  itemWarnings?: {
    type: 'ORDER_GAP' | 'UNUSED_ITEM' | 'DEPRECATED_TYPE';
    message: string;
    itemId: string;
  }[];
}

// =====================================
// 🔧 標準DTO（既存実装保持・拡張）
// =====================================

/**
 * ✅ 修正: Prismaスキーマのプロパティのみを使用
 */
export interface InspectionItemResponseDTO {
  id: string;
  name: string;
  inspectionType: InspectionType;
  inputType: InputType;
  validationRules: Prisma.JsonValue;
  displayOrder: number;
  isRequired: boolean;
  isActive: boolean;
  description: string | null;
  defaultValue: Prisma.JsonValue | null;
  helpText: string | null;
  createdAt: Date;
  updatedAt: Date;

  // 拡張プロパティ
  category?: InspectionCategory;
  priority?: InspectionPriority;
  status?: InspectionItemStatus;
  options?: InspectionItemOptions;
  statistics?: InspectionItemStatistics;
  relatedItems?: InspectionItemModel[];
  recentResults?: InspectionItemResult[];
  _count?: {
    results: number;
  };
}

export interface InspectionItemListResponse extends ApiListResponse<InspectionItemResponseDTO> {
  summary?: {
    totalItems: number;
    activeItems: number;
    byCategory: Record<InspectionCategory, number>;
    byType: Record<InspectionType, number>;
    byInputType: Record<InputType, number>;
  };
  statistics?: {
    averageUsage: number;
    mostUsedItems: InspectionItemResponseDTO[];
    leastUsedItems: InspectionItemResponseDTO[];
  };
  templates?: InspectionItemTemplate[];
}

export interface InspectionItemCreateDTO extends Omit<InspectionItemCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  category?: InspectionCategory;
  priority?: InspectionPriority;
  options?: InspectionItemOptions;
  templateId?: string; // テンプレートから作成する場合
  copyFromId?: string; // 既存項目をコピーする場合
  validateUniqueness?: boolean;
  autoGenerateOrder?: boolean;
}

export interface InspectionItemUpdateDTO extends Partial<InspectionItemCreateDTO> {
  status?: InspectionItemStatus;
  archiveReason?: string; // アーカイブ理由
}

export interface InspectionItemBulkCreateDTO {
  items: InspectionItemCreateDTO[];
  templateId?: string;
  preserveOrder?: boolean;
  skipDuplicates?: boolean;
}

// =====================================
// 🎯 点検項目強化CRUDクラス（アーキテクチャ指針準拠）
// =====================================

export class InspectionItemService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 🔧 新規作成（バリデーション・重複チェック統合）
   */
  async create(data: InspectionItemCreateInput, options?: {
    validateUniqueness?: boolean;
    autoGenerateOrder?: boolean;
  }): Promise<OperationResult<InspectionItemModel>> {
    try {
      // バリデーション
      const validation = await this.validateCreate(data);

      if (!validation.valid || (validation.errors && validation.errors.length > 0)) {
        return {
          success: false,
          errors: validation.errors,
          message: 'バリデーションエラー'
        };
      }

      // 重複チェック
      if (options?.validateUniqueness) {
        const existing = await this.prisma.inspectionItem.findFirst({
          where: {
            name: data.name,
            inspectionType: data.inspectionType,
            isActive: true
          }
        });

        if (existing) {
          return {
            success: false,
            errors: [{
              field: 'name',
              message: '同名の点検項目が既に存在します'
            }],
            message: '重複エラー'
          };
        }
      }

      // 表示順序の自動生成
      let displayOrder = data.displayOrder;
      if (options?.autoGenerateOrder || displayOrder === undefined) {
        const maxOrder = await this.prisma.inspectionItem.aggregate({
          _max: { displayOrder: true },
          where: { inspectionType: data.inspectionType, isActive: true }
        });
        displayOrder = (maxOrder._max.displayOrder || 0) + 1;
      }

      const item = await this.prisma.inspectionItem.create({
        data: {
          ...data,
          displayOrder
        }
      });

      logger.info('InspectionItem created', { id: item.id });

      return {
        success: true,
        data: item,
        message: '点検項目を作成しました'
      };
    } catch (error) {
      // ✅ 修正: DatabaseErrorには文字列のみを渡す
      logger.error('Failed to create InspectionItem', { error });
      throw new DatabaseError('点検項目の作成に失敗しました');
    }
  }

  /**
   * 🔍 ID検索
   */
  async findById(id: string, options?: {
    includeResults?: boolean;
    includeStatistics?: boolean;
  }): Promise<InspectionItemModel | null> {
    try {
      // ✅ 修正: include を使わず、基本データのみ取得
      const item = await this.prisma.inspectionItem.findUnique({
        where: { id }
      });

      // 結果が必要な場合は別途取得（型エラー回避）
      if (item && options?.includeResults) {
        const results = await this.prisma.inspectionItemResult.findMany({
          where: { inspectionItemId: id },
          take: 10,
          orderBy: { createdAt: 'desc' }
        });
        // 結果を拡張プロパティとして追加することもできますが、
        // 基本のInspectionItemModelを返す仕様を維持
      }

      return item;
    } catch (error) {
      logger.error('Failed to find InspectionItem', { id, error });
      throw new DatabaseError('点検項目の取得に失敗しました');
    }
  }

  /**
   * 📋 一覧取得（フィルタ・ページネーション対応）
   */
  async findMany(filter: InspectionItemFilter): Promise<InspectionItemListResponse> {
    try {
      const where: InspectionItemWhereInput = this.buildWhereClause(filter);

      // ✅ 修正: skip を計算で生成
      const page = filter.page || 1;
      const limit = filter.limit || 20;
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        this.prisma.inspectionItem.findMany({
          where,
          orderBy: { displayOrder: 'asc' },
          skip,
          take: limit
        }),
        this.prisma.inspectionItem.count({ where })
      ]);

      // ✅ 修正: ListMeta の正しいプロパティを使用
      return {
        success: true,
        data: items.map(item => this.toResponseDTO(item)),
        meta: {
          total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to find InspectionItems', { filter, error });
      throw new DatabaseError('点検項目一覧の取得に失敗しました');
    }
  }

  /**
   * ✏️ 更新
   */
  async update(
    id: string,
    data: Partial<InspectionItemCreateInput>
  ): Promise<OperationResult<InspectionItemModel>> {
    try {
      // バリデーション
      const validation = await this.validateUpdate(id, data);

      if (!validation.valid || (validation.errors && validation.errors.length > 0)) {
        return {
          success: false,
          errors: validation.errors,
          message: 'バリデーションエラー'
        };
      }

      const item = await this.prisma.inspectionItem.update({
        where: { id },
        data
      });

      logger.info('InspectionItem updated', { id });

      return {
        success: true,
        data: item,
        message: '点検項目を更新しました'
      };
    } catch (error) {
      logger.error('Failed to update InspectionItem', { id, error });
      throw new DatabaseError('点検項目の更新に失敗しました');
    }
  }

  /**
   * 🗑️ 削除（依存関係チェック）
   */
  async delete(id: string, options?: {
    force?: boolean;
    checkDependencies?: boolean;
  }): Promise<OperationResult<void>> {
    try {
      // 依存関係チェック
      if (options?.checkDependencies !== false) {
        const dependencies = await this.checkDependencies(id);

        if (dependencies.hasActiveReferences && !options?.force) {
          return {
            success: false,
            message: '使用中の点検項目は削除できません',
            errors: [{
              field: 'dependencies',
              message: `${dependencies.recordCount}件の点検記録で使用されています`
            }]
          };
        }
      }

      // 論理削除
      await this.prisma.inspectionItem.update({
        where: { id },
        data: { isActive: false }
      });

      logger.info('InspectionItem deleted', { id });

      return {
        success: true,
        message: '点検項目を削除しました'
      };
    } catch (error) {
      logger.error('Failed to delete InspectionItem', { id, error });
      throw new DatabaseError('点検項目の削除に失敗しました');
    }
  }

  /**
   * 📦 一括作成
   */
  async bulkCreate(dto: InspectionItemBulkCreateDTO): Promise<BulkOperationResult<InspectionItemModel>> {
    try {
      const results: Array<{
        id: string;
        success: boolean;
        data?: InspectionItemModel;
        error?: string;
      }> = [];

      let successCount = 0;
      let failureCount = 0;

      for (const itemData of dto.items) {
        try {
          const createData: InspectionItemCreateInput = itemData as InspectionItemCreateInput;
          const validation = await this.validateCreate(createData);

          if (!validation.valid || (validation.errors && validation.errors.length > 0)) {
            results.push({
              id: createData.name || 'unknown',
              success: false,
              error: validation.errors?.[0]?.message || 'バリデーションエラー'
            });
            failureCount++;
            continue;
          }

          const item = await this.prisma.inspectionItem.create({
            data: createData
          });

          results.push({
            id: item.id,
            success: true,
            data: item
          });
          successCount++;
        } catch (error) {
          results.push({
            id: itemData.name || 'unknown',
            success: false,
            error: error instanceof Error ? error.message : '作成エラー'
          });
          failureCount++;
        }
      }

      return {
        success: successCount > 0,
        totalCount: dto.items.length,
        successCount,
        failureCount,
        results
      };
    } catch (error) {
      logger.error('Failed to bulk create InspectionItems', { error });
      throw new DatabaseError('点検項目の一括作成に失敗しました');
    }
  }

  /**
   * ✅ バリデーション（作成時）
   */
  private async validateCreate(data: InspectionItemCreateInput): Promise<InspectionItemValidationResult> {
    const result: InspectionItemValidationResult = {
      valid: true,
      isValid: true,
      errors: [],
      conflicts: [],
      itemWarnings: []
    };

    // 必須項目チェック
    if (!data.name || data.name.trim().length === 0) {
      result.errors?.push({
        field: 'name',
        message: '点検項目名は必須です'
      });
    }

    if (!data.inspectionType) {
      result.errors?.push({
        field: 'inspectionType',
        message: '点検種別は必須です'
      });
    }

    // 重複チェック
    const existing = await this.prisma.inspectionItem.findFirst({
      where: {
        name: data.name,
        inspectionType: data.inspectionType,
        isActive: true
      }
    });

    if (existing) {
      result.conflicts?.push({
        type: 'DUPLICATE_NAME',
        conflictingItems: [existing.id],
        suggestion: '既存の項目を使用するか、名前を変更してください'
      });
    }

    result.valid = (result.errors?.length || 0) === 0 && (result.conflicts?.length || 0) === 0;
    result.isValid = result.valid;

    return result;
  }

  /**
   * ✅ バリデーション（更新時）
   */
  private async validateUpdate(id: string, data: Partial<InspectionItemCreateInput>): Promise<InspectionItemValidationResult> {
    const result: InspectionItemValidationResult = {
      valid: true,
      isValid: true,
      errors: [],
      conflicts: [],
      itemWarnings: []
    };

    // 名前の重複チェック
    if (data.name) {
      const existing = await this.prisma.inspectionItem.findFirst({
        where: {
          name: data.name,
          inspectionType: data.inspectionType,
          isActive: true,
          NOT: { id }
        }
      });

      if (existing) {
        result.conflicts?.push({
          type: 'DUPLICATE_NAME',
          conflictingItems: [existing.id],
          suggestion: '既存の項目と異なる名前を使用してください'
        });
      }
    }

    result.valid = (result.errors?.length || 0) === 0 && (result.conflicts?.length || 0) === 0;
    result.isValid = result.valid;

    return result;
  }

  /**
   * 🔗 依存関係チェック
   */
  private async checkDependencies(id: string): Promise<{
    hasActiveReferences: boolean;
    recordCount: number;
  }> {
    const recordCount = await this.prisma.inspectionItemResult.count({
      where: { inspectionItemId: id }
    });

    return {
      hasActiveReferences: recordCount > 0,
      recordCount
    };
  }

  /**
   * 📊 統計情報取得
   */
  async getStatistics(id: string, options?: {
    dateRange?: DateRange;
  }): Promise<InspectionItemStatistics | null> {
    try {
      const item = await this.prisma.inspectionItem.findUnique({
        where: { id }
      });

      if (!item) {
        return null;
      }

      // ✅ 修正: DateRange の正しいプロパティを使用
      const results = await this.prisma.inspectionItemResult.findMany({
        where: {
          inspectionItemId: id,
          ...(options?.dateRange && {
            createdAt: {
              gte: options.dateRange.startDate ? new Date(options.dateRange.startDate) : undefined,
              lte: options.dateRange.endDate ? new Date(options.dateRange.endDate) : undefined
            }
          })
        }
      });

      const totalResults = results.length;
      // ✅ 修正: resultValue プロパティを使用
      const passCount = results.filter(r =>
        r.resultValue === 'PASS' || r.resultValue === 'OK' || r.isPassed === true
      ).length;
      const failCount = totalResults - passCount;

      const statistics: InspectionItemStatistics = {
        period: {
          start: options?.dateRange?.startDate ? new Date(options.dateRange.startDate) : new Date(0),
          end: options?.dateRange?.endDate ? new Date(options.dateRange.endDate) : new Date()
        },
        generatedAt: new Date(),
        usageCount: totalResults,
        passRate: totalResults > 0 ? (passCount / totalResults) * 100 : 0,
        failRate: totalResults > 0 ? (failCount / totalResults) * 100 : 0,
        byVehicleType: {},
        byInspector: {},
        trendData: []
      };

      return statistics;
    } catch (error) {
      logger.error('Failed to get InspectionItem statistics', { id, error });
      throw new DatabaseError('統計情報の取得に失敗しました');
    }
  }

  /**
   * 🔧 WhereClause構築
   */
  private buildWhereClause(filter: InspectionItemFilter): InspectionItemWhereInput {
    const where: InspectionItemWhereInput = {};

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } }
      ];
    }

    if (filter.inspectionType) {
      where.inspectionType = Array.isArray(filter.inspectionType)
        ? { in: filter.inspectionType }
        : filter.inspectionType;
    }

    if (filter.inputType) {
      where.inputType = Array.isArray(filter.inputType)
        ? { in: filter.inputType }
        : filter.inputType;
    }

    if (filter.isRequired !== undefined) {
      where.isRequired = filter.isRequired;
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    return where;
  }

  /**
   * 🔄 ResponseDTO変換
   */
  private toResponseDTO(item: InspectionItemModel): InspectionItemResponseDTO {
    return {
      id: item.id,
      name: item.name,
      inspectionType: item.inspectionType,
      inputType: item.inputType,
      validationRules: item.validationRules,
      displayOrder: item.displayOrder,
      isRequired: item.isRequired,
      isActive: item.isActive,
      description: item.description,
      defaultValue: item.defaultValue,
      helpText: item.helpText,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}

// =====================================
// 🏭 ファクトリ関数
// =====================================

let serviceInstance: InspectionItemService | null = null;

export function getInspectionItemService(prisma?: PrismaClient): InspectionItemService {
  if (!serviceInstance) {
    serviceInstance = new InspectionItemService(prisma || new PrismaClient());
  }
  return serviceInstance;
}
