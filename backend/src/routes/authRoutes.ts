// =====================================
// backend/src/models/MaintenanceRecordModel.ts
// メンテナンス記録モデル - 完全アーキテクチャ改修版
// Phase 1-B-12: 既存完全実装統合・メンテナンス管理システム強化
// アーキテクチャ指針準拠版(Phase 1-A基盤活用)
// 作成日時: 2025年9月16日
// 更新日時: 2025年10月9日 - コンパイルエラー完全修正版
// =====================================

import type {
  MaintenanceRecord as PrismaMaintenanceRecord,
  Prisma,
  User,
  Vehicle,
  MaintenanceType
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
  ValidationResult,
  ValidationError,
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
// 📦 メンテナンス管理専用Enum(既存保持・拡張)
// =====================================

/**
 * メンテナンスカテゴリ
 */
export enum MaintenanceCategory {
  PREVENTIVE = 'PREVENTIVE',                       // 予防保全
  CORRECTIVE = 'CORRECTIVE',                       // 事後保全
  PREDICTIVE = 'PREDICTIVE',                       // 予知保全
  EMERGENCY = 'EMERGENCY',                         // 緊急
  SCHEDULED = 'SCHEDULED',                         // 定期
  INSPECTION = 'INSPECTION',                       // 点検
  REPAIR = 'REPAIR',                               // 修理
  REPLACEMENT = 'REPLACEMENT',                     // 交換
  UPGRADE = 'UPGRADE',                             // アップグレード
  CLEANING = 'CLEANING',                           // 清掃
  CALIBRATION = 'CALIBRATION',                     // 校正
  TESTING = 'TESTING'                              // テスト
}

/**
 * メンテナンス優先度
 */
export enum MaintenancePriority {
  CRITICAL = 'CRITICAL',                           // 最高
  HIGH = 'HIGH',                                   // 高
  MEDIUM = 'MEDIUM',                               // 中
  LOW = 'LOW',                                     // 低
  ROUTINE = 'ROUTINE'                              // 定常
}

/**
 * メンテナンス状態
 */
export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',                         // 予定
  IN_PROGRESS = 'IN_PROGRESS',                     // 作業中
  COMPLETED = 'COMPLETED',                         // 完了
  POSTPONED = 'POSTPONED',                         // 延期
  CANCELLED = 'CANCELLED',                         // 中止
  ON_HOLD = 'ON_HOLD'                              // 保留
}

/**
 * 部品・材料種別
 */
export enum PartCategory {
  ENGINE = 'ENGINE',                               // エンジン系
  TRANSMISSION = 'TRANSMISSION',                   // 駆動系
  BRAKE = 'BRAKE',                                 // ブレーキ系
  SUSPENSION = 'SUSPENSION',                       // サスペンション系
  ELECTRICAL = 'ELECTRICAL',                       // 電装系
  HYDRAULIC = 'HYDRAULIC',                         // 油圧系
  TIRE = 'TIRE',                                   // タイヤ
  BODY = 'BODY',                                   // 車体
  CONSUMABLE = 'CONSUMABLE',                       // 消耗品
  FLUIDS = 'FLUIDS',                               // 液類
  FILTER = 'FILTER',                               // フィルター
  OTHER = 'OTHER'                                  // その他
}

/**
 * メンテナンス詳細情報(拡張機能)
 */
export interface MaintenanceDetails {
  // 基本情報
  workOrderNumber?: string;                        // 作業指示書番号
  referenceNumber?: string;                        // 参照番号
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;

  // スケジュール情報
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  estimatedDuration?: number;                      // 分単位
  actualDuration?: number;                         // 分単位

  // 作業内容
  workDescription: string;
  symptomsObserved?: string;
  rootCauseAnalysis?: string;
  actionsTaken?: string;
  recommendedActions?: string[];

