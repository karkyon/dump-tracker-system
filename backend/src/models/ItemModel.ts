// =====================================
// ItemModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:23 PM JST 2025
// テーブルアクセサ: item
// =====================================

import type { 
  Item as PrismaItem,
  Prisma,
  OperationDetail,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type ItemModel = PrismaItem;
export type ItemCreateInput = Prisma.ItemCreateInput;
export type ItemUpdateInput = Prisma.ItemUpdateInput;  
export type ItemWhereInput = Prisma.ItemWhereInput;
export type ItemWhereUniqueInput = Prisma.ItemWhereUniqueInput;
export type ItemOrderByInput = Prisma.ItemOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface ItemResponseDTO extends ItemModel {
  _count?: {
    [key: string]: number;
  };
}

export interface ItemListResponse {
  data: ItemModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ItemCreateDTO extends Omit<ItemCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface ItemUpdateDTO extends Partial<ItemCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class ItemService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: ItemCreateInput): Promise<ItemModel> {
    return await this.prisma.item.create({
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
  async findByKey(id: string): Promise<ItemModel | null> {
    return await this.prisma.item.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: ItemWhereInput;
    orderBy?: ItemOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<ItemModel[]> {
    return await this.prisma.item.findMany({
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
    where?: ItemWhereInput;
    orderBy?: ItemOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<ItemListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.item.count({ where })
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
  async update(id: string, data: ItemUpdateInput): Promise<ItemModel> {
    return await this.prisma.item.update({
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
  async delete(id: string): Promise<ItemModel> {
    return await this.prisma.item.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.item.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: ItemWhereInput): Promise<number> {
    return await this.prisma.item.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _itemServiceInstance: ItemService | null = null;

export const getItemService = (prisma?: PrismaClient): ItemService => {
  if (!_itemServiceInstance) {
    _itemServiceInstance = new ItemService(prisma || new PrismaClient());
  }
  return _itemServiceInstance;
};

export type { ItemModel as default };
