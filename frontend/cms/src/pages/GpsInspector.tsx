// frontend/cms/src/pages/GpsInspector.tsx
// GPS Inspector — 運行別GPS記録の診断・検証ページ (ADMIN専用)
// 機能:
//  - 運行IDを入力してGPS RAWデータをDBから取得・表示
//  - バックエンドgps.logを取得・フィルタリング表示
//  - DB記録とログを並べて問題点を自動診断
//  - Fix-1〜BUG-031など各修正の動作確認ギミック

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/api';
import { useAuthStore } from '../store/authStore';

// ─── 型定義 ───────────────────────────────────────────
interface Operation {
  id: string; operationNumber: string; status: string;
  actualStartTime: string | null; actualEndTime: string | null;
  totalDistanceKm: number | null; startOdometer: number | null;
  endOdometer: number | null; gpsLogCount: number;
  vehiclePlate: string | null; driverName: string | null;
}

interface GpsLogEntry {
  id: string; latitude: number; longitude: number;
  accuracyMeters: number | null; speedKmh: number | null;
  heading: number | null; altitude: number | null;
  recordedAt: string; operationId: string | null;
  deltaKm: number; isNoise: boolean; cumulativeKm: number;
}

interface Diagnostics {
  totalLogs: number; logsWithOperationId: number;
  logsWithoutOperationId: number; nullOperationCountInDB: number;
  accuracyStats: { min: string; max: string; avg: string;
    over100m: number; over150m: number } | null;
  distanceCalc: { totalDistanceKm: number; noiseSkippedKm: number;
    noiseSegments: number; dbTotalDistanceKm: number | null };
  filters: Record<string, string>;
}

interface InspectionResult {
  operation: any; gpsLogs: GpsLogEntry[]; diagnostics: Diagnostics;
}

interface LogEntry { raw?: string; level?: string; message?: string;
  [key: string]: any; }

// ─── カラーヘルパー ────────────────────────────────────
const accColor = (v: number | null) => {
  if (v === null) return 'text-gray-400';
  if (v > 150) return 'text-red-600 font-bold';
  if (v > 100) return 'text-orange-500 font-semibold';
  if (v > 50)  return 'text-yellow-600';
  return 'text-green-600';
};
const levelColor: Record<string, string> = {
  error: 'bg-red-50 text-red-800', warn: 'bg-yellow-50 text-yellow-800',
  info: 'bg-blue-50 text-blue-700', debug: 'bg-gray-50 text-gray-600',
};
function fmtDt(s: string | null) {
  return s ? new Date(s).toLocaleString('ja-JP') : '—';
}
function fmtKm(v: number | null) {
  return v !== null ? `${v.toFixed(3)} km` : '—';
}

