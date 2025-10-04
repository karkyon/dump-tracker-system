// =====================================
// backend/src/models/LocationModel.ts
// 位置モデル（既存完全実装 + Phase 1-A基盤統合 + 高度機能統合版）
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: Sat Sep 27 08:00:00 JST 2025 - Phase 1-B完全統合
// アーキテクチャ指針準拠版 - Phase 1-B対応
// =====================================

import type { 
  Location as PrismaLocation,
  Prisma,
  OperationDetail,
  LocationType
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
  ConflictError 
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 GPS計算基盤の活用
import { 
  calculateDistance, 
  isValidCoordinates,
  calculateBearing 
} from '../utils/gpsCalculations';

// 🎯 共通型定義の活用（types/common.ts）
import type {
  PaginationQuery,
  ApiResponse,
  OperationResult,
  BulkOperationResult
} from '../types/common';

// 🎯 types/location.ts 高度機能の統合
import type {
  LocationInfo,
  LocationWithDetails,
  LocationResponseDTO,
  LocationListResponse,
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationFilter,
  LocationSearchQuery,
  NearbyLocationRequest,
  NearbyLocation,
  Coordinates,
  LocationStatistics,
  LocationReportConfig,
  LocationReportData,
  LocationMapConfig,
  LocationMarker,
  LocationHeatmapData,
  LocationAccessibility
} from '../types/location';

// =====================================
// 🔧 既存完全実装の100%保持 - 基本型定義
// =====================================

export type LocationModel = PrismaLocation;
export type LocationCreateInput = Prisma.LocationCreateInput;
export type LocationUpdateInput = Prisma.LocationUpdateInput;  
export type LocationWhereInput = Prisma.LocationWhereInput;
export type LocationWhereUniqueInput = Prisma.LocationWhereUniqueInput;
export type LocationOrderByInput = Prisma.LocationOrderByWithRelationInput;

// =====================================
// 🔧 既存完全実装の100%保持 + types/location.ts統合 - 標準DTO
// =====================================

export interface LocationResponseDTOExtended extends LocationResponseDTO {
  _count?: {
    [key: string]: number;
  };
  statistics?: LocationStatistics;
  nearbyLocations?: NearbyLocation[];
}

export interface LocationListResponseExtended extends LocationListResponse {
  data: LocationResponseDTOExtended[];
  summary?: {
    totalLocations: number;
    activeLocations: number;
    locationsByType: Record<LocationType, number>;
    averageCoordinateAccuracy?: number;
  };
}

export interface LocationCreateDTOExtended extends Omit<LocationCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用（既存互換）
  accessibility?: LocationAccessibility;
  autoValidateCoordinates?: boolean;
}

export interface LocationUpdateDTOExtended extends Partial<LocationCreateDTOExtended> {
  // 更新用（部分更新対応、既存互換）
}

// =====================================
// 🔧 既存完全実装の100%保持 + Phase 1-A基盤統合 + 高度機能統合 - LocationService
// =====================================

