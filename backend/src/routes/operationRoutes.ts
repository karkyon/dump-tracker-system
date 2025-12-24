// =====================================
// backend/src/routes/operationRoutes.ts
// 運行管理ルート - Router層責務徹底版 + Swagger UI完全対応
// tripRoutes/userRoutes/vehicleRoutesパターン完全準拠
// 最終更新: 2025-12-24 - Swagger UI完全追加
// 依存関係: controllers/operationController.ts, middleware/auth.ts
// =====================================

/**
 * 【設計方針】
 *
 * routes層の責務: エンドポイント定義のみ
 * - ルーティング設定
 * - 認証・認可ミドルウェアの適用
 * - Controllerメソッドへの委譲
 * - Swagger UIドキュメント完備
 *
 * ❌ Router層で実装してはいけないこと:
 * - ビジネスロジック
 * - データベース操作
 * - バリデーション（Controllerで実施）
 * - 統計情報の管理
 * - フォールバック処理
 * - エラーハンドリング（Controllerで実施）
 *
 * ✅ tripRoutes.ts, userRoutes.ts, vehicleRoutes.ts と同じパターン
 */

import { Router } from 'express';

// 🎯 Phase 1完了基盤の活用
import {
  authenticateToken,
  requireAdmin,
  requireManager
} from '../middleware/auth';
import {
  validateId,
  validatePaginationQuery
} from '../middleware/validation';
import logger from '../utils/logger';

// 🎯 Controllerの統合活用（全機能実装済み）
import { OperationController } from '../controllers/operationController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const operationController = new OperationController();

// =====================================
// 全ルートで認証必須
// =====================================

router.use(authenticateToken());

// =====================================
// 🚗 運行管理APIエンドポイント（全機能実装・Swagger対応）
// =====================================

/**
 * @swagger
 * /operations:
 *   get:
 *     summary: 運行一覧取得
 *     description: |
 *       運行記録の一覧を取得します。以下の機能に対応:
 *       - ページネーション（page, limit）
 *       - ステータスフィルタ（PLANNING, IN_PROGRESS, COMPLETED, CANCELLED）
 *       - 車両IDフィルタ
 *       - 期間フィルタ（startDate, endDate）
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: ページ番号
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: 1ページあたりの件数
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PLANNING, IN_PROGRESS, COMPLETED, CANCELLED]
 *         description: 運行ステータスでフィルタ
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: 車両IDでフィルタ
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 開始日でフィルタ（YYYY-MM-DD）
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 終了日でフィルタ（YYYY-MM-DD）
 *     responses:
 *       200:
 *         description: 運行一覧取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 運行一覧を取得しました
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           operationNumber:
 *                             type: string
 *                           vehicleId:
 *                             type: string
 *                           driverId:
 *                             type: string
 *                           status:
 *                             type: string
 *                           actualStartTime:
 *                             type: string
 *                             format: date-time
 *                           vehicle:
 *                             type: object
 *                           driver:
 *                             type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: 認証エラー
 *       500:
 *         description: サーバーエラー
 */
router.get('/', validatePaginationQuery, operationController.getAllOperations);

/**
 * @swagger
 * /operations/{id}:
 *   get:
 *     summary: 運行詳細取得
 *     description: |
 *       指定されたIDの運行詳細情報を取得します。以下を含みます:
 *       - 運行基本情報
 *       - 車両情報（リレーション）
 *       - ドライバー情報（リレーション）
 *       - 運行詳細（operationDetails）
 *       - GPS履歴（gpsLogs、最新100件）
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行ID
 *     responses:
 *       200:
 *         description: 運行詳細取得成功
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
 *                     operationNumber:
 *                       type: string
 *                     vehicles:
 *                       type: object
 *                     usersOperationsDriverIdTousers:
 *                       type: object
 *                     operationDetails:
 *                       type: array
 *                     gpsLogs:
 *                       type: array
 *       404:
 *         description: 運行が見つかりません
 *       401:
 *         description: 認証エラー
 */
