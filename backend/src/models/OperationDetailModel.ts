// =====================================
// OperationDetailModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:23 PM JST 2025
// テーブルアクセサ: operationDetail
// =====================================

import type { 
  OperationDetail as PrismaOperationDetail,
  Prisma,
  Item,
  Location,
  Operation,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type OperationDetailModel = PrismaOperationDetail;
export type OperationDetailCreateInput = Prisma.OperationDetailCreateInput;
export type OperationDetailUpdateInput = Prisma.OperationDetailUpdateInput;  
export type OperationDetailWhereInput = Prisma.OperationDetailWhereInput;
export type OperationDetailWhereUniqueInput = Prisma.OperationDetailWhereUniqueInput;
export type OperationDetailOrderByInput = Prisma.OperationDetailOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface OperationDetailResponseDTO extends OperationDetailModel {
  _count?: {
    [key: string]: number;
  };
}

export interface OperationDetailListResponse {
  data: OperationDetailModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OperationDetailCreateDTO extends Omit<OperationDetailCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface OperationDetailUpdateDTO extends Partial<OperationDetailCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class OperationDetailService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: OperationDetailCreateInput): Promise<OperationDetailModel> {
    return await this.prisma.operationDetail.create({
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
  async findByKey(id: string): Promise<OperationDetailModel | null> {
    return await this.prisma.operationDetail.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: OperationDetailWhereInput;
    orderBy?: OperationDetailOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<OperationDetailModel[]> {
    return await this.prisma.operationDetail.findMany({
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
    where?: OperationDetailWhereInput;
    orderBy?: OperationDetailOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<OperationDetailListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.operationDetail.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.operationDetail.count({ where })
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
  async update(id: string, data: OperationDetailUpdateInput): Promise<OperationDetailModel> {
    return await this.prisma.operationDetail.update({
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
  async delete(id: string): Promise<OperationDetailModel> {
    return await this.prisma.operationDetail.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.operationDetail.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: OperationDetailWhereInput): Promise<number> {
    return await this.prisma.operationDetail.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _operationdetailServiceInstance: OperationDetailService | null = null;

export const getOperationDetailService = (prisma?: PrismaClient): OperationDetailService => {
  if (!_operationdetailServiceInstance) {
    _operationdetailServiceInstance = new OperationDetailService(prisma || new PrismaClient());
  }
  return _operationdetailServiceInstance;
};

export type { OperationDetailModel as default };
