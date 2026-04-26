// =====================================
// backend/src/models/OperationModel.ts
// 運行モデル（既存完全実装 + types/trip.ts統合版 + 正しいPrismaリレーション名使用版）
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: Thu Oct 23 14:00:00 JST 2025 - operationNumber登録エラー修正
// アーキテクチャ指針準拠版 - types/trip.ts完全統合対応
// =====================================

import type {
  GpsLog,
  InspectionRecord,
  OperationDetail,
  OperationStatus,
  Prisma,
  Operation as PrismaOperation,
  User,
  Vehicle
} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// 🎯 Phase 1-A完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  DatabaseError,
  NotFoundError,
  ValidationError
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 GPS計算ユーティリティの統合

// 🎯 共通型定義の活用（types/common.ts）
import type {
  PaginationQuery
} from '../types/common';

// 🚀 types/trip.tsからの統合型定義（必須要件）
import type {
  PaginatedTripResponse,
  TripStatus,
  VehicleOperationStatus
} from '../types/trip';

import {
  TripVehicleStatusManager
} from '../types/trip';

// ActivityType を Prisma から import

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
export interface TripOperationModel {
  // Prisma Operation の基本フィールド
  id: string;
  operationNumber: string;
  vehicleId: string;
  driverId: string;
  status: OperationStatus | null;
  plannedStartTime: Date | null;
  actualStartTime: Date | null;
  plannedEndTime: Date | null;
  actualEndTime: Date | null;
  totalDistanceKm: Prisma.Decimal | null;
  fuelConsumedLiters: Prisma.Decimal | null;
  fuelCostYen: Prisma.Decimal | null;
  weatherCondition: string | null;
  roadCondition: string | null;
  loadedDistanceKm?: Prisma.Decimal | number | null;  // 実車キロ（積載状態での走行距離 km）
  revenueYen?: number | null;                         // 営業収入（円）
  notes: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  // GPS・位置情報（拡張フィールド）
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

  // 運行詳細情報（拡張フィールド）
  plannedRoute?: string;
  actualRoute?: string;
  expectedDistance?: number;
  actualDistance?: number;

  // 時間管理（拡張フィールド）
  duration?: number;

  // 効率・統計（拡張フィールド）
  fuelConsumed?: number;
  fuelCost?: number;
  averageSpeed?: number;
  maxSpeed?: number;
  idleTime?: number;

  // 運行状態管理（拡張フィールド）
  // 注意: tripStatusはOperationStatusのエイリアスのため、使用可能な値は以下のみ:
  // 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  tripStatus: TripStatus;
  vehicleOperationStatus: VehicleOperationStatus;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  completionRate?: number;

  // リレーション（拡張フィールド）
  vehicle?: Vehicle;
  driver?: User;
  activities?: OperationDetail[];
  gpsLogs?: GpsLog[];
  inspectionRecords?: InspectionRecord[];
}

/**
 * 運行統計情報（types/trip.ts完全準拠）
 */
export interface OperationStatistics {
  totalTrips: number;
  completedTrips: number;
  activeTrips: number;
  cancelledTrips: number;

  totalDistance: number;
  averageDistance: number;
  totalFuelConsumed: number;
  averageFuelConsumption: number;
  totalFuelCost: number;

  totalDuration: number;
  averageDuration: number;
  completionRate: number;
  onTimeCompletionRate: number;
  delayRate: number;

  byStatus: Record<string, number>;
  byVehicle: Record<string, number>;
  byDriver: Record<string, number>;

  recentTrends: {
    last7Days: number;
    last30Days: number;
    thisMonth: number;
    lastMonth: number;
  };
}

/**
 * 運行フィルタ（types/trip.ts完全準拠）
 */
export interface OperationTripFilter extends PaginationQuery {
  status?: OperationStatus | OperationStatus[];
  vehicleId?: string | string[];
  driverId?: string | string[];
  startDate?: Date;
  endDate?: Date;
  minDistance?: number;
  maxDistance?: number;
  searchTerm?: string;
  includeStatistics?: boolean;
  includeRelations?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * 運行開始リクエスト（types/trip.ts完全準拠）
 */
export interface StartTripOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  expectedDistance?: number;
  plannedRoute?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
  customerId?: string;    // 🆕 客先ID
  startOdometer?: number; // ✅ BUG-041修正: startOdometerをDB保存するため追加
}