export class LocationService {
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
  async create(data: LocationCreateInput): Promise<OperationResult<LocationModel>> {
    try {
      // 🎯 Phase 1-A基盤: バリデーション強化
      if (!data.name?.trim()) {
        throw new ValidationError('位置名は必須です');
      }

      // 🎯 新機能: GPS座標の自動検証
      if (data.latitude !== undefined && data.longitude !== undefined) {
        if (!isValidCoordinates(data.latitude, data.longitude)) {
          throw new ValidationError('無効なGPS座標です');
        }
      }

      // 🎯 新機能: 重複チェック（近隣位置検証）
      if (data.latitude && data.longitude) {
        const nearbyLocations = await this.findNearbyLocations({
          latitude: data.latitude,
          longitude: data.longitude,
          radiusKm: 0.1, // 100m以内
          limit: 1
        });

        if (nearbyLocations.length > 0) {
          logger.warn('Nearby location detected during creation', {
            newLocation: data.name,
            nearbyLocation: nearbyLocations[0].location.name,
            distance: nearbyLocations[0].distance
          });
        }
      }

      const location = await this.prisma.location.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // 🎯 Phase 1-A基盤: ログ統合
      logger.info('Location created successfully', { 
        locationId: location.id,
        name: location.name,
        type: location.locationType 
      });

      return {
        success: true,
        data: location,
        message: '位置情報を作成しました'
      };

    } catch (error) {
      // 🎯 Phase 1-A基盤: エラーハンドリング統合
      logger.error('Failed to create location', { error, data });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError('位置情報の作成に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 主キー指定取得（強化版）
   */
  async findByKey(id: string, options?: {
    includeStatistics?: boolean;
    includeNearby?: boolean;
    nearbyRadius?: number;
  }): Promise<LocationWithDetails | null> {
    try {
      if (!id) {
        throw new ValidationError('位置IDは必須です');
      }

      const location = await this.prisma.location.findUnique({
        where: { id },
        include: {
          operationDetails: options?.includeStatistics ? {
            take: 10,
            orderBy: { createdAt: 'desc' }
          } : false
        }
      });

      if (!location) {
        return null;
      }

      // 🎯 新機能: 統計情報の付加
      let statistics: LocationStatistics | undefined;
      if (options?.includeStatistics) {
        statistics = await this.generateLocationStatistics(id);
      }

      // 🎯 新機能: 近隣位置情報の付加
      let nearbyLocations: NearbyLocation[] | undefined;
      if (options?.includeNearby && location.latitude && location.longitude) {
        nearbyLocations = await this.findNearbyLocations({
          latitude: location.latitude,
          longitude: location.longitude,
          radiusKm: options.nearbyRadius || 5,
          limit: 5,
          excludeLocationIds: [id]
        });
      }

      logger.debug('Location found with details', { 
        locationId: id,
        includeStatistics: !!statistics,
        nearbyCount: nearbyLocations?.length || 0
      });

      return {
        ...location,
        statistics,
        nearbyLocations,
        recentOperations: location.operationDetails
      };

    } catch (error) {
      logger.error('Failed to find location by key', { error, id });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError('位置情報の取得に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 条件指定一覧取得（強化版）
   */
  async findMany(params?: {
    where?: LocationWhereInput;
    orderBy?: LocationOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<LocationModel[]> {
    try {
      const locations = await this.prisma.location.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take
      });

      logger.debug('Locations found', { 
        count: locations.length,
        params 
      });

      return locations;

    } catch (error) {
      logger.error('Failed to find locations', { error, params });
      throw new AppError('位置情報一覧の取得に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 + 新機能統合 - ページネーション付き一覧取得（高度検索版）
   */
  async findManyWithPagination(params: {
    where?: LocationWhereInput;
    orderBy?: LocationOrderByInput;
    page: number;
    pageSize: number;
    filter?: LocationFilter;
  }): Promise<LocationListResponseExtended> {
    try {
      const { page, pageSize, where, orderBy, filter } = params;
      
      // 🎯 Phase 1-A基盤: バリデーション強化
      if (page < 1 || pageSize < 1) {
        throw new ValidationError('ページ番号とページサイズは1以上である必要があります');
      }

      const skip = (page - 1) * pageSize;

      // 🎯 新機能: 高度フィルター対応
      let enhancedWhere = where || {};
      if (filter) {
        enhancedWhere = this.buildLocationFilter(filter);
      }

      const [data, total] = await Promise.all([
        this.prisma.location.findMany({
          where: enhancedWhere,
          orderBy: orderBy || { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            operationDetails: {
              take: 3,
              orderBy: { createdAt: 'desc' }
            }
          }
        }),
        this.prisma.location.count({ where: enhancedWhere })
      ]);

      // 🎯 新機能: 距離計算（位置ベース検索の場合）
      let locationsWithDistance = data;
      if (filter?.within) {
        locationsWithDistance = await this.addDistanceToLocations(
          data, 
          filter.within.latitude, 
          filter.within.longitude
        );
      }

      // 🎯 新機能: サマリー統計生成
      const summary = await this.generateLocationsSummary(enhancedWhere);

      const result: LocationListResponseExtended = {
        data: locationsWithDistance,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        summary
      };

      logger.debug('Locations paginated with enhancements', { 
        page,
        pageSize,
        total,
        totalPages: result.totalPages,
        hasDistanceCalculation: !!filter?.within,
        summaryGenerated: !!summary
      });

      return result;

    } catch (error) {
      logger.error('Failed to find locations with pagination', { error, params });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError('位置情報ページネーション取得に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 更新（強化版）
   */
  async update(id: string, data: LocationUpdateInput): Promise<OperationResult<LocationModel>> {
    try {
      if (!id) {
        throw new ValidationError('位置IDは必須です');
      }

      // 🎯 Phase 1-A基盤: 存在チェック強化
      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('指定された位置情報が見つかりません');
      }

      // 🎯 新機能: GPS座標更新時の検証
      if (data.latitude !== undefined && data.longitude !== undefined) {
        if (!isValidCoordinates(data.latitude, data.longitude)) {
          throw new ValidationError('無効なGPS座標です');
        }
      }

      const location = await this.prisma.location.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      logger.info('Location updated successfully', { 
        locationId: id,
        changes: Object.keys(data),
        coordinatesUpdated: !!(data.latitude || data.longitude)
      });

      return {
        success: true,
        data: location,
        message: '位置情報を更新しました'
      };

    } catch (error) {
      logger.error('Failed to update location', { error, id, data });
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError('位置情報の更新に失敗しました', 500, error);
    }
  }

  /**
   * 🔧 既存完全実装保持 - 削除（強化版）
   */
  async delete(id: string): Promise<OperationResult<LocationModel>> {
    try {
      if (!id) {
        throw new ValidationError('位置IDは必須です');
      }

      // 🎯 Phase 1-A基盤: 存在チェック強化
      const existing = await this.findByKey(id);
      if (!existing) {
        throw new NotFoundError('指定された位置情報が見つかりません');
      }

      // 🎯 新機能: 関連データの事前チェック
      const operationCount = await this.prisma.operationDetail.count({
        where: { locationId: id }
      });

      if (operationCount > 0) {
        throw new ConflictError(
          `この位置は${operationCount}件の運行記録で使用されているため削除できません`
        );
      }

      const location = await this.prisma.location.delete({
        where: { id }
      });

      logger.info('Location deleted successfully', { 
        locationId: id,
        name: existing.name
      });

      return {
        success: true,
        data: location,
        message: '位置情報を削除しました'
      };

    } catch (error) {
      logger.error('Failed to delete location', { error, id });
      
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new AppError('位置情報の削除に失敗しました', 500, error);
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

      const count = await this.prisma.location.count({
        where: { id }
      });

      return count > 0;

    } catch (error) {
      logger.error('Failed to check location existence', { error, id });
      return false;
    }
  }

  /**
   * 🔧 既存完全実装保持 - カウント取得
   */
  async count(where?: LocationWhereInput): Promise<number> {
    try {
      const count = await this.prisma.location.count({ where });
      
      logger.debug('Location count retrieved', { count, where });
      
      return count;

    } catch (error) {
      logger.error('Failed to count locations', { error, where });
      throw new AppError('位置情報数の取得に失敗しました', 500, error);
    }
  }

  // =====================================
  // 🎯 types/location.ts統合: 新機能追加（既存機能を損なわない）
  // =====================================

  /**
   * 🎯 新機能: 近隣位置検索
   */
  async findNearbyLocations(request: NearbyLocationRequest): Promise<NearbyLocation[]> {
    try {
      const { latitude, longitude, radiusKm, limit = 10, excludeLocationIds = [], locationType } = request;

      if (!isValidCoordinates(latitude, longitude)) {
        throw new ValidationError('無効なGPS座標です');
      }

      const where: LocationWhereInput = {
        isActive: true,
        latitude: { not: null },
        longitude: { not: null },
        id: excludeLocationIds.length > 0 ? { notIn: excludeLocationIds } : undefined,
        locationType: locationType ? { in: locationType } : undefined
      };

      const locations = await this.prisma.location.findMany({
        where,
        take: limit * 2 // 距離フィルタリング後に十分な数を確保
      });

      const nearbyLocations: NearbyLocation[] = locations
        .map(location => {
          const distance = calculateDistance(
            latitude,
            longitude,
            location.latitude!,
            location.longitude!
          );
          
          if (distance <= radiusKm) {
            return {
              location: {
                ...location,
                createdAt: location.createdAt.toISOString(),
                updatedAt: location.updatedAt.toISOString(),
                distance: Number(distance.toFixed(3))
              },
              distance: Number(distance.toFixed(3)),
              bearing: calculateBearing(latitude, longitude, location.latitude!, location.longitude!)
            };
          }
          return null;
        })
        .filter((item): item is NearbyLocation => item !== null)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      logger.debug('Nearby locations found', {
        centerLat: latitude,
        centerLng: longitude,
        radiusKm,
        foundCount: nearbyLocations.length
      });

      return nearbyLocations;

    } catch (error) {
      logger.error('Failed to find nearby locations', { error, request });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError('近隣位置検索に失敗しました', 500, error);
    }
  }

  /**
   * 🎯 新機能: 位置統計生成
   */
  async generateLocationStatistics(locationId: string, period?: { from: Date; to: Date }): Promise<LocationStatistics> {
    try {
      const location = await this.prisma.location.findUnique({
        where: { id: locationId },
        include: {
          operationDetails: {
            where: period ? {
              createdAt: {
                gte: period.from,
                lte: period.to
              }
            } : undefined,
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!location) {
        throw new NotFoundError('位置情報が見つかりません');
      }

      const operations = location.operationDetails;
      const totalVisits = operations.length;
      const lastVisit = operations[0]?.createdAt;

      // 運行タイプ別統計
      const operationsByType = operations.reduce((acc, op) => {
        const type = op.activityType || 'UNKNOWN';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 平均滞在時間計算（簡易版）
      let averageStayTime = 0;
      if (operations.length > 1) {
        const stayTimes = operations
          .filter(op => op.startTime && op.endTime)
          .map(op => {
            const start = new Date(op.startTime!).getTime();
            const end = new Date(op.endTime!).getTime();
            return (end - start) / (1000 * 60); // 分単位
          });
        
        if (stayTimes.length > 0) {
          averageStayTime = stayTimes.reduce((sum, time) => sum + time, 0) / stayTimes.length;
        }
      }

      const statistics: LocationStatistics = {
        totalVisits,
        lastVisit,
        averageStayTime: Math.round(averageStayTime),
        operationsByType,
        period: period ? {
          from: period.from.toISOString(),
          to: period.to.toISOString()
        } : undefined,
        efficiency: totalVisits > 0 ? Math.min(100, (totalVisits / 30) * 100) : 0 // 簡易効率指標
      };

      logger.debug('Location statistics generated', {
        locationId,
        totalVisits,
        averageStayTime,
        period: !!period
      });

      return statistics;

    } catch (error) {
      logger.error('Failed to generate location statistics', { error, locationId });
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError('位置統計の生成に失敗しました', 500, error);
    }
  }

  // =====================================
  // 🎯 内部ヘルパーメソッド
  // =====================================

  private buildLocationFilter(filter: LocationFilter): LocationWhereInput {
    const where: LocationWhereInput = {};

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { address: { contains: filter.search, mode: 'insensitive' } },
        { clientName: { contains: filter.search, mode: 'insensitive' } }
      ];
    }

    if (filter.locationType?.length) {
      where.locationType = { in: filter.locationType };
    }

    if (filter.clientName) {
      where.clientName = { contains: filter.clientName, mode: 'insensitive' };
    }

    if (typeof filter.isActive === 'boolean') {
      where.isActive = filter.isActive;
    }

    if (filter.hasCoordinates) {
      where.AND = [
        { latitude: { not: null } },
        { longitude: { not: null } }
      ];
    }

    return where;
  }

  private async addDistanceToLocations(
    locations: any[], 
    centerLat: number, 
    centerLng: number
  ): Promise<LocationResponseDTOExtended[]> {
    return locations.map(location => {
      let distance: number | undefined;
      
      if (location.latitude && location.longitude) {
        distance = Number(calculateDistance(
          centerLat,
          centerLng,
          location.latitude,
          location.longitude
        ).toFixed(3));
      }

      return {
        ...location,
        createdAt: location.createdAt.toISOString(),
        updatedAt: location.updatedAt.toISOString(),
        distance
      };
    });
  }

  private async generateLocationsSummary(where: LocationWhereInput) {
    const [total, active, typeStats] = await Promise.all([
      this.prisma.location.count({ where }),
      this.prisma.location.count({ where: { ...where, isActive: true } }),
      this.prisma.location.groupBy({
        by: ['locationType'],
        where,
        _count: true
      })
    ]);

    const locationsByType = typeStats.reduce((acc, stat) => {
      acc[stat.locationType] = stat._count;
      return acc;
    }, {} as Record<LocationType, number>);

    return {
      totalLocations: total,
      activeLocations: active,
      locationsByType
    };
  }

  /**
   * 🎯 新機能: 一括操作（既存機能を損なわない追加）
   */
  async bulkUpdate(
    ids: string[], 
    data: Partial<LocationUpdateInput>
  ): Promise<BulkOperationResult> {
    try {
      if (!ids?.length) {
        throw new ValidationError('更新対象のIDリストは必須です');
      }

      const results = await Promise.allSettled(
        ids.map(id => this.update(id, data))
      );

      const successful = results.filter((r): r is PromiseFulfilledResult<OperationResult<LocationModel>> => 
        r.status === 'fulfilled'
      );
      const failed = results.filter(r => r.status === 'rejected');

      logger.info('Bulk location update completed', {
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
      logger.error('Failed to bulk update locations', { error, ids });
      throw new AppError('位置情報の一括更新に失敗しました', 500, error);
    }
  }
}

// =====================================
// 🔧 既存完全実装保持 + Phase 1-A基盤統合 - ファクトリ関数
// =====================================

let _locationServiceInstance: LocationService | null = null;

export const getLocationService = (prisma?: PrismaClient): LocationService => {
  if (!_locationServiceInstance) {
    // 🎯 Phase 1-A基盤: DatabaseService シングルトン活用
    _locationServiceInstance = new LocationService(prisma || DatabaseService.getInstance());
  }
  return _locationServiceInstance;
};

// =====================================
// 🔧 既存完全実装保持 + 型統合 - 型エクスポート
// =====================================

export type { LocationModel as default };

// 🎯 types/location.ts統合: 高度型定義の再エクスポート
export type {
  LocationInfo,
  LocationWithDetails,
  LocationResponseDTO,
  LocationListResponse,
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationFilter,
  LocationSearchQuery,
  NearbyLocationRequest,
  NearbyLocation,
  LocationStatistics,
  LocationReportConfig,
  LocationReportData
} from '../types/location';