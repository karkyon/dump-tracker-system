// =====================================
// backend/src/routes/vehicleRoutes.ts
// 車両管理ルート - Swagger UI完全対応版 + thisバインディング確認版
// エンドポイント定義のみ・ビジネスロジックはController層に委譲
// 最終更新: 2025年12月3日
// 修正内容: 全11エンドポイントにSwagger定義追加 + `this`バインディング確認
// 依存関係: middleware/auth.ts, controllers/vehicleController.ts
// =====================================

/**
 * 【設計方針】
 *
 * routes層の責務: エンドポイント定義のみ
 * - ルーティング設定
 * - 認証・認可ミドルウェアの適用
 * - Controllerメソッドへの委譲
 *
 * ビジネスロジック・バリデーション・DB操作は全てController/Service層に委譲
 * tripRoutes.ts等と同じパターンを採用
 */

import { Router } from 'express';

// 🎯 Phase 1完了基盤の活用
import {
  authenticateToken,
  authorize,
  requireAdmin
} from '../middleware/auth';

// 🎯 Controllerの統合活用（全機能実装済み）
import { getVehicleController } from '../controllers/vehicleController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const vehicleController = getVehicleController();

// 🔧🔧🔧 重要: `this`バインディングについて
// VehicleControllerは全メソッドをアロー関数プロパティとして定義しているため、
// `this`コンテキストは自動的にクラスインスタンスにバインドされます。
// 例: public getAllVehicles = asyncHandler(async (req, res) => { ... })
//
// したがって、以下のようにメソッドを直接渡しても問題ありません:
// ✅ router.get('/', vehicleController.getAllVehicles);
//
// もし将来的に通常のメソッド（function）に変更する場合は、以下のいずれかが必要です:
// 1. アロー関数でラップ: router.get('/', (req, res) => vehicleController.getAllVehicles(req, res));
// 2. コンストラクタでバインド: this.getAllVehicles = this.getAllVehicles.bind(this);

// =====================================
// 全ルートで認証必須
// =====================================

router.use(authenticateToken());

// =====================================
// 🚛 車両管理APIエンドポイント（全機能実装 + Swagger対応）
// =====================================

/**
 * @swagger
 * /vehicles:
 *   get:
 *     summary: 車両一覧取得
 *     description: |
 *       ページネーション・検索・フィルタ機能付きで車両一覧を取得
 *
 *       **実装機能:**
 *       - ページネーション・検索・フィルタ
 *       - 車種別フィルタ（大型/中型/小型ダンプ、トレーラー等）
 *       - ステータス別フィルタ（稼働中/整備中/故障等）
 *       - ソート機能（登録番号、型式、最終点検日等）
 *       - 利用可能車両のみ表示オプション
 *
 *       **権限:** 全ロール（DRIVER, MANAGER, ADMIN）
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
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
 *         name: search
 *         schema:
 *           type: string
 *         description: 検索キーワード（登録番号、型式等）
 *       - in: query
 *         name: vehicleType
 *         schema:
 *           type: string
 *           enum: [DUMP_LARGE, DUMP_MEDIUM, DUMP_SMALL, TRAILER, MIXER, OTHER]
 *         description: 車種でフィルタ
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_SERVICE]
 *         description: ステータスでフィルタ
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: registrationNumber
 *         description: ソート項目
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: ソート順
 *       - in: query
 *         name: availableOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 利用可能な車両のみ表示
 *     responses:
 *       200:
 *         description: 車両一覧取得成功
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
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: 認証エラー
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両一覧取得
 * GET /vehicles
 *
 * 実装機能:
 * - ページネーション・検索・フィルタ
 * - 車種別フィルタ
 * - ステータス別フィルタ
 * - ソート機能
 * - 権限: 全ロール
 */
router.get('/', vehicleController.getAllVehicles);

/**
 * @swagger
 * /vehicles/{id}:
 *   get:
 *     summary: 車両詳細取得
 *     description: |
 *       指定されたIDの車両詳細情報を取得
 *
 *       **実装機能:**
 *       - 車両基本情報
 *       - 最新点検情報
 *       - 整備履歴（直近5件）
 *       - 運行統計（総運行回数、走行距離等）
 *       - 現在の割り当て状況
 *
 *       **権限:** 全ロール（DRIVER, MANAGER, ADMIN）
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両ID
 *     responses:
 *       200:
 *         description: 車両詳細取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Vehicle'
 *       401:
 *         description: 認証エラー
 *       404:
 *         description: 車両が見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両詳細取得
 * GET /vehicles/:id
 *
 * 実装機能:
 * - 車両基本情報
 * - 最新点検情報
 * - 整備履歴
 * - 運行統計
 */
