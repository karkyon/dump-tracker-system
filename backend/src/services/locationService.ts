// =====================================
// backend/src/services/locationService.ts
// 位置管理サービス - Phase 2完全統合版
// models/LocationModel.ts基盤・Phase 1完成基盤統合版
// 作成日時: 2025年9月27日19:30
// =====================================

import { UserRole, PrismaClient, LocationType } from '@prisma/client';

// 🎯 Phase 1完成基盤の活用
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
import { calculateDistance, isValidCoordinates } from '../utils/gpsCalculations';

// 🎯 types/からの統一型定義インポート
import type {
  LocationModel,
  LocationResponseDTO,
  LocationCreateDTO,
  LocationUpdateDTO,
  getLocationService
} from '../types';

// 🎯 共通型定義の活用（types/common.ts）
import type {
  PaginationQuery,
  ApiResponse,
  OperationResult,
  BulkOperationResult
} from '../types/common';

// =====================================
// 🔧 位置管理型定義
// =====================================

export interface LocationFilter extends PaginationQuery {
  search?: string;
  locationType?: LocationType[];
  clientName?: string;
  isActive?: boolean;
  hasCoordinates?: boolean;
  within?: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
  sortBy?: 'name' | 'address' | 'locationType' | 'clientName' | 'createdAt' | 'updatedAt' | 'distance';
}

export interface CreateLocationRequest {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: LocationType;
  clientName?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  accessInstructions?: string;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateLocationRequest extends Partial<CreateLocationRequest> {
  // 部分更新対応
}

export interface NearbyLocationRequest {
  latitude: number;
  longitude: number;
  radiusKm: number;
  limit?: number;
  excludeLocationIds?: string[];
  locationType?: LocationType[];
  isActiveOnly?: boolean;
}

export interface NearbyLocation {
  location: LocationResponseDTO;
  distance: number; // km
  bearing: number; // 度（0-359）
}

export interface LocationStatistics {
  totalLocations: number;
  activeLocations: number;
  inactiveLocations: number;
  locationsByType: Record<LocationType, number>;
  withCoordinates: number;
  withoutCoordinates: number;
  averageOperationsPerLocation: number;
}

// =====================================
// 📍 LocationService クラス - Phase 2統合版
// =====================================

export class LocationService {
  private readonly db: PrismaClient;
  private readonly locationService: ReturnType<typeof getLocationService>;

  constructor(db?: PrismaClient) {
    this.db = db || DatabaseService.getInstance();
    this.locationService = getLocationService(this.db);
  }

  // =====================================
  // 🔐 権限チェックメソッド群
  // =====================================

  private checkLocationAccess(
    requesterId: string,
    requesterRole: UserRole,
    accessType: 'read' | 'write' | 'delete'
  ): void {
    // 管理者・マネージャーは全てアクセス可能
    if (['ADMIN', 'MANAGER'].includes(requesterRole)) {
      return;
    }

    // ディスパッチャーは読み取り・書き込み可能
    if (requesterRole === 'DISPATCHER') {
      if (accessType === 'delete') {
        throw new AuthorizationError('位置削除の権限がありません');
      }
      return;
    }

    // 運転手は読み取りのみ可能
    if (requesterRole === 'DRIVER') {
      if (accessType !== 'read') {
        throw new AuthorizationError('位置情報の編集権限がありません');
      }
      return;
    }

    throw new AuthorizationError('位置情報へのアクセス権限がありません');
  }

  // =====================================
  // 📦 CRUD操作メソッド群
  // =====================================

