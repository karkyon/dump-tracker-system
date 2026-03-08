// =====================================
// backend/src/routes/inspectionItemRoutes.ts
// 点検項目管理ルート（マスタデータ）- Controller分離対応版
// 作成日: 2025年12月15日
// 修正日: 2025年12月16日
// 修正内容:
//   - validateId を削除（UUID検証は controller 内で実施）
//   - import元を inspectionItemController に変更（Controller分離対応）
// 目的: 点検項目（InspectionItem）のCRUD管理
// 概念: マスタデータ - 点検する項目の定義（例：タイヤ空気圧、エンジンオイル量）
// 依存関係: controllers/inspectionItemController.ts, middleware/auth.ts, middleware/validation.ts
// 他ルートとの整合性: /vehicles, /users, /items, /locations と同じ単一リソース構造
// =====================================

import { Router } from 'express';

// Middleware統合
import {
  authenticateToken,
  requireAdmin,
  requireManager
} from '../middleware/auth';
import {
  validatePaginationQuery
} from '../middleware/validation';
import logger from '../utils/logger';

// ✅ 修正: Controller統合（inspectionItemController に変更）
import {
  getAllInspectionItems,
  getInspectionItemById,
  createInspectionItem,
  updateInspectionItem,
  deleteInspectionItem,
  updateOrder
} from '../controllers/inspectionItemController';

// 型定義
import type { AuthenticatedRequest } from '../types/auth';

// =====================================
// 🏭 点検項目ルーター初期化
// =====================================

const router = Router();

logger.info('🔧 [InspectionItemRoutes] ルーター初期化開始', {
  timestamp: new Date().toISOString(),
  file: 'backend/src/routes/inspectionItemRoutes.ts',
  description: '点検項目マスタ管理 - マスタデータ専用ルート',
  controller: 'inspectionItemController.ts (分離版)'
});

// =====================================
// デバッグ出力: 全リクエストをログ（認証前）
// =====================================

router.use((req, res, next) => {
  logger.info('🔍 [InspectionItemRoutes] リクエスト受信（認証前)', {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    params: req.params,
    timestamp: new Date().toISOString()
  });
  next();
});

// 全ルートに認証を適用
router.use(authenticateToken());

// デバッグ出力: 認証後
router.use((req, res, next) => {
  logger.info('🔍 [InspectionItemRoutes] 認証完了後', {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    user: (req as AuthenticatedRequest).user ? {
      userId: (req as AuthenticatedRequest).user?.userId,
      role: (req as AuthenticatedRequest).user?.role
    } : 'なし',
    timestamp: new Date().toISOString()
  });
  next();
});

// =====================================
// 📋 点検項目管理API（マスタデータ）
// =====================================

/**
 * @swagger
 * /inspection-items:
 *   get:
 *     summary: 点検項目一覧取得
 *     description: |
 *       フィルタリング・ソート・ページネーション対応の点検項目一覧を取得
 *
 *       **マスタデータ管理:**
 *       - 点検項目の定義情報を管理
 *       - 例: タイヤ空気圧、エンジンオイル量、ブレーキパッド
 *
 *       **企業レベル機能:**
 *       - フィルタリング（点検種別、カテゴリ、有効/無効）
 *       - ソート（表示順序、カテゴリ、作成日時）
 *       - ページネーション（大量データ対応）
 *       - 権限制御（全ユーザー閲覧可能）
 *     tags:
 *       - 🔧 点検項目管理 (Inspection Items Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: inspectionType
 *         schema:
 *           type: string
 *           enum: [PRE_TRIP, POST_TRIP, DAILY, WEEKLY, MONTHLY]
 *         description: 点検種別でフィルタ
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: カテゴリでフィルタ（ENGINE, BRAKE, TIRE等）
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: 有効な項目のみ取得
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: ページ番号
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 1ページあたりの件数
 *     responses:
 *       200:
 *         description: 点検項目一覧取得成功
 *       401:
 *         description: 認証エラー
 *       500:
 *         description: サーバーエラー
 */
router.get(
  '/',
  (req, res, next) => {
    logger.info('🎯 [InspectionItemRoutes] GET / ルート到達', {
      query: req.query,
      timestamp: new Date().toISOString()
    });
    next();
  },
  validatePaginationQuery,
  getAllInspectionItems
);

/**
 * @swagger
 * /inspection-items/{id}:
 *   get:
 *     summary: 点検項目詳細取得
 *     description: |
 *       指定IDの点検項目の詳細情報を取得
 *
 *       **マスタデータ管理:**
 *       - 個別の点検項目定義情報を取得
 *
 *       **企業レベル機能:**
 *       - 詳細情報表示
 *       - 関連履歴取得
 *       - 使用統計情報
 *     tags:
 *       - 🔧 点検項目管理 (Inspection Items Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 点検項目ID
 *     responses:
 *       200:
 *         description: 点検項目詳細取得成功
 *       404:
 *         description: 点検項目が見つかりません
 *       401:
 *         description: 認証エラー
 */
router.get(
  '/:id',
  (req, res, next) => {
    logger.info('🎯 [InspectionItemRoutes] GET /:id ルート到達', {
      id: req.params.id,
      timestamp: new Date().toISOString()
    });
    next();
  },
  // ✅ 修正: validateId を削除（controller 内で UUID 検証）
  getInspectionItemById
);

/**
 * @swagger
 * /inspection-items:
 *   post:
 *     summary: 点検項目作成
 *     description: |
 *       新規点検項目を作成（マネージャー以上）
 *
 *       **マスタデータ管理:**
 *       - 新しい点検項目定義を追加
 *       - 例: 新しい点検項目「エアコンフィルター」を追加
 *
 *       **企業レベル機能:**
 *       - 管理者権限制御
 *       - 重複チェック
 *       - 表示順管理
 *       - 履歴記録
 *     tags:
 *       - 🔧 点検項目管理 (Inspection Items Management)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - inspectionType
 *             properties:
 *               name:
 *                 type: string
 *                 description: 点検項目名
 *                 example: "ウォッシャー液残量"
 *               description:
 *                 type: string
 *                 description: 項目説明
 *                 example: "ウォッシャー液残量が十分か確認"
 *               inspectionType:
 *                 type: string
 *                 enum: [PRE_TRIP, POST_TRIP, DAILY, WEEKLY, MONTHLY]
 *                 description: 点検種別
 *                 example: "PRE_TRIP"
 *               inputType:
 *                 type: string
 *                 enum: [CHECKBOX, TEXT, NUMBER, SELECT, DATE, PHOTO, SIGNATURE]
 *                 description: 入力タイプ
 *                 default: "CHECKBOX"
 *                 example: "CHECKBOX"
 *               category:
 *                 type: string
 *                 description: カテゴリ
 *                 example: "ENGINE"
 *               displayOrder:
 *                 type: integer
 *                 description: 表示順序
 *                 default: 0
 *                 example: 1
 *               isRequired:
 *                 type: boolean
 *                 description: 必須項目か
 *                 default: true
 *                 example: true
 *               isActive:
 *                 type: boolean
 *                 description: 有効フラグ
 *                 default: true
 *                 example: true
 *               helpText:
 *                 type: string
 *                 description: ヘルプテキスト
 *                 example: "ウォッシャー液残量が十分か確認"
 *               defaultValue:
 *                 type: string
 *                 description: デフォルト値
 *                 example: "適正範囲内"
 *               validationRules:
 *                 type: object
 *                 description: バリデーションルール（JSON）
 *                 example: { "min": 0, "max": 100 }
 *           examples:
 *             basic:
 *               summary: 基本的な点検項目
 *               value:
 *                 name: "ウォッシャー液残量"
 *                 description: "ウォッシャー液残量が十分か確認"
 *                 inspectionType: "PRE_TRIP"
 *                 inputType: "CHECKBOX"
 *                 category: "ENGINE"
 *                 displayOrder: 1
 *                 isRequired: true
 *                 isActive: true
 *                 helpText: "ウォッシャー液残量が十分か確認"
 *             withValidation:
 *               summary: バリデーション付き
 *               value:
 *                 name: "タイヤ空気圧"
 *                 description: "タイヤ空気圧を測定"
 *                 inspectionType: "PRE_TRIP"
 *                 inputType: "NUMBER"
 *                 category: "TIRE"
 *                 displayOrder: 2
 *                 isRequired: true
 *                 isActive: true
 *                 helpText: "規定空気圧: 2.0-2.5 kPa"
 *                 defaultValue: "2.2"
 *                 validationRules: { "min": 2.0, "max": 2.5, "unit": "kPa" }
 *     responses:
 *       201:
 *         description: 点検項目作成成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（マネージャー以上が必要）
 *       409:
 *         description: 重複エラー（同名項目が既に存在）
 */
router.post(
  '/',
  requireManager,
  createInspectionItem
);

