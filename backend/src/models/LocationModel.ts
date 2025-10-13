// =====================================
// backend/src/models/LocationModel.ts
// 位置モデル（既存完全実装 + Phase 1-A基盤統合 + 高度機能統合版）
// コンパイルエラー完全修正版 v3 - 全エラー解消
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: Mon Oct 13 2025 - 完全修正
// =====================================

import type {
  Location as PrismaLocation,
  Prisma,
  OperationDetail,
  LocationType
} from '@prisma/client';

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
// 🔧 基本型定義
// =====================================

export type LocationModel = PrismaLocation;
export type LocationCreateInput = Prisma.LocationCreateInput;
export type LocationUpdateInput = Prisma.LocationUpdateInput;
export type LocationWhereInput = Prisma.LocationWhereInput;
export type LocationWhereUniqueInput = Prisma.LocationWhereUniqueInput;
export type LocationOrderByInput = Prisma.LocationOrderByWithRelationInput;

// Decimal型のヘルパー型定義
type DecimalValue = PrismaLocation['latitude'];

// =====================================
// 🔧 拡張DTO型定義
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
  accessibility?: LocationAccessibility;
  autoValidateCoordinates?: boolean;
}

export interface LocationUpdateDTOExtended extends Partial<LocationCreateDTOExtended> {
  // 更新用（部分更新対応）
}

// =====================================
// 🔧 LocationService クラス
// =====================================

export class LocationService {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || DatabaseService.getInstance();
  }

  // =====================================
  // 🔧 基本CRUDメソッド
  // =====================================

