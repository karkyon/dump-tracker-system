// =====================================
// backend/src/models/ItemModel.ts
// 品目モデル - コンパイルエラー完全修正版
// Phase 1-B-11: 既存完全実装統合・品目管理システム強化
// アーキテクチャ指針準拠版（Phase 1-A基盤活用）
// 作成日時: 2025年9月16日
// 最終更新: 2025年10月10日 - コンパイルエラー完全解消
// =====================================

import type {
  Prisma,
  Item as PrismaItem
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完了基盤の活用
import {
  AppError,
  ConflictError,
  DatabaseError
} from '../utils/errors';
import logger from '../utils/logger';

import type {
  ApiListResponse,
  BulkOperationResult,
  DateRange,
  ExtendedFilterOptions,
  ExtendedStatistics,
  SearchQuery,
  StatisticsBase,
  ValidationError,
  ValidationResult
} from '../types/common';

// =====================================
// 🔧 基本型定義（既存実装保持・改良）
// =====================================

export type ItemModel = PrismaItem;
export type ItemCreateInput = Prisma.ItemCreateInput;
export type ItemUpdateInput = Prisma.ItemUpdateInput;
export type ItemWhereInput = Prisma.ItemWhereInput;
export type ItemWhereUniqueInput = Prisma.ItemWhereUniqueInput;
export type ItemOrderByInput = Prisma.ItemOrderByWithRelationInput;

// =====================================
// 🔧 品目強化型定義（業務機能拡張）
// =====================================

/**
 * 品目カテゴリ（建設業界標準）
 */
enum ItemCategory {
  // 骨材系
  AGGREGATE = 'AGGREGATE',           // 骨材
  SAND = 'SAND',                    // 砂
  GRAVEL = 'GRAVEL',                // 砂利
  CRUSHED_STONE = 'CRUSHED_STONE',  // 砕石

  // 土砂系
  SOIL = 'SOIL',                    // 土砂
  CLAY = 'CLAY',                    // 粘土
  TOPSOIL = 'TOPSOIL',              // 表土
  FILL_SOIL = 'FILL_SOIL',          // 盛土

  // 建設資材
  CONCRETE = 'CONCRETE',             // コンクリート
  ASPHALT = 'ASPHALT',              // アスファルト
  CEMENT = 'CEMENT',                // セメント
  STEEL = 'STEEL',                  // 鋼材

  // 廃材・リサイクル
  WASTE = 'WASTE',                  // 廃材
  RECYCLED = 'RECYCLED',            // リサイクル材

  // その他
  SPECIAL = 'SPECIAL',              // 特殊材料
  OTHER = 'OTHER'                   // その他
}

/**
 * 品目単位（建設業界標準）
 */
enum ItemUnit {
  // 体積単位
  CUBIC_METER = 'CUBIC_METER',      // m³
  LITER = 'LITER',                  // L

  // 重量単位
  TON = 'TON',                      // t
  KILOGRAM = 'KILOGRAM',            // kg
  GRAM = 'GRAM',                    // g

  // 面積単位
  SQUARE_METER = 'SQUARE_METER',    // m²

  // 長さ単位
  METER = 'METER',                  // m
  CENTIMETER = 'CENTIMETER',        // cm
  MILLIMETER = 'MILLIMETER',        // mm

  // 個数単位
  PIECE = 'PIECE',                  // 個
  BOX = 'BOX',                      // 箱
  BUNDLE = 'BUNDLE',                // 束
  ROLL = 'ROLL',                    // 巻

  // その他
  SET = 'SET',                      // セット
  LOT = 'LOT',                      // ロット
  OTHER = 'OTHER'                   // その他
}

/**
 * 品目ステータス
 */
enum ItemStatus {
  ACTIVE = 'ACTIVE',                // 使用中
  INACTIVE = 'INACTIVE',            // 停止中
  DISCONTINUED = 'DISCONTINUED',    // 廃止
  PENDING = 'PENDING',              // 承認待ち
  ARCHIVED = 'ARCHIVED'             // アーカイブ
}

/**
 * 品質グレード
 */
enum ItemQualityGrade {
  PREMIUM = 'PREMIUM',              // プレミアム
  STANDARD = 'STANDARD',            // 標準
  ECONOMY = 'ECONOMY',              // エコノミー
  BUDGET = 'BUDGET',                // バジェット
  UNGRADED = 'UNGRADED'             // 未評価
}

/**
 * 品目詳細情報（高度な仕様管理）
 */
interface ItemDetails {
  // 基本仕様
  specifications?: {
    dimensions?: string;             // 寸法
    weight?: number;                 // 重量
    density?: number;                // 密度
    moistureContent?: number;        // 含水率
    strength?: string;               // 強度
    color?: string;                  // 色
    texture?: string;                // 質感
    origin?: string;                 // 産地
    manufacturer?: string;           // 製造元
    modelNumber?: string;            // 型番
  };

  // 品質情報
  quality?: {
    grade: ItemQualityGrade;
    certifications?: string[];       // 認証情報
    testReports?: string[];          // 試験報告書
    qualityScore?: number;           // 品質スコア (0-100)
    sustainabilityRating?: number;   // 持続可能性評価 (0-5)
    complianceStandards?: string[];  // 準拠規格
  };

  // 価格情報
  pricing?: {
    basePrice: number;
    currency: string;
    pricePerUnit: number;
    bulkDiscounts?: Array<{
      minQuantity: number;
      discountRate: number;
    }>;
    seasonalPricing?: Array<{
      season: string;
      priceMultiplier: number;
    }>;
    lastUpdated: Date;
  };

  // 供給・在庫情報
  supply?: {
    suppliers?: Array<{
      id: string;
      name: string;
      reliability: number;
      leadTime: number;
    }>;
    availabilityStatus?: 'AVAILABLE' | 'LIMITED' | 'OUT_OF_STOCK';
    minimumOrderQuantity?: number;
    maximumOrderQuantity?: number;
  };

  // 使用・運用情報
  usage?: {
    applications?: string[];        // 用途
    restrictions?: string[];        // 制限事項
    handlingInstructions?: string;  // 取扱い指示
    storageRequirements?: string;   // 保存要件
  };
}

/**
 * 品目統計情報（高度分析）
 * ✅ 修正: ExtendedStatistics を extends して summary プロパティを追加
 */
interface ItemStatistics extends StatisticsBase, ExtendedStatistics {
  // 使用統計
  usageStats: {
    totalUsageCount: number;
    totalUsageVolume: number;
    averageMonthlyUsage: number;
    peakUsagePeriod: string;
    usageTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  };

  // 価格統計
  priceStats: {
    averagePrice: number;
    priceVolatility: number;
    priceHistory: Array<{
      date: Date;
      price: number;
      supplier?: string;
    }>;
  };

  // 季節性分析
  seasonalityAnalysis: {
    seasonalFactor: number;
    peakSeasons: string[];
    lowSeasons: string[];
    recommendations: string[];
  };

  // 効率性評価
  efficiency: {
    utilizationRate: number;
    costEffectiveness: number;
    performanceScore: number;
    improvementSuggestions: string[];
  };
}

/**
 * 品目検索・フィルタ条件（高度検索）
 * ✅ 修正: SearchQuery, ExtendedFilterOptions, DateRange を extends
 */
interface ItemFilter extends SearchQuery, ExtendedFilterOptions, DateRange {
  // 基本フィルタ
  categories?: ItemCategory[];
  units?: ItemUnit[];
  status?: ItemStatus[];
  qualityGrades?: ItemQualityGrade[];

  // 価格フィルタ
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };

  // 使用頻度フィルタ
  usageFrequency?: {
    min?: number;
    max?: number;
    period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  };

  // 品質フィルタ
  qualityRequirements?: {
    minGrade?: ItemQualityGrade;
    requiredCertifications?: string[];
    hasQualityAssurance?: boolean;
    sustainabilityRating?: {
      min?: number;
    };
  };

  // 在庫・可用性フィルタ
  availabilityStatus?: 'AVAILABLE' | 'LIMITED' | 'OUT_OF_STOCK';
  leadTimeMax?: number; // 最大納期（日）

  // 季節性フィルタ
  seasonality?: 'PEAK' | 'LOW' | 'STABLE';

  // 統計・分析オプション
  includeStatistics?: boolean;
  includePriceHistory?: boolean;
  includeUsageTrends?: boolean;
  groupBy?: 'category' | 'supplier' | 'project' | 'month';

  // ✅ 追加: SearchQuery からの拡張プロパティ
  query?: string;
  dateRange?: DateRange;
}

