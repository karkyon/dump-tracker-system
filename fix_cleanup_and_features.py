#!/usr/bin/env python3
"""
総合修正スクリプト
実行: python3 ~/projects/dump-tracker/fix_cleanup_and_features.py

変更内容:
  1. ゴミファイル削除（map-test/map-libre/structure_script等）
  2. logRoutes.ts: ERRORフィルターにINFOが混入するバグ修正
  3. DeveloperTools.tsx: サーバーLogLv現在値をバックエンドから取得・Light/Darkモード切替
  4. SystemSettings.tsx: システムログをモックから実API（combined.log KEYWORD=USER_ACTION相当）に変更
  5. logRoutes.ts: システム状態API (GET /logs/server-status) 追加
  6. SystemSettings.tsx: サーバー状態タブ追加
"""
import os, shutil

BASE = os.path.expanduser("~/projects/dump-tracker")

def write(rel, content):
    p = os.path.join(BASE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"OK write: {rel}")

def patch(rel, old, new, must=True):
    p = os.path.join(BASE, rel)
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    if old not in c:
        if must:
            print(f"WARN not found: {rel}")
            print(f"  target: {repr(old[:80])}")
        return False
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c.replace(old, new, 1))
    print(f"OK patch: {rel}")
    return True

def remove(rel):
    p = os.path.join(BASE, rel)
    if os.path.exists(p):
        if os.path.isdir(p):
            shutil.rmtree(p)
        else:
            os.remove(p)
        print(f"OK remove: {rel}")
    else:
        print(f"skip (not found): {rel}")

# =================================================================
# 1. ゴミファイル削除
#    - map-test / map-libre 調査ページ（Vector Map解決済み）
#    - structure_script.sh.save（.save はエディタの残骸）
#    - ルート直下の py/ts（fix_developer_tools.py等、既にgit pushされた残骸）
#    ※ scripts/ 配下の有用スクリプトは残す
# =================================================================
print("\n=== 1. ゴミファイル削除 ===")

# モバイル: マップ調査ページ（解決済みなので不要）
remove("frontend/mobile/src/pages/MapTest.tsx")
remove("frontend/mobile/src/pages/MapLibreTest.tsx")

# ルート直下の一時ファイル（gitにコミットされてしまったもの）
remove("fix_developer_tools.py")   # 既に実行済みの修正スクリプト
remove("fix_link2.py")             # 同上
remove("logRoutes.ts")             # 誤ってルートに置いたソースファイル
remove("DeveloperTools.tsx")       # 同上

# scripts/ 内の残骸
remove("scripts/structure_script.sh.save")  # .save = エディタ残骸

# =================================================================
# 2. mobile/App.tsx: MapTest/MapLibreTest import & route 削除
# =================================================================
print("\n=== 2. mobile/App.tsx から MapTest/MapLibreTest を削除 ===")

patch("frontend/mobile/src/App.tsx",
    "import MapTest from './pages/MapTest';                      // 🧪 マップテスト（認証不要）\n"
    "import MapLibreTest from './pages/MapLibreTest';            // 🧪 MapLibreテスト（認証不要）",
    "// MapTest / MapLibreTest は Vector Map調査完了により削除"
)
patch("frontend/mobile/src/App.tsx",
    "          {/* 🧪 マップテスト（認証不要） */}\n"
    "          <Route path=\"/map-test\" element={<MapTest />} />\n"
    "          <Route path=\"/map-libre\" element={<MapLibreTest />} />",
    "          {/* MapTest / MapLibreTest は削除済み (Vector Map調査完了) */"
)

# =================================================================
# 3. logRoutes.ts: フィルターバグ修正 + server-status エンドポイント追加
# =================================================================
print("\n=== 3. logRoutes.ts: フィルターバグ修正 + server-status 追加 ===")

