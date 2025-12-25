// frontend/mobile/src/pages/Home.tsx
// ログイン後のホーム画面 - 運行開始・履歴確認・設定へのメイン導線

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { 
  Truck, 
  History, 
  Settings, 
  TrendingUp,
  Clock,
  MapPin,
  ChevronRight,
  Calendar,
  LogOut
} from 'lucide-react';
import apiService from '../services/api';

/**
 * 今日の運行サマリー型定義
 */
interface TodaysSummary {
  operationCount: number;     // 今日の運行回数
  totalDistance: number;      // 今日の総走行距離 (km)
  totalDuration: number;      // 今日の総運行時間 (分)
  lastOperationEndTime?: string; // 最終運行終了時刻
}

/**
 * Home画面コンポーネント
 */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
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
    
    // 日付表示を1秒ごとに更新
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
      // エラーでもデフォルト値(0)で表示を継続
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
    
    return `${year}年${month}月${day}日(${dayOfWeek})`;
  };

  /**
   * 時刻フォーマット関数
   */
  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  /**
   * 運行時間フォーマット関数 (分 → 時間:分)
   */
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-md mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Truck className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">運転日報アプリ</h1>
                <p className="text-blue-100 text-xs mt-0.5">
                  ダンプトラック運行記録システム
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2
                       bg-white/10 hover:bg-white/20
                       rounded-lg backdrop-blur-sm
                       transition-all duration-200
                       active:scale-95"
              aria-label="ログアウト"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">ログアウト</span>
            </button>
          </div>
          
          {/* ユーザー挨拶 & 日付表示 */}
          <div className="mt-4 space-y-1">
            <p className="text-lg font-semibold">
              こんにちは、{user?.name || 'ゲスト'}さん
            </p>
            <div className="flex items-center space-x-4 text-sm text-blue-100">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(currentDate)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{formatTime(currentDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 px-6 py-6 space-y-5">
        <div className="max-w-md mx-auto space-y-5">
          
          {/* 今日の運行状況カード */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                今日の運行状況
              </h2>
              {!isLoading && (
                <button
                  onClick={fetchTodaysSummary}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  更新
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : summary.operationCount > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {/* 運行回数 */}
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {summary.operationCount}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">運行回数</div>
                </div>

                {/* 総走行距離 */}
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {summary.totalDistance.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">走行距離(km)</div>
                </div>

                {/* 総運行時間 */}
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {formatDuration(summary.totalDuration)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">運行時間</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">
                  本日の運行記録はありません
                </p>
              </div>
            )}
          </div>

          {/* 運行開始ボタン (メイン機能) */}
          <button
            onClick={handleStartOperation}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700
                     hover:from-blue-700 hover:to-blue-800
                     text-white font-bold py-6 rounded-2xl
                     shadow-lg hover:shadow-xl
                     active:scale-[0.98]
                     transition-all duration-200
                     flex items-center justify-center space-x-3"
          >
            <Truck className="w-7 h-7" />
            <span className="text-lg">運行を開始する</span>
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* サブ機能ボタン */}
          <div className="grid grid-cols-2 gap-4">
            {/* 履歴確認ボタン */}
            <button
              onClick={handleViewHistory}
              className="bg-white border-2 border-gray-200
                       hover:border-blue-500 hover:bg-blue-50
                       text-gray-700 hover:text-blue-700
                       font-semibold py-5 rounded-xl
                       shadow-md hover:shadow-lg
                       active:scale-[0.98]
                       transition-all duration-200
                       flex flex-col items-center justify-center space-y-2"
            >
              <History className="w-7 h-7" />
              <span className="text-sm">履歴確認</span>
            </button>

            {/* 設定ボタン */}
            <button
              onClick={handleSettings}
              className="bg-white border-2 border-gray-200
                       hover:border-gray-400 hover:bg-gray-50
                       text-gray-700 hover:text-gray-800
                       font-semibold py-5 rounded-xl
                       shadow-md hover:shadow-lg
                       active:scale-[0.98]
                       transition-all duration-200
                       flex flex-col items-center justify-center space-y-2"
            >
              <Settings className="w-7 h-7" />
              <span className="text-sm">設定</span>
            </button>
          </div>

          {/* バージョン情報 */}
          <div className="text-center text-xs text-gray-400 pt-2">
            <p>Version 1.0.0</p>
            <p className="mt-0.5">© 2025 ダンプ運行記録システム</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;