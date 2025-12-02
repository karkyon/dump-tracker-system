// =====================================
// backend/src/routes/tripRoutes.ts
// 運行管理ルート統合 - Swagger UI重複解消版
// 運行記録CRUD・GPS連携・状態管理・リアルタイム追跡・統計分析
// 最終更新: 2025年12月2日
// 修正内容: Swaggerタグを「🗺️ 運行管理 (Trip Management)」に統一
// 依存関係: middleware/auth.ts, controllers/tripController.ts, models/OperationModel.ts
// =====================================

/**
 * 【重要な設計決定の理由】
 *
 * 元のtripRoutes.tsは大量のビジネスロジックを直接実装していましたが、
 * これは以下の理由で不適切でした:
 *
 * 1. アーキテクチャ違反
 *    - routes層: エンドポイント定義のみを行うべき
 *    - ビジネスロジックはcontroller層・service層が担当
 *
 * 2. プロジェクトの整合性
 *    - userRoutes.ts, vehicleRoutes.ts等は全てcontrollerパターン採用済み
 *    - tripRoutesだけが直接実装では一貫性がない
 *
 * 3. 完成済み基盤の存在
 *    - tripController.ts: 完成済み（全13機能実装）
 *    - tripService.ts: 完成済み（ビジネスロジック実装）
 *    - これらを活用しないのは二重実装
 *
 * 4. エラーの根本原因
 *    - 107件のコンパイルエラーの大半は、routes層で直接
 *      データアクセス・型変換・バリデーションを行っていたため
 *
 * したがって、本修正では「機能削減」ではなく「適切な責務分離」を実現しています。
 * 全機能はcontroller/service層で実装済みであり、routes層はそれを呼び出すのみです。
 */

import { Router } from 'express';

// 🎯 Phase 1完了基盤の活用
import { authenticateToken, requireAdmin, requireManagerOrAdmin, requireRole } from '../middleware/auth';

// 🎯 コントローラーの統合活用（全機能実装済み）
import { TripController } from '../controllers/tripController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const tripController = new TripController();

// =====================================
// 全ルートで認証必須
// =====================================

router.use(authenticateToken());

// =====================================
// 🚛 運行管理APIエンドポイント（全機能実装）
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
 *       - 🗺️ 運行管理 (Trip Management)
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
/**
 * 運行記録一覧取得
 * GET /trips
 *
 * 実装機能:
 * - ページネーション・検索・フィルタ
 * - 複数条件フィルタ（車両ID、運転手ID、ステータス、期間）
 * - 統計情報取得オプション
 * - GPS情報フィルタ
 * - 権限ベースデータ制御（運転手は自分の運行のみ）
 */
router.get('/', tripController.getAllTrips);

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
 *       - 🗺️ 運行管理 (Trip Management)
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
/**
 * 運行記録詳細取得
 * GET /trips/:id
 *
 * 実装機能:
 * - 運行基本情報
 * - 関連車両情報
 * - 関連運転手情報
 * - GPS履歴
 * - 運行詳細アクティビティ
 * - 燃料記録
 * - 統計情報
 */
router.get('/:id', tripController.getTripById);

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
 *       - 🗺️ 運行管理 (Trip Management)
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
/**
 * @swagger
 * /trips/start:
 *   post:
 *     summary: 運行作成/開始（エイリアス）
 *     description: |
 *       新しい運行を作成・開始（POSTTripsのエイリアス）
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
 *       - 🗺️ 運行管理 (Trip Management)
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
/**
 * 運行作成/開始
 * POST /trips or POST /trips/start
 *
 * 実装機能:
 * - GPS座標バリデーション
 * - 車両状態チェック
 * - 運転手アサイン
 * - 初期GPS記録作成
 * - 車両ステータス更新
 *
 * 注: startTrip は createTrip のエイリアス
 */
router.post('/', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.createTrip);
router.post('/start', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.createTrip);

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
 *       - 🗺️ 運行管理 (Trip Management)
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
/**
 * 運行更新
 * PUT /trips/:id
 *
 * 実装機能:
 * - ステータス更新
 * - メモ更新
 * - 権限チェック（自分の運行または管理者）
 */
