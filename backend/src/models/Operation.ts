// backend/src/models/Operation.ts
import { PrismaClient, operation_status as PrismaOperationStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 運行モデル - Prismaスキーマ完全準拠版
 * ダンプトラック運行記録の管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface OperationModel {
  id: string;
  operation_number: string;
  vehicle_id: string;
  driver_id: string;
  status: PrismaOperationStatus;
  planned_start_time?: Date | null;
  actual_start_time?: Date | null;
  planned_end_time?: Date | null;
  actual_end_time?: Date | null;
  total_distance_km?: number | null; // Decimal型をnumberで扱う
  fuel_consumed_liters?: number | null; // Decimal型をnumberで扱う
  notes?: string | null;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OperationCreateInput {
  operation_number?: string; // 自動生成される場合はオプショナル
  vehicle_id: string;
  driver_id: string;
  status?: PrismaOperationStatus;
  planned_start_time?: Date;
  actual_start_time?: Date;
  planned_end_time?: Date;
  total_distance_km?: number;
  fuel_consumed_liters?: number;
  notes?: string;
  created_by?: string;
}

export interface OperationUpdateInput {
  operation_number?: string;
  vehicle_id?: string;
  driver_id?: string;
  status?: PrismaOperationStatus;
  planned_start_time?: Date;
  actual_start_time?: Date;
  planned_end_time?: Date;
  actual_end_time?: Date;
  total_distance_km?: number;
  fuel_consumed_liters?: number;
  notes?: string;
}

export interface OperationWhereInput {
  id?: string;
  operation_number?: string | { contains?: string; mode?: 'insensitive' };
  vehicle_id?: string;
  driver_id?: string;
  status?: PrismaOperationStatus | PrismaOperationStatus[];
  created_by?: string;
  planned_start_time?: {
    gte?: Date;
    lte?: Date;
  };
  actual_start_time?: {
    gte?: Date;
    lte?: Date;
  };
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface OperationOrderByInput {
  id?: 'asc' | 'desc';
  operation_number?: 'asc' | 'desc';
  status?: 'asc' | 'desc';
  planned_start_time?: 'asc' | 'desc';
  actual_start_time?: 'asc' | 'desc';
  total_distance_km?: 'asc' | 'desc';
  fuel_consumed_liters?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface OperationResponseDTO {
  id: string;
  operation_number: string;
  vehicle_id: string;
  driver_id: string;
  status: PrismaOperationStatus;
  planned_start_time?: Date | null;
  actual_start_time?: Date | null;
  planned_end_time?: Date | null;
  actual_end_time?: Date | null;
  total_distance_km?: number | null;
  fuel_consumed_liters?: number | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
  // リレーションデータ
  vehicle?: {
    plate_number: string;
    model: string;
  };
  driver?: {
    name: string;
    employee_id?: string;
  };
  creator?: {
    name: string;
  };
}

export interface OperationStats {
  total_operations: number;
  completed_operations: number;
  in_progress_operations: number;
  planned_operations: number;
  cancelled_operations: number;
  total_distance: number;
  total_fuel_consumed: number;
  average_distance_per_operation: number;
  average_fuel_consumption: number;
  completion_rate: number;
  operations_this_month: number;
  operations_today: number;
}

export interface OperationSummary {
  operation_id: string;
  operation_number: string;
  vehicle_plate_number: string;
  driver_name: string;
  status: PrismaOperationStatus;
  duration_hours?: number;
  total_distance_km?: number;
  fuel_consumed_liters?: number;
  total_loads: number;
  total_weight_tons: number;
  efficiency_score: number;
  start_time?: Date;
  end_time?: Date;
}

export interface DailyOperationReport {
  date: Date;
  total_operations: number;
  completed_operations: number;
  total_distance: number;
  total_fuel: number;
  total_weight: number;
  active_vehicles: number;
  active_drivers: number;
  operations: OperationSummary[];
}

// =====================================
// 運行モデルクラス
// =====================================

export class Operation {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 運行作成
   */
  async create(data: OperationCreateInput): Promise<OperationModel> {
    try {
      // 運行番号の自動生成（YYYYMM-NNNN形式）
      if (!data.operation_number) {
        data.operation_number = await this.generateOperationNumber();
      }

      return await this.prisma.operations.create({
        data: {
          ...data,
          status: data.status || PrismaOperationStatus.PLANNING,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`運行作成エラー: ${error}`);
    }
  }

  /**
   * 運行取得（ID指定）
   */
  async findById(id: string, includeRelations: boolean = false): Promise<OperationModel | null> {
    try {
      return await this.prisma.operations.findUnique({
        where: { id },
        include: includeRelations ? {
          vehicles: true,
          users_operations_driver_idTousers: true,
          users_operations_created_byTousers: true,
          operation_details: {
            include: {
              locations: true,
              items: true
            }
          },
          inspection_records: true,
          gps_logs: true
        } : undefined
      });
    } catch (error) {
      throw new Error(`運行取得エラー: ${error}`);
    }
  }

  /**
   * 運行取得（運行番号指定）
   */
  async findByOperationNumber(operation_number: string): Promise<OperationModel | null> {
    try {
      return await this.prisma.operations.findUnique({
        where: { operation_number }
      });
    } catch (error) {
      throw new Error(`運行取得エラー: ${error}`);
    }
  }

  /**
   * 運行一覧取得
   */
  async findMany(params: {
    where?: OperationWhereInput;
    orderBy?: OperationOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      vehicle?: boolean;
      driver?: boolean;
      creator?: boolean;
      operation_details?: boolean;
      gps_logs?: boolean;
      inspection_records?: boolean;
    };
  }): Promise<OperationModel[]> {
    try {
      return await this.prisma.operations.findMany({
        where: params.where,
        orderBy: params.orderBy || { created_at: 'desc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          vehicles: params.include.vehicle,
          users_operations_driver_idTousers: params.include.driver,
          users_operations_created_byTousers: params.include.creator,
          operation_details: params.include.operation_details ? {
            include: {
              locations: true,
              items: true
            }
          } : undefined,
          gps_logs: params.include.gps_logs,
          inspection_records: params.include.inspection_records
        } : undefined
      });
    } catch (error) {
      throw new Error(`運行一覧取得エラー: ${error}`);
    }
  }

  /**
   * 運行更新
   */
  async update(id: string, data: OperationUpdateInput): Promise<OperationModel> {
    try {
      return await this.prisma.operations.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`運行更新エラー: ${error}`);
    }
  }

  /**
   * 運行削除
   */
  async delete(id: string): Promise<OperationModel> {
    try {
      return await this.prisma.operations.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`運行削除エラー: ${error}`);
    }
  }

  /**
   * 運行数カウント
   */
  async count(where?: OperationWhereInput): Promise<number> {
    try {
      return await this.prisma.operations.count({ where });
    } catch (error) {
      throw new Error(`運行数取得エラー: ${error}`);
    }
  }

  /**
   * 運行開始
   */
  async startOperation(id: string): Promise<OperationModel> {
    try {
      return await this.prisma.operations.update({
        where: { id },
        data: {
          status: PrismaOperationStatus.IN_PROGRESS,
          actual_start_time: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`運行開始エラー: ${error}`);
    }
  }

  /**
   * 運行完了
   */
  async completeOperation(id: string, data: {
    total_distance_km?: number;
    fuel_consumed_liters?: number;
    notes?: string;
  }): Promise<OperationModel> {
    try {
      return await this.prisma.operations.update({
        where: { id },
        data: {
          status: PrismaOperationStatus.COMPLETED,
          actual_end_time: new Date(),
          total_distance_km: data.total_distance_km,
          fuel_consumed_liters: data.fuel_consumed_liters,
          notes: data.notes,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`運行完了エラー: ${error}`);
    }
  }

  /**
   * 運行キャンセル
   */
  async cancelOperation(id: string, reason?: string): Promise<OperationModel> {
    try {
      return await this.prisma.operations.update({
        where: { id },
        data: {
          status: PrismaOperationStatus.CANCELLED,
          notes: reason ? `キャンセル理由: ${reason}` : 'キャンセル',
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`運行キャンセルエラー: ${error}`);
    }
  }

  /**
   * 進行中運行取得
   */
  async findActiveOperations(): Promise<OperationModel[]> {
    try {
      return await this.prisma.operations.findMany({
        where: { status: PrismaOperationStatus.IN_PROGRESS },
        include: {
          vehicles: true,
          users_operations_driver_idTousers: true
        },
        orderBy: { actual_start_time: 'asc' }
      });
    } catch (error) {
      throw new Error(`進行中運行取得エラー: ${error}`);
    }
  }

  /**
   * 運転手の運行一覧
   */
  async findByDriverId(driver_id: string, limit?: number): Promise<OperationModel[]> {
    try {
      return await this.prisma.operations.findMany({
        where: { driver_id },
        include: {
          vehicles: true
        },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`運転手運行一覧取得エラー: ${error}`);
    }
  }

  /**
   * 車両の運行一覧
   */
  async findByVehicleId(vehicle_id: string, limit?: number): Promise<OperationModel[]> {
    try {
      return await this.prisma.operations.findMany({
        where: { vehicle_id },
        include: {
          users_operations_driver_idTousers: true
        },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`車両運行一覧取得エラー: ${error}`);
    }
  }

  /**
   * 運行統計取得
   */
  async getStats(period?: { start_date?: Date; end_date?: Date }): Promise<OperationStats> {
    try {
      const whereClause = period ? {
        created_at: {
          gte: period.start_date,
          lte: period.end_date
        }
      } : {};

      const [
        total_operations,
        completed_operations,
        in_progress_operations,
        planned_operations,
        cancelled_operations,
        distance_result,
        fuel_result,
        today_operations,
        month_operations
      ] = await Promise.all([
        this.prisma.operations.count({ where: whereClause }),
        this.prisma.operations.count({ where: { ...whereClause, status: PrismaOperationStatus.COMPLETED } }),
        this.prisma.operations.count({ where: { ...whereClause, status: PrismaOperationStatus.IN_PROGRESS } }),
        this.prisma.operations.count({ where: { ...whereClause, status: PrismaOperationStatus.PLANNING } }),
        this.prisma.operations.count({ where: { ...whereClause, status: PrismaOperationStatus.CANCELLED } }),
        this.prisma.operations.aggregate({
          where: { ...whereClause, status: PrismaOperationStatus.COMPLETED },
          _sum: { total_distance_km: true },
          _avg: { total_distance_km: true }
        }),
        this.prisma.operations.aggregate({
          where: { ...whereClause, status: PrismaOperationStatus.COMPLETED },
          _sum: { fuel_consumed_liters: true },
          _avg: { fuel_consumed_liters: true }
        }),
        this.prisma.operations.count({
          where: {
            created_at: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        this.prisma.operations.count({
          where: {
            created_at: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        })
      ]);

      return {
        total_operations,
        completed_operations,
        in_progress_operations,
        planned_operations,
        cancelled_operations,
        total_distance: distance_result._sum.total_distance_km || 0,
        total_fuel_consumed: fuel_result._sum.fuel_consumed_liters || 0,
        average_distance_per_operation: distance_result._avg.total_distance_km || 0,
        average_fuel_consumption: fuel_result._avg.fuel_consumed_liters || 0,
        completion_rate: total_operations > 0 ? (completed_operations / total_operations) * 100 : 0,
        operations_this_month: month_operations,
        operations_today: today_operations
      };
    } catch (error) {
      throw new Error(`運行統計取得エラー: ${error}`);
    }
  }

  /**
   * 日次運行レポート取得
   */
  async getDailyReport(date: Date): Promise<DailyOperationReport> {
    try {
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const operations = await this.prisma.operations.findMany({
        where: {
          created_at: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        include: {
          vehicles: true,
          users_operations_driver_idTousers: true,
          operation_details: {
            include: {
              items: true
            }
          }
        }
      });

      const operationSummaries: OperationSummary[] = operations.map(op => {
        const totalWeight = op.operation_details.reduce((sum, detail) => sum + (detail.quantity_tons || 0), 0);
        const duration = op.actual_start_time && op.actual_end_time ? 
          (op.actual_end_time.getTime() - op.actual_start_time.getTime()) / (1000 * 60 * 60) : undefined;

        return {
          operation_id: op.id,
          operation_number: op.operation_number,
          vehicle_plate_number: op.vehicles.plate_number,
          driver_name: op.users_operations_driver_idTousers.name,
          status: op.status,
          duration_hours: duration,
          total_distance_km: op.total_distance_km,
          fuel_consumed_liters: op.fuel_consumed_liters,
          total_loads: op.operation_details.length,
          total_weight_tons: totalWeight,
          efficiency_score: this.calculateEfficiencyScore(op),
          start_time: op.actual_start_time,
          end_time: op.actual_end_time
        };
      });

      return {
        date: startOfDay,
        total_operations: operations.length,
        completed_operations: operations.filter(op => op.status === PrismaOperationStatus.COMPLETED).length,
        total_distance: operations.reduce((sum, op) => sum + (op.total_distance_km || 0), 0),
        total_fuel: operations.reduce((sum, op) => sum + (op.fuel_consumed_liters || 0), 0),
        total_weight: operationSummaries.reduce((sum, op) => sum + op.total_weight_tons, 0),
        active_vehicles: new Set(operations.map(op => op.vehicle_id)).size,
        active_drivers: new Set(operations.map(op => op.driver_id)).size,
        operations: operationSummaries
      };
    } catch (error) {
      throw new Error(`日次レポート取得エラー: ${error}`);
    }
  }

  /**
   * 運行番号自動生成
   */
  private async generateOperationNumber(): Promise<string> {
    try {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      
      // 同月の最大連番を取得
      const lastOperation = await this.prisma.operations.findFirst({
        where: {
          operation_number: {
            startsWith: yearMonth
          }
        },
        orderBy: {
          operation_number: 'desc'
        }
      });

      let sequence = 1;
      if (lastOperation) {
        const lastSequence = parseInt(lastOperation.operation_number.split('-')[1] || '0');
        sequence = lastSequence + 1;
      }

      return `${yearMonth}-${sequence.toString().padStart(4, '0')}`;
    } catch (error) {
      throw new Error(`運行番号生成エラー: ${error}`);
    }
  }

  /**
   * 効率スコア計算
   */
  private calculateEfficiencyScore(operation: any): number {
    if (!operation.total_distance_km || !operation.fuel_consumed_liters) {
      return 0;
    }

    // 燃費効率 (km/L)
    const fuelEfficiency = operation.total_distance_km / operation.fuel_consumed_liters;
    
    // 基準燃費を3.5km/Lとして効率スコアを計算（100点満点）
    const baseEfficiency = 3.5;
    return Math.min(100, (fuelEfficiency / baseEfficiency) * 100);
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(operation: any): OperationResponseDTO {
    return {
      id: operation.id,
      operation_number: operation.operation_number,
      vehicle_id: operation.vehicle_id,
      driver_id: operation.driver_id,
      status: operation.status,
      planned_start_time: operation.planned_start_time,
      actual_start_time: operation.actual_start_time,
      planned_end_time: operation.planned_end_time,
      actual_end_time: operation.actual_end_time,
      total_distance_km: operation.total_distance_km,
      fuel_consumed_liters: operation.fuel_consumed_liters,
      notes: operation.notes,
      created_by: operation.created_by,
      created_at: operation.created_at,
      updated_at: operation.updated_at,
      vehicle: operation.vehicles ? {
        plate_number: operation.vehicles.plate_number,
        model: operation.vehicles.model
      } : undefined,
      driver: operation.users_operations_driver_idTousers ? {
        name: operation.users_operations_driver_idTousers.name,
        employee_id: operation.users_operations_driver_idTousers.employee_id
      } : undefined,
      creator: operation.users_operations_created_byTousers ? {
        name: operation.users_operations_created_byTousers.name
      } : undefined
    };
  }

  /**
   * 運行存在確認
   */
  async exists(where: { 
    id?: string; 
    operation_number?: string 
  }): Promise<boolean> {
    try {
      const operation = await this.prisma.operations.findUnique({ where });
      return operation !== null;
    } catch (error) {
      throw new Error(`運行存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const operationModel = new Operation();
export default operationModel;