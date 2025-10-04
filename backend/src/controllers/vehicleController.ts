// =====================================
// backend/src/controllers/vehicleController.ts
// 車両管理コントローラー - 完全アーキテクチャ改修統合版
// services/vehicleService.ts（前回完成）連携・企業レベル車両管理API実現
// 最終更新: 2025年9月28日
// 依存関係: services/vehicleService.ts, middleware/auth.ts, utils/errors.ts, types/vehicle.ts
// 統合基盤: middleware層100%・utils層統合活用・services層完成基盤連携
// =====================================

import { Request, Response, NextFunction } from 'express';

// 🎯 Phase 1完成基盤の活用（middleware・utils統合）
import { asyncHandler } from '../middleware/errorHandler';
import { 
  AppError, 
  ValidationError, 
  AuthorizationError, 
  NotFoundError,
  ConflictError 
} from '../utils/errors';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../utils/logger';

// 🎯 Phase 2 Services層完成基盤の活用（前回完成）
import { VehicleService, getVehicleService } from '../services/vehicleService';
import { UserService, getUserService } from '../services/userService';
import { LocationService, getLocationService } from '../services/locationService';

// 🎯 types/からの統一型定義インポート（Phase 1&2完成基盤）
import type {
  VehicleCreateInput,
  VehicleUpdateInput,
  VehicleResponseDTO,
  VehicleListResponse,
  VehicleFilter,
  VehicleSearchQuery,
  VehicleStatusUpdateRequest,
  VehicleAssignmentRequest,
  VehicleMaintenanceRequest,
  VehicleStatistics,
  FleetStatistics,
  VehicleUtilizationReport,
  AuthenticatedRequest
} from '../types/vehicle';

import type {
  PaginationQuery,
  ApiResponse,
  ApiListResponse,
  OperationResult
} from '../types/common';

// =====================================
// 🚗 車両管理コントローラークラス（完全統合版）
// =====================================

/**
 * 車両管理コントローラー統合クラス
 * 
 * 【統合基盤活用】
 * - services/vehicleService.ts（前回完成）: 車両ビジネスロジック完全委譲
 * - middleware/auth.ts: 認証・権限制御統合
 * - utils/errors.ts: 統一エラーハンドリング
 * - utils/response.ts: 統一レスポンス形式
 * 
 * 【routes層連携】
 * - routes/vehicleRoutes.ts: 完成API層との密連携準備
 * 
 * 【統合効果】
 * - services層（前回完成）との完全連携
 * - 重複コード削除、処理効率向上
 * - 型安全性向上、企業レベルAPI実現
 */
export class VehicleController {
  private readonly vehicleService: VehicleService;
  private readonly userService: UserService;
  private readonly locationService: LocationService;

  constructor() {
    this.vehicleService = getVehicleService();
    this.userService = getUserService();
    this.locationService = getLocationService();
  }

  // =====================================
  // 🚗 基本車両管理（企業レベル機能統合）
  // =====================================

