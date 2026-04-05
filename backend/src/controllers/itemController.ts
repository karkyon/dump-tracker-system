// =====================================
// backend/src/controllers/itemController.ts
// 品目関連コントローラー - Phase 3完全統合版
// 既存完全実装保持・Phase 1&2完成基盤活用・アーキテクチャ指針準拠
// 作成日時: 2025年9月27日19:45
// 最終更新: 2025年10月18日
// Phase 3: Controllers層統合・品目管理API統合・レスポンス統一・型安全性向上
// =====================================

import { Response } from 'express';

// 🎯 Phase 1完成基盤の活用
import { asyncHandler } from '../utils/asyncHandler';
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError
} from '../utils/errors';
import logger from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

// 🎯 Phase 2 Services層完成基盤の活用
import { ItemService } from '../services/itemService';

// 🎯 types/からの統一型定義インポート（models/ItemModelから直接）
import type {
  ItemResponseDTO,
  ItemUsageStats
} from '../models/ItemModel';

import type {
  AuthenticatedRequest
} from '../types/auth';

// 🎯 共通型定義の活用（Phase 1完成基盤）
import type {
  ApiListResponse,
  ApiResponse,
  PaginationQuery
} from '../types/common';

// =====================================
// 📦 品目管理型定義（Controller層専用）
// =====================================

interface ItemFilter extends PaginationQuery {
  search?: string;
  category?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  hasStock?: boolean;
  sortBy?: 'name' | 'itemType' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

interface CreateItemRequest {
  name: string;
  description?: string;
  itemType?: any;
  unit?: string;
  standardWeight?: number;
  standardVolume?: number;
  hazardous?: boolean;
  hazardousClass?: string;
  handlingInstructions?: string;
  storageRequirements?: string;
  temperatureRange?: string;
  isFragile?: boolean;
  isHazardous?: boolean;
  requiresSpecialEquipment?: boolean;
  displayOrder?: number;
  photoUrls?: string;
  specificationFileUrl?: string;
  msdsFileUrl?: string;
  isActive?: boolean;
}

interface UpdateItemRequest extends Partial<CreateItemRequest> {
  // 部分更新対応
}

interface ItemUsageStatsRequest {
  startDate?: string;
  endDate?: string;
  includeInactive?: boolean;
}

// =====================================
// 📦 品目管理コントローラークラス
// =====================================
export class ItemController {
  private readonly itemService: ItemService;

  constructor() {
    this.itemService = new ItemService();
  }

  // =====================================
  // 📦 基本品目管理（既存機能100%保持）
  // =====================================

  /**
   * 品目一覧取得
   */
  getAllItems = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const filter: ItemFilter = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 50,
        search: req.query.search as string,
        category: req.query.category as string,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true, // デフォルト: アクティブのみ表示
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        hasStock: req.query.hasStock ? req.query.hasStock === 'true' : undefined,
        sortBy: (req.query.sortBy as 'name' | 'itemType' | 'createdAt' | 'updatedAt') || 'createdAt',
        sortOrder: req.query.sortOrder as 'asc' | 'desc' || 'asc'
      };

      // ItemService経由で一覧取得
      const result = await this.itemService.getItems(
        filter,
        req.user?.userId || '',
        req.user?.role || 'DRIVER'
      );

      const currentPage = filter.page || 1;
      const pageSize = filter.limit || 50;
      const totalPages = Math.ceil(result.total / pageSize);

      // 統一レスポンス形式
      const response: ApiListResponse<ItemResponseDTO> = {
        success: true,
        data: result.items,
        message: '品目一覧を取得しました',
        timestamp: new Date().toISOString(),
        meta: {
          total: result.total,
          page: currentPage,
          pageSize: pageSize,
          totalPages: totalPages,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1
        }
      };

