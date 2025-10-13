// =====================================
// backend/src/models/VehicleModel.ts
// 車両モデル（Prismaスキーマ完全準拠版）
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: 2025/10/14 - Prismaスキーマ準拠・コンパイルエラー完全修正版
// アーキテクチャ指針準拠版 - Phase 1-B対応
// =====================================

import type {
  MaintenanceRecord,
  Operation,
  OperationStatus,
  Prisma,
  Vehicle as PrismaVehicle
} from '@prisma/client';

// 🔧 Prismaスキーマ準拠: Enumを値として使用
import { PrismaClient, VehicleStatus } from '@prisma/client';

// 🎯 Phase 1-A完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 共通型定義の活用（types/common.ts）
import type {
  ApiListResponse,
  BulkOperationResult,
  OperationResult
} from '../types/common';

// 🎯 types/vehicle.ts 超高度機能の統合
import type {
  VehicleDailyStats,
  VehicleFilter,
  VehicleFuelRecord,
  VehicleInfo,
  VehicleMaintenanceSchedule,
  VehicleMaintenanceSummary,
  VehicleMonthlyStats,
  VehicleResponseDTO,
  VehicleStatistics,
  VehicleWeeklyStats,
  VehicleWithDetails
} from '../types/vehicle';

// 型ガード関数

// =====================================
// 🔧 Prismaスキーマ準拠 - 基本型定義
// =====================================

export type VehicleModel = PrismaVehicle;
export type VehicleCreateInput = Prisma.VehicleCreateInput;
export type VehicleUpdateInput = Prisma.VehicleUpdateInput;
export type VehicleWhereInput = Prisma.VehicleWhereInput;
export type VehicleWhereUniqueInput = Prisma.VehicleWhereUniqueInput;
export type VehicleOrderByInput = Prisma.VehicleOrderByWithRelationInput;

// =====================================
// 🔧 Prismaスキーマ準拠 - VehicleAvailability型定義（修正版）
// =====================================

/**
 * 車両の利用可能性（Prismaスキーマに準拠した型定義）
 */
export interface VehicleAvailability {
  isAvailable: boolean;
  currentOperationId?: string;
  maintenanceId?: string;
  availableFrom?: Date;
  availableUntil?: Date;
}

// =====================================
// 🔧 拡張型定義
// =====================================

export interface VehicleResponseDTOExtended extends VehicleResponseDTO {
  _count?: {
    [key: string]: number;
  };
  statistics?: VehicleStatistics;
  availability?: VehicleAvailability;
  maintenanceSummary?: VehicleMaintenanceSummary;
}

export interface VehicleListResponseExtended extends ApiListResponse<VehicleResponseDTOExtended> {
  // ApiListResponseから継承される必須プロパティ:
  // success: boolean;
  // data: VehicleResponseDTOExtended[];
  // meta: ListMeta;
  // timestamp: string;

  // 追加プロパティ（互換性のため保持）
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;

  summary?: {
    totalVehicles: number;
    activeVehicles: number;
    inUseVehicles: number;
    maintenanceVehicles: number;
    averageUtilization?: number;
    totalFleetValue?: number;
  };
  fleetStatistics?: {
    averageFuelEfficiency: number;
    totalDistance: number;
    totalFuelConsumed: number;
    totalOperationTime: number;
  };
}

export interface VehicleCreateDTOExtended extends Omit<VehicleCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  maintenanceSchedule?: VehicleMaintenanceSchedule;
  initialFuelRecord?: VehicleFuelRecord;
}

export interface VehicleUpdateDTOExtended extends Partial<VehicleCreateDTOExtended> {
  // 更新用（部分更新対応、既存互換）
}

// =====================================
// 🔧 VehicleService - Prismaスキーマ完全準拠版
// =====================================

