// =====================================
// InspectionRecordModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:23 PM JST 2025
// テーブルアクセサ: inspectionRecord
// =====================================

import type { 
  InspectionRecord as PrismaInspectionRecord,
  Prisma,
  InspectionItemResult,
  Operation,
  User,
  Vehicle,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type InspectionRecordModel = PrismaInspectionRecord;
export type InspectionRecordCreateInput = Prisma.InspectionRecordCreateInput;
export type InspectionRecordUpdateInput = Prisma.InspectionRecordUpdateInput;  
export type InspectionRecordWhereInput = Prisma.InspectionRecordWhereInput;
export type InspectionRecordWhereUniqueInput = Prisma.InspectionRecordWhereUniqueInput;
export type InspectionRecordOrderByInput = Prisma.InspectionRecordOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface InspectionRecordResponseDTO extends InspectionRecordModel {
  _count?: {
    [key: string]: number;
  };
}

export interface InspectionRecordListResponse {
  data: InspectionRecordModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InspectionRecordCreateDTO extends Omit<InspectionRecordCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface InspectionRecordUpdateDTO extends Partial<InspectionRecordCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class InspectionRecordService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: InspectionRecordCreateInput): Promise<InspectionRecordModel> {
    return await this.prisma.inspectionRecord.create({
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
  async findByKey(id: string): Promise<InspectionRecordModel | null> {
    return await this.prisma.inspectionRecord.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: InspectionRecordWhereInput;
    orderBy?: InspectionRecordOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<InspectionRecordModel[]> {
    return await this.prisma.inspectionRecord.findMany({
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
    where?: InspectionRecordWhereInput;
    orderBy?: InspectionRecordOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<InspectionRecordListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.inspectionRecord.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.inspectionRecord.count({ where })
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
  async update(id: string, data: InspectionRecordUpdateInput): Promise<InspectionRecordModel> {
    return await this.prisma.inspectionRecord.update({
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
  async delete(id: string): Promise<InspectionRecordModel> {
    return await this.prisma.inspectionRecord.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.inspectionRecord.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: InspectionRecordWhereInput): Promise<number> {
    return await this.prisma.inspectionRecord.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _inspectionrecordServiceInstance: InspectionRecordService | null = null;

export const getInspectionRecordService = (prisma?: PrismaClient): InspectionRecordService => {
  if (!_inspectionrecordServiceInstance) {
    _inspectionrecordServiceInstance = new InspectionRecordService(prisma || new PrismaClient());
  }
  return _inspectionrecordServiceInstance;
};

export type { InspectionRecordModel as default };