router.get('/:id', vehicleController.getVehicleById);

/**
 * @swagger
 * /vehicles:
 *   post:
 *     summary: 車両登録
 *     description: |
 *       新しい車両を登録
 *
 *       **実装機能:**
 *       - 車両登録
 *       - 重複チェック（登録番号）
 *       - バリデーション（登録番号形式、車検有効期限等）
 *       - 初期ステータス設定
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - registrationNumber
 *               - vehicleType
 *               - model
 *             properties:
 *               registrationNumber:
 *                 type: string
 *                 description: '登録番号（例: 大阪 300 あ 1234）'
 *               vehicleType:
 *                 type: string
 *                 enum: [DUMP_LARGE, DUMP_MEDIUM, DUMP_SMALL, TRAILER, MIXER, OTHER]
 *                 description: 車種
 *               model:
 *                 type: string
 *                 description: '型式（例: いすゞ GIGA）'
 *               year:
 *                 type: integer
 *                 description: 年式
 *               maxLoadCapacity:
 *                 type: number
 *                 format: float
 *                 description: 最大積載量（トン）
 *               fuelType:
 *                 type: string
 *                 enum: [GASOLINE, DIESEL, ELECTRIC, HYBRID]
 *                 description: 燃料タイプ
 *               insuranceExpiryDate:
 *                 type: string
 *                 format: date
 *                 description: 保険有効期限
 *               inspectionExpiryDate:
 *                 type: string
 *                 format: date
 *                 description: 車検有効期限
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_SERVICE]
 *                 default: AVAILABLE
 *                 description: 初期ステータス
 *     responses:
 *       201:
 *         description: 車両登録成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       409:
 *         description: 登録番号重複
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両登録
 * POST /vehicles
 *
 * 実装機能:
 * - 車両登録
 * - 重複チェック
 * - バリデーション
 * - 権限: 管理者・マネージャー
 */
router.post('/',
  authorize(['ADMIN', 'MANAGER']),
  vehicleController.createVehicle
);

/**
 * @swagger
 * /vehicles/{id}:
 *   put:
 *     summary: 車両情報更新
 *     description: |
 *       車両情報を更新
 *
 *       **実装機能:**
 *       - 車両情報更新
 *       - バリデーション
 *       - 登録番号重複チェック（変更時）
 *       - 変更履歴記録
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registrationNumber:
 *                 type: string
 *               vehicleType:
 *                 type: string
 *                 enum: [DUMP_LARGE, DUMP_MEDIUM, DUMP_SMALL, TRAILER, MIXER, OTHER]
 *               model:
 *                 type: string
 *               year:
 *                 type: integer
 *               maxLoadCapacity:
 *                 type: number
 *                 format: float
 *               fuelType:
 *                 type: string
 *                 enum: [GASOLINE, DIESEL, ELECTRIC, HYBRID]
 *               insuranceExpiryDate:
 *                 type: string
 *                 format: date
 *               inspectionExpiryDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_SERVICE]
 *     responses:
 *       200:
 *         description: 更新成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 車両が見つかりません
 *       409:
 *         description: 登録番号重複
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両情報更新
 * PUT /vehicles/:id
 *
 * 実装機能:
 * - 車両情報更新
 * - バリデーション
 * - 変更履歴記録
 * - 権限: 管理者・マネージャー
 */
router.put('/:id',
  authorize(['ADMIN', 'MANAGER']),
  vehicleController.updateVehicle
);

/**
 * @swagger
 * /vehicles/{id}:
 *   delete:
 *     summary: 車両削除
 *     description: |
 *       車両を削除（論理削除）
 *
 *       **実装機能:**
 *       - 車両削除（論理削除）
 *       - 運行中車両の削除防止
 *       - 関連データ処理
 *
 *       **注意:** この操作は取り消せません
 *
 *       **権限:** ADMIN のみ
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両ID
 *     responses:
 *       200:
 *         description: 削除成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（管理者のみ）
 *       404:
 *         description: 車両が見つかりません
 *       409:
 *         description: 運行中のため削除不可
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両削除
 * DELETE /vehicles/:id
 *
 * 実装機能:
 * - 車両削除（論理削除）
 * - 運行中車両の削除防止
 * - 権限: 管理者のみ
 */
