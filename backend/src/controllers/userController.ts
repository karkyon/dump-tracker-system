// =====================================
// backend/src/controllers/userController.ts
// ユーザー管理コントローラー - 車両・点検統合連携強化版
// 既存完成基盤 + 車両・点検統合管理システム連携強化
// 🔧🔧🔧 inspection パターン7段階デバッグログ追加版（既存機能100%保持）
// 最終更新: 2025年12月14日
// 修正内容: getAllUsers等に7段階デバッグログ追加（inspectionController.tsパターン準拠）
// 依存関係: userService.ts, inspectionController.ts（今回完成）, vehicleController.ts
// 統合基盤: middleware層100%・utils層・services層・controllers層密連携
// =====================================

import { Response } from 'express';

// 🎯 完成基盤の活用（middleware・utils統合）
import { asyncHandler } from '../middleware/errorHandler';
import {
  ConflictError,
  NotFoundError,
  ValidationError
} from '../utils/errors';
import logger from '../utils/logger';
import {
  sendError,
  sendSuccess,
  sendUnauthorizedError,
  sendValidationError
} from '../utils/response';

// 🎯 Services層の活用
import { getLocationService } from '../models/LocationModel';
import { getUserService } from '../services/userService';

// 🎯 types/からの型定義インポート
import type {
  UserRole
} from '../types';

// ✅ 修正: AuthenticatedRequestの定義（types/user不使用）
import type { AuthenticatedRequest } from '../types/auth';

// =====================================
// 👥 ユーザー管理コントローラー統合クラス
// =====================================

/**
 * ユーザー管理コントローラー統合クラス
 *
 * 【完成基盤活用】
 * - middleware/auth.ts: 認証・権限制御
 * - utils統合基盤: エラー・レスポンス・ログ統合
 * - services層連携: userService.ts, locationService.ts
 */
class UserController {
  private readonly userService: ReturnType<typeof getUserService>;
  private readonly locationService: ReturnType<typeof getLocationService>;

  constructor() {
    this.userService = getUserService();
    this.locationService = getLocationService();

    logger.info('🔧 UserController初期化完了');
  }

  // =====================================
  // 👥 基本ユーザー管理API
  // =====================================

  /**
   * ユーザー一覧取得API
   * GET /api/users
   *
   * 🔧🔧🔧 inspection パターン7段階デバッグログ適用版
   */
  public getAllUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // 🔧🔧🔧 デバッグ出力1: メソッド開始
    logger.info('🔧🔧🔧 [DEBUG-Controller] getAllUsers メソッド開始', {
      userId: req.user?.userId,
      role: req.user?.role,
      query: req.query,
      timestamp: new Date().toISOString()
    });

