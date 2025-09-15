import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { TripService } from '../services/tripService';
import { 
  OperationModel, 
  OperationDetailModel,
  OperationCreateInput,
  OperationDetailCreateInput,
  GpsLogModel,
  GpsLogCreateInput
} from '../types';
import { AuthenticatedRequest, CreateTripRequest, UpdateTripRequest } from '../types/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();
const tripService = new TripService();

/**
 * 運行記録一覧取得
 */
export const getAllTrips = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search,
    driverId,
    vehicleId,
    status,
    startDate,
    endDate,
    sortBy = 'startTime'
  } = req.query;
  
  const trips = await tripService.getAllTrips({
    page: Number(page),
    limit: Number(limit),
    search: search as string,
    driverId: driverId as string,
    vehicleId: vehicleId as string,
    status: status as any,
    startDate: startDate as string,
    endDate: endDate as string,
    sortBy: sortBy as string
  });
  
  res.json({
    success: true,
    data: trips
  });
});

/**
 * 運行記録詳細取得
 */
export const getTripById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const trip = await tripService.getTripById(id);
  
  if (!trip) {
    throw new AppError('運行記録が見つかりません', 404);
  }
  
  res.json({
    success: true,
    data: trip
  });
});

/**
 * 運行開始（Operation作成）
 */
export const startTrip = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tripData: CreateTripRequest = req.body;
  
  // 運転手は自分の運行記録のみ作成可能
  if (req.user?.role === 'DRIVER' && req.user?.id !== tripData.driverId) {
    throw new AppError('他の運転手の運行記録は作成できません', 403);
  }
  
  const trip = await tripService.startTrip(tripData, req.user?.id);
  
  res.status(201).json({
    success: true,
    message: '運行を開始しました',
    data: trip
  });
});

/**
 * 運行更新
 */
export const updateTrip = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updateData: UpdateTripRequest = req.body;
  
  const trip = await tripService.getTripById(id);
  if (!trip) {
    throw new AppError('運行記録が見つかりません', 404);
  }
  
  // 権限チェック：運転手は自分の運行記録のみ更新可能
  if (req.user?.role === 'DRIVER' && trip.driverId !== req.user?.id) {
    throw new AppError('他の運転手の運行記録は更新できません', 403);
  }
  
  const updatedTrip = await tripService.updateTrip(id, updateData);
  
  res.json({
    success: true,
    message: '運行記録を更新しました',
    data: updatedTrip
  });
});

/**
 * 運行終了
 */
export const endTrip = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { endTime, endMileage, notes } = req.body;
  
  const trip = await tripService.getTripById(id);
  if (!trip) {
    throw new AppError('運行記録が見つかりません', 404);
  }
  
  // 権限チェック
  if (req.user?.role === 'DRIVER' && trip.driverId !== req.user?.id) {
    throw new AppError('他の運転手の運行記録は終了できません', 403);
  }
  
  const endedTrip = await tripService.endTrip(id, {
    endTime: new Date(endTime),
    endMileage,
    notes
  });
  
  res.json({
    success: true,
    message: '運行を終了しました',
    data: endedTrip
  });
});

/**
 * GPS位置情報更新（GpsLog作成）
 */
export const updateGPSLocation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { latitude, longitude, speed, heading, accuracy } = req.body;
  
  const trip = await tripService.getTripById(id);
  if (!trip) {
    throw new AppError('運行記録が見つかりません', 404);
  }
  
  // 権限チェック
  if (req.user?.role === 'DRIVER' && trip.driverId !== req.user?.id) {
    throw new AppError('他の運転手の位置情報は更新できません', 403);
  }
  
  // GpsLogとして位置情報を記録
  const gpsData = await tripService.updateGPSLocation(id, {
    latitude,
    longitude,
    speedKmh: speed,
    heading,
    accuracyMeters: accuracy,
    timestamp: new Date()
  });
  
  res.json({
    success: true,
    message: '位置情報を更新しました',
    data: gpsData
  });
});

/**
 * 給油記録追加
 */
export const addFuelRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { amount, pricePerLiter, totalCost, mileage, location } = req.body;
  
  const trip = await tripService.getTripById(id);
  if (!trip) {
    throw new AppError('運行記録が見つかりません', 404);
  }
  
  // 権限チェック
  if (req.user?.role === 'DRIVER' && trip.driverId !== req.user?.id) {
    throw new AppError('他の運転手の給油記録は追加できません', 403);
  }
  
  const fuelRecord = await tripService.addFuelRecord(id, {
    amount,
    pricePerLiter,
    totalCost,
    mileage,
    location,
    timestamp: new Date()
  });
  
  res.status(201).json({
    success: true,
    message: '給油記録を追加しました',
    data: fuelRecord
  });
});

/**
 * 積込記録追加（OperationDetail作成）
 */
export const addLoadingRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { locationId, itemId, quantity, startTime, endTime, notes } = req.body;
  
  const trip = await tripService.getTripById(id);
  if (!trip) {
    throw new AppError('運行記録が見つかりません', 404);
  }
  
  // 権限チェック
  if (req.user?.role === 'DRIVER' && trip.driverId !== req.user?.id) {
    throw new AppError('他の運転手の積込記録は追加できません', 403);
  }
  
  // OperationDetailとして積込記録を作成
  const loadingRecord = await tripService.addLoadingRecord(id, {
    locationId,
    itemId,
    quantity,
    activityType: 'LOADING',
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    notes
  });
  
  res.status(201).json({
    success: true,
    message: '積込記録を追加しました',
    data: loadingRecord
  });
});

/**
 * 積下記録追加（OperationDetail作成）
 */
export const addUnloadingRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { locationId, itemId, quantity, startTime, endTime, notes } = req.body;
  
  const trip = await tripService.getTripById(id);
  if (!trip) {
    throw new AppError('運行記録が見つかりません', 404);
  }
  
  // 権限チェック
  if (req.user?.role === 'DRIVER' && trip.driverId !== req.user?.id) {
    throw new AppError('他の運転手の積下記録は追加できません', 403);
  }
  
  // OperationDetailとして積下記録を作成
  const unloadingRecord = await tripService.addUnloadingRecord(id, {
    locationId,
    itemId,
    quantity,
    activityType: 'UNLOADING',
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    notes
  });
  
  res.status(201).json({
    success: true,
    message: '積下記録を追加しました',
    data: unloadingRecord
  });
});

/**
 * 運行統計取得
 */
export const getTripStatistics = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, driverId, vehicleId } = req.query;
  
  const statistics = await tripService.getTripStatistics({
    startDate: startDate as string,
    endDate: endDate as string,
    driverId: driverId as string,
    vehicleId: vehicleId as string
  });
  
  res.json({
    success: true,
    data: statistics
  });
});

/**
 * 運転手の現在の運行記録取得
 */
export const getCurrentTrip = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const driverId = req.user?.role === 'DRIVER' ? req.user?.id : req.query.driverId as string;
  
  if (!driverId) {
    throw new AppError('運転手IDが指定されていません', 400);
  }
  
  const currentTrip = await tripService.getCurrentTripByDriver(driverId);
  
  res.json({
    success: true,
    data: currentTrip
  });
});

/**
 * 運行記録削除
 */
export const deleteTrip = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  // 管理者のみ削除可能
  if (req.user?.role !== 'ADMIN') {
    throw new AppError('運行記録削除の権限がありません', 403);
  }
  
  await tripService.deleteTrip(id);
  
  res.json({
    success: true,
    message: '運行記録を削除しました'
  });
});
