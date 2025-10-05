// =====================================
// backend/src/controllers/reportController.ts
// レポート管理コントローラー - 完全アーキテクチャ改修統合版
// 統合レポートAPI制御層・経営ダッシュボード・BI・意思決定支援
// 最終更新: 2025年9月28日
// 依存関係: middleware/auth.ts, middleware/errorHandler.ts, services/reportService.ts
// 統合基盤: 3層統合管理システム・車両・点検統合APIシステム100%活用
// =====================================

// import { Request, Response } from 'express';

// 🎯 完成済み統合基盤の100%活用（重複排除・統合版）
// import {
//   authenticateToken,
//   requireRole,
//   requireAdmin,
//   requireManager
// } from '../middleware/auth';

import { asyncHandler } from '../middleware/errorHandler';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  AppError,
  ERROR_CODES
} from '../utils/errors';

import {
  sendSuccess,
  sendError,
  sendNotFound
} from '../utils/response';

import logger from '../utils/logger';

// 🎯 types/からの統一型定義インポート（整合性確保）
import type {
  AuthenticatedRequest,
  UserRole,
  ReportType,
  ReportFormat,
  DailyOperationReportParams,
  MonthlyOperationReportParams,
  VehicleUtilizationReportParams,
  InspectionSummaryReportParams,
  TransportationSummaryReportParams,
  CustomReportParams,
  ReportGenerationResult,
  ReportFilter,
  ComprehensiveDashboardParams,
  KPIAnalysisParams,
  PredictiveAnalyticsParams
} from '../types/index';

// 🎯 完成済みサービス層との密連携（統合reportService.ts活用）
import { getReportService } from '../services/reportService';

/**
 * レポート管理コントローラー統合クラス
 *
 * 【統合基盤活用】
 * - middleware/auth.ts: 認証・権限制御完全活用
 * - middleware/errorHandler.ts: asyncHandler統一エラーハンドリング
 * - utils/response.ts: sendSuccess・sendError統一レスポンス
 * - utils/errors.ts: 統一エラー分類・適切なHTTPステータス
 *
 * 【services/reportService.ts密連携】
 * - 3層統合レポート・分析機能・BI基盤活用
 * - 企業レベル統合ダッシュボード・KPI・予測分析
 * - 車両・点検統合APIシステム（20エンドポイント）連携
 *
 * 【統合効果】
 * - 統合レポートAPI制御層・経営ダッシュボード実現
 * - HTTP制御層・業務フロー・権限制御統合
 * - 企業レベル意思決定支援・戦略分析API提供
 */

// =====================================
// サービスインスタンス初期化
// =====================================

const reportService = getReportService();

// =====================================
// 基本レポート管理API（統合版）
// =====================================

/**
 * レポート一覧取得（統合版）
 * GET /api/v1/reports
 * 権限制御: 全ロール（個人データ制限あり）
 */
export const getAllReports = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  logger.info('📊 Getting reports list', {
    userId: req.user.id,
    role: req.user.role,
    query: req.query
  });

  // フィルター解析
  const filter: ReportFilter = {
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    reportType: req.query.reportType as ReportType,
    format: req.query.format as ReportFormat,
    userId: req.user.role === UserRole.DRIVER ? req.user.id : undefined // ドライバーは自分のみ
  };

  try {
    const reports = await reportService.getReportsList(filter, req.user.id, req.user.role);

    return sendSuccess(res, {
      reports: reports.data,
      pagination: {
        page: filter.page,
        limit: filter.limit,
        total: reports.total,
        totalPages: Math.ceil(reports.total / filter.limit)
      },
      filter
    }, 'レポート一覧を取得しました');
  } catch (error) {
    logger.error('❌ Failed to get reports list', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id,
      filter
    });

    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, 'レポート一覧の取得に失敗しました', 500, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
});

/**
 * レポート詳細取得（統合版）
 * GET /api/v1/reports/:id
 * 権限制御: 全ロール（アクセス制限あり）
 */
