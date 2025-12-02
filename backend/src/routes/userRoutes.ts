// =====================================
// backend/src/routes/userRoutes.ts
// ユーザー管理ルート - Swagger UI完全対応版
// エンドポイント定義のみ・ビジネスロジックはController層に委譲
// 最終更新: 2025年12月2日
// 修正内容: 全13エンドポイントにSwagger定義追加
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
 */

import { Router } from 'express';

// 🎯 Phase 1完了基盤の活用
import {
  authenticateToken,
  authorize,
  requireAdmin
} from '../middleware/auth';

// 🎯 Controllerの統合活用（全機能実装済み）
import { getUserController } from '../controllers/userController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const userController = getUserController();

// =====================================
// 全ルートで認証必須
// =====================================

router.use(authenticateToken());

// =====================================
// 👥 ユーザー管理APIエンドポイント（全機能実装 + Swagger対応）
// =====================================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: ユーザー一覧取得
 *     description: |
 *       ページネーション・検索・フィルタ機能付きでユーザー一覧を取得
 *
 *       **実装機能:**
 *       - ページネーション・検索・フィルタ
 *       - ロール別フィルタ（DRIVER, MANAGER, ADMIN）
 *       - ステータス別フィルタ（アクティブ/非アクティブ）
 *       - ソート機能（名前、作成日、最終ログイン等）
 *       - 権限ベースデータ制御
 *
 *       **権限:** MANAGER, ADMIN
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
 *         description: 検索キーワード（名前、メール等）
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [DRIVER, MANAGER, ADMIN]
 *         description: ロールでフィルタ
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: アクティブ状態でフィルタ
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
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
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
  authorize(['ADMIN', 'MANAGER']),
  userController.getAllUsers
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
router.get('/:id', userController.getUserById);

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
 *                 description: ユーザー名
 *               email:
 *                 type: string
 *                 format: email
 *                 description: メールアドレス
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: パスワード（8文字以上）
 *               role:
 *                 type: string
 *                 enum: [DRIVER, MANAGER, ADMIN]
 *                 description: ロール
 *               phone:
 *                 type: string
 *                 description: 電話番号
 *               licenseNumber:
 *                 type: string
 *                 description: 運転免許証番号
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: アクティブ状態
 *     responses:
 *       201:
 *         description: ユーザー作成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       409:
 *         description: メールアドレス重複
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
  authorize(['ADMIN', 'MANAGER']),
  userController.createUser
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: ユーザー更新
 *     description: |
 *       ユーザー情報を更新
 *
 *       **実装機能:**
 *       - ユーザー情報更新
 *       - 権限チェック（自分または管理者）
 *       - 特権フィールド保護（ロール変更は管理者のみ）
 *       - メールアドレス重複チェック
 *
 *       **権限:** 本人（基本情報のみ）, ADMIN（全フィールド）
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
 *                 minLength: 3
 *                 maxLength: 50
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               licenseNumber:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [DRIVER, MANAGER, ADMIN]
 *                 description: ロール（管理者のみ変更可能）
 *               isActive:
 *                 type: boolean
 *                 description: アクティブ状態（管理者のみ変更可能）
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
 *         description: ユーザーが見つかりません
 *       409:
 *         description: メールアドレス重複
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
 * - 特権フィールド保護（管理者のみ）
 */
