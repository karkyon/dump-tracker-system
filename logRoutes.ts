import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();

/** GET /api/v1/logs/recent */
router.get('/recent', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const lines = Math.min(parseInt(req.query.lines as string) || 500, 5000);
  const level = (req.query.level as string) || 'all';
  const keyword = (req.query.keyword as string) || '';
  const startDate = (req.query.startDate as string) || '';
  const endDate   = (req.query.endDate   as string) || '';

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
      rawContent = fs.readFileSync(logPath, 'utf-8');
    } else {
      const CHUNK_SIZE = Math.min(stat.size, 512 * 1024);
      const buf = Buffer.alloc(CHUNK_SIZE);
      const fd = fs.openSync(logPath, 'r');
      fs.readSync(fd, buf, 0, CHUNK_SIZE, stat.size - CHUNK_SIZE);
      fs.closeSync(fd);
      rawContent = buf.toString('utf-8');
    }
    const firstNewline = rawContent.indexOf('\n');
    const content = firstNewline >= 0 ? rawContent.slice(firstNewline + 1) : rawContent;
    let allLines = content.split('\n').filter(Boolean);

    if (level !== 'all') {
      allLines = allLines.filter(l => {
        try { const d = JSON.parse(l); return d.level === level; }
        catch { return l.toLowerCase().includes(level); }
      });
    }
    if (keyword) allLines = allLines.filter(l => l.includes(keyword));
    if (startTs !== null || endTs !== null) {
      allLines = allLines.filter(l => {
        try {
          const d = JSON.parse(l);
          if (!d.timestamp) return true;
          const ts = new Date(d.timestamp).getTime();
          if (startTs !== null && ts < startTs) return false;
          if (endTs   !== null && ts > endTs)   return false;
          return true;
        } catch { return true; }
      });
    }
    const recent = (startTs !== null || endTs !== null)
      ? allLines.slice(-Math.min(allLines.length, lines))
      : allLines.slice(-lines);

    return sendSuccess(res, {
      logs: recent, total: recent.length, logFileSizeMB: fileSizeMB,
      filters: { lines, level, keyword, startDate, endDate }
    });
  } catch (e: any) {
    return sendSuccess(res, { logs: [`ログファイルエラー: ${e.message}`], total: 0 });
  }
}));

/** POST /api/v1/logs/level - サーバーLogLv動的変更（開発者専用） */
router.post('/level', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { level } = req.body as { level: string };
  const valid = ['error', 'warn', 'info', 'http', 'debug'];
  if (!valid.includes(level)) {
    return res.status(400).json({ success: false, message: `無効なレベル。有効値: ${valid.join(', ')}` });
  }
  process.env.LOG_LEVEL = level;
  return sendSuccess(res, { message: `ログレベルを ${level} に変更しました`, level });
}));

/** POST /api/v1/logs/archive - 退避 & クリア（開発者専用） */
router.post('/archive', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  const archiveDir = path.join(process.cwd(), 'logs', 'archives');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // JST
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archivePath = path.join(archiveDir, `combined-${stamp}.log`);

  try {
    const stat = fs.statSync(logPath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    fs.copyFileSync(logPath, archivePath);
    fs.writeFileSync(logPath, '');

    // 最大世代数超えた古いアーカイブを削除
    const configPath = path.join(process.cwd(), 'logs', 'log-config.json');
    let maxArchives = 10;
    if (fs.existsSync(configPath)) {
      try { maxArchives = JSON.parse(fs.readFileSync(configPath, 'utf-8')).maxArchives ?? 10; } catch {}
    }
    const archives = fs.readdirSync(archiveDir)
      .filter(f => f.startsWith('combined-') && f.endsWith('.log'))
      .sort();
    if (archives.length > maxArchives) {
      archives.slice(0, archives.length - maxArchives).forEach(f => {
        try { fs.unlinkSync(path.join(archiveDir, f)); } catch {}
      });
    }
    return sendSuccess(res, {
      message: `アーカイブ完了: ${path.basename(archivePath)}`,
      archiveFile: path.basename(archivePath),
      originalSizeMB: sizeMB,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: `アーカイブ失敗: ${e.message}` });
  }
}));

/** GET /api/v1/logs/archives - アーカイブ一覧（開発者専用） */
router.get('/archives', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const archiveDir = path.join(process.cwd(), 'logs', 'archives');
  if (!fs.existsSync(archiveDir)) return sendSuccess(res, { archives: [], total: 0 });
  const archives = fs.readdirSync(archiveDir)
    .filter(f => f.endsWith('.log'))
    .map(f => {
      const fp = path.join(archiveDir, f);
      const stat = fs.statSync(fp);
      return { name: f, sizeMB: (stat.size / 1024 / 1024).toFixed(2), createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sendSuccess(res, { archives, total: archives.length });
}));

/** GET /api/v1/logs/config - ログ設定取得（開発者専用） */
router.get('/config', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const configPath = path.join(process.cwd(), 'logs', 'log-config.json');
  const defaults = {
    maxFileSizeMB: 50, maxArchives: 10, autoArchiveEnabled: false,
    autoArchiveThresholdMB: 100, retentionDays: 30
  };
  if (!fs.existsSync(configPath)) return sendSuccess(res, defaults);
  try { return sendSuccess(res, { ...defaults, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) }); }
  catch { return sendSuccess(res, defaults); }
}));

/** PUT /api/v1/logs/config - ログ設定保存（開発者専用） */
router.put('/config', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const configPath = path.join(logDir, 'log-config.json');
  fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
  return sendSuccess(res, { message: 'ログ設定を保存しました', config: req.body });
}));

/**
 * DELETE /api/v1/logs/clear
 * 退避なし強制クリア（confirm: "FORCE_CLEAR" 必須）
 * ⚠️ 通常は POST /logs/archive を使用すること
 */
router.delete('/clear', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { confirm } = req.body as { confirm?: string };
  if (confirm !== 'FORCE_CLEAR') {
    return res.status(400).json({
      success: false,
      message: '退避なしクリアには confirm: "FORCE_CLEAR" が必要です。通常は POST /logs/archive を使用してください。'
    });
  }
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  fs.writeFileSync(logPath, '');
  return sendSuccess(res, { message: 'ログをクリアしました（退避なし）' });
}));

export default router;
