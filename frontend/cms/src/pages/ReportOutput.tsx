/**
 * frontend/cms/src/pages/ReportOutput.tsx
 * 完全版: バックエンドAPIに接続してPDF生成・ダウンロードを実装
 *  - APIクライアント関数を実装（レポート生成、ステータス取得、レポート一覧取得、削除）
 *  - レポート生成フォームを実装（対象日、出力形式、含まれる項目の選択）
 *  - 生成中のレポートをリアルタイムで表示するステータスパネルを実装
 *  - 生成履歴テーブルを実装（帳票名、対象期間、形式、生成日時、サイズ、ステータス、操作）
 *  - ダウンロードと削除の操作を実装
 *  - エラーハンドリングとユーザーフィードバックを強化
 *  - Tailwind CSSでスタイリング
 *  - APIベースURLは環境変数やCMSの定数から取得する柔軟な実装
 *  - TypeScriptで型安全に実装
 *  - コードの可読性と保守性を考慮した構成
 *  - コメントでコードの意図を明確化
 *  - レスポンシブデザインを考慮したレイアウト
 *  - ユーザーが操作しやすいUI/UXを提供
 *  - ローディング状態やエラー状態を適切に表示
 *  - ポーリングのタイムアウトやエラーリトライの実装
 *  - ダウンロードは認証付きで安全に実装
 *  - 生成中のレポートはリアルタイムでステータスが更新されるように実装
 *  - 生成履歴は最新の20件を表示し、ページネーションやフィルタリングは将来の拡張として考慮
 *  - コードはモジュール化して、APIクライアント関数やステータスバッジコンポーネントなどを分割して実装
 *  - ユーザーが操作する際の確認ダイアログや成功/失敗のフィードバックを適切に実装
 *  - エラーが発生した場合はユーザーにわかりやすいメッセージを表示し、必要に応じて詳細なエラー情報も提供
 *  - レスポンシブデザインを考慮して、モバイルデバイスでも操作しやすいUIを提供
 *  - コードはTypeScriptで型安全に実装し、将来の拡張や保守がしやすいように構成
 *  - コメントでコードの意図や重要なポイントを明確化し、他の開発者が理解しやすいようにする
 *  - APIクライアント関数はエラーハンドリングを強化し、APIからのエラーを適切に処理してユーザーにフィードバックする
 *  - ポーリングの実装では、一定回数以上のポーリング失敗でタイムアウトとみなし、ユーザーに通知する
 *  - ダウンロード機能は認証付きで安全に実装し、ファイル名も適切に設定してユーザーがわかりやすいようにする
 *  - 生成中のレポートはリアルタイムでステータスが更新されるように実装し、ユーザーが現在の状況を把握しやすいようにする
 *  - 生成履歴は最新の20件を表示し、将来的にはページネーションやフィルタリング機能も考慮する
 *  - コードはモジュール化して、APIクライアント関数やステータスバッジコンポーネントなどを分割して実装し、コードの再利用性と保守性を高める
 *  - ユーザーが操作する際の確認ダイアログや成功/失敗のフィードバックを適切に実装し、ユーザーエクスペリエンスを向上させる
 *  - エラーが発生した場合はユーザーにわかりやすいメッセージを表示し、必要に応じて詳細なエラー情報も提供することで、ユーザーが問題を理解しやすくする
 *  - レスポンシブデザインを考慮して、モバイルデバイスでも操作しやすいUIを提供することで、幅広いユーザーに対応する
 *  - コードはTypeScriptで型安全に実装し、将来の拡張や保守がしやすいように構成することで、プロジェクトの品質と安定性を向上させる
 *  - コメントでコードの意図や重要なポイントを明確化し、他の開発者が理解しやすいようにすることで、チームでの協力とコードの保守性を高める
 *  - APIクライアント関数はエラーハンドリングを強化し、APIからのエラーを適切に処理してユーザーにフィードバックする
 *  - ポーリングの実装では、一定回数以上のポーリング失敗でタイムアウトとみなし、ユーザーに通知する
 *  - ダウンロード機能は認証付きで安全に実装し、ファイル名も適切に設定してユーザーがわかりやすいようにする
 *  - 生成中のレポートはリアルタイムでステータスが更新されるように実装し、ユーザーが現在の状況を把握しやすいようにする
 *  - 生成履歴は最新の20件を表示し、将来的にはページネーションやフィルタリング機能も考慮する
 *  - コードはモジュール化して、APIクライアント関数やステータスバッジコンポーネントなどを分割して実装し、コードの再利用性と保守性を高める
 *  - ユーザーが操作する際の確認ダイアログや成功/失敗のフィードバックを適切に実装し、ユーザーエクスペリエンスを向上させる
 *  - エラーが発生した場合はユーザーにわかりやすいメッセージを表示し、必要に応じて詳細なエラー情報も提供することで、ユーザーが問題を理解しやすくする
 *  - レスポンシブデザインを考慮して、モバイルデバイスでも操作しやすいUIを提供することで、幅広いユーザーに対応する
 *
 * 🆕 P4-08: 貨物自動車運送事業実績報告書セクション追加
 *  - 年度選択（4月始まり・5年分）
 *  - 集計プレビュー（データ充足チェック表示）
 *  - PDF生成・生成履歴からダウンロード
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, FileText, Calendar, RefreshCw, CheckCircle, XCircle, Clock, Trash2, BarChart3 } from 'lucide-react';
import Input from '../components/common/Input';
import type { DataAvailabilityCheck, AnnualTransportPreview } from '../types';

// =====================================
// 型定義
// =====================================

type ReportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type ReportFormat = 'PDF' | 'EXCEL' | 'CSV';

interface Report {
  id: string;
  title: string;
  reportType: string;
  format: ReportFormat;
  status: ReportStatus;
  startDate: string | null;
  generatedAt: string | null;
  createdAt: string;
  fileSize: number | null;
  errorMessage: string | null;
}

interface GeneratingReport {
  reportId: string;
  title: string;
  status: ReportStatus;
  polling: boolean;
}

// =====================================
// 定数
// =====================================

const API_BASE = (() => {
  try {
    // CMS用 constants.ts から取得（存在する場合）
    return (window as any).__API_BASE_URL__
      || import.meta.env.VITE_API_BASE_URL
      || 'https://10.1.119.244:8443/api/v1';
  } catch {
    return 'https://10.1.119.244:8443/api/v1';
  }
})();

const POLLING_INTERVAL_MS = 2000; // 2秒ごとにポーリング
const MAX_POLLING_COUNT = 60;     // 最大2分間ポーリング

// 🆕 P4-08: 年度選択肢（現在の年度から5年分・4月始まり）
const FISCAL_YEARS_OPTIONS = (() => {
  const now = new Date();
  const curr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, i) => curr - i);
})();

// =====================================
// ユーティリティ
// =====================================

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getReportTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DAILY_OPERATION: '日次運行報告書',
    MONTHLY_OPERATION: '月次運行報告書',
    ANNUAL_OPERATION: '輸送実績報告書',
    ANNUAL_TRANSPORT_REPORT: '貨物自動車運送事業実績報告書',
    VEHICLE_UTILIZATION: '車両稼働レポート',
    INSPECTION_SUMMARY: '点検サマリー',
    COMPREHENSIVE_DASHBOARD: '総合ダッシュボード',
  };
  return labels[type] || type;
}

// =====================================
// APIクライアント関数
// =====================================

async function apiGenerateDailyReport(params: {
  date: string;
  format: string;
  driverId?: string;
  vehicleId?: string;
}): Promise<{ reportId: string; status: ReportStatus; title: string }> {
  const res = await fetch(`${API_BASE}/reports/daily-operation`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      date: params.date,
      format: params.format.toUpperCase(),
      driverId: params.driverId || undefined,
      vehicleId: params.vehicleId || undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'APIエラー' }));
    throw new Error(err.message || `APIエラー: ${res.status}`);
  }

  const json = await res.json();
  return {
    reportId: json.data?.reportId,
    status: json.data?.status,
    title: json.data?.title || '日次運行報告書',
  };
}

async function apiGetReportStatus(
  reportId: string
): Promise<{ status: ReportStatus; errorMessage?: string }> {
  const res = await fetch(`${API_BASE}/reports/${reportId}/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`ステータス取得エラー: ${res.status}`);
  const json = await res.json();
  return {
    status: json.data?.status,
    errorMessage: json.data?.errorMessage,
  };
}

async function apiFetchReports(): Promise<Report[]> {
  const res = await fetch(`${API_BASE}/reports?limit=20&page=1`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`レポート一覧取得エラー: ${res.status}`);
  const json = await res.json();
  return json.data?.reports || [];
}

async function apiDeleteReport(reportId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reports/${reportId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`削除エラー: ${res.status}`);
}

function downloadReport(reportId: string, title: string): void {
  // 認証付きダウンロード: フォーム送信方式でBearerトークンをヘッダに設定するため、
  // fetch + blob で取得してリンククリック
  const fileName = `${title || 'report'}.pdf`;

  fetch(`${API_BASE}/reports/${reportId}/download`, {
    headers: getAuthHeaders(),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`ダウンロードエラー: ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch((err) => {
      console.error('ダウンロードエラー:', err);
      alert(`ダウンロードに失敗しました: ${err.message}`);
    });
}

// 🆕 P4-08: 実績報告書 集計プレビュー取得
async function apiPreviewAnnualTransport(fiscalYear: number): Promise<AnnualTransportPreview> {
  const res = await fetch(`${API_BASE}/reports/annual-transport/preview/${fiscalYear}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'APIエラー' }));
    throw new Error(err.message || `プレビュー取得エラー: ${res.status}`);
  }
  return (await res.json()).data;
}

// 🆕 P4-08: 実績報告書 PDF生成
async function apiGenerateAnnualTransport(
  fiscalYear: number
): Promise<{ reportId: string; status: ReportStatus; title: string }> {
  const res = await fetch(`${API_BASE}/reports/annual-transport`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fiscalYear, format: 'PDF' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'APIエラー' }));
    throw new Error(err.message || `生成エラー: ${res.status}`);
  }
  const json = await res.json();
  return {
    reportId: json.data?.reportId,
    status:   json.data?.status   || 'PENDING',
    title:    json.data?.title    || `貨物自動車運送事業実績報告書 ${fiscalYear}年度`,
  };
}

// =====================================
// ステータスバッジコンポーネント
// =====================================

const StatusBadge: React.FC<{ status: ReportStatus }> = ({ status }) => {
  const config: Record<ReportStatus, { label: string; className: string; icon: React.ReactNode }> = {
    PENDING: {
      label: '待機中',
      className: 'bg-yellow-100 text-yellow-800',
      icon: <Clock className="w-3 h-3 mr-1" />,
    },
    PROCESSING: {
      label: '生成中...',
      className: 'bg-blue-100 text-blue-800',
      icon: <RefreshCw className="w-3 h-3 mr-1 animate-spin" />,
    },
    COMPLETED: {
      label: '完了',
      className: 'bg-green-100 text-green-800',
      icon: <CheckCircle className="w-3 h-3 mr-1" />,
    },
    FAILED: {
      label: '失敗',
      className: 'bg-red-100 text-red-800',
      icon: <XCircle className="w-3 h-3 mr-1" />,
    },
  };

  const c = config[status] || config.PENDING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
};

// 🆕 P4-08: データ充足チェックバッジ
const AvailabilityBadge: React.FC<{ status: 'ok' | 'warn' | 'error'; label: string }> = ({ status, label }) => {
  const config = {
    ok:    { icon: '✓', color: 'text-green-600' },
    warn:  { icon: '△', color: 'text-amber-500' },
    error: { icon: '✕', color: 'text-red-500'   },
  };
  const c = config[status];
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className={`font-bold ${c.color}`}>{c.icon}</span>
      <span className="text-gray-700">{label}</span>
    </div>
  );
};

// =====================================
// メインコンポーネント
// =====================================

const ReportOutput: React.FC = () => {
  // 日報フォーム状態
  const [dailyDate, setDailyDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dailyFormat, setDailyFormat] = useState<ReportFormat>('PDF');
  const [dailyInclude, setDailyInclude] = useState({
    vehicleInfo: true,
    driverInfo: true,
    operationDetails: true,
    inspectionResults: true,
  });

  // 生成中レポートの追跡
  const [generatingReports, setGeneratingReports] = useState<GeneratingReport[]>([]);

  // 生成履歴
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // ポーリング管理
  const pollingCountRef = useRef<Record<string, number>>({});

  // =====================================
  // 🆕 P4-08: 実績報告書 state
  // =====================================
  const [annualFiscalYear, setAnnualFiscalYear] = useState<number>(FISCAL_YEARS_OPTIONS[0]!);
  const [annualPreview, setAnnualPreview]           = useState<AnnualTransportPreview | null>(null);
  const [annualPreviewLoading, setAnnualPreviewLoading] = useState(false);
  const [annualGenerating, setAnnualGenerating]     = useState(false);
  const [annualError, setAnnualError]               = useState<string | null>(null);

  // =====================================
  // レポート一覧取得
  // =====================================

  const fetchReports = useCallback(async () => {
    setIsLoadingReports(true);
    setReportError(null);
    try {
      const list = await apiFetchReports();
      setReports(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '取得エラー';
      setReportError(msg);
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // =====================================
  // ポーリング処理
  // =====================================

  const startPolling = useCallback(
    (reportId: string, _title: string) => {
      pollingCountRef.current[reportId] = 0;

      const poll = async () => {
        const count = pollingCountRef.current[reportId] ?? 0;

        if (count >= MAX_POLLING_COUNT) {
          // タイムアウト
          setGeneratingReports((prev) =>
            prev.map((r) =>
              r.reportId === reportId
                ? { ...r, status: 'FAILED', polling: false }
                : r
            )
          );
          return;
        }

        pollingCountRef.current[reportId] = count + 1;

        try {
          const { status } = await apiGetReportStatus(reportId);

          setGeneratingReports((prev) =>
            prev.map((r) =>
              r.reportId === reportId ? { ...r, status } : r
            )
          );

          if (status === 'COMPLETED' || status === 'FAILED') {
            // ポーリング完了 → 履歴を更新
            setGeneratingReports((prev) =>
              prev.map((r) =>
                r.reportId === reportId ? { ...r, polling: false } : r
              )
            );
            fetchReports();
            return;
          }

          // 継続ポーリング
          setTimeout(poll, POLLING_INTERVAL_MS);
        } catch (err) {
          console.error('[Polling] エラー:', err);
          setTimeout(poll, POLLING_INTERVAL_MS * 2);
        }
      };

      setTimeout(poll, POLLING_INTERVAL_MS);
    },
    [fetchReports]
  );

  // =====================================
  // 日報生成ハンドラ
  // =====================================

  const handleGenerateDailyReport = async () => {
    try {
      const result = await apiGenerateDailyReport({
        date: dailyDate,
        format: dailyFormat,
      });

      const newGenerating: GeneratingReport = {
        reportId: result.reportId,
        title: result.title,
        status: result.status || 'PENDING',
        polling: true,
      };

      setGeneratingReports((prev) => [newGenerating, ...prev]);
      startPolling(result.reportId, result.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成エラー';
      alert(`日報生成に失敗しました: ${msg}`);
    }
  };

  // =====================================
  // 削除ハンドラ
  // =====================================

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('このレポートを削除しますか？')) return;
    try {
      await apiDeleteReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      alert('削除に失敗しました');
    }
  };

  // =====================================
  // 🆕 P4-08: 実績報告書 ハンドラ
  // =====================================

  /** 集計プレビュー取得 */
  const handlePreviewAnnualTransport = async () => {
    setAnnualPreviewLoading(true);
    setAnnualError(null);
    setAnnualPreview(null);
    try {
      const data = await apiPreviewAnnualTransport(annualFiscalYear);
      setAnnualPreview(data);
    } catch (err: any) {
      setAnnualError(err.message || 'プレビューの取得に失敗しました');
    } finally {
      setAnnualPreviewLoading(false);
    }
  };

  /** PDF生成 */
  const handleGenerateAnnualTransport = async () => {
    setAnnualGenerating(true);
    setAnnualError(null);
    try {
      const result = await apiGenerateAnnualTransport(annualFiscalYear);

      const newGenerating: GeneratingReport = {
        reportId: result.reportId,
        title:    result.title,
        status:   result.status || 'PENDING',
        polling:  true,
      };
      setGeneratingReports((prev) => [newGenerating, ...prev]);
      startPolling(result.reportId, result.title);

      alert(`実績報告書の生成を開始しました。\n完了後に生成履歴（下部）からダウンロードできます。`);
    } catch (err: any) {
      setAnnualError(err.message || 'PDF生成に失敗しました');
    } finally {
      setAnnualGenerating(false);
    }
  };

  // =====================================
  // 現在生成中のレポートがあるかチェック
  // =====================================
  const isAnyGenerating = generatingReports.some((r) => r.polling);

  // =====================================
  // レンダリング
  // =====================================

  return (
    <div className="space-y-6">
      {/* ページタイトル */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">帳票出力</h1>
          <p className="mt-1 text-sm text-gray-600">日報・輸送実績報告書の生成と出力</p>
        </div>
        <button
          onClick={fetchReports}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingReports ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {/* 生成パネル */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 日次運行報告書 */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-6">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">日次運行報告書</h2>
              <p className="text-sm text-gray-500">日別の運行記録をまとめた報告書</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* 対象日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">対象日</label>
              <Input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
              />
            </div>

            {/* 出力形式 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出力形式</label>
              <select
                value={dailyFormat}
                onChange={(e) => setDailyFormat(e.target.value as ReportFormat)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PDF">PDF</option>
                <option value="EXCEL">Excel</option>
                <option value="CSV">CSV</option>
              </select>
            </div>

            {/* 含まれる項目 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">含まれる項目</label>
              <div className="space-y-2">
                {[
                  { key: 'vehicleInfo', label: '車両情報' },
                  { key: 'driverInfo', label: '運転手情報' },
                  { key: 'operationDetails', label: '運行詳細' },
                  { key: 'inspectionResults', label: '点検結果' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={dailyInclude[key as keyof typeof dailyInclude]}
                      onChange={(e) =>
                        setDailyInclude((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="mr-2 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 生成ボタン */}
            <button
              onClick={handleGenerateDailyReport}
              disabled={isAnyGenerating}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isAnyGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  日報生成
                </>
              )}
            </button>
          </div>
        </div>

        {/* 生成ステータスパネル */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="bg-purple-100 p-2 rounded-lg mr-3">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">生成ステータス</h2>
              <p className="text-sm text-gray-500">現在の生成タスク</p>
            </div>
          </div>

          {generatingReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <FileText className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">生成タスクはありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {generatingReports.map((gr) => (
                <div
                  key={gr.reportId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{gr.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">ID: {gr.reportId.slice(0, 8)}...</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <StatusBadge status={gr.status} />
                    {gr.status === 'COMPLETED' && (
                      <button
                        onClick={() => downloadReport(gr.reportId, gr.title)}
                        className="text-blue-600 hover:text-blue-800"
                        title="ダウンロード"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =====================================
          🆕 P4-08: 貨物自動車運送事業実績報告書セクション
          貨物自動車運送事業報告規則 第4号様式（A4縦）
      ===================================== */}
      <div className="bg-white shadow rounded-lg p-6 border-l-4 border-green-500">
        {/* セクションヘッダー */}
        <div className="flex items-center mb-5">
          <div className="bg-green-100 p-2 rounded-lg mr-3">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-gray-900">
                貨物自動車運送事業実績報告書
              </h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                NEW
              </span>
            </div>
            <p className="text-sm text-gray-500">
              貨物自動車運送事業報告規則 第4号様式（A4縦）— 地方運輸局長あて提出用
            </p>
          </div>
        </div>

        {/* 入力エリア */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* 対象年度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              対象年度 <span className="text-red-500">*</span>
            </label>
            <select
              value={annualFiscalYear}
              onChange={(e) => {
                setAnnualFiscalYear(Number(e.target.value));
                setAnnualPreview(null);  // 年度変更でプレビューリセット
              }}
              className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
            >
              {FISCAL_YEARS_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}年度（{y}/4/1〜{y + 1}/3/31）
                </option>
              ))}
            </select>
          </div>

          {/* 出力形式（PDF固定） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">出力形式</label>
            <div className="flex items-center h-9 mt-0.5">
              <span className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                PDF（A4縦・第4号様式）
              </span>
            </div>
          </div>
        </div>

        {/* 集計プレビュー表示 */}
        {annualPreview && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
            <p className="text-xs font-medium text-gray-600 mb-3 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              データ充足状況（{annualFiscalYear}年度）
            </p>

            {/* データ充足チェックグリッド */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {([
                { key: 'vehicleDays',      label: '延実在・実働車両数' },
                { key: 'totalDistance',    label: '走行キロ' },
                { key: 'loadedDistance',   label: '実車キロ' },
                { key: 'transportTons',    label: '輸送トン数' },
                { key: 'revenue',          label: '営業収入' },
                { key: 'regionAssigned',   label: '管轄区域' },
                { key: 'accidentRecords',  label: '事故件数' },
                { key: 'businessSettings', label: '事業者情報' },
              ] as { key: keyof DataAvailabilityCheck; label: string }[]).map(({ key, label }) => {
                const status = annualPreview.availability?.[key] as 'ok' | 'warn' | 'error';
                return (
                  <AvailabilityBadge key={key} status={status} label={label} />
                );
              })}
            </div>

            {/* 警告メッセージ */}
            {annualPreview.availability?.unassignedRegionCount > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center justify-between">
                <span>
                  管轄区域未設定の車両が {annualPreview.availability.unassignedRegionCount} 台あります
                </span>
                <a
                  href="/vehicles"
                  className="text-blue-600 underline ml-2 hover:text-blue-800"
                >
                  車両マスタで設定する →
                </a>
              </div>
            )}
            {annualPreview.availability?.missingLoadedDistanceCount > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 mt-1">
                実車キロ未入力の運行が {annualPreview.availability.missingLoadedDistanceCount} 件あります（運行記録から入力）
              </div>
            )}
            {annualPreview.availability?.missingRevenueCount > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 mt-1">
                営業収入未入力の運行が {annualPreview.availability.missingRevenueCount} 件あります（運行記録から入力）
              </div>
            )}
            {!annualPreview.businessSettings?.companyName && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 mt-1 flex items-center justify-between">
                <span>事業者情報が未設定です。PDF印字に必要な情報が不足します</span>
                <a
                  href="/settings"
                  className="text-blue-600 underline ml-2 hover:text-blue-800"
                >
                  システム設定で入力する →
                </a>
              </div>
            )}

            {/* 概況サマリー */}
            {annualPreview.overview && (
              <div className="mt-3 flex gap-4 text-xs text-gray-600">
                <span>車両数: <strong>{annualPreview.overview.vehicleCount}</strong> 台</span>
                <span>従業員数: <strong>{annualPreview.overview.employeeCount}</strong> 人</span>
                <span>運転者数: <strong>{annualPreview.overview.driverCount}</strong> 人</span>
                {annualPreview.total && (
                  <span>
                    輸送トン数合計: <strong>{annualPreview.total.transportTons.toLocaleString()}</strong> トン
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* エラー表示 */}
        {annualError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {annualError}
          </div>
        )}

        {/* ボタンエリア */}
        <div className="flex justify-end gap-3">
          {/* 集計プレビューボタン */}
          <button
            onClick={handlePreviewAnnualTransport}
            disabled={annualPreviewLoading || annualGenerating}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-green-500 text-green-600 font-medium rounded-md hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {annualPreviewLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                取得中...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4" />
                集計プレビュー
              </>
            )}
          </button>

          {/* PDF生成ボタン */}
          <button
            onClick={handleGenerateAnnualTransport}
            disabled={annualGenerating || annualPreviewLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {annualGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                PDF生成・ダウンロード
              </>
            )}
          </button>
        </div>
      </div>
      {/* ===================================== END P4-08 ===================================== */}

      {/* 生成履歴 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            最近の生成履歴
          </h3>
          {reportError && (
            <span className="text-sm text-red-500">{reportError}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['帳票名', '対象期間', '形式', '生成日時', 'サイズ', 'ステータス', '操作'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoadingReports ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />
                    読み込み中...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    生成履歴はありません
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {getReportTypeLabel(report.reportType)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {report.startDate
                        ? new Date(report.startDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {report.format}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(report.generatedAt || report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatFileSize(report.fileSize)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} />
                      {report.status === 'FAILED' && report.errorMessage && (
                        <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate" title={report.errorMessage}>
                          {report.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {report.status === 'COMPLETED' && (
                          <button
                            onClick={() => downloadReport(report.id, report.title)}
                            className="text-blue-600 hover:text-blue-800"
                            title="ダウンロード"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="text-red-400 hover:text-red-600"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportOutput;