// =====================================
// backend/src/models/InspectionItemModel.ts
// 点検項目モデル - 完全アーキテクチャ改修版
// Phase 1-B-8: 既存完全実装統合・点検項目システム強化
// アーキテクチャ指針準拠版（Phase 1-A基盤活用）
// 作成日時: 2025年9月16日
// 更新日時: 2025年9月27日 15:00
// =====================================

import type { 
  InspectionItem as PrismaInspectionItem,
  Prisma,
  InspectionType,
  InputType,
  InspectionItemResult,
  User,
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完了基盤の活用
import logger from '../utils/logger';
import { 
  AppError, 
  ValidationError, 
  NotFoundError,
  DatabaseError,
  ConflictError 
} from '../utils/errors';

import type {
  ApiResponse,
  ApiListResponse,
  PaginationQuery,
  SearchQuery,
  DateRange,
  StatisticsBase,
  ValidationResult,
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
 */
export interface InspectionItemValidationResult extends ValidationResult {
  conflicts?: {
    type: 'DUPLICATE_NAME' | 'INVALID_ORDER' | 'CIRCULAR_DEPENDENCY';
    conflictingItems: string[];
    suggestion: string;
  }[];
  warnings?: {
    type: 'ORDER_GAP' | 'UNUSED_ITEM' | 'DEPRECATED_TYPE';
    message: string;
    itemId: string;
  }[];
}

// =====================================
// 🔧 標準DTO（既存実装保持・拡張）
// =====================================

export interface InspectionItemResponseDTO extends InspectionItemModel {
  category?: InspectionCategory;
  priority?: InspectionPriority;
  status?: InspectionItemStatus;
  options?: InspectionItemOptions;
  statistics?: InspectionItemStatistics;
  relatedItems?: InspectionItemModel[];
  recentResults?: InspectionItemResult[];
  _count?: {
    inspectionRecords: number;
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
  }): Promise<InspectionItemResponseDTO> {
    try {
      // バリデーション実行
      const validation = await this.validateItem(data);
      if (!validation.isValid) {
        throw new ValidationError(
          'バリデーションエラー',
          'inspectionItem',
          data,
          validation.errors.map(e => e.message)
        );
      }

      // 重複チェック（必要な場合）
      if (options?.validateUniqueness !== false) {
        await this.checkDuplicateName(data.name, data.inspectionType);
      }

      // 表示順序の自動生成
      let displayOrder = data.displayOrder;
      if (options?.autoGenerateOrder !== false && !displayOrder) {
        displayOrder = await this.generateNextDisplayOrder(data.inspectionType);
      }

      logger.info('点検項目作成開始', {
        name: data.name,
        inspectionType: data.inspectionType,
        displayOrder
      });

      const item = await this.prisma.inspectionItem.create({
        data: {
          ...data,
          displayOrder,
          isActive: data.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          createdBy: true,
          inspectionRecords: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      // 統計情報の付加
      const enhanced = await this.enhanceWithStatistics(item);

      logger.info('点検項目作成完了', { 
        id: item.id, 
        name: item.name,
        displayOrder: item.displayOrder 
      });

      return enhanced;

    } catch (error) {
      logger.error('点検項目作成エラー', { error, data });
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('点検項目の作成に失敗しました');
    }
  }

  /**
   * 🔧 主キー指定取得（既存実装保持・拡張）
   */
  async findByKey(id: string, options?: {
    includeStatistics?: boolean;
    includeRelated?: boolean;
    includeResults?: boolean;
  }): Promise<InspectionItemResponseDTO | null> {
    try {
      const item = await this.prisma.inspectionItem.findUnique({
        where: { id },
        include: {
          createdBy: true,
          ...(options?.includeResults && {
            inspectionRecords: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                inspectionItemResults: true
              }
            }
          })
        }
      });

      if (!item) {
        return null;
      }

      let enhanced = await this.enhanceWithStatistics(item);

      // 関連項目の追加
      if (options?.includeRelated) {
        enhanced.relatedItems = await this.findRelatedItems(item);
      }

      // 統計情報の追加
      if (options?.includeStatistics) {
        enhanced.statistics = await this.calculateItemStatistics(id);
      }

      return enhanced;

    } catch (error) {
      logger.error('点検項目取得エラー', { error, id });
      throw new DatabaseError('点検項目の取得に失敗しました');
    }
  }

  /**
   * 🔧 条件指定一覧取得（既存実装保持・拡張）
   */
  async findMany(params?: {
    where?: InspectionItemWhereInput;
    orderBy?: InspectionItemOrderByInput;
    skip?: number;
    take?: number;
    includeStatistics?: boolean;
  }): Promise<InspectionItemResponseDTO[]> {
    try {
      const items = await this.prisma.inspectionItem.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { displayOrder: 'asc' },
        skip: params?.skip,
        take: params?.take,
        include: {
          createdBy: true,
          _count: {
            select: {
              inspectionRecords: true
            }
          }
        }
      });

      // 統計情報の付加
      const enhanced = await Promise.all(
        items.map(item => this.enhanceWithStatistics(item))
      );

      // 統計情報を含める場合
      if (params?.includeStatistics) {
        for (const item of enhanced) {
          item.statistics = await this.calculateItemStatistics(item.id);
        }
      }

      return enhanced;

    } catch (error) {
      logger.error('点検項目一覧取得エラー', { error, params });
      throw new DatabaseError('点検項目一覧の取得に失敗しました');
    }
  }

  /**
   * 🔧 ページネーション付き一覧取得（統計・サマリー追加）
   */
  async findManyWithPagination(params: {
    where?: InspectionItemWhereInput;
    orderBy?: InspectionItemOrderByInput;
    page: number;
    pageSize: number;
    includeStatistics?: boolean;
    includeSummary?: boolean;
    includeTemplates?: boolean;
  }): Promise<InspectionItemListResponse> {
    try {
      const { page, pageSize, where, orderBy } = params;
      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        this.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          includeStatistics: params.includeStatistics
        }),
        this.prisma.inspectionItem.count({ where })
      ]);

      const response: InspectionItemListResponse = {
        success: true,
        data,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          hasNextPage: page * pageSize < total,
          hasPreviousPage: page > 1
        },
        timestamp: new Date().toISOString()
      };

      // サマリー情報の追加
      if (params.includeSummary) {
        response.summary = await this.generateSummary(where);
        response.statistics = await this.generateListStatistics(data);
      }

      // テンプレート情報の追加
      if (params.includeTemplates) {
        response.templates = await this.getAvailableTemplates();
      }

      return response;

    } catch (error) {
      logger.error('点検項目ページネーション取得エラー', { error, params });
      throw new DatabaseError('点検項目ページネーション取得に失敗しました');
    }
  }

  /**
   * 🔧 高度な検索機能（フィルタ統合）
   */
  async findByFilter(filter: InspectionItemFilter): Promise<InspectionItemListResponse> {
    try {
      const where = this.buildWhereFromFilter(filter);
      
      return await this.findManyWithPagination({
        where,
        orderBy: this.buildOrderByFromFilter(filter),
        page: filter.page || 1,
        pageSize: filter.limit || 20,
        includeStatistics: true,
        includeSummary: true
      });

    } catch (error) {
      logger.error('点検項目フィルタ検索エラー', { error, filter });
      throw new DatabaseError('点検項目フィルタ検索に失敗しました');
    }
  }

  /**
   * 🔧 更新（バリデーション統合）
   */
  async update(id: string, data: InspectionItemUpdateInput): Promise<InspectionItemResponseDTO> {
    try {
      const existingItem = await this.findByKey(id);
      if (!existingItem) {
        throw new NotFoundError('点検項目が見つかりません', 'InspectionItem', id);
      }

      // バリデーション実行
      const validation = await this.validateItem(data, id);
      if (!validation.isValid) {
        throw new ValidationError(
          'バリデーションエラー',
          'inspectionItem',
          data,
          validation.errors.map(e => e.message)
        );
      }

      const updated = await this.prisma.inspectionItem.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        },
        include: {
          createdBy: true,
          _count: {
            select: { inspectionRecords: true }
          }
        }
      });

      const enhanced = await this.enhanceWithStatistics(updated);

      logger.info('点検項目更新完了', { id, updates: Object.keys(data) });

      return enhanced;

    } catch (error) {
      logger.error('点検項目更新エラー', { error, id, data });
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('点検項目の更新に失敗しました');
    }
  }

  /**
   * 🔧 削除（論理削除・依存関係チェック）
   */
  async delete(id: string, softDelete: boolean = true): Promise<OperationResult> {
    try {
      const item = await this.findByKey(id);
      if (!item) {
        throw new NotFoundError('点検項目が見つかりません', 'InspectionItem', id);
      }

      // 依存関係チェック
      const dependencies = await this.checkDependencies(id);
      if (dependencies.hasActiveReferences && !softDelete) {
        throw new ConflictError(
          '点検項目は使用中のため削除できません',
          { dependencies }
        );
      }

      if (softDelete) {
        // 論理削除
        await this.update(id, { 
          isActive: false,
          status: InspectionItemStatus.ARCHIVED,
          archiveReason: '削除処理による無効化'
        });
      } else {
        // 物理削除
        await this.prisma.inspectionItem.delete({
          where: { id }
        });
      }

      logger.info('点検項目削除完了', { id, softDelete });

      return {
        success: true,
        affectedCount: 1,
        message: softDelete ? '点検項目を無効化しました' : '点検項目を削除しました'
      };

    } catch (error) {
      logger.error('点検項目削除エラー', { error, id });
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('点検項目の削除に失敗しました');
    }
  }

  /**
   * 🔧 一括作成（テンプレート対応）
   */
  async bulkCreate(data: InspectionItemBulkCreateDTO): Promise<BulkOperationResult> {
    try {
      let successCount = 0;
      let failureCount = 0;
      const errors: Array<{ index: number; error: string }> = [];

      logger.info('点検項目一括作成開始', { 
        itemCount: data.items.length,
        templateId: data.templateId 
      });

      for (let i = 0; i < data.items.length; i++) {
        try {
          await this.create(data.items[i], {
            validateUniqueness: !data.skipDuplicates,
            autoGenerateOrder: data.preserveOrder !== false
          });
          successCount++;
        } catch (error) {
          failureCount++;
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : '不明なエラー'
          });
        }
      }

      logger.info('点検項目一括作成完了', { successCount, failureCount });

      return {
        success: failureCount === 0,
        successCount,
        failureCount,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      logger.error('点検項目一括作成エラー', { error, data });
      throw new DatabaseError('点検項目の一括作成に失敗しました');
    }
  }

  /**
   * 🔧 表示順序更新
   */
  async updateDisplayOrder(updates: Array<{ id: string; displayOrder: number }>): Promise<OperationResult> {
    try {
      logger.info('表示順序更新開始', { updateCount: updates.length });

      await this.prisma.$transaction(async (tx) => {
        for (const update of updates) {
          await tx.inspectionItem.update({
            where: { id: update.id },
            data: { 
              displayOrder: update.displayOrder,
              updatedAt: new Date()
            }
          });
        }
      });

      logger.info('表示順序更新完了', { updateCount: updates.length });

      return {
        success: true,
        affectedCount: updates.length,
        message: '表示順序を更新しました'
      };

    } catch (error) {
      logger.error('表示順序更新エラー', { error, updates });
      throw new DatabaseError('表示順序の更新に失敗しました');
    }
  }

  // =====================================
  // 🔍 バリデーション・ビジネスロジック関数
  // =====================================

  /**
   * 点検項目バリデーション
   */
  private async validateItem(
    data: Partial<InspectionItemCreateInput>, 
    excludeId?: string
  ): Promise<InspectionItemValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const conflicts: InspectionItemValidationResult['conflicts'] = [];
    const warnings: InspectionItemValidationResult['warnings'] = [];

    // 必須フィールドチェック
    if (!data.name?.trim()) {
      errors.push({ field: 'name', message: '点検項目名は必須です' });
    }

    if (!data.inspectionType) {
      errors.push({ field: 'inspectionType', message: '点検タイプは必須です' });
    }

    if (!data.inputType) {
      errors.push({ field: 'inputType', message: '入力タイプは必須です' });
    }

    // 名前重複チェック
    if (data.name && data.inspectionType) {
      const existingItem = await this.prisma.inspectionItem.findFirst({
        where: {
          name: data.name,
          inspectionType: data.inspectionType,
          isActive: true,
          ...(excludeId && { id: { not: excludeId } })
        }
      });

      if (existingItem) {
        conflicts.push({
          type: 'DUPLICATE_NAME',
          conflictingItems: [existingItem.id],
          suggestion: '別の名前を使用するか、既存の項目を更新してください'
        });
      }
    }

    // 表示順序の妥当性チェック
    if (data.displayOrder !== undefined && data.displayOrder < 0) {
      errors.push({ field: 'displayOrder', message: '表示順序は0以上である必要があります' });
    }

    return {
      isValid: errors.length === 0 && conflicts.length === 0,
      errors,
      conflicts,
      warnings
    };
  }

  /**
   * 重複名チェック
   */
  private async checkDuplicateName(name: string, inspectionType: InspectionType): Promise<void> {
    const existing = await this.prisma.inspectionItem.findFirst({
      where: {
        name,
        inspectionType,
        isActive: true
      }
    });

    if (existing) {
      throw new ConflictError(
        `点検項目「${name}」は既に存在します`,
        { existingId: existing.id }
      );
    }
  }

  /**
   * 次の表示順序生成
   */
  private async generateNextDisplayOrder(inspectionType: InspectionType): Promise<number> {
    const lastItem = await this.prisma.inspectionItem.findFirst({
      where: {
        inspectionType,
        isActive: true
      },
      orderBy: { displayOrder: 'desc' }
    });

    return (lastItem?.displayOrder || 0) + 10;
  }

  /**
   * 統計情報付加
   */
  private async enhanceWithStatistics(item: any): Promise<InspectionItemResponseDTO> {
    const enhanced: InspectionItemResponseDTO = {
      ...item,
      _count: item._count || { inspectionRecords: 0, results: 0 }
    };

    return enhanced;
  }

  /**
   * 項目統計計算
   */
  private async calculateItemStatistics(itemId: string): Promise<InspectionItemStatistics> {
    const [
      usageCount,
      results
    ] = await Promise.all([
      this.prisma.inspectionRecord.count({
        where: { inspectionItemId: itemId }
      }),
      this.prisma.inspectionRecord.findMany({
        where: { inspectionItemId: itemId },
        include: { inspectionItemResults: true },
        take: 100,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const passCount = results.filter(r => 
      r.inspectionItemResults.some(result => result.status === 'OK')
    ).length;
    
    const failCount = results.filter(r => 
      r.inspectionItemResults.some(result => result.status === 'NG')
    ).length;

    return {
      total: usageCount,
      usageCount,
      passRate: usageCount > 0 ? (passCount / usageCount) * 100 : 0,
      failRate: usageCount > 0 ? (failCount / usageCount) * 100 : 0,
      byVehicleType: {},
      byInspector: {},
      trendData: []
    };
  }

  /**
   * 関連項目検索
   */
  private async findRelatedItems(item: InspectionItemModel): Promise<InspectionItemModel[]> {
    return await this.prisma.inspectionItem.findMany({
      where: {
        inspectionType: item.inspectionType,
        id: { not: item.id },
        isActive: true
      },
      take: 5,
      orderBy: { displayOrder: 'asc' }
    });
  }

  /**
   * 依存関係チェック
   */
  private async checkDependencies(id: string) {
    const activeRecords = await this.prisma.inspectionRecord.count({
      where: { inspectionItemId: id }
    });

    return {
      hasActiveReferences: activeRecords > 0,
      recordCount: activeRecords
    };
  }

  /**
   * フィルタからWhere条件構築
   */
  private buildWhereFromFilter(filter: InspectionItemFilter): InspectionItemWhereInput {
    const where: InspectionItemWhereInput = {};

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search } },
        { description: { contains: filter.search } }
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

    if (filter.displayOrderRange) {
      where.displayOrder = {
        ...(filter.displayOrderRange.min && { gte: filter.displayOrderRange.min }),
        ...(filter.displayOrderRange.max && { lte: filter.displayOrderRange.max })
      };
    }

    return where;
  }

  /**
   * フィルタからOrderBy条件構築
   */
  private buildOrderByFromFilter(filter: InspectionItemFilter): InspectionItemOrderByInput {
    if (filter.sortBy) {
      return {
        [filter.sortBy]: filter.sortOrder || 'asc'
      };
    }
    return { displayOrder: 'asc' };
  }

  /**
   * サマリー情報生成
   */
  private async generateSummary(where?: InspectionItemWhereInput) {
    const [
      total,
      active,
      byCategory,
      byType
    ] = await Promise.all([
      this.prisma.inspectionItem.count({ where }),
      this.prisma.inspectionItem.count({ 
        where: { ...where, isActive: true } 
      }),
      this.getCountsByField('inspectionType', where),
      this.getCountsByField('inputType', where)
    ]);

    return {
      totalItems: total,
      activeItems: active,
      byCategory: {} as Record<InspectionCategory, number>,
      byType: byType as Record<InspectionType, number>,
      byInputType: byCategory as Record<InputType, number>
    };
  }

  /**
   * リスト統計生成
   */
  private async generateListStatistics(items: InspectionItemResponseDTO[]) {
    const usage = items.map(item => item._count?.inspectionRecords || 0);
    const averageUsage = usage.reduce((sum, count) => sum + count, 0) / items.length;

    const sorted = [...items].sort((a, b) => 
      (b._count?.inspectionRecords || 0) - (a._count?.inspectionRecords || 0)
    );

    return {
      averageUsage,
      mostUsedItems: sorted.slice(0, 3),
      leastUsedItems: sorted.slice(-3).reverse()
    };
  }

  /**
   * フィールド別カウント
   */
  private async getCountsByField(field: string, where?: InspectionItemWhereInput) {
    const results = await this.prisma.inspectionItem.groupBy({
      by: [field as any],
      where,
      _count: { [field]: true }
    });

    return results.reduce((acc, result) => {
      acc[result[field as keyof typeof result] as string] = result._count[field as keyof typeof result._count];
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * 利用可能テンプレート取得
   */
  private async getAvailableTemplates(): Promise<InspectionItemTemplate[]> {
    // TODO: テンプレート機能の実装
    return [];
  }
}

// =====================================
// 🏭 ファクトリ関数（DI対応）
// =====================================

/**
 * InspectionItemServiceのファクトリ関数
 * Phase 1-A基盤準拠のDI対応
 */
export function getInspectionItemService(prisma: PrismaClient): InspectionItemService {
  return new InspectionItemService(prisma);
}

// =====================================
// 🔧 エクスポート（types/index.ts統合用）
// =====================================

export default InspectionItemService;

// 点検項目機能追加エクスポート
export type {
  InspectionItemOptions,
  InspectionItemTemplate,
  InspectionItemStatistics,
  InspectionItemFilter,
  InspectionItemValidationResult,
  InspectionItemBulkCreateDTO
};

export {
  InspectionCategory,
  InspectionPriority,
  InspectionItemStatus
};