  /**
   * 車両一覧取得（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・権限制御・高度検索
   */
  getAllVehicles = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // リクエストパラメータ解析（型安全）
      const filter: VehicleFilter = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search as string,
        status: req.query.status ? (req.query.status as string).split(',') as any[] : undefined,
        fuelType: req.query.fuelType ? (req.query.fuelType as string).split(',') as any[] : undefined,
        assignedDriverId: req.query.assignedDriverId as string,
        manufacturerId: req.query.manufacturerId as string,
        yearFrom: req.query.yearFrom ? Number(req.query.yearFrom) : undefined,
        yearTo: req.query.yearTo ? Number(req.query.yearTo) : undefined,
        capacityFrom: req.query.capacityFrom ? Number(req.query.capacityFrom) : undefined,
        capacityTo: req.query.capacityTo ? Number(req.query.capacityTo) : undefined,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
        hasAssignedDriver: req.query.hasAssignedDriver ? req.query.hasAssignedDriver === 'true' : undefined,
        sortBy: req.query.sortBy as any
      };

      // 権限ベースフィルタリング
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      // services層（前回完成）でのビジネスロジック処理
      const result = await this.vehicleService.getVehicleList(filter, {
        userId,
        userRole,
        includeStatistics: true,
        includeCurrentLocation: userRole === 'ADMIN' || userRole === 'MANAGER',
        includeUtilization: userRole === 'ADMIN'
      });

      logger.info('車両一覧取得完了', {
        userId,
        userRole,
        totalVehicles: result.data.length,
        filter: {
          search: filter.search,
          status: filter.status,
          page: filter.page,
          limit: filter.limit
        }
      });

      return sendSuccess<VehicleListResponse>(res, result, '車両一覧を取得しました');

    } catch (error) {
      logger.error('車両一覧取得エラー', {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両一覧の取得に失敗しました', 500);
    }
  });

  /**
   * 車両詳細取得（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・権限制御・詳細情報統合
   */
  getVehicleById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const vehicleId = req.params.id;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!vehicleId) {
        throw new ValidationError('車両IDが指定されていません');
      }

      // services層（前回完成）でのビジネスロジック処理
      const vehicle = await this.vehicleService.getVehicleById(vehicleId, {
        userId,
        userRole,
        includeOperationHistory: true,
        includeMaintenanceHistory: userRole === 'ADMIN' || userRole === 'MANAGER',
        includeGPSHistory: userRole === 'ADMIN' || userRole === 'MANAGER',
        includeAssignmentHistory: userRole === 'ADMIN'
      });

      if (!vehicle) {
        throw new NotFoundError('指定された車両が見つかりません');
      }

      logger.info('車両詳細取得完了', {
        vehicleId,
        userId,
        userRole,
        plateNumber: vehicle.plateNumber
      });

      return sendSuccess<VehicleResponseDTO>(res, vehicle, '車両詳細を取得しました');

    } catch (error) {
      logger.error('車両詳細取得エラー', {
        error: error instanceof Error ? error.message : error,
        vehicleId: req.params.id,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両詳細の取得に失敗しました', 500);
    }
  });

  /**
   * 車両作成（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・権限制御・重複チェック
   */
  createVehicle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const createData: VehicleCreateInput = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // 管理者・マネージャー権限チェック
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new AuthorizationError('車両作成権限がありません');
      }

      // 入力値バリデーション
      if (!createData.plateNumber || !createData.model || !createData.manufacturer) {
        throw new ValidationError('ナンバープレート、モデル、メーカーは必須です');
      }

      // services層（前回完成）でのビジネスロジック処理
      const newVehicle = await this.vehicleService.createVehicle(createData, {
        createdBy: userId!,
        validateUnique: true,
        autoAssignLocation: true,
        generateQRCode: true
      });

      logger.info('車両作成完了', {
        vehicleId: newVehicle.id,
        plateNumber: newVehicle.plateNumber,
        createdBy: userId,
        userRole
      });

      return sendSuccess<VehicleResponseDTO>(res, newVehicle, '車両を作成しました', 201);

    } catch (error) {
      logger.error('車両作成エラー', {
        error: error instanceof Error ? error.message : error,
        plateNumber: req.body.plateNumber,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両の作成に失敗しました', 500);
    }
  });

  /**
   * 車両更新（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・権限制御・履歴管理
   */
  updateVehicle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const vehicleId = req.params.id;
      const updateData: VehicleUpdateInput = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!vehicleId) {
        throw new ValidationError('車両IDが指定されていません');
      }

      // 管理者・マネージャー権限チェック
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new AuthorizationError('車両更新権限がありません');
      }

      // services層（前回完成）でのビジネスロジック処理
      const updatedVehicle = await this.vehicleService.updateVehicle(vehicleId, updateData, {
        updatedBy: userId!,
        createAuditLog: true,
        validateConstraints: true,
        notifyChanges: true
      });

      if (!updatedVehicle) {
        throw new NotFoundError('指定された車両が見つかりません');
      }

      logger.info('車両更新完了', {
        vehicleId,
        plateNumber: updatedVehicle.plateNumber,
        updatedBy: userId,
        userRole,
        changedFields: Object.keys(updateData)
      });

      return sendSuccess<VehicleResponseDTO>(res, updatedVehicle, '車両を更新しました');

    } catch (error) {
      logger.error('車両更新エラー', {
        error: error instanceof Error ? error.message : error,
        vehicleId: req.params.id,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両の更新に失敗しました', 500);
    }
  });

  /**
   * 車両削除（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・論理削除・制約チェック
   */
  deleteVehicle = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const vehicleId = req.params.id;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!vehicleId) {
        throw new ValidationError('車両IDが指定されていません');
      }

      // 管理者権限チェック
      if (userRole !== 'ADMIN') {
        throw new AuthorizationError('車両削除権限がありません');
      }

      // services層（前回完成）でのビジネスロジック処理
      const result = await this.vehicleService.deleteVehicle(vehicleId, {
        deletedBy: userId!,
        checkActiveOperations: true,
        createAuditLog: true,
        softDelete: true
      });

      logger.info('車両削除完了', {
        vehicleId,
        deletedBy: userId,
        userRole,
        softDelete: true
      });

      return sendSuccess<OperationResult>(res, result, '車両を削除しました');

    } catch (error) {
      logger.error('車両削除エラー', {
        error: error instanceof Error ? error.message : error,
        vehicleId: req.params.id,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両の削除に失敗しました', 500);
    }
  });

  // =====================================
  // 🚗 高度な車両管理機能（企業レベル機能）
  // =====================================

  /**
   * 車両ステータス変更（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・制約チェック・通知機能
   */
  updateVehicleStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const vehicleId = req.params.id;
      const statusData: VehicleStatusUpdateRequest = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!vehicleId) {
        throw new ValidationError('車両IDが指定されていません');
      }

      if (!statusData.status) {
        throw new ValidationError('変更するステータスが指定されていません');
      }

      // 権限チェック
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new AuthorizationError('車両ステータス変更権限がありません');
      }

      // services層（前回完成）でのビジネスロジック処理
      const result = await this.vehicleService.updateVehicleStatus(vehicleId, statusData, {
        updatedBy: userId!,
        validateTransition: true,
        notifyDriver: true,
        createAuditLog: true
      });

      logger.info('車両ステータス変更完了', {
        vehicleId,
        newStatus: statusData.status,
        reason: statusData.reason,
        updatedBy: userId,
        userRole
      });

      return sendSuccess<VehicleResponseDTO>(res, result, '車両ステータスを変更しました');

    } catch (error) {
      logger.error('車両ステータス変更エラー', {
        error: error instanceof Error ? error.message : error,
        vehicleId: req.params.id,
        status: req.body.status,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両ステータスの変更に失敗しました', 500);
    }
  });

  /**
   * 車両割り当て管理（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・ドライバー管理・競合チェック
   */
  assignVehicleToDriver = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const vehicleId = req.params.id;
      const assignmentData: VehicleAssignmentRequest = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!vehicleId) {
        throw new ValidationError('車両IDが指定されていません');
      }

      // 権限チェック
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new AuthorizationError('車両割り当て権限がありません');
      }

      // services層（前回完成）でのビジネスロジック処理
      const result = await this.vehicleService.assignVehicleToDriver(vehicleId, assignmentData, {
        assignedBy: userId!,
        validateDriverLicense: true,
        checkConflicts: true,
        notifyDriver: true,
        createSchedule: assignmentData.scheduleDate !== undefined
      });

      logger.info('車両割り当て完了', {
        vehicleId,
        driverId: assignmentData.driverId,
        assignedBy: userId,
        userRole,
        scheduledDate: assignmentData.scheduleDate
      });

      return sendSuccess<VehicleResponseDTO>(res, result, '車両をドライバーに割り当てました');

    } catch (error) {
      logger.error('車両割り当てエラー', {
        error: error instanceof Error ? error.message : error,
        vehicleId: req.params.id,
        driverId: req.body.driverId,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両の割り当てに失敗しました', 500);
    }
  });

  /**
   * 車両統計取得（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・フリート分析・運用効率統計
   */
  getVehicleStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // 管理者・マネージャー権限チェック
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new AuthorizationError('車両統計取得権限がありません');
      }

      const dateRange = {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : new Date()
      };

      // services層（前回完成）でのビジネスロジック処理
      const statistics = await this.vehicleService.getVehicleStatistics({
        userId,
        userRole,
        dateRange,
        includeFleetAnalysis: true,
        includeUtilizationMetrics: true,
        includeCostAnalysis: userRole === 'ADMIN',
        includeMaintenanceStats: true
      });

      logger.info('車両統計取得完了', {
        userId,
        userRole,
        dateRange,
        totalVehicles: statistics.totalVehicles
      });

      return sendSuccess<VehicleStatistics>(res, statistics, '車両統計を取得しました');

    } catch (error) {
      logger.error('車両統計取得エラー', {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両統計の取得に失敗しました', 500);
    }
  });

  /**
   * 車両検索（企業レベル統合版）
   * services/vehicleService.ts（前回完成）連携・高度検索・全文検索
   */
  searchVehicles = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const searchQuery: VehicleSearchQuery = {
        query: req.query.q as string,
        plateNumber: req.query.plateNumber as string,
        model: req.query.model as string,
        manufacturer: req.query.manufacturer as string,
        assignedDriverName: req.query.assignedDriverName as string,
        fullText: req.query.fullText as string,
        fuzzy: req.query.fuzzy === 'true',
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
      };

      const userId = req.user?.id;
      const userRole = req.user?.role;

      // services層（前回完成）でのビジネスロジック処理
      const results = await this.vehicleService.searchVehicles(searchQuery, {
        userId,
        userRole,
        includeHighlights: true,
        includeSuggestions: true,
        includeFilters: true
      });

      logger.info('車両検索完了', {
        userId,
        userRole,
        query: searchQuery.query,
        fullText: searchQuery.fullText,
        resultCount: results.data.length
      });

      return sendSuccess<VehicleListResponse>(res, results, '車両検索を実行しました');

    } catch (error) {
      logger.error('車両検索エラー', {
        error: error instanceof Error ? error.message : error,
        query: req.query.q,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('車両検索に失敗しました', 500);
    }
  });
}

// =====================================
// 🚗 ファクトリ関数（シングルトンパターン）
// =====================================

let vehicleControllerInstance: VehicleController | null = null;

/**
 * VehicleControllerインスタンス取得（シングルトンパターン）
 * services/vehicleService.ts（前回完成）と同様のパターンで統一性確保
 */
export const getVehicleController = (): VehicleController => {
  if (!vehicleControllerInstance) {
    vehicleControllerInstance = new VehicleController();
  }
  return vehicleControllerInstance;
};

// =====================================
// 🚗 デフォルトエクスポート（統合版）
// =====================================

const vehicleController = getVehicleController();

export default vehicleController;

// 個別メソッドエクスポート（routes層互換性）
export const {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  updateVehicleStatus,
  assignVehicleToDriver,
  getVehicleStatistics,
  searchVehicles
} = vehicleController;