router.put('/:id', userController.updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: ユーザー削除
 *     description: |
 *       ユーザーを削除（論理削除）
 *
 *       **実装機能:**
 *       - ユーザー削除（論理削除）
 *       - 自己削除防止
 *       - 関連データ処理
 *
 *       **注意:** この操作は取り消せません
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
 *         description: 削除成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（管理者のみ）
 *       404:
 *         description: ユーザーが見つかりません
 *       409:
 *         description: 自己削除エラー
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー削除
 * DELETE /users/:id
 *
 * 実装機能:
 * - ユーザー削除
 * - 自己削除防止
 * - 権限: 管理者のみ
 */
router.delete('/:id',
  requireAdmin,
  userController.deleteUser
);

/**
 * @swagger
 * /users/{id}/password:
 *   put:
 *     summary: パスワード変更
 *     description: |
 *       ユーザーのパスワードを変更
 *
 *       **実装機能:**
 *       - 現在のパスワード検証
 *       - 新パスワードバリデーション（8文字以上）
 *       - パスワードハッシュ化
 *       - セッション無効化（再ログイン必要）
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
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: 現在のパスワード
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: 新しいパスワード（8文字以上）
 *     responses:
 *       200:
 *         description: パスワード変更成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 現在のパスワードが間違っています
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: サーバーエラー
 */
/**
 * パスワード変更
 * PUT /users/:id/password
 *
 * 実装機能:
 * - 現在のパスワード検証
 * - 新パスワードバリデーション
 * - パスワードハッシュ化
 */
router.put('/:id/password', userController.changePassword);

/**
 * @swagger
 * /users/{id}/toggle-status:
 *   patch:
 *     summary: ユーザーステータス切替
 *     description: |
 *       ユーザーのアクティブ/非アクティブ状態を切り替え
 *
 *       **実装機能:**
 *       - アクティブ/非アクティブ切替
 *       - 非アクティブ化時のセッション無効化
 *       - 監査ログ記録
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
 *         description: ステータス変更成功
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
 * ユーザーステータス切替
 * PATCH /users/:id/toggle-status
 *
 * 実装機能:
 * - アクティブ/非アクティブ切替
 * - 権限: 管理者・マネージャー
 */
router.patch('/:id/toggle-status',
  authorize(['ADMIN', 'MANAGER']),
  userController.toggleUserStatus
);

/**
 * @swagger
 * /users/api/stats:
 *   get:
 *     summary: ユーザー統計取得
 *     description: |
 *       ユーザーに関する統計情報を取得
 *
 *       **実装機能:**
 *       - 総ユーザー数
 *       - ロール別統計（運転手/マネージャー/管理者数）
 *       - アクティブ率
 *       - 最近のログイン統計
 *       - 期間別登録ユーザー数
 *
 *       **権限:** ADMIN のみ
 *     tags:
 *       - 👥 ユーザー管理 (User Management)
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
 *                     totalUsers:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                     roleDistribution:
 *                       type: object
 *                       properties:
 *                         DRIVER:
 *                           type: integer
 *                         MANAGER:
 *                           type: integer
 *                         ADMIN:
 *                           type: integer
 *                     recentLogins:
 *                       type: integer
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー（管理者のみ）
 *       500:
 *         description: サーバーエラー
 */
/**
 * ユーザー統計取得
 * GET /users/api/stats
 *
 * 実装機能:
 * - 総ユーザー数
 * - ロール別統計
 * - アクティブ率
 * - 最近のログイン統計
 * - 権限: 管理者
 */
router.get('/api/stats',
  requireAdmin,
  userController.getUserStatistics
);

/**
 * @swagger
 * /users/{id}/activities:
 *   get:
 *     summary: ユーザーアクティビティ取得
 *     description: |
 *       ユーザーの活動履歴を取得
 *
 *       **実装機能:**
 *       - アクティビティ履歴（ログイン、運行記録等）
 *       - ページネーション
 *       - 期間フィルタ
 *       - アクティビティタイプフィルタ
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
 *         name: activityType
 *         schema:
 *           type: string
 *           enum: [LOGIN, TRIP_START, TRIP_END, INSPECTION]
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
 * - ページネーション
 * - 権限チェック（自分または管理者）
 */
router.get('/:id/activities', userController.getUserActivities);

/**
 * @swagger
 * /users/{id}/preferences:
 *   get:
 *     summary: ユーザー設定取得
 *     description: |
 *       ユーザーの個別設定を取得
 *
 *       **実装機能:**
 *       - ユーザー個別設定（通知設定、表示設定等）
 *       - デフォルト値の提供
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
 * - ユーザー個別設定
 * - 権限: 本人のみ
 */
router.get('/:id/preferences', userController.getUserPreferences);

/**
 * @swagger
 * /users/{id}/preferences:
 *   put:
 *     summary: ユーザー設定更新
 *     description: |
 *       ユーザーの個別設定を更新
 *
 *       **実装機能:**
 *       - ユーザー個別設定更新
 *       - バリデーション
 *       - デフォルト値の適用
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
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
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
router.put('/:id/preferences', userController.updateUserPreferences);

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
  authorize(['ADMIN', 'MANAGER']),
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
 *                     successful:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     failures:
 *                       type: array
 *                       items:
 *                         type: object
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
 * - 複数ユーザーのステータス一括更新
 * - 権限: 管理者
 */
router.post('/bulk/status',
  requireAdmin,
  userController.bulkUpdateUserStatus
);

// =====================================
// エクスポート
// =====================================

export default router;

// =====================================
// Swagger UI対応完了確認（2025年12月2日）
// =====================================

/**
 * ✅ routes/userRoutes.ts Swagger UI完全対応版完了
 *
 * 【Swagger対応完了】
 * ✅ 全13エンドポイントにSwaggerドキュメント追加
 * ✅ パラメータ定義完備（query, path, body）
 * ✅ レスポンススキーマ定義
 * ✅ 認証・権限要件明記
 * ✅ エラーレスポンス定義
 * ✅ 企業レベル機能説明
 * ✅ tripRoutes.tsパターン準拠
 *
 * 【設計原則】
 * ✅ routes層: エンドポイント定義のみ（薄く保つ）
 * ✅ Controller層: HTTP処理・バリデーション・レスポンス変換
 * ✅ Service層: ビジネスロジック・DB操作
 * ✅ アーキテクチャ一貫性: tripRoutes.ts等と同じパターン
 *
 * 【実装機能】
 * ✅ 基本CRUD: 一覧・詳細・作成・更新・削除
 * ✅ 認証機能: パスワード変更
 * ✅ 管理機能: ステータス切替・統計・検索・一括更新
 * ✅ ユーザー機能: アクティビティ・設定管理
 * ✅ 権限制御: ロール別アクセス制御
 *
 * 【エンドポイント数】
 * 全13エンドポイント実装
 * 1. GET /users - 一覧取得
 * 2. GET /users/:id - 詳細取得
 * 3. POST /users - 作成
 * 4. PUT /users/:id - 更新
 * 5. DELETE /users/:id - 削除
 * 6. PUT /users/:id/password - パスワード変更
 * 7. PATCH /users/:id/toggle-status - ステータス切替
 * 8. GET /users/api/stats - 統計取得
 * 9. GET /users/:id/activities - アクティビティ取得
 * 10. GET /users/:id/preferences - 設定取得
 * 11. PUT /users/:id/preferences - 設定更新
 * 12. GET /users/search - 検索
 * 13. POST /users/bulk/status - 一括更新
 *
 * 【既存機能100%保持】
 * ✅ 全コード保持（一切削除なし）
 * ✅ 全コメント保持
 * ✅ Controller層活用パターン維持
 * ✅ 権限制御の適切な配置
 */
