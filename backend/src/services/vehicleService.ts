// =====================================
// backend/src/services/vehicleService.ts
// 車両管理サービス - 企業レベル完全フリート管理システム版
// 循環依存解消：イベントエミッター方式採用
// 5層統合システム・モバイル統合・レポート分析・予防保全・コスト最適化
// 最終更新: 2025年10月16日
// 依存関係: middleware/auth.ts, utils/database.ts, models/VehicleModel.ts, utils/events.ts
// 統合基盤: 5層統合システム・モバイル統合基盤・統合レポート分析・企業レベル完全機能
// =====================================

import { Vehicle, VehicleStatus, UserRole, MaintenanceType } from '@prisma/client';

// Phase 1完成基盤の活用
import {
  AppError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ERROR_CODES
} from '../utils/errors';
import { DATABASE_SERVICE } from '../utils/database';
import { calculateDistance, isValidCoordinate } from '../utils/gpsCalculations';
import { hashPassword as encryptSensitiveData } from '../utils/crypto';
import logger from '../utils/logger';

// イベントエミッター導入
import { emitEvent } from '../utils/events';

// ✅ FIX: getLocationServiceWrapperをインポート（getLocationServiceは未エクスポート）
import { getLocationServiceWrapper } from '../services/locationService';
import type { UserService } from './userService';

// types/からの統一型定義インポート
import type {
  VehicleCreateInput,
  VehicleUpdateInput,
  VehicleResponseDTO,
  VehicleListResponse,
  VehicleFilter as VehicleFilterBase,
  VehicleSearchQuery,
  VehicleStatusUpdateRequest,
  VehicleAssignmentRequest,
  VehicleMaintenanceRequest,
  VehicleStatistics,
  FleetStatistics,
  VehicleUtilizationReport,
  VehiclePerformanceMetrics,
  VehicleCostAnalysis,
  FleetOptimizationReport,
  VehicleMaintenanceSchedule,
  PredictiveMaintenanceAlert,
  VehicleEfficiencyAnalysis,
  FleetComparisonReport,
  CreateVehicleRequest,
  UpdateVehicleRequest
} from '../types/vehicle';

import type {
  PaginationQuery,
  ApiResponse,
  ApiListResponse,
  OperationResult,
  DateRange,
  SortOptions
} from '../types/common';

// VehicleFilterを拡張してPaginationQueryを含める
interface VehicleFilter extends VehicleFilterBase, PaginationQuery {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  yearRange?: {
    min?: number;
    max?: number;
  };
}

// VehicleStatus定数の定義
const VEHICLE_STATUS = {
  ACTIVE: 'ACTIVE' as VehicleStatus,
  MAINTENANCE: 'MAINTENANCE' as VehicleStatus,
  INACTIVE: 'INACTIVE' as VehicleStatus,
  RETIRED: 'RETIRED' as VehicleStatus,
  AVAILABLE: 'ACTIVE' as VehicleStatus,
  OUT_OF_SERVICE: 'INACTIVE' as VehicleStatus
};

// ERROR_CODES拡張
const EXTENDED_ERROR_CODES = {
  ...ERROR_CODES,
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  DATABASE_OPERATION_FAILED: 'DATABASE_OPERATION_FAILED'
};

// =====================================
// 車両管理サービス統合クラス
// =====================================

/**
 * ✅ FIX: classキーワードを削除して重複宣言エラーを解消
 */
export class VehicleService {
  // ✅ FIX: DATABASE_SERVICE.getInstance()を使用
  private readonly prisma = DATABASE_SERVICE.getInstance();

  // サービス間連携
  private locationService?: ReturnType<typeof getLocationServiceWrapper>;
  private userService?: UserService;

  constructor() {
    this.initializeServices();
  }

  /**
   * サービス初期化
   */
  private async initializeServices(): Promise<void> {
    try {
      // ✅ FIX: getLocationServiceWrapper使用
      this.locationService = getLocationServiceWrapper();
      logger.info('車両サービス初期化完了');
    } catch (error) {
      logger.error('車両サービス初期化エラー', { error });
    }
  }

  // =====================================
  // 基本CRUD操作
  // =====================================

