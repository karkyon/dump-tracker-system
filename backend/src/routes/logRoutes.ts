import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const router = Router();

// noUncheckedIndexedAccess: true 対応 — 配列要素を安全に string 化
function safeStr(v: string | undefined, fallback = '?'): string {
  return v !== undefined && v !== '' ? v : fallback;
}

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
    const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
    let allLines = content.split('\n').filter(Boolean);

    if (level !== 'all') {
      allLines = allLines.filter(l => {
        const clean = stripAnsi(l);
        try {
          const d = JSON.parse(clean);
          return (d.level ?? '').toLowerCase() === level.toLowerCase();
        } catch {
          return false;
        }
      });
    }

    if (keyword) allLines = allLines.filter(l => l.includes(keyword));

    if (startTs !== null || endTs !== null) {
      allLines = allLines.filter(l => {
        try {
          const d = JSON.parse(stripAnsi(l));
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

/** POST /api/v1/logs/level */
router.post('/level', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { level } = req.body as { level: string };
  const valid = ['error', 'warn', 'info', 'http', 'debug'];
  if (!valid.includes(level)) {
    return res.status(400).json({ success: false, message: `無効なレベル。有効値: ${valid.join(', ')}` });
  }
  process.env.LOG_LEVEL = level;
  return sendSuccess(res, { message: `ログレベルを ${level} に変更しました`, level });
}));

/** GET /api/v1/logs/current-level */
router.get('/current-level', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const level = process.env.LOG_LEVEL || 'info';
  return sendSuccess(res, { level });
}));

/** POST /api/v1/logs/archive */
router.post('/archive', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  const archiveDir = path.join(process.cwd(), 'logs', 'archives');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archivePath = path.join(archiveDir, `combined-${stamp}.log`);
  try {
    const stat = fs.statSync(logPath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
    fs.copyFileSync(logPath, archivePath);
    fs.writeFileSync(logPath, '');
    const configPath = path.join(process.cwd(), 'logs', 'log-config.json');
    let maxArchives = 10;
    if (fs.existsSync(configPath)) {
      try { maxArchives = JSON.parse(fs.readFileSync(configPath, 'utf-8')).maxArchives ?? 10; } catch {}
    }
    const archives = fs.readdirSync(archiveDir)
      .filter(f => f.startsWith('combined-') && f.endsWith('.log')).sort();
    if (archives.length > maxArchives) {
      archives.slice(0, archives.length - maxArchives).forEach(f => {
        try { fs.unlinkSync(path.join(archiveDir, f)); } catch {}
      });
    }
    return sendSuccess(res, {
      message: `アーカイブ完了: ${path.basename(archivePath)}`,
      archiveFile: path.basename(archivePath),
      originalSizeMB: sizeMB
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: `アーカイブ失敗: ${e.message}` });
  }
}));

/** GET /api/v1/logs/archives */
router.get('/archives', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const archiveDir = path.join(process.cwd(), 'logs', 'archives');
  if (!fs.existsSync(archiveDir)) return sendSuccess(res, { archives: [], total: 0 });
  const archives = fs.readdirSync(archiveDir).filter(f => f.endsWith('.log')).map(f => {
    const fp = path.join(archiveDir, f);
    const stat = fs.statSync(fp);
    return { name: f, sizeMB: (stat.size / 1024 / 1024).toFixed(2), createdAt: stat.mtime.toISOString() };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sendSuccess(res, { archives, total: archives.length });
}));

/** DELETE /api/v1/logs/archives/:name */
router.delete('/archives/:name', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const name = req.params['name'];
  if (!name || name.includes('..') || name.includes('/')) {
    return res.status(400).json({ success: false, message: '無効なファイル名' });
  }
  const archiveDir = path.join(process.cwd(), 'logs', 'archives');
  const filePath = path.join(archiveDir, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'ファイルが見つかりません' });
  }
  fs.unlinkSync(filePath);
  return sendSuccess(res, { message: `削除しました: ${name}` });
}));

/** GET /api/v1/logs/config */
router.get('/config', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const configPath = path.join(process.cwd(), 'logs', 'log-config.json');
  const defaults = { maxFileSizeMB: 50, maxArchives: 10, autoArchiveEnabled: false, autoArchiveThresholdMB: 100, retentionDays: 30 };
  if (!fs.existsSync(configPath)) return sendSuccess(res, defaults);
  try { return sendSuccess(res, { ...defaults, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) }); }
  catch { return sendSuccess(res, defaults); }
}));

/** PUT /api/v1/logs/config */
router.put('/config', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const configPath = path.join(logDir, 'log-config.json');
  fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
  return sendSuccess(res, { message: 'ログ設定を保存しました', config: req.body });
}));

/** DELETE /api/v1/logs/clear */
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

/** GET /api/v1/logs/activity */
router.get('/activity', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const lines = Math.min(parseInt(req.query.lines as string) || 200, 1000);
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
  const ACTION_KEYWORDS = [
    '認証成功', '認証失敗', 'ログイン', 'ログアウト',
    'LOGIN', 'LOGOUT', 'AUTH', 'USER_ACTION',
    '運行開始', '運行終了', 'GPS', 'フィードバック'
  ];
  try {
    const stat = fs.statSync(logPath);
    const CHUNK_SIZE = Math.min(stat.size, 256 * 1024);
    const buf = Buffer.alloc(CHUNK_SIZE);
    const fd = fs.openSync(logPath, 'r');
    fs.readSync(fd, buf, 0, CHUNK_SIZE, stat.size - CHUNK_SIZE);
    fs.closeSync(fd);
    const rawContent = buf.toString('utf-8');
    const firstNewline = rawContent.indexOf('\n');
    const content = firstNewline >= 0 ? rawContent.slice(firstNewline + 1) : rawContent;
    const activityLogs = content.split('\n').filter(Boolean)
      .filter(l => {
        const clean = stripAnsi(l);
        try {
          const d = JSON.parse(clean);
          const msg: string = (d.message || '').toLowerCase();
          if (msg.includes('authenticatetoken') && msg.includes('開始')) return false;
          if (msg.includes('get /api/v1/logs')) return false;
          return ACTION_KEYWORDS.some(kw => clean.includes(kw));
        } catch {
          return ACTION_KEYWORDS.some(kw => clean.includes(kw));
        }
      })
      .slice(-lines).reverse()
      .map(l => {
        const clean = stripAnsi(l);
        try {
          const d = JSON.parse(clean);
          return {
            timestamp: d.timestamp || '',
            level: (d.level || 'info').toUpperCase(),
            message: d.message || clean,
            data: d.data || d.frontendData || null,
          };
        } catch {
          return { timestamp: '', level: 'INFO', message: clean, data: null };
        }
      });
    return sendSuccess(res, { logs: activityLogs, total: activityLogs.length });
  } catch (e: any) {
    return sendSuccess(res, { logs: [], total: 0, error: e.message });
  }
}));

/** GET /api/v1/logs/server-status */
router.get('/server-status', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // noUncheckedIndexedAccess 対応: split結果を safeStr() で安全に取り出す
  let diskInfo = { total: '不明', used: '不明', free: '不明', usedPercent: '不明' };
  try {
    const dfParts = execSync('df -h / | tail -1').toString().trim().split(/\s+/);
    diskInfo = {
      total:       safeStr(dfParts[1]),
      used:        safeStr(dfParts[2]),
      free:        safeStr(dfParts[3]),
      usedPercent: safeStr(dfParts[4]),
    };
  } catch { /* デフォルト値を使用 */ }

  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  let logFileSizeMB = '0.00';
  try { logFileSizeMB = (fs.statSync(logPath).size / 1024 / 1024).toFixed(2); } catch {}

  const checkPorts = [80, 443, 3000, 3003, 5432];
  const portStatus: Record<number, boolean> = {};
  for (const port of checkPorts) {
    try {
      const out = execSync(`ss -tlnp 2>/dev/null | grep ":${port} "`, { timeout: 2000 }).toString();
      portStatus[port] = out.length > 0;
    } catch {
      portStatus[port] = false;
    }
  }

  let backendServiceStatus = '不明';
  try {
    backendServiceStatus = execSync(
      'systemctl is-active dump-tracker-backend.service 2>/dev/null',
      { timeout: 3000 }
    ).toString().trim();
  } catch { backendServiceStatus = 'inactive or unknown'; }

  const uptimeSec = Math.floor(process.uptime());
  const uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`;

  // noUncheckedIndexedAccess 対応: cpus[0] は undefined の可能性
  const cpuModel = cpus[0]?.model ?? '不明';
  const loadAvg1m  = loadAvg[0]?.toFixed(2) ?? '0.00';
  const loadAvg5m  = loadAvg[1]?.toFixed(2) ?? '0.00';
  const loadAvg15m = loadAvg[2]?.toFixed(2) ?? '0.00';

  return sendSuccess(res, {
    timestamp: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    cpu: { cores: cpus.length, model: cpuModel, loadAvg1m, loadAvg5m, loadAvg15m },
    memory: {
      totalMB:        (totalMem / 1024 / 1024).toFixed(0),
      usedMB:         (usedMem  / 1024 / 1024).toFixed(0),
      freeMB:         (freeMem  / 1024 / 1024).toFixed(0),
      usedPercent:    ((usedMem / totalMem) * 100).toFixed(1),
      nodeHeapUsedMB:  (mem.heapUsed  / 1024 / 1024).toFixed(1),
      nodeHeapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
      nodeRssMB:       (mem.rss       / 1024 / 1024).toFixed(1),
    },
    disk: diskInfo,
    logFile: { sizeMB: logFileSizeMB, path: logPath },
    ports: portStatus,
    services: {
      backendSystemd: backendServiceStatus,
      nodeUptime:     uptimeStr,
      pid:            process.pid,
      nodeVersion:    process.version,
      platform:       process.platform,
    },
    logLevel: process.env.LOG_LEVEL || 'info',
  });
}));

export default router;
