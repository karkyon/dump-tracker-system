import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Download, Trash2, AlertTriangle } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

const SystemSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [generalSettings, setGeneralSettings] = useState({
    companyName: 'ダンプ運送株式会社',
    systemName: 'ダンプ運行記録システム',
    timezone: 'Asia/Tokyo',
    language: 'ja',
    dateFormat: 'YYYY/MM/DD',
    timeFormat: '24h'
  });

  const [logSettings, setLogSettings] = useState({
    retentionDays: 365,
    logLevel: 'info',
    enableApiLogging: true,
    enableUserActionLogging: true
  });

  const tabs = [
    { id: 'general', label: '一般設定', icon: Settings },
    { id: 'logs', label: 'ログ管理', icon: AlertTriangle }
  ];

  const handleSaveGeneralSettings = async () => {
    try {
      // 実際のAPI呼び出しをシミュレート
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    <Layout>
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
                  <option value="YYYY/MM/DD">年/月/日</option>
                  <option value="DD/MM/YYYY">日/月/年</option>
                  <option value="MM/DD/YYYY">月/日/年</option>
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

            <div className="flex justify-end mt-6">
              <Button onClick={handleSaveGeneralSettings}>
                <Save className="w-4 h-4 mr-2" />
                設定を保存
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
    </Layout>
  );
};

export default SystemSettings;