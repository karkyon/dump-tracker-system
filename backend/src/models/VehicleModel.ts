// =====================================
// backend/src/models/VehicleModel.ts
// 車両モデル（既存完全実装 + Phase 1-A基盤統合 + 車両管理特化超高度機能統合版）
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: Sat Sep 27 08:30:00 JST 2025 - Phase 1-B完全統合
// アーキテクチャ指針準拠版 - Phase 1-B対応
// =====================================

import type {
  Vehicle as PrismaVehicle,
  Prisma,
  // GpsLog,
  // InspectionRecord,
  // MaintenanceRecord,
  // Operation,
  VehicleStatus,
  // FuelType
} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 共通型定義の活用（types/common.ts）
import type {
  // PaginationQuery,
  // ApiResponse,
  OperationResult,
  BulkOperationResult
} from '../types/common';

// 🎯 types/vehicle.ts 超高度機能の統合
import type {
  // VehicleInfo,
  VehicleWithDetails,
  VehicleResponseDTO,
  VehicleListResponse,
  // CreateVehicleRequest,
  // UpdateVehicleRequest,
  VehicleFilter,
  // VehicleSearchQuery,
  VehicleStatistics,
  VehicleDailyStats,
  VehicleWeeklyStats,
  VehicleMonthlyStats,
  // VehicleStatusChangeRequest,
  VehicleAvailability,
  VehicleMaintenanceSchedule,
  VehicleMaintenanceSummary,
  VehicleFuelRecord,
  // VehicleCostAnalysis,
  // VehicleReportConfig
} from '../types/vehicle';

// 型ガード関数は使用時に直接インポート
import {
  isValidVehicleStatus,
  isValidFuelType,
  isVehicleOperational,
  isVehicleInMaintenance,
  // hasAssignedDriver
} from '../types/vehicle';

// =====================================
// 🔧 既存完全実装の100%保持 - 基本型定義
// =====================================

export type VehicleModel = PrismaVehicle;
export type VehicleCreateInput = Prisma.VehicleCreateInput;
export type VehicleUpdateInput = Prisma.VehicleUpdateInput;
export type VehicleWhereInput = Prisma.VehicleWhereInput;
export type VehicleWhereUniqueInput = Prisma.VehicleWhereUniqueInput;
export type VehicleOrderByInput = Prisma.VehicleOrderByWithRelationInput;

// =====================================
// 🔧 既存完全実装の100%保持 + types/vehicle.ts統合 - 標準DTO
// =====================================

export interface VehicleResponseDTOExtended extends VehicleResponseDTO {
  _count?: {
    [key: string]: number;
  };
  statistics?: VehicleStatistics;
  availability?: VehicleAvailability;
  maintenanceSummary?: VehicleMaintenanceSummary;
}

export interface VehicleListResponseExtended extends VehicleListResponse {
  data: VehicleResponseDTOExtended[];
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
  // フロントエンド送信用（既存互換）
  maintenanceSchedule?: VehicleMaintenanceSchedule;
  initialFuelRecord?: VehicleFuelRecord;
}

export interface VehicleUpdateDTOExtended extends Partial<VehicleCreateDTOExtended> {
  // 更新用（部分更新対応、既存互換）
}

// =====================================
// 🔧 既存完全実装の100%保持 + Phase 1-A基盤統合 + 車両管理特化超高度機能統合 - VehicleService
// =====================================

