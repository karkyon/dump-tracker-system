import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * GET /api/v1/logs/recent
 * バックエンドログ取得API（管理者専用）
 * クエリパラメータ:
 *   lines: 取得行数 (デフォルト500)
 *   level: フィルターレベル (error/warn/info/debug/all)
 *   keyword: キーワードフィルター
 *   startDate: 日付フィルター開始 (YYYY-MM-DD, JST)
 *   endDate: 日付フィルター終了 (YYYY-MM-DD, JST)
 */
router.get('/recent', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const lines = Math.min(parseInt(req.query.lines as string) || 500, 5000);
  const level = (req.query.level as string) || 'all';
  const keyword = (req.query.keyword as string) || '';
  const startDate = (req.query.startDate as string) || '';
  const endDate   = (req.query.endDate   as string) || '';

  // 日付フィルター用タイムスタンプ範囲（JST指定→UTC変換）
  let startTs: number | null = null;
  let endTs:   number | null = null;
  if (startDate) startTs = new Date(startDate + 'T00:00:00+09:00').getTime();
  if (endDate)   endTs   = new Date(endDate   + 'T23:59:59+09:00').getTime();

  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  try {
    const stat = fs.statSync(logPath);
    const fileSizeMB = (stat.size / 1024 / 1024).toFixed(2);

    let rawContent: string;
    if (startTs !== null || endTs !== null) {
      // 日付指定ありの場合はファイル全体を読む（過去ログ検索のため）
      rawContent = fs.readFileSync(logPath, 'utf-8');
    } else {
      // 日付指定なし：末尾512KBのみ（高速）
      const CHUNK_SIZE = Math.min(stat.size, 512 * 1024);
      const buf = Buffer.alloc(CHUNK_SIZE);
      const fd = fs.openSync(logPath, 'r');
      fs.readSync(fd, buf, 0, CHUNK_SIZE, stat.size - CHUNK_SIZE);
      fs.closeSync(fd);
      rawContent = buf.toString('utf-8');
    }
    // 最初の行は途中から始まる可能性があるので除去
    const firstNewline = rawContent.indexOf('\n');
    const content = firstNewline >= 0 ? rawContent.slice(firstNewline + 1) : rawContent;
    let allLines = content.split('\n').filter(Boolean);

    // レベルフィルター
    if (level !== 'all') {
      allLines = allLines.filter(l => {
        try {
          const d = JSON.parse(l);
          return d.level === level;
        } catch {
          return l.toLowerCase().includes(level);
        }
      });
    }

    // キーワードフィルター
    if (keyword) {
      allLines = allLines.filter(l => l.includes(keyword));
    }

    // 日付フィルター（startDate / endDate, JST基準）
    // JSONパース成功行 → timestampで範囲チェック
    // JSONパース失敗行（プレーンテキスト）→ 除外しない（タイムスタンプ判定不能のため通す）
    if (startTs !== null || endTs !== null) {
      allLines = allLines.filter(l => {
        try {
          const d = JSON.parse(l);
          // JSONだがtimestampなし → 通す
          if (!d.timestamp) return true;
          const ts = new Date(d.timestamp).getTime();
          if (startTs !== null && ts < startTs) return false;
          if (endTs   !== null && ts > endTs)   return false;
          return true;
        } catch {
          // プレーンテキスト行 → 通す
          return true;
        }
      });
    }

    // 最新N行（日付フィルターあり時は全件、なしは末尾N行）
    const recent = (startTs !== null || endTs !== null)
      ? allLines.slice(-Math.min(allLines.length, lines))
      : allLines.slice(-lines);

    // ログサイズ
    const sizeMB = fileSizeMB;

    return sendSuccess(res, {
      logs: recent,
      total: recent.length,
      logFileSizeMB: sizeMB,
      logFilePath: logPath,
      filters: { lines, level, keyword, startDate, endDate }
    });
  } catch (e: any) {
    return sendSuccess(res, { logs: [`ログファイルエラー: ${e.message}`], total: 0 });
  }
}));

/**
 * POST /api/v1/logs/level
 * ログレベル動的切り替え
 */
router.post('/level', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { level } = req.body as { level: string };
  const valid = ['error', 'warn', 'info', 'http', 'debug'];
  if (!valid.includes(level)) {
    return res.status(400).json({ success: false, message: `無効なレベル。有効値: ${valid.join(', ')}` });
  }
  process.env.LOG_LEVEL = level;
  return sendSuccess(res, { message: `ログレベルを ${level} に変更しました`, level });
}));

/**
 * DELETE /api/v1/logs/clear
 * ログファイルクリア（管理者専用）
 */
router.delete('/clear', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  fs.writeFileSync(logPath, '');
  return sendSuccess(res, { message: 'ログをクリアしました' });
}));

export default router;
