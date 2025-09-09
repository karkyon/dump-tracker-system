import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ItemService } from '../services/itemService';
import { AuthenticatedRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();
const itemService = new ItemService();

/**
 * 全品目の一覧取得
 */
export const getAllItems = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 50,
    search,
    category,
    isActive,
    sortBy = 'displayOrder'
  } = req.query;
  
  const items = await itemService.getAllItems({
    page: Number(page),
    limit: Number(limit),
    search: search as string,
    category: category as string,
    isActive: isActive ? Boolean(isActive) : undefined,
    sortBy: sortBy as string
  });
  
  res.json({
    success: true,
    data: items
  });
});

/**
 * 品目詳細取得
 */
export const getItemById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const item = await itemService.getItemById(id);
  
  if (!item) {
    throw new AppError('品目が見つかりません', 404);
  }
  
  res.json({
    success: true,
    data: item
  });
});

/**
 * 品目新規作成
 */
export const createItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, category, unit, displayOrder } = req.body;
  
  // 管理者・マネージャーのみ作成可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    throw new AppError('品目作成の権限がありません', 403);
  }
  
  const item = await itemService.createItem({
    name,
    description,
    category,
    unit,
    displayOrder
  });
  
  res.status(201).json({
    success: true,
    message: '品目を作成しました',
    data: item
  });
});

/**
 * 品目情報更新
 */
export const updateItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, category, unit, displayOrder } = req.body;
  
  // 管理者・マネージャーのみ更新可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    throw new AppError('品目更新の権限がありません', 403);
  }
  
  const item = await itemService.updateItem(id, {
    name,
    description,
    category,
    unit,
    displayOrder
  });
  
  res.json({
    success: true,
    message: '品目情報を更新しました',
    data: item
  });
});

/**
 * 品目削除
 */
export const deleteItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  // 管理者のみ削除可能
  if (req.user.role !== 'ADMIN') {
    throw new AppError('品目削除の権限がありません', 403);
  }
  
  await itemService.deleteItem(id);
  
  res.json({
    success: true,
    message: '品目を削除しました'
  });
});

/**
 * 品目表示順更新
 */
export const updateItemOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { items } = req.body; // { id: string, displayOrder: number }[]
  
  // 管理者・マネージャーのみ実行可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    throw new AppError('品目順序変更の権限がありません', 403);
  }
  
  await itemService.updateItemOrder(items);
  
  res.json({
    success: true,
    message: '品目の表示順を更新しました'
  });
});

/**
 * 品目のアクティブ状態切り替え
 */
export const toggleItemStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  // 管理者・マネージャーのみ実行可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    throw new AppError('品目状態変更の権限がありません', 403);
  }
  
  const item = await itemService.toggleItemStatus(id);
  
  res.json({
    success: true,
    message: `品目を${item.isActive ? '有効' : '無効'}にしました`,
    data: item
  });
});

/**
 * カテゴリ一覧取得
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await itemService.getCategories();
  
  res.json({
    success: true,
    data: categories
  });
});

/**
 * 品目使用統計取得
 */
export const getItemUsageStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  
  const stats = await itemService.getItemUsageStats(id, {
    startDate: startDate as string,
    endDate: endDate as string
  });
  
  res.json({
    success: true,
    data: stats
  });
});

/**
 * よく使用される品目取得（運転手用）
 */
export const getFrequentlyUsedItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { limit = 10 } = req.query;
  const driverId = req.user.role === 'DRIVER' ? req.user.id : req.query.driverId as string;
  
  const items = await itemService.getFrequentlyUsedItems(driverId, Number(limit));
  
  res.json({
    success: true,
    data: items
  });
});