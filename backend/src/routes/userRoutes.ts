// =====================================
// backend/src/routes/userRoutes.ts
// ユーザー管理ルート - Swagger UI完全対応版 + inspection パターンデバッグログ追加版
// エンドポイント定義のみ・ビジネスロジックはController層に委譲
// 🔧🔧🔧 inspection パターンルートレベルデバッグログ追加版（既存機能100%保持）
// 🚨🚨🚨 重要修正: ルート定義順序の最適化（/search を / より先に定義）
// 🚨🚨🚨 TypeScriptエラー完全修正版 - user?.使用でundefinedチェック
// 最終更新: 2025年12月14日
// 修正内容: inspectionRoute.tsパターン準拠 - ルート定義順序の最適化 + TypeScript undefined エラー16個修正
// 依存関係: middleware/auth.ts, controllers/userController.ts
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
 *
 * 【重要: ルート定義順序】
 * Expressは上から順にルートをマッチングするため、
 * より具体的なパス（/search, /bulk/status等）を先に定義し、
 * より汎用的なパス（/, /:id等）を後に定義する必要があります。
 */

import { Router } from 'express';

// 🎯 Phase 1完了基盤の活用
import {
  authenticateToken,
  authorize,
  requireAdmin
} from '../middleware/auth';

import logger from '../utils/logger';

// 🎯 Controllerの統合活用（全機能実装済み）
import { getUserController } from '../controllers/userController';

// 🎯 types/からの統一型定義インポート
import type { AuthenticatedRequest } from '../types/auth';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const userController = getUserController();

// 🔧🔧🔧 デバッグ出力追加: ルーター初期化確認
logger.info('🔧🔧🔧 [DEBUG-UserRoutes] ルーター初期化開始', {
  timestamp: new Date().toISOString(),
  file: 'backend/src/routes/userRoutes.ts'
});

// 🔧🔧🔧 重要: `this`バインディングについて
// UserControllerは全メソッドをアロー関数プロパティとして定義しているため、
// `this`コンテキストは自動的にクラスインスタンスにバインドされます。
// 例: public getAllUsers = asyncHandler(async (req, res) => { ... })
//
// したがって、以下のようにメソッドを直接渡しても問題ありません:
// ✅ router.get('/', userController.getAllUsers);
//
// もし将来的に通常のメソッド（function）に変更する場合は、以下のいずれかが必要です:
// 1. アロー関数でラップ: router.get('/', (req, res) => userController.getAllUsers(req, res));
// 2. bind使用: router.get('/', userController.getAllUsers.bind(userController));

// 🔧🔧🔧 デバッグ出力追加: 全リクエストをログ（認証前に配置）
router.use((req, res, next) => {
  logger.info('🔍🔍🔍 [DEBUG-UserRoutes] リクエスト受信（認証前）', {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    baseUrl: req.baseUrl,
    query: req.query,
    params: req.params,
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : 'なし',
      'content-type': req.headers['content-type']
    },
    timestamp: new Date().toISOString()
  });
  next();
});

// 全ルートに認証を適用
router.use(authenticateToken());

// 🔧🔧🔧 デバッグ出力追加: 認証後のログ
router.use((req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  logger.info('🔍🔍🔍 [DEBUG-UserRoutes] 認証完了後', {
    method: req.method,
    url: req.originalUrl,
    user: authReq.user ? {
      userId: authReq.user?.userId,
      role: authReq.user?.role
    } : 'なし',
    timestamp: new Date().toISOString()
  });
  next();
});

// =====================================
// 👥 ユーザー管理APIエンドポイント
// =====================================
// 🚨 重要: より具体的なパスを先に定義
// Expressのルートマッチングは上から順に行われるため、
// /search や /bulk/status などの具体的なパスを先に定義し、
// / や /:id などの汎用的なパスを後に定義する必要があります

/**
 * @swagger
 * /users/search:
 *   get:
 *     summary: ユーザー検索
 *     description: |
 *       キーワードでユーザーを検索
 *
 *       **実装機能:**
 *       - キーワード検索（名前、メール、電話番号等）
 *       - ページネーション
 *       - ロールフィルタ
 *       - ステータスフィルタ
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [DRIVER, MANAGER, ADMIN]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: 検索成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー検索
 * GET /users/search
 *
 * 実装機能:
 * - キーワード検索
 * - ページネーション
 * - 権限: 管理者・マネージャー
 */
router.get('/search',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET /search ルート到達 - authorize前', {
      query: req.query,
      timestamp: new Date().toISOString()
    });
    next();
  },
  authorize(['ADMIN', 'MANAGER']),
  (req, res, next) => {
    // ✅✅✅ 修正: user?.を使用してundefinedチェック
    const authReq = req as AuthenticatedRequest;
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET /search authorize通過 - controller実行直前', {
      user: authReq.user ? {
        userId: authReq.user?.userId,
        role: authReq.user?.role
      } : 'なし',
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.searchUsers
);

/**
 * @swagger
 * /users/bulk/status:
 *   post:
 *     summary: ユーザー一括ステータス更新
 *     description: |
 *       複数ユーザーのステータスを一括更新
 *
 *       **実装機能:**
 *       - 複数ユーザーのステータス一括更新
 *       - トランザクション処理
 *       - エラーハンドリング（一部失敗時の処理）
 *       - 監査ログ記録
 *
 *       **権限:** ADMIN のみ
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *               - isActive
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: ユーザーIDの配列
 *               isActive:
 *                 type: boolean
 *                 description: 設定するステータス
 *     responses:
 *       200:
 *         description: 一括更新成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（管理者のみ）
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー一括ステータス更新
 * POST /users/bulk/status
 *
 * 実装機能:
 * - 一括ステータス更新
 * - 権限: 管理者のみ
 */
router.post('/bulk/status',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] POST /bulk/status ルート到達 - requireAdmin前', {
      body: req.body,
      timestamp: new Date().toISOString()
    });
    next();
  },
  requireAdmin,
  (req, res, next) => {
    // ✅✅✅ 修正: user?.を使用してundefinedチェック
    const authReq = req as AuthenticatedRequest;
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] POST /bulk/status requireAdmin通過 - controller実行直前', {
      user: authReq.user ? {
        userId: authReq.user?.userId,
        role: authReq.user?.role
      } : 'なし',
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.bulkUpdateUserStatus
);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: ユーザー一覧取得
 *     description: |
 *       フィルタリング・ページネーション対応のユーザー一覧を取得
 *
 *       **実装機能:**
 *       - ページネーション・検索・フィルタ
 *       - ロール別フィルタ
 *       - ステータス別フィルタ
 *       - ソート機能
 *       - 権限: 管理者・マネージャー
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
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
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [DRIVER, MANAGER, ADMIN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 検索キーワード（名前、メール等）
 *     responses:
 *       200:
 *         description: ユーザー一覧取得成功
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
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
 *       403:
 *         description: 権限エラー
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー一覧取得
 * GET /users
 *
 * 実装機能:
 * - ページネーション・検索・フィルタ
 * - ロール別フィルタ
 * - ステータス別フィルタ
 * - ソート機能
 * - 権限: 管理者・マネージャー
 */
router.get('/',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET / ルート到達 - authorize前', {
      query: req.query,
      timestamp: new Date().toISOString()
    });
    next();
  },
  authorize(['ADMIN', 'MANAGER']),
  (req, res, next) => {
    // ✅✅✅ 修正: user?.を使用してundefinedチェック
    const authReq = req as AuthenticatedRequest;
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET / authorize通過 - controller実行直前', {
      user: authReq.user ? {
        userId: authReq.user?.userId,
        role: authReq.user?.role
      } : 'なし',
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.getAllUsers
);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: ユーザー作成
 *     description: |
 *       新しいユーザーを作成
 *
 *       **実装機能:**
 *       - ユーザー登録
 *       - パスワードハッシュ化
 *       - 重複チェック（メールアドレス）
 *       - ロール割り当て
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [DRIVER, MANAGER, ADMIN]
 *     responses:
 *       201:
 *         description: ユーザー作成成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       409:
 *         description: メールアドレスが既に使用されています
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー作成
 * POST /users
 *
 * 実装機能:
 * - ユーザー登録
 * - パスワードハッシュ化
 * - 重複チェック
 * - 権限: 管理者・マネージャー
 */
router.post('/',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] POST / ルート到達 - authorize前', {
      body: { ...req.body, password: '***' },
      timestamp: new Date().toISOString()
    });
    next();
  },
  authorize(['ADMIN', 'MANAGER']),
  (req, res, next) => {
    // ✅✅✅ 修正: user?.を使用してundefinedチェック
    const authReq = req as AuthenticatedRequest;
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] POST / authorize通過 - controller実行直前', {
      user: authReq.user ? {
        userId: authReq.user?.userId,
        role: authReq.user?.role
      } : 'なし',
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.createUser
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: ユーザー詳細取得
 *     description: |
 *       指定されたIDのユーザー詳細情報を取得
 *
 *       **実装機能:**
 *       - ユーザー基本情報
 *       - 権限チェック（自分または管理者・マネージャー）
 *       - 関連運行情報（権限に応じて）
 *       - 統計情報（運行実績等）
 *
 *       **権限:** 本人, MANAGER, ADMIN
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
 *     responses:
 *       200:
 *         description: ユーザー詳細取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー詳細取得
 * GET /users/:id
 *
 * 実装機能:
 * - ユーザー基本情報
 * - 権限チェック（自分または管理者・マネージャー）
 * - 関連運行情報（権限に応じて）
 */
router.get('/:id',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET /:id ルート到達', {
      params: req.params,
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.getUserById
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: ユーザー更新
 *     description: |
 *       既存ユーザー情報を更新
 *
 *       **実装機能:**
 *       - ユーザー情報更新
 *       - 権限チェック（自分または管理者）
 *       - メールアドレス重複チェック
 *       - 更新履歴記録
 *
 *       **権限:** 本人, ADMIN
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [DRIVER, MANAGER, ADMIN]
 *     responses:
 *       200:
 *         description: ユーザー更新成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー更新
 * PUT /users/:id
 *
 * 実装機能:
 * - ユーザー情報更新
 * - 権限チェック（自分または管理者）
 */
router.put('/:id',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] PUT /:id ルート到達', {
      params: req.params,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.updateUser
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: ユーザー削除
 *     description: |
 *       ユーザーを削除（論理削除）
 *
 *       **実装機能:**
 *       - 論理削除（isActive = false）
 *       - 管理者権限制御
 *       - 関連データ保持
 *       - 削除履歴記録
 *
 *       **権限:** ADMIN のみ
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
 *     responses:
 *       200:
 *         description: ユーザー削除成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（管理者のみ）
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー削除
 * DELETE /users/:id
 *
 * 実装機能:
 * - 論理削除
 * - 権限: 管理者のみ
 */
router.delete('/:id',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] DELETE /:id ルート到達 - requireAdmin前', {
      params: req.params,
      timestamp: new Date().toISOString()
    });
    next();
  },
  requireAdmin,
  (req, res, next) => {
    // ✅✅✅ 修正: user?.を使用してundefinedチェック
    const authReq = req as AuthenticatedRequest;
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] DELETE /:id requireAdmin通過 - controller実行直前', {
      user: authReq.user ? {
        userId: authReq.user?.userId,
        role: authReq.user?.role
      } : 'なし',
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.deleteUser
);

/**
 * @swagger
 * /users/{id}/change-password:
 *   post:
 *     summary: パスワード変更
 *     description: |
 *       ユーザーのパスワードを変更
 *
 *       **実装機能:**
 *       - 現在のパスワード確認
 *       - 新しいパスワードのバリデーション
 *       - パスワード強度チェック
 *       - パスワードハッシュ化
 *       - パスワード履歴管理（再利用防止）
 *
 *       **権限:** 本人, ADMIN
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: パスワード変更成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー / 現在のパスワードが正しくありません
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * パスワード変更
 * POST /users/:id/change-password
 *
 * 実装機能:
 * - パスワード変更
 * - 権限: 本人または管理者
 */
router.post('/:id/change-password',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] POST /:id/change-password ルート到達', {
      params: req.params,
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.changePassword
);

