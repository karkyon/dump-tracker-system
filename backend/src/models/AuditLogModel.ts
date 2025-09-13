// =====================================
// AuditLogModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:22 PM JST 2025
// テーブルアクセサ: auditLog
// =====================================

import type { 
  AuditLog as PrismaAuditLog,
  Prisma,
  User,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type AuditLogModel = PrismaAuditLog;
export type AuditLogCreateInput = Prisma.AuditLogCreateInput;
export type AuditLogUpdateInput = Prisma.AuditLogUpdateInput;  
export type AuditLogWhereInput = Prisma.AuditLogWhereInput;
export type AuditLogWhereUniqueInput = Prisma.AuditLogWhereUniqueInput;
export type AuditLogOrderByInput = Prisma.AuditLogOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface AuditLogResponseDTO extends AuditLogModel {
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

export interface AuditLogCreateDTO extends Omit<AuditLogCreateInput, 'id'> {
  // フロントエンド送信用
}

export interface AuditLogUpdateDTO extends Partial<AuditLogCreateDTO> {
  // 更新用（部分更新対応）
}

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
      data: {
        ...data,

      }
    });
  }

  /**
   * 主キー指定取得
   */
  async findByKey(id: string): Promise<AuditLogModel | null> {
    return await this.prisma.auditLog.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: AuditLogWhereInput;
    orderBy?: AuditLogOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<AuditLogModel[]> {
    return await this.prisma.auditLog.findMany({
      where: params?.where,
      orderBy: params?.orderBy || {},
      skip: params?.skip,
      take: params?.take
    });
  }

  /**
   * ページネーション付き一覧取得
   */
  async findManyWithPagination(params: {
    where?: AuditLogWhereInput;
    orderBy?: AuditLogOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<AuditLogListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: orderBy || {},
        skip,
        take: pageSize
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
  async update(id: string, data: AuditLogUpdateInput): Promise<AuditLogModel> {
    return await this.prisma.auditLog.update({
      where: { id },
      data: {
        ...data,

      }
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
