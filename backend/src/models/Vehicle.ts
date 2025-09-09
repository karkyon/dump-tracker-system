// backend/src/models/Vehicle.ts
import { PrismaClient, Vehicle, VehicleStatus, MaintenanceRecord, User } from '@prisma/client';
import { CreateVehicleRequest, UpdateVehicleRequest, VehicleFilter } from '../types';

const prisma = new PrismaClient();

/**
 * 車両モデルクラス
 * データベースの車両テーブルに対する操作を提供
 */
export class VehicleModel {
  
  /**
   * 車両一覧取得
   */
  static async findAll(filter: VehicleFilter = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'vehicleNumber',
      sortOrder = 'asc',
      search,
      status,
      isActive,
      vehicleType
    } = filter;

    const skip = (page - 1) * limit;

    const where: any = {};

    // 検索条件
    if (search) {
      where.OR = [
        { vehicleNumber: { contains: search, mode: 'insensitive' } },
        { vehicleType: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (vehicleType) {
      where.vehicleType = { contains: vehicleType, mode: 'insensitive' };
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          lastDriver: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true
            }
          },
          operations: {
            take: 5,
            orderBy: { operationDate: 'desc' },
            select: {
              id: true,
              operationDate: true,
              status: true,
              startMileage: true,
              endMileage: true
            }
          },
          maintenanceRecords: {
            take: 3,
            orderBy: { performedAt: 'desc' },
            select: {
              id: true,
              maintenanceType: true,
              description: true,
              cost: true,
              performedAt: true,
              nextDue: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.vehicle.count({ where })
    ]);

    return {
      vehicles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        count: total,
        limit
      }
    };
  }

