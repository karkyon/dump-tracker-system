// frontend/cms/src/pages/FeedbackDetail.tsx
// フィードバック管理 詳細画面 (FB-02)
// ADMIN / MANAGER 専用

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTLog } from '../hooks/useTLog';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, MessageSquare, ExternalLink, Save, Link, Link2Off, AlertCircle,
  Eye, Edit2, Columns, Bold, Italic, List, Code, Heading1, Heading2, ChevronDown,
} from 'lucide-react';
import { API_BASE_URL } from '../utils/constants';

// =============================================
// 型定義
// =============================================

type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'wontfix';

interface StatusHistory {
  from: string;
  to: string;
  changedAt: string;
  changedBy: string;
}

interface FeedbackDetail {
  id: string;
  app: 'mobile' | 'cms';
  name?: string;
  reportType: string;
  screen: string;
  operation?: string;
  frequency?: string;
  what: string;
  expected?: string;
  steps?: string;
  severity: number;
  device?: string;
  extra?: string;
  photoPaths?: string[];
  photoUrls?: string[];
  createdAt: string;
  status: FeedbackStatus;
  adminNotes?: string;
  adminNotesUpdatedAt?: string;
  adminNotesUpdatedBy?: string;
  backlogIssueId?: string;
  backlogIssueKey?: string;
  backlogLinkedAt?: string;
  backlogLinkedBy?: string;
  statusHistory?: StatusHistory[];
}

// =============================================
// 定数
// =============================================

const REPORT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  bug:     { label: '🐛 バグ・不具合',  color: 'bg-red-100 text-red-700' },
  odd:     { label: '⚠️ 動作がおかしい', color: 'bg-orange-100 text-orange-700' },
  improve: { label: '💡 改善要望',       color: 'bg-purple-100 text-purple-700' },
  feature: { label: '✨ 新機能提案',     color: 'bg-blue-100 text-blue-700' },
  data:    { label: '📊 データの誤り',   color: 'bg-yellow-100 text-yellow-700' },
  good:    { label: '👍 良かった点',     color: 'bg-green-100 text-green-700' },
};

