import { Request, Response, NextFunction } from 'express';
import { ItemService } from '../services/itemService';
import { AuthenticatedRequest } from '../types/auth';
import { AppError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

const itemService = new ItemService();

/**
 * 品目作成
 * @route POST /api/items
 * @access Admin, Manager
 */
export const createItem = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    console.log(`[createItem] ユーザー: ${req.user?.username}, 品目作成開始`);

    // 認証チェック
    if (!req.user) {
      console.log('[createItem] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      console.log(`[createItem] 権限エラー: ${req.user.username} (${req.user.role}) には品目作成権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    // バリデーション
    const { name, displayOrder } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      console.log('[createItem] バリデーションエラー: 品目名が無効です');
      res.status(400).json({
        success: false,
        message: '品目名は必須です'
      });
      return;
    }

    try {
      const result = await itemService.createItem({
        name: name.trim(),
        displayOrder: displayOrder ? Number(displayOrder) : undefined
      });

      console.log(`[createItem] 成功: 品目「${result.name}」を作成しました (ID: ${result.id})`);
      
      res.status(201).json({
        success: true,
        message: '品目が正常に作成されました',
        data: result
      });
    } catch (error) {
      console.error(`[createItem] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 品目一覧取得
 * @route GET /api/items
 * @access All authenticated users
 */
export const getAllItems = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    console.log(`[getAllItems] ユーザー: ${req.user?.username}, 品目一覧取得開始`);

    // 認証チェック
    if (!req.user) {
      console.log('[getAllItems] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    try {
      const queryParams = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        sortBy: req.query.sortBy as string || 'displayOrder',
        sortOrder: (req.query.sortOrder as string || 'asc') as 'asc' | 'desc',
        search: req.query.search as string,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined
      };

      const result = await itemService.getItems(queryParams);

      console.log(`[getAllItems] 成功: ${result.data.length}件の品目を取得しました (総件数: ${result.total})`);
      
      res.status(200).json({
        success: true,
        message: '品目一覧を正常に取得しました',
        data: result
      });
    } catch (error) {
      console.error(`[getAllItems] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 品目詳細取得
 * @route GET /api/items/:id
 * @access All authenticated users
 */
export const getItemById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const itemId = req.params.id;
    console.log(`[getItemById] ユーザー: ${req.user?.username}, 品目詳細取得開始 (ID: ${itemId})`);

    // 認証チェック
    if (!req.user) {
      console.log('[getItemById] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    try {
      const result = await itemService.getItemById(itemId);

      console.log(`[getItemById] 成功: 品目「${result.name}」の詳細を取得しました`);
      
      res.status(200).json({
        success: true,
        message: '品目詳細を正常に取得しました',
        data: result
      });
    } catch (error) {
      console.error(`[getItemById] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 品目更新
 * @route PUT /api/items/:id
 * @access Admin, Manager
 */
export const updateItem = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const itemId = req.params.id;
    console.log(`[updateItem] ユーザー: ${req.user?.username}, 品目更新開始 (ID: ${itemId})`);

    // 認証チェック
    if (!req.user) {
      console.log('[updateItem] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      console.log(`[updateItem] 権限エラー: ${req.user.username} (${req.user.role}) には品目更新権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    // バリデーション
    const { name, displayOrder, isActive } = req.body;
    const updateData: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: '品目名が無効です'
        });
        return;
      }
      updateData.name = name.trim();
    }

    if (displayOrder !== undefined) {
      updateData.displayOrder = Number(displayOrder);
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    try {
      const result = await itemService.updateItem(itemId, updateData);

      console.log(`[updateItem] 成功: 品目「${result.name}」を更新しました`);
      
      res.status(200).json({
        success: true,
        message: '品目が正常に更新されました',
        data: result
      });
    } catch (error) {
      console.error(`[updateItem] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 品目削除（論理削除）
 * @route DELETE /api/items/:id
 * @access Admin only
 */
export const deleteItem = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const itemId = req.params.id;
    console.log(`[deleteItem] ユーザー: ${req.user?.username}, 品目削除開始 (ID: ${itemId})`);

    // 認証チェック
    if (!req.user) {
      console.log('[deleteItem] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック（管理者のみ）
    if (req.user.role !== 'ADMIN') {
      console.log(`[deleteItem] 権限エラー: ${req.user.username} (${req.user.role}) には品目削除権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    try {
      await itemService.deleteItem(itemId);

      console.log(`[deleteItem] 成功: 品目を削除しました (ID: ${itemId})`);
      
      res.status(200).json({
        success: true,
        message: '品目が正常に削除されました'
      });
    } catch (error) {
      console.error(`[deleteItem] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * アクティブ品目一覧取得
 * @route GET /api/items/active
 * @access All authenticated users
 */
export const getActiveItems = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    console.log(`[getActiveItems] ユーザー: ${req.user?.username}, アクティブ品目一覧取得開始`);

    // 認証チェック
    if (!req.user) {
      console.log('[getActiveItems] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    try {
      const result = await itemService.getActiveItems();

      console.log(`[getActiveItems] 成功: ${result.length}件のアクティブ品目を取得しました`);
      
      res.status(200).json({
        success: true,
        message: 'アクティブ品目一覧を正常に取得しました',
        data: result
      });
    } catch (error) {
      console.error(`[getActiveItems] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 品目検索
 * @route GET /api/items/search
 * @access All authenticated users
 */
export const searchItems = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const query = req.query.query as string;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    
    console.log(`[searchItems] ユーザー: ${req.user?.username}, 品目検索開始 (クエリ: "${query}")`);

    // 認証チェック
    if (!req.user) {
      console.log('[searchItems] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: '検索クエリは必須です',
        data: []
      });
      return;
    }

    try {
      const result = await itemService.searchItems(query.trim(), limit);

      console.log(`[searchItems] 成功: ${result.length}件の品目が見つかりました`);
      
      res.status(200).json({
        success: true,
        message: '品目検索が正常に完了しました',
        data: result
      });
    } catch (error) {
      console.error(`[searchItems] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 表示順序更新
 * @route PATCH /api/items/:id/display-order
 * @access Admin, Manager
 */
export const updateDisplayOrder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const itemId = req.params.id;
    const { displayOrder } = req.body;
    
    console.log(`[updateDisplayOrder] ユーザー: ${req.user?.username}, 表示順序更新開始 (ID: ${itemId})`);

    // 認証チェック
    if (!req.user) {
      console.log('[updateDisplayOrder] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      console.log(`[updateDisplayOrder] 権限エラー: ${req.user.username} (${req.user.role}) には表示順序更新権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    // バリデーション
    if (displayOrder === undefined || !Number.isInteger(Number(displayOrder))) {
      res.status(400).json({
        success: false,
        message: '表示順序は整数である必要があります'
      });
      return;
    }

    try {
      const result = await itemService.updateDisplayOrder(itemId, Number(displayOrder));

      console.log(`[updateDisplayOrder] 成功: 品目「${result.name}」の表示順序を${result.displayOrder}に更新しました`);
      
      res.status(200).json({
        success: true,
        message: '表示順序が正常に更新されました',
        data: result
      });
    } catch (error) {
      console.error(`[updateDisplayOrder] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 表示順序一括更新
 * @route PATCH /api/items/bulk-display-order
 * @access Admin, Manager
 */
export const bulkUpdateDisplayOrder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    console.log(`[bulkUpdateDisplayOrder] ユーザー: ${req.user?.username}, 表示順序一括更新開始`);

    // 認証チェック
    if (!req.user) {
      console.log('[bulkUpdateDisplayOrder] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      console.log(`[bulkUpdateDisplayOrder] 権限エラー: ${req.user.username} (${req.user.role}) には表示順序更新権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    const { itemOrders } = req.body;

    // バリデーション
    if (!Array.isArray(itemOrders) || itemOrders.length === 0) {
      res.status(400).json({
        success: false,
        message: '品目順序データが無効です'
      });
      return;
    }

    for (const item of itemOrders) {
      if (!item.id || !Number.isInteger(Number(item.displayOrder))) {
        res.status(400).json({
          success: false,
          message: '品目IDまたは表示順序が無効です'
        });
        return;
      }
    }

    try {
      await itemService.bulkUpdateDisplayOrder(itemOrders.map((item: any) => ({
        id: item.id,
        displayOrder: Number(item.displayOrder)
      })));

      console.log(`[bulkUpdateDisplayOrder] 成功: ${itemOrders.length}件の品目表示順序を一括更新しました`);
      
      res.status(200).json({
        success: true,
        message: '表示順序が正常に一括更新されました'
      });
    } catch (error) {
      console.error(`[bulkUpdateDisplayOrder] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 品目統計取得
 * @route GET /api/items/:id/stats
 * @access Manager, Admin
 */
export const getItemStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const itemId = req.params.id;
    const { startDate, endDate } = req.query;
    
    console.log(`[getItemStats] ユーザー: ${req.user?.username}, 品目統計取得開始 (ID: ${itemId})`);

    // 認証チェック
    if (!req.user) {
      console.log('[getItemStats] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック（統計情報は管理者とマネージャーのみ）
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      console.log(`[getItemStats] 権限エラー: ${req.user.username} (${req.user.role}) には統計情報取得権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    try {
      const result = await itemService.getItemStats(
        itemId,
        startDate as string,
        endDate as string
      );

      console.log(`[getItemStats] 成功: 品目「${result.itemInfo.name}」の統計情報を取得しました`);
      
      res.status(200).json({
        success: true,
        message: '品目統計が正常に取得されました',
        data: result
      });
    } catch (error) {
      console.error(`[getItemStats] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 使用頻度順品目一覧取得
 * @route GET /api/items/usage-frequency
 * @access Manager, Admin
 */
export const getItemsByUsageFrequency = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const { startDate, endDate } = req.query;
    
    console.log(`[getItemsByUsageFrequency] ユーザー: ${req.user?.username}, 使用頻度順品目一覧取得開始`);

    // 認証チェック
    if (!req.user) {
      console.log('[getItemsByUsageFrequency] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      console.log(`[getItemsByUsageFrequency] 権限エラー: ${req.user.username} (${req.user.role}) には使用統計取得権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    try {
      const result = await itemService.getItemsByUsageFrequency(
        limit,
        startDate as string,
        endDate as string
      );

      console.log(`[getItemsByUsageFrequency] 成功: ${result.length}件の使用頻度統計を取得しました`);
      
      res.status(200).json({
        success: true,
        message: '使用頻度順品目一覧を正常に取得しました',
        data: result
      });
    } catch (error) {
      console.error(`[getItemsByUsageFrequency] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 品目ステータス切り替え
 * @route PATCH /api/items/:id/toggle-status
 * @access Admin only
 */
export const toggleItemStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const itemId = req.params.id;
    
    console.log(`[toggleItemStatus] ユーザー: ${req.user?.username}, 品目ステータス切り替え開始 (ID: ${itemId})`);

    // 認証チェック
    if (!req.user) {
      console.log('[toggleItemStatus] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック（管理者のみ）
    if (req.user.role !== 'ADMIN') {
      console.log(`[toggleItemStatus] 権限エラー: ${req.user.username} (${req.user.role}) にはステータス変更権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    try {
      const result = await itemService.toggleItemStatus(itemId);

      console.log(`[toggleItemStatus] 成功: 品目「${result.name}」のステータスを${result.isActive ? 'アクティブ' : '非アクティブ'}に変更しました`);
      
      res.status(200).json({
        success: true,
        message: '品目ステータスが正常に更新されました',
        data: result
      });
    } catch (error) {
      console.error(`[toggleItemStatus] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * カテゴリ一覧取得
 * @route GET /api/items/categories
 * @access All authenticated users
 */
export const getCategories = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    console.log(`[getCategories] ユーザー: ${req.user?.username}, カテゴリ一覧取得開始`);

    // 認証チェック
    if (!req.user) {
      console.log('[getCategories] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    try {
      const result = await itemService.getCategories();

      console.log(`[getCategories] 成功: ${result.length}件のカテゴリを取得しました`);
      
      res.status(200).json({
        success: true,
        message: 'カテゴリ一覧を正常に取得しました',
        data: result
      });
    } catch (error) {
      console.error(`[getCategories] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * 品目使用統計取得（getItemStatsのエイリアス）
 * @route GET /api/items/:id/usage-stats
 * @access Manager, Admin
 */
export const getItemUsageStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const itemId = req.params.id;
    const { startDate, endDate } = req.query;
    
    console.log(`[getItemUsageStats] ユーザー: ${req.user?.username}, 品目使用統計取得開始 (ID: ${itemId})`);

    // 認証チェック
    if (!req.user) {
      console.log('[getItemUsageStats] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 権限チェック
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      console.log(`[getItemUsageStats] 権限エラー: ${req.user.username} (${req.user.role}) には使用統計取得権限がありません`);
      res.status(403).json({
        success: false,
        message: 'この操作を実行する権限がありません'
      });
      return;
    }

    try {
      const result = await itemService.getItemUsageStats(itemId, {
        startDate: startDate as string,
        endDate: endDate as string
      });

      console.log(`[getItemUsageStats] 成功: 品目「${result.itemInfo.name}」の使用統計を取得しました`);
      
      res.status(200).json({
        success: true,
        message: '品目使用統計が正常に取得されました',
        data: result
      });
    } catch (error) {
      console.error(`[getItemUsageStats] エラー: ${error}`);
      next(error);
    }
  }
);

/**
 * よく使用される品目取得（運転手用）
 * @route GET /api/items/frequently-used
 * @access All authenticated users
 */
export const getFrequentlyUsedItems = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const driverId = req.query.driverId as string;
    
    console.log(`[getFrequentlyUsedItems] ユーザー: ${req.user?.username}, よく使用される品目取得開始`);

    // 認証チェック
    if (!req.user) {
      console.log('[getFrequentlyUsedItems] 認証エラー: ユーザーが認証されていません');
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    // 運転手が他の運転手のデータにアクセスしようとしている場合は拒否
    if (req.user.role === 'DRIVER' && driverId && driverId !== req.user.userId) {
      console.log(`[getFrequentlyUsedItems] 権限エラー: 運転手は自分のデータのみ取得可能です`);
      res.status(403).json({
        success: false,
        message: '他の運転手のデータにはアクセスできません'
      });
      return;
    }

    try {
      const effectiveDriverId = req.user.role === 'DRIVER' ? req.user.userId : driverId;
      const result = await itemService.getFrequentlyUsedItems(effectiveDriverId, limit);

      console.log(`[getFrequentlyUsedItems] 成功: ${result.length}件のよく使用される品目を取得しました`);
      
      res.status(200).json({
        success: true,
        message: 'よく使用される品目一覧を正常に取得しました',
        data: result
      });
    } catch (error) {
      console.error(`[getFrequentlyUsedItems] エラー: ${error}`);
      next(error);
    }
  }
);