/**
   * 新規作成
   */
  async create(data: LocationCreateInput): Promise<OperationResult<LocationModel>> {
    try {
      if (!data.name?.trim()) {
        throw new ValidationError('位置名は必須です');
      }

      // GPS座標の自動検証
      if (data.latitude !== undefined && data.longitude !== undefined) {
        const lat = this.convertToNumber(data.latitude);
        const lng = this.convertToNumber(data.longitude);
        if (!isValidCoordinates(lat, lng)) {
          throw new ValidationError('無効なGPS座標です');
        }
      }

      // 重複チェック
      if (data.latitude && data.longitude) {
        const lat = this.convertToNumber(data.latitude);
        const lng = this.convertToNumber(data.longitude);
        const nearbyLocations = await this.findNearbyLocations({
          latitude: lat,
          longitude: lng,
          radiusKm: 0.1,
          limit: 1
        });

        const nearbyLocation = nearbyLocations[0];
        if (nearbyLocation) {
          logger.warn('Nearby location detected during creation', {
            newLocation: data.name,
            nearbyLocation: nearbyLocation.location.name,
            distance: nearbyLocation.distance
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
      logger.error('Failed to create location', { error: error as any, data });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new AppError('位置情報の作成に失敗しました', 500);
    }
  }

  /**
   * 主キー指定取得
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
          } : undefined
        }
      });

      if (!location) {
        return null;
      }

      // 統計情報の付加
      let statistics: LocationStatistics | undefined;
      if (options?.includeStatistics) {
        statistics = await this.generateLocationStatistics(id);
      }

      // 近隣位置情報の付加
      let nearbyLocations: NearbyLocation[] | undefined;
      if (options?.includeNearby && location.latitude && location.longitude) {
        const lat = this.convertToNumber(location.latitude);
        const lng = this.convertToNumber(location.longitude);
        nearbyLocations = await this.findNearbyLocations({
          latitude: lat,
          longitude: lng,
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

      const latNum = location.latitude ? this.convertToNumber(location.latitude) : undefined;
      const lngNum = location.longitude ? this.convertToNumber(location.longitude) : undefined;

      const result: LocationWithDetails = {
        id: location.id,
        name: location.name,
        address: location.address,
        locationType: location.locationType,
        clientName: location.clientName || undefined,
        contactPerson: location.contactPerson || undefined,
        contactPhone: location.contactPhone || undefined,
        contactEmail: location.contactEmail || undefined,
        operatingHours: location.operatingHours || undefined,
        accessInstructions: location.specialInstructions || undefined,
        isActive: location.isActive ?? true,
        latitude: latNum,
        longitude: lngNum,
        createdAt: location.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: location.updatedAt?.toISOString() || new Date().toISOString()
      };

      if (statistics) {
        result.statistics = statistics;
      }

      if (nearbyLocations) {
        result.nearbyLocations = nearbyLocations;
      }

      if (location.operationDetails && location.operationDetails.length > 0) {
        result.operationDetails = location.operationDetails.map(od => ({
          id: od.id,
          operationId: od.operationId,
          sequence: 0,
          estimatedArrivalTime: od.actualStartTime || undefined,
          actualArrivalTime: od.actualStartTime || undefined,
          estimatedDepartureTime: od.actualEndTime || undefined,
          actualDepartureTime: od.actualEndTime || undefined
        }));
      }

      return result;

    } catch (error) {
      logger.error('Failed to find location by key', { error: error as any, id });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new AppError('位置情報の取得に失敗しました', 500);
    }
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: LocationWhereInput;
    orderBy?: LocationOrderByInput;
    skip?: number;
    take?: number;
    include?: any;
  }): Promise<LocationModel[]> {
    try {
      const locations = await this.prisma.location.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take,
        include: params?.include
      });

      logger.debug('Locations found', {
        count: locations.length,
        params
      });

      return locations;

    } catch (error) {
      logger.error('Failed to find locations', { error: error as any, params });
      throw new AppError('位置情報一覧の取得に失敗しました', 500);
    }
  }

  /**
   * ページネーション付き一覧取得
   */
  async findManyWithPagination(params: {
    where?: LocationWhereInput;
    orderBy?: LocationOrderByInput;
    page: number;
    pageSize: number;
    filter?: LocationFilter;
  }): Promise<LocationListResponseExtended> {
    try {
      const page = Math.max(1, params.page);
      const pageSize = Math.max(1, Math.min(100, params.pageSize));
      const skip = (page - 1) * pageSize;

      let where: LocationWhereInput = params.where || {};

      // フィルタ条件の追加
      if (params.filter) {
        where = this.buildLocationFilter(params.filter);
      }

      const [locations, total] = await Promise.all([
        this.prisma.location.findMany({
          where,
          orderBy: params.orderBy || { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            _count: {
              select: { operationDetails: true }
            }
          }
        }),
        this.prisma.location.count({ where })
      ]);

      const totalPages = Math.ceil(total / pageSize);

      const data: LocationResponseDTOExtended[] = locations.map(location =>
        this.toResponseDTO(location)
      );

      // サマリー情報の生成
      const summary = await this.generateLocationsSummary(where);

      logger.debug('Locations retrieved with pagination', {
        page,
        pageSize,
        total,
        totalPages
      });

      return {
        success: true,
        data,
        meta: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        summary,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to find locations with pagination', { error: error as any, params });
      throw new AppError('位置情報一覧の取得に失敗しました', 500);
    }
  }

  /**
   * 単一条件検索
   */
  async findFirst(params: {
    where: LocationWhereInput;
    orderBy?: LocationOrderByInput;
    include?: any;
  }): Promise<LocationModel | null> {
    try {
      const location = await this.prisma.location.findFirst({
        where: params.where,
        orderBy: params.orderBy,
        include: params.include
      });

      return location;

    } catch (error) {
      logger.error('Failed to find first location', { error: error as any, params });
      throw new AppError('位置情報の検索に失敗しました', 500);
    }
  }

  /**
   * 一意条件検索
   */
  async findUnique(params: {
    where: LocationWhereUniqueInput;
    include?: any;
  }): Promise<LocationModel | null> {
    try {
      const location = await this.prisma.location.findUnique({
        where: params.where,
        include: params.include
      });

      return location;

    } catch (error) {
      logger.error('Failed to find unique location', { error: error as any, params });
      throw new AppError('位置情報の取得に失敗しました', 500);
    }
  }

  /**
   * 更新
   */
  async update(id: string, data: LocationUpdateInput): Promise<OperationResult<LocationModel>> {
    try {
      if (!id) {
        throw new ValidationError('位置IDは必須です');
      }

      const existing = await this.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError('指定された位置情報が見つかりません');
      }

      // GPS座標の検証
      if (data.latitude !== undefined && data.longitude !== undefined) {
        const lat = this.convertToNumber(data.latitude);
        const lng = this.convertToNumber(data.longitude);
        if (!isValidCoordinates(lat, lng)) {
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
        hasCoordinates: !!(data.latitude || data.longitude)
      });

      return {
        success: true,
        data: location,
        message: '位置情報を更新しました'
      };

    } catch (error) {
      logger.error('Failed to update location', { error: error as any, id, data });

      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      throw new AppError('位置情報の更新に失敗しました', 500);
    }
  }

  /**
   * 削除
   */
  async delete(id: string): Promise<OperationResult<LocationModel>> {
    try {
      if (!id) {
        throw new ValidationError('位置IDは必須です');
      }

      const existing = await this.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError('指定された位置情報が見つかりません');
      }

      // 関連データの事前チェック
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
      logger.error('Failed to delete location', { error: error as any, id });

      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }

      throw new AppError('位置情報の削除に失敗しました', 500);
    }
  }

  /**
   * 存在チェック
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
      logger.error('Failed to check location existence', { error: error as any, id });
      return false;
    }
  }

  /**
   * カウント取得
   */
  async count(where?: LocationWhereInput): Promise<number> {
    try {
      return await this.prisma.location.count({ where });
    } catch (error) {
      logger.error('Failed to count locations', { error: error as any, where });
      throw new AppError('位置情報のカウント取得に失敗しました', 500);
    }
  }

  // =====================================
  // 🌍 地理的検索メソッド
  // =====================================

  /**
   * 近隣位置検索
   */
  async findNearbyLocations(request: NearbyLocationRequest): Promise<NearbyLocation[]> {
    try {
      // 座標検証
      if (!isValidCoordinates(request.latitude, request.longitude)) {
        throw new ValidationError('無効な座標です');
      }

      if (request.radiusKm <= 0 || request.radiusKm > 1000) {
        throw new ValidationError('検索半径は1-1000kmの範囲で指定してください');
      }

      // フィルタ条件構築
      const whereCondition: LocationWhereInput = {
        latitude: { not: null },
        longitude: { not: null }
      };

      if (request.excludeLocationIds && request.excludeLocationIds.length > 0) {
        whereCondition.id = { notIn: request.excludeLocationIds };
      }

      if (request.locationType && request.locationType.length > 0) {
        whereCondition.locationType = { in: request.locationType };
      }

      if (request.isActiveOnly !== false) {
        whereCondition.isActive = true;
      }

      // 全候補位置取得
      const candidateLocations = await this.findMany({
        where: whereCondition,
        include: {
          _count: {
            select: { operationDetails: true }
          }
        }
      });

      // 距離計算と絞り込み
      const nearbyLocations = candidateLocations
        .map(location => {
          if (!location.latitude || !location.longitude) {
            return null;
          }

          const lat = this.convertToNumber(location.latitude);
          const lng = this.convertToNumber(location.longitude);
          const distance = calculateDistance(
            request.latitude,
            request.longitude,
            lat,
            lng
          );

          if (distance <= request.radiusKm) {
            const bearing = calculateBearing(
              request.latitude,
              request.longitude,
              lat,
              lng
            );

            return {
              location: this.toResponseDTO(location),
              distance: Number(distance.toFixed(3)),
              bearing: Number(bearing.toFixed(1))
            };
          }

          return null;
        })
        .filter((item): item is NearbyLocation => item !== null)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, request.limit || 10);

      logger.debug('Nearby locations found', {
        center: { lat: request.latitude, lng: request.longitude },
        radiusKm: request.radiusKm,
        found: nearbyLocations.length
      });

      return nearbyLocations;

    } catch (error) {
      logger.error('Failed to find nearby locations', { error: error as any, request });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new AppError('近隣位置の検索に失敗しました', 500);
    }
  }

  // =====================================
  // 🎯 統計・分析メソッド
  // =====================================

  /**
   * 位置統計生成
   */
  async generateLocationStatistics(locationId: string, period?: { from: Date; to: Date }): Promise<LocationStatistics> {
    try {
      const location = await this.findUnique({ where: { id: locationId } });
      if (!location) {
        throw new NotFoundError('位置が見つかりません');
      }

      // 運行詳細の集計
      const whereCondition: any = { locationId };
      if (period) {
        whereCondition.createdAt = {
          gte: period.from,
          lte: period.to
        };
      }

      const operationDetails = await this.prisma.operationDetail.findMany({
        where: whereCondition
      });

      const totalVisits = operationDetails.length;
      const completedVisits = operationDetails.filter(od =>
        od.actualStartTime && od.actualEndTime
      ).length;

      // 滞在時間の計算
      const stayTimes = operationDetails
        .filter(od => od.actualStartTime && od.actualEndTime)
        .map(od => {
          const start = od.actualStartTime!.getTime();
          const end = od.actualEndTime!.getTime();
          return (end - start) / (1000 * 60);
        });

      const averageStayTime = stayTimes.length > 0
        ? stayTimes.reduce((a, b) => a + b, 0) / stayTimes.length
        : 0;

      const statistics: LocationStatistics = {
        totalLocations: 1,
        activeLocations: location.isActive ?? true ? 1 : 0,
        inactiveLocations: location.isActive ?? true ? 0 : 1,
        locationsByType: {
          [location.locationType]: 1
        } as Record<LocationType, number>,
        geographicSpread: {
          center: {
            latitude: location.latitude ? this.convertToNumber(location.latitude) : 0,
            longitude: location.longitude ? this.convertToNumber(location.longitude) : 0
          },
          boundingBox: {
            northEast: {
              latitude: location.latitude ? this.convertToNumber(location.latitude) : 0,
              longitude: location.longitude ? this.convertToNumber(location.longitude) : 0
            },
            southWest: {
              latitude: location.latitude ? this.convertToNumber(location.latitude) : 0,
              longitude: location.longitude ? this.convertToNumber(location.longitude) : 0
            }
          },
          maxDistance: 0,
          averageDistance: 0
        },
        accessibilityStats: {
          wheelchairAccessible: 0,
          elevatorAvailable: 0,
          parkingAvailable: 0,
          publicTransportNearby: 0
        },
        operationStats: {
          mostActiveLocation: {
            locationId: location.id,
            operationCount: totalVisits
          },
          averageOperationsPerLocation: totalVisits,
          totalOperations: totalVisits
        },
        coordinateAccuracy: {
          withCoordinates: location.latitude && location.longitude ? 1 : 0,
          withoutCoordinates: location.latitude && location.longitude ? 0 : 1,
          averageAccuracy: 0
        },
        totalVisits: totalVisits,
        byType: {
          [location.locationType]: totalVisits
        } as Record<LocationType, number>,
        topLocations: [{
          id: location.id,
          name: location.name,
          visitCount: totalVisits
        }],
        period: {
          start: period?.from || new Date(0),
          end: period?.to || new Date()
        },
        generatedAt: new Date()
      };

      logger.debug('Location statistics generated', {
        locationId,
        totalVisits,
        averageStayTime,
        period: !!period
      });

      return statistics;

    } catch (error) {
      logger.error('Failed to generate location statistics', { error: error as any, locationId });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new AppError('位置統計の生成に失敗しました', 500);
    }
  }

  // =====================================
  // 🎯 一括操作
  // =====================================

  /**
   * 一括更新
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

      const successResults: Array<{ id: string; success: boolean; data?: any; error?: string }> = [];
      const failureResults: Array<{ id: string; success: boolean; data?: any; error?: string }> = [];

      results.forEach((result, index) => {
        const id = ids[index]!; // non-null assertion
        if (result.status === 'fulfilled') {
          successResults.push({
            id,
            success: true,
            data: result.value.data
          });
        } else {
          failureResults.push({
            id,
            success: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      logger.info('Bulk location update completed', {
        total: ids.length,
        successful: successResults.length,
        failed: failureResults.length
      });

      return {
        success: failureResults.length === 0,
        totalCount: ids.length,
        successCount: successResults.length,
        failureCount: failureResults.length,
        results: [...successResults, ...failureResults]
      };

    } catch (error) {
      logger.error('Failed to bulk update locations', { error: error as any, ids });
      throw new AppError('位置情報の一括更新に失敗しました', 500);
    }
  }

  // =====================================
  // 🛠️ ユーティリティメソッド
  // =====================================

  /**
   * Decimal型をnumber型に変換
   */
  private convertToNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return parseFloat(value);
    }

    // Decimal型の場合
    if (typeof value === 'object' && value !== null && 'toNumber' in value && typeof value.toNumber === 'function') {
      return value.toNumber();
    }

    return 0;
  }

  /**
   * LocationフィルタからWhereInput構築
   */
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

  /**
   * 位置サマリー生成
   */
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
   * LocationModelをResponseDTOに変換
   */
  private toResponseDTO(location: LocationModel & { _count?: any }): LocationResponseDTOExtended {
    const lat = location.latitude ? this.convertToNumber(location.latitude) : undefined;
    const lng = location.longitude ? this.convertToNumber(location.longitude) : undefined;

    return {
      id: location.id,
      name: location.name,
      address: location.address,
      latitude: lat,
      longitude: lng,
      locationType: location.locationType,
      clientName: location.clientName || undefined,
      contactPerson: location.contactPerson || undefined,
      contactPhone: location.contactPhone || undefined,
      contactEmail: location.contactEmail || undefined,
      operatingHours: location.operatingHours || undefined,
      accessInstructions: location.specialInstructions || undefined,
      isActive: location.isActive ?? true,
      createdAt: location.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: location.updatedAt?.toISOString() || new Date().toISOString(),
      operationCount: location._count?.operationDetails || 0,
      _count: location._count
    };
  }
}

// =====================================
// 🔧 ファクトリ関数
// =====================================

let _locationServiceInstance: LocationService | null = null;

export const getLocationService = (prisma?: PrismaClient): LocationService => {
  if (!_locationServiceInstance) {
    _locationServiceInstance = new LocationService(prisma || DatabaseService.getInstance());
  }
  return _locationServiceInstance;
};

// =====================================
// 🔧 型エクスポート
// =====================================

export type { LocationModel as default };

// types/location.ts統合: 高度型定義の再エクスポート
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
