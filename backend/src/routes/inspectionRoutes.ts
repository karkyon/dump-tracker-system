// =====================================
// backend/src/routes/inspectionRoutes.ts
// 点検記録管理ルート(トランザクションデータ)
// 修正日: 2025年12月15日
// 目的: 点検記録(InspectionRecord)のCRUD管理
// 概念: トランザクションデータ - 実際に実施された点検の記録
// 依存関係: controllers/inspectionController.ts, middleware/auth.ts, middleware/validation.ts
// 修正内容: 点検項目エンドポイントを inspectionItemRoutes.ts に分離、点検記録を直下に配置
// ✅ NEW: operationId パラメータ対応追加
// 最終更新: 2025年11月28日(デバッグ出力追加版)
// 統合基盤: middleware層100%・utils層・controllers層統合活用
// =====================================

import { UserRole } from '@prisma/client';
import { Router } from 'express';

// 🎯 Phase 1完成基盤の活用(tripRoutes.tsパターン準拠)
import {
  authenticateToken,
  requireAdmin,
  requireManager,
  requireRole
} from '../middleware/auth';
import {
  validateId,
  validatePaginationQuery
} from '../middleware/validation';
import logger from '../utils/logger';

// 🎯 完成済みcontrollers層との密連携
import {
  getAllInspectionRecords,
  getInspectionRecordById,
  createInspectionRecord,
  updateInspectionRecord,
  deleteInspectionRecord,
  getInspectionStatistics,
  getVehicleInspectionSummary,
  getInspectionDashboard
} from '../controllers/inspectionController';

// 🎯 types/からの統一型定義インポート
import type { AuthenticatedRequest } from '../types/auth';

// =====================================
// 🏭 点検記録管理ルーター初期化
// =====================================

const router = Router();

// 🔧🔧🔧 デバッグ出力追加: ルーター初期化確認
logger.info('🔧🔧🔧 [DEBUG-InspectionRoutes] ルーター初期化開始', {
  timestamp: new Date().toISOString(),
  file: 'backend/src/routes/inspectionRoutes.ts',
  description: '点検記録管理 - トランザクションデータ専用ルート',
  note: '点検項目(マスタ)は /inspection-items で管理'
});

/**
 * 点検記録管理API統合ルーター
 *
 * 【概念整理】
 * - このルートは「点検記録(InspectionRecord)」のみを管理
 * - 点検記録 = 実際に実施された点検のトランザクションデータ
 * - 例: 2025年12月15日 10:00、田中運転手が車両A号のエンジンオイルを点検 → 合格
 *
 * - 点検項目(InspectionItem)のマスタデータ管理は別ルート
 * - /inspection-items で管理(inspectionItemRoutes.ts)
 *
 * 【統合基盤活用】
 * - middleware/auth.ts: 認証・権限制御統合
 * - middleware/validation.ts: バリデーション統合
 * - middleware/errorHandler.ts: エラーハンドリング統合
 *
 * 【controllers層連携】
 * - controllers/inspectionController.ts: 完成済み・HTTP制御層との密連携
 *
 * 【統合効果】
 * - 点検記録管理APIエンドポイント完全実現
 * - 車両・点検統合API確立
 * - 企業レベル点検業務APIシステム実現
 */

// 🔧🔧🔧 デバッグ出力追加: 全リクエストをログ(認証前に配置)
router.use((req, res, next) => {
  logger.info('🔍🔍🔍 [DEBUG-InspectionRoutes] リクエスト受信(認証前)', {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    baseUrl: req.baseUrl,
    query: req.query,
    params: req.params,
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : 'なし',
      'content-type': req.headers['content-type']
    },
    timestamp: new Date().toISOString()
  });
  next();
});

// 全点検関連ルートに認証を適用
router.use(authenticateToken());

// 🔧🔧🔧 デバッグ出力追加: 認証後のログ
router.use((req, res, next) => {
  logger.info('🔍🔍🔍 [DEBUG-InspectionRoutes] 認証完了後', {
    method: req.method,
    url: req.originalUrl,
    user: (req as AuthenticatedRequest).user ? {
      userId: (req as AuthenticatedRequest).user?.userId,
      role: (req as AuthenticatedRequest).user?.role
    } : 'なし',
    timestamp: new Date().toISOString()
  });
  next();
});

// =====================================
// 📝 点検記録管理API(トランザクションデータ)
// =====================================