export const getReportById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, 'レポートIDが必要です', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  logger.info('📊 Getting report details', {
    reportId: id,
    userId: req.user.id,
    role: req.user.role
  });

  try {
    const report = await reportService.getReportDetails(id, req.user.id, req.user.role);

    return sendSuccess(res, report, 'レポート詳細を取得しました');
  } catch (error) {
    logger.error('❌ Failed to get report details', {
      error: error instanceof Error ? error.message : 'Unknown error',
      reportId: id,
      userId: req.user.id
    });

    if (error instanceof NotFoundError) {
      return sendNotFound(res, 'レポートが見つかりません');
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, 'レポート詳細の取得に失敗しました', 500, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
});

// =====================================
// 日次・月次運行レポート生成API（3層統合版）
// =====================================

/**
 * 日次運行レポート生成（3層統合版）
 * POST /api/v1/reports/daily-operation
 * 権限制御: 全ロール（個人データ制限あり）
 */
export const generateDailyOperationReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  logger.info('📊 Generating daily operation report', {
    userId: req.user.id,
    role: req.user.role,
    body: req.body
  });

  try {
    // リクエストデータバリデーション
    const {
      date,
      driverId,
      vehicleId,
      format = ReportFormat.PDF,
      includeStatistics = false
    } = req.body;

    if (!date) {
      return sendError(res, '日付が必要です', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // ドライバー権限の場合、自分のデータのみアクセス可能
    const requestDriverId = req.user.role === UserRole.DRIVER ? req.user.id : driverId;

    const params: DailyOperationReportParams = {
      date: new Date(date),
      driverId: requestDriverId,
      vehicleId,
      format,
      includeStatistics,
      requesterId: req.user.id,
      requesterRole: req.user.role
    };

    const report = await reportService.generateDailyOperationReport(params);

    return sendSuccess(res, report, '日次運行レポートを生成しました', 201);
  } catch (error) {
    logger.error('❌ Failed to generate daily operation report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id,
      body: req.body
    });

    if (error instanceof ValidationError) {
      return sendError(res, error.message, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, '日次運行レポートの生成に失敗しました', 500, ERROR_CODES.REPORT_GENERATION_FAILED);
  }
});

/**
 * 月次運行レポート生成（統合経営分析版）
 * POST /api/v1/reports/monthly-operation
 * 権限制御: 管理者・マネージャー
 */