    try {
      const {
        page = 1,
        limit = 10,
        role,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // 🔧🔧🔧 デバッグ出力2: クエリパラメータ抽出完了
      logger.info('🔍🔍🔍 [DEBUG-Controller] クエリパラメータ抽出完了', {
        page,
        limit,
        role,
        status,
        search,
        sortBy,
        sortOrder,
        rawQuery: req.query,
        timestamp: new Date().toISOString()
      });

      const paginationOptions = {
        page: Number(page),
        limit: Number(limit)
      };

      const filterOptions = {
        role: role as UserRole | undefined,
        isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
        search: search as string | undefined
      };

      // 🔧🔧🔧 デバッグ出力3: フィルタオプション構築完了
      logger.info('🔍🔍🔍 [DEBUG-Controller] フィルタオプション構築完了', {
        paginationOptions,
        filterOptions,
        timestamp: new Date().toISOString()
      });

      // 🔧🔧🔧 デバッグ出力4: Service層呼び出し開始
      logger.info('🔍🔍🔍 [DEBUG-Controller] Service層呼び出し開始', {
        serviceName: 'userService.findAll',
        filterOptions,
        userId: req.user?.userId,
        timestamp: new Date().toISOString()
      });

      // ✅ 修正: userService.findAll使用（getAllUsers非存在）
      const result = await this.userService.findAll(filterOptions);

      // 🔧🔧🔧 デバッグ出力5: Service層呼び出し完了
      logger.info('🔍🔍🔍 [DEBUG-Controller] Service層呼び出し完了', {
        resultSuccess: !!result,
        dataLength: result.data?.length || 0,
        totalCount: result.pagination?.total || 0,
        timestamp: new Date().toISOString()
      });

      logger.info('👥 ユーザー一覧取得成功', {
        total: result.pagination.total,
        page: result.pagination.page
      });

      // 🔧🔧🔧 デバッグ出力6: レスポンス送信開始
      logger.info('🔍🔍🔍 [DEBUG-Controller] レスポンス送信開始', {
        statusCode: 200,
        dataLength: result.data?.length || 0,
        timestamp: new Date().toISOString()
      });

      return sendSuccess(res, {
        users: result.data,
        pagination: result.pagination
      }, 'ユーザー一覧を取得しました');

    } catch (error) {
      // 🔧🔧🔧 デバッグ出力7: エラー詳細
      logger.error('❌❌❌ [DEBUG-Controller] getAllUsers エラー（詳細）', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        userId: req.user?.userId,
        timestamp: new Date().toISOString()
      });

      logger.error('👥 ユーザー一覧取得エラー:', error);
      return sendError(res, 'ユーザー一覧の取得に失敗しました', 500);
    }
  });

  /**
   * ユーザー詳細取得API
   * GET /api/users/:id
   */
  public getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        // ✅ 修正: sendValidationErrorの引数を配列形式に修正
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      // ✅ 修正: userService.findById使用（getUserById非存在）
      const user = await this.userService.findById(id);

      if (!user) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      logger.info('👤 ユーザー詳細取得成功', { userId: id });

      return sendSuccess(res, user, 'ユーザー詳細を取得しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('👤 ユーザー詳細取得エラー:', error);
      return sendError(res, 'ユーザー詳細の取得に失敗しました', 500);
    }
  });

  /**
   * ユーザー作成API
   * POST /api/users
   */
  public createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 権限チェック: 管理者以上のみ作成可能
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
        return sendUnauthorizedError(res, 'ユーザーの作成には管理者権限が必要です');
      }

      const userData = {
        ...req.body,
        createdBy: req.user.userId
      };

      const newUser = await this.userService.create(userData);

      logger.info('✅ ユーザー作成成功', {
        userId: newUser.id,
        username: newUser.username,
        createdBy: req.user.userId
      });

      return sendSuccess(res, newUser, 'ユーザーを作成しました', 201);

    } catch (error) {
      if (error instanceof ValidationError) {
        return sendValidationError(res, [
          { field: 'user', message: error.message, value: req.body }
        ], error.message);
      }
      if (error instanceof ConflictError) {
        return sendError(res, error.message, 409);
      }
      logger.error('✅ ユーザー作成エラー:', error);
      return sendError(res, 'ユーザーの作成に失敗しました', 500);
    }
  });

  /**
   * ユーザー更新API
   * PUT /api/users/:id
   */
  public updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      // 権限チェック
      if (req.user?.role !== 'ADMIN' && req.user?.userId !== id) {
        return sendUnauthorizedError(res, '他のユーザーを更新する権限がありません');
      }

      const updateData = {
        ...req.body,
        updatedBy: req.user?.userId
      };

      const updatedUser = await this.userService.update(id, updateData);

      logger.info('📝 ユーザー更新成功', {
        userId: id,
        updatedBy: req.user?.userId
      });

      return sendSuccess(res, updatedUser, 'ユーザーを更新しました');

    } catch (error) {
      if (error instanceof ValidationError) {
        return sendValidationError(res, [
          { field: 'user', message: error.message, value: req.body }
        ], error.message);
      }
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('📝 ユーザー更新エラー:', error);
      return sendError(res, 'ユーザーの更新に失敗しました', 500);
    }
  });

  /**
   * ユーザー削除API
   * DELETE /api/users/:id
   */
  public deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      // 権限チェック: 管理者のみ削除可能
      if (req.user?.role !== 'ADMIN') {
        return sendUnauthorizedError(res, 'ユーザーの削除には管理者権限が必要です');
      }

      // 自分自身は削除できない
      if (req.user?.userId === id) {
        return sendError(res, '自分自身を削除することはできません', 400);
      }

      await this.userService.delete(id);

      logger.info('🗑️ ユーザー削除成功', {
        userId: id,
        deletedBy: req.user.userId
      });

      return sendSuccess(res, null, 'ユーザーを削除しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('🗑️ ユーザー削除エラー:', error);
      return sendError(res, 'ユーザーの削除に失敗しました', 500);
    }
  });

  /**
   * パスワード変更API
   * POST /api/users/:id/change-password
   */
  public changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!id) {
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      // 本人または管理者のみ変更可能
      if (req.user?.userId !== id && req.user?.role !== 'ADMIN') {
        return sendUnauthorizedError(res, 'パスワードを変更する権限がありません');
      }

      // 新しいパスワードの確認
      if (newPassword !== confirmPassword) {
        return sendValidationError(res, [
          { field: 'confirmPassword', message: '新しいパスワードと確認用パスワードが一致しません', value: confirmPassword }
        ], 'バリデーションエラー');
      }

      await this.userService.changePassword(id, currentPassword, newPassword);

      logger.info('🔐 パスワード変更成功', {
        userId: id,
        changedBy: req.user.userId
      });

      return sendSuccess(res, null, 'パスワードを変更しました');

    } catch (error) {
      if (error instanceof ValidationError) {
        return sendValidationError(res, [
          { field: 'password', message: error.message, value: '' }
        ], error.message);
      }
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('🔐 パスワード変更エラー:', error);
      return sendError(res, 'パスワード変更に失敗しました', 500);
    }
  });

  /**
   * ユーザーステータス切替API
   * PATCH /api/users/:id/toggle-status
   */
  public toggleUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      // 権限チェック: 管理者のみ実行可能
      if (req.user?.role !== 'ADMIN') {
        return sendUnauthorizedError(res, 'ステータス変更には管理者権限が必要です');
      }

      // 自分自身のステータスは変更できない
      if (req.user?.userId === id) {
        return sendError(res, '自分自身のステータスは変更できません', 400);
      }

      const user = await this.userService.findById(id);
      if (!user) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      const updatedUser = await this.userService.update(id, {
        isActive: !user.isActive
      });

      logger.info('🔄 ユーザーステータス変更成功', {
        userId: id,
        newStatus: updatedUser.isActive ? 'active' : 'inactive',
        changedBy: req.user.userId
      });

      return sendSuccess(res, updatedUser, 'ユーザーステータスを変更しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('🔄 ユーザーステータス変更エラー:', error);
      return sendError(res, 'ユーザーステータスの変更に失敗しました', 500);
    }
  });

  /**
   * ユーザー統計取得API
   * GET /api/users/:id/statistics
   */
  public getUserStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      const statistics = await this.userService.getUserStatistics(id);

      logger.info('📊 ユーザー統計取得成功', { userId: id });

      return sendSuccess(res, statistics, 'ユーザー統計を取得しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('📊 ユーザー統計取得エラー:', error);
      return sendError(res, 'ユーザー統計の取得に失敗しました', 500);
    }
  });

  /**
   * ユーザーアクティビティ取得API
   * GET /api/users/:id/activities
   */
  public getUserActivities = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      if (!id) {
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      // 本人または管理者のみ閲覧可能
      if (req.user?.userId !== id && req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
        return sendUnauthorizedError(res, 'アクティビティを閲覧する権限がありません');
      }

      const activities = await this.userService.getUserActivities(id, {
        page: Number(page),
        limit: Number(limit)
      });

      logger.info('📜 ユーザーアクティビティ取得成功', { userId: id });

      return sendSuccess(res, activities, 'ユーザーアクティビティを取得しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('📜 ユーザーアクティビティ取得エラー:', error);
      return sendError(res, 'ユーザーアクティビティの取得に失敗しました', 500);
    }
  });

  /**
   * ユーザー設定取得API
   * GET /api/users/:id/preferences
   */
  public getUserPreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      // 本人のみ閲覧可能
      if (req.user?.userId !== id) {
        return sendUnauthorizedError(res, '設定を閲覧する権限がありません');
      }

      const preferences = await this.userService.getUserPreferences(id);

      logger.info('⚙️ ユーザー設定取得成功', { userId: id });

      return sendSuccess(res, preferences, 'ユーザー設定を取得しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('⚙️ ユーザー設定取得エラー:', error);
      return sendError(res, 'ユーザー設定の取得に失敗しました', 500);
    }
  });

  /**
   * ユーザー設定更新API
   * PUT /api/users/:id/preferences
   */
  public updateUserPreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return sendValidationError(res, [
          { field: 'id', message: 'ユーザーIDが必要です', value: id }
        ], 'バリデーションエラー');
      }

      // 本人のみ更新可能
      if (req.user?.userId !== id) {
        return sendUnauthorizedError(res, '設定を更新する権限がありません');
      }

      const updatedPreferences = await this.userService.updateUserPreferences(id, req.body);

      logger.info('⚙️ ユーザー設定更新成功', { userId: id });

      return sendSuccess(res, updatedPreferences, 'ユーザー設定を更新しました');

    } catch (error) {
      if (error instanceof ValidationError) {
        return sendValidationError(res, [
          { field: 'preferences', message: error.message, value: req.body }
        ], error.message);
      }
      if (error instanceof NotFoundError) {
        return sendError(res, error.message, 404);
      }
      logger.error('⚙️ ユーザー設定更新エラー:', error);
      return sendError(res, 'ユーザー設定の更新に失敗しました', 500);
    }
  });

  /**
   * ユーザー検索API
   * GET /api/users/search
   */
  public searchUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { q, role, status, page = 1, limit = 20 } = req.query;

      if (!q) {
        return sendValidationError(res, [
          { field: 'q', message: '検索キーワードが必要です', value: q }
        ], 'バリデーションエラー');
      }

      const searchOptions = {
        search: q as string,
        role: role as UserRole | undefined,
        isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
        page: Number(page),
        limit: Number(limit)
      };

      const result = await this.userService.findAll(searchOptions);

      logger.info('🔍 ユーザー検索成功', {
        keyword: q,
        resultsCount: result.data.length
      });

      return sendSuccess(res, {
        users: result.data,
        pagination: result.pagination
      }, 'ユーザー検索結果を取得しました');

    } catch (error) {
      logger.error('🔍 ユーザー検索エラー:', error);
      return sendError(res, 'ユーザー検索に失敗しました', 500);
    }
  });

  /**
   * ユーザー一括ステータス更新API
   * PATCH /api/users/bulk-status
   */
  public bulkUpdateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userIds, isActive } = req.body;

      // 権限チェック: 管理者のみ実行可能
      if (req.user?.role !== 'ADMIN') {
        return sendUnauthorizedError(res, '一括更新には管理者権限が必要です');
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return sendValidationError(res, [
          { field: 'userIds', message: 'ユーザーIDの配列が必要です', value: userIds }
        ], 'バリデーションエラー');
      }

      if (typeof isActive !== 'boolean') {
        return sendValidationError(res, [
          { field: 'isActive', message: 'ステータスはboolean型で指定してください', value: isActive }
        ], 'バリデーションエラー');
      }

      const results = await Promise.all(
        userIds.map(id =>
          this.userService.update(id, { isActive })
            .catch(error => ({ id, error: error.message }))
        )
      );

      const successful = results.filter(r => !('error' in r));
      const failed = results.filter(r => 'error' in r);

      logger.info('🔄 ユーザー一括ステータス更新完了', {
        total: userIds.length,
        successful: successful.length,
        failed: failed.length,
        updatedBy: req.user.userId
      });

      return sendSuccess(res, {
        successful: successful.length,
        failed: failed.length,
        failures: failed
      }, `${successful.length}件のユーザーステータスを更新しました`);

    } catch (error) {
      logger.error('🔄 ユーザー一括ステータス更新エラー:', error);
      return sendError(res, 'ユーザー一括ステータス更新に失敗しました', 500);
    }
  });
}

