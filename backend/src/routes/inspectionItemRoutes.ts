// =====================================
// backend/src/routes/inspectionItemRoutes.ts
// 点検項目管理ルート（マスタデータ）
// 作成日: 2025年12月15日
// 目的: 点検項目（InspectionItem）のCRUD管理
// 概念: マスタデータ - 点検する項目の定義（例：タイヤ空気圧、エンジンオイル量）
// 依存関係: controllers/inspectionController.ts, middleware/auth.ts, middleware/validation.ts
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
  validateId,
  validatePaginationQuery
} from '../middleware/validation';
import logger from '../utils/logger';

// Controller統合
import {
  getAllInspectionItems,
  getInspectionItemById,
  createInspectionItem,
  updateInspectionItem,
  deleteInspectionItem
} from '../controllers/inspectionController';

// 型定義
import type { AuthenticatedRequest } from '../types/auth';

// =====================================
// 🏭 点検項目ルーター初期化
// =====================================

const router = Router();

logger.info('🔧 [InspectionItemRoutes] ルーター初期化開始', {
  timestamp: new Date().toISOString(),
  file: 'backend/src/routes/inspectionItemRoutes.ts',
  description: '点検項目マスタ管理 - マスタデータ専用ルート'
});

// =====================================
// デバッグ出力: 全リクエストをログ（認証前）
// =====================================

router.use((req, res, next) => {
  logger.info('🔍 [InspectionItemRoutes] リクエスト受信（認証前)', {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
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
 *       - 🔧 点検項目管理（マスタ） (Inspection Items Management)
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
 *       - 🔧 点検項目管理（マスタ） (Inspection Items Management)
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
  validateId,
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
 *       - 🔧 点検項目管理（マスタ） (Inspection Items Management)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemName
 *               - inspectionType
 *               - category
 *             properties:
 *               itemName:
 *                 type: string
 *                 description: 点検項目名
 *                 example: "エンジンオイル量"
 *               description:
 *                 type: string
 *                 description: 項目説明
 *                 example: "エンジンオイルレベルゲージで適正範囲内か確認"
 *               inspectionType:
 *                 type: string
 *                 enum: [PRE_TRIP, POST_TRIP, DAILY, WEEKLY, MONTHLY]
 *                 description: 点検種別
 *                 example: "PRE_TRIP"
 *               category:
 *                 type: string
 *                 description: カテゴリ
 *                 example: "ENGINE"
 *               expectedValue:
 *                 type: string
 *                 description: 期待値
 *                 example: "適正範囲内"
 *               displayOrder:
 *                 type: integer
 *                 description: 表示順序
 *                 example: 1
 *               isRequired:
 *                 type: boolean
 *                 description: 必須項目か
 *                 example: true
 *               isActive:
 *                 type: boolean
 *                 description: 有効フラグ
 *                 example: true
 *     responses:
 *       201:
 *         description: 点検項目作成成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（マネージャー以上が必要）
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
 *       - 🔧 点検項目管理（マスタ） (Inspection Items Management)
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
 *               itemName:
 *                 type: string
 *               description:
 *                 type: string
 *               expectedValue:
 *                 type: string
 *               displayOrder:
 *                 type: integer
 *               isRequired:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 点検項目更新成功
 *       404:
 *         description: 点検項目が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.put(
  '/:id',
  validateId,
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
 *       - 🔧 点検項目管理（マスタ） (Inspection Items Management)
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
  validateId,
  requireAdmin,
  deleteInspectionItem
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
  integrationStatus: 'controllers/inspectionController.ts - Full Integration',
  middleware: 'auth + validation integrated',
  dataType: 'マスタデータ（点検項目定義）',
  timestamp: new Date().toISOString()
});

export default router;

// =====================================
// ✅ 統合完了確認
// =====================================

/**
 * ✅ routes/inspectionItemRoutes.ts - 新規作成完了
 *
 * 【作成目的】
 * ✅ 点検項目（InspectionItem）マスタデータ管理の独立
 * ✅ 点検記録（InspectionRecord）トランザクションデータとの明確な分離
 * ✅ 他のルート構造（/vehicles, /users等）との整合性確保
 *
 * 【エンドポイント構造】
 * ✅ /inspection-items - 点検項目マスタ管理（5エンドポイント）
 *   - GET / - 一覧取得
 *   - GET /:id - 詳細取得
 *   - POST / - 作成（マネージャー以上）
 *   - PUT /:id - 更新（マネージャー以上）
 *   - DELETE /:id - 削除（管理者のみ）
 *
 * 【概念整理】
 * ✅ マスタデータ: 点検する項目の定義
 *   - 例: タイヤ空気圧、エンジンオイル量、ブレーキパッド
 *   - 変更頻度: 低い
 *   - 管理者が設定
 *
 * 【Swagger対応完了】
 * ✅ 全5エンドポイントにSwaggerドキュメント追加
 * ✅ パラメータ定義完備
 * ✅ レスポンススキーマ定義
 * ✅ 認証・権限要件明記
 * ✅ マスタデータとしての役割を明記
 *
 * 【他ルートとの整合性】
 * ✅ /vehicles - 車両マスタ
 * ✅ /users - ユーザーマスタ
 * ✅ /items - 品目マスタ
 * ✅ /locations - 場所マスタ
 * ✅ /inspection-items - 点検項目マスタ ← NEW!
 *
 * 【次のステップ】
 * 🎯 inspectionRoutes.ts から点検項目エンドポイント削除
 * 🎯 routes/index.ts に新ルート追加
 */