router.get('/:id', validateId, operationController.getOperationById);

/**
 * @swagger
 * /operations/start:
 *   post:
 *     summary: 運行開始
 *     description: |
 *       新規運行を開始します（管理者・マネージャーのみ）。以下を実施:
 *       - 運行番号自動生成（OPYYYYYMMDD-XXXX形式）
 *       - 車両・ドライバー存在確認
 *       - ステータスをIN_PROGRESSに設定
 *       - actualStartTime自動記録
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
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
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 description: 車両ID
 *               driverId:
 *                 type: string
 *                 description: 運転手ID（未指定時は実行ユーザー）
 *               startLocation:
 *                 type: string
 *                 description: 出発地（任意）
 *           example:
 *             vehicleId: "vehicle-123"
 *             driverId: "user-456"
 *             startLocation: "東京営業所"
 *     responses:
 *       201:
 *         description: 運行開始成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 車両またはドライバーが見つかりません
 */
router.post('/start', requireManager, operationController.startOperation);

/**
 * @swagger
 * /operations/end:
 *   post:
 *     summary: 運行終了
 *     description: |
 *       実行中の運行を終了します（管理者・マネージャーのみ）。以下を実施:
 *       - ステータスをCOMPLETEDに更新
 *       - actualEndTime自動記録
 *       - 走行距離計算（endOdometer - startOdometer）
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
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
 *             properties:
 *               operationId:
 *                 type: string
 *                 description: 運行ID
 *               endOdometer:
 *                 type: number
 *                 description: 終了時走行距離計（km）
 *               endLocation:
 *                 type: string
 *                 description: 到着地（任意）
 *           example:
 *             operationId: "op-123"
 *             endOdometer: 15234.5
 *             endLocation: "大阪営業所"
 *     responses:
 *       200:
 *         description: 運行終了成功
 *       404:
 *         description: 運行が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.post('/end', requireManager, operationController.endOperation);

/**
 * @swagger
 * /operations/status/{vehicleId}:
 *   get:
 *     summary: 車両別運行ステータス取得
 *     description: |
 *       指定された車両の現在の運行ステータスを取得します。以下を返却:
 *       - currentOperation: 最新の運行情報
 *       - status: IN_PROGRESS または IDLE
 *       - lastOperationEndTime: 最終運行終了時刻
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 車両ID
 *     responses:
 *       200:
 *         description: ステータス取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicleId:
 *                   type: string
 *                 currentOperation:
 *                   type: object
 *                 status:
 *                   type: string
 *                   enum: [IN_PROGRESS, IDLE]
 *                 lastOperationEndTime:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 認証エラー
 */
router.get('/status/:vehicleId', validateId, operationController.getOperationStatus);