export const generateMonthlyOperationReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  // 管理者・マネージャーのみ生成可能
  if (![UserRole.ADMIN, UserRole.MANAGER].includes(req.user.role)) {
    return sendError(res, '月次レポート生成の権限がありません', 403, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  logger.info('📊 Generating monthly operation report', {
    userId: req.user.id,
    role: req.user.role,
    body: req.body
  });

  try {
    const {
      year,
      month,
      driverId,
      vehicleId,
      format = ReportFormat.PDF,
      includeStatistics = true
    } = req.body;

    if (!year || !month) {
      return sendError(res, '年・月が必要です', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const params: MonthlyOperationReportParams = {
      year,
      month,
      driverId,
      vehicleId,
      format,
      includeStatistics,
      requesterId: req.user.id,
      requesterRole: req.user.role
    };

    const report = await reportService.generateMonthlyOperationReport(params);

    return sendSuccess(res, report, '月次運行レポートを生成しました', 201);
  } catch (error) {
    logger.error('❌ Failed to generate monthly operation report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id,
      body: req.body
    });

    if (error instanceof ValidationError) {
      return sendError(res, error.message, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, '月次運行レポートの生成に失敗しました', 500, ERROR_CODES.REPORT_GENERATION_FAILED);
  }
});

// =====================================
// 車両・点検統合レポートAPI（統合版）
// =====================================

/**
 * 車両稼働レポート生成（統合版）
 * POST /api/v1/reports/vehicle-utilization
 * 権限制御: 管理者・マネージャー
 */
export const generateVehicleUtilizationReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  // 管理者・マネージャーのみ生成可能
  if (![UserRole.ADMIN, UserRole.MANAGER].includes(req.user.role)) {
    return sendError(res, '車両稼働レポート生成の権限がありません', 403, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  logger.info('📊 Generating vehicle utilization report', {
    userId: req.user.id,
    role: req.user.role,
    body: req.body
  });

  try {
    const {
      startDate,
      endDate,
      vehicleIds,
      format = ReportFormat.PDF,
      groupBy = 'DAY',
      includeMaintenanceRecords = true
    } = req.body;

    const params: VehicleUtilizationReportParams = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      vehicleIds,
      format,
      groupBy,
      includeMaintenanceRecords,
      requesterId: req.user.id,
      requesterRole: req.user.role
    };

    const report = await reportService.generateVehicleUtilizationReport(params);

    return sendSuccess(res, report, '車両稼働レポートを生成しました', 201);
  } catch (error) {
    logger.error('❌ Failed to generate vehicle utilization report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id,
      body: req.body
    });

    if (error instanceof ValidationError) {
      return sendError(res, error.message, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, '車両稼働レポートの生成に失敗しました', 500, ERROR_CODES.REPORT_GENERATION_FAILED);
  }
});

/**
 * 点検サマリーレポート生成（統合版）
 * POST /api/v1/reports/inspection-summary
 * 権限制御: 管理者・マネージャー・点検員
 */
export const generateInspectionSummaryReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  logger.info('📊 Generating inspection summary report', {
    userId: req.user.id,
    role: req.user.role,
    body: req.body
  });

  try {
    const {
      startDate,
      endDate,
      vehicleIds,
      inspectionType,
      format = ReportFormat.PDF,
      includeIssuesOnly = false
    } = req.body;

    if (!startDate || !endDate) {
      return sendError(res, '開始日・終了日が必要です', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const params: InspectionSummaryReportParams = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      vehicleIds,
      inspectionType,
      format,
      includeIssuesOnly,
      requesterId: req.user.id,
      requesterRole: req.user.role
    };

    const report = await reportService.generateInspectionSummaryReport(params);

    return sendSuccess(res, report, '点検サマリーレポートを生成しました', 201);
  } catch (error) {
    logger.error('❌ Failed to generate inspection summary report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id,
      body: req.body
    });

    if (error instanceof ValidationError) {
      return sendError(res, error.message, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, '点検サマリーレポートの生成に失敗しました', 500, ERROR_CODES.REPORT_GENERATION_FAILED);
  }
});

// =====================================
// 企業レベル統合ダッシュボード・分析API（NEW）
// =====================================

/**
 * 総合ダッシュボードレポート生成（企業レベル）
 * POST /api/v1/reports/comprehensive-dashboard
 * 権限制御: 管理者・マネージャー
 */
export const generateComprehensiveDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  // 管理者・マネージャーのみアクセス可能
  if (![UserRole.ADMIN, UserRole.MANAGER].includes(req.user.role)) {
    return sendError(res, '総合ダッシュボードへのアクセス権限がありません', 403, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  logger.info('📊 Generating comprehensive dashboard', {
    userId: req.user.id,
    role: req.user.role,
    body: req.body
  });

  try {
    const {
      period = '30days',
      startDate,
      endDate,
      format = ReportFormat.PDF,
      includeKPIs = true,
      includePredictiveAnalysis = true,
      includeCompetitiveAnalysis = false
    } = req.body;

    const params: ComprehensiveDashboardParams = {
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      format,
      includeKPIs,
      includePredictiveAnalysis,
      includeCompetitiveAnalysis,
      requesterId: req.user.id,
      requesterRole: req.user.role
    };

    const dashboard = await reportService.generateComprehensiveDashboard(params);

    return sendSuccess(res, dashboard, '総合ダッシュボードを生成しました', 201);
  } catch (error) {
    logger.error('❌ Failed to generate comprehensive dashboard', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id,
      body: req.body
    });

    if (error instanceof ValidationError) {
      return sendError(res, error.message, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, '総合ダッシュボードの生成に失敗しました', 500, ERROR_CODES.REPORT_GENERATION_FAILED);
  }
});