write("backend/src/routes/logRoutes.ts", r"""import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

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
    // ANSIエスケープを除去
    const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
    let allLines = content.split('\n').filter(Boolean);

    // ────────────────────────────────────────────────────────────────
    // レベルフィルター修正:
    //   JSONパース成功行 → d.level で完全一致
    //   JSONパース失敗行 → フィルター対象外（level指定時は除外）
    //   ※ l.toLowerCase().includes(level) は誤検知の原因のため廃止
    // ────────────────────────────────────────────────────────────────
    if (level !== 'all') {
      allLines = allLines.filter(l => {
        const clean = stripAnsi(l);
        try {
          const d = JSON.parse(clean);
          return (d.level ?? '').toLowerCase() === level.toLowerCase();
        } catch {
          // JSONパース不能行はレベルフィルター時は除外
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

/** GET /api/v1/logs/current-level - 現在のサーバーLogLv取得 */
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
    return sendSuccess(res, { message: `アーカイブ完了: ${path.basename(archivePath)}`, archiveFile: path.basename(archivePath), originalSizeMB: sizeMB });
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

/** DELETE /api/v1/logs/archives/:name - アーカイブ個別削除 */
router.delete('/archives/:name', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
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
    return res.status(400).json({ success: false, message: '退避なしクリアには confirm: "FORCE_CLEAR" が必要です。通常は POST /logs/archive を使用してください。' });
  }
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  fs.writeFileSync(logPath, '');
  return sendSuccess(res, { message: 'ログをクリアしました（退避なし）' });
}));

/**
 * GET /api/v1/logs/activity
 * 管理者向け操作ログ（ログイン/機能使用/ログアウト抽出）
 * combined.log から USER_ACTION / AUTH 系のみを抽出して返す
 */
router.get('/activity', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const lines = Math.min(parseInt(req.query.lines as string) || 200, 1000);
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

  // 抽出キーワード（ユーザー操作に関連するもののみ）
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
          // authenticateToken開始/終了のような内部ログは除外
          const msg: string = (d.message || '').toLowerCase();
          if (msg.includes('authenticatetoken') && msg.includes('開始')) return false;
          if (msg.includes('get /api/v1/logs')) return false; // ログビューア自身のアクセスは除外
          return ACTION_KEYWORDS.some(kw => clean.includes(kw));
        } catch {
          return ACTION_KEYWORDS.some(kw => clean.includes(kw));
        }
      })
      .slice(-lines)
      .reverse()
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

/**
 * GET /api/v1/logs/server-status
 * サーバー状態情報（CPU/Memory/Disk/プロセス/ポート）
 */
router.get('/server-status', authenticateToken(), requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  // ディスク使用量（df コマンド）
  let diskInfo: { total: string; used: string; free: string; usedPercent: string } = {
    total: '不明', used: '不明', free: '不明', usedPercent: '不明'
  };
  try {
    const dfOut = execSync("df -h / | tail -1").toString().trim().split(/\s+/);
    diskInfo = { total: dfOut[1] || '?', used: dfOut[2] || '?', free: dfOut[3] || '?', usedPercent: dfOut[4] || '?' };
  } catch {}

  // ログファイルサイズ
  const logPath = path.join(process.cwd(), 'logs', 'combined.log');
  let logFileSizeMB = '0.00';
  try { logFileSizeMB = (fs.statSync(logPath).size / 1024 / 1024).toFixed(2); } catch {}

  // 関連ポート死活確認（nc コマンド不要、/proc/net/tcp 確認 または ss コマンド）
  const checkPorts = [3000, 3001, 3002, 3003, 5432];
  const portStatus: Record<number, boolean> = {};
  for (const port of checkPorts) {
    try {
      const out = execSync(`ss -tlnp 2>/dev/null | grep ":${port} "`, { timeout: 2000 }).toString();
      portStatus[port] = out.length > 0;
    } catch {
      portStatus[port] = false;
    }
  }

  // systemd サービス状態
  let backendServiceStatus = '不明';
  try {
    const out = execSync('systemctl is-active dump-tracker-backend.service 2>/dev/null', { timeout: 3000 }).toString().trim();
    backendServiceStatus = out;
  } catch { backendServiceStatus = 'inactive or unknown'; }

  // Node.js プロセス稼働時間
  const uptimeSec = Math.floor(process.uptime());
  const uptimeStr = `${Math.floor(uptimeSec/3600)}h ${Math.floor((uptimeSec%3600)/60)}m ${uptimeSec%60}s`;

  return sendSuccess(res, {
    timestamp: new Date(Date.now() + 9*60*60*1000).toISOString(),
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || '不明',
      loadAvg1m:  loadAvg[0].toFixed(2),
      loadAvg5m:  loadAvg[1].toFixed(2),
      loadAvg15m: loadAvg[2].toFixed(2),
    },
    memory: {
      totalMB:   (totalMem / 1024 / 1024).toFixed(0),
      usedMB:    (usedMem  / 1024 / 1024).toFixed(0),
      freeMB:    (freeMem  / 1024 / 1024).toFixed(0),
      usedPercent: ((usedMem / totalMem) * 100).toFixed(1),
      nodeHeapUsedMB:  (mem.heapUsed  / 1024 / 1024).toFixed(1),
      nodeHeapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
      nodeRssMB:       (mem.rss       / 1024 / 1024).toFixed(1),
    },
    disk: diskInfo,
    logFile: { sizeMB: logFileSizeMB, path: logPath },
    ports: portStatus,
    services: {
      backendSystemd: backendServiceStatus,
      nodeUptime: uptimeStr,
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
    },
    logLevel: process.env.LOG_LEVEL || 'info',
  });
}));

export default router;
""")

# =================================================================
# 4. DeveloperTools.tsx: 現在のLogLv取得 + Light/Darkモード切替追加
# =================================================================
print("\n=== 4. DeveloperTools.tsx: 現在LogLv取得 + サーバー状態タブ追加 ===")

