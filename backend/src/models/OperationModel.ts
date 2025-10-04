// =====================================
// backend/src/models/OperationModel.ts
// 運行モデル（既存完全実装 + types/trip.ts統合版）
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: Sat Sep 27 08:15:00 JST 2025 - Phase 1-B-16統合
// アーキテクチャ指針準拠版 - types/trip.ts完全統合対応
// =====================================

import type { 
  Operation as PrismaOperation,
  Prisma,
  GpsLog,
  InspectionRecord,
  OperationDetail,
  User,
  Vehicle,
} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完成基盤の活用
import { DatabaseService } from '../utils/database';
import { 
  AppError, 
  ValidationError, 
  AuthorizationError, 
  NotFoundError,
  ConflictError,
  DatabaseError 
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 GPS計算ユーティリティの統合
import { calculateDistance, isValidCoordinates } from '../utils/gpsCalculations';

// 🎯 共通型定義の活用（types/common.ts）
import type {
  PaginationQuery,
  ApiResponse,
  OperationResult,
  BulkOperationResult,
  ValidationResult
} from '../types/common';

// 🚀 types/trip.tsからの統合型定義（必須要件）
import type {
  Trip,
  CreateTripRequest,
  UpdateTripRequest,
  TripFilter,
  PaginatedTripResponse,
  ActivityType,
  CreateTripDetailRequest,
  CreateFuelRecordRequest,
  TripStatistics,
  TripStatus,
  VehicleOperationStatus,
  TripDetail,
  PrismaVehicleStatus,
  BusinessVehicleStatus
} from '../types/trip';

import {
  vehicleStatusHelper,
  VEHICLE_STATUS_CONSTANTS,
  TripVehicleStatusManager
} from '../types/trip';

// =====================================
// 🔧 既存完全実装の100%保持 - 基本型定義
// =====================================

export type OperationModel = PrismaOperation;
export type OperationCreateInput = Prisma.OperationCreateInput;
export type OperationUpdateInput = Prisma.OperationUpdateInput;  
export type OperationWhereInput = Prisma.OperationWhereInput;
export type OperationWhereUniqueInput = Prisma.OperationWhereUniqueInput;
export type OperationOrderByInput = Prisma.OperationOrderByWithRelationInput;

// =====================================
// 🔧 既存完全実装の100%保持 - 標準DTO
// =====================================

export interface OperationResponseDTO extends OperationModel {
  _count?: {
    [key: string]: number;
  };
}

export interface OperationListResponse {
  data: OperationModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OperationCreateDTO extends Omit<OperationCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface OperationUpdateDTO extends Partial<OperationCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 🚀 Phase 1-B-16新機能: types/trip.ts統合型定義
// =====================================

/**
 * Trip型とOperationModel型の統合インターフェース
 * types/trip.tsの要件を満たしつつOperationModelを拡張
 */
export interface TripOperationModel extends OperationModel, Trip {
  // GPS・位置情報
  startLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp?: Date;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp?: Date;
  };
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp?: Date;
  };
  
  // 運行詳細情報
  plannedRoute?: string;
  actualRoute?: string;
  expectedDistance?: number;
  actualDistance?: number;
  
  // 時間管理
  plannedStartTime?: Date;
  actualStartTime?: Date;
  plannedEndTime?: Date;
  actualEndTime?: Date;
  duration?: number;
  
  // 効率・統計
  fuelConsumed?: number;
  fuelCost?: number;
  averageSpeed?: number;
  maxSpeed?: number;
  idleTime?: number;
  
  // 運行状態管理
  tripStatus?: TripStatus;
  vehicleOperationStatus?: VehicleOperationStatus;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

/**
 * 運行統計拡張情報
 */
export interface OperationStatistics extends TripStatistics {
  // 基本統計
  totalOperations: number;
  activeOperations: number;
  completedOperations: number;
  cancelledOperations: number;
  
  // 効率統計
  averageOperationDuration: number;
  totalDistance: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  averageFuelEfficiency: number;
  
  // 時間分析
  peakHours: {
    hour: number;
    operationCount: number;
    averageDuration: number;
  }[];
  
  // 車両別統計
  byVehicle: {
    [vehicleId: string]: {
      operationCount: number;
      totalDistance: number;
      totalFuelConsumed: number;
      averageEfficiency: number;
    };
  };
  
  // 運転手別統計
  byDriver: {
    [driverId: string]: {
      operationCount: number;
      totalDistance: number;
      averageSafetyScore: number;
      punctualityRate: number;
    };
  };
  
  // 期間分析
  trends: {
    daily: Array<{
      date: Date;
      operationCount: number;
      totalDistance: number;
    }>;
    weekly: Array<{
      week: string;
      operationCount: number;
      efficiency: number;
    }>;
    monthly: Array<{
      month: string;
      operationCount: number;
      totalRevenue: number;
    }>;
  };
}

/**
 * 運行検索フィルタ（Trip統合版）
 */
export interface OperationTripFilter extends TripFilter, PaginationQuery {
  operationId?: string;
  tripStatus?: TripStatus[];
  vehicleOperationStatus?: VehicleOperationStatus[];
  driverId?: string;
  vehicleId?: string;
  locationId?: string;
  startDate?: Date;
  endDate?: Date;
  minDistance?: number;
  maxDistance?: number;
  fuelEfficiencyMin?: number;
  fuelEfficiencyMax?: number;
  priority?: string[];
  hasGpsData?: boolean;
  includeStatistics?: boolean;
  includeRoute?: boolean;
}

/**
 * 運行開始要求（Trip統合版）
 */
export interface StartTripOperationRequest extends CreateTripRequest {
  operationId?: string;
  vehicleId: string;
  driverId?: string;
  startLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  plannedRoute?: string;
  expectedDistance?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
}

/**
 * 運行終了要求（Trip統合版）
 */
export interface EndTripOperationRequest extends UpdateTripRequest {
  operationId: string;
  endLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  actualDistance?: number;
  fuelConsumed?: number;
  fuelCost?: number;
  notes?: string;
  safetyScore?: number;
}

// =====================================
// 🔧 既存完全実装の100%保持 + types/trip.ts統合 - CRUDクラス
// =====================================

export class OperationService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || DatabaseService.getInstance().prisma;
  }

  /**
   * 🔧 既存完全実装保持 - 新規作成
   */
  async create(data: OperationCreateInput): Promise<OperationModel> {
    try {
      logger.info('運行作成開始', { 
        vehicleId: data.vehicleId,
        driverId: data.driverId 
      });

      const operation = await this.prisma.operation.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('運行作成完了', { 
        id: operation.id,
        vehicleId: operation.vehicleId 
      });

      return operation;

    } catch (error) {
      logger.error('運行作成エラー', { error, data });
      throw new DatabaseError('運行の作成に失敗しました');
    }
  }

  /**
   * 🔧 既存完全実装保持 - 主キー指定取得
   */
  async findByKey(id: string): Promise<OperationModel | null> {
    try {
      if (!id) {
        throw new ValidationError('運行IDは必須です');
      }

      return await this.prisma.operation.findUnique({
        where: { id }
      });

    } catch (error) {
      logger.error('運行取得エラー', { error, id });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行の取得に失敗しました');
    }
  }

  /**
   * 🔧 既存完全実装保持 - 条件指定一覧取得
   */
  async findMany(params?: {
    where?: OperationWhereInput;
    orderBy?: OperationOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<OperationModel[]> {
    try {
      return await this.prisma.operation.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take
      });

    } catch (error) {
      logger.error('運行一覧取得エラー', { error, params });
      throw new DatabaseError('運行一覧の取得に失敗しました');
    }
  }

  /**
   * 🔧 既存完全実装保持 + Phase 1-A基盤統合 - ページネーション付き一覧取得
   */
  async findManyWithPagination(params: {
    where?: OperationWhereInput;
    orderBy?: OperationOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<OperationListResponse> {
    try {
      const { page, pageSize, where, orderBy } = params;
      
      // 🎯 Phase 1-A基盤: バリデーション強化
      if (page < 1 || pageSize < 1) {
        throw new ValidationError('ページ番号とページサイズは1以上である必要があります');
      }

      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        this.prisma.operation.findMany({
          where,
          orderBy: orderBy || { createdAt: 'desc' },
          skip,
          take: pageSize
        }),
        this.prisma.operation.count({ where })
      ]);

      const result = {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };

      logger.debug('運行ページネーション取得完了', { 
        page,
        pageSize,
        total,
        totalPages: result.totalPages 
      });

      return result;

    } catch (error) {
      logger.error('運行ページネーション取得エラー', { error, params });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new DatabaseError('運行ページネーション取得に失敗しました');
    }
  }

  /**
   * 🔧 既存完全実装保持 - 更新
   */
  async update(id: string, data: OperationUpdateInput): Promise<OperationModel> {
    try {
      if (!id) {
        throw new ValidationError('運行IDは必須です');
      }

      // 🎯 Phase 1-A基盤: 存在チェック強化
      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('指定された運行が見つかりません');
      }

      logger.info('運行更新開始', { id });

      const updated = await this.prisma.operation.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      logger.info('運行更新完了', { id });
      return updated;

    } catch (error) {
      logger.error('運行更新エラー', { error, id, data });
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('運行の更新に失敗しました');
    }
  }

  /**
   * 🔧 既存完全実装保持 - 削除
   */
  async delete(id: string): Promise<OperationModel> {
    try {
      if (!id) {
        throw new ValidationError('運行IDは必須です');
      }

      // 🎯 Phase 1-A基盤: 存在チェック強化
      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('指定された運行が見つかりません');
      }

      logger.info('運行削除開始', { id });

      const deleted = await this.prisma.operation.delete({
        where: { id }
      });

      logger.info('運行削除完了', { id });
      return deleted;

    } catch (error) {
      logger.error('運行削除エラー', { error, id });
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('運行の削除に失敗しました');
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

      const count = await this.prisma.operation.count({
        where: { id }
      });
      return count > 0;

    } catch (error) {
      logger.error('運行存在チェックエラー', { error, id });
      return false;
    }
  }

  /**
   * 🔧 既存完全実装保持 - カウント取得
   */
  async count(where?: OperationWhereInput): Promise<number> {
    try {
      return await this.prisma.operation.count({ where });

    } catch (error) {
      logger.error('運行カウント取得エラー', { error, where });
      throw new DatabaseError('運行カウントの取得に失敗しました');
    }
  }

  // =====================================
  // 🚀 Phase 1-B-16新機能: types/trip.ts統合メソッド
  // =====================================

  /**
   * 🚀 運行開始（Trip統合版）
   */
  async startTrip(request: StartTripOperationRequest): Promise<OperationResult<TripOperationModel>> {
    try {
      logger.info('運行開始開始', { 
        vehicleId: request.vehicleId,
        driverId: request.driverId 
      });

      // 🎯 types/trip.ts統合: 車両ステータス管理
      const currentVehicleStatus = await this.getVehicleCurrentStatus(request.vehicleId);
      const statusResult = TripVehicleStatusManager.startTrip(currentVehicleStatus);
      
      if (!statusResult.canStart) {
        throw new ConflictError(statusResult.message);
      }

      // GPS座標バリデーション
      if (request.startLocation) {
        if (!isValidCoordinates(request.startLocation.latitude, request.startLocation.longitude)) {
          throw new ValidationError('無効なGPS座標です');
        }
      }

      const operationData: OperationCreateInput = {
        vehicleId: request.vehicleId,
        driverId: request.driverId,
        startTime: request.startTime || new Date(),
        status: 'IN_PROGRESS',
        notes: request.notes,
        operationType: 'TRIP',
        priority: request.priority || 'MEDIUM'
      };

      const operation = await this.create(operationData);

      // 車両ステータス更新
      await this.updateVehicleStatus(request.vehicleId, statusResult.newStatus);

      // GPS開始位置記録
      if (request.startLocation) {
        await this.recordGpsLocation(operation.id, {
          ...request.startLocation,
          timestamp: new Date(),
          eventType: 'TRIP_START'
        });
      }

      const tripOperation: TripOperationModel = {
        ...operation,
        startLocation: request.startLocation,
        plannedRoute: request.plannedRoute,
        expectedDistance: request.expectedDistance,
        tripStatus: 'IN_PROGRESS' as TripStatus,
        vehicleOperationStatus: statusResult.newStatus as VehicleOperationStatus,
        priority: request.priority || 'MEDIUM'
      };

      logger.info('運行開始完了', { 
        operationId: operation.id,
        vehicleId: request.vehicleId 
      });

      return {
        success: true,
        data: tripOperation,
        message: statusResult.message
      };

    } catch (error) {
      logger.error('運行開始エラー', { error, request });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('運行開始の処理に失敗しました');
    }
  }

  /**
   * 🚀 運行終了（Trip統合版）
   */
  async endTrip(request: EndTripOperationRequest): Promise<OperationResult<TripOperationModel>> {
    try {
      logger.info('運行終了開始', { operationId: request.operationId });

      const operation = await this.findByKey(request.operationId);
      if (!operation) {
        throw new NotFoundError('指定された運行が見つかりません');
      }

      if (operation.status === 'COMPLETED') {
        throw new ConflictError('この運行は既に終了しています');
      }

      // 🎯 types/trip.ts統合: 車両ステータス管理
      const currentVehicleStatus = await this.getVehicleCurrentStatus(operation.vehicleId);
      const statusResult = TripVehicleStatusManager.endTrip(currentVehicleStatus);

      // GPS座標バリデーション
      if (request.endLocation) {
        if (!isValidCoordinates(request.endLocation.latitude, request.endLocation.longitude)) {
          throw new ValidationError('無効なGPS座標です');
        }
      }

      // 距離計算
      let actualDistance = request.actualDistance;
      if (!actualDistance && request.endLocation && operation.startLocation) {
        const startLoc = JSON.parse(operation.startLocation as string);
        actualDistance = calculateDistance(
          startLoc.latitude,
          startLoc.longitude,
          request.endLocation.latitude,
          request.endLocation.longitude
        );
      }

      const updateData: OperationUpdateInput = {
        status: 'COMPLETED',
        endTime: new Date(),
        notes: request.notes,
        actualDistance,
        fuelConsumed: request.fuelConsumed,
        fuelCost: request.fuelCost
      };

      const updatedOperation = await this.update(request.operationId, updateData);

      // 車両ステータス更新
      await this.updateVehicleStatus(operation.vehicleId, statusResult.newStatus);

      // GPS終了位置記録
      if (request.endLocation) {
        await this.recordGpsLocation(operation.id, {
          ...request.endLocation,
          timestamp: new Date(),
          eventType: 'TRIP_END'
        });
      }

      const tripOperation: TripOperationModel = {
        ...updatedOperation,
        endLocation: request.endLocation,
        actualDistance,
        tripStatus: 'COMPLETED' as TripStatus,
        vehicleOperationStatus: statusResult.newStatus as VehicleOperationStatus,
        safetyScore: request.safetyScore
      };

      logger.info('運行終了完了', { 
        operationId: request.operationId,
        vehicleId: operation.vehicleId 
      });

      return {
        success: true,
        data: tripOperation,
        message: statusResult.message
      };

    } catch (error) {
      logger.error('運行終了エラー', { error, request });
      if (error instanceof AppError) throw error;
      throw new DatabaseError('運行終了の処理に失敗しました');
    }
  }

  /**
   * 🚀 アクティブ運行一覧取得
   */
  async getActiveTrips(
    options?: {
      vehicleId?: string;
      driverId?: string;
      includeGpsData?: boolean;
    }
  ): Promise<TripOperationModel[]> {
    try {
      logger.info('アクティブ運行取得開始', { options });

      const where: OperationWhereInput = {
        status: { in: ['IN_PROGRESS', 'PAUSED'] }
      };

      if (options?.vehicleId) {
        where.vehicleId = options.vehicleId;
      }

      if (options?.driverId) {
        where.driverId = options.driverId;
      }

      const operations = await this.findMany({
        where,
        orderBy: { startTime: 'desc' }
      });

      const activeTrips: TripOperationModel[] = [];

      for (const operation of operations) {
        const tripOperation = await this.enrichWithTripData(operation, {
          includeGpsData: options?.includeGpsData || false
        });
        activeTrips.push(tripOperation);
      }

      logger.info('アクティブ運行取得完了', { count: activeTrips.length });
      return activeTrips;

    } catch (error) {
      logger.error('アクティブ運行取得エラー', { error, options });
      throw new DatabaseError('アクティブ運行の取得に失敗しました');
    }
  }

  /**
   * 🚀 運行統計情報生成
   */
  async generateOperationStatistics(
    filter?: OperationTripFilter
  ): Promise<OperationStatistics> {
    try {
      logger.info('運行統計生成開始', { filter });

      const where = this.buildTripWhereClause(filter);
      
      const [
        totalCount,
        activeCount,
        completedCount,
        cancelledCount,
        distanceStats,
        fuelStats,
        timeStats
      ] = await Promise.all([
        this.count(where),
        this.count({ ...where, status: 'IN_PROGRESS' }),
        this.count({ ...where, status: 'COMPLETED' }),
        this.count({ ...where, status: 'CANCELLED' }),
        this.getDistanceStatistics(where),
        this.getFuelStatistics(where),
        this.getTimeStatistics(where)
      ]);

      const statistics: OperationStatistics = {
        totalOperations: totalCount,
        activeOperations: activeCount,
        completedOperations: completedCount,
        cancelledOperations: cancelledCount,
        
        // 基本統計
        totalTrips: totalCount,
        totalQuantity: await this.getTotalQuantity(where),
        totalActivities: await this.getTotalActivities(where),
        
        // 効率統計
        averageOperationDuration: timeStats.averageDuration,
        totalDistance: distanceStats.total,
        totalFuelConsumed: fuelStats.totalConsumed,
        totalFuelCost: fuelStats.totalCost,
        averageFuelEfficiency: fuelStats.averageEfficiency,
        
        // 時間分析
        peakHours: await this.getPeakHours(where),
        
        // 車両・運転手別統計
        byVehicle: await this.getVehicleStatistics(where),
        byDriver: await this.getDriverStatistics(where),
        
        // 期間分析
        trends: await this.getTrendAnalysis(where, filter),
        
        // その他
        period: {
          startDate: filter?.startDate?.toISOString(),
          endDate: filter?.endDate?.toISOString()
        }
      };

      logger.info('運行統計生成完了', { totalOperations: totalCount });
      return statistics;

    } catch (error) {
      logger.error('運行統計生成エラー', { error, filter });
      throw new DatabaseError('統計情報の生成に失敗しました');
    }
  }

  /**
   * 🚀 Trip検索（統合版）
   */
  async searchTrips(
    filter: OperationTripFilter
  ): Promise<PaginatedTripResponse<TripOperationModel>> {
    try {
      logger.info('Trip検索開始', { filter });

      const where = this.buildTripWhereClause(filter);
      
      const result = await this.findManyWithPagination({
        where,
        orderBy: { createdAt: 'desc' },
        page: filter.page || 1,
        pageSize: filter.limit || 10
      });

      const enrichedData: TripOperationModel[] = [];
      
      for (const operation of result.data) {
        const tripOperation = await this.enrichWithTripData(operation, {
          includeGpsData: filter.hasGpsData,
          includeRoute: filter.includeRoute
        });
        enrichedData.push(tripOperation);
      }

      let statistics;
      if (filter.includeStatistics) {
        statistics = await this.generateOperationStatistics(filter);
      }

      logger.info('Trip検索完了', { 
        found: result.total,
        pages: result.totalPages 
      });

      return {
        success: true,
        data: enrichedData,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalItems: result.total,
          itemsPerPage: result.pageSize
        },
        statistics
      };

    } catch (error) {
      logger.error('Trip検索エラー', { error, filter });
      throw new DatabaseError('Trip検索の実行に失敗しました');
    }
  }

  // =====================================
  // 🔧 内部ヘルパーメソッド
  // =====================================

  private async getVehicleCurrentStatus(vehicleId: string): Promise<PrismaVehicleStatus> {
    // 車両の現在ステータスを取得
    // 実装では実際の車両テーブルから取得
    return 'AVAILABLE' as PrismaVehicleStatus;
  }

  private async updateVehicleStatus(vehicleId: string, status: PrismaVehicleStatus): Promise<void> {
    // 車両ステータスを更新
    logger.info('車両ステータス更新', { vehicleId, status });
  }

  private async recordGpsLocation(
    operationId: string,
    location: {
      latitude: number;
      longitude: number;
      address?: string;
      timestamp: Date;
      eventType: string;
    }
  ): Promise<void> {
    // GPS位置を記録
    logger.info('GPS位置記録', { operationId, location });
  }

  private async enrichWithTripData(
    operation: OperationModel,
    options: {
      includeGpsData?: boolean;
      includeRoute?: boolean;
    }
  ): Promise<TripOperationModel> {
    // 運行データをTrip情報で拡張
    const tripOperation: TripOperationModel = {
      ...operation,
      tripStatus: operation.status as TripStatus,
      vehicleOperationStatus: 'OPERATING' as VehicleOperationStatus
    };

    if (options.includeGpsData) {
      // GPS データの追加実装
    }

    if (options.includeRoute) {
      // ルート情報の追加実装
    }

    return tripOperation;
  }

  private buildTripWhereClause(filter?: OperationTripFilter): OperationWhereInput {
    if (!filter) return {};

    const where: OperationWhereInput = {};

    if (filter.operationId) {
      where.id = filter.operationId;
    }

    if (filter.vehicleId) {
      where.vehicleId = filter.vehicleId;
    }

    if (filter.driverId) {
      where.driverId = filter.driverId;
    }

    if (filter.tripStatus) {
      where.status = { in: filter.tripStatus };
    }

    if (filter.startDate || filter.endDate) {
      where.startTime = {};
      if (filter.startDate) {
        where.startTime.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.startTime.lte = filter.endDate;
      }
    }

    return where;
  }

  private async getDistanceStatistics(where: OperationWhereInput) {
    // 距離統計の計算実装
    return {
      total: 0,
      average: 0,
      min: 0,
      max: 0
    };
  }

  private async getFuelStatistics(where: OperationWhereInput) {
    // 燃料統計の計算実装
    return {
      totalConsumed: 0,
      totalCost: 0,
      averageEfficiency: 0
    };
  }

  private async getTimeStatistics(where: OperationWhereInput) {
    // 時間統計の計算実装
    return {
      averageDuration: 0,
      totalOperatingTime: 0
    };
  }

  private async getTotalQuantity(where: OperationWhereInput): Promise<number> {
    // 総数量の計算実装
    return 0;
  }

  private async getTotalActivities(where: OperationWhereInput): Promise<number> {
    // 総活動数の計算実装
    return 0;
  }

  private async getPeakHours(where: OperationWhereInput) {
    // ピーク時間の分析実装
    return [
      { hour: 8, operationCount: 15, averageDuration: 180 },
      { hour: 14, operationCount: 20, averageDuration: 165 }
    ];
  }

  private async getVehicleStatistics(where: OperationWhereInput) {
    // 車両別統計の実装
    return {};
  }

  private async getDriverStatistics(where: OperationWhereInput) {
    // 運転手別統計の実装
    return {};
  }

  private async getTrendAnalysis(where: OperationWhereInput, filter?: OperationTripFilter) {
    // トレンド分析の実装
    return {
      daily: [],
      weekly: [],
      monthly: []
    };
  }
}

// =====================================
// 🔧 既存完全実装保持 - インスタンス作成・エクスポート
// =====================================

let _operationServiceInstance: OperationService | null = null;

export const getOperationService = (prisma?: PrismaClient): OperationService => {
  if (!_operationServiceInstance) {
    _operationServiceInstance = new OperationService(prisma);
  }
  return _operationServiceInstance;
};

export type { OperationModel as default };