/**
 * @swagger
 * /inspections:
 *   get:
 *     summary: 点検記録一覧取得
 *     description: |
 *       フィルタリング・ページネーション対応の点検記録一覧を取得
 *
 *       **トランザクションデータ管理:**
 *       - 実際に実施された点検の記録を管理
 *       - 例: 2025年12月15日、田中運転手が車両A号を点検
 *
 *       **企業レベル機能:**
 *       - 高度フィルタリング(車両、運行、点検者、ステータス)
 *       - 統計情報取得
 *       - 車両連携
 *     tags:
 *       - ✅ 点検記録管理 (Inspection Records Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両IDでフィルタ
 *       - in: query
 *         name: operationId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ✅ NEW - 運行IDでフィルタ(特定運行の点検記録取得)
 *       - in: query
 *         name: inspectorId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 点検者IDでフィルタ
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED]
 *         description: ステータスでフィルタ
 *       - in: query
 *         name: inspectionType
 *         schema:
 *           type: string
 *           enum: [PRE_TRIP, POST_TRIP]
 *         description: 点検種別でフィルタ
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: 点検記録一覧取得成功
 *       401:
 *         description: 認証エラー
 */
// ✅ FIX No.27: CMS 運行記録詳細「点検項目」タブ用。運行に紐づく点検の項目別結果を返す。
//   従来、画面側の項目詳細は一度も取得されず（state の setter が未使用）、常に0件と表示されていた。
//   管理者専用のデバッグAPIではなく、管理者・マネージャーが使える正規のAPIとして提供する。
router.get(
  '/operation/:operationId/items',
  requireRole(['ADMIN', 'MANAGER'] as UserRole[]),
  async (req, res) => {
    try {
      const { getDebugService } = await import('../services/debugService');
      const result: any = await getDebugService().getInspectionItemDetails(String(req.params.operationId));
      res.json({ success: true, data: result?.data ?? result ?? [] });
    } catch (e) {
      logger.error('点検項目詳細取得エラー', { error: e instanceof Error ? e.message : String(e) });
      res.status(500).json({ success: false, message: '点検項目の取得に失敗しました', code: 'INSPECTION_ITEMS_ERROR' });
    }
  }
);

router.get(
  '/',
  (req, res, next) => {
    logger.info('🎯🎯🎯 [DEBUG-InspectionRoutes] GET / ルート到達 - 点検記録一覧', {
      query: req.query,
      timestamp: new Date().toISOString()
    });
    next();
  },
  validatePaginationQuery,
  getAllInspectionRecords
);

/**
 * @swagger
 * /inspections/{id}:
 *   get:
 *     summary: 点検記録詳細取得
 *     description: |
 *       指定IDの点検記録の詳細情報を取得
 *
 *       **トランザクションデータ管理:**
 *       - 個別の点検実施記録を取得
 *
 *       **企業レベル機能:**
 *       - 詳細情報表示
 *       - 関連データ取得
 *       - 権限制御
 *     tags:
 *       - ✅ 点検記録管理 (Inspection Records Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 点検記録ID
 *     responses:
 *       200:
 *         description: 点検記録詳細取得成功
 *       404:
 *         description: 点検記録が見つかりません
 *       401:
 *         description: 認証エラー
 */
router.get(
  '/:id',
  validateId,
  getInspectionRecordById
);

