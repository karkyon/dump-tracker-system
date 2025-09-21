import { Request, Response } from 'express';
import { PrismaClient, InspectionType } from '@prisma/client';
import { InspectionService } from '../services/inspectionService';
import { 
  InspectionItemModel,
  InspectionItemResultModel,
  InspectionRecordModel,
  VehicleModel,
  UserModel 
} from '../types';
import { AuthenticatedRequest } from '../types/auth';
import { AppError } from '../middleware/errorHandler';

// PrismaClientの単一初期化
const prisma = new PrismaClient();
const inspectionService = new InspectionService();

// asyncHandlerを安全にインポート
const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ロガーの安全なインポート
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || '')
};

/**
 * 成功レスポンスを送信する汎用関数
 */
const sendSuccess = (res: Response, data: any, message: string, statusCode: number = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * エラーレスポンスを送信する汎用関数
 */
const sendError = (res: Response, message: string, statusCode: number = 400, errorCode?: string) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: errorCode || 'ERROR'
  });
};

/**
 * バリデーション用の簡易関数
 */
const validateRequestData = (data: any, requiredFields: string[] = []): boolean => {
  if (!data || typeof data !== 'object') return false;
  
  for (const field of requiredFields) {
    if (!data[field]) {
      return false;
    }
  }
  
  return true;
};

/**
 * Prismaクライアントが利用可能かチェック
 */
const checkPrismaAvailable = (): boolean => {
  return prisma !== null;
};

/**
 * 点検項目一覧取得
 * GET /api/v1/inspections/items
 */
export const getAllInspectionItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  try {
    const { 
      page = 1, 
      limit = 50, 
      inspection_type, 
      is_active = 'true',
      sort_by = 'displayOrder'  // ✅ 修正: display_order -> displayOrder
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (inspection_type) {
      where.inspectionType = inspection_type;  // ✅ 修正: inspection_type -> inspectionType
    }

    if (is_active !== undefined) {
      where.isActive = is_active === 'true';
    }

    const [items, total] = await Promise.all([
      // ✅ 修正: inspectionItemResult -> inspectionItem
      prisma.inspectionItem.findMany({
        where,
        orderBy: { [sort_by as string]: 'asc' },
        skip,
        take: Number(limit)
      }),
      prisma.inspectionItem.count({ where })  // ✅ 修正: inspectionItemResult -> inspectionItem
    ]);

    return sendSuccess(res, {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    }, '点検項目一覧を取得しました');
  } catch (error) {
    logger.error('点検項目一覧取得エラー:', error);
    return sendError(res, '点検項目一覧の取得に失敗しました', 500);
  }
});

/**
 * 点検項目詳細取得
 * GET /api/v1/inspections/items/:id
 */
export const getInspectionItemById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, '点検項目IDが必要です', 400);
    }

    const item = await prisma.inspectionItem.findUnique({
      where: { id }
    });

    if (!item) {
      return sendError(res, '点検項目が見つかりません', 404);
    }

    return sendSuccess(res, item, '点検項目詳細を取得しました');
  } catch (error) {
    logger.error('点検項目詳細取得エラー:', error);
    return sendError(res, '点検項目詳細の取得に失敗しました', 500);
  }
});

/**
 * 点検項目新規作成
 * POST /api/v1/inspections/items
 */
export const createInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  // 管理者・マネージャーのみ作成可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return sendError(res, '点検項目作成の権限がありません', 403);
  }

  try {
    const { name, description, inspection_type, input_type, category, is_required, display_order } = req.body;

    if (!validateRequestData(req.body, ['name', 'inspection_type'])) {
      return sendError(res, '必須項目が不足しています', 400);
    }

    // 表示順序の重複チェック・自動設定
    let finalDisplayOrder = display_order;
    if (!finalDisplayOrder) {
      const maxOrder = await prisma.inspectionItem.aggregate({
        _max: {
          displayOrder: true
        }
      });
      finalDisplayOrder = (maxOrder._max.displayOrder || 0) + 1;
    }

    const item = await prisma.inspectionItem.create({
      data: {
        name,
        description,
        inspectionType: inspection_type as InspectionType,
        inputType: input_type || 'TEXT',
        category,
        isRequired: is_required || false,
        displayOrder: finalDisplayOrder,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return sendSuccess(res, item, '点検項目を作成しました', 201);
  } catch (error) {
    logger.error('点検項目作成エラー:', error);
    return sendError(res, '点検項目の作成に失敗しました', 500);
  }
});

/**
 * 点検項目更新
 * PUT /api/v1/inspections/items/:id
 */
export const updateInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  // 管理者・マネージャーのみ更新可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return sendError(res, '点検項目更新の権限がありません', 403);
  }

  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (!id) {
      return sendError(res, '点検項目IDが必要です', 400);
    }

    // 既存項目の存在確認
    const existingItem = await prisma.inspectionItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return sendError(res, '点検項目が見つかりません', 404);
    }

    // 更新日時を設定
    updateData.updated_at = new Date();

    const item = await prisma.inspectionItem.update({
      where: { id },
      data: updateData
    });

    return sendSuccess(res, item, '点検項目を更新しました');
  } catch (error) {
    logger.error('点検項目更新エラー:', error);
    return sendError(res, '点検項目の更新に失敗しました', 500);
  }
});

