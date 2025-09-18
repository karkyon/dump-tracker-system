import { PrismaClient } from '@prisma/client';
import {
  OperationModel,
  OperationDetailModel,
  OperationCreateInput,
  OperationDetailCreateInput,
  GpsLogModel,
  GpsLogCreateInput,
  UserModel,
  VehicleModel,
  CreateTripRequest,
  UpdateTripRequest,
  TripFilter,
  PaginatedTripResponse,
  ActivityType,
  CreateTripDetailRequest,
  CreateFuelRecordRequest,
  TripStatus,
  VehicleOperationStatus,
  vehicleStatusHelper
} from '../types';
import { UserRole } from '../types/auth';
import { AppError } from '../utils/errors';
import { calculateDistance } from '../utils/gpsCalculations';
import { truncate } from 'fs/promises';

const prisma = new PrismaClient();

export class TripService {
  constructor(private prisma: PrismaClient) {}            // Dependency Injection
  /**
   * 運行開始（Operationレコード作成）
   */
  async startTrip(tripData: CreateTripRequest, userId?: string): Promise<OperationModel> {
    // driverIdの確定
    const driverId = tripData.driverId || userId;
    if (!driverId) {
      throw new AppError('ドライバーIDが指定されていません', 400);
    }
    
    // 車両の利用可能性チェック
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: tripData.vehicleId }
    });
    
    if (!vehicle) {
      throw new AppError('指定された車両が見つかりません', 404);
    }

    if (vehicle.status !== 'ACTIVE') {
      throw new AppError('指定された車両は利用できません', 400);
    }
    
    // 運行番号生成
    const operationNumber = `OP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // トランザクションで運行作成と車両ステータス更新を実行
    const [operation] = await prisma.$transaction([
      // Operation作成
      prisma.operation.create({
        data: {
          operationNumber,
          vehicleId: tripData.vehicleId,
          driverId: driverId,
          plannedStartTime: new Date(tripData.startTime),
          actualStartTime: new Date(tripData.startTime),
          status: 'IN_PROGRESS',
          notes: tripData.notes
        },
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
      }),
      // 車両ステータス更新
      prisma.vehicle.update({
        where: { id: tripData.vehicleId },
        data: { status: vehicleStatusHelper.getOperatingStatus() }
      })
    ]);
    
    return operation;
  }
  
  /**
   * 運行詳細取得
   */
  async getTripById(id: string): Promise<any> {
    return await prisma.operation.findUnique({
      where: { id },
      include: {
        vehicles: true,
        usersOperationsDriverIdTousers: true,
        operationDetails: {
          include: {
            items: true,
            locations: true
          }
        },
        gpsLogs: {
          orderBy: { recordedAt: 'desc' },
          take: 10
        }
      }
    });
  }
  
  /**
   * 運行更新
   */
  async updateTrip(id: string, updateData: UpdateTripRequest): Promise<any> {
    return await prisma.operation.update({
      where: { id },
      data: {
        status: updateData.status,
        notes: updateData.notes,
        updatedAt: new Date()
      },
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
    });
  }
  
  /**
   * 運行終了
   */
  async endTrip(id: string, endData: any): Promise<any> {
    // 運行情報を取得
    const operation = await prisma.operation.findUnique({
      where: { id },
      select: { vehicleId: true }
    });
    
    if (!operation) {
      throw new AppError('運行記録が見つかりません', 404);
    }
    
    // トランザクションで運行終了と車両ステータス復旧を実行
    const [updatedOperation] = await prisma.$transaction([
      // 運行記録を更新
      prisma.operation.update({
        where: { id },
        data: {
          actualEndTime: endData.endTime,
          status: 'COMPLETED',
          notes: endData.notes,
          updatedAt: new Date()
        },
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
      }),
      // 車両ステータスをACTIVEに復旧
      prisma.vehicle.update({
        where: { id: operation.vehicleId },
        data: { status: 'ACTIVE' }                       // 利用可能状態に復旧
      })
    ]);
    
    return updatedOperation;
  }
  
  /**
   * 積込記録追加（OperationDetail作成）
   */
  async addLoadingRecord(
    operationId: string, 
    data: {
      locationId: string;
      itemId: string;
      quantity: number;
      activityType: string;
      startTime: Date;
      endTime?: Date;
      notes?: string;
    }
  ): Promise<OperationDetailModel> {
    // シーケンス番号取得
    const lastDetail = await prisma.operationDetail.findFirst({
      where: { operationId },
      orderBy: { sequenceNumber: 'desc' }
    });
    
    const sequenceNumber = (lastDetail?.sequenceNumber || 0) + 1;
    
    // OperationDetail作成
    const operationDetail = await prisma.operationDetail.create({
      data: {
        operationId,
        sequenceNumber,
        activityType: 'LOADING',
        locationId: data.locationId,
        itemId: data.itemId,
        quantityTons: data.quantity,
        actualStartTime: data.startTime,                    // 実際開始時刻
        actualEndTime: data.endTime,                        // 実際終了時刻
        notes: data.notes
      },
      include: {
        items: true,
        locations: true
      }
    });
    
    return operationDetail;
  }
  
  /**
   * 積下記録追加（OperationDetail作成）
   */
  async addUnloadingRecord(
    operationId: string,
    data: {
      locationId: string;
      itemId: string;
      quantity: number;
      activityType: string;
      startTime: Date;
      endTime?: Date;
      notes?: string;
    }
  ): Promise<OperationDetailModel> {
    // シーケンス番号取得
    const lastDetail = await prisma.operationDetail.findFirst({
      where: { operationId },
      orderBy: { sequenceNumber: 'desc' }
    });
    
    const sequenceNumber = (lastDetail?.sequenceNumber || 0) + 1;
    
    // OperationDetail作成
    const operationDetail = await prisma.operationDetail.create({
      data: {
        operationId,
        sequenceNumber,
        activityType: 'UNLOADING',
        locationId: data.locationId,
        itemId: data.itemId,
        quantityTons: data.quantity,
        actualStartTime: data.startTime,                    // 実際開始時刻
        actualEndTime: data.endTime,                        // 実際終了時刻
        notes: data.notes
      },
      include: {
        items: true,
        locations: true
      }
    });
    
    return operationDetail;
  }
  
  /**
   * GPS位置情報更新（GpsLog作成）
   */
  async updateGPSLocation(
    operationId: string,
    data: {
      latitude: number;
      longitude: number;
      speedKmh?: number;
      heading?: number;
      accuracyMeters?: number;
      timestamp: Date;
    }
  ): Promise<GpsLogModel> {
    const operation = await prisma.operation.findUnique({ 
      where: { id: operationId },
      select: { vehicleId: true }
    });
    
    if (!operation) {
      throw new AppError('運行記録が見つかりません', 404);
    }
    
    const gpsLog = await prisma.gpsLog.create({
      data: {
        vehicleId: operation.vehicleId,                      // 必ず存在するvehicleId
        operationId: operationId,
        latitude: data.latitude,
        longitude: data.longitude,
        speedKmh: data.speedKmh,
        heading: data.heading,
        accuracyMeters: data.accuracyMeters,
        recordedAt: data.timestamp
      }
    });
    
    return gpsLog;
  }
  
  /**
   * 給油記録追加
   */
  async addFuelRecord(id: string, data: any): Promise<any> {
    // 給油記録の実装（将来的な拡張用）
    return {
      tripId: id,
      ...data,
      createdAt: new Date()
    };
  }
  
  /**
   * 運行統計取得
   */
  async getTripStatistics(params: any): Promise<any> {
    const where: any = {};
    
    if (params.startDate || params.endDate) {
      where.operationDate = {};
      if (params.startDate) {
        where.operationDate.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.operationDate.lte = new Date(params.endDate);
      }
    }
    
    if (params.driverId) {
      where.driverId = params.driverId;
    }
    
    if (params.vehicleId) {
      where.vehicleId = params.vehicleId;
    }
    
    const [totalTrips, totalQuantity, totalActivities] = await Promise.all([
      prisma.operation.count({ where }),
      prisma.operationDetail.aggregate({
        where: { operations: where },
        _sum: { quantityTons: true }
      }),
      prisma.operationDetail.count({
        where: { operations: where }
      })
    ]);
    
    return {
      totalTrips,
      totalQuantity: totalQuantity._sum?.quantityTons || 0,
      totalActivities: totalActivities,
      period: {
        startDate: params.startDate,
        endDate: params.endDate
      }
    };
  }
  
  /**
   * 現在の運行取得
   */
  async getCurrentTripByDriver(driverId: string): Promise<any> {
    return await prisma.operation.findFirst({
      where: {
        driverId,
        status: 'IN_PROGRESS'
      },
      include: {
        vehicles: true,
        operationDetails: {
          include: {
            items: true,                                      // ✅ 正しいリレーション名
            locations: true
          }
        }
      },
      orderBy: { actualStartTime: 'desc' }  // 最新の運行を取得
    });
  }
  
  /**
   * 運行削除
   */
  async deleteTrip(id: string): Promise<void> {
    await prisma.operation.delete({
      where: { id }
    });
  }
  
  /**
   * 運行一覧取得
   */
  async getAllTrips(params: any): Promise<any> {
    const where: any = {};
    
    if (params.driverId) {
      where.driverId = params.driverId;
    }
    
    if (params.vehicleId) {
      where.vehicleId = params.vehicleId;
    }
    
    if (params.status) {
      where.status = params.status;
    }
    
    if (params.startDate || params.endDate) {
      where.operationDate = {};
      if (params.startDate) {
        where.operationDate.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.operationDate.lte = new Date(params.endDate);
      }
    }
    
    const [operations, total] = await Promise.all([
      prisma.operation.findMany({
        where,
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true,
          operationDetails: {
            include: {
              items: true,
              locations: true
            }
          }
        },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' } // 最新の運行を先頭に
      }),
      prisma.operation.count({ where })
    ]);
    
    return {
      data: operations,
      total,
      page: params.page,
      pageSize: params.limit,
      totalPages: Math.ceil(total / params.limit)
    };
  }
}

// TripServiceインスタンス管理用の変数
let _tripServiceInstance: TripService | null = null;

/**
 * TripServiceのインスタンスを取得するファクトリー関数
 * @param prismaClient 任意のPrismaClientインスタンス
 * @returns TripServiceインスタンス
 */
export const getTripService = (prismaClient?: PrismaClient): TripService => {
  if (!_tripServiceInstance) {
    _tripServiceInstance = new TripService(prismaClient || prisma);
  }
  return _tripServiceInstance;
};

// デフォルトエクスポート（他のモジュールとの互換性のため）
export default getTripService();

// =====================================
// ファイル構成例（全体像）
// =====================================

/*
src/services/tripService.ts の構成:

1. import文
2. 型定義
3. TripServiceクラス定義
4. ファクトリー関数とインスタンス管理
5. エクスポート
*/