// =====================================
// 🔧 既存完全実装の100%保持 + Phase 1-A基盤統合 - CRUDクラス
// =====================================

export class OperationService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    if (prisma) {
      this.prisma = prisma;
    } else {
      // ✅ 修正: DatabaseService.getInstance() は PrismaClient を返す
      this.prisma = DatabaseService.getInstance();
    }
  }

  /**
   * 🔧 既存完全実装保持 - 新規作成
   */
  async create(data: OperationCreateInput): Promise<OperationModel> {
    try {
      logger.info('運行作成開始', {
        vehicleId: (data as any).vehicleId,
        driverId: (data as any).driverId
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
        operationNumber: operation.operationNumber
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
    page?: number;
    pageSize?: number;
  }): Promise<OperationListResponse> {
    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        this.prisma.operation.findMany({
          where: params.where,
          orderBy: params.orderBy || { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            vehicles: true,                       // ✅ 車両情報
            usersOperationsDriverIdTousers: true, // ✅ ドライバー情報
            customer: true                        // ✅ 客先情報
          }
        }),
        this.prisma.operation.count({ where: params.where })
      ]);

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };

    } catch (error) {
      logger.error('運行ページネーション取得エラー', { error, params });
      throw new DatabaseError('運行一覧の取得に失敗しました');
    }
  }

  /**
   * 🔧 既存完全実装保持 - 更新
   */
  async update(
    where: OperationWhereUniqueInput,
    data: OperationUpdateInput
  ): Promise<OperationModel> {
    try {
      logger.info('運行更新開始', { where, data });

      const operation = await this.prisma.operation.update({
        where,
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      logger.info('運行更新完了', {
        id: operation.id,
        operationNumber: operation.operationNumber
      });

      return operation;

    } catch (error) {
      logger.error('運行更新エラー', { error, where, data });
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('指定された運行が見つかりません');
      }
      throw new DatabaseError('運行の更新に失敗しました');
    }
  }

  /**
   * 🔧 既存完全実装保持 - 削除
   */
  async delete(where: OperationWhereUniqueInput): Promise<OperationModel> {
    try {
      logger.info('運行削除開始', { where });

      const operation = await this.prisma.operation.delete({
        where
      });

      logger.info('運行削除完了', {
        id: operation.id,
        operationNumber: operation.operationNumber
      });

      return operation;

    } catch (error) {
      logger.error('運行削除エラー', { error, where });
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('指定された運行が見つかりません');
      }
      throw new DatabaseError('運行の削除に失敗しました');
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
      throw new DatabaseError('運行数の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: 運行番号による取得
   */
  async findByOperationNumber(operationNumber: string): Promise<OperationModel | null> {
    try {
      if (!operationNumber) {
        throw new ValidationError('運行番号は必須です');
      }

      return await this.prisma.operation.findUnique({
        where: { operationNumber }
      });

    } catch (error) {
      logger.error('運行番号取得エラー', { error, operationNumber });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: 車両IDによる運行一覧取得
   */
  async findByVehicleId(vehicleId: string, limit?: number): Promise<OperationModel[]> {
    try {
      if (!vehicleId) {
        throw new ValidationError('車両IDは必須です');
      }

      return await this.prisma.operation.findMany({
        where: { vehicleId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

    } catch (error) {
      logger.error('車両運行一覧取得エラー', { error, vehicleId });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行一覧の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: ドライバーIDによる運行一覧取得
   */
  async findByDriverId(driverId: string, limit?: number): Promise<OperationModel[]> {
    try {
      if (!driverId) {
        throw new ValidationError('ドライバーIDは必須です');
      }

      return await this.prisma.operation.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

    } catch (error) {
      logger.error('ドライバー運行一覧取得エラー', { error, driverId });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行一覧の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: ステータスによる運行一覧取得
   */
  async findByStatus(status: OperationStatus, limit?: number): Promise<OperationModel[]> {
    try {
      if (!status) {
        throw new ValidationError('ステータスは必須です');
      }

      return await this.prisma.operation.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

    } catch (error) {
      logger.error('ステータス運行一覧取得エラー', { error, status });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行一覧の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: 日付範囲による運行一覧取得
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<OperationModel[]> {
    try {
      if (!startDate || !endDate) {
        throw new ValidationError('開始日と終了日は必須です');
      }

      if (startDate > endDate) {
        throw new ValidationError('開始日は終了日より前である必要があります');
      }

      return await this.prisma.operation.findMany({
        where: {
          OR: [
            {
              plannedStartTime: {
                gte: startDate,
                lte: endDate
              }
            },
            {
              actualStartTime: {
                gte: startDate,
                lte: endDate
              }
            }
          ]
        },
        orderBy: { plannedStartTime: 'asc' }
      });

    } catch (error) {
      logger.error('日付範囲運行一覧取得エラー', { error, startDate, endDate });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行一覧の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: リレーション込みの運行取得
   * ✅ 修正: schema.camel.prisma の正しいリレーション名を使用
   */
  async findWithRelations(id: string): Promise<TripOperationModel | null> {
    try {
      if (!id) {
        throw new ValidationError('運行IDは必須です');
      }

      const operation = await this.prisma.operation.findUnique({
        where: { id },
        include: {
          vehicles: true,                       // ✅ 修正: vehicles (複数形)
          usersOperationsDriverIdTousers: true, // ✅ 修正: ドライバー用リレーション名
          operationDetails: true,
          gpsLogs: {
            orderBy: { recordedAt: 'asc' }
          },
          inspectionRecords: true
        }
      });

      if (!operation) {
        return null;
      }

      // TripOperationModel への変換
      const tripOperation: TripOperationModel = {
        ...operation,
        tripStatus: operation.status || 'PLANNING',
        vehicleOperationStatus: 'AVAILABLE',
        vehicle: operation.vehicles,                       // ✅ vehicles → vehicle
        driver: operation.usersOperationsDriverIdTousers,  // ✅ usersOperationsDriverIdTousers → driver
        activities: operation.operationDetails,
        gpsLogs: operation.gpsLogs,
        inspectionRecords: operation.inspectionRecords
      };

      return tripOperation;

    } catch (error) {
      logger.error('リレーション運行取得エラー', { error, id });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: 運行開始
   * ✅ 修正: operationNumberが確実に登録されるように修正
   */
  async startTrip(request: StartTripOperationRequest): Promise<TripOperationModel> {
    try {
      logger.info('運行開始処理開始', { request });

      // バリデーション
      if (!request.vehicleId || !request.driverId) {
        throw new ValidationError('車両IDとドライバーIDは必須です');
      }

      // ユーザーと車両の存在確認
      const [user, vehicle] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: request.driverId } }),
        this.prisma.vehicle.findUnique({ where: { id: request.vehicleId } })
      ]);

      if (!user) {
        throw new ValidationError('指定されたドライバーが見つかりません');
      }

      if (!vehicle) {
        throw new ValidationError('指定された車両が見つかりません');
      }

      // 運行番号を生成
      const operationNumber = await this.generateOperationNumber();
      logger.info('運行番号生成完了', { operationNumber });

      // 車両のステータス更新（運行開始時）
      const vehicleStatus = TripVehicleStatusManager.getStartTripStatus();

      // 運行作成データ（スカラーフィールドとリレーションを明示的に分離）
      const operationData = {
        operationNumber: operationNumber,  // ✅ 修正: 生成した運行番号を明示的に指定
        vehicleId: request.vehicleId,      // ✅ 修正: 直接IDを指定
        driverId: request.driverId,        // ✅ 修正: 直接IDを指定
        customerId: request.customerId,    // ✅ BUG-041修正: 客先ID
        status: 'IN_PROGRESS' as const,
        plannedStartTime: request.plannedStartTime || new Date(),
        actualStartTime: new Date(),       // ✅ 追加: 実際の開始時刻を設定
        plannedEndTime: request.plannedEndTime,
        notes: request.notes,
        startOdometer: request.startOdometer, // ✅ BUG-041修正: startOdometerをDB保存
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('運行作成データ', { operationData });

      const operation = await this.prisma.operation.create({
        data: operationData,
        include: {
          vehicles: true,                       // ✅ 修正: vehicles (複数形)
          usersOperationsDriverIdTousers: true  // ✅ 修正: ドライバー用リレーション名
        }
      });

      logger.info('運行開始完了', {
        operationId: operation.id,
        operationNumber: operation.operationNumber,
        vehicleId: request.vehicleId,
        driverId: request.driverId
      });

      // TripOperationModel への変換
      const tripOperation: TripOperationModel = {
        ...operation,
        tripStatus: operation.status || 'IN_PROGRESS',
        vehicleOperationStatus: vehicleStatus,
        vehicle: operation.vehicles,                       // ✅ vehicles → vehicle
        driver: operation.usersOperationsDriverIdTousers   // ✅ usersOperationsDriverIdTousers → driver
      };

      return tripOperation;

    } catch (error) {
      logger.error('運行開始エラー', { error, request });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行の開始に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: 運行終了
   * ✅ 修正: schema.camel.prisma の正しいリレーション名を使用
   */
  async endTrip(operationId: string, endData: {
    endTime?: Date;
    actualDistance?: number;
    fuelConsumed?: number;
    fuelCost?: number;
    notes?: string;
  }): Promise<TripOperationModel> {
    try {
      logger.info('運行終了処理開始', { operationId, endData });

      if (!operationId) {
        throw new ValidationError('運行IDは必須です');
      }

      // 運行の存在確認
      const operation = await this.findByKey(operationId);
      if (!operation) {
        throw new NotFoundError('指定された運行が見つかりません');
      }

      // 車両のステータス更新（運行終了時）
      const vehicleStatus = TripVehicleStatusManager.getEndTripStatus();

      // 運行更新
      const updateData: OperationUpdateInput = {
        status: 'COMPLETED',
        actualEndTime: endData.endTime || new Date(),
        totalDistanceKm: endData.actualDistance,
        fuelConsumedLiters: endData.fuelConsumed,
        fuelCostYen: endData.fuelCost,
        notes: endData.notes ? `${operation.notes || ''}\n${endData.notes}` : operation.notes,
        updatedAt: new Date()
      };

      const updatedOperation = await this.prisma.operation.update({
        where: { id: operationId },
        data: updateData,
        include: {
          vehicles: true,                       // ✅ 修正: vehicles (複数形)
          usersOperationsDriverIdTousers: true  // ✅ 修正: ドライバー用リレーション名
        }
      });

      logger.info('運行終了完了', { operationId });

      const tripOperation: TripOperationModel = {
        ...updatedOperation,
        tripStatus: 'COMPLETED',
        vehicleOperationStatus: vehicleStatus,
        vehicle: updatedOperation.vehicles,                       // ✅ vehicles → vehicle
        driver: updatedOperation.usersOperationsDriverIdTousers   // ✅ usersOperationsDriverIdTousers → driver
      };

      return tripOperation;

    } catch (error) {
      logger.error('運行終了エラー', { error, operationId });
      if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new DatabaseError('運行の終了に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: 運行キャンセル
   * ✅ 修正: schema.camel.prisma の正しいリレーション名を使用
   */
  async cancelTrip(operationId: string, reason: string): Promise<TripOperationModel> {
    try {
      logger.info('運行キャンセル処理開始', { operationId, reason });

      if (!operationId) {
        throw new ValidationError('運行IDは必須です');
      }

      if (!reason) {
        throw new ValidationError('キャンセル理由は必須です');
      }

      const operation = await this.findByKey(operationId);
      if (!operation) {
        throw new NotFoundError('指定された運行が見つかりません');
      }

      const updateData: OperationUpdateInput = {
        status: 'CANCELLED',
        notes: `${operation.notes || ''}\n[キャンセル] ${reason}`,
        updatedAt: new Date()
      };

      const updatedOperation = await this.prisma.operation.update({
        where: { id: operationId },
        data: updateData,
        include: {
          vehicles: true,                       // ✅ 修正: vehicles (複数形)
          usersOperationsDriverIdTousers: true  // ✅ 修正: ドライバー用リレーション名
        }
      });

      logger.info('運行キャンセル完了', { operationId });

      const tripOperation: TripOperationModel = {
        ...updatedOperation,
        tripStatus: 'CANCELLED',
        vehicleOperationStatus: 'AVAILABLE',
        vehicle: updatedOperation.vehicles,                       // ✅ vehicles → vehicle
        driver: updatedOperation.usersOperationsDriverIdTousers   // ✅ usersOperationsDriverIdTousers → driver
      };

      return tripOperation;

    } catch (error) {
      logger.error('運行キャンセルエラー', { error, operationId });
      if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new DatabaseError('運行のキャンセルに失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: 運行統計取得
   */
  async getStatistics(filter?: OperationTripFilter): Promise<OperationStatistics> {
    try {
      logger.info('運行統計取得開始', { filter });

      const where = this.buildWhereClause(filter);

      const [
        totalTrips,
        completedTrips,
        activeTrips,
        cancelledTrips,
        operations
      ] = await Promise.all([
        this.count(where),
        this.count({ ...where, status: 'COMPLETED' }),
        this.count({ ...where, status: 'IN_PROGRESS' }),
        this.count({ ...where, status: 'CANCELLED' }),
        this.findMany({ where })
      ]);

      // 統計計算
      const totalDistance = operations.reduce((sum, op) =>
        sum + (op.totalDistanceKm ? Number(op.totalDistanceKm) : 0), 0
      );
      const totalFuelConsumed = operations.reduce((sum, op) =>
        sum + (op.fuelConsumedLiters ? Number(op.fuelConsumedLiters) : 0), 0
      );
      const totalFuelCost = operations.reduce((sum, op) =>
        sum + (op.fuelCostYen ? Number(op.fuelCostYen) : 0), 0
      );
      const onTimeTrips = operations.filter(op =>
        op.actualEndTime && op.plannedEndTime && op.actualEndTime <= op.plannedEndTime
      ).length;

      const statistics: OperationStatistics = {
        totalTrips,
        completedTrips,
        activeTrips,
        cancelledTrips,
        totalDistance,
        averageDistance: totalTrips > 0 ? totalDistance / totalTrips : 0,
        totalFuelConsumed,
        averageFuelConsumption: totalTrips > 0 ? totalFuelConsumed / totalTrips : 0,
        totalFuelCost,
        totalDuration: 0,
        completionRate: totalTrips ? (completedTrips / totalTrips) * 100 : 0,
        averageDuration: 0,
        onTimeCompletionRate: totalTrips ? (onTimeTrips / totalTrips) * 100 : 0,
        delayRate: 0,
        byStatus: {},
        byVehicle: {},
        byDriver: {},
        recentTrends: {
          last7Days: 0,
          last30Days: 0,
          thisMonth: 0,
          lastMonth: 0
        }
      };

      logger.info('運行統計取得完了', { statistics });

      return statistics;

    } catch (error) {
      logger.error('運行統計取得エラー', { error, filter });
      throw new DatabaseError('運行統計の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: フィルタ条件からWHERE句構築
   */
  private buildWhereClause(filter?: OperationTripFilter): OperationWhereInput {
    if (!filter) return {};

    const where: OperationWhereInput = {};

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        where.status = { in: filter.status };
      } else {
        where.status = filter.status;
      }
    }

    if (filter.vehicleId) {
      if (Array.isArray(filter.vehicleId)) {
        where.vehicleId = { in: filter.vehicleId };
      } else {
        where.vehicleId = filter.vehicleId;
      }
    }

    if (filter.driverId) {
      if (Array.isArray(filter.driverId)) {
        where.driverId = { in: filter.driverId };
      } else {
        where.driverId = filter.driverId;
      }
    }

    if (filter.startDate || filter.endDate) {
      where.OR = [
        {
          plannedStartTime: {
            ...(filter.startDate && { gte: filter.startDate }),
            ...(filter.endDate && { lte: filter.endDate })
          }
        },
        {
          actualStartTime: {
            ...(filter.startDate && { gte: filter.startDate }),
            ...(filter.endDate && { lte: filter.endDate })
          }
        }
      ];
    }

    if (filter.searchTerm) {
      where.OR = [
        { operationNumber: { contains: filter.searchTerm, mode: 'insensitive' } },
        { notes: { contains: filter.searchTerm, mode: 'insensitive' } }
      ];
    }

    return where;
  }

  /**
   * 🚀 Phase 1-B-16新機能: 運行番号生成
   * ✅ 競合対策: 重複チェックと再試行ロジックを追加
   */
  private async generateOperationNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const prefix = `OP${year}${month}${day}`;

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        // 同じ日付の運行数を取得
        const count = await this.prisma.operation.count({
          where: {
            operationNumber: {
              startsWith: prefix
            }
          }
        });

        const sequence = String(count + 1).padStart(4, '0');
        const operationNumber = `${prefix}-${sequence}`;

        // ✅ 重複チェック（念のため）
        const existing = await this.prisma.operation.findUnique({
          where: { operationNumber }
        });

        if (!existing) {
          return operationNumber;
        }

        // 重複が見つかった場合は再試行
        attempts++;
        logger.warn('運行番号の重複を検出、再生成します', {
          operationNumber,
          attempt: attempts
        });

        // 短い待機時間を追加（競合を避けるため）
        await new Promise(resolve => setTimeout(resolve, 10 * attempts));

      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        logger.warn('運行番号生成エラー、再試行します', {
          error,
          attempt: attempts
        });
        await new Promise(resolve => setTimeout(resolve, 10 * attempts));
      }
    }

    throw new Error('運行番号の生成に失敗しました（最大試行回数を超えました）');
  }

  /**
   * 🚀 Phase 1-B-16新機能: ページネーション付き運行一覧（Trip形式）
   * ✅ 修正: schema.camel.prisma の正しいリレーション名を使用
   */
  async findTripsWithPagination(filter: OperationTripFilter): Promise<PaginatedTripResponse<TripOperationModel>> {
    try {
      const page = filter.page || 1;
      const pageSize = filter.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const where = this.buildWhereClause(filter);

      const [data, total, statistics] = await Promise.all([
        this.prisma.operation.findMany({
          where,
          orderBy: { plannedStartTime: 'desc' },
          skip,
          take: pageSize,
          include: filter.includeRelations ? {
            vehicles: true,                       // ✅ 修正: vehicles (複数形)
            usersOperationsDriverIdTousers: true, // ✅ 修正: ドライバー用リレーション名
            operationDetails: true,
            gpsLogs: true
          } : undefined
        }),
        this.prisma.operation.count({ where }),
        filter.includeStatistics ? this.getStatistics(filter) : Promise.resolve(undefined)
      ]);

      // TripOperationModel への変換
      const trips: TripOperationModel[] = data.map(op => ({
        ...op,
        tripStatus: op.status || 'PLANNING',
        vehicleOperationStatus: 'AVAILABLE',
        vehicle: (op as any).vehicles,                       // ✅ vehicles → vehicle
        driver: (op as any).usersOperationsDriverIdTousers,  // ✅ usersOperationsDriverIdTousers → driver
        activities: (op as any).operationDetails,
        gpsLogs: (op as any).gpsLogs
      }));

      return {
        success: true,
        data: trips,
        message: '運行一覧を取得しました',
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / pageSize),
          totalItems: total,
          itemsPerPage: pageSize
        }
      };

    } catch (error) {
      logger.error('Trip一覧取得エラー', { error, filter });
      throw new DatabaseError('運行一覧の取得に失敗しました');
    }
  }

  /**
   * 🚀 Phase 1-B-16新機能: トレンド分析
   */
  async getTrends(filter: OperationTripFilter) {
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
