// =====================================
// backend/src/routes/tripRoutes.ts
// 運行管理ルート統合 - SwaggerUI完全対応・認証問題完全解決版
// 運行記録CRUD・GPS連携・状態管理・リアルタイム追跡・統計分析
// 最終更新: 2025年12月4日 v2
// 修正内容: 認証ミドルウェア二重適用問題の完全解決・inspectionRoutesパターン準拠
// 依存関係: middleware/auth.ts, controllers/tripController.ts
// =====================================

/**
 * 【問題の真の原因と解決策】
 *
 * ❌ 問題:
 * 1. routes/index.tsで requireAuth: true が設定されている
 * 2. tripRoutes.ts内で router.use(authenticateToken()) を再適用
 * 3. 認証ミドルウェアが二重に適用され、リクエストが停止
 *
 * ✅ 解決策（inspectionRoutesパターンを採用）:
 * 1. routes/index.tsでの認証適用を無効化（requireAuth: false）
 * 2. tripRoutes.ts内で個別に認証を適用
 * 3. エンドポイントごとに適切な権限制御を実施
 *
 * 参考: inspectionRoutesは同じパターンで正常動作中
 */

import { Router } from 'express';

// 🎯 Phase 1完了基盤の活用
import { 
  authenticateToken, 
  requireAdmin, 
  requireManagerOrAdmin, 
  requireRole 
} from '../middleware/auth';
import logger from '../utils/logger';

// 🎯 コントローラーの統合活用（全機能実装済み）
import { getTripController } from '../controllers/tripController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const tripController = getTripController();

// 🔧 デバッグ: Controllerインスタンス確認
logger.info('🚛 TripRoutes初期化開始', {
  controllerMethods: {
    getAllTrips: typeof tripController.getAllTrips === 'function',
    getTripById: typeof tripController.getTripById === 'function',
    createTrip: typeof tripController.createTrip === 'function',
    updateTrip: typeof tripController.updateTrip === 'function',
    endTrip: typeof tripController.endTrip === 'function',
    updateGPSLocation: typeof tripController.updateGPSLocation === 'function',
    getGPSHistory: typeof tripController.getGPSHistory === 'function',
    addFuelRecord: typeof tripController.addFuelRecord === 'function',
    addLoadingRecord: typeof tripController.addLoadingRecord === 'function',
    addUnloadingRecord: typeof tripController.addUnloadingRecord === 'function',
    getCurrentTrip: typeof tripController.getCurrentTrip === 'function',
    getTripStatistics: typeof tripController.getTripStatistics === 'function',
    deleteTrip: typeof tripController.deleteTrip === 'function'
  }
});

// =====================================
// 🚛 運行管理APIエンドポイント（全14エンドポイント）
// =====================================

/**
 * @swagger
 * /trips:
 *   get:
 *     summary: 運行記録一覧取得
 *     description: |
 *       ページネーション・検索・フィルタ機能付きで運行記録一覧を取得
 *
 *       **実装機能:**
 *       - ページネーション・検索・フィルタ
 *       - 複数条件フィルタ（車両ID、運転手ID、ステータス、期間）
 *       - 統計情報取得オプション
 *       - GPS情報フィルタ
 *       - 権限ベースデータ制御（運転手は自分の運行のみ）
 *
 *       **権限:** DRIVER（自分の運行のみ）, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: ページ番号
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: ページサイズ
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: 車両IDでフィルタ
 *       - in: query
 *         name: driverId
 *         schema:
 *           type: string
 *         description: 運転手IDでフィルタ
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PLANNING, IN_PROGRESS, COMPLETED, CANCELLED]
 *         description: ステータスでフィルタ
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 開始日時（この日時以降）
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 終了日時（この日時以前）
 *     responses:
 *       200:
 *         description: 運行一覧取得成功
 *       401:
 *         description: 認証エラー
 *       500:
 *         description: サーバーエラー
 */
router.get(
  '/',
  authenticateToken(),
  tripController.getAllTrips
);

