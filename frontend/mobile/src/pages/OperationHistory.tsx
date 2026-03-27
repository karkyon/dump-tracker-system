// frontend/mobile/src/pages/OperationHistory.tsx
// 運行履歴画面（D9）- 実API連携版
// ダミーデータを削除し、GET /mobile/operations を呼び出す完全実装

import React, { useEffect, useState, useCallback } from 'react';
import { useTLog } from '../hooks/useTLog';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Truck,
  MapPin,
  Clock,
  TrendingUp,
  Search,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';

// =====================================
// 型定義
// =====================================
interface OperationHistoryItem {
  id: string;
  date: string;
  vehicleNumber: string;
  vehicleType: string;
  driverName: string;
  startTime: string;
  endTime: string;
  totalDistance: number;
  totalDuration: number;
  loadingCount: number;
  unloadingCount: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED';
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// =====================================
// OperationHistory コンポーネント
// =====================================
const OperationHistory: React.FC = () => {
  useTLog('OPERATION_HISTORY', '運行履歴');

  const navigate = useNavigate();

  // 状態管理
  const [operations, setOperations] = useState<OperationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // =====================================
  // 運行履歴取得
  // =====================================
  const fetchOperationHistory = useCallback(async (page = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const params: any = {
        page,
        limit: 20,
      };

      if (filterStatus !== 'ALL') {
        params.status = filterStatus;
      }

      // GET /api/v1/mobile/operations
      const response = await apiService.getOperations(params);

      if (response.success && response.data) {
        const data = response.data as any;

        // バックエンドのレスポンス形式に対応
        // { operations: [...], pagination: {...} } 形式
        const items: OperationHistoryItem[] = data.operations || data;
        const paginationData: PaginationInfo | null = data.pagination || null;

        if (page === 1) {
          setOperations(items);
        } else {
          // ページネーション追加読み込み
          setOperations(prev => [...prev, ...items]);
        }

        if (paginationData) {
          setPagination(paginationData);
        }
        setCurrentPage(page);
      } else {
        console.error('運行履歴取得失敗:', response.message);
        toast.error('運行履歴の取得に失敗しました');
      }
    } catch (error: any) {
      console.error('運行履歴取得エラー:', error);
      toast.error('運行履歴の取得に失敗しました');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterStatus]);

  // フィルタ変更時に再取得
  useEffect(() => {
    setCurrentPage(1);
    fetchOperationHistory(1);
  }, [filterStatus]);

  // =====================================
  // ハンドラー
  // =====================================
  const handleBack = () => navigate('/home');

  const handleViewDetail = (operationId: string) => {
    navigate(`/operation-history/${operationId}`);
  };

  const handleRefresh = () => {
    fetchOperationHistory(1, true);
  };

  const handleLoadMore = () => {
    if (pagination?.hasNextPage) {
      fetchOperationHistory(currentPage + 1);
    }
  };

  // =====================================
  // フォーマット関数
  // =====================================
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { text: string; color: string }> = {
      COMPLETED: { text: '完了', color: 'bg-green-100 text-green-700' },
      IN_PROGRESS: { text: '運行中', color: 'bg-blue-100 text-blue-700' },
      CANCELLED: { text: 'キャンセル', color: 'bg-gray-100 text-gray-700' },
    };
    const config = statusConfig[status] ?? { text: status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  // =====================================
  // 検索フィルタ（クライアントサイド）
  // =====================================
  const filteredOperations = operations.filter(op => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      op.vehicleNumber.toLowerCase().includes(query) ||
      op.driverName.toLowerCase().includes(query)
    );
  });

  // =====================================
  // サマリー計算
  // =====================================
  const summary = {
    total: pagination?.totalItems || filteredOperations.length,
    totalDistance: filteredOperations.reduce((sum, op) => sum + op.totalDistance, 0),
    totalDuration: filteredOperations.reduce((sum, op) => sum + op.totalDuration, 0),
  };

