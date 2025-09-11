// backend/src/models/Item.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 品目モデル - Prismaスキーマ完全準拠版
 * 運搬品目（砂利、コンクリート廃材等）の管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface ItemModel {
  id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  standard_weight_tons?: number | null; // Decimal型をnumberで扱う
  hazardous: boolean;
  description?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ItemCreateInput {
  name: string;
  category?: string;
  unit?: string;
  standard_weight_tons?: number;
  hazardous?: boolean;
  description?: string;
  is_active?: boolean;
}

export interface ItemUpdateInput {
  name?: string;
  category?: string;
  unit?: string;
  standard_weight_tons?: number;
  hazardous?: boolean;
  description?: string;
  is_active?: boolean;
}

export interface ItemWhereInput {
  id?: string;
  name?: string | { contains?: string; mode?: 'insensitive' };
  category?: string | { contains?: string; mode?: 'insensitive' };
  unit?: string;
  hazardous?: boolean;
  is_active?: boolean;
  standard_weight_tons?: {
    gte?: number;
    lte?: number;
  };
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface ItemOrderByInput {
  id?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  category?: 'asc' | 'desc';
  unit?: 'asc' | 'desc';
  standard_weight_tons?: 'asc' | 'desc';
  hazardous?: 'asc' | 'desc';
  is_active?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface ItemResponseDTO {
  id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  standard_weight_tons?: number | null;
  hazardous: boolean;
  description?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ItemStats {
  total_items: number;
  active_items: number;
  hazardous_items: number;
  categories_count: number;
  most_used_items: ItemUsageStats[];
  total_weight_capacity: number;
  average_weight_per_item: number;
}

export interface ItemUsageStats {
  item_id: string;
  item_name: string;
  category?: string;
  usage_count: number;
  total_quantity_tons: number;
  average_quantity_per_use: number;
  last_used_date?: Date;
}

export interface ItemCategory {
  category: string;
  item_count: number;
  total_weight_capacity: number;
  hazardous_count: number;
  items: ItemModel[];
}

export interface ItemAvailability {
  item_id: string;
  item_name: string;
  is_available: boolean;
  current_stock_tons?: number;
  reserved_tons?: number;
  available_tons?: number;
  next_availability_date?: Date;
}

// =====================================
// 品目モデルクラス
// =====================================

export class Item {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 品目作成
   */
  async create(data: ItemCreateInput): Promise<ItemModel> {
    try {
      return await this.prisma.items.create({
        data: {
          ...data,
          unit: data.unit || 'トン',
          hazardous: data.hazardous ?? false,
          is_active: data.is_active ?? true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`品目作成エラー: ${error}`);
    }
  }

  /**
   * 品目取得（ID指定）
   */
  async findById(id: string): Promise<ItemModel | null> {
    try {
      return await this.prisma.items.findUnique({
        where: { id }
      });
    } catch (error) {
      throw new Error(`品目取得エラー: ${error}`);
    }
  }

  /**
   * 品目取得（名前指定）
   */
  async findByName(name: string): Promise<ItemModel | null> {
    try {
      return await this.prisma.items.findUnique({
        where: { name }
      });
    } catch (error) {
      throw new Error(`品目取得エラー: ${error}`);
    }
  }

  /**
   * 品目一覧取得
   */
  async findMany(params: {
    where?: ItemWhereInput;
    orderBy?: ItemOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      operation_details?: boolean;
    };
  }): Promise<ItemModel[]> {
    try {
      return await this.prisma.items.findMany({
        where: params.where,
        orderBy: params.orderBy || { name: 'asc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          operation_details: params.include.operation_details
        } : undefined
      });
    } catch (error) {
      throw new Error(`品目一覧取得エラー: ${error}`);
    }
  }

  /**
   * 品目更新
   */
  async update(id: string, data: ItemUpdateInput): Promise<ItemModel> {
    try {
      return await this.prisma.items.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`品目更新エラー: ${error}`);
    }
  }

  /**
   * 品目削除（論理削除）
   */
  async softDelete(id: string): Promise<ItemModel> {
    try {
      return await this.prisma.items.update({
        where: { id },
        data: { 
          is_active: false,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`品目削除エラー: ${error}`);
    }
  }

  /**
   * 品目物理削除
   */
  async delete(id: string): Promise<ItemModel> {
    try {
      return await this.prisma.items.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`品目物理削除エラー: ${error}`);
    }
  }

  /**
   * 品目数カウント
   */
  async count(where?: ItemWhereInput): Promise<number> {
    try {
      return await this.prisma.items.count({ where });
    } catch (error) {
      throw new Error(`品目数取得エラー: ${error}`);
    }
  }

  /**
   * アクティブ品目取得
   */
  async findActiveItems(): Promise<ItemModel[]> {
    try {
      return await this.prisma.items.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`アクティブ品目取得エラー: ${error}`);
    }
  }

  /**
   * 危険物品目取得
   */
  async findHazardousItems(): Promise<ItemModel[]> {
    try {
      return await this.prisma.items.findMany({
        where: { 
          hazardous: true,
          is_active: true 
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`危険物品目取得エラー: ${error}`);
    }
  }

  /**
   * カテゴリ別品目取得
   */
  async findByCategory(category: string): Promise<ItemModel[]> {
    try {
      return await this.prisma.items.findMany({
        where: { 
          category,
          is_active: true 
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`カテゴリ別品目取得エラー: ${error}`);
    }
  }

  /**
   * 品目統計取得
   */
  async getStats(): Promise<ItemStats> {
    try {
      const [
        total_items,
        active_items,
        hazardous_items,
        categories_result,
        weight_result,
        usage_stats
      ] = await Promise.all([
        this.prisma.items.count(),
        this.prisma.items.count({ where: { is_active: true } }),
        this.prisma.items.count({ where: { hazardous: true, is_active: true } }),
        this.prisma.items.groupBy({
          by: ['category'],
          where: { is_active: true },
          _count: { category: true }
        }),
        this.prisma.items.aggregate({
          where: { is_active: true },
          _sum: { standard_weight_tons: true },
          _avg: { standard_weight_tons: true }
        }),
        this.getMostUsedItems(5)
      ]);

      return {
        total_items,
        active_items,
        hazardous_items,
        categories_count: categories_result.length,
        most_used_items: usage_stats,
        total_weight_capacity: weight_result._sum.standard_weight_tons || 0,
        average_weight_per_item: weight_result._avg.standard_weight_tons || 0
      };
    } catch (error) {
      throw new Error(`品目統計取得エラー: ${error}`);
    }
  }

  /**
   * 使用頻度の高い品目取得
   */
  async getMostUsedItems(limit: number = 10): Promise<ItemUsageStats[]> {
    try {
      const usage_data = await this.prisma.$queryRaw`
        SELECT 
          i.id as item_id,
          i.name as item_name,
          i.category,
          COUNT(od.id) as usage_count,
          SUM(od.quantity_tons) as total_quantity_tons,
          AVG(od.quantity_tons) as average_quantity_per_use,
          MAX(od.created_at) as last_used_date
        FROM items i
        LEFT JOIN operation_details od ON i.id = od.item_id
        WHERE i.is_active = true
        GROUP BY i.id, i.name, i.category
        ORDER BY usage_count DESC, total_quantity_tons DESC
        LIMIT ${limit}
      ` as any[];

      return usage_data.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        category: item.category,
        usage_count: Number(item.usage_count),
        total_quantity_tons: Number(item.total_quantity_tons) || 0,
        average_quantity_per_use: Number(item.average_quantity_per_use) || 0,
        last_used_date: item.last_used_date
      }));
    } catch (error) {
      throw new Error(`使用頻度品目取得エラー: ${error}`);
    }
  }

  /**
   * カテゴリ一覧取得
   */
  async getCategories(): Promise<ItemCategory[]> {
    try {
      const categories_data = await this.prisma.$queryRaw`
        SELECT 
          i.category,
          COUNT(i.id) as item_count,
          SUM(i.standard_weight_tons) as total_weight_capacity,
          COUNT(CASE WHEN i.hazardous = true THEN 1 END) as hazardous_count
        FROM items i
        WHERE i.is_active = true AND i.category IS NOT NULL
        GROUP BY i.category
        ORDER BY i.category
      ` as any[];

      const categories: ItemCategory[] = [];

      for (const cat of categories_data) {
        const items = await this.findByCategory(cat.category);
        categories.push({
          category: cat.category,
          item_count: Number(cat.item_count),
          total_weight_capacity: Number(cat.total_weight_capacity) || 0,
          hazardous_count: Number(cat.hazardous_count),
          items
        });
      }

      return categories;
    } catch (error) {
      throw new Error(`カテゴリ一覧取得エラー: ${error}`);
    }
  }

  /**
   * 品目検索
   */
  async search(query: string, limit: number = 10): Promise<ItemModel[]> {
    try {
      return await this.prisma.items.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ],
          is_active: true
        },
        take: limit,
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`品目検索エラー: ${error}`);
    }
  }

  /**
   * 単位別品目取得
   */
  async findByUnit(unit: string): Promise<ItemModel[]> {
    try {
      return await this.prisma.items.findMany({
        where: { 
          unit,
          is_active: true 
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`単位別品目取得エラー: ${error}`);
    }
  }

  /**
   * 重量範囲別品目取得
   */
  async findByWeightRange(min_weight?: number, max_weight?: number): Promise<ItemModel[]> {
    try {
      const whereClause: any = { is_active: true };
      
      if (min_weight !== undefined || max_weight !== undefined) {
        whereClause.standard_weight_tons = {};
        if (min_weight !== undefined) {
          whereClause.standard_weight_tons.gte = min_weight;
        }
        if (max_weight !== undefined) {
          whereClause.standard_weight_tons.lte = max_weight;
        }
      }

      return await this.prisma.items.findMany({
        where: whereClause,
        orderBy: { standard_weight_tons: 'asc' }
      });
    } catch (error) {
      throw new Error(`重量範囲別品目取得エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(item: ItemModel): ItemResponseDTO {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      standard_weight_tons: item.standard_weight_tons,
      hazardous: item.hazardous,
      description: item.description,
      is_active: item.is_active,
      created_at: item.created_at,
      updated_at: item.updated_at
    };
  }

  /**
   * バルク品目作成（CSV等からの一括登録）
   */
  async createMany(items: ItemCreateInput[]): Promise<{ count: number }> {
    try {
      const itemsWithDefaults = items.map(item => ({
        ...item,
        unit: item.unit || 'トン',
        hazardous: item.hazardous ?? false,
        is_active: item.is_active ?? true,
        created_at: new Date(),
        updated_at: new Date()
      }));

      return await this.prisma.items.createMany({
        data: itemsWithDefaults,
        skipDuplicates: true
      });
    } catch (error) {
      throw new Error(`バルク品目作成エラー: ${error}`);
    }
  }

  /**
   * 品目存在確認
   */
  async exists(where: { 
    id?: string; 
    name?: string 
  }): Promise<boolean> {
    try {
      const item = await this.prisma.items.findUnique({ where });
      return item !== null;
    } catch (error) {
      throw new Error(`品目存在確認エラー: ${error}`);
    }
  }

  /**
   * 未使用品目取得
   */
  async findUnusedItems(): Promise<ItemModel[]> {
    try {
      return await this.prisma.items.findMany({
        where: {
          is_active: true,
          operation_details: {
            none: {}
          }
        },
        orderBy: { created_at: 'desc' }
      });
    } catch (error) {
      throw new Error(`未使用品目取得エラー: ${error}`);
    }
  }

  /**
   * 品目使用履歴取得
   */
  async getUsageHistory(item_id: string, limit: number = 20): Promise<any[]> {
    try {
      return await this.prisma.operation_details.findMany({
        where: { item_id },
        include: {
          operations: {
            include: {
              vehicles: true,
              users_operations_driver_idTousers: true
            }
          },
          locations: true
        },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`品目使用履歴取得エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const itemModel = new Item();
export default itemModel;