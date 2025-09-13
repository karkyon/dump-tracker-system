// =====================================
// MaintenanceRecordModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:23 PM JST 2025
// テーブルアクセサ: maintenanceRecord
// =====================================

import type { 
  MaintenanceRecord as PrismaMaintenanceRecord,
  Prisma,
  User,
  Vehicle,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type MaintenanceRecordModel = PrismaMaintenanceRecord;
export type MaintenanceRecordCreateInput = Prisma.MaintenanceRecordCreateInput;
export type MaintenanceRecordUpdateInput = Prisma.MaintenanceRecordUpdateInput;  
export type MaintenanceRecordWhereInput = Prisma.MaintenanceRecordWhereInput;
export type MaintenanceRecordWhereUniqueInput = Prisma.MaintenanceRecordWhereUniqueInput;
export type MaintenanceRecordOrderByInput = Prisma.MaintenanceRecordOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface MaintenanceRecordResponseDTO extends MaintenanceRecordModel {
  _count?: {
    [key: string]: number;
  };
}

export interface MaintenanceRecordListResponse {
  data: MaintenanceRecordModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MaintenanceRecordCreateDTO extends Omit<MaintenanceRecordCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface MaintenanceRecordUpdateDTO extends Partial<MaintenanceRecordCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class MaintenanceRecordService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: MaintenanceRecordCreateInput): Promise<MaintenanceRecordModel> {
    return await this.prisma.maintenanceRecord.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  /**
   * 主キー指定取得
   */
  async findByKey(id: string): Promise<MaintenanceRecordModel | null> {
    return await this.prisma.maintenanceRecord.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: MaintenanceRecordWhereInput;
    orderBy?: MaintenanceRecordOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<MaintenanceRecordModel[]> {
    return await this.prisma.maintenanceRecord.findMany({
      where: params?.where,
      orderBy: params?.orderBy || { createdAt: 'desc' },
      skip: params?.skip,
      take: params?.take
    });
  }

  /**
   * ページネーション付き一覧取得
   */
  async findManyWithPagination(params: {
    where?: MaintenanceRecordWhereInput;
    orderBy?: MaintenanceRecordOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<MaintenanceRecordListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.maintenanceRecord.count({ where })
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
  async update(id: string, data: MaintenanceRecordUpdateInput): Promise<MaintenanceRecordModel> {
    return await this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 削除
   */
  async delete(id: string): Promise<MaintenanceRecordModel> {
    return await this.prisma.maintenanceRecord.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.maintenanceRecord.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: MaintenanceRecordWhereInput): Promise<number> {
    return await this.prisma.maintenanceRecord.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _maintenancerecordServiceInstance: MaintenanceRecordService | null = null;

export const getMaintenanceRecordService = (prisma?: PrismaClient): MaintenanceRecordService => {
  if (!_maintenancerecordServiceInstance) {
    _maintenancerecordServiceInstance = new MaintenanceRecordService(prisma || new PrismaClient());
  }
  return _maintenancerecordServiceInstance;
};

export type { MaintenanceRecordModel as default };
