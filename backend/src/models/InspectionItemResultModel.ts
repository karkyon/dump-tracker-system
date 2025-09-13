// =====================================
// InspectionItemResultModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:22 PM JST 2025
// テーブルアクセサ: inspectionItemResult
// =====================================

import type { 
  InspectionItemResult as PrismaInspectionItemResult,
  Prisma,
  InspectionItem,
  InspectionRecord,
  User,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type InspectionItemResultModel = PrismaInspectionItemResult;
export type InspectionItemResultCreateInput = Prisma.InspectionItemResultCreateInput;
export type InspectionItemResultUpdateInput = Prisma.InspectionItemResultUpdateInput;  
export type InspectionItemResultWhereInput = Prisma.InspectionItemResultWhereInput;
export type InspectionItemResultWhereUniqueInput = Prisma.InspectionItemResultWhereUniqueInput;
export type InspectionItemResultOrderByInput = Prisma.InspectionItemResultOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface InspectionItemResultResponseDTO extends InspectionItemResultModel {
  _count?: {
    [key: string]: number;
  };
}

export interface InspectionItemResultListResponse {
  data: InspectionItemResultModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InspectionItemResultCreateDTO extends Omit<InspectionItemResultCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface InspectionItemResultUpdateDTO extends Partial<InspectionItemResultCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class InspectionItemResultService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: InspectionItemResultCreateInput): Promise<InspectionItemResultModel> {
    return await this.prisma.inspectionItemResult.create({
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
  async findByKey(id: string): Promise<InspectionItemResultModel | null> {
    return await this.prisma.inspectionItemResult.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: InspectionItemResultWhereInput;
    orderBy?: InspectionItemResultOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<InspectionItemResultModel[]> {
    return await this.prisma.inspectionItemResult.findMany({
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
    where?: InspectionItemResultWhereInput;
    orderBy?: InspectionItemResultOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<InspectionItemResultListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.inspectionItemResult.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.inspectionItemResult.count({ where })
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
  async update(id: string, data: InspectionItemResultUpdateInput): Promise<InspectionItemResultModel> {
    return await this.prisma.inspectionItemResult.update({
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
  async delete(id: string): Promise<InspectionItemResultModel> {
    return await this.prisma.inspectionItemResult.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.inspectionItemResult.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: InspectionItemResultWhereInput): Promise<number> {
    return await this.prisma.inspectionItemResult.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _inspectionitemresultServiceInstance: InspectionItemResultService | null = null;

export const getInspectionItemResultService = (prisma?: PrismaClient): InspectionItemResultService => {
  if (!_inspectionitemresultServiceInstance) {
    _inspectionitemresultServiceInstance = new InspectionItemResultService(prisma || new PrismaClient());
  }
  return _inspectionitemresultServiceInstance;
};

export type { InspectionItemResultModel as default };