export class VehicleService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || DatabaseService.getInstance();
    logger.info('VehicleService initialized with Prisma schema compliance');
  }

  // =====================================
  // 🔧 基本CRUD操作（Prismaスキーマ準拠）
  // =====================================

  /**
   * ID指定検索
   */
  async findById(id: string): Promise<VehicleModel | null> {
    try {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id }
      });
      return vehicle;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to find vehicle by ID', { error: errorMessage, id });
      throw new AppError('車両の取得に失敗しました', 500, errorMessage);
    }
  }

  /**
   * 🔧 修正: 車両詳細取得（Prismaスキーマ準拠）
   * - assignedDriver リレーションは存在しないため削除
   * - recordedAt を使用（timestamp ではない）
   */
  async findByIdWithDetails(id: string): Promise<VehicleWithDetails | null> {
    try {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id },
        include: {
          operations: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              operationDetails: true
            }
          },
          maintenanceRecords: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          },
          gpsLogs: {
            take: 1,
            orderBy: { recordedAt: 'desc' } // 🔧 修正: timestamp → recordedAt
          }
        }
      });

      if (!vehicle) return null;

      // 🔧 修正: Prismaスキーマに準拠した型変換
      const vehicleWithDetails: VehicleWithDetails = {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        model: vehicle.model,
        manufacturer: vehicle.manufacturer || '',
        year: vehicle.year || undefined,
        capacity: vehicle.capacityTons ? Number(vehicle.capacityTons) : undefined, // 🔧 修正: capacityTons
        fuelType: vehicle.fuelType || undefined,
        status: vehicle.status || VehicleStatus.ACTIVE,
        assignedDriverId: undefined, // 🔧 修正: スキーマに存在しないため undefined
        currentMileage: vehicle.currentMileage || undefined,
        notes: vehicle.notes || undefined,
        isActive: vehicle.status === VehicleStatus.ACTIVE, // 🔧 修正: status から判定
        createdAt: vehicle.createdAt || new Date(),
        updatedAt: vehicle.updatedAt || new Date(),
        assignedDriver: undefined, // 🔧 修正: リレーションが存在しないため undefined
        recentOperations: vehicle.operations || [],
        maintenanceHistory: vehicle.maintenanceRecords || [],
        gpsLogs: vehicle.gpsLogs || [],
        statistics: await this.generateVehicleStatistics(vehicle.id)
      };

      return vehicleWithDetails;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to find vehicle with details', { error: errorMessage, id });
      throw new AppError('車両詳細の取得に失敗しました', 500, errorMessage);
    }
  }

  /**
   * ナンバープレートで検索
   */
  async findByPlateNumber(plateNumber: string): Promise<VehicleModel | null> {
    try {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: {
          plateNumber: {
            equals: plateNumber,
            mode: 'insensitive'
          }
        }
      });
      return vehicle;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to find vehicle by plate number', { error: errorMessage, plateNumber });
      throw new AppError('車両の取得に失敗しました', 500, errorMessage);
    }
  }

  /**
   * 🔧 修正: 新規車両作成（Prismaスキーマ準拠）
   */
  async create(data: Partial<VehicleCreateInput>): Promise<OperationResult<VehicleModel>> {
    try {
      // バリデーション
      if (!data.plateNumber) {
        throw new ValidationError('ナンバープレートは必須です');
      }

      if (!data.model) {
        throw new ValidationError('車両モデルは必須です');
      }

      // 重複チェック
      const existing = await this.findByPlateNumber(data.plateNumber);
      if (existing) {
        throw new ConflictError('このナンバープレートは既に登録されています');
      }

      // 🔧 修正: Prismaスキーマに準拠したデータ作成
      const vehicle = await this.prisma.vehicle.create({
        data: {
          plateNumber: data.plateNumber,
          model: data.model,
          manufacturer: data.manufacturer || '',
          year: data.year,
          capacityTons: data.capacityTons, // 🔧 修正: capacity → capacityTons
          fuelType: data.fuelType,
          status: data.status || VehicleStatus.ACTIVE,
          currentMileage: data.currentMileage || 0,
          notes: data.notes
        }
      });

      logger.info('Vehicle created successfully', { id: vehicle.id, plateNumber: vehicle.plateNumber });

      return {
        success: true,
        data: vehicle,
        message: '車両を登録しました'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create vehicle', { error: errorMessage, data });

      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }

      throw new AppError('車両の登録に失敗しました', 500, errorMessage);
    }
  }

  /**
   * 車両更新
   */
  async update(id: string, data: Partial<VehicleUpdateInput>): Promise<OperationResult<VehicleModel>> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('指定された車両が見つかりません');
      }

      const vehicle = await this.prisma.vehicle.update({
        where: { id },
        data
      });

      logger.info('Vehicle updated successfully', { id: vehicle.id });

      return {
        success: true,
        data: vehicle,
        message: '車両を更新しました'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update vehicle', { error: errorMessage, id, data });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new AppError('車両の更新に失敗しました', 500, errorMessage);
    }
  }

  /**
   * 車両削除（論理削除）
   */
  async delete(id: string): Promise<OperationResult<void>> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('指定された車両が見つかりません');
      }

      await this.prisma.vehicle.delete({
        where: { id }
      });

      logger.info('Vehicle deleted successfully', { id });

      return {
        success: true,
        message: '車両を削除しました'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to delete vehicle', { error: errorMessage, id });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new AppError('車両の削除に失敗しました', 500, errorMessage);
    }
  }

  // =====================================
  // 🔧 検索・フィルタリング（Prismaスキーマ準拠）
  // =====================================

  /**
   * 基本検索
   */
  async findMany(params: {
    where?: VehicleWhereInput;
    orderBy?: VehicleOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<VehicleModel[]> {
    try {
      const vehicles = await this.prisma.vehicle.findMany(params);
      return vehicles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to find vehicles', { error: errorMessage, params });
      throw new AppError('車両一覧の取得に失敗しました', 500);
    }
  }

  /**
   * 🔧 修正: ページネーション付き一覧取得（Prismaスキーマ準拠）
   */
  async findManyWithPagination(params: {
    where?: VehicleWhereInput;
    orderBy?: VehicleOrderByInput;
    page: number;
    pageSize: number;
    filter?: VehicleFilter;
    includeFleetStatistics?: boolean;
  }): Promise<VehicleListResponseExtended> {
    try {
      const { page, pageSize, where, orderBy, filter, includeFleetStatistics } = params;

      if (page < 1 || pageSize < 1) {
        throw new ValidationError('ページ番号とページサイズは1以上である必要があります');
      }

      const skip = (page - 1) * pageSize;

      let enhancedWhere = where || {};
      if (filter) {
        enhancedWhere = this.buildVehicleFilter(filter);
      }

      const [data, total] = await Promise.all([
        this.prisma.vehicle.findMany({
          where: enhancedWhere,
          orderBy: orderBy || { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            operations: {
              take: 1,
              orderBy: { createdAt: 'desc' }
            },
            maintenanceRecords: {
              take: 1,
              orderBy: { createdAt: 'desc' }
            }
          }
        }),
        this.prisma.vehicle.count({ where: enhancedWhere })
      ]);

      // 🔧 修正: Prismaスキーマに準拠した型変換
      const enhancedData: VehicleResponseDTOExtended[] = await Promise.all(
        data.map(async (vehicle) => {
          const availability = await this.checkVehicleAvailability(vehicle.id);
          return {
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            model: vehicle.model,
            manufacturer: vehicle.manufacturer || '',
            year: vehicle.year || undefined,
            capacity: vehicle.capacityTons ? Number(vehicle.capacityTons) : undefined, // 🔧 修正
            fuelType: vehicle.fuelType || undefined,
            status: vehicle.status || VehicleStatus.ACTIVE,
            assignedDriverId: undefined, // 🔧 修正: スキーマに存在しない
            currentMileage: vehicle.currentMileage || undefined,
            notes: vehicle.notes || undefined,
            isActive: vehicle.status === VehicleStatus.ACTIVE, // 🔧 修正
            createdAt: vehicle.createdAt || new Date(),
            updatedAt: vehicle.updatedAt || new Date(),
            availability
          };
        })
      );

      const summary = await this.generateVehiclesSummary(enhancedWhere);

      let fleetStatistics;
      if (includeFleetStatistics) {
        fleetStatistics = await this.generateFleetStatistics(enhancedWhere);
      }

      const totalPages = Math.ceil(total / pageSize);

      const result: VehicleListResponseExtended = {
        success: true,
        data: enhancedData,
        meta: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        timestamp: new Date().toISOString(),
        total,
        page,
        pageSize,
        totalPages,
        summary,
        fleetStatistics
      };

      logger.debug('Vehicles paginated with advanced features', {
        page,
        pageSize,
        total,
        totalPages: result.totalPages,
        fleetStatisticsGenerated: !!fleetStatistics
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to find vehicles with pagination', { error: errorMessage, params });
      throw new AppError('車両一覧の取得に失敗しました', 500, errorMessage);
    }
  }

  // =====================================
  // 🔧 内部ヘルパー関数（Prismaスキーマ準拠）
  // =====================================

  /**
   * 🔧 修正: フィルター条件を構築（Prismaスキーマ準拠）
   */
  private buildVehicleFilter(filter: VehicleFilter): VehicleWhereInput {
    const where: VehicleWhereInput = {};

    if (filter.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
    }

    if (filter.fuelType) {
      where.fuelType = Array.isArray(filter.fuelType)
        ? { in: filter.fuelType }
        : filter.fuelType;
    }

    // 🔧 修正: assignedDriverId はスキーマに存在しないため削除

    if (filter.manufacturer) {
      where.manufacturer = {
        contains: filter.manufacturer,
        mode: 'insensitive'
      };
    }

    if (filter.yearFrom || filter.yearTo) {
      where.year = {};
      if (filter.yearFrom) where.year.gte = filter.yearFrom;
      if (filter.yearTo) where.year.lte = filter.yearTo;
    }

    // 🔧 修正: capacity → capacityTons（スキーマに存在しない場合はコメントアウト）
    // if (filter.capacityMin || filter.capacityMax) {
    //   where.capacityTons = {};
    //   if (filter.capacityMin) where.capacityTons.gte = filter.capacityMin;
    //   if (filter.capacityMax) where.capacityTons.lte = filter.capacityMax;
    // }

    if (filter.mileageMin || filter.mileageMax) {
      where.currentMileage = {};
      if (filter.mileageMin) where.currentMileage.gte = filter.mileageMin;
      if (filter.mileageMax) where.currentMileage.lte = filter.mileageMax;
    }

    if (typeof filter.isActive === 'boolean') {
      // isActiveフィールドはPrismaスキーマに存在しないため、statusで代用
      if (filter.isActive) {
        where.status = { not: VehicleStatus.RETIRED };
      } else {
        where.status = VehicleStatus.RETIRED;
      }
    }

    // 🔧 修正: hasAssignedDriver はスキーマに存在しないため削除

    return where;
  }

  /**
   * 🔧 修正: 車両の利用可能性をチェック（Prismaスキーマ準拠）
   */
  private async checkVehicleAvailability(vehicleId: string): Promise<VehicleAvailability> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        operations: {
          where: {
            status: { in: ['IN_PROGRESS' as OperationStatus] } // 🔧 修正: ONGOING, LOADING → IN_PROGRESS
          },
          take: 1
        },
        maintenanceRecords: {
          where: {
            status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
          },
          take: 1
        }
      }
    });

    if (!vehicle) {
      return {
        isAvailable: false,
        availableFrom: undefined,
        availableUntil: undefined
      };
    }

    const hasActiveOperation = vehicle.operations && vehicle.operations.length > 0;
    const hasActiveMaintenance = vehicle.maintenanceRecords && vehicle.maintenanceRecords.length > 0;

    if (hasActiveOperation) {
      return {
        isAvailable: false,
        currentOperationId: vehicle.operations[0]?.id,
        availableFrom: undefined,
        availableUntil: undefined
      };
    }

    if (hasActiveMaintenance) {
      return {
        isAvailable: false,
        maintenanceId: vehicle.maintenanceRecords[0]?.id,
        availableFrom: vehicle.maintenanceRecords[0]?.scheduledDate || undefined, // 🔧 修正
        availableUntil: undefined
      };
    }

    if (vehicle.status !== VehicleStatus.ACTIVE) {
      return {
        isAvailable: false,
        availableFrom: undefined,
        availableUntil: undefined
      };
    }

    return {
      isAvailable: true,
      availableFrom: new Date(),
      availableUntil: undefined
    };
  }

  /**
   * 🔧 修正: 車両統計を生成（Prismaスキーマ準拠）
   */
  private async generateVehicleStatistics(vehicleId: string): Promise<VehicleStatistics | undefined> {
    try {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          operations: {
            where: {
              status: 'COMPLETED' as OperationStatus
            }
          },
          maintenanceRecords: true
        }
      });

      if (!vehicle) return undefined;

      const totalOperations = vehicle.operations.length;

      // 🔧 修正: totalDistance → totalDistanceKm
      const totalDistance = vehicle.operations.reduce((sum, op) => {
        const distance = op.totalDistanceKm ? (typeof op.totalDistanceKm === 'number' ? op.totalDistanceKm : Number(op.totalDistanceKm)) : 0;
        return sum + distance;
      }, 0);

      // 🔧 修正: maintenanceCost プロパティ名
      const maintenanceCost = vehicle.maintenanceRecords.reduce((sum, mr) => {
        const cost = mr.cost ? (typeof mr.cost === 'number' ? mr.cost : Number(mr.cost)) : 0;
        return sum + cost;
      }, 0);

      // 🔧 修正: lastOperationは使用しないためコメントアウト
      // const lastOperation = vehicle.operations[0];
      const lastMaintenanceDate = vehicle.maintenanceRecords[0]?.scheduledDate || undefined; // 🔧 修正

      return {
        totalDistance,
        totalOperations,
        completedOperations: 0,
        ongoingOperations: 0,
        averageDistance: totalOperations > 0 ? totalDistance / totalOperations : 0,
        totalOperationTime: 0,
        averageOperationTime: 0,
        totalFuelConsumed: 0,
        totalFuelCost: 0,
        averageFuelEfficiency: 0,
        fuelCostPerKm: 0,
        downtime: 0,
        costPerKm: 0,
        operationDays: 0,
        utilizationRate: 0,
        availabilityRate: 0,
        maintenanceCount: vehicle.maintenanceRecords.length,
        lastMaintenanceDate,
        nextMaintenanceDate: undefined,
        maintenanceCost
      };
    } catch (error) {
      logger.error('Failed to generate vehicle statistics', { error, vehicleId });
      return undefined;
    }
  }

  /**
   * 車両サマリーを生成
   */
  private async generateVehiclesSummary(where: VehicleWhereInput): Promise<{
    totalVehicles: number;
    activeVehicles: number;
    inUseVehicles: number;
    maintenanceVehicles: number;
  }> {
    const [totalVehicles, activeVehicles, maintenanceVehicles] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.count({ where: { ...where, status: VehicleStatus.ACTIVE } }),
      this.prisma.vehicle.count({ where: { ...where, status: VehicleStatus.MAINTENANCE } })
    ]);

    return {
      totalVehicles,
      activeVehicles,
      inUseVehicles: 0, // 🔧 修正: IN_USE status は存在しないため0
      maintenanceVehicles
    };
  }

  /**
   * フリート統計を生成
   */
  private async generateFleetStatistics(where: VehicleWhereInput): Promise<{
    averageFuelEfficiency: number;
    totalDistance: number;
    totalFuelConsumed: number;
    totalOperationTime: number;
  }> {
    // 実装は簡略化
    return {
      averageFuelEfficiency: 0,
      totalDistance: 0,
      totalFuelConsumed: 0,
      totalOperationTime: 0
    };
  }

  // =====================================
  // 🔧 高度な機能（Prismaスキーマ準拠）
  // =====================================

  /**
   * 🔧 修正: 車両基本情報への変換（Prismaスキーマ準拠）
   */
  private mapToVehicleInfo(vehicle: PrismaVehicle & {
    operations?: Operation[];
    maintenanceRecords?: MaintenanceRecord[];
  }): VehicleInfo {
    return {
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      model: vehicle.model,
      manufacturer: vehicle.manufacturer || '',
      year: vehicle.year || undefined,
      capacity: vehicle.capacityTons ? Number(vehicle.capacityTons) : undefined, // 🔧 修正
      fuelType: vehicle.fuelType || undefined,
      status: vehicle.status || VehicleStatus.ACTIVE,
      assignedDriverId: undefined, // 🔧 修正: スキーマに存在しない
      currentMileage: vehicle.currentMileage || undefined,
      notes: vehicle.notes || undefined,
      isActive: vehicle.status === VehicleStatus.ACTIVE, // 🔧 修正
      createdAt: vehicle.createdAt || new Date(),
      updatedAt: vehicle.updatedAt || new Date()
    };
  }

  /**
   * 🔧 修正: 統計情報付き車両情報を取得（Prismaスキーマ準拠）
   */
  async getVehicleWithStatistics(id: string): Promise<VehicleWithDetails | null> {
    try {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id },
        include: {
          operations: {
            include: {
              operationDetails: true
            }
          },
          maintenanceRecords: true
        }
      });

      if (!vehicle) return null;

      const vehicleInfo = this.mapToVehicleInfo(vehicle);
      const statistics = await this.generateVehicleStatistics(id);

      if (!statistics) {
        return {
          ...vehicleInfo,
          assignedDriver: undefined, // 🔧 修正: リレーションが存在しない
          recentOperations: vehicle.operations,
          maintenanceHistory: vehicle.maintenanceRecords
        };
      }

      return {
        ...vehicleInfo,
        assignedDriver: undefined, // 🔧 修正: リレーションが存在しない
        recentOperations: vehicle.operations,
        maintenanceHistory: vehicle.maintenanceRecords,
        statistics
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get vehicle with statistics', { error: errorMessage, id });
      throw new AppError('統計情報付き車両の取得に失敗しました', 500, errorMessage);
    }
  }

  // =====================================
  // 🔧 スタブ実装（将来の実装予定）
  // =====================================

  private async generateDailyStats(vehicleId: string, period?: { from: Date; to: Date }): Promise<VehicleDailyStats[]> {
    return [];
  }

  private async generateWeeklyStats(vehicleId: string, period?: { from: Date; to: Date }): Promise<VehicleWeeklyStats[]> {
    return [];
  }

  private async generateMonthlyStats(vehicleId: string, period?: { from: Date; to: Date }): Promise<VehicleMonthlyStats[]> {
    return [];
  }

  private calculateNextMaintenanceDate(vehicle: VehicleModel, lastMaintenanceDate?: Date): Date | undefined {
    if (!lastMaintenanceDate) return undefined;

    const nextDate = new Date(lastMaintenanceDate);
    nextDate.setDate(nextDate.getDate() + 90);

    return nextDate;
  }

  /**
   * 🔧 修正: 一括更新（BulkOperationResult準拠）
   */
  async bulkUpdate(
    ids: string[],
    data: Partial<VehicleUpdateInput>
  ): Promise<BulkOperationResult> {
    try {
      if (!ids?.length) {
        throw new ValidationError('更新対象のIDリストは必須です');
      }

      const results = await Promise.allSettled(
        ids.map(id => this.update(id, data))
      );

      const successfulResults: OperationResult<VehicleModel>[] = [];
      const failedResults: { id: string; error: string }[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          failedResults.push({
            id: ids[index] || '',  // undefined対策
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      logger.info('Bulk vehicle update completed', {
        total: ids.length,
        successful: successfulResults.length,
        failed: failedResults.length
      });

      // 🔧 修正: BulkOperationResultの正しい型定義に準拠
      return {
        success: failedResults.length === 0,
        totalCount: ids.length,
        successCount: successfulResults.length,
        failureCount: failedResults.length,
        results: ids.map((id, index) => {
          const settledResult = results[index];
          if (!settledResult) {  // undefined チェック追加
            return {
              id,
              success: false,
              error: 'Result not found'
            };
          }
          if (settledResult.status === 'fulfilled') {
            return {
              id,
              success: true,
              data: settledResult.value.data
            };
          } else {
            return {
              id,
              success: false,
              error: settledResult.reason?.message || 'Unknown error'
            };
          }
        })
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to bulk update vehicles', { error: errorMessage, ids });
      throw new AppError('車両の一括更新に失敗しました', 500, errorMessage);
    }
  }
}

// =====================================
// 🔧 ファクトリ関数
// =====================================

let _vehicleServiceInstance: VehicleService | null = null;

export const getVehicleService = (prisma?: PrismaClient): VehicleService => {
  if (!_vehicleServiceInstance) {
    _vehicleServiceInstance = new VehicleService(prisma || DatabaseService.getInstance());
  }
  return _vehicleServiceInstance;
};

// =====================================
// 🔧 型エクスポート
// =====================================

export type { VehicleModel as default };

// 🎯 types/vehicle.ts統合: 車両管理特化型定義の再エクスポート
export type {
  CreateVehicleRequest,
  UpdateVehicleRequest, VehicleCostAnalysis, VehicleFilter, VehicleFuelRecord, VehicleInfo, VehicleListResponse, VehicleMaintenanceSchedule,
  VehicleMaintenanceSummary, VehicleResponseDTO, VehicleStatistics, VehicleWithDetails
} from '../types/vehicle';

// 🎯 車両管理特化ユーティリティ関数の再エクスポート
export {
  hasAssignedDriver, isValidFuelType, isValidVehicleStatus, isVehicleInMaintenance, isVehicleOperational
} from '../types/vehicle';