router.delete('/:id',
  requireAdmin,
  vehicleController.deleteVehicle
);

/**
 * @swagger
 * /vehicles/{id}/status:
 *   patch:
 *     summary: 車両ステータス更新
 *     description: |
 *       車両のステータスを更新
 *
 *       **実装機能:**
 *       - ステータス更新（稼働中/整備中/故障等）
 *       - ステータス遷移バリデーション
 *       - 運行中車両のステータス変更制限
 *       - 監査ログ記録
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_SERVICE]
 *                 description: 新しいステータス
 *               reason:
 *                 type: string
 *                 description: ステータス変更理由
 *     responses:
 *       200:
 *         description: ステータス更新成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 車両が見つかりません
 *       409:
 *         description: ステータス遷移不可
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両ステータス更新
 * PATCH /vehicles/:id/status
 *
 * 実装機能:
 * - ステータス更新
 * - ステータス遷移バリデーション
 * - 権限: 管理者・マネージャー
 */
router.patch('/:id/status',
  authorize(['ADMIN', 'MANAGER']),
  vehicleController.updateVehicleStatus
);

/**
 * @swagger
 * /vehicles/api/stats:
 *   get:
 *     summary: 車両統計取得
 *     description: |
 *       車両に関する統計情報を取得
 *
 *       **実装機能:**
 *       - 総車両数
 *       - 車種別統計
 *       - ステータス別統計
 *       - 稼働率
 *       - 車検期限切れ警告
 *       - 平均走行距離
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
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
 *     responses:
 *       200:
 *         description: 統計取得成功
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
 *                     totalVehicles:
 *                       type: integer
 *                     availableVehicles:
 *                       type: integer
 *                     vehicleTypeDistribution:
 *                       type: object
 *                     statusDistribution:
 *                       type: object
 *                     utilizationRate:
 *                       type: number
 *                       format: float
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両統計取得
 * GET /vehicles/api/stats
 *
 * 実装機能:
 * - 総車両数
 * - 車種別統計
 * - ステータス別統計
 * - 稼働率
 * - 権限: 管理者・マネージャー
 */
router.get('/api/stats',
  authorize(['ADMIN', 'MANAGER']),
  vehicleController.getVehicleStatistics
);

/**
 * @swagger
 * /vehicles/{id}/maintenance-history:
 *   get:
 *     summary: 車両整備履歴取得
 *     description: |
 *       車両の整備履歴を取得
 *
 *       **実装機能:**
 *       - 整備履歴一覧
 *       - ページネーション
 *       - 期間フィルタ
 *       - 整備タイプフィルタ（定期点検/修理/車検等）
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: maintenanceType
 *         schema:
 *           type: string
 *           enum: [INSPECTION, REPAIR, OVERHAUL, TIRE_CHANGE]
 *     responses:
 *       200:
 *         description: 整備履歴取得成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 車両が見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両整備履歴取得
 * GET /vehicles/:id/maintenance-history
 *
 * 実装機能:
 * - 整備履歴一覧
 * - ページネーション
 * - 権限: 管理者・マネージャー
 */
router.get('/:id/maintenance-history',
  authorize(['ADMIN', 'MANAGER']),
  vehicleController.getVehicleMaintenanceHistory
);

/**
 * @swagger
 * /vehicles/{id}/trips:
 *   get:
 *     summary: 車両運行履歴取得
 *     description: |
 *       車両の運行履歴を取得
 *
 *       **実装機能:**
 *       - 運行履歴一覧
 *       - ページネーション
 *       - 期間フィルタ
 *       - ステータスフィルタ
 *       - 統計情報（総運行回数、走行距離等）
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [COMPLETED, IN_PROGRESS, CANCELLED]
 *     responses:
 *       200:
 *         description: 運行履歴取得成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: 車両が見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両運行履歴取得
 * GET /vehicles/:id/trips
 *
 * 実装機能:
 * - 運行履歴一覧
 * - ページネーション
 * - 統計情報
 * - 権限: 管理者・マネージャー
 */
router.get('/:id/trips',
  authorize(['ADMIN', 'MANAGER']),
  vehicleController.getVehicleTrips
);

