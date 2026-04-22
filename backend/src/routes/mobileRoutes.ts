// =====================================
// backend/src/routes/mobileRoutes.ts
// モバイルAPI専用ルート - Swagger UI完全対応版
// 既存機能100%保持 + 全エンドポイントSwagger完備 + 新規エンドポイント追加
// Controller完全委譲・他Routerとの完全一貫性実現
// 最終更新: 2025年11月29日
// 修正内容: Swagger UI完全対応（inspectionRoutes.tsパターン準拠）+ 近隣地点検知API追加
// 依存関係: controllers/mobileController.ts, middleware/auth.ts, middleware/validation.ts
// 統合基盤: Router層責務に徹した実装（tripRoutes/userRoutes/vehicleRoutesパターン）
// =====================================

/**
 * 【設計方針】
 *
 * routes層の責務: エンドポイント定義のみ
 * - ルーティング設定
 * - 認証・認可ミドルウェアの適用
 * - Controllerメソッドへの委譲
 * - Swagger UI完全対応
 *
 * ビジネスロジック・バリデーション・DB操作は全てController/Service層に委譲
 * tripRoutes.ts, userRoutes.ts, vehicleRoutes.ts, inspectionRoutes.ts等と同じパターンを採用
 */

import { NextFunction, Request, RequestHandler, Response, Router } from 'express';

// 🎯 Phase 1完了基盤の活用（tripRoutes.tsパターン準拠）
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateId, validatePaginationQuery } from '../middleware/validation';
import logger from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';

// 🎯 完成済みcontrollers層との密連携
import { UserRole } from '@prisma/client';
import { getMobileController } from '../controllers/mobileController';
import { getTripController } from '../controllers/tripController';

// 🎯 型定義インポート
import type { AuthenticatedRequest } from '../types/auth';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const mobileController = getMobileController();

// 🔧 デバッグ出力: ルーター初期化確認
logger.info('🔧 [MobileRoutes] ルーター初期化完了 (Swagger UI対応版 + 近隣地点検知機能)', {
  timestamp: new Date().toISOString(),
  file: 'backend/src/routes/mobileRoutes.ts'
});

// =====================================
// 🔍 ログミドルウェア (共通)
// =====================================

/**
 * ルートアクセスログ出力
 * @param path - ログに表示するパス (例: 'GET /mobile/vehicle')
 */
const logRequest = (path: string): RequestHandler => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    logger.info(`🔵 [MobileRoute] ${path} が呼ばれました`, {
      timestamp: new Date().toISOString()
    });
    next();
  };
};

// =====================================
// 📱 モバイルAPIエンドポイント（全機能実装）
// =====================================

/**
 * 【エンドポイント一覧】
 *
 * 認証:
 * - POST   /auth/login           モバイル認証ログイン
 * - GET    /auth/me              現在のユーザー情報取得
 * - GET    /auth/info            認証情報取得（詳細版）
 *
 * 運行管理:
 * - POST   /operations/start     運行開始
 * - POST   /operations/:id/end   運行終了
 * - GET    /operations/current   現在運行状況
 * - POST   /operations/nearby-locations  🆕 近隣地点検知
 *
 * GPS・位置:
 * - POST   /gps/log              GPS位置ログ記録
 * - GET    /locations            位置一覧取得
 * - POST   /locations/quick      クイック位置登録
 *
 * 車両:
 * - GET    /vehicle              車両情報取得
 * - GET    /vehicles             車両一覧取得
 * - PUT    /vehicle/status       車両ステータス更新
 *
 * 監視:
 * - GET    /health               ヘルスチェック
 */

// =====================================
// 🔐 モバイル認証エンドポイント
// =====================================