  // 品質・安全
  qualityChecks?: Array<{
    checkType: string;
    result: 'PASS' | 'FAIL' | 'N/A';
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
    warrantyPeriod?: number;                       // 日数
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
    period: number;                                // 日数
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
  averageDowntime: number;                         // 分単位
  totalDowntime: number;                           // 分単位
  averageRepairTime: number;                       // 分単位

  // 効率性指標
  plannedVsActualTime: {
    plannedHours: number;
    actualHours: number;
    efficiency: number;                            // %
  };
  firstTimeFixRate: number;                        // %
  repeatFailureRate: number;                       // %

  // コスト分析
  costBreakdown: {
    labor: number;
    parts: number;
    overhead: number;
    emergency: number;
  };
  costTrends: Array<{
    period: string;
    totalCost: number;
    averageCost: number;
  }>;

  // 故障分析
  failureAnalysis: {
    topFailureModes: Array<{
      mode: string;
      count: number;
      totalCost: number;
    }>;
    mtbf: number;                                  // 平均故障間隔(時間)
    mttr: number;                                  // 平均修復時間(時間)
    availability: number;                          // 可用性(%)
  };

  // カテゴリ別分析
  categoryBreakdown: Record<MaintenanceCategory, {
    count: number;
    totalCost: number;
    averageCost: number;
    averageDuration: number;
  }>;

  // 予測分析
  predictiveInsights: {
    upcomingMaintenanceCount: number;
    budgetForecast: number;
    riskAssessment: string;
    recommendations: string[];
  };
}

/**
 * メンテナンス検索・フィルタ条件(高度検索)
 * PaginationQueryとSearchQueryを継承しているため、page, pageSize, sortBy, sortOrder, search, filtersが利用可能
 */
export interface MaintenanceFilter extends PaginationQuery, SearchQuery {
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
  isCompleted?: boolean;
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
  confidence: number;                              // 0-100%
  maintenanceType: MaintenanceCategory;
  estimatedCost: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  basedOnFactors: string[];
  recommendations: string[];
}

/**
 * メンテナンスバリデーション結果
 * ✅ FIX: valid プロパティを追加
 */
export interface MaintenanceValidationResult extends ValidationResult {
  valid: boolean;                                   // ValidationResultのalias
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
    estimatedWaitTime?: number;                    // 分単位
  };
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
  duration?: number;                               // 分単位
  isOverdue?: boolean;
  daysUntilDue?: number;
  costEfficiency?: number;

