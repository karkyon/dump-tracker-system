// =====================================
// backend/src/routes/operationDetailRoutes.ts
// 運行詳細管理ルート - Controller委譲版 + Swagger UI完全対応
// Router層責務に徹した実装(userRoutes/vehicleRoutesパターン)
// 最終更新: 2025-12-24 - Swagger UI完全追加
// 依存関係: controllers/operationDetailController.ts, middleware/auth.ts
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
 * ビジネスロジック・バリデーション・DB操作は全てController/Service層に委譲
 * userRoutes.ts, vehicleRoutes.ts等と同じパターンを採用
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
import { OperationDetailController } from '../controllers/operationDetailController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const operationDetailController = new OperationDetailController();

// =====================================
// 全ルートで認証必須
// =====================================

router.use(authenticateToken());

// =====================================
// 🚚 運行詳細管理APIエンドポイント（全機能実装・Swagger対応）
// =====================================

/**
 * @swagger
 * /operation-details:
 *   get:
 *     summary: 運行詳細一覧取得
 *     description: |
 *       運行詳細の一覧を取得します。以下の機能に対応:
 *       - ページネーション
 *       - 運行ID、作業種別、期間、位置ID、品目IDでフィルタ
 *       - シーケンス順ソート
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 1ページあたりの件数
 *       - in: query
 *         name: operationId
 *         schema:
 *           type: string
 *         description: 運行IDでフィルタ
 *       - in: query
 *         name: activityType
 *         schema:
 *           type: string
 *         description: 作業種別でフィルタ
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 開始日でフィルタ
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 終了日でフィルタ
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: string
 *         description: 位置IDでフィルタ
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *         description: 品目IDでフィルタ
 *     responses:
 *       200:
 *         description: 運行詳細一覧取得成功
 *       401:
 *         description: 認証エラー
 */
router.get('/', validatePaginationQuery, operationDetailController.getAllOperationDetails);

/**
 * @swagger
 * /operation-details/{id}:
 *   get:
 *     summary: 運行詳細詳細取得
 *     description: |
 *       指定されたIDの運行詳細情報を取得します。以下を含みます:
 *       - 運行詳細基本情報
 *       - 関連運行情報（operations）
 *       - 関連位置情報（locations）
 *       - 関連品目情報（items）
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行詳細ID
 *     responses:
 *       200:
 *         description: 運行詳細取得成功
 *       404:
 *         description: 運行詳細が見つかりません
 *       401:
 *         description: 認証エラー
 */
router.get('/:id', validateId, operationDetailController.getOperationDetailById);

/**
 * @swagger
 * /operation-details:
 *   post:
 *     summary: 運行詳細作成
 *     description: |
 *       新規運行詳細を作成します（管理者・マネージャーのみ）。以下を実施:
 *       - 運行ID、位置ID、品目IDの存在確認
 *       - シーケンス番号の自動採番
 *       - 作業種別の検証
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
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
 *               - activityType
 *               - locationId
 *               - itemId
 *             properties:
 *               operationId:
 *                 type: string
 *                 description: 運行ID
 *               sequenceNumber:
 *                 type: integer
 *                 description: シーケンス番号（自動採番される場合は省略可）
 *               activityType:
 *                 type: string
 *                 description: 作業種別（LOADING, UNLOADING等）
 *               locationId:
 *                 type: string
 *                 description: 位置ID
 *               itemId:
 *                 type: string
 *                 description: 品目ID
 *               plannedTime:
 *                 type: string
 *                 format: date-time
 *                 description: 予定時刻
 *               quantityTons:
 *                 type: number
 *                 description: 数量（トン）
 *               notes:
 *                 type: string
 *                 description: 備考
 *           example:
 *             operationId: "op-123"
 *             activityType: "LOADING"
 *             locationId: "loc-456"
 *             itemId: "item-789"
 *             quantityTons: 10.5
 *     responses:
 *       201:
 *         description: 運行詳細作成成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.post('/', requireManager, operationDetailController.createOperationDetail);

/**
 * @swagger
 * /operation-details/{id}:
 *   put:
 *     summary: 運行詳細更新
 *     description: |
 *       既存運行詳細を更新します（管理者・マネージャーのみ）。以下を実施:
 *       - 運行詳細データ更新
 *       - 作業時間記録（actualStartTime, actualEndTime）
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行詳細ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sequenceNumber:
 *                 type: integer
 *               activityType:
 *                 type: string
 *               locationId:
 *                 type: string
 *               itemId:
 *                 type: string
 *               plannedTime:
 *                 type: string
 *                 format: date-time
 *               actualStartTime:
 *                 type: string
 *                 format: date-time
 *               actualEndTime:
 *                 type: string
 *                 format: date-time
 *               quantityTons:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: 運行詳細更新成功
 *       404:
 *         description: 運行詳細が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.put('/:id', requireManager, validateId, operationDetailController.updateOperationDetail);

/**
 * @swagger
 * /operation-details/{id}:
 *   delete:
 *     summary: 運行詳細削除
 *     description: |
 *       運行詳細を削除します（管理者のみ）。
 *       物理削除を実行します。
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行詳細ID
 *     responses:
 *       200:
 *         description: 運行詳細削除成功
 *       404:
 *         description: 運行詳細が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.delete('/:id', requireAdmin, validateId, operationDetailController.deleteOperationDetail);

/**
 * @swagger
 * /operation-details/by-operation/{operationId}:
 *   get:
 *     summary: 運行別詳細一覧取得
 *     description: |
 *       特定運行の全詳細を取得します。以下を実施:
 *       - シーケンス番号順にソート
 *       - 関連位置・品目情報を含む
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: operationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 運行ID
 *     responses:
 *       200:
 *         description: 運行別詳細取得成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 */