router.put('/:id', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.updateTrip);

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
 *       - 🗺️ 運行管理 (Trip Management)
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
/**
 * 運行終了
 * POST /trips/:id/end
 *
 * 実装機能:
 * - 終了時刻記録
 * - 最終GPS記録
 * - 距離・燃費計算
 * - 車両ステータス復帰
 * - 運行統計生成
 */
router.post('/:id/end', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.endTrip);

/**
 * @swagger
 * /trips/{id}/location:
 *   post:
 *     summary: 運行中GPS位置更新
 *     description: |
 *       運行中のGPS位置情報をリアルタイム更新
 *
 *       **実装機能:**
 *       - リアルタイムGPS記録
 *       - 座標バリデーション
 *       - 距離累積計算
 *       - 移動経路記録
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 🗺️ 運行管理 (Trip Management)
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
 *                 format: double
 *                 minimum: -90
 *                 maximum: 90
 *                 description: 緯度
 *               longitude:
 *                 type: number
 *                 format: double
 *                 minimum: -180
 *                 maximum: 180
 *                 description: 経度
 *               accuracy:
 *                 type: number
 *                 description: GPS精度（メートル）
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
/**
 * 運行中GPS位置更新
 * POST /trips/:id/location
 *
 * 実装機能:
 * - リアルタイムGPS記録
 * - 座標バリデーション
 * - 距離累積計算
 * - 移動経路記録
 */
router.post('/:id/location', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.updateGPSLocation);

/**
 * @swagger
 * /trips/{id}/gps-history:
 *   get:
 *     summary: GPS履歴取得
 *     description: |
 *       指定された運行のGPS履歴を取得
 *
 *       **実装機能:**
 *       - 時系列GPS履歴
 *       - ページネーション
 *       - 期間フィルタ
 *       - 移動ルート再構成
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 🗺️ 運行管理 (Trip Management)
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
 *         description: 開始時刻（この時刻以降）
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 終了時刻（この時刻以前）
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
 *           default: 50
 *         description: ページサイズ
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
/**
 * GPS履歴取得
 * GET /trips/:id/gps-history
 *
 * 実装機能:
 * - 時系列GPS履歴
 * - ページネーション
 * - 期間フィルタ
 * - 移動ルート再構成
 */
router.get('/:id/gps-history', tripController.getGPSHistory);

/**
 * @swagger
 * /trips/{id}/fuel:
 *   post:
 *     summary: 燃料記録追加
 *     description: |
 *       運行中の給油記録を追加
 *
 *       **実装機能:**
 *       - 給油記録
 *       - 燃料コスト記録
 *       - 位置情報記録
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 🗺️ 運行管理 (Trip Management)
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
 *               - fuelAmount
 *               - fuelCost
 *               - fuelTime
 *             properties:
 *               fuelAmount:
 *                 type: number
 *                 description: 給油量（リットル）
 *               fuelCost:
 *                 type: number
 *                 description: 給油コスト（円）
 *               fuelTime:
 *                 type: string
 *                 format: date-time
 *                 description: 給油時刻
 *               fuelLocation:
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
/**
 * 燃料記録追加
 * POST /trips/:id/fuel
 *
 * 実装機能:
 * - 給油記録
 * - 燃料コスト記録
 * - 位置情報記録
 */
router.post('/:id/fuel', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.addFuelRecord);

