// backend/src/routes/devCleanupRoutes.ts
// UAT準備用データクリーンアップAPI (ADMIN専用・開発環境裏技)
import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../types/auth';
import { DatabaseService } from '../utils/database';
import type { Prisma } from '@prisma/client';
import logger from '../utils/logger';

const router = Router();

// 全ルートにADMIN認証必須
router.use(authenticateToken());
router.use(requireAdmin);

// ============================================================
// トランザクション削除順序（外部キー制約を考慮）
// ============================================================
const TRANSACTION_TABLES = [
  { key: 'inspectionItemResults', table: 'inspection_item_results', label: '点検結果明細' },
  { key: 'operationDetailItems',  table: 'operation_detail_items',  label: '運行明細品目' },
  { key: 'operationDetails',      table: 'operation_details',       label: '運行明細' },
  { key: 'inspectionRecords',     table: 'inspection_records',      label: '点検記録' },
  { key: 'gpsLogs',               table: 'gps_logs',                label: 'GPS記録' },
  { key: 'accidentRecords',       table: 'accident_records',        label: '事故記録' },
  { key: 'operations',            table: 'operations',              label: '運行記録' },
  { key: 'maintenanceRecords',    table: 'maintenance_records',     label: '整備記録' },
  { key: 'reports',               table: 'reports',                 label: '帳票生成履歴' },
  { key: 'notifications',         table: 'notifications',           label: '通知' },
  { key: 'auditLogs',             table: 'audit_logs',              label: '監査ログ' },
];

// マスタテーブル（個別物理削除）
const MASTER_TABLES = [
  { key: 'vehicles',        table: 'vehicles',         label: '車両マスタ',           fk: ['operations','gps_logs','inspection_records','maintenance_records','accident_records'] },
  { key: 'users_driver',    table: 'users',            label: 'ユーザー(DRIVER)',      filter: "WHERE role = \'DRIVER\'", fk: [] },
  { key: 'customers',       table: 'customers',        label: '客先マスタ',           fk: [] },
  { key: 'locations',       table: 'locations',        label: '積込・積降場所マスタ', fk: [] },
  { key: 'items',           table: 'items',            label: '品目マスタ',           fk: [] },
  { key: 'inspectionItems', table: 'inspection_items', label: '点検項目マスタ',       fk: ['inspection_item_results'] },
];

/**
 * GET /api/v1/dev/cleanup/counts
 * 各テーブルの件数を返す（確認画面用）
 */
router.get('/counts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = DatabaseService.getInstance();

  const txCounts: Record<string, number> = {};
  for (const t of TRANSACTION_TABLES) {
    const result = await prisma.$queryRawUnsafe<[{count: bigint}]>(
      `SELECT COUNT(*) as count FROM ${t.table}`
    );
    txCounts[t.key] = Number(result[0].count);
  }

  // マスタ件数
  const masterCounts: Record<string, number> = {};
  const vResult = await prisma.$queryRawUnsafe<[{count: bigint}]>('SELECT COUNT(*) as count FROM vehicles');
  masterCounts['vehicles'] = Number(vResult[0].count);

  const uResult = await prisma.$queryRawUnsafe<[{count: bigint}]>("SELECT COUNT(*) as count FROM users WHERE role = 'DRIVER'");
  masterCounts['users_driver'] = Number(uResult[0].count);

  const cResult = await prisma.$queryRawUnsafe<[{count: bigint}]>('SELECT COUNT(*) as count FROM customers');
  masterCounts['customers'] = Number(cResult[0].count);

  const lResult = await prisma.$queryRawUnsafe<[{count: bigint}]>('SELECT COUNT(*) as count FROM locations');
  masterCounts['locations'] = Number(lResult[0].count);

  const iResult = await prisma.$queryRawUnsafe<[{count: bigint}]>('SELECT COUNT(*) as count FROM items');
  masterCounts['items'] = Number(iResult[0].count);

  const iiResult = await prisma.$queryRawUnsafe<[{count: bigint}]>('SELECT COUNT(*) as count FROM inspection_items');
  masterCounts['inspectionItems'] = Number(iiResult[0].count);

  logger.info('データクリーンアップ件数確認', {
    userId: req.user?.userId,
    txCounts,
    masterCounts
  });

  res.json({
    success: true,
    data: {
      transactionTables: TRANSACTION_TABLES.map(t => ({
        ...t,
        count: txCounts[t.key] ?? 0
      })),
      masterTables: MASTER_TABLES.map(t => ({
        key: t.key,
        table: t.table,
        label: t.label,
        count: masterCounts[t.key] ?? 0
      })),
      totalTransactionRecords: Object.values(txCounts).reduce((a, b) => a + b, 0)
    }
  });
}));

