// backend/src/controllers/reportController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ReportService } from '../services/reportService';
import { 
  AuthenticatedRequest, 
  ReportType,
  ReportFormat,
  ReportFilter,
  UserRole 
} from '../types';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler';
import { validate, reportValidation } from '../utils/validation';

const prisma = new PrismaClient();
const reportService = new ReportService();

/**
 * 帳票一覧取得
 * GET /api/v1/reports
 */
export const getAllReports = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const filter: ReportFilter = {
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    sortBy: req.query.sortBy as string || 'createdAt',
    sortOrder: req.query.sortOrder as 'asc' | 'desc' || 'desc',
    reportType: req.query.reportType as ReportType,
    status: req.query.status as string,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    createdById: req.query.createdById as string
  };

  // 運転手は自分が作成した帳票のみ取得可能
  if (req.user.role === UserRole.DRIVER) {
    filter.createdById = req.user.id;
  }

  const reports = await reportService.getReports(filter, req.user.id, req.user.role);

  return sendSuccess(res, reports, '帳票一覧を取得しました', 200);
});

/**
 * 帳票詳細取得
 * GET /api/v1/reports/:id
 */
export const getReportById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '帳票IDが必要です', 400);
  }

  const report = await reportService.getReportById(id, req.user.id, req.user.role);

  return sendSuccess(res, report, '帳票詳細を取得しました', 200);
});

/**
 * 日次運行報告書生成
 * POST /api/v1/reports/daily-operation
 */
export const generateDailyOperationReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(reportValidation.dailyOperation, req.body);

  const { 
    targetDate, 
    format = ReportFormat.PDF,
    driverId,
    vehicleId,
    includeGpsData = false,
    includeInspections = true 
  } = validatedData;

  const report = await reportService.generateDailyOperationReport({
    targetDate,
    format,
    driverId,
    vehicleId,
    includeGpsData,
    includeInspections,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  return sendSuccess(res, report, '日次運行報告書を生成しました', 201);
});

/**
 * 月次運行報告書生成
 * POST /api/v1/reports/monthly-operation
 */
export const generateMonthlyOperationReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(reportValidation.monthlyOperation, req.body);

  const { 
    year, 
    month, 
    format = ReportFormat.PDF,
    driverId,
    vehicleId,
    includeStatistics = true 
  } = validatedData;

  const report = await reportService.generateMonthlyOperationReport({
    year,
    month,
    format,
    driverId,
    vehicleId,
    includeStatistics,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  return sendSuccess(res, report, '月次運行報告書を生成しました', 201);
});

/**
 * 車両稼働報告書生成
 * POST /api/v1/reports/vehicle-utilization
 */
export const generateVehicleUtilizationReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(reportValidation.vehicleUtilization, req.body);

  const { 
    startDate, 
    endDate, 
    format = ReportFormat.PDF,
    vehicleIds,
    includeMaintenanceData = true 
  } = validatedData;

  const report = await reportService.generateVehicleUtilizationReport({
    startDate,
    endDate,
    format,
    vehicleIds,
    includeMaintenanceData,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  return sendSuccess(res, report, '車両稼働報告書を生成しました', 201);
});

/**
 * 運転手実績報告書生成
 * POST /api/v1/reports/driver-performance
 */
export const generateDriverPerformanceReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(reportValidation.driverPerformance, req.body);

  const { 
    startDate, 
    endDate, 
    format = ReportFormat.PDF,
    driverIds,
    includeGpsAnalysis = false 
  } = validatedData;

  // 運転手は自分の実績報告書のみ生成可能
  if (req.user.role === UserRole.DRIVER) {
    validatedData.driverIds = [req.user.id];
  }

  const report = await reportService.generateDriverPerformanceReport({
    startDate,
    endDate,
    format,
    driverIds: validatedData.driverIds,
    includeGpsAnalysis,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  return sendSuccess(res, report, '運転手実績報告書を生成しました', 201);
});

/**
 * 運送実績報告書生成
 * POST /api/v1/reports/transportation-summary
 */
export const generateTransportationSummaryReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // 管理者・マネージャーのみ生成可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return sendError(res, '運送実績報告書生成の権限がありません', 403);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(reportValidation.transportationSummary, req.body);

  const { 
    year, 
    month, 
    format = ReportFormat.PDF,
    groupBy = 'ITEM',
    includeLocationBreakdown = true 
  } = validatedData;

  const report = await reportService.generateTransportationSummaryReport({
    year,
    month,
    format,
    groupBy,
    includeLocationBreakdown,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  return sendSuccess(res, report, '運送実績報告書を生成しました', 201);
});

/**
 * 点検報告書生成
 * POST /api/v1/reports/inspection-summary
 */
export const generateInspectionSummaryReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(reportValidation.inspectionSummary, req.body);

  const { 
    startDate, 
    endDate, 
    format = ReportFormat.PDF,
    vehicleIds,
    inspectionType,
    includeIssuesOnly = false 
  } = validatedData;

  const report = await reportService.generateInspectionSummaryReport({
    startDate,
    endDate,
    format,
    vehicleIds,
    inspectionType,
    includeIssuesOnly,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  return sendSuccess(res, report, '点検報告書を生成しました', 201);
});

/**
 * カスタム帳票生成
 * POST /api/v1/reports/custom
 */
export const generateCustomReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  // 管理者・マネージャーのみ生成可能
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return sendError(res, 'カスタム帳票生成の権限がありません', 403);
  }

  // リクエストデータのバリデーション
  const validatedData = validate(reportValidation.custom, req.body);

  const report = await reportService.generateCustomReport({
    ...validatedData,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  return sendSuccess(res, report, 'カスタム帳票を生成しました', 201);
});

/**
 * 帳票ダウンロード
 * GET /api/v1/reports/:id/download
 */
export const downloadReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '帳票IDが必要です', 400);
  }

  const { filePath, fileName, mimeType } = await reportService.getReportFile(
    id,
    req.user.id,
    req.user.role
  );

  // ファイルダウンロード用のレスポンス設定
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  
  return res.download(filePath, fileName);
});

/**
 * 帳票プレビュー
 * GET /api/v1/reports/:id/preview
 */
export const previewReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '帳票IDが必要です', 400);
  }

  const preview = await reportService.getReportPreview(id, req.user.id, req.user.role);

  return sendSuccess(res, preview, '帳票プレビューを取得しました', 200);
});

/**
 * 帳票削除
 * DELETE /api/v1/reports/:id
 */
export const deleteReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '帳票IDが必要です', 400);
  }

  await reportService.deleteReport(id, req.user.id, req.user.role);

  return sendSuccess(res, null, '帳票を削除しました', 200);
});

/**
 * 帳票生成状況確認
 * GET /api/v1/reports/:id/status
 */
export const getReportStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, '帳票IDが必要です', 400);
  }

  const status = await reportService.getReportStatus(id, req.user.id, req.user.role);

  return sendSuccess(res, status, '帳票生成状況を取得しました', 200);
});

/**
 * 帳票テンプレート一覧取得
 * GET /api/v1/reports/templates
 */
export const getReportTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401);
  }

  const templates = await reportService.getReportTemplates(req.user.role);

  return sendSuccess(res, templates, '帳票テンプレート一覧を取得しました', 200);
});