  // 統計情報
  relatedRecords?: {
    previousMaintenanceCount: number;
    averageInterval: number;                       // 日数
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
  summary?: {
    totalRecords: number;
    completedRecords: number;
    pendingRecords: number;
    overdueRecords: number;
    totalCost: number;
    averageCost: number;
  };

  statistics?: MaintenanceStatistics;

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
   * ✅ FIX: data.vehicleId → vehicles関連使用、scheduledDate型チェック修正
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
      logger.info('メンテナンス記録作成開始', { data, options });

      // ✅ FIX: vehicles経由で車両IDを取得
      const vehicleConnect = typeof data.vehicles === 'object' && 'connect' in data.vehicles
        ? (data.vehicles.connect as { id?: string })
        : undefined;
      const vehicleId = vehicleConnect?.id;

      if (!vehicleId) {
        throw new AppValidationError('車両IDは必須です');
      }

      // 車両存在チェック
      const vehicle = await this.db.vehicle.findUnique({
        where: { id: vehicleId }
      });

      if (!vehicle) {
        throw new NotFoundError('対象車両が見つかりません');
      }

      // ✅ FIX: scheduledDate型チェック修正
      const scheduledDate = data.scheduledDate ?
        (data.scheduledDate instanceof Date ? data.scheduledDate : new Date(data.scheduledDate))
        : undefined;

      // スケジュール競合チェック
      if (options?.validateScheduling && scheduledDate) {
        await this.validateScheduling(vehicleId, scheduledDate);
      }

      // リソース可用性チェック
      if (options?.checkResourceAvailability) {
        await this.checkResourceAvailability(data);
      }

      // 作業指示書番号生成
      let workOrderNumber: string | undefined;
      if (options?.generateWorkOrder) {
        workOrderNumber = await this.generateWorkOrderNumber();
      }

      const record = await this.db.maintenanceRecord.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              model: true,
              manufacturer: true
            }
          },
          users: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      });

      logger.info('メンテナンス記録作成完了', { recordId: record.id, workOrderNumber });
      return this.toResponseDTO(record);

    } catch (error) {
      logger.error('メンテナンス記録作成エラー', { error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('メンテナンス記録の作成に失敗しました');
    }
  }

  /**
   * 🔍 主キー指定取得(既存実装保持)
   */
  async findByKey(id: string): Promise<MaintenanceRecordResponseDTO | null> {
    try {
      const record = await this.db.maintenanceRecord.findUnique({
        where: { id },
        include: {
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              model: true,
              manufacturer: true
            }
          },
          users: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      });

      if (!record) {
        logger.warn('メンテナンス記録が見つかりません', { id });
        return null;
      }

      return this.toResponseDTO(record);

    } catch (error) {
      logger.error('メンテナンス記録取得エラー', { id, error: error instanceof Error ? error.message : error });
      throw new DatabaseError('メンテナンス記録の取得に失敗しました');
    }
  }

  /**
   * 🔍 条件指定一覧取得(既存実装保持・拡張)
   */
  async findMany(params?: {
    where?: MaintenanceRecordWhereInput;
    orderBy?: MaintenanceRecordOrderByInput;
    skip?: number;
    take?: number;
    includeRelations?: boolean;
  }): Promise<MaintenanceRecordResponseDTO[]> {
    try {
      const records = await this.db.maintenanceRecord.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take,
        include: params?.includeRelations ? {
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              model: true,
              manufacturer: true
            }
          },
          users: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        } : undefined
      });

      return records.map(record => this.toResponseDTO(record));

    } catch (error) {
      logger.error('メンテナンス記録一覧取得エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('メンテナンス記録一覧の取得に失敗しました');
    }
  }

  /**
   * 🔍 ページネーション付き一覧取得(既存実装保持・統計拡張)
   * ✅ FIX: paginationプロパティ名をmetaに変更してApiListResponse型に準拠
   */
  async findManyWithPagination(params: {
    where?: MaintenanceRecordWhereInput;
    orderBy?: MaintenanceRecordOrderByInput;
    page?: number;
    pageSize?: number;
    includeStatistics?: boolean;
  }): Promise<MaintenanceRecordListResponse> {
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
        this.db.maintenanceRecord.count({ where: params.where })
      ]);

      const totalPages = Math.ceil(total / pageSize);

      // 統計情報生成
      let statistics: MaintenanceStatistics | undefined;
      let summary: any;
      let categoryBreakdown: any;
      if (params.includeStatistics) {
        statistics = await this.generateStatistics(params.where);
        summary = await this.generateSummary(params.where);
        categoryBreakdown = await this.generateCategoryBreakdown(params.where);
      }

      // ✅ FIX: ApiListResponse型に準拠したレスポンス形式
      return {
        success: true,
        data: records,
        meta: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        timestamp: new Date().toISOString(),
        summary,
        statistics,
        categoryBreakdown
      };

    } catch (error) {
      logger.error('ページネーション付き取得エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('データの取得に失敗しました');
    }
  }

  /**
   * ✏️ 更新(既存実装保持・履歴管理拡張)
   */
  async update(
    id: string,
    data: MaintenanceRecordUpdateInput,
    options?: {
      reason?: string;
      updatedBy?: string;
      trackHistory?: boolean;
    }
  ): Promise<MaintenanceRecordResponseDTO> {
    try {
      logger.info('メンテナンス記録更新開始', { id, reason: options?.reason });

      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('更新対象のメンテナンス記録が見つかりません');
      }

      // 履歴追跡
      if (options?.trackHistory) {
        await this.trackUpdateHistory(id, existing, data, options.updatedBy);
      }

      const updated = await this.db.maintenanceRecord.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        },
        include: {
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              model: true,
              manufacturer: true
            }
          },
          users: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      });

      logger.info('メンテナンス記録更新完了', { id });
      return this.toResponseDTO(updated);

    } catch (error) {
      logger.error('メンテナンス記録更新エラー', { id, error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('メンテナンス記録の更新に失敗しました');
    }
  }

  /**
   * 🗑️ 削除(既存実装保持)
   */
  async delete(id: string): Promise<MaintenanceRecordModel> {
    try {
      logger.info('メンテナンス記録削除開始', { id });

      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('削除対象のメンテナンス記録が見つかりません');
      }

      const deleted = await this.db.maintenanceRecord.delete({
        where: { id }
      });

      logger.info('メンテナンス記録削除完了', { id });
      return deleted;

    } catch (error) {
      logger.error('メンテナンス記録削除エラー', { id, error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('メンテナンス記録の削除に失敗しました');
    }
  }

  /**
   * 🔍 存在チェック(既存実装保持)
   */
  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.db.maintenanceRecord.count({
        where: { id }
      });
      return count > 0;

    } catch (error) {
      logger.error('存在チェックエラー', { id, error: error instanceof Error ? error.message : error });
      throw new DatabaseError('存在チェックに失敗しました');
    }
  }

  /**
   * 🔢 カウント取得(既存実装保持)
   */
  async count(where?: MaintenanceRecordWhereInput): Promise<number> {
    try {
      return await this.db.maintenanceRecord.count({ where });

    } catch (error) {
      logger.error('カウント取得エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('カウントの取得に失敗しました');
    }
  }

  // =====================================
  // 🔧 新規機能メソッド(メンテナンス管理強化)
  // =====================================

  /**
   * 🔍 高度検索・フィルタ機能
   * ✅ FIX: MaintenanceFilterの継承により、sortBy/sortOrder/page/pageSizeが利用可能
   */
  async search(filter: MaintenanceFilter): Promise<MaintenanceRecordListResponse> {
    try {
      logger.info('メンテナンス高度検索開始', { filter });

      const where = this.buildSearchConditions(filter);
      const orderBy = this.buildOrderBy(filter.sortBy, filter.sortOrder);

      const result = await this.findManyWithPagination({
        where,
        orderBy,
        page: filter.page,
        pageSize: filter.pageSize || filter.limit, // limitもサポート
        includeStatistics: filter.includeStatistics
      });

      logger.info('メンテナンス高度検索完了', { resultCount: result.data.length });
      return result;

    } catch (error) {
      logger.error('高度検索エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('検索処理に失敗しました');
    }
  }

  /**
   * 📊 統計情報生成
   */
  async generateStatistics(where?: MaintenanceRecordWhereInput): Promise<MaintenanceStatistics> {
    try {
      logger.info('メンテナンス統計情報生成開始');

      const [total, records] = await Promise.all([
        this.count(where),
        this.findMany({ where, take: 1000 }) // 分析用データ
      ]);

      // ✅ FIX: 完了状態のカウントはstatusで判定
      const completed = records.filter(r => r.status === 'COMPLETED').length;

      const totalCost = records.reduce((sum, record) => {
        const cost = record.cost ? (typeof record.cost === 'number' ? record.cost : record.cost.toNumber()) : 0;
        return sum + cost;
      }, 0);
      const averageCost = total > 0 ? totalCost / total : 0;

      // 統計データの算出
      const statistics: MaintenanceStatistics = {
        totalRecords: total,
        completedRecords: completed,
        pendingRecords: total - completed,
        totalCost,
        averageCost,
        averageDowntime: 0,
        totalDowntime: 0,
        averageRepairTime: 0,
        plannedVsActualTime: {
          plannedHours: 0,
          actualHours: 0,
          efficiency: 100
        },
        firstTimeFixRate: 0,
        repeatFailureRate: 0,
        costBreakdown: {
          labor: 0,
          parts: 0,
          overhead: 0,
          emergency: 0
        },
        costTrends: [],
        failureAnalysis: {
          topFailureModes: [],
          mtbf: 0,
          mttr: 0,
          availability: 100
        },
        categoryBreakdown: {} as Record<MaintenanceCategory, any>,
        predictiveInsights: {
          upcomingMaintenanceCount: 0,
          budgetForecast: 0,
          riskAssessment: 'LOW',
          recommendations: []
        }
      };

      logger.info('メンテナンス統計情報生成完了', { total, completed });
      return statistics;

    } catch (error) {
      logger.error('統計情報生成エラー', { error: error instanceof Error ? error.message : error });
      throw new DatabaseError('統計情報の生成に失敗しました');
    }
  }

  /**
   * ✅ バルク作成・バリデーション
   * ✅ FIX: ValidationErrorの配列形式を修正
   */
  async bulkCreate(dto: MaintenanceBulkCreateDTO): Promise<BulkOperationResult> {
    try {
      logger.info('バルク作成開始', { count: dto.records.length });

      // バリデーション
      const validationResult = await this.validateBulkCreate(dto.records);
      if (!validationResult.isValid) {
        // ✅ FIX: ValidationError配列を適切な形式に変換
        const errorMessages = validationResult.errors.map(e =>
          typeof e === 'string' ? e : e.message
        );
        throw new AppValidationError(
          `バリデーションエラー: ${errorMessages.join(', ')}`
        );
      }

      const results: MaintenanceRecordResponseDTO[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      for (let i = 0; i < dto.records.length; i++) {
        try {
          const record = await this.create(dto.records[i] as MaintenanceRecordCreateInput, dto.batchOptions);
          results.push(record);
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info('バルク作成完了', {
        success: results.length,
        failed: errors.length
      });

      return {
        success: errors.length === 0,
        total: dto.records.length,
        succeeded: results.length,
        failed: errors.length,
        results,
        errors: errors.map(e => e.error),
        message: `${results.length}件作成成功、${errors.length}件失敗`
      };

    } catch (error) {
      logger.error('バルク作成エラー', { error: error instanceof Error ? error.message : error });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('バルク作成に失敗しました');
    }
  }

  /**
   * バリデーション: バルク作成
   * ✅ FIX: ValidationErrorの配列、valid/isValid両方をサポート
   */
  private async validateBulkCreate(records: MaintenanceRecordCreateDTO[]): Promise<MaintenanceValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!records || records.length === 0) {
      errors.push({
        field: 'records',
        message: '作成するレコードが指定されていません',
        value: records
      });
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // ✅ FIX: vehicles経由で車両IDを取得
      const vehicleConnect = typeof record.vehicles === 'object' && 'connect' in record.vehicles
        ? (record.vehicles.connect as { id?: string })
        : undefined;

      if (!vehicleConnect?.id) {
        errors.push({
          field: `records[${i}].vehicles`,
          message: '車両IDは必須です',
          value: record.vehicles
        });
      }

      if (!record.maintenanceType) {
        errors.push({
          field: `records[${i}].maintenanceType`,
          message: 'メンテナンスタイプは必須です',
          value: record.maintenanceType
        });
      }

      // ✅ FIX: scheduledDate型チェック修正
      if (record.scheduledDate) {
        const scheduledDate = record.scheduledDate instanceof Date
          ? record.scheduledDate
          : new Date(record.scheduledDate);

        const vehicleId = vehicleConnect?.id;
        if (vehicleId) {
          const conflicts = await this.checkScheduleConflicts(vehicleId, scheduledDate);
          if (conflicts) {
            warnings.push(`レコード${i}: スケジュール競合の可能性があります`);
          }
        }
      }
    }

    const result: MaintenanceValidationResult = {
      isValid: errors.length === 0,
      valid: errors.length === 0, // validプロパティも追加
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };

    return result;
  }

  // =====================================
  // 🔧 プライベートヘルパーメソッド
  // =====================================

  /**
   * 検索条件構築
   * ✅ FIX: DateRangeのプロパティ名修正、isCompletedの扱い修正
   */
  private buildSearchConditions(filter: MaintenanceFilter): MaintenanceRecordWhereInput {
    const where: MaintenanceRecordWhereInput = {};

    // 基本フィルタ
    if (filter.vehicleIds && filter.vehicleIds.length > 0) {
      where.vehicles = { id: { in: filter.vehicleIds } };
    }

    if (filter.statuses && filter.statuses.length > 0) {
      where.status = { in: filter.statuses };
    }

    // ✅ FIX: SearchQueryのsearchプロパティを使用
    if (filter.search) {
      where.OR = [
        { description: { contains: filter.search } },
        { notes: { contains: filter.search } }
      ];
    }

    // ✅ FIX: DateRangeのプロパティ名をstartDate/endDateに修正
    if (filter.scheduledDateRange) {
      where.scheduledDate = {};
      if (filter.scheduledDateRange.startDate) {
        where.scheduledDate.gte = new Date(filter.scheduledDateRange.startDate);
      }
      if (filter.scheduledDateRange.endDate) {
        where.scheduledDate.lte = new Date(filter.scheduledDateRange.endDate);
      }
    }

    // ✅ FIX: isCompletedはstatusで判定
    if (filter.isCompleted !== undefined) {
      where.status = filter.isCompleted ? 'COMPLETED' : { not: 'COMPLETED' };
    }

    return where;
  }

  /**
   * ソート条件構築
   */
  private buildOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc'): MaintenanceRecordOrderByInput | undefined {
    if (!sortBy) return undefined;

    const order = sortOrder || 'desc';
    return { [sortBy]: order } as MaintenanceRecordOrderByInput;
  }

  /**
   * スケジュール競合チェック
   */
  private async checkScheduleConflicts(vehicleId: string, scheduledDate: Date): Promise<boolean> {
    try {
      const conflicts = await this.db.maintenanceRecord.count({
        where: {
          vehicles: { id: vehicleId },
          scheduledDate: {
            gte: new Date(scheduledDate.getTime() - 4 * 60 * 60 * 1000), // 前後4時間
            lte: new Date(scheduledDate.getTime() + 4 * 60 * 60 * 1000)
          },
          status: { notIn: ['COMPLETED', 'CANCELLED'] }
        }
      });
      return conflicts > 0;
    } catch (error) {
      logger.error('スケジュール競合チェックエラー', { error });
      return false;
    }
  }

  /**
   * スケジュール検証
   */
  private async validateScheduling(vehicleId: string, scheduledDate: Date): Promise<void> {
    const conflicts = await this.checkScheduleConflicts(vehicleId, scheduledDate);
    if (conflicts) {
      throw new ConflictError('指定された日時に既に別のメンテナンスが予定されています');
    }
  }

  /**
   * リソース可用性チェック
   */
  private async checkResourceAvailability(data: MaintenanceRecordCreateInput): Promise<void> {
    // 実装省略: 技術者、部品、設備の可用性チェック
    logger.info('リソース可用性チェック', { data });
  }

  /**
   * 作業指示書番号生成
   */
  private async generateWorkOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `WO${year}${month}${random}`;
  }

  /**
   * 更新履歴追跡
   */
  private async trackUpdateHistory(
    id: string,
    before: MaintenanceRecordResponseDTO,
    after: MaintenanceRecordUpdateInput,
    updatedBy?: string
  ): Promise<void> {
    // 実装省略: 監査ログへの記録
    logger.info('更新履歴追跡', { id, updatedBy });
  }

  /**
   * サマリー生成
   * ✅ FIX: isCompletedの代わりにstatusで判定
   */
  private async generateSummary(where?: MaintenanceRecordWhereInput) {
    const total = await this.count(where);
    const completed = await this.count({
      ...where,
      status: 'COMPLETED'
    });

    return {
      totalRecords: total,
      completedRecords: completed,
      pendingRecords: total - completed,
      overdueRecords: 0,
      totalCost: 0,
      averageCost: 0
    };
  }

  /**
   * カテゴリ別集計生成
   */
  private async generateCategoryBreakdown(where?: MaintenanceRecordWhereInput) {
    return {} as Record<MaintenanceCategory, any>;
  }

  /**
   * ResponseDTO変換
   */
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

  /**
   * 作業時間計算
   */
  private calculateDuration(record: any): number {
    // 作業時間計算
    return 0;
  }

  /**
   * 期限切れチェック
   */
  private checkOverdue(record: any): boolean {
    // 期限切れチェック
    return false;
  }

  /**
   * 期限までの日数計算
   */
  private calculateDaysUntilDue(record: any): number {
    // 期限までの日数計算
    return 0;
  }
}

// =====================================
// 🭐 ファクトリ関数(DI対応)
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

// ✅ FIX: デフォルトエクスポートを削除して重複を解消
// export default MaintenanceRecordService;

// ✅ FIX: 型エクスポートを一度だけに統合
export type {
  MaintenanceRecordModel,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput,
  MaintenanceRecordWhereInput,
  MaintenanceRecordWhereUniqueInput,
  MaintenanceRecordOrderByInput,
  MaintenanceRecordResponseDTO,
  MaintenanceRecordListResponse,
  MaintenanceRecordCreateDTO,
  MaintenanceRecordUpdateDTO,
  MaintenanceDetails,
  MaintenanceStatistics,
  MaintenanceFilter,
  MaintenancePrediction,
  MaintenanceValidationResult,
  MaintenanceBulkCreateDTO
};

// ✅ FIX: Enumエクスポートを一度だけに統合
export {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  PartCategory,
  MaintenanceRecordService
};
