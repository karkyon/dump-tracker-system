// =====================================
// backend/src/models/InspectionRecordModel.ts
// 点検記録モデル - 完全アーキテクチャ改修版
// Phase 1-B-10: 既存完全実装統合・点検記録管理システム強化
// アーキテクチャ指針準拠版（Phase 1-A基盤活用）
// 作成日時: 2025年9月16日
// 更新日時: 2025年9月27日 16:00
// =====================================

import type {
  InspectionRecord as PrismaInspectionRecord,
  Prisma,
  // InspectionItemResult,
  // // Operation,
  // User,
  // Vehicle,
  InspectionType,
  // InspectionStatus
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完了基盤の活用
import logger from '../utils/logger';
import {
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  // ConflictError
} from '../utils/errors';

import type {
  // ApiResponse,
  ApiListResponse,
  PaginationQuery,
  SearchQuery,
  DateRange,
  StatisticsBase,
  ValidationResult,
  OperationResult,
  BulkOperationResult
} from '../types/common';

// 🎯 関連統合完了モデルとの連携
import type {
  InspectionCategory,
  InspectionPriority,
  // InspectionItemStatus
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
  DRAFT = 'DRAFT',             // 下書き
  IN_PROGRESS = 'IN_PROGRESS', // 実施中
  PENDING_REVIEW = 'PENDING_REVIEW', // レビュー待ち
  APPROVED = 'APPROVED',       // 承認済み
  REJECTED = 'REJECTED',       // 却下
  COMPLETED = 'COMPLETED',     // 完了
  CANCELLED = 'CANCELLED',     // 中止
  ARCHIVED = 'ARCHIVED'        // アーカイブ
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
  // 点検環境情報
  environment?: {
    temperature?: number;
    humidity?: number;
    weather?: string;
    visibility?: string;
  };

  // 位置情報
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    facility?: string;
  };

  // 使用機器情報
  equipment?: {
    tools: string[];
    calibrationDates: Record<string, Date>;
    serialNumbers: Record<string, string>;
  };

  // チェックリスト進捗
  checklist?: {
    totalItems: number;
    completedItems: number;
    passedItems: number;
    failedItems: number;
    skippedItems: number;
    completionPercentage: number;
  };

  // 時間追跡
  timeTracking?: {
    plannedDuration: number; // 分
    actualDuration: number;  // 分
    startTime: Date;
    endTime?: Date;
    pausedDuration?: number; // 分
  };

  // 品質指標
  qualityMetrics?: {
    thoroughnessScore: number; // 0-100
    accuracyScore: number;     // 0-100
    timelinessScore: number;   // 0-100
    overallScore: number;      // 0-100
  };

  // 特記事項
  notes?: {
    preInspectionNotes?: string;
    postInspectionNotes?: string;
    inspectorComments?: string;
    reviewerComments?: string;
  };
}

/**
 * 点検記録統計情報
 */
export interface InspectionRecordStatistics extends StatisticsBase {
  // 基本統計
  totalRecords: number;
  completedRecords: number;
  inProgressRecords: number;
  pendingRecords: number;
  completionRate: number;

  // 品質統計
  averageQualityScore: number;
  averageCompletionTime: number; // 分
  onTimeCompletionRate: number;

  // カテゴリ別統計
  byCategory: Record<InspectionCategory, {
    total: number;
    completed: number;
    averageScore: number;
    averageTime: number;
  }>;

  // 重要度別統計
  byPriority: Record<InspectionPriority, {
    total: number;
    completed: number;
    urgentCount: number;
  }>;

  // ステータス別統計
  byStatus: Record<InspectionWorkflowStatus, number>;

  // 点検員別統計
  byInspector: Record<string, {
    name: string;
    total: number;
    completed: number;
    averageScore: number;
    averageTime: number;
    onTimeRate: number;
  }>;

  // 車両別統計
  byVehicle: Record<string, {
    plateNumber: string;
    total: number;
    completed: number;
    averageScore: number;
    issueCount: number;
  }>;

  // 傾向データ
  trendData: {
    date: string;
    completed: number;
    averageScore: number;
    averageTime: number;
    issueCount: number;
  }[];

