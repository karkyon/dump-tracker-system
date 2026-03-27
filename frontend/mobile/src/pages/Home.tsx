// frontend/mobile/src/pages/Home.tsx
// ログイン後のホーム画面 - 季節テーマ統合版
// ✅ 既存機能100%保持 + 季節背景演出追加

import React, { useEffect, useState } from 'react';
import { useTLog } from '../hooks/useTLog';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useOperationStore } from '../stores/operationStore';
import { useSeasonalTheme, THEME_ICONS } from '../hooks/useSeasonalTheme';
import { 
  Truck, 
  Settings, 
  TrendingUp,
  Clock,
  MapPin,
  Calendar,
  LogOut,
  RefreshCw
} from 'lucide-react';
import apiService from '../services/api';

/**
 * 今日の運行サマリー型定義
 */
interface TodaysSummary {
  operationCount: number;
  totalDistance: number;
  totalDuration: number;
  lastOperationEndTime?: string;
}

/**
 * Home画面コンポーネント - 季節テーマ統合版
 */
const Home: React.FC = () => {
  useTLog('HOME', 'ホーム');

  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const operationStore = useOperationStore();
  
  // 🎨 季節テーマHook
  const { currentTheme, activeThemeKey } = useSeasonalTheme();
  
  // 状態管理
  const [summary, setSummary] = useState<TodaysSummary>({
    operationCount: 0,
    totalDistance: 0,
    totalDuration: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  /**
   * 今日の運行サマリーを取得
   */
  useEffect(() => {
    fetchTodaysSummary();
    
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /**
   * 今日の運行サマリー取得処理
   */
  const fetchTodaysSummary = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getTodaysSummary();
      
      if (response.success && response.data) {
        setSummary(response.data);
      }
    } catch (error: any) {
      console.error('運行サマリー取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 運行開始ボタンハンドラ
   */
  const handleStartOperation = () => {
    navigate('/vehicle-info');
  };

  /**
   * 履歴確認ボタンハンドラ
   */
  const handleViewHistory = () => {
    navigate('/operation-history');
  };

  /**
   * 設定ボタンハンドラ
   */
  const handleSettings = () => {
    navigate('/settings');
  };

  /**
   * ログアウトボタンハンドラ
   */
  const handleLogout = () => {
    if (window.confirm('ログアウトしますか？')) {
      operationStore.resetOperation();
      logout();
      navigate('/login', { replace: true });
    }
  };

  /**
   * 日付フォーマット関数
   */
  const formatDate = (date: Date): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];
    return `${year}年${month}月${day}日（${dayOfWeek}）`;
  };

  /**
   * 時刻フォーマット関数
   */
  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div 
      className="min-h-screen pb-20"
      style={{
        backgroundColor: currentTheme.background,
        backgroundImage: `url(${currentTheme.backgroundImage})`,
        backgroundSize: '200px 200px',
        backgroundRepeat: 'repeat'
      }}
    >
      {/* 🎨 季節テーマに対応したヘッダー */}
      <header 
        className="text-white px-4 py-4 shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.marker} 100%)`
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">ダンプ運行記録</h1>
            <p className="text-sm text-white/80">Dump Tracker</p>
          </div>
          <div className="flex items-center space-x-2">
            {/* 季節アイコン表示 */}
            <span className="text-3xl" title={activeThemeKey}>
              {THEME_ICONS[activeThemeKey]}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6 space-y-5">
        {/* 挨拶カード */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md p-5">
          <div className="flex items-start space-x-2">
            <div style={{ color: currentTheme.primary }} className="mt-0.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">こんにちは</p>
              <p className="text-base font-bold text-gray-800 mb-2">
                {user?.name || '運転手テストユーザー'}さん
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(currentDate)} {formatTime(currentDate)}
              </p>
            </div>
          </div>
        </div>

        {/* 今日の運行状況カード */}
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" style={{ color: currentTheme.primary }} />
              <h2 className="text-lg font-bold text-gray-800">今日の運行状況</h2>
            </div>
            {!isLoading && (
              <button
                onClick={fetchTodaysSummary}
                className="text-sm font-medium flex items-center space-x-1 transition-colors"
                style={{ color: currentTheme.primary }}
              >
                <RefreshCw className="w-4 h-4" />
                <span>更新</span>
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div 
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{ borderColor: currentTheme.primary }}
              />
            </div>
          ) : summary.operationCount > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <Calendar className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-600">{summary.operationCount}</p>
                <p className="text-xs text-gray-600">運行回数</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <MapPin className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-600">
                  {(summary.totalDistance / 1000).toFixed(1)}
                </p>
                <p className="text-xs text-gray-600">走行距離(km)</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <Clock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-purple-600">
                  {Math.floor(summary.totalDuration / 60)}
                </p>
                <p className="text-xs text-gray-600">運行時間(h)</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">本日の運行記録はまだありません</p>
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="space-y-4">
          {/* 運行開始ボタン（フルサイズ） */}
          <button
            onClick={handleStartOperation}
            className="w-full text-white font-bold py-6 rounded-2xl shadow-lg
                     transform hover:scale-[1.02] active:scale-[0.98]
                     transition-all duration-200
                     flex flex-col items-center justify-center space-y-2"
            style={{
              background: `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.marker} 100%)`
            }}
          >
            <Truck className="w-8 h-8" />
            <span className="text-lg">運行開始</span>
          </button>

          {/* 履歴確認・設定ボタン（2カラム） */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleViewHistory}
              className="bg-white hover:bg-gray-50 border-2 text-gray-700 font-bold py-5 rounded-2xl shadow-md
                       transform hover:scale-[1.02] active:scale-[0.98]
                       transition-all duration-200
                       flex flex-col items-center justify-center space-y-2"
              style={{ borderColor: currentTheme.primary }}
            >
              <Clock className="w-7 h-7 text-gray-600" />
              <span className="text-sm">履歴確認</span>
            </button>

            <button
              onClick={handleSettings}
              className="bg-white hover:bg-gray-50 border-2 border-gray-200
                       hover:border-gray-400
                       text-gray-700 font-bold py-5 rounded-2xl shadow-md
                       transform hover:scale-[1.02] active:scale-[0.98]
                       transition-all duration-200
                       flex flex-col items-center justify-center space-y-2"
            >
              <Settings className="w-7 h-7 text-gray-600" />
              <span className="text-sm">設定</span>
            </button>
          </div>
        </div>

        {/* フッター */}
        <div className="text-center text-gray-400 pt-4">
          <p className="text-xs mb-1">Version 1.0.0</p>
          <p className="text-xs">© 2025 ダンプ運行記録システム</p>
        </div>
      </main>
    </div>
  );
};

export default Home;