// =====================================
// GpsLogModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:22 PM JST 2025
// テーブルアクセサ: gpsLog
// =====================================

import type { 
  GpsLog as PrismaGpsLog,
  Prisma,
  Operation,
  Vehicle,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type GpsLogModel = PrismaGpsLog;
export type GpsLogCreateInput = Prisma.GpsLogCreateInput;
export type GpsLogUpdateInput = Prisma.GpsLogUpdateInput;  
export type GpsLogWhereInput = Prisma.GpsLogWhereInput;
export type GpsLogWhereUniqueInput = Prisma.GpsLogWhereUniqueInput;
export type GpsLogOrderByInput = Prisma.GpsLogOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface GpsLogResponseDTO extends GpsLogModel {
  _count?: {
    [key: string]: number;
  };
}

export interface GpsLogListResponse {
  data: GpsLogModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GpsLogCreateDTO extends Omit<GpsLogCreateInput, 'id'> {
  // フロントエンド送信用
}

export interface GpsLogUpdateDTO extends Partial<GpsLogCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class GpsLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: GpsLogCreateInput): Promise<GpsLogModel> {
    return await this.prisma.gpsLog.create({
      data: {
        ...data,

      }
    });
  }

  /**
   * 主キー指定取得
   */
  async findByKey(id: string): Promise<GpsLogModel | null> {
    return await this.prisma.gpsLog.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: GpsLogWhereInput;
    orderBy?: GpsLogOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<GpsLogModel[]> {
    return await this.prisma.gpsLog.findMany({
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
    where?: GpsLogWhereInput;
    orderBy?: GpsLogOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<GpsLogListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.gpsLog.findMany({
        where,
        orderBy: orderBy || {},
        skip,
        take: pageSize
      }),
      this.prisma.gpsLog.count({ where })
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
  async update(id: string, data: GpsLogUpdateInput): Promise<GpsLogModel> {
    return await this.prisma.gpsLog.update({
      where: { id },
      data: {
        ...data,

      }
    });
  }

  /**
   * 削除
   */
  async delete(id: string): Promise<GpsLogModel> {
    return await this.prisma.gpsLog.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.gpsLog.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: GpsLogWhereInput): Promise<number> {
    return await this.prisma.gpsLog.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _gpslogServiceInstance: GpsLogService | null = null;

export const getGpsLogService = (prisma?: PrismaClient): GpsLogService => {
  if (!_gpslogServiceInstance) {
    _gpslogServiceInstance = new GpsLogService(prisma || new PrismaClient());
  }
  return _gpslogServiceInstance;
};

export type { GpsLogModel as default };