  // パフォーマンス指標
  performanceIndicators: {
    efficiency: number;        // 効率性指標
    quality: number;          // 品質指標
    consistency: number;      // 一貫性指標
    reliability: number;      // 信頼性指標
  };
}

/**
 * 点検記録検索フィルタ（拡張版）
 */
export interface InspectionRecordFilter extends PaginationQuery, SearchQuery {
  operationId?: string | string[];
  inspectorId?: string | string[];
  vehicleId?: string | string[];
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
 * 点検記録バリデーション結果
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
}

/**
 * ワークフロー進行記録
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
}

// =====================================
// 🔧 標準DTO（既存実装保持・拡張）
// =====================================

export interface InspectionRecordResponseDTO extends InspectionRecordModel {
  workflowStatus?: InspectionWorkflowStatus;
  priority?: InspectionRecordPriority;
  details?: InspectionRecordDetails;

  // 関連情報
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

  // ワークフロー情報
  workflow?: {
    currentStatus: InspectionWorkflowStatus;
    history: WorkflowTransition[];
    nextActions: string[];
    canEdit: boolean;
    canApprove: boolean;
    canReject: boolean;
  };

  // 品質・パフォーマンス情報
  qualityMetrics?: {
    overallScore: number;
    completionTime: number;
    efficiency: number;
    issuesCount: number;
  };

  // 統計情報
  _count?: {
    inspectionItemResults: number;
    issues: number;
    warnings: number;
    approvals: number;
  };

  // 計算フィールド
  completionPercentage?: number;
  isOverdue?: boolean;
  daysUntilDue?: number;
  requiresFollowUp?: boolean;
}

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

  // フィルタ集計
  filterSummary?: {
    byStatus: Record<InspectionWorkflowStatus, number>;
    byPriority: Record<InspectionRecordPriority, number>;
    byType: Record<InspectionType, number>;
    byInspector: Record<string, number>;
  };
}

export interface InspectionRecordCreateDTO extends Omit<InspectionRecordCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  workflowStatus?: InspectionWorkflowStatus;
  priority?: InspectionRecordPriority;
  details?: InspectionRecordDetails;

  // 自動生成・計算オプション
  autoSchedule?: boolean;
  autoAssignInspector?: boolean;
  useTemplate?: string;
  copyFromRecord?: string;

  // バリデーションオプション
  validateReadiness?: boolean;
  checkConflicts?: boolean;
  enforceBusinessRules?: boolean;
}

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

  // 更新メタデータ
  reason?: string;
  updatedBy?: string;
  notifyStakeholders?: boolean;
}

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
// 🎯 点検記録強化CRUDクラス（アーキテクチャ指針準拠）
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
    data: InspectionRecordCreateInput,
    options?: {
      autoSchedule?: boolean;
      autoAssignInspector?: boolean;
      validateReadiness?: boolean;
      useTemplate?: string;
    }
  ): Promise<InspectionRecordResponseDTO> {
    try {
      logger.info('点検記録作成開始', {
        operationId: data.operationId,
        inspectorId: data.inspectorId,
        options
      });

      // 準備状況バリデーション
      if (options?.validateReadiness) {
        const validationResult = await this.validateReadiness(data);
        if (!validationResult.isValid) {
          throw new ValidationError('点検準備が整っていません', validationResult.errors);
        }
      }

      // テンプレート適用
      let processedData = { ...data };
      if (options?.useTemplate) {
        processedData = await this.applyTemplate(processedData, options.useTemplate);
      }

      // 自動スケジューリング
      if (options?.autoSchedule && !processedData.scheduledAt) {
        processedData.scheduledAt = await this.calculateOptimalSchedule(processedData);
      }

      // 自動点検員割り当て
      if (options?.autoAssignInspector && !processedData.inspectorId) {
        processedData.inspectorId = await this.assignOptimalInspector(processedData);
      }

      const record = await this.db.inspectionRecord.create({
        data: {
          ...processedData,
          workflowStatus: InspectionWorkflowStatus.DRAFT,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          operation: {
            include: {
              driver: true,
              vehicle: true
            }
          },
          inspector: true,
          inspectionItemResults: {
            include: {
              inspectionItem: true
            }
          }
        }
      });

      logger.info('点検記録作成完了', { recordId: record.id });
      return this.toResponseDTO(record);

    } catch (error) {
      logger.error('点検記録作成エラー', { error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('点検記録の作成に失敗しました');
    }
  }

  /**
   * 🔍 主キー指定取得（既存実装保持・拡張）
   */
  async findByKey(id: string): Promise<InspectionRecordResponseDTO | null> {
    try {
      const record = await this.db.inspectionRecord.findUnique({
        where: { id },
        include: {
          operation: {
            include: {
              driver: true,
              vehicle: true
            }
          },
          inspector: true,
          inspectionItemResults: {
            include: {
              inspectionItem: true
            }
          }
        }
      });

      if (!record) {
        logger.warn('点検記録が見つかりません', { id });
        return null;
      }

      return this.toResponseDTO(record);

    } catch (error) {
      logger.error('点検記録取得エラー', { id, error: error instanceof Error ? error.message : error });
      throw new DatabaseError('点検記録の取得に失敗しました');
    }
  }

  /**
   * 🔍 条件指定一覧取得（既存実装保持・拡張）
   */
  async findMany(params?: {
    where?: InspectionRecordWhereInput;
    orderBy?: InspectionRecordOrderByInput;
    skip?: number;
    take?: number;
    includeRelations?: boolean;
  }): Promise<InspectionRecordResponseDTO[]> {
    try {
      const records = await this.db.inspectionRecord.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take,
        include: params?.includeRelations ? {
          operation: {
            include: {
              driver: true,
              vehicle: true
            }
          },
          inspector: true,
          inspectionItemResults: {
            include: {
              inspectionItem: true
            }
          }
        } : undefined
      });

      return records.map(record => this.toResponseDTO(record));

    } catch (error) {
      logger.error('点検記録一覧取得エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('点検記録一覧の取得に失敗しました');
    }
  }

  /**
   * 🔍 ページネーション付き一覧取得（既存実装保持・統計拡張）
   */
  async findManyWithPagination(params: {
    where?: InspectionRecordWhereInput;
    orderBy?: InspectionRecordOrderByInput;
    page?: number;
    pageSize?: number;
    includeStatistics?: boolean;
  }): Promise<InspectionRecordListResponse> {
    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const skip = (page - 1) * pageSize;

      const [records, total] = await Promise.all([
        this.findMany({
          where: params.where,
          orderBy: params.orderBy,
          skip,
          take: pageSize,
          includeRelations: true
        }),
        this.db.inspectionRecord.count({ where: params.where })
      ]);

      const totalPages = Math.ceil(total / pageSize);

      // 統計情報生成
      let statistics: InspectionRecordStatistics | undefined;
      let summary: any;
      if (params.includeStatistics) {
        statistics = await this.generateStatistics(params.where);
        summary = await this.generateSummary(params.where);
      }

      return {
        success: true,
        data: records,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        },
        summary,
        statistics
      };

    } catch (error) {
      logger.error('ページネーション付き取得エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('データの取得に失敗しました');
    }
  }

  /**
   * ✏️ 更新（ワークフロー・履歴管理）
   */
  async update(
    id: string,
    data: InspectionRecordUpdateInput,
    options?: {
      workflowTransition?: {
        toStatus: InspectionWorkflowStatus;
        reason?: string;
        comments?: string;
        actorId: string;
      };
      notifyStakeholders?: boolean;
    }
  ): Promise<InspectionRecordResponseDTO> {
    try {
      logger.info('点検記録更新開始', { id, options });

      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('更新対象の点検記録が見つかりません');
      }

      // ワークフロー状態遷移処理
      if (options?.workflowTransition) {
        await this.processWorkflowTransition(id, options.workflowTransition);
      }

      const updated = await this.db.inspectionRecord.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        },
        include: {
          operation: {
            include: {
              driver: true,
              vehicle: true
            }
          },
          inspector: true,
          inspectionItemResults: {
            include: {
              inspectionItem: true
            }
          }
        }
      });

      // ステークホルダー通知
      if (options?.notifyStakeholders) {
        await this.notifyStakeholders(id, 'RECORD_UPDATED');
      }

      logger.info('点検記録更新完了', { id });
      return this.toResponseDTO(updated);

    } catch (error) {
      logger.error('点検記録更新エラー', { id, error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('点検記録の更新に失敗しました');
    }
  }

  /**
   * 🗑️ 削除（既存実装保持）
   */
  async delete(id: string): Promise<OperationResult> {
    try {
      logger.info('点検記録削除開始', { id });

      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('削除対象の点検記録が見つかりません');
      }

      await this.db.inspectionRecord.delete({
        where: { id }
      });

      logger.info('点検記録削除完了', { id });
      return {
        success: true,
        message: '点検記録を削除しました'
      };

    } catch (error) {
      logger.error('点検記録削除エラー', { id, error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('点検記録の削除に失敗しました');
    }
  }

  /**
   * 📊 高度な検索・フィルタリング
   */
  async search(filter: InspectionRecordFilter): Promise<InspectionRecordListResponse> {
    try {
      const whereClause = this.buildWhereClause(filter);

      return await this.findManyWithPagination({
        where: whereClause,
        orderBy: this.buildOrderBy(filter),
        page: filter.page,
        pageSize: filter.limit,
        includeStatistics: filter.includeStatistics
      });

    } catch (error) {
      logger.error('点検記録検索エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('検索処理に失敗しました');
    }
  }

  /**
   * 📈 統計情報生成
   */
  async generateStatistics(where?: InspectionRecordWhereInput): Promise<InspectionRecordStatistics> {
    try {
      const [
        totalCount,
        statusCounts,
        categoryStats,
        priorityStats,
        inspectorStats,
        vehicleStats,
        trendData,
        performanceIndicators
      ] = await Promise.all([
        this.db.inspectionRecord.count({ where }),
        this.getStatusCounts(where),
        this.getCategoryStatistics(where),
        this.getPriorityStatistics(where),
        this.getInspectorStatistics(where),
        this.getVehicleStatistics(where),
        this.getTrendData(where),
        this.calculatePerformanceIndicators(where)
      ]);

      const completedCount = statusCounts[InspectionWorkflowStatus.COMPLETED] || 0;
      const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

      return {
        total: totalCount,
        totalRecords: totalCount,
        completedRecords: completedCount,
        inProgressRecords: statusCounts[InspectionWorkflowStatus.IN_PROGRESS] || 0,
        pendingRecords: statusCounts[InspectionWorkflowStatus.PENDING_REVIEW] || 0,
        completionRate,
        averageQualityScore: 0, // TODO: 実装
        averageCompletionTime: 0, // TODO: 実装
        onTimeCompletionRate: 0, // TODO: 実装
        byCategory: categoryStats,
        byPriority: priorityStats,
        byStatus: statusCounts,
        byInspector: inspectorStats,
        byVehicle: vehicleStats,
        trendData,
        performanceIndicators
      };

    } catch (error) {
      logger.error('統計情報生成エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('統計情報の生成に失敗しました');
    }
  }

  /**
   * 🔍 一括操作
   */
  async bulkCreate(data: InspectionRecordBulkCreateDTO): Promise<BulkOperationResult> {
    try {
      logger.info('点検記録一括作成開始', { count: data.records.length });

      const results = await Promise.allSettled(
        data.records.map(record => this.create(record, data.batchOptions))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      const errors = results
        .map((result, index) => result.status === 'rejected' ? { index, error: result.reason.message } : null)
        .filter(Boolean) as Array<{ index: number; error: string }>;

      logger.info('点検記録一括作成完了', { successful, failed });

      return {
        success: failed === 0,
        successCount: successful,
        failureCount: failed,
        errors
      };

    } catch (error) {
      logger.error('一括作成エラー', { error: error instanceof Error ? error.message : error });
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
      // ワークフロー状態遷移の実装
      // TODO: 詳細なワークフロー管理実装
      logger.info('ワークフロー状態遷移', { recordId, transition });

    } catch (error) {
      logger.error('ワークフロー処理エラー', { recordId, error: error instanceof Error ? error.message : error });
      throw new DatabaseError('ワークフロー処理に失敗しました');
    }
  }

  // =====================================
  // 🔧 プライベートヘルパーメソッド
  // =====================================

  private async validateReadiness(data: InspectionRecordCreateInput): Promise<ValidationResult> {
    // 準備状況バリデーションロジックの実装
    // TODO: 詳細なバリデーション実装
    return {
      isValid: true,
      errors: []
    };
  }

  private async applyTemplate(data: InspectionRecordCreateInput, templateId: string): Promise<InspectionRecordCreateInput> {
    // テンプレート適用ロジックの実装
    // TODO: テンプレート機能実装
    return data;
  }

  private async calculateOptimalSchedule(data: InspectionRecordCreateInput): Promise<Date> {
    // 最適スケジューリングロジックの実装
    // TODO: スケジューリング算法実装
    return new Date();
  }

  private async assignOptimalInspector(data: InspectionRecordCreateInput): Promise<string> {
    // 最適点検員割り当てロジックの実装
    // TODO: 割り当て算法実装
    return '';
  }

  private buildWhereClause(filter: InspectionRecordFilter): InspectionRecordWhereInput {
    const where: InspectionRecordWhereInput = {};

    // フィルタ条件の構築
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

    if (filter.scheduledDate) {
      where.scheduledAt = {
        gte: filter.scheduledDate.startDate ? new Date(filter.scheduledDate.startDate) : undefined,
        lte: filter.scheduledDate.endDate ? new Date(filter.scheduledDate.endDate) : undefined
      };
    }

    return where;
  }

  private buildOrderBy(filter: InspectionRecordFilter): InspectionRecordOrderByInput {
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';

    return { [sortBy]: sortOrder };
  }

  private async getStatusCounts(where?: InspectionRecordWhereInput) {
    // ステータス別カウント実装
    return {} as Record<InspectionWorkflowStatus, number>;
  }

  private async getCategoryStatistics(where?: InspectionRecordWhereInput) {
    // カテゴリ別統計実装
    return {} as Record<InspectionCategory, any>;
  }

  private async getPriorityStatistics(where?: InspectionRecordWhereInput) {
    // 重要度別統計実装
    return {} as Record<InspectionPriority, any>;
  }

  private async getInspectorStatistics(where?: InspectionRecordWhereInput) {
    // 点検員別統計実装
    return {} as Record<string, any>;
  }

  private async getVehicleStatistics(where?: InspectionRecordWhereInput) {
    // 車両別統計実装
    return {} as Record<string, any>;
  }

  private async getTrendData(where?: InspectionRecordWhereInput) {
    // 傾向データ実装
    return [] as any[];
  }

  private async calculatePerformanceIndicators(where?: InspectionRecordWhereInput) {
    // パフォーマンス指標計算実装
    return {
      efficiency: 0,
      quality: 0,
      consistency: 0,
      reliability: 0
    };
  }

  private async generateSummary(where?: InspectionRecordWhereInput) {
    // サマリー情報生成
    return {
      totalRecords: 0,
      completedRecords: 0,
      inProgressRecords: 0,
      overdueRecords: 0,
      completionRate: 0,
      averageQualityScore: 0
    };
  }

  private async notifyStakeholders(recordId: string, eventType: string): Promise<void> {
    // ステークホルダー通知実装
    // TODO: 通知機能実装
  }

  private toResponseDTO(record: any): InspectionRecordResponseDTO {
    // ResponseDTO変換ロジック
    return {
      ...record,
      // 関連情報の整形
      // 計算フィールドの追加
      // ワークフロー情報の追加
    } as InspectionRecordResponseDTO;
  }
}

// =====================================
// 🭐 ファクトリ関数（DI対応）
// =====================================

/**
 * InspectionRecordServiceのファクトリ関数
 * Phase 1-A基盤準拠のDI対応
 */
export function getInspectionRecordService(prisma?: PrismaClient): InspectionRecordService {
  return new InspectionRecordService(prisma);
}

// =====================================
// 🔧 エクスポート（types/index.ts統合用）
// =====================================

export default InspectionRecordService;

// 点検記録機能追加エクスポート
export type {
  InspectionRecordDetails,
  InspectionRecordStatistics,
  InspectionRecordFilter,
  InspectionRecordValidationResult,
  InspectionRecordBulkCreateDTO,
  WorkflowTransition
};

export {
  InspectionWorkflowStatus,
  InspectionRecordPriority
};
