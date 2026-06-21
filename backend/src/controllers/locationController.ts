// =====================================
// backend/src/controllers/locationController.ts
// 位置管理コントローラー - コンパイルエラー完全修正版 v2
// 既存機能完全保持・全エラー解消
// 最終更新: 2025年10月17日
// =====================================

import { LocationType, UserRole } from '@prisma/client';
import { Response } from 'express';

// Phase 1完成基盤の活用
import { asyncHandler } from '../utils/asyncHandler';
import { DatabaseService } from '../utils/database';
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from '../utils/errors';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

// Phase 2 services/基盤の活用
import { getLocationServiceWrapper } from '../services/locationService';

// types/統合基盤の活用（完全な型安全性）
import type {
  AuthenticatedRequest,
  CreateLocationRequest,
  LocationFilter,
  LocationListResponse,
  NearbyLocationRequest,
  UpdateLocationRequest
} from '../types';

// 共通型定義の活用（types/common.tsから）

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

      // 【修正】registration_method カラムが存在しないため
      // special_instructions で登録元を識別できるよう設定
      // モバイル登録は mobileController で 'モバイルからクイック登録' を設定済み
      if (!createData.accessInstructions && !createData.notes) {
        createData.accessInstructions = '管理者から登録';
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

      // ✅ メートル単位の半径指定に対応
      let radiusKm: number;

      if (req.query.radiusMeters) {
        // メートル指定があればキロメートルに変換
        radiusKm = parseFloat(req.query.radiusMeters as string) / 1000;
      } else if (req.query.radiusKm) {
        // キロメートル指定
        radiusKm = parseFloat(req.query.radiusKm as string);
      } else {
        throw new ValidationError('検索半径（radiusMetersまたはradiusKm）が必要です');
      }

      const nearbyRequest: NearbyLocationRequest = {
        latitude: req.query.latitude ? parseFloat(req.query.latitude as string) : undefined as any,
        longitude: req.query.longitude ? parseFloat(req.query.longitude as string) : undefined as any,
        radiusKm: radiusKm,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        locationType: req.query.locationType ?
          (Array.isArray(req.query.locationType) ?
            req.query.locationType as LocationType[] :
            [req.query.locationType as LocationType])
          : undefined,
        isActiveOnly: req.query.isActiveOnly === 'false' ? false : true
      };

      // バリデーション
      if (!nearbyRequest.latitude || !nearbyRequest.longitude) {
        throw new ValidationError('緯度・経度が必要です');
      }
      if (!nearbyRequest.radiusKm || nearbyRequest.radiusKm <= 0) {
        throw new ValidationError('有効な検索半径が必要です');
      }

      const nearbyLocations = await this.locationServiceWrapper.findNearbyLocations(
        nearbyRequest,
        req.user.userId,
        req.user.role as UserRole
      );

      const response = successResponse(nearbyLocations, '近隣位置を検索しました');
      logger.info('近隣位置検索', {
        latitude: nearbyRequest.latitude,
        longitude: nearbyRequest.longitude,
        radiusKm: nearbyRequest.radiusKm,
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

  /**
   * 位置マップサマリー取得（実績回数付き）
   * GET /api/v1/locations/map-summary
   *
   * 運行記録「マップ表示」タブ用。
   * 各場所(location)に紐づく operationDetails 件数を「実績回数」として集計し、
   * 代表客先名（最も件数の多い客先）・最終利用日を付加して返却する。
   */
  getLocationsMapSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const db = DatabaseService.getInstance();

      // ---- 期間フィルタ（任意） ----
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      // ---- 種別・キーワード検索（任意） ----
      // ✅ 修正: locationType は「マスタの固定属性」では事前フィルタしない。
      //    同一場所が積込・荷降の両方で使われるケースがあり、マスタ上 PICKUP 登録でも
      //    実際には UNLOADING の実績がある場合があるため、ここで除外すると
      //    「荷降のみ」フィルタで実績があるのに表示されない不具合が起きる。
      //    集計（loadingCount/unloadingCount算出）後に、実績ベースでフィルタする。
      const locationTypeParam = req.query.locationType as string | undefined;
      const search = (req.query.search as string | undefined)?.trim();

      const locationWhere: any = { isActive: true };
      // ✅ search は場所名（location.name）のみで判定する。
      //    address や客先名まで対象にすると、検索語と無関係な場所が大量にヒットしてしまうため。
      if (search) {
        locationWhere.name = { contains: search, mode: 'insensitive' };
      }

      // ---- 場所マスタ取得（locationType による事前フィルタなし） ----
      const locations = await db.location.findMany({
        where: locationWhere,
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          locationType: true
        },
        orderBy: { name: 'asc' }
      });

      if (locations.length === 0) {
        return res.status(200).json(successResponse([], '位置マップサマリーを取得しました'));
      }

      const locationIds = locations.map(l => l.id);

      // ---- operationDetails を取得（期間フィルタ適用・全期間も含めて1回で取得） ----
      // ✅ 修正: activityType も取得し、積込(LOADING)/荷降(UNLOADING)を区別して集計する。
      //    1つの場所が両方の用途で使われるケースに対応（マスタのlocationTypeだけでは判定しない）。
      const detailWhereBase: any = { locationId: { in: locationIds } };
      const detailWhereFiltered: any = { ...detailWhereBase };
      if (dateFrom || dateTo) {
        detailWhereFiltered.actualStartTime = {};
        if (dateFrom) detailWhereFiltered.actualStartTime.gte = dateFrom;
        if (dateTo) detailWhereFiltered.actualStartTime.lte = dateTo;
      }

      const details = await db.operationDetail.findMany({
        where: detailWhereFiltered,
        select: {
          locationId: true,
          activityType: true,
          actualStartTime: true,
          plannedTime: true,
          operations: {
            select: {
              customer: { select: { name: true } }
            }
          }
        }
      });

      // ---- locationId ごとに集計（積込/荷降を分離） ----
      type Agg = {
        loadingCount: number;
        unloadingCount: number;
        lastDate: Date | null;
        customerCounts: Map<string, number>;
      };
      const aggMap = new Map<string, Agg>();

      for (const d of details) {
        if (!d.locationId) continue;
        const agg = aggMap.get(d.locationId) || {
          loadingCount: 0,
          unloadingCount: 0,
          lastDate: null,
          customerCounts: new Map<string, number>()
        };

        if (d.activityType === 'LOADING') agg.loadingCount += 1;
        else if (d.activityType === 'UNLOADING') agg.unloadingCount += 1;

        const ts = d.actualStartTime || d.plannedTime;
        if (ts && (!agg.lastDate || ts > agg.lastDate)) {
          agg.lastDate = ts;
        }

        const customerName = d.operations?.customer?.name;
        if (customerName) {
          agg.customerCounts.set(customerName, (agg.customerCounts.get(customerName) || 0) + 1);
        }

        aggMap.set(d.locationId, agg);
      }

      // ---- レスポンス整形 ----
      let summary = locations.map(loc => {
        const agg = aggMap.get(loc.id);
        let topCustomerName: string | null = null;
        if (agg && agg.customerCounts.size > 0) {
          const sorted = [...agg.customerCounts.entries()].sort((a, b) => b[1] - a[1]);
          topCustomerName = sorted[0]?.[0] ?? null;
        }

        const loadingCount = agg?.loadingCount || 0;
        const unloadingCount = agg?.unloadingCount || 0;

        return {
          id: loc.id,
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude ? Number(loc.latitude) : null,
          longitude: loc.longitude ? Number(loc.longitude) : null,
          locationType: loc.locationType,
          customerName: topCustomerName,
          loadingCount,
          unloadingCount,
          operationCount: loadingCount + unloadingCount,
          lastUsedAt: agg?.lastDate ? agg.lastDate.toISOString() : null
        };
      });

      // ✅ 修正: locationType フィルタは集計後（実績ベース）で適用する。
      //    PICKUP指定 → loadingCount > 0 の場所のみ／DELIVERY指定 → unloadingCount > 0 の場所のみ。
      //    実績がまだ無い場所は、マスタの登録種別で判定してフィルタに含める。
      if (locationTypeParam && locationTypeParam !== 'ALL') {
        summary = summary.filter(loc => {
          const hasAnyRecord = loc.loadingCount > 0 || loc.unloadingCount > 0;
          if (locationTypeParam === 'PICKUP') {
            return hasAnyRecord ? loc.loadingCount > 0 : loc.locationType === 'PICKUP';
          }
          if (locationTypeParam === 'DELIVERY') {
            return hasAnyRecord ? loc.unloadingCount > 0 : loc.locationType === 'DELIVERY';
          }
          return true;
        });
      }

      logger.info('位置マップサマリー取得', {
        count: summary.length,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        userId: req.user.userId
      });

      return res.status(200).json(successResponse(summary, '位置マップサマリーを取得しました'));

    } catch (error) {
      logger.error('位置マップサマリー取得エラー', { error, userId: req.user?.userId });

      if (error instanceof ValidationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        return res.status(error.statusCode).json(errorRes);
      } else if (error instanceof AuthorizationError) {
        const errorRes = errorResponse(error.message, error.statusCode, error.code);
        return res.status(error.statusCode).json(errorRes);
      } else {
        const errorRes = errorResponse('位置マップサマリーの取得に失敗しました', 500, 'GET_LOCATIONS_MAP_SUMMARY_ERROR');
        return res.status(500).json(errorRes);
      }
    }
  });

  /**
   * 位置別実績統計取得（直近30日/90日/1年の積込・荷降回数）
   * GET /api/v1/locations/usage-stats
   *
   * 積込・積卸場所マスタ一覧画面用。全場所の直近期間別の積込/荷降回数を一括取得する。
   */
  getLocationsUsageStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('認証が必要です');
      }

      const db = DatabaseService.getInstance();

      const locations = await db.location.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      if (locations.length === 0) {
        return res.status(200).json(successResponse([], '位置別実績統計を取得しました'));
      }

      const locationIds = locations.map(l => l.id);
      const now = new Date();
      const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const day365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // 直近1年分のみ取得し、フロント/メモリ側で30日・90日・365日に振り分ける
      // （365日を超えるレコードはこの集計には不要）
      const details = await db.operationDetail.findMany({
        where: {
          locationId: { in: locationIds },
          actualStartTime: { gte: day365 }
        },
        select: {
          locationId: true,
          activityType: true,
          actualStartTime: true,
          plannedTime: true
        }
      });

      type PeriodAgg = { loading: number; unloading: number };
      type LocAgg = { d30: PeriodAgg; d90: PeriodAgg; d365: PeriodAgg };
      const makeEmpty = (): PeriodAgg => ({ loading: 0, unloading: 0 });
      const aggMap = new Map<string, LocAgg>();

      for (const d of details) {
        if (!d.locationId) continue;
        const ts = d.actualStartTime || d.plannedTime;
        if (!ts) continue;

        const agg = aggMap.get(d.locationId) || { d30: makeEmpty(), d90: makeEmpty(), d365: makeEmpty() };

        const bump = (bucket: PeriodAgg) => {
          if (d.activityType === 'LOADING') bucket.loading += 1;
          else if (d.activityType === 'UNLOADING') bucket.unloading += 1;
        };

        if (ts >= day365) bump(agg.d365);
        if (ts >= day90) bump(agg.d90);
        if (ts >= day30) bump(agg.d30);

        aggMap.set(d.locationId, agg);
      }

      const result = locationIds.map(id => {
        const agg = aggMap.get(id) || { d30: makeEmpty(), d90: makeEmpty(), d365: makeEmpty() };
        return {
          locationId: id,
          last30Days: agg.d30,
          last90Days: agg.d90,
          last365Days: agg.d365
        };
      });

      logger.info('位置別実績統計取得', { count: result.length, userId: req.user.userId });

      return res.status(200).json(successResponse(result, '位置別実績統計を取得しました'));

    } catch (error) {
      logger.error('位置別実績統計取得エラー', { error, userId: req.user?.userId });
      const errorRes = errorResponse('位置別実績統計の取得に失敗しました', 500, 'GET_LOCATIONS_USAGE_STATS_ERROR');
      return res.status(500).json(errorRes);
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
    // ✅ Fix-B: PICKUP / DELIVERY / BOTH を追加
    // 修正前は DEPOT/DESTINATION/REST_AREA/FUEL_STATION のみで
    // CMS登録時に使用する PICKUP/DELIVERY/BOTH が全てフィルタ除外され
    // モバイルの近隣地点検索が常に0件になっていた
    const validTypes: LocationType[] = [
      'DEPOT', 'DESTINATION', 'REST_AREA', 'FUEL_STATION',
      'PICKUP', 'DELIVERY', 'BOTH'   // ✅ Fix-B: CMS登録タイプを追加
    ];

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
  getLocationsByType,
  getLocationsMapSummary,
  getLocationsUsageStats
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
