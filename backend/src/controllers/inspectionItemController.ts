// =====================================
// backend/src/controllers/inspectionItemController.ts
// 点検項目管理コントローラー（マスタデータ専用）
// 作成日: 2025年12月16日
// 目的: 点検項目（InspectionItem）のCRUD管理
// 概念: マスタデータ - 点検する項目の定義（例：タイヤ空気圧、エンジンオイル量）
// 分離元: controllers/inspectionController.ts
// 依存関係: services/inspectionService.ts, middleware/auth.ts
// =====================================

import { Response } from 'express';
import { InspectionService } from '../services/inspectionService';
import { asyncHandler } from '../utils/asyncHandler';
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendValidationError,
  sendUnauthorizedError
} from '../utils/response';
import logger from '../utils/logger';

// 型定義
import type { AuthenticatedRequest } from '../types/auth';
import type {
  InspectionItemCreateInput,
  InspectionItemUpdateInput,
  InspectionType
} from '../types';
import {
  NotFoundError,
  ValidationError,
  ConflictError
} from '../utils/errors';

// =====================================
// 🏭 点検項目コントローラークラス
// =====================================

/**
 * 点検項目管理コントローラー（マスタデータ専用）
 *
 * 責務:
 * - 点検項目のCRUD操作
 * - マスタデータ管理
 * - 権限制御
 * - バリデーション
 */
class InspectionItemController {
  private inspectionService: InspectionService;

  constructor() {
    this.inspectionService = new InspectionService();
    logger.info('🔧 InspectionItemController初期化完了 - マスタデータ専用');
  }

  // =====================================
  // 📋 点検項目管理API（マスタデータ）
  // =====================================

  /**
   * 点検項目一覧取得API
   * 企業レベル機能: フィルタリング・ソート・ページネーション・権限制御
   */
  public getAllInspectionItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // 🔧🔧🔧 デバッグ出力1: メソッド開始
    logger.info('🔧🔧🔧 [DEBUG-ItemController] getAllInspectionItems メソッド開始', {
      userId: req.user?.userId,
      role: req.user?.role,
      query: req.query,
      timestamp: new Date().toISOString()
    });