  /**
   * 車両詳細取得
   */
  static async findById(id: string): Promise<Vehicle | null> {
    return prisma.vehicle.findUnique({
      where: { id },
      include: {
        lastDriver: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true
          }
        },
        operations: {
          orderBy: { operationDate: 'desc' },
          take: 10,
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                username: true
              }
            }
          }
        },
        maintenanceRecords: {
          orderBy: { performedAt: 'desc' },
          take: 10
        },
        gpsLogs: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });
  }

  /**
   * 車両番号で検索
   */
  static async findByVehicleNumber(vehicleNumber: string): Promise<Vehicle | null> {
    return prisma.vehicle.findUnique({
      where: { vehicleNumber }
    });
  }

  /**
   * 車両新規作成
   */
  static async create(data: CreateVehicleRequest): Promise<Vehicle> {
    // 車両番号の重複チェック
    const existingVehicle = await this.findByVehicleNumber(data.vehicleNumber);
    if (existingVehicle) {
      throw new Error('この車両番号は既に使用されています');
    }

    return prisma.vehicle.create({
      data: {
        vehicleNumber: data.vehicleNumber,
        vehicleType: data.vehicleType,
        capacity: data.capacity,
        currentMileage: data.currentMileage,
        status: VehicleStatus.AVAILABLE,
        isActive: true
      },
      include: {
        lastDriver: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * 車両情報更新
   */
  static async update(id: string, data: UpdateVehicleRequest): Promise<Vehicle> {
    // 車両の存在確認
    const existingVehicle = await this.findById(id);
    if (!existingVehicle) {
      throw new Error('車両が見つかりません');
    }

    // 車両番号の重複チェック（変更する場合）
    if (data.vehicleNumber && data.vehicleNumber !== existingVehicle.vehicleNumber) {
      const duplicateVehicle = await this.findByVehicleNumber(data.vehicleNumber);
      if (duplicateVehicle) {
        throw new Error('この車両番号は既に使用されています');
      }
    }

    return prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        lastDriver: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * 車両削除（論理削除）
   */
  static async delete(id: string): Promise<Vehicle> {
    const vehicle = await this.findById(id);
    if (!vehicle) {
      throw new Error('車両が見つかりません');
    }

    // アクティブな運行記録があるかチェック
    const activeOperations = await prisma.operation.count({
      where: {
        vehicleId: id,
        status: {
          in: ['PLANNING', 'IN_PROGRESS', 'STARTED']
        }
      }
    });

    if (activeOperations > 0) {
      throw new Error('この車両はアクティブな運行記録があるため削除できません');
    }

    return prisma.vehicle.update({
      where: { id },
      data: {
        isActive: false,
        status: VehicleStatus.OUT_OF_SERVICE,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 車両の走行距離更新
   */
  static async updateMileage(id: string, mileage: number): Promise<Vehicle> {
    const vehicle = await this.findById(id);
    if (!vehicle) {
      throw new Error('車両が見つかりません');
    }

    if (mileage < vehicle.currentMileage) {
      throw new Error('走行距離は現在の値より大きい必要があります');
    }

    return prisma.vehicle.update({
      where: { id },
      data: {
        currentMileage: mileage,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 車両ステータス更新
   */
  static async updateStatus(id: string, status: VehicleStatus): Promise<Vehicle> {
    return prisma.vehicle.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 最終運転手設定
   */
  static async setLastDriver(vehicleId: string, driverId: string): Promise<Vehicle> {
    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        lastDriverId: driverId,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 利用可能な車両一覧取得
   */
  static async findAvailable(): Promise<Vehicle[]> {
    return prisma.vehicle.findMany({
      where: {
        isActive: true,
        status: VehicleStatus.AVAILABLE
      },
      orderBy: { vehicleNumber: 'asc' },
      include: {
        lastDriver: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });
  }

  /**
   * 車両統計取得
   */
  static async getStatistics(vehicleId: string, startDate?: Date, endDate?: Date) {
    const vehicle = await this.findById(vehicleId);
    if (!vehicle) {
      throw new Error('車両が見つかりません');
    }

    const whereCondition: any = { vehicleId };
    
    if (startDate || endDate) {
      whereCondition.operationDate = {};
      if (startDate) whereCondition.operationDate.gte = startDate;
      if (endDate) whereCondition.operationDate.lte = endDate;
    }

    const [operations, maintenanceRecords] = await Promise.all([
      prisma.operation.findMany({
        where: whereCondition,
        include: {
          driver: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.maintenanceRecord.findMany({
        where: {
          vehicleId,
          ...(startDate || endDate ? {
            performedAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate })
            }
          } : {})
        }
      })
    ]);

    // 統計計算
    const totalOperations = operations.length;
    const totalMileage = operations.reduce((sum, op) => {
      if (op.endMileage && op.startMileage) {
        return sum + (op.endMileage - op.startMileage);
      }
      return sum;
    }, 0);

    const maintenanceCost = maintenanceRecords.reduce((sum, record) => {
      return sum + (record.cost || 0);
    }, 0);

    const avgMileagePerOperation = totalOperations > 0 ? totalMileage / totalOperations : 0;

    return {
      vehicle,
      statistics: {
        totalOperations,
        totalMileage,
        maintenanceCost,
        avgMileagePerOperation,
        maintenanceCount: maintenanceRecords.length,
        period: {
          startDate,
          endDate
        }
      },
      operations,
      maintenanceRecords
    };
  }

  /**
   * メンテナンス記録追加
   */
  static async addMaintenanceRecord(vehicleId: string, data: {
    maintenanceType: string;
    description?: string;
    cost?: number;
    mileage: number;
    performedAt: Date;
    nextDue?: Date;
  }): Promise<MaintenanceRecord> {
    const vehicle = await this.findById(vehicleId);
    if (!vehicle) {
      throw new Error('車両が見つかりません');
    }

    return prisma.maintenanceRecord.create({
      data: {
        vehicleId,
        maintenanceType: data.maintenanceType,
        description: data.description,
        cost: data.cost,
        mileage: data.mileage,
        performedAt: data.performedAt,
        nextDue: data.nextDue
      }
    });
  }

  /**
   * メンテナンス履歴取得
   */
  static async getMaintenanceHistory(vehicleId: string): Promise<MaintenanceRecord[]> {
    return prisma.maintenanceRecord.findMany({
      where: { vehicleId },
      orderBy: { performedAt: 'desc' }
    });
  }
}

export default VehicleModel;