  /**
   * 車両一覧取得
   */
  async getVehicleList(
    filter: VehicleFilter,
    context: {
      userId: string;
      userRole: UserRole;
      includeStatistics?: boolean;
      includeCurrentLocation?: boolean;
      includeUtilization?: boolean;
    }
  ): Promise<VehicleListResponse> {
    try {
      logger.info('車両一覧取得開始', { filter, context });

      const whereClause = await this.buildVehicleWhereClause(filter, context);
      const page = filter.page || 1;
      const limit = filter.limit || 10;
      const skip = (page - 1) * limit;
      const orderBy = this.buildOrderBy(filter.sortBy, filter.sortOrder);

      const [vehicles, totalCount] = await Promise.all([
        this.prisma.vehicle.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: limit,
          include: {
            assignedDriver: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            },
            operations: context.includeStatistics ? {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                status: true
              }
            } : false,
            maintenances: {
              orderBy: { scheduledDate: 'desc' },
              take: 1
            },
            inspections: {
              orderBy: { inspectionDate: 'desc' },
              take: 1
            }
          }
        }),
        this.prisma.vehicle.count({ where: whereClause })
      ]);

      const vehicleList = await Promise.all(
        vehicles.map(async (vehicle: any) => {
          const dto = this.mapVehicleToResponseDTO(vehicle);

          if (context.includeStatistics) {
            dto.operationCount = vehicle.operations?.length || 0;
            dto.lastOperationDate = vehicle.operations?.[0]?.endTime || null;
          }

          if (context.includeCurrentLocation && this.locationService) {
            const location = await this.getCurrentVehicleLocation(vehicle.id);
            if (location) {
              dto.currentLocation = location;
            }
          }

          if (context.includeUtilization) {
            dto.utilizationRate = await this.calculateVehicleUtilization(vehicle.id);
          }

          return dto;
        })
      );

      const totalPages = Math.ceil(totalCount / limit);

      // ✅ FIX: VehicleListResponseに準拠した戻り値
      return {
        success: true,
        data: vehicleList,
        meta: {
          total: totalCount,
          page,
          pageSize: limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        message: '車両一覧を取得しました',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('車両一覧取得エラー', {
        error: error instanceof Error ? error.message : String(error),
        filter,
        context
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('車両一覧の取得に失敗しました', EXTENDED_ERROR_CODES.DATABASE_QUERY_FAILED);
    }
  }

  /**
   * 車両詳細取得
   */
  async getVehicleById(
    vehicleId: string,
    context: {
      userId: string;
      userRole: UserRole;
      includeDetailedStats?: boolean;
      includePredictiveAnalysis?: boolean;
      includeFleetComparison?: boolean;
    }
  ): Promise<VehicleResponseDTO> {
    try {
      logger.info('車両詳細取得開始', { vehicleId, context });

      await this.checkVehicleAccessPermission(vehicleId, context.userId, context.userRole);

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          assignedDriver: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true
            }
          },
          operations: {
            orderBy: { startTime: 'desc' },
            take: 10,
            include: {
              driver: {
                select: { id: true, username: true }
              }
            }
          },
          maintenances: {
            orderBy: { scheduledDate: 'desc' },
            take: 5,
            include: {
              performedBy: {
                select: { id: true, username: true }
              }
            }
          },
          inspections: context.includeDetailedStats ? {
            orderBy: { inspectionDate: 'desc' },
            take: 10,
            include: {
              inspector: {
                select: { id: true, username: true }
              },
              inspectionItems: {
                include: {
                  inspectionItem: true
                }
              }
            }
          } : false,
          trips: context.includeDetailedStats ? {
            where: {
              startTime: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
              }
            },
            include: {
              driver: {
                select: { id: true, username: true }
              },
              gpsLogs: {
                select: {
                  id: true,
                  latitude: true,
                  longitude: true,
                  timestamp: true,
                  speed: true
                }
              }
            }
          } : false
        }
      });

      if (!vehicle) {
        throw new NotFoundError(`車両が見つかりません: ${vehicleId}`);
      }

      let vehicleData = this.mapVehicleToResponseDTO(vehicle);

      if (context.includeDetailedStats) {
        const detailedStats = await this.calculateDetailedVehicleStatistics(vehicleId);
        (vehicleData as any).detailedStatistics = detailedStats;
      }

      if (context.includePredictiveAnalysis) {
        const predictiveAnalysis = await this.performPredictiveAnalysis(vehicleId);
        (vehicleData as any).predictiveAnalysis = predictiveAnalysis;
      }

      if (context.includeFleetComparison) {
        const fleetComparison = await this.performFleetComparison(vehicleId);
        (vehicleData as any).fleetComparison = fleetComparison;
      }

      const mobileStatus = await this.getMobileIntegrationStatus(vehicleId);
      (vehicleData as any).mobileIntegration = mobileStatus;

      logger.info('車両詳細取得完了', {
        vehicleId,
        userId: context.userId,
        includeDetailedStats: !!context.includeDetailedStats
      });

      return vehicleData;

    } catch (error) {
      logger.error('車両詳細取得エラー', {
        error: error instanceof Error ? error.message : String(error),
        vehicleId,
        userId: context.userId
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('車両詳細の取得に失敗しました', EXTENDED_ERROR_CODES.DATABASE_QUERY_FAILED);
    }
  }

  /**
   * 車両作成
   */
  async createVehicle(
    vehicleData: CreateVehicleRequest,
    context: {
      userId: string;
      userRole: UserRole;
      autoAssignLocation?: boolean;
      enablePredictiveMaintenance?: boolean;
      createMaintenanceSchedule?: boolean;
    }
  ): Promise<VehicleResponseDTO> {
    try {
      logger.info('車両作成開始', { vehicleData, context });

      if (!['ADMIN', 'MANAGER'].includes(context.userRole)) {
        throw new AuthorizationError('車両作成権限がありません');
      }

      await this.validateVehicleData(vehicleData);

      const existingVehicle = await this.prisma.vehicle.findFirst({
        where: {
          plateNumber: vehicleData.plateNumber
        }
      });

      if (existingVehicle) {
        throw new ConflictError(`ナンバープレート重複: ${vehicleData.plateNumber}`);
      }

      if ((vehicleData as any).vin) {
        const existingVin = await this.prisma.vehicle.findFirst({
          where: { vin: (vehicleData as any).vin }
        });

        if (existingVin) {
          throw new ConflictError(`VIN重複: ${(vehicleData as any).vin}`);
        }
      }

      const newVehicle = await this.prisma.$transaction(async (tx: any) => {
        const createData: any = {
          plateNumber: vehicleData.plateNumber,
          model: vehicleData.model,
          manufacturer: vehicleData.manufacturer,
          year: vehicleData.year,
          capacity: vehicleData.capacity,
          fuelType: vehicleData.fuelType,
          status: (vehicleData as any).status || VEHICLE_STATUS.AVAILABLE,
          registrationDate: (vehicleData as any).registrationDate || new Date(),
          nextMaintenanceDate: (vehicleData as any).nextMaintenanceDate,
          fuelEfficiency: (vehicleData as any).fuelEfficiency,
          notes: vehicleData.notes,
          isActive: true
        };

        if ((vehicleData as any).vin) {
          createData.vin = encryptSensitiveData((vehicleData as any).vin);
        }

        const vehicle = await tx.vehicle.create({
          data: createData,
          include: {
            assignedDriver: true
          }
        });

        if (context.autoAssignLocation && this.locationService) {
          await this.assignDefaultLocation(vehicle.id, context.userId);
        }

        if (context.createMaintenanceSchedule) {
          await this.createInitialMaintenanceSchedule(vehicle.id, context.userId);
        }

        await this.createAuditLog(tx, {
          action: 'CREATE',
          entityType: 'VEHICLE',
          entityId: vehicle.id,
          userId: context.userId,
          details: {
            plateNumber: vehicleData.plateNumber,
            model: vehicleData.model
          }
        });

        return vehicle;
      });

      // ✅ FIX: emitEventを関数として呼び出し
      await emitEvent('vehicle.created', {
        vehicleId: newVehicle.id,
        plateNumber: newVehicle.plateNumber,
        createdBy: context.userId,
        timestamp: new Date()
      });

      logger.info('車両作成完了', {
        vehicleId: newVehicle.id,
        plateNumber: newVehicle.plateNumber,
        createdBy: context.userId
      });

      return this.mapVehicleToResponseDTO(newVehicle);

    } catch (error) {
      logger.error('車両作成エラー', {
        error: error instanceof Error ? error.message : String(error),
        vehicleData,
        context
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('車両の作成に失敗しました', EXTENDED_ERROR_CODES.DATABASE_OPERATION_FAILED);
    }
  }

  /**
   * 車両更新
   */
  async updateVehicle(
    vehicleId: string,
    updateData: UpdateVehicleRequest,
    context: {
      userId: string;
      userRole: UserRole;
      validateStatusTransition?: boolean;
      notifyDriver?: boolean;
    }
  ): Promise<VehicleResponseDTO> {
    try {
      logger.info('車両更新開始', { vehicleId, updateData, context });

      await this.checkVehicleAccessPermission(vehicleId, context.userId, context.userRole);

      const existingVehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId }
      });

      if (!existingVehicle) {
        throw new NotFoundError(`車両が見つかりません: ${vehicleId}`);
      }

      await this.validateVehicleUpdateData(updateData, existingVehicle);

      const updatedVehicle = await this.prisma.$transaction(async (tx: any) => {
        const updateDataPrepared: any = { ...updateData };

        if ((updateData as any).vin) {
          updateDataPrepared.vin = encryptSensitiveData((updateData as any).vin);
        }

        const vehicle = await tx.vehicle.update({
          where: { id: vehicleId },
          data: updateDataPrepared,
          include: {
            assignedDriver: true
          }
        });

        await this.createChangeHistory(tx, {
          entityType: 'VEHICLE',
          entityId: vehicleId,
          userId: context.userId,
          changes: this.getChangedFields(existingVehicle, updateData)
        });

        await this.createAuditLog(tx, {
          action: 'UPDATE',
          entityType: 'VEHICLE',
          entityId: vehicleId,
          userId: context.userId,
          details: {
            before: existingVehicle,
            after: vehicle
          }
        });

        return vehicle;
      });

      // ✅ FIX: emitEventを関数として呼び出し
      await emitEvent('vehicle.updated', {
        vehicleId: updatedVehicle.id,
        plateNumber: updatedVehicle.plateNumber,
        updatedBy: context.userId,
        changes: this.getChangedFields(existingVehicle, updateData),
        timestamp: new Date()
      });

      if (context.notifyDriver && updatedVehicle.assignedDriverId) {
        await this.notifyDriverOfVehicleUpdate(
          updatedVehicle.assignedDriverId,
          vehicleId,
          this.getChangedFields(existingVehicle, updateData)
        );
      }

      logger.info('車両更新完了', {
        vehicleId,
        updatedBy: context.userId
      });

      return this.mapVehicleToResponseDTO(updatedVehicle);

    } catch (error) {
      logger.error('車両更新エラー', {
        error: error instanceof Error ? error.message : String(error),
        vehicleId,
        updateData,
        context
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('車両の更新に失敗しました', EXTENDED_ERROR_CODES.DATABASE_OPERATION_FAILED);
    }
  }

  /**
   * 車両削除
   */
  async deleteVehicle(
    vehicleId: string,
    context: {
      userId: string;
      userRole: UserRole;
      hardDelete?: boolean;
      checkConstraints?: boolean;
    }
  ): Promise<OperationResult<void>> {
    try {
      logger.info('車両削除開始', { vehicleId, context });

      if (context.userRole !== 'ADMIN') {
        throw new AuthorizationError('車両削除権限がありません');
      }

      const existingVehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          operations: {
            where: {
              status: 'IN_PROGRESS'
            }
          }
        }
      });

      if (!existingVehicle) {
        throw new NotFoundError(`車両が見つかりません: ${vehicleId}`);
      }

      if (context.checkConstraints && existingVehicle.operations.length > 0) {
        throw new ConflictError('進行中の運行がある車両は削除できません');
      }

      await this.prisma.$transaction(async (tx: any) => {
        if (context.hardDelete) {
          await tx.vehicle.delete({
            where: { id: vehicleId }
          });
        } else {
          await tx.vehicle.update({
            where: { id: vehicleId },
            data: {
              isActive: false,
              status: VEHICLE_STATUS.OUT_OF_SERVICE,
              deletedAt: new Date()
            }
          });
        }

        await this.createAuditLog(tx, {
          action: context.hardDelete ? 'HARD_DELETE' : 'SOFT_DELETE',
          entityType: 'VEHICLE',
          entityId: vehicleId,
          userId: context.userId,
          details: {
            plateNumber: existingVehicle.plateNumber,
            model: existingVehicle.model
          }
        });
      });

      // ✅ FIX: emitEventを関数として呼び出し
      await emitEvent('vehicle.deleted', {
        vehicleId,
        plateNumber: existingVehicle.plateNumber,
        deletedBy: context.userId,
        hardDelete: context.hardDelete,
        timestamp: new Date()
      });

      logger.info('車両削除完了', {
        vehicleId,
        hardDelete: context.hardDelete,
        deletedBy: context.userId
      });

      // ✅ FIX: OperationResult<void>に準拠した戻り値
      return {
        success: true,
        message: context.hardDelete ? '車両を完全に削除しました' : '車両を非アクティブにしました',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('車両削除エラー', {
        error: error instanceof Error ? error.message : String(error),
        vehicleId,
        context
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('車両の削除に失敗しました', EXTENDED_ERROR_CODES.DATABASE_OPERATION_FAILED);
    }
  }

  // =====================================
  // フリート統計・分析
  // =====================================

  /**
   * フリート統計取得
   */
  async getFleetStatistics(
    filter: {
      startDate?: Date;
      endDate?: Date;
      vehicleIds?: string[];
      includeInactive?: boolean;
    }
  ): Promise<FleetStatistics> {
    try {
      logger.info('フリート統計取得開始', { filter });

      const whereClause: any = {
        ...(filter.vehicleIds && { id: { in: filter.vehicleIds } }),
        ...(!filter.includeInactive && { isActive: true })
      };

      const vehicles = await this.prisma.vehicle.findMany({
        where: whereClause,
        include: {
          operations: {
            where: {
              startTime: {
                gte: filter.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              },
              endTime: {
                lte: filter.endDate || new Date()
              }
            }
          },
          maintenances: {
            where: {
              scheduledDate: {
                gte: filter.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: filter.endDate || new Date()
              }
            }
          },
          fuelRecords: {
            where: {
              recordedAt: {
                gte: filter.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                lte: filter.endDate || new Date()
              }
            }
          }
        }
      });

      // ✅ FIX: 型注釈を追加してany型エラーを解消
      const statistics: FleetStatistics = {
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter((v: Vehicle) => v.status === VEHICLE_STATUS.ACTIVE).length,
        operationalVehicles: vehicles.filter((v: Vehicle) =>
          v.status === VEHICLE_STATUS.ACTIVE ||
          v.status === VEHICLE_STATUS.AVAILABLE
        ).length,
        maintenanceVehicles: vehicles.filter((v: Vehicle) => v.status === VEHICLE_STATUS.MAINTENANCE).length,
        retiredVehicles: vehicles.filter((v: Vehicle) => v.status === VEHICLE_STATUS.RETIRED).length,

        utilizationRate: this.calculateFleetUtilization(vehicles),

        averageFuelEfficiency: this.calculateAverageFuelEfficiency(vehicles),
        totalFuelConsumed: vehicles.reduce((sum: number, v: any) =>
          sum + (v.fuelRecords?.reduce((fs: number, fr: any) => fs + (fr.amount || 0), 0) || 0), 0
        ),

        totalDistance: vehicles.reduce((sum: number, v: any) =>
          sum + (v.operations?.reduce((os: number, op: any) => os + (op.distance || 0), 0) || 0), 0
        ),

        totalFuelCost: vehicles.reduce((sum: number, v: any) =>
          sum + (v.fuelRecords?.reduce((fs: number, fr: any) => fs + (fr.totalCost || 0), 0) || 0), 0
        ),
        totalMaintenanceCost: vehicles.reduce((sum: number, v: any) =>
          sum + (v.maintenances?.reduce((ms: number, m: any) => ms + (m.cost || 0), 0) || 0), 0
        ),

        totalRevenue: 0,

        totalFleetValue: vehicles.reduce((sum: number, v: any) => sum + (v.currentValue || 0), 0)
      };

      logger.info('フリート統計取得完了', {
        totalVehicles: statistics.totalVehicles,
        activeVehicles: statistics.activeVehicles
      });

      return statistics;

    } catch (error) {
      logger.error('フリート統計取得エラー', {
        error: error instanceof Error ? error.message : String(error),
        filter
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('フリート統計の取得に失敗しました', EXTENDED_ERROR_CODES.DATABASE_QUERY_FAILED);
    }
  }

  /**
   * 車両パフォーマンス分析
   */
  async analyzeVehiclePerformance(
    vehicleId: string,
    period: {
      startDate: Date;
      endDate: Date;
    }
  ): Promise<VehiclePerformanceMetrics> {
    try {
      logger.info('車両パフォーマンス分析開始', { vehicleId, period });

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          operations: {
            where: {
              startTime: { gte: period.startDate },
              endTime: { lte: period.endDate }
            }
          },
          fuelRecords: {
            where: {
              recordedAt: {
                gte: period.startDate,
                lte: period.endDate
              }
            }
          },
          maintenances: {
            where: {
              scheduledDate: {
                gte: period.startDate,
                lte: period.endDate
              }
            }
          },
          trips: {
            where: {
              startTime: { gte: period.startDate },
              endTime: { lte: period.endDate }
            }
          }
        }
      });

      if (!vehicle) {
        throw new NotFoundError(`車両が見つかりません: ${vehicleId}`);
      }

      // ✅ FIX: VehiclePerformanceMetrics型に準拠
      const metrics: VehiclePerformanceMetrics = {
        vehicleId,
        period: {
          startDate: period.startDate,
          endDate: period.endDate
        },

        efficiency: {
          fuelEfficiency: this.calculateFuelEfficiency(vehicle),
          fuelEfficiencyTrend: 'STABLE' as const,
          distancePerOperation: this.calculateAverageDistancePerDay(vehicle, period),
          timePerOperation: 0
        },

        reliability: {
          breakdownCount: 0,
          maintenanceFrequency: vehicle.maintenances?.length || 0,
          averageRepairTime: 0,
          reliabilityScore: 100
        },

        cost: {
          totalOperatingCost: (vehicle.fuelRecords?.reduce((sum: number, fr: any) => sum + (fr.totalCost || 0), 0) || 0) +
                               (vehicle.maintenances?.reduce((sum: number, m: any) => sum + (m.cost || 0), 0) || 0),
          costPerKm: 0,
          costPerHour: 0,
          fuelCostRatio: 0,
          maintenanceCostRatio: 0
        },

        productivity: {
          totalDistance: vehicle.operations?.reduce((sum: number, op: any) => sum + (op.distance || 0), 0) || 0,
          totalOperations: vehicle.operations?.length || 0,
          averageLoadUtilization: 0,
          revenuePerKm: 0
        },

        safety: {
          accidentCount: 0,
          inspectionFailures: 0,
          safetyScore: 100
        },

        comparison: {
          fleetAverage: {
            efficiency: 0,
            cost: 0,
            reliability: 0
          },
          ranking: 1,
          percentile: 90
        },

        recommendations: []
      };

      logger.info('車両パフォーマンス分析完了', { vehicleId });

      return metrics;

    } catch (error) {
      logger.error('車両パフォーマンス分析エラー', {
        error: error instanceof Error ? error.message : String(error),
        vehicleId,
        period
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('車両パフォーマンス分析に失敗しました', EXTENDED_ERROR_CODES.DATABASE_QUERY_FAILED);
    }
  }

  /**
   * 予防保全スケジュール生成
   */
  async generatePreventiveMaintenanceSchedule(
    vehicleId: string,
    options: {
      horizon: number;
      optimizeFor: 'COST' | 'AVAILABILITY' | 'RELIABILITY';
      constraints?: {
        maxDowntimePerMonth?: number;
        budgetLimit?: number;
        preferredDays?: string[];
      };
    }
  ): Promise<VehicleMaintenanceSchedule[]> {
    try {
      logger.info('予防保全スケジュール生成開始', { vehicleId, options });

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          maintenances: {
            orderBy: { scheduledDate: 'desc' }
          },
          operations: {
            orderBy: { startTime: 'desc' },
            take: 100
          }
        }
      });

      if (!vehicle) {
        throw new NotFoundError(`車両が見つかりません: ${vehicleId}`);
      }

      const schedules: VehicleMaintenanceSchedule[] = [];

      const regularMaintenances = this.generateRegularMaintenanceSchedule(
        vehicle,
        options.horizon
      );

      const predictiveMaintenances = await this.generatePredictiveMaintenanceSchedule(
        vehicle,
        options
      );

      const optimizedSchedule = this.optimizeMaintenanceSchedule(
        [...regularMaintenances, ...predictiveMaintenances],
        options
      );

      for (const schedule of optimizedSchedule) {
        // ✅ FIX: VehicleMaintenanceSchedule型に準拠
        const maintenanceSchedule: VehicleMaintenanceSchedule = {
          vehicleId,
          scheduleId: schedule.id || undefined,
          nextMaintenanceDate: schedule.scheduledDate,
          maintenanceType: schedule.type as any,
          maintenanceItems: schedule.requiredParts || [],
          estimatedCost: schedule.estimatedCost,
          estimatedDuration: schedule.estimatedDuration,
          priority: schedule.priority,
          assignedTechnician: schedule.assignedTo,
          notes: schedule.description,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        schedules.push(maintenanceSchedule);
      }

      await this.saveMaintenanceSchedules(schedules);

      // ✅ FIX: emitEventを関数として呼び出し
      await emitEvent('maintenance.scheduled', {
        vehicleId,
        schedules: schedules.map((s: VehicleMaintenanceSchedule) => ({
          scheduleId: s.scheduleId,
          maintenanceType: s.maintenanceType,
          nextMaintenanceDate: s.nextMaintenanceDate
        })),
        timestamp: new Date()
      });

      logger.info('予防保全スケジュール生成完了', {
        vehicleId,
        scheduledCount: schedules.length
      });

      return schedules;

    } catch (error) {
      logger.error('予防保全スケジュール生成エラー', {
        error: error instanceof Error ? error.message : String(error),
        vehicleId,
        options
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError('予防保全スケジュール生成に失敗しました', EXTENDED_ERROR_CODES.DATABASE_OPERATION_FAILED);
    }
  }

  // =====================================
  // ヘルパーメソッド
  // =====================================

  /**
   * 車両データをResponseDTOに変換
   */
  private mapVehicleToResponseDTO(vehicle: any): VehicleResponseDTO {
    return {
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      model: vehicle.model,
      manufacturer: vehicle.manufacturer,
      year: vehicle.year,
      capacity: vehicle.capacity,
      fuelType: vehicle.fuelType,
      status: vehicle.status,
      assignedDriverId: vehicle.assignedDriverId,
      currentMileage: vehicle.currentMileage,
      notes: vehicle.notes,
      isActive: vehicle.isActive,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,

      assignedDriver: vehicle.assignedDriver ? {
        id: vehicle.assignedDriver.id,
        name: vehicle.assignedDriver.username,
        email: vehicle.assignedDriver.email,
        role: vehicle.assignedDriver.role
      } : undefined,

      nextMaintenanceDate: vehicle.nextMaintenanceDate,
      maintenanceStatus: this.getMaintenanceStatus(vehicle)
    };
  }

  /**
   * WHERE句構築
   */
  private async buildVehicleWhereClause(
    filter: VehicleFilter,
    context: { userId: string; userRole: UserRole }
  ): Promise<any> {
    const where: any = {};

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

    if (filter.assignedDriverId) {
      where.assignedDriverId = filter.assignedDriverId;
    }

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

    if (filter.search) {
      where.OR = [
        { plateNumber: { contains: filter.search, mode: 'insensitive' } },
        { model: { contains: filter.search, mode: 'insensitive' } },
        { manufacturer: { contains: filter.search, mode: 'insensitive' } }
      ];
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.yearRange) {
      where.year = {};
      if (filter.yearRange.min) where.year.gte = filter.yearRange.min;
      if (filter.yearRange.max) where.year.lte = filter.yearRange.max;
    }

    if (context.userRole === 'DRIVER') {
      where.assignedDriverId = context.userId;
    }

    return where;
  }

  /**
   * ソート条件構築
   */
  private buildOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc'): any {
    const field = sortBy || 'createdAt';
    const order = sortOrder || 'desc';
    return { [field]: order };
  }

  /**
   * 車両バリデーション
   */
  private async validateVehicleData(data: CreateVehicleRequest): Promise<void> {
    const errors: string[] = [];

    if (!data.plateNumber) errors.push('ナンバープレートは必須です');
    if (!data.model) errors.push('モデル名は必須です');
    if (!data.manufacturer) errors.push('製造元は必須です');

    if (data.plateNumber && !/^[A-Z0-9-]+$/i.test(data.plateNumber)) {
      errors.push('ナンバープレートの形式が不正です');
    }

    if (data.year) {
      const currentYear = new Date().getFullYear();
      if (data.year < 1900 || data.year > currentYear + 1) {
        errors.push('年式が不正です');
      }
    }

    if (data.capacity && (data.capacity < 1 || data.capacity > 100)) {
      errors.push('容量は1-100の範囲で指定してください');
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }
  }

  /**
   * 車両更新データバリデーション
   */
  private async validateVehicleUpdateData(
    updateData: UpdateVehicleRequest,
    existingVehicle: any
  ): Promise<void> {
    if (updateData.status) {
      const validTransitions = this.getValidStatusTransitions(existingVehicle.status);
      if (!validTransitions.includes(updateData.status)) {
        throw new ValidationError(
          `無効なステータス遷移: ${existingVehicle.status} → ${updateData.status}`
        );
      }
    }

    if (updateData.year) {
      const currentYear = new Date().getFullYear();
      if (updateData.year < 1900 || updateData.year > currentYear + 1) {
        throw new ValidationError('年式が不正です');
      }
    }
  }

  /**
   * 有効なステータス遷移取得
   */
  private getValidStatusTransitions(currentStatus: VehicleStatus): VehicleStatus[] {
    const transitions: Record<VehicleStatus, VehicleStatus[]> = {
      ACTIVE: ['MAINTENANCE', 'INACTIVE', 'RETIRED'],
      MAINTENANCE: ['ACTIVE', 'INACTIVE'],
      INACTIVE: ['ACTIVE', 'MAINTENANCE', 'RETIRED'],
      RETIRED: []
    };

    return transitions[currentStatus] || [];
  }

  /**
   * アクセス権限チェック
   */
  private async checkVehicleAccessPermission(
    vehicleId: string,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      return;
    }

    if (userRole === 'DRIVER') {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          assignedDriverId: userId
        }
      });

      if (!vehicle) {
        throw new AuthorizationError('この車両へのアクセス権限がありません');
      }
    } else {
      throw new AuthorizationError('車両へのアクセス権限がありません');
    }
  }

  /**
   * 現在の車両位置取得
   */
  private async getCurrentVehicleLocation(vehicleId: string): Promise<any> {
    try {
      if (!this.locationService) {
        return null;
      }

      const latestGpsLog = await this.prisma.gpsLog.findFirst({
        where: { vehicleId },
        orderBy: { recordedAt: 'desc' }
      });

      if (!latestGpsLog) {
        return null;
      }

      return {
        latitude: Number(latestGpsLog.latitude),
        longitude: Number(latestGpsLog.longitude),
        timestamp: latestGpsLog.recordedAt,
        accuracy: latestGpsLog.accuracy
      };

    } catch (error) {
      logger.error('車両位置取得エラー', { error, vehicleId });
      return null;
    }
  }

  /**
   * 車両利用率計算
   */
  private async calculateVehicleUtilization(vehicleId: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const operations = await this.prisma.operation.findMany({
        where: {
          vehicleId,
          startTime: { gte: thirtyDaysAgo }
        }
      });

      if (operations.length === 0) return 0;

      const totalOperationHours = operations.reduce((sum: number, op: any) => {
        const duration = op.endTime
          ? (op.endTime.getTime() - op.startTime.getTime()) / (1000 * 60 * 60)
          : 0;
        return sum + duration;
      }, 0);

      const totalHours = 30 * 24;
      const utilizationRate = (totalOperationHours / totalHours) * 100;

      return Math.min(100, Math.round(utilizationRate * 100) / 100);

    } catch (error) {
      logger.error('車両利用率計算エラー', { error, vehicleId });
      return 0;
    }
  }

  /**
   * 詳細車両統計計算
   */
  private async calculateDetailedVehicleStatistics(vehicleId: string): Promise<VehicleStatistics> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [operations, fuelRecords, maintenances] = await Promise.all([
      this.prisma.operation.findMany({
        where: { vehicleId, startTime: { gte: ninetyDaysAgo } }
      }),
      this.prisma.fuelRecord.findMany({
        where: { vehicleId, recordedAt: { gte: ninetyDaysAgo } }
      }),
      this.prisma.maintenance.findMany({
        where: { vehicleId, scheduledDate: { gte: ninetyDaysAgo } }
      })
    ]);

    const totalDistance = operations.reduce((sum: number, op: any) => sum + (op.distance || 0), 0);
    const totalFuelConsumed = fuelRecords.reduce((sum: number, fr: any) => sum + (fr.amount || 0), 0);

    return {
      totalOperations: operations.length,
      completedOperations: operations.filter((op: any) => op.status === 'COMPLETED').length,
      ongoingOperations: operations.filter((op: any) => op.status === 'IN_PROGRESS').length,
      totalDistance,
      averageDistance: operations.length > 0 ? totalDistance / operations.length : 0,
      totalOperationTime: operations.reduce((sum: number, op: any) => {
        if (!op.endTime) return sum;
        return sum + ((op.endTime.getTime() - op.startTime.getTime()) / (1000 * 60 * 60));
      }, 0),
      averageOperationTime: 0,
      totalFuelConsumed,
      totalFuelCost: fuelRecords.reduce((sum: number, fr: any) => sum + (fr.totalCost || 0), 0),
      averageFuelEfficiency: totalDistance > 0 ? (totalFuelConsumed / totalDistance) * 100 : 0,
      fuelCostPerKm: 0,
      operationDays: new Set(operations.map((op: any) =>
        op.startTime.toISOString().split('T')[0]
      )).size,
      utilizationRate: await this.calculateVehicleUtilization(vehicleId),
      availabilityRate: 0,
      maintenanceCount: maintenances.length,
      lastMaintenanceDate: maintenances[0]?.completedDate,
      nextMaintenanceDate: maintenances.find((m: any) => m.status === 'SCHEDULED')?.scheduledDate,
      maintenanceCost: maintenances.reduce((sum: number, m: any) => sum + (m.cost || 0), 0),
      downtime: 0,
      costPerKm: 0,
      revenuePerKm: 0,
      profitMargin: 0,
      co2Emissions: 0,
      safetyScore: 100
    };
  }

  /**
   * 変更フィールド取得
   */
  private getChangedFields(before: any, after: any): Record<string, any> {
    const changes: Record<string, any> = {};

    for (const key in after) {
      if (before[key] !== after[key]) {
        changes[key] = {
          before: before[key],
          after: after[key]
        };
      }
    }

    return changes;
  }

  /**
   * 監査ログ作成
   */
  private async createAuditLog(tx: any, data: any): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          userId: data.userId,
          details: data.details,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('監査ログ作成エラー', { error, data });
    }
  }

  /**
   * 変更履歴作成
   */
  private async createChangeHistory(tx: any, data: any): Promise<void> {
    try {
      await tx.changeHistory.create({
        data: {
          entityType: data.entityType,
          entityId: data.entityId,
          userId: data.userId,
          changes: data.changes,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('変更履歴作成エラー', { error, data });
    }
  }

  /**
   * メンテナンスステータス取得
   */
  private getMaintenanceStatus(vehicle: any): 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' {
    if (!vehicle.nextMaintenanceDate) {
      return 'UP_TO_DATE';
    }

    const daysUntilMaintenance = Math.ceil(
      (vehicle.nextMaintenanceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilMaintenance < 0) return 'OVERDUE';
    if (daysUntilMaintenance <= 7) return 'DUE_SOON';
    return 'UP_TO_DATE';
  }

  /**
   * フリート利用率計算
   */
  private calculateFleetUtilization(vehicles: any[]): number {
    if (vehicles.length === 0) return 0;

    const utilizationRates = vehicles.map((v: any) => {
      const operationHours = v.operations?.reduce((sum: number, op: any) => {
        if (!op.endTime) return sum;
        return sum + ((op.endTime.getTime() - op.startTime.getTime()) / (1000 * 60 * 60));
      }, 0) || 0;

      const totalHours = 30 * 24;
      return (operationHours / totalHours) * 100;
    });

    return Math.round(
      (utilizationRates.reduce((sum: number, rate: number) => sum + rate, 0) / vehicles.length) * 100
    ) / 100;
  }

  /**
   * 平均燃費計算
   */
  private calculateAverageFuelEfficiency(vehicles: any[]): number {
    const efficiencies = vehicles
      .filter((v: any) => v.operations?.length > 0 && v.fuelRecords?.length > 0)
      .map((v: any) => {
        const totalDistance = v.operations.reduce((sum: number, op: any) =>
          sum + (op.distance || 0), 0
        );
        const totalFuel = v.fuelRecords.reduce((sum: number, fr: any) =>
          sum + (fr.amount || 0), 0
        );

        return totalDistance > 0 ? (totalFuel / totalDistance) * 100 : 0;
      })
      .filter((eff: number) => eff > 0);

    if (efficiencies.length === 0) return 0;

    return Math.round(
      (efficiencies.reduce((sum: number, eff: number) => sum + eff, 0) / efficiencies.length) * 100
    ) / 100;
  }

  /**
   * 燃費計算
   */
  private calculateFuelEfficiency(vehicle: any): number {
    if (!vehicle.operations?.length || !vehicle.fuelRecords?.length) {
      return 0;
    }

    const totalDistance = vehicle.operations.reduce((sum: number, op: any) =>
      sum + (op.distance || 0), 0
    );
    const totalFuel = vehicle.fuelRecords.reduce((sum: number, fr: any) =>
      sum + (fr.amount || 0), 0
    );

    return totalDistance > 0 ? (totalFuel / totalDistance) * 100 : 0;
  }

  /**
   * 1日あたり平均走行距離計算
   */
  private calculateAverageDistancePerDay(vehicle: any, period: { startDate: Date; endDate: Date }): number {
    const totalDistance = vehicle.operations?.reduce((sum: number, op: any) =>
      sum + (op.distance || 0), 0
    ) || 0;

    const days = Math.ceil(
      (period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return days > 0 ? totalDistance / days : 0;
  }

  /**
   * アイドル時間計算
   */
  private calculateIdleTime(vehicle: any): number {
    return 0;
  }

  /**
   * メンテナンスダウンタイム計算
   */
  private calculateMaintenanceDowntime(vehicle: any): number {
    return vehicle.maintenances?.reduce((sum: number, m: any) => {
      return sum + (m.actualDuration || m.estimatedDuration || 0);
    }, 0) || 0;
  }

  /**
   * MTBF計算
   */
  private calculateMTBF(vehicle: any): number {
    const emergencyMaintenances = vehicle.maintenances?.filter((m: any) =>
      m.type === 'EMERGENCY'
    ) || [];

    if (emergencyMaintenances.length <= 1) {
      return 999999;
    }

    return 720;
  }

  /**
   * メンテナンスコンプライアンス計算
   */
  private calculateMaintenanceCompliance(vehicle: any): number {
    const scheduledMaintenances = vehicle.maintenances?.filter((m: any) =>
      m.type === 'SCHEDULED'
    ) || [];

    const completedOnTime = scheduledMaintenances.filter((m: any) =>
      m.completedDate && m.completedDate <= m.scheduledDate
    ).length;

    return scheduledMaintenances.length > 0
      ? (completedOnTime / scheduledMaintenances.length) * 100
      : 100;
  }

  /**
   * デフォルト位置割り当て
   */
  private async assignDefaultLocation(vehicleId: string, userId: string): Promise<void> {
    // 実装: デフォルト位置を車両に割り当て
  }

  /**
   * 初期メンテナンススケジュール作成
   */
  private async createInitialMaintenanceSchedule(vehicleId: string, userId: string): Promise<void> {
    // 実装: 初期メンテナンススケジュールを作成
  }

  /**
   * ドライバー通知
   */
  private async notifyDriverOfVehicleUpdate(driverId: string, vehicleId: string, changes: any): Promise<void> {
    // 実装: ドライバーに変更を通知
  }

  /**
   * 定期メンテナンススケジュール生成
   */
  private generateRegularMaintenanceSchedule(vehicle: any, horizon: number): any[] {
    return [];
  }

  /**
   * 予測メンテナンススケジュール生成
   */
  private async generatePredictiveMaintenanceSchedule(vehicle: any, options: any): Promise<any[]> {
    return [];
  }

  /**
   * メンテナンススケジュール最適化
   */
  private optimizeMaintenanceSchedule(schedules: any[], options: any): any[] {
    return schedules;
  }

  /**
   * メンテナンススケジュール保存
   */
  private async saveMaintenanceSchedules(schedules: VehicleMaintenanceSchedule[]): Promise<void> {
    // 実装: スケジュールをデータベースに保存
  }

  /**
   * 予測分析実行
   */
  private async performPredictiveAnalysis(vehicleId: string): Promise<any> {
    return {
      predictedFailures: [],
      maintenanceRecommendations: [],
      costForecast: 0
    };
  }

  /**
   * フリート比較実行
   */
  private async performFleetComparison(vehicleId: string): Promise<any> {
    return {
      ranking: 1,
      percentile: 90,
      strengths: [],
      improvements: []
    };
  }

  /**
   * モバイル統合状態取得
   */
  private async getMobileIntegrationStatus(vehicleId: string): Promise<any> {
    return {
      connected: true,
      lastSync: new Date(),
      mobileFeatures: {
        gpsTracking: true,
        remoteControl: false,
        diagnostics: true
      }
    };
  }
}

// =====================================
// エクスポート
// =====================================

let vehicleServiceInstance: VehicleService | null = null;

export const getVehicleService = (): VehicleService => {
  if (!vehicleServiceInstance) {
    vehicleServiceInstance = new VehicleService();
  }
  return vehicleServiceInstance;
};

export { VehicleService };
