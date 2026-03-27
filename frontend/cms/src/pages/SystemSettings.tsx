import React, { useEffect, useState } from 'react';
import { useTLog } from '../hooks/useTLog';
import { Settings, Save, Download, Trash2, AlertTriangle, Building2 } from 'lucide-react';
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
// 事業内容選択肢（様式規則準拠・最大3項目）
// =====================================
const BUSINESS_TYPE_OPTIONS: { value: string; label: string }[] = [
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

const SystemSettings: React.FC = () => {
  useTLog('SYSTEM_SETTINGS', 'システム設定');

  const [activeTab, setActiveTab] = useState('general');
const GENERAL_SETTINGS_KEY = 'dump_tracker_general_settings';
const [generalSettings, setGeneralSettings] = useState(() => {
  try {
    const raw = localStorage.getItem(GENERAL_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {
      companyName: 'ダンプ運送株式会社',
      systemName: 'ダンプ運行記録システム',
      timezone: 'Asia/Tokyo',
      language: 'ja',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: '24h'
    };
  } catch {
    return {
      companyName: 'ダンプ運送株式会社',
      systemName: 'ダンプ運行記録システム',
      timezone: 'Asia/Tokyo',
      language: 'ja',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: '24h'
    };
  }
});

  const [logSettings, setLogSettings] = useState({
    retentionDays: 365,
    logLevel: 'info',
    enableApiLogging: true,
    enableUserActionLogging: true
  });

  // ✅ GPS走行軌跡表示設定（localStorage永続化）
  const GPS_TRACK_KEY = 'dump_tracker_gps_track_settings';
  const [gpsTrackSettings, setGpsTrackSettings] = useState<{
    showTrack: boolean;
    intervalMinutes: number;
  }>(() => {
    try {
      const raw = localStorage.getItem(GPS_TRACK_KEY);
      return raw ? JSON.parse(raw) : { showTrack: false, intervalMinutes: 5 };
    } catch {
      return { showTrack: false, intervalMinutes: 5 };
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
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessSaved, setBusinessSaved] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);

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

  // 🆕 事業内容チェックボックス切り替え
  const toggleBusinessType = (value: string) => {
    const current = businessSettings.businessTypes;
    if (current.includes(value)) {
      setBusinessSettings({ ...businessSettings, businessTypes: current.filter(t => t !== value) });
    } else if (current.length < 3) {
      setBusinessSettings({ ...businessSettings, businessTypes: [...current, value] });
    }
  };

  // 🆕 事業者情報保存
  const handleSaveBusinessSettings = async () => {
    if (businessSettings.businessTypes.length > 3) {
      setBusinessError('事業内容は3項目以内で選択してください');
      return;
    }
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

  // 🆕 事業者情報リセット
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
  // タブ定義（🆕 事業者情報タブを追加）
  // =====================================
  const tabs = [
    { id: 'general',  label: '一般設定',   icon: Settings      },
    { id: 'business', label: '事業者情報', icon: Building2     },  // 🆕 P4-04
    { id: 'logs',     label: 'ログ管理',   icon: AlertTriangle },
  ];

  const handleSaveGeneralSettings = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      // 一般設定を保存
      localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(generalSettings));
      // GPS走行軌跡設定を保存
      localStorage.setItem(GPS_TRACK_KEY, JSON.stringify(gpsTrackSettings));
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

  const mockLogs = [
    {
      id: '1',
      timestamp: '2025-01-16 10:30:15',
      level: 'INFO',
      category: 'USER_ACTION',
      message: 'ユーザー "山田太郎" がログインしました',
      ip: '192.168.1.100'
    },
    {
      id: '2',
      timestamp: '2025-01-16 10:25:42',
      level: 'INFO',
      category: 'API',
      message: 'GET /api/v1/vehicles - 200',
      ip: '192.168.1.100'
    },
    {
      id: '3',
      timestamp: '2025-01-16 10:20:30',
      level: 'WARN',
      category: 'SYSTEM',
      message: 'GPS接続エラーが発生しました（車両: 倉敷500あ1234）',
      ip: '192.168.1.248'
    },
    {
      id: '4',
      timestamp: '2025-01-16 10:15:18',
      level: 'INFO',
      category: 'USER_ACTION',
      message: '運行記録が追加されました（ID: 12345）',
      ip: '192.168.1.100'
    }
  ];

  const getLogLevelBadge = (level: string) => {
    const levelConfig = {
      INFO: 'bg-blue-100 text-blue-800',
      WARN: 'bg-yellow-100 text-yellow-800',
      ERROR: 'bg-red-100 text-red-800',
      DEBUG: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${levelConfig[level as keyof typeof levelConfig] || levelConfig.INFO}`}>
        {level}
      </span>
    );
  };

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
                {/* 🆕 事業者情報タブに NEW バッジ */}
                {tab.id === 'business' && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                    NEW
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 一般設定タブ */}
      {activeTab === 'general' && (
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
                  companyName: e.target.value
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
                  systemName: e.target.value
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
                  timezone: e.target.value
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
                  language: e.target.value
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
                  dateFormat: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
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
                  timeFormat: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="24h">24時間形式</option>
                <option value="12h">12時間形式</option>
              </select>
            </div>
          </div>

          {/* GPS走行軌跡表示設定 */}
          <div className="mt-8 space-y-4">
            <h3 className="text-base font-medium text-gray-900">GPS走行軌跡表示設定</h3>

            {/* 表示ON/OFFトグル */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">走行軌跡を表示する</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  GPSログに基づく走行ルートを地図上に描画します
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGpsTrackSettings(prev => ({ ...prev, showTrack: !prev.showTrack }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  gpsTrackSettings.showTrack ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                aria-label="走行軌跡表示切替"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    gpsTrackSettings.showTrack ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* インターバル設定（表示ONの場合のみ有効） */}
            <div className={`p-4 bg-gray-50 rounded-lg border border-gray-200 ${!gpsTrackSettings.showTrack ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                描画インターバル
              </label>
              <p className="text-xs text-gray-500 mb-3">
                何分間隔のGPS座標を描画するかを設定します。短いほど詳細になりますが表示が重くなります。
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={gpsTrackSettings.intervalMinutes}
                  onChange={(e) => setGpsTrackSettings(prev => ({
                    ...prev,
                    intervalMinutes: Number(e.target.value)
                  }))}
                  disabled={!gpsTrackSettings.showTrack}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value={1}>1分間隔（最詳細）</option>
                  <option value={2}>2分間隔</option>
                  <option value={5}>5分間隔（推奨）</option>
                  <option value={10}>10分間隔</option>
                  <option value={15}>15分間隔</option>
                  <option value={30}>30分間隔（軽量）</option>
                </select>
                <span className="text-sm text-gray-500">
                  ごとにGPS点を表示
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveGeneralSettings}>
              <Save className="w-4 h-4 mr-2" />
              設定を保存
            </Button>
          </div>
        </div>
      )}

      {/* =====================================
          🆕 P4-04: 事業者情報タブ
          貨物自動車運送事業報告規則 第4号様式のヘッダー印字用データを入力
      ===================================== */}
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

          {/* 事業内容カード */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium text-gray-900">事業内容</h2>
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                businessSettings.businessTypes.length > 3
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {businessSettings.businessTypes.length} / 3 項目選択中
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              主なもの3項目以内を選択してください（貨物自動車運送事業報告規則の規定）
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {BUSINESS_TYPE_OPTIONS.map(({ value, label }) => {
                const checked = businessSettings.businessTypes.includes(value);
                const disabled = !checked && businessSettings.businessTypes.length >= 3;
                return (
                  <label
                    key={value}
                    className={`flex items-center gap-2 p-3 border rounded-md text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : disabled
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleBusinessType(value)}
                      className="accent-blue-600 w-4 h-4 flex-shrink-0"
                    />
                    {label}
                  </label>
                );
              })}
            </div>

            {businessSettings.businessTypes.length > 3 && (
              <p className="mt-3 text-sm text-red-600">
                事業内容は3項目以内で選択してください
              </p>
            )}
          </div>

          {/* 保存ステータス・ボタン */}
          {businessSaved && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              ✓ 保存しました
            </div>
          )}
          {businessError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {businessError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleResetBusinessSettings} disabled={businessLoading}>
              変更をリセット
            </Button>
            <Button
              onClick={handleSaveBusinessSettings}
              disabled={businessLoading || businessSettings.businessTypes.length > 3}
            >
              <Save className="w-4 h-4 mr-2" />
              {businessLoading ? '保存中...' : '保存する'}
            </Button>
          </div>
        </div>
      )}

      {/* ログ管理タブ */}
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
                    retentionDays: parseInt(e.target.value)
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
                    logLevel: e.target.value
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
                        enableApiLogging: e.target.checked
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
                        enableUserActionLogging: e.target.checked
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

          {/* システムログ一覧 */}
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
                  {mockLogs.map(log => (
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

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-700">
                最新の10件を表示中
              </p>
              <Button variant="outline" size="sm">
                もっと見る
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;