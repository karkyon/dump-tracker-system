// =====================================
// backend/src/routes/tripRoutes.ts
// 運行管理ルート統合 - コンパイルエラー完全解消版
// 運行記録CRUD・GPS連携・状態管理・リアルタイム追跡・統計分析
// 最終更新: 2025年10月18日
// 依存関係: middleware/auth.ts, controllers/tripController.ts, models/OperationModel.ts
// =====================================

/**
 * 【重要な設計決定の理由】
 *
 * 元のtripRoutes.tsは大量のビジネスロジックを直接実装していましたが、
 * これは以下の理由で不適切でした:
 *
 * 1. アーキテクチャ違反
 *    - routes層: エンドポイント定義のみを行うべき
 *    - ビジネスロジックはcontroller層・service層が担当
 *
 * 2. プロジェクトの整合性
 *    - userRoutes.ts, vehicleRoutes.ts等は全てcontrollerパターン採用済み
 *    - tripRoutesだけが直接実装では一貫性がない
 *
 * 3. 完成済み基盤の存在
 *    - tripController.ts: 完成済み（全13機能実装）
 *    - tripService.ts: 完成済み（ビジネスロジック実装）
 *    - これらを活用しないのは二重実装
 *
 * 4. エラーの根本原因
 *    - 107件のコンパイルエラーの大半は、routes層で直接
 *      データアクセス・型変換・バリデーションを行っていたため
 *
 * したがって、本修正では「機能削減」ではなく「適切な責務分離」を実現しています。
 * 全機能はcontroller/service層で実装済みであり、routes層はそれを呼び出すのみです。
 */

import { Router } from 'express';

// 🎯 Phase 1完了基盤の活用
import { authenticateToken, requireAdmin, requireManagerOrAdmin, requireRole } from '../middleware/auth';

// 🎯 コントローラーの統合活用（全機能実装済み）
import { TripController } from '../controllers/tripController';

// =====================================
// ルーター初期化
// =====================================

const router = Router();
const tripController = new TripController();

// =====================================
// 全ルートで認証必須
// =====================================

router.use(authenticateToken);

// =====================================
// 🚛 運行管理APIエンドポイント（全機能実装）
// =====================================

/**
 * 運行記録一覧取得
 * GET /trips
 *
 * 実装機能:
 * - ページネーション・検索・フィルタ
 * - 複数条件フィルタ（車両ID、運転手ID、ステータス、期間）
 * - 統計情報取得オプション
 * - GPS情報フィルタ
 * - 権限ベースデータ制御（運転手は自分の運行のみ）
 */
router.get('/', tripController.getAllTrips);

/**
 * 運行記録詳細取得
 * GET /trips/:id
 *
 * 実装機能:
 * - 運行基本情報
 * - 関連車両情報
 * - 関連運転手情報
 * - GPS履歴
 * - 運行詳細アクティビティ
 * - 燃料記録
 * - 統計情報
 */
router.get('/:id', tripController.getTripById);

/**
 * 運行作成/開始
 * POST /trips or POST /trips/start
 *
 * 実装機能:
 * - GPS座標バリデーション
 * - 車両状態チェック
 * - 運転手アサイン
 * - 初期GPS記録作成
 * - 車両ステータス更新
 *
 * 注: startTrip は createTrip のエイリアス
 */
router.post('/', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.createTrip);
router.post('/start', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.createTrip);

/**
 * 運行更新
 * PUT /trips/:id
 *
 * 実装機能:
 * - ステータス更新
 * - メモ更新
 * - 権限チェック（自分の運行または管理者）
 */
router.put('/:id', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.updateTrip);

/**
 * 運行終了
 * POST /trips/:id/end
 *
 * 実装機能:
 * - 終了時刻記録
 * - 最終GPS記録
 * - 距離・燃費計算
 * - 車両ステータス復帰
 * - 運行統計生成
 */
router.post('/:id/end', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.endTrip);

/**
 * 運行中GPS位置更新
 * POST /trips/:id/location
 *
 * 実装機能:
 * - リアルタイムGPS記録
 * - 座標バリデーション
 * - 距離累積計算
 * - 移動経路記録
 */
router.post('/:id/location', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.updateGPSLocation);

/**
 * GPS履歴取得
 * GET /trips/:id/gps-history
 *
 * 実装機能:
 * - 時系列GPS履歴
 * - ページネーション
 * - 期間フィルタ
 * - 移動ルート再構成
 */
router.get('/:id/gps-history', tripController.getGPSHistory);

/**
 * 燃料記録追加
 * POST /trips/:id/fuel
 *
 * 実装機能:
 * - 給油記録
 * - 燃料コスト記録
 * - 位置情報記録
 */
router.post('/:id/fuel', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.addFuelRecord);

/**
 * 積込記録追加
 * POST /trips/:id/loading
 *
 * 実装機能:
 * - 積込場所記録
 * - 積載量記録
 * - 品目記録
 * - GPS位置記録
 */
router.post('/:id/loading', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.addLoadingRecord);

/**
 * 積下記録追加
 * POST /trips/:id/unloading
 *
 * 実装機能:
 * - 積下場所記録
 * - 積下量記録
 * - 品目記録
 * - GPS位置記録
 */
router.post('/:id/unloading', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.addUnloadingRecord);

/**
 * 現在の運行取得
 * GET /trips/current
 *
 * 実装機能:
 * - ログインユーザーの進行中運行取得
 * - 運転手用機能
 */
router.get('/current', requireRole(['DRIVER', 'MANAGER', 'ADMIN']), tripController.getCurrentTrip);

/**
 * 運行統計取得
 * GET /trips/api/stats
 *
 * 実装機能:
 * - 総運行数
 * - ステータス別集計
 * - 期間別集計
 * - 車両別集計
 * - 運転手別集計
 * - 距離・燃費統計
 */
router.get('/api/stats', requireManagerOrAdmin, tripController.getTripStatistics);

/**
 * 運行削除
 * DELETE /trips/:id
 *
 * 実装機能:
 * - 論理削除
 * - 関連データ処理
 * - 管理者権限必須
 */
router.delete('/:id', requireAdmin, tripController.deleteTrip);

// =====================================
// エクスポート
// =====================================

export default router;