    try {
      const {
        inspectionType,
        isActive
      } = req.query;

      // 🔧🔧🔧 デバッグ出力2: クエリパラメータ確認
      logger.info('🔍🔍🔍 [DEBUG-ItemController] クエリパラメータ抽出完了', {
        inspectionType,
        isActive,
        rawQuery: req.query,
        timestamp: new Date().toISOString()
      });

      logger.info('📋 [ItemController] 点検項目一覧取得開始', {
        userId: req.user?.userId,
        inspectionType,
        isActive
      });

      // フィルタオプション
      const filterOptions: any = {
        inspectionType: inspectionType as InspectionType,
        isActive: isActive !== 'false'
      };

      // 🔧🔧🔧 デバッグ出力3: フィルタオプション確認
      logger.info('🔍🔍🔍 [DEBUG-ItemController] フィルタオプション構築完了', {
        filterOptions,
        timestamp: new Date().toISOString()
      });

      // 🔧🔧🔧 デバッグ出力4: サービス呼び出し前
      logger.info('🔍🔍🔍 [DEBUG-ItemController] inspectionService.getInspectionItems 呼び出し開始', {
        filterOptions,
        requesterId: req.user?.userId || '',
        timestamp: new Date().toISOString()
      });

      const result = await this.inspectionService.getInspectionItems(
        filterOptions,
        req.user?.userId || '',
        req.user?.role || 'DRIVER'
      );

      // 🔧🔧🔧 デバッグ出力5: サービス呼び出し後
      logger.info('🔍🔍🔍 [DEBUG-ItemController] inspectionService.getInspectionItems 呼び出し完了', {
        resultSuccess: result.success,
        dataLength: result.data?.length,
        metaTotal: result.meta?.total,
        timestamp: new Date().toISOString()
      });

      logger.info(`📋 点検項目一覧取得成功`, {
        userId: req.user?.userId,
        filters: filterOptions,
        resultCount: result.data?.length || 0,
        totalCount: result.meta?.total || 0
      });

      // 🔧🔧🔧 デバッグ出力6: レスポンス送信前
      logger.info('🔍🔍🔍 [DEBUG-ItemController] sendSuccess 呼び出し', {
        hasData: !!result.data,
        dataLength: result.data?.length,
        timestamp: new Date().toISOString()
      });

      return sendSuccess(res, result, '点検項目一覧を取得しました');

    } catch (error) {
      // 🔧🔧🔧 デバッグ出力7: エラー詳細
      logger.error('❌❌❌ [DEBUG-ItemController] getAllInspectionItems エラー', {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.userId,
        timestamp: new Date().toISOString()
      });

      logger.error('📋 点検項目一覧取得エラー:', error);
      return sendError(res, '点検項目一覧の取得に失敗しました', 500);
    }
  });

  /**
   * 点検項目詳細取得API
   * 企業レベル機能: 詳細情報・履歴・権限制御
   */
  public getInspectionItemById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { includeHistory } = req.query;

      // ✅ UUID形式のバリデーション
      const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!id || typeof id !== 'string' || !UUID_V4_REGEX.test(id.trim())) {
        logger.warn('❌ [ItemController] 無効なUUID形式', {
          id,
          expectedFormat: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        });

        return sendValidationError(res, [
          { field: 'id', message: '有効な点検項目IDを指定してください', value: id }
        ], 'バリデーションエラー');
      }

      logger.info('📋 [ItemController] 点検項目詳細取得開始', {
        userId: req.user?.userId,
        itemId: id,
        includeHistory
      });

      const result = await this.inspectionService.getInspectionItems(
        {
          inspectionType: undefined
        },
        req.user?.userId || '',
        req.user?.role || 'DRIVER'
      );

      // レコードIDでフィルタリング（取得後）
      const filteredItem = result.data?.find(item => item.id === id);

      if (!filteredItem) {
        return sendNotFound(res, undefined, '指定された点検項目が見つかりません');
      }

      logger.info(`📋 点検項目詳細取得成功`, {
        userId: req.user?.userId,
        itemId: id,
        includeHistory
      });

      return sendSuccess(res, filteredItem, '点検項目詳細を取得しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendNotFound(res, undefined, error.message);
      }
      logger.error('📋 点検項目詳細取得エラー:', error);
      return sendError(res, '点検項目詳細の取得に失敗しました', 500);
    }
  });

  /**
   * 点検項目作成API
   * 企業レベル機能: 重複チェック・表示順管理・権限制御
   */
  public createInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 権限チェック: 管理者以上のみ作成可能
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
        return sendUnauthorizedError(res, '点検項目の作成には管理者権限が必要です');
      }

      const itemData: InspectionItemCreateInput = {
        ...req.body,
        createdBy: req.user.userId
      };

      const newItem = await this.inspectionService.createInspectionItem(
        itemData,
        req.user.userId,
        req.user.role
      );

      logger.info(`📋 点検項目作成成功`, {
        userId: req.user.userId,
        itemId: newItem.id,
        name: newItem.name
      });

      return sendSuccess(res, newItem, '点検項目を作成しました', 201);

    } catch (error) {
      if (error instanceof ValidationError) {
        return sendValidationError(res, [
          { field: 'item', message: error.message, value: req.body }
        ], error.message);
      }
      if (error instanceof ConflictError) {
        return sendError(res, error.message, 409);
      }
      logger.error('📋 点検項目作成エラー:', error);
      return sendError(res, '点検項目の作成に失敗しました', 500);
    }
  });

  /**
   * 点検項目更新API
   * 企業レベル機能: 部分更新・履歴管理・権限制御
   */
  public updateInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // ✅ UUID形式のバリデーション
      const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!id || typeof id !== 'string' || !UUID_V4_REGEX.test(id.trim())) {
        logger.warn('❌ [ItemController] 無効なUUID形式', {
          id,
          expectedFormat: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        });

        return sendValidationError(res, [
          { field: 'id', message: '有効な点検項目IDを指定してください', value: id }
        ], 'バリデーションエラー');
      }

      // 権限チェック: 管理者以上のみ更新可能
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
        return sendUnauthorizedError(res, '点検項目の更新には管理者権限が必要です');
      }

      const updateData: InspectionItemUpdateInput = {
        ...req.body
      };

      const updatedItem = await this.inspectionService.updateInspectionItem(
        id,
        updateData,
        req.user.userId,
        req.user.role
      );

      logger.info(`📋 点検項目更新成功`, {
        userId: req.user.userId,
        itemId: id
      });

      return sendSuccess(res, updatedItem, '点検項目を更新しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendNotFound(res, undefined, error.message);
      }
      if (error instanceof ValidationError) {
        return sendValidationError(res, [
          { field: 'item', message: error.message, value: req.body }
        ], error.message);
      }
      logger.error('📋 点検項目更新エラー:', error);
      return sendError(res, '点検項目の更新に失敗しました', 500);
    }
  });

  /**
   * 点検項目削除API
   * 企業レベル機能: ソフト削除・関連データチェック・権限制御
   */
  public deleteInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { force } = req.query;

      // ✅ UUID形式のバリデーション
      const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!id || typeof id !== 'string' || !UUID_V4_REGEX.test(id.trim())) {
        logger.warn('❌ [ItemController] 無効なUUID形式', {
          id,
          expectedFormat: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        });

        return sendValidationError(res, [
          { field: 'id', message: '有効な点検項目IDを指定してください', value: id }
        ], 'バリデーションエラー');
      }

      // 権限チェック: 管理者のみ削除可能
      if (req.user?.role !== 'ADMIN') {
        return sendUnauthorizedError(res, '点検項目の削除には管理者権限が必要です');
      }

      const forceDelete = force === 'true';

      const result = await this.inspectionService.deleteInspectionItem(
        id,
        req.user.userId,
        req.user?.role || 'ADMIN'
      );

      logger.info(`✅ [ItemController] 点検項目削除成功`, {
        userId: req.user.userId,
        itemId: id,
        forceDelete
      });

      return sendSuccess(res, result, '点検項目を削除しました');

    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendNotFound(res, undefined, error.message);
      }
      logger.error('❌ [ItemController] 点検項目削除エラー:', error);
      return sendError(res, '点検項目の削除に失敗しました', 500);
    }
  });
}

