// =====================================
// backend/src/controllers/gpsController.ts
// GPS横断機能コントローラー - 企業レベル統合版
// リアルタイム追跡・横断的分析・ジオフェンシング・ヒートマップ・データマイニング
// 最終更新: 2025年10月20日
// 依存関係: services/gpsService.ts, middleware/auth.ts, utils層
// 統合基盤: controllers層100%・services層完全活用・企業レベル機能実現
// =====================================

import { Response } from 'express';

// 🎯 完成済み7層統合基盤の100%活用
import { asyncHandler } from '../middleware/errorHandler';
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError
} from '../utils/errors';
import { sendSuccess } from '../utils/response';
import logger from '../utils/logger';

// 🎯 GPS Service統合
import { GpsService } from '../services/gpsService';

// 🎯 統一型定義インポート
import type { AuthenticatedRequest } from '../types';
import type { Coordinates } from '../types/location';

/**
 * GPSコントローラークラス
 * 横断的GPS機能を提供（リアルタイム・分析・ジオフェンス・ヒートマップ）
 *
 * 【責務】
 * - リアルタイム全車両位置追跡
 * - 横断的GPS分析
 * - ジオフェンシング管理
 * - ヒートマップ生成
 * - データマイニング・予測分析
 *
 * 【設計方針】
 * - tripController: 運行単位のGPS（既存維持）
 * - mobileController: モバイル特化GPS（既存維持）
 * - gpsController: 横断的・分析機能（新規）
 */
export class GpsController {
  private gpsService: GpsService;

  constructor() {
    this.gpsService = new GpsService();
    logger.info('🌐 GpsController初期化完了 - 横断的GPS機能統合版');
  }

  // =====================================
  // 📡 リアルタイム追跡機能
  // =====================================

  /**
   * 全車両のリアルタイム位置取得
   * GET /api/v1/gps/realtime/vehicles
   *
   * 実装機能:
   * - 全車両の最新GPS位置
   * - ステータス情報統合
   * - 運行状態表示
   * - 地図表示用データ整形
   *
   * 権限: MANAGER, ADMIN
   */
  public getAllVehiclesRealtime = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      logger.info('📡 全車両リアルタイム位置取得開始', {
        userId: req.user?.userId
      });

      // 権限チェック（管理者・マネージャーのみ）
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      const positions = await this.gpsService.getAllVehiclePositions();

      logger.info('✅ 全車両リアルタイム位置取得完了', {
        count: positions.length
      });

