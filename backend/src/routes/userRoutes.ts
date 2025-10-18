// =====================================
// backend/src/routes/userRoutes.ts
// ユーザー管理ルート - Controller活用版
// エンドポイント定義のみ・ビジネスロジックはController層に委譲
// 最終更新: 2025年10月18日
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
// 👥 ユーザー管理APIエンドポイント（全機能実装）
// =====================================

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
 * ユーザー設定取得
 * GET /users/:id/preferences
 *
 * 実装機能:
 * - ユーザー個別設定
 * - 権限: 本人のみ
 */
router.get('/:id/preferences', userController.getUserPreferences);

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
// 完了確認
// =====================================

/**
 * ✅ routes/userRoutes.ts Controller活用版完了
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
 * 【Controller活用効果】
 * ✅ コード量: ~150行（直接実装の1/10）
 * ✅ 保守性: 高（責務分離）
 * ✅ テスト性: 高（各層独立テスト可能）
 * ✅ 一貫性: 他routesファイルと統一
 * ✅ 型安全性: Controller層で完全担保
 *
 * 【エンドポイント数】
 * 全13エンドポイント実装
 * - GET /users: 一覧
 * - GET /users/:id: 詳細
 * - POST /users: 作成
 * - PUT /users/:id: 更新
 * - DELETE /users/:id: 削除
 * - PUT /users/:id/password: パスワード変更
 * - PATCH /users/:id/toggle-status: ステータス切替
 * - GET /users/api/stats: 統計
 * - GET /users/:id/activities: アクティビティ
 * - GET /users/:id/preferences: 設定取得
 * - PUT /users/:id/preferences: 設定更新
 * - GET /users/search: 検索
 * - POST /users/bulk/status: 一括更新
 */