/**
 * @swagger
 * /mobile/auth/login:
 *   post:
 *     summary: モバイル認証ログイン
 *     description: |
 *       モバイルアプリ専用のログインエンドポイント
 *
 *       **モバイル専用機能:**
 *       - デバイス情報記録
 *       - モバイル専用トークン設定
 *       - GPS権限事前確認
 *       - オフライン対応準備
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: ユーザー名
 *                 example: test_driver
 *                 minLength: 3
 *                 maxLength: 50
 *               password:
 *                 type: string
 *                 format: password
 *                 description: パスワード
 *                 example: test123
 *                 minLength: 6
 *               deviceInfo:
 *                 type: object
 *                 description: デバイス情報（オプション）
 *                 properties:
 *                   platform:
 *                     type: string
 *                     example: iOS
 *                     enum: [iOS, Android, Web]
 *                   userAgent:
 *                     type: string
 *                     example: Mozilla/5.0
 *     responses:
 *       200:
 *         description: ログイン成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT認証トークン
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: 01234567-89ab-cdef-0123-456789abcdef
 *                         username:
 *                           type: string
 *                           example: test_driver
 *                         role:
 *                           type: string
 *                           example: DRIVER
 *                     mobileConfig:
 *                       type: object
 *                       properties:
 *                         offlineMode:
 *                           type: boolean
 *                           example: true
 *                         gpsTracking:
 *                           type: boolean
 *                           example: true
 *                         syncInterval:
 *                           type: integer
 *                           example: 30000
 *                 message:
 *                   type: string
 *                   example: モバイル認証が完了しました
 *       400:
 *         description: バリデーションエラー
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: VALIDATION_ERROR
 *                 message:
 *                   type: string
 *                   example: ユーザー名とパスワードが必要です
 *       401:
 *         description: 認証失敗
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: MOBILE_AUTH_FAILED
 *                 message:
 *                   type: string
 *                   example: 認証に失敗しました
 */
router.post('/auth/login',
  logRequest('POST /mobile/auth/login'),
  mobileController.login
);

/**
 * @swagger
 * /mobile/auth/me:
 *   get:
 *     summary: 現在のユーザー情報取得
 *     description: |
 *       認証済みユーザーの基本情報を取得
 *
 *       **機能:**
 *       - フロントエンドの api.getCurrentUser() に対応
 *       - トークン検証
 *       - 基本ユーザー情報返却
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ユーザー情報取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                     email:
 *                       type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: 認証エラー
 */
router.get('/auth/me',
  logRequest('GET /mobile/auth/me'),
  authenticateToken(),
  mobileController.getCurrentUser
);

/**
 * @swagger
 * /mobile/auth/info:
 *   get:
 *     summary: モバイル認証情報取得（詳細版）
 *     description: |
 *       認証済みユーザーの詳細情報を取得
 *
 *       **機能:**
 *       - モバイルステータス確認
 *       - 同期状態確認
 *       - /auth/me より詳細な情報
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 認証情報取得成功
 *       401:
 *         description: 認証エラー
 */
router.get('/auth/info',
  logRequest('GET /mobile/auth/info'),
  authenticateToken(),
  mobileController.getAuthInfo
);

// =====================================
// 🚛 モバイル運行管理エンドポイント
// =====================================

/**
 * @swagger
 * /mobile/operations/start:
 *   post:
 *     summary: 運行開始
 *     description: |
 *       新規運行を開始
 *
 *       **モバイル専用機能:**
 *       - GPS位置自動取得
 *       - 車両ステータス確認
 *       - リアルタイム追跡開始
 *       - オフライン同期準備
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleId
 *               - driverId
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 format: uuid
 *                 description: 車両ID
 *                 example: 01234567-89ab-cdef-0123-456789abcdef
 *               driverId:
 *                 type: string
 *                 format: uuid
 *                 description: ドライバーID
 *                 example: 01234567-89ab-cdef-0123-456789abcdef
 *               startLatitude:
 *                 type: number
 *                 format: double
 *                 description: 出発地点の緯度
 *                 example: 35.6812
 *                 minimum: -90
 *                 maximum: 90
 *               startLongitude:
 *                 type: number
 *                 format: double
 *                 description: 出発地点の経度
 *                 example: 139.7671
 *                 minimum: -180
 *                 maximum: 180
 *               startLocation:
 *                 type: string
 *                 description: 出発地点名
 *                 example: 車庫
 *                 maxLength: 200
 *               cargoInfo:
 *                 type: string
 *                 description: 積荷情報
 *                 example: 砂利 10t
 *                 maxLength: 500
 *           examples:
 *             with_gps:
 *               summary: GPS情報付き運行開始
 *               value:
 *                 vehicleId: 01234567-89ab-cdef-0123-456789abcdef
 *                 driverId: 01234567-89ab-cdef-0123-456789abcdef
 *                 startLatitude: 35.6812
 *                 startLongitude: 139.7671
 *                 startLocation: 車庫
 *                 cargoInfo: 砂利 10t
 *             minimal:
 *               summary: 最小限の情報で運行開始
 *               value:
 *                 vehicleId: 01234567-89ab-cdef-0123-456789abcdef
 *                 driverId: 01234567-89ab-cdef-0123-456789abcdef
 *     responses:
 *       201:
 *         description: 運行開始成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     tripId:
 *                       type: string
 *                       example: 01234567-89ab-cdef-0123-456789abcdef
 *                     operationId:
 *                       type: string
 *                       example: 01234567-89ab-cdef-0123-456789abcdef
 *                     status:
 *                       type: string
 *                       example: in_progress
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-11-29T12:00:00Z
 *                     currentPosition:
 *                       type: object
 *                       properties:
 *                         latitude:
 *                           type: number
 *                           example: 35.6812
 *                         longitude:
 *                           type: number
 *                           example: 139.7671
 *                 message:
 *                   type: string
 *                   example: 運行を開始しました
 *       400:
 *         description: バリデーションエラー
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: VALIDATION_ERROR
 *                 message:
 *                   type: string
 *                   example: 車両IDは必須です
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 車両が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.post('/operations/start',
  logRequest('POST /mobile/operations/start'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.startOperation
);

/**
 * @swagger
 * /mobile/operations/{id}/end:
 *   post:
 *     summary: 運行終了
 *     description: |
 *       指定IDの運行を終了
 *
 *       **機能:**
 *       - 最終GPS位置記録
 *       - 統計データ自動生成
 *       - オフライン同期
 *       - 運行サマリー生成
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 運行ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               endPosition:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: 運行終了成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 運行が見つかりません
 */