/**
 * @swagger
 * /inspections:
 *   post:
 *     summary: 点検記録作成
 *     description: |
 *       新規点検記録を作成
 *
 *       **権限要件:**
 *       - DRIVER（運転手）: 点検記録を作成可能
 *       - 現時点ではDRIVERが点検も実施
 *       - 将来的にはINSPECTORロールとして分離予定
 *
 *       **設計思想:**
 *       - Phase 1: DRIVER = 点検実施者（現在）
 *       - Phase 2: DRIVER ≠ INSPECTOR（将来的に分離）
 *
 *       **トランザクションデータ管理:**
 *       - 新しい点検実施記録を作成
 *       - 例: 「2025年12月26日、田中運転手が車両A号を点検開始」
 *
 *       **企業レベル機能:**
 *       - 車両連携
 *       - GPS記録
 *       - ステータス管理
 *       - 業務フロー統合
 *     tags:
 *       - ✅ 点検記録管理 (Inspection Records Management)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleId
 *               - inspectorId
 *               - inspectionType
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 format: uuid
 *                 description: 車両ID
 *               inspectorId:
 *                 type: string
 *                 format: uuid
 *                 description: 点検者ID（現時点ではDRIVER）
 *               inspectionType:
 *                 type: string
 *                 enum: [PRE_TRIP, POST_TRIP]
 *                 description: 点検種別
 *               results:
 *                 type: array
 *                 description: 点検結果配列
 *                 items:
 *                   type: object
 *                   properties:
 *                     inspectionItemId:
 *                       type: string
 *                       format: uuid
 *                     resultValue:
 *                       type: string
 *                     isPassed:
 *                       type: boolean
 *                     notes:
 *                       type: string
 *               latitude:
 *                 type: number
 *                 format: double
 *                 description: 緯度(GPS)
 *               longitude:
 *                 type: number
 *                 format: double
 *                 description: 経度(GPS)
 *               locationName:
 *                 type: string
 *                 description: 場所名
 *               overallNotes:
 *                 type: string
 *                 description: 総合備考
 *     responses:
 *       201:
 *         description: 点検記録作成成功
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.post(
  '/',
  requireRole('DRIVER' as UserRole),  // ✅ DRIVER（Prismaスキーマ変更不要）
  createInspectionRecord
);

/**
 * @swagger
 * /inspections/{id}:
 *   put:
 *     summary: 点検記録更新
 *     description: |
 *       既存の点検記録を更新
 *
 *       **トランザクションデータ管理:**
 *       - 既存の点検実施記録を更新
 *       - 例: ステータスを「進行中」→「完了」に変更
 *
 *       **企業レベル機能:**
 *       - ステータス更新
 *       - 進捗管理
 *       - 権限制御
 *     tags:
 *       - ✅ 点検記録管理 (Inspection Records Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 点検記録ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED]
 *               overallResult:
 *                 type: string
 *               overallNotes:
 *                 type: string
 *               defectsFound:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 点検記録更新成功
 *       404:
 *         description: 点検記録が見つかりません
 *       401:
 *         description: 認証エラー
 */
router.put(
  '/:id',
  validateId,
  requireRole('INSPECTOR' as UserRole),
  updateInspectionRecord
);

/**
 * @swagger
 * /inspections/{id}:
 *   delete:
 *     summary: 点検記録削除
 *     description: |
 *       点検記録を削除(管理者のみ)
 *
 *       **トランザクションデータ管理:**
 *       - 点検実施記録を削除(論理削除)
 *
 *       **企業レベル機能:**
 *       - 管理者権限制御
 *       - 論理削除
 *       - 履歴保持
 *     tags:
 *       - ✅ 点検記録管理 (Inspection Records Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 点検記録ID
 *     responses:
 *       200:
 *         description: 点検記録削除成功
 *       404:
 *         description: 点検記録が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー(管理者のみ)
 */
router.delete(
  '/:id',
  validateId,
  requireAdmin,
  deleteInspectionRecord
);

// =====================================
// 📊 統計・分析API
// =====================================

/**
 * @swagger
 * /inspections/statistics:
 *   get:
 *     summary: 点検統計情報取得
 *     description: |
 *       点検に関する統計情報を取得(マネージャー以上)
 *
 *       **企業レベル機能:**
 *       - KPI監視
 *       - トレンド分析
 *       - 品質管理指標
 *       - 予測分析
 *     tags:
 *       - ✅ 点検記録管理 (Inspection Records Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 統計開始日
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 統計終了日
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両IDでフィルタ
 *     responses:
 *       200:
 *         description: 統計情報取得成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー(マネージャー以上が必要)
 */
router.get(
  '/statistics',
  requireManager,
  getInspectionStatistics
);

/**
 * @swagger
 * /inspections/vehicle/{vehicleId}/summary:
 *   get:
 *     summary: 車両別点検サマリー取得
 *     description: |
 *       特定車両の点検サマリーを取得(マネージャー以上)
 *
 *       **企業レベル機能:**
 *       - 車両別分析
 *       - 点検履歴サマリー
 *       - 問題傾向分析
 *       - メンテナンス推奨
 *     tags:
 *       - ✅ 点検記録管理 (Inspection Records Management)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 車両ID
 *     responses:
 *       200:
 *         description: 車両別サマリー取得成功
 *       404:
 *         description: 車両が見つかりません
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー(マネージャー以上が必要)
 */
router.get(
  '/vehicle/:vehicleId/summary',
  requireManager,
  validateId,
  getVehicleInspectionSummary
);

