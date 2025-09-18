import { PrismaClient, LocationType } from '@prisma/client';
import { 
  LocationModel,
  LocationCreateInput,
  LocationUpdateInput,
  LocationResponseDTO,
  OperationDetailModel 
} from '../types';
import { PaginatedResponse } from '../utils/asyncHandler';
import { isValidCoordinate } from '../utils/gpsCalculations';
import { LocationFilter, CreateLocationRequest, UpdateLocationRequest } from '../types/location';
import { AppError } from '../utils/errors';

const prisma = new PrismaClient();

export class LocationService {
  /**
   * 場所一覧取得（ページネーション・フィルター対応）
   * @param filter フィルター条件
   * @returns 場所一覧
   */
  async getLocations(filter: LocationFilter): Promise<PaginatedResponse<LocationModel>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      locationType,
      isActive,
      search
    } = filter;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    // 検索条件構築
    const where: any = {};

    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (locationType) {
      where.locationType = locationType;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    // 総件数取得
    const total = await prisma.location.count({ where });

    // 場所取得
    const locations = await prisma.location.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder
      }
    });

    const totalPages = Math.ceil(total / take);

    return {
      data: locations,
      total,
      page,
      limit: take,
      totalPages,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: take
      }
    };
  }

  /**
   * 場所詳細取得
   * @param locationId 場所ID
   * @returns 場所情報
   */
  async getLocationById(locationId: string): Promise<LocationModel & { usageCount?: number; recentUsage?: any[] }> {
    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      throw new AppError('場所が見つかりません', 404);
    }

    // 使用回数を取得
    const usageCount = await prisma.operationDetail.count({
      where: { locationId }
    });

    // 最近の使用履歴を取得
    const recentUsage = await prisma.operationDetail.findMany({
      where: { locationId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        operations: {
          select: {
            plannedStartTime: true,
            usersOperationsDriverIdTousers: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    return {
      ...location,
      usageCount,
      recentUsage: recentUsage.map(usage => ({
        activityType: usage.activityType,
        timestamp: usage.createdAt,
        plannedTime: usage.operations.plannedStartTime,
        driverName: usage.operations.usersOperationsDriverIdTousers.name
      }))
    };
  }

  /**
   * 場所作成
   * @param locationData 場所データ
   * @param creatorId 作成者ID
   * @returns 作成された場所
   */
  async createLocation(locationData: CreateLocationRequest, creatorId?: string): Promise<LocationModel> {
    const {
      name,
      clientName,
      address,
      latitude,
      longitude,
      locationType,
      contactPerson,
      contactPhone,
      contactEmail,
      operatingHours,
      specialInstructions,
      hazardousArea,
      accessRestrictions,
      parkingInstructions,
      unloadingInstructions,
      equipmentAvailable
    } = locationData;

    // GPS座標の有効性チェック
    if (latitude && longitude && !isValidCoordinate(latitude, longitude)) {
      throw new AppError('無効なGPS座標です', 400);
    }

    // 重複チェック（同じ名前の場所）
    const existingLocation = await prisma.location.findFirst({
      where: {
        name,
        address
      }
    });

    if (existingLocation) {
      throw new AppError('同じ名前・住所の組み合わせが既に存在します', 409);
    }

    // 場所作成
    const newLocation = await prisma.location.create({
      data: {
        name,
        clientName,
        address,
        latitude,
        longitude,
        locationType,
        contactPerson,
        contactPhone,
        contactEmail,
        operatingHours,
        specialInstructions,
        hazardousArea,
        accessRestrictions,
        parkingInstructions,
        unloadingInstructions,
        equipmentAvailable
      }
    });

    return newLocation;
  }

  /**
   * 場所情報更新
   * @param locationId 場所ID
   * @param updateData 更新データ
   * @returns 更新された場所
   */
  async updateLocation(locationId: string, updateData: UpdateLocationRequest): Promise<LocationModel> {
    // 場所存在確認
    const existingLocation = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!existingLocation) {
      throw new AppError('場所が見つかりません', 404);
    }

    // GPS座標の有効性チェック
    if (updateData.latitude && updateData.longitude && 
        !isValidCoordinate(updateData.latitude, updateData.longitude)) {
      throw new AppError('無効なGPS座標です', 400);
    }

    // 重複チェック（更新する場合）
    if (updateData.name || updateData.address) {
      const duplicateLocation = await prisma.location.findFirst({
        where: {
          AND: [
            { id: { not: locationId } },
            {
              name: updateData.name || existingLocation.name,
              address: updateData.address || existingLocation.address
            }
          ]
        }
      });

      if (duplicateLocation) {
        throw new AppError('同じ名前・住所の組み合わせが既に存在します', 409);
      }
    }

    // 場所更新
    const updatedLocation = await prisma.location.update({
      where: { id: locationId },
      data: updateData
    });

    return updatedLocation;
  }

  /**
   * 場所削除（論理削除）
   * @param locationId 場所ID
   */
  async deleteLocation(locationId: string): Promise<void> {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        operationDetails: {
          where: {
            operations: {
              status: {
                in: ['PLANNING', 'IN_PROGRESS']
              }
            }
          }
        }
      }
    });

    if (!location) {
      throw new AppError('場所が見つかりません', 404);
    }

    // アクティブな運行記録で使用中の場合は削除不可
    if (location.operationDetails.length > 0) {
      throw new AppError('進行中の運行記録で使用されているため、この場所を削除できません', 400);
    }

    // 場所を無効化
    await prisma.location.update({
      where: { id: locationId },
      data: { isActive: false }
    });
  }

  /**
   * 場所タイプ別一覧取得
   * @param locationType 場所タイプ
   * @param isActive アクティブフラグ
   * @returns 場所一覧
   */
  async getLocationsByType(
    locationType: LocationType,
    isActive: boolean = true
  ): Promise<Array<{ id: string; clientName: string; name: string; address: string }>> {
    const locations = await prisma.location.findMany({
      where: {
        locationType: {
          in: locationType === LocationType.BOTH 
            ? [LocationType.LOADING, LocationType.UNLOADING, LocationType.BOTH]
            : [locationType, LocationType.BOTH]
        },
        isActive
      },
      select: {
        id: true,
        clientName: true,
        name: true,
        address: true
      },
      orderBy: [
        { clientName: 'asc' },
        { name: 'asc' }
      ]
    });

    return locations.map(location => ({
      id: location.id,
      clientName: location.clientName || '',
      name: location.name,
      address: location.address
    }));
  }

  /**
   * 積込場所一覧取得（簡易版）
   * @returns 積込場所一覧
   */
  async getLoadingLocations(): Promise<Array<{ id: string; clientName: string; name: string }>> {
    const locations = await this.getLocationsByType(LocationType.LOADING);
    return locations.map(loc => ({
      id: loc.id,
      clientName: loc.clientName,
      name: loc.name
    }));
  }

  /**
   * 積下場所一覧取得（簡易版）
   * @returns 積下場所一覧
   */
  async getUnloadingLocations(): Promise<Array<{ id: string; clientName: string; name: string }>> {
    const locations = await this.getLocationsByType(LocationType.UNLOADING);
    return locations.map(loc => ({
      id: loc.id,
      clientName: loc.clientName,
      name: loc.name
    }));
  }

  /**
   * 客先一覧取得（ユニーク）
   * @returns 客先一覧
   */
  async getCustomers(): Promise<string[]> {
    const result = await prisma.location.findMany({
      where: { 
        isActive: true,
        clientName: { not: null }
      },
      select: { clientName: true },
      distinct: ['clientName'],
      orderBy: { clientName: 'asc' }
    });

    return result.map(customer => customer.clientName!).filter(Boolean);
  }

  /**
   * 場所検索（オートコンプリート用）
   * @param query 検索クエリ
   * @param locationType 場所タイプ（オプション）
   * @param limit 取得件数
   * @returns 場所一覧
   */
  async searchLocations(
    query: string, 
    locationType?: LocationType, 
    limit: number = 10
  ): Promise<Array<{ id: string; clientName: string; name: string; address: string; locationType: LocationType }>> {
    if (!query || query.length < 2) {
      return [];
    }

    const where: any = {
      isActive: true,
      OR: [
        { clientName: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } }
      ]
    };

    if (locationType) {
      where.locationType = {
        in: locationType === LocationType.BOTH
          ? [LocationType.LOADING, LocationType.UNLOADING, LocationType.BOTH]
          : [locationType, LocationType.BOTH]
      };
    }

    const locations = await prisma.location.findMany({
      where,
      select: {
        id: true,
        clientName: true,
        name: true,
        address: true,
        locationType: true
      },
      take: limit,
      orderBy: [
        { clientName: 'asc' },
        { name: 'asc' }
      ]
    });

    return locations.map(location => ({
      id: location.id,
      clientName: location.clientName || '',
      name: location.name,
      address: location.address,
      locationType: location.locationType
    }));
  }

  /**
   * GPS座標から近くの場所を検索
   * @param latitude 緯度
   * @param longitude 経度
   * @param radiusKm 検索半径（km）
   * @param limit 取得件数
   * @returns 近くの場所一覧
   */
  async findNearbyLocations(
    latitude: number,
    longitude: number,
    radiusKm: number = 1.0,
    limit: number = 10
  ): Promise<Array<LocationModel & { distance: number }>> {
    if (!isValidCoordinate(latitude, longitude)) {
      throw new AppError('無効なGPS座標です', 400);
    }

    // GPS座標を持つアクティブな場所を取得
    const locations = await prisma.location.findMany({
      where: {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null }
      }
    });

    // 距離を計算して近い順にソート
    const locationsWithDistance = locations
      .map(location => {
        const distance = this.calculateDistance(
          latitude, longitude,
          Number(location.latitude!), Number(location.longitude!)
        );
        return {
          ...location,
          distance: Number(distance.toFixed(3))
        };
      })
      .filter(location => location.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return locationsWithDistance;
  }

  /**
   * アプリからの自動登録（GPS座標付き）
   * @param locationData 場所データ
   * @returns 作成された場所
   */
  async autoRegisterFromApp(
    locationData: CreateLocationRequest & { latitude: number; longitude: number }
  ): Promise<LocationModel> {
    const { latitude, longitude } = locationData;

    // GPS座標の有効性チェック
    if (!isValidCoordinate(latitude, longitude)) {
      throw new AppError('無効なGPS座標です', 400);
    }

    // 近くに同じような場所がないかチェック
    const nearbyLocations = await this.findNearbyLocations(latitude, longitude, 0.1, 5);
    
    const similarLocation = nearbyLocations.find(loc => 
      (loc.clientName && loc.clientName.toLowerCase().includes(locationData.clientName?.toLowerCase() || '')) ||
      (locationData.clientName && locationData.clientName.toLowerCase().includes(loc.clientName?.toLowerCase() || ''))
    );

    if (similarLocation) {
      // 既存の類似場所を返す
      return similarLocation;
    }

    // 新規作成
    return this.createLocation({
      ...locationData,
      latitude,
      longitude
    });
  }

  /**
   * 場所の使用統計取得
   * @param locationId 場所ID
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 使用統計
   */
  async getLocationStats(locationId: string, startDate?: string, endDate?: string) {
    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      throw new AppError('場所が見つかりません', 404);
    }

    const whereCondition: any = { locationId };

    if (startDate || endDate) {
      whereCondition.operations = {
        plannedStartTime: {}
      };
      if (startDate) whereCondition.operations.plannedStartTime.gte = new Date(startDate);
      if (endDate) whereCondition.operations.plannedStartTime.lte = new Date(endDate);
    }

    const [
      totalUsage,
      loadingCount,
      unloadingCount,
      uniqueDrivers,
      recentActivity
    ] = await Promise.all([
      // 総使用回数
      prisma.operationDetail.count({
        where: whereCondition
      }),
      
      // 積込活動回数
      prisma.operationDetail.count({
        where: {
          ...whereCondition,
          activityType: 'LOADING'
        }
      }),
      
      // 積下活動回数
      prisma.operationDetail.count({
        where: {
          ...whereCondition,
          activityType: 'UNLOADING'
        }
      }),
      
      // ユニーク運転手数
      prisma.operationDetail.groupBy({
        by: ['operationId'],
        where: whereCondition
      }).then(async (results) => {
        const operationIds = results.map(r => r.operationId);
        const uniqueDriversResult = await prisma.operation.groupBy({
          by: ['driverId'],
          where: { id: { in: operationIds } }
        });
        return uniqueDriversResult.length;
      }),
      
      // 最近の活動
      prisma.operationDetail.findMany({
        where: whereCondition,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          operations: {
            select: {
              usersOperationsDriverIdTousers: {
                select: { name: true }
              }
            }
          }
        }
      })
    ]);

    return {
      locationInfo: {
        clientName: location.clientName,
        name: location.name,
        address: location.address,
        locationType: location.locationType
      },
      statistics: {
        totalUsage,
        loadingCount,
        unloadingCount,
        uniqueDrivers,
        recentActivity: recentActivity.map(activity => ({
          activityType: activity.activityType,
          timestamp: activity.createdAt,
          driverName: activity.operations?.usersOperationsDriverIdTousers.name
        }))
      }
    };
  }

  /**
   * 2点間の距離を計算（簡易版）
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}