      return sendSuccess(
        res,
        positions,
        `${positions.length}台の車両位置を取得しました`,
        200
      );
    }
  );

  /**
   * 特定車両のリアルタイム位置取得
   * GET /api/v1/gps/realtime/vehicle/:vehicleId
   *
   * 実装機能:
   * - 特定車両の最新GPS位置
   * - 詳細情報（速度・方位・精度）
   * - 最新の運行情報
   */
  public getVehicleRealtime = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { vehicleId } = req.params;

      logger.info('📍 車両リアルタイム位置取得開始', {
        vehicleId,
        userId: req.user?.userId
      });

      if (!vehicleId) {
        throw new ValidationError('車両IDが必要です');
      }

      const position = await this.gpsService.getVehiclePosition(vehicleId);

      if (!position) {
        throw new NotFoundError(`車両 ${vehicleId} の位置情報が見つかりません`);
      }

      logger.info('✅ 車両リアルタイム位置取得完了', { vehicleId });

      return sendSuccess(
        res,
        position,
        '車両位置を取得しました',
        200
      );
    }
  );

  /**
   * 特定エリア内の車両取得
   * POST /api/v1/gps/realtime/area
   *
   * 実装機能:
   * - 円形エリア内の車両検索
   * - 矩形エリア内の車両検索
   * - 最寄り車両の検索
   */
  public getVehiclesInArea = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { center, radiusKm, bounds } = req.body;

      logger.info('🗺️ エリア内車両検索開始', {
        center,
        radiusKm,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      // パラメータバリデーション
      if (!center && !bounds) {
        throw new ValidationError('centerまたはboundsが必要です');
      }

      const vehicles = await this.gpsService.getVehiclesInArea({
        center,
        radiusKm,
        bounds
      });

      logger.info('✅ エリア内車両検索完了', { count: vehicles.length });

      return sendSuccess(
        res,
        vehicles,
        `エリア内に${vehicles.length}台の車両が見つかりました`,
        200
      );
    }
  );

  // =====================================
  // 📊 ヒートマップ・可視化機能
  // =====================================

  /**
   * ヒートマップデータ取得
   * GET /api/v1/gps/heatmap
   *
   * 実装機能:
   * - GPS密度データ生成
   * - 期間指定対応
   * - 車両フィルタ対応
   * - グリッドベースの集計
   *
   * 権限: MANAGER, ADMIN
   */
  public getHeatmapData = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { startDate, endDate, vehicleIds, gridSize } = req.query;

      logger.info('🔥 ヒートマップデータ取得開始', {
        startDate,
        endDate,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      const heatmapData = await this.gpsService.generateHeatmap({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vehicleIds: vehicleIds ? (vehicleIds as string).split(',') : undefined,
        gridSize: gridSize ? parseInt(gridSize as string) : 0.01 // デフォルト約1km
      });

      logger.info('✅ ヒートマップデータ取得完了', {
        dataPoints: heatmapData.length
      });

      return sendSuccess(
        res,
        heatmapData,
        'ヒートマップデータを取得しました',
        200
      );
    }
  );

  /**
   * 移動軌跡データ取得
   * GET /api/v1/gps/tracks
   *
   * 実装機能:
   * - 全車両の移動軌跡
   * - 時系列データ
   * - 地図表示用フォーマット
   */
  public getTracksData = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { startDate, endDate, vehicleIds, simplify } = req.query;

      logger.info('🛤️ 移動軌跡データ取得開始', {
        startDate,
        endDate,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      const tracks = await this.gpsService.getVehicleTracks({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vehicleIds: vehicleIds ? (vehicleIds as string).split(',') : undefined,
        simplify: simplify === 'true'
      });

      logger.info('✅ 移動軌跡データ取得完了', { tracksCount: tracks.length });

      return sendSuccess(
        res,
        tracks,
        '移動軌跡データを取得しました',
        200
      );
    }
  );

  // =====================================
  // 🚧 ジオフェンシング機能
  // =====================================

  /**
   * ジオフェンス一覧取得
   * GET /api/v1/gps/geofences
   *
   * 実装機能:
   * - 登録済みジオフェンス一覧
   * - アクティブ/非アクティブフィルタ
   */
  public getGeofences = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      logger.info('🚧 ジオフェンス一覧取得開始', {
        userId: req.user?.userId
      });

      const geofences = await this.gpsService.getAllGeofences();

      logger.info('✅ ジオフェンス一覧取得完了', {
        count: geofences.length
      });

      return sendSuccess(
        res,
        geofences,
        'ジオフェンス一覧を取得しました',
        200
      );
    }
  );

  /**
   * ジオフェンス作成
   * POST /api/v1/gps/geofences
   *
   * 実装機能:
   * - 円形エリア定義
   * - 多角形エリア定義
   * - 通知設定
   *
   * 権限: ADMIN
   */
  public createGeofence = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const geofenceData = req.body;

      logger.info('🏗️ ジオフェンス作成開始', {
        name: geofenceData.name,
        userId: req.user?.userId
      });

      // 権限チェック（管理者のみ）
      if (req.user!.role !== 'ADMIN') {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      // バリデーション
      if (!geofenceData.name || !geofenceData.area) {
        throw new ValidationError('名前とエリア情報が必要です');
      }

      const geofence = await this.gpsService.createGeofence(geofenceData);

      logger.info('✅ ジオフェンス作成完了', { id: geofence.id });

      return sendSuccess(
        res,
        geofence,
        'ジオフェンスを作成しました',
        201
      );
    }
  );

  /**
   * ジオフェンス違反検出
   * GET /api/v1/gps/geofence/violations
   *
   * 実装機能:
   * - 許可エリア外への移動検出
   * - 進入禁止エリアへの侵入検出
   * - 期間指定対応
   *
   * 権限: MANAGER, ADMIN
   */
  public getGeofenceViolations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { startDate, endDate, vehicleIds, geofenceIds } = req.query;

      logger.info('⚠️ ジオフェンス違反検出開始', {
        startDate,
        endDate,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      const violations = await this.gpsService.detectGeofenceViolations({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vehicleIds: vehicleIds ? (vehicleIds as string).split(',') : undefined,
        geofenceIds: geofenceIds ? (geofenceIds as string).split(',') : undefined
      });

      logger.info('✅ ジオフェンス違反検出完了', {
        violationsCount: violations.length
      });

      return sendSuccess(
        res,
        violations,
        `${violations.length}件の違反を検出しました`,
        200
      );
    }
  );

  // =====================================
  // 📈 データ分析・マイニング機能
  // =====================================

  /**
   * 速度違反検出
   * GET /api/v1/gps/speed-violations
   *
   * 実装機能:
   * - 速度制限超過の検出
   * - 急加速・急減速の検出
   * - 期間・車両フィルタ
   *
   * 権限: MANAGER, ADMIN
   */
  public getSpeedViolations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { threshold, startDate, endDate, vehicleIds } = req.query;

      logger.info('⚡ 速度違反検出開始', {
        threshold,
        startDate,
        endDate,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      const violations = await this.gpsService.detectSpeedViolations({
        speedThreshold: threshold ? parseInt(threshold as string) : 80,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vehicleIds: vehicleIds ? (vehicleIds as string).split(',') : undefined
      });

      logger.info('✅ 速度違反検出完了', { violationsCount: violations.length });

      return sendSuccess(
        res,
        violations,
        `${violations.length}件の速度違反を検出しました`,
        200
      );
    }
  );

  /**
   * アイドリング分析
   * GET /api/v1/gps/idle-analysis
   *
   * 実装機能:
   * - 長時間停車の検出
   * - アイドリング時間の集計
   * - 燃料無駄遣いの分析
   *
   * 権限: MANAGER, ADMIN
   */
  public getIdleAnalysis = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { minIdleMinutes, startDate, endDate, vehicleIds } = req.query;

      logger.info('🅿️ アイドリング分析開始', {
        minIdleMinutes,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      const analysis = await this.gpsService.analyzeIdling({
        minIdleMinutes: minIdleMinutes ? parseInt(minIdleMinutes as string) : 10,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vehicleIds: vehicleIds ? (vehicleIds as string).split(',') : undefined
      });

      logger.info('✅ アイドリング分析完了', { eventsCount: analysis.length });

      return sendSuccess(
        res,
        analysis,
        'アイドリング分析を完了しました',
        200
      );
    }
  );

  /**
   * 移動パターン分析
   * GET /api/v1/gps/analytics/patterns
   *
   * 実装機能:
   * - 頻出ルートの特定
   * - 移動時間帯の分析
   * - 効率的なルートの提案
   *
   * 権限: MANAGER, ADMIN
   */
  public analyzeMovementPatterns = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { startDate, endDate, vehicleIds } = req.query;

      logger.info('📊 移動パターン分析開始', {
        startDate,
        endDate,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      const patterns = await this.gpsService.analyzeMovementPatterns({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vehicleIds: vehicleIds ? (vehicleIds as string).split(',') : undefined
      });

      logger.info('✅ 移動パターン分析完了');

      return sendSuccess(
        res,
        patterns,
        '移動パターン分析を完了しました',
        200
      );
    }
  );

  /**
   * ルート最適化提案
   * POST /api/v1/gps/route-optimization
   *
   * 実装機能:
   * - 複数地点の最適訪問順序
   * - 距離・時間の最小化
   * - 交通状況考慮（将来実装）
   *
   * 権限: MANAGER, ADMIN
   */
  public suggestRouteOptimization = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { startLocation, destinations, vehicleId } = req.body;

      logger.info('🗺️ ルート最適化提案開始', {
        destinationsCount: destinations?.length,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      // バリデーション
      if (!startLocation || !destinations || destinations.length === 0) {
        throw new ValidationError('出発地と目的地が必要です');
      }

      const optimizedRoute = await this.gpsService.optimizeRoute({
        startLocation,
        destinations,
        vehicleId
      });

      logger.info('✅ ルート最適化提案完了');

      return sendSuccess(
        res,
        optimizedRoute,
        '最適ルートを生成しました',
        200
      );
    }
  );

  /**
   * GPS統計サマリー
   * GET /api/v1/gps/statistics
   *
   * 実装機能:
   * - 総移動距離
   * - 平均速度
   * - GPS記録数
   * - 車両稼働率
   *
   * 権限: MANAGER, ADMIN
   */
  public getGpsStatistics = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { startDate, endDate, vehicleIds } = req.query;

      logger.info('📈 GPS統計取得開始', {
        startDate,
        endDate,
        userId: req.user?.userId
      });

      // 権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
        throw new AuthorizationError('この操作には管理者権限が必要です');
      }

      const statistics = await this.gpsService.getStatistics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vehicleIds: vehicleIds ? (vehicleIds as string).split(',') : undefined
      });

      logger.info('✅ GPS統計取得完了');

      return sendSuccess(
        res,
        statistics,
        'GPS統計を取得しました',
        200
      );
    }
  );
}

// =====================================
// 📤 エクスポート
// =====================================

export default GpsController;

/**
 * ✅ controllers/gpsController.ts 作成完了
 *
 * 【実装機能】
 * ✅ リアルタイム追跡: 全車両位置・エリア内検索
 * ✅ ヒートマップ: GPS密度可視化・移動軌跡
 * ✅ ジオフェンシング: エリア管理・違反検出
 * ✅ 速度分析: 違反検出・アイドリング分析
 * ✅ データマイニング: 移動パターン・ルート最適化
 * ✅ 統計分析: GPS統計サマリー
 *
 * 【アーキテクチャ適合】
 * ✅ tripController.tsパターン完全適用
 * ✅ Service層への完全委譲
 * ✅ 権限制御の徹底
 * ✅ エラーハンドリング統合
 * ✅ ログ出力統一
 *
 * 【次のステップ】
 * 🎯 services/gpsService.ts の実装
 * 🎯 routes/gpsRoutes.ts の実装
 * 🎯 型定義の追加
 */
