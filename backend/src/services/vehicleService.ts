import { PrismaClient } from '@prisma/client';
import { 
  PaginationQuery,
  PaginatedResponse,
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleStatus,
  UserRole,
  Vehicle,
  VehicleWithDetails,
  VehicleStatistics,
  VehicleFuelAnalysis,
  BulkUpdateResult,
  VehicleUtilizationReportItem,
  AvailableVehicle,
  VehicleSearchResult,
  AddMaintenanceRecordRequest
} from '../types/vehicle';
import { AppError } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * 車両管理サービスクラス
 * 車両に関するすべての操作を管理
 */
export class VehicleService {
  /**
   * 車両一覧取得（ページネーション対応）
   * @param query ページネーションクエリ
   * @returns 車両一覧
   */
  async getVehicles(
    query: PaginationQuery & {
      search?: string;
      status?: VehicleStatus;
      model?: string;
      fuelType?: string;
      year?: number;
      manufacturer?: string;
    }
  ): Promise<PaginatedResponse<Vehicle & { lastDriverName?: string }>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      status,
      model,
      fuelType,
      year,
      manufacturer
    } = query;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    // 検索条件構築
    const where: any = {};

    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (model) {
      where.model = { contains: model, mode: 'insensitive' };
    }

    if (fuelType) {
      where.fuelType = fuelType;
    }

    if (year) {
      where.year = year;
    }

    if (manufacturer) {
      where.manufacturer = { contains: manufacturer, mode: 'insensitive' };
    }

    // 総件数取得
    const total = await prisma.vehicle.count({ where });

    // 車両取得（最後の運転手情報を含む）
    const vehicles = await prisma.vehicle.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder
      },
      include: {
        operations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            usersOperationsDriverIdTousers: {
              select: {
                id: true,
                name: true,
                username: true
              }
            }
          }
        },
        _count: {
          select: {
            operations: true
          }
        }
      }
    });

    const totalPages = Math.ceil(total / take);

    // レスポンス形式に変換
    const formattedVehicles = vehicles.map(vehicle => ({
      id: vehicle.id,
      plate_number: vehicle.plateNumber,
      model: vehicle.model,
      manufacturer: vehicle.manufacturer,
      year: vehicle.year,
      capacity: vehicle.capacityTons ? Number(vehicle.capacityTons) : null,
      fuelType: vehicle.fuelType,
      status: vehicle.status,
      last_maintenance_date: vehicle.inspectionExpiry,
      nextMaintenanceDate: vehicle.inspectionExpiry,
      assignedDriverId: null, // schema.camel.prismaには該当フィールドなし
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
      lastDriverName: vehicle.operations[0]?.usersOperationsDriverIdTousers?.name || undefined,
      tripCount: vehicle._count.operations
    }));

    return {
      data: formattedVehicles,
      total,
      page,
      limit: take,
      totalPages
    };
  }

  /**
   * 車両詳細取得
   * @param vehicleId 車両ID
   * @returns 車両情報
   */
  async getVehicleById(vehicleId: string): Promise<Vehicle & { 
    lastDriverName?: string; 
    recentTrips?: any[];
    maintenanceHistory?: any[];
    statistics?: any;
  }> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        operations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            operationNumber: true,
            actualStartTime: true,
            actualEndTime: true,
            status: true,
            totalDistanceKm: true,
            fuelConsumedLiters: true,
            fuelCostYen: true,
            usersOperationsDriverIdTousers: {
              select: {
                name: true,
                username: true
              }
            }
          }
        },
        maintenanceRecords: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            maintenanceType: true,
            scheduledDate: true,
            completedDate: true,
            cost: true,
            description: true,
            isCompleted: true,
            createdAt: true
          }
        }
      }
    });

    if (!vehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    // 統計情報を計算
    const statistics = await this.calculateVehicleStatistics(vehicleId);

    return {
      id: vehicle.id,
      plate_number: vehicle.plateNumber,
      model: vehicle.model,
      manufacturer: vehicle.manufacturer,
      year: vehicle.year,
      capacity: vehicle.capacityTons ? Number(vehicle.capacityTons) : null,
      fuelType: vehicle.fuelType,
      status: vehicle.status,
      last_maintenance_date: vehicle.inspectionExpiry,
      nextMaintenanceDate: vehicle.inspectionExpiry,
      assignedDriverId: null, // schema.camel.prismaには該当フィールドなし
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
      lastDriverName: vehicle.operations[0]?.usersOperationsDriverIdTousers?.name || undefined,
      recentTrips: vehicle.operations.map(op => ({
        id: op.id,
        tripNumber: op.operationNumber,
        startTime: op.actualStartTime,
        endTime: op.actualEndTime,
        status: op.status,
        distance: op.totalDistanceKm,
        fuelConsumed: op.fuelConsumedLiters,
        fuelCost: op.fuelCostYen,
        driverName: op.usersOperationsDriverIdTousers?.name
      })),
      maintenanceHistory: vehicle.maintenanceRecords.map(maintenance => ({
        id: maintenance.id,
        maintenanceType: maintenance.maintenanceType,
        scheduledDate: maintenance.scheduledDate,
        completedDate: maintenance.completedDate,
        cost: maintenance.cost,
        description: maintenance.description,
        isCompleted: maintenance.isCompleted,
        createdAt: maintenance.createdAt
      })),
      statistics
    };
  }

  /**
   * 車両作成
   * @param vehicleData 車両データ
   * @param creatorId 作成者ID
   * @returns 作成された車両
   */
  async createVehicle(vehicleData: CreateVehicleRequest, creatorId: string): Promise<Vehicle> {
    const { plate_number, model, manufacturer, year, capacity, fuelType } = vehicleData;

    // 車番重複チェック
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: plate_number }
    });

    if (existingVehicle) {
      throw new AppError('この車番は既に登録されています', 409);
    }

    // 車両作成
    const newVehicle = await prisma.vehicle.create({
      data: {
        plateNumber: plate_number,
        model,
        manufacturer,
        year,
        capacityTons: capacity ? capacity.toString() : null,
        fuelType: fuelType as any,
        status: 'ACTIVE'
      }
    });

    return {
      id: newVehicle.id,
      plate_number: newVehicle.plateNumber,
      model: newVehicle.model,
      manufacturer: newVehicle.manufacturer,
      year: newVehicle.year,
      capacity: newVehicle.capacityTons ? Number(newVehicle.capacityTons) : null,
      fuelType: newVehicle.fuelType,
      status: newVehicle.status,
      last_maintenance_date: newVehicle.inspectionExpiry,
      nextMaintenanceDate: newVehicle.inspectionExpiry,
      assignedDriverId: null,
      createdAt: newVehicle.createdAt,
      updatedAt: newVehicle.updatedAt
    };
  }

  /**
   * 車両情報更新
   * @param vehicleId 車両ID
   * @param updateData 更新データ
   * @returns 更新された車両
   */
  async updateVehicle(vehicleId: string, updateData: UpdateVehicleRequest): Promise<Vehicle> {
    // 車両存在確認
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!existingVehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    // 車番重複チェック（変更する場合）
    if (updateData.plate_number && updateData.plate_number !== existingVehicle.plateNumber) {
      const duplicateVehicle = await prisma.vehicle.findUnique({
        where: { plateNumber: updateData.plate_number }
      });

      if (duplicateVehicle) {
        throw new AppError('この車番は既に使用されています', 409);
      }
    }

    // 更新データ構築
    const updateFields: any = {};
    
    if (updateData.plate_number) updateFields.plateNumber = updateData.plate_number;
    if (updateData.model) updateFields.model = updateData.model;
    if (updateData.manufacturer !== undefined) updateFields.manufacturer = updateData.manufacturer;
    if (updateData.year !== undefined) updateFields.year = updateData.year;
    if (updateData.capacity !== undefined) {
      updateFields.capacityTons = updateData.capacity ? updateData.capacity.toString() : null;
    }
    if (updateData.fuelType) updateFields.fuelType = updateData.fuelType;
    if (updateData.status) updateFields.status = updateData.status;

    // 車両更新
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: updateFields
    });

    return {
      id: updatedVehicle.id,
      plate_number: updatedVehicle.plateNumber,
      model: updatedVehicle.model,
      manufacturer: updatedVehicle.manufacturer,
      year: updatedVehicle.year,
      capacity: updatedVehicle.capacityTons ? Number(updatedVehicle.capacityTons) : null,
      fuelType: updatedVehicle.fuelType,
      status: updatedVehicle.status,
      last_maintenance_date: updatedVehicle.inspectionExpiry,
      nextMaintenanceDate: updatedVehicle.inspectionExpiry,
      assignedDriverId: null,
      createdAt: updatedVehicle.createdAt,
      updatedAt: updatedVehicle.updatedAt
    };
  }

  /**
   * 車両削除（論理削除）
   * @param vehicleId 車両ID
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   */
  async deleteVehicle(
    vehicleId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<void> {
    // 管理者権限チェック
    if (requesterRole !== 'ADMIN') {
      throw new AppError('車両の削除は管理者権限が必要です', 403);
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        operations: {
          where: {
            status: {
              in: ['PLANNING', 'IN_PROGRESS']
            }
          }
        }
      }
    });

    if (!vehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    // アクティブな運行記録がある場合は削除不可
    if (vehicle.operations.length > 0) {
      throw new AppError('進行中の運行記録があるため、この車両を削除できません', 400);
    }

    // 車両を使用停止状態に更新（論理削除）
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { 
        status: 'RETIRED'
      }
    });
  }

  /**
   * 車両ステータス更新
   * @param vehicleId 車両ID
   * @param status 新しい状態
   * @param driverId 運転手ID（使用中の場合）
   * @returns 更新された車両
   */
  async updateVehicleStatus(
    vehicleId: string, 
    status: VehicleStatus, 
    driverId?: string
  ): Promise<Vehicle> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    // 使用中の場合は運転手IDを設定する機能は現在のスキーマでは未実装
    // 将来的に assignedDriverId フィールドが追加された場合に実装予定
    const updateData: any = { status };

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: updateData
    });

    return {
      id: updatedVehicle.id,
      plate_number: updatedVehicle.plateNumber,
      model: updatedVehicle.model,
      manufacturer: updatedVehicle.manufacturer,
      year: updatedVehicle.year,
      capacity: updatedVehicle.capacityTons ? Number(updatedVehicle.capacityTons) : null,
      fuelType: updatedVehicle.fuelType,
      status: updatedVehicle.status,
      last_maintenance_date: updatedVehicle.inspectionExpiry,
      nextMaintenanceDate: updatedVehicle.inspectionExpiry,
      assignedDriverId: null,
      createdAt: updatedVehicle.createdAt,
      updatedAt: updatedVehicle.updatedAt
    };
  }

  /**
   * 利用可能な車両一覧取得
   * @returns 利用可能な車両一覧
   */
  async getAvailableVehicles(): Promise<Array<AvailableVehicle>> {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: 'ACTIVE'
      },
      select: {
        id: true,
        plateNumber: true,
        model: true,
        manufacturer: true,
        capacityTons: true,
        fuelType: true
      },
      orderBy: {
        plateNumber: 'asc'
      }
    });

    return vehicles.map(v => ({
      id: v.id,
      plate_number: v.plateNumber,
      model: v.model,
      manufacturer: v.manufacturer || '',
      capacity: v.capacityTons ? Number(v.capacityTons) : 0,
      fuelType: v.fuelType || ''
    }));
  }

  /**
   * 車両の統計情報取得
   * @param vehicleId 車両ID
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 統計情報
   */
  async getVehicleStats(vehicleId: string, startDate?: string, endDate?: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    return await this.calculateVehicleStatistics(vehicleId, startDate, endDate);
  }

  /**
   * 車両統計の計算（内部メソッド）
   * @param vehicleId 車両ID
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 統計情報
   */
  private async calculateVehicleStatistics(vehicleId: string, startDate?: string, endDate?: string) {
    const whereCondition: any = { vehicleId };

    if (startDate || endDate) {
      whereCondition.actualStartTime = {};
      if (startDate) whereCondition.actualStartTime.gte = new Date(startDate);
      if (endDate) whereCondition.actualStartTime.lte = new Date(endDate);
    }

    const [
      vehicle,
      totalTrips,
      completedTrips,
      totalDistance,
      totalFuelCost,
      totalFuelConsumed,
      averageTripDistance,
      averageFuelCost,
      maintenanceCount
    ] = await Promise.all([
      prisma.vehicle.findUnique({ where: { id: vehicleId } }),
      // 総運行回数
      prisma.operation.count({
        where: whereCondition
      }),
      
      // 完了した運行回数
      prisma.operation.count({
        where: { ...whereCondition, status: 'COMPLETED' }
      }),
      
      // 総走行距離
      prisma.operation.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _sum: { totalDistanceKm: true }
      }).then(result => result._sum.totalDistanceKm || 0),
      
      // 総給油費用
      prisma.operation.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _sum: { fuelCostYen: true }
      }).then(result => result._sum.fuelCostYen || 0),

      // 総燃料消費量
      prisma.operation.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _sum: { fuelConsumedLiters: true }
      }).then(result => result._sum.fuelConsumedLiters || 0),
      
      // 平均運行距離
      prisma.operation.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _avg: { totalDistanceKm: true }
      }).then(result => result._avg.totalDistanceKm || 0),

      // 平均燃料費
      prisma.operation.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _avg: { fuelCostYen: true }
      }).then(result => result._avg.fuelCostYen || 0),

      // メンテナンス回数
      prisma.maintenanceRecord.count({
        where: { 
          vehicleId,
          ...(startDate || endDate ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) })
            }
          } : {})
        }
      })
    ]);

    // 燃費計算
    const fuelEfficiency = Number(totalFuelConsumed) > 0 ? Number(totalDistance) / Number(totalFuelConsumed) : 0;
    
    // 平均給油コスト（1kmあたり）
    const averageFuelCostPerKm = Number(totalDistance) > 0 ? Number(totalFuelCost) / Number(totalDistance) : 0;

    // 稼働率計算（期間中の運行日数）
    const periodDays = startDate && endDate ? 
      Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : 
      365; // デフォルト1年
    const operationDays = await prisma.operation.groupBy({
      by: ['vehicleId'],
      where: whereCondition,
      _count: {
        id: true
      }
    });
    const utilizationRate = operationDays.length > 0 ? (operationDays[0]._count.id / periodDays * 100) : 0;

    return {
      vehicleInfo: {
        plate_number: vehicle?.plateNumber,
        model: vehicle?.model,
        manufacturer: vehicle?.manufacturer,
        year: vehicle?.year,
        status: vehicle?.status,
        fuelType: vehicle?.fuelType,
        capacity: vehicle?.capacityTons ? Number(vehicle.capacityTons) : null
      },
      statistics: {
        totalTrips,
        completedTrips,
        totalDistance: Number(totalDistance.toFixed(2)),
        totalFuelCost: Number(totalFuelCost.toFixed(0)),
        totalFuelConsumed: Number(totalFuelConsumed.toFixed(2)),
        averageTripDistance: Number(averageTripDistance.toFixed(2)),
        averageFuelCost: Number(averageFuelCost.toFixed(0)),
        fuelEfficiency: Number(fuelEfficiency.toFixed(2)),
        averageFuelCostPerKm: Number(averageFuelCostPerKm.toFixed(2)),
        utilizationRate: Number(utilizationRate.toFixed(1)),
        maintenanceCount,
        completionRate: totalTrips > 0 ? (completedTrips / totalTrips * 100).toFixed(1) : '0'
      }
    };
  }

  /**
   * 車両タイプ一覧取得
   * @returns 車両タイプ一覧
   */
  async getVehicleTypes(): Promise<string[]> {
    const result = await prisma.vehicle.findMany({
      select: { model: true },
      distinct: ['model'],
      orderBy: { model: 'asc' }
    });

    return result.map(v => v.model);
  }

  /**
   * 車両メーカー一覧取得
   * @returns 車両メーカー一覧
   */
  async getVehicleManufacturers(): Promise<string[]> {
    const result = await prisma.vehicle.findMany({
      select: { manufacturer: true },
      distinct: ['manufacturer'],
      orderBy: { manufacturer: 'asc' }
    });

    return result.map(v => v.manufacturer).filter(Boolean) as string[];
  }

  /**
   * 車両の運行履歴取得
   * @param vehicleId 車両ID
   * @param limit 取得件数
   * @returns 運行履歴
   */
  async getVehicleTrips(vehicleId: string, limit: number = 20) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    return await prisma.operation.findMany({
      where: { vehicleId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        usersOperationsDriverIdTousers: {
          select: {
            name: true,
            username: true
          }
        },
        operationDetails: {
          include: {
            locations: {
              select: {
                name: true,
                address: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * 車両検索（オートコンプリート用）
   * @param query 検索クエリ
   * @param limit 取得件数
   * @returns 車両一覧
   */
  async searchVehicles(query: string, limit: number = 10): Promise<VehicleSearchResult[]> {
    if (!query || query.length < 1) {
      return [];
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { plateNumber: { contains: query, mode: 'insensitive' } },
          { model: { contains: query, mode: 'insensitive' } },
          { manufacturer: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        plateNumber: true,
        model: true,
        manufacturer: true,
        status: true,
        fuelType: true
      },
      take: limit,
      orderBy: {
        plateNumber: 'asc'
      }
    });

    return vehicles.map(v => ({
      id: v.id,
      plate_number: v.plateNumber,
      model: v.model,
      manufacturer: v.manufacturer,
      status: v.status,
      fuelType: v.fuelType
    }));
  }

  /**
   * メンテナンス記録追加
   * @param vehicleId 車両ID
   * @param maintenanceData メンテナンスデータ
   * @param inspectorId 点検者ID
   * @returns 作成されたメンテナンス記録
   */
  async addMaintenanceRecord(
    vehicleId: string, 
    maintenanceData: AddMaintenanceRecordRequest,
    inspectorId: string
  ) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    // 点検者の存在確認
    const inspector = await prisma.user.findUnique({
      where: { id: inspectorId }
    });

    if (!inspector) {
      throw new AppError('点検者が見つかりません', 404);
    }

    // メンテナンス記録を作成
    const maintenanceRecord = await prisma.maintenanceRecord.create({
      data: {
        vehicleId,
        maintenanceType: maintenanceData.inspectionType as any,
        scheduledDate: new Date(),
        description: maintenanceData.notes,
        isCompleted: maintenanceData.status === 'PASS',
        createdBy: inspectorId
      }
    });

    // 車両の次回メンテナンス日を更新
    if (maintenanceData.nextDue) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          inspectionExpiry: maintenanceData.nextDue
        }
      });
    }

    return maintenanceRecord;
  }

  /**
   * メンテナンス履歴取得
   * @param vehicleId 車両ID
   * @param limit 取得件数
   * @returns メンテナンス履歴
   */
  async getMaintenanceHistory(vehicleId: string, limit: number = 20) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    return await prisma.maintenanceRecord.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        users: {
          select: {
            name: true,
            username: true
          }
        }
      }
    });
  }

  /**
   * 車両ステータス一括更新
   * @param vehicleIds 車両ID配列
   * @param status 新しいステータス
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   */
  async bulkUpdateVehicleStatus(
    vehicleIds: string[],
    status: VehicleStatus,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<BulkUpdateResult> {
    // 管理者権限チェック
    if (requesterRole !== 'ADMIN') {
      throw new AppError('車両ステータスの一括更新は管理者権限が必要です', 403);
    }

    if (!vehicleIds || vehicleIds.length === 0) {
      throw new AppError('更新対象の車両が指定されていません', 400);
    }

    // 使用中から他のステータスに変更する場合は、アクティブなトリップがないかチェック
    if (status !== 'ACTIVE') {
      const activeTrips = await prisma.operation.findMany({
        where: {
          vehicleId: { in: vehicleIds },
          status: { in: ['PLANNING', 'IN_PROGRESS'] }
        }
      });

      if (activeTrips.length > 0) {
        throw new AppError('進行中の運行記録がある車両は状態を変更できません', 400);
      }
    }

    const updateResult = await prisma.vehicle.updateMany({
      where: {
        id: { in: vehicleIds }
      },
      data: {
        status
      }
    });

    return {
      updatedCount: updateResult.count,
      message: `${updateResult.count}台の車両のステータスを${status}に更新しました`
    };
  }

  /**
   * 車両の燃費分析
   * @param vehicleId 車両ID
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 燃費分析データ
   */
  async getVehicleFuelAnalysis(vehicleId: string, startDate?: string, endDate?: string): Promise<VehicleFuelAnalysis> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new AppError('車両が見つかりません', 404);
    }

    const whereCondition: any = { 
      vehicleId,
      status: 'COMPLETED',
      fuelConsumedLiters: { not: null },
      totalDistanceKm: { not: null, gt: 0 }
    };

    if (startDate || endDate) {
      whereCondition.actualStartTime = {};
      if (startDate) whereCondition.actualStartTime.gte = new Date(startDate);
      if (endDate) whereCondition.actualStartTime.lte = new Date(endDate);
    }

    const trips = await prisma.operation.findMany({
      where: whereCondition,
      select: {
        actualStartTime: true,
        totalDistanceKm: true,
        fuelConsumedLiters: true,
        fuelCostYen: true
      },
      orderBy: { actualStartTime: 'asc' }
    });

    // 月別燃費データ
    const monthlyData = trips.reduce((acc, trip) => {
      if (!trip.actualStartTime) return acc;
      
      const month = trip.actualStartTime.toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { totalDistance: 0, totalFuel: 0, totalCost: 0, tripCount: 0 };
      }
      acc[month].totalDistance += Number(trip.totalDistanceKm) || 0;
      acc[month].totalFuel += Number(trip.fuelConsumedLiters) || 0;
      acc[month].totalCost += Number(trip.fuelCostYen) || 0;
      acc[month].tripCount += 1;
      return acc;
    }, {} as any);

    const monthlyAnalysis = Object.entries(monthlyData).map(([month, data]: [string, any]) => ({
      month,
      averageFuelEfficiency: data.totalFuel > 0 ? (data.totalDistance / data.totalFuel).toFixed(2) : '0',
      totalDistance: data.totalDistance.toFixed(2),
      totalFuelConsumed: data.totalFuel.toFixed(2),
      totalFuelCost: data.totalCost.toFixed(0),
      averageCostPerKm: data.totalDistance > 0 ? (data.totalCost / data.totalDistance).toFixed(2) : '0',
      tripCount: data.tripCount
    }));

    // 全体統計
    const totalDistance = trips.reduce((sum, trip) => sum + (Number(trip.totalDistanceKm) || 0), 0);
    const totalFuel = trips.reduce((sum, trip) => sum + (Number(trip.fuelConsumedLiters) || 0), 0);
    const totalCost = trips.reduce((sum, trip) => sum + (Number(trip.fuelCostYen) || 0), 0);

    return {
      vehicleInfo: {
        plate_number: vehicle.plateNumber,
        model: vehicle.model,
        manufacturer: vehicle.manufacturer || ''
      },
      overallStatistics: {
        totalTrips: trips.length,
        totalDistance: totalDistance.toFixed(2),
        totalFuelConsumed: totalFuel.toFixed(2),
        totalFuelCost: totalCost.toFixed(0),
        averageFuelEfficiency: totalFuel > 0 ? (totalDistance / totalFuel).toFixed(2) : '0',
        averageCostPerKm: totalDistance > 0 ? (totalCost / totalDistance).toFixed(2) : '0'
      },
      monthlyAnalysis
    };
  }

  /**
   * メンテナンス予定車両取得
   * @param daysAhead 何日後まで
   * @returns メンテナンス予定車両一覧
   */
  async getVehiclesDueForMaintenance(daysAhead: number = 30) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);

    return await prisma.vehicle.findMany({
      where: {
        inspectionExpiry: {
          lte: targetDate
        },
        status: {
          not: 'RETIRED'
        }
      },
      include: {
        operations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            usersOperationsDriverIdTousers: {
              select: {
                name: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: {
        inspectionExpiry: 'asc'
      }
    });
  }

  /**
   * 車両利用率レポート
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 利用率レポート
   */
  async getVehicleUtilizationReport(startDate?: string, endDate?: string): Promise<VehicleUtilizationReportItem[]> {
    const whereCondition: any = {};

    if (startDate || endDate) {
      whereCondition.actualStartTime = {};
      if (startDate) whereCondition.actualStartTime.gte = new Date(startDate);
      if (endDate) whereCondition.actualStartTime.lte = new Date(endDate);
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: {
          not: 'RETIRED'
        }
      },
      include: {
        operations: {
          where: whereCondition,
          select: {
            actualStartTime: true,
            actualEndTime: true,
            status: true
          }
        },
        _count: {
          select: {
            operations: {
              where: whereCondition
            }
          }
        }
      }
    });

    return vehicles.map(vehicle => {
      const completedTrips = vehicle.operations.filter(trip => trip.status === 'COMPLETED');
      const totalDays = startDate && endDate ? 
        Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : 
        30; // デフォルト30日

      return {
        vehicleId: vehicle.id,
        plate_number: vehicle.plateNumber,
        model: vehicle.model,
        status: vehicle.status || undefined,
        totalTrips: vehicle._count.operations,
        completedTrips: completedTrips.length,
        utilizationRate: totalDays > 0 ? ((completedTrips.length / totalDays) * 100).toFixed(1) : '0',
        lastTripDate: completedTrips.length > 0 ? 
          completedTrips[completedTrips.length - 1].actualStartTime : null
      };
    });
  }
}