router.get('/by-operation/:operationId', operationDetailController.getOperationDetailsByOperation);

/**
 * @swagger
 * /operation-details/efficiency-analysis:
 *   get:
 *     summary: 作業効率分析
 *     description: |
 *       作業効率の分析を取得します（管理者・マネージャーのみ）。以下を算出:
 *       - 作業種別別効率（完了率、平均時間）
 *       - 時間帯別分析
 *       - 遅延分析
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
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
 *                 totalOperations:
 *                   type: integer
 *                 completedOperations:
 *                   type: integer
 *                 byActivityType:
 *                   type: object
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.get('/efficiency-analysis', requireManager, operationDetailController.getEfficiencyAnalysis);

/**
 * @swagger
 * /operation-details/bulk-operation:
 *   post:
 *     summary: 一括作業操作
 *     description: |
 *       複数の運行詳細を一括操作します（管理者・マネージャーのみ）。
 *       対応アクション: complete（完了）, cancel（キャンセル）
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operationIds
 *               - action
 *             properties:
 *               operationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 運行詳細IDの配列
 *               action:
 *                 type: string
 *                 enum: [complete, cancel]
 *                 description: 実行アクション
 *           example:
 *             operationIds: ["detail-1", "detail-2", "detail-3"]
 *             action: "complete"
 *     responses:
 *       200:
 *         description: 一括操作成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: array
 *                   items:
 *                     type: string
 *                 failed:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.post('/bulk-operation', requireManager, operationDetailController.bulkOperation);

/**
 * @swagger
 * /operation-details/stats:
 *   get:
 *     summary: 運行詳細統計
 *     description: |
 *       運行詳細の統計情報を取得します（管理者のみ）。以下を取得:
 *       - total: 総件数
 *       - completed: 完了件数
 *       - inProgress: 実行中件数
 *       - completionRate: 完了率
 *     tags:
 *       - 🗺️ 運行詳細管理 (Operation Details Management)
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
 *                 total:
 *                   type: integer
 *                 completed:
 *                   type: integer
 *                 inProgress:
 *                   type: integer
 *                 completionRate:
 *                   type: number
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.get('/stats', requireAdmin, operationDetailController.getStats);

// =====================================
// ルート登録完了ログ
// =====================================

logger.info('✅ 運行詳細管理ルート登録完了 - Swagger UI完全対応版', {
  totalEndpoints: 9,
  swaggerDocumented: 9,
  integrationStatus: 'controllers/operationDetailController.ts - Full Integration',
  middleware: 'auth + validation + Swagger integrated',
  timestamp: new Date().toISOString()
});

export default router;

// =====================================
// ✅ Swagger UI完全対応 完了確認
// =====================================

/**
 * ✅ routes/operationDetailRoutes.ts - Swagger UI完全対応版
 *
 * 【Swagger対応完了】
 * ✅ 全9エンドポイントにSwaggerドキュメント追加
 * ✅ パラメータ定義完備（query, path, body）
 * ✅ レスポンススキーマ定義
 * ✅ 認証・権限要件明記
 * ✅ エラーレスポンス定義
 * ✅ リクエスト例（example）追加
 * ✅ inspectionRoutes.tsパターン準拠
 *
 * 【既存機能100%保持】
 * ✅ 全コード保持（一切削除なし）
 * ✅ 全コメント保持
 * ✅ ミドルウェア: 全て保持
 * ✅ エンドポイント: 全9個保持
 * ✅ 権限制御: 全て保持
 * ✅ バリデーション: 全て保持
 *
 * 【実装エンドポイント一覧】
 * 1. GET /operation-details - 運行詳細一覧取得
 * 2. GET /operation-details/:id - 運行詳細詳細取得
 * 3. POST /operation-details - 運行詳細作成
 * 4. PUT /operation-details/:id - 運行詳細更新
 * 5. DELETE /operation-details/:id - 運行詳細削除
 * 6. GET /operation-details/by-operation/:operationId - 運行別詳細一覧
 * 7. GET /operation-details/efficiency-analysis - 作業効率分析
 * 8. POST /operation-details/bulk-operation - 一括作業操作
 * 9. GET /operation-details/stats - 運行詳細統計
 */