router.post('/operations/:id/end',
  logRequest('POST /mobile/operations/:id/end'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  validateId,
  mobileController.endOperation
);

// =====================================
// 🆕 運行履歴エンドポイント（D9/D9a）
// =====================================

/**
 * @swagger
 * /mobile/operations:
 *   get:
 *     summary: 運行履歴一覧取得（D9）
 *     description: |
 *       ログインユーザーの運行履歴一覧を取得します。
 *       DRIVERロールは自分の記録のみ取得できます。
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [COMPLETED, IN_PROGRESS, CANCELLED]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 運行履歴取得成功
 *       401:
 *         description: 認証エラー
 */
router.get('/operations',
  logRequest('GET /mobile/operations'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.getOperationHistory
);


/**
 * @swagger
 * /mobile/operations/current:
 *   get:
 *     summary: 現在の運行状況取得
 *     description: |
 *       ログインユーザーの進行中運行を取得
 *
 *       **機能:**
 *       - リアルタイム状況確認
 *       - 運転手用機能
 *       - GPS追跡情報
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 現在運行取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     tripId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: integer
 *       401:
 *         description: 認証エラー
 */
router.get('/operations/current',
  logRequest('GET /mobile/operations/current'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.getCurrentOperation
);
/**
 * @swagger
 * /mobile/operations/{id}:
 *   get:
 *     summary: 運行記録詳細取得（D9a）
 *     description: |
 *       指定した運行IDの詳細情報を取得します。
 *       DRIVERロールは自分の記録のみ参照できます。
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行記録ID
 *     responses:
 *       200:
 *         description: 運行詳細取得成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 運行記録が見つかりません
 */
router.get('/operations/:id',
  logRequest('GET /mobile/operations/:id'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.getOperationDetail
);

/**
 * @swagger
 * /mobile/operations/nearby-locations:
 *   post:
 *     summary: 🆕 運行中近隣地点検知
 *     description: |
 *       現在のGPS位置から近隣の積込場所・積降場所を検索
 *
 *       **地点接近検知機能:**
 *       - 現在位置から100-200m範囲内の地点を自動検知
 *       - 運行フェーズに応じたフィルタリング
 *         - TO_LOADING → 積込場所(PICKUP)のみ
 *         - TO_UNLOADING → 積降場所(DELIVERY)のみ
 *       - 距離順ソート
 *       - モバイル端末での自動ポップアップ表示に使用
 *
 *       **使用シーン:**
 *       - 運転手が積込場所に接近時に自動通知
 *       - 運転手が積降場所に接近時に自動通知
 *       - 地点候補の自動表示
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operationId
 *               - latitude
 *               - longitude
 *               - radiusMeters
 *               - phase
 *             properties:
 *               operationId:
 *                 type: string
 *                 format: uuid
 *                 description: 運行ID
 *                 example: "01234567-89ab-cdef-0123-456789abcdef"
 *               latitude:
 *                 type: number
 *                 format: double
 *                 description: 現在位置の緯度
 *                 example: 35.6812
 *                 minimum: -90
 *                 maximum: 90
 *               longitude:
 *                 type: number
 *                 format: double
 *                 description: 現在位置の経度
 *                 example: 139.7671
 *                 minimum: -180
 *                 maximum: 180
 *               radiusMeters:
 *                 type: number
 *                 format: double
 *                 description: 検知範囲（メートル）
 *                 example: 200
 *                 minimum: 50
 *                 maximum: 1000
 *                 default: 200
 *               phase:
 *                 type: string
 *                 enum: [TO_LOADING, TO_UNLOADING, AT_LOADING, AT_UNLOADING, BREAK, REFUEL]
 *                 description: 運行フェーズ
 *                 example: "TO_LOADING"
 *           examples:
 *             to_loading:
 *               summary: 積込場所へ向かう途中
 *               value:
 *                 operationId: "01234567-89ab-cdef-0123-456789abcdef"
 *                 latitude: 35.6812
 *                 longitude: 139.7671
 *                 radiusMeters: 200
 *                 phase: "TO_LOADING"
 *             to_unloading:
 *               summary: 積降場所へ向かう途中
 *               value:
 *                 operationId: "01234567-89ab-cdef-0123-456789abcdef"
 *                 latitude: 35.6850
 *                 longitude: 139.7700
 *                 radiusMeters: 150
 *                 phase: "TO_UNLOADING"
 *     responses:
 *       200:
 *         description: 近隣地点検索成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     nearbyLocations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "location-uuid-001"
 *                           name:
 *                             type: string
 *                             example: "○○建設資材置場"
 *                           address:
 *                             type: string
 *                             example: "愛知県名古屋市中区錦1-1-1"
 *                           locationType:
 *                             type: string
 *                             enum: [PICKUP, DELIVERY]
 *                             example: "PICKUP"
 *                           distance:
 *                             type: number
 *                             format: double
 *                             description: 現在位置からの距離（メートル）
 *                             example: 150
 *                           latitude:
 *                             type: number
 *                             format: double
 *                             example: 35.6820
 *                           longitude:
 *                             type: number
 *                             format: double
 *                             example: 139.7680
 *                           clientName:
 *                             type: string
 *                             example: "○○建設"
 *                             nullable: true
 *                     currentPhase:
 *                       type: string
 *                       example: "TO_LOADING"
 *                     suggestion:
 *                       type: string
 *                       description: 自動提案メッセージ
 *                       example: "○○建設資材置場まで150m"
 *                       nullable: true
 *                 message:
 *                   type: string
 *                   example: "近隣地点を検索しました"
 *       400:
 *         description: バリデーションエラー
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "VALIDATION_ERROR"
 *                 message:
 *                   type: string
 *                   example: "緯度・経度が必要です"
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 運行が見つかりません
 *       500:
 *         description: サーバーエラー
 */

/**
 * @swagger
 * /mobile/operations/{id}/customer:
 *   patch:
 *     summary: 客先変更（運行中）
 *     description: REQ-011 運行終了せずに客先だけ変更する
 *     tags: [📱 モバイル - 運行管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId]
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: 新しい客先ID
 *     responses:
 *       200:
 *         description: 客先変更成功
 *       400:
 *         description: バリデーションエラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 運行または客先が見つかりません
 */
router.patch('/operations/:id/customer',
  logRequest('PATCH /mobile/operations/:id/customer'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.changeCustomer
);

router.post('/operations/nearby-locations',
  logRequest('POST /mobile/operations/nearby-locations'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.getNearbyLocations
);
// =====================================
// mobileRoutes.ts への追加コード
// 既存のルート定義の後に追加してください
// 🆕 モバイル専用: 積込・積降の開始/完了エンドポイント
// 既存エンドポイントは100%保持
// =====================================

/**
 * @swagger
 * /mobile/trips/{id}/loading/start:
 *   post:
 *     summary: 🆕 モバイル | 積込開始
 *     description: |
 *       モバイルアプリから積込場所への到着を記録し、積込作業を開始します。
 *
 *       **モバイル専用機能:**
 *       - 自動GPS座標取得
 *       - オフライン対応（後で同期）
 *       - シンプルなレスポンス形式
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locationId
 *             properties:
 *               locationId:
 *                 type: string
 *                 description: 積込場所ID
 *               latitude:
 *                 type: number
 *                 description: 緯度
 *               longitude:
 *                 type: number
 *                 description: 経度
 *               accuracy:
 *                 type: number
 *                 description: GPS精度
 *               notes:
 *                 type: string
 *                 description: 備考
 *     responses:
 *       201:
 *         description: 積込開始成功
 */
router.post('/trips/:id/loading/start',
  logRequest('POST /mobile/trips/:id/loading/start'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  validateId,
  getTripController().startLoadingHandler  // ✅ 直接参照
);

/**
 * @swagger
 * /mobile/trips/{id}/loading/complete:
 *   post:
 *     summary: 🆕 モバイル | 積込完了
 *     description: |
 *       モバイルアプリから積込作業を完了します。
 *
 *       **モバイル専用機能:**
 *       - 品目選択UI対応
 *       - 数量入力サポート
 *       - オフライン対応
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *                 description: 品目ID
 *               quantity:
 *                 type: number
 *                 description: 積載量
 *               notes:
 *                 type: string
 *                 description: 備考
 *     responses:
 *       200:
 *         description: 積込完了成功
 */
router.post('/trips/:id/loading/complete',
  logRequest('POST /mobile/trips/:id/loading/complete'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  validateId,
  getTripController().completeLoadingHandler  // ✅ 直接参照
);

/**
 * @swagger
 * /mobile/trips/{id}/unloading/start:
 *   post:
 *     summary: 🆕 モバイル | 積降開始
 *     description: |
 *       モバイルアプリから積降場所への到着を記録し、積降作業を開始します。
 *
 *       **モバイル専用機能:**
 *       - 自動GPS座標取得
 *       - 運行時間一時停止
 *       - オフライン対応
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locationId
 *             properties:
 *               locationId:
 *                 type: string
 *                 description: 積降場所ID
 *               latitude:
 *                 type: number
 *                 description: 緯度
 *               longitude:
 *                 type: number
 *                 description: 経度
 *               accuracy:
 *                 type: number
 *                 description: GPS精度
 *               notes:
 *                 type: string
 *                 description: 備考
 *     responses:
 *       201:
 *         description: 積降開始成功
 */
router.post('/trips/:id/unloading/start',
  logRequest('POST /mobile/trips/:id/unloading/start'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  validateId,
  getTripController().startUnloadingHandler  // ✅ 直接参照
);

/**
 * @swagger
 * /mobile/trips/{id}/unloading/complete:
 *   post:
 *     summary: 🆕 モバイル | 積降完了
 *     description: |
 *       モバイルアプリから積降作業を完了します。
 *
 *       **モバイル専用機能:**
 *       - 品目選択UI対応
 *       - 数量入力サポート
 *       - 運行時間再開
 *       - 次の積込場所へ自動遷移
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *                 description: 品目ID
 *               quantity:
 *                 type: number
 *                 description: 積載量
 *               notes:
 *                 type: string
 *                 description: 備考
 *     responses:
 *       200:
 *         description: 積降完了成功
 */
router.post('/trips/:id/unloading/complete',
  logRequest('POST /mobile/trips/:id/unloading/complete'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  validateId,
  getTripController().completeUnloadingHandler  // ✅ 直接参照
);

logger.info('✅ Mobile TripRoutes 新規エンドポイント追加完了', {
  newEndpoints: [
    'POST /mobile/trips/:id/loading/start',
    'POST /mobile/trips/:id/loading/complete',
    'POST /mobile/trips/:id/unloading/start',
    'POST /mobile/trips/:id/unloading/complete'
  ]
});

// =====================================
// 📍 モバイルGPS・位置管理エンドポイント
// =====================================

/**
 * @swagger
 * /mobile/gps/log:
 *   post:
 *     summary: GPS位置ログ記録
 *     description: |
 *       GPS位置情報を記録
 *
 *       **機能:**
 *       - 高頻度GPS記録
 *       - バッチ処理対応
 *       - 精度検証・異常値検出
 *       - オフライン同期・データ圧縮
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     accuracy:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       201:
 *         description: GPS記録成功
 *       401:
 *         description: 認証エラー
 */
router.post('/gps/log',
  logRequest('POST /mobile/gps/log'),
  authenticateToken(),
  mobileController.logGpsPosition
);

/**
 * @swagger
 * /mobile/locations:
 *   get:
 *     summary: 位置一覧取得
 *     description: |
 *       位置情報の一覧を取得
 *
 *       **機能:**
 *       - 近隣位置検索
 *       - よく使用する場所優先表示
 *       - オフライン対応・キャッシュ
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: 位置一覧取得成功
 *       401:
 *         description: 認証エラー
 */
router.get('/locations',
  logRequest('GET /mobile/locations'),
  authenticateToken(),
  validatePaginationQuery,
  mobileController.getLocations
);

/**
 * @swagger
 * /mobile/locations/quick:
 *   post:
 *     summary: クイック位置登録
 *     description: |
 *       現在地から素早く位置を登録
 *
 *       **機能:**
 *       - 最小限の入力項目
 *       - GPS自動取得
 *       - 即座の登録
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               name:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               locationType:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: 位置登録成功
 *       401:
 *         description: 認証エラー
 */
router.post('/locations/quick',
  logRequest('POST /mobile/locations/quick'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.quickAddLocation
);

// =====================================
// 🚗 モバイル車両管理エンドポイント
// =====================================

/**
 * @swagger
 * /mobile/vehicle:
 *   get:
 *     summary: 車両情報取得
 *     description: |
 *       割り当てられた車両情報を取得
 *
 *       **機能:**
 *       - ステータス確認
 *       - メンテナンス情報
 *       - 車両詳細取得
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 車両情報取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicleId:
 *                       type: string
 *                     info:
 *                       type: object
 *                       properties:
 *                         plateNumber:
 *                           type: string
 *                         model:
 *                           type: string
 *                         manufacturer:
 *                           type: string
 *       401:
 *         description: 認証エラー
 */
router.get('/vehicle',
  logRequest('GET /mobile/vehicle'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.getVehicleInfo
);

/**
 * @swagger
 * /mobile/vehicles:
 *   get:
 *     summary: 車両一覧取得
 *     description: |
 *       利用可能な車両一覧を取得
 *
 *       **機能:**
 *       - フィルタリング・検索機能
 *       - ステータスフィルター
 *       - ページネーション
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 車両一覧取得成功
 *       401:
 *         description: 認証エラー
 */
router.get('/vehicles',
  logRequest('GET /mobile/vehicles'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.getVehiclesList
);

/**
 * @swagger
 * /mobile/vehicle/status:
 *   put:
 *     summary: 車両ステータス更新
 *     description: |
 *       モバイルから車両ステータスを更新
 *
 *       **機能:**
 *       - リアルタイム反映
 *       - ステータス履歴記録
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: ステータス更新成功
 *       401:
 *         description: 認証エラー
 */
router.put('/vehicle/status',
  logRequest('PUT /mobile/vehicle/status'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.updateVehicleStatus
);

// =====================================
// 🔧 モバイルヘルスチェック・監視エンドポイント
// =====================================

/**
 * @swagger
 * /mobile/health:
 *   get:
 *     summary: モバイルAPIヘルスチェック
 *     description: |
 *       モバイルAPIの稼働状況を確認
 *
 *       **機能:**
 *       - API稼働状況確認
 *       - サービス統合状況確認
 *       - 統計情報取得
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     responses:
 *       200:
 *         description: ヘルスチェック成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 */
router.get('/health',
  logRequest('GET /mobile/health'),
  mobileController.healthCheck
);

/**
 * @swagger
 * /mobile/summary/today:
 *   get:
 *     summary: 今日の運行サマリー取得
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: サマリー取得成功
 */
router.get('/summary/today',
  logRequest('GET /mobile/summary/today'),
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN'] as UserRole[]),
  mobileController.getTodaysSummary
);

// =====================================
// 🚫 404ハンドラー
// =====================================

/**
 * @swagger
 * /mobile/*:
 *   all:
 *     summary: 未定義エンドポイント
 *     description: 定義されていないモバイルAPIエンドポイントへのアクセス
 *     tags:
 *       - 📱 モバイル統合 (Mobile Integration)
 *     responses:
 *       404:
 *         description: エンドポイントが見つかりません
 */
router.use('*', (req, res) => {
  logger.warn('未定義モバイルAPIエンドポイント', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    message: `モバイルAPI: ${req.method} ${req.originalUrl} は存在しません`,
    data: {
      availableEndpoints: [
        'POST /mobile/auth/login - モバイル認証ログイン',
        'GET /mobile/auth/me - 現在のユーザー情報取得',
        'GET /mobile/auth/info - モバイル認証情報取得（詳細）',
        'POST /mobile/operations/start - 運行開始',
        'POST /mobile/operations/:id/end - 運行終了',
        'GET /mobile/operations - 運行履歴一覧取得 (D9)',
        'GET /mobile/operations/:id - 運行記録詳細取得 (D9a)',
        'GET /mobile/operations/current - 現在運行状況',
        '🆕 POST /mobile/operations/nearby-locations - 近隣地点検知',
        'POST /mobile/gps/log - GPS位置ログ記録',
        'GET /mobile/locations - 位置一覧取得',
        'POST /mobile/locations/quick - クイック位置登録',
        'GET /mobile/vehicle - 車両情報取得',
        'GET /mobile/vehicles - 車両一覧取得',
        'PUT /mobile/vehicle/status - 車両ステータス更新',
        'GET /mobile/health - ヘルスチェック'
      ],
      documentation: '/docs'
    }
  });
});

// =====================================
// エクスポート
// =====================================

logger.info('✅ routes/mobileRoutes.ts Swagger UI完全対応版 + 近隣地点検知機能 統合完了', {
  totalEndpoints: 14,
  swaggerDocumented: 14,
  newEndpoints: 1,
  integrationStatus: 'controllers/mobileController.ts - Full Integration',
  middleware: 'auth + validation + Swagger integrated',
  timestamp: new Date().toISOString()
});

export default router;

// =====================================
// ✅ Swagger UI完全対応 + 新規機能追加 完了確認
// =====================================

/**
 * ✅ routes/mobileRoutes.ts - Swagger UI完全対応版 + 近隣地点検知機能追加
 *
 * 【Swagger対応完了】
 * ✅ 全14エンドポイント（13既存 + 1新規）にSwaggerドキュメント追加
 * ✅ パラメータ定義完備（query, path, body）
 * ✅ レスポンススキーマ定義
 * ✅ 認証・権限要件明記
 * ✅ エラーレスポンス定義
 * ✅ モバイル専用機能説明
 * ✅ inspectionRoutes.tsパターン準拠
 *
 * 【新規機能追加】
 * 🆕 POST /mobile/operations/nearby-locations - 運行中近隣地点検知
 *    - 現在GPS位置から100-200m範囲内の地点を自動検知
 *    - 運行フェーズ別フィルタリング（TO_LOADING → PICKUP, TO_UNLOADING → DELIVERY）
 *    - 距離順ソート
 *    - モバイル端末での自動ポップアップ表示に使用
 *
 * 【既存機能100%保持】
 * ✅ 全コード保持（一切削除なし）
 * ✅ 全コメント保持
 * ✅ ミドルウェア: 全て保持
 * ✅ エンドポイント: 全13個保持 + 1個追加
 * ✅ 権限制御: 全て保持
 * ✅ バリデーション: 全て保持
 * ✅ ログ機能: 全て保持
 * ✅ 404ハンドラー: 保持
 *
 * 【実装エンドポイント一覧】
 * 1. POST /mobile/auth/login
 * 2. GET /mobile/auth/me
 * 3. GET /mobile/auth/info
 * 4. POST /mobile/operations/start
 * 5. POST /mobile/operations/:id/end
 * 6. GET /mobile/operations/current
 * 7. 🆕 POST /mobile/operations/nearby-locations - 近隣地点検知
 * 8. POST /mobile/gps/log
 * 9. GET /mobile/locations
 * 10. POST /mobile/locations/quick
 * 11. GET /mobile/vehicle
 * 12. GET /mobile/vehicles
 * 13. PUT /mobile/vehicle/status
 * 14. GET /mobile/health
 *
 * 【次のステップ】
 * ✅ Swagger UIでの単体テスト実施
 * ✅ 近隣地点検知機能のController/Service層実装
 * ✅ フロントエンド統合
 */