/**
 * @swagger
 * /trips/{id}/loading:
 *   post:
 *     summary: 積込記録追加（D5機能）
 *     description: |
 *       運行中の積込作業を記録
 *
 *       **D5機能対応:** モバイルアプリの「積込場所到着」ボタンクリック時に使用
 *
 *       **実装機能:**
 *       - 積込場所記録
 *       - 積載量記録
 *       - 品目記録
 *       - GPS位置記録（直接指定または位置IDから取得）
 *       - 到着時刻自動記録
 *
 *       **リクエストパラメータ:**
 *       - `locationId`: 必須 - 場所ID
 *       - `latitude`, `longitude`: 🆕 必須 - GPS座標（直接指定）
 *       - `accuracy`: オプション - GPS精度（メートル）
 *       - `arrivalTime`: オプション - 到着時刻（省略時は現在時刻）
 *       - `itemId`, `quantity`, `notes`: 既存のオプションフィールド
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 🗺️ 運行管理 (Trip Management)
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
 *               - locationId
 *               - latitude
 *               - longitude
 *             properties:
 *               locationId:
 *                 type: string
 *                 format: uuid
 *                 description: 積込場所ID
 *               latitude:
 *                 type: number
 *                 format: double
 *                 minimum: -90
 *                 maximum: 90
 *                 description: 🆕 GPS緯度（D5機能）
 *               longitude:
 *                 type: number
 *                 format: double
 *                 minimum: -180
 *                 maximum: 180
 *                 description: 🆕 GPS経度（D5機能）
 *               accuracy:
 *                 type: number
 *                 description: 🆕 GPS精度（メートル）
 *               arrivalTime:
 *                 type: string
 *                 format: date-time
 *                 description: 🆕 到着時刻（省略時は現在時刻）
 *               itemId:
 *                 type: string
 *                 description: 品目ID
 *               quantity:
 *                 type: number
 *                 description: 積載量
 *               notes:
 *                 type: string
 *                 description: メモ
 *     responses:
 *       201:
 *         description: 積込記録追加成功
 *       400:
 *         description: バリデーションエラー（GPS座標必須）
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 運行記録または場所が見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * 積込記録追加
 * POST /trips/:id/loading
 *
 * 実装機能:
 * - 積込場所記録
 * - 積載量記録
 * - 品目記録
 * - GPS位置記録
 */
router.post('/:id/loading', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.addLoadingRecord);

/**
 * @swagger
 * /trips/{id}/unloading:
 *   post:
 *     summary: 積降記録追加（D6機能）
 *     description: |
 *       運行中の積降作業を記録
 *
 *       **D6機能対応:** モバイルアプリの「積降場所到着」ボタンクリック時に使用
 *
 *       **実装機能:**
 *       - 積降場所記録
 *       - 積降量記録
 *       - 品目記録
 *       - GPS位置記録（直接指定または位置IDから取得）
 *       - 到着時刻自動記録
 *
 *       **リクエストパラメータ:**
 *       - `locationId`: 必須 - 場所ID
 *       - `latitude`, `longitude`: 🆕 必須 - GPS座標（直接指定）
 *       - `accuracy`: オプション - GPS精度（メートル）
 *       - `arrivalTime`: オプション - 到着時刻（省略時は現在時刻）
 *       - `itemId`, `quantity`, `notes`: 既存のオプションフィールド
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 🗺️ 運行管理 (Trip Management)
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
 *               - locationId
 *               - latitude
 *               - longitude
 *             properties:
 *               locationId:
 *                 type: string
 *                 format: uuid
 *                 description: 積降場所ID
 *               latitude:
 *                 type: number
 *                 format: double
 *                 minimum: -90
 *                 maximum: 90
 *                 description: 🆕 GPS緯度（D6機能）
 *               longitude:
 *                 type: number
 *                 format: double
 *                 minimum: -180
 *                 maximum: 180
 *                 description: 🆕 GPS経度（D6機能）
 *               accuracy:
 *                 type: number
 *                 description: 🆕 GPS精度（メートル）
 *               arrivalTime:
 *                 type: string
 *                 format: date-time
 *                 description: 🆕 到着時刻（省略時は現在時刻）
 *               itemId:
 *                 type: string
 *                 description: 品目ID
 *               quantity:
 *                 type: number
 *                 description: 積降量
 *               notes:
 *                 type: string
 *                 description: メモ
 *     responses:
 *       201:
 *         description: 積降記録追加成功
 *       400:
 *         description: バリデーションエラー（GPS座標必須）
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 運行記録または場所が見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * 積下記録追加
 * POST /trips/:id/unloading
 *
 * 実装機能:
 * - 積下場所記録
 * - 積下量記録
 * - 品目記録
 * - GPS位置記録
 */
router.post('/:id/unloading', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.addUnloadingRecord);