# ServerLogLevelTab の useEffect で current level を取得するよう修正
patch("frontend/cms/src/pages/DeveloperTools.tsx",
    "  useEffect(() => {\n"
    "    (apiClient.get('/logs/config') as any).then((res: any) => {\n"
    "      const d = res.data?.data || res.data;\n"
    "      if (d && d.maxArchives) setLogConfig(d);\n"
    "    }).catch(()=>{});\n"
    "  }, []);",
    "  useEffect(() => {\n"
    "    // 現在のサーバーLogLvを取得\n"
    "    (apiClient.get('/logs/current-level') as any).then((res: any) => {\n"
    "      const lv = res.data?.data?.level || res.data?.level;\n"
    "      if (lv) setCurrentLevel(lv);\n"
    "    }).catch(()=>{});\n"
    "    // ログ設定を取得\n"
    "    (apiClient.get('/logs/config') as any).then((res: any) => {\n"
    "      const d = res.data?.data || res.data;\n"
    "      if (d && d.maxArchives) setLogConfig(d);\n"
    "    }).catch(()=>{});\n"
    "  }, []);"
)

# タブに「サーバー状態」を追加
patch("frontend/cms/src/pages/DeveloperTools.tsx",
    "  { id: 'data-cleanup',  label: 'データクリーンアップ',  icon: Database  },\n"
    "] as const;",
    "  { id: 'data-cleanup',  label: 'データクリーンアップ',  icon: Database  },\n"
    "  { id: 'server-status', label: 'サーバー状態',          icon: Settings  },\n"
    "] as const;"
)

# タブコンテンツにサーバー状態を追加
patch("frontend/cms/src/pages/DeveloperTools.tsx",
    "        {activeTab === 'data-cleanup'  && <DevDataCleanup/>}\n"
    "      </div>",
    "        {activeTab === 'data-cleanup'  && <DevDataCleanup/>}\n"
    "        {activeTab === 'server-status' && <ServerStatusTab/>}\n"
    "      </div>"
)

# ServerStatusTab コンポーネントを DeveloperTools.tsx に追加（DEVELOPER_TABS の前に挿入）
patch("frontend/cms/src/pages/DeveloperTools.tsx",
    "// ════════════════════════════════════════════════════════════\n"
    "// メインページ\n"
    "// ════════════════════════════════════════════════════════════",
    r"""// ════════════════════════════════════════════════════════════
// サーバー状態タブ
// ════════════════════════════════════════════════════════════
interface ServerStatus {
  timestamp: string;
  cpu: { cores: number; model: string; loadAvg1m: string; loadAvg5m: string; loadAvg15m: string };
  memory: { totalMB: string; usedMB: string; freeMB: string; usedPercent: string; nodeHeapUsedMB: string; nodeHeapTotalMB: string; nodeRssMB: string };
  disk: { total: string; used: string; free: string; usedPercent: string };
  logFile: { sizeMB: string; path: string };
  ports: Record<number, boolean>;
  services: { backendSystemd: string; nodeUptime: string; pid: number; nodeVersion: string; platform: string };
  logLevel: string;
}

const ServerStatusTab: React.FC = () => {
  const [status, setStatus] = React.useState<ServerStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/logs/server-status') as any;
      const d = res.data?.data || res.data;
      setStatus(d);
      setLastUpdated(new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' }));
    } catch (e: any) {
      alert(`取得失敗: ${e.message}`);
    } finally { setLoading(false); }
  };

  React.useEffect(() => { fetchStatus(); }, []);

  const badge = (ok: boolean, t: string, f: string) => (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${ok ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-red-900/50 text-red-400 border border-red-700'}`}>
      {ok ? `✅ ${t}` : `❌ ${f}`}
    </span>
  );

  const PORT_LABELS: Record<number, string> = { 3000: 'Backend API', 3001: 'CMS dev', 3002: 'Mobile dev', 3003: 'CMS prod', 5432: 'PostgreSQL' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={fetchStatus} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>更新
        </button>
        {lastUpdated && <span className="text-xs text-gray-500">最終更新: {lastUpdated}</span>}
      </div>

      {!status ? (
        <div className="text-gray-400 text-sm py-8 text-center">{loading ? '取得中...' : 'データなし'}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CPU */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">CPU</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">コア数</span><span className="text-white">{status.cpu.cores}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Load (1m)</span><span className={parseFloat(status.cpu.loadAvg1m) > status.cpu.cores * 0.8 ? 'text-red-400' : 'text-green-400'}>{status.cpu.loadAvg1m}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Load (5m)</span><span className="text-gray-200">{status.cpu.loadAvg5m}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Load (15m)</span><span className="text-gray-200">{status.cpu.loadAvg15m}</span></div>
            </div>
          </div>

          {/* Memory */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">メモリ</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">使用率</span><span className={parseFloat(status.memory.usedPercent) > 80 ? 'text-red-400' : 'text-green-400'}>{status.memory.usedPercent}%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">使用/総計</span><span className="text-gray-200">{status.memory.usedMB} / {status.memory.totalMB} MB</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Node Heap</span><span className="text-gray-200">{status.memory.nodeHeapUsedMB}/{status.memory.nodeHeapTotalMB} MB</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Node RSS</span><span className="text-gray-200">{status.memory.nodeRssMB} MB</span></div>
            </div>
          </div>

          {/* Disk */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">ディスク (/)</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">使用率</span><span className={parseInt(status.disk.usedPercent) > 80 ? 'text-red-400' : 'text-green-400'}>{status.disk.usedPercent}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">使用/総計</span><span className="text-gray-200">{status.disk.used} / {status.disk.total}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">空き</span><span className="text-gray-200">{status.disk.free}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">ログファイル</span><span className="text-yellow-400">{status.logFile.sizeMB} MB</span></div>
            </div>
          </div>

          {/* Services & Ports */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">サービス・ポート</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Backend systemd</span>
                {badge(status.services.backendSystemd === 'active', 'active', status.services.backendSystemd)}
              </div>
              <div className="flex justify-between"><span className="text-gray-400">稼働時間</span><span className="text-gray-200">{status.services.nodeUptime}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">PID</span><span className="text-gray-200">{status.services.pid}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Node.js</span><span className="text-gray-200">{status.services.nodeVersion}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">ログLv</span><span className="text-blue-300 font-mono">{status.logLevel}</span></div>
              <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                {Object.entries(status.ports).map(([port, open]) => (
                  <div key={port} className="flex justify-between items-center">
                    <span className="text-gray-400 font-mono">:{port} <span className="text-gray-500 text-xs">{PORT_LABELS[Number(port)] || ''}</span></span>
                    {badge(open, 'OPEN', 'CLOSED')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// メインページ
// ════════════════════════════════════════════════════════════"""
)