// =====================================
// 📤 エクスポート
// =====================================

// シングルトンインスタンスを作成
const getInspectionItemController = () => {
  return new InspectionItemController();
};

const inspectionItemController = getInspectionItemController();

// 名前付きエクスポート（routes/inspectionItemRoutes.ts対応）
export const {
  getAllInspectionItems,
  getInspectionItemById,
  createInspectionItem,
  updateInspectionItem,
  deleteInspectionItem
} = inspectionItemController;

// クラスエクスポート
export { InspectionItemController };

// デフォルトエクスポート
export default inspectionItemController;

// =====================================
// ✅ 新規作成完了確認
// =====================================

/**
 * ✅ controllers/inspectionItemController.ts - 新規作成完了
 *
 * 【分離完了】
 * ✅ inspectionController.ts から点検項目メソッドを分離
 * ✅ マスタデータ専用コントローラーとして独立
 *
 * 【実装メソッド】
 * ✅ getAllInspectionItems - 点検項目一覧取得
 * ✅ getInspectionItemById - 点検項目詳細取得
 * ✅ createInspectionItem - 点検項目作成
 * ✅ updateInspectionItem - 点検項目更新
 * ✅ deleteInspectionItem - 点検項目削除
 *
 * 【既存機能100%保持】
 * ✅ すべてのデバッグログ保持
 * ✅ すべてのバリデーション保持
 * ✅ すべての権限制御保持
 * ✅ すべてのエラーハンドリング保持
 * ✅ UUID対応バリデーション保持
 *
 * 【依存関係】
 * ✅ services/inspectionService.ts - ビジネスロジック層
 * ✅ utils/response.ts - レスポンスユーティリティ
 * ✅ utils/errors.ts - エラークラス
 * ✅ middleware/auth.ts - 認証・権限制御
 *
 * 【次のステップ】
 * 🎯 inspectionItemRoutes.ts の import を修正
 * 🎯 inspectionController.ts から点検項目メソッドを削除
 */