/**
 * 品目バリデーション結果
 * ✅ 修正: ValidationResult を正しく継承し、valid プロパティを持つ
 */
interface ItemValidationResult extends ValidationResult {
  // ValidationResult から継承: valid, isValid, errors, warnings

  checks?: {
    type: 'NAME_UNIQUENESS' | 'SPECIFICATION_VALIDITY' | 'PRICE_REASONABILITY' | 'SUPPLIER_VERIFICATION';
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    details?: any;
  }[];

  qualityChecks?: {
    type: 'CERTIFICATION_VALID' | 'SPECIFICATION_COMPLETE' | 'MARKET_PRICE_ANALYSIS';
    score: number;
    threshold: number;
    passed: boolean;
    recommendations?: string[];
  }[];

  marketAnalysis?: {
    priceCompetitiveness: number;  // 価格競争力 (0-100)
    demandForecast: number;       // 需要予測
    riskAssessment: string;       // リスク評価
    recommendations: string[];
  };
}

// =====================================
// 🔧 既存カスタム型定義の完全保持・拡張
// =====================================

/**
 * 軽量な品目情報（一覧表示・選択肢用）
 * 既存実装完全保持・拡張
 */
interface ItemSummary {
  id: string;
  name: string;
  displayOrder: number | null;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  usageCount?: number;