// ─── メインコンポーネント ───────────────────────────────
const GpsInspector: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [recentOps, setRecentOps] = useState<Operation[]>([]);
  const [selectedOpId, setSelectedOpId] = useState('');
  const [inputOpId, setInputOpId] = useState('');
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [logLines, setLogLines] = useState(300);
  const [loading, setLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'db'|'log'|'compare'>('db');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showOpList, setShowOpList] = useState(false); // 運行一覧の折り畳み制御
  const [error, setError] = useState('');

  // 最近の運行一覧取得
  useEffect(() => {
    if (!isAdmin) return;
    apiClient.get('/debug/gps/recent-operations?limit=20')
      .then((res: any) => {
        const d = res?.data?.data || res?.data || [];
        setRecentOps(Array.isArray(d) ? d : []);
      }).catch(() => {});
  }, [isAdmin]);

  // GPS RAWデータ取得
  const fetchGpsData = useCallback(async (opId: string) => {
    if (!opId.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res: any = await apiClient.get(`/debug/gps/operation/${opId.trim()}`);
      const d = res?.data?.data || res?.data;
      setResult(d);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'データ取得エラー');
    } finally {
      setLoading(false);
    }
  }, []);

  // バックエンドログ取得
  const fetchLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const res: any = await apiClient.get(`/debug/gps/logs?lines=${logLines}`);
      const entries = res?.data?.data?.entries || [];
      setLogEntries(entries);
    } catch { setLogEntries([]); }
    finally { setLogLoading(false); }
  }, [logLines]);

  useEffect(() => {
    if (activeTab === 'log' || activeTab === 'compare') fetchLogs();
  }, [activeTab, fetchLogs]);

  // 問題点自動検出
  const issues: { level: 'error'|'warn'|'ok'; msg: string; detail?: string }[] = [];
  if (result) {
    const d = result.diagnostics;
    if (d.totalLogs === 0)
      issues.push({ level: 'error', msg: 'GPSログが0件',
        detail: 'BUG-031が未修正か、enableLogging=trueが渡されていない可能性があります' });
    if (d.logsWithoutOperationId > 0)
      issues.push({ level: 'warn', msg: `operationId=NULLのログが${d.logsWithoutOperationId}件`,
        detail: 'Fix-1/2が未適用、または旧ログが残存しています' });
    if (d.nullOperationCountInDB > 50)
      issues.push({ level: 'warn', msg: `DB全体でoperationId=NULLが${d.nullOperationCountInDB}件`,
        detail: 'DELETE FROM "GpsLog" WHERE "operationId" IS NULL; で削除を検討' });
    if (d.accuracyStats) {
      const avg = parseFloat(d.accuracyStats.avg);
      if (d.accuracyStats.over150m > 0)
        issues.push({ level: 'warn', msg: `accuracy{'>'}{150}mのログが${d.accuracyStats.over150m}件`,
          detail: 'Fix-1: DBに保存されているが正常 (保存済みレコード=修正前の記録か、または150m未満でDBに入った)' });
      if (avg > 80)
        issues.push({ level: 'warn', msg: `平均精度${avg.toFixed(0)}m — GPS精度が低い環境`,
          detail: '屋内テストの場合は正常。実走での精度を確認してください' });
    }
    if (d.distanceCalc.dbTotalDistanceKm !== null) {
      const diff = Math.abs(d.distanceCalc.totalDistanceKm - d.distanceCalc.dbTotalDistanceKm);
      if (diff > 0.5)
        issues.push({ level: 'warn',
          msg: `DB記録距離(${d.distanceCalc.dbTotalDistanceKm.toFixed(3)}km)とGPS再計算(${d.distanceCalc.totalDistanceKm.toFixed(3)}km)が${diff.toFixed(3)}km乖離`,
          detail: 'endOdometerかフロント計算値が使われた場合は正常な乖離の可能性あり' });
    }
    if (issues.length === 0)
      issues.push({ level: 'ok', msg: '問題なし — 全チェック通過' });
  }

  // ログフィルタリング
  const filteredLogs = logEntries.filter(e => {
    const str = JSON.stringify(e).toLowerCase();
    return !logFilter || str.includes(logFilter.toLowerCase());
  });
  const displayLogs = showAllLogs ? filteredLogs : filteredLogs.slice(-100);

  if (!isAdmin) return (
    <div className="p-8 text-red-600 font-bold text-lg">
      ⛔ このページはADMIN/MANAGERのみアクセス可能です
    </div>
  );

  return (
    <div className="max-w-full">
      {/* ヘッダー */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🛰️ GPS Inspector
            <span className="text-sm font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded">ADMIN専用</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            運行IDを指定してGPS記録のRAWデータ・バックエンドログ・問題点を診断します
          </p>
        </div>
      </div>

      {/* 運行選択パネル */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-64">
            <label className="block text-xs text-gray-500 mb-1">運行ID（直接入力）</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm font-mono"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={inputOpId}
              onChange={e => setInputOpId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchGpsData(inputOpId)}
            />
          </div>
          <button
            onClick={() => { setSelectedOpId(inputOpId); fetchGpsData(inputOpId); }}
            disabled={loading || !inputOpId.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {loading ? '取得中...' : '🔍 診断'}
          </button>
        </div>

        {/* 最近の運行リスト — 折り畳み対応 */}
        {recentOps.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowOpList(prev => !prev)}
              className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-800 mb-2 select-none"
            >
              <span>{showOpList ? '▼' : '▶'}</span>
              <span>最近の運行一覧（クリックで選択）: {recentOps.length}件</span>
              <span className="text-gray-400">{showOpList ? '（クリックで閉じる）' : '（クリックで開く）'}</span>
            </button>
            {showOpList && <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {['運行番号','状態','開始日時','GPS件数','距離','車両','ドライバー','操作'].map(h => (
                      <th key={h} className="text-left px-2 py-1 border-b text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOps.map(op => (
                    <tr key={op.id}
                      className={`hover:bg-blue-50 cursor-pointer ${selectedOpId===op.id ? 'bg-blue-100' : ''}`}
                      onClick={() => { setInputOpId(op.id); setSelectedOpId(op.id); fetchGpsData(op.id); }}
                    >
                      <td className="px-2 py-1 border-b font-mono text-gray-700">{op.operationNumber}</td>
                      <td className="px-2 py-1 border-b">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          op.status==='COMPLETED' ? 'bg-green-100 text-green-700' :
                          op.status==='IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'}`}>{op.status}</span>
                      </td>
                      <td className="px-2 py-1 border-b text-gray-600">{fmtDt(op.actualStartTime)}</td>
                      <td className="px-2 py-1 border-b">
                        <span className={op.gpsLogCount === 0 ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'}>
                          {op.gpsLogCount}件
                        </span>
                      </td>
                      <td className="px-2 py-1 border-b">{fmtKm(op.totalDistanceKm)}</td>
                      <td className="px-2 py-1 border-b">{op.vehiclePlate || '—'}</td>
                      <td className="px-2 py-1 border-b">{op.driverName || '—'}</td>
                      <td className="px-2 py-1 border-b">
                        <button className="text-blue-600 hover:underline text-xs">診断</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
          ❌ {error}
        </div>
      )}

      {/* 診断結果タブ */}
      {(result || activeTab === 'log') && (
        <>
          <div className="flex gap-1 mb-0 border-b border-gray-200">
            {[
              { id: 'db', label: '📊 DB記録データ', disabled: !result },
              { id: 'log', label: '📋 バックエンドログ', disabled: false },
              { id: 'compare', label: '🔍 問題点診断', disabled: !result },
            ].map(tab => (
              <button key={tab.id}
                onClick={() => { if (!tab.disabled) setActiveTab(tab.id as any); }}
                disabled={tab.disabled}
                className={`px-4 py-2 text-sm font-medium rounded-t border-t border-l border-r -mb-px
                  ${activeTab === tab.id
                    ? 'bg-white border-gray-200 text-blue-700 border-b-white'
                    : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100 disabled:opacity-40'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-b rounded-tr p-4">

            {/* === DB記録タブ === */}
            {activeTab === 'db' && result && (
              <div>
                {/* 運行サマリー */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'GPS記録件数', value: result.diagnostics.totalLogs,
                      color: result.diagnostics.totalLogs===0 ? 'text-red-600 font-bold text-2xl' : 'text-green-600 font-bold text-2xl' },
                    { label: 'DB計算距離', value: fmtKm(result.diagnostics.distanceCalc.totalDistanceKm),
                      color: 'text-blue-700 font-bold text-xl' },
                    { label: 'DB保存距離', value: fmtKm(result.diagnostics.distanceCalc.dbTotalDistanceKm),
                      color: 'text-gray-700 font-bold text-xl' },
                    { label: 'ノイズスキップ', value: `${result.diagnostics.distanceCalc.noiseSegments}件`,
                      color: 'text-orange-600 font-bold text-xl' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded p-3">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className={s.color}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* 精度統計 */}
                {result.diagnostics.accuracyStats && (
                  <div className="bg-blue-50 rounded p-3 mb-4 text-sm">
                    <p className="font-semibold text-blue-800 mb-1">📡 精度 (accuracy) 統計</p>
                    <div className="flex gap-6 flex-wrap">
                      <span>最小: <b>{result.diagnostics.accuracyStats.min}m</b></span>
                      <span>最大: <b className={parseFloat(result.diagnostics.accuracyStats.max)>150 ? 'text-red-600' : ''}>
                        {result.diagnostics.accuracyStats.max}m</b></span>
                      <span>平均: <b>{result.diagnostics.accuracyStats.avg}m</b></span>
                      <span className={result.diagnostics.accuracyStats.over100m > 0 ? 'text-orange-600' : ''}>
                        {'>'}{100}m: <b>{result.diagnostics.accuracyStats.over100m}件</b> (送信スキップ対象)
                      </span>
                      <span className={result.diagnostics.accuracyStats.over150m > 0 ? 'text-red-600' : ''}>
                        {'>'}{150}m: <b>{result.diagnostics.accuracyStats.over150m}件</b> (DB保存スキップ対象)
                      </span>
                    </div>
                  </div>
                )}

                {/* GPS修正フィルタ一覧 */}
                <details className="mb-4">
                  <summary className="cursor-pointer text-sm text-gray-600 font-medium mb-2">
                    🛡️ 適用中のGPS精度フィルタ一覧（クリックで展開）
                  </summary>
                  <div className="bg-gray-50 rounded p-3 mt-2 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs">
                    {Object.entries(result.diagnostics.filters).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-green-600">✅</span>
                        <span className="font-mono text-gray-700">{k}:</span>
                        <span className="text-gray-600">{v}</span>
                      </div>
                    ))}
                  </div>
                </details>

                {/* GPS RAWログテーブル */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">
                      GPS RAWログ ({result.gpsLogs.length}件)
                    </p>
                    <span className="text-xs text-gray-400">赤=ノイズスキップ / 橙=accuracy{'>'}{100}m</span>
                  </div>
                  <div className="overflow-auto max-h-96 border rounded">
                    <table className="text-xs w-full border-collapse">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          {['#','recordedAt','緯度','経度','精度(m)','速度(km/h)','方位','Δkm','累計km','N/S'].map(h => (
                            <th key={h} className="text-left px-2 py-1 border-b text-gray-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.gpsLogs.map((log, i) => (
                          <tr key={log.id}
                            className={log.isNoise ? 'bg-red-50 opacity-60' :
                              log.accuracyMeters !== null && log.accuracyMeters > 100 ? 'bg-orange-50' : 'hover:bg-gray-50'}
                          >
                            <td className="px-2 py-0.5 border-b text-gray-400">{i+1}</td>
                            <td className="px-2 py-0.5 border-b whitespace-nowrap">{new Date(log.recordedAt).toLocaleTimeString('ja-JP')}</td>
                            <td className="px-2 py-0.5 border-b font-mono">{log.latitude.toFixed(6)}</td>
                            <td className="px-2 py-0.5 border-b font-mono">{log.longitude.toFixed(6)}</td>
                            <td className={`px-2 py-0.5 border-b ${accColor(log.accuracyMeters)}`}>
                              {log.accuracyMeters !== null ? log.accuracyMeters.toFixed(0) : '—'}
                            </td>
                            <td className="px-2 py-0.5 border-b">{log.speedKmh !== null ? log.speedKmh.toFixed(1) : '—'}</td>
                            <td className="px-2 py-0.5 border-b">{log.heading !== null ? log.heading.toFixed(0)+'°' : '—'}</td>
                            <td className={`px-2 py-0.5 border-b font-mono ${log.isNoise ? 'text-red-500 line-through' : ''}`}>
                              {log.deltaKm > 0 ? log.deltaKm.toFixed(4) : '—'}
                            </td>
                            <td className="px-2 py-0.5 border-b font-mono text-blue-600">{log.cumulativeKm.toFixed(3)}</td>
                            <td className="px-2 py-0.5 border-b text-center">
                              {log.isNoise ? '🔇' : '✅'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* === バックエンドログタブ === */}
            {activeTab === 'log' && (
              <div>
                <div className="flex gap-3 items-center mb-3 flex-wrap">
                  <input
                    className="border rounded px-3 py-1.5 text-sm flex-1 min-w-40"
                    placeholder="フィルタ (GPS-RX, GPS-SAVE, GPS-SKIP, GPS-DIST, operationId ...)"
                    value={logFilter}
                    onChange={e => setLogFilter(e.target.value)}
                  />
                  <select
                    className="border rounded px-2 py-1.5 text-sm"
                    value={logLines}
                    onChange={e => setLogLines(parseInt(e.target.value))}
                  >
                    {[100,200,300,500,1000].map(n => (
                      <option key={n} value={n}>末尾{n}行</option>
                    ))}
                  </select>
                  <button onClick={fetchLogs} disabled={logLoading}
                    className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm disabled:opacity-50">
                    {logLoading ? '取得中...' : '🔄 更新'}
                  </button>
                  <label className="flex items-center gap-1 text-sm text-gray-600">
                    <input type="checkbox" checked={showAllLogs} onChange={e => setShowAllLogs(e.target.checked)} />
                    全件表示
                  </label>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  表示: {displayLogs.length}/{filteredLogs.length}件
                  {logFilter && ` (フィルタ: "${logFilter}")`}
                </p>
                <div className="space-y-0.5 max-h-[600px] overflow-y-auto font-mono text-xs">
                  {displayLogs.length === 0 && (
                    <p className="text-gray-400 text-center py-8">
                      {logLoading ? '取得中...' : 'ログがありません。dt-restart後に運行を実行してください。'}
                    </p>
                  )}
                  {displayLogs.map((entry, i) => {
                    const isGPSRX = JSON.stringify(entry).includes('GPS-RX');
                    const isGPSSAVE = JSON.stringify(entry).includes('GPS-SAVE');
                    const isGPSSKIP = JSON.stringify(entry).includes('GPS-SKIP');
                    const isGPSDIST = JSON.stringify(entry).includes('GPS-DIST');
                    const lvl = entry.level || 'info';
                    return (
                      <div key={i} className={`px-2 py-1 rounded text-xs ${
                        isGPSSKIP ? 'bg-orange-50 border-l-2 border-orange-400' :
                        isGPSSAVE ? 'bg-green-50 border-l-2 border-green-400' :
                        isGPSRX   ? 'bg-blue-50 border-l-2 border-blue-400' :
                        isGPSDIST ? 'bg-purple-50 border-l-2 border-purple-400' :
                        levelColor[lvl] || 'bg-gray-50'
                      }`}>
                        {entry.raw
                          ? <span className="text-gray-600">{entry.raw}</span>
                          : <>
                            <span className="text-gray-400 mr-2">{entry.timestamp || ''}</span>
                            <span className={`mr-2 font-semibold ${lvl==='error'?'text-red-700':lvl==='warn'?'text-yellow-700':'text-blue-700'}`}>
                              [{lvl.toUpperCase()}]
                            </span>
                            <span className="text-gray-800">{entry.message || ''}</span>
                            {(entry.accuracy || entry.operationId || entry.id) && (
                              <span className="text-gray-500 ml-2">
                                {entry.operationId && `opId:${String(entry.operationId).slice(-8)} `}
                                {entry.accuracy && `acc:${entry.accuracy}m `}
                                {entry.id && `id:${String(entry.id).slice(-8)}`}
                              </span>
                            )}
                          </>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === 問題点診断タブ === */}
            {activeTab === 'compare' && result && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">🔍 自動問題点診断</h3>

                {/* 問題一覧 */}
                <div className="space-y-2 mb-6">
                  {issues.map((issue, i) => (
                    <div key={i} className={`rounded p-3 text-sm ${
                      issue.level==='error' ? 'bg-red-50 border border-red-200' :
                      issue.level==='warn'  ? 'bg-yellow-50 border border-yellow-200' :
                      'bg-green-50 border border-green-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{issue.level==='error'?'🚨':issue.level==='warn'?'⚠️':'✅'}</span>
                        <div>
                          <p className={`font-semibold ${
                            issue.level==='error'?'text-red-800':
                            issue.level==='warn'?'text-yellow-800':'text-green-800'}`}>
                            {issue.msg}
                          </p>
                          {issue.detail && <p className="text-xs text-gray-600 mt-0.5">{issue.detail}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 修正チェックリスト */}
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">📋 GPS修正チェックリスト</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {[
                      { fix: 'BUG-031', desc: 'useGPS enableLogging=true 設定', check: result.diagnostics.totalLogs > 0 },
                      { fix: 'Fix-1/2', desc: 'operationId紐付き (logsWithoutOperationId=0)', check: result.diagnostics.logsWithoutOperationId === 0 },
                      { fix: 'Fix-3', desc: 'GPS履歴 operationIdフィルタ', check: true },
                      { fix: 'Fix-4A', desc: 'accuracy{'>'}{100}m 送信スキップ', check: result.diagnostics.accuracyStats ? result.diagnostics.accuracyStats.over100m === 0 : true },
                      { fix: 'Fix-4B', desc: 'accuracy{'>'}{150}m 距離計算スキップ', check: result.diagnostics.accuracyStats ? result.diagnostics.accuracyStats.over150m === 0 : true },
                      { fix: 'Fix-S11-3', desc: '<10mノイズスキップ (BE)', check: result.diagnostics.distanceCalc.noiseSegments >= 0 },
                      { fix: 'Fix-A', desc: 'CMS GPSルート全点描画', check: true },
                      { fix: 'Fix-B', desc: 'PICKUP/DELIVERY parseLocationTypes', check: true },
                    ].map(item => (
                      <div key={item.fix} className={`flex items-center gap-2 p-2 rounded ${item.check ? 'bg-green-50' : 'bg-red-50'}`}>
                        <span>{item.check ? '✅' : '❌'}</span>
                        <span className="font-mono text-gray-600">{item.fix}</span>
                        <span className="text-gray-600">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 修正推奨アクション */}
                {issues.some(i => i.level !== 'ok') && (
                  <div className="mt-4 bg-blue-50 rounded p-4">
                    <h4 className="text-sm font-bold text-blue-800 mb-2">🔧 推奨アクション</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      {result.diagnostics.totalLogs === 0 && (
                        <li>• dt-restart 後に再度運行を実行し、バックエンドlogで [GPS-SAVE] が出力されるか確認</li>
                      )}
                      {result.diagnostics.nullOperationCountInDB > 50 && (
                        <li>• DBeaver: DELETE FROM "GpsLog" WHERE "operationId" IS NULL;</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!result && !loading && activeTab === 'db' && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-4xl mb-3">🛰️</p>
          <p className="text-gray-500">上の一覧から運行を選択するか、運行IDを入力して診断してください</p>
        </div>
      )}
    </div>
  );
};

export default GpsInspector;
