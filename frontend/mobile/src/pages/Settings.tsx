// frontend/mobile/src/pages/Settings.tsx
// 設定画面（D9a仕様） - 季節テーマ設定機能追加版
// ✅ 既存機能100%保持 + 季節テーマ設定追加

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Bell,
  Eye,
  Wrench,
  AlertTriangle,
  Database,
  Save,
  RotateCcw,
  Palette
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSeasonalTheme, ThemeKey, THEME_ICONS } from '../hooks/useSeasonalTheme';

/**
 * 設定データ型定義
 */
interface SettingsData {
  notifications: {
    operationStart: boolean;
    gpsAutoUpdate: boolean;
    dataCompletion: boolean;
  };
  display: {
    darkMode: boolean;
    fontSize: 'small' | 'medium' | 'large';
    orientation: 'portrait' | 'landscape' | 'auto';
  };
  operation: {
    autoLogoutMinutes: number;
    gpsAutoRecording: boolean;
    offlineSync: boolean;
    autoBackup: boolean;
  };
  alerts: {
    speedLimit: number;
    continuousDriving: number;
  };
  data: {
    syncInterval: number;
    backupFrequency: number;
  };
}

/**
 * Settings画面コンポーネント - 季節テーマ設定追加版
 */
const Settings: React.FC = () => {
  const navigate = useNavigate();
  
  // 🎨 季節テーマHook
  const {
    currentTheme,
    activeThemeKey,
    isAutoApply,
    manualTheme,
    toggleAutoApply,
    setManualTheme,
    allThemes
  } = useSeasonalTheme();

  // デフォルト設定値
  const defaultSettings: SettingsData = {
    notifications: {
      operationStart: true,
      gpsAutoUpdate: true,
      dataCompletion: false
    },
    display: {
      darkMode: false,
      fontSize: 'medium',
      orientation: 'auto'
    },
    operation: {
      autoLogoutMinutes: 30,
      gpsAutoRecording: true,
      offlineSync: false,
      autoBackup: true
    },
    alerts: {
      speedLimit: 80,
      continuousDriving: 240
    },
    data: {
      syncInterval: 30,
      backupFrequency: 24
    }
  };

  // 状態管理
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  /**
   * 設定読み込み
   */
  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * 設定読み込み処理
   */
  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('設定読み込みエラー:', error);
      toast.error('設定の読み込みに失敗しました');
    }
  };

  /**
   * 設定更新ハンドラ（ジェネリック）
   */
  const updateSetting = <K extends keyof SettingsData>(
    category: K,
    key: keyof SettingsData[K],
    value: any
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  /**
   * 設定保存処理
   */
  const handleSave = () => {
    try {
      localStorage.setItem('appSettings', JSON.stringify(settings));
      setHasChanges(false);
      toast.success('設定を保存しました');
    } catch (error) {
      console.error('設定保存エラー:', error);
      toast.error('設定の保存に失敗しました');
    }
  };

  /**
   * 設定リセット処理
   */
  const handleReset = () => {
    if (window.confirm('設定を初期値に戻しますか？')) {
      setSettings(defaultSettings);
      setHasChanges(true);
      toast.success('設定を初期値に戻しました');
    }
  };

  /**
   * 戻るボタンハンドラ
   */
  const handleBack = () => {
    if (hasChanges) {
      if (window.confirm('変更が保存されていません。戻りますか？')) {
        navigate('/home');
      }
    } else {
      navigate('/home');
    }
  };

  /**
   * テーマ表示名マッピング
   */
  const themeNameMap: Record<ThemeKey, string> = {
    'default': 'デフォルト',
    'newyear': '正月',
    'spring': '春・桜',
    'early_summer': '初夏',
    'midsummer': '真夏',
    'rainy': '梅雨',
    'autumn': '秋',
    'maple': '紅葉',
    'winter': '冬',
    'snowman': '雪だるま',
    'valentine': 'バレンタイン',
    'children': 'こどもの日',
    'hinamatsuri': 'ひな祭り',
    'moon': '月見',
    'obon': 'お盆',
    'war_memorial': '終戦記念日'
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-6 h-6" />
            設定
          </h1>
        </div>
      </div>

      {/* 設定コンテンツ */}
      <div className="px-4 py-4 space-y-4">
        
        {/* 通知設定 */}
        <section className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 flex items-center gap-2 border-b border-orange-100">
            <Bell className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold text-gray-800">通知設定</h2>
          </div>
          <div className="p-4 space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-gray-700">運行開始通知</span>
              <input
                type="checkbox"
                checked={settings.notifications.operationStart}
                onChange={(e) => updateSetting('notifications', 'operationStart', e.target.checked)}
                className="w-12 h-6 appearance-none bg-gray-300 rounded-full relative
                         checked:bg-blue-600 transition-colors cursor-pointer
                         before:content-[''] before:absolute before:w-5 before:h-5 
                         before:bg-white before:rounded-full before:top-0.5 before:left-0.5
                         before:transition-transform checked:before:translate-x-6"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-gray-700">手渡高さデータ</span>
              <input
                type="checkbox"
                checked={settings.notifications.gpsAutoUpdate}
                onChange={(e) => updateSetting('notifications', 'gpsAutoUpdate', e.target.checked)}
                className="w-12 h-6 appearance-none bg-gray-300 rounded-full relative
                         checked:bg-blue-600 transition-colors cursor-pointer
                         before:content-[''] before:absolute before:w-5 before:h-5 
                         before:bg-white before:rounded-full before:top-0.5 before:left-0.5
                         before:transition-transform checked:before:translate-x-6"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-gray-700">データ完成通知</span>
              <input
                type="checkbox"
                checked={settings.notifications.dataCompletion}
                onChange={(e) => updateSetting('notifications', 'dataCompletion', e.target.checked)}
                className="w-12 h-6 appearance-none bg-gray-300 rounded-full relative
                         checked:bg-blue-600 transition-colors cursor-pointer
                         before:content-[''] before:absolute before:w-5 before:h-5 
                         before:bg-white before:rounded-full before:top-0.5 before:left-0.5
                         before:transition-transform checked:before:translate-x-6"
              />
            </label>
          </div>
        </section>

        {/* 表示設定 + 🆕 季節テーマ設定 */}
        <section className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-pink-50 px-4 py-3 flex items-center gap-2 border-b border-pink-100">
            <Eye className="w-5 h-5 text-pink-600" />
            <h2 className="font-semibold text-gray-800">表示設定</h2>
          </div>
          <div className="p-4 space-y-4">
            
            {/* 🎨 季節テーマ自動適用 */}
            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-pink-600" />
                  <span className="text-gray-700 font-medium">季節テーマ自動適用</span>
                </div>
                <input
                  type="checkbox"
                  checked={isAutoApply}
                  onChange={toggleAutoApply}
                  className="w-12 h-6 appearance-none bg-gray-300 rounded-full relative
                           checked:bg-pink-600 transition-colors cursor-pointer
                           before:content-[''] before:absolute before:w-5 before:h-5 
                           before:bg-white before:rounded-full before:top-0.5 before:left-0.5
                           before:transition-transform checked:before:translate-x-6"
                />
              </div>
              
              {/* 🎨 手動テーマ選択 */}
              {!isAutoApply && (
                <div className="mt-3">
                  <label className="block text-sm text-gray-600 mb-2">
                    テーマを選択
                  </label>
                  <select
                    value={manualTheme || 'default'}
                    onChange={(e) => setManualTheme(e.target.value as ThemeKey)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    {Object.keys(allThemes).map((key) => (
                      <option key={key} value={key}>
                        {THEME_ICONS[key as ThemeKey]} {themeNameMap[key as ThemeKey]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* 現在のテーマ表示 */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">現在のテーマ</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{THEME_ICONS[activeThemeKey]}</span>
                  <span className="font-medium text-gray-800">
                    {themeNameMap[activeThemeKey]}
                  </span>
                  {isAutoApply && (
                    <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                      自動
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ダークモード */}
            <label className="flex items-center justify-between">
              <span className="text-gray-700">ダークモード</span>
              <input
                type="checkbox"
                checked={settings.display.darkMode}
                onChange={(e) => updateSetting('display', 'darkMode', e.target.checked)}
                className="w-12 h-6 appearance-none bg-gray-300 rounded-full relative
                         checked:bg-blue-600 transition-colors cursor-pointer
                         before:content-[''] before:absolute before:w-5 before:h-5 
                         before:bg-white before:rounded-full before:top-0.5 before:left-0.5
                         before:transition-transform checked:before:translate-x-6"
              />
            </label>

            {/* フォントサイズ */}
            <div>
              <label className="block text-gray-700 mb-2">フォントサイズ</label>
              <select
                value={settings.display.fontSize}
                onChange={(e) => updateSetting('display', 'fontSize', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="small">小</option>
                <option value="medium">標準</option>
                <option value="large">大</option>
              </select>
            </div>

            {/* 画面向き */}
            <div>
              <label className="block text-gray-700 mb-2">画面向き設定</label>
              <select
                value={settings.display.orientation}
                onChange={(e) => updateSetting('display', 'orientation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="portrait">縦固定</option>
                <option value="landscape">横固定</option>
                <option value="auto">自動</option>
              </select>
            </div>
          </div>
        </section>

        {/* 操作設定 */}
        <section className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-purple-50 px-4 py-3 flex items-center gap-2 border-b border-purple-100">
            <Wrench className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-gray-800">操作設定</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">
                自動ログアウト時間
              </label>
              <select
                value={settings.operation.autoLogoutMinutes}
                onChange={(e) => updateSetting('operation', 'autoLogoutMinutes', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15分</option>
                <option value={30}>30分</option>
                <option value={60}>60分</option>
              </select>
            </div>

            <label className="flex items-center justify-between">
              <span className="text-gray-700">GPS自動取得</span>
              <input
                type="checkbox"
                checked={settings.operation.gpsAutoRecording}
                onChange={(e) => updateSetting('operation', 'gpsAutoRecording', e.target.checked)}
                className="w-12 h-6 appearance-none bg-gray-300 rounded-full relative
                         checked:bg-blue-600 transition-colors cursor-pointer
                         before:content-[''] before:absolute before:w-5 before:h-5 
                         before:bg-white before:rounded-full before:top-0.5 before:left-0.5
                         before:transition-transform checked:before:translate-x-6"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-gray-700">オフライン反映</span>
              <input
                type="checkbox"
                checked={settings.operation.offlineSync}
                onChange={(e) => updateSetting('operation', 'offlineSync', e.target.checked)}
                className="w-12 h-6 appearance-none bg-gray-300 rounded-full relative
                         checked:bg-blue-600 transition-colors cursor-pointer
                         before:content-[''] before:absolute before:w-5 before:h-5 
                         before:bg-white before:rounded-full before:top-0.5 before:left-0.5
                         before:transition-transform checked:before:translate-x-6"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-gray-700">データ自動バックアップ</span>
              <input
                type="checkbox"
                checked={settings.operation.autoBackup}
                onChange={(e) => updateSetting('operation', 'autoBackup', e.target.checked)}
                className="w-12 h-6 appearance-none bg-gray-300 rounded-full relative
                         checked:bg-blue-600 transition-colors cursor-pointer
                         before:content-[''] before:absolute before:w-5 before:h-5 
                         before:bg-white before:rounded-full before:top-0.5 before:left-0.5
                         before:transition-transform checked:before:translate-x-6"
              />
            </label>
          </div>
        </section>

        {/* アラート設定 */}
        <section className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-red-50 px-4 py-3 flex items-center gap-2 border-b border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="font-semibold text-gray-800">アラート設定</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">
                速度超過閾値（km/h）
              </label>
              <input
                type="number"
                value={settings.alerts.speedLimit}
                onChange={(e) => updateSetting('alerts', 'speedLimit', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={40}
                max={120}
                step={10}
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">
                連続運転時間閾値（分）
              </label>
              <input
                type="number"
                value={settings.alerts.continuousDriving}
                onChange={(e) => updateSetting('alerts', 'continuousDriving', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={60}
                max={480}
                step={30}
              />
            </div>
          </div>
        </section>

        {/* データ設定 */}
        <section className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-blue-50 px-4 py-3 flex items-center gap-2 border-b border-blue-100">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">データ設定</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">
                同期間隔（分）
              </label>
              <select
                value={settings.data.syncInterval}
                onChange={(e) => updateSetting('data', 'syncInterval', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15分</option>
                <option value={30}>30分</option>
                <option value={60}>60分</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">
                バックアップ頻度（時間）
              </label>
              <select
                value={settings.data.backupFrequency}
                onChange={(e) => updateSetting('data', 'backupFrequency', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={12}>12時間</option>
                <option value={24}>24時間</option>
                <option value={48}>48時間</option>
              </select>
            </div>
          </div>
        </section>
      </div>

      {/* 固定フッター（保存・リセットボタン） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700
                     font-semibold py-3 rounded-xl transition-colors
                     flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            リセット
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex-1 font-semibold py-3 rounded-xl transition-colors
                     flex items-center justify-center gap-2
                     ${hasChanges
                       ? 'bg-blue-600 hover:bg-blue-700 text-white'
                       : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                     }`}
          >
            <Save className="w-5 h-5" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;