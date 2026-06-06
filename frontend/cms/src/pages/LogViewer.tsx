// frontend/cms/src/pages/LogViewer.tsx
// バックエンドログビューア（改善版）
// - 新しいログを上部表示
// - 画面高さ固定（スクロール不要）
// - Light/Dark切り替え

import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Play, Square, Trash2, Download, Terminal, AlertCircle, AlertTriangle, Sun, Moon } from 'lucide-react';
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
    return { raw: line, level: d.level || 'info', message: d.message || line, timestamp: d.timestamp || '', data: d.data };
  } catch {
    const level = line.includes('error') ? 'error' : line.includes('warn') ? 'warn' : line.includes('debug') ? 'debug' : 'info';
    return { raw: line, level, message: line, timestamp: '' };
  }
}

const LEVEL_COLORS_DARK: Record<string, string> = {
  error: '#ff7b72', warn: '#e3b341', info: '#79c0ff', http: '#56d364', debug: '#8b949e',
};
const LEVEL_COLORS_LIGHT: Record<string, string> = {
  error: '#cf222e', warn: '#9a6700', info: '#0969da', http: '#1a7f37', debug: '#57606a',
};

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(true);
  const [level, setLevel] = useState<LogLevel>('all');
  const [keyword, setKeyword] = useState('FRONTEND');
  const [lines, setLines] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [logFileSize, setLogFileSize] = useState('');
  const [currentLogLevel, setCurrentLogLevel] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [dark, setDark] = useState(true);
  const todayJST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayJST);
  const [endDate, setEndDate] = useState(todayJST);
  const [useDateFilter, setUseDateFilter] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // テーマ
  const bg = dark ? '#0d1117' : '#ffffff';
  const bg2 = dark ? '#161b22' : '#f6f8fa';
  const border = dark ? '#30363d' : '#d0d7de';
  const text = dark ? '#c9d1d9' : '#1f2328';
  const textMuted = dark ? '#8b949e' : '#57606a';
  const LEVEL_COLORS = dark ? LEVEL_COLORS_DARK : LEVEL_COLORS_LIGHT;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ lines: String(lines), level });
      if (keyword) params.set('keyword', keyword);
      if (useDateFilter && startDate) params.set('startDate', startDate);
      if (useDateFilter && endDate) params.set('endDate', endDate);
      const res = await apiClient.get(`/logs/recent?${params}`) as any;
      const data = res.data?.data || res.data;
      const rawLogs: string[] = data?.logs || [];
      // 新しいログを上部に表示（reverse）
      setLogs(rawLogs.map(parseLine).reverse());
      setLogFileSize(data?.logFileSizeMB || '');
    } catch (e: any) {
      setLogs([{ raw: '', level: 'error', message: `API エラー: ${e.message}`, timestamp: '' }]);
    } finally {
      setLoading(false);
    }
  }, [lines, level, keyword, startDate, endDate, useDateFilter]);

  useEffect(() => { fetchLogs(); }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (running) intervalRef.current = setInterval(fetchLogs, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, fetchLogs]);

  const changeServerLogLevel = async (lv: string) => {
    try {
      await (apiClient.post('/logs/level', { level: lv }) as any);
      setCurrentLogLevel(lv);
    } catch (e: any) { alert(`失敗: ${e.message}`); }
  };

  const clearLogs = async () => {
    if (!confirm('ログファイルをクリアしますか？')) return;
    try { await (apiClient.delete('/logs/clear') as any); setLogs([]); } catch (e: any) { alert(`失敗: ${e.message}`); }
  };

  const downloadLogs = () => {
    const content = [...logs].reverse().map(l => l.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backend-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
  };

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <div style={{ background: bg, height: '100vh', display: 'flex', flexDirection: 'column', color: text, fontFamily: 'monospace', fontSize: 12, overflow: 'hidden' }}>
      {/* ヘッダー固定 */}
      <div style={{ background: bg2, borderBottom: `1px solid ${border}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#58a6ff', fontSize: 14, fontWeight: 'bold' }}>
          <Terminal size={16} /> ログビューア
        </div>
        <span style={{ background: 'rgba(255,123,114,0.2)', color: '#ff7b72', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
          <AlertCircle size={10} style={{ display: 'inline', marginRight: 2 }} />ERR {errorCount}
        </span>
        <span style={{ background: 'rgba(227,179,65,0.2)', color: '#e3b341', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
          <AlertTriangle size={10} style={{ display: 'inline', marginRight: 2 }} />WARN {warnCount}
        </span>
        <span style={{ color: textMuted, fontSize: 11 }}>計 {logs.length}件{logFileSize && ` | ${logFileSize}MB`}</span>
        {loading && <span style={{ color: '#58a6ff', fontSize: 11 }}>⟳</span>}

        {/* 操作ボタン */}
        <button onClick={() => setRunning(r => !r)} style={{ padding: '2px 8px', background: running ? '#da3633' : '#238636', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
          {running ? <><Square size={10} />停止</> : <><Play size={10} />開始</>}
        </button>
        <button onClick={fetchLogs} style={{ padding: '2px 6px', background: '#21262d', color: text, border: `1px solid ${border}`, borderRadius: 4, cursor: 'pointer' }}>
          <RefreshCw size={12} />
        </button>
        <button onClick={clearLogs} style={{ padding: '2px 6px', background: '#21262d', color: '#ff7b72', border: `1px solid ${border}`, borderRadius: 4, cursor: 'pointer' }}>
          <Trash2 size={12} />
        </button>
        <button onClick={downloadLogs} style={{ padding: '2px 6px', background: '#21262d', color: text, border: `1px solid ${border}`, borderRadius: 4, cursor: 'pointer' }}>
          <Download size={12} />
        </button>
        <button onClick={() => setDark(d => !d)} style={{ padding: '2px 6px', background: '#21262d', color: text, border: `1px solid ${border}`, borderRadius: 4, cursor: 'pointer' }}>
          {dark ? <Sun size={12} /> : <Moon size={12} />}
        </button>
      </div>

      {/* フィルターバー固定 */}
      <div style={{ background: bg2, borderBottom: `1px solid ${border}`, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        {/* キーワード */}
        <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchLogs()} placeholder="キーワード" style={{ padding: '2px 8px', background: dark ? '#0d1117' : '#f6f8fa', color: text, border: `1px solid ${border}`, borderRadius: 4, fontSize: 11, width: 130 }} />
        {/* 表示件数 */}
        <select value={lines} onChange={e => setLines(Number(e.target.value))} style={{ padding: '2px 4px', background: dark ? '#0d1117' : '#f6f8fa', color: text, border: `1px solid ${border}`, borderRadius: 4, fontSize: 11 }}>
          {[200, 500, 1000, 2000, 5000].map(n => <option key={n} value={n}>{n}件</option>)}
        </select>
        {/* レベルフィルター */}
        {(['all','error','warn','info','http','debug'] as LogLevel[]).map(lv => (
          <button key={lv} onClick={() => setLevel(lv)} style={{ padding: '1px 6px', background: level === lv ? '#1f6feb' : (dark ? '#21262d' : '#f6f8fa'), color: LEVEL_COLORS[lv] || text, border: `1px solid ${level === lv ? '#1f6feb' : border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, textTransform: 'uppercase' }}>
            {lv}
          </button>
        ))}
        {/* 日付 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, color: textMuted, fontSize: 11 }}>
          <input type="checkbox" checked={useDateFilter} onChange={e => setUseDateFilter(e.target.checked)} />日付
        </label>
        {useDateFilter && (<>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '2px 4px', background: dark ? '#0d1117' : '#f6f8fa', color: text, border: `1px solid ${border}`, borderRadius: 4, fontSize: 11 }} />
          <span style={{ color: textMuted, fontSize: 11 }}>〜</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '2px 4px', background: dark ? '#0d1117' : '#f6f8fa', color: text, border: `1px solid ${border}`, borderRadius: 4, fontSize: 11 }} />
        </>)}
        {/* サーバーログレベル */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ color: textMuted, fontSize: 10 }}>サーバーログレベル:</span>
          {['error','warn','info','http','debug'].map(lv => (
            <button key={lv} onClick={() => changeServerLogLevel(lv)} style={{ padding: '1px 5px', background: currentLogLevel === lv ? '#1f6feb' : (dark ? '#21262d' : '#f6f8fa'), color: LEVEL_COLORS[lv] || text, border: `1px solid ${currentLogLevel === lv ? '#1f6feb' : border}`, borderRadius: 4, cursor: 'pointer', fontSize: 10, textTransform: 'uppercase' }}>
              {lv}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, color: textMuted, fontSize: 11 }}>
          {running && <span style={{ color: '#56d364' }}>● リアルタイム(3秒)</span>}
        </label>
      </div>

      {/* ログエリア - 残り高さ全部使う */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {logs.map((entry, i) => (
          <div key={i} onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            style={{ padding: '1px 12px', background: expandedIdx === i ? (dark ? '#161b22' : '#f6f8fa') : 'transparent', borderLeft: `3px solid ${LEVEL_COLORS[entry.level] || border}`, borderBottom: `1px solid ${dark ? '#21262d' : '#eaeef2'}`, cursor: 'pointer', color: LEVEL_COLORS[entry.level] || text }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: textMuted, minWidth: 72, fontSize: 11, flexShrink: 0 }}>
                {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false }) : ''}
              </span>
              <span style={{ minWidth: 42, fontWeight: 'bold', textTransform: 'uppercase', fontSize: 11, flexShrink: 0 }}>
                {entry.level}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expandedIdx === i ? 'pre-wrap' : 'nowrap', fontSize: 11 }}>
                {entry.message}
              </span>
            </div>
            {expandedIdx === i && (
              <pre style={{ marginTop: 2, padding: 6, background: dark ? '#0d1117' : '#f6f8fa', borderRadius: 4, overflow: 'auto', fontSize: 11, color: text, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {entry.data ? JSON.stringify(entry.data, null, 2) : entry.raw}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
