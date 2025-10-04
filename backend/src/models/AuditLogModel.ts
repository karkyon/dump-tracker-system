// =====================================
// backend/src/models/AuditLogModel.ts
// 監査ログモデル - 完全アーキテクチャ改修版
// Phase 1-B-7: 既存完全実装統合・監査システム強化
// アーキテクチャ指針準拠版（Phase 1-A基盤活用）
// 作成日時: 2025年9月16日
// 更新日時: 2025年9月27日 14:00
// =====================================

import { PrismaClient, Prisma } from '@prisma/client';

// 🎯 Phase 1-A完了基盤の活用
import logger from '../utils/logger';
import { 
  AppError, 
  ValidationError, 
  NotFoundError,
  DatabaseError,
  SecurityError 
} from '../utils/errors';

import type {
  ApiResponse,
  ApiListResponse,
  PaginationQuery,
  SearchQuery,
  DateRange,
  StatisticsBase,
  ValidationResult,
  OperationResult
} from '../types/common';

// =====================================
// 🔧 基本型定義（既存実装保持・改良）
// =====================================

export type AuditLogModel = Prisma.AuditLogGetPayload<{}>;
export type UserModel = Prisma.UserGetPayload<{}>;

export type AuditLogCreateInput = Prisma.AuditLogCreateInput;
export type AuditLogUpdateInput = Prisma.AuditLogUpdateInput;
export type AuditLogWhereInput = Prisma.AuditLogWhereInput;
export type AuditLogWhereUniqueInput = Prisma.AuditLogWhereUniqueInput;
export type AuditLogOrderByInput = Prisma.AuditLogOrderByWithRelationInput;
export type AuditLogInclude = Prisma.AuditLogInclude;

// =====================================
// 🔧 監査ログ強化型定義（セキュリティ・分析機能）
// =====================================

/**
 * 操作タイプ定義（拡張版）
 */
export enum AuditOperationType {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  FAILED_LOGIN = 'FAILED_LOGIN',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  BACKUP = 'BACKUP',
  RESTORE = 'RESTORE'
}

/**
 * セキュリティレベル定義
 */
export enum SecurityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * 監査コンテキスト情報
 */
export interface AuditContext {
  sessionId?: string;
  requestId?: string;
  sourceSystem?: string;
  apiVersion?: string;
  clientVersion?: string;
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
  deviceInfo?: {
    type?: 'WEB' | 'MOBILE' | 'API' | 'SYSTEM';
    os?: string;
    browser?: string;
  };
}

/**
 * セキュリティ分析結果
 */
export interface SecurityAnalysisResult {
  riskLevel: SecurityLevel;
  anomalies: {
    type: 'UNUSUAL_TIME' | 'UNUSUAL_LOCATION' | 'UNUSUAL_VOLUME' | 'SUSPICIOUS_PATTERN';
    severity: SecurityLevel;
    description: string;
    confidence: number; // 0-100
  }[];
  recommendations: string[];
}

/**
 * 監査統計情報（拡張版）
 */
export interface AuditLogStatistics extends StatisticsBase {
  operationCounts: Record<AuditOperationType, number>;
  userActivityCounts: Record<string, number>;
  tableActivityCounts: Record<string, number>;
  hourlyDistribution: Record<string, number>;
  weeklyDistribution: Record<string, number>;
  securityEvents: {
    failedLogins: number;
    suspiciousActivities: number;
    highRiskOperations: number;
  };
  systemHealth: {
    averageResponseTime: number;
    errorRate: number;
    peakUsageHours: string[];
  };
}

/**
 * 監査ログ検索フィルタ（拡張版）
 */
export interface AuditLogFilter extends PaginationQuery, SearchQuery, DateRange {
  userId?: string;
  userIds?: string[];
  tableName?: string;
  tableNames?: string[];
  operationType?: AuditOperationType;
  operationTypes?: AuditOperationType[];
  securityLevel?: SecurityLevel;
  hasAnomalies?: boolean;
  ipAddress?: string;
  sessionId?: string;
  recordId?: string;
  includeSystemOperations?: boolean;
  excludeReadOperations?: boolean;
}

