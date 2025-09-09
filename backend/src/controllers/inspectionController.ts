// backend/src/controllers/inspectionController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { InspectionService } from '../services/inspectionService';
import { 
  AuthenticatedRequest, 
  CreateInspectionItemRequest, 
  UpdateInspectionItemRequest,
  CreateInspectionRecordRequest,
  InspectionFilter,
  UserRole 
} from '../types';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler';
import { validate, inspectionValidation } from '../utils/validation';

const prisma = new PrismaClient();
const inspectionService = new InspectionService();

/**
 * 点検項目一覧取得
 * GET /api/v1/inspections/items
 */
export const getAllInspectionItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { 
    page = 1, 
    limit = 50, 
    inspectionType, 
    isActive = true,
    sortBy = 'displayOrder' 
  } = req.query;

  const items = await inspectionService.getInspectionItems({
    page: Number(page),
    limit: Number(limit),
    inspectionType: inspectionType as string,
    isActive: isActive === 'true',
    sortBy: sortBy as string
  });

  return sendSuccess(res, items, '点検項目一覧を取得しました', 200);
});

/**
 * 点検項目詳細取得
 * GET /api/v1/inspections/items/:id
 */
export const getInspectionItemById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '点検項目IDが必要です', 400);
  }

  const item = await inspectionService.getInspectionItemById(id);

  return sendSuccess(res, item, '点検項目詳細を取得しました', 200);
});

/**
 * 点検項目新規作成
 * POST /api/v1/inspections/items
 */
export const createInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // 管理者・マネージャーのみ作成可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return sendError(res, '点検項目作成の権限がありません', 403);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(inspectionValidation.createItem, req.body);

  const item = await inspectionService.createInspectionItem(validatedData);

  return sendSuccess(res, item, '点検項目を作成しました', 201);
});

/**
 * 点検項目更新
 * PUT /api/v1/inspections/items/:id
 */
export const updateInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // 管理者・マネージャーのみ更新可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return sendError(res, '点検項目更新の権限がありません', 403);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '点検項目IDが必要です', 400);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(inspectionValidation.updateItem, req.body);

  const item = await inspectionService.updateInspectionItem(id, validatedData);

  return sendSuccess(res, item, '点検項目を更新しました', 200);
});

/**
 * 点検項目削除（論理削除）
 * DELETE /api/v1/inspections/items/:id
 */
export const deleteInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // 管理者のみ削除可能
  if (req.user.role !== UserRole.ADMIN) {
    return sendError(res, '点検項目削除の権限がありません', 403);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '点検項目IDが必要です', 400);
  }

  await inspectionService.deleteInspectionItem(id);

  return sendSuccess(res, null, '点検項目を削除しました', 200);
});

/**
 * 点検項目表示順更新
 * PUT /api/v1/inspections/items/order
 */
export const updateInspectionItemOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // 管理者・マネージャーのみ更新可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return sendError(res, '点検項目順序更新の権限がありません', 403);
  }

  const { items } = req.body; // { id: string, displayOrder: number }[]

  if (!Array.isArray(items)) {
    return sendError(res, '項目データが正しくありません', 400);
  }

  await inspectionService.updateInspectionItemOrder(items);

  return sendSuccess(res, null, '点検項目の表示順を更新しました', 200);
});

/**
 * 点検記録一覧取得
 * GET /api/v1/inspections/records
 */
export const getAllInspectionRecords = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const filter: InspectionFilter = {
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    sortBy: req.query.sortBy as string || 'inspectionDate',
    sortOrder: req.query.sortOrder as 'asc' | 'desc' || 'desc',
    operationId: req.query.operationId as string,
    driverId: req.query.driverId as string,
    vehicleId: req.query.vehicleId as string,
    inspectionType: req.query.inspectionType as string,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string
  };

  // 運転手は自分の点検記録のみ取得可能
  if (req.user.role === UserRole.DRIVER) {
    filter.driverId = req.user.id;
  }

  const records = await inspectionService.getInspectionRecords(filter, req.user.id, req.user.role);

  return sendSuccess(res, records, '点検記録一覧を取得しました', 200);
});

/**
 * 点検記録詳細取得
 * GET /api/v1/inspections/records/:id
 */
export const getInspectionRecordById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '点検記録IDが必要です', 400);
  }

  const record = await inspectionService.getInspectionRecordById(id, req.user.id, req.user.role);

  return sendSuccess(res, record, '点検記録詳細を取得しました', 200);
});

/**
 * 点検記録新規作成
 * POST /api/v1/inspections/records
 */
export const createInspectionRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(inspectionValidation.createRecord, req.body);

  const recordData: CreateInspectionRecordRequest = {
    ...validatedData,
    inspectorId: req.user.id
  };

  const record = await inspectionService.createInspectionRecord(recordData);

  return sendSuccess(res, record, '点検記録を作成しました', 201);
});

/**
 * 点検記録更新
 * PUT /api/v1/inspections/records/:id
 */
export const updateInspectionRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '点検記録IDが必要です', 400);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(inspectionValidation.updateRecord, req.body);

  const record = await inspectionService.updateInspectionRecord(
    id,
    validatedData,
    req.user.id,
    req.user.role
  );

  return sendSuccess(res, record, '点検記録を更新しました', 200);
});

/**
 * 点検記録削除
 * DELETE /api/v1/inspections/records/:id
 */
export const deleteInspectionRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // 管理者のみ削除可能
  if (req.user.role !== UserRole.ADMIN) {
    return sendError(res, '点検記録削除の権限がありません', 403);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '点検記録IDが必要です', 400);
  }

  await inspectionService.deleteInspectionRecord(id);

  return sendSuccess(res, null, '点検記録を削除しました', 200);
});

/**
 * 運行別点検記録取得
 * GET /api/v1/inspections/records/operation/:operationId
 */
export const getInspectionRecordsByOperation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { operationId } = req.params;

  if (!operationId) {
    return sendError(res, '運行記録IDが必要です', 400);
  }

  const records = await inspectionService.getInspectionRecordsByOperation(
    operationId,
    req.user.id,
    req.user.role
  );

  return sendSuccess(res, records, '運行別点検記録を取得しました', 200);
});

/**
 * 点検統計取得
 * GET /api/v1/inspections/statistics
 */
export const getInspectionStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { startDate, endDate, driverId, vehicleId, inspectionType } = req.query;

  const stats = await inspectionService.getInspectionStatistics({
    startDate: startDate as string,
    endDate: endDate as string,
    driverId: driverId as string,
    vehicleId: vehicleId as string,
    inspectionType: inspectionType as string,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  return sendSuccess(res, stats, '点検統計を取得しました', 200);
});

/**
 * 点検テンプレート取得
 * GET /api/v1/inspections/template/:inspectionType
 */
export const getInspectionTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { inspectionType } = req.params;

  if (!inspectionType) {
    return sendError(res, '点検タイプが必要です', 400);
  }

  const template = await inspectionService.getInspectionTemplate(inspectionType);

  return sendSuccess(res, template, '点検テンプレートを取得しました', 200);
});