  /**
   * 位置作成
   */
  async createLocation(
    request: CreateLocationRequest,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<LocationResponseDTO> {
    try {
      // 権限チェック
      this.checkLocationAccess(requesterId, requesterRole, 'write');

      // 入力検証
      if (!request.name?.trim()) {
        throw new ValidationError('位置名は必須です');
      }

      if (!request.address?.trim()) {
        throw new ValidationError('住所は必須です');
      }

      if (!request.locationType) {
        throw new ValidationError('位置タイプは必須です');
      }

      // 座標検証（提供された場合）
      if ((request.latitude !== undefined || request.longitude !== undefined)) {
        if (request.latitude === undefined || request.longitude === undefined) {
          throw new ValidationError('緯度・経度は両方指定してください');
        }
        
        if (!isValidCoordinates(request.latitude, request.longitude)) {
          throw new ValidationError('無効な座標です');
        }
      }

      // 重複チェック
      const existingLocation = await this.locationService.findFirst({
        where: {
          name: request.name.trim(),
          address: request.address.trim()
        }
      });

      if (existingLocation) {
        throw new ConflictError('同名・同住所の位置が既に存在します');
      }

      // 位置作成
      const locationData = {
        name: request.name.trim(),
        address: request.address.trim(),
        latitude: request.latitude,
        longitude: request.longitude,
        locationType: request.locationType,
        clientName: request.clientName?.trim(),
        contactPerson: request.contactPerson?.trim(),
        contactPhone: request.contactPhone?.trim(),
        contactEmail: request.contactEmail?.trim(),
        operatingHours: request.operatingHours?.trim(),
        accessInstructions: request.accessInstructions?.trim(),
        notes: request.notes?.trim(),
        isActive: request.isActive !== false
      };

      const location = await this.locationService.create(locationData);

      logger.info('位置作成完了', { 
        locationId: location.id,
        name: location.name,
        locationType: location.locationType,
        hasCoordinates: location.latitude !== null && location.longitude !== null,
        requesterId 
      });

      return this.toResponseDTO(location);

    } catch (error) {
      logger.error('位置作成エラー', { error, request, requesterId });
      throw error;
    }
  }

  /**
   * 位置取得
   */
  async getLocation(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<LocationResponseDTO> {
    try {
      // 権限チェック
      this.checkLocationAccess(requesterId, requesterRole, 'read');

      const location = await this.locationService.findUnique({
        where: { id },
        include: {
          _count: {
            select: { operationDetails: true }
          }
        }
      });

      if (!location) {
        throw new NotFoundError('位置が見つかりません');
      }

      return this.toResponseDTO(location);

    } catch (error) {
      logger.error('位置取得エラー', { error, id, requesterId });
      throw error;
    }
  }

  /**
   * 位置一覧取得
   */
  async getLocations(
    filter: LocationFilter = {},
    requesterId: string,
    requesterRole: UserRole
  ): Promise<{ locations: LocationResponseDTO[]; total: number; hasMore: boolean }> {
    try {
      // 権限チェック
      this.checkLocationAccess(requesterId, requesterRole, 'read');

      const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc', ...filterConditions } = filter;
      const offset = (page - 1) * limit;

      // フィルタ条件構築
      let whereCondition: any = {};

      if (filterConditions.search) {
        whereCondition.OR = [
          { name: { contains: filterConditions.search, mode: 'insensitive' } },
          { address: { contains: filterConditions.search, mode: 'insensitive' } },
          { clientName: { contains: filterConditions.search, mode: 'insensitive' } }
        ];
      }

      if (filterConditions.locationType) {
        whereCondition.locationType = {
          in: filterConditions.locationType
        };
      }

      if (filterConditions.clientName) {
        whereCondition.clientName = {
          contains: filterConditions.clientName,
          mode: 'insensitive'
        };
      }

      if (filterConditions.isActive !== undefined) {
        whereCondition.isActive = filterConditions.isActive;
      }

      if (filterConditions.hasCoordinates === true) {
        whereCondition.AND = [
          { latitude: { not: null } },
          { longitude: { not: null } }
        ];
      } else if (filterConditions.hasCoordinates === false) {
        whereCondition.OR = [
          { latitude: null },
          { longitude: null }
        ];
      }

      // 半径内検索
      let locations: any[] = [];
      let total = 0;

      if (filterConditions.within) {
        // 半径内検索の場合は全件取得してJavaScriptで距離計算
        const allLocations = await this.locationService.findMany({
          where: {
            ...whereCondition,
            latitude: { not: null },
            longitude: { not: null }
          },
          include: {
            _count: {
              select: { operationDetails: true }
            }
          }
        });

        const { latitude: centerLat, longitude: centerLon, radiusKm } = filterConditions.within;

        const locationsWithDistance = allLocations
          .map(location => ({
            ...location,
            distance: calculateDistance(
              centerLat,
              centerLon,
              location.latitude!,
              location.longitude!
            )
          }))
          .filter(location => location.distance <= radiusKm)
          .sort((a, b) => a.distance - b.distance);

        total = locationsWithDistance.length;
        locations = locationsWithDistance.slice(offset, offset + limit);

      } else {
        // 通常検索
        const [locationResults, totalCount] = await Promise.all([
          this.locationService.findMany({
            where: whereCondition,
            include: {
              _count: {
                select: { operationDetails: true }
              }
            },
            orderBy: sortBy === 'distance' ? { name: sortOrder } : { [sortBy]: sortOrder },
            take: limit,
            skip: offset
          }),
          this.locationService.count({ where: whereCondition })
        ]);

        locations = locationResults;
        total = totalCount;
      }

      return {
        locations: locations.map(location => this.toResponseDTO(location)),
        total,
        hasMore: offset + locations.length < total
      };

    } catch (error) {
      logger.error('位置一覧取得エラー', { error, filter, requesterId });
      throw error;
    }
  }

  /**
   * 位置更新
   */
  async updateLocation(
    id: string,
    updateData: UpdateLocationRequest,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<LocationResponseDTO> {
    try {
      // 権限チェック
      this.checkLocationAccess(requesterId, requesterRole, 'write');

      // 存在チェック
      const existingLocation = await this.locationService.findUnique({
        where: { id }
      });

      if (!existingLocation) {
        throw new NotFoundError('位置が見つかりません');
      }

      // 座標検証（提供された場合）
      if ((updateData.latitude !== undefined || updateData.longitude !== undefined)) {
        if (updateData.latitude === undefined || updateData.longitude === undefined) {
          throw new ValidationError('緯度・経度は両方指定してください');
        }
        
        if (!isValidCoordinates(updateData.latitude, updateData.longitude)) {
          throw new ValidationError('無効な座標です');
        }
      }

      // 重複チェック（名前・住所が変更された場合）
      if (updateData.name || updateData.address) {
        const checkName = updateData.name?.trim() || existingLocation.name;
        const checkAddress = updateData.address?.trim() || existingLocation.address;

        const conflictingLocation = await this.locationService.findFirst({
          where: {
            id: { not: id },
            name: checkName,
            address: checkAddress
          }
        });

        if (conflictingLocation) {
          throw new ConflictError('同名・同住所の位置が既に存在します');
        }
      }

      // 更新データ準備
      const cleanUpdateData: any = {};
      if (updateData.name !== undefined) cleanUpdateData.name = updateData.name.trim();
      if (updateData.address !== undefined) cleanUpdateData.address = updateData.address.trim();
      if (updateData.latitude !== undefined) cleanUpdateData.latitude = updateData.latitude;
      if (updateData.longitude !== undefined) cleanUpdateData.longitude = updateData.longitude;
      if (updateData.locationType !== undefined) cleanUpdateData.locationType = updateData.locationType;
      if (updateData.clientName !== undefined) cleanUpdateData.clientName = updateData.clientName?.trim();
      if (updateData.contactPerson !== undefined) cleanUpdateData.contactPerson = updateData.contactPerson?.trim();
      if (updateData.contactPhone !== undefined) cleanUpdateData.contactPhone = updateData.contactPhone?.trim();
      if (updateData.contactEmail !== undefined) cleanUpdateData.contactEmail = updateData.contactEmail?.trim();
      if (updateData.operatingHours !== undefined) cleanUpdateData.operatingHours = updateData.operatingHours?.trim();
      if (updateData.accessInstructions !== undefined) cleanUpdateData.accessInstructions = updateData.accessInstructions?.trim();
      if (updateData.notes !== undefined) cleanUpdateData.notes = updateData.notes?.trim();
      if (updateData.isActive !== undefined) cleanUpdateData.isActive = updateData.isActive;

      // 位置更新
      const updatedLocation = await this.locationService.update(id, cleanUpdateData);

      logger.info('位置更新完了', { 
        locationId: id,
        updateData: cleanUpdateData,
        requesterId 
      });

      return this.toResponseDTO(updatedLocation);

    } catch (error) {
      logger.error('位置更新エラー', { error, id, updateData, requesterId });
      throw error;
    }
  }

  /**
   * 位置削除
   */
  async deleteLocation(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<OperationResult<void>> {
    try {
      // 権限チェック
      this.checkLocationAccess(requesterId, requesterRole, 'delete');

      // 存在チェック
      const existingLocation = await this.locationService.findUnique({
        where: { id },
        include: {
          _count: {
            select: { operationDetails: true }
          }
        }
      });

      if (!existingLocation) {
        throw new NotFoundError('位置が見つかりません');
      }

      // 使用中チェック
      if (existingLocation._count.operationDetails > 0) {
        // 使用中の場合は論理削除
        await this.locationService.update(id, { isActive: false });
        
        logger.info('位置論理削除完了', { 
          locationId: id,
          name: existingLocation.name,
          operationDetailsCount: existingLocation._count.operationDetails,
          requesterId 
        });

        return {
          success: true,
          message: '位置を無効化しました（運行記録で使用中のため）'
        };
      } else {
        // 使用されていない場合は物理削除
        await this.locationService.delete(id);
        
        logger.info('位置物理削除完了', { 
          locationId: id,
          name: existingLocation.name,
          requesterId 
        });

        return {
          success: true,
          message: '位置を削除しました'
        };
      }

    } catch (error) {
      logger.error('位置削除エラー', { error, id, requesterId });
      throw error;
    }
  }

  // =====================================
  // 🌍 地理的検索・分析メソッド群
  // =====================================

  /**
   * 近隣位置検索
   */
  async findNearbyLocations(
    request: NearbyLocationRequest,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<NearbyLocation[]> {
    try {
      // 権限チェック
      this.checkLocationAccess(requesterId, requesterRole, 'read');

      // 座標検証
      if (!isValidCoordinates(request.latitude, request.longitude)) {
        throw new ValidationError('無効な座標です');
      }

      if (request.radiusKm <= 0 || request.radiusKm > 1000) {
        throw new ValidationError('検索半径は1-1000kmの範囲で指定してください');
      }

      // フィルタ条件構築
      let whereCondition: any = {
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
      const candidateLocations = await this.locationService.findMany({
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
          const distance = calculateDistance(
            request.latitude,
            request.longitude,
            location.latitude!,
            location.longitude!
          );

          if (distance <= request.radiusKm) {
            // 方位計算（簡易版）
            const bearing = this.calculateBearing(
              request.latitude,
              request.longitude,
              location.latitude!,
              location.longitude!
            );

            return {
              location: this.toResponseDTO(location),
              distance: Math.round(distance * 1000) / 1000, // 小数点第3位まで
              bearing
            };
          }
          return null;
        })
        .filter((item): item is NearbyLocation => item !== null)
        .sort((a, b) => a.distance - b.distance);

      // 件数制限
      const limit = request.limit || 50;
      const result = nearbyLocations.slice(0, limit);

      logger.info('近隣位置検索完了', {
        centerCoordinates: [request.latitude, request.longitude],
        radiusKm: request.radiusKm,
        foundCount: result.length,
        requesterId
      });

      return result;

    } catch (error) {
      logger.error('近隣位置検索エラー', { error, request, requesterId });
      throw error;
    }
  }

  /**
   * 位置統計取得
   */
  async getLocationStatistics(
    requesterId: string,
    requesterRole: UserRole
  ): Promise<LocationStatistics> {
    try {
      // 権限チェック
      this.checkLocationAccess(requesterId, requesterRole, 'read');

      const [
        totalLocations,
        activeLocations,
        locationsByType,
        coordinateStats,
        operationStats
      ] = await Promise.all([
        this.locationService.count(),
        this.locationService.count({ where: { isActive: true } }),
        this.locationService.groupBy({
          by: ['locationType'],
          _count: true,
          where: { isActive: true }
        }),
        Promise.all([
          this.locationService.count({
            where: {
              isActive: true,
              latitude: { not: null },
              longitude: { not: null }
            }
          }),
          this.locationService.count({
            where: {
              isActive: true,
              OR: [
                { latitude: null },
                { longitude: null }
              ]
            }
          })
        ]),
        this.locationService.aggregate({
          _avg: {
            // operationDetails count の平均は複雑なため簡略化
          }
        })
      ]);

      const locationsByTypeMap = locationsByType.reduce((acc, item) => {
        acc[item.locationType as LocationType] = item._count;
        return acc;
      }, {} as Record<LocationType, number>);

      const [withCoordinates, withoutCoordinates] = coordinateStats;

      return {
        totalLocations,
        activeLocations,
        inactiveLocations: totalLocations - activeLocations,
        locationsByType: locationsByTypeMap,
        withCoordinates,
        withoutCoordinates,
        averageOperationsPerLocation: 0 // 簡略化
      };

    } catch (error) {
      logger.error('位置統計取得エラー', { error, requesterId });
      throw error;
    }
  }

  // =====================================
  // 🛠️ ユーティリティメソッド群
  // =====================================

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRadians = (deg: number) => deg * Math.PI / 180;
    const toDegrees = (rad: number) => rad * 180 / Math.PI;

    const dLon = toRadians(lon2 - lon1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360; // 0-359度に正規化
  }

  private toResponseDTO(location: LocationModel & { _count?: any }): LocationResponseDTO {
    return {
      id: location.id,
      name: location.name,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      locationType: location.locationType,
      clientName: location.clientName,
      contactPerson: location.contactPerson,
      contactPhone: location.contactPhone,
      contactEmail: location.contactEmail,
      operatingHours: location.operatingHours,
      accessInstructions: location.accessInstructions,
      notes: location.notes,
      isActive: location.isActive,
      operationCount: location._count?.operationDetails || 0,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString()
    };
  }

  /**
   * サービスヘルスチェック
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date; details: any }> {
    try {
      const locationCount = await this.locationService.count();
      const activeLocationCount = await this.locationService.count({
        where: { isActive: true }
      });
      const withCoordinatesCount = await this.locationService.count({
        where: {
          latitude: { not: null },
          longitude: { not: null }
        }
      });
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        details: {
          database: 'connected',
          totalLocations: locationCount,
          activeLocations: activeLocationCount,
          withCoordinates: withCoordinatesCount,
          gpsCalculationsAvailable: typeof calculateDistance === 'function',
          service: 'LocationService'
        }
      };
    } catch (error) {
      logger.error('LocationServiceヘルスチェックエラー', { error });
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : '不明なエラー'
        }
      };
    }
  }
}

// =====================================
// 🔄 シングルトンファクトリ
// =====================================

let _locationServiceInstance: LocationService | null = null;

export const getLocationServiceInstance = (db?: PrismaClient): LocationService => {
  if (!_locationServiceInstance) {
    _locationServiceInstance = new LocationService(db);
  }
  return _locationServiceInstance;
};

// =====================================
// 📤 エクスポート
// =====================================

export default LocationService;