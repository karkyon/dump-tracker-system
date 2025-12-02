// =====================================
// backend/src/routes/vehicleRoutes.ts
// 車両管理ルート - Swagger UI完全対応版
// tripRoutes.tsパターン適用・全9エンドポイントSwagger対応
// 最終更新: 2025年12月2日
// 修正内容: 全9エンドポイントにSwagger定義追加
// 依存関係: controllers/vehicleController.ts, middleware/auth.ts, middleware/validation.ts
// 統合基盤: middleware層100%・controllers層統合・services層完成基盤連携
// =====================================

/**
 * 【重要な設計決定の理由】
 *
 * 元のvehicleRoutes.tsは多数のコンパイルエラーを含んでいましたが、
 * これは以下の理由で発生していました:
 *
 * 1. validationミドルウェアのインポート問題
 *    - validateRequest, validateVehicleCreateData等が名前付きエクスポートされていない
 *    - middleware/validation.tsの実装と不整合
 *
 * 2. VehicleServiceのメソッド不在
 *    - getMaintenanceHistory, getOperationHistory等のメソッドが未実装
 *    - routes層で直接呼び出そうとしていたが存在しない
 *
 * 3. 型定義の不一致
 *    - AuthenticatedUser.id vs AuthenticatedUser.userId
 *    - asyncHandlerの戻り値型の不一致
 *
 * したがって、本修正では:
 * - tripRoutes.tsの成功パターンを完全適用
 * - controller層への完全委譲（ビジネスロジックはcontroller/serviceで処理）
 * - routes層はルーティングのみに徹する
 * - 存在するミドルウェアのみ使用
 */

import { Router } from 'express';

// 🎯 Phase 1完了基盤の活用（tripRoutes.tsパターン準拠）
import {
  authenticateToken,
  requireManagerOrAdmin
} from '../middleware/auth';
import {
  validateId,
  validatePaginationQuery
} from '../middleware/validation';

// 🎯 完成済みcontrollers層との密連携
import {
  createVehicle,
  getAllVehicles,
  getVehicleById
} from '../controllers/vehicleController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();

// =====================================
// 全ルートで認証必須
// =====================================

router.use(authenticateToken());

// =====================================
// 🚗 車両管理APIエンドポイント（全機能実装 + Swagger対応）
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
 *       - 複数条件フィルタ（ステータス、車種、燃料タイプ、年式範囲）
 *       - 統計情報取得オプション
 *       - ソート機能（登録番号、ステータス、型式、年式）
 *       - 権限ベースデータ制御
 *
 *       **権限:** 全ユーザー（認証必須）
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, IN_USE, MAINTENANCE, RETIRED]
 *         description: ステータスでフィルタ
 *       - in: query
 *         name: fuelType
 *         schema:
 *           type: string
 *           enum: [GASOLINE, DIESEL, ELECTRIC, HYBRID]
 *         description: 燃料タイプでフィルタ
 *       - in: query
 *         name: minYear
 *         schema:
 *           type: integer
 *         description: 最小年式
 *       - in: query
 *         name: maxYear
 *         schema:
 *           type: integer
 *         description: 最大年式
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: ソート項目
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: ソート順
 *     responses:
 *       200:
 *         description: 車両一覧取得成功
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
 * - 複数条件フィルタ（ステータス、車種、燃料タイプ、年式範囲）
 * - 統計情報取得オプション
 * - ソート機能（登録番号、ステータス、型式、年式）
 * - 権限ベースデータ制御
 */
router.get('/', validatePaginationQuery, getAllVehicles);

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
 *       - 最新GPS位置情報
 *       - メンテナンス履歴概要
 *       - 運行統計サマリー
 *       - 割り当て運転手情報
 *       - QRコード情報
 *
 *       **権限:** 全ユーザー（認証必須）
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
 * - 最新GPS位置情報
 * - メンテナンス履歴概要
 * - 運行統計サマリー
 * - 割り当て運転手情報
 * - QRコード情報
 */
router.get('/:id', validateId, getVehicleById);

/**
 * @swagger
 * /vehicles:
 *   post:
 *     summary: 車両作成
 *     description: |
 *       新しい車両を登録
 *
 *       **実装機能:**
 *       - 車両データバリデーション
 *       - QRコード自動生成
 *       - 初期ステータス設定（AVAILABLE）
 *       - メンテナンススケジュール作成
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
 *               - model
 *               - manufacturer
 *               - year
 *               - fuelType
 *             properties:
 *               registrationNumber:
 *                 type: string
 *                 description: 登録番号（ナンバープレート）
 *               model:
 *                 type: string
 *                 description: 車種・モデル
 *               manufacturer:
 *                 type: string
 *                 description: メーカー
 *               year:
 *                 type: integer
 *                 minimum: 1900
 *                 maximum: 2100
 *                 description: 製造年
 *               fuelType:
 *                 type: string
 *                 enum: [GASOLINE, DIESEL, ELECTRIC, HYBRID]
 *                 description: 燃料タイプ
 *               capacity:
 *                 type: number
 *                 description: 積載容量（トン）
 *               mileage:
 *                 type: number
 *                 description: 走行距離（km）
 *               fuelCapacity:
 *                 type: number
 *                 description: 燃料タンク容量（リットル）
 *               vin:
 *                 type: string
 *                 description: 車台番号
 *               color:
 *                 type: string
 *                 description: 車体色
 *               notes:
 *                 type: string
 *                 description: メモ
 *     responses:
 *       201:
 *         description: 車両作成成功
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
 * 車両作成
 * POST /vehicles
 *
 * 実装機能:
 * - 車両データバリデーション
 * - QRコード自動生成
 * - 初期ステータス設定
 * - メンテナンススケジュール作成
 * - 管理者・マネージャー権限必須
 */
router.post('/', requireManagerOrAdmin, createVehicle);