      logger.info('品目一覧取得', {
        userId: req.user?.userId,
        filter,
        resultCount: result.items.length,
        total: result.total
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('品目一覧取得エラー', { error, query: req.query });

      const errResponse = errorResponse('品目一覧の取得に失敗しました', 500, 'GET_ITEMS_ERROR');
      res.status(500).json(errResponse);
    }
  });

  /**
   * 品目詳細取得
   */
  getItemById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new ValidationError('品目IDは必須です', 'id');
      }

      const item = await this.itemService.getItem(
        id,
        req.user?.userId || '',
        req.user?.role || 'DRIVER'
      );

      const response: ApiResponse<ItemResponseDTO> = successResponse(
        item,
        '品目詳細を取得しました'
      );

      logger.info('品目詳細取得', {
        itemId: id,
        itemName: item.name,
        userId: req.user?.userId
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('品目詳細取得エラー', { error, itemId: req.params.id });

      if (error instanceof NotFoundError) {
        const errResponse = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errResponse);
      } else {
        const errResponse = errorResponse('品目詳細の取得に失敗しました', 500, 'GET_ITEM_ERROR');
        res.status(500).json(errResponse);
      }
    }
  });

  /**
   * 品目作成
   */
  createItem = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // 管理者権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user?.role || '')) {
        throw new AuthorizationError('品目作成の権限がありません');
      }

      const requestData: CreateItemRequest = req.body;

      // 必須フィールドのバリデーション
      if (!requestData.name || requestData.name.trim().length === 0) {
        throw new ValidationError('品目名は必須です', 'name');
      }

      const newItem = await this.itemService.createItem(
        requestData,
        req.user?.userId || '',
        req.user?.role || 'ADMIN'
      );

      const response: ApiResponse<ItemResponseDTO> = {
        success: true,
        data: newItem,
        message: '品目を作成しました',
        timestamp: new Date().toISOString()
      };

      logger.info('品目作成', {
        itemId: newItem.id,
        itemName: newItem.name,
        userId: req.user?.userId
      });

      res.status(201).json(response);

    } catch (error) {
      logger.error('品目作成エラー', { error, body: req.body });

      if (error instanceof AuthorizationError ||
        error instanceof ValidationError ||
        error instanceof ConflictError) {
        const errResponse = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errResponse);
      } else {
        const errResponse = errorResponse('品目の作成に失敗しました', 500, 'CREATE_ITEM_ERROR');
        res.status(500).json(errResponse);
      }
    }
  });

  /**
   * 品目更新
   */
  updateItem = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // 管理者権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user?.role || '')) {
        throw new AuthorizationError('品目更新の権限がありません');
      }

      if (!id) {
        throw new ValidationError('品目IDは必須です', 'id');
      }

      const requestData: UpdateItemRequest = req.body;

      const updatedItem = await this.itemService.updateItem(
        id,
        requestData as any,
        req.user?.userId || '',
        req.user?.role || 'ADMIN'
      );

      const response: ApiResponse<ItemResponseDTO> = {
        success: true,
        data: updatedItem,
        message: '品目を更新しました',
        timestamp: new Date().toISOString()
      };

      logger.info('品目更新', {
        itemId: id,
        itemName: updatedItem.name,
        updates: Object.keys(requestData),
        userId: req.user?.userId
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('品目更新エラー', { error, itemId: req.params.id });

      if (error instanceof AuthorizationError ||
        error instanceof NotFoundError ||
        error instanceof ValidationError) {
        const errResponse = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errResponse);
      } else {
        const errResponse = errorResponse('品目の更新に失敗しました', 500, 'UPDATE_ITEM_ERROR');
        res.status(500).json(errResponse);
      }
    }
  });

  /**
   * 品目削除（論理削除）
   */
  deleteItem = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // 管理者権限チェック
      if (!['ADMIN'].includes(req.user?.role || '')) {
        throw new AuthorizationError('品目削除の権限がありません');
      }

      if (!id) {
        throw new ValidationError('品目IDは必須です', 'id');
      }

      await this.itemService.deleteItem(
        id,
        req.user?.userId || '',
        req.user?.role || 'ADMIN'
      );

      const response: ApiResponse<null> = successResponse(
        null,
        '品目を削除しました'
      );

      logger.info('品目削除', { itemId: id, userId: req.user?.userId });

      res.status(200).json(response);

    } catch (error) {
      logger.error('品目削除エラー', { error, itemId: req.params.id });

      if (error instanceof AuthorizationError ||
        error instanceof NotFoundError ||
        error instanceof ValidationError) {
        const errResponse = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errResponse);
      } else {
        const errResponse = errorResponse('品目の削除に失敗しました', 500, 'DELETE_ITEM_ERROR');
        res.status(500).json(errResponse);
      }
    }
  });

  /**
   * 品目ステータス切り替え
   */
  toggleItemStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // 管理者権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user?.role || '')) {
        throw new AuthorizationError('品目ステータス変更の権限がありません');
      }

      if (!id) {
        throw new ValidationError('品目IDは必須です', 'id');
      }

      // 現在の品目取得
      const currentItem = await this.itemService.getItem(
        id,
        req.user?.userId || '',
        req.user?.role || 'ADMIN'
      );

      // ステータス反転
      const updatedItem = await this.itemService.updateItem(
        id,
        { isActive: !currentItem.isActive },
        req.user?.userId || '',
        req.user?.role || 'ADMIN'
      );

      const response: ApiResponse<ItemResponseDTO> = successResponse(
        updatedItem,
        `品目ステータスを${updatedItem.isActive ? 'アクティブ' : '非アクティブ'}に変更しました`
      );

      logger.info('品目ステータス切り替え', {
        itemId: id,
        itemName: updatedItem.name,
        newStatus: updatedItem.isActive ? 'active' : 'inactive',
        userId: req.user?.userId
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('品目ステータス切り替えエラー', { error, itemId: req.params.id });

      if (error instanceof AuthorizationError ||
        error instanceof NotFoundError ||
        error instanceof ValidationError) {
        const errResponse = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errResponse);
      } else {
        const errResponse = errorResponse('品目ステータスの変更に失敗しました', 500, 'TOGGLE_ITEM_STATUS_ERROR');
        res.status(500).json(errResponse);
      }
    }
  });

  // =====================================
  // 📊 統計・分析機能
  // =====================================


  /**
   * 品目表示順一括更新
   */
  updateDisplayOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!['ADMIN', 'MANAGER'].includes(req.user?.role || '')) {
        throw new AuthorizationError('品目表示順更新の権限がありません');
      }

      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        throw new ValidationError('更新対象の品目リストが必要です', 'items');
      }

      // 各品目のdisplayOrderを個別更新
      await Promise.all(
        items.map(({ id, order }: { id: string; order: number }) =>
          this.itemService.updateItem(
            id,
            { displayOrder: order } as any,
            req.user?.userId || '',
            req.user?.role || 'ADMIN'
          )
        )
      );

      const response = {
        success: true,
        message: '表示順を更新しました',
        timestamp: new Date().toISOString()
      };

      logger.info('品目表示順一括更新', {
        count: items.length,
        userId: req.user?.userId
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('品目表示順更新エラー', { error });
      if (error instanceof AuthorizationError || error instanceof ValidationError) {
        const errResponse = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errResponse);
      } else {
        const errResponse = errorResponse('表示順の更新に失敗しました', 500, 'UPDATE_ORDER_ERROR');
        res.status(500).json(errResponse);
      }
    }
  });

  /**
   * カテゴリ一覧取得
   */
  getCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const categories = await this.itemService.getCategories(
        req.user?.userId || '',
        req.user?.role || 'DRIVER'
      );

      const response: ApiResponse<string[]> = successResponse(
        categories,
        'カテゴリ一覧を取得しました'
      );

      logger.info('カテゴリ一覧取得', {
        userId: req.user?.userId,
        categoryCount: categories.length
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('カテゴリ一覧取得エラー', { error });

      const errResponse = errorResponse('カテゴリ一覧の取得に失敗しました', 500, 'GET_CATEGORIES_ERROR');
      res.status(500).json(errResponse);
    }
  });

  /**
     * 品目使用統計取得
     */
  getItemUsageStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const params: ItemUsageStatsRequest = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        includeInactive: req.query.includeInactive === 'true'
      };

      // 簡易実装: 品目一覧から使用統計を生成
      const result = await this.itemService.getItems(
        { page: 1, limit: 100 },
        req.user?.userId || '',
        req.user?.role || 'DRIVER'
      );

      const stats: ItemUsageStats[] = result.items.map(item => ({
        item: {
          id: item.id,
          name: item.name,
          itemType: item.itemType as any,
          unit: item.unit as any,
          displayOrder: item.displayOrder || 0,
          isActive: item.isActive || false,
          createdAt: item.createdAt || new Date(),
          updatedAt: item.updatedAt || new Date()
        },
        usageCount: item._count?.operationDetails || 0
      }));

      const response: ApiResponse<ItemUsageStats[]> = {
        success: true,
        data: stats,
        message: '品目使用統計を取得しました',
        timestamp: new Date().toISOString()
      };

      logger.info('品目使用統計取得', {
        userId: req.user?.userId,
        params
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('品目使用統計取得エラー', { error });

      const errResponse = errorResponse('品目使用統計の取得に失敗しました', 500, 'GET_ITEM_USAGE_STATS_ERROR');
      res.status(500).json(errResponse);
    }
  });

  /**
   * 品目統計情報取得
   */
  getItemStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // 簡易実装: 品目一覧から統計を生成
      const result = await this.itemService.getItems(
        { page: 1, limit: 1000 },
        req.user?.userId || '',
        req.user?.role || 'DRIVER'
      );

      const statistics = {
        totalItems: result.total,
        activeItems: result.items.filter(i => i.isActive).length,
        inactiveItems: result.items.filter(i => !i.isActive).length,
        categoriesCount: new Set(result.items.map(i => i.itemType).filter(Boolean)).size,
        totalUsage: result.items.reduce((sum, i) => sum + (i._count?.operationDetails || 0), 0)
      };

      const response: ApiResponse<typeof statistics> = successResponse(
        statistics,
        '品目統計情報を取得しました'
      );

      logger.info('品目統計情報取得', {
        userId: req.user?.userId,
        statistics
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('品目統計情報取得エラー', { error });

      const errResponse = errorResponse('品目統計情報の取得に失敗しました', 500, 'GET_ITEM_STATISTICS_ERROR');
      res.status(500).json(errResponse);
    }
  });

  /**
   * 人気品目取得
   */
  getPopularItems = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 10;

      // 簡易実装: 使用回数順にソート
      const result = await this.itemService.getItems(
        { page: 1, limit: 100 },
        req.user?.userId || '',
        req.user?.role || 'DRIVER'
      );

      const popularItems = result.items
        .sort((a, b) => (b._count?.operationDetails || 0) - (a._count?.operationDetails || 0))
        .slice(0, limit);

      const response: ApiResponse<ItemResponseDTO[]> = successResponse(
        popularItems,
        '人気品目を取得しました'
      );

      logger.info('人気品目取得', {
        userId: req.user?.userId,
        limit,
        resultCount: popularItems.length
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('人気品目取得エラー', { error });

      const errResponse = errorResponse('人気品目の取得に失敗しました', 500, 'GET_POPULAR_ITEMS_ERROR');
      res.status(500).json(errResponse);
    }
  });

  /**
   * 在庫不足品目取得
   */
  getLowStockItems = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // 管理者・マネージャー権限チェック
      if (!['ADMIN', 'MANAGER'].includes(req.user?.role || '')) {
        throw new AuthorizationError('在庫情報を参照する権限がありません');
      }

      // 簡易実装: 空の配列を返す（在庫管理機能は未実装）
      const lowStockItems: ItemResponseDTO[] = [];

      const response: ApiResponse<ItemResponseDTO[]> = successResponse(
        lowStockItems,
        '在庫不足品目を取得しました'
      );

      logger.info('在庫不足品目取得', {
        alertCount: lowStockItems.length,
        userId: req.user?.userId
      });

      res.status(200).json(response);

    } catch (error) {
      logger.error('在庫不足品目取得エラー', { error });

      if (error instanceof AuthorizationError) {
        const errResponse = errorResponse(error.message, error.statusCode, error.code);
        res.status(error.statusCode).json(errResponse);
      } else {
        const errResponse = errorResponse('在庫不足品目の取得に失敗しました', 500, 'GET_LOW_STOCK_ITEMS_ERROR');
        res.status(500).json(errResponse);
      }
    }
  });
}

// =====================================
// 🏭 ファクトリ関数（シングルトンパターン）
// =====================================

let _itemControllerInstance: ItemController | null = null;

export const getItemController = (): ItemController => {
  if (!_itemControllerInstance) {
    _itemControllerInstance = new ItemController();
  }
  return _itemControllerInstance;
};

// =====================================
// 📤 エクスポート（既存完全実装保持）
// =====================================

const itemController = getItemController();

// 既存機能100%保持のためのエクスポート
export const {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  toggleItemStatus,
  getCategories,
  getItemUsageStats,
  getItemStatistics,
  getPopularItems,
  getLowStockItems,
  updateDisplayOrder
} = itemController;

// デフォルトエクスポート
export default itemController;
