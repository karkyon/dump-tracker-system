// =====================================
// AuditLogModel.ts
// 修正版 - Prisma型エラー解消済み
// 生成日時: Tue Sep 16 10:05:28 AM JST 2025
// テーブルアクセサ: auditLog
// =====================================

import { PrismaClient, Prisma } from '@prisma/client';

// =====================================
// 基本型定義（修正版）
// =====================================

// 正しいPrisma型の参照
export type AuditLogModel = Prisma.AuditLogGetPayload<{}>;
export type UserModel = Prisma.UserGetPayload<{}>;

// 正しい入力型の定義
export type AuditLogCreateInput = Prisma.AuditLogCreateInput;
export type AuditLogUpdateInput = Prisma.AuditLogUpdateInput;
export type AuditLogWhereInput = Prisma.AuditLogWhereInput;
export type AuditLogWhereUniqueInput = Prisma.AuditLogWhereUniqueInput;
export type AuditLogOrderByInput = Prisma.AuditLogOrderByWithRelationInput;
export type AuditLogInclude = Prisma.AuditLogInclude;

// =====================================
// 標準DTO
// =====================================

export interface AuditLogResponseDTO extends AuditLogModel {
  users?: UserModel;
  _count?: {
    [key: string]: number;
  };
}

export interface AuditLogListResponse {
  data: AuditLogModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 作成用DTO（フロントエンド用）
export interface AuditLogCreateDTO {
  tableName: string;
  operationType: string;
  recordId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: any;
  newValues?: any;
}

// 更新用DTO（フロントエンド用）
export interface AuditLogUpdateDTO extends Partial<AuditLogCreateDTO> {}

// =====================================
// 基本CRUDクラス
// =====================================

export class AuditLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: AuditLogCreateInput): Promise<AuditLogModel> {
    return await this.prisma.auditLog.create({
      data
    });
  }

  /**
   * 主キー指定取得
   */
  async findByKey(
    id: string, 
    include?: AuditLogInclude
  ): Promise<AuditLogModel | null> {
    return await this.prisma.auditLog.findUnique({
      where: { id },
      include
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: AuditLogWhereInput;
    orderBy?: AuditLogOrderByInput | AuditLogOrderByInput[];
    skip?: number;
    take?: number;
    include?: AuditLogInclude;
  }): Promise<AuditLogModel[]> {
    return await this.prisma.auditLog.findMany({
      where: params?.where,
      orderBy: params?.orderBy || { createdAt: 'desc' },
      skip: params?.skip,
      take: params?.take,
      include: params?.include
    });
  }

  /**
   * ページネーション付き一覧取得
   */
  async findManyWithPagination(params: {
    where?: AuditLogWhereInput;
    orderBy?: AuditLogOrderByInput | AuditLogOrderByInput[];
    page: number;
    pageSize: number;
    include?: AuditLogInclude;
  }): Promise<AuditLogListResponse> {
    const { page, pageSize, where, orderBy, include } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize,
        include
      }),
      this.prisma.auditLog.count({ where })
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
  async update(
    id: string, 
    data: AuditLogUpdateInput,
    include?: AuditLogInclude
  ): Promise<AuditLogModel> {
    return await this.prisma.auditLog.update({
      where: { id },
      data,
      include
    });
  }

  /**
   * 削除
   */
  async delete(id: string): Promise<AuditLogModel> {
    return await this.prisma.auditLog.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.auditLog.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: AuditLogWhereInput): Promise<number> {
    return await this.prisma.auditLog.count({ where });
  }

  /**
   * ユーザー別監査ログ取得
   */
  async findByUser(
    userId: string,
    params?: {
      page?: number;
      pageSize?: number;
      operationType?: string;
      tableName?: string;
    }
  ): Promise<AuditLogListResponse> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    
    const where: AuditLogWhereInput = {
      userId,
      ...(params?.operationType && { operationType: params.operationType }),
      ...(params?.tableName && { tableName: params.tableName })
    };

    return this.findManyWithPagination({
      where,
      page,
      pageSize,
      orderBy: { createdAt: 'desc' },
      include: { users: true }
    });
  }

  /**
   * 操作タイプ別監査ログ取得
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
      include: { users: true }
    });
  }

  /**
   * テーブル別監査ログ取得
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
      include: { users: true }
    });
  }

  /**
   * 日付範囲での監査ログ取得
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
      include: { users: true }
    });
  }

  /**
   * レコード変更履歴取得
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
   * 監査ログ統計情報取得
   */
  async getAuditStatistics(params?: {
    dateFrom?: Date;
    dateTo?: Date;
    userId?: string;
  }): Promise<{
    totalLogs: number;
    operationTypeCounts: { operationType: string; count: number }[];
    tableNameCounts: { tableName: string; count: number }[];
    dailyCounts: { date: string; count: number }[];
  }> {
    const where: AuditLogWhereInput = {
      ...(params?.dateFrom || params?.dateTo) && {
        createdAt: {
          ...(params?.dateFrom && { gte: params.dateFrom }),
          ...(params?.dateTo && { lte: params.dateTo })
        }
      },
      ...(params?.userId && { userId: params.userId })
    };

    const [totalLogs, operationTypeStats, tableNameStats] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['operationType'],
        where,
        _count: { operationType: true }
      }),
      this.prisma.auditLog.groupBy({
        by: ['tableName'],
        where,
        _count: { tableName: true }
      })
    ]);

    return {
      totalLogs,
      operationTypeCounts: operationTypeStats.map(stat => ({
        operationType: stat.operationType,
        count: stat._count.operationType
      })),
      tableNameCounts: tableNameStats.map(stat => ({
        tableName: stat.tableName,
        count: stat._count.tableName
      })),
      dailyCounts: [] // 必要に応じて実装
    };
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _auditlogServiceInstance: AuditLogService | null = null;

export const getAuditLogService = (prisma?: PrismaClient): AuditLogService => {
  if (!_auditlogServiceInstance) {
    _auditlogServiceInstance = new AuditLogService(prisma || new PrismaClient());
  }
  return _auditlogServiceInstance;
};

export type { AuditLogModel as default };