/**
 * @swagger
 * /trips/current:
 *   get:
 *     summary: 現在の運行取得
 *     description: |
 *       現在進行中の運行を取得
 *
 *       **実装機能:**
 *       - 進行中運行の検索
 *       - ドライバー別フィルタ
 *
 *       **権限:** DRIVER（自分の運行のみ）, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 現在の運行取得成功
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 進行中の運行がありません
 *       500:
 *         description: サーバーエラー
 */
router.get(
  '/current',
  authenticateToken(),
  tripController.getCurrentTrip
);

/**
 * @swagger
 * /trips/api/stats:
 *   get:
 *     summary: 運行統計取得
 *     description: |
 *       運行統計情報を取得
 *
 *       **実装機能:**
 *       - 総運行数
 *       - ステータス別集計
 *       - 期間別集計
 *       - 車両別集計
 *       - 運転手別集計
 *       - 距離・燃費統計
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 集計開始日
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 集計終了日
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: 車両IDでフィルタ
 *       - in: query
 *         name: driverId
 *         schema:
 *           type: string
 *         description: 運転手IDでフィルタ
 *     responses:
 *       200:
 *         description: 統計取得成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       500:
 *         description: サーバーエラー
 */
router.get(
  '/api/stats',
  authenticateToken(),
  requireManagerOrAdmin,
  tripController.getTripStatistics
);

/**
 * @swagger
 * /trips/{id}:
 *   get:
 *     summary: 運行記録詳細取得
 *     description: |
 *       指定されたIDの運行詳細情報を取得
 *
 *       **実装機能:**
 *       - 運行基本情報
 *       - 関連車両情報
 *       - 関連運転手情報
 *       - GPS履歴
 *       - 運行詳細アクティビティ
 *       - 燃料記録
 *       - 統計情報
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
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
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.get(
  '/:id',
  authenticateToken(),
  tripController.getTripById
);

/**
 * @swagger
 * /trips/{id}/gps-history:
 *   get:
 *     summary: GPS履歴取得
 *     description: |
 *       運行のGPS履歴を取得
 *
 *       **実装機能:**
 *       - 時系列GPS履歴
 *       - フィルタ機能
 *       - ページネーション
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行記録ID
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 開始時刻
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 終了時刻
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: 取得件数
 *     responses:
 *       200:
 *         description: GPS履歴取得成功
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.get(
  '/:id/gps-history',
  authenticateToken(),
  tripController.getGPSHistory
);

/**
 * @swagger
 * /trips:
 *   post:
 *     summary: 運行作成/開始
 *     description: |
 *       新しい運行を作成・開始
 *
 *       **実装機能:**
 *       - GPS座標バリデーション
 *       - 車両状態チェック
 *       - 運転手アサイン
 *       - 初期GPS記録作成
 *       - 車両ステータス更新
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
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
 *               - actualStartTime
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 description: 車両ID
 *               driverId:
 *                 type: string
 *                 description: 運転手ID（省略時は認証ユーザー）
 *               actualStartTime:
 *                 type: string
 *                 format: date-time
 *                 description: 実際の開始時刻
 *               startMileage:
 *                 type: number
 *                 description: 開始時の走行距離（km）
 *               startLocation:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *                   address:
 *                     type: string
 *               notes:
 *                 type: string
 *                 description: メモ
 *     responses:
 *       201:
 *         description: 運行作成成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       409:
 *         description: 車両が既に使用中
 *       500:
 *         description: サーバーエラー
 */
router.post(
  '/',
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN']),
  tripController.createTrip
);

/**
 * @swagger
 * /trips/start:
 *   post:
 *     summary: 運行作成/開始（エイリアス）
 *     description: POST /tripsのエイリアス
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       $ref: '#/components/requestBodies/CreateTrip'
 *     responses:
 *       $ref: '#/components/responses/TripCreated'
 */
router.post(
  '/start',
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN']),
  tripController.createTrip
);