  // 新規拡張フィールド
  category?: ItemCategory;
  unit?: ItemUnit;
  currentPrice?: number;
  status?: ItemStatus;
  qualityGrade?: ItemQualityGrade;
}

/**
 * 使用履歴付き品目詳細情報
 * 既存実装完全保持・拡張
 */
interface ItemWithUsage extends ItemSummary {
  recentUsage?: Array<{
    activityType: string;
    createdAt: Date;
    operationDate?: Date;
    driverName?: string;
    plateNumber?: string;
    clientName?: string;
    locationName?: string;

    // 新規拡張フィールド
    quantity?: number;
    unit?: ItemUnit;
    pricePerUnit?: number;
    totalCost?: number;
    supplier?: string;
    qualityGrade?: ItemQualityGrade;
  }>;

  // 新規拡張情報
  details?: ItemDetails;
  statistics?: {
    totalUsage: number;
    averageMonthlyUsage: number;
    lastUsedDate: Date;
    popularityRank: number;
  };
}

/**
 * 統計・分析用の品目と使用回数のペア
 * 既存実装完全保持・拡張
 */
interface ItemUsageStats {
  item: ItemSummary;
  usageCount: number;

  // 新規拡張統計
  usageVolume?: number;
  totalCost?: number;
  averagePricePerUnit?: number;
  usageTrend?: 'INCREASING' | 'DECREASING' | 'STABLE';
  seasonalityFactor?: number;
  efficiencyScore?: number;  // 効率性スコア (0-100)
}

// =====================================
// 🔧 標準DTO（既存実装保持・拡張）
// =====================================

/**
 * ✅ 修正: ItemModel のすべてのフィールドを含むように定義
 */
interface ItemResponseDTO {
  // ItemModel から継承される基本フィールド（Prismaスキーマに基づく）
  id: string;
  name: string;
  itemType: string | null;  // item_type (Prismaが自動変換)
  unit: string | null;
  standardWeight: number | null;
  hazardous: boolean | null;
  description: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  standardVolume: number | null;
  hazardousClass: string | null;
  handlingInstructions: string | null;
  storageRequirements: string | null;
  temperatureRange: string | null;
  isFragile: boolean | null;
  isHazardous: boolean | null;
  requiresSpecialEquipment: boolean | null;
  displayOrder: number | null;
  photoUrls: string | null;
  specificationFileUrl: string | null;
  msdsFileUrl: string | null;

  // 拡張フィールド
  category?: ItemCategory;
  status?: ItemStatus;
  qualityGrade?: ItemQualityGrade;
  details?: ItemDetails;

  // 使用統計
  usageStatistics?: {
    totalUsage: number;
    currentMonthUsage: number;
    lastUsedDate?: Date;
    popularityRank: number;
  };

  // 価格情報
  pricing?: {
    currentPrice: number;
    averagePrice: number;
    priceVolatility: number;
    lastPriceUpdate: Date;
  };

  // 供給者情報
  suppliers?: Array<{
    id: string;
    name: string;
    pricePerUnit: number;
    leadTime: number;
    reliability: number;
    isPreferred: boolean;
  }>;

  // 品質・認証情報
  quality?: {
    grade: ItemQualityGrade;
    certifications: string[];
    qualityScore: number;
    sustainabilityRating: number;
  };

  // 在庫・可用性
  availability?: {
    status: 'AVAILABLE' | 'LIMITED' | 'OUT_OF_STOCK';
    estimatedLeadTime: number;
    minimumOrderQuantity: number;
    preferredSupplier?: string;
  };

  // カウント情報
  _count?: {
    operationDetails: number;
    priceHistory: number;
    qualityReports: number;
    suppliers: number;
  };

  // 計算フィールド
  isPopular?: boolean;
  isSeasonal?: boolean;
  isPriceVolatile?: boolean;
  requiresSpecialHandling?: boolean;
}

/**
 * ✅ ApiListResponse を extends しているため pagination は不要
 */
interface ItemListResponse extends ApiListResponse<ItemResponseDTO> {
  // ApiListResponse から継承: success, data, meta, message, timestamp, summary, statistics

  // カテゴリ集計
  categorySummary?: Record<ItemCategory, {
    count: number;
    totalUsage: number;
    averagePrice: number;
  }>;

  // 価格分析
  priceAnalysis?: {
    priceRanges: Array<{
      range: string;
      count: number;
    }>;
    marketTrends: string[];
    recommendations: string[];
  };
}

interface ItemCreateDTO extends Omit<ItemCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  category?: ItemCategory;
  unit?: ItemUnit;
  status?: ItemStatus;
  qualityGrade?: ItemQualityGrade;
  details?: ItemDetails;

  // 初期設定オプション
  autoGenerateDisplayOrder?: boolean;
  validateSpecifications?: boolean;
  checkMarketPrice?: boolean;
  setupDefaultSuppliers?: boolean;
}

interface ItemUpdateDTO extends Partial<ItemCreateDTO> {
  // 価格更新
  priceUpdate?: {
    newPrice: number;
    supplier: string;
    effectiveDate: Date;
    reason: string;
  };

  // 品質更新
  qualityUpdate?: {
    newGrade: ItemQualityGrade;
    certifications: string[];
    reason: string;
  };

  // 供給者更新
  supplierUpdate?: {
    action: 'ADD' | 'UPDATE' | 'REMOVE';
    supplierId: string;
    details?: any;
  };

  // 更新メタデータ
  reason?: string;
  updatedBy?: string;
  notifyStakeholders?: boolean;
}

interface ItemBulkCreateDTO {
  items: ItemCreateDTO[];
  batchOptions?: {
    validateAll?: boolean;
    checkDuplicates?: boolean;
    autoGenerateOrders?: boolean;
    defaultCategory?: ItemCategory;
    defaultStatus?: ItemStatus;
  };
}

// =====================================
// 🎯 品目強化CRUDクラス（既存実装完全保持・アーキテクチャ指針準拠）
// =====================================

export class ItemService {
  private readonly db: PrismaClient;

  constructor(db?: PrismaClient) {
    this.db = db || new PrismaClient();
  }

