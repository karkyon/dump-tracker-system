// =====================================
// backend/src/routes/reportRoutes.ts
// レポート管理ルート - 完全アーキテクチャ改修統合版
// 統合レポートAPI実現・3層統合レポートエンドポイント・企業レベル分析API
// 最終更新: 2025年9月28日
// 依存関係: middleware/auth.ts, middleware/errorHandler.ts, controllers/reportController.ts
// 統合基盤: 車両・点検統合APIシステム・3層統合管理システム100%活用
// =====================================

import { Router } from 'express';

// 🎯 完成済み統合基盤の100%活用（重複排除・統合版）
import { 
  authenticateToken,
  requireRole,
  requireAdmin,
  requireManager,
  requireManagerOrAdmin
} from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  validateId,
  validateReportParams,
  validateDateRange,
  validatePagination
} from '../middleware/validation';
import logger from '../utils/logger';

// 🎯 統合controllerとの密連携（完全アーキテクチャ改修版）
import reportController from '../controllers/reportController';

// 🎯 types/からの統一型定義インポート（整合性確保）
import type { UserRole } from '../types';

/**
 * レポート管理ルート統合クラス
 * 
 * 【統合基盤活用】
 * - middleware/auth.ts: 認証・権限制御完全活用
 * - middleware/errorHandler.ts: asyncHandler統一エラーハンドリング
 * - middleware/validation.ts: バリデーション統合活用
 * 
 * 【controllers/reportController.ts密連携】
 * - 13エンドポイント完全連携：日次・月次・車両・点検・ダッシュボード・KPI・予測分析
 * - 階層権限制御：ロール別アクセス制御・個人データ保護
 * - 企業レベル機能：経営支援・意思決定支援・戦略分析API
 * 
 * 【統合効果】
 * - 3層統合レポートエンドポイント実現
 * - 車両・点検統合APIシステム（20エンドポイント）との連携
 * - 企業レベル4層統合システム確立（管理層・業務層・分析層・API層）
 */

const router = Router();

// =====================================
// 統合認証・ログ設定
// =====================================

// 全ルートで認証必須
router.use(authenticateToken);

// ルートアクセスログ
router.use((req, res, next) => {
  logger.info('📊 Report API access', {
    method: req.method,
    path: req.path,
    user: req.user ? {
      id: req.user.id,
      role: req.user.role
    } : 'anonymous',
    query: req.query,
    ip: req.ip
  });
  next();
});

// =====================================
// 基本レポート管理API（統合版）
// =====================================

/**
 * レポート一覧取得
 * GET /api/v1/reports
 * 権限: 全ロール（個人データ制限あり）
 */
router.get(
  '/',
  validatePagination,
  asyncHandler(reportController.getAllReports)
);

/**
 * レポート詳細取得
 * GET /api/v1/reports/:id
 * 権限: 全ロール（アクセス制限あり）
 */
router.get(
  '/:id',
  validateId,
  asyncHandler(reportController.getReportById)
);

/**
 * レポートテンプレート一覧取得
 * GET /api/v1/reports/templates
 * 権限: 全ロール（権限に応じたテンプレート）
 */
router.get(
  '/templates',
  asyncHandler(reportController.getReportTemplates)
);

// =====================================
// 日次・月次運行レポート生成API（3層統合版）
// =====================================

/**
 * 日次運行レポート生成
 * POST /api/v1/reports/daily-operation
 * 権限: 全ロール（個人データ制限あり）
 * 機能: 3層統合データ（ユーザー・車両・点検）による総合分析
 */
router.post(
  '/daily-operation',
  validateReportParams,
  asyncHandler(reportController.generateDailyOperationReport)
);

/**
 * 月次運行レポート生成
 * POST /api/v1/reports/monthly-operation
 * 権限: 管理者・マネージャー
 * 機能: 統合経営分析・予測分析・戦略支援
 */
router.post(
  '/monthly-operation',
  requireManagerOrAdmin,
  validateReportParams,
  validateDateRange,
  asyncHandler(reportController.generateMonthlyOperationReport)
);

// =====================================
// 車両・点検統合レポートAPI（統合版）
// =====================================

/**
 * 車両稼働レポート生成
 * POST /api/v1/reports/vehicle-utilization
 * 権限: 管理者・マネージャー
 * 機能: 車両・点検統合分析・予防保全・コスト最適化
 */
router.post(
  '/vehicle-utilization',
  requireManagerOrAdmin,
  validateReportParams,
  validateDateRange,
  asyncHandler(reportController.generateVehicleUtilizationReport)
);

/**
 * 点検サマリーレポート生成
 * POST /api/v1/reports/inspection-summary
 * 権限: 管理者・マネージャー・点検員
 * 機能: 点検統合分析・品質管理・安全性評価
 */
router.post(
  '/inspection-summary',
  requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.INSPECTOR]),
  validateReportParams,
  validateDateRange,
  asyncHandler(reportController.generateInspectionSummaryReport)
);

// =====================================
// 企業レベル統合ダッシュボード・分析API（NEW）
// =====================================

/**
 * 総合ダッシュボードレポート生成
 * POST /api/v1/reports/comprehensive-dashboard
 * 権限: 管理者・マネージャー
 * 機能: 企業レベル統合ダッシュボード・リアルタイム監視・KPI
 */
router.post(
  '/comprehensive-dashboard',
  requireManagerOrAdmin,
  validateReportParams,
  asyncHandler(reportController.generateComprehensiveDashboard)
);

/**
 * KPI分析レポート生成
 * POST /api/v1/reports/kpi-analysis
 * 権限: 管理者・マネージャー
 * 機能: 総合効率指数・安全性スコア・生産性指数・ベンチマーキング
 */
router.post(
  '/kpi-analysis',
  requireManagerOrAdmin,
  validateReportParams,
  asyncHandler(reportController.generateKPIAnalysis)
);

/**
 * 予測分析レポート生成
 * POST /api/v1/reports/predictive-analytics
 * 権限: 管理者のみ
 * 機能: AI駆動改善提案・予防保全・需要予測・戦略支援
 */
router.post(
  '/predictive-analytics',
  requireAdmin,
  validateReportParams,
  asyncHandler(reportController.generatePredictiveAnalytics)
);

// =====================================
// レポート操作API（統合版）
// =====================================

/**
 * レポートダウンロード
 * GET /api/v1/reports/:id/download
 * 権限: 全ロール（アクセス制限あり）
 * 機能: ファイルダウンロード・権限チェック・ログ記録
 */
router.get(
  '/:id/download',
  validateId,
  asyncHandler(reportController.downloadReport)
);

/**
 * レポートプレビュー
 * GET /api/v1/reports/:id/preview
 * 権限: 全ロール（アクセス制限あり）
 * 機能: レポート内容プレビュー・権限チェック
 */
router.get(
  '/:id/preview',
  validateId,
  asyncHandler(reportController.previewReport)
);

/**
 * レポート生成状況確認
 * GET /api/v1/reports/:id/status
 * 権限: 全ロール（アクセス制限あり）
 * 機能: 生成進捗・完了状況・エラー状況確認
 */
router.get(
  '/:id/status',
  validateId,
  asyncHandler(reportController.getReportStatus)
);

/**
 * レポート削除
 * DELETE /api/v1/reports/:id
 * 権限: 管理者・マネージャー（生成者本人のみ）
 * 機能: レポート削除・ファイル削除・権限チェック
 */
router.delete(
  '/:id',
  requireManagerOrAdmin,
  validateId,
  asyncHandler(reportController.deleteReport)
);

// =====================================
// ルート登録完了ログ・統計情報
// =====================================

const routeEndpoints = [
  'GET /',
  'GET /:id',
  'GET /templates',
  'POST /daily-operation',
  'POST /monthly-operation',
  'POST /vehicle-utilization',
  'POST /inspection-summary',
  'POST /comprehensive-dashboard',
  'POST /kpi-analysis',
  'POST /predictive-analytics',
  'GET /:id/download',
  'GET /:id/preview',
  'GET /:id/status',
  'DELETE /:id'
];

logger.info('✅ Report routes registration completed', {
  totalEndpoints: routeEndpoints.length,
  endpoints: routeEndpoints,
  features: [
    '3層統合レポート（ユーザー・車両・点検）',
    '企業レベル統合ダッシュボード',
    'KPI分析・予測分析',
    '車両・点検統合API連携',
    '階層権限制御システム',
    '統一エラーハンドリング',
    'バリデーション統合'
  ],
  integrationLevel: 'Enterprise Grade - 4層統合システム確立'
});

// =====================================
// API利用統計・モニタリング
// =====================================

// ルートアクセス統計（開発・監視用）
router.use((req, res, next) => {
  const endTime = Date.now();
  const startTime = req.startTime || endTime;
  const processingTime = endTime - startTime;

  logger.info('📈 Report API response', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    processingTime: `${processingTime}ms`,
    user: req.user ? {
      id: req.user.id,
      role: req.user.role
    } : 'anonymous'
  });
  
  next();
});

// =====================================
// エラーハンドリング・フォールバック
// =====================================

/**
 * 未定義ルート用404ハンドラー
 * 統合されたエラーハンドリングシステムを活用
 */
router.use('*', (req, res) => {
  logger.warn('⚠️ Report API route not found', {
    method: req.method,
    path: req.path,
    user: req.user ? {
      id: req.user.id,
      role: req.user.role
    } : 'anonymous'
  });

  res.status(404).json({
    success: false,
    message: `レポートAPIルート「${req.method} ${req.path}」が見つかりません`,
    error: 'ROUTE_NOT_FOUND',
    availableEndpoints: routeEndpoints,
    documentation: '/api/v1/docs/reports'
  });
});

// =====================================
// デフォルトエクスポート
// =====================================

export default router;