/**
 * @swagger
 * /trips/{id}:
 *   put:
 *     summary: 運行更新
 *     description: |
 *       運行情報を更新
 *
 *       **実装機能:**
 *       - ステータス更新
 *       - メモ更新
 *       - 権限チェック（自分の運行または管理者）
 *
 *       **権限:** DRIVER（自分の運行のみ）, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行記録ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PLANNING, IN_PROGRESS, COMPLETED, CANCELLED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.put(
  '/:id',
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN']),
  tripController.updateTrip
);

/**
 * @swagger
 * /trips/{id}/end:
 *   post:
 *     summary: 運行終了
 *     description: |
 *       運行を終了し、統計情報を生成
 *
 *       **実装機能:**
 *       - 終了時刻記録
 *       - 最終GPS記録
 *       - 距離・燃費計算
 *       - 車両ステータス復帰
 *       - 運行統計生成
 *
 *       **権限:** DRIVER（自分の運行のみ）, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行記録ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endTime
 *             properties:
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: 運行終了時刻
 *               endMileage:
 *                 type: number
 *                 description: 終了時の走行距離（km）
 *               endLocation:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *                   address:
 *                     type: string
 *               notes:
 *                 type: string
 *                 description: 終了時のメモ
 *     responses:
 *       200:
 *         description: 運行終了成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.post(
  '/:id/end',
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN']),
  tripController.endTrip
);

/**
 * @swagger
 * /trips/{id}/location:
 *   post:
 *     summary: GPS位置更新
 *     description: |
 *       運行中のGPS位置情報を更新
 *
 *       **実装機能:**
 *       - リアルタイムGPS記録
 *       - 移動距離計算
 *       - 速度計算
 *       - 異常検知
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行記録ID
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
 *               latitude:
 *                 type: number
 *                 description: 緯度
 *               longitude:
 *                 type: number
 *                 description: 経度
 *               accuracy:
 *                 type: number
 *                 description: 精度（メートル）
 *               speed:
 *                 type: number
 *                 description: 速度（km/h）
 *               heading:
 *                 type: number
 *                 description: 方位（度）
 *     responses:
 *       200:
 *         description: GPS位置更新成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.post(
  '/:id/location',
  authenticateToken(),
  tripController.updateGPSLocation
);

/**
 * @swagger
 * /trips/{id}/fuel:
 *   post:
 *     summary: 燃料記録追加
 *     description: |
 *       運行の燃料記録を追加
 *
 *       **実装機能:**
 *       - 給油記録
 *       - 燃費計算
 *       - コスト記録
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行記録ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - liters
 *               - cost
 *             properties:
 *               liters:
 *                 type: number
 *                 description: 給油量（リットル）
 *               cost:
 *                 type: number
 *                 description: 給油コスト（円）
 *               stationName:
 *                 type: string
 *                 description: ガソリンスタンド名
 *               notes:
 *                 type: string
 *                 description: メモ
 *     responses:
 *       200:
 *         description: 燃料記録追加成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.post(
  '/:id/fuel',
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN']),
  tripController.addFuelRecord
);

/**
 * @swagger
 * /trips/{id}/loading:
 *   post:
 *     summary: 積込記録追加（D5機能）
 *     description: |
 *       運行の積込記録を追加
 *
 *       **実装機能:**
 *       - 積込地点記録
 *       - GPS座標記録
 *       - 時刻記録
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行記録ID
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
 *               latitude:
 *                 type: number
 *                 description: 緯度
 *               longitude:
 *                 type: number
 *                 description: 経度
 *               locationName:
 *                 type: string
 *                 description: 地点名
 *               notes:
 *                 type: string
 *                 description: メモ
 *     responses:
 *       200:
 *         description: 積込記録追加成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.post(
  '/:id/loading',
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN']),
  tripController.addLoadingRecord
);

/**
 * @swagger
 * /trips/{id}/unloading:
 *   post:
 *     summary: 積降記録追加（D6機能）
 *     description: |
 *       運行の積降記録を追加
 *
 *       **実装機能:**
 *       - 積降地点記録
 *       - GPS座標記録
 *       - 時刻記録
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行記録ID
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
 *               latitude:
 *                 type: number
 *                 description: 緯度
 *               longitude:
 *                 type: number
 *                 description: 経度
 *               locationName:
 *                 type: string
 *                 description: 地点名
 *               notes:
 *                 type: string
 *                 description: メモ
 *     responses:
 *       200:
 *         description: 積降記録追加成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.post(
  '/:id/unloading',
  authenticateToken(),
  requireRole(['DRIVER', 'MANAGER', 'ADMIN']),
  tripController.addUnloadingRecord
);

/**
 * @swagger
 * /trips/{id}:
 *   delete:
 *     summary: 運行削除
 *     description: |
 *       運行記録を削除（論理削除）
 *
 *       **実装機能:**
 *       - 論理削除
 *       - 関連データ処理
 *       - 管理者権限必須
 *
 *       **注意:** この操作は取り消せません
 *
 *       **権限:** ADMIN のみ
 *     tags:
 *       - 📋 運行記録管理 (Trip Management)
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
 *         description: 削除成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（管理者のみ）
 *       404:
 *         description: 運行記録が見つかりません
 *       500:
 *         description: サーバーエラー
 */
