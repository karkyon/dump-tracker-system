// frontend/cms/src/pages/DeveloperTools.tsx
// 開発者専用ツール統合ページ（ADMIN専用）
// タブ: ログビューア / サーバーLogLv・管理 / GPS Inspector / 運行デバッグ / データクリーンアップ
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal, AlertCircle, AlertTriangle, RefreshCw, Play, Square,
  Download, Sun, Moon, Archive, Settings, FileText,
  Satellite, Database, Shield, Save
} from 'lucide-react';
import { apiClient } from '../utils/api';
import { useTLog } from '../hooks/useTLog';
import { useAuthStore } from '../store/authStore';
import GpsInspector from './GpsInspector';
import OperationDebug from './OperationDebug';
import { DevDataCleanup } from './DevDataCleanup';

// ─── 型定義 ─────────────────────────────────────────────────
type LogLevel = 'all' | 'error' | 'warn' | 'info' | 'http' | 'debug';
interface LogEntry { raw: string; level: string; message: string; timestamp: string; data?: any; }
interface ArchiveInfo { name: string; sizeMB: string; createdAt: string; }
interface LogConfig {
  maxFileSizeMB: number; maxArchives: number; autoArchiveEnabled: boolean;
  autoArchiveThresholdMB: number; retentionDays: number;
}

// ─── ユーティリティ ──────────────────────────────────────────
function stripAnsi(str: string): string { return str.replace(/\u001b\[[0-9;]*m/g, ''); }

function parseLine(line: string): LogEntry {
  const clean = stripAnsi(line);
  try {
    const d = JSON.parse(clean);
    return { raw: clean, level: d.level || 'info', message: d.message || clean, timestamp: d.timestamp || '', data: d.data };
  } catch {
    const m = clean.match(/^(\w+):\s(.+)$/);
    if (m) {
      const level = ['error','warn','info','http','debug'].includes(m[1]) ? m[1] : 'info';
      return { raw: clean, level, message: m[2], timestamp: '' };
    }
    return { raw: clean, level: clean.includes('error') ? 'error' : clean.includes('warn') ? 'warn' : 'info', message: clean, timestamp: '' };
  }
}

const LEVEL_COLORS_DARK: Record<string,string>  = { error:'#ff7b72',warn:'#e3b341',info:'#79c0ff',http:'#56d364',debug:'#8b949e' };
const LEVEL_COLORS_LIGHT: Record<string,string> = { error:'#cf222e',warn:'#9a6700',info:'#0969da',http:'#1a7f37',debug:'#57606a' };

// ════════════════════════════════════════════════════════════
// ログビューアタブ
// ════════════════════════════════════════════════════════════
const LogViewerTab: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(true);
  const [level, setLevel] = useState<LogLevel>('all');
  const [keyword, setKeyword] = useState('FRONTEND');
  const [lines, setLines] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [logFileSize, setLogFileSize] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [dark, setDark] = useState(false);
  const todayJST = new Date(Date.now() + 9*60*60*1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayJST);
  const [endDate, setEndDate] = useState(todayJST);
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [archives, setArchives] = useState<ArchiveInfo[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [showArchives, setShowArchives] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const bg = dark ? '#0d1117' : '#f6f8fa';
  const bg2 = dark ? '#161b22' : '#ffffff';
  const border = dark ? '#30363d' : '#d0d7de';
  const text = dark ? '#c9d1d9' : '#1f2328';
  const textMuted = dark ? '#8b949e' : '#57606a';
  const LEVEL_COLORS = dark ? LEVEL_COLORS_DARK : LEVEL_COLORS_LIGHT;
  const iconColor = dark ? '#c9d1d9' : '#1f2328';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ lines: String(lines), level });
      if (keyword) params.set('keyword', keyword);
      if (useDateFilter && startDate) params.set('startDate', startDate);
      if (useDateFilter && endDate) params.set('endDate', endDate);
      const res = await apiClient.get(`/logs/recent?${params}`) as any;
      const data = res.data?.data || res.data;
      setLogs((data?.logs ?? [] as string[]).map(parseLine).reverse());
      setLogFileSize(data?.logFileSizeMB || '');
    } catch (e: any) {
      setLogs([{ raw:'', level:'error', message:`API エラー: ${e.message}`, timestamp:'' }]);
    } finally { setLoading(false); }
  }, [lines, level, keyword, startDate, endDate, useDateFilter]);

  useEffect(() => { fetchLogs(); }, []);
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (running) intervalRef.current = setInterval(fetchLogs, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, fetchLogs]);

  const fetchArchives = async () => {
    try {
      const res = await apiClient.get('/logs/archives') as any;
      setArchives(res.data?.data?.archives || []);
    } catch {}
  };

  const handleDownloadArchive = async (name: string) => {
    try {
      const res = await apiClient.get(`/logs/archives/${encodeURIComponent(name)}/download`, { responseType: 'blob' }) as any;
      const blob = new Blob([res.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`❌ ダウンロード失敗: ${e.message}`);
    }
  };

  const handleArchive = async () => {
    if (!confirm(
      '【退避 & クリア】\n\n' +
      '現在のログファイルをサーバーの logs/archives/ にコピー保存してからクリアします。\n' +
      'アーカイブは「退避済みアーカイブ一覧」からいつでも確認できます。\n\n実行しますか？'
    )) return;
    setArchiving(true);
    try {
      await (apiClient.post('/logs/archive', {}) as any);
      setLogs([]);
      await fetchArchives();
      alert('✅ アーカイブ完了。ログをクリアしました。\nサーバー logs/archives/ に保存済みです。');
    } catch (e: any) {
      alert(`❌ アーカイブ失敗: ${e.message}`);
    } finally { setArchiving(false); }
  };

  const downloadLogs = () => {
    const content = [...logs].reverse().map(l => l.raw).join('\n');
    const blob = new Blob([content], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backend-log-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
    a.click();
  };

  const errorCount = logs.filter(l=>l.level==='error').length;
  const warnCount  = logs.filter(l=>l.level==='warn').length;

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    padding: '2px 8px', border: `1px solid ${active?'#1f6feb':border}`,
    background: active ? '#1f6feb' : bg2, color: active ? '#fff' : iconColor,
    borderRadius: 4, cursor: 'pointer', fontSize: 11, display:'flex', alignItems:'center', gap: 3
  });

  return (
    <div style={{ fontFamily:'monospace', fontSize:12, color:text, background:bg, borderRadius:8, overflow:'hidden', border:`1px solid ${border}` }}>
      {/* ヘッダー */}
      <div style={{ background:bg2, borderBottom:`1px solid ${border}`, padding:'6px 12px', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <div style={{ display:'flex',alignItems:'center',gap:6,color:'#58a6ff',fontSize:14,fontWeight:'bold' }}>
          <Terminal size={16}/>リアルタイムログ
        </div>
        <span style={{ background:'rgba(255,123,114,0.2)',color:'#ff7b72',padding:'1px 6px',borderRadius:4,fontSize:11 }}>
          <AlertCircle size={10} style={{display:'inline',marginRight:2}}/>ERR {errorCount}
        </span>
        <span style={{ background:'rgba(227,179,65,0.2)',color:'#e3b341',padding:'1px 6px',borderRadius:4,fontSize:11 }}>
          <AlertTriangle size={10} style={{display:'inline',marginRight:2}}/>WARN {warnCount}
        </span>
        <span style={{ color:textMuted,fontSize:11 }}>計{logs.length}件{logFileSize&&` | ${logFileSize}MB`}</span>
        {loading && <span style={{color:'#58a6ff',fontSize:11}}>⟳</span>}
        <button onClick={()=>setRunning(r=>!r)} style={btnStyle()}>
          {running?<><Square size={10}/>停止</>:<><Play size={10}/>開始</>}
        </button>
        <button onClick={fetchLogs} style={btnStyle()} title="手動再読込"><RefreshCw size={12}/></button>
        <button onClick={handleArchive} disabled={archiving}
          title="退避してクリア（ログはサーバーに保存されます）"
          style={{...btnStyle(), color:'#e3b341', borderColor:'rgba(227,179,65,0.5)'}}>
          <Archive size={12}/>{archiving?'退避中...':'退避 & クリア'}
        </button>
        <button onClick={downloadLogs} style={btnStyle()} title="現在表示中のログをファイルダウンロード"><Download size={12}/></button>
        <button onClick={()=>setDark(d=>!d)} style={btnStyle()} title="テーマ切替">
          {dark?<Sun size={12}/>:<Moon size={12}/>}
        </button>
        {running && <span style={{color:'#56d364',fontSize:11,marginLeft:4}}>● リアルタイム(3秒)</span>}
      </div>

      {/* フィルターバー — 「表示フィルター」明示 */}
      <div style={{ background:bg2, borderBottom:`1px solid ${border}`, padding:'4px 12px', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <span style={{
          color:'#58a6ff', fontSize:10, fontWeight:'bold',
          background:'rgba(88,166,255,0.12)', border:'1px solid rgba(88,166,255,0.4)',
          borderRadius:3, padding:'1px 6px', letterSpacing:'0.05em', flexShrink:0
        }}>
          📋 表示フィルター
        </span>
        <input value={keyword} onChange={e=>setKeyword(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&fetchLogs()} placeholder="キーワード"
          style={{padding:'2px 8px',background:bg,color:text,border:`1px solid ${border}`,borderRadius:4,fontSize:11,width:130}}/>
        <select value={lines} onChange={e=>setLines(Number(e.target.value))}
          style={{padding:'2px 4px',background:bg,color:text,border:`1px solid ${border}`,borderRadius:4,fontSize:11}}>
          {[200,500,1000,2000,5000].map(n=><option key={n} value={n}>{n}件</option>)}
        </select>
        {(['all','error','warn','info','http','debug'] as LogLevel[]).map(lv=>(
          <button key={lv} onClick={()=>setLevel(lv)} style={btnStyle(level===lv)}
            title={`サーバー側で「${lv==='all'?'全レベルを':lv+'」のみ'}取得してフィルタ表示`}>
            <span style={{color:level===lv?'#fff':(LEVEL_COLORS[lv]||text)}}>{lv}</span>
          </button>
        ))}
        <label style={{display:'flex',alignItems:'center',gap:3,color:textMuted,fontSize:11}}>
          <input type="checkbox" checked={useDateFilter} onChange={e=>setUseDateFilter(e.target.checked)}/>日付
        </label>
        {useDateFilter&&(<>
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
            style={{padding:'2px 4px',background:bg,color:text,border:`1px solid ${border}`,borderRadius:4,fontSize:11}}/>
          <span style={{color:textMuted}}>〜</span>
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
            style={{padding:'2px 4px',background:bg,color:text,border:`1px solid ${border}`,borderRadius:4,fontSize:11}}/>
        </>)}
      </div>

      {/* ログエリア */}
      <div style={{padding:'2px 0', maxHeight:500, overflowY:'auto'}}>
        {logs.map((entry,i)=>(
          <div key={i} onClick={()=>setExpandedIdx(expandedIdx===i?null:i)}
            style={{padding:'1px 12px',
              background:expandedIdx===i?(dark?'#161b22':'#f0f6ff'):'transparent',
              borderLeft:`3px solid ${LEVEL_COLORS[entry.level]||border}`,
              borderBottom:`1px solid ${dark?'#21262d':'#eaeef2'}`,cursor:'pointer'}}>
            <div style={{display:'flex',gap:6,color:LEVEL_COLORS[entry.level]||text}}>
              <span style={{color:textMuted,minWidth:72,fontSize:11,flexShrink:0}}>
                {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour12:false}) : ''}
              </span>
              <span style={{minWidth:42,fontWeight:'bold',textTransform:'uppercase',fontSize:11,flexShrink:0}}>{entry.level}</span>
              <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:expandedIdx===i?'pre-wrap':'nowrap',fontSize:11,color:text}}>
                {entry.message}
              </span>
            </div>
            {expandedIdx===i&&(
              <pre style={{marginTop:2,padding:6,background:dark?'#0d1117':'#f6f8fa',borderRadius:4,overflow:'auto',fontSize:11,color:text,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
                {entry.data?JSON.stringify(entry.data,null,2):entry.raw}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* アーカイブ一覧 */}
      <div style={{borderTop:`1px solid ${border}`,padding:'6px 12px',background:bg2}}>
        <button onClick={()=>{setShowArchives(v=>!v);if(!showArchives)fetchArchives();}} style={{...btnStyle(),fontSize:11}}>
          <Archive size={11}/> 退避済みアーカイブ一覧 {showArchives?'▲':'▼'}
        </button>
        {showArchives && (
          <div style={{marginTop:6}}>
            {archives.length===0
              ? <span style={{color:textMuted,fontSize:11}}>アーカイブなし（「退避 & クリア」で保存されます）</span>
              : archives.map(a=>(
                <div key={a.name} style={{display:'flex',gap:8,fontSize:11,color:text,padding:'2px 0',borderBottom:`1px solid ${border}`,alignItems:'center'}}>
                  <span style={{flex:1,fontFamily:'monospace'}}>{a.name}</span>
                  <span style={{color:textMuted}}>{a.sizeMB}MB</span>
                  <span style={{color:textMuted}}>{new Date(a.createdAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</span>
                  <button onClick={()=>handleDownloadArchive(a.name)} title="ダウンロード"
                    style={{display:'flex',alignItems:'center',gap:2,padding:'1px 6px',border:`1px solid ${border}`,background:bg2,color:iconColor,borderRadius:4,cursor:'pointer',fontSize:10}}>
                    <Download size={10}/>
                  </button>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// サーバーLogLv・ログ管理タブ（開発者専用）
// ════════════════════════════════════════════════════════════
const ServerLogLevelTab: React.FC = () => {
  const [currentLevel, setCurrentLevel] = useState('');
  const [logConfig, setLogConfig] = useState<LogConfig>({
    maxFileSizeMB: 50, maxArchives: 10, autoArchiveEnabled: false,
    autoArchiveThresholdMB: 100, retentionDays: 30,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const LEVEL_COLORS: Record<string,string> = { error:'#ef4444',warn:'#f59e0b',info:'#3b82f6',http:'#22c55e',debug:'#6b7280' };
  const LEVEL_DESC: Record<string,string> = {
    error: 'エラーのみ記録（最小限・本番安定時）',
    warn:  '警告以上を記録',
    info:  '通常運用ログを記録 ✅ 推奨',
    http:  'HTTPアクセスログも記録',
    debug: '全詳細を記録 ⚠️ ファイル急増注意',
  };

  useEffect(() => {
    // 現在のサーバーLogLvを取得
    (apiClient.get('/logs/current-level') as any).then((res: any) => {
      const lv = res.data?.data?.level || res.data?.level;
      if (lv) setCurrentLevel(lv);
    }).catch(()=>{});
    // ログ設定を取得
    (apiClient.get('/logs/config') as any).then((res: any) => {
      const d = res.data?.data || res.data;
      if (d && d.maxArchives) setLogConfig(d);
    }).catch(()=>{});
  }, []);

  const changeLevel = async (lv: string) => {
    try {
      await (apiClient.post('/logs/level', {level:lv}) as any);
      setCurrentLevel(lv);
      alert(`✅ サーバーログレベルを「${lv}」に変更しました\n※ 再起動するとリセットされます。永続化は backend/.env の LOG_LEVEL を変更してください。`);
    } catch (e: any) { alert(`失敗: ${e.message}`); }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await (apiClient.put('/logs/config', logConfig) as any);
      setSaved(true); setTimeout(()=>setSaved(false), 3000);
    } catch (e: any) { alert(`設定保存失敗: ${e.message}`); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* サーバーLogLv */}
      <div className="bg-amber-50 rounded-xl p-5 border border-yellow-300">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded border border-yellow-300">
            ⚠️ 開発者専用
          </span>
          <h3 className="text-sm font-bold text-yellow-700">サーバーログレベル動的変更</h3>
        </div>
        <div className="text-xs text-gray-600 mb-2 space-y-1">
          <p>バックエンドサーバーがファイルに<strong className="text-yellow-700">書き込むログの種類</strong>をリアルタイムで制御します。</p>
          <p className="text-red-600">⚠️ 再起動するとリセット。永続化は <code className="bg-gray-100 px-1 rounded text-gray-700">backend/.env</code> の <code className="bg-gray-100 px-1 rounded text-gray-700">LOG_LEVEL</code> を変更してください。</p>
          <p className="text-gray-500">※ ログビューアの「表示フィルター」とは別物です。表示フィルターは取得データの絞り込みで、書き込みには影響しません。</p>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          {['error','warn','info','http','debug'].map(lv=>(
            <button key={lv} onClick={()=>changeLevel(lv)}
              className={`flex flex-col items-start px-4 py-3 rounded border transition-all ${
                currentLevel===lv ? 'border-blue-500 bg-blue-100'     : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}>
              <span className="text-xs font-bold uppercase" style={{color:LEVEL_COLORS[lv]}}>{lv}</span>
              <span className="text-xs text-gray-600 mt-1">{LEVEL_DESC[lv]}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3" id="svrloglv-current">
          現在のセッション設定: <span className="text-blue-700 font-mono font-bold">{currentLevel || '（変更なし）'}</span>
        </p>
      </div>

      {/* ログファイル管理設定 */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded border border-yellow-300">
            ⚠️ 開発者専用
          </span>
          <h3 className="text-sm font-bold text-blue-700">ログファイル管理設定</h3>
        </div>
        <div className="text-xs text-gray-600 mb-4 space-y-1">
          <p>アーカイブ世代数・自動退避閾値を設定します。</p>
          <p className="text-green-700">
            ✅ 自動退避を有効にすると、サーバーが10分おきに <code className="bg-gray-100 px-1 rounded text-gray-700">combined.log</code> のサイズを確認し、
            「自動退避閾値」を超えた時点で自動的にアーカイブ（コピー保存→クリア）します。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-700 block mb-1">最大アーカイブ世代数</label>
            <input type="number" value={logConfig.maxArchives} min={1} max={100}
              onChange={e=>setLogConfig({...logConfig,maxArchives:Number(e.target.value)})}
              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm"/>
            <p className="text-xs text-gray-500 mt-0.5">超えた古いアーカイブは自動削除</p>
          </div>
          <div>
            <label className="text-xs text-gray-700 block mb-1">ログ保持期間（日）</label>
            <input type="number" value={logConfig.retentionDays} min={1} max={3650}
              onChange={e=>setLogConfig({...logConfig,retentionDays:Number(e.target.value)})}
              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm"/>
          </div>
          <div>
            <label className="text-xs text-gray-700 block mb-1">最大ファイルサイズ (MB)</label>
            <input type="number" value={logConfig.maxFileSizeMB} min={10} max={500}
              onChange={e=>setLogConfig({...logConfig,maxFileSizeMB:Number(e.target.value)})}
              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm"/>
            <p className="text-xs text-gray-500 mt-0.5">自動退避有効時に参照</p>
          </div>
          <div>
            <label className="text-xs text-gray-700 block mb-1">自動退避閾値 (MB)</label>
            <input type="number" value={logConfig.autoArchiveThresholdMB} min={10} max={1000}
              onChange={e=>setLogConfig({...logConfig,autoArchiveThresholdMB:Number(e.target.value)})}
              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm"/>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={logConfig.autoArchiveEnabled}
                onChange={e=>setLogConfig({...logConfig,autoArchiveEnabled:e.target.checked})}
                className="rounded"/>
              自動退避を有効にする（閾値超過時に自動アーカイブ）
            </label>
          </div>
        </div>
        <button onClick={saveConfig} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50 transition-colors">
          <Save size={14}/>{saving?'保存中...':saved?'✅ 保存済み':'設定を保存'}
        </button>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
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
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${ok ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
      {ok ? `✅ ${t}` : `❌ ${f}`}
    </span>
  );

  const PORT_LABELS: Record<number, string> = { 80: 'HTTP (nginx→HTTPS redirect)', 443: 'HTTPS (Mobile/CMS nginx)', 3000: 'Backend内部 (nginxがproxy)', 3003: 'CMS prod (nginx)', 5432: 'PostgreSQL' };
  // staging での期待状態: 3003/5432=OPEN, 3000/3001/3002=CLOSED(正常)
  const PORT_EXPECTED_OPEN: Record<number, boolean> = { 80: true, 443: true, 3000: false, 3003: true, 5432: true };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={fetchStatus} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>更新
        </button>
        {lastUpdated && <span className="text-xs text-gray-500">最終更新: {lastUpdated}</span>}
      </div>

      {!status ? (
        <div className="text-gray-400 text-sm py-8 text-center">{loading ? '取得中...' : 'データなし'}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CPU */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">CPU</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">コア数</span><span className="text-gray-900 font-medium">{status.cpu.cores}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Load (1m)</span><span className={parseFloat(status.cpu.loadAvg1m) > status.cpu.cores * 0.8 ? 'text-red-400' : 'text-green-400'}>{status.cpu.loadAvg1m}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Load (5m)</span><span className="text-gray-700">{status.cpu.loadAvg5m}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Load (15m)</span><span className="text-gray-700">{status.cpu.loadAvg15m}</span></div>
            </div>
          </div>

          {/* Memory */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">メモリ</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">使用率</span><span className={parseFloat(status.memory.usedPercent) > 80 ? 'text-red-400' : 'text-green-400'}>{status.memory.usedPercent}%</span></div>
              <div className="flex justify-between"><span className="text-gray-600">使用/総計</span><span className="text-gray-700">{status.memory.usedMB} / {status.memory.totalMB} MB</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Node Heap</span><span className="text-gray-700">{status.memory.nodeHeapUsedMB}/{status.memory.nodeHeapTotalMB} MB</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Node RSS</span><span className="text-gray-700">{status.memory.nodeRssMB} MB</span></div>
            </div>
          </div>

          {/* Disk */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">ディスク (/)</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">使用率</span><span className={parseInt(status.disk.usedPercent) > 80 ? 'text-red-400' : 'text-green-400'}>{status.disk.usedPercent}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">使用/総計</span><span className="text-gray-700">{status.disk.used} / {status.disk.total}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">空き</span><span className="text-gray-700">{status.disk.free}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">ログファイル</span><span className="text-yellow-400">{status.logFile.sizeMB} MB</span></div>
            </div>
          </div>

          {/* Services & Ports */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">サービス・ポート</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Backend systemd</span>
                {badge(status.services.backendSystemd === 'active', 'active', status.services.backendSystemd)}
              </div>
              <div className="flex justify-between"><span className="text-gray-600">稼働時間</span><span className="text-gray-700">{status.services.nodeUptime}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">PID</span><span className="text-gray-700">{status.services.pid}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Node.js</span><span className="text-gray-700">{status.services.nodeVersion}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">ログLv</span><span className="text-blue-700 font-mono font-bold">{status.logLevel}</span></div>
              <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                {Object.entries(status.ports).map(([port, open]) => (
                  <div key={port} className="flex justify-between items-center">
                    <span className="text-gray-600 font-mono">:{port} <span className="text-gray-400 text-xs">{PORT_LABELS[Number(port)] || ''}</span></span>
                    {(() => { const exp = PORT_EXPECTED_OPEN[Number(port)]; const ok = open === exp; return <span className={`px-2 py-0.5 rounded text-xs font-bold border ${ ok ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300' }`}>{open ? '✅ OPEN' : '❌ CLOSED'}{!ok ? ' ⚠️' : ''}</span>; })()}
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
// ════════════════════════════════════════════════════════════
const DEVELOPER_TABS = [
  { id: 'log-viewer',    label: 'ログビューア',          icon: Terminal  },
  { id: 'server-log',    label: 'サーバーLogLv・管理',   icon: Settings  },
  { id: 'gps-inspector', label: 'GPS Inspector',         icon: Satellite },
  { id: 'op-debug',      label: '運行・点検デバッグ',    icon: FileText  },
  { id: 'data-cleanup',  label: 'データクリーンアップ',  icon: Database  },
  { id: 'server-status', label: 'サーバー状態',          icon: Settings  },
] as const;
type DevTabId = typeof DEVELOPER_TABS[number]['id'];

const DeveloperTools: React.FC = () => {
  useTLog('DEVELOPER_TOOLS', '開発者ツール');
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<DevTabId>('log-viewer');

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300"/>
          <p className="text-lg font-medium">アクセス権限がありません</p>
          <p className="text-sm mt-1">このページは ADMIN ロールのみ閲覧可能です</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ページヘッダー */}
      <div className="flex items-center gap-3">
        <div className="bg-orange-100 p-2 rounded-lg">
          <Terminal className="w-6 h-6 text-orange-600"/>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">開発者ツール</h1>
          <p className="text-sm text-gray-500">ADMIN専用 — ログ管理・デバッグ・データ診断</p>
        </div>
        <span className="ml-auto px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
          ⚠️ 開発者専用
        </span>
      </div>

      {/* タブナビ */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-1 overflow-x-auto">
          {DEVELOPER_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                className={`whitespace-nowrap py-2 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab===tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                <Icon className="w-4 h-4"/>{tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* タブコンテンツ */}
      <div>
        {activeTab === 'log-viewer'    && <LogViewerTab/>}
        {activeTab === 'server-log'    && <ServerLogLevelTab/>}
        {activeTab === 'gps-inspector' && <GpsInspector/>}
        {activeTab === 'op-debug'      && <OperationDebug/>}
        {activeTab === 'data-cleanup'  && <DevDataCleanup/>}
        {activeTab === 'server-status' && <ServerStatusTab/>}
      </div>
    </div>
  );
};

export default DeveloperTools;
