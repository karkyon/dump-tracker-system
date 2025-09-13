// =====================================
// InspectionItemModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:22 PM JST 2025
// テーブルアクセサ: inspectionItem
// =====================================

import type { 
  InspectionItem as PrismaInspectionItem,
  Prisma,
  InspectionItemResult,
  User,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type InspectionItemModel = PrismaInspectionItem;
export type InspectionItemCreateInput = Prisma.InspectionItemCreateInput;
export type InspectionItemUpdateInput = Prisma.InspectionItemUpdateInput;  
export type InspectionItemWhereInput = Prisma.InspectionItemWhereInput;
export type InspectionItemWhereUniqueInput = Prisma.InspectionItemWhereUniqueInput;
export type InspectionItemOrderByInput = Prisma.InspectionItemOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface InspectionItemResponseDTO extends InspectionItemModel {
  _count?: {
    [key: string]: number;
  };
}

export interface InspectionItemListResponse {
  data: InspectionItemModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InspectionItemCreateDTO extends Omit<InspectionItemCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface InspectionItemUpdateDTO extends Partial<InspectionItemCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class InspectionItemService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: InspectionItemCreateInput): Promise<InspectionItemModel> {
    return await this.prisma.inspectionItem.create({
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
  async findByKey(id: string): Promise<InspectionItemModel | null> {
    return await this.prisma.inspectionItem.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: InspectionItemWhereInput;
    orderBy?: InspectionItemOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<InspectionItemModel[]> {
    return await this.prisma.inspectionItem.findMany({
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
    where?: InspectionItemWhereInput;
    orderBy?: InspectionItemOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<InspectionItemListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.inspectionItem.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.inspectionItem.count({ where })
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
  async update(id: string, data: InspectionItemUpdateInput): Promise<InspectionItemModel> {
    return await this.prisma.inspectionItem.update({
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
  async delete(id: string): Promise<InspectionItemModel> {
    return await this.prisma.inspectionItem.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.inspectionItem.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: InspectionItemWhereInput): Promise<number> {
    return await this.prisma.inspectionItem.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _inspectionitemServiceInstance: InspectionItemService | null = null;

export const getInspectionItemService = (prisma?: PrismaClient): InspectionItemService => {
  if (!_inspectionitemServiceInstance) {
    _inspectionitemServiceInstance = new InspectionItemService(prisma || new PrismaClient());
  }
  return _inspectionitemServiceInstance;
};

export type { InspectionItemModel as default };
