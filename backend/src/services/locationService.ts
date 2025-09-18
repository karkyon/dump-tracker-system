import { PrismaClient } from '@prisma/client';
import { 
  LocationModel,
  LocationCreateInput,
  LocationUpdateInput,
  LocationResponseDTO,
  OperationDetailModel 
} from '../types';
import { AppError } from '../utils/errors';

const prisma = new PrismaClient();

export class LocationService {
  /**
   * 場所一覧取得（ページネーション・フィルター対応）
   * @param filter フィルター条件
   * @returns 場所一覧
   */
  async getLocations(filter: LocationFilter): Promise<PaginatedResponse<Location>> {
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
        { customerName: { contains: search, mode: 'insensitive' } },
        { locationName: { contains: search, mode: 'insensitive' } },
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
      },
      include: {
        createdBy: {
          select: {
            name: true
          }
        }
      }
    });

    const totalPages = Math.ceil(total / take);

    // レスポンス形式に変換
    const formattedLocations = locations.map(location => ({
      id: location.id,
      customerName: location.customerName,
      locationName: location.locationName,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      locationType: location.locationType,
      isActive: location.isActive,
      registrationSource: location.registrationSource,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      createdByName: location.createdBy?.name
    }));

    return {
      data: formattedLocations,
      total,
      page,
      limit: take,
      totalPages
    };
  }

  /**
   * 場所詳細取得
   * @param locationId 場所ID
   * @returns 場所情報
   */
  async getLocationById(locationId: string): Promise<Location & { usageCount?: number; recentUsage?: any[] }> {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        createdBy: {
          select: {
            name: true
          }
        }
      }
    });

    if (!location) {
      throw new AppError('場所が見つかりません', 404);
    }

    // 使用回数を取得
    const usageCount = await prisma.tripDetail.count({
      where: { locationId }
    });

    // 最近の使用履歴を取得
    const recentUsage = await prisma.tripDetail.findMany({
      where: { locationId },
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: {
        trip: {
          select: {
            date: true,
            driver: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    return {
      id: location.id,
      customerName: location.customerName,
      locationName: location.locationName,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      locationType: location.locationType,
      isActive: location.isActive,
      registrationSource: location.registrationSource,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      usageCount,
      recentUsage: recentUsage.map(usage => ({
        activityType: usage.activityType,
        timestamp: usage.timestamp,
        tripDate: usage.trip.date,
        driverName: usage.trip.driver.name
      }))
    };
  }

  /**
   * 場所作成
   * @param locationData 場所データ
   * @param creatorId 作成者ID
   * @returns 作成された場所
   */
  async createLocation(locationData: CreateLocationRequest, creatorId?: string): Promise<Location> {
    const {
      customerName,
      locationName,
      address,
      latitude,
      longitude,
      locationType
    } = locationData;

    // GPS座標の有効性チェック
    if (latitude && longitude && !isValidCoordinate(latitude, longitude)) {
      throw new AppError('無効なGPS座標です', 400);
    }

    // 重複チェック（同じ客先・場所名の組み合わせ）
    const existingLocation = await prisma.location.findFirst({
      where: {
        customerName,
        locationName,
        address
      }
    });

    if (existingLocation) {
      throw new AppError('同じ客先名・場所名・住所の組み合わせが既に存在します', 409);
    }

    // 場所作成
    const newLocation = await prisma.location.create({
      data: {
        customerName,
        locationName,
        address,
        latitude,
        longitude,
        locationType,
        createdById: creatorId,
        registrationSource: creatorId ? 'admin' : 'app'
      }
    });

    return {
      id: newLocation.id,
      customerName: newLocation.customerName,
      locationName: newLocation.locationName,
      address: newLocation.address,
      latitude: newLocation.latitude,
      longitude: newLocation.longitude,
      locationType: newLocation.locationType,
      isActive: newLocation.isActive,
      registrationSource: newLocation.registrationSource,
      createdAt: newLocation.createdAt,
      updatedAt: newLocation.updatedAt
    };
  }

  /**
   * 場所情報更新
   * @param locationId 場所ID
   * @param updateData 更新データ
   * @returns 更新された場所
   */
  async updateLocation(locationId: string, updateData: UpdateLocationRequest): Promise<Location> {
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
    if (updateData.customerName || updateData.locationName || updateData.address) {
      const duplicateLocation = await prisma.location.findFirst({
        where: {
          AND: [
            { id: { not: locationId } },
            {
              customerName: updateData.customerName || existingLocation.customerName,
              locationName: updateData.locationName || existingLocation.locationName,
              address: updateData.address || existingLocation.address
            }
          ]
        }
      });

      if (duplicateLocation) {
        throw new AppError('同じ客先名・場所名・住所の組み合わせが既に存在します', 409);
      }
    }

    // 場所更新
    const updatedLocation = await prisma.location.update({
      where: { id: locationId },
      data: updateData
    });

    return {
      id: updatedLocation.id,
      customerName: updatedLocation.customerName,
      locationName: updatedLocation.locationName,
      address: updatedLocation.address,
      latitude: updatedLocation.latitude,
      longitude: updatedLocation.longitude,
      locationType: updatedLocation.locationType,
      isActive: updatedLocation.isActive,
      registrationSource: updatedLocation.registrationSource,
      createdAt: updatedLocation.createdAt,
      updatedAt: updatedLocation.updatedAt
    };
  }

  /**
   * 場所削除（論理削除）
   * @param locationId 場所ID
   */
  async deleteLocation(locationId: string): Promise<void> {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        tripDetails: {
          where: {
            trip: {
              status: {
                in: ['PREPARING', 'IN_PROGRESS']
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
    if (location.tripDetails.length > 0) {
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
  ): Promise<Array<{ id: string; customerName: string; locationName: string; address: string }>> {
    return await prisma.location.findMany({
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
        customerName: true,
        locationName: true,
        address: true
      },
      orderBy: [
        { customerName: 'asc' },
        { locationName: 'asc' }
      ]
    });
  }

  /**
   * 積込場所一覧取得（簡易版）
   * @returns 積込場所一覧
   */
  async getLoadingLocations(): Promise<Array<{ id: string; customerName: string; locationName: string }>> {
    return this.getLocationsByType(LocationType.LOADING);
  }

  /**
   * 積下場所一覧取得（簡易版）
   * @returns 積下場所一覧
   */
  async getUnloadingLocations(): Promise<Array<{ id: string; customerName: string; locationName: string }>> {
    return this.getLocationsByType(LocationType.UNLOADING);
  }

  /**
   * 客先一覧取得（ユニーク）
   * @returns 客先一覧
   */
  async getCustomers(): Promise<string[]> {
    const result = await prisma.location.findMany({
      where: { isActive: true },
      select: { customerName: true },
      distinct: ['customerName'],
      orderBy: { customerName: 'asc' }
    });

    return result.map(customer => customer.customerName);
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
  ): Promise<Array<{ id: string; customerName: string; locationName: string; address: string; locationType: LocationType }>> {
    if (!query || query.length < 2) {
      return [];
    }

    const where: any = {
      isActive: true,
      OR: [
        { customerName: { contains: query, mode: 'insensitive' } },
        { locationName: { contains: query, mode: 'insensitive' } },
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

    return await prisma.location.findMany({
      where,
      select: {
        id: true,
        customerName: true,
        locationName: true,
        address: true,
        locationType: true
      },
      take: limit,
      orderBy: [
        { customerName: 'asc' },
        { locationName: 'asc' }
      ]
    });
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
  ): Promise<Array<Location & { distance: number }>> {
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
          location.latitude!, location.longitude!
        );
        return {
          ...location,
          distance: Number(distance.toFixed(3))
        };
      })
      .filter(location => location.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return locationsWithDistance.map(location => ({
      id: location.id,
      customerName: location.customerName,
      locationName: location.locationName,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      locationType: location.locationType,
      isActive: location.isActive,
      registrationSource: location.registrationSource,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      distance: location.distance
    }));
  }

  /**
   * アプリからの自動登録（GPS座標付き）
   * @param locationData 場所データ
   * @returns 作成された場所
   */
  async autoRegisterFromApp(
    locationData: CreateLocationRequest & { latitude: number; longitude: number }
  ): Promise<Location> {
    const { latitude, longitude } = locationData;

    // GPS座標の有効性チェック
    if (!isValidCoordinate(latitude, longitude)) {
      throw new AppError('無効なGPS座標です', 400);
    }

    // 近くに同じような場所がないかチェック
    const nearbyLocations = await this.findNearbyLocations(latitude, longitude, 0.1, 5);
    
    const similarLocation = nearbyLocations.find(loc => 
      loc.customerName.toLowerCase().includes(locationData.customerName.toLowerCase()) ||
      locationData.customerName.toLowerCase().includes(loc.customerName.toLowerCase())
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
      whereCondition.trip = {
        date: {}
      };
      if (startDate) whereCondition.trip.date.gte = new Date(startDate);
      if (endDate) whereCondition.trip.date.lte = new Date(endDate);
    }

    const [
      totalUsage,
      loadingCount,
      unloadingCount,
      uniqueDrivers,
      recentActivity
    ] = await Promise.all([
      // 総使用回数
      prisma.tripDetail.count({
        where: whereCondition
      }),
      
      // 積込活動回数
      prisma.tripDetail.count({
        where: {
          ...whereCondition,
          activityType: {
            in: ['LOADING_ARRIVAL', 'LOADING_DEPARTURE']
          }
        }
      }),
      
      // 積下活動回数
      prisma.tripDetail.count({
        where: {
          ...whereCondition,
          activityType: {
            in: ['UNLOADING_ARRIVAL', 'UNLOADING_DEPARTURE']
          }
        }
      }),
      
      // ユニーク運転手数
      prisma.tripDetail.groupBy({
        by: ['trip'],
        where: whereCondition
      }).then(async (results) => {
        const tripIds = results.map(r => r.trip);
        const uniqueDriversResult = await prisma.trip.groupBy({
          by: ['driverId'],
          where: { id: { in: tripIds } }
        });
        return uniqueDriversResult.length;
      }),
      
      // 最近の活動
      prisma.tripDetail.findMany({
        where: whereCondition,
        take: 5,
        orderBy: { timestamp: 'desc' },
        include: {
          trip: {
            select: {
              driver: {
                select: { name: true }
              }
            }
          }
        }
      })
    ]);

    return {
      locationInfo: {
        customerName: location.customerName,
        locationName: location.locationName,
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
          timestamp: activity.timestamp,
          driverName: activity.trip?.driver.name
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