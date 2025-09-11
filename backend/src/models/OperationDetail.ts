// backend/src/models/OperationDetail.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 運行詳細モデル - Prismaスキーマ完全準拠版
 * 積込・積下作業の詳細記録管理
 */

// =====================================
// 型定義（Prismaスキーマ準拠）
// =====================================

export enum ActivityType {
  LOADING = 'LOADING',
  UNLOADING = 'UNLOADING'
}

export interface OperationDetailModel {
  id: string;
  operation_id: string;
  sequence_number: number;
  activity_type: ActivityType;
  location_id: string;
  item_id: string;
  planned_time?: Date | null;
  actual_start_time?: Date | null;
  actual_end_time?: Date | null;
  quantity_tons: number; // Decimal型をnumberで扱う
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OperationDetailCreateInput {
  operation_id: string;
  sequence_number: number;
  activity_type: ActivityType;
  location_id: string;
  item_id: string;
  planned_time?: Date;
  quantity_tons: number;
  notes?: string;
}

export interface OperationDetailUpdateInput {
  sequence_number?: number;
  activity_type?: ActivityType;
  location_id?: string;
  item_id?: string;
  planned_time?: Date;
  actual_start_time?: Date;
  actual_end_time?: Date;
  quantity_tons?: number;
  notes?: string;
}

export interface OperationDetailWhereInput {
  id?: string;
  operation_id?: string;
  sequence_number?: number;
  activity_type?: ActivityType | ActivityType[];
  location_id?: string;
  item_id?: string;
  planned_time?: {
    gte?: Date;
    lte?: Date;
  };
  actual_start_time?: {
    gte?: Date;
    lte?: Date;
  };
  quantity_tons?: {
    gte?: number;
    lte?: number;
  };
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface OperationDetailOrderByInput {
  id?: 'asc' | 'desc';
  sequence_number?: 'asc' | 'desc';
  activity_type?: 'asc' | 'desc';
  planned_time?: 'asc' | 'desc';
  actual_start_time?: 'asc' | 'desc';
  quantity_tons?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface OperationDetailResponseDTO {
  id: string;
  operation_id: string;
  sequence_number: number;
  activity_type: ActivityType;
  location_id: string;
  item_id: string;
  planned_time?: Date | null;
  actual_start_time?: Date | null;
  actual_end_time?: Date | null;
  quantity_tons: number;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
  // リレーションデータ
  operation?: {
    operation_number: string;
    status: string;
  };
  location?: {
    name: string;
    address: string;
    location_type: string;
  };
  item?: {
    name: string;
    category?: string;
    unit?: string;
  };
}

export interface OperationDetailStats {
  total_details: number;
  loading_count: number;
  unloading_count: number;
  total_quantity_tons: number;
  average_quantity_per_detail: number;
  completed_details: number;
  pending_details: number;
  total_processing_time_minutes: number;
  average_processing_time_minutes: number;
}

export interface LoadingUnloadingSummary {
  operation_id: string;
  operation_number: string;
  loading_details: OperationDetailResponseDTO[];
  unloading_details: OperationDetailResponseDTO[];
  total_loaded_tons: number;
  total_unloaded_tons: number;
  balance_tons: number;
  is_balanced: boolean;
  locations_visited: string[];
  items_handled: string[];
}

export interface DetailProgressTracker {
  detail_id: string;
  sequence_number: number;
  activity_type: ActivityType;
  location_name: string;
  item_name: string;
  planned_time?: Date;
  actual_start_time?: Date;
  actual_end_time?: Date;
  quantity_tons: number;
  is_completed: boolean;
  processing_time_minutes?: number;
  delay_minutes?: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
}

// =====================================
// 運行詳細モデルクラス
// =====================================

export class OperationDetail {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 運行詳細作成
   */
  async create(data: OperationDetailCreateInput): Promise<OperationDetailModel> {
    try {
      return await this.prisma.operation_details.create({
        data: {
          ...data,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`運行詳細作成エラー: ${error}`);
    }
  }

  /**
   * 運行詳細取得（ID指定）
   */
  async findById(id: string, includeRelations: boolean = false): Promise<OperationDetailModel | null> {
    try {
      return await this.prisma.operation_details.findUnique({
        where: { id },
        include: includeRelations ? {
          operations: true,
          locations: true,
          items: true
        } : undefined
      });
    } catch (error) {
      throw new Error(`運行詳細取得エラー: ${error}`);
    }
  }

  /**
   * 運行詳細一覧取得
   */
  async findMany(params: {
    where?: OperationDetailWhereInput;
    orderBy?: OperationDetailOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      operation?: boolean;
      location?: boolean;
      item?: boolean;
    };
  }): Promise<OperationDetailModel[]> {
    try {
      return await this.prisma.operation_details.findMany({
        where: params.where,
        orderBy: params.orderBy || { sequence_number: 'asc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          operations: params.include.operation,
          locations: params.include.location,
          items: params.include.item
        } : undefined
      });
    } catch (error) {
      throw new Error(`運行詳細一覧取得エラー: ${error}`);
    }
  }

  /**
   * 運行詳細更新
   */
  async update(id: string, data: OperationDetailUpdateInput): Promise<OperationDetailModel> {
    try {
      return await this.prisma.operation_details.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`運行詳細更新エラー: ${error}`);
    }
  }

  /**
   * 運行詳細削除
   */
  async delete(id: string): Promise<OperationDetailModel> {
    try {
      return await this.prisma.operation_details.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`運行詳細削除エラー: ${error}`);
    }
  }

  /**
   * 運行詳細数カウント
   */
  async count(where?: OperationDetailWhereInput): Promise<number> {
    try {
      return await this.prisma.operation_details.count({ where });
    } catch (error) {
      throw new Error(`運行詳細数取得エラー: ${error}`);
    }
  }

  /**
   * 運行の詳細一覧取得
   */
  async findByOperationId(operation_id: string): Promise<OperationDetailModel[]> {
    try {
      return await this.prisma.operation_details.findMany({
        where: { operation_id },
        include: {
          locations: true,
          items: true
        },
        orderBy: { sequence_number: 'asc' }
      });
    } catch (error) {
      throw new Error(`運行詳細一覧取得エラー: ${error}`);
    }
  }

  /**
   * 作業開始
   */
  async startActivity(id: string): Promise<OperationDetailModel> {
    try {
      return await this.prisma.operation_details.update({
        where: { id },
        data: {
          actual_start_time: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`作業開始エラー: ${error}`);
    }
  }

  /**
   * 作業完了
   */
  async completeActivity(id: string, data: {
    quantity_tons?: number;
    notes?: string;
  }): Promise<OperationDetailModel> {
    try {
      return await this.prisma.operation_details.update({
        where: { id },
        data: {
          actual_end_time: new Date(),
          quantity_tons: data.quantity_tons,
          notes: data.notes,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`作業完了エラー: ${error}`);
    }
  }

  /**
   * 積込詳細取得
   */
  async findLoadingDetails(operation_id: string): Promise<OperationDetailModel[]> {
    try {
      return await this.prisma.operation_details.findMany({
        where: {
          operation_id,
          activity_type: ActivityType.LOADING
        },
        include: {
          locations: true,
          items: true
        },
        orderBy: { sequence_number: 'asc' }
      });
    } catch (error) {
      throw new Error(`積込詳細取得エラー: ${error}`);
    }
  }

  /**
   * 積下詳細取得
   */
  async findUnloadingDetails(operation_id: string): Promise<OperationDetailModel[]> {
    try {
      return await this.prisma.operation_details.findMany({
        where: {
          operation_id,
          activity_type: ActivityType.UNLOADING
        },
        include: {
          locations: true,
          items: true
        },
        orderBy: { sequence_number: 'asc' }
      });
    } catch (error) {
      throw new Error(`積下詳細取得エラー: ${error}`);
    }
  }

  /**
   * 運行詳細統計取得
   */
  async getStats(operation_id?: string): Promise<OperationDetailStats> {
    try {
      const whereClause = operation_id ? { operation_id } : {};

      const [
        total_details,
        loading_count,
        unloading_count,
        quantity_result,
        completed_count,
        time_result
      ] = await Promise.all([
        this.prisma.operation_details.count({ where: whereClause }),
        this.prisma.operation_details.count({ 
          where: { ...whereClause, activity_type: ActivityType.LOADING } 
        }),
        this.prisma.operation_details.count({ 
          where: { ...whereClause, activity_type: ActivityType.UNLOADING } 
        }),
        this.prisma.operation_details.aggregate({
          where: whereClause,
          _sum: { quantity_tons: true },
          _avg: { quantity_tons: true }
        }),
        this.prisma.operation_details.count({
          where: {
            ...whereClause,
            actual_end_time: { not: null }
          }
        }),
        this.prisma.$queryRaw`
          SELECT 
            AVG(EXTRACT(EPOCH FROM (actual_end_time - actual_start_time)) / 60) as avg_minutes,
            SUM(EXTRACT(EPOCH FROM (actual_end_time - actual_start_time)) / 60) as total_minutes
          FROM operation_details 
          WHERE actual_start_time IS NOT NULL 
            AND actual_end_time IS NOT NULL
            ${operation_id ? Prisma.sql`AND operation_id = ${operation_id}` : Prisma.empty}
        ` as any[]
      ]);

      const timeData = time_result[0] || { avg_minutes: 0, total_minutes: 0 };

      return {
        total_details,
        loading_count,
        unloading_count,
        total_quantity_tons: quantity_result._sum.quantity_tons || 0,
        average_quantity_per_detail: quantity_result._avg.quantity_tons || 0,
        completed_details: completed_count,
        pending_details: total_details - completed_count,
        total_processing_time_minutes: Number(timeData.total_minutes) || 0,
        average_processing_time_minutes: Number(timeData.avg_minutes) || 0
      };
    } catch (error) {
      throw new Error(`運行詳細統計取得エラー: ${error}`);
    }
  }

  /**
   * 積込・積下サマリー取得
   */
  async getLoadingUnloadingSummary(operation_id: string): Promise<LoadingUnloadingSummary> {
    try {
      const [operation, loading_details, unloading_details] = await Promise.all([
        this.prisma.operations.findUnique({
          where: { id: operation_id },
          select: { operation_number: true }
        }),
        this.findLoadingDetails(operation_id),
        this.findUnloadingDetails(operation_id)
      ]);

      if (!operation) {
        throw new Error('運行が見つかりません');
      }

      const total_loaded_tons = loading_details.reduce((sum, detail) => sum + detail.quantity_tons, 0);
      const total_unloaded_tons = unloading_details.reduce((sum, detail) => sum + detail.quantity_tons, 0);
      const balance_tons = total_loaded_tons - total_unloaded_tons;

      const locations_visited = Array.from(new Set([
        ...loading_details.map(d => d.locations?.name || ''),
        ...unloading_details.map(d => d.locations?.name || '')
      ])).filter(name => name);

      const items_handled = Array.from(new Set([
        ...loading_details.map(d => d.items?.name || ''),
        ...unloading_details.map(d => d.items?.name || '')
      ])).filter(name => name);

      return {
        operation_id,
        operation_number: operation.operation_number,
        loading_details: loading_details.map(d => this.toResponseDTO(d)),
        unloading_details: unloading_details.map(d => this.toResponseDTO(d)),
        total_loaded_tons,
        total_unloaded_tons,
        balance_tons,
        is_balanced: Math.abs(balance_tons) < 0.01, // 0.01トン未満の差は許容
        locations_visited,
        items_handled
      };
    } catch (error) {
      throw new Error(`積込・積下サマリー取得エラー: ${error}`);
    }
  }

  /**
   * 進捗トラッカー取得
   */
  async getProgressTracker(operation_id: string): Promise<DetailProgressTracker[]> {
    try {
      const details = await this.prisma.operation_details.findMany({
        where: { operation_id },
        include: {
          locations: true,
          items: true
        },
        orderBy: { sequence_number: 'asc' }
      });

      return details.map(detail => {
        const processing_time_minutes = detail.actual_start_time && detail.actual_end_time ?
          (detail.actual_end_time.getTime() - detail.actual_start_time.getTime()) / (1000 * 60) : undefined;

        const delay_minutes = detail.planned_time && detail.actual_start_time ?
          Math.max(0, (detail.actual_start_time.getTime() - detail.planned_time.getTime()) / (1000 * 60)) : undefined;

        let status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
        if (detail.actual_end_time) {
          status = 'COMPLETED';
        } else if (detail.actual_start_time) {
          status = 'IN_PROGRESS';
        } else if (delay_minutes && delay_minutes > 15) {
          status = 'DELAYED';
        } else {
          status = 'PLANNED';
        }

        return {
          detail_id: detail.id,
          sequence_number: detail.sequence_number,
          activity_type: detail.activity_type,
          location_name: detail.locations?.name || '',
          item_name: detail.items?.name || '',
          planned_time: detail.planned_time,
          actual_start_time: detail.actual_start_time,
          actual_end_time: detail.actual_end_time,
          quantity_tons: detail.quantity_tons,
          is_completed: !!detail.actual_end_time,
          processing_time_minutes,
          delay_minutes,
          status
        };
      });
    } catch (error) {
      throw new Error(`進捗トラッカー取得エラー: ${error}`);
    }
  }

  /**
   * バルク作成（運行の全詳細を一括作成）
   */
  async createMany(details: OperationDetailCreateInput[]): Promise<{ count: number }> {
    try {
      const detailsWithTimestamps = details.map(detail => ({
        ...detail,
        created_at: new Date(),
        updated_at: new Date()
      }));

      return await this.prisma.operation_details.createMany({
        data: detailsWithTimestamps,
        skipDuplicates: true
      });
    } catch (error) {
      throw new Error(`バルク詳細作成エラー: ${error}`);
    }
  }

  /**
   * 連番自動調整
   */
  async reorderSequences(operation_id: string): Promise<void> {
    try {
      const details = await this.prisma.operation_details.findMany({
        where: { operation_id },
        orderBy: { sequence_number: 'asc' }
      });

      const updatePromises = details.map((detail, index) => 
        this.prisma.operation_details.update({
          where: { id: detail.id },
          data: { 
            sequence_number: index + 1,
            updated_at: new Date()
          }
        })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      throw new Error(`連番調整エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(detail: any): OperationDetailResponseDTO {
    return {
      id: detail.id,
      operation_id: detail.operation_id,
      sequence_number: detail.sequence_number,
      activity_type: detail.activity_type,
      location_id: detail.location_id,
      item_id: detail.item_id,
      planned_time: detail.planned_time,
      actual_start_time: detail.actual_start_time,
      actual_end_time: detail.actual_end_time,
      quantity_tons: detail.quantity_tons,
      notes: detail.notes,
      created_at: detail.created_at,
      updated_at: detail.updated_at,
      operation: detail.operations ? {
        operation_number: detail.operations.operation_number,
        status: detail.operations.status
      } : undefined,
      location: detail.locations ? {
        name: detail.locations.name,
        address: detail.locations.address,
        location_type: detail.locations.location_type
      } : undefined,
      item: detail.items ? {
        name: detail.items.name,
        category: detail.items.category,
        unit: detail.items.unit
      } : undefined
    };
  }

  /**
   * 運行詳細存在確認
   */
  async exists(where: { 
    id?: string; 
    operation_id?: string;
    sequence_number?: number;
  }): Promise<boolean> {
    try {
      const detail = await this.prisma.operation_details.findFirst({ where });
      return detail !== null;
    } catch (error) {
      throw new Error(`運行詳細存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const operationDetailModel = new OperationDetail();
export default operationDetailModel;