/**
 * 点検項目削除（論理削除）
 * DELETE /api/v1/inspections/items/:id
 */
export const deleteInspectionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  // 管理者のみ削除可能
  if (req.user.role !== 'ADMIN') {
    return sendError(res, '点検項目削除の権限がありません', 403);
  }

  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, '点検項目IDが必要です', 400);
    }

    // 既存項目の存在確認
    const existingItem = await prisma.inspectionItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return sendError(res, '点検項目が見つかりません', 404);
    }

    // 論理削除
    await prisma.inspectionItem.update({
      where: { id },
      data: { 
        isActive: false,
        updatedAt: new Date()
      }
    });

    return sendSuccess(res, null, '点検項目を削除しました');
  } catch (error) {
    logger.error('点検項目削除エラー:', error);
    return sendError(res, '点検項目の削除に失敗しました', 500);
  }
});

/**
 * 点検記録一覧取得
 * GET /api/v1/inspections/records
 */
export const getAllInspectionRecords = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  try {
    const { 
      page = 1, 
      limit = 20, 
      vehicle_id,
      inspector_id,
      inspection_type,
      status,
      date_from,
      date_to
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    // ✅ 修正: フィールド名をキャメルケースに統一
    if (vehicle_id) where.vehicleId = vehicle_id;
    if (inspector_id) where.inspectorId = inspector_id;
    if (inspection_type) where.inspectionType = inspection_type;
    if (status) where.status = status;

    // ✅ 修正: 日付範囲フィルター
    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) where.createdAt.gte = new Date(date_from as string);
      if (date_to) where.createdAt.lte = new Date(date_to as string);
    }

    // ✅ 修正: 権限に基づくフィルター
    if (req.user.role === 'DRIVER') {
      where.inspectorId = req.user.userId;
    }

    const [records, total] = await Promise.all([
      prisma.inspectionRecord.findMany({
        where,
        include: {
          users: {
            select: { id: true, name: true, email: true }
          },
          vehicles: {
            select: { id: true, plateNumber: true, model: true }
          },
          inspectionItemResults: {
            include: {
              inspectionItems: {
                select: { id: true, name: true, inspectionType: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.inspectionRecord.count({ where })
    ]);

    return sendSuccess(res, {
      records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    }, '点検記録一覧を取得しました');
  } catch (error) {
    logger.error('点検記録一覧取得エラー:', error);
    return sendError(res, '点検記録一覧の取得に失敗しました', 500);
  }
});

/**
 * 点検記録詳細取得
 * GET /api/v1/inspections/records/:id
 */
export const getInspectionRecordById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, '点検記録IDが必要です', 400);
    }

    const record = await prisma.inspectionRecord.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        vehicles: {
          select: { id: true, plateNumber: true, model: true }
        },
        operations: {
          select: { id: true, status: true, plannedStartTime: true }
        },
        inspectionItemResults: {
          include: {
            inspectionItems: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!record) {
      return sendError(res, '点検記録が見つかりません', 404);
    }

    // 権限チェック（ドライバーは自分の記録のみ）
    if (req.user.role === 'DRIVER' && record.inspectorId !== req.user.userId) {
      return sendError(res, '点検記録へのアクセス権限がありません', 403);
    }

    return sendSuccess(res, record, '点検記録詳細を取得しました');
  } catch (error) {
    logger.error('点検記録詳細取得エラー:', error);
    return sendError(res, '点検記録詳細の取得に失敗しました', 500);
  }
});

/**
 * 点検記録新規作成
 * POST /api/v1/inspections/records
 */
export const createInspectionRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  try {
    const { 
      vehicle_id, 
      operation_id, 
      inspection_type, 
      latitude, 
      longitude, 
      location_name, 
      weather_condition, 
      temperature 
    } = req.body;

    if (!validateRequestData(req.body, ['vehicle_id', 'inspection_type'])) {
      return sendError(res, '必須項目が不足しています', 400);
    }

    // 車両の存在確認
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle_id }
    });

    if (!vehicle) {
      return sendError(res, '指定された車両が見つかりません', 404);
    }

    const record = await prisma.inspectionRecord.create({
      data: {
        vehicleId: vehicle_id,
        inspectorId: req.user.userId,
        operationId: operation_id || null,
        inspectionType: inspection_type as InspectionType,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        latitude,
        longitude,
        locationName: location_name,
        weatherCondition: weather_condition,
        temperature,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return sendSuccess(res, record, '点検記録を作成しました', 201);
  } catch (error) {
    logger.error('点検記録作成エラー:', error);
    return sendError(res, '点検記録の作成に失敗しました', 500);
  }
});

/**
 * 点検記録更新
 * PUT /api/v1/inspections/records/:id
 */