  // =====================================
  // レンダリング
  // =====================================
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
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
            {/* リフレッシュボタン */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* 検索バー */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="車両番号・運転手名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white
                       text-gray-900 placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          {/* フィルタータブ */}
          <div className="flex gap-2">
            {[
              { value: 'ALL', label: '全て' },
              { value: 'COMPLETED', label: '完了' },
              { value: 'IN_PROGRESS', label: '運行中' },
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
      </div>

      {/* 運行履歴リスト */}
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          // ローディング表示
          <div className="flex flex-col justify-center items-center py-16 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            <p className="text-gray-500 text-sm">運行履歴を取得中...</p>
          </div>
        ) : filteredOperations.length === 0 ? (
          // データなし
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">運行履歴がありません</p>
            <p className="text-gray-400 text-sm mt-1">
              {filterStatus !== 'ALL' ? 'フィルタを変更してお試しください' : ''}
            </p>
          </div>
        ) : (
          // 運行履歴カード
          filteredOperations.map((operation) => (
            <div
              key={operation.id}
              onClick={() => handleViewDetail(operation.id)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4
                       hover:shadow-md active:bg-gray-50 transition-all cursor-pointer"
            >
              {/* ヘッダー行 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-gray-800">
                    {formatDate(operation.date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(operation.status)}
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* 車両・運転手情報 */}
              <div className="flex items-center gap-4 mb-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span className="text-gray-700 font-medium">{operation.vehicleNumber}</span>
                </div>
                <div className="text-gray-500">{operation.driverName}</div>
              </div>

              {/* 運行情報グリッド */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {/* 運行時間 */}
                <div className="text-center bg-blue-50 rounded-lg py-2">
                  <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                  <div className="text-xs text-gray-500 mb-0.5">運行時間</div>
                  <div className="text-sm font-semibold text-blue-700">
                    {formatDuration(operation.totalDuration)}
                  </div>
                </div>

                {/* 走行距離 */}
                <div className="text-center bg-green-50 rounded-lg py-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                  <div className="text-xs text-gray-500 mb-0.5">走行距離</div>
                  <div className="text-sm font-semibold text-green-700">
                    {operation.totalDistance.toFixed(1)}km
                  </div>
                </div>

                {/* 積降回数 */}
                <div className="text-center bg-orange-50 rounded-lg py-2">
                  <MapPin className="w-4 h-4 text-orange-600 mx-auto mb-1" />
                  <div className="text-xs text-gray-500 mb-0.5">積降回数</div>
                  <div className="text-sm font-semibold text-orange-700">
                    {operation.loadingCount + operation.unloadingCount}回
                  </div>
                </div>
              </div>

              {/* 時間帯 */}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{operation.startTime} 開始</span>
                <div className="flex-1 mx-3 border-t border-dashed border-gray-200" />
                <span>{operation.endTime || '運行中'} {operation.endTime ? '終了' : ''}</span>
              </div>
            </div>
          ))
        )}

        {/* もっと読み込むボタン */}
        {!isLoading && pagination?.hasNextPage && (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-blue-600 font-medium text-sm
                     border border-blue-200 rounded-xl bg-white
                     hover:bg-blue-50 active:bg-blue-100 transition-colors"
          >
            さらに読み込む
          </button>
        )}
      </div>

      {/* サマリー情報（画面下部固定） */}
      {!isLoading && filteredOperations.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
          <div className="flex justify-around text-center">
            <div>
              <div className="text-xs text-gray-500">総運行数</div>
              <div className="text-lg font-bold text-blue-600">
                {summary.total}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">総走行距離</div>
              <div className="text-lg font-bold text-green-600">
                {summary.totalDistance.toFixed(1)}km
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">総運行時間</div>
              <div className="text-lg font-bold text-orange-600">
                {formatDuration(summary.totalDuration)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationHistory;