// =====================================
// backend/src/models/MaintenanceRecordModel.ts
// メンテナンス記録モデル - 完全アーキテクチャ改修版
// Phase 1-B-12: 既存完全実装統合・メンテナンス管理システム強化
// アーキテクチャ指針準拠版(Phase 1-A基盤活用)
// 作成日時: 2025年9月16日
// 更新日時: 2025年10月6日 - コンパイルエラー完全修正版
// =====================================

import type {
  MaintenanceRecord as PrismaMaintenanceRecord,
  Prisma,
  User,
  Vehicle,
  MaintenanceType,
  MaintenanceStatus
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完了基盤の活用
import logger from '../utils/logger';
import {
  AppError,
  ValidationError as AppValidationError,
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
  ValidationError,
  ValidationResult,
  OperationResult,
  BulkOperationResult
} from '../types/common';

// =====================================
// 🔧 基本型定義(既存実装保持・改良)
// =====================================

export type MaintenanceRecordModel = PrismaMaintenanceRecord;
export type MaintenanceRecordCreateInput = Prisma.MaintenanceRecordCreateInput;
export type MaintenanceRecordUpdateInput = Prisma.MaintenanceRecordUpdateInput;
export type MaintenanceRecordWhereInput = Prisma.MaintenanceRecordWhereInput;
export type MaintenanceRecordWhereUniqueInput = Prisma.MaintenanceRecordWhereUniqueInput;
export type MaintenanceRecordOrderByInput = Prisma.MaintenanceRecordOrderByWithRelationInput;

// =====================================
// 🔧 メンテナンス強化型定義(業務機能拡張)
// =====================================

/**
 * メンテナンス種別(業界標準拡張)
 */
export enum MaintenanceCategory {
  // 法定点検・車検
  LEGAL_INSPECTION = 'LEGAL_INSPECTION',
  VEHICLE_INSPECTION = 'VEHICLE_INSPECTION',
  PERIODIC_INSPECTION = 'PERIODIC_INSPECTION',

  // 予防保全
  PREVENTIVE = 'PREVENTIVE',
  SCHEDULED = 'SCHEDULED',
  TIME_BASED = 'TIME_BASED',
  CONDITION_BASED = 'CONDITION_BASED',

  // 事後保全
  CORRECTIVE = 'CORRECTIVE',
  EMERGENCY = 'EMERGENCY',
  BREAKDOWN = 'BREAKDOWN',

  // 改良・改造
  MODIFICATION = 'MODIFICATION',
  UPGRADE = 'UPGRADE',
  RETROFIT = 'RETROFIT',

  // その他
  ROUTINE = 'ROUTINE',
  SAFETY = 'SAFETY',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
  OTHER = 'OTHER'
}

/**
 * メンテナンス優先度
 */
export enum MaintenancePriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * 部品カテゴリ
 */
export enum PartCategory {
  ENGINE = 'ENGINE',
  TRANSMISSION = 'TRANSMISSION',
  BRAKE = 'BRAKE',
  SUSPENSION = 'SUSPENSION',
  ELECTRICAL = 'ELECTRICAL',
  TIRE = 'TIRE',
  BODY = 'BODY',
  INTERIOR = 'INTERIOR',
  FLUID = 'FLUID',
  FILTER = 'FILTER',
  CONSUMABLE = 'CONSUMABLE',
  OTHER = 'OTHER'
}

// =====================================
// 🔧 拡張型定義(企業レベル機能)
// =====================================

/**
 * メンテナンス詳細情報(高度な業務情報)
 */
export interface MaintenanceDetails {
  // 作業詳細
  workDescription?: string;
  rootCauseAnalysis?: string;
  correctiveActions?: string[];
  preventiveActions?: string[];

  // 品質管理
  qualityChecks?: Array<{
    checkType: string;
    result: 'PASS' | 'FAIL';
    inspector: string;
    notes?: string;
  }>;
  safetyMeasures?: string[];
  complianceRequirements?: string[];
  certificationRequired?: boolean;

  // 部品・材料
  partsUsed?: Array<{
    partNumber: string;
    partName: string;
    category: PartCategory;
    quantity: number;
    unitCost: number;
    totalCost: number;
    supplier?: string;
    warrantyPeriod?: number;
  }>;

  // コスト詳細
  laborCost?: number;
  partsCost?: number;
  overheadCost?: number;
  totalCost: number;

  // 関係者情報
  technicians?: Array<{
    userId: string;
    name: string;
    role: string;
    hoursWorked: number;
  }>;
  supervisor?: {
    userId: string;
    name: string;
  };

  // 文書・写真
  attachments?: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    uploadDate: Date;
    description?: string;
  }>;
  beforePhotos?: string[];
  afterPhotos?: string[];

  // フォローアップ
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  warrantyInformation?: {
    provider: string;
    period: number;
    conditions: string;
  };
}

/**
 * メンテナンス統計情報(高度分析)
 */
export interface MaintenanceStatistics extends StatisticsBase {
  // 基本統計
  totalRecords: number;
  completedRecords: number;
  pendingRecords: number;
  totalCost: number;
  averageCost: number;

  // 時間統計
  averageDowntime?: number;
  totalDowntime?: number;
  averageRepairTime?: number;

  // 効率性指標
  plannedVsActualTime?: {
    plannedHours: number;
    actualHours: number;
    efficiency: number;
  };
  firstTimeFixRate?: number;
  repeatFailureRate?: number;

  // コスト分析
  costBreakdown?: {
    labor: number;
    parts: number;
    overhead: number;
    emergency: number;
  };
  costTrends?: Array<{
    period: string;
    totalCost: number;
    averageCost: number;
  }>;

  // 故障分析
  failureAnalysis?: {
    topFailureModes: Array<{
      mode: string;
      count: number;
      totalCost: number;
    }>;
    mtbf?: number;
    mttr?: number;
    availability?: number;
  };

  // カテゴリ別分析
  categoryBreakdown?: Record<MaintenanceCategory, {
    count: number;
    totalCost: number;
    averageCost: number;
    averageDuration: number;
  }>;

  // 予測分析
  predictiveInsights?: {
    upcomingMaintenanceCount: number;
    budgetForecast: number;
    riskAssessment: string;
    recommendations: string[];
  };
}

/**
 * メンテナンス検索・フィルタ条件(高度検索)
 */
export interface MaintenanceFilter extends SearchQuery, PaginationQuery {
  // 基本フィルタ
  vehicleIds?: string[];
  categories?: MaintenanceCategory[];
  priorities?: MaintenancePriority[];
  statuses?: MaintenanceStatus[];

  // 日付フィルタ
  scheduledDateRange?: DateRange;
  completedDateRange?: DateRange;

  // コストフィルタ
  costRange?: {
    min?: number;
    max?: number;
  };

  // 関係者フィルタ
  technicianIds?: string[];
  supervisorIds?: string[];
  vendorNames?: string[];

  // 状態フィルタ
  isOverdue?: boolean;
  hasWarranty?: boolean;
  requiresFollowUp?: boolean;

  // 部品フィルタ
  partCategories?: PartCategory[];
  partNumbers?: string[];

  // 統計・分析オプション
  includeStatistics?: boolean;
  includeCostAnalysis?: boolean;
  includeFailureAnalysis?: boolean;
  groupBy?: 'vehicle' | 'category' | 'technician' | 'month' | 'quarter';
}

/**
 * メンテナンス予測結果
 */
export interface MaintenancePrediction {
  vehicleId: string;
  predictedMaintenanceDate: Date;
  confidence: number;
  maintenanceType: MaintenanceCategory;
  estimatedCost: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  basedOnFactors: string[];
  recommendations: string[];
}

/**
 * メンテナンスバリデーション結果
 */
export interface MaintenanceValidationResult extends ValidationResult {
  valid: boolean;
  checks?: {
    type: 'SCHEDULE_CONFLICT' | 'RESOURCE_AVAILABILITY' | 'COST_REASONABILITY' | 'COMPLIANCE_CHECK';
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    details?: any;
  }[];

  complianceChecks?: {
    requirement: string;
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
    notes?: string;
  }[];

  resourceAnalysis?: {
    technicianAvailability: boolean;
    partsAvailability: boolean;
    equipmentAvailability: boolean;
    estimatedWaitTime?: number;
  };

  warnings?: Array<{ field: string; message: string }>;
}

// =====================================
// 🔧 標準DTO(既存実装保持・拡張)
// =====================================

export interface MaintenanceRecordResponseDTO extends MaintenanceRecordModel {
  // 関連データ
  vehicle?: {
    id: string;
    plateNumber: string;
    model: string;
    manufacturer: string;
  };

  technician?: {
    id: string;
    name: string;
    role: string;
  };

  // 拡張情報
  details?: MaintenanceDetails;

  // 計算フィールド
  duration?: number;
  isOverdue?: boolean;
  daysUntilDue?: number;
  costEfficiency?: number;

  // 統計情報
  relatedRecords?: {
    previousMaintenanceCount: number;
    averageInterval: number;
    lastMaintenanceDate?: Date;
  };

  // カウント情報
  _count?: {
    partsUsed: number;
    qualityChecks: number;
    attachments: number;
  };
}

export interface MaintenanceRecordListResponse extends ApiListResponse<MaintenanceRecordResponseDTO> {
  // ApiListResponseが既にsummaryを持っているため、型を拡張
  summary?: {
    totalRecords: number;
    completedRecords: number;
    pendingRecords: number;
    overdueRecords: number;
    totalCost: number;
    averageCost: number;
  };

  // カテゴリ集計
  categoryBreakdown?: Record<MaintenanceCategory, {
    count: number;
    totalCost: number;
    averageCost: number;
  }>;

  // 優先度集計
  priorityBreakdown?: Record<MaintenancePriority, {
    count: number;
    averageDuration: number;
  }>;

  // コスト分析
  costAnalysis?: {
    monthlyTrends: Array<{
      month: string;
      totalCost: number;
      recordCount: number;
    }>;
    topExpensiveTypes: Array<{
      category: MaintenanceCategory;
      totalCost: number;
      averageCost: number;
    }>;
  };
}

export interface MaintenanceRecordCreateDTO extends Omit<MaintenanceRecordCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // 拡張フィールド
  details?: MaintenanceDetails;

  // 作業指示オプション
  autoSchedule?: boolean;
  notifyTechnicians?: boolean;
  generateWorkOrder?: boolean;
  estimateCost?: boolean;
}

export interface MaintenanceRecordUpdateDTO extends Partial<MaintenanceRecordCreateDTO> {
  // 進捗管理
  progressUpdate?: {
    status: MaintenanceStatus;
    completionPercentage: number;
    notes: string;
    updatedBy: string;
  };

  // コスト更新
  costUpdate?: {
    laborCost: number;
    partsCost: number;
    overheadCost: number;
    reason: string;
  };

  // 品質管理
  qualityAssurance?: {
    inspectionResults: Array<{
      checkType: string;
      result: 'PASS' | 'FAIL';
      notes?: string;
    }>;
    certificationRequired: boolean;
    inspectedBy: string;
  };
}

export interface MaintenanceBulkCreateDTO {
  records: MaintenanceRecordCreateDTO[];
  batchOptions?: {
    validateScheduling?: boolean;
    checkResourceAvailability?: boolean;
    autoAssignTechnicians?: boolean;
    generateWorkOrders?: boolean;
  };
}

// =====================================
// 🎯 メンテナンス強化CRUDクラス(既存実装完全保持・アーキテクチャ指針準拠)
// =====================================

export class MaintenanceRecordService {
  private readonly db: PrismaClient;

  constructor(db?: PrismaClient) {
    this.db = db || new PrismaClient();
  }

  /**
   * 🔧 新規作成(既存実装保持・バリデーション強化)
   */
  async create(
    data: MaintenanceRecordCreateInput,
    options?: {
      validateScheduling?: boolean;
      checkResourceAvailability?: boolean;
      generateWorkOrder?: boolean;
    }
  ): Promise<MaintenanceRecordResponseDTO> {
    try {
      // バリデーション
      await this.validateCreate(data, options);

      // メンテナンス記録作成
      const record = await this.db.maintenanceRecord.create({
        data,
        include: {
          vehicles: true,
          users: true
        }
      });

      logger.info(`メンテナンス記録作成成功: ${record.id}`);

      return this.toResponseDTO(record);
    } catch (error) {
      logger.error('メンテナンス記録作成エラー:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('メンテナンス記録の作成に失敗しました');
    }
  }

  /**
   * 🔧 ID検索(既存実装保持)
   */
  async findById(id: string): Promise<MaintenanceRecordResponseDTO> {
    try {
      const record = await this.db.maintenanceRecord.findUnique({
        where: { id },
        include: {
          vehicles: true,
          users: true
        }
      });

      if (!record) {
        throw new NotFoundError('メンテナンス記録', id);
      }

      return this.toResponseDTO(record);
    } catch (error) {
      logger.error('メンテナンス記録取得エラー:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('メンテナンス記録の取得に失敗しました');
    }
  }

  /**
   * 🔧 リスト取得(既存実装保持・フィルタ強化)
   */
  async findMany(filter: MaintenanceFilter = {}): Promise<MaintenanceRecordListResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        ...otherFilters
      } = filter;

      const skip = (page - 1) * limit;
      const where = this.buildWhereClause(filter);
      const orderBy = this.buildOrderByClause(sortBy, sortOrder);

      const [records, total] = await Promise.all([
        this.db.maintenanceRecord.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            vehicles: true,
            users: true
          }
        }),
        this.db.maintenanceRecord.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      // サマリー生成
      const summary = await this.generateSummary(where);

      return {
        success: true,
        data: records.map(r => this.toResponseDTO(r)),
        meta: {
          total,
          page,
          pageSize: limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        timestamp: new Date().toISOString(),
        summary
      };
    } catch (error) {
      logger.error('メンテナンス記録リスト取得エラー:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('メンテナンス記録リストの取得に失敗しました');
    }
  }

  /**
   * 🔧 更新(既存実装保持)
   */
  async update(
    id: string,
    data: MaintenanceRecordUpdateInput
  ): Promise<MaintenanceRecordResponseDTO> {
    try {
      // 存在確認
      const existing = await this.db.maintenanceRecord.findUnique({
        where: { id }
      });

      if (!existing) {
        throw new NotFoundError('メンテナンス記録', id);
      }

      // 更新実行
      const record = await this.db.maintenanceRecord.update({
        where: { id },
        data,
        include: {
          vehicles: true,
          users: true
        }
      });

      logger.info(`メンテナンス記録更新成功: ${id}`);

      return this.toResponseDTO(record);
    } catch (error) {
      logger.error('メンテナンス記録更新エラー:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('メンテナンス記録の更新に失敗しました');
    }
  }

  /**
   * 🔧 削除(既存実装保持)
   */
  async delete(id: string): Promise<OperationResult> {
    try {
      // 存在確認
      const existing = await this.db.maintenanceRecord.findUnique({
        where: { id }
      });

      if (!existing) {
        throw new NotFoundError('メンテナンス記録', id);
      }

      // 削除実行
      await this.db.maintenanceRecord.delete({
        where: { id }
      });

      logger.info(`メンテナンス記録削除成功: ${id}`);

      return {
        success: true,
        message: 'メンテナンス記録を削除しました'
      };
    } catch (error) {
      logger.error('メンテナンス記録削除エラー:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('メンテナンス記録の削除に失敗しました');
    }
  }

  /**
   * 🔧 件数取得(既存実装保持)
   */
  async count(where?: MaintenanceRecordWhereInput): Promise<number> {
    try {
      return await this.db.maintenanceRecord.count({ where });
    } catch (error) {
      logger.error('メンテナンス記録件数取得エラー:', error);
      throw new DatabaseError('メンテナンス記録件数の取得に失敗しました');
    }
  }

  /**
   * 🔧 統計情報取得(既存実装保持・拡張)
   */
  async getStatistics(filter?: MaintenanceFilter): Promise<MaintenanceStatistics> {
    try {
      const where = filter ? this.buildWhereClause(filter) : undefined;

      const [total, records] = await Promise.all([
        this.count(where),
        this.db.maintenanceRecord.findMany({
          where,
          select: {
            status: true,
            cost: true,
            scheduledDate: true,
            completedDate: true
          }
        })
      ]);

      const completed = records.filter(r => r.status === 'COMPLETED').length;
      const pending = total - completed;
      const totalCost = records.reduce((sum, r) => sum + (r.cost ? Number(r.cost) : 0), 0);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      return {
        totalRecords: total,
        completedRecords: completed,
        pendingRecords: pending,
        totalCost,
        averageCost: total > 0 ? totalCost / total : 0,
        period: {
          start: startOfMonth,
          end: now
        },
        generatedAt: now
      };
    } catch (error) {
      logger.error('メンテナンス統計取得エラー:', error);
      throw new DatabaseError('メンテナンス統計の取得に失敗しました');
    }
  }

  /**
   * 🔧 一括作成(既存実装保持)
   */
  async bulkCreate(dto: MaintenanceBulkCreateDTO): Promise<BulkOperationResult> {
    try {
      const results: Array<{ id: string; success: boolean; data?: any; error?: string }> = [];
      const errors: ValidationError[] = [];

      // ✅ for...of ループを使用してundefinedの可能性を排除
      let index = 0;
      for (const recordData of dto.records) {
        try {
          const record = await this.create(recordData as any);
          results.push({
            id: record.id,
            success: true,
            data: record
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          results.push({
            id: `record-${index}`,
            success: false,
            error: errorMessage
          });
          errors.push({
            field: `records[${index}]`,
            message: errorMessage
          });
        }
        index++;
      }

      return {
        success: errors.length === 0,
        totalCount: dto.records.length,
        successCount: results.filter(r => r.success).length,
        failureCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          duration: 0,
          timestamp: new Date()
        }
      };
    } catch (error) {
      logger.error('メンテナンス一括作成エラー:', error);
      throw new DatabaseError('メンテナンス記録の一括作成に失敗しました');
    }
  }

  /**
   * 🔧 バリデーション(既存実装保持・強化)
   */
  async validateBulkCreate(dto: MaintenanceBulkCreateDTO): Promise<MaintenanceValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // ✅ for...of ループを使用してundefinedの可能性を排除
    let index = 0;
    for (const record of dto.records) {
      // 車両IDチェック(リレーション経由)
      if (!record.vehicles) {
        errors.push({
          field: `records[${index}].vehicles`,
          message: '車両情報が必要です'
        });
      }

      // 日付チェック
      if (record.scheduledDate && record.completedDate) {
        const scheduled = new Date(record.scheduledDate);
        const completed = new Date(record.completedDate);
        if (scheduled > completed) {
          errors.push({
            field: `records[${index}].scheduledDate`,
            message: '予定日は完了日より前である必要があります'
          });
        }
      }

      // 重複チェック(車両と予定日の組み合わせ)
      if (record.vehicles && record.scheduledDate) {
        const vehicleConnect = (record.vehicles as any).connect;
        if (vehicleConnect?.id) {
          const existing = await this.db.maintenanceRecord.findFirst({
            where: {
              vehicleId: vehicleConnect.id,
              scheduledDate: new Date(record.scheduledDate)
            }
          });

          if (existing) {
            warnings.push({
              field: `records[${index}]`,
              message: `同じ車両・日付のメンテナンス記録が既に存在します`
            });
          }
        }
      }

      index++;
    }

    return {
      isValid: errors.length === 0,
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // =====================================
  // 🔧 プライベートヘルパーメソッド
  // =====================================

  private buildWhereClause(filter: MaintenanceFilter): MaintenanceRecordWhereInput {
    const where: MaintenanceRecordWhereInput = {};

    // 検索クエリ
    if (filter.search) {
      where.OR = [
        { description: { contains: filter.search, mode: 'insensitive' } },
        { vendorName: { contains: filter.search, mode: 'insensitive' } }
      ];
    }

    // 車両フィルタ
    if (filter.vehicleIds && filter.vehicleIds.length > 0) {
      where.vehicleId = { in: filter.vehicleIds };
    }

    // ステータスフィルタ
    if (filter.statuses && filter.statuses.length > 0) {
      where.status = { in: filter.statuses };
    }

    // 日付範囲フィルタ
    if (filter.scheduledDateRange) {
      where.scheduledDate = {};
      if (filter.scheduledDateRange.startDate) {
        where.scheduledDate.gte = new Date(filter.scheduledDateRange.startDate);
      }
      if (filter.scheduledDateRange.endDate) {
        where.scheduledDate.lte = new Date(filter.scheduledDateRange.endDate);
      }
    }

    // コスト範囲フィルタ
    if (filter.costRange) {
      where.cost = {};
      if (filter.costRange.min !== undefined) {
        where.cost.gte = filter.costRange.min;
      }
      if (filter.costRange.max !== undefined) {
        where.cost.lte = filter.costRange.max;
      }
    }

    // ベンダーフィルタ
    if (filter.vendorNames && filter.vendorNames.length > 0) {
      where.vendorName = { in: filter.vendorNames };
    }

    return where;
  }

  private buildOrderByClause(
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): MaintenanceRecordOrderByInput {
    const order = sortOrder || 'desc';

    switch (sortBy) {
      case 'scheduledDate':
        return { scheduledDate: order };
      case 'completedDate':
        return { completedDate: order };
      case 'cost':
        return { cost: order };
      case 'status':
        return { status: order };
      default:
        return { createdAt: order };
    }
  }

  private async validateCreate(
    data: MaintenanceRecordCreateInput,
    options?: {
      validateScheduling?: boolean;
      checkResourceAvailability?: boolean;
    }
  ): Promise<void> {
    // 車両存在確認(リレーション経由)
    const vehicleConnect = (data.vehicles as any)?.connect;
    if (vehicleConnect?.id) {
      const vehicle = await this.db.vehicle.findUnique({
        where: { id: vehicleConnect.id }
      });
      if (!vehicle) {
        throw new AppValidationError('指定された車両が存在しません', 'vehicles');
      }
    }

    // スケジュール検証
    if (options?.validateScheduling && data.scheduledDate && vehicleConnect?.id) {
      const conflicts = await this.db.maintenanceRecord.findMany({
        where: {
          vehicleId: vehicleConnect.id,
          scheduledDate: new Date(data.scheduledDate),
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
        }
      });

      if (conflicts.length > 0) {
        throw new ConflictError('指定日時に既にメンテナンスが予定されています');
      }
    }
  }

  private async generateSummary(where?: MaintenanceRecordWhereInput) {
    const total = await this.count(where);

    const statusCounts = await this.db.maintenanceRecord.groupBy({
      by: ['status'],
      where,
      _count: { status: true }
    });

    const completed = statusCounts.find(s => s.status === 'COMPLETED')?._count.status || 0;
    const pending = total - completed;

    const costData = await this.db.maintenanceRecord.aggregate({
      where,
      _sum: { cost: true },
      _avg: { cost: true }
    });

    return {
      totalRecords: total,
      completedRecords: completed,
      pendingRecords: pending,
      overdueRecords: 0,
      totalCost: Number(costData._sum.cost || 0),
      averageCost: Number(costData._avg.cost || 0)
    };
  }

  private async generateCategoryBreakdown(where?: MaintenanceRecordWhereInput) {
    return {} as Record<MaintenanceCategory, any>;
  }

  private toResponseDTO(record: any): MaintenanceRecordResponseDTO {
    return {
      ...record,
      vehicle: record.vehicles,
      technician: record.users,
      duration: this.calculateDuration(record),
      isOverdue: this.checkOverdue(record),
      daysUntilDue: this.calculateDaysUntilDue(record)
    } as MaintenanceRecordResponseDTO;
  }

  private calculateDuration(record: any): number {
    return 0;
  }

  private checkOverdue(record: any): boolean {
    return false;
  }

  private calculateDaysUntilDue(record: any): number {
    return 0;
  }
}

// =====================================
// 🎯 ファクトリ関数(DI対応)
// =====================================

/**
 * MaintenanceRecordServiceのファクトリ関数
 * Phase 1-A基盤準拠のDI対応
 */
export function getMaintenanceRecordService(prisma?: PrismaClient): MaintenanceRecordService {
  return new MaintenanceRecordService(prisma);
}

// =====================================
// 🔧 エクスポート(types/index.ts統合用)
// =====================================

export default MaintenanceRecordService;