/**
 * KPI分析レポート生成（企業レベル）
 * POST /api/v1/reports/kpi-analysis
 * 権限制御: 管理者・マネージャー
 */
export const generateKPIAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  // 管理者・マネージャーのみアクセス可能
  if (![UserRole.ADMIN, UserRole.MANAGER].includes(req.user.role)) {
    return sendError(res, 'KPI分析へのアクセス権限がありません', 403, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  logger.info('📊 Generating KPI analysis', {
    userId: req.user.id,
    role: req.user.role,
    body: req.body
  });

  try {
    const {
      kpiTypes = ['efficiency', 'safety', 'productivity'],
      period = '30days',
      startDate,
      endDate,
      format = ReportFormat.PDF,
      includeTrends = true,
      includeBenchmarks = true,
      includeRecommendations = true
    } = req.body;

    const params: KPIAnalysisParams = {
      kpiTypes,
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      format,
      includeTrends,
      includeBenchmarks,
      includeRecommendations,
      requesterId: req.user.id,
      requesterRole: req.user.role
    };

    const kpiAnalysis = await reportService.generateKPIAnalysis(params);

    return sendSuccess(res, kpiAnalysis, 'KPI分析レポートを生成しました', 201);
  } catch (error) {
    logger.error('❌ Failed to generate KPI analysis', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id,
      body: req.body
    });

    if (error instanceof ValidationError) {
      return sendError(res, error.message, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, 'KPI分析レポートの生成に失敗しました', 500, ERROR_CODES.REPORT_GENERATION_FAILED);
  }
});

/**
 * 予測分析レポート生成（AI駆動型）
 * POST /api/v1/reports/predictive-analytics
 * 権限制御: 管理者のみ
 */
export const generatePredictiveAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  // 管理者のみアクセス可能
  if (req.user.role !== UserRole.ADMIN) {
    return sendError(res, '予測分析へのアクセス権限がありません', 403, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  logger.info('📊 Generating predictive analytics', {
    userId: req.user.id,
    role: req.user.role,
    body: req.body
  });

  try {
    const {
      analysisTypes = ['maintenance', 'demand', 'performance'],
      forecastPeriod = '90days',
      historicalPeriod = '365days',
      format = ReportFormat.PDF,
      includeConfidenceIntervals = true,
      includeActionableInsights = true
    } = req.body;

    const params: PredictiveAnalyticsParams = {
      analysisTypes,
      forecastPeriod,
      historicalPeriod,
      format,
      includeConfidenceIntervals,
      includeActionableInsights,
      requesterId: req.user.id,
      requesterRole: req.user.role
    };

    const predictiveAnalytics = await reportService.generatePredictiveAnalytics(params);

    return sendSuccess(res, predictiveAnalytics, '予測分析レポートを生成しました', 201);
  } catch (error) {
    logger.error('❌ Failed to generate predictive analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id,
      body: req.body
    });

    if (error instanceof ValidationError) {
      return sendError(res, error.message, 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, '予測分析レポートの生成に失敗しました', 500, ERROR_CODES.REPORT_GENERATION_FAILED);
  }
});

// =====================================
// レポート操作API（統合版）
// =====================================

/**
 * レポートダウンロード（統合版）
 * GET /api/v1/reports/:id/download
 * 権限制御: 全ロール（アクセス制限あり）
 */
export const downloadReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, 'レポートIDが必要です', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  logger.info('📥 Downloading report', {
    reportId: id,
    userId: req.user.id,
    role: req.user.role
  });

  try {
    const { filePath, fileName, mimeType } = await reportService.getReportFile(
      id,
      req.user.id,
      req.user.role
    );

    // ファイルダウンロード用のレスポンス設定
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    logger.info('✅ Report download initiated', {
      reportId: id,
      fileName,
      userId: req.user.id
    });

    return res.download(filePath, fileName);
  } catch (error) {
    logger.error('❌ Failed to download report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      reportId: id,
      userId: req.user.id
    });

    if (error instanceof NotFoundError) {
      return sendNotFound(res, 'レポートファイルが見つかりません');
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, 'レポートのダウンロードに失敗しました', 500, ERROR_CODES.FILE_DOWNLOAD_FAILED);
  }
});