/**
 * POST /api/v1/dev/cleanup/transactions
 * トランザクションデータを全件物理削除
 */
router.post('/transactions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { confirm } = req.body;
  if (confirm !== 'DUMPTRACKER2026') {
    res.status(400).json({ success: false, message: '確認コードが正しくありません' });
    return;
  }

  const userId = req.user?.userId ?? 'unknown';
  logger.warn('🚨 トランザクションデータ全件削除開始', { userId });

  const prisma = DatabaseService.getInstance();
  const deletedCounts: Record<string, number> = {};

  // 外部キー制約を考慮した順序で削除
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const t of TRANSACTION_TABLES) {
      const result = await tx.$executeRawUnsafe(`DELETE FROM ${t.table}`);
      deletedCounts[t.key] = result;
      logger.info(`削除完了: ${t.table} - ${result}件`);
    }
  }, { timeout: 60000 });

  // アップロード画像ファイルも削除（uploads/images/）
  try {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../../uploads/images');
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadDir, file));
      }
      logger.info(`画像ファイル削除: ${files.length}件`);
      deletedCounts['imageFiles'] = files.length;
    }
  } catch (e) {
    logger.warn('画像ファイル削除スキップ', e);
  }

  logger.warn('✅ トランザクションデータ全件削除完了', { userId, deletedCounts });

  res.json({
    success: true,
    message: 'トランザクションデータを全件削除しました',
    data: {
      deletedCounts,
      tables: TRANSACTION_TABLES.map(t => ({
        label: t.label,
        deleted: deletedCounts[t.key] ?? 0
      }))
    }
  });
}));

/**
 * DELETE /api/v1/dev/cleanup/master/:table/:id
 * マスタデータの1件物理削除
 */
router.delete('/master/:table/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const table = req.params.table ?? '';
  const id    = req.params.id    ?? '';
  const allowedTables = ['vehicles', 'users', 'customers', 'locations', 'items', 'inspection_items'];

  if (!allowedTables.includes(table)) {
    res.status(400).json({ success: false, message: '対象外のテーブルです' });
    return;
  }
  if (!id) {
    res.status(400).json({ success: false, message: 'IDが指定されていません' });
    return;
  }

  const prisma = DatabaseService.getInstance();

  await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE id = $1::uuid`, id);

  logger.info('マスタデータ1件削除', { table, id, userId: req.user?.userId });

  res.json({ success: true, message: `${table} ID:${id} を削除しました` });
}));

/**
 * POST /api/v1/dev/cleanup/master/bulk-delete
 * マスタデータ複数件物理削除
 */
router.post('/master/bulk-delete', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { table, ids } = req.body as { table: string; ids: string[] };
  const allowedTables = ['vehicles', 'users', 'customers', 'locations', 'items', 'inspection_items'];

  if (!allowedTables.includes(table)) {
    res.status(400).json({ success: false, message: '対象外のテーブルです' });
    return;
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, message: 'IDリストが空です' });
    return;
  }

  const prisma = DatabaseService.getInstance();
  // DRIVER限定（usersテーブルは役割チェック）
  let where = `id = ANY($1::uuid[])`;
  if (table === 'users') where += ` AND role = 'DRIVER'`;

  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM ${table} WHERE ${where}`,
    ids
  );

  logger.info('マスタデータ複数削除', { table, count: result, ids, userId: req.user?.userId });

  res.json({ success: true, message: `${result}件削除しました`, deleted: result });
}));

export default router;