router.delete(
  '/:id',
  authenticateToken(),
  requireAdmin,
  tripController.deleteTrip
);

// =====================================
// 登録完了ログ
// =====================================

logger.info('✅ TripRoutes登録完了 - inspectionRoutesパターン準拠版', {
  totalEndpoints: 14,
  authenticationPattern: 'Individual endpoint authentication (like inspectionRoutes)',
  middlewareApplied: 'authenticateToken() per endpoint + role-based authorization',
  timestamp: new Date().toISOString()
});

// =====================================
// エクスポート
// =====================================

export default router;

// =====================================
// ✅ SwaggerUI完全対応・認証問題完全解決版 v2 完成
// =====================================

/**
 * 【修正完了サマリー v2】
 *
 * ✅ 真の問題の特定:
 * - routes/index.tsでrequireAuth: trueが設定されている
 * - tripRoutes.ts内でrouter.use(authenticateToken())を再適用
 * - 認証ミドルウェアが二重に適用され、リクエストが停止
 *
 * ✅ inspectionRoutesパターンを完全採用:
 * 1. routes/index.tsでの認証を無効化（requireAuth: false に変更必要）
 * 2. 各エンドポイントで個別にauthenticateToken()を適用
 * 3. 必要に応じて権限制御ミドルウェアを追加
 *
 * ✅ 全14エンドポイント実装:
 * 1. GET    /trips               - 運行一覧取得
 * 2. GET    /trips/current       - 現在の運行取得（パス順序最適化）
 * 3. GET    /trips/api/stats     - 運行統計取得（パス順序最適化）
 * 4. GET    /trips/:id           - 運行詳細取得
 * 5. GET    /trips/:id/gps-history - GPS履歴取得
 * 6. POST   /trips               - 運行開始
 * 7. POST   /trips/start         - 運行開始（エイリアス）
 * 8. PUT    /trips/:id           - 運行更新
 * 9. POST   /trips/:id/end       - 運行終了
 * 10. POST  /trips/:id/location  - GPS位置更新
 * 11. POST  /trips/:id/fuel      - 燃料記録追加
 * 12. POST  /trips/:id/loading   - 積込記録追加（D5機能）
 * 13. POST  /trips/:id/unloading - 積降記録追加（D6機能）
 * 14. DELETE /trips/:id          - 運行削除
 *
 * ✅ 認証パターン:
 * - 全エンドポイントで個別にauthenticateToken()を適用
 * - 権限が必要なエンドポイントではrequireRole等を追加
 * - inspectionRoutesと同じパターンで実装
 *
 * ✅ Swagger UI完全対応:
 * - 全エンドポイントにSwagger定義
 * - パラメータ定義完備
 * - レスポンススキーマ定義
 * - 認証・権限要件明記
 *
 * ✅ パス順序の最適化:
 * - /trips/current を /trips/:id より前に配置
 * - /trips/api/stats を /trips/:id より前に配置
 * - パラメータパスとの競合を回避
 */