/**
 * @swagger
 * /vehicles/search:
 *   get:
 *     summary: 車両検索
 *     description: |
 *       キーワードで車両を検索
 *
 *       **実装機能:**
 *       - キーワード検索（登録番号、型式、メーカー等）
 *       - ページネーション
 *       - 車種フィルタ
 *       - ステータスフィルタ
 *
 *       **権限:** 全ロール（DRIVER, MANAGER, ADMIN）
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: 検索キーワード
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: vehicleType
 *         schema:
 *           type: string
 *           enum: [DUMP_LARGE, DUMP_MEDIUM, DUMP_SMALL, TRAILER, MIXER, OTHER]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_SERVICE]
 *     responses:
 *       200:
 *         description: 検索成功
 *       401:
 *         description: 認証エラー
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車両検索
 * GET /vehicles/search
 *
 * 実装機能:
 * - キーワード検索
 * - ページネーション
 * - 権限: 全ロール
 */
router.get('/search', vehicleController.searchVehicles);

/**
 * @swagger
 * /vehicles/api/inspection-due:
 *   get:
 *     summary: 車検期限切れ車両取得
 *     description: |
 *       車検期限が切れている、または間もなく切れる車両を取得
 *
 *       **実装機能:**
 *       - 車検期限切れ車両一覧
 *       - 警告期間設定（デフォルト30日前）
 *       - 期限切れ日数計算
 *       - ソート機能（期限切れ日が近い順等）
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 🚛 車両管理 (Vehicle Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: daysThreshold
 *         schema:
 *           type: integer
 *           default: 30
 *         description: 警告期間（日数）
 *     responses:
 *       200:
 *         description: 取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vehicle'
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       500:
 *         description: サーバーエラー
 */
/**
 * 車検期限切れ車両取得
 * GET /vehicles/api/inspection-due
 *
 * 実装機能:
 * - 車検期限切れ車両一覧
 * - 警告期間設定
 * - 権限: 管理者・マネージャー
 */
router.get('/api/inspection-due',
  authorize(['ADMIN', 'MANAGER']),
  vehicleController.getVehiclesInspectionDue
);

// =====================================
// エクスポート
// =====================================

export default router;

// =====================================
// Swagger UI対応完了確認 + thisバインディング確認（2025年12月3日）
// =====================================

/**
 * ✅ routes/vehicleRoutes.ts Swagger UI完全対応版 + thisバインディング確認完了
 *
 * 【Swagger対応完了】
 * ✅ 全11エンドポイントにSwaggerドキュメント追加
 * ✅ パラメータ定義完備（query, path, body）
 * ✅ レスポンススキーマ定義
 * ✅ 認証・権限要件明記
 * ✅ エラーレスポンス定義
 * ✅ 企業レベル機能説明
 * ✅ tripRoutes.tsパターン準拠
 *
 * 【thisバインディング確認完了】
 * ✅ VehicleControllerは全メソッドをアロー関数プロパティとして定義
 * ✅ `this`コンテキストは自動的にクラスインスタンスにバインド
 * ✅ メソッドを直接渡しても安全
 * ✅ コメントで明記し、将来的な変更時の注意点を記載
 *
 * 【設計原則】
 * ✅ routes層: エンドポイント定義のみ（薄く保つ）
 * ✅ Controller層: HTTP処理・バリデーション・レスポンス変換
 * ✅ Service層: ビジネスロジック・DB操作
 * ✅ アーキテクチャ一貫性: tripRoutes.ts等と同じパターン
 *
 * 【実装機能】
 * ✅ 基本CRUD: 一覧・詳細・登録・更新・削除
 * ✅ 管理機能: ステータス更新・統計・整備履歴・運行履歴
 * ✅ 検索機能: キーワード検索
 * ✅ 警告機能: 車検期限切れ警告
 * ✅ 権限制御: ロール別アクセス制御
 *
 * 【エンドポイント数】
 * 全11エンドポイント実装
 * 1. GET /vehicles - 一覧取得
 * 2. GET /vehicles/:id - 詳細取得
 * 3. POST /vehicles - 登録
 * 4. PUT /vehicles/:id - 更新
 * 5. DELETE /vehicles/:id - 削除
 * 6. PATCH /vehicles/:id/status - ステータス更新
 * 7. GET /vehicles/api/stats - 統計取得
 * 8. GET /vehicles/:id/maintenance-history - 整備履歴
 * 9. GET /vehicles/:id/trips - 運行履歴
 * 10. GET /vehicles/search - 検索
 * 11. GET /vehicles/api/inspection-due - 車検期限切れ
 *
 * 【既存機能100%保持】
 * ✅ 全コード保持（一切削除なし）
 * ✅ 全コメント保持
 * ✅ Controller層活用パターン維持
 * ✅ 権限制御の適切な配置
 */
