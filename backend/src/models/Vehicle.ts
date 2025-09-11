// backend/src/models/Vehicle.ts
import { PrismaClient, fuel_type as PrismaFuelType, vehicle_status as PrismaVehicleStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 車両モデル - Prismaスキーマ完全準拠版
 * スネークケース命名規則、DB整合性確保
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface VehicleModel {
  id: string;
  plate_number: string;
  model: string;
  manufacturer?: string | null;
  year?: number | null;
  fuel_type: PrismaFuelType;
  capacity_tons?: number | null; // Decimal型をnumberで扱う
  current_mileage: number;
  status: PrismaVehicleStatus;
  purchase_date?: Date | null;
  insurance_expiry?: Date | null;
  inspection_expiry?: Date | null;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface VehicleCreateInput {
  plate_number: string;
  model: string;
  manufacturer?: string;
  year?: number;
  fuel_type?: PrismaFuelType;
  capacity_tons?: number;
  current_mileage?: number;
  status?: PrismaVehicleStatus;
  purchase_date?: Date;
  insurance_expiry?: Date;
  inspection_expiry?: Date;
  notes?: string;
}

export interface VehicleUpdateInput {
  plate_number?: string;
  model?: string;
  manufacturer?: string;
  year?: number;
  fuel_type?: PrismaFuelType;
  capacity_tons?: number;
  current_mileage?: number;
  status?: PrismaVehicleStatus;
  purchase_date?: Date;
  insurance_expiry?: Date;
  inspection_expiry?: Date;
  notes?: string;
}

export interface VehicleWhereInput {
  id?: string;
  plate_number?: string | { contains?: string; mode?: 'insensitive' };
  model?: { contains?: string; mode?: 'insensitive' };
  manufacturer?: { contains?: string; mode?: 'insensitive' };
  year?: number | { gte?: number; lte?: number };
  fuel_type?: PrismaFuelType | PrismaFuelType[];
  status?: PrismaVehicleStatus | PrismaVehicleStatus[];
  capacity_tons?: { gte?: number; lte?: number };
  current_mileage?: { gte?: number; lte?: number };
  created_at?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface VehicleOrderByInput {
  id?: 'asc' | 'desc';
  plate_number?: 'asc' | 'desc';
  model?: 'asc' | 'desc';
  manufacturer?: 'asc' | 'desc';
  year?: 'asc' | 'desc';
  fuel_type?: 'asc' | 'desc';
  status?: 'asc' | 'desc';
  current_mileage?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface VehicleResponseDTO {
  id: string;
  plate_number: string;
  model: string;
  manufacturer?: string | null;
  year?: number | null;
  fuel_type: PrismaFuelType;
  capacity_tons?: number | null;
  current_mileage: number;
  status: PrismaVehicleStatus;
  purchase_date?: Date | null;
  insurance_expiry?: Date | null;
  inspection_expiry?: Date | null;
  notes?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface VehicleStats {
  total_vehicles: number;
  active_vehicles: number;
  maintenance_vehicles: number;
  retired_vehicles: number;
  diesel_vehicles: number;
  electric_vehicles: number;
  average_mileage: number;
  total_capacity: number;
  vehicles_needing_inspection: number;
  vehicles_needing_insurance_renewal: number;
}

export interface VehicleUtilization {
  vehicle_id: string;
  plate_number: string;
  period: {
    start_date: Date;
    end_date: Date;
  };
  total_operations: number;
  total_distance: number;
  total_fuel_consumed: number;
  utilization_rate: number;
  efficiency_score: number;
  maintenance_cost: number;
  revenue_generated: number;
}

export interface VehicleMaintenanceAlert {
  vehicle_id: string;
  plate_number: string;
  alert_type: 'INSPECTION' | 'INSURANCE' | 'MAINTENANCE' | 'MILEAGE';
  due_date?: Date;
  days_remaining: number;
  current_mileage: number;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// =====================================
// 車両モデルクラス
// =====================================

export class Vehicle {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 車両作成
   */
  async create(data: VehicleCreateInput): Promise<VehicleModel> {
    try {
      return await this.prisma.vehicle.create({
        data: {
          ...data,
          fuel_type: data.fuel_type ?? PrismaFuelType.DIESEL,
          current_mileage: data.current_mileage ?? 0,
          status: data.status ?? PrismaVehicleStatus.ACTIVE,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`車両作成エラー: ${error}`);
    }
  }

  /**
   * 車両取得（ID指定）
   */
  async findById(id: string): Promise<VehicleModel | null> {
    try {
      const result = await this.prisma.vehicle.findUnique({
        where: { id }
      });
      if (!result) return null;
      if (result.fuel_type === null) {
        throw new Error('fuel_type is null, which is incompatible with VehicleModel');
      }
      return {
        ...result,
        fuel_type: result.fuel_type as PrismaFuelType
      };
    } catch (error) {
      throw new Error(`車両取得エラー: ${error}`);
    }
  }

  /**
   * 車両取得（ナンバープレート指定）
   */
  async findByPlateNumber(plate_number: string): Promise<VehicleModel | null> {
    try {
      return await this.prisma.vehicle.findUnique({
        where: { plate_number }
      });
    } catch (error) {
      throw new Error(`車両取得エラー: ${error}`);
    }
  }

  /**
   * 車両一覧取得
   */
  async findMany(params: {
    where?: VehicleWhereInput;
    orderBy?: VehicleOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      operations?: boolean;
      maintenance_records?: boolean;
      gps_logs?: boolean;
      inspection_records?: boolean;
    };
  }): Promise<VehicleModel[]> {
    try {
      return await this.prisma.vehicle.findMany({
        where: params.where,
        orderBy: params.orderBy || { plate_number: 'asc' },
        skip: params.skip,
        take: params.take,
        include: params.include
      });
    } catch (error) {
      throw new Error(`車両一覧取得エラー: ${error}`);
    }
  }

  /**
   * 車両更新
   */
  async update(id: string, data: VehicleUpdateInput): Promise<VehicleModel> {
    try {
      return await this.prisma.vehicle.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`車両更新エラー: ${error}`);
    }
  }

  /**
   * 車両削除（論理削除）
   */
  async softDelete(id: string): Promise<VehicleModel> {
    try {
      return await this.prisma.vehicle.update({
        where: { id },
        data: { 
          status: PrismaVehicleStatus.RETIRED,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`車両削除エラー: ${error}`);
    }
  }

  /**
   * 車両物理削除
   */
  async delete(id: string): Promise<VehicleModel> {
    try {
      return await this.prisma.vehicle.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`車両物理削除エラー: ${error}`);
    }
  }

  /**
   * 車両数カウント
   */
  async count(where?: VehicleWhereInput): Promise<number> {
    try {
      return await this.prisma.vehicle.count({ where });
    } catch (error) {
      throw new Error(`車両数取得エラー: ${error}`);
    }
  }

  /**
   * 走行距離更新
   */
  async updateMileage(id: string, current_mileage: number): Promise<VehicleModel> {
    try {
      return await this.prisma.vehicle.update({
        where: { id },
        data: {
          current_mileage,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`走行距離更新エラー: ${error}`);
    }
  }

  /**
   * ステータス更新
   */
  async updateStatus(id: string, status: PrismaVehicleStatus): Promise<VehicleModel> {
    try {
      return await this.prisma.vehicle.update({
        where: { id },
        data: {
          status,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`ステータス更新エラー: ${error}`);
    }
  }

  /**
   * アクティブ車両取得
   */
  async findActiveVehicles(): Promise<VehicleModel[]> {
    try {
      return await this.prisma.vehicle.findMany({
        where: { status: PrismaVehicleStatus.ACTIVE },
        orderBy: { plate_number: 'asc' }
      });
    } catch (error) {
      throw new Error(`アクティブ車両取得エラー: ${error}`);
    }
  }

  /**
   * メンテナンス対象車両取得
   */
  async findMaintenanceVehicles(): Promise<VehicleModel[]> {
    try {
      return await this.prisma.vehicle.findMany({
        where: { status: PrismaVehicleStatus.MAINTENANCE },
        orderBy: { plate_number: 'asc' }
      });
    } catch (error) {
      throw new Error(`メンテナンス車両取得エラー: ${error}`);
    }
  }

  /**
   * 車両統計取得
   */
  async getStats(): Promise<VehicleStats> {
    try {
      const [
        total_vehicles,
        active_vehicles,
        maintenance_vehicles,
        retired_vehicles,
        diesel_vehicles,
        electric_vehicles,
        mileage_result,
        capacity_result,
        inspection_alerts,
        insurance_alerts
      ] = await Promise.all([
        this.prisma.vehicle.count(),
        this.prisma.vehicle.count({ where: { status: PrismaVehicleStatus.ACTIVE } }),
        this.prisma.vehicle.count({ where: { status: PrismaVehicleStatus.MAINTENANCE } }),
        this.prisma.vehicle.count({ where: { status: PrismaVehicleStatus.RETIRED } }),
        this.prisma.vehicle.count({ where: { fuel_type: PrismaFuelType.DIESEL } }),
        this.prisma.vehicle.count({ where: { fuel_type: PrismaFuelType.ELECTRIC } }),
        this.prisma.vehicle.aggregate({
          _avg: { current_mileage: true }
        }),
        this.prisma.vehicle.aggregate({
          _sum: { capacity_tons: true }
        }),
        this.prisma.vehicle.count({
          where: {
            inspection_expiry: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30日以内
            }
          }
        }),
        this.prisma.vehicle.count({
          where: {
            insurance_expiry: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30日以内
            }
          }
        })
      ]);

      return {
        total_vehicles,
        active_vehicles,
        maintenance_vehicles,
        retired_vehicles,
        diesel_vehicles,
        electric_vehicles,
        average_mileage: Math.round(mileage_result._avg.current_mileage || 0),
        total_capacity: capacity_result._sum.capacity_tons || 0,
        vehicles_needing_inspection: inspection_alerts,
        vehicles_needing_insurance_renewal: insurance_alerts
      };
    } catch (error) {
      throw new Error(`車両統計取得エラー: ${error}`);
    }
  }

  /**
   * 車両検索
   */
  async search(query: string, limit: number = 10): Promise<VehicleModel[]> {
    try {
      return await this.prisma.vehicle.findMany({
        where: {
          OR: [
            { plate_number: { contains: query, mode: 'insensitive' } },
            { model: { contains: query, mode: 'insensitive' } },
            { manufacturer: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: limit,
        orderBy: { plate_number: 'asc' }
      });
    } catch (error) {
      throw new Error(`車両検索エラー: ${error}`);
    }
  }

  /**
   * メンテナンスアラート取得
   */
  async getMaintenanceAlerts(): Promise<VehicleMaintenanceAlert[]> {
    try {
      const vehicles = await this.prisma.vehicle.findMany({
        where: {
          status: { not: PrismaVehicleStatus.RETIRED }
        }
      });

      const alerts: VehicleMaintenanceAlert[] = [];
      const now = new Date();

      vehicles.forEach(vehicle => {
        // 車検期限チェック
        if (vehicle.inspection_expiry) {
          const days = Math.ceil((vehicle.inspection_expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 30) {
            alerts.push({
              vehicle_id: vehicle.id,
              plate_number: vehicle.plate_number,
              alert_type: 'INSPECTION',
              due_date: vehicle.inspection_expiry,
              days_remaining: days,
              current_mileage: vehicle.current_mileage,
              message: `車検期限まで${days}日です`,
              priority: days <= 7 ? 'CRITICAL' : days <= 14 ? 'HIGH' : 'MEDIUM'
            });
          }
        }

        // 保険期限チェック
        if (vehicle.insurance_expiry) {
          const days = Math.ceil((vehicle.insurance_expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 30) {
            alerts.push({
              vehicle_id: vehicle.id,
              plate_number: vehicle.plate_number,
              alert_type: 'INSURANCE',
              due_date: vehicle.insurance_expiry,
              days_remaining: days,
              current_mileage: vehicle.current_mileage,
              message: `保険期限まで${days}日です`,
              priority: days <= 7 ? 'CRITICAL' : days <= 14 ? 'HIGH' : 'MEDIUM'
            });
          }
        }
      });

      return alerts.sort((a, b) => a.days_remaining - b.days_remaining);
    } catch (error) {
      throw new Error(`メンテナンスアラート取得エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(vehicle: VehicleModel): VehicleResponseDTO {
    return {
      id: vehicle.id,
      plate_number: vehicle.plate_number,
      model: vehicle.model,
      manufacturer: vehicle.manufacturer,
      year: vehicle.year,
      fuel_type: vehicle.fuel_type,
      capacity_tons: vehicle.capacity_tons,
      current_mileage: vehicle.current_mileage,
      status: vehicle.status,
      purchase_date: vehicle.purchase_date,
      insurance_expiry: vehicle.insurance_expiry,
      inspection_expiry: vehicle.inspection_expiry,
      notes: vehicle.notes,
      created_at: vehicle.created_at,
      updated_at: vehicle.updated_at
    };
  }

  /**
   * バルク車両作成（CSV等からの一括登録）
   */
  async createMany(vehicles: VehicleCreateInput[]): Promise<{ count: number }> {
    try {
      const vehiclesWithTimestamps = vehicles.map(vehicle => ({
        ...vehicle,
        fuel_type: vehicle.fuel_type || PrismaFuelType.DIESEL,
        current_mileage: vehicle.current_mileage || 0,
        status: vehicle.status || PrismaVehicleStatus.ACTIVE,
        created_at: new Date(),
        updated_at: new Date()
      }));

      return await this.prisma.vehicle.createMany({
        data: vehiclesWithTimestamps,
        skipDuplicates: true
      });
    } catch (error) {
      throw new Error(`バルク車両作成エラー: ${error}`);
    }
  }

  /**
   * 車両存在確認
   */
  async exists(where: { 
    id?: string; 
    plate_number?: string 
  }): Promise<boolean> {
    try {
      const vehicle = await this.prisma.vehicle.findUnique({ where });
      return vehicle !== null;
    } catch (error) {
      throw new Error(`車両存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const vehicleModel = new Vehicle();
export default vehicleModel;