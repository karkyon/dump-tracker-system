// frontend/cms/src/pages/LogViewer.tsx
// バックエンドログビューア（本格版）
// 機能: リアルタイム監視・レベルフィルター・キーワード検索・ログクリア・ダウンロード

import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Play, Square, Trash2, Download, Filter, Terminal, AlertCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '../utils/api';

type LogLevel = 'all' | 'error' | 'warn' | 'info' | 'http' | 'debug';

interface LogEntry {
  raw: string;
  level: string;
  message: string;
  timestamp: string;
  data?: any;
}

function parseLine(line: string): LogEntry {
  try {
    const d = JSON.parse(line);
    return {
      raw: line,
      level: d.level || 'info',
      message: d.message || line,
      timestamp: d.timestamp || '',
      data: d.data
    };
  } catch {
    const level = line.includes('error') ? 'error'
      : line.includes('warn') ? 'warn'
      : line.includes('debug') ? 'debug'
      : 'info';
    return { raw: line, level, message: line, timestamp: '' };
  }
}

const LEVEL_COLORS: Record<string, string> = {
  error: '#ff7b72',
  warn:  '#e3b341',
  info:  '#79c0ff',
  http:  '#56d364',
  debug: '#8b949e',
};

const LEVEL_BG: Record<string, string> = {
  error: 'rgba(255,123,114,0.1)',
  warn:  'rgba(227,179,65,0.1)',
  info:  '',
  http:  '',
  debug: '',
};

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState<LogLevel>('all');
  const [keyword, setKeyword] = useState('');
  const [lines, setLines] = useState(500);
  const [loading, setLoading] = useState(false);
  const [logFileSize, setLogFileSize] = useState('');
  const [currentLogLevel, setCurrentLogLevel] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ lines: String(lines), level });
      if (keyword) params.set('keyword', keyword);
      const res = await apiClient.get(`/logs/recent?${params}`) as any;
      const data = res.data?.data || res.data;
      const rawLogs: string[] = data?.logs || [];
      setLogs(rawLogs.map(parseLine));
      setLogFileSize(data?.logFileSizeMB || '');
      if (autoScroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) {
      setLogs([{ raw: '', level: 'error', message: `API エラー: ${e.message}`, timestamp: '' }]);
    } finally {
      setLoading(false);
    }
  }, [lines, level, keyword, autoScroll]);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (running) {
      intervalRef.current = setInterval(fetchLogs, 3000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, fetchLogs]);

  const changeServerLogLevel = async (lv: string) => {
    try {
      await (apiClient.post('/logs/level', { level: lv }) as any);
      setCurrentLogLevel(lv);
      alert(`サーバーのログレベルを "${lv}" に変更しました`);
    } catch (e: any) { alert(`失敗: ${e.message}`); }
  };

  const clearLogs = async () => {
    if (!confirm('ログファイルをクリアしますか？')) return;
    try {
      await (apiClient.delete('/logs/clear') as any);
      setLogs([]);
      alert('クリアしました');
    } catch (e: any) { alert(`失敗: ${e.message}`); }
  };

  const downloadLogs = () => {
    const content = logs.map(l => l.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backend-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
  };

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh', color: '#c9d1d9', fontFamily: 'monospace', fontSize: 12, padding: 0 }}>
      {/* ヘッダー */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#58a6ff', fontSize: 16, fontWeight: 'bold' }}>
          <Terminal size={20} />
          バックエンドログビューア
        </div>
        {/* 統計 */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
          <span style={{ background: 'rgba(255,123,114,0.2)', color: '#ff7b72', padding: '2px 8px', borderRadius: 4 }}>
            <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />エラー {errorCount}
          </span>
          <span style={{ background: 'rgba(227,179,65,0.2)', color: '#e3b341', padding: '2px 8px', borderRadius: 4 }}>
            <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />警告 {warnCount}
          </span>
          <span style={{ color: '#8b949e', padding: '2px 8px' }}>
            計 {logs.length}件 {logFileSize && `| ファイル ${logFileSize}MB`}
          </span>
        </div>
        {loading && <span style={{ color: '#58a6ff', fontSize: 11 }}>⟳ 読み込み中...</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => { setRunning(r => !r); }}
            style={{ padding: '4px 12px', background: running ? '#da3633' : '#238636', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {running ? <><Square size={12} /> 停止</> : <><Play size={12} /> リアルタイム</>}
          </button>
          <button onClick={fetchLogs} style={{ padding: '4px 10px', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer' }}>
            <RefreshCw size={12} />
          </button>
          <button onClick={downloadLogs} style={{ padding: '4px 10px', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer' }}>
            <Download size={12} />
          </button>
          <button onClick={clearLogs} style={{ padding: '4px 10px', background: '#21262d', color: '#ff7b72', border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* フィルターバー */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: '#8b949e' }} />
        {/* 表示レベルフィルター */}
        <select value={level} onChange={e => setLevel(e.target.value as LogLevel)}
          style={{ padding: '4px 8px', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }}>
          <option value="all">全レベル</option>
          <option value="error">ERROR のみ</option>
          <option value="warn">WARN のみ</option>
          <option value="info">INFO のみ</option>
          <option value="http">HTTP のみ</option>
          <option value="debug">DEBUG のみ</option>
        </select>
        {/* キーワード */}
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="キーワード検索 (例: operationId, 400, prisma)"
          style={{ padding: '4px 10px', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, width: 280 }} />
        {/* 行数 */}
        <select value={lines} onChange={e => setLines(Number(e.target.value))}
          style={{ padding: '4px 8px', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }}>
          <option value={100}>最新100行</option>
          <option value={500}>最新500行</option>
          <option value={1000}>最新1000行</option>
          <option value={2000}>最新2000行</option>
        </select>
        <button onClick={fetchLogs} style={{ padding: '4px 12px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          検索
        </button>
        {keyword && <button onClick={() => setKeyword('')} style={{ padding: '4px 8px', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer' }}>
          クリア
        </button>}

        {/* サーバーログレベル切り替え */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: '#8b949e', fontSize: 11 }}>サーバーログレベル:</span>
          {['error','warn','info','http','debug'].map(lv => (
            <button key={lv} onClick={() => changeServerLogLevel(lv)}
              style={{ padding: '2px 8px', background: currentLogLevel === lv ? '#1f6feb' : '#21262d', color: LEVEL_COLORS[lv] || '#c9d1d9', border: `1px solid ${currentLogLevel === lv ? '#1f6feb' : '#30363d'}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, textTransform: 'uppercase' }}>
              {lv}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8b949e', fontSize: 11 }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          自動スクロール
        </label>
      </div>

      {/* ログ表示エリア */}
      <div style={{ height: 'calc(100vh - 130px)', overflowY: 'auto', padding: '4px 0' }}>
        {logs.map((entry, i) => (
          <div key={i}
            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            style={{
              padding: '2px 16px',
              background: expandedIdx === i ? '#161b22' : (LEVEL_BG[entry.level] || 'transparent'),
              borderLeft: `3px solid ${LEVEL_COLORS[entry.level] || '#30363d'}`,
              borderBottom: '1px solid #21262d',
              cursor: 'pointer',
              color: LEVEL_COLORS[entry.level] || '#c9d1d9',
            }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#8b949e', minWidth: 80, fontSize: 11 }}>
                {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ja-JP') : ''}
              </span>
              <span style={{ minWidth: 50, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 11 }}>
                {entry.level}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expandedIdx === i ? 'pre-wrap' : 'nowrap' }}>
                {entry.message}
              </span>
            </div>
            {expandedIdx === i && entry.data && (
              <pre style={{ marginTop: 4, padding: 8, background: '#0d1117', borderRadius: 4, overflow: 'auto', fontSize: 11, color: '#c9d1d9', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            )}
            {expandedIdx === i && !entry.data && (
              <pre style={{ marginTop: 4, padding: 8, background: '#0d1117', borderRadius: 4, overflow: 'auto', fontSize: 11, color: '#c9d1d9', whiteSpace: 'pre-wrap' }}>
                {entry.raw}
              </pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {running && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: '#238636', color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 12 }}>
          🟢 リアルタイム監視中 (3秒更新)
        </div>
      )}
    </div>
  );
}