/**
 * レポートプレビュー（統合版）
 * GET /api/v1/reports/:id/preview
 * 権限制御: 全ロール（アクセス制限あり）
 */
export const previewReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, 'レポートIDが必要です', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  logger.info('👁️ Previewing report', {
    reportId: id,
    userId: req.user.id,
    role: req.user.role
  });

  try {
    const preview = await reportService.getReportPreview(id, req.user.id, req.user.role);

    return sendSuccess(res, preview, 'レポートプレビューを取得しました');
  } catch (error) {
    logger.error('❌ Failed to preview report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      reportId: id,
      userId: req.user.id
    });

    if (error instanceof NotFoundError) {
      return sendNotFound(res, 'レポートが見つかりません');
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, 'レポートプレビューの取得に失敗しました', 500, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
});

/**
 * レポート削除（統合版）
 * DELETE /api/v1/reports/:id
 * 権限制御: 管理者・マネージャー（生成者本人のみ）
 */
export const deleteReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, 'レポートIDが必要です', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  logger.info('🗑️ Deleting report', {
    reportId: id,
    userId: req.user.id,
    role: req.user.role
  });

  try {
    await reportService.deleteReport(id, req.user.id, req.user.role);

    return sendSuccess(res, null, 'レポートを削除しました');
  } catch (error) {
    logger.error('❌ Failed to delete report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      reportId: id,
      userId: req.user.id
    });

    if (error instanceof NotFoundError) {
      return sendNotFound(res, 'レポートが見つかりません');
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, 'レポートの削除に失敗しました', 500, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
});

/**
 * レポート生成状況確認（統合版）
 * GET /api/v1/reports/:id/status
 * 権限制御: 全ロール（アクセス制限あり）
 */
export const getReportStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  const { id } = req.params;

  if (!id) {
    return sendError(res, 'レポートIDが必要です', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  logger.info('⏱️ Checking report status', {
    reportId: id,
    userId: req.user.id,
    role: req.user.role
  });

  try {
    const status = await reportService.getReportStatus(id, req.user.id, req.user.role);

    return sendSuccess(res, status, 'レポート生成状況を取得しました');
  } catch (error) {
    logger.error('❌ Failed to get report status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      reportId: id,
      userId: req.user.id
    });

    if (error instanceof NotFoundError) {
      return sendNotFound(res, 'レポートが見つかりません');
    }
    if (error instanceof AuthorizationError) {
      return sendError(res, error.message, 403, ERROR_CODES.ACCESS_DENIED);
    }
    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, 'レポート生成状況の取得に失敗しました', 500, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
});

/**
 * レポートテンプレート一覧取得（統合版）
 * GET /api/v1/reports/templates
 * 権限制御: 全ロール（権限に応じたテンプレート）
 */
export const getReportTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);
  }

  logger.info('📋 Getting report templates', {
    userId: req.user.id,
    role: req.user.role
  });

  try {
    const templates = await reportService.getReportTemplates(req.user.role);

    return sendSuccess(res, templates, 'レポートテンプレート一覧を取得しました');
  } catch (error) {
    logger.error('❌ Failed to get report templates', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user.id
    });

    if (error instanceof AppError) {
      return sendError(res, error.message, error.statusCode, error.code);
    }
    return sendError(res, 'レポートテンプレート一覧の取得に失敗しました', 500, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
});

// =====================================
// デフォルトエクスポート
// =====================================

export default {
  getAllReports,
  getReportById,
  generateDailyOperationReport,
  generateMonthlyOperationReport,
  generateVehicleUtilizationReport,
  generateInspectionSummaryReport,
  generateComprehensiveDashboard,
  generateKPIAnalysis,
  generatePredictiveAnalytics,
  downloadReport,
  previewReport,
  deleteReport,
  getReportStatus,
  getReportTemplates
};