const SEVERITY_CONFIG: Record<number, { label: string; color: string }> = {
  0: { label: '🔴 業務停止 — 今すぐ対応してほしい',            color: 'bg-red-100 text-red-700 border border-red-300' },
  1: { label: '🟠 業務に支障 — なんとかなっているが困っている', color: 'bg-orange-100 text-orange-700 border border-orange-300' },
  2: { label: '🟡 不便 — 業務は続けられる',                    color: 'bg-yellow-100 text-yellow-700 border border-yellow-300' },
  3: { label: '🟢 軽微・提案 — 感想・要望レベル',              color: 'bg-green-100 text-green-700 border border-green-300' },
};

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  new:         { label: '🔴 新規',   color: 'bg-red-50 text-red-700 border border-red-200' },
  in_progress: { label: '🟠 対応中', color: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  resolved:    { label: '✅ 完了',   color: 'bg-green-50 text-green-700 border border-green-200' },
  wontfix:     { label: '⚫ 却下',   color: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

const PRIORITY_MAP: Record<number, string> = { 0: '緊急 🔴', 1: '高 🟠', 2: '中 🟡', 3: '低 🟢' };

// =============================================
// ヘルパー
// =============================================

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ja-JP');
}

// =============================================
// コンポーネント
// =============================================

// =============================================
// Markdown → HTML 変換
// =============================================
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inlineMd(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.85em">$1</code>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#2563eb;text-decoration:underline">$1</a>');
  return t;
}
function mdToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inCode = false; let inUl = false; let inOl = false;
  const closeList = () => { if (inUl) { out.push('</ul>'); inUl = false; } if (inOl) { out.push('</ol>'); inOl = false; } };
  for (const line of lines) {
    if (line.startsWith('```')) { if (inCode) { out.push('</code></pre>'); inCode = false; } else { closeList(); out.push('<pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;overflow-x:auto;font-size:0.85em"><code>'); inCode = true; } continue; }
    if (inCode) { out.push(escapeHtml(line)); continue; }
    if (line.startsWith('### ')) { closeList(); out.push(`<h3 style="font-size:1em;font-weight:600;margin:12px 0 4px;color:#374151">${inlineMd(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## ')) { closeList(); out.push(`<h2 style="font-size:1.1em;font-weight:700;margin:16px 0 6px;color:#1f2937;border-bottom:1px solid #e5e7eb;padding-bottom:4px">${inlineMd(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# ')) { closeList(); out.push(`<h1 style="font-size:1.25em;font-weight:700;margin:16px 0 8px;color:#111827">${inlineMd(line.slice(2))}</h1>`); continue; }
    if (line.startsWith('> ')) { closeList(); out.push(`<blockquote style="border-left:3px solid #6366f1;background:#f5f3ff;padding:6px 12px;margin:8px 0;border-radius:0 4px 4px 0;color:#4b5563">${inlineMd(line.slice(2))}</blockquote>`); continue; }
    if (line.match(/^[-*] /)) { if (!inUl) { if (inOl) { out.push('</ol>'); inOl = false; } out.push('<ul style="list-style:disc;padding-left:20px;margin:6px 0">'); inUl = true; } out.push(`<li style="margin:2px 0">${inlineMd(line.slice(2))}</li>`); continue; }
    if (line.match(/^\d+\. /)) { if (!inOl) { if (inUl) { out.push('</ul>'); inUl = false; } out.push('<ol style="list-style:decimal;padding-left:20px;margin:6px 0">'); inOl = true; } out.push(`<li style="margin:2px 0">${inlineMd(line.replace(/^\d+\. /, ''))}</li>`); continue; }
    closeList();
    if (line.trim() === '' || line.trim() === '---') { out.push(line.trim() === '---' ? '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">' : '<br>'); continue; }
    out.push(`<p style="margin:4px 0;line-height:1.6">${inlineMd(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

// =============================================
// テンプレート定義
// =============================================
const NOTES_TEMPLATES = [
  {
    label: '🐛 不具合対応',
    value: `## 原因
<!-- 何が根本原因だったか -->

## 影響範囲
<!-- どの機能・ユーザーに影響があるか -->

## 対策内容
\`\`\`
// 修正箇所・変更内容
\`\`\`

## 確認方法
- [ ] 再現手順で不具合が解消されていることを確認
- [ ] 既存機能への影響がないことを確認

## 関連コミット / PR
<!-- commit hash または PR URL -->
`,
  },
  {
    label: '💡 改善実装',
    value: `## 実装内容
<!-- 何を変更・追加したか -->

## 変更ファイル
\`\`\`
- path/to/file.ts
\`\`\`

## 動作確認
- [ ] 要望通りに動作することを確認
- [ ] 既存機能への影響がないことを確認
`,
  },
  {
    label: '⏭️ 先送り・却下理由',
    value: `## 判断理由
<!-- なぜ対応しない or 先送りにするか -->

## 代替案
<!-- 代わりにユーザーができること -->

## 再検討条件
<!-- どうなったら対応を検討するか -->
`,
  },
];

const FeedbackDetail: React.FC = () => {
  useTLog('FEEDBACK_DETAIL', 'フィードバック管理詳細');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [fb, setFb] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesViewMode, setNotesViewMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);

  const [showBacklogPanel, setShowBacklogPanel] = useState(false);
  const [backlogTitle, setBacklogTitle] = useState('');
  const [backlogBody, setBacklogBody] = useState('');
  const [linkingBacklog, setLinkingBacklog] = useState(false);
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [manualKey, setManualKey] = useState('');
  const [linkingManual, setLinkingManual] = useState(false);

  const notesTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setFb(json.data);
      setNotes(json.data.adminNotes || '');
    } catch (e: any) {
      toast.error(`取得エラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  useEffect(() => {
    if (!fb || !showBacklogPanel) return;
    const shortId = fb.id.substring(0, 6);

    // 種別プレフィックス（既存チケット形式）
    const typePrefix: Record<string, string> = {
      bug: 'BUG', odd: 'BUG', data: 'BUG',
      improve: 'REQ', feature: 'REQ', good: 'OTHER',
    };
    const prefix = typePrefix[fb.reportType] || 'OTHER';
    const category = fb.app === 'mobile' ? 'Mobile' : 'CMS';
    const rt = REPORT_TYPE_CONFIG[fb.reportType]?.label || fb.reportType;
    const sv = SEVERITY_CONFIG[fb.severity]?.label || String(fb.severity);
    const issueId = `[${prefix}-FB-${shortId}]`;

    // タイトル: 既存チケット形式 [BUG-FB-xxxx][Mobile] 画面名 - 問題内容
    setBacklogTitle(`${issueId}[${category}] ${fb.screen} - ${fb.what.substring(0, 50)}`);

    // 本文: REQ-016スタイル準拠
    setBacklogBody([
      `## FB-${shortId} | ${fb.screen} - ${fb.what.substring(0, 60)}`,
      '',
      '---',
      '',
      '### 概要',
      '',
      fb.what,
      '',
      '---',
      '',
      '### 問題の詳細',
      '',
      `**カテゴリ:** ${category}`,
      `**種別:** ${rt}（${prefix}）`,
      `**影響度:** ${sv}`,
      `**発生画面:** ${fb.screen}`,
      `**操作内容:** ${fb.operation || '（未記入）'}`,
      `**発生頻度:** ${fb.frequency || '（未記入）'}`,
      `**使用端末:** ${fb.device || '（未記入）'}`,
      `**報告者:** ${fb.name || '匿名'}`,
      `**報告日時:** ${formatDate(fb.createdAt)}`,
      '',
      '**現象:**',
      fb.what,
      '',
      fb.expected ? `**期待する動作:**\n${fb.expected}` : '',
      '',
      '---',
      '',
      '### 根本原因',
      '',
      '（調査中 — 管理者メモを参照）',
      '',
      fb.extra ? `**補足情報:**\n${fb.extra}` : '',
      '',
      '---',
      '',
      '### 解決策・修正内容',
      '',
      '（未着手）',
      '',
      '---',
      '',
      '### 解決状況',
      '',
      '⬜ **未対応**',
      '',
      '---',
      '',
      '### テストケース',
      '',
      fb.steps ? `**再現手順:**\n${fb.steps}` : '（未記入）',
      '',
      '---',
      '',
      '*Dump Tracker フィードバックシステムより自動起票*',
      `*Firebase Document ID: ${fb.id}*`,
      `*カテゴリ: ${category} | 種別: ${prefix} | 影響度: ${fb.severity}*`,
    ].filter(l => l !== undefined && l !== null).join('\n'));
  }, [fb, showBacklogPanel]);

  const updateStatus = async (status: FeedbackStatus) => {
    if (!id) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/${id}/status`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`ステータスを「${STATUS_CONFIG[status].label}」に変更しました`);
      fetchDetail();
    } catch (e: any) {
      toast.error(`ステータス変更エラー: ${e.message}`);
    } finally {
      setSavingStatus(false);
    }
  };

  const saveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/${id}/notes`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('メモを保存しました');
      fetchDetail();
    } catch (e: any) {
      toast.error(`メモ保存エラー: ${e.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  const submitBacklog = async () => {
    if (!id) return;
    setLinkingBacklog(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/${id}/backlog`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ title: backlogTitle, body: backlogBody }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      toast.success(`Backlog ${json.data.issueKey} を起票しました`);
      setShowBacklogPanel(false);
      fetchDetail();
    } catch (e: any) {
      toast.error(`Backlog起票エラー: ${e.message}`);
    } finally {
      setLinkingBacklog(false);
    }
  };

  const unlinkBacklog = async () => {
    if (!id || !window.confirm('Backlog連携を解除しますか？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/${id}/backlog`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Backlog連携を解除しました');
      fetchDetail();
    } catch (e: any) {
      toast.error(`解除エラー: ${e.message}`);
    }
  };

  // 既存Backlogチケットキーを手入力で連携
  const linkManualKey = async () => {
    const key = manualKey.trim().toUpperCase();
    if (!key || !id) return;
    // 簡易バリデーション: 英数字-数字 形式
    if (!/^[A-Z0-9]+-\d+$/.test(key)) {
      toast.error('キー形式が正しくありません（例: DUMPTRACKER2026-52）');
      return;
    }
    setLinkingManual(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/${id}/backlog/link-existing`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ issueKey: key }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      toast.success(`Backlog ${key} と連携しました`);
      setManualKey('');
      setShowBacklogPanel(false);
      fetchDetail();
    } catch (e: any) {
      toast.error(`連携エラー: ${e.message}`);
    } finally {
      setLinkingManual(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <MessageSquare className="h-6 w-6 animate-pulse mr-2" /> 読み込み中...
      </div>
    );
  }

  if (!fb) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-10 w-10 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">フィードバックが見つかりません</p>
        <button onClick={() => navigate('/feedback')} className="mt-4 text-primary-600 underline text-sm">一覧に戻る</button>
      </div>
    );
  }

  const rt = REPORT_TYPE_CONFIG[fb.reportType] || { label: fb.reportType, color: 'bg-gray-100 text-gray-600' };
  const sv = SEVERITY_CONFIG[fb.severity] || { label: String(fb.severity), color: 'bg-gray-100 text-gray-600' };
  const st = STATUS_CONFIG[fb.status] || { label: fb.status, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="space-y-4">
      {/* パンくず */}
      <div className="text-sm text-gray-500 flex items-center gap-1.5">
        <button onClick={() => navigate('/feedback')} className="text-primary-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> フィードバック管理
        </button>
        <span>›</span>
        <span>詳細</span>
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{fb.id.substring(0, 8)}</span>
      </div>

      {/* ヘッダー */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`inline-flex px-2 py-0.5 rounded text-sm font-semibold ${rt.color}`}>{rt.label}</span>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${fb.app === 'mobile' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                {fb.app === 'mobile' ? '📱 モバイルアプリ' : '💻 CMS管理画面'}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded text-sm font-semibold ${st.color}`}>{st.label}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{fb.what.substring(0, 80)}{fb.what.length > 80 ? '...' : ''}</h2>
            <p className="text-xs text-gray-400 mt-1">
              📅 {formatDate(fb.createdAt)} &nbsp;·&nbsp; 👤 {fb.name || '匿名'} &nbsp;·&nbsp; 📱 {fb.device || '—'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <p className="text-xs text-gray-500 font-semibold">ステータス変更：</p>
            <div className="flex gap-1.5 flex-wrap">
              {fb.status !== 'in_progress' && (
                <button onClick={() => updateStatus('in_progress')} disabled={savingStatus}
                  className="px-3 py-1.5 text-xs border border-yellow-300 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 font-medium">
                  🟠 対応中にする
                </button>
              )}
              {fb.status !== 'resolved' && (
                <button onClick={() => updateStatus('resolved')} disabled={savingStatus}
                  className="px-3 py-1.5 text-xs border border-green-300 bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium">
                  ✅ 完了にする
                </button>
              )}
              {fb.status !== 'wontfix' && (
                <button onClick={() => updateStatus('wontfix')} disabled={savingStatus}
                  className="px-3 py-1.5 text-xs border border-gray-300 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 font-medium">
                  🚫 却下する
                </button>
              )}
              {fb.status !== 'new' && (
                <button onClick={() => updateStatus('new')} disabled={savingStatus}
                  className="px-3 py-1.5 text-xs border border-red-200 bg-red-50 text-red-600 rounded hover:bg-red-100 font-medium">
                  🔴 新規に戻す
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4">
        {/* メインカラム */}
        <div className="space-y-4">

          {/* 基本情報 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">📋 基本情報</div>
            <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
              {[
                { label: '発生画面', value: fb.screen },
                { label: '操作内容', value: fb.operation || '—' },
                { label: '発生頻度', value: fb.frequency || '—' },
                { label: '使用端末', value: fb.device || '—' },
              ].map((field, i) => (
                <div key={i} className="p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{field.label}</div>
                  <div className="text-sm text-gray-800">{field.value}</div>
                </div>
              ))}
              <div className="p-3 col-span-2">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">影響度</div>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${sv.color}`}>{sv.label}</span>
              </div>
            </div>
          </div>

          {/* 詳細内容 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">📝 詳細内容</div>
            {[
              { label: '❶ 問題内容（必須）', value: fb.what },
              { label: '❷ 期待する動作', value: fb.expected },
              { label: '❸ 再現手順', value: fb.steps },
              { label: '補足', value: fb.extra },
            ].filter(f => f.value).map((field, i) => (
              <div key={i} className="p-4 border-b border-gray-50 last:border-0">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">{field.label}</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{field.value}</div>
              </div>
            ))}
          </div>

          {/* スクリーンショット */}
          {fb.photoPaths && fb.photoPaths.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">📷 スクリーンショット（{fb.photoPaths.length}枚）</div>
              <div className="flex gap-3 flex-wrap p-4">
                {(fb.photoUrls && fb.photoUrls.length > 0 ? fb.photoUrls : fb.photoPaths).map((url, i) => (
                  <div
                    key={i}
                    className="w-24 h-24 rounded border-2 border-gray-200 overflow-hidden cursor-pointer hover:border-primary-400 transition-colors flex items-center justify-center bg-gray-50"
                    onClick={() => setPhotoIndex(i)}
                  >
                    {fb.photoUrls && fb.photoUrls[i]
                      ? <img src={url} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                      : <div className="text-center text-gray-400 text-xs"><div className="text-2xl">🖼️</div><div>{i + 1}</div></div>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* サイドカラム */}
        <div className="space-y-4">

          {/* 管理者メモ（Markdownエディタ） */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* ヘッダー */}
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">🗒️ 対応メモ</span>
              <span className="text-xs text-gray-400 flex-1">Markdown形式で記述できます</span>
              {/* テンプレート */}
              <div className="relative">
                <button
                  onClick={() => setShowTemplateMenu(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 bg-white"
                >
                  テンプレート <ChevronDown className="h-3 w-3" />
                </button>
                {showTemplateMenu && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded shadow-lg min-w-[180px]">
                    {NOTES_TEMPLATES.map(t => (
                      <button
                        key={t.label}
                        onClick={() => { setNotes(t.value); setShowTemplateMenu(false); setNotesViewMode('edit'); }}
                        className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* ビューモード切替 */}
              <div className="flex items-center border border-gray-200 rounded overflow-hidden">
                {([['edit', <Edit2 className="h-3 w-3" />, '編集'], ['split', <Columns className="h-3 w-3" />, '分割'], ['preview', <Eye className="h-3 w-3" />, 'プレビュー']] as const).map(([mode, icon, label]) => (
                  <button
                    key={mode}
                    title={label}
                    onClick={() => setNotesViewMode(mode)}
                    className={`px-2 py-1 text-xs flex items-center gap-1 ${notesViewMode === mode ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            {/* ツールバー */}
            {notesViewMode !== 'preview' && (
              <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 bg-gray-50 flex-wrap">
                {[
                  { icon: <Bold className="h-3.5 w-3.5" />, title: '太字', wrap: ['**', '**'] },
                  { icon: <Italic className="h-3.5 w-3.5" />, title: '斜体', wrap: ['*', '*'] },
                  { icon: <Heading1 className="h-3.5 w-3.5" />, title: '見出し1', line: '# ' },
                  { icon: <Heading2 className="h-3.5 w-3.5" />, title: '見出し2', line: '## ' },
                  { icon: <List className="h-3.5 w-3.5" />, title: 'リスト', line: '- ' },
                  { icon: <Code className="h-3.5 w-3.5" />, title: 'コード', wrap: ['`', '`'] },
                ].map((btn, i) => (
                  <button
                    key={i}
                    title={btn.title}
                    onClick={() => {
                      const ta = notesTextareaRef.current;
                      if (!ta) return;
                      const { selectionStart: s, selectionEnd: e, value: v } = ta;
                      if (btn.wrap) {
                        const sel = v.slice(s, e) || 'テキスト';
                        const nv = v.slice(0, s) + btn.wrap[0] + sel + btn.wrap[1] + v.slice(e);
                        setNotes(nv);
                        setTimeout(() => { ta.focus(); ta.setSelectionRange(s + btn.wrap![0].length, s + btn.wrap![0].length + sel.length); }, 0);
                      } else if (btn.line) {
                        const ls = v.lastIndexOf('\n', s - 1) + 1;
                        setNotes(v.slice(0, ls) + btn.line + v.slice(ls));
                        setTimeout(() => ta.focus(), 0);
                      }
                    }}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>
            )}
            {/* エディタ / プレビュー本体 */}
            <div className={`flex ${notesViewMode === 'split' ? 'divide-x divide-gray-200' : ''}`} style={{ minHeight: '200px' }}>
              {(notesViewMode === 'edit' || notesViewMode === 'split') && (
                <textarea
                  ref={notesTextareaRef}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={'## 原因\n\n## 対策内容\n\n## 確認方法\n'}
                  className="flex-1 border-none outline-none p-3 text-sm font-mono resize-none bg-white"
                  style={{ minHeight: '200px' }}
                />
              )}
              {(notesViewMode === 'preview' || notesViewMode === 'split') && (
                <div
                  className="flex-1 p-3 overflow-y-auto text-sm"
                  style={{ minHeight: '200px' }}
                  dangerouslySetInnerHTML={{ __html: notes.trim() ? mdToHtml(notes) : '<p style="color:#9ca3af">プレビューがここに表示されます</p>' }}
                />
              )}
            </div>
            {/* フッター: 最終更新 + 保存ボタン */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
              {fb.adminNotesUpdatedBy ? (
                <span className="text-xs text-gray-400">最終更新: {fb.adminNotesUpdatedBy} / {formatDate(fb.adminNotesUpdatedAt)}</span>
              ) : <span />}
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {savingNotes ? '保存中...' : '保存'}
              </button>
            </div>
          </div>

          {/* Backlog連携 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">🎫 Backlog連携</div>
            <div className="p-3">
              {fb.backlogIssueKey ? (
                <div className="space-y-2">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="text-xl font-extrabold text-blue-700 font-mono">{fb.backlogIssueKey}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      連携日時: {formatDate(fb.backlogLinkedAt)}<br />連携者: {fb.backlogLinkedBy}
                    </div>
                    <a
                      href={`https://jadeworks.backlog.com/view/${fb.backlogIssueKey}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 text-xs underline mt-2"
                    >
                      <ExternalLink className="h-3 w-3" /> Backlogで開く
                    </a>
                  </div>
                  <button onClick={unlinkBacklog} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                    <Link2Off className="h-3.5 w-3.5" /> 連携を解除
                  </button>
                </div>
              ) : showBacklogPanel ? (
                <div className="space-y-3">
                  {/* タブ: 新規起票 / 既存連携 */}
                  <div className="flex border border-gray-200 rounded overflow-hidden text-xs">
                    <button
                      onClick={() => setLinkMode('new')}
                      className={`flex-1 py-1.5 font-semibold ${linkMode === 'new' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >🎫 新規起票</button>
                    <button
                      onClick={() => setLinkMode('existing')}
                      className={`flex-1 py-1.5 font-semibold ${linkMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >🔗 既存チケット連携</button>
                  </div>

                  {linkMode === 'new' ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">件名</label>
                        <input value={backlogTitle} onChange={e => setBacklogTitle(e.target.value)}
                          className="w-full border border-gray-300 rounded p-1.5 text-xs focus:outline-none focus:border-primary-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">優先度</label>
                        <div className="text-sm font-semibold">{PRIORITY_MAP[fb.severity]}</div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">詳細本文（編集可）</label>
                        <textarea value={backlogBody} onChange={e => setBacklogBody(e.target.value)} rows={6}
                          className="w-full border border-gray-300 rounded p-1.5 text-xs font-mono resize-y focus:outline-none focus:border-primary-500" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowBacklogPanel(false)} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">キャンセル</button>
                        <button onClick={submitBacklog} disabled={linkingBacklog}
                          className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-semibold">
                          {linkingBacklog ? '起票中...' : '🎫 起票する'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">既にBacklogにチケットがある場合、キーを入力して連携します。連携後はWebhookでステータスが自動同期されます。</p>
                      <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">Backlogチケットキー</label>
                        <input
                          value={manualKey}
                          onChange={e => setManualKey(e.target.value)}
                          placeholder="例: DUMPTRACKER2026-52"
                          className="w-full border border-gray-300 rounded p-1.5 text-xs font-mono focus:outline-none focus:border-primary-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">プロジェクトキー-番号 の形式で入力してください</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowBacklogPanel(false)} className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">キャンセル</button>
                        <button onClick={linkManualKey} disabled={linkingManual || !manualKey.trim()}
                          className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-semibold">
                          {linkingManual ? '連携中...' : '🔗 連携する'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">🎫</div>
                  <p className="text-xs text-gray-500 mb-3">Backlogチケットに<br />まだ起票されていません</p>
                  <button
                    onClick={() => { setShowBacklogPanel(true); setLinkMode('new'); }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700"
                  >
                    <Link className="h-4 w-4" /> Backlogに起票 / 連携する
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 対応履歴 */}
          {fb.statusHistory && fb.statusHistory.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">📅 対応履歴</div>
              <div className="p-3 space-y-3">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-gray-700">フィードバック受信（新規）</div>
                    <div className="text-xs text-gray-400">{formatDate(fb.createdAt)} / システム自動</div>
                  </div>
                </div>
                {fb.statusHistory.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-700">ステータスを「{h.to}」に変更</div>
                      <div className="text-xs text-gray-400">{formatDate(h.changedAt)} / {h.changedBy}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => navigate('/feedback')} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" /> 一覧に戻る
          </button>
        </div>
      </div>

      {/* 写真拡大モーダル */}
      {photoIndex !== null && fb.photoUrls && fb.photoUrls[photoIndex] && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setPhotoIndex(null)}>
          <img src={fb.photoUrls[photoIndex]} alt="Screenshot" className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl" />
        </div>
      )}
    </div>
  );
};

export default FeedbackDetail;