// =====================================
// 🔧 標準DTO（既存実装保持・拡張）
// =====================================

export interface AuditLogResponseDTO extends AuditLogModel {
  user?: UserModel;
  context?: AuditContext;
  securityAnalysis?: SecurityAnalysisResult;
  relatedLogs?: AuditLogModel[];
  _count?: {
    [key: string]: number;
  };
}

export interface AuditLogListResponse extends ApiListResponse<AuditLogResponseDTO> {
  summary?: {
    totalOperations: number;
    uniqueUsers: number;
    securityEvents: number;
    anomaliesCount: number;
  };
  statistics?: AuditLogStatistics;
  securitySummary?: {
    overallRisk: SecurityLevel;
    criticalAlerts: number;
    recommendations: string[];
  };
}

export interface AuditLogCreateDTO extends Omit<AuditLogCreateInput, 'id'> {
  context?: AuditContext;
  securityLevel?: SecurityLevel;
  autoAnalyze?: boolean;
}

export interface AuditLogUpdateDTO extends Partial<AuditLogCreateDTO> {
  // 監査ログの更新は通常制限される
  notes?: string;
  reviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
}

// =====================================
// 🎯 監査ログ強化CRUDクラス（アーキテクチャ指針準拠）
// =====================================

export class AuditLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 🔧 新規作成（セキュリティ分析統合）
   */
  async create(data: AuditLogCreateInput, context?: AuditContext): Promise<AuditLogResponseDTO> {
    try {
      // セキュリティレベル自動判定
      const securityLevel = this.determineSecurityLevel(data);
      
      // 監査ログ記録開始
      logger.info('監査ログ作成開始', {
        tableName: data.tableName,
        operationType: data.operationType,
        userId: data.userId,
        securityLevel,
        context
      });

      const auditLog = await this.prisma.auditLog.create({
        data: {
          ...data,
          // コンテキスト情報をJSONとして保存
          ...(context && { 
            userAgent: context.deviceInfo ? 
              JSON.stringify(context.deviceInfo) : data.userAgent 
          })
        },
        include: {
          users: true
        }
      });

      // セキュリティ分析の実行
      let securityAnalysis: SecurityAnalysisResult | undefined;
      if (securityLevel === SecurityLevel.HIGH || securityLevel === SecurityLevel.CRITICAL) {
        securityAnalysis = await this.performSecurityAnalysis(auditLog);
      }

      const enhancedResult: AuditLogResponseDTO = {
        ...auditLog,
        context,
        securityAnalysis
      };

      // 異常検知時のアラート
      if (securityAnalysis?.riskLevel === SecurityLevel.CRITICAL) {
        logger.warn('重大なセキュリティイベント検出', {
          auditLogId: auditLog.id,
          riskLevel: securityAnalysis.riskLevel,
          anomalies: securityAnalysis.anomalies
        });
      }

      logger.info('監査ログ作成完了', { 
        id: auditLog.id,
        securityLevel,
        riskLevel: securityAnalysis?.riskLevel 
      });

      return enhancedResult;

    } catch (error) {
      logger.error('監査ログ作成エラー', { error, data, context });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('監査ログの作成に失敗しました');
    }
  }

  /**
   * 🔧 主キー指定取得（既存実装保持・拡張）
   */
  async findByKey(id: string, includeAnalysis: boolean = false): Promise<AuditLogResponseDTO | null> {
    try {
      const result = await this.prisma.auditLog.findUnique({
        where: { id },
        include: {
          users: true
        }
      });

      if (!result) {
        return null;
      }

      const enhanced: AuditLogResponseDTO = { ...result };

      // セキュリティ分析を含める場合
      if (includeAnalysis) {
        enhanced.securityAnalysis = await this.performSecurityAnalysis(result);
        enhanced.relatedLogs = await this.findRelatedLogs(result);
      }

      return enhanced;

    } catch (error) {
      logger.error('監査ログ取得エラー', { error, id });
      throw new DatabaseError('監査ログの取得に失敗しました');
    }
  }

  /**
   * 🔧 条件指定一覧取得（既存実装保持・拡張）
   */
  async findMany(params?: {
    where?: AuditLogWhereInput;
    orderBy?: AuditLogOrderByInput | AuditLogOrderByInput[];
    skip?: number;
    take?: number;
    includeAnalysis?: boolean;
  }): Promise<AuditLogResponseDTO[]> {
    try {
      const results = await this.prisma.auditLog.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take,
        include: {
          users: true
        }
      });

      // セキュリティ分析を含める場合
      if (params?.includeAnalysis) {
        const enhanced = await Promise.all(
          results.map(async (log) => ({
            ...log,
            securityAnalysis: await this.performSecurityAnalysis(log)
          }))
        );
        return enhanced;
      }

      return results;

    } catch (error) {
      logger.error('監査ログ一覧取得エラー', { error, params });
      throw new DatabaseError('監査ログ一覧の取得に失敗しました');
    }
  }

  /**
   * 🔧 ページネーション付き一覧取得（統計・セキュリティ分析追加）
   */
  async findManyWithPagination(params: {
    where?: AuditLogWhereInput;
    orderBy?: AuditLogOrderByInput | AuditLogOrderByInput[];
    page: number;
    pageSize: number;
    includeStatistics?: boolean;
    includeSecurityAnalysis?: boolean;
  }): Promise<AuditLogListResponse> {
    try {
      const { page, pageSize, where, orderBy } = params;
      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        this.findMany({
          where,
          orderBy,
          skip,
          take: pageSize,
          includeAnalysis: params.includeSecurityAnalysis
        }),
        this.prisma.auditLog.count({ where })
      ]);

      const response: AuditLogListResponse = {
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

      // 統計情報の追加
      if (params.includeStatistics) {
        response.statistics = await this.calculateStatistics(where);
        response.summary = {
          totalOperations: total,
          uniqueUsers: await this.countUniqueUsers(where),
          securityEvents: await this.countSecurityEvents(where),
          anomaliesCount: data.filter(log => 
            log.securityAnalysis?.anomalies && log.securityAnalysis.anomalies.length > 0
          ).length
        };
      }

      // セキュリティサマリーの追加
      if (params.includeSecurityAnalysis) {
        response.securitySummary = await this.generateSecuritySummary(data);
      }

      return response;

    } catch (error) {
      logger.error('監査ログページネーション取得エラー', { error, params });
      throw new DatabaseError('監査ログページネーション取得に失敗しました');
    }
  }

  /**
   * 🔧 ユーザー別監査ログ取得（既存実装保持）
   */
  async findByUser(
    userId: string,
    params?: {
      page?: number;
      pageSize?: number;
      operationType?: string;
      tableName?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<AuditLogListResponse> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    
    const where: AuditLogWhereInput = {
      userId,
      ...(params?.operationType && { operationType: params.operationType }),
      ...(params?.tableName && { tableName: params.tableName }),
      ...(params?.dateFrom || params?.dateTo) && {
        createdAt: {
          ...(params?.dateFrom && { gte: params.dateFrom }),
          ...(params?.dateTo && { lte: params.dateTo })
        }
      }
    };

    return this.findManyWithPagination({
      where,
      page,
      pageSize,
      orderBy: { createdAt: 'desc' },
      includeStatistics: true
    });
  }

  /**
   * 🔧 操作タイプ別監査ログ取得（既存実装保持）
   */
  async findByOperationType(
    operationType: string,
    params?: {
      page?: number;
      pageSize?: number;
      tableName?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<AuditLogListResponse> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    
    const where: AuditLogWhereInput = {
      operationType,
      ...(params?.tableName && { tableName: params.tableName }),
      ...(params?.dateFrom || params?.dateTo) && {
        createdAt: {
          ...(params?.dateFrom && { gte: params.dateFrom }),
          ...(params?.dateTo && { lte: params.dateTo })
        }
      }
    };

    return this.findManyWithPagination({
      where,
      page,
      pageSize,
      orderBy: { createdAt: 'desc' },
      includeStatistics: true
    });
  }

  /**
   * 🔧 テーブル別監査ログ取得（既存実装保持）
   */
  async findByTable(
    tableName: string,
    recordId?: string,
    params?: {
      page?: number;
      pageSize?: number;
    }
  ): Promise<AuditLogListResponse> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    
    const where: AuditLogWhereInput = {
      tableName,
      ...(recordId && { recordId })
    };

    return this.findManyWithPagination({
      where,
      page,
      pageSize,
      orderBy: { createdAt: 'desc' },
      includeStatistics: true
    });
  }

  /**
   * 🔧 日付範囲での監査ログ取得（既存実装保持）
   */
  async findByDateRange(
    dateFrom: Date,
    dateTo: Date,
    params?: {
      page?: number;
      pageSize?: number;
      userId?: string;
      tableName?: string;
      operationType?: string;
    }
  ): Promise<AuditLogListResponse> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    
    const where: AuditLogWhereInput = {
      createdAt: {
        gte: dateFrom,
        lte: dateTo
      },
      ...(params?.userId && { userId: params.userId }),
      ...(params?.tableName && { tableName: params.tableName }),
      ...(params?.operationType && { operationType: params.operationType })
    };

    return this.findManyWithPagination({
      where,
      page,
      pageSize,
      orderBy: { createdAt: 'desc' },
      includeStatistics: true,
      includeSecurityAnalysis: true
    });
  }

  /**
   * 🔧 レコード変更履歴取得（既存実装保持）
   */
  async getRecordHistory(
    tableName: string,
    recordId: string,
    params?: {
      page?: number;
      pageSize?: number;
    }
  ): Promise<AuditLogListResponse> {
    return this.findByTable(tableName, recordId, params);
  }

  /**
   * 🔧 監査ログ統計情報取得（既存実装保持・拡張）
   */
  async getAuditStatistics(params?: {
    dateFrom?: Date;
    dateTo?: Date;
    userId?: string;
    tableName?: string;
  }): Promise<AuditLogStatistics> {
    try {
      const where: AuditLogWhereInput = {
        ...(params?.dateFrom || params?.dateTo) && {
          createdAt: {
            ...(params?.dateFrom && { gte: params.dateFrom }),
            ...(params?.dateTo && { lte: params.dateTo })
          }
        },
        ...(params?.userId && { userId: params.userId }),
        ...(params?.tableName && { tableName: params.tableName })
      };

      return await this.calculateStatistics(where);

    } catch (error) {
      logger.error('監査統計情報取得エラー', { error, params });
      throw new DatabaseError('監査統計情報の取得に失敗しました');
    }
  }

  /**
   * 🚨 セキュリティイベント検索（新機能）
   */
  async findSecurityEvents(params: {
    securityLevel?: SecurityLevel;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<AuditLogListResponse> {
    const securityOperations = [
      AuditOperationType.LOGIN,
      AuditOperationType.FAILED_LOGIN,
      AuditOperationType.PASSWORD_CHANGE,
      AuditOperationType.PERMISSION_CHANGE,
      AuditOperationType.SYSTEM_CONFIG
    ];

    const where: AuditLogWhereInput = {
      operationType: { in: securityOperations },
      ...(params.dateFrom || params.dateTo) && {
        createdAt: {
          ...(params.dateFrom && { gte: params.dateFrom }),
          ...(params.dateTo && { lte: params.dateTo })
        }
      }
    };

    return this.findManyWithPagination({
      where,
      page: params.page || 1,
      pageSize: params.pageSize || 50,
      orderBy: { createdAt: 'desc' },
      includeSecurityAnalysis: true,
      includeStatistics: true
    });
  }

  /**
   * 🔧 更新（制限付き）
   */
  async update(id: string, data: AuditLogUpdateDTO): Promise<AuditLogResponseDTO> {
    try {
      // 監査ログの更新は制限されるため、限定的な項目のみ
      const allowedUpdates = {
        notes: data.notes,
        reviewed: data.reviewed,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt
      };

      const result = await this.prisma.auditLog.update({
        where: { id },
        data: allowedUpdates,
        include: {
          users: true
        }
      });

      logger.info('監査ログ更新完了', { id, updates: allowedUpdates });

      return result;

    } catch (error) {
      logger.error('監査ログ更新エラー', { error, id, data });
      throw new DatabaseError('監査ログの更新に失敗しました');
    }
  }

  /**
   * 🔧 削除（制限付き・セキュリティログ）
   */
  async delete(id: string, reason: string, deletedBy: string): Promise<void> {
    try {
      // 削除前にセキュリティログを記録
      await this.create({
        tableName: 'audit_log',
        operationType: AuditOperationType.DELETE,
        recordId: id,
        userId: deletedBy,
        oldValues: { reason },
        ipAddress: '',
        userAgent: 'SYSTEM'
      });

      await this.prisma.auditLog.delete({
        where: { id }
      });

      logger.warn('監査ログ削除実行', { id, reason, deletedBy });

    } catch (error) {
      logger.error('監査ログ削除エラー', { error, id, reason, deletedBy });
      throw new DatabaseError('監査ログの削除に失敗しました');
    }
  }

  // =====================================
  // 🔒 セキュリティ・分析関数（新機能）
  // =====================================

  /**
   * セキュリティレベル判定
   */
  private determineSecurityLevel(data: AuditLogCreateInput): SecurityLevel {
    const criticalOperations = [
      AuditOperationType.DELETE,
      AuditOperationType.PERMISSION_CHANGE,
      AuditOperationType.SYSTEM_CONFIG,
      AuditOperationType.BACKUP,
      AuditOperationType.RESTORE
    ];

    const highOperations = [
      AuditOperationType.CREATE,
      AuditOperationType.UPDATE,
      AuditOperationType.PASSWORD_CHANGE,
      AuditOperationType.EXPORT
    ];

    if (criticalOperations.includes(data.operationType as AuditOperationType)) {
      return SecurityLevel.CRITICAL;
    }
    if (highOperations.includes(data.operationType as AuditOperationType)) {
      return SecurityLevel.HIGH;
    }
    if (data.operationType === AuditOperationType.FAILED_LOGIN) {
      return SecurityLevel.MEDIUM;
    }
    return SecurityLevel.LOW;
  }

  /**
   * セキュリティ分析実行
   */
  private async performSecurityAnalysis(auditLog: AuditLogModel): Promise<SecurityAnalysisResult> {
    const anomalies: SecurityAnalysisResult['anomalies'] = [];

    // 異常な時間帯チェック
    const hour = new Date(auditLog.createdAt).getHours();
    if (hour < 6 || hour > 22) {
      anomalies.push({
        type: 'UNUSUAL_TIME',
        severity: SecurityLevel.MEDIUM,
        description: `異常な時間帯での操作: ${hour}時`,
        confidence: 75
      });
    }

    // 連続失敗ログインチェック
    if (auditLog.operationType === AuditOperationType.FAILED_LOGIN) {
      const recentFailures = await this.prisma.auditLog.count({
        where: {
          userId: auditLog.userId,
          operationType: AuditOperationType.FAILED_LOGIN,
          createdAt: {
            gte: new Date(Date.now() - 30 * 60 * 1000) // 過去30分
          }
        }
      });

      if (recentFailures >= 3) {
        anomalies.push({
          type: 'SUSPICIOUS_PATTERN',
          severity: SecurityLevel.HIGH,
          description: `連続ログイン失敗: ${recentFailures}回`,
          confidence: 90
        });
      }
    }

    // リスクレベル決定
    const maxSeverity = anomalies.reduce((max, anomaly) => {
      const severityOrder = [SecurityLevel.LOW, SecurityLevel.MEDIUM, SecurityLevel.HIGH, SecurityLevel.CRITICAL];
      return severityOrder.indexOf(anomaly.severity) > severityOrder.indexOf(max) ? anomaly.severity : max;
    }, SecurityLevel.LOW);

    return {
      riskLevel: maxSeverity,
      anomalies,
      recommendations: this.generateSecurityRecommendations(anomalies)
    };
  }

  /**
   * セキュリティ推奨事項生成
   */
  private generateSecurityRecommendations(anomalies: SecurityAnalysisResult['anomalies']): string[] {
    const recommendations: string[] = [];

    if (anomalies.some(a => a.type === 'UNUSUAL_TIME')) {
      recommendations.push('業務時間外のアクセスパターンを監視してください');
    }

    if (anomalies.some(a => a.type === 'SUSPICIOUS_PATTERN')) {
      recommendations.push('アカウントのセキュリティ設定を確認してください');
      recommendations.push('2要素認証の有効化を検討してください');
    }

    if (anomalies.some(a => a.severity === SecurityLevel.CRITICAL)) {
      recommendations.push('即座にセキュリティチームに報告してください');
    }

    return recommendations;
  }

  /**
   * 関連ログ検索
   */
  private async findRelatedLogs(auditLog: AuditLogModel): Promise<AuditLogModel[]> {
    return await this.prisma.auditLog.findMany({
      where: {
        OR: [
          {
            recordId: auditLog.recordId,
            tableName: auditLog.tableName
          },
          {
            userId: auditLog.userId,
            createdAt: {
              gte: new Date(auditLog.createdAt.getTime() - 5 * 60 * 1000),
              lte: new Date(auditLog.createdAt.getTime() + 5 * 60 * 1000)
            }
          }
        ],
        id: { not: auditLog.id }
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * 統計情報計算
   */
  private async calculateStatistics(where?: AuditLogWhereInput): Promise<AuditLogStatistics> {
    const [
      total,
      operationCounts,
      userCounts,
      tableCounts
    ] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.getOperationCounts(where),
      this.getUserActivityCounts(where),
      this.getTableActivityCounts(where)
    ]);

    return {
      total,
      operationCounts,
      userActivityCounts: userCounts,
      tableActivityCounts: tableCounts,
      hourlyDistribution: await this.getHourlyDistribution(where),
      weeklyDistribution: await this.getWeeklyDistribution(where),
      securityEvents: await this.getSecurityEventCounts(where),
      systemHealth: await this.getSystemHealthMetrics(where)
    };
  }

  /**
   * 操作タイプ別カウント
   */
  private async getOperationCounts(where?: AuditLogWhereInput): Promise<Record<AuditOperationType, number>> {
    const counts = await this.prisma.auditLog.groupBy({
      by: ['operationType'],
      where,
      _count: { operationType: true }
    });

    const result = Object.values(AuditOperationType).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as Record<AuditOperationType, number>);

    counts.forEach(count => {
      if (Object.values(AuditOperationType).includes(count.operationType as AuditOperationType)) {
        result[count.operationType as AuditOperationType] = count._count.operationType;
      }
    });

    return result;
  }

  /**
   * ユーザー活動カウント
   */
  private async getUserActivityCounts(where?: AuditLogWhereInput): Promise<Record<string, number>> {
    const counts = await this.prisma.auditLog.groupBy({
      by: ['userId'],
      where: { ...where, userId: { not: null } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 50
    });

    return counts.reduce((acc, count) => {
      if (count.userId) {
        acc[count.userId] = count._count.userId;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * テーブル活動カウント
   */
  private async getTableActivityCounts(where?: AuditLogWhereInput): Promise<Record<string, number>> {
    const counts = await this.prisma.auditLog.groupBy({
      by: ['tableName'],
      where,
      _count: { tableName: true },
      orderBy: { _count: { tableName: 'desc' } }
    });

    return counts.reduce((acc, count) => {
      acc[count.tableName] = count._count.tableName;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * 時間別分布取得
   */
  private async getHourlyDistribution(where?: AuditLogWhereInput): Promise<Record<string, number>> {
    // SQLレベルでの時間別集計（Prismaの制限により簡易実装）
    const logs = await this.prisma.auditLog.findMany({
      where,
      select: { createdAt: true }
    });

    const distribution: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      distribution[i.toString()] = 0;
    }

    logs.forEach(log => {
      const hour = new Date(log.createdAt).getHours().toString();
      distribution[hour]++;
    });

    return distribution;
  }

  /**
   * 週別分布取得
   */
  private async getWeeklyDistribution(where?: AuditLogWhereInput): Promise<Record<string, number>> {
    const logs = await this.prisma.auditLog.findMany({
      where,
      select: { createdAt: true }
    });

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const distribution: Record<string, number> = {};
    weekdays.forEach(day => distribution[day] = 0);

    logs.forEach(log => {
      const dayOfWeek = weekdays[new Date(log.createdAt).getDay()];
      distribution[dayOfWeek]++;
    });

    return distribution;
  }

  /**
   * セキュリティイベントカウント
   */
  private async getSecurityEventCounts(where?: AuditLogWhereInput) {
    const [failedLogins, suspiciousActivities, highRiskOperations] = await Promise.all([
      this.prisma.auditLog.count({
        where: { ...where, operationType: AuditOperationType.FAILED_LOGIN }
      }),
      this.prisma.auditLog.count({
        where: { ...where, operationType: AuditOperationType.PERMISSION_CHANGE }
      }),
      this.prisma.auditLog.count({
        where: { 
          ...where, 
          operationType: { 
            in: [AuditOperationType.DELETE, AuditOperationType.SYSTEM_CONFIG] 
          } 
        }
      })
    ]);

    return {
      failedLogins,
      suspiciousActivities,
      highRiskOperations
    };
  }

  /**
   * システム健全性メトリクス
   */
  private async getSystemHealthMetrics(where?: AuditLogWhereInput) {
    return {
      averageResponseTime: 150, // 実装時に計算
      errorRate: 0.05, // 実装時に計算
      peakUsageHours: ['09:00', '13:00', '17:00']
    };
  }

  /**
   * ユニークユーザー数カウント
   */
  private async countUniqueUsers(where?: AuditLogWhereInput): Promise<number> {
    const result = await this.prisma.auditLog.groupBy({
      by: ['userId'],
      where: { ...where, userId: { not: null } }
    });
    return result.length;
  }

  /**
   * セキュリティイベント数カウント
   */
  private async countSecurityEvents(where?: AuditLogWhereInput): Promise<number> {
    return await this.prisma.auditLog.count({
      where: {
        ...where,
        operationType: {
          in: [
            AuditOperationType.LOGIN,
            AuditOperationType.FAILED_LOGIN,
            AuditOperationType.PASSWORD_CHANGE,
            AuditOperationType.PERMISSION_CHANGE
          ]
        }
      }
    });
  }

  /**
   * セキュリティサマリー生成
   */
  private async generateSecuritySummary(logs: AuditLogResponseDTO[]) {
    const criticalLogs = logs.filter(log => 
      log.securityAnalysis?.riskLevel === SecurityLevel.CRITICAL
    );

    const allRecommendations = logs
      .flatMap(log => log.securityAnalysis?.recommendations || [])
      .filter((rec, index, arr) => arr.indexOf(rec) === index); // 重複除去

    return {
      overallRisk: criticalLogs.length > 0 ? SecurityLevel.CRITICAL : SecurityLevel.LOW,
      criticalAlerts: criticalLogs.length,
      recommendations: allRecommendations.slice(0, 5) // 上位5件
    };
  }
}

// =====================================
// 🏭 ファクトリ関数（DI対応）
// =====================================

/**
 * AuditLogServiceのファクトリ関数
 * Phase 1-A基盤準拠のDI対応
 */
export function getAuditLogService(prisma: PrismaClient): AuditLogService {
  return new AuditLogService(prisma);
}

// =====================================
// 🔧 エクスポート（types/index.ts統合用）
// =====================================

export default AuditLogService;

// 監査ログ機能追加エクスポート
export type {
  AuditContext,
  SecurityAnalysisResult,
  AuditLogStatistics,
  AuditLogFilter,
  SecurityLevel
};

export {
  AuditOperationType
};