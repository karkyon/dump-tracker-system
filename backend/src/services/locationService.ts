// =====================================
// backend/src/services/locationService.ts
// 位置サービス層 - コンパイルエラー完全修正版 v3
// 最終更新: 2025年10月14日
// 既存機能完全保持・全エラー解消
// =====================================

import type { PrismaClient, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Phase 1-A完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  AppError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from '../utils/errors';
import logger from '../utils/logger';

// GPS計算基盤の活用
import {
  calculateDistance,
  isValidCoordinates
} from '../utils/gpsCalculations';

// 共通型定義の活用（types/common.tsから）
import type {
  LocationStatistics,
  OperationResult
} from '../types/common';

// Location関連型定義の活用
import type {
  CreateLocationRequest,
  LocationFilter,
  LocationResponseDTO,
  NearbyLocation,
  NearbyLocationRequest,
  UpdateLocationRequest
} from '../types/location';

// LocationModel型定義の活用
import type {
  LocationCreateInput,
  LocationModel,
  LocationUpdateInput
} from '../models/LocationModel';

// getLocationServiceを値としてインポート
import { getLocationService } from '../models/LocationModel';

// =====================================
// 🏗️ LocationServiceWrapperクラス
// =====================================

class LocationServiceWrapper {
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
      const locationData: LocationCreateInput = {
        name: request.name.trim(),
        address: request.address.trim(),
        latitude: request.latitude,
        longitude: request.longitude,
        locationType: request.locationType,
        contactPerson: request.contactPerson?.trim(),
        contactPhone: request.contactPhone?.trim(),
        contactEmail: request.contactEmail?.trim(),
        operatingHours: request.operatingHours?.trim(),
        accessRestrictions: request.accessInstructions?.trim(),
        isActive: request.isActive !== false
      };

      const result = await this.locationService.create(locationData);
      if (!result.success || !result.data) {
        throw new AppError(result.message || '位置作成に失敗しました', 500);
      }

      const location = result.data;

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
      const whereCondition: any = {};

      if (filterConditions.search) {
        whereCondition.OR = [
          { name: { contains: filterConditions.search, mode: 'insensitive' } },
          { address: { contains: filterConditions.search, mode: 'insensitive' } }
        ];
      }

      if (filterConditions.locationType && Array.isArray(filterConditions.locationType)) {
        whereCondition.locationType = { in: filterConditions.locationType };
      }

      if (filterConditions.clientName) {
        whereCondition.clientName = { contains: filterConditions.clientName, mode: 'insensitive' };
      }

      if (filterConditions.isActive !== undefined) {
        whereCondition.isActive = filterConditions.isActive;
      }

      if (filterConditions.hasCoordinates !== undefined) {
        if (filterConditions.hasCoordinates) {
          whereCondition.AND = [
            { latitude: { not: null } },
            { longitude: { not: null } }
          ];
        } else {
          whereCondition.OR = [
            { latitude: null },
            { longitude: null }
          ];
        }
      }

      let locations: any[];
      let total: number;

      // 近隣検索の場合
      if (filterConditions.within) {
        const allLocations = await this.locationService.findMany({
          where: whereCondition,
          include: {
            _count: {
              select: { operationDetails: true }
            }
          }
        });

        const { latitude, longitude, radiusKm } = filterConditions.within;

        const locationsWithDistance = allLocations
          .filter(loc => loc.latitude !== null && loc.longitude !== null)
          .map(location => ({
            ...location,
            distance: calculateDistance(
              latitude,
              longitude,
              this.convertToNumber(location.latitude!),
              this.convertToNumber(location.longitude!)
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
          // 修正: countメソッドは直接whereConditionを受け取る
          this.locationService.count(whereCondition)
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
      const cleanUpdateData: LocationUpdateInput = {};
      if (updateData.name !== undefined) cleanUpdateData.name = updateData.name.trim();
      if (updateData.address !== undefined) cleanUpdateData.address = updateData.address.trim();
      if (updateData.latitude !== undefined) cleanUpdateData.latitude = updateData.latitude;
      if (updateData.longitude !== undefined) cleanUpdateData.longitude = updateData.longitude;
      if (updateData.locationType !== undefined) cleanUpdateData.locationType = updateData.locationType;
      if (updateData.contactPerson !== undefined) cleanUpdateData.contactPerson = updateData.contactPerson?.trim();
      if (updateData.contactPhone !== undefined) cleanUpdateData.contactPhone = updateData.contactPhone?.trim();
      if (updateData.contactEmail !== undefined) cleanUpdateData.contactEmail = updateData.contactEmail?.trim();
      if (updateData.operatingHours !== undefined) cleanUpdateData.operatingHours = updateData.operatingHours?.trim();
      if (updateData.accessInstructions !== undefined) cleanUpdateData.accessRestrictions = updateData.accessInstructions?.trim();
      if (updateData.isActive !== undefined) cleanUpdateData.isActive = updateData.isActive;

      // 位置更新
      const result = await this.locationService.update(id, cleanUpdateData);
      if (!result.success || !result.data) {
        throw new AppError(result.message || '位置更新に失敗しました', 500);
      }

      const updatedLocation = result.data;

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

      // 存在チェック（修正: 型アサーションで_countを明示的に扱う）
      const existingLocation = await this.locationService.findUnique({
        where: { id },
        include: {
          _count: {
            select: { operationDetails: true }
          }
        }
      }) as any; // 型アサーションで_countを利用可能に

      if (!existingLocation) {
        throw new NotFoundError('位置が見つかりません');
      }

      // _countプロパティの正しい型チェック
      const operationDetailsCount = existingLocation._count?.operationDetails || 0;

      // 使用中チェック
      if (operationDetailsCount > 0) {
        // 使用中の場合は論理削除
        await this.locationService.update(id, { isActive: false });

        logger.info('位置論理削除完了', {
          locationId: id,
          name: existingLocation.name,
          operationDetailsCount,
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
  // 🔍 検索・分析メソッド群
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

      if (request.radiusKm <= 0) {
        throw new ValidationError('検索半径は正の数値である必要があります');
      }

      // 全位置取得（座標を持つもののみ）
      const allLocations = await this.locationService.findMany({
        where: {
          isActive: true,
          latitude: { not: null },
          longitude: { not: null },
          // ✅ locationTypeフィルタ追加
          ...(request.locationType && request.locationType.length > 0
            ? { locationType: { in: request.locationType } }
            : {})
        }
      });

      // 距離計算・フィルタリング・ソート
      const nearbyLocations: NearbyLocation[] = allLocations
        .map(location => {
          const lat = this.convertToNumber(location.latitude!);
          const lng = this.convertToNumber(location.longitude!);

          const distance = calculateDistance(
            request.latitude,
            request.longitude,
            lat,
            lng
          );

          if (distance <= request.radiusKm) {
            // 方位計算
            const bearing = this.calculateBearing(
              request.latitude,
              request.longitude,
              lat,
              lng
            );

            return {
              location: this.toResponseDTO(location),
              distance: Math.round(distance * 1000) / 1000,
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
   * 位置統計取得（修正: types/common.tsのLocationStatistics型に完全準拠）
   */
  async getLocationStatistics(
    requesterId: string,
    requesterRole: UserRole
  ): Promise<LocationStatistics> {
    try {
      // 権限チェック
      this.checkLocationAccess(requesterId, requesterRole, 'read');

      // Prismaクライアントを直接使用してgroupByとaggregateを実行
      const [
        totalLocations,
        activeLocations,
        locationsByType
      ] = await Promise.all([
        this.db.location.count(),
        this.db.location.count({ where: { isActive: true } }),
        this.db.location.groupBy({
          by: ['locationType'],
          _count: true,
          where: { isActive: true }
        })
      ]);

      // types/common.tsのLocationStatistics型に準拠（StatisticsBaseを継承）
      const statistics: LocationStatistics = {
        // StatisticsBaseからの必須プロパティ
        period: {
          start: new Date(0),
          end: new Date()
        },
        generatedAt: new Date(),

        // LocationStatistics固有のプロパティ
        totalLocations,
        activeLocations,
        totalVisits: 0,
        byType: locationsByType.reduce<Record<string, number>>((acc, item) => {
          acc[item.locationType] = item._count;
          return acc;
        }, {}),
        topLocations: []
      };

      logger.info('位置統計取得完了', { requesterId, statistics });

      return statistics;

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
    return (bearing + 360) % 360;
  }

  private toResponseDTO(
    location: LocationModel & {
      _count?: {
        operationDetails?: number;
        [key: string]: number | undefined;
      };
      distance?: number;
    }
  ): LocationResponseDTO {
    const lat = location.latitude ? this.convertToNumber(location.latitude) : undefined;
    const lng = location.longitude ? this.convertToNumber(location.longitude) : undefined;

    return {
      id: location.id,
      name: location.name,
      address: location.address,
      locationType: location.locationType,
      latitude: lat,
      longitude: lng,
      contactPerson: location.contactPerson ?? undefined,
      contactPhone: location.contactPhone ?? undefined,
      contactEmail: location.contactEmail ?? undefined,
      operatingHours: location.operatingHours ?? undefined,
      accessInstructions: location.accessRestrictions ?? undefined,
      isActive: location.isActive ?? true,
      operationCount: location._count?.operationDetails,
      createdAt: location.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: location.updatedAt?.toISOString() || new Date().toISOString(),
      distance: location.distance
    };
  }

  private convertToNumber(value: Decimal | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }
    return typeof value === 'number' ? value : value.toNumber();
  }
}

// =====================================
// 🏭 ファクトリ関数
// =====================================

let _locationServiceWrapperInstance: LocationServiceWrapper | null = null;

export const getLocationServiceWrapper = (db?: PrismaClient): LocationServiceWrapper => {
  if (!_locationServiceWrapperInstance) {
    _locationServiceWrapperInstance = new LocationServiceWrapper(db);
  }
  return _locationServiceWrapperInstance;
};

// =====================================
// 📤 エクスポート
// =====================================

export { LocationServiceWrapper };