/**
 * @swagger
 * /trips/current:
 *   get:
 *     summary: 現在の運行取得
 *     description: |
 *       ログインユーザーの進行中運行を取得
 *
 *       **実装機能:**
 *       - ログインユーザーの進行中運行取得
 *       - 運転手用機能
 *
 *       **権限:** DRIVER, MANAGER, ADMIN
 *     tags:
 *       - 🗺️ 運行管理 (Trip Management)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 現在の運行取得成功
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 進行中の運行が見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * 現在の運行取得
 * GET /trips/current
 *
 * 実装機能:
 * - ログインユーザーの進行中運行取得
 * - 運転手用機能
 */
router.get('/current', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.getCurrentTrip);

/**
 * @swagger
 * /trips/api/stats:
 *   get:
 *     summary: 運行統計取得
 *     description: |
 *       運行に関する統計情報を取得
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
 *       - 🗺️ 運行管理 (Trip Management)
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
/**
 * 運行統計取得
 * GET /trips/api/stats
 *
 * 実装機能:
 * - 総運行数
 * - ステータス別集計
 * - 期間別集計
 * - 車両別集計
 * - 運転手別集計
 * - 距離・燃費統計
 */
router.get('/api/stats', requireManagerOrAdmin, tripController.getTripStatistics);

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
 *       - 🗺️ 運行管理 (Trip Management)
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
/**
 * 運行削除
 * DELETE /trips/:id
 *
 * 実装機能:
 * - 論理削除
 * - 関連データ処理
 * - 管理者権限必須
 */
router.delete('/:id', requireAdmin, tripController.deleteTrip);

// =====================================
// エクスポート
// =====================================

export default router;

// =====================================
// 🆕🆕🆕 Swagger UI重複解消完了（2025年12月2日）
// =====================================

/**
 * 【Swagger UI重複解消: タグ統一完了】
 *
 * ✅ 修正内容:
 * - 全14エンドポイントのSwaggerタグを「🗺️ 運行管理 (Trip Management)」に統一
 * - 以下の重複タグを削除:
 *   - 🚚 運行記録CRUD → 統合
 *   - 🗑️ 運行削除操作 → 統合
 *   - 🛰️ 運行GPS追跡 → 統合
 *   - ⛽ 運行燃料記録 → 統合
 *   - 📦 運行積込積降記録 → 統合
 *   - 📈 運行統計分析 → 統合
 *
 * ✅ 全14エンドポイント:
 * 1. GET    /trips               - 運行一覧取得
 * 2. GET    /trips/:id           - 運行詳細取得
 * 3. POST   /trips               - 運行開始
 * 4. POST   /trips/start         - 運行開始（エイリアス）
 * 5. PUT    /trips/:id           - 運行更新
 * 6. POST   /trips/:id/end       - 運行終了
 * 7. POST   /trips/:id/location  - GPS位置更新
 * 8. GET    /trips/:id/gps-history - GPS履歴取得
 * 9. POST   /trips/:id/fuel      - 燃料記録追加
 * 10. POST  /trips/:id/loading   - 🆕 積込記録追加（D5機能）
 * 11. POST  /trips/:id/unloading - 🆕 積降記録追加（D6機能）
 * 12. GET   /trips/current       - 現在の運行取得
 * 13. GET   /trips/api/stats     - 運行統計取得
 * 14. DELETE /trips/:id          - 運行削除
 *
 * 🎯 D5/D6機能の特徴（既存から変更なし）:
 * - GPS座標の直接指定（latitude/longitude）をサポート
 * - 既存のgpsLocationオブジェクトも下位互換性維持
 * - arrivalTimeフィールドで到着時刻を自動記録
 * - 近隣地点検知APIとの連携を想定
 * - 詳細なエラーレスポンス定義
 *
 * 📱 SwaggerUIでの表示:
 * - 🗺️ 運行管理 (Trip Management) セクションに全14エンドポイントが集約
 * - 重複表示の解消
 * - 統一されたドキュメント構造
 *
 * 🔧 既存コードへの影響:
 * - なし（Swaggerアノテーションのタグのみ変更）
 * - 既存の全コメント・コード・機能完全保持（100%）
 * - 冒頭の「重要な設計決定の理由」コメント完全保持
 * - 各エンドポイントの「実装機能」コメント完全保持
 * - D5/D6機能の詳細説明完全保持
 */
