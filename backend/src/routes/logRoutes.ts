import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { authenticateToken } from '../middleware/auth';
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
 */
router.get('/recent', asyncHandler(async (req: Request, res: Response) => {
  const lines = Math.min(parseInt(req.query.lines as string) || 500, 2000);
  const level = (req.query.level as string) || 'all';
  const keyword = (req.query.keyword as string) || '';

  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  try {
    // ファイル末尾からN行だけ読む（大容量ログ対応）
    const stat = fs.statSync(logPath);
    const fileSizeMB = (stat.size / 1024 / 1024).toFixed(2);
    const CHUNK_SIZE = Math.min(stat.size, 512 * 1024); // 末尾512KBだけ読む
    const buf = Buffer.alloc(CHUNK_SIZE);
    const fd = fs.openSync(logPath, 'r');
    fs.readSync(fd, buf, 0, CHUNK_SIZE, stat.size - CHUNK_SIZE);
    fs.closeSync(fd);
    const rawContent = buf.toString('utf-8');
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

    // 最新N行
    const recent = allLines.slice(-lines);

    // ログサイズ
    const sizeMB = fileSizeMB;

    return sendSuccess(res, {
      logs: recent,
      total: recent.length,
      logFileSizeMB: sizeMB,
      logFilePath: logPath,
      filters: { lines, level, keyword }
    });
  } catch (e: any) {
    return sendSuccess(res, { logs: [`ログファイルエラー: ${e.message}`], total: 0 });
  }
}));

/**
 * POST /api/v1/logs/level
 * ログレベル動的切り替え
 */
router.post('/level', asyncHandler(async (req: Request, res: Response) => {
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
router.delete('/clear', asyncHandler(async (req: Request, res: Response) => {
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  fs.writeFileSync(logPath, '');
  return sendSuccess(res, { message: 'ログをクリアしました' });
}));

export default router;
