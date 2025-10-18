// =====================================
// backend/src/controllers/locationController.ts
// 位置管理コントローラー - コンパイルエラー完全修正版 v2
// 既存機能完全保持・全エラー解消
// 最終更新: 2025年10月17日
// =====================================

import { Request, Response } from 'express';
import { UserRole, LocationType } from '@prisma/client';

// Phase 1完成基盤の活用
import { asyncHandler } from '../utils/asyncHandler';
import {
  AppError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
} from '../utils/errors';
import { successResponse, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { DatabaseService } from '../utils/database';

// Phase 2 services/基盤の活用
import { getLocationServiceWrapper } from '../services/locationService';

// types/統合基盤の活用（完全な型安全性）
import type {
  LocationResponseDTO,
  LocationFilter,
  CreateLocationRequest,
  UpdateLocationRequest,
  NearbyLocationRequest,
  LocationStatistics,
  LocationListResponse,
  NearbyLocation,
  AuthenticatedRequest
} from '../types';

// 共通型定義の活用（types/common.tsから）
import type {
  ApiResponse,
  PaginationQuery
} from '../types/common';

// =====================================
// LocationController クラス（完全統合版）
// =====================================

class LocationController {
  private readonly locationServiceWrapper: ReturnType<typeof getLocationServiceWrapper>;

  constructor() {
    // Phase 1&2基盤統合：Dependency Injection
    const db = DatabaseService.getInstance();
    this.locationServiceWrapper = getLocationServiceWrapper(db);
  }

  // =====================================
  // 位置CRUD操作（既存完全実装100%保持）
  // =====================================

  /**
   * 位置一覧取得
   * GET /api/v1/locations
   */
  getAllLocations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 認証チェック
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      // クエリパラメータ取得・バリデーション
      const filter: LocationFilter = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        search: req.query.search as string,
        locationType: this.parseLocationTypes(req.query.locationType),
        clientName: req.query.clientName as string,
        isActive: this.parseBoolean(req.query.isActive as string),
        hasCoordinates: this.parseBoolean(req.query.hasCoordinates as string),
        sortBy: req.query.sortBy as any || 'name',
        sortOrder: req.query.sortOrder === 'desc' ? 'desc' : 'asc'
      };

      // 近隣検索パラメータ
      if (req.query.latitude && req.query.longitude && req.query.radius) {
        filter.within = {
          latitude: parseFloat(req.query.latitude as string),
          longitude: parseFloat(req.query.longitude as string),
          radiusKm: parseFloat(req.query.radius as string)
        };
      }

      // LocationService経由で位置一覧取得
      const result = await this.locationServiceWrapper.getLocations(
        filter,
        req.user.userId,
        req.user.role as UserRole
      );

      // 統一レスポンス形式
      const response: LocationListResponse = {
        success: true,
        data: result.locations,
        message: '位置一覧を取得しました',
        meta: {
          total: result.total,
          page: filter.page || 1,
          pageSize: filter.limit || 50,
          totalPages: Math.ceil(result.total / (filter.limit || 50)),
          hasNextPage: result.hasMore,
          hasPreviousPage: (filter.page || 1) > 1
        },
        timestamp: new Date().toISOString()
      };

      logger.info('位置一覧取得', {
        count: result.locations.length,
        total: result.total,
        filter,
        userId: req.user.userId
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('位置一覧取得エラー', { error, userId: req.user?.userId });

      if (error instanceof ValidationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置一覧の取得に失敗しました', 500, 'GET_LOCATIONS_ERROR');
        res.status(500).json(errorRes);
      }
    }
  });

  /**
   * 位置詳細取得
   * GET /api/v1/locations/:id
   */
  getLocationById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const { id } = req.params;
      if (!id) {
        throw new ValidationError('位置IDが必要です');
      }

      // ✅ 修正: getLocationById → getLocation
      const location = await this.locationServiceWrapper.getLocation(
        id,
        req.user.userId,
        req.user.role as UserRole
      );

      if (!location) {
        throw new NotFoundError('位置が見つかりません');
      }

      const response = successResponse(location, '位置情報を取得しました');
      logger.info('位置詳細取得', { locationId: id, userId: req.user.userId });

      res.status(200).json(response);

    } catch (error) {
      logger.error('位置詳細取得エラー', { error, locationId: req.params.id, userId: req.user?.userId });

      if (error instanceof NotFoundError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置情報の取得に失敗しました', 500, 'GET_LOCATION_ERROR');
        res.status(500).json(errorRes);
      }
    }
  });

  /**
   * 位置作成
   * POST /api/v1/locations
   */
  createLocation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      // 権限チェック（管理者・マネージャーのみ）
      if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
        throw new AuthorizationError('位置の作成権限がありません');
      }

      const createData: CreateLocationRequest = req.body;

      // バリデーション
      if (!createData.name?.trim()) {
        throw new ValidationError('位置名は必須です');
      }
      if (!createData.address?.trim()) {
        throw new ValidationError('住所は必須です');
      }

      // ✅ 修正: LocationResponseDTOを直接返すメソッドを使用
      const location = await this.locationServiceWrapper.createLocation(
        createData,
        req.user.userId,
        req.user.role as UserRole
      );

      const response = successResponse(location, '位置を作成しました');
      logger.info('位置作成', { locationId: location.id, userId: req.user.userId });

      res.status(201).json(response);

    } catch (error) {
      logger.error('位置作成エラー', { error, userId: req.user?.userId });

      if (error instanceof ValidationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof ConflictError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置の作成に失敗しました', 500, 'CREATE_LOCATION_ERROR');
        res.status(500).json(errorRes);
      }
    }
  });

  /**
   * 位置更新
   * PUT /api/v1/locations/:id
   */
  updateLocation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      // 権限チェック（管理者・マネージャーのみ）
      if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
        throw new AuthorizationError('位置の更新権限がありません');
      }

      const { id } = req.params;
      if (!id) {
        throw new ValidationError('位置IDが必要です');
      }

      const updateData: UpdateLocationRequest = req.body;

      // ✅ 修正: LocationResponseDTOを直接返すメソッドを使用
      const location = await this.locationServiceWrapper.updateLocation(
        id,
        updateData,
        req.user.userId,
        req.user.role as UserRole
      );

      const response = successResponse(location, '位置を更新しました');
      logger.info('位置更新', { locationId: id, userId: req.user.userId });

      res.status(200).json(response);

    } catch (error) {
      logger.error('位置更新エラー', { error, locationId: req.params.id, userId: req.user?.userId });

      if (error instanceof NotFoundError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof ValidationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置の更新に失敗しました', 500, 'UPDATE_LOCATION_ERROR');
        res.status(500).json(errorRes);
      }
    }
  });

  /**
   * 位置削除
   * DELETE /api/v1/locations/:id
   */
  deleteLocation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      // 権限チェック（管理者のみ）
      if (req.user.role !== 'ADMIN') {
        throw new AuthorizationError('位置の削除権限がありません（管理者のみ）');
      }

      const { id } = req.params;
      if (!id) {
        throw new ValidationError('位置IDが必要です');
      }

      await this.locationServiceWrapper.deleteLocation(
        id,
        req.user.userId,
        req.user.role as UserRole
      );

      const response = successResponse(null, '位置を削除しました');
      logger.info('位置削除', { locationId: id, userId: req.user.userId });

      res.status(200).json(response);

    } catch (error) {
      logger.error('位置削除エラー', { error, locationId: req.params.id, userId: req.user?.userId });

      if (error instanceof NotFoundError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof ConflictError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置の削除に失敗しました', 500, 'DELETE_LOCATION_ERROR');
        res.status(500).json(errorRes);
      }
    }
  });

  // =====================================
  // 高度な位置機能（既存完全実装保持）
  // =====================================

  /**
   * 位置統計取得
   * GET /api/v1/locations/statistics
   */
  getLocationStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const statistics = await this.locationServiceWrapper.getLocationStatistics(
        req.user.userId,
        req.user.role as UserRole
      );

      const response = successResponse(statistics, '位置統計を取得しました');
      logger.info('位置統計取得', { userId: req.user.userId });

      res.status(200).json(response);

    } catch (error) {
      logger.error('位置統計取得エラー', { error, userId: req.user?.userId });

      if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置統計の取得に失敗しました', 500, 'GET_STATISTICS_ERROR');
        res.status(500).json(errorRes);
      }
    }
  });

  /**
   * 近隣位置検索
   * POST /api/v1/locations/nearby
   */
  getNearbyLocations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const nearbyRequest: NearbyLocationRequest = req.body;

      // バリデーション
      if (!nearbyRequest.latitude || !nearbyRequest.longitude) {
        throw new ValidationError('緯度・経度が必要です');
      }
      if (!nearbyRequest.radiusKm || nearbyRequest.radiusKm <= 0) {
        throw new ValidationError('有効な検索半径が必要です');
      }

      // ✅ 修正: getNearbyLocations → findNearbyLocations
      const nearbyLocations = await this.locationServiceWrapper.findNearbyLocations(
        nearbyRequest,
        req.user.userId,
        req.user.role as UserRole
      );

      const response = successResponse(nearbyLocations, '近隣位置を検索しました');
      logger.info('近隣位置検索', {
        latitude: nearbyRequest.latitude,
        longitude: nearbyRequest.longitude,
        radius: nearbyRequest.radiusKm,
        resultCount: nearbyLocations.length,
        userId: req.user.userId
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('近隣位置検索エラー', { error, userId: req.user?.userId });

      if (error instanceof ValidationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('近隣位置検索に失敗しました', 500, 'NEARBY_SEARCH_ERROR');
        res.status(500).json(errorRes);
      }
    }
  });

  /**
   * タイプ別位置検索
   * GET /api/v1/locations/type/:locationType
   */
  getLocationsByType = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const { locationType } = req.params;
      if (!locationType) {
        throw new ValidationError('位置タイプが必要です');
      }

      // LocationTypeの検証
      const validLocationTypes: LocationType[] = ['DEPOT', 'DESTINATION', 'REST_AREA', 'FUEL_STATION'];
      if (!validLocationTypes.includes(locationType as LocationType)) {
        throw new ValidationError(`無効な位置タイプです: ${locationType}`);
      }

      // クエリパラメータ取得
      const filter: LocationFilter = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        search: req.query.search as string,
        locationType: [locationType as LocationType],
        clientName: req.query.clientName as string,
        isActive: this.parseBoolean(req.query.isActive as string),
        hasCoordinates: this.parseBoolean(req.query.hasCoordinates as string),
        sortBy: req.query.sortBy as any || 'name',
        sortOrder: req.query.sortOrder === 'desc' ? 'desc' : 'asc'
      };

      // LocationService経由で位置検索
      const result = await this.locationServiceWrapper.getLocations(
        filter,
        req.user.userId,
        req.user.role as UserRole
      );

      // 統一レスポンス形式
      const response: LocationListResponse = {
        success: true,
        data: result.locations,
        message: `${locationType}タイプの位置一覧を取得しました`,
        meta: {
          total: result.total,
          page: filter.page || 1,
          pageSize: filter.limit || 50,
          totalPages: Math.ceil(result.total / (filter.limit || 50)),
          hasNextPage: result.hasMore,
          hasPreviousPage: (filter.page || 1) > 1
        },
        timestamp: new Date().toISOString()
      };

      logger.info('位置タイプ別検索', {
        locationType,
        count: result.locations.length,
        total: result.total,
        userId: req.user.userId
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('位置タイプ別検索エラー', { error, locationType: req.params.locationType, userId: req.user?.userId });

      if (error instanceof ValidationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置タイプ別検索に失敗しました', 500, 'GET_LOCATIONS_BY_TYPE_ERROR');
        res.status(500).json(errorRes);
      }
    }
  });

  // =====================================
  // ヘルパーメソッド
  // =====================================

  /**
   * LocationType配列のパース
   */
  private parseLocationTypes(value: any): LocationType[] | undefined {
    if (!value) return undefined;

    const types = Array.isArray(value) ? value : [value];
    const validTypes: LocationType[] = ['DEPOT', 'DESTINATION', 'REST_AREA', 'FUEL_STATION'];

    return types
      .filter((t: string) => validTypes.includes(t as LocationType))
      .map((t: string) => t as LocationType);
  }

  /**
   * Boolean値のパース
   */
  private parseBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }
}

