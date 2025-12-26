// frontend/mobile/src/pages/OperationHistory.tsx
// 運行履歴画面 - 過去の運行記録一覧表示

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Truck,
  MapPin,
  Clock,
  TrendingUp,
  Search,
  ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * 運行履歴アイテム型定義
 */
interface OperationHistoryItem {
  id: string;
  date: string;
  vehicleNumber: string;
  driverName: string;
  startTime: string;
  endTime: string;
  totalDistance: number;  // km
  totalDuration: number;  // 分
  loadingCount: number;   // 積込回数
  unloadingCount: number; // 積降回数
  status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED';
}

/**
 * OperationHistory画面コンポーネント
 */
const OperationHistory: React.FC = () => {
  const navigate = useNavigate();

  // 状態管理
  const [operations, setOperations] = useState<OperationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  /**
   * 運行履歴取得処理
   */
  useEffect(() => {
    fetchOperationHistory();
  }, [selectedDate, filterStatus]);

  /**
   * 運行履歴取得
   */
  const fetchOperationHistory = async () => {
    try {
      setIsLoading(true);

      // TODO: 実際のAPI実装時に置き換え
      // const response = await apiService.getOperations({
      //   date: selectedDate,
      //   status: filterStatus !== 'ALL' ? filterStatus : undefined
      // });

      // ダミーデータ（開発用）
      const dummyData: OperationHistoryItem[] = [
        {
          id: '1',
          date: '2025-12-26',
          vehicleNumber: '倉敷100あ1234',
          driverName: '山田太郎',
          startTime: '08:30',
          endTime: '17:45',
          totalDistance: 125.5,
          totalDuration: 555,
          loadingCount: 3,
          unloadingCount: 3,
          status: 'COMPLETED'
        },
        {
          id: '2',
          date: '2025-12-25',
          vehicleNumber: '倉敷100あ1234',
          driverName: '山田太郎',
          startTime: '08:15',
          endTime: '18:20',
          totalDistance: 142.3,
          totalDuration: 605,
          loadingCount: 4,
          unloadingCount: 4,
          status: 'COMPLETED'
        }
      ];

      setOperations(dummyData);
    } catch (error: any) {
      console.error('運行履歴取得エラー:', error);
      toast.error('運行履歴の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 戻るボタンハンドラ
   */
  const handleBack = () => {
    navigate('/home');
  };

  /**
   * 運行詳細表示ハンドラ
   */
  const handleViewDetail = (operationId: string) => {
    // TODO: 運行詳細画面への遷移を実装
    toast(`運行ID: ${operationId} の詳細表示（未実装）`);
  };

  /**
   * 日付フォーマット関数
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
  };

  /**
   * 時間フォーマット関数
   */
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins}m`;
  };

  /**
   * ステータスバッジ取得
   */
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      COMPLETED: { text: '完了', color: 'bg-green-100 text-green-700' },
      IN_PROGRESS: { text: '運行中', color: 'bg-blue-100 text-blue-700' },
      CANCELLED: { text: 'キャンセル', color: 'bg-gray-100 text-gray-700' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.COMPLETED;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  /**
   * フィルタリングされた運行一覧
   */
  const filteredOperations = operations.filter(op => {
    // 検索クエリでフィルタ
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        op.vehicleNumber.toLowerCase().includes(query) ||
        op.driverName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              運行履歴
            </h1>
          </div>

          {/* 検索バー */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="車両番号・運転手名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg
                       text-gray-900 placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>

        {/* フィルタータブ */}
        <div className="flex gap-2 px-4 pb-3">
          {[
            { value: 'ALL', label: '全て' },
            { value: 'COMPLETED', label: '完了' },
            { value: 'IN_PROGRESS', label: '運行中' }
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${filterStatus === filter.value
                  ? 'bg-white text-blue-700'
                  : 'bg-white/10 text-white hover:bg-white/20'
                }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* 運行履歴リスト */}
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          // ローディング表示
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : filteredOperations.length === 0 ? (
          // データなし
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">運行履歴がありません</p>
          </div>
        ) : (
          // 運行履歴カード
          filteredOperations.map((operation) => (
            <div
              key={operation.id}
              onClick={() => handleViewDetail(operation.id)}
              className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg
                       transition-shadow cursor-pointer"
            >
              {/* ヘッダー行 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-gray-800">
                    {formatDate(operation.date)}
                  </span>
                </div>
                {getStatusBadge(operation.status)}
              </div>

              {/* 車両・運転手情報 */}
              <div className="flex items-center gap-4 mb-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span className="text-gray-700">{operation.vehicleNumber}</span>
                </div>
                <div className="text-gray-600">
                  {operation.driverName}
                </div>
              </div>

              {/* 運行情報グリッド */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                {/* 運行時間 */}
                <div className="text-center bg-blue-50 rounded-lg py-2">
                  <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 mb-0.5">運行時間</div>
                  <div className="text-sm font-semibold text-blue-700">
                    {formatDuration(operation.totalDuration)}
                  </div>
                </div>

                {/* 走行距離 */}
                <div className="text-center bg-green-50 rounded-lg py-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 mb-0.5">走行距離</div>
                  <div className="text-sm font-semibold text-green-700">
                    {operation.totalDistance.toFixed(1)}km
                  </div>
                </div>

                {/* 積降回数 */}
                <div className="text-center bg-orange-50 rounded-lg py-2">
                  <MapPin className="w-4 h-4 text-orange-600 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 mb-0.5">積降回数</div>
                  <div className="text-sm font-semibold text-orange-700">
                    {operation.loadingCount + operation.unloadingCount}回
                  </div>
                </div>
              </div>

              {/* 時間帯 */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{operation.startTime} 開始</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span>{operation.endTime} 終了</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* サマリー情報（画面下部） */}
      {!isLoading && filteredOperations.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex justify-around text-center">
            <div>
              <div className="text-xs text-gray-600">総運行数</div>
              <div className="text-lg font-bold text-blue-600">
                {filteredOperations.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">総走行距離</div>
              <div className="text-lg font-bold text-green-600">
                {filteredOperations.reduce((sum, op) => sum + op.totalDistance, 0).toFixed(1)}km
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">総運行時間</div>
              <div className="text-lg font-bold text-orange-600">
                {formatDuration(
                  filteredOperations.reduce((sum, op) => sum + op.totalDuration, 0)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationHistory;