// =====================================
// OperationModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Tue Sep 16 10:05:28 AM JST 2025
// テーブルアクセサ: operation
// =====================================

import type { 
  Operation as PrismaOperation,
  Prisma,
  GpsLog,
  InspectionRecord,
  OperationDetail,
  User,
  Vehicle,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type OperationModel = PrismaOperation;
export type OperationCreateInput = Prisma.OperationCreateInput;
export type OperationUpdateInput = Prisma.OperationUpdateInput;  
export type OperationWhereInput = Prisma.OperationWhereInput;
export type OperationWhereUniqueInput = Prisma.OperationWhereUniqueInput;
export type OperationOrderByInput = Prisma.OperationOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface OperationResponseDTO extends OperationModel {
  _count?: {
    [key: string]: number;
  };
}

export interface OperationListResponse {
  data: OperationModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OperationCreateDTO extends Omit<OperationCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface OperationUpdateDTO extends Partial<OperationCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class OperationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: OperationCreateInput): Promise<OperationModel> {
    return await this.prisma.operation.create({
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
  async findByKey(id: string): Promise<OperationModel | null> {
    return await this.prisma.operation.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: OperationWhereInput;
    orderBy?: OperationOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<OperationModel[]> {
    return await this.prisma.operation.findMany({
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
    where?: OperationWhereInput;
    orderBy?: OperationOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<OperationListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.operation.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.operation.count({ where })
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
  async update(id: string, data: OperationUpdateInput): Promise<OperationModel> {
    return await this.prisma.operation.update({
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
  async delete(id: string): Promise<OperationModel> {
    return await this.prisma.operation.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.operation.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: OperationWhereInput): Promise<number> {
    return await this.prisma.operation.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _operationServiceInstance: OperationService | null = null;

export const getOperationService = (prisma?: PrismaClient): OperationService => {
  if (!_operationServiceInstance) {
    _operationServiceInstance = new OperationService(prisma || new PrismaClient());
  }
  return _operationServiceInstance;
};

export type { OperationModel as default };
