import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/v1/debug/logs/recent?lines=200
router.get('/logs/recent', asyncHandler(async (req: any, res: any) => {
  const lines = parseInt(req.query.lines as string) || 200;
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const allLines = content.split('\n').filter(Boolean);
    const recent = allLines.slice(-lines);
    return sendSuccess(res, { logs: recent, total: recent.length });
  } catch (e) {
    return sendSuccess(res, { logs: ['ログファイルが見つかりません'], total: 0 });
  }
}));

export default router;
