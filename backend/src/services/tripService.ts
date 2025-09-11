import { PrismaClient } from '@prisma/client';
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
} from '../types';
import { AppError } from '../utils/asyncHandler';
import { calculateDistance } from '../utils/gpsCalculations';

const prisma = new PrismaClient();

export class TripService {
  /**
   * 運行記録一覧取得（ページネーション・フィルター対応）
   * @param filter フィルター条件
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   * @returns 運行記録一覧
   */
  async getTrips(
    filter: TripFilter,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<PaginatedResponse<Trip & { driverName?: string; vehicleNumber?: string }>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      driverId,
      vehicleId,
      startDate,
      endDate,
      status,
      siteId
    } = filter;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    // 検索条件構築
    const where: any = {};

    // 運転手は自分の運行記録のみ表示
    if (requesterRole === UserRole.DRIVER) {
      where.driverId = requesterId;
    } else if (driverId) {
      where.driverId = driverId;
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (siteId) {
      where.siteId = siteId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    // 総件数取得
    const total = await prisma.operations.count({ where });

    // 運行記録取得
    const trips = await prisma.operations.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder
      },
      include: {
        driver: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        vehicle: {
          select: {
            plateNumber: true,
            model: true,
            manufacturer: true
          }
        },
        site: {
          select: {
            name: true,
            address: true
          }
        }
      }
    });

    const totalPages = Math.ceil(total / take);

    // レスポンス形式に変換
    const formattedTrips = trips.map(trip => ({
      id: trip.id,
      tripNumber: trip.tripNumber,
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      siteId: trip.siteId,
      startTime: trip.startTime,
      endTime: trip.endTime,
      status: trip.status,
      startLatitude: trip.startLatitude,
      startLongitude: trip.startLongitude,
      endLatitude: trip.endLatitude,
      endLongitude: trip.endLongitude,
      materialType: trip.materialType,
      loadWeight: trip.loadWeight,
      unloadWeight: trip.unloadWeight,
      distance: trip.distance,
      fuelConsumed: trip.fuelConsumed,
      fuelCost: trip.fuelCost,
      notes: trip.notes,
      weatherCondition: trip.weatherCondition,
      roadCondition: trip.roadCondition,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
      vehicleNumber: trip.vehicle.plateNumber,
      siteName: trip.site?.name
    }));

    return {
      data: formattedTrips,
      total,
      page,
      limit: take,
      totalPages
    };
  }

  /**
   * 運行記録詳細取得
   * @param tripId 運行記録ID
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   * @returns 運行記録詳細
   */
  async getTripById(
    tripId: string, 
    requesterId: string, 
    requesterRole: UserRole
  ): Promise<Trip & { 
    driverName?: string; 
    vehicleNumber?: string; 
    siteName?: string;
    tripDetails?: any[];
    fuelRecords?: any[];
    inspectionRecords?: any[];
  }> {
    const trip = await prisma.operations.findUnique({
      where: { id: tripId },
      include: {
        driver: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        vehicle: {
          select: {
            plateNumber: true,
            model: true,
            manufacturer: true
          }
        },
        site: {
          select: {
            name: true,
            address: true,
            latitude: true,
            longitude: true
          }
        }
      }
    });

    if (!trip) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    // 権限チェック：運転手は自分の運行記録のみアクセス可能
    if (requesterRole === UserRole.DRIVER && trip.driverId !== requesterId) {
      throw new AppError('この運行記録にアクセスする権限がありません', 403);
    }

    return {
      id: trip.id,
      tripNumber: trip.tripNumber,
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      siteId: trip.siteId,
      startTime: trip.startTime,
      endTime: trip.endTime,
      status: trip.status,
      startLatitude: trip.startLatitude,
      startLongitude: trip.startLongitude,
      endLatitude: trip.endLatitude,
      endLongitude: trip.endLongitude,
      materialType: trip.materialType,
      loadWeight: trip.loadWeight,
      unloadWeight: trip.unloadWeight,
      distance: trip.distance,
      fuelConsumed: trip.fuelConsumed,
      fuelCost: trip.fuelCost,
      notes: trip.notes,
      weatherCondition: trip.weatherCondition,
      roadCondition: trip.roadCondition,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
      vehicleNumber: trip.vehicle.plateNumber,
      siteName: trip.site?.name
    };
  }

  /**
   * 運行記録作成
   * @param tripData 運行記録データ
   * @param driverId 運転手ID
   * @returns 作成された運行記録
   */
  async createTrip(tripData: CreateTripRequest, driverId: string): Promise<Trip> {
    const { vehicleId, siteId, materialType, notes, weatherCondition } = tripData;

    // 車両存在・利用可能性確認
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new AppError('指定された車両が見つかりません', 404);
    }

    if (vehicle.status !== 'AVAILABLE') {
      throw new AppError('この車両は現在使用中です', 400);
    }

    // 運転手の未完了運行記録チェック
    const activeTrip = await prisma.operations.findFirst({
      where: {
        driverId,
        status: {
          in: ['PLANNED', 'IN_PROGRESS']
        }
      }
    });

    if (activeTrip) {
      throw new AppError('未完了の運行記録があります', 400);
    }

    // サイト存在確認（指定されている場合）
    if (siteId) {
      const site = await prisma.site.findUnique({
        where: { id: siteId }
      });

      if (!site) {
        throw new AppError('指定されたサイトが見つかりません', 404);
      }

      if (!site.isActive) {
        throw new AppError('指定されたサイトは無効です', 400);
      }
    }

    // トリップ番号生成（日付 + 連番）
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todayTripsCount = await prisma.operations.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }
    });
    const tripNumber = `${today}-${String(todayTripsCount + 1).padStart(3, '0')}`;

    // トランザクションで運行記録作成と車両状態更新
    const newTrip = await prisma.$transaction(async (tx) => {
      // 運行記録作成
      const trip = await tx.trip.create({
        data: {
          tripNumber,
          driverId,
          vehicleId,
          siteId,
          materialType,
          notes,
          weatherCondition,
          status: 'PLANNED',
          startTime: new Date()
        }
      });

      // 車両状態を「使用中」に更新
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          status: 'IN_USE',
          assignedDriverId: driverId
        }
      });

      return trip;
    });

    return {
      id: newTrip.id,
      tripNumber: newTrip.tripNumber,
      driverId: newTrip.driverId,
      vehicleId: newTrip.vehicleId,
      siteId: newTrip.siteId,
      startTime: newTrip.startTime,
      endTime: newTrip.endTime,
      status: newTrip.status,
      startLatitude: newTrip.startLatitude,
      startLongitude: newTrip.startLongitude,
      endLatitude: newTrip.endLatitude,
      endLongitude: newTrip.endLongitude,
      materialType: newTrip.materialType,
      loadWeight: newTrip.loadWeight,
      unloadWeight: newTrip.unloadWeight,
      distance: newTrip.distance,
      fuelConsumed: newTrip.fuelConsumed,
      fuelCost: newTrip.fuelCost,
      notes: newTrip.notes,
      weatherCondition: newTrip.weatherCondition,
      roadCondition: newTrip.roadCondition,
      createdAt: newTrip.createdAt,
      updatedAt: newTrip.updatedAt
    };
  }

  /**
   * 運行記録更新
   * @param tripId 運行記録ID
   * @param updateData 更新データ
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   * @returns 更新された運行記録
   */
  async updateTrip(
    tripId: string, 
    updateData: UpdateTripRequest,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<Trip> {
    const existingTrip = await prisma.operations.findUnique({
      where: { id: tripId },
      include: { vehicle: true }
    });

    if (!existingTrip) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    // 権限チェック：運転手は自分の運行記録のみ更新可能
    if (requesterRole === UserRole.DRIVER && existingTrip.driverId !== requesterId) {
      throw new AppError('この運行記録を更新する権限がありません', 403);
    }

    // 完了済みの運行記録は更新不可
    if (existingTrip.status === 'COMPLETED') {
      throw new AppError('完了済みの運行記録は更新できません', 400);
    }

    // 距離の自動計算（GPS座標が更新された場合）
    let calculatedDistance = updateData.distance;
    if (updateData.endLatitude && updateData.endLongitude && existingTrip.startLatitude && existingTrip.startLongitude) {
      calculatedDistance = calculateDistance(
        existingTrip.startLatitude,
        existingTrip.startLongitude,
        updateData.endLatitude,
        updateData.endLongitude
      );
    }

    const updatedTrip = await prisma.operations.update({
      where: { id: tripId },
      data: {
        ...updateData,
        ...(calculatedDistance && { distance: calculatedDistance })
      }
    });

    return {
      id: updatedTrip.id,
      tripNumber: updatedTrip.tripNumber,
      driverId: updatedTrip.driverId,
      vehicleId: updatedTrip.vehicleId,
      siteId: updatedTrip.siteId,
      startTime: updatedTrip.startTime,
      endTime: updatedTrip.endTime,
      status: updatedTrip.status,
      startLatitude: updatedTrip.startLatitude,
      startLongitude: updatedTrip.startLongitude,
      endLatitude: updatedTrip.endLatitude,
      endLongitude: updatedTrip.endLongitude,
      materialType: updatedTrip.materialType,
      loadWeight: updatedTrip.loadWeight,
      unloadWeight: updatedTrip.unloadWeight,
      distance: updatedTrip.distance,
      fuelConsumed: updatedTrip.fuelConsumed,
      fuelCost: updatedTrip.fuelCost,
      notes: updatedTrip.notes,
      weatherCondition: updatedTrip.weatherCondition,
      roadCondition: updatedTrip.roadCondition,
      createdAt: updatedTrip.createdAt,
      updatedAt: updatedTrip.updatedAt
    };
  }

  /**
   * 運行記録完了
   * @param tripId 運行記録ID
   * @param endData 終了データ
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   * @returns 完了した運行記録
   */
  async completeTrip(
    tripId: string, 
    endData: { 
      endLatitude?: number; 
      endLongitude?: number; 
      distance?: number; 
      fuelConsumed?: number; 
      fuelCost?: number; 
      loadWeight?: number;
      unloadWeight?: number;
      notes?: string;
      roadCondition?: string;
    },
    requesterId: string,
    requesterRole: UserRole
  ): Promise<Trip> {
    const existingTrip = await prisma.operations.findUnique({
      where: { id: tripId },
      include: { vehicle: true }
    });

    if (!existingTrip) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    // 権限チェック
    if (requesterRole === UserRole.DRIVER && existingTrip.driverId !== requesterId) {
      throw new AppError('この運行記録を完了する権限がありません', 403);
    }

    if (existingTrip.status === 'COMPLETED') {
      throw new AppError('この運行記録は既に完了しています', 400);
    }

    // 距離の自動計算（GPS座標が提供された場合）
    let finalDistance = endData.distance;
    if (endData.endLatitude && endData.endLongitude && existingTrip.startLatitude && existingTrip.startLongitude) {
      finalDistance = calculateDistance(
        existingTrip.startLatitude,
        existingTrip.startLongitude,
        endData.endLatitude,
        endData.endLongitude
      );
    }

    // トランザクションで運行記録完了と車両状態更新
    const completedTrip = await prisma.$transaction(async (tx) => {
      // 運行記録を完了状態に更新
      const trip = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          endLatitude: endData.endLatitude,
          endLongitude: endData.endLongitude,
          distance: finalDistance,
          fuelConsumed: endData.fuelConsumed,
          fuelCost: endData.fuelCost,
          loadWeight: endData.loadWeight,
          unloadWeight: endData.unloadWeight,
          notes: endData.notes,
          roadCondition: endData.roadCondition
        }
      });

      // 車両状態を「利用可能」に更新
      await tx.vehicle.update({
        where: { id: existingTrip.vehicleId },
        data: {
          status: 'AVAILABLE',
          assignedDriverId: null
        }
      });

      return trip;
    });

    return {
      id: completedTrip.id,
      tripNumber: completedTrip.tripNumber,
      driverId: completedTrip.driverId,
      vehicleId: completedTrip.vehicleId,
      siteId: completedTrip.siteId,
      startTime: completedTrip.startTime,
      endTime: completedTrip.endTime,
      status: completedTrip.status,
      startLatitude: completedTrip.startLatitude,
      startLongitude: completedTrip.startLongitude,
      endLatitude: completedTrip.endLatitude,
      endLongitude: completedTrip.endLongitude,
      materialType: completedTrip.materialType,
      loadWeight: completedTrip.loadWeight,
      unloadWeight: completedTrip.unloadWeight,
      distance: completedTrip.distance,
      fuelConsumed: completedTrip.fuelConsumed,
      fuelCost: completedTrip.fuelCost,
      notes: completedTrip.notes,
      weatherCondition: completedTrip.weatherCondition,
      roadCondition: completedTrip.roadCondition,
      createdAt: completedTrip.createdAt,
      updatedAt: completedTrip.updatedAt
    };
  }

  /**
   * 運行記録キャンセル
   * @param tripId 運行記録ID
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   */
  async cancelTrip(
    tripId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<void> {
    const existingTrip = await prisma.operations.findUnique({
      where: { id: tripId }
    });

    if (!existingTrip) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    // 権限チェック
    if (requesterRole === UserRole.DRIVER && existingTrip.driverId !== requesterId) {
      throw new AppError('この運行記録をキャンセルする権限がありません', 403);
    }

    if (existingTrip.status === 'COMPLETED') {
      throw new AppError('完了済みの運行記録はキャンセルできません', 400);
    }

    // トランザクションで運行記録キャンセルと車両状態更新
    await prisma.$transaction(async (tx) => {
      // 運行記録をキャンセル状態に更新
      await tx.trip.update({
        where: { id: tripId },
        data: {
          status: 'CANCELLED',
          endTime: new Date()
        }
      });

      // 車両状態を「利用可能」に戻す
      await tx.vehicle.update({
        where: { id: existingTrip.vehicleId },
        data: {
          status: 'AVAILABLE',
          assignedDriverId: null
        }
      });
    });
  }

  /**
   * 運行詳細（アクティビティ）追加
   * @param tripId 運行記録ID
   * @param activityData アクティビティデータ
   * @param requesterId リクエスト者ID
   * @returns 作成された運行詳細
   */
  async addTripActivity(
    tripId: string,
    activityData: CreateTripDetailRequest,
    requesterId: string
  ): Promise<any> {
    const trip = await prisma.operations.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    if (trip.driverId !== requesterId) {
      throw new AppError('この運行記録に活動を追加する権限がありません', 403);
    }

    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      throw new AppError('完了またはキャンセル済みの運行記録には活動を追加できません', 400);
    }

    // 場所とアイテムの存在確認
    if (activityData.locationId) {
      const location = await prisma.location.findUnique({
        where: { id: activityData.locationId }
      });
      if (!location || !location.isActive) {
        throw new AppError('指定された場所が見つからないか無効です', 404);
      }
    }

    if (activityData.itemId) {
      const item = await prisma.item.findUnique({
        where: { id: activityData.itemId }
      });
      if (!item || !item.isActive) {
        throw new AppError('指定されたアイテムが見つからないか無効です', 404);
      }
    }

    // Note: TripDetailテーブルが存在しない場合はコメントアウト
    /*
    const tripDetail = await prisma.tripDetail.create({
      data: {
        tripId,
        activityType: activityData.activityType,
        locationId: activityData.locationId,
        itemId: activityData.itemId,
        timestamp: new Date(activityData.timestamp),
        latitude: activityData.latitude,
        longitude: activityData.longitude,
        isCargoConfirmed: activityData.isCargoConfirmed,
        remarks: activityData.remarks
      },
      include: {
        location: {
          select: {
            name: true,
            address: true
          }
        },
        item: {
          select: {
            name: true,
            unit: true
          }
        }
      }
    });

    return tripDetail;
    */

    // 代替として、tripのnotesに活動記録を追加
    const activityNote = `[${activityData.activityType}] ${new Date(activityData.timestamp).toISOString()} - ${activityData.remarks || ''}`;
    await prisma.operations.update({
      where: { id: tripId },
      data: {
        notes: trip.notes ? `${trip.notes}\n${activityNote}` : activityNote
      }
    });

    return {
      tripId,
      activityType: activityData.activityType,
      timestamp: new Date(activityData.timestamp),
      remarks: activityData.remarks
    };
  }

  /**
   * 給油記録追加
   * @param tripId 運行記録ID
   * @param fuelData 給油データ
   * @param requesterId リクエスト者ID
   * @returns 作成された給油記録
   */
  async addFuelRecord(
    tripId: string,
    fuelData: CreateFuelRecordRequest,
    requesterId: string
  ): Promise<any> {
    const trip = await prisma.operations.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    if (trip.driverId !== requesterId) {
      throw new AppError('この運行記録に給油記録を追加する権限がありません', 403);
    }

    const totalAmount = fuelData.fuelAmount * fuelData.unitPrice;

    // Note: FuelRecordテーブルが存在しない場合はコメントアウト
    /*
    const fuelRecord = await prisma.fuelRecord.create({
      data: {
        tripId,
        fuelAmount: fuelData.fuelAmount,
        mileage: fuelData.mileage,
        unitPrice: fuelData.unitPrice,
        totalAmount,
        timestamp: new Date(),
        latitude: fuelData.latitude,
        longitude: fuelData.longitude
      }
    });

    return fuelRecord;
    */

    // 代替として、tripのfuelConsumedとfuelCostを更新
    await prisma.operations.update({
      where: { id: tripId },
      data: {
        fuelConsumed: (trip.fuelConsumed || 0) + fuelData.fuelAmount,
        fuelCost: (trip.fuelCost || 0) + totalAmount
      }
    });

    return {
      tripId,
      fuelAmount: fuelData.fuelAmount,
      unitPrice: fuelData.unitPrice,
      totalAmount,
      timestamp: new Date()
    };
  }

  /**
   * アクティブな運行記録取得（運転手用）
   * @param driverId 運転手ID
   * @returns アクティブな運行記録
   */
  async getActiveTrip(driverId: string): Promise<Trip | null> {
    const trip = await prisma.operations.findFirst({
      where: {
        driverId,
        status: {
          in: ['PLANNED', 'IN_PROGRESS']
        }
      },
      include: {
        vehicle: {
          select: {
            plateNumber: true,
            model: true,
            manufacturer: true
          }
        },
        site: {
          select: {
            name: true,
            address: true
          }
        }
      }
    });

    if (!trip) {
      return null;
    }

    return {
      id: trip.id,
      tripNumber: trip.tripNumber,
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      siteId: trip.siteId,
      startTime: trip.startTime,
      endTime: trip.endTime,
      status: trip.status,
      startLatitude: trip.startLatitude,
      startLongitude: trip.startLongitude,
      endLatitude: trip.endLatitude,
      endLongitude: trip.endLongitude,
      materialType: trip.materialType,
      loadWeight: trip.loadWeight,
      unloadWeight: trip.unloadWeight,
      distance: trip.distance,
      fuelConsumed: trip.fuelConsumed,
      fuelCost: trip.fuelCost,
      notes: trip.notes,
      weatherCondition: trip.weatherCondition,
      roadCondition: trip.roadCondition,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt
    };
  }

  /**
   * 運行記録統計取得
   * @param startDate 開始日
   * @param endDate 終了日
   * @param driverId 運転手ID（オプション）
   * @param vehicleId 車両ID（オプション）
   * @returns 統計情報
   */
  async getTripStatistics(
    startDate?: string,
    endDate?: string,
    driverId?: string,
    vehicleId?: string
  ) {
    const whereCondition: any = {};

    if (startDate || endDate) {
      whereCondition.startTime = {};
      if (startDate) whereCondition.startTime.gte = new Date(startDate);
      if (endDate) whereCondition.startTime.lte = new Date(endDate);
    }

    if (driverId) whereCondition.driverId = driverId;
    if (vehicleId) whereCondition.vehicleId = vehicleId;

    const [
      totalTrips,
      completedTrips,
      inProgressTrips,
      cancelledTrips,
      totalDistance,
      totalFuelCost,
      totalFuelConsumed,
      averageDistance,
      averageFuelCost
    ] = await Promise.all([
      prisma.operations.count({ where: whereCondition }),
      prisma.operations.count({ where: { ...whereCondition, status: 'COMPLETED' } }),
      prisma.operations.count({ where: { ...whereCondition, status: 'IN_PROGRESS' } }),
      prisma.operations.count({ where: { ...whereCondition, status: 'CANCELLED' } }),
      prisma.operations.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _sum: { distance: true }
      }).then(result => result._sum.distance || 0),
      prisma.operations.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _sum: { fuelCost: true }
      }).then(result => result._sum.fuelCost || 0),
      prisma.operations.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _sum: { fuelConsumed: true }
      }).then(result => result._sum.fuelConsumed || 0),
      prisma.operations.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _avg: { distance: true }
      }).then(result => result._avg.distance || 0),
      prisma.operations.aggregate({
        where: { ...whereCondition, status: 'COMPLETED' },
        _avg: { fuelCost: true }
      }).then(result => result._avg.fuelCost || 0)
    ]);

    // 燃費計算
    const fuelEfficiency = totalFuelConsumed > 0 ? Number(totalDistance) / Number(totalFuelConsumed) : 0;

    return {
      totalTrips,
      completedTrips,
      inProgressTrips,
      cancelledTrips,
      totalDistance: Number(totalDistance.toFixed(2)),
      totalFuelCost: Number(totalFuelCost.toFixed(0)),
      totalFuelConsumed: Number(totalFuelConsumed.toFixed(2)),
      averageDistance: Number(averageDistance.toFixed(2)),
      averageFuelCost: Number(averageFuelCost.toFixed(0)),
      fuelEfficiency: Number(fuelEfficiency.toFixed(2)),
      completionRate: totalTrips > 0 ? (completedTrips / totalTrips * 100).toFixed(1) : '0',
      cancellationRate: totalTrips > 0 ? (cancelledTrips / totalTrips * 100).toFixed(1) : '0'
    };
  }

  /**
   * GPS位置情報更新
   * @param tripId 運行記録ID
   * @param gpsData GPS座標データ
   * @param requesterId リクエスト者ID
   * @returns 更新された運行記録
   */
  async updateGPSLocation(
    tripId: string,
    gpsData: { latitude: number; longitude: number; timestamp: Date },
    requesterId: string
  ) {
    const trip = await prisma.operations.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    if (trip.driverId !== requesterId) {
      throw new AppError('この運行記録のGPS情報を更新する権限がありません', 403);
    }

    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      throw new AppError('完了またはキャンセル済みの運行記録のGPS情報は更新できません', 400);
    }

    // 開始位置が未設定の場合は開始位置として設定
    if (!trip.startLatitude || !trip.startLongitude) {
      return await prisma.operations.update({
        where: { id: tripId },
        data: {
          startLatitude: gpsData.latitude,
          startLongitude: gpsData.longitude,
          status: 'IN_PROGRESS'
        }
      });
    }

    // 進行中の場合は現在位置として記録（実際のGPSログテーブルがあればそちらに記録）
    // 現在は最新位置として記録
    return await prisma.operations.update({
      where: { id: tripId },
      data: {
        endLatitude: gpsData.latitude,
        endLongitude: gpsData.longitude
      }
    });
  }

  /**
   * 運行記録の複製作成
   * @param tripId 複製元の運行記録ID
   * @param driverId 新しい運転手ID
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   * @returns 複製された運行記録
   */
  async duplicateTrip(
    tripId: string,
    driverId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<Trip> {
    // 管理者権限チェック
    if (requesterRole === UserRole.DRIVER) {
      throw new AppError('運行記録の複製は管理者権限が必要です', 403);
    }

    const originalTrip = await prisma.operations.findUnique({
      where: { id: tripId }
    });

    if (!originalTrip) {
      throw new AppError('複製元の運行記録が見つかりません', 404);
    }

    // 新しい運行記録を作成
    const duplicateData: CreateTripRequest = {
      vehicleId: originalTrip.vehicleId,
      siteId: originalTrip.siteId,
      materialType: originalTrip.materialType,
      notes: `[複製] ${originalTrip.notes || ''}`,
      weatherCondition: originalTrip.weatherCondition
    };

    return await this.createTrip(duplicateData, driverId);
  }

  /**
   * 運転手の当日運行記録取得
   * @param driverId 運転手ID
   * @returns 当日の運行記録一覧
   */
  async getTodayTrips(driverId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    return await prisma.operations.findMany({
      where: {
        driverId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        vehicle: {
          select: {
            plateNumber: true,
            model: true
          }
        },
        site: {
          select: {
            name: true,
            address: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });
  }

  /**
   * 運行記録一括ステータス更新
   * @param tripIds 運行記録ID配列
   * @param status 新しいステータス
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   */
  async bulkUpdateTripStatus(
    tripIds: string[],
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DELAYED',
    requesterId: string,
    requesterRole: UserRole
  ) {
    // 管理者権限チェック
    if (requesterRole === UserRole.DRIVER) {
      throw new AppError('一括ステータス更新は管理者権限が必要です', 403);
    }

    if (!tripIds || tripIds.length === 0) {
      throw new AppError('更新対象の運行記録が指定されていません', 400);
    }

    const updateResult = await prisma.operations.updateMany({
      where: {
        id: {
          in: tripIds
        },
        status: {
          not: 'COMPLETED' // 完了済みは除外
        }
      },
      data: {
        status,
        ...(status === 'COMPLETED' && { endTime: new Date() }),
        ...(status === 'CANCELLED' && { endTime: new Date() })
      }
    });

    return {
      updatedCount: updateResult.count,
      message: `${updateResult.count}件の運行記録のステータスを${status}に更新しました`
    };
  }

  /**
   * 運行記録削除（論理削除）
   * @param tripId 運行記録ID
   * @param requesterId リクエスト者ID
   * @param requesterRole リクエスト者の権限
   */
  async deleteTrip(
    tripId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<void> {
    // 管理者権限チェック
    if (requesterRole !== UserRole.ADMIN) {
      throw new AppError('運行記録の削除は管理者権限が必要です', 403);
    }

    const trip = await prisma.operations.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    // 進行中の運行記録は削除不可
    if (trip.status === 'IN_PROGRESS') {
      throw new AppError('進行中の運行記録は削除できません', 400);
    }

    // 論理削除（実際の削除ではなく、ステータスを変更）
    await prisma.operations.update({
      where: { id: tripId },
      data: {
        status: 'CANCELLED',
        notes: `${trip.notes || ''}\n[削除済み: ${new Date().toISOString()}]`
      }
    });

    // 車両が使用中の場合は利用可能に戻す
    if (trip.status === 'IN_PROGRESS' || trip.status === 'PLANNED') {
      await prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: {
          status: 'AVAILABLE',
          assignedDriverId: null
        }
      });
    }
  }

  /**
   * 運転手の現在の運行記録取得（アクティブトリップ）
   * @param driverId 運転手ID
   * @returns 現在の運行記録
   */
  async getCurrentTripByDriver(driverId: string) {
    return await this.getActiveTrip(driverId);
  }
}