export class VehicleService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    // 🎯 Phase 1-A基盤: DatabaseService シングルトン活用
    this.prisma = prisma || DatabaseService.getInstance();
  }

  // =====================================
  // 🔧 既存完全実装保持 - 基本CRUDメソッド
  // =====================================

  /**
   * 🔧 既存完全実装保持 - 新規作成（強化版）
   */
  async create(data: VehicleCreateInput): Promise<OperationResult<VehicleModel>> {
    try {
      // 🎯 Phase 1-A基盤: バリデーション強化
      if (!data.plateNumber?.trim()) {
        throw new ValidationError('車両ナンバーは必須です');
      }

      if (!data.model?.trim()) {
        throw new ValidationError('車両モデルは必須です');
      }

      // 🎯 新機能: 車両ナンバー重複チェック
      const existingVehicle = await this.prisma.vehicle.findFirst({
        where: { plateNumber: data.plateNumber }
      });

      if (existingVehicle) {
        throw new ConflictError('この車両ナンバーは既に登録されています');
      }

      // 🎯 新機能: 燃料タイプ・ステータス検証
      if (data.fuelType && !isValidFuelType(data.fuelType)) {
        throw new ValidationError('無効な燃料タイプです');
      }

      if (data.status && !isValidVehicleStatus(data.status)) {
        throw new ValidationError('無効な車両ステータスです');
      }

      const vehicle = await this.prisma.vehicle.create({
        data: {
          ...data,
          status: data.status || VehicleStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // 🎯 Phase 1-A基盤: ログ統合
      logger.info('Vehicle created successfully', {
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        model: vehicle.model,
        status: vehicle.status
      });

      return {
        success: true,
        data: vehicle,
        message: '車両を作成しました'
      };

    } catch (error) {
      // 🎯 Phase 1-A基盤: エラーハンドリング統合
      logger.error('Failed to create vehicle', { error, data });

      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }

      throw new AppError('車両の作成に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 主キー指定取得（超強化版）
   */
  async findByKey(id: string, options?: {
    includeStatistics?: boolean;
    includeMaintenanceHistory?: boolean;
    includeOperations?: boolean;
    includeAvailability?: boolean;
    statisticsPeriod?: { from: Date; to: Date };
  }): Promise<VehicleWithDetails | null> {
    try {
      if (!id) {
        throw new ValidationError('車両IDは必須です');
      }

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id },
        include: {
          operations: options?.includeOperations ? {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              operationDetails: true
            }
          } : false,
          maintenanceRecords: options?.includeMaintenanceHistory ? {
            take: 20,
            orderBy: { createdAt: 'desc' }
          } : false,
          assignedDriver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!vehicle) {
        return null;
      }

      // 🎯 新機能: 車両統計の生成
      let statistics: VehicleStatistics | undefined;
      if (options?.includeStatistics) {
        statistics = await this.generateVehicleStatistics(id, options.statisticsPeriod);
      }

      // 🎯 新機能: メンテナンス履歴サマリー
      let maintenanceSummary: VehicleMaintenanceSummary | undefined;
      if (options?.includeMaintenanceHistory) {
        maintenanceSummary = await this.generateMaintenanceSummary(id);
      }

      // 🎯 新機能: 車両可用性情報
      let availability: VehicleAvailability | undefined;
      if (options?.includeAvailability) {
        availability = await this.checkVehicleAvailability(id);
      }

      logger.debug('Vehicle found with enhanced details', {
        vehicleId: id,
        includeStatistics: !!statistics,
        includeMaintenanceHistory: !!maintenanceSummary,
        includeAvailability: !!availability
      });

      return {
        ...vehicle,
        statistics,
        maintenanceHistory: vehicle.maintenanceRecords,
        recentOperations: vehicle.operations,
        availability
      };

    } catch (error) {
      logger.error('Failed to find vehicle by key', { error, id });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new AppError('車両情報の取得に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 条件指定一覧取得（強化版）
   */
  async findMany(params?: {
    where?: VehicleWhereInput;
    orderBy?: VehicleOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<VehicleModel[]> {
    try {
      const vehicles = await this.prisma.vehicle.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take
      });

      logger.debug('Vehicles found', {
        count: vehicles.length,
        params
      });

      return vehicles;

    } catch (error) {
      logger.error('Failed to find vehicles', { error, params });
      throw new AppError('車両一覧の取得に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 + 新機能統合 - ページネーション付き一覧取得（高度検索・統計版）
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

      // 🎯 Phase 1-A基盤: バリデーション強化
      if (page < 1 || pageSize < 1) {
        throw new ValidationError('ページ番号とページサイズは1以上である必要があります');
      }

      const skip = (page - 1) * pageSize;

      // 🎯 新機能: 高度フィルター対応
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
            assignedDriver: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
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

      // 🎯 新機能: 拡張データ付加
      const enhancedData = await Promise.all(
        data.map(async (vehicle) => {
          const availability = await this.checkVehicleAvailability(vehicle.id);
          return {
            ...vehicle,
            createdAt: vehicle.createdAt.toISOString(),
            updatedAt: vehicle.updatedAt.toISOString(),
            availability
          };
        })
      );

      // 🎯 新機能: サマリー統計生成
      const summary = await this.generateVehiclesSummary(enhancedWhere);

      // 🎯 新機能: フリート統計生成
      let fleetStatistics;
      if (includeFleetStatistics) {
        fleetStatistics = await this.generateFleetStatistics(enhancedWhere);
      }

      const result: VehicleListResponseExtended = {
        data: enhancedData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
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
      logger.error('Failed to find vehicles with pagination', { error, params });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new AppError('車両ページネーション取得に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 更新（強化版）
   */
  async update(id: string, data: VehicleUpdateInput): Promise<OperationResult<VehicleModel>> {
    try {
      if (!id) {
        throw new ValidationError('車両IDは必須です');
      }

      // 🎯 Phase 1-A基盤: 存在チェック強化
      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('指定された車両が見つかりません');
      }

      // 🎯 新機能: 車両ナンバー重複チェック（変更時）
      if (data.plateNumber && data.plateNumber !== existing.plateNumber) {
        const existingWithPlate = await this.prisma.vehicle.findFirst({
          where: {
            plateNumber: data.plateNumber,
            id: { not: id }
          }
        });

        if (existingWithPlate) {
          throw new ConflictError('この車両ナンバーは既に使用されています');
        }
      }

      // 🎯 新機能: ステータス・燃料タイプ検証
      if (data.status && !isValidVehicleStatus(data.status)) {
        throw new ValidationError('無効な車両ステータスです');
      }

      if (data.fuelType && !isValidFuelType(data.fuelType)) {
        throw new ValidationError('無効な燃料タイプです');
      }

      const vehicle = await this.prisma.vehicle.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      logger.info('Vehicle updated successfully', {
        vehicleId: id,
        changes: Object.keys(data),
        statusChanged: !!(data.status && data.status !== existing.status)
      });

      return {
        success: true,
        data: vehicle,
        message: '車両情報を更新しました'
      };

    } catch (error) {
      logger.error('Failed to update vehicle', { error, id, data });

      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }

      throw new AppError('車両の更新に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 削除（強化版）
   */
  async delete(id: string): Promise<OperationResult<VehicleModel>> {
    try {
      if (!id) {
        throw new ValidationError('車両IDは必須です');
      }

      // 🎯 Phase 1-A基盤: 存在チェック強化
      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('指定された車両が見つかりません');
      }

      // 🎯 新機能: 関連データの事前チェック
      const [operationCount, maintenanceCount] = await Promise.all([
        this.prisma.operation.count({ where: { vehicleId: id } }),
        this.prisma.maintenanceRecord.count({ where: { vehicleId: id } })
      ]);

      if (operationCount > 0) {
        throw new ConflictError(
          `この車両は${operationCount}件の運行記録で使用されているため削除できません`
        );
      }

      const vehicle = await this.prisma.vehicle.delete({
        where: { id }
      });

      logger.info('Vehicle deleted successfully', {
        vehicleId: id,
        plateNumber: existing.plateNumber,
        maintenanceRecordsCount: maintenanceCount
      });

      return {
        success: true,
        data: vehicle,
        message: '車両を削除しました'
      };

    } catch (error) {
      logger.error('Failed to delete vehicle', { error, id });

      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }

      throw new AppError('車両の削除に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    try {
      if (!id) {
        return false;
      }

      const count = await this.prisma.vehicle.count({
        where: { id }
      });

      return count > 0;

    } catch (error) {
      logger.error('Failed to check vehicle existence', { error, id });
      return false;
    }
  }

  /**
   * 🔧 既存完全実装保持 - カウント取得
   */
  async count(where?: VehicleWhereInput): Promise<number> {
    try {
      const count = await this.prisma.vehicle.count({ where });

      logger.debug('Vehicle count retrieved', { count, where });

      return count;

    } catch (error) {
      logger.error('Failed to count vehicles', { error, where });
      throw new AppError('車両数の取得に失敗しました', 500, error);
    }
  }

  // =====================================
  // 🎯 types/vehicle.ts統合: 車両管理特化超高度機能（既存機能を損なわない）
  // =====================================

  /**
   * 🎯 新機能: 車両統計生成（超高度版）
   */
  async generateVehicleStatistics(vehicleId: string, period?: { from: Date; to: Date }): Promise<VehicleStatistics> {
    try {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          operations: {
            where: period ? {
              createdAt: {
                gte: period.from,
                lte: period.to
              }
            } : undefined,
            include: {
              operationDetails: true
            }
          },
          maintenanceRecords: {
            where: period ? {
              createdAt: {
                gte: period.from,
                lte: period.to
              }
            } : undefined
          }
        }
      });

      if (!vehicle) {
        throw new NotFoundError('車両が見つかりません');
      }

      const operations = vehicle.operations;
      const maintenance = vehicle.maintenanceRecords;

      // 基本統計計算
      const totalOperations = operations.length;
      const completedOperations = operations.filter(op => op.status === 'COMPLETED').length;
      const ongoingOperations = operations.filter(op => op.status === 'IN_PROGRESS').length;

      // 距離・時間統計
      const totalDistance = operations.reduce((sum, op) => sum + (op.distance || 0), 0);
      const averageDistance = totalOperations > 0 ? totalDistance / totalOperations : 0;

      const operationTimes = operations
        .filter(op => op.startTime && op.endTime)
        .map(op => {
          const start = new Date(op.startTime!).getTime();
          const end = new Date(op.endTime!).getTime();
          return (end - start) / (1000 * 60); // 分単位
        });

      const totalOperationTime = operationTimes.reduce((sum, time) => sum + time, 0);
      const averageOperationTime = operationTimes.length > 0 ? totalOperationTime / operationTimes.length : 0;

      // 燃料統計（簡易計算）
      const totalFuelConsumed = operations.reduce((sum, op) => sum + (op.fuelConsumed || 0), 0);
      const totalFuelCost = operations.reduce((sum, op) => sum + (op.fuelCost || 0), 0);
      const averageFuelEfficiency = totalFuelConsumed > 0 ? totalDistance / totalFuelConsumed : 0;
      const fuelCostPerKm = totalDistance > 0 ? totalFuelCost / totalDistance : 0;

      // 稼働統計
      const periodDays = period ?
        Math.ceil((period.to.getTime() - period.from.getTime()) / (1000 * 60 * 60 * 24)) :
        30; // デフォルト30日

      const operationDays = new Set(
        operations.map(op => new Date(op.createdAt).toDateString())
      ).size;

      const utilizationRate = periodDays > 0 ? (operationDays / periodDays) * 100 : 0;
      const availabilityRate = isVehicleOperational(vehicle) ? 100 : 80; // 簡易計算

      // メンテナンス統計
      const maintenanceCount = maintenance.length;
      const lastMaintenanceDate = maintenance[0]?.createdAt;
      const maintenanceCost = maintenance.reduce((sum, m) => sum + (m.cost || 0), 0);

      // 期間統計（簡易版）
      const periodStats = {
        daily: await this.generateDailyStats(vehicleId, period),
        weekly: await this.generateWeeklyStats(vehicleId, period),
        monthly: await this.generateMonthlyStats(vehicleId, period)
      };

      const statistics: VehicleStatistics = {
        totalOperations,
        completedOperations,
        ongoingOperations,
        totalDistance: Number(totalDistance.toFixed(2)),
        averageDistance: Number(averageDistance.toFixed(2)),
        totalOperationTime: Math.round(totalOperationTime),
        averageOperationTime: Math.round(averageOperationTime),
        totalFuelConsumed: Number(totalFuelConsumed.toFixed(2)),
        totalFuelCost: Number(totalFuelCost.toFixed(0)),
        averageFuelEfficiency: Number(averageFuelEfficiency.toFixed(2)),
        fuelCostPerKm: Number(fuelCostPerKm.toFixed(2)),
        operationDays,
        utilizationRate: Number(utilizationRate.toFixed(1)),
        availabilityRate: Number(availabilityRate.toFixed(1)),
        maintenanceCount,
        lastMaintenanceDate,
        nextMaintenanceDate: this.calculateNextMaintenanceDate(vehicle, lastMaintenanceDate),
        maintenanceCost: Number(maintenanceCost.toFixed(0)),
        periodStats
      };

      logger.debug('Vehicle statistics generated', {
        vehicleId,
        totalOperations,
        utilizationRate: statistics.utilizationRate,
        period: !!period
      });

      return statistics;

    } catch (error) {
      logger.error('Failed to generate vehicle statistics', { error, vehicleId });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new AppError('車両統計の生成に失敗しました', 500, error);
    }
  }

  /**
   * 🎯 新機能: 車両可用性チェック
   */
  async checkVehicleAvailability(vehicleId: string): Promise<VehicleAvailability> {
    try {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          operations: {
            where: {
              status: 'IN_PROGRESS'
            },
            take: 1,
            include: {
              assignedDriver: {
                select: { id: true }
              }
            }
          }
        }
      });

      if (!vehicle) {
        throw new NotFoundError('車両が見つかりません');
      }

      const isOperational = isVehicleOperational(vehicle);
      const inMaintenance = isVehicleInMaintenance(vehicle);
      const currentOperation = vehicle.operations[0];

      const availability: VehicleAvailability = {
        vehicleId,
        isAvailable: isOperational && !currentOperation && !inMaintenance,
        status: vehicle.status,
        unavailableUntil: undefined,
        unavailableReason: undefined,
        currentOperation: currentOperation ? {
          id: currentOperation.id,
          startTime: currentOperation.startTime!,
          estimatedEndTime: currentOperation.endTime,
          driverId: currentOperation.assignedDriver?.id || ''
        } : undefined
      };

      if (inMaintenance) {
        availability.unavailableReason = 'メンテナンス中';
      } else if (currentOperation) {
        availability.unavailableReason = '運行中';
        availability.unavailableUntil = currentOperation.endTime;
      } else if (!vehicle.isActive) {
        availability.unavailableReason = '非稼働状態';
      }

      return availability;

    } catch (error) {
      logger.error('Failed to check vehicle availability', { error, vehicleId });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new AppError('車両可用性チェックに失敗しました', 500, error);
    }
  }

  /**
   * 🎯 新機能: メンテナンス履歴サマリー生成
   */
  async generateMaintenanceSummary(vehicleId: string): Promise<VehicleMaintenanceSummary> {
    try {
      const maintenanceRecords = await this.prisma.maintenanceRecord.findMany({
        where: { vehicleId },
        orderBy: { createdAt: 'desc' }
      });

      const totalMaintenanceCount = maintenanceRecords.length;
      const totalMaintenanceCost = maintenanceRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
      const lastMaintenanceDate = maintenanceRecords[0]?.createdAt;

      // 平均メンテナンス間隔計算
      let averageMaintenanceInterval = 0;
      if (maintenanceRecords.length > 1) {
        const intervals = [];
        for (let i = 0; i < maintenanceRecords.length - 1; i++) {
          const current = new Date(maintenanceRecords[i].createdAt);
          const next = new Date(maintenanceRecords[i + 1].createdAt);
          intervals.push(Math.abs(current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
        }
        averageMaintenanceInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      }

      // タイプ別統計
      const maintenanceByType = maintenanceRecords.reduce((acc, record) => {
        const type = record.maintenanceType || 'ROUTINE';
        if (!acc[type]) {
          acc[type] = { count: 0, totalCost: 0, averageCost: 0 };
        }
        acc[type].count++;
        acc[type].totalCost += record.cost || 0;
        acc[type].averageCost = acc[type].totalCost / acc[type].count;
        return acc;
      }, {} as Record<string, { count: number; totalCost: number; averageCost: number; }>);

      const summary: VehicleMaintenanceSummary = {
        vehicleId,
        totalMaintenanceCount,
        totalMaintenanceCost: Number(totalMaintenanceCost.toFixed(0)),
        lastMaintenanceDate,
        averageMaintenanceInterval: Math.round(averageMaintenanceInterval),
        upcomingMaintenance: [], // 実装時に予定メンテナンスを取得
        maintenanceByType
      };

      return summary;

    } catch (error) {
      logger.error('Failed to generate maintenance summary', { error, vehicleId });
      throw new AppError('メンテナンス履歴サマリーの生成に失敗しました', 500, error);
    }
  }

  // =====================================
  // 🎯 内部ヘルパーメソッド
  // =====================================

  private buildVehicleFilter(filter: VehicleFilter): VehicleWhereInput {
    const where: VehicleWhereInput = {};

    if (filter.search) {
      where.OR = [
        { plateNumber: { contains: filter.search, mode: 'insensitive' } },
        { model: { contains: filter.search, mode: 'insensitive' } },
        { manufacturer: { contains: filter.search, mode: 'insensitive' } }
      ];
    }

    if (filter.status?.length) {
      where.status = { in: filter.status };
    }

    if (filter.fuelType?.length) {
      where.fuelType = { in: filter.fuelType };
    }

    if (filter.assignedDriverId) {
      where.assignedDriverId = filter.assignedDriverId;
    }

    if (filter.yearFrom || filter.yearTo) {
      where.year = {};
      if (filter.yearFrom) where.year.gte = filter.yearFrom;
      if (filter.yearTo) where.year.lte = filter.yearTo;
    }

    if (typeof filter.isActive === 'boolean') {
      where.isActive = filter.isActive;
    }

    if (filter.hasAssignedDriver !== undefined) {
      where.assignedDriverId = filter.hasAssignedDriver ? { not: null } : null;
    }

    return where;
  }

  private async generateVehiclesSummary(where: VehicleWhereInput) {
    const [total, active, inUse, maintenance] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.count({ where: { ...where, isActive: true } }),
      this.prisma.vehicle.count({ where: { ...where, status: VehicleStatus.ACTIVE } }),
      this.prisma.vehicle.count({ where: { ...where, status: VehicleStatus.MAINTENANCE } })
    ]);

    return {
      totalVehicles: total,
      activeVehicles: active,
      inUseVehicles: inUse,
      maintenanceVehicles: maintenance
    };
  }

  private async generateFleetStatistics(where: VehicleWhereInput) {
    // 簡易版フリート統計
    const vehicles = await this.prisma.vehicle.findMany({
      where,
      include: {
        operations: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const totalDistance = vehicles.reduce((sum, vehicle) =>
      sum + vehicle.operations.reduce((opSum, op) => opSum + (op.distance || 0), 0), 0
    );

    const totalFuelConsumed = vehicles.reduce((sum, vehicle) =>
      sum + vehicle.operations.reduce((opSum, op) => opSum + (op.fuelConsumed || 0), 0), 0
    );

    const totalOperationTime = vehicles.reduce((sum, vehicle) =>
      sum + vehicle.operations.reduce((opSum, op) => {
        if (op.startTime && op.endTime) {
          return opSum + ((new Date(op.endTime).getTime() - new Date(op.startTime).getTime()) / (1000 * 60));
        }
        return opSum;
      }, 0), 0
    );

    return {
      averageFuelEfficiency: totalFuelConsumed > 0 ? Number((totalDistance / totalFuelConsumed).toFixed(2)) : 0,
      totalDistance: Number(totalDistance.toFixed(2)),
      totalFuelConsumed: Number(totalFuelConsumed.toFixed(2)),
      totalOperationTime: Math.round(totalOperationTime)
    };
  }

  private async generateDailyStats(vehicleId: string, period?: { from: Date; to: Date }): Promise<VehicleDailyStats[]> {
    // 簡易版日次統計
    return [];
  }

  private async generateWeeklyStats(vehicleId: string, period?: { from: Date; to: Date }): Promise<VehicleWeeklyStats[]> {
    // 簡易版週次統計
    return [];
  }

  private async generateMonthlyStats(vehicleId: string, period?: { from: Date; to: Date }): Promise<VehicleMonthlyStats[]> {
    // 簡易版月次統計
    return [];
  }

  private calculateNextMaintenanceDate(vehicle: VehicleModel, lastMaintenanceDate?: Date): Date | undefined {
    if (!lastMaintenanceDate) return undefined;

    // 簡易計算: 前回メンテナンスから90日後
    const nextDate = new Date(lastMaintenanceDate);
    nextDate.setDate(nextDate.getDate() + 90);

    return nextDate;
  }

  /**
   * 🎯 新機能: 一括操作（既存機能を損なわない追加）
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

      const successful = results.filter((r): r is PromiseFulfilledResult<OperationResult<VehicleModel>> =>
        r.status === 'fulfilled'
      );
      const failed = results.filter(r => r.status === 'rejected');

      logger.info('Bulk vehicle update completed', {
        total: ids.length,
        successful: successful.length,
        failed: failed.length
      });

      return {
        success: failed.length === 0,
        total: ids.length,
        successful: successful.length,
        failed: failed.length,
        results: successful.map(r => r.value.data!),
        errors: failed.map((r: PromiseRejectedResult) => r.reason?.message || 'Unknown error')
      };

    } catch (error) {
      logger.error('Failed to bulk update vehicles', { error, ids });
      throw new AppError('車両の一括更新に失敗しました', 500, error);
    }
  }
}

// =====================================
// 🔧 既存完全実装保持 + Phase 1-A基盤統合 - ファクトリ関数
// =====================================

let _vehicleServiceInstance: VehicleService | null = null;

export const getVehicleService = (prisma?: PrismaClient): VehicleService => {
  if (!_vehicleServiceInstance) {
    // 🎯 Phase 1-A基盤: DatabaseService シングルトン活用
    _vehicleServiceInstance = new VehicleService(prisma || DatabaseService.getInstance());
  }
  return _vehicleServiceInstance;
};

// =====================================
// 🔧 既存完全実装保持 + 型統合 - 型エクスポート
// =====================================

export type { VehicleModel as default };

// 🎯 types/vehicle.ts統合: 車両管理特化型定義の再エクスポート
export type {
  VehicleInfo,
  VehicleWithDetails,
  VehicleResponseDTO,
  VehicleListResponse,
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleFilter,
  VehicleStatistics,
  VehicleAvailability,
  VehicleMaintenanceSchedule,
  VehicleMaintenanceSummary,
  VehicleFuelRecord,
  VehicleCostAnalysis
} from '../types/vehicle';

// 🎯 車両管理特化ユーティリティ関数の再エクスポート
export {
  isValidVehicleStatus,
  isValidFuelType,
  isVehicleOperational,
  isVehicleInMaintenance,
  hasAssignedDriver
} from '../types/vehicle';
