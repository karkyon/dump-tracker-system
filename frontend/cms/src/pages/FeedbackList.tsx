// frontend/cms/src/pages/FeedbackList.tsx
// フィードバック管理 一覧画面 (FB-01)
// ADMIN / MANAGER 専用

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTLog } from '../hooks/useTLog';
import { toast } from 'react-hot-toast';
import {
  MessageSquare, RefreshCw, Download,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { API_BASE_URL } from '../utils/constants';

// =============================================
// 型定義
// =============================================

export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'wontfix';
export type FeedbackApp = 'mobile' | 'cms';

export interface FeedbackItem {
  id: string;
  app: FeedbackApp;
  name?: string;
  reportType: string;
  screen: string;
  what: string;
  severity: number;
  device?: string;
  photoPaths?: string[];
  createdAt: string;
  status: FeedbackStatus;
  backlogIssueKey?: string;
}

interface FeedbackStats {
  total: number;
  new: number;
  in_progress: number;
  resolved: number;
  wontfix: number;
}

// =============================================
// 定数
// =============================================

const REPORT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  bug:     { label: '🐛 バグ',    color: 'bg-red-100 text-red-700' },
  odd:     { label: '⚠️ おかしい', color: 'bg-orange-100 text-orange-700' },
  improve: { label: '💡 改善',    color: 'bg-purple-100 text-purple-700' },
  feature: { label: '✨ 新機能',  color: 'bg-blue-100 text-blue-700' },
  data:    { label: '📊 データ',  color: 'bg-yellow-100 text-yellow-700' },
  good:    { label: '👍 良い',    color: 'bg-green-100 text-green-700' },
};

