// =====================================
// backend/src/routes/mobileRoute.ts
// モバイルAPI専用ルート - Swagger UI完全対応版
// 既存機能100%保持 + 全エンドポイントSwagger完備
// Controller完全委譲・他Routerとの完全一貫性実現
// 最終更新: 2025年11月29日
// 修正内容: Swagger UI完全対応（inspectionRoutes.tsパターン準拠）
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

// 🎯 完成済みcontrollers層との密連携
import { UserRole } from '@prisma/client';
import { getMobileController } from '../controllers/mobileController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const mobileController = getMobileController();

// 🔧 デバッグ出力: ルーター初期化確認
logger.info('🔧 [MobileRoutes] ルーター初期化完了', {
  timestamp: new Date().toISOString(),
  file: 'backend/src/routes/mobileRoute.ts'
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
 *       - 📱 モバイルAPI (Mobile API)
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
        'GET /mobile/operations/current - 現在運行状況',
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

logger.info('✅ routes/mobileRoute.ts Swagger UI完全対応版 統合完了', {
  totalEndpoints: 13,
  swaggerDocumented: 13,
  integrationStatus: 'controllers/mobileController.ts - Full Integration',
  middleware: 'auth + validation + Swagger integrated',
  timestamp: new Date().toISOString()
});

export default router;

// =====================================
// ✅ Swagger UI完全対応 完了確認
// =====================================

/**
 * ✅ routes/mobileRoute.ts - Swagger UI完全対応版
 *
 * 【Swagger対応完了】
 * ✅ 全13エンドポイントにSwaggerドキュメント追加
 * ✅ パラメータ定義完備（query, path, body）
 * ✅ レスポンススキーマ定義
 * ✅ 認証・権限要件明記
 * ✅ エラーレスポンス定義
 * ✅ モバイル専用機能説明
 * ✅ inspectionRoutes.tsパターン準拠
 *
 * 【既存機能100%保持】
 * ✅ ミドルウェア: 全て保持
 * ✅ エンドポイント: 全13個保持
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
 * 7. POST /mobile/gps/log
 * 8. GET /mobile/locations
 * 9. POST /mobile/locations/quick
 * 10. GET /mobile/vehicle
 * 11. GET /mobile/vehicles
 * 12. PUT /mobile/vehicle/status
 * 13. GET /mobile/health
 *
 * 【次のステップ】
 * ✅ Swagger UIでの単体テスト実施
 * → 404問題の解消へ進む
 */