/**
 * @swagger
 * /inspections/dashboard:
 *   get:
 *     summary: 点検ダッシュボードデータ取得
 *     description: |
 *       点検管理ダッシュボード用の統合データを取得(マネージャー以上)
 *
 *       **企業レベル機能:**
 *       - リアルタイム監視
 *       - 統合ダッシュボード
 *       - アラート・通知
 *       - KPI可視化
 *     tags:
 *       - ✅ 点検記録管理 (Inspection Records Management)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ダッシュボードデータ取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       description: 概要統計
 *                     alerts:
 *                       type: array
 *                       description: アラート情報
 *                     recentActivities:
 *                       type: array
 *                       description: 最近のアクティビティ
 *                     kpis:
 *                       type: object
 *                       description: KPI指標
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー(マネージャー以上が必要)
 */
router.get(
  '/dashboard',
  requireManager,
  getInspectionDashboard
);

// =====================================
// 📊 API使用状況監視・ログ
// =====================================

/**
 * ルート使用統計の記録
 * 全てのAPIエンドポイントでアクセスログを記録
 */
router.use('*', (req, res, next) => {
  logger.info('📋 点検記録管理API使用', {
    method: req.method,
    path: req.originalUrl,
    userId: (req as AuthenticatedRequest).user?.userId,
    userRole: (req as AuthenticatedRequest).user?.role,
    timestamp: new Date().toISOString(),
    ip: req.ip
  });
  next();
});

// =====================================
// 📤 エクスポート・統合完了確認
// =====================================

logger.info('✅ routes/inspectionRoutes.ts 点検記録専用版 統合完了', {
  totalEndpoints: 8,
  endpointList: [
    'GET / - 点検記録一覧取得 (✅ operationId対応)',
    'GET /:id - 点検記録詳細取得',
    'POST / - 点検記録作成',
    'PUT /:id - 点検記録更新',
    'DELETE /:id - 点検記録削除',
    'GET /statistics - 点検統計情報取得',
    'GET /vehicle/:vehicleId/summary - 車両別サマリー',
    'GET /dashboard - ダッシュボード'
  ],
  removedEndpoints: [
    '削除: /items (点検項目) → /inspection-items に移動'
  ],
  newFeatures: [
    '✅ operationId パラメータ対応追加'
  ],
  dataType: 'トランザクションデータ(点検記録)',
  relatedRoute: '/inspection-items で点検項目マスタを管理',
  debugMode: true,
  integrationStatus: 'controllers/inspectionController.ts - Full Integration',
  middleware: 'auth + validation + errorHandler + DEBUG integrated',
  timestamp: new Date().toISOString()
});

export default router;

// =====================================
// ✅ 修正完了確認
// =====================================

/**
 * ✅ routes/inspectionRoutes.ts - operationId対応完了版
 *
 * 【修正内容】
 * ✅ operationIdパラメータをSwagger定義に追加
 * ✅ 点検項目エンドポイント(/items/*)を削除 → inspectionItemRoutes.ts へ移行
 * ✅ 点検記録エンドポイント(/records/*)を直下(/)に配置
 * ✅ 統計・ダッシュボードエンドポイントを維持
 * ✅ すべてのデバッグログを保持
 * ✅ すべてのSwagger定義を保持
 * ✅ すべてのコメント・説明を保持
 *
 * 【概念整理完了】
 * ✅ このルート = 点検記録(InspectionRecord)トランザクションデータのみ
 * ✅ 点検項目(InspectionItem)マスタデータ = /inspection-items で管理
 *
 * 【エンドポイント構造】
 * ✅ /inspections - 点検記録管理(8エンドポイント)
 *   - GET / - 一覧取得 (✅ operationId対応)
 *   - GET /:id - 詳細取得
 *   - POST / - 作成
 *   - PUT /:id - 更新
 *   - DELETE /:id - 削除
 *   - GET /statistics - 統計情報
 *   - GET /vehicle/:vehicleId/summary - 車両別サマリー
 *   - GET /dashboard - ダッシュボード
 *
 * 【削除されたエンドポイント】
 * ❌ GET /items - → GET /inspection-items へ移行
 * ❌ GET /items/:id - → GET /inspection-items/:id へ移行
 * ❌ POST /items - → POST /inspection-items へ移行
 * ❌ PUT /items/:id - → PUT /inspection-items/:id へ移行
 * ❌ DELETE /items/:id - → DELETE /inspection-items/:id へ移行
 *
 * 【他ルートとの整合性確保】
 * ✅ マスタデータ: /vehicles, /users, /items, /locations, /inspection-items
 * ✅ トランザクションデータ: /trips, /operations, /inspections
 *
 * 【既存機能100%保持】
 * ✅ すべてのミドルウェア
 * ✅ すべての認証・権限制御
 * ✅ すべてのバリデーション
 * ✅ すべてのデバッグログ
 * ✅ すべてのSwagger定義
 * ✅ すべてのコメント
 */