export const updateInspectionRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (!id) {
      return sendError(res, '点検記録IDが必要です', 400);
    }

    // 既存記録の存在確認
    const existingRecord = await prisma.inspectionRecord.findUnique({
      where: { id }
    });

    if (!existingRecord) {
      return sendError(res, '点検記録が見つかりません', 404);
    }

    // 権限チェック（ドライバーは自分の記録のみ、管理者・マネージャーは全て）
    if (req.user.role === 'DRIVER' && existingRecord.inspectorId !== req.user.userId) {
      return sendError(res, '点検記録の更新権限がありません', 403);
    }

    // 完了時の処理
    if (updateData.status === 'COMPLETED' && !existingRecord.completedAt) {
      updateData.completedAt = new Date();
    }

    updateData.updatedAt = new Date();

    const record = await prisma.inspectionRecord.update({
      where: { id },
      data: updateData
    });

    return sendSuccess(res, record, '点検記録を更新しました');
  } catch (error) {
    logger.error('点検記録更新エラー:', error);
    return sendError(res, '点検記録の更新に失敗しました', 500);
  }
});

/**
 * 点検記録削除
 * DELETE /api/v1/inspections/records/:id
 */
export const deleteInspectionRecord = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  // 管理者のみ削除可能
  if (req.user.role !== 'ADMIN') {
    return sendError(res, '点検記録削除の権限がありません', 403);
  }

  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, '点検記録IDが必要です', 400);
    }

    // 既存記録の存在確認
    const existingRecord = await prisma.inspectionRecord.findUnique({
      where: { id },
      include: {
        inspectionItemResults: true
      }
    });

    if (!existingRecord) {
      return sendError(res, '点検記録が見つかりません', 404);
    }

    // 関連する結果データも削除
    await prisma.$transaction([
      prisma.inspectionItemResult.deleteMany({
        where: { inspectionRecordId: id }
      }),
      prisma.inspectionRecord.delete({
        where: { id }
      })
    ]);

    return sendSuccess(res, null, '点検記録を削除しました');
  } catch (error) {
    logger.error('点検記録削除エラー:', error);
    return sendError(res, '点検記録の削除に失敗しました', 500);
  }
});

/**
 * 車両別点検統計取得
 * GET /api/v1/inspections/statistics/:vehicleId
 */
export const getInspectionStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  if (!checkPrismaAvailable()) {
    return sendError(res, 'データベース接続エラー', 500);
  }

  try {
    const { vehicleId } = req.params;
    const { period = '30' } = req.query; // デフォルトは過去30日

    if (!vehicleId) {
      return sendError(res, '車両IDが必要です', 400);
    }

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - Number(period));

    const [totalRecords, completedRecords, defectsCount, averageTime] = await Promise.all([
      // 総点検回数
      prisma.inspectionRecord.count({
        where: {
          vehicleId: vehicleId,
          createdAt: { gte: dateFrom }
        }
      }),
      // 完了した点検回数
      prisma.inspectionRecord.count({
        where: {
          vehicleId: vehicleId,
          status: 'COMPLETED',
          createdAt: { gte: dateFrom }
        }
      }),
      // 不具合発見回数
      prisma.inspectionRecord.count({
        where: {
          vehicleId: vehicleId,
          overallResult: false,
          createdAt: { gte: dateFrom }
        }
      }),
      // 平均点検時間の計算
      prisma.inspectionRecord.findMany({
        where: {
          vehicleId: vehicleId,
          status: 'COMPLETED',
          startedAt: { not: null },
          completedAt: { not: null },
          createdAt: { gte: dateFrom }
        },
        select: {
          startedAt: true,
          completedAt: true
        }
      })
    ]);

    // 平均点検時間を計算
    let avgInspectionTime = 0;
    const completedTimes = averageTime as { startedAt: Date; completedAt: Date }[];
    if (Array.isArray(completedTimes) && completedTimes.length > 0) {
      const totalTime: number = completedTimes.reduce((sum: number, record: { startedAt: Date; completedAt: Date }) => {
        if (record && record.startedAt && record.completedAt) {
          return sum + (record.completedAt.getTime() - record.startedAt.getTime());
        }
        return sum;
      }, 0);
      avgInspectionTime = Math.round(totalTime / completedTimes.length / (1000 * 60)); // 分単位
    }

    const statistics = {
      period: Number(period),
      totalRecords,
      completedRecords,
      defectsCount,
      completionRate: totalRecords > 0 ? Math.round((completedRecords / totalRecords) * 100) : 0,
      defectRate: completedRecords > 0 ? Math.round((defectsCount / completedRecords) * 100) : 0,
      averageInspectionTime: avgInspectionTime
    };

    return sendSuccess(res, statistics, '点検統計を取得しました');
  } catch (error) {
    logger.error('点検統計取得エラー:', error);
    return sendError(res, '点検統計の取得に失敗しました', 500);
  }
});

export default {
  getAllInspectionItems,
  getInspectionItemById,
  createInspectionItem,
  updateInspectionItem,
  deleteInspectionItem,
  getAllInspectionRecords,
  getInspectionRecordById,
  createInspectionRecord,
  updateInspectionRecord,
  deleteInspectionRecord,
  getInspectionStatistics
};