// =====================================
// ファクトリ関数
// =====================================

let _locationControllerInstance: LocationController | null = null;

export const getLocationController = (): LocationController => {
  if (!_locationControllerInstance) {
    _locationControllerInstance = new LocationController();
  }
  return _locationControllerInstance;
};

// =====================================
// エクスポート（既存機能100%保持）
// =====================================

const locationController = getLocationController();

// 既存機能100%保持のためのエクスポート
export const {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationStatistics,
  getNearbyLocations,
  getLocationsByType
} = locationController;

// クラスエクスポート
export { LocationController };

// デフォルトエクスポート
export default locationController;

// 後方互換性維持のためのエイリアス
export const getLocations = getAllLocations;
export const getLocation = getLocationById;
export const searchNearby = getNearbyLocations;
export const getStatistics = getLocationStatistics;

// =====================================
// ✅ locationController.ts コンパイルエラー完全修正完了 v2
// =====================================

/**
 * ✅ 修正内容 v2
 *
 * 【修正済みエラー】
 * ✅ TS2551: getLocationById → getLocation に修正
 * ✅ TS2339: result.success/data/message → 直接LocationResponseDTOを使用
 * ✅ TS2551: getNearbyLocations → findNearbyLocations に修正
 *
 * 【既存機能100%保持】
 * ✅ 全8メソッド完全保持
 * ✅ 認証・権限制御維持
 * ✅ エラーハンドリング統一
 * ✅ ログ記録統合
 * ✅ バリデーション強化
 * ✅ 後方互換性維持
 */
