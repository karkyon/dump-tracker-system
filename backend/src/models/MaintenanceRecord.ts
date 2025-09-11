// backend/src/models/MaintenanceRecord.ts
import { PrismaClient, maintenance_type as PrismaMaintenanceType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * メンテナンス記録モデル - Prismaスキーマ完全準拠版
 * 車両メンテナンス記録の管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface MaintenanceRecordModel {
  id: string;
  vehicle_id: string;
  maintenance_type: PrismaMaintenanceType;
  scheduled_date?: Date | null;
  completed_date?: Date | null;
  mileage_at_maintenance?: number | null;
  cost?: number | null; // Decimal型をnumberで扱う
  vendor_name?: string | null;
  description?: string | null;
  next_maintenance_date?: Date | null;
  next_maintenance_mileage?: number | null;
  is_completed: boolean;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MaintenanceRecordCreateInput {
  vehicle_id: string;
  maintenance_type: PrismaMaintenanceType;
  scheduled_date?: Date;
  mileage_at_maintenance?: number;
  cost?: number;
  vendor_name?: string;
  description?: string;
  next_maintenance_date?: Date;
  next_maintenance_mileage?: number;
  is_completed?: boolean;
  created_by?: string;
}

export interface MaintenanceRecordUpdateInput {
  vehicle_id?: string;
  maintenance_type?: PrismaMaintenanceType;
  scheduled_date?: Date;
  completed_date?: Date;
  mileage_at_maintenance?: number;
  cost?: number;
  vendor_name?: string;
  description?: string;
  next_maintenance_date?: Date;
  next_maintenance_mileage?: number;
  is_completed?: boolean;
}

export interface MaintenanceRecordWhereInput {
  id?: string;
  vehicle_id?: string;
  maintenance_type?: PrismaMaintenanceType | PrismaMaintenanceType[];
  scheduled_date?: {
    gte?: Date;
    lte?: Date;
  };
  completed_date?: {
    gte?: Date;
    lte?: Date;
  };
  is_completed?: boolean;
  created_by?: string;
  vendor_name?: string | { contains?: string; mode?: 'insensitive' };
  cost?: {
    gte?: number;
    lte?: number;
  };
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface MaintenanceRecordOrderByInput {
  id?: 'asc' | 'desc';
  maintenance_type?: 'asc' | 'desc';
  scheduled_date?: 'asc' | 'desc';
  completed_date?: 'asc' | 'desc';
  mileage_at_maintenance?: 'asc' | 'desc';
  cost?: 'asc' | 'desc';
  is_completed?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface MaintenanceRecordResponseDTO {
  id: string;
  vehicle_id: string;
  maintenance_type: PrismaMaintenanceType;
  scheduled_date?: Date | null;
  completed_date?: Date | null;
  mileage_at_maintenance?: number | null;
  cost?: number | null;
  vendor_name?: string | null;
  description?: string | null;
  next_maintenance_date?: Date | null;
  next_maintenance_mileage?: number | null;
  is_completed: boolean;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
  // リレーションデータ
  vehicle?: {
    plate_number: string;
    model: string;
    current_mileage: number;
  };
  creator?: {
    name: string;
    employee_id?: string;
  };
}

export interface MaintenanceRecordStats {
  total_records: number;
  completed_records: number;
  pending_records: number;
  routine_maintenance: number;
  repair_maintenance: number;
  inspection_maintenance: number;
  emergency_maintenance: number;
  total_cost: number;
  average_cost_per_maintenance: number;
  overdue_maintenance: number;
  maintenance_this_month: number;
  upcoming_maintenance_7days: number;
  upcoming_maintenance_30days: number;
}

export interface MaintenanceSchedule {
  vehicle_id: string;
  vehicle_plate_number: string;
  vehicle_model: string;
  current_mileage: number;
  scheduled_maintenances: ScheduledMaintenance[];
  overdue_maintenances: OverdueMaintenance[];
  next_maintenance: NextMaintenance;
}

export interface ScheduledMaintenance {
  id: string;
  maintenance_type: PrismaMaintenanceType;
  scheduled_date: Date;
  description?: string;
  vendor_name?: string;
  estimated_cost?: number;
  days_until_due: number;
  is_overdue: boolean;
}

export interface OverdueMaintenance {
  id: string;
  maintenance_type: PrismaMaintenanceType;
  scheduled_date: Date;
  days_overdue: number;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface NextMaintenance {
  maintenance_type: PrismaMaintenanceType;
  due_date?: Date;
  due_mileage?: number;
  days_until_due?: number;
  mileage_until_due?: number;
  is_urgent: boolean;
}

export interface MaintenanceCostAnalysis {
  vehicle_id: string;
  vehicle_plate_number: string;
  period: {
    start_date: Date;
    end_date: Date;
  };
  total_cost: number;
  maintenance_count: number;
  average_cost_per_maintenance: number;
  cost_by_type: {
    routine: number;
    repair: number;
    inspection: number;
    emergency: number;
  };
  most_expensive_maintenance: {
    id: string;
    type: PrismaMaintenanceType;
    cost: number;
    date: Date;
    description?: string;
  };
  cost_trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

// =====================================
// メンテナンス記録モデルクラス
// =====================================

export class MaintenanceRecord {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * メンテナンス記録作成
   */
  async create(data: MaintenanceRecordCreateInput): Promise<MaintenanceRecordModel> {
    try {
      return await this.prisma.maintenance_records.create({
        data: {
          ...data,
          is_completed: data.is_completed ?? false,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`メンテナンス記録作成エラー: ${error}`);
    }
  }

  /**
   * メンテナンス記録取得（ID指定）
   */
  async findById(id: string, includeRelations: boolean = false): Promise<MaintenanceRecordModel | null> {
    try {
      return await this.prisma.maintenance_records.findUnique({
        where: { id },
        include: includeRelations ? {
          vehicles: true,
          users: true
        } : undefined
      });
    } catch (error) {
      throw new Error(`メンテナンス記録取得エラー: ${error}`);
    }
  }

  /**
   * メンテナンス記録一覧取得
   */
  async findMany(params: {
    where?: MaintenanceRecordWhereInput;
    orderBy?: MaintenanceRecordOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      vehicle?: boolean;
      creator?: boolean;
    };
  }): Promise<MaintenanceRecordModel[]> {
    try {
      return await this.prisma.maintenance_records.findMany({
        where: params.where,
        orderBy: params.orderBy || { created_at: 'desc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          vehicles: params.include.vehicle,
          users: params.include.creator
        } : undefined
      });
    } catch (error) {
      throw new Error(`メンテナンス記録一覧取得エラー: ${error}`);
    }
  }

  /**
   * メンテナンス記録更新
   */
  async update(id: string, data: MaintenanceRecordUpdateInput): Promise<MaintenanceRecordModel> {
    try {
      return await this.prisma.maintenance_records.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`メンテナンス記録更新エラー: ${error}`);
    }
  }

  /**
   * メンテナンス記録削除
   */
  async delete(id: string): Promise<MaintenanceRecordModel> {
    try {
      return await this.prisma.maintenance_records.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`メンテナンス記録削除エラー: ${error}`);
    }
  }

  /**
   * メンテナンス記録数カウント
   */
  async count(where?: MaintenanceRecordWhereInput): Promise<number> {
    try {
      return await this.prisma.maintenance_records.count({ where });
    } catch (error) {
      throw new Error(`メンテナンス記録数取得エラー: ${error}`);
    }
  }

  /**
   * メンテナンス完了
   */
  async completeMaintenance(id: string, data: {
    completed_date?: Date;
    mileage_at_maintenance?: number;
    cost?: number;
    description?: string;
    next_maintenance_date?: Date;
    next_maintenance_mileage?: number;
  }): Promise<MaintenanceRecordModel> {
    try {
      return await this.prisma.maintenance_records.update({
        where: { id },
        data: {
          is_completed: true,
          completed_date: data.completed_date || new Date(),
          mileage_at_maintenance: data.mileage_at_maintenance,
          cost: data.cost,
          description: data.description,
          next_maintenance_date: data.next_maintenance_date,
          next_maintenance_mileage: data.next_maintenance_mileage,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`メンテナンス完了エラー: ${error}`);
    }
  }

  /**
   * 車両のメンテナンス記録取得
   */
  async findByVehicleId(vehicle_id: string, limit?: number): Promise<MaintenanceRecordModel[]> {
    try {
      return await this.prisma.maintenance_records.findMany({
        where: { vehicle_id },
        include: {
          users: true
        },
        orderBy: { created_at: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`車両メンテナンス記録取得エラー: ${error}`);
    }
  }

  /**
   * 未完了メンテナンス取得
   */
  async findPendingMaintenance(): Promise<MaintenanceRecordModel[]> {
    try {
      return await this.prisma.maintenance_records.findMany({
        where: { is_completed: false },
        include: {
          vehicles: true,
          users: true
        },
        orderBy: { scheduled_date: 'asc' }
      });
    } catch (error) {
      throw new Error(`未完了メンテナンス取得エラー: ${error}`);
    }
  }

  /**
   * 期限切れメンテナンス取得
   */
  async findOverdueMaintenance(): Promise<MaintenanceRecordModel[]> {
    try {
      const today = new Date();
      return await this.prisma.maintenance_records.findMany({
        where: {
          is_completed: false,
          scheduled_date: {
            lt: today
          }
        },
        include: {
          vehicles: true,
          users: true
        },
        orderBy: { scheduled_date: 'asc' }
      });
    } catch (error) {
      throw new Error(`期限切れメンテナンス取得エラー: ${error}`);
    }
  }

  /**
   * 今後のメンテナンス取得
   */
  async findUpcomingMaintenance(days: number = 30): Promise<MaintenanceRecordModel[]> {
    try {
      const today = new Date();
      const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

      return await this.prisma.maintenance_records.findMany({
        where: {
          is_completed: false,
          scheduled_date: {
            gte: today,
            lte: futureDate
          }
        },
        include: {
          vehicles: true,
          users: true
        },
        orderBy: { scheduled_date: 'asc' }
      });
    } catch (error) {
      throw new Error(`今後のメンテナンス取得エラー: ${error}`);
    }
  }

  /**
   * メンテナンス統計取得
   */
  async getStats(period?: { start_date?: Date; end_date?: Date }): Promise<MaintenanceRecordStats> {
    try {
      const whereClause = period ? {
        created_at: {
          gte: period.start_date,
          lte: period.end_date
        }
      } : {};

      const [
        total_records,
        completed_records,
        pending_records,
        routine_maintenance,
        repair_maintenance,
        inspection_maintenance,
        emergency_maintenance,
        cost_result,
        overdue_count,
        month_count,
        upcoming_7days,
        upcoming_30days
      ] = await Promise.all([
        this.prisma.maintenance_records.count({ where: whereClause }),
        this.prisma.maintenance_records.count({ where: { ...whereClause, is_completed: true } }),
        this.prisma.maintenance_records.count({ where: { ...whereClause, is_completed: false } }),
        this.prisma.maintenance_records.count({ where: { ...whereClause, maintenance_type: PrismaMaintenanceType.ROUTINE } }),
        this.prisma.maintenance_records.count({ where: { ...whereClause, maintenance_type: PrismaMaintenanceType.REPAIR } }),
        this.prisma.maintenance_records.count({ where: { ...whereClause, maintenance_type: PrismaMaintenanceType.INSPECTION } }),
        this.prisma.maintenance_records.count({ where: { ...whereClause, maintenance_type: PrismaMaintenanceType.EMERGENCY } }),
        this.prisma.maintenance_records.aggregate({
          where: { ...whereClause, is_completed: true },
          _sum: { cost: true },
          _avg: { cost: true }
        }),
        this.prisma.maintenance_records.count({
          where: {
            is_completed: false,
            scheduled_date: { lt: new Date() }
          }
        }),
        this.prisma.maintenance_records.count({
          where: {
            created_at: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        }),
        this.prisma.maintenance_records.count({
          where: {
            is_completed: false,
            scheduled_date: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        this.prisma.maintenance_records.count({
          where: {
            is_completed: false,
            scheduled_date: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      return {
        total_records,
        completed_records,
        pending_records,
        routine_maintenance,
        repair_maintenance,
        inspection_maintenance,
        emergency_maintenance,
        total_cost: cost_result._sum.cost || 0,
        average_cost_per_maintenance: cost_result._avg.cost || 0,
        overdue_maintenance: overdue_count,
        maintenance_this_month: month_count,
        upcoming_maintenance_7days: upcoming_7days,
        upcoming_maintenance_30days: upcoming_30days
      };
    } catch (error) {
      throw new Error(`メンテナンス統計取得エラー: ${error}`);
    }
  }

  /**
   * 車両メンテナンススケジュール取得
   */
  async getMaintenanceSchedule(vehicle_id: string): Promise<MaintenanceSchedule | null> {
    try {
      const vehicle = await this.prisma.vehicles.findUnique({
        where: { id: vehicle_id }
      });

      if (!vehicle) {
        return null;
      }

      const today = new Date();
      const maintenanceRecords = await this.prisma.maintenance_records.findMany({
        where: {
          vehicle_id,
          is_completed: false
        },
        orderBy: { scheduled_date: 'asc' }
      });

      const scheduled_maintenances: ScheduledMaintenance[] = [];
      const overdue_maintenances: OverdueMaintenance[] = [];

      maintenanceRecords.forEach(record => {
        const days_until_due = record.scheduled_date ? 
          Math.ceil((record.scheduled_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        if (days_until_due < 0) {
          overdue_maintenances.push({
            id: record.id,
            maintenance_type: record.maintenance_type,
            scheduled_date: record.scheduled_date!,
            days_overdue: Math.abs(days_until_due),
            description: record.description,
            priority: Math.abs(days_until_due) > 30 ? 'CRITICAL' : 
                     Math.abs(days_until_due) > 14 ? 'HIGH' : 
                     Math.abs(days_until_due) > 7 ? 'MEDIUM' : 'LOW'
          });
        } else {
          scheduled_maintenances.push({
            id: record.id,
            maintenance_type: record.maintenance_type,
            scheduled_date: record.scheduled_date!,
            description: record.description,
            vendor_name: record.vendor_name,
            estimated_cost: record.cost,
            days_until_due,
            is_overdue: false
          });
        }
      });

      // 次回メンテナンス計算
      const next_scheduled = scheduled_maintenances.length > 0 ? scheduled_maintenances[0] : null;
      const next_maintenance: NextMaintenance = {
        maintenance_type: next_scheduled?.maintenance_type || PrismaMaintenanceType.ROUTINE,
        due_date: next_scheduled?.scheduled_date,
        days_until_due: next_scheduled?.days_until_due,
        is_urgent: next_scheduled ? next_scheduled.days_until_due <= 7 : false
      };

      return {
        vehicle_id,
        vehicle_plate_number: vehicle.plate_number,
        vehicle_model: vehicle.model,
        current_mileage: vehicle.current_mileage,
        scheduled_maintenances,
        overdue_maintenances,
        next_maintenance
      };
    } catch (error) {
      throw new Error(`メンテナンススケジュール取得エラー: ${error}`);
    }
  }

  /**
   * メンテナンスコスト分析
   */
  async getCostAnalysis(
    vehicle_id: string, 
    period: { start_date: Date; end_date: Date }
  ): Promise<MaintenanceCostAnalysis | null> {
    try {
      const vehicle = await this.prisma.vehicles.findUnique({
        where: { id: vehicle_id }
      });

      if (!vehicle) {
        return null;
      }

      const records = await this.prisma.maintenance_records.findMany({
        where: {
          vehicle_id,
          is_completed: true,
          completed_date: {
            gte: period.start_date,
            lte: period.end_date
          }
        },
        orderBy: { completed_date: 'asc' }
      });

      const total_cost = records.reduce((sum, record) => sum + (record.cost || 0), 0);
      const maintenance_count = records.length;
      const average_cost = maintenance_count > 0 ? total_cost / maintenance_count : 0;

      const cost_by_type = {
        routine: records.filter(r => r.maintenance_type === PrismaMaintenanceType.ROUTINE)
                       .reduce((sum, r) => sum + (r.cost || 0), 0),
        repair: records.filter(r => r.maintenance_type === PrismaMaintenanceType.REPAIR)
                      .reduce((sum, r) => sum + (r.cost || 0), 0),
        inspection: records.filter(r => r.maintenance_type === PrismaMaintenanceType.INSPECTION)
                          .reduce((sum, r) => sum + (r.cost || 0), 0),
        emergency: records.filter(r => r.maintenance_type === PrismaMaintenanceType.EMERGENCY)
                         .reduce((sum, r) => sum + (r.cost || 0), 0)
      };

      const most_expensive = records.reduce((max, record) => 
        (record.cost || 0) > (max.cost || 0) ? record : max, records[0]);

      // コスト傾向分析（簡単な実装）
      const monthly_costs = this.groupByMonth(records);
      const cost_trend = this.analyzeCostTrend(monthly_costs);

      return {
        vehicle_id,
        vehicle_plate_number: vehicle.plate_number,
        period,
        total_cost,
        maintenance_count,
        average_cost_per_maintenance: average_cost,
        cost_by_type,
        most_expensive_maintenance: {
          id: most_expensive.id,
          type: most_expensive.maintenance_type,
          cost: most_expensive.cost || 0,
          date: most_expensive.completed_date!,
          description: most_expensive.description
        },
        cost_trend
      };
    } catch (error) {
      throw new Error(`コスト分析取得エラー: ${error}`);
    }
  }

  /**
   * 月別グループ化
   */
  private groupByMonth(records: MaintenanceRecordModel[]): { month: string; cost: number }[] {
    const monthly = new Map<string, number>();
    
    records.forEach(record => {
      if (record.completed_date && record.cost) {
        const month = record.completed_date.toISOString().slice(0, 7); // YYYY-MM
        monthly.set(month, (monthly.get(month) || 0) + record.cost);
      }
    });

    return Array.from(monthly.entries()).map(([month, cost]) => ({ month, cost }));
  }

  /**
   * コスト傾向分析
   */
  private analyzeCostTrend(monthly_costs: { month: string; cost: number }[]): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (monthly_costs.length < 2) return 'STABLE';

    const first_half = monthly_costs.slice(0, Math.floor(monthly_costs.length / 2));
    const second_half = monthly_costs.slice(Math.floor(monthly_costs.length / 2));

    const first_avg = first_half.reduce((sum, item) => sum + item.cost, 0) / first_half.length;
    const second_avg = second_half.reduce((sum, item) => sum + item.cost, 0) / second_half.length;

    const change_rate = (second_avg - first_avg) / first_avg;

    if (change_rate > 0.1) return 'INCREASING';
    if (change_rate < -0.1) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(record: any): MaintenanceRecordResponseDTO {
    return {
      id: record.id,
      vehicle_id: record.vehicle_id,
      maintenance_type: record.maintenance_type,
      scheduled_date: record.scheduled_date,
      completed_date: record.completed_date,
      mileage_at_maintenance: record.mileage_at_maintenance,
      cost: record.cost,
      vendor_name: record.vendor_name,
      description: record.description,
      next_maintenance_date: record.next_maintenance_date,
      next_maintenance_mileage: record.next_maintenance_mileage,
      is_completed: record.is_completed,
      created_by: record.created_by,
      created_at: record.created_at,
      updated_at: record.updated_at,
      vehicle: record.vehicles ? {
        plate_number: record.vehicles.plate_number,
        model: record.vehicles.model,
        current_mileage: record.vehicles.current_mileage
      } : undefined,
      creator: record.users ? {
        name: record.users.name,
        employee_id: record.users.employee_id
      } : undefined
    };
  }

  /**
   * バルクメンテナンス記録作成
   */
  async createMany(records: MaintenanceRecordCreateInput[]): Promise<{ count: number }> {
    try {
      const recordsWithDefaults = records.map(record => ({
        ...record,
        is_completed: record.is_completed ?? false,
        created_at: new Date(),
        updated_at: new Date()
      }));

      return await this.prisma.maintenance_records.createMany({
        data: recordsWithDefaults,
        skipDuplicates: true
      });
    } catch (error) {
      throw new Error(`バルクメンテナンス記録作成エラー: ${error}`);
    }
  }

  /**
   * メンテナンス記録存在確認
   */
  async exists(where: { 
    id?: string; 
    vehicle_id?: string;
    maintenance_type?: PrismaMaintenanceType;
  }): Promise<boolean> {
    try {
      const record = await this.prisma.maintenance_records.findFirst({ where });
      return record !== null;
    } catch (error) {
      throw new Error(`メンテナンス記録存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const maintenanceRecordModel = new MaintenanceRecord();
export default maintenanceRecordModel;