/**
 * @swagger
 * /inspection-items/{id}:
 *   put:
 *     summary: 点検項目更新
 *     description: |
 *       既存の点検項目を更新（マネージャー以上）
 *
 *       **マスタデータ管理:**
 *       - 既存の点検項目定義を変更
 *
 *       **企業レベル機能:**
 *       - 管理者権限制御
 *       - 部分更新対応
 *       - 履歴管理
 *       - 変更追跡
 *     tags:
 *       - 🔧 点検項目管理 (Inspection Items Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 点検項目ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 点検項目名
 *               description:
 *                 type: string
 *                 description: 項目説明
 *               inputType:
 *                 type: string
 *                 enum: [CHECKBOX, TEXT, NUMBER, SELECT, DATE, PHOTO, SIGNATURE]
 *                 description: 入力タイプ
 *               displayOrder:
 *                 type: integer
 *                 description: 表示順序
 *               isRequired:
 *                 type: boolean
 *                 description: 必須項目か
 *               isActive:
 *                 type: boolean
 *                 description: 有効フラグ
 *               helpText:
 *                 type: string
 *                 description: ヘルプテキスト
 *               defaultValue:
 *                 type: string
 *                 description: デフォルト値
 *               validationRules:
 *                 type: object
 *                 description: バリデーションルール（JSON）
 *           examples:
 *             minimal:
 *               summary: 最小限の更新
 *               value:
 *                 name: "エンジンオイル量（更新）"
 *             full:
 *               summary: 完全な更新
 *               value:
 *                 name: "エンジンオイル量"
 *                 description: "エンジンオイルの量を確認"
 *                 inputType: "CHECKBOX"
 *                 displayOrder: 1
 *                 isRequired: true
 *                 isActive: true
 *                 helpText: "オイルゲージで確認"
 *                 defaultValue: "適正範囲内"
 *                 validationRules: {}
 *     responses:
 *       200:
 *         description: 点検項目更新成功
 *       400:
 *         description: バリデーションエラー
 *       404:
 *         description: 点検項目が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       409:
 *         description: 重複エラー
 */
router.put(
  '/:id',
  // ✅ 修正: validateId を削除（controller 内で UUID 検証）
  requireManager,
  updateInspectionItem
);

/**
 * @swagger
 * /inspection-items/{id}:
 *   delete:
 *     summary: 点検項目削除
 *     description: |
 *       点検項目を削除（管理者のみ）
 *
 *       **マスタデータ管理:**
 *       - 点検項目定義を削除（論理削除）
 *
 *       **企業レベル機能:**
 *       - 管理者権限制御
 *       - ソフト削除（論理削除）
 *       - 関連データチェック
 *       - 履歴保持
 *     tags:
 *       - 🔧 点検項目管理 (Inspection Items Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 点検項目ID
 *     responses:
 *       200:
 *         description: 点検項目削除成功
 *       404:
 *         description: 点検項目が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（管理者のみ）
 */
router.delete(
  '/:id',
  requireAdmin,
  deleteInspectionItem
);

// 表示順序一括更新
router.post(
  '/update-order',
  requireAdmin,
  updateOrder
);
// =====================================
// 📤 エクスポート・統合完了確認
// =====================================

logger.info('✅ routes/inspectionItemRoutes.ts 初期化完了', {
  totalEndpoints: 5,
  endpointList: [
    'GET / - 点検項目一覧取得',
    'GET /:id - 点検項目詳細取得',
    'POST / - 点検項目作成（マネージャー以上）',
    'PUT /:id - 点検項目更新（マネージャー以上）',
    'DELETE /:id - 点検項目削除（管理者のみ）'
  ],
  integrationStatus: 'controllers/inspectionItemController.ts - Full Integration',
  middleware: 'auth integrated, validateId removed',
  dataType: 'マスタデータ（点検項目定義）',
  timestamp: new Date().toISOString()
});

export default router;

// =====================================
// ✅ Controller分離対応完了確認
// =====================================

/**
 * ✅ routes/inspectionItemRoutes.ts - Controller分離対応完了
 *
 * 【修正内容】
 * ✅ import元を inspectionItemController に変更
 *    - 修正前: from '../controllers/inspectionController'
 *    - 修正後: from '../controllers/inspectionItemController'
 *
 * 【分離完了】
 * ✅ 点検項目（マスタ）専用ルート
 * ✅ 点検項目専用コントローラーと連携
 *
 * 【既存機能100%保持】
 * ✅ すべてのエンドポイント
 * ✅ すべてのミドルウェア
 * ✅ すべてのSwagger定義
 * ✅ すべてのデバッグログ
 * ✅ すべてのコメント・説明
 */
