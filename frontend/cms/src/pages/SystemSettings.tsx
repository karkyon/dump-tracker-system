import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTLog } from '../hooks/useTLog';
import { AlertTriangle, Building2, Save, Settings, Trash2, Upload, Download } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { API_BASE_URL } from '../utils/constants';
import type { TransportBusinessSettings } from '../types';

// =====================================
// 🆕 P4-04: 事業者情報API
// =====================================

/** 認証ヘッダーを生成 */
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
};

/** システム設定取得 */
const fetchSystemSettings = async (): Promise<Record<string, string>> => {
  const res = await fetch(`${API_BASE_URL}/settings/system`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return {};
  const json = await res.json();
  return json.data ?? {};
};

/** システム設定保存 */
const saveSystemSettings = async (updates: { key: string; value: string }[]): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/settings/system`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'APIエラー' }));
    throw new Error(err.message || `保存エラー: ${res.status}`);
  }
};

/** 事業者情報取得 */
const fetchTransportBusiness = async (): Promise<TransportBusinessSettings> => {
  const res = await fetch(`${API_BASE_URL}/settings/transport-business`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`取得エラー: ${res.status}`);
  const json = await res.json();
  return json.data ?? {};
};

/** 事業者情報保存 */
const saveTransportBusiness = async (data: TransportBusinessSettings): Promise<TransportBusinessSettings> => {
  const res = await fetch(`${API_BASE_URL}/settings/transport-business`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'APIエラー' }));
    throw new Error(err.message || `保存エラー: ${res.status}`);
  }
  return (await res.json()).data;
};

// =====================================
// 事業内容選択肢（様式規則準拠）
// ③ UI側は1項目のみ選択に変更。
//    バックエンドAPIとの互換性維持のため
//    保存時は [value] 配列として送信する。
// =====================================
const BUSINESS_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '',            label: '-- 選択してください --' },
  { value: 'DUMP_EARTH',  label: 'ダンプによる土砂等運搬' },
  { value: 'FROZEN',      label: '冷凍・冷蔵輸送' },
  { value: 'LONG_ITEM',   label: '基準緩和・長大物品輸送' },
  { value: 'TIMBER',      label: '原木・製材輸送' },
  { value: 'CONTAINER',   label: '国際海上コンテナ輸送' },
  { value: 'MOVING',      label: '引越輸送' },
  { value: 'READY_MIX',   label: '生コンクリート輸送' },
  { value: 'HAZARDOUS',   label: '危険物等輸送' },
  { value: 'OTHER',       label: 'その他' },
];

// =====================================
// localStorage キー定数
// =====================================
export const GENERAL_SETTINGS_KEY  = 'dump_tracker_general_settings';
const GPS_TRACK_KEY          = 'dump_tracker_gps_track_settings';
/** ② 会社ロゴ保存キー（Base64 データURL） */
export const COMPANY_LOGO_KEY = 'dump_tracker_company_logo';

// =====================================
// SystemSettings コンポーネント
// =====================================
const SystemSettings: React.FC = () => {
  useTLog('SYSTEM_SETTINGS', 'システム設定');

  const [activeTab, setActiveTab] = useState('general');

  // =====================================
  // 一般設定 state（localStorage 永続化）
  // =====================================
  const [generalSettings, setGeneralSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(GENERAL_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {
        companyName: 'ダンプ運送株式会社',
        systemName:  'ダンプ運行記録システム',
        timezone:    'Asia/Tokyo',
        language:    'ja',
        dateFormat:  'YYYY/MM/DD',
        timeFormat:  '24h',
      };
    } catch {
      return {
        companyName: 'ダンプ運送株式会社',
        systemName:  'ダンプ運行記録システム',
        timezone:    'Asia/Tokyo',
        language:    'ja',
        dateFormat:  'YYYY/MM/DD',
        timeFormat:  '24h',
      };
    }
  });

  // ② 会社ロゴ state（localStorage 永続化 / Base64 データURL）
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem(COMPANY_LOGO_KEY) || null;
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logSettings, setLogSettings] = useState({
    retentionDays:             365,
    logLevel:                  'info',
    enableApiLogging:          true,
    enableUserActionLogging:   true,
  });

  // ✅ GPS走行軌跡記録設定（localStorage永続化）
  const [gpsTrackSettings, setGpsTrackSettings] = useState<{
    enableRecording: boolean;
    intervalSeconds: number;
  }>(() => {
    try {
      const raw = localStorage.getItem(GPS_TRACK_KEY);
      return raw ? JSON.parse(raw) : { enableRecording: true, intervalSeconds: 3 };
    } catch {
      return { enableRecording: true, intervalSeconds: 3 };
    }
  });

  // =====================================
  // 🆕 P4-04: 事業者情報 state
  // =====================================
  const [businessSettings, setBusinessSettings] = useState<TransportBusinessSettings>({
    businessNumber:     '',
    companyName:        '',
    address:            '',
    representativeName: '',
    phoneNumber:        '',
    submissionTarget:   '',
    businessTypes:      [],
  });
  // 🆕 運行設定（離脱検知距離）
  const [departureAlertDistanceM, setDepartureAlertDistanceM] = useState<number>(200);
  const [operationSettingSaving, setOperationSettingSaving] = useState(false);
  const [operationSettingSaved, setOperationSettingSaved]   = useState(false);

  // 🆕 システム設定読み込み
  React.useEffect(() => {
    fetchSystemSettings()
      .then(data => {
        if (data.departure_alert_distance_m) {
          setDepartureAlertDistanceM(parseInt(data.departure_alert_distance_m, 10));
        }
      })
      .catch(err => console.error('システム設定取得エラー:', err));
  }, []);

  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessSaved,   setBusinessSaved]   = useState(false);
  const [businessError,   setBusinessError]   = useState<string | null>(null);

  // 🆕 事業者情報の初期読み込み
  useEffect(() => {
    fetchTransportBusiness()
      .then(data => setBusinessSettings({
        businessNumber:     data.businessNumber     || '',
        companyName:        data.companyName        || '',
        address:            data.address            || '',
        representativeName: data.representativeName || '',
        phoneNumber:        data.phoneNumber        || '',
        submissionTarget:   data.submissionTarget   || '',
        businessTypes:      data.businessTypes      || [],
      }))
      .catch(err => {
        console.error('事業者情報取得エラー:', err);
        // 未登録の場合（404等）は初期値のまま
      });
  }, []);

  // ⑤ システムログ 表示件数 state（もっと見るボタン制御）
  const LOG_PAGE_SIZE    = 4; // 一度に増やす件数
  const [displayedLogsCount, setDisplayedLogsCount] = useState(LOG_PAGE_SIZE);

  // =====================================
  // タブ定義
  // ① 事業者情報タブの NEW バッジを削除
  // =====================================
  const tabs = [
    { id: 'general',   label: '一般設定',   icon: Settings      },
    { id: 'operation', label: '運行設定',   icon: Settings      },  // 🆕 離脱検知距離等
    { id: 'business',  label: '事業者情報', icon: Building2     },
    { id: 'logs',      label: 'ログ管理',   icon: AlertTriangle },
  ];

  // =====================================
  // ② 会社ロゴ ハンドラ
  // =====================================

  /** ファイルを読み込んで Base64 に変換し state / localStorage へ保存 */
  const processLogoFile = useCallback((file: File) => {
    // 画像ファイルのみ受け付ける
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください（PNG / JPEG / SVG / WebP 等）');
      return;
    }
    // ファイルサイズ上限: 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert('ファイルサイズは 2MB 以内にしてください');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLogoUrl(dataUrl);
      localStorage.setItem(COMPANY_LOGO_KEY, dataUrl);
      console.log('✅ [SystemSettings] 会社ロゴを保存しました');
    };
    reader.readAsDataURL(file);
  }, []);

  /** D&D: ドラッグオーバー */
  const handleLogoDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  /** D&D: ドラッグリーブ */
  const handleLogoDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  /** D&D: ドロップ */
  const handleLogoDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processLogoFile(file);
  }, [processLogoFile]);

  /** ファイル選択ダイアログ経由 */
  const handleLogoFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processLogoFile(file);
    // 同一ファイル再選択できるようリセット
    e.target.value = '';
  }, [processLogoFile]);

  /** ロゴ削除 */
  const handleLogoRemove = useCallback(() => {
    if (!confirm('会社ロゴを削除しますか？')) return;
    setLogoUrl(null);
    localStorage.removeItem(COMPANY_LOGO_KEY);
    console.log('✅ [SystemSettings] 会社ロゴを削除しました');
  }, []);

  // =====================================
  // 一般設定保存
  // =====================================
  const handleSaveGeneralSettings = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      // 一般設定を保存
      localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(generalSettings));
      // GPS走行軌跡設定を保存
      localStorage.setItem(GPS_TRACK_KEY, JSON.stringify(gpsTrackSettings));
      // ② ロゴは processLogoFile / handleLogoRemove 内で即時保存済みのため追加処理不要
      console.log('✅ [SystemSettings] 一般設定を保存:', generalSettings);
      console.log('✅ [SystemSettings] GPS走行軌跡設定を保存:', gpsTrackSettings);
      alert('設定を保存しました');
    } catch (error) {
      alert('設定の保存に失敗しました');
    }
  };

  const handleExportLogs = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('ログファイルをダウンロードしました');
    } catch (error) {
      alert('ログファイルのダウンロードに失敗しました');
    }
  };

  const handleClearLogs = async () => {
    if (confirm('古いログを削除しますか？この操作は取り消せません。')) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        alert('古いログを削除しました');
      } catch (error) {
        alert('ログの削除に失敗しました');
      }
    }
  };

  // =====================================
  // 🆕 P4-04: 事業者情報保存
  // =====================================

  /** 🆕 運行設定保存 */
  const handleSaveOperationSettings = async () => {
    setOperationSettingSaving(true);
    setOperationSettingSaved(false);
    try {
      await saveSystemSettings([
        { key: 'departure_alert_distance_m', value: String(departureAlertDistanceM) }
      ]);
      setOperationSettingSaved(true);
      setTimeout(() => setOperationSettingSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || '保存に失敗しました');
    } finally {
      setOperationSettingSaving(false);
    }
  };

  /** 🆕 事業者情報保存 */
  const handleSaveBusinessSettings = async () => {
    setBusinessLoading(true);
    setBusinessError(null);
    setBusinessSaved(false);
    try {
      await saveTransportBusiness(businessSettings);
      setBusinessSaved(true);
      setTimeout(() => setBusinessSaved(false), 3000);
    } catch (err: any) {
      setBusinessError(err.message || '保存に失敗しました');
    } finally {
      setBusinessLoading(false);
    }
  };

  /** 🆕 事業者情報リセット */
  const handleResetBusinessSettings = () => {
    fetchTransportBusiness()
      .then(data => setBusinessSettings({
        businessNumber:     data.businessNumber     || '',
        companyName:        data.companyName        || '',
        address:            data.address            || '',
        representativeName: data.representativeName || '',
        phoneNumber:        data.phoneNumber        || '',
        submissionTarget:   data.submissionTarget   || '',
        businessTypes:      data.businessTypes      || [],
      }))
      .catch(() => {});
  };

  // =====================================
  // ⑤ システムログ モックデータ・もっと見るロジック
  // =====================================
  const mockLogs = [
    {
      id: '1',
      timestamp: '2025-01-16 10:30:15',
      level: 'INFO',
      category: 'USER_ACTION',
      message: 'ユーザー "山田太郎" がログインしました',
      ip: '192.168.1.100',
    },
    {
      id: '2',
      timestamp: '2025-01-16 10:25:42',
      level: 'INFO',
      category: 'API',
      message: 'GET /api/v1/vehicles - 200',
      ip: '192.168.1.100',
    },
    {
      id: '3',
      timestamp: '2025-01-16 10:20:30',
      level: 'WARN',
      category: 'SYSTEM',
      message: 'GPS接続エラーが発生しました（車両: 倉敷500あ1234）',
      ip: '192.168.1.248',
    },
    {
      id: '4',
      timestamp: '2025-01-16 10:15:18',
      level: 'INFO',
      category: 'USER_ACTION',
      message: '運行記録が追加されました（ID: 12345）',
      ip: '192.168.1.100',
    },
    {
      id: '5',
      timestamp: '2025-01-16 10:10:05',
      level: 'ERROR',
      category: 'SYSTEM',
      message: 'データベース接続タイムアウトが発生しました',
      ip: '192.168.1.1',
    },
    {
      id: '6',
      timestamp: '2025-01-16 10:05:00',
      level: 'INFO',
      category: 'USER_ACTION',
      message: 'ユーザー "鈴木花子" が車両情報を更新しました（ID: V-001）',
      ip: '192.168.1.101',
    },
    {
      id: '7',
      timestamp: '2025-01-16 09:58:33',
      level: 'WARN',
      category: 'API',
      message: 'POST /api/v1/operations - 422 バリデーションエラー',
      ip: '192.168.1.102',
    },
    {
      id: '8',
      timestamp: '2025-01-16 09:45:21',
      level: 'INFO',
      category: 'USER_ACTION',
      message: 'ユーザー "田中次郎" がログアウトしました',
      ip: '192.168.1.103',
    },
  ];

  /** ⑤ 現在表示するログ（displayedLogsCount 件） */
  const displayedLogs = mockLogs.slice(0, displayedLogsCount);
  const hasMoreLogs   = displayedLogsCount < mockLogs.length;

  /** ⑤ もっと見るボタンクリック: LOG_PAGE_SIZE 件追加表示 */
  const handleLoadMoreLogs = () => {
    setDisplayedLogsCount(prev => Math.min(prev + LOG_PAGE_SIZE, mockLogs.length));
  };

  // =====================================
  // ログレベルバッジ
  // =====================================
  const getLogLevelBadge = (level: string) => {
    const levelConfig: Record<string, string> = {
      INFO:  'bg-blue-100 text-blue-800',
      WARN:  'bg-yellow-100 text-yellow-800',
      ERROR: 'bg-red-100 text-red-800',
      DEBUG: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${levelConfig[level] || levelConfig.INFO}`}>
        {level}
      </span>
    );
  };

  // =====================================
  // レンダリング
  // =====================================
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">システム設定</h1>
      </div>

      <div className="text-sm text-gray-600">
        システム全体の設定とログ管理
      </div>

      {/* タブナビゲーション */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
                {/* ① 事業者情報タブの NEW バッジを削除 */}
              </button>
            );
          })}
        </nav>
      </div>

      {/* =====================================================
          一般設定タブ
      ===================================================== */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* 基本設定カード */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">基本設定</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会社名
                </label>
                <Input
                  type="text"
                  value={generalSettings.companyName}
                  onChange={(e) => setGeneralSettings({
                    ...generalSettings,
                    companyName: e.target.value,
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  システム名
                </label>
                <Input
                  type="text"
                  value={generalSettings.systemName}
                  onChange={(e) => setGeneralSettings({
                    ...generalSettings,
                    systemName: e.target.value,
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイムゾーン
                </label>
                <select
                  value={generalSettings.timezone}
                  onChange={(e) => setGeneralSettings({
                    ...generalSettings,
                    timezone: e.target.value,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Asia/Tokyo">アジア/東京 (JST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  言語
                </label>
                <select
                  value={generalSettings.language}
                  onChange={(e) => setGeneralSettings({
                    ...generalSettings,
                    language: e.target.value,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日付形式
                </label>
                <select
                  value={generalSettings.dateFormat}
                  onChange={(e) => setGeneralSettings({
                    ...generalSettings,
                    dateFormat: e.target.value,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  時刻形式
                </label>
                <select
                  value={generalSettings.timeFormat}
                  onChange={(e) => setGeneralSettings({
                    ...generalSettings,
                    timeFormat: e.target.value,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="24h">24時間形式</option>
                  <option value="12h">12時間形式</option>
                </select>
              </div>
            </div>
          </div>

          {/* ② 会社ロゴ設定カード */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">会社ロゴ設定</h2>
            <p className="text-xs text-gray-500 mb-4">
              登録したロゴは管理者向けCMS・ドライバー用アプリのヘッダーに会社名と並べて表示されます。
            </p>

            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* D&D アップロードエリア */}
              <div
                onDragOver={handleLogoDragOver}
                onDragLeave={handleLogoDragLeave}
                onDrop={handleLogoDrop}
                onClick={() => !logoUrl && fileInputRef.current?.click()}
                className={`flex-1 min-h-[140px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors
                  ${logoUrl
                    ? 'border-gray-200 bg-gray-50 cursor-default'
                    : isDragOver
                      ? 'border-blue-400 bg-blue-50 cursor-copy'
                      : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                  }`}
              >
                {logoUrl ? (
                  /* ロゴ登録済み: サムネイル表示 */
                  <div className="flex flex-col items-center gap-3 p-4">
                    <img
                      src={logoUrl}
                      alt="会社ロゴ プレビュー"
                      className="max-h-20 max-w-[200px] object-contain"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        変更
                      </button>
                      <span className="text-xs text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleLogoRemove(); }}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ロゴ未登録: アップロード誘導 */
                  <>
                    <Upload className="w-8 h-8 text-gray-400" />
                    <p className="text-sm text-gray-600 font-medium">
                      ここにファイルをドラッグ＆ドロップ
                    </p>
                    <p className="text-xs text-gray-400">または クリックしてファイルを選択</p>
                  </>
                )}
              </div>

              {/* 推奨サイズ等の案内 */}
              <div className="flex-shrink-0 md:w-56 bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-800 space-y-1.5">
                <p className="font-semibold text-sm mb-1">推奨仕様</p>
                <p>📐 推奨サイズ: 横 200px × 縦 60px 以上</p>
                <p>🎨 形式: PNG / SVG（透過背景推奨）</p>
                <p>📦 最大ファイルサイズ: 2MB</p>
                <p className="pt-1 text-blue-700">
                  ※ SVG形式は任意サイズで綺麗に表示されます
                </p>
              </div>
            </div>

            {/* 非表示のファイル入力 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFileChange}
            />
          </div>

          {/* GPS走行軌跡記録設定カード */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">GPS走行軌跡記録設定</h2>

            <div className="space-y-4">
              {/* 走行軌跡を記録するトグル */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">走行軌跡を記録する</p>
                  <p className="text-xs text-gray-500">インターバルで設定された間隔でGPS位置情報をサーバへ送信します</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGpsTrackSettings({
                    ...gpsTrackSettings,
                    enableRecording: !gpsTrackSettings.enableRecording,
                  })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    gpsTrackSettings.enableRecording ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      gpsTrackSettings.enableRecording ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 記録インターバル */}
              <div className={`${gpsTrackSettings.enableRecording ? '' : 'opacity-50 pointer-events-none'}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  記録インターバル
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  設定された間隔でGPS座標をサーバへ送信します。短いほど軌跡が詳細になります。
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={gpsTrackSettings.intervalSeconds}
                    onChange={(e) => setGpsTrackSettings({
                      ...gpsTrackSettings,
                      intervalSeconds: parseInt(e.target.value),
                    })}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1秒間隔</option>
                    <option value={3}>3秒間隔（推奨）</option>
                    <option value={5}>5秒間隔</option>
                    <option value={10}>10秒間隔</option>
                    <option value={15}>15秒間隔</option>
                    <option value={30}>30秒間隔</option>
                    <option value={45}>45秒間隔</option>
                    <option value={60}>60秒間隔</option>
                    <option value={180}>3分間隔</option>
                    <option value={300}>5分間隔</option>
                    <option value={600}>10分間隔</option>
                  </select>
                  <span className="text-sm text-gray-500">ごとにGPS点を記録</span>
                </div>
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end">
            <Button onClick={handleSaveGeneralSettings}>
              <Save className="w-4 h-4 mr-2" />
              設定を保存
            </Button>
          </div>
        </div>
      )}

      {/* =====================================================
          🆕 運行設定タブ
      ===================================================== */}
      {activeTab === 'operation' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">離脱検知設定</h2>
            <p className="text-sm text-gray-500 mb-6">
              積込・積降場所からこの距離以上離れたとき、自動的に次のフェーズに移行しトーストで通知します。
            </p>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  離脱検知距離
                  <span className="ml-2 text-blue-600 font-bold">{departureAlertDistanceM} m</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={50}
                  value={departureAlertDistanceM}
                  onChange={(e) => setDepartureAlertDistanceM(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>50m</span>
                  <span>200m（デフォルト）</span>
                  <span>500m</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-800 space-y-1">
                <p className="font-semibold">動作説明</p>
                <p>• 積込場所到着中に {departureAlertDistanceM}m 以上移動 → 「積降場所へ移動中」に自動切替</p>
                <p>• 積降場所到着中に {departureAlertDistanceM}m 以上移動 → 積降完了を自動記録し「積込場所へ移動中」に切替</p>
              </div>
            </div>

            {operationSettingSaved && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
                ✅ 運行設定を保存しました
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveOperationSettings} disabled={operationSettingSaving}>
                <Save className="w-4 h-4 mr-2" />
                {operationSettingSaving ? '保存中...' : '設定を保存'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          🆕 P4-04: 事業者情報タブ
          帳票（貨物自動車運送事業実績報告書）のヘッダー印字用データを入力
      ===================================================== */}
      {activeTab === 'business' && (
        <div className="space-y-6">
          {/* 事業者基本情報カード */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">事業者基本情報</h2>
            <p className="text-xs text-gray-500 mb-6">
              貨物自動車運送事業実績報告書（第4号様式）のヘッダーに印字される情報を入力してください
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  事業者番号（国交省発行）
                </label>
                <Input
                  type="text"
                  value={businessSettings.businessNumber}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, businessNumber: e.target.value })}
                  placeholder="例: 05-00123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  電話番号
                </label>
                <Input
                  type="text"
                  value={businessSettings.phoneNumber}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, phoneNumber: e.target.value })}
                  placeholder="例: 086-422-1234"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  住所 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={businessSettings.address}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, address: e.target.value })}
                  placeholder="例: 岡山県倉敷市美観地区1丁目1-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  代表者名（役職及び氏名）<span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={businessSettings.representativeName}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, representativeName: e.target.value })}
                  placeholder="例: 代表取締役 山田 太郎"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  提出先（地方運輸局長名）<span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={businessSettings.submissionTarget}
                  onChange={(e) => setBusinessSettings({ ...businessSettings, submissionTarget: e.target.value })}
                  placeholder="例: 中国運輸局長"
                />
              </div>
            </div>
          </div>

          {/* ③ 事業内容カード（1項目のみ選択に変更） */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium text-gray-900">事業内容</h2>
            </div>
            {/* ④ 「（貨物自動車運送事業報告規則の規定）」削除済み */}
            <p className="text-xs text-gray-500 mb-4">
              主な事業内容を1つ選択してください
            </p>

            {/* ③ セレクトボックス（1項目のみ選択） */}
            <select
              value={businessSettings.businessTypes[0] || ''}
              onChange={(e) => {
                const val = e.target.value;
                // バックエンドAPIとの互換性維持: string[] として送信
                setBusinessSettings({
                  ...businessSettings,
                  businessTypes: val ? [val] : [],
                });
              }}
              className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {BUSINESS_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* エラー表示 */}
          {businessError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {businessError}
            </div>
          )}

          {/* 保存完了メッセージ */}
          {businessSaved && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
              ✅ 事業者情報を保存しました
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex justify-between items-center">
            <Button variant="secondary" onClick={handleResetBusinessSettings}>
              リセット
            </Button>
            <Button onClick={handleSaveBusinessSettings} disabled={businessLoading}>
              <Save className="w-4 h-4 mr-2" />
              {businessLoading ? '保存中...' : '保存する'}
            </Button>
          </div>
        </div>
      )}

      {/* =====================================================
          ログ管理タブ
      ===================================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* ログ設定 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">ログ設定</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ログ保持期間（日）
                </label>
                <Input
                  type="number"
                  value={logSettings.retentionDays}
                  onChange={(e) => setLogSettings({
                    ...logSettings,
                    retentionDays: parseInt(e.target.value),
                  })}
                  min="1"
                  max="3650"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ログレベル
                </label>
                <select
                  value={logSettings.logLevel}
                  onChange={(e) => setLogSettings({
                    ...logSettings,
                    logLevel: e.target.value,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="debug">DEBUG</option>
                  <option value="info">INFO</option>
                  <option value="warn">WARN</option>
                  <option value="error">ERROR</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={logSettings.enableApiLogging}
                      onChange={(e) => setLogSettings({
                        ...logSettings,
                        enableApiLogging: e.target.checked,
                      })}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">API呼び出しログを記録</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={logSettings.enableUserActionLogging}
                      onChange={(e) => setLogSettings({
                        ...logSettings,
                        enableUserActionLogging: e.target.checked,
                      })}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">ユーザー操作ログを記録</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleExportLogs}>
                  <Download className="w-4 h-4 mr-2" />
                  ログ出力
                </Button>
                <Button variant="danger" onClick={handleClearLogs}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  ログクリア
                </Button>
              </div>
              <Button onClick={handleSaveGeneralSettings}>
                <Save className="w-4 h-4 mr-2" />
                設定を保存
              </Button>
            </div>
          </div>

          {/* ⑤ システムログ一覧（もっと見る機能修正済み） */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">システムログ</h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      レベル
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      カテゴリ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      メッセージ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.timestamp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getLogLevelBadge(log.level)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.category}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                        {log.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ip}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ⑤ もっと見る / 全件表示済みフッター */}
            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-700">
                {displayedLogs.length} 件 / 全 {mockLogs.length} 件を表示中
              </p>
              {hasMoreLogs ? (
                <Button variant="outline" size="sm" onClick={handleLoadMoreLogs}>
                  もっと見る
                </Button>
              ) : (
                <span className="text-xs text-gray-400">すべてのログを表示しています</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;