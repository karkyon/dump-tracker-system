// frontend/mobile/src/pages/OperationHistoryDetail.tsx
// D9a: 運行記録詳細画面 - 新規実装
// GET /mobile/operations/:id を呼び出して詳細表示

import React, { useEffect, useState } from 'react';
import { useTLog } from '../hooks/useTLog';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  User,
  Clock,
  TrendingUp,
  MapPin,
  Fuel,
  Package,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';

// =====================================
// 型定義
// =====================================
interface ActivityRecord {
  id: string;
  activityType: string;
  locationName: string;
  itemName: string;
  quantity: number;
  unit: string;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  sequenceNumber: number;
}

interface FuelRecord {
  id: string;
  fuelAmount: number;
  fuelCost: number;
  mileageAtRefuel: number;
  stationName: string;
  recordedAt: string | null;
}

interface OperationDetail {
  id: string;
  date: string;
  status: string;
  vehicle: {
    id: string;
    registrationNumber: string;
    vehicleType: string;
  };
  driver: {
    id: string;
    name: string;
  };
  startTime: string | null;
  endTime: string | null;
  totalDistance: number;
  totalDuration: number;
  startMileage: number;
  endMileage: number;
  loadingCount: number;
  unloadingCount: number;
  activities: ActivityRecord[];
  fuelRecords: FuelRecord[];
  notes: string;
  customerName?: string; // 🆕 客先名
}

// =====================================
// アクティビティ種別ラベル変換
// =====================================
const ACTIVITY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  LOADING: { label: '積込', color: 'text-blue-700 bg-blue-50', icon: '📦' },
  LOADING_START: { label: '積込到着', color: 'text-blue-600 bg-blue-50', icon: '🚛' },
  LOADING_COMPLETE: { label: '積込完了', color: 'text-blue-800 bg-blue-100', icon: '✅' },
  UNLOADING: { label: '積降', color: 'text-orange-700 bg-orange-50', icon: '📤' },
  UNLOADING_START: { label: '積降到着', color: 'text-orange-600 bg-orange-50', icon: '🏗️' },
  UNLOADING_COMPLETE: { label: '積降完了', color: 'text-orange-800 bg-orange-100', icon: '✅' },
  BREAK_START: { label: '休憩開始', color: 'text-gray-600 bg-gray-50', icon: '☕' },
  BREAK_END: { label: '休憩終了', color: 'text-gray-600 bg-gray-50', icon: '▶️' },
  FUEL: { label: '給油', color: 'text-green-700 bg-green-50', icon: '⛽' },
  FUELING: { label: '給油', color: 'text-green-700 bg-green-50', icon: '⛽' }, // ✅ 追加: FUELINGも給油として表示
};