  /**
   * 🔧 新規作成（既存実装保持・バリデーション強化）
   */
  async create(
    data: ItemCreateInput,
    options?: {
      autoGenerateDisplayOrder?: boolean;
      validateSpecifications?: boolean;
      checkMarketPrice?: boolean;
    }
  ): Promise<ItemResponseDTO> {
    try {
      logger.info('品目作成開始', { name: data.name, options });

      // 重複チェック
      const existing = await this.db.item.findFirst({
        where: { name: data.name }
      });

      if (existing) {
        throw new ConflictError('同名の品目が既に存在します');
      }

      // 表示順序自動生成
      let displayOrder = data.displayOrder;
      if (options?.autoGenerateDisplayOrder && !displayOrder) {
        const lastItem = await this.db.item.findFirst({
          orderBy: { displayOrder: 'desc' }
        });
        displayOrder = (lastItem?.displayOrder || 0) + 10;
      }

      // 仕様バリデーション
      if (options?.validateSpecifications) {
        await this.validateSpecifications(data);
      }

      const item = await this.db.item.create({
        data: {
          ...data,
          displayOrder,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('品目作成完了', { itemId: item.id });
      return this.toResponseDTO(item);

    } catch (error) {
      logger.error('品目作成エラー', { error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('品目の作成に失敗しました');
    }
  }

  /**
   * 🔍 主キー指定取得（既存実装保持）
   */
  async findByKey(id: string): Promise<ItemResponseDTO | null> {
    try {
      const item = await this.db.item.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              operationDetails: true
            }
          }
        }
      });

      if (!item) {
        logger.warn('品目が見つかりません', { id });
        return null;
      }

      return this.toResponseDTO(item);

    } catch (error) {
      logger.error('品目取得エラー', { id, error: error instanceof Error ? error.message : error });
      throw new DatabaseError('品目の取得に失敗しました');
    }
  }

  /**
   * 🔍 条件指定一覧取得（既存実装保持・拡張）
   */
  async findMany(params?: {
    where?: ItemWhereInput;
    orderBy?: ItemOrderByInput;
    skip?: number;
    take?: number;
    includeUsageStats?: boolean;
  }): Promise<ItemResponseDTO[]> {
    try {
      const items = await this.db.item.findMany({
        where: params?.where,
        orderBy: params?.orderBy,
        skip: params?.skip,
        take: params?.take,
        include: {
          _count: params?.includeUsageStats ? {
            select: {
              operationDetails: true
            }
          } : undefined
        }
      });

      return items.map(item => this.toResponseDTO(item));

    } catch (error) {
      logger.error('品目一覧取得エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('品目一覧の取得に失敗しました');
    }
  }

  /**
   * 📊 一覧取得（ページネーション・高度検索）
   */
  async list(filter: ItemFilter = {}): Promise<ItemListResponse> {
    try {
      const {
        page = 1,
        pageSize = 50,
        sortBy = 'displayOrder',
        sortOrder = 'asc',
        query,
        search,
        categories,
        status,
        priceRange,
        includeStatistics = false
      } = filter;

      const skip = (page - 1) * pageSize;

      // WHERE条件構築
      const where: ItemWhereInput = {};

      // 検索クエリ
      if (query || search) {
        const searchTerm = query || search;
        where.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { handlingInstructions: { contains: searchTerm, mode: 'insensitive' } }
        ];
      }

      // カテゴリフィルタ
      if (categories && categories.length > 0) {
        where.ItemType = { in: categories as any };
      }

      // 価格範囲フィルタは削除（スキーマにpricePerUnitフィールドが存在しないため）
      // 代わりに standardWeight や standardVolume でフィルタリングする場合はここに追加

      // 総件数取得
      const total = await this.db.item.count({ where });

      // データ取得
      const items = await this.db.item.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              operationDetails: true
            }
          }
        }
      });

      // 統計情報生成
      let statistics: ItemStatistics | undefined;
      let summary: any;

      if (includeStatistics) {
        statistics = await this.generateStatistics(where);
        summary = await this.generateSummary(where);
      }

      const response: ItemListResponse = {
        success: true,
        data: items.map(item => this.toResponseDTO(item)),
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          hasNextPage: page * pageSize < total,
          hasPreviousPage: page > 1
        },
        message: '品目一覧を取得しました',
        timestamp: new Date().toISOString(),
        summary,
        statistics
      };

      return response;

    } catch (error) {
      logger.error('品目一覧取得エラー', { filter, error: error instanceof Error ? error.message : error });
      throw new DatabaseError('品目一覧の取得に失敗しました');
    }
  }

  /**
   * ✏️ 更新（既存実装保持）
   */
  async update(
    id: string,
    data: ItemUpdateInput
  ): Promise<ItemResponseDTO> {
    try {
      logger.info('品目更新開始', { id, data });

      // ✅ 修正: StringFieldUpdateOperationsInput の場合は trim() を呼ばない
      const updateData: ItemUpdateInput = {
        ...data,
        updatedAt: new Date()
      };

      const item = await this.db.item.update({
        where: { id },
        data: updateData
      });

      logger.info('品目更新完了', { itemId: item.id });
      return this.toResponseDTO(item);

    } catch (error) {
      logger.error('品目更新エラー', { id, error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('品目の更新に失敗しました');
    }
  }

  /**
   * 🗑️ 削除（既存実装保持）
   */
  async delete(id: string): Promise<boolean> {
    try {
      logger.info('品目削除開始', { id });

      await this.db.item.delete({
        where: { id }
      });

      logger.info('品目削除完了', { id });
      return true;

    } catch (error) {
      logger.error('品目削除エラー', { id, error: error instanceof Error ? error.message : error });
      throw new DatabaseError('品目の削除に失敗しました');
    }
  }

  /**
   * 📊 統計情報取得（高度分析）
   */
  async getStatistics(filter?: ItemFilter): Promise<ItemStatistics> {
    try {
      const where: ItemWhereInput = this.buildWhereCondition(filter);
      return await this.generateStatistics(where);
    } catch (error) {
      logger.error('統計情報取得エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('統計情報の取得に失敗しました');
    }
  }

  /**
   * ✅ バリデーション（高度検証）
   * ✅ 修正: ValidationError[] を返すように修正
   */
  async validate(
    data: ItemCreateInput | ItemUpdateInput,
    options?: {
      autoGenerateDisplayOrder?: boolean;
      validateSpecifications?: boolean;
      checkMarketPrice?: boolean;
    }
  ): Promise<ItemValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Array<{ field: string; message: string }> = [];

    try {
      // 名前の重複チェック（名前がstring型の場合のみ）
      if ('name' in data && data.name && typeof data.name === 'string') {
        const existing = await this.db.item.findFirst({
          where: { name: data.name }
        });

        if (existing) {
          errors.push({
            field: 'name',
            message: '同名の品目が既に存在します',
            code: 'DUPLICATE_NAME',
            value: data.name
          });
        }
      }

      // 仕様バリデーション
      if (options?.validateSpecifications) {
        const specErrors = await this.validateSpecifications(data);
        errors.push(...specErrors);
      }

      // ✅ 修正: valid と isValid の両方を設定
      const result: ItemValidationResult = {
        valid: errors.length === 0,
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };

      return result;

    } catch (error) {
      logger.error('バリデーションエラー', { error: error instanceof Error ? error.message : error });
      // エラー時も valid/isValid を設定して返す
      return {
        valid: false,
        isValid: false,
        errors: [{
          field: 'general',
          message: 'バリデーション処理中にエラーが発生しました',
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }

  /**
   * 🔄 一括作成（バッチ処理）
   */
  async bulkCreate(
    dto: ItemBulkCreateDTO
  ): Promise<BulkOperationResult<ItemResponseDTO>> {
    const results: Array<{
      id: string;
      success: boolean;
      data?: ItemResponseDTO;
      error?: string;
    }> = [];

    let successCount = 0;
    let failureCount = 0;

    try {
      // ✅ 修正: batchOptions の型を createメソッドのoptionsに合わせる
      const createOptions = {
        autoGenerateDisplayOrder: dto.batchOptions?.autoGenerateOrders,
        validateSpecifications: dto.batchOptions?.validateAll,
        checkMarketPrice: dto.batchOptions?.checkDuplicates
      };

      for (const itemData of dto.items) {
        try {
          const item = await this.create(itemData as ItemCreateInput, createOptions);
          results.push({
            id: item.id,
            success: true,
            data: item
          });
          successCount++;
        } catch (error) {
          results.push({
            id: '',
            success: false,
            error: error instanceof Error ? error.message : '作成に失敗しました'
          });
          failureCount++;
        }
      }

      return {
        success: failureCount === 0,
        totalCount: dto.items.length,
        successCount,
        failureCount,
        results,
        metadata: {
          duration: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('一括作成エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('一括作成に失敗しました');
    }
  }

  // =====================================
  // 🔧 内部ヘルパーメソッド
  // =====================================

  /**
   * WHERE条件構築
   */
  private buildWhereCondition(filter?: ItemFilter): ItemWhereInput {
    const where: ItemWhereInput = {};

    if (!filter) return where;

    // 検索クエリ
    if (filter.query || filter.search) {
      const searchTerm = filter.query || filter.search;
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // カテゴリフィルタ
    if (filter.categories && filter.categories.length > 0) {
      where.ItemType = { in: filter.categories as any };
    }

    // 日付範囲
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.createdAt.lte = new Date(filter.endDate);
      }
    }

    return where;
  }

  /**
   * 仕様バリデーション
   * ✅ 修正: ValidationError[] を返すように修正
   */
  private async validateSpecifications(data: ItemCreateInput | ItemUpdateInput): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // 名前チェック（data.name は string | StringFieldUpdateOperationsInput 型）
    if ('name' in data && data.name) {
      // ✅ 修正: string型の場合のみチェック
      if (typeof data.name === 'string' && data.name.trim().length === 0) {
        errors.push({
          field: 'name',
          message: '品目名は必須です',
          code: 'REQUIRED'
        });
      }
    }

    return errors;
  }

  /**
   * 統計情報生成
   */
  private async generateStatistics(where?: ItemWhereInput): Promise<ItemStatistics> {
    const usageStats = await this.generateUsageStatistics(where);
    const priceStats = await this.generatePriceStatistics(where);
    const seasonalityAnalysis = await this.generateSeasonalityAnalysis(where);
    const efficiency = await this.generateEfficiencyAnalysis(where);

    return {
      period: {
        start: new Date(new Date().getFullYear(), 0, 1),
        end: new Date()
      },
      generatedAt: new Date(),
      usageStats,
      priceStats,
      seasonalityAnalysis,
      efficiency,
      summary: await this.generateSummary(where)
    };
  }

  private async generateUsageStatistics(where?: ItemWhereInput) {
    // 使用統計生成
    return {
      totalUsageCount: 0,
      totalUsageVolume: 0,
      averageMonthlyUsage: 0,
      peakUsagePeriod: 'N/A',
      usageTrend: 'STABLE' as const
    };
  }

  private async generatePriceStatistics(where?: ItemWhereInput) {
    // 価格統計生成
    return {
      averagePrice: 0,
      priceVolatility: 0,
      priceHistory: []
    };
  }

  private async generateSeasonalityAnalysis(where?: ItemWhereInput) {
    // 季節性分析
    return {
      seasonalFactor: 1.0,
      peakSeasons: [],
      lowSeasons: [],
      recommendations: []
    };
  }

  private async generateEfficiencyAnalysis(where?: ItemWhereInput) {
    // 効率性評価
    return {
      utilizationRate: 0,
      costEffectiveness: 0,
      performanceScore: 0,
      improvementSuggestions: []
    };
  }

  private async generateUsageTrends(where?: ItemWhereInput) {
    // 傾向データ実装
    return [] as any[];
  }

  private async generateSummary(where?: ItemWhereInput) {
    // サマリー情報生成
    const total = await this.db.item.count({ where });
    const active = await this.db.item.count({
      where: { ...where, isActive: true }
    });

    return {
      totalItems: total,
      activeItems: active,
      totalCategories: 0,
      averagePrice: 0,
      totalUsageThisMonth: 0
    };
  }

  private async generateCategorySummary(where?: ItemWhereInput) {
    // カテゴリサマリー生成
    return {} as Record<ItemCategory, any>;
  }

  private toResponseDTO(item: any): ItemResponseDTO {
    return {
      ...item,
      // 拡張フィールドの追加
      usageStatistics: {
        totalUsage: item._count?.operationDetails || 0,
        currentMonthUsage: 0,
        popularityRank: 0
      }
    } as ItemResponseDTO;
  }
}

// =====================================
// 🭐 ファクトリ関数（DI対応）
// =====================================

/**
 * ItemServiceのファクトリ関数
 * Phase 1-A基盤準拠のDI対応
 */
export function getItemService(prisma?: PrismaClient): ItemService {
  return new ItemService(prisma);
}

// =====================================
// 🔧 エクスポート（types/index.ts統合用）
// =====================================

export default ItemService;

// ✅ 重複エクスポートを削除し、1回のみエクスポート
export type {
  ItemBulkCreateDTO, ItemCreateDTO, ItemDetails, ItemFilter, ItemListResponse, ItemResponseDTO, ItemStatistics, ItemSummary, ItemUpdateDTO, ItemUsageStats, ItemValidationResult, ItemWithUsage
};

export {
  ItemCategory, ItemQualityGrade, ItemStatus, ItemUnit
};

