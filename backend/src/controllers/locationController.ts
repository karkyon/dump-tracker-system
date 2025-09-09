import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LocationService } from '../services/locationService';
import { AuthenticatedRequest, CreateLocationRequest, UpdateLocationRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();
const locationService = new LocationService();

/**
 * 全場所の一覧取得
 */
export const getAllLocations = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search,
    type,
    clientName,
    isActive,
    sortBy = 'name'
  } = req.query;
  
  const locations = await locationService.getAllLocations({
    page: Number(page),
    limit: Number(limit),
    search: search as string,
    type: type as 'LOADING' | 'UNLOADING',
    clientName: clientName as string,
    isActive: isActive ? Boolean(isActive) : undefined,
    sortBy: sortBy as string
  });
  
  res.json({
    success: true,
    data: locations
  });
});

/**
 * 場所詳細取得
 */
export const getLocationById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const location = await locationService.getLocationById(id);
  
  if (!location) {
    throw new AppError('場所が見つかりません', 404);
  }
  
  res.json({
    success: true,
    data: location
  });
});

/**
 * 場所新規作成
 */
export const createLocation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const locationData: CreateLocationRequest = req.body;
  
  const location = await locationService.createLocation({
    ...locationData,
    createdById: req.user.id
  });
  
  res.status(201).json({
    success: true,
    message: '場所を作成しました',
    data: location
  });
});

/**
 * 場所情報更新
 */
export const updateLocation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updateData: UpdateLocationRequest = req.body;
  
  // 管理者・マネージャーのみ更新可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    throw new AppError('場所更新の権限がありません', 403);
  }
  
  const location = await locationService.updateLocation(id, updateData);
  
  res.json({
    success: true,
    message: '場所情報を更新しました',
    data: location
  });
});

/**
 * 場所削除
 */
export const deleteLocation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  // 管理者のみ削除可能
  if (req.user.role !== 'ADMIN') {
    throw new AppError('場所削除の権限がありません', 403);
  }
  
  await locationService.deleteLocation(id);
  
  res.json({
    success: true,
    message: '場所を削除しました'
  });
});

/**
 * 積込場所一覧取得
 */
export const getLoadingLocations = asyncHandler(async (req: Request, res: Response) => {
  const { search, clientName, limit = 50 } = req.query;
  
  const locations = await locationService.getLocationsByType('LOADING', {
    search: search as string,
    clientName: clientName as string,
    limit: Number(limit)
  });
  
  res.json({
    success: true,
    data: locations
  });
});

/**
 * 積下場所一覧取得
 */
export const getUnloadingLocations = asyncHandler(async (req: Request, res: Response) => {
  const { search, clientName, limit = 50 } = req.query;
  
  const locations = await locationService.getLocationsByType('UNLOADING', {
    search: search as string,
    clientName: clientName as string,
    limit: Number(limit)
  });
  
  res.json({
    success: true,
    data: locations
  });
});

/**
 * GPS座標から近くの場所を検索
 */
export const getNearbyLocations = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, radius = 1000, type } = req.query;
  
  if (!latitude || !longitude) {
    throw new AppError('緯度・経度が指定されていません', 400);
  }
  
  const locations = await locationService.getNearbyLocations({
    latitude: Number(latitude),
    longitude: Number(longitude),
    radius: Number(radius),
    type: type as 'LOADING' | 'UNLOADING'
  });
  
  res.json({
    success: true,
    data: locations
  });
});

/**
 * 住所からGPS座標を取得
 */
export const geocodeAddress = asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.query;
  
  if (!address) {
    throw new AppError('住所が指定されていません', 400);
  }
  
  try {
    const coordinates = await locationService.geocodeAddress(address as string);
    
    res.json({
      success: true,
      data: coordinates
    });
  } catch (error) {
    throw new AppError('住所のジオコーディングに失敗しました', 400);
  }
});

/**
 * GPS座標から住所を取得（逆ジオコーディング）
 */
export const reverseGeocode = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude } = req.query;
  
  if (!latitude || !longitude) {
    throw new AppError('緯度・経度が指定されていません', 400);
  }
  
  try {
    const address = await locationService.reverseGeocode({
      latitude: Number(latitude),
      longitude: Number(longitude)
    });
    
    res.json({
      success: true,
      data: { address }
    });
  } catch (error) {
    throw new AppError('逆ジオコーディングに失敗しました', 400);
  }
});

/**
 * 場所の使用頻度統計取得
 */
export const getLocationUsageStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  
  const stats = await locationService.getLocationUsageStats(id, {
    startDate: startDate as string,
    endDate: endDate as string
  });
  
  res.json({
    success: true,
    data: stats
  });
});

/**
 * 顧客名一覧取得
 */
export const getClientNames = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query;
  
  const clients = await locationService.getClientNames(search as string);
  
  res.json({
    success: true,
    data: clients
  });
});

/**
 * 場所のアクティブ状態切り替え
 */
export const toggleLocationStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  // 管理者・マネージャーのみ実行可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    throw new AppError('場所状態変更の権限がありません', 403);
  }
  
  const location = await locationService.toggleLocationStatus(id);
  
  res.json({
    success: true,
    message: `場所を${location.isActive ? '有効' : '無効'}にしました`,
    data: location
  });
});