import { PrismaClient } from '@prisma/client';
import {
  OperationModel,
  OperationDetailModel,
  OperationCreateInput,
  OperationDetailCreateInput,
  GpsLogModel,
  GpsLogCreateInput,
  UserModel,
  VehicleModel
} from '../types';
import {
  Trip,
  CreateTripRequest,
  UpdateTripRequest,
  TripStatus,
  VehicleStatus,
  UserRole,
  TripFilter,
  PaginatedResponse,
  ActivityType,
  CreateTripDetailRequest,
  CreateFuelRecordRequest
} from '../types/auth';
import { AppError } from '../utils/asyncHandler';
import { calculateDistance } from '../utils/gpsCalculations';

const prisma = new PrismaClient();

export class TripService {
  /**
   * 運行開始（Operationレコード作成）
   */
  async startTrip(tripData: CreateTripRequest, userId?: string): Promise<OperationModel> {
    // 車両の利用可能性チェック
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: tripData.vehicleId }
    });
    
    if (!vehicle || vehicle.status !== 'AVAILABLE') {
      throw new AppError('指定された車両は利用できません', 400);
    }
    
    // 運行番号生成
    const operationNumber = `OP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Operationレコード作成
    const operation = await prisma.operation.create({
      data: {
        operationNumber,
        vehicleId: tripData.vehicleId,
        driverId: tripData.driverId || userId,
        operationDate: new Date(tripData.startTime),
        startTime: new Date(tripData.startTime),
        status: 'IN_PROGRESS',
        notes: tripData.notes
      },
      include: {
        vehicle: true,
        driver: true
      }
    });
    
    // 車両ステータスを更新
    await prisma.vehicle.update({
      where: { id: tripData.vehicleId },
      data: { status: 'IN_USE' }
    });
    
    return operation;
  }
  
  /**
   * 運行詳細取得
   */
  async getTripById(id: string): Promise<any> {
    return await prisma.operation.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: true,
        operationDetails: {
          include: {
            item: true,
            location: true
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
        vehicle: true,
        driver: true
      }
    });
  }
  
  /**
   * 運行終了
   */
  async endTrip(id: string, endData: any): Promise<any> {
    return await prisma.operation.update({
      where: { id },
      data: {
        endTime: endData.endTime,
        status: 'COMPLETED',
        notes: endData.notes,
        updatedAt: new Date()
      },
      include: {
        vehicle: true,
        driver: true
      }
    });
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
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes
      },
      include: {
        item: true,
        location: true
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
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes
      },
      include: {
        item: true,
        location: true
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
    const gpsLog = await prisma.gpsLog.create({
      data: {
        operationId,
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
    
    const [totalTrips, totalDistance, operationDetails] = await Promise.all([
      prisma.operation.count({ where }),
      prisma.operationDetail.aggregate({
        where: { operation: where },
        _sum: { quantityTons: true }
      }),
      prisma.operationDetail.count({
        where: { operation: where }
      })
    ]);
    
    return {
      totalTrips,
      totalQuantity: operationDetails._sum?.quantityTons || 0,
      totalActivities: operationDetails,
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
        vehicle: true,
        operationDetails: {
          include: {
            item: true,
            location: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
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
          vehicle: true,
          driver: true,
          operationDetails: {
            include: {
              item: true,
              location: true
            }
          }
        },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { operationDate: 'desc' }
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