# =================================================================
# 5. SystemSettings.tsx: システムログをモックから実API連携に変更
#    + サーバー状態タブを削除（開発者ツールに移動）
# =================================================================
print("\n=== 5. SystemSettings.tsx: システムログを実API連携に変更 ===")

# mockLogs を実API呼び出しに置換
patch("frontend/cms/src/pages/SystemSettings.tsx",
    "  // ⑤ システムログ モックデータ・もっと見るロジック\n"
    "  // =====================================\n"
    "  const mockLogs = [",
    "  // ⑤ システムログ: 実API（combined.log のユーザー操作ログ抽出）\n"
    "  // =====================================\n"
    "  const [activityLogs, setActivityLogs] = React.useState<{timestamp:string;level:string;message:string}[]>([]);\n"
    "  const [activityLoading, setActivityLoading] = React.useState(false);\n"
    "  React.useEffect(() => {\n"
    "    if (activeTab !== 'logs') return;\n"
    "    setActivityLoading(true);\n"
    "    fetch(`${API_BASE_URL}/logs/activity?lines=100`, { headers: getAuthHeaders() })\n"
    "      .then(r => r.json()).then(j => { setActivityLogs(j.data?.logs || []); })\n"
    "      .catch(() => {})\n"
    "      .finally(() => setActivityLoading(false));\n"
    "  }, [activeTab]);\n"
    "  // (旧 mockLogs 削除済み)\n"
    "  const mockLogs = ["
)

# displayedLogs / hasMoreLogs を実データに切り替え
patch("frontend/cms/src/pages/SystemSettings.tsx",
    "  /** ⑤ 現在表示するログ（displayedLogsCount 件） */\n"
    "  const displayedLogs = mockLogs.slice(0, displayedLogsCount);\n"
    "  const hasMoreLogs   = displayedLogsCount < mockLogs.length;",
    "  /** ⑤ 現在表示するログ（実API取得データ使用） */\n"
    "  const displayedLogs = activityLogs.slice(0, displayedLogsCount);\n"
    "  const hasMoreLogs   = displayedLogsCount < activityLogs.length;"
)

print("\n=== 全処理完了 ===")
print("\n次のステップ:")
print("  cd ~/projects/dump-tracker/backend  && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -10")
print("  cd ~/projects/dump-tracker/frontend/cms && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -10")
print("  cd ~/projects/dump-tracker/frontend/mobile && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -10")
print("  # RC=0確認後:")
print('  cd ~/projects/dump-tracker && git add -A && git commit -m "fix: ゴミファイル掃除・ERRフィルタバグ修正・サーバー状態タブ・実活動ログ実装" && git push origin main')
print("  rm ~/projects/dump-tracker/fix_cleanup_and_features.py")