// =====================================
// 🏭 ファクトリ関数
// =====================================

let _userControllerInstance: UserController | null = null;

export const getUserController = (): UserController => {
  if (!_userControllerInstance) {
    _userControllerInstance = new UserController();
  }
  return _userControllerInstance;
};

// =====================================
// 📤 エクスポート
// =====================================

const userController = getUserController();

// 既存機能100%保持のためのエクスポート
export const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  toggleUserStatus,
  getUserStatistics,
  getUserActivities,
  getUserPreferences,
  updateUserPreferences,
  searchUsers,
  bulkUpdateUserStatus
} = userController;

// 統合版名前付きエクスポート
export {
  userController as default, UserController
};

// =====================================
// ✅ 7段階デバッグログ適用完了確認
// =====================================

/**
 * ✅ controllers/userController.ts - inspection パターン7段階デバッグログ適用完了
 *
 * 【修正内容】
 * 1. ✅ getAllUsers に7段階デバッグログ追加（inspectionController.tsパターン準拠）
 *    - デバッグ出力1: メソッド開始
 *    - デバッグ出力2: クエリパラメータ抽出完了
 *    - デバッグ出力3: フィルタオプション構築完了
 *    - デバッグ出力4: Service層呼び出し開始
 *    - デバッグ出力5: Service層呼び出し完了
 *    - デバッグ出力6: レスポンス送信開始
 *    - デバッグ出力7: エラー詳細
 * 2. ✅ 既存機能100%保持
 * 3. ✅ 既存コメント100%保持
 * 4. ✅ 既存の全メソッド保持
 *
 * 【期待されるログ出力】
 * 🔧🔧🔧 [DEBUG-Controller] getAllUsers メソッド開始
 * 🔍🔍🔍 [DEBUG-Controller] クエリパラメータ抽出完了
 * 🔍🔍🔍 [DEBUG-Controller] フィルタオプション構築完了
 * 🔍🔍🔍 [DEBUG-Controller] Service層呼び出し開始
 * 🔍🔍🔍 [DEBUG-Controller] Service層呼び出し完了
 * 🔍🔍🔍 [DEBUG-Controller] レスポンス送信開始
 *
 * 【既存機能100%保持】
 * ✅ 全13メソッド保持
 * ✅ 全コメント保持
 * ✅ 全エラーハンドリング保持
 * ✅ 全バリデーション保持
 * ✅ 全権限チェック保持
 */
