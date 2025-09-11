// backend/src/models/InspectionItem.ts
import { PrismaClient, inspection_type as PrismaInspectionType, input_type as PrismaInputType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 点検項目モデル - Prismaスキーマ完全準拠版
 * 点検項目マスタデータの管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface InspectionItemModel {
  id: string;
  name: string;
  description?: string | null;
  inspection_type: PrismaInspectionType;
  input_type: PrismaInputType;
  category?: string | null;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InspectionItemCreateInput {
  name: string;
  description?: string;
  inspection_type: PrismaInspectionType;
  input_type?: PrismaInputType;
  category?: string;
  is_required?: boolean;
  display_order?: number;
  is_active?: boolean;
  created_by?: string;
}

export interface InspectionItemUpdateInput {
  name?: string;
  description?: string;
  inspection_type?: PrismaInspectionType;
  input_type?: PrismaInputType;
  category?: string;
  is_required?: boolean;
  display_order?: number;
  is_active?: boolean;
}

export interface InspectionItemWhereInput {
  id?: string;
  name?: string | { contains?: string; mode?: 'insensitive' };
  inspection_type?: PrismaInspectionType | PrismaInspectionType[];
  input_type?: PrismaInputType | PrismaInputType[];
  category?: string | { contains?: string; mode?: 'insensitive' };
  is_required?: boolean;
  is_active?: boolean;
  created_by?: string;
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface InspectionItemOrderByInput {
  id?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  inspection_type?: 'asc' | 'desc';
  input_type?: 'asc' | 'desc';
  category?: 'asc' | 'desc';
  is_required?: 'asc' | 'desc';
  display_order?: 'asc' | 'desc';
  is_active?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface InspectionItemResponseDTO {
  id: string;
  name: string;
  description?: string | null;
  inspection_type: PrismaInspectionType;
  input_type: PrismaInputType;
  category?: string | null;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
  // リレーションデータ
  creator?: {
    name: string;
  };
}

export interface InspectionItemStats {
  total_items: number;
  active_items: number;
  required_items: number;
  pre_trip_items: number;
  post_trip_items: number;
  daily_items: number;
  weekly_items: number;
  monthly_items: number;
  categories_count: number;
  checkbox_items: number;
  text_items: number;
  number_items: number;
  select_items: number;
}

export interface InspectionItemCategory {
  category: string;
  item_count: number;
  required_count: number;
  inspection_types: PrismaInspectionType[];
  items: InspectionItemModel[];
}

export interface InspectionItemUsage {
  item_id: string;
  item_name: string;
  category?: string;
  usage_count: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  last_used_date?: Date;
  most_common_result?: string;
}

export interface InspectionTemplate {
  inspection_type: PrismaInspectionType;
  category?: string;
  items: InspectionItemWithOptions[];
  total_items: number;
  required_items: number;
  estimated_time_minutes: number;
}

export interface InspectionItemWithOptions {
  id: string;
  name: string;
  description?: string;
  input_type: PrismaInputType;
  is_required: boolean;
  display_order: number;
  options?: string[]; // SELECT型の場合の選択肢
  default_value?: string;
  validation_rules?: any;
}

// =====================================
// 点検項目モデルクラス
// =====================================

export class InspectionItem {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 点検項目作成
   */
  async create(data: InspectionItemCreateInput): Promise<InspectionItemModel> {
    try {
      // 表示順序の自動設定
      if (!data.display_order) {
        const maxOrder = await this.prisma.inspection_items.aggregate({
          where: {
            inspection_type: data.inspection_type,
            is_active: true
          },
          _max: { display_order: true }
        });
        data.display_order = (maxOrder._max.display_order || 0) + 1;
      }

      return await this.prisma.inspection_items.create({
        data: {
          ...data,
          input_type: data.input_type || PrismaInputType.CHECKBOX,
          is_required: data.is_required ?? false,
          is_active: data.is_active ?? true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`点検項目作成エラー: ${error}`);
    }
  }

  /**
   * 点検項目取得（ID指定）
   */
  async findById(id: string, includeRelations: boolean = false): Promise<InspectionItemModel | null> {
    try {
      return await this.prisma.inspection_items.findUnique({
        where: { id },
        include: includeRelations ? {
          users: true,
          inspection_item_results: true
        } : undefined
      });
    } catch (error) {
      throw new Error(`点検項目取得エラー: ${error}`);
    }
  }

  /**
   * 点検項目一覧取得
   */
  async findMany(params: {
    where?: InspectionItemWhereInput;
    orderBy?: InspectionItemOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      creator?: boolean;
      results?: boolean;
    };
  }): Promise<InspectionItemModel[]> {
    try {
      return await this.prisma.inspection_items.findMany({
        where: params.where,
        orderBy: params.orderBy || { display_order: 'asc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          users: params.include.creator,
          inspection_item_results: params.include.results
        } : undefined
      });
    } catch (error) {
      throw new Error(`点検項目一覧取得エラー: ${error}`);
    }
  }

  /**
   * 点検項目更新
   */
  async update(id: string, data: InspectionItemUpdateInput): Promise<InspectionItemModel> {
    try {
      return await this.prisma.inspection_items.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`点検項目更新エラー: ${error}`);
    }
  }

  /**
   * 点検項目削除（論理削除）
   */
  async softDelete(id: string): Promise<InspectionItemModel> {
    try {
      return await this.prisma.inspection_items.update({
        where: { id },
        data: { 
          is_active: false,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`点検項目削除エラー: ${error}`);
    }
  }

  /**
   * 点検項目物理削除
   */
  async delete(id: string): Promise<InspectionItemModel> {
    try {
      return await this.prisma.inspection_items.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`点検項目物理削除エラー: ${error}`);
    }
  }

  /**
   * 点検項目数カウント
   */
  async count(where?: InspectionItemWhereInput): Promise<number> {
    try {
      return await this.prisma.inspection_items.count({ where });
    } catch (error) {
      throw new Error(`点検項目数取得エラー: ${error}`);
    }
  }

  /**
   * アクティブ点検項目取得
   */
  async findActiveItems(): Promise<InspectionItemModel[]> {
    try {
      return await this.prisma.inspection_items.findMany({
        where: { is_active: true },
        orderBy: [
          { inspection_type: 'asc' },
          { display_order: 'asc' }
        ]
      });
    } catch (error) {
      throw new Error(`アクティブ点検項目取得エラー: ${error}`);
    }
  }

  /**
   * 点検タイプ別項目取得
   */
  async findByInspectionType(inspection_type: PrismaInspectionType): Promise<InspectionItemModel[]> {
    try {
      return await this.prisma.inspection_items.findMany({
        where: { 
          inspection_type,
          is_active: true 
        },
        orderBy: { display_order: 'asc' }
      });
    } catch (error) {
      throw new Error(`点検タイプ別項目取得エラー: ${error}`);
    }
  }

  /**
   * カテゴリ別項目取得
   */
  async findByCategory(category: string): Promise<InspectionItemModel[]> {
    try {
      return await this.prisma.inspection_items.findMany({
        where: { 
          category,
          is_active: true 
        },
        orderBy: [
          { inspection_type: 'asc' },
          { display_order: 'asc' }
        ]
      });
    } catch (error) {
      throw new Error(`カテゴリ別項目取得エラー: ${error}`);
    }
  }

  /**
   * 必須項目取得
   */
  async findRequiredItems(inspection_type?: PrismaInspectionType): Promise<InspectionItemModel[]> {
    try {
      const whereClause: any = { 
        is_required: true,
        is_active: true 
      };

      if (inspection_type) {
        whereClause.inspection_type = inspection_type;
      }

      return await this.prisma.inspection_items.findMany({
        where: whereClause,
        orderBy: [
          { inspection_type: 'asc' },
          { display_order: 'asc' }
        ]
      });
    } catch (error) {
      throw new Error(`必須項目取得エラー: ${error}`);
    }
  }

  /**
   * 点検項目統計取得
   */
  async getStats(): Promise<InspectionItemStats> {
    try {
      const [
        total_items,
        active_items,
        required_items,
        pre_trip_items,
        post_trip_items,
        daily_items,
        weekly_items,
        monthly_items,
        categories_result,
        checkbox_items,
        text_items,
        number_items,
        select_items
      ] = await Promise.all([
        this.prisma.inspection_items.count(),
        this.prisma.inspection_items.count({ where: { is_active: true } }),
        this.prisma.inspection_items.count({ where: { is_required: true, is_active: true } }),
        this.prisma.inspection_items.count({ where: { inspection_type: PrismaInspectionType.PRE_TRIP, is_active: true } }),
        this.prisma.inspection_items.count({ where: { inspection_type: PrismaInspectionType.POST_TRIP, is_active: true } }),
        this.prisma.inspection_items.count({ where: { inspection_type: PrismaInspectionType.DAILY, is_active: true } }),
        this.prisma.inspection_items.count({ where: { inspection_type: PrismaInspectionType.WEEKLY, is_active: true } }),
        this.prisma.inspection_items.count({ where: { inspection_type: PrismaInspectionType.MONTHLY, is_active: true } }),
        this.prisma.inspection_items.groupBy({
          by: ['category'],
          where: { is_active: true },
          _count: { category: true }
        }),
        this.prisma.inspection_items.count({ where: { input_type: PrismaInputType.CHECKBOX, is_active: true } }),
        this.prisma.inspection_items.count({ where: { input_type: PrismaInputType.TEXT, is_active: true } }),
        this.prisma.inspection_items.count({ where: { input_type: PrismaInputType.NUMBER, is_active: true } }),
        this.prisma.inspection_items.count({ where: { input_type: PrismaInputType.SELECT, is_active: true } })
      ]);

      return {
        total_items,
        active_items,
        required_items,
        pre_trip_items,
        post_trip_items,
        daily_items,
        weekly_items,
        monthly_items,
        categories_count: categories_result.length,
        checkbox_items,
        text_items,
        number_items,
        select_items
      };
    } catch (error) {
      throw new Error(`点検項目統計取得エラー: ${error}`);
    }
  }

  /**
   * カテゴリ一覧取得
   */
  async getCategories(): Promise<InspectionItemCategory[]> {
    try {
      const categories_data = await this.prisma.$queryRaw`
        SELECT 
          i.category,
          COUNT(i.id) as item_count,
          COUNT(CASE WHEN i.is_required = true THEN 1 END) as required_count,
          ARRAY_AGG(DISTINCT i.inspection_type) as inspection_types
        FROM inspection_items i
        WHERE i.is_active = true AND i.category IS NOT NULL
        GROUP BY i.category
        ORDER BY i.category
      ` as any[];

      const categories: InspectionItemCategory[] = [];

      for (const cat of categories_data) {
        const items = await this.findByCategory(cat.category);
        categories.push({
          category: cat.category,
          item_count: Number(cat.item_count),
          required_count: Number(cat.required_count),
          inspection_types: cat.inspection_types,
          items
        });
      }

      return categories;
    } catch (error) {
      throw new Error(`カテゴリ一覧取得エラー: ${error}`);
    }
  }

  /**
   * 点検項目使用統計取得
   */
  async getUsageStats(limit: number = 10): Promise<InspectionItemUsage[]> {
    try {
      const usage_data = await this.prisma.$queryRaw`
        SELECT 
          i.id as item_id,
          i.name as item_name,
          i.category,
          COUNT(iir.id) as usage_count,
          COUNT(CASE WHEN iir.is_passed = true THEN 1 END) as pass_count,
          COUNT(CASE WHEN iir.is_passed = false THEN 1 END) as fail_count,
          ROUND(
            COUNT(CASE WHEN iir.is_passed = true THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN iir.is_passed IS NOT NULL THEN 1 END), 0), 
            2
          ) as pass_rate,
          MAX(iir.created_at) as last_used_date,
          MODE() WITHIN GROUP (ORDER BY iir.result_value) as most_common_result
        FROM inspection_items i
        LEFT JOIN inspection_item_results iir ON i.id = iir.inspection_item_id
        WHERE i.is_active = true
        GROUP BY i.id, i.name, i.category
        ORDER BY usage_count DESC, pass_rate ASC
        LIMIT ${limit}
      ` as any[];

      return usage_data.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        category: item.category,
        usage_count: Number(item.usage_count),
        pass_count: Number(item.pass_count),
        fail_count: Number(item.fail_count),
        pass_rate: Number(item.pass_rate) || 0,
        last_used_date: item.last_used_date,
        most_common_result: item.most_common_result
      }));
    } catch (error) {
      throw new Error(`使用統計取得エラー: ${error}`);
    }
  }

  /**
   * 点検テンプレート取得
   */
  async getInspectionTemplate(
    inspection_type: PrismaInspectionType,
    category?: string
  ): Promise<InspectionTemplate> {
    try {
      const whereClause: any = {
        inspection_type,
        is_active: true
      };

      if (category) {
        whereClause.category = category;
      }

      const items = await this.prisma.inspection_items.findMany({
        where: whereClause,
        orderBy: { display_order: 'asc' }
      });

      const itemsWithOptions: InspectionItemWithOptions[] = items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        input_type: item.input_type,
        is_required: item.is_required,
        display_order: item.display_order,
        options: item.input_type === PrismaInputType.SELECT ? 
          ['良好', '要注意', '不良', '確認不可'] : undefined,
        default_value: item.input_type === PrismaInputType.CHECKBOX ? 'false' : undefined
      }));

      // 推定時間計算（項目数 × 平均時間）
      const estimatedTimePerItem = {
        [PrismaInputType.CHECKBOX]: 0.5,
        [PrismaInputType.TEXT]: 1.5,
        [PrismaInputType.NUMBER]: 1.0,
        [PrismaInputType.SELECT]: 0.8
      };

      const estimated_time = items.reduce((total, item) => {
        return total + estimatedTimePerItem[item.input_type];
      }, 0);

      return {
        inspection_type,
        category,
        items: itemsWithOptions,
        total_items: items.length,
        required_items: items.filter(item => item.is_required).length,
        estimated_time_minutes: Math.round(estimated_time)
      };
    } catch (error) {
      throw new Error(`点検テンプレート取得エラー: ${error}`);
    }
  }

  /**
   * 表示順序更新
   */
  async updateDisplayOrder(updates: { id: string; display_order: number }[]): Promise<void> {
    try {
      const updatePromises = updates.map(update =>
        this.prisma.inspection_items.update({
          where: { id: update.id },
          data: { 
            display_order: update.display_order,
            updated_at: new Date()
          }
        })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      throw new Error(`表示順序更新エラー: ${error}`);
    }
  }

  /**
   * 点検項目検索
   */
  async search(query: string, inspection_type?: PrismaInspectionType, limit: number = 10): Promise<InspectionItemModel[]> {
    try {
      const whereClause: any = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } }
        ],
        is_active: true
      };

      if (inspection_type) {
        whereClause.inspection_type = inspection_type;
      }

      return await this.prisma.inspection_items.findMany({
        where: whereClause,
        take: limit,
        orderBy: [
          { inspection_type: 'asc' },
          { display_order: 'asc' }
        ]
      });
    } catch (error) {
      throw new Error(`点検項目検索エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(item: any): InspectionItemResponseDTO {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      inspection_type: item.inspection_type,
      input_type: item.input_type,
      category: item.category,
      is_required: item.is_required,
      display_order: item.display_order,
      is_active: item.is_active,
      created_by: item.created_by,
      created_at: item.created_at,
      updated_at: item.updated_at,
      creator: item.users ? {
        name: item.users.name
      } : undefined
    };
  }

  /**
   * バルク点検項目作成
   */
  async createMany(items: InspectionItemCreateInput[]): Promise<{ count: number }> {
    try {
      const itemsWithDefaults = items.map((item, index) => ({
        ...item,
        input_type: item.input_type || PrismaInputType.CHECKBOX,
        is_required: item.is_required ?? false,
        is_active: item.is_active ?? true,
        display_order: item.display_order || (index + 1),
        created_at: new Date(),
        updated_at: new Date()
      }));

      return await this.prisma.inspection_items.createMany({
        data: itemsWithDefaults,
        skipDuplicates: true
      });
    } catch (error) {
      throw new Error(`バルク点検項目作成エラー: ${error}`);
    }
  }

  /**
   * 点検項目存在確認
   */
  async exists(where: { 
    id?: string; 
    name?: string;
    inspection_type?: PrismaInspectionType;
  }): Promise<boolean> {
    try {
      const item = await this.prisma.inspection_items.findFirst({ where });
      return item !== null;
    } catch (error) {
      throw new Error(`点検項目存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const inspectionItemModel = new InspectionItem();
export default inspectionItemModel;