/**
 * @swagger
 * /operations/active:
 *   get:
 *     summary: アクティブな運行一覧取得
 *     description: |
 *       現在実行中（IN_PROGRESS）の全運行を取得します（管理者・マネージャーのみ）。
 *       リアルタイム監視ダッシュボードで使用します。
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: アクティブ運行取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.get('/active', requireManager, operationController.getActiveOperations);

/**
 * @swagger
 * /operations/efficiency:
 *   get:
 *     summary: 運行効率分析
 *     description: |
 *       運行効率の分析データを取得します（管理者・マネージャーのみ）。以下を算出:
 *       - averageDuration: 平均運行時間
 *       - totalDistance: 総走行距離
 *       - utilizationRate: 稼働率（完了/全体）
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 分析開始日
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 分析終了日
 *     responses:
 *       200:
 *         description: 効率分析取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageDuration:
 *                   type: number
 *                 totalDistance:
 *                   type: number
 *                 utilizationRate:
 *                   type: number
 *                 period:
 *                   type: object
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.get('/efficiency', requireManager, operationController.getOperationEfficiency);

/**
 * @swagger
 * /operations/stats:
 *   get:
 *     summary: 運行統計
 *     description: |
 *       運行統計情報を取得します（管理者のみ）。以下を取得:
 *       - totalOperations: 総運行数
 *       - activeOperations: 実行中運行数
 *       - completedOperations: 完了運行数
 *       - cancelledOperations: キャンセル運行数
 *       - averageDuration: 平均運行時間
 *       - totalDistance: 総走行距離
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 統計取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalOperations:
 *                   type: integer
 *                 activeOperations:
 *                   type: integer
 *                 completedOperations:
 *                   type: integer
 *                 cancelledOperations:
 *                   type: integer
 *                 averageDuration:
 *                   type: number
 *                 totalDistance:
 *                   type: number
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.get('/stats', requireAdmin, operationController.getOperationStats);

/**
 * @swagger
 * /operations:
 *   post:
 *     summary: 運行作成
 *     description: |
 *       新規運行レコードを作成します（管理者・マネージャーのみ）。
 *       運行開始と同じ処理を実行します。
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
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
 *             properties:
 *               vehicleId:
 *                 type: string
 *               driverId:
 *                 type: string
 *               plannedStartTime:
 *                 type: string
 *                 format: date-time
 *               plannedEndTime:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: 運行作成成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.post('/', requireManager, operationController.createOperation);

/**
 * @swagger
 * /operations/{id}:
 *   put:
 *     summary: 運行更新
 *     description: 既存運行を更新します（管理者・マネージャーのみ）
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
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
 *             properties:
 *               status:
 *                 type: string
 *               plannedStartTime:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: 運行更新成功
 *       404:
 *         description: 運行が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.put('/:id', requireManager, validateId, operationController.updateOperation);

/**
 * @swagger
 * /operations/{id}:
 *   delete:
 *     summary: 運行削除
 *     description: 運行レコードを削除します（管理者のみ）
 *     tags:
 *       - 🗺️ 運行管理 (Operations Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行ID
 *     responses:
 *       200:
 *         description: 運行削除成功
 *       404:
 *         description: 運行が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.delete('/:id', requireAdmin, validateId, operationController.deleteOperation);

// =====================================
// ルート登録完了ログ
// =====================================

logger.info('✅ 運行管理ルート登録完了 - Swagger UI完全対応', {
  totalEndpoints: 11,
  pattern: 'tripRoutes.tsパターン準拠',
  routerResponsibility: 'エンドポイント定義のみ',
  swaggerDocumented: 11,
  timestamp: new Date().toISOString()
});

export default router;

// =====================================
// ✅ routes/operationRoutes.ts Swagger UI完全対応 完了確認
// =====================================

/**
 * 【Swagger対応完了】
 * ✅ 全11エンドポイントにSwaggerドキュメント追加
 * ✅ パラメータ定義完備（query, path, body）
 * ✅ レスポンススキーマ定義
 * ✅ 認証・権限要件明記
 * ✅ エラーレスポンス定義
 * ✅ リクエスト例（example）追加
 * ✅ 詳細説明（description）完備
 * ✅ inspectionRoutes.tsパターン準拠
 *
 * 【既存機能100%保持】
 * ✅ 全コード保持（一切削除なし）
 * ✅ 全コメント保持
 * ✅ ミドルウェア: 全て保持
 * ✅ エンドポイント: 全11個保持
 * ✅ 権限制御: 全て保持
 * ✅ バリデーション: 全て保持
 *
 * 【実装エンドポイント一覧】
 * 1. GET /operations - 運行一覧取得
 * 2. GET /operations/:id - 運行詳細取得
 * 3. POST /operations/start - 運行開始
 * 4. POST /operations/end - 運行終了
 * 5. GET /operations/status/:vehicleId - 車両別ステータス
 * 6. GET /operations/active - アクティブ運行一覧
 * 7. GET /operations/efficiency - 運行効率分析
 * 8. GET /operations/stats - 運行統計
 * 9. POST /operations - 運行作成
 * 10. PUT /operations/:id - 運行更新
 * 11. DELETE /operations/:id - 運行削除
 */
