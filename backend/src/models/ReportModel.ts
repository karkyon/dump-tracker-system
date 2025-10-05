// =====================================
// backend/src/models/ReportModel.ts
// レポートモデル - Phase 1-A基盤統合完全版
// 作成日時: 2025年10月5日
// 最終更新: 2025年10月5日
// アーキテクチャ指針準拠版 - 企業レベルレポート管理システム
// =====================================

import type {
  Report as PrismaReport,
  Prisma
} from '@prisma/client';

// Enumは値として使用するため、通常のimportで取得
import {
  ReportType,
  ReportFormat,
  ReportGenerationStatus,
  UserRole
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  AppError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 共通型定義の活用
import type {
  PaginationQuery,
  ApiResponse,
  OperationResult,
  BulkOperationResult,
  ValidationResult
} from '../types/common';

// 🎯 Report型定義の活用
import type {
  ReportInfo,
  CreateReportRequest,
  UpdateReportRequest,
  ReportResponseDTO,
  ReportListResponse,
  ReportFilter,
  ReportSearchQuery,
  ReportStatistics,
  ReportGenerationResult,
  ReportAccessControl,
  ReportExportOptions,
  ReportExportResult,
  ReportTemplate,
  ReportModel,
  ReportCreateInput,
  ReportUpdateInput,
  ReportWhereInput,
  ReportWhereUniqueInput,
  ReportOrderByInput
} from '../types/report';

import {
  isValidReportType,
  isValidReportFormat,
  isValidReportStatus,
  isReportCompleted,
  isReportFailed,
  isReportProcessing
} from '../types/report';

// =====================================
// 🔧 基本型定義のエクスポート
// =====================================

export type {
  ReportModel,
  ReportCreateInput,
  ReportUpdateInput,
  ReportWhereInput,
  ReportWhereUniqueInput,
  ReportOrderByInput
};

// =====================================
// 🔧 標準DTO（後方互換性維持）
// =====================================

export interface ReportResponseDTOExtended extends ReportResponseDTO {
  _count?: {
    [key: string]: number;
  };
}

export interface ReportListResponseExtended {
  data: ReportResponseDTOExtended[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statistics?: ReportStatistics;
}

export type ReportCreateDTO = Omit<ReportCreateInput, 'id' | 'createdAt' | 'updatedAt'>;
export type ReportUpdateDTO = Partial<ReportCreateDTO>;

// =====================================
// 🏢 ReportService - レポート管理サービス
// =====================================

/**
 * レポート管理サービスクラス
 *
 * 【Phase 1-A完成基盤活用】
 * - DatabaseService: 統一DB接続・トランザクション管理
 * - エラーハンドリング: 適切なエラー分類・詳細メッセージ
 * - ロギング: 統合ログシステム・操作履歴記録
 *
 * 【主要機能】
 * - レポートCRUD操作
 * - レポート生成・エクスポート
 * - レポートフィルタリング・検索
 * - アクセス制御・権限管理
 * - 統計情報取得
 */
export class ReportService {
  private readonly db: PrismaClient;

  constructor(db?: PrismaClient) {
    this.db = db || DatabaseService.getInstance();
    logger.info('✅ ReportService initialized', {
      dbConnection: this.db ? 'connected' : 'not connected'
    });
  }

  // =====================================
  // 1. レポートCRUD操作
  // =====================================

  /**
   * レポート作成
   */
  async createReport(
    data: CreateReportRequest,
    userId: string
  ): Promise<ReportResponseDTO> {
    logger.info('📊 Creating new report', {
      reportType: data.reportType,
      format: data.format,
      userId
    });

    try {
      // バリデーション
      this.validateCreateReportData(data);

      // レポート作成
      const report = await this.db.report.create({
        data: {
          reportType: data.reportType,
          format: data.format,
          title: data.title,
          description: data.description,
          generatedBy: userId,
          parameters: data.parameters ? (data.parameters as Prisma.InputJsonValue) : undefined,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          tags: data.tags || [],
          isPublic: data.isPublic || false,
          sharedWith: data.sharedWith || [],
          status: ReportGenerationStatus.PENDING
        },
        include: {
          user: true
        }
      });

      logger.info('✅ Report created successfully', {
        reportId: report.id,
        reportType: report.reportType
      });

      return report as ReportResponseDTO;
    } catch (error) {
      logger.error('❌ Failed to create report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new DatabaseError(
        'レポートの作成に失敗しました',
        'REPORT_CREATE_FAILED'
      );
    }
  }

  /**
   * レポート取得（ID指定）
   */
  async getReportById(
    id: string,
    userId: string,
    userRole: UserRole
  ): Promise<ReportResponseDTO> {
    logger.info('🔍 Getting report by ID', { reportId: id, userId });

    try {
      const report = await this.db.report.findUnique({
        where: { id },
        include: {
          user: true
        }
      });

      if (!report) {
        throw new NotFoundError(
          `レポート（ID: ${id}）が見つかりません`,
          'REPORT_NOT_FOUND'
        );
      }

      // アクセス権限チェック
      if (!this.canAccessReport(report, userId, userRole)) {
        throw new AuthorizationError(
          'このレポートへのアクセス権限がありません',
          'REPORT_ACCESS_DENIED'
        );
      }

      return report as ReportResponseDTO;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }

      logger.error('❌ Failed to get report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: id
      });

      throw new DatabaseError(
        'レポートの取得に失敗しました',
        'REPORT_GET_FAILED'
      );
    }
  }

  /**
   * レポート一覧取得（フィルタリング対応）
   */
  async getReports(
    filter: ReportFilter,
    userId: string,
    userRole: UserRole
  ): Promise<ReportListResponse> {
    logger.info('📋 Getting reports list', { filter, userId });

    try {
      // WHERE条件の構築
      const where: ReportWhereInput = this.buildWhereCondition(filter, userId, userRole);

      // ページネーション設定
      const page = filter.page || 1;
      const pageSize = filter.pageSize || 20;
      const skip = (page - 1) * pageSize;

      // データ取得
      const [reports, total] = await Promise.all([
        this.db.report.findMany({
          where,
          include: {
            user: true
          },
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' }
        }),
        this.db.report.count({ where })
      ]);

      return {
        data: reports as ReportResponseDTO[],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      logger.error('❌ Failed to get reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filter
      });

      throw new DatabaseError(
        'レポート一覧の取得に失敗しました',
        'REPORTS_GET_FAILED'
      );
    }
  }

  /**
   * レポート更新
   */
  async updateReport(
    id: string,
    data: UpdateReportRequest,
    userId: string,
    userRole: UserRole
  ): Promise<ReportResponseDTO> {
    logger.info('✏️ Updating report', { reportId: id, userId });

    try {
      // 既存レポート取得
      const existingReport = await this.getReportById(id, userId, userRole);

      // 編集権限チェック
      if (!this.canEditReport(existingReport, userId, userRole)) {
        throw new AuthorizationError(
          'このレポートの編集権限がありません',
          'REPORT_EDIT_DENIED'
        );
      }

      // バリデーション
      this.validateUpdateReportData(data);

      // レポート更新
      const updatedReport = await this.db.report.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          tags: data.tags,
          isPublic: data.isPublic,
          sharedWith: data.sharedWith
        },
        include: {
          user: true
        }
      });

      logger.info('✅ Report updated successfully', { reportId: id });

      return updatedReport as ReportResponseDTO;
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      logger.error('❌ Failed to update report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: id
      });

      throw new DatabaseError(
        'レポートの更新に失敗しました',
        'REPORT_UPDATE_FAILED'
      );
    }
  }

  /**
   * レポート削除
   */
  async deleteReport(
    id: string,
    userId: string,
    userRole: UserRole
  ): Promise<OperationResult> {
    logger.info('🗑️ Deleting report', { reportId: id, userId });

    try {
      // 既存レポート取得
      const existingReport = await this.getReportById(id, userId, userRole);

      // 削除権限チェック
      if (!this.canDeleteReport(existingReport, userId, userRole)) {
        throw new AuthorizationError(
          'このレポートの削除権限がありません',
          'REPORT_DELETE_DENIED'
        );
      }

      // レポート削除
      await this.db.report.delete({
        where: { id }
      });

      logger.info('✅ Report deleted successfully', { reportId: id });

      return {
        success: true,
        message: 'レポートを削除しました'
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }

      logger.error('❌ Failed to delete report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: id
      });

      throw new DatabaseError(
        'レポートの削除に失敗しました',
        'REPORT_DELETE_FAILED'
      );
    }
  }

  // =====================================
  // 2. レポート生成・ステータス管理
  // =====================================

  /**
   * レポート生成ステータス更新
   */
  async updateReportStatus(
    reportId: string,
    status: ReportGenerationStatus,
    resultData?: Record<string, any>,
    filePath?: string,
    fileSize?: number,
    errorMessage?: string
  ): Promise<ReportResponseDTO> {
    logger.info('🔄 Updating report status', { reportId, status });

    try {
      const updateData: Prisma.ReportUpdateInput = {
        status,
        resultData: resultData ? (resultData as Prisma.InputJsonValue) : undefined,
        filePath,
        fileSize,
        errorMessage
      };

      if (status === ReportGenerationStatus.COMPLETED) {
        updateData.generatedAt = new Date();
      }

      const updatedReport = await this.db.report.update({
        where: { id: reportId },
        data: updateData,
        include: {
          user: true
        }
      });

      logger.info('✅ Report status updated', { reportId, status });

      return updatedReport as ReportResponseDTO;
    } catch (error) {
      logger.error('❌ Failed to update report status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        status
      });

      throw new DatabaseError(
        'レポートステータスの更新に失敗しました',
        'REPORT_STATUS_UPDATE_FAILED'
      );
    }
  }

  /**
   * レポート生成状況取得
   */
  async getReportStatus(
    reportId: string,
    userId: string,
    userRole: UserRole
  ): Promise<{
    status: ReportGenerationStatus;
    progress?: number;
    generatedAt?: Date;
    errorMessage?: string;
  }> {
    const report = await this.getReportById(reportId, userId, userRole);

    return {
      status: report.status,
      generatedAt: report.generatedAt || undefined,
      errorMessage: report.errorMessage || undefined
    };
  }

  // =====================================
  // 3. レポート統計・分析
  // =====================================

  /**
   * レポート統計情報取得
   */
  async getReportStatistics(
    userId: string,
    userRole: UserRole
  ): Promise<ReportStatistics> {
    logger.info('📊 Getting report statistics', { userId });

    try {
      // アクセス可能なレポートのWHERE条件
      const where = this.buildAccessibleReportsWhere(userId, userRole);

      const [
        totalReports,
        reportsByType,
        reportsByFormat,
        reportsByStatus,
        recentReports
      ] = await Promise.all([
        // 総レポート数
        this.db.report.count({ where }),

        // タイプ別レポート数
        this.db.report.groupBy({
          by: ['reportType'],
          where,
          _count: true
        }),

        // フォーマット別レポート数
        this.db.report.groupBy({
          by: ['format'],
          where,
          _count: true
        }),

        // ステータス別レポート数
        this.db.report.groupBy({
          by: ['status'],
          where,
          _count: true
        }),

        // 最近のレポート（5件）
        this.db.report.findMany({
          where,
          include: {
            user: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        })
      ]);

      return {
        totalReports,
        reportsByType: reportsByType.reduce((acc, item) => {
          acc[item.reportType] = item._count;
          return acc;
        }, {} as Record<ReportType, number>),
        reportsByFormat: reportsByFormat.reduce((acc, item) => {
          acc[item.format] = item._count;
          return acc;
        }, {} as Record<ReportFormat, number>),
        reportsByStatus: reportsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<ReportGenerationStatus, number>),
        recentReports: recentReports as ReportResponseDTO[]
      };
    } catch (error) {
      logger.error('❌ Failed to get report statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });

      throw new DatabaseError(
        'レポート統計の取得に失敗しました',
        'REPORT_STATISTICS_FAILED'
      );
    }
  }

  // =====================================
  // 4. アクセス制御・権限管理
  // =====================================

  /**
   * レポートアクセス可否チェック
   */
  private canAccessReport(
    report: PrismaReport,
    userId: string,
    userRole: UserRole
  ): boolean {
    // 管理者は全アクセス可能
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // 作成者は常にアクセス可能
    if (report.generatedBy === userId) {
      return true;
    }

    // 公開レポートはアクセス可能
    if (report.isPublic) {
      return true;
    }

    // 共有されているユーザーはアクセス可能
    if (report.sharedWith.includes(userId)) {
      return true;
    }

    return false;
  }

  /**
   * レポート編集可否チェック
   */
  private canEditReport(
    report: PrismaReport,
    userId: string,
    userRole: UserRole
  ): boolean {
    // 管理者は編集可能
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // 作成者は編集可能
    if (report.generatedBy === userId) {
      return true;
    }

    return false;
  }

  /**
   * レポート削除可否チェック
   */
  private canDeleteReport(
    report: PrismaReport,
    userId: string,
    userRole: UserRole
  ): boolean {
    // 管理者は削除可能
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // 作成者は削除可能
    if (report.generatedBy === userId) {
      return true;
    }

    return false;
  }

  /**
   * アクセス可能なレポートのWHERE条件構築
   */
  private buildAccessibleReportsWhere(
    userId: string,
    userRole: UserRole
  ): ReportWhereInput {
    // 管理者は全レポートにアクセス可能
    if (userRole === UserRole.ADMIN) {
      return {};
    }

    // その他のユーザーは以下の条件でアクセス可能
    return {
      OR: [
        { generatedBy: userId },      // 自分が作成したレポート
        { isPublic: true },            // 公開レポート
        { sharedWith: { has: userId } } // 共有されたレポート
      ]
    };
  }

  // =====================================
  // 5. WHERE条件構築・バリデーション
  // =====================================

  /**
   * WHERE条件構築
   */
  private buildWhereCondition(
    filter: ReportFilter,
    userId: string,
    userRole: UserRole
  ): ReportWhereInput {
    const where: ReportWhereInput = {
      AND: [
        this.buildAccessibleReportsWhere(userId, userRole)
      ]
    };

    const andConditions = where.AND as ReportWhereInput[];

    // レポートタイプフィルター
    if (filter.reportType) {
      andConditions.push({
        reportType: Array.isArray(filter.reportType)
          ? { in: filter.reportType }
          : filter.reportType
      });
    }

    // フォーマットフィルター
    if (filter.format) {
      andConditions.push({
        format: Array.isArray(filter.format)
          ? { in: filter.format }
          : filter.format
      });
    }

    // ステータスフィルター
    if (filter.status) {
      andConditions.push({
        status: Array.isArray(filter.status)
          ? { in: filter.status }
          : filter.status
      });
    }

    // 作成者フィルター
    if (filter.generatedBy) {
      andConditions.push({ generatedBy: filter.generatedBy });
    }

    // タグフィルター
    if (filter.tags && filter.tags.length > 0) {
      andConditions.push({
        tags: { hasSome: filter.tags }
      });
    }

    // 公開フラグフィルター
    if (typeof filter.isPublic === 'boolean') {
      andConditions.push({ isPublic: filter.isPublic });
    }

    // 日付範囲フィルター
    if (filter.startDate || filter.endDate) {
      const dateFilter: any = {};
      if (filter.startDate) {
        dateFilter.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        dateFilter.lte = new Date(filter.endDate);
      }
      andConditions.push({ createdAt: dateFilter });
    }

    // 検索クエリ
    if (filter.search) {
      andConditions.push({
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } }
        ]
      });
    }

    return where;
  }

  /**
   * レポート作成データのバリデーション
   */
  private validateCreateReportData(data: CreateReportRequest): void {
    const errors: string[] = [];

    if (!data.reportType) {
      errors.push('レポートタイプは必須です');
    } else if (!isValidReportType(data.reportType)) {
      errors.push('無効なレポートタイプです');
    }

    if (!data.format) {
      errors.push('レポートフォーマットは必須です');
    } else if (!isValidReportFormat(data.format)) {
      errors.push('無効なレポートフォーマットです');
    }

    if (!data.title || data.title.trim().length === 0) {
      errors.push('レポートタイトルは必須です');
    } else if (data.title.length > 200) {
      errors.push('レポートタイトルは200文字以内で入力してください');
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (start > end) {
        errors.push('開始日は終了日より前である必要があります');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        `レポート作成データが無効です: ${errors.join(', ')}`
      );
    }
  }

  /**
   * レポート更新データのバリデーション
   */
  private validateUpdateReportData(data: UpdateReportRequest): void {
    const errors: string[] = [];

    if (data.title !== undefined) {
      if (data.title.trim().length === 0) {
        errors.push('レポートタイトルは空にできません');
      } else if (data.title.length > 200) {
        errors.push('レポートタイトルは200文字以内で入力してください');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        `レポート更新データが無効です: ${errors.join(', ')}`
      );
    }
  }

  // =====================================
  // 6. レポートテンプレート管理
  // =====================================

  /**
   * レポートテンプレート一覧取得
   */
  async getReportTemplates(userRole: UserRole): Promise<ReportTemplate[]> {
    const templates: ReportTemplate[] = [
      {
        id: 'daily-operation',
        name: '日次運行レポート',
        reportType: ReportType.DAILY_OPERATION,
        description: '指定日の運行詳細レポート',
        defaultFormat: ReportFormat.PDF,
        requiredParameters: ['date'],
        optionalParameters: ['driverId', 'vehicleId', 'includeStatistics'],
        supportedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER],
        exampleParameters: {
          date: '2025-10-05',
          includeStatistics: true
        }
      },
      {
        id: 'monthly-operation',
        name: '月次運行レポート',
        reportType: ReportType.MONTHLY_OPERATION,
        description: '月次運行統計レポート',
        defaultFormat: ReportFormat.EXCEL,
        requiredParameters: ['year', 'month'],
        optionalParameters: ['driverId', 'vehicleId', 'includeStatistics'],
        supportedRoles: [UserRole.ADMIN, UserRole.MANAGER],
        exampleParameters: {
          year: 2025,
          month: 10,
          includeStatistics: true
        }
      },
      {
        id: 'vehicle-utilization',
        name: '車両稼働レポート',
        reportType: ReportType.VEHICLE_UTILIZATION,
        description: '車両稼働率・効率分析レポート',
        defaultFormat: ReportFormat.PDF,
        requiredParameters: [],
        optionalParameters: ['startDate', 'endDate', 'vehicleIds', 'groupBy'],
        supportedRoles: [UserRole.ADMIN, UserRole.MANAGER],
        exampleParameters: {
          groupBy: 'MONTH',
          includeMaintenanceRecords: true
        }
      },
      {
        id: 'inspection-summary',
        name: '点検サマリーレポート',
        reportType: ReportType.INSPECTION_SUMMARY,
        description: '点検結果統計レポート',
        defaultFormat: ReportFormat.PDF,
        requiredParameters: [],
        optionalParameters: ['startDate', 'endDate', 'vehicleIds', 'inspectionTypes'],
        supportedRoles: [UserRole.ADMIN, UserRole.MANAGER],
        exampleParameters: {
          groupBy: 'TYPE',
          includeFailedItems: true
        }
      }
    ];

    // ユーザーの役割に応じてテンプレートをフィルタリング
    return templates.filter(template =>
      template.supportedRoles.includes(userRole)
    );
  }
}

// =====================================
// 📤 エクスポート（シングルトン）
// =====================================

let reportServiceInstance: ReportService | null = null;

export const getReportService = (): ReportService => {
  if (!reportServiceInstance) {
    reportServiceInstance = new ReportService();
  }
  return reportServiceInstance;
};

// 注: ReportServiceは既にクラス定義時にexportされているため、ここでは不要

// =====================================
// ✅ models/ReportModel.ts 完全実装完了
// =====================================