// =====================================
// OperationHistoryDetail コンポーネント
// =====================================
const OperationHistoryDetail: React.FC = () => {
  useTLog('OPERATION_HISTORY_DETAIL', '運行履歴詳細');

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<OperationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // =====================================
  // 詳細データ取得
  // =====================================
  useEffect(() => {
    if (!id) return;
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      setIsLoading(true);

      // GET /api/v1/mobile/operations/:id
      const response = await (apiService as any).getOperationDetail(id);

      if (response.success && response.data) {
        setDetail(response.data);
      } else {
        toast.error('運行詳細の取得に失敗しました');
        navigate(-1);
      }
    } catch (error: any) {
      console.error('運行詳細取得エラー:', error);
      toast.error('運行詳細の取得に失敗しました');
      navigate(-1);
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================
  // フォーマット関数
  // =====================================
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
  };

  const formatTime = (isoStr: string | null): string => {
    if (!isoStr) return '--:--';
    return new Date(isoStr).toTimeString().slice(0, 5);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { text: string; color: string }> = {
      COMPLETED: { text: '完了', color: 'bg-green-100 text-green-700' },
      IN_PROGRESS: { text: '運行中', color: 'bg-blue-100 text-blue-700' },
      CANCELLED: { text: 'キャンセル', color: 'bg-gray-100 text-gray-700' },
    };
    const config = statusConfig[status] ?? { text: status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const getActivityInfo = (activityType: string) => {
    return ACTIVITY_LABELS[activityType] || { label: activityType, color: 'text-gray-600 bg-gray-50', icon: '•' };
  };

  // =====================================
  // ローディング表示
  // =====================================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-4">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">運行記録詳細</h1>
            <p className="text-blue-100 text-sm">{formatDate(detail.date)}</p>
          </div>
          <div className="ml-auto">
            {getStatusBadge(detail.status)}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* 車両・運転手情報カード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">基本情報</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">車両番号</div>
                <div className="font-semibold text-gray-800">{detail.vehicle.registrationNumber}</div>
              </div>
              {detail.vehicle.vehicleType && (
                <div className="ml-auto text-sm text-gray-500">{detail.vehicle.vehicleType}</div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">運転手</div>
                <div className="font-semibold text-gray-800">{detail.driver.name || '不明'}</div>
              </div>
            </div>
            {detail.customerName && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <span className="text-base">🏢</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">客先</div>
                  <div className="font-semibold text-gray-800">{detail.customerName}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 運行サマリーカード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">運行サマリー</h2>

          {/* 時間帯 */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">出発</div>
              <div className="text-xl font-bold text-gray-800">{formatTime(detail.startTime)}</div>
            </div>
            <div className="flex-1 mx-4 relative">
              <div className="border-t-2 border-dashed border-gray-200" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                            bg-white px-2 text-xs text-gray-400">
                {formatDuration(detail.totalDuration)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">帰着</div>
              <div className="text-xl font-bold text-gray-800">
                {detail.endTime ? formatTime(detail.endTime) : '運行中'}
              </div>
            </div>
          </div>

          {/* 統計グリッド */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <div className="text-xs text-gray-500">運行時間</div>
              <div className="font-bold text-blue-700">{formatDuration(detail.totalDuration)}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <div className="text-xs text-gray-500">走行距離</div>
              <div className="font-bold text-green-700">{detail.totalDistance.toFixed(1)}km</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <Package className="w-5 h-5 text-orange-600 mx-auto mb-1" />
              <div className="text-xs text-gray-500">積込回数</div>
              <div className="font-bold text-orange-700">{detail.loadingCount}回</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <MapPin className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <div className="text-xs text-gray-500">積降回数</div>
              <div className="font-bold text-purple-700">{detail.unloadingCount}回</div>
            </div>
          </div>

          {/* 走行距離詳細 */}
          {(detail.startMileage > 0 || detail.endMileage > 0) && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm text-gray-600">
              <span>開始距離: {detail.startMileage.toLocaleString()}km</span>
              <span>終了距離: {detail.endMileage.toLocaleString()}km</span>
            </div>
          )}
        </div>

        {/* アクティビティタイムライン */}
        {detail.activities.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">運行内容</h2>
            <div className="space-y-3">
              {detail.activities
                .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
                .map((activity, index) => {
                  const actInfo = getActivityInfo(activity.activityType);
                  return (
                    <div key={activity.id} className="flex gap-3">
                      {/* タイムラインライン */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${actInfo.color}`}>
                          {actInfo.icon}
                        </div>
                        {index < detail.activities.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-1" />
                        )}
                      </div>

                      {/* アクティビティ内容 */}
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${actInfo.color}`}>
                            {actInfo.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTime(activity.startTime)}
                          </span>
                        </div>
                        {activity.locationName && (
                          <div className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {activity.locationName}
                          </div>
                        )}
                        {activity.itemName && (
                          <div className="mt-0.5 text-sm text-gray-500">
                            品目: {activity.itemName}
                            {activity.quantity > 0 && ` × ${activity.quantity}${activity.unit}`}
                          </div>
                        )}
                        {activity.notes && (
                          <div className="mt-0.5 text-xs text-gray-400">{activity.notes}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 給油記録 */}
        {detail.fuelRecords.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">給油記録</h2>
            <div className="space-y-3">
              {detail.fuelRecords.map((fuel) => (
                <div key={fuel.id} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <Fuel className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800">
                        {fuel.fuelAmount.toFixed(1)}L
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatTime(fuel.recordedAt)}
                      </span>
                    </div>
                    {fuel.stationName && (
                      <div className="text-sm text-gray-500 mt-0.5">{fuel.stationName}</div>
                    )}
                    {fuel.fuelCost > 0 && (
                      <div className="text-sm text-gray-500">
                        ¥{fuel.fuelCost.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* メモ */}
        {detail.notes && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">メモ</h2>
            <p className="text-gray-700 text-sm">{detail.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationHistoryDetail;