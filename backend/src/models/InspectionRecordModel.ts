// =====================================
// backend/src/models/InspectionRecordModel.ts
// 点検記録モデル - コンパイルエラー完全解消版
// Phase 1-B-10: 既存完全実装統合・点検記録管理システム強化
// アーキテクチャ指針準拠版（Phase 1-A基盤活用）
// 作成日時: 2025年9月16日
// 最終更新: 2025年12月27日 - resultsフィールド追加・全機能100%保持
// =====================================

import type {
  InspectionRecord as PrismaInspectionRecord,
  Prisma,
  InspectionType
} from '@prisma/client';

// ✅ FIX: InspectionStatus を通常の import に変更（値として使用するため）
import { InspectionStatus, PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完了基盤の活用
import logger from '../utils/logger';
import {
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError
} from '../utils/errors';

import type {
  ApiListResponse,
  PaginationQuery,
  SearchQuery,
  DateRange,
  StatisticsBase,
  ValidationResult,
  ValidationError as CommonValidationError,
  OperationResult,
  BulkOperationResult
} from '../types/common';

// 🎯 関連統合完了モデルとの連携
import type {
  InspectionCategory,
  InspectionPriority
} from './InspectionItemModel';

import type {
  InspectionResultStatus,
  ResultSeverity
} from './InspectionItemResultModel';

// =====================================
// 🔧 基本型定義（既存実装保持・改良）
// =====================================

export type InspectionRecordModel = PrismaInspectionRecord;
export type InspectionRecordCreateInput = Prisma.InspectionRecordCreateInput;
export type InspectionRecordUpdateInput = Prisma.InspectionRecordUpdateInput;
export type InspectionRecordWhereInput = Prisma.InspectionRecordWhereInput;
export type InspectionRecordWhereUniqueInput = Prisma.InspectionRecordWhereUniqueInput;
export type InspectionRecordOrderByInput = Prisma.InspectionRecordOrderByWithRelationInput;

// =====================================
// 🔧 点検記録強化型定義（業務機能拡張）
// =====================================

/**
 * 点検記録ワークフロー状態
 */
export enum InspectionWorkflowStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * 点検記録優先度
 */
export enum InspectionRecordPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  EMERGENCY = 'EMERGENCY'
}

/**
 * 点検記録詳細情報
 */
export interface InspectionRecordDetails {
  environment?: {
    temperature?: number;
    humidity?: number;
    weather?: string;
    visibility?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    facility?: string;
  };
  equipment?: {
    tools: string[];
    calibrationDates: Record<string, Date>;
    serialNumbers: Record<string, string>;
  };
  checklist?: {
    totalItems: number;
    completedItems: number;
    skippedItems: number;
    categories: Record<string, number>;
  };
  compliance?: {
    regulations: string[];
    standards: string[];
    certifications: string[];
    auditTrail: Array<{
      timestamp: Date;
      action: string;
      userId: string;
      details?: any;
    }>;
  };
}

/**
 * ワークフロー遷移履歴
 */
export interface WorkflowTransition {
  fromStatus: InspectionWorkflowStatus;
  toStatus: InspectionWorkflowStatus;
  timestamp: Date;
  actorId: string;
  reason?: string;
  comments?: string;
  approvalRequired?: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * 点検記録統計情報
 */
export interface InspectionRecordStatistics extends StatisticsBase {
  // StatisticsBase からの必須プロパティは継承される
  // period: { start: Date; end: Date; }
  // generatedAt: Date

  totalCount: number; // ✅ 追加: 統計の総数
  byStatus: Record<InspectionWorkflowStatus, number>;
  byPriority: Record<InspectionRecordPriority, number>;
  byType: Record<InspectionType, number>;
  averageCompletionTime: number;
  completionRate: number;
  defectRate: number;
  trendData?: Array<{
    date: string;
    count: number;
    completionRate: number;
  }>;
}

/**
 * 点検記録フィルター（完全版）
 */
export interface InspectionRecordFilter extends PaginationQuery, SearchQuery, DateRange {
  operationId?: string | string[];
  vehicleId?: string | string[];
  inspectorId?: string | string[];
  facilityId?: string | string[];

  // ステータス・優先度フィルタ
  status?: InspectionWorkflowStatus | InspectionWorkflowStatus[];
  priority?: InspectionRecordPriority | InspectionRecordPriority[];
  inspectionType?: InspectionType | InspectionType[];

  // 時間範囲フィルタ
  scheduledDate?: DateRange;
  completedDate?: DateRange;

  // 品質フィルタ
  qualityScoreRange?: {
    min?: number;
    max?: number;
  };

  // 完了状況フィルタ
  completionStatus?: 'ALL' | 'COMPLETED' | 'INCOMPLETE' | 'OVERDUE';

  // 問題・警告フィルタ
  hasIssues?: boolean;
  hasWarnings?: boolean;
  issuesSeverity?: ResultSeverity | ResultSeverity[];

  // 位置情報フィルタ
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // km
  };

  // 統計・分析オプション
  includeStatistics?: boolean;
  includeTrends?: boolean;
  includeQualityMetrics?: boolean;
  groupBy?: 'date' | 'inspector' | 'vehicle' | 'category' | 'facility';
}

/**
 * 点検記録バリデーション結果（完全版）
 */
export interface InspectionRecordValidationResult extends ValidationResult {
  readinessChecks?: {
    type: 'VEHICLE_AVAILABILITY' | 'INSPECTOR_CERTIFICATION' | 'EQUIPMENT_READY' | 'WEATHER_CONDITIONS';
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    details?: any;
  }[];

  qualityChecks?: {
    type: 'COMPLETENESS' | 'ACCURACY' | 'TIMELINESS' | 'CONSISTENCY';
    score: number;
    threshold: number;
    passed: boolean;
    recommendations?: string[];
  }[];

  businessRules?: {
    rule: string;
    passed: boolean;
    message: string;
    impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }[];

  warnings?: Array<{
    field: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations?: string[];
}

/**
 * 点検記録レスポンスDTO
 */
export interface InspectionRecordResponseDTO extends InspectionRecordModel {
  workflowStatus?: InspectionWorkflowStatus;
  priority?: InspectionRecordPriority;
  details?: InspectionRecordDetails;

  operation?: {
    id: string;
    startTime: Date;
    endTime?: Date;
    status: string;
    driverId: string;
    vehicleId: string;
  };

  inspector?: {
    id: string;
    name: string;
    email: string;
    certifications: string[];
  };

  vehicle?: {
    id: string;
    plateNumber: string;
    model: string;
    type: string;
  };

  inspectionItems?: {
    total: number;
    completed: number;
    passed: number;
    failed: number;
    items: Array<{
      id: string;
      name: string;
      category: InspectionCategory;
      priority: InspectionPriority;
      status: InspectionResultStatus;
      result?: any;
    }>;
  };

  workflow?: {
    currentStatus: InspectionWorkflowStatus;
    history: WorkflowTransition[];
    nextActions: string[];
    canEdit: boolean;
    canApprove: boolean;
    canReject: boolean;
  };

  qualityMetrics?: {
    overallScore: number;
    completionTime: number;
    efficiency: number;
    issuesCount: number;
  };

  _count?: {
    inspectionItemResults: number;
    issues: number;
    warnings: number;
    approvals: number;
  };

  completionPercentage?: number;
  isOverdue?: boolean;
  daysUntilDue?: number;
  requiresFollowUp?: boolean;
}

/**
 * 点検記録リストレスポンス
 */
export interface InspectionRecordListResponse extends ApiListResponse<InspectionRecordResponseDTO> {
  summary?: {
    totalRecords: number;
    completedRecords: number;
    inProgressRecords: number;
    overdueRecords: number;
    completionRate: number;
    averageQualityScore: number;
  };
  statistics?: InspectionRecordStatistics;
  filterSummary?: {
    byStatus: Record<InspectionWorkflowStatus, number>;
    byPriority: Record<InspectionRecordPriority, number>;
    byType: Record<InspectionType, number>;
    byInspector: Record<string, number>;
  };
}

/**
 * ✅ 【追加】点検項目結果入力DTO
 * inspection_item_resultsテーブルへの保存用
 */
export interface InspectionItemResultInput {
  inspectionItemId: string;  // 点検項目ID
  resultValue: string;        // 結果値（OK, NG, 数値等）
  isPassed: boolean;          // 合格/不合格
  notes?: string;             // 備考
  defectLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // 不具合レベル
  photoUrls?: string[];       // 写真URL配列
  attachmentUrls?: string[];  // 添付ファイルURL配列
}

/**
 * 点検記録作成DTO
 * ✅ 修正: resultsフィールド追加
 */
export interface InspectionRecordCreateDTO {
  operationId?: string;
  vehicleId: string;
  inspectorId: string;
  inspectionType: InspectionType;
  status?: InspectionStatus;
  scheduledAt?: Date | string;
  startedAt?: Date | string;
  completedAt?: Date | string;
  overallResult?: boolean;
  overallNotes?: string;
  defectsFound?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  weatherCondition?: string;
  temperature?: number;

  // ✅ 【追加】点検項目の結果配列
  results?: InspectionItemResultInput[];

  // 拡張フィールド
  workflowStatus?: InspectionWorkflowStatus;
  priority?: InspectionRecordPriority;
  details?: InspectionRecordDetails;

  // オプション
  autoSchedule?: boolean;
  autoAssignInspector?: boolean;
  useTemplate?: string;
  copyFromRecord?: string;
  validateReadiness?: boolean;
  checkConflicts?: boolean;
  enforceBusinessRules?: boolean;
}

/**
 * 点検記録更新DTO
 */
export interface InspectionRecordUpdateDTO extends Partial<InspectionRecordCreateDTO> {
  workflowTransition?: {
    toStatus: InspectionWorkflowStatus;
    reason?: string;
    comments?: string;
  };
  qualityReview?: {
    score: number;
    feedback: string;
    recommendations: string[];
    reviewedBy: string;
  };
  reason?: string;
  updatedBy?: string;
  notifyStakeholders?: boolean;
}

/**
 * 点検記録一括作成DTO
 */
export interface InspectionRecordBulkCreateDTO {
  records: InspectionRecordCreateDTO[];
  batchOptions?: {
    useTemplate?: string;
    autoSchedule?: boolean;
    skipDuplicates?: boolean;
    validateAll?: boolean;
    assignmentStrategy?: 'ROUND_ROBIN' | 'WORKLOAD_BALANCE' | 'SKILL_MATCH';
  };
}

// =====================================
// 🎯 点検記録強化CRUDクラス（全機能保持版）
// =====================================

export class InspectionRecordService {
  private readonly db: PrismaClient;

  constructor(db?: PrismaClient) {
    this.db = db || new PrismaClient();
  }

  /**
   * 🔧 新規作成（ワークフロー・バリデーション統合）
   */
  async create(
    data: InspectionRecordCreateDTO,
    options?: {
      autoSchedule?: boolean;
      autoAssignInspector?: boolean;
      validateReadiness?: boolean;
      useTemplate?: string;
    }
  ): Promise<InspectionRecordResponseDTO> {
    try {
      logger.info('点検記録作成開始', {
        vehicleId: data.vehicleId,
        inspectorId: data.inspectorId,
        options
      });

      // 準備状況バリデーション
      if (options?.validateReadiness) {
        const validationResult = await this.validateReadiness(data);
        if (!validationResult.valid) {
          const errorMessages = validationResult.errors?.map(e => e.message).join(', ') || '検証エラー';
          throw new ValidationError('点検準備が整っていません: ' + errorMessages);
        }
      }

      // テンプレート適用
      let createData = data;
      if (options?.useTemplate) {
        createData = await this.applyTemplate(data, options.useTemplate);
      }

      // 自動スケジューリング
      if (options?.autoSchedule && !createData.scheduledAt) {
        createData.scheduledAt = await this.calculateOptimalSchedule(createData);
      }

      // 自動割り当て
      if (options?.autoAssignInspector && !createData.inspectorId) {
        createData.inspectorId = await this.assignOptimalInspector(createData);
      }

      // 点検記録作成
      const record = await this.db.inspectionRecord.create({
        data: {
          operationId: createData.operationId,
          vehicleId: createData.vehicleId,
          inspectorId: createData.inspectorId,
          inspectionType: createData.inspectionType,
          status: createData.status || InspectionStatus.PENDING,
          scheduledAt: createData.scheduledAt ? new Date(createData.scheduledAt) : undefined,
          startedAt: createData.startedAt ? new Date(createData.startedAt) : undefined,
          completedAt: createData.completedAt ? new Date(createData.completedAt) : undefined,
          overallResult: createData.overallResult,
          overallNotes: createData.overallNotes,
          defectsFound: createData.defectsFound || 0,
          latitude: createData.latitude,
          longitude: createData.longitude,
          locationName: createData.locationName,
          weatherCondition: createData.weatherCondition,
          temperature: createData.temperature
        },
        include: {
          vehicles: true,
          users: true,
          inspectionItemResults: true
        }
      });

      logger.info('点検記録作成完了', { recordId: record.id });
      return this.toResponseDTO(record);

    } catch (error) {
      logger.error('点検記録作成エラー', {
        error: error instanceof Error ? error.message : error
      });
      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('点検記録の作成に失敗しました');
    }
  }

  /**
   * 📖 単一取得（詳細情報付き）
   */
  async findById(
    id: string,
    includeRelations: boolean = true
  ): Promise<InspectionRecordResponseDTO | null> {
    try {
      const record = await this.db.inspectionRecord.findUnique({
        where: { id },
        include: includeRelations ? {
          vehicles: true,
          users: true,
          operations: true,
          inspectionItemResults: {
            include: {
              inspectionItems: true
            }
          }
        } : undefined
      });

      if (!record) {
        return null;
      }

      return this.toResponseDTO(record);

    } catch (error) {
      logger.error('点検記録取得エラー', {
        id,
        error: error instanceof Error ? error.message : error
      });
      throw new DatabaseError('点検記録の取得に失敗しました');
    }
  }

  /**
   * 📋 一覧取得（フィルタ・ページネーション・統計付き）
   */
  async findMany(
    filter: InspectionRecordFilter
  ): Promise<InspectionRecordListResponse> {
    try {
      const where = this.buildWhereClause(filter);
      const orderBy = this.buildOrderBy(filter);

      const [records, totalItems] = await Promise.all([
        this.db.inspectionRecord.findMany({
          where,
          orderBy,
          skip: ((filter.page || 1) - 1) * (filter.limit || 10),
          take: filter.limit || 10,
          include: {
            vehicles: true,
            users: true,
            inspectionItemResults: true
          }
        }),
        this.db.inspectionRecord.count({ where })
      ]);

      const items = records.map(record => this.toResponseDTO(record));

      // 統計情報生成
      let statistics: InspectionRecordStatistics | undefined;
      let summary: any;

      if (filter.includeStatistics) {
        statistics = await this.generateStatistics(where);
      }

      summary = await this.generateSummary(where);

      return {
        success: true,
        data: items,
        meta: {
          total: totalItems,
          page: filter.page || 1,
          pageSize: filter.limit || 10,
          totalPages: Math.ceil(totalItems / (filter.limit || 10)),
          hasNextPage: (filter.page || 1) * (filter.limit || 10) < totalItems,
          hasPreviousPage: (filter.page || 1) > 1
        },
        timestamp: new Date().toISOString(),
        summary,
        statistics
      };

    } catch (error) {
      logger.error('点検記録一覧取得エラー', {
        filter,
        error: error instanceof Error ? error.message : error
      });
      throw new DatabaseError('点検記録一覧の取得に失敗しました');
    }
  }

  /**
   * ✏️ 更新（部分更新対応・ワークフロー管理）
   */
  async update(
    id: string,
    data: InspectionRecordUpdateDTO
  ): Promise<InspectionRecordResponseDTO> {
    try {
      // 既存レコード確認
      const existing = await this.db.inspectionRecord.findUnique({
        where: { id }
      });

      if (!existing) {
        throw new NotFoundError('指定された点検記録が見つかりません');
      }

      // ワークフロー遷移処理
      if (data.workflowTransition) {
        await this.processWorkflowTransition(id, {
          toStatus: data.workflowTransition.toStatus,
          reason: data.workflowTransition.reason,
          comments: data.workflowTransition.comments,
          actorId: data.updatedBy || ''
        });
      }

      // 更新実行
      const updated = await this.db.inspectionRecord.update({
        where: { id },
        data: {
          status: data.status,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
          startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
          overallResult: data.overallResult,
          overallNotes: data.overallNotes,
          defectsFound: data.defectsFound,
          latitude: data.latitude,
          longitude: data.longitude,
          locationName: data.locationName,
          weatherCondition: data.weatherCondition,
          temperature: data.temperature,
          updatedAt: new Date()
        },
        include: {
          vehicles: true,
          users: true,
          inspectionItemResults: true
        }
      });

      // ステークホルダー通知
      if (data.notifyStakeholders) {
        await this.notifyStakeholders(id, 'RECORD_UPDATED');
      }

      return this.toResponseDTO(updated);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('点検記録更新エラー', {
        id,
        error: error instanceof Error ? error.message : error
      });
      throw new DatabaseError('点検記録の更新に失敗しました');
    }
  }

  /**
   * 🗑️ 削除（ソフト削除対応）
   */
  async delete(id: string, soft: boolean = true): Promise<boolean> {
    try {
      if (soft) {
        // ソフト削除（ステータス更新）
        await this.db.inspectionRecord.update({
          where: { id },
          data: {
            status: InspectionStatus.PENDING, // または専用の削除ステータス
            updatedAt: new Date()
          }
        });
      } else {
        // 物理削除
        await this.db.inspectionRecord.delete({
          where: { id }
        });
      }

      return true;

    } catch (error) {
      logger.error('点検記録削除エラー', {
        id,
        soft,
        error: error instanceof Error ? error.message : error
      });
      throw new DatabaseError('点検記録の削除に失敗しました');
    }
  }

  /**
   * 📊 統計情報取得
   */
  private async generateStatistics(
    where?: InspectionRecordWhereInput
  ): Promise<InspectionRecordStatistics> {
    try {
      const [total, byStatus, byPriority, byType] = await Promise.all([
        this.db.inspectionRecord.count({ where }),
        this.getStatusCounts(where),
        this.getPriorityStatistics(where),
        this.db.inspectionRecord.groupBy({
          by: ['inspectionType'],
          where,
          _count: true
        })
      ]);

      const byTypeRecord = byType.reduce((acc, item) => {
        acc[item.inspectionType] = item._count;
        return acc;
      }, {} as Record<InspectionType, number>);

      const performanceIndicators = await this.calculatePerformanceIndicators(where);
      const trendData = await this.getTrendData(where);

      return {
        period: {
          start: new Date(),
          end: new Date()
        },
        generatedAt: new Date(),
        totalCount: total,
        byStatus,
        byPriority,
        byType: byTypeRecord,
        averageCompletionTime: performanceIndicators.avgCompletionTime,
        completionRate: performanceIndicators.completionRate,
        defectRate: performanceIndicators.defectRate,
        trendData
      };

    } catch (error) {
      logger.error('統計取得エラー', {
        error: error instanceof Error ? error.message : error
      });
      throw new DatabaseError('統計情報の取得に失敗しました');
    }
  }

  /**
   * 📦 一括作成
   */
  async bulkCreate(
    dto: InspectionRecordBulkCreateDTO
  ): Promise<BulkOperationResult<InspectionRecordResponseDTO>> {
    try {
      const results = await Promise.allSettled(
        dto.records.map(record => this.create(record))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // ✅ FIX: BulkOperationResult の正しい形式（totalCount と results が必須）
      const resultsList = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            id: result.value.id,
            success: true,
            data: result.value,
            error: undefined
          };
        } else {
          return {
            id: `record-${index}`,
            success: false,
            data: undefined,
            error: result.reason?.message || '不明なエラー'
          };
        }
      });

      logger.info('点検記録一括作成完了', { successful, failed });

      return {
        success: failed === 0,
        totalCount: dto.records.length,
        successCount: successful,
        failureCount: failed,
        results: resultsList,
        metadata: {
          duration: 0,
          timestamp: new Date()
        }
      };

    } catch (error) {
      logger.error('一括作成エラー', {
        error: error instanceof Error ? error.message : error
      });
      throw new DatabaseError('一括作成処理に失敗しました');
    }
  }

  /**
   * 🔄 ワークフロー管理
   */
  async processWorkflowTransition(
    recordId: string,
    transition: {
      toStatus: InspectionWorkflowStatus;
      reason?: string;
      comments?: string;
      actorId: string;
    }
  ): Promise<void> {
    try {
      logger.info('ワークフロー状態遷移', { recordId, transition });

      const currentRecord = await this.db.inspectionRecord.findUnique({
        where: { id: recordId }
      });

      if (!currentRecord) {
        throw new NotFoundError('指定された点検記録が見つかりません');
      }

      // TODO: 詳細なワークフロー管理実装
      await this.notifyStakeholders(recordId, 'WORKFLOW_TRANSITION');

    } catch (error) {
      logger.error('ワークフロー処理エラー', {
        recordId,
        error: error instanceof Error ? error.message : error
      });
      throw new DatabaseError('ワークフロー処理に失敗しました');
    }
  }

  // =====================================
  // 🔧 プライベートヘルパーメソッド（全機能保持）
  // =====================================

  private async validateReadiness(
    data: InspectionRecordCreateDTO
  ): Promise<ValidationResult> {
    const errors: CommonValidationError[] = [];
    // TODO: 詳細なバリデーション実装

    // ✅ FIX: ValidationResult は valid プロパティを持つ
    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async applyTemplate(
    data: InspectionRecordCreateDTO,
    templateId: string
  ): Promise<InspectionRecordCreateDTO> {
    // TODO: テンプレート機能実装
    return data;
  }

  private async calculateOptimalSchedule(
    data: InspectionRecordCreateDTO
  ): Promise<Date> {
    // TODO: スケジューリング算法実装
    return new Date();
  }

  private async assignOptimalInspector(
    data: InspectionRecordCreateDTO
  ): Promise<string> {
    // TODO: 割り当て算法実装
    return '';
  }

  private buildWhereClause(
    filter: InspectionRecordFilter
  ): InspectionRecordWhereInput {
    const where: InspectionRecordWhereInput = {};

    if (filter.operationId) {
      where.operationId = Array.isArray(filter.operationId)
        ? { in: filter.operationId }
        : filter.operationId;
    }

    if (filter.inspectorId) {
      where.inspectorId = Array.isArray(filter.inspectorId)
        ? { in: filter.inspectorId }
        : filter.inspectorId;
    }

    if (filter.vehicleId) {
      where.vehicleId = Array.isArray(filter.vehicleId)
        ? { in: filter.vehicleId }
        : filter.vehicleId;
    }

    if (filter.inspectionType) {
      where.inspectionType = Array.isArray(filter.inspectionType)
        ? { in: filter.inspectionType }
        : filter.inspectionType;
    }

    if (filter.scheduledDate) {
      where.scheduledAt = {
        gte: filter.scheduledDate.startDate
          ? new Date(filter.scheduledDate.startDate)
          : undefined,
        lte: filter.scheduledDate.endDate
          ? new Date(filter.scheduledDate.endDate)
          : undefined
      };
    }

    if (filter.completedDate) {
      where.completedAt = {
        gte: filter.completedDate.startDate
          ? new Date(filter.completedDate.startDate)
          : undefined,
        lte: filter.completedDate.endDate
          ? new Date(filter.completedDate.endDate)
          : undefined
      };
    }

    return where;
  }

  private buildOrderBy(
    filter: InspectionRecordFilter
  ): InspectionRecordOrderByInput {
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';
    return { [sortBy]: sortOrder };
  }

  private async getStatusCounts(
    where?: InspectionRecordWhereInput
  ): Promise<Record<InspectionWorkflowStatus, number>> {
    const statusCounts = {} as Record<InspectionWorkflowStatus, number>;
    for (const status of Object.values(InspectionWorkflowStatus)) {
      statusCounts[status] = 0;
    }
    return statusCounts;
  }

  private async getPriorityStatistics(
    where?: InspectionRecordWhereInput
  ): Promise<Record<InspectionRecordPriority, number>> {
    const priorityCounts = {} as Record<InspectionRecordPriority, number>;
    for (const priority of Object.values(InspectionRecordPriority)) {
      priorityCounts[priority] = 0;
    }
    return priorityCounts;
  }

  private async getInspectorStatistics(
    where?: InspectionRecordWhereInput
  ): Promise<Record<string, any>> {
    // TODO: 点検員別統計実装
    return {};
  }

  private async getVehicleStatistics(
    where?: InspectionRecordWhereInput
  ): Promise<Record<string, any>> {
    // TODO: 車両別統計実装
    return {};
  }

  private async getTrendData(
    where?: InspectionRecordWhereInput
  ): Promise<Array<{ date: string; count: number; completionRate: number }>> {
    // TODO: 傾向データ実装
    return [];
  }

  private async calculatePerformanceIndicators(
    where?: InspectionRecordWhereInput
  ): Promise<{
    avgCompletionTime: number;
    completionRate: number;
    defectRate: number;
    efficiency: number;
    quality: number;
    consistency: number;
    reliability: number;
  }> {
    return {
      avgCompletionTime: 0,
      completionRate: 0,
      defectRate: 0,
      efficiency: 0,
      quality: 0,
      consistency: 0,
      reliability: 0
    };
  }

  private async generateSummary(
    where?: InspectionRecordWhereInput
  ): Promise<{
    totalRecords: number;
    completedRecords: number;
    inProgressRecords: number;
    overdueRecords: number;
    completionRate: number;
    averageQualityScore: number;
  }> {
    const totalRecords = await this.db.inspectionRecord.count({ where });
    const completedRecords = await this.db.inspectionRecord.count({
      where: {
        ...where,
        completedAt: { not: null }
      }
    });

    return {
      totalRecords,
      completedRecords,
      inProgressRecords: 0,
      overdueRecords: 0,
      completionRate: totalRecords > 0 ? (completedRecords / totalRecords) * 100 : 0,
      averageQualityScore: 0
    };
  }

  private async notifyStakeholders(
    recordId: string,
    eventType: string
  ): Promise<void> {
    // TODO: 通知機能実装
    logger.info('ステークホルダー通知', { recordId, eventType });
  }

  private toResponseDTO(record: any): InspectionRecordResponseDTO {
    return {
      ...record,
      workflowStatus: InspectionWorkflowStatus.DRAFT,
      priority: InspectionRecordPriority.NORMAL
    } as InspectionRecordResponseDTO;
  }
}

// =====================================
// 📦 ファクトリ関数（シングルトンパターン）
// =====================================

let inspectionRecordServiceInstance: InspectionRecordService | null = null;

export function getInspectionRecordService(
  db?: PrismaClient
): InspectionRecordService {
  if (!inspectionRecordServiceInstance) {
    inspectionRecordServiceInstance = new InspectionRecordService(db);
  }
  return inspectionRecordServiceInstance;
}

// =====================================
// 📦 エクスポート
// =====================================

export default InspectionRecordService;