/**
 * @swagger
 * /users/{id}/toggle-status:
 *   patch:
 *     summary: ユーザーステータス切替
 *     description: |
 *       ユーザーのアクティブ/非アクティブステータスを切り替え
 *
 *       **実装機能:**
 *       - ステータス切替（有効 ⇔ 無効）
 *       - 管理者権限制御
 *       - 自分自身のステータスは変更不可
 *       - ステータス変更履歴記録
 *
 *       **権限:** ADMIN のみ
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
 *     responses:
 *       200:
 *         description: ステータス切替成功
 *       400:
 *         description: 自分自身のステータスは変更できません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（管理者のみ）
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザーステータス切替
 * PATCH /users/:id/toggle-status
 *
 * 実装機能:
 * - ステータス切替
 * - 権限: 管理者のみ
 */
router.patch('/:id/toggle-status',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] PATCH /:id/toggle-status ルート到達 - requireAdmin前', {
      params: req.params,
      timestamp: new Date().toISOString()
    });
    next();
  },
  requireAdmin,
  (req, res, next) => {
    // ✅✅✅ 修正: user?.を使用してundefinedチェック
    const authReq = req as AuthenticatedRequest;
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] PATCH /:id/toggle-status requireAdmin通過 - controller実行直前', {
      user: authReq.user ? {
        userId: authReq.user?.userId,
        role: authReq.user?.role
      } : 'なし',
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.toggleUserStatus
);

/**
 * @swagger
 * /users/{id}/statistics:
 *   get:
 *     summary: ユーザー統計情報取得
 *     description: |
 *       ユーザーの統計情報を取得
 *
 *       **実装機能:**
 *       - 運行実績統計
 *       - アクティビティ統計
 *       - パフォーマンス指標
 *       - 期間別集計
 *
 *       **権限:** MANAGER, ADMIN
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
 *     responses:
 *       200:
 *         description: 統計情報取得成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー統計取得
 * GET /users/:id/statistics
 *
 * 実装機能:
 * - 運行実績統計
 * - 権限: 管理者・マネージャー
 */
router.get('/:id/statistics',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET /:id/statistics ルート到達 - authorize前', {
      params: req.params,
      timestamp: new Date().toISOString()
    });
    next();
  },
  authorize(['ADMIN', 'MANAGER']),
  (req, res, next) => {
    // ✅✅✅ 修正: user?.を使用してundefinedチェック
    const authReq = req as AuthenticatedRequest;
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET /:id/statistics authorize通過 - controller実行直前', {
      user: authReq.user ? {
        userId: authReq.user?.userId,
        role: authReq.user?.role
      } : 'なし',
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.getUserStatistics
);

/**
 * @swagger
 * /users/{id}/activities:
 *   get:
 *     summary: ユーザーアクティビティ取得
 *     description: |
 *       ユーザーのアクティビティ履歴を取得
 *
 *       **実装機能:**
 *       - アクティビティ履歴一覧
 *       - ページネーション
 *       - フィルタリング（日付範囲等）
 *       - 権限に応じたデータ制御
 *
 *       **権限:** 本人, MANAGER, ADMIN
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
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
 *     responses:
 *       200:
 *         description: アクティビティ取得成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザーアクティビティ取得
 * GET /users/:id/activities
 *
 * 実装機能:
 * - アクティビティ履歴
 * - 権限: 本人、管理者、マネージャー
 */
router.get('/:id/activities',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET /:id/activities ルート到達', {
      params: req.params,
      query: req.query,
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.getUserActivities
);

/**
 * @swagger
 * /users/{id}/preferences:
 *   get:
 *     summary: ユーザー設定取得
 *     description: |
 *       ユーザーの個人設定を取得
 *
 *       **実装機能:**
 *       - 表示設定
 *       - 通知設定
 *       - 言語設定
 *       - テーマ設定
 *
 *       **権限:** 本人のみ
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
 *     responses:
 *       200:
 *         description: 設定取得成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（本人のみ）
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー設定取得
 * GET /users/:id/preferences
 *
 * 実装機能:
 * - ユーザー個別設定取得
 * - 権限: 本人のみ
 */
router.get('/:id/preferences',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] GET /:id/preferences ルート到達', {
      params: req.params,
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.getUserPreferences
);

/**
 * @swagger
 * /users/{id}/preferences:
 *   put:
 *     summary: ユーザー設定更新
 *     description: |
 *       ユーザーの個人設定を更新
 *
 *       **実装機能:**
 *       - 表示設定更新
 *       - 通知設定更新
 *       - 言語設定更新
 *       - テーマ設定更新
 *       - バリデーション
 *
 *       **権限:** 本人のみ
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ユーザーID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications:
 *                 type: boolean
 *               theme:
 *                 type: string
 *                 enum: [light, dark, auto]
 *               language:
 *                 type: string
 *                 enum: [ja, en]
 *     responses:
 *       200:
 *         description: 設定更新成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（本人のみ）
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー設定更新
 * PUT /users/:id/preferences
 *
 * 実装機能:
 * - ユーザー個別設定更新
 * - 権限: 本人のみ
 */
router.put('/:id/preferences',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-UserRoutes] PUT /:id/preferences ルート到達', {
      params: req.params,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    next();
  },
  userController.updateUserPreferences
);

// =====================================
// ルート登録完了ログ
// =====================================

logger.info('✅ ユーザー管理ルート登録完了（inspection パターンデバッグログ追加版 + ルート順序最適化版 + TypeScriptエラー修正版）', {
  endpoints: [
    'GET /users/search - 検索',
    'POST /users/bulk/status - 一括更新',
    'GET /users - 一覧取得',
    'POST /users - 作成',
    'GET /users/:id - 詳細取得',
    'PUT /users/:id - 更新',
    'DELETE /users/:id - 削除',
    'POST /users/:id/change-password - パスワード変更',
    'PATCH /users/:id/toggle-status - ステータス切替',
    'GET /users/:id/statistics - 統計取得',
    'GET /users/:id/activities - アクティビティ取得',
    'GET /users/:id/preferences - 設定取得',
    'PUT /users/:id/preferences - 設定更新'
  ],
  totalEndpoints: 13,
  debugMode: true,
  patternSource: 'inspectionRoute.ts',
  routeOrderOptimized: true,
  typeScriptErrorsFixed: true,
  timestamp: new Date().toISOString()
});

export default router;

// =====================================
// ✅ TypeScriptエラー完全修正確認
// =====================================

/**
 * ✅ routes/userRoutes.ts - TypeScriptエラー16個完全修正版
 *
 * 【修正内容】
 * 1. ✅ 16箇所のundefinedエラー修正
 *    - 誤り: (req as AuthenticatedRequest).user.userId // userがundefinedの可能性
 *    - 正解: authReq.user?.userId // オプショナルチェーン使用
 * 2. ✅ ルート定義順序の最適化（404問題の根本解決）
 *    - /search, /bulk/status → / → /:id の順に定義
 * 3. ✅ 認証前デバッグログ追加（inspectionRoute.tsパターン準拠）
 * 4. ✅ 認証後デバッグログ追加（inspectionRoute.tsパターン準拠）
 * 5. ✅ 各エンドポイントにデバッグミドルウェア追加
 * 6. ✅ 既存機能100%保持
 * 7. ✅ 既存コメント100%保持
 * 8. ✅ 全13エンドポイント保持
 * 9. ✅ Swagger定義100%保持
 *
 * 【修正箇所一覧】
 * - 98行目: GET /search デバッグログ内
 * - 99行目: GET /search デバッグログ内
 * - 190行目: POST /bulk/status デバッグログ内
 * - 191行目: POST /bulk/status デバッグログ内
 * - 270行目: GET / デバッグログ内
 * - 271行目: GET / デバッグログ内
 * - 382行目: POST / デバッグログ内
 * - 383行目: POST / デバッグログ内
 * - 474行目: DELETE /:id デバッグログ内
 * - 475行目: DELETE /:id デバッグログ内
 * - 689行目: PATCH /:id/toggle-status デバッグログ内
 * - 690行目: PATCH /:id/toggle-status デバッグログ内
 * - 842行目: GET /:id/statistics デバッグログ内
 * - 843行目: GET /:id/statistics デバッグログ内
 * - 911行目: （この辺りにあるデバッグログ内）
 * - 912行目: （この辺りにあるデバッグログ内）
 *
 * 【既存機能100%保持】
 * ✅ 全13エンドポイント保持
 * ✅ 全Swagger定義保持
 * ✅ 全権限制御保持
 * ✅ 全コメント保持
 */
