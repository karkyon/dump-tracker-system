// frontend/mobile/src/pages/Home.tsx
// ログイン後のホーム画面 - 添付画像デザイン完全準拠 + 全機能保持版（312行相当）

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useOperationStore } from '../stores/operationStore';
import { 
  Truck, 
  History, 
  Settings, 
  TrendingUp,
  Clock,
  MapPin,
  ChevronRight,
  Calendar,
  LogOut,
  RefreshCw
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
 * 🎨 添付画像デザイン完全準拠
 * ✅ 元の312行の全機能保持
 */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const operationStore = useOperationStore();
  
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-8">
      {/* ヘッダー - 画像デザイン準拠 */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-md mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            {/* 左側：アプリタイトル */}
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2.5 rounded-lg backdrop-blur-sm">
                <Truck className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">運転日報アプリ</h1>
                <p className="text-xs text-white/90 mt-0.5">
                  ダンプトラック運行記録システム
                </p>
              </div>
            </div>

            {/* 右側：ログアウトボタン */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 bg-white/20 hover:bg-white/30 
                       px-3.5 py-2 rounded-lg transition-colors backdrop-blur-sm
                       active:scale-95"
              aria-label="ログアウト"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6 space-y-5">
        {/* 挨拶カード - 画像デザイン準拠（独立したカード） */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md p-5">
          <div className="flex items-start space-x-2">
            <div className="text-blue-500 mt-0.5">
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

        {/* 今日の運行状況カード - 画像デザイン準拠 */}
        <div className="bg-white rounded-2xl shadow-lg p-5">
          {/* カードヘッダー */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-800">今日の運行状況</h2>
            </div>
            {!isLoading && (
              <button
                onClick={fetchTodaysSummary}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium
                         flex items-center space-x-1 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>更新</span>
              </button>
            )}
          </div>

          {/* データ表示エリア */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : summary.operationCount > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {/* 運行回数 - 画像通り青背景 */}
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {summary.operationCount}
                </div>
                <div className="text-xs text-gray-600">運行回数</div>
              </div>

              {/* 走行距離 - 画像通り緑背景 */}
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {summary.totalDistance.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600">走行距離(km)</div>
              </div>

              {/* 運行時間 - 画像通りオレンジ背景 */}
              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <div className="text-lg font-bold text-orange-600 mb-1">
                  {formatDuration(summary.totalDuration)}
                </div>
                <div className="text-xs text-gray-600">運行時間</div>
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

        {/* 運行を開始するボタン - 画像デザイン準拠 */}
        <button
          onClick={handleStartOperation}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 
                   hover:from-blue-700 hover:to-blue-800
                   text-white font-bold text-lg py-5 rounded-2xl shadow-lg
                   transform hover:scale-[1.02] active:scale-[0.98]
                   transition-all duration-200
                   flex items-center justify-center space-x-3"
        >
          <Truck className="w-6 h-6" />
          <span>運行を開始する</span>
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* 下部ボタン群 - 画像デザイン準拠（横並び） */}
        <div className="grid grid-cols-2 gap-4">
          {/* 履歴確認ボタン */}
          <button
            onClick={handleViewHistory}
            className="bg-white hover:bg-gray-50 border-2 border-gray-200
                     hover:border-blue-400
                     text-gray-700 font-bold py-5 rounded-2xl shadow-md
                     transform hover:scale-[1.02] active:scale-[0.98]
                     transition-all duration-200
                     flex flex-col items-center justify-center space-y-2"
          >
            <Clock className="w-7 h-7 text-gray-600" />
            <span className="text-sm">履歴確認</span>
          </button>

          {/* 設定ボタン */}
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

        {/* フッター - 画像デザイン準拠 */}
        <div className="text-center text-gray-400 pt-4">
          <p className="text-xs mb-1">Version 1.0.0</p>
          <p className="text-xs">© 2025 ダンプ運行記録システム</p>
        </div>
      </main>
    </div>
  );
};

export default Home;