const SEVERITY_CONFIG: Record<number, { label: string; color: string }> = {
  0: { label: '🔴 業務停止', color: 'bg-red-100 text-red-700 border border-red-200' },
  1: { label: '🟠 業務支障', color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  2: { label: '🟡 不便',     color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  3: { label: '🟢 軽微',     color: 'bg-green-100 text-green-700 border border-green-200' },
};

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  new:         { label: '🔴 新規',   color: 'bg-red-50 text-red-700 border border-red-200' },
  in_progress: { label: '🟠 対応中', color: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  resolved:    { label: '✅ 完了',   color: 'bg-green-50 text-green-700 border border-green-200' },
  wontfix:     { label: '⚫ 却下',   color: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

// =============================================
// API ヘルパー
// =============================================

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// =============================================
// コンポーネント
// =============================================

const FeedbackList: React.FC = () => {
  useTLog('FEEDBACK_LIST', 'フィードバック管理一覧');
  const navigate = useNavigate();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({ total: 0, new: 0, in_progress: 0, resolved: 0, wontfix: 0 });
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [filterApp, setFilterApp] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('new');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  // sortOrderはAPIに渡すが setter は fetchData 内部でのみ使用（'desc'固定）
  const [sortBy, setSortBy] = useState<'createdAt' | 'severity'>('createdAt');
  const sortOrder = 'desc';

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterApp) params.set('app', filterApp);
      if (filterType) params.set('reportType', filterType);
      if (filterSeverity !== '') params.set('severity', filterSeverity);
      if (filterStatus) params.set('status', filterStatus);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (filterKeyword) params.set('keyword', filterKeyword);
      params.set('page', String(pg));
      params.set('limit', String(limit));
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await fetch(`${API_BASE_URL}/feedback?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      setItems(json.data || []);
      setTotal(json.meta?.total || 0);
      if (json.meta?.stats) setStats(json.meta.stats);
    } catch (e: any) {
      toast.error(`フィードバック取得エラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [filterApp, filterType, filterSeverity, filterStatus, filterDateFrom, filterDateTo, filterKeyword, sortBy, sortOrder, page, limit]);

  useEffect(() => { fetchData(1); setPage(1); }, [filterApp, filterType, filterSeverity, filterStatus, filterDateFrom, filterDateTo, filterKeyword, sortBy]);
  useEffect(() => { fetchData(page); }, [page]);

  const bulkUpdateStatus = async (status: FeedbackStatus) => {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          fetch(`${API_BASE_URL}/feedback/${id}/status`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status }),
          })
        )
      );
      toast.success(`${selected.size}件を「${STATUS_CONFIG[status].label}」に変更しました`);
      setSelected(new Set());
      fetchData(page);
    } catch {
      toast.error('一括変更に失敗しました');
    }
  };

  const exportCsv = () => {
    const headers = ['ID', 'アプリ', '種類', '影響度', '画面', '内容', '報告者', '日時', 'ステータス', 'Backlog'];
    const rows = items.map(i => [
      i.id.substring(0, 8),
      i.app,
      REPORT_TYPE_CONFIG[i.reportType]?.label || i.reportType,
      SEVERITY_CONFIG[i.severity]?.label || String(i.severity),
      i.screen,
      `"${i.what.replace(/"/g, '""')}"`,
      i.name || '匿名',
      new Date(i.createdAt).toLocaleString('ja-JP'),
      STATUS_CONFIG[i.status]?.label || i.status,
      i.backlogIssueKey || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary-600" />
            フィードバック管理
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
              ADMIN専用
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ユーザーから収集したフィードバックの確認・ステータス管理・Backlog連携
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> CSV出力
          </button>
          <button
            onClick={() => fetchData(page)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
          >
            <RefreshCw className="h-4 w-4" /> 更新
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-5 gap-3">
        {([
          { key: 'total',       label: '合計',   num: stats.total,       color: 'border-l-primary-500', numColor: 'text-primary-600' },
          { key: 'new',         label: '新規',   num: stats.new,         color: 'border-l-red-500',     numColor: 'text-red-600' },
          { key: 'in_progress', label: '対応中', num: stats.in_progress, color: 'border-l-yellow-500',  numColor: 'text-yellow-600' },
          { key: 'resolved',    label: '完了',   num: stats.resolved,    color: 'border-l-green-500',   numColor: 'text-green-600' },
          { key: 'wontfix',     label: '却下',   num: stats.wontfix,     color: 'border-l-gray-400',    numColor: 'text-gray-500' },
        ] as const).map(c => (
          <div
            key={c.key}
            className={`bg-white rounded-lg border border-gray-200 border-l-4 ${c.color} p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
            onClick={() => { setFilterStatus(c.key === 'total' ? '' : c.key); setPage(1); }}
          >
            <div className={`text-3xl font-extrabold ${c.numColor}`}>{c.num}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">アプリ</label>
            <select value={filterApp} onChange={e => setFilterApp(e.target.value)} className="h-8 border border-gray-300 rounded text-sm px-2 bg-white focus:outline-none focus:border-primary-500">
              <option value="">すべて</option>
              <option value="mobile">📱 モバイル</option>
              <option value="cms">💻 CMS</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">種類</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-8 border border-gray-300 rounded text-sm px-2 bg-white focus:outline-none focus:border-primary-500">
              <option value="">すべて</option>
              {Object.entries(REPORT_TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">影響度</label>
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="h-8 border border-gray-300 rounded text-sm px-2 bg-white focus:outline-none focus:border-primary-500">
              <option value="">すべて</option>
              {[0, 1, 2, 3].map(n => (
                <option key={n} value={String(n)}>{SEVERITY_CONFIG[n].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">ステータス</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-8 border border-gray-300 rounded text-sm px-2 bg-white focus:outline-none focus:border-primary-500">
              <option value="">すべて</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">開始日</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-8 border border-gray-300 rounded text-sm px-2 focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">終了日</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-8 border border-gray-300 rounded text-sm px-2 focus:outline-none focus:border-primary-500" />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">キーワード</label>
            <input
              type="text"
              value={filterKeyword}
              onChange={e => setFilterKeyword(e.target.value)}
              placeholder="問題内容・画面名で検索..."
              className="h-8 w-full border border-gray-300 rounded text-sm px-2 focus:outline-none focus:border-primary-500"
            />
          </div>
          <button
            onClick={() => { setFilterApp(''); setFilterType(''); setFilterSeverity(''); setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterKeyword(''); }}
            className="h-8 px-3 border border-gray-300 rounded text-sm text-gray-600 bg-white hover:bg-gray-50"
          >
            リセット
          </button>
        </div>
      </div>

      {/* 一括操作バー */}
      {selected.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <span className="text-sm font-semibold text-primary-700">{selected.size}件 選択中</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkUpdateStatus('in_progress')} className="px-3 py-1 text-xs border border-yellow-300 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">→ 対応中</button>
            <button onClick={() => bulkUpdateStatus('resolved')}    className="px-3 py-1 text-xs border border-green-300 bg-green-50 text-green-700 rounded hover:bg-green-100">→ 完了</button>
            <button onClick={() => bulkUpdateStatus('wontfix')}     className="px-3 py-1 text-xs border border-gray-300 bg-gray-50 text-gray-600 rounded hover:bg-gray-100">→ 却下</button>
          </div>
        </div>
      )}

      {/* テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            フィードバック一覧 — {total}件中 {Math.min((page - 1) * limit + 1, total)}〜{Math.min(page * limit, total)}件表示
          </span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="h-7 border border-gray-300 rounded text-xs px-1.5 bg-white">
            <option value="createdAt">新しい順</option>
            <option value="severity">影響度（高い順）</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" /> 読み込み中...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>フィードバックが見つかりません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="w-9 px-3 py-2.5 text-left">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-primary-600"
                      checked={selected.size === items.length && items.length > 0}
                      onChange={e => setSelected(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left">種別</th>
                  <th className="px-3 py-2.5 text-left">影響度</th>
                  <th className="px-3 py-2.5 text-left">発生画面</th>
                  <th className="px-3 py-2.5 text-left">問題内容</th>
                  <th className="px-3 py-2.5 text-left">報告者</th>
                  <th className="px-3 py-2.5 text-left">日時</th>
                  <th className="px-3 py-2.5 text-left">ステータス</th>
                  <th className="px-3 py-2.5 text-left">Backlog</th>
                  <th className="px-3 py-2.5 text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => {
                  const rt = REPORT_TYPE_CONFIG[item.reportType] || { label: item.reportType, color: 'bg-gray-100 text-gray-600' };
                  const sv = SEVERITY_CONFIG[item.severity] || { label: String(item.severity), color: 'bg-gray-100 text-gray-600' };
                  const st = STATUS_CONFIG[item.status] || { label: item.status, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/feedback/${item.id}`)}>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 accent-primary-600"
                          checked={selected.has(item.id)}
                          onChange={e => {
                            const next = new Set(selected);
                            e.target.checked ? next.add(item.id) : next.delete(item.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${rt.color}`}>{rt.label}</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${item.app === 'mobile' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {item.app === 'mobile' ? '📱 Mobile' : '💻 CMS'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${sv.color}`}>{sv.label}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs text-gray-500">{item.screen.split(':')[0]}</span>
                        <div className="text-xs text-gray-400 max-w-28 truncate">{item.screen.split(':')[1]?.trim()}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="max-w-56 truncate text-gray-800 text-xs">{item.what}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{item.name || '匿名'}</td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs text-gray-600">{new Date(item.createdAt).toLocaleDateString('ja-JP')}</div>
                        <div className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {item.backlogIssueKey
                          ? <a href={`https://jadeworks.backlog.com/view/${item.backlogIssueKey}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs" onClick={e => e.stopPropagation()}>{item.backlogIssueKey}</a>
                          : <span className="text-gray-300 text-xs">未連携</span>}
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/feedback/${item.id}`)}
                          className="px-2.5 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700"
                        >
                          詳細
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">全{total}件 / {page}/{totalPages}ページ</span>
            <div className="flex gap-1">
              {([
                { icon: <ChevronsLeft className="h-3.5 w-3.5" />,  action: () => setPage(1),              disabled: page === 1 },
                { icon: <ChevronLeft  className="h-3.5 w-3.5" />,  action: () => setPage(p => p - 1),    disabled: page === 1 },
                { icon: <ChevronRight className="h-3.5 w-3.5" />,  action: () => setPage(p => p + 1),    disabled: page === totalPages },
                { icon: <ChevronsRight className="h-3.5 w-3.5" />, action: () => setPage(totalPages),    disabled: page === totalPages },
              ] as const).map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.action}
                  disabled={btn.disabled}
                  className="w-7 h-7 border border-gray-300 rounded flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {btn.icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackList;
