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
import ActivityEditSheet, { createDraftActivity } from '../components/ActivityEditSheet';
import type { ActivityRecord as EditSheetActivityRecord } from '../components/ActivityEditSheet';

// =====================================
// 型定義
// =====================================
interface ActivityRecord {
  id: string;
  activityType: string;
  locationName: string;
  itemName: string;
  // ✅ 複数品目対応
  itemNames?: string[];
  itemIds?: string[];
  customItemName?: string;
  quantity: number;
  unit: string;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  sequenceNumber: number;
  customerName?: string | null;
  customerId?: string;
  locationId?: string;
  fuelCostYen?: number;
  locationLat?: number;
  locationLng?: number;
}

interface FuelRecord {
  id: string;
  fuelAmount: number;
  fuelCost: number;
  mileageAtRefuel: number;
  stationName: string;
  notes?: string;
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
// アクティビティ種別ラベル変換 (✅ トレードカラー統一)
// =====================================
// ✅ トレードカラー定数: 積込=#2196F3 / 荷降=#4CAF50 / 休憩=#9C27B0 / 給油=#FF9800
const TC = {
  LOADING_BG: '#E3F2FD', LOADING_FG: '#1565C0', LOADING_BORDER: '#2196F3',
  UNLOADING_BG: '#E8F5E9', UNLOADING_FG: '#2E7D32', UNLOADING_BORDER: '#4CAF50',
  BREAK_BG: '#F3E5F5', BREAK_FG: '#6A1B9A', BREAK_BORDER: '#9C27B0',
  FUEL_BG: '#FFF3E0', FUEL_FG: '#E65100', FUEL_BORDER: '#FF9800',
  OTHER_BG: '#F9FAFB', OTHER_FG: '#6B7280', OTHER_BORDER: '#E5E7EB',
};
const ACTIVITY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  LOADING: { label: '積込', color: 'text-blue-800 bg-blue-50', icon: '📍' },
  LOADING_START: { label: '積込到着', color: 'text-blue-700 bg-blue-50', icon: '📍' },
  LOADING_COMPLETE: { label: '積込完了', color: 'text-blue-800 bg-blue-100', icon: '✅' },
  LOADING_COMPLETED: { label: '積込完了', color: 'text-blue-800 bg-blue-100', icon: '✅' },
  UNLOADING: { label: '荷降', color: 'text-green-800 bg-green-50', icon: '📍' },
  UNLOADING_START: { label: '荷降到着', color: 'text-green-700 bg-green-50', icon: '📍' },
  UNLOADING_COMPLETE: { label: '荷降完了', color: 'text-green-800 bg-green-100', icon: '✅' },
  UNLOADING_COMPLETED: { label: '荷降完了', color: 'text-green-800 bg-green-100', icon: '✅' },
  BREAK: { label: '休憩', color: 'text-purple-800 bg-purple-50', icon: '☕' },
  BREAK_START: { label: '休憩', color: 'text-purple-800 bg-purple-50', icon: '☕' },
  BREAK_END: { label: '休憩終了', color: 'text-purple-700 bg-purple-50', icon: '☕' },
  FUEL: { label: '給油', color: 'text-orange-700 bg-orange-50', icon: '⛽' },
  FUELING: { label: '給油', color: 'text-orange-700 bg-orange-50', icon: '⛽' },
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
  // 🆕 イベント追加シート（記録漏れの後追い登録用）
    // ✅ 運行中の画面と全く同じ編集機能をこの画面にも実装
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);
  const [insertMode, setInsertMode] = useState(false);
  const [pickerContext, setPickerContext] = useState<{ afterSeq: number; prevEndTime: string | null; lastLoadingCustomerId?: string; lastLoadingCustomerName?: string } | null>(null);
  const [creatingActivity, setCreatingActivity] = useState<{ draft: EditSheetActivityRecord; afterSeq: number } | null>(null);
  const [detailCustomers, setDetailCustomers] = useState<{ id: string; name: string }[]>([]);
  const [detailItems, setDetailItems] = useState<{ id: string; name: string; itemType?: string; displayOrder?: number }[]>([]);
  // ✅ 修正④: 走行距離のインライン編集用
  const [editingDistance, setEditingDistance] = useState(false);
  const [distanceInput, setDistanceInput] = useState('');
  const [savingDistance, setSavingDistance] = useState(false);

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
        // ✅ 運行中の画面（OperationRecord）と同じ客先・品目マスタを取得し、編集シートに渡す
        try {
          const cr = await apiService.getCustomers();
          const ci = (cr as any)?.data?.customers ?? (cr as any)?.data ?? cr;
          if (Array.isArray(ci)) setDetailCustomers(ci);
        } catch { /* 客先取得失敗は編集シート側でも空リストで動作継続 */ }
        try {
          const ir = await (apiService as any).getItems();
          const ii = ir?.data?.items ?? (Array.isArray(ir?.data) ? ir.data : null) ?? ir;
          const itemList = Array.isArray(ii) ? ii : [];
          setDetailItems(itemList);
        } catch { /* 品目取得失敗は編集シート側でも空リストで動作継続 */ }
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

  // ✅ 修正④: 走行距離の保存
  const handleSaveDistance = async () => {
    if (!id || !distanceInput.trim()) return;
    setSavingDistance(true);
    try {
      const res = await (apiService as any).updateOperationDistance(id, parseFloat(distanceInput));
      if (res?.success) {
        toast.success('走行距離を更新しました');
        setEditingDistance(false);
        fetchDetail();
      } else {
        toast.error(res?.message || '走行距離の更新に失敗しました');
      }
    } catch (error) {
      console.error('走行距離更新エラー:', error);
      toast.error('走行距離の更新に失敗しました');
    } finally {
      setSavingDistance(false);
    }
  };

  // =====================================
  // フォーマット関数
  // =====================================
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    // ✅ JST変換
    const jstStr = date.toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short'
    });
    return jstStr;
  };

  const formatTime = (isoStr: string | null): string => {
    if (!isoStr) return '--:--';
    // ✅ JST変換
    return new Date(isoStr).toLocaleTimeString('ja-JP', {
      timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false
    });
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
    <div className="min-h-screen bg-gray-50 pb-32">
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
            <p className="text-blue-100 text-sm">{formatDate(detail.date ?? '')}</p>
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
              <div className="text-xl font-bold text-gray-800">{formatTime(detail.startTime ?? '')}</div>
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
                {detail.endTime ? formatTime(detail.endTime ?? '') : '運行中'}
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
              <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                走行距離
                {!editingDistance && (
                  <button
                    onClick={() => { setDistanceInput(detail.totalDistance ? String(detail.totalDistance) : ''); setEditingDistance(true); }}
                    className="text-[10px] text-blue-600 underline"
                  >編集</button>
                )}
              </div>
              {editingDistance ? (
                <div className="flex items-center gap-1 justify-center mt-1">
                  <input
                    type="number" inputMode="decimal" value={distanceInput}
                    onChange={e => setDistanceInput(e.target.value)}
                    className="w-16 border border-gray-300 rounded px-1 py-0.5 text-sm text-center"
                  />
                  <button
                    onClick={handleSaveDistance} disabled={savingDistance}
                    className="text-xs text-white bg-green-600 rounded px-2 py-0.5 disabled:opacity-50"
                  >保存</button>
                  <button onClick={() => setEditingDistance(false)} className="text-xs text-gray-500 px-1">✕</button>
                </div>
              ) : (
                <div className="font-bold text-green-700">{detail.totalDistance.toFixed(1)}km</div>
              )}
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

        {/* ✅ CMSと同じ品目・客先別集計サマリー（1運行ごと） */}
        {detail.activities.length > 0 && (() => {
          const sortedForSummary = [...detail.activities].sort(
            (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)
          );
          const completedLoadings = sortedForSummary.filter(
            a => a.activityType === 'LOADING' && !!a.endTime
          );
          const namesOf = (a: ActivityRecord): string[] =>
            (a.itemNames && a.itemNames.length > 0) ? a.itemNames : (a.itemName ? [a.itemName] : []);
          const uniqueItems = [...new Set(completedLoadings.flatMap(namesOf))];
          const itemCountMap: Record<string, number> = {};
          completedLoadings.forEach(a => {
            namesOf(a).forEach(n => { itemCountMap[n] = (itemCountMap[n] || 0) + 1; });
          });
          const itemCountEntries = Object.entries(itemCountMap);

          type RouteRow = { customer: string; item: string; route: string; count: number };
          const routeMap = new Map<string, RouteRow>();
          completedLoadings.forEach(le => {
            const idx = sortedForSummary.indexOf(le);
            const nextUnl = sortedForSummary.slice(idx + 1).find(a => a.activityType === 'UNLOADING');
            const customer = le.customerName || detail.customerName || '—';
            const item = namesOf(le).join('、') || '—';
            const loadLoc = le.locationName || '—';
            const unlLoc = nextUnl?.locationName || '—';
            const route = `${loadLoc}〜${unlLoc}`;
            const key = `${customer}|${item}|${route}`;
            const prev = routeMap.get(key);
            if (prev) { prev.count++; } else { routeMap.set(key, { customer, item, route, count: 1 }); }
          });
          const routeRows = Array.from(routeMap.values());

          if (uniqueItems.length === 0 && routeRows.length === 0) return null;

          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">品目・客先サマリー</h2>

              {uniqueItems.length > 0 && (
                <div className="mb-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 flex-shrink-0">運搬品目:</span>
                  {uniqueItems.map((name, i) => (
                    <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                      {name}
                    </span>
                  ))}
                </div>
              )}

              {itemCountEntries.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-gray-500 block mb-1">品目別台数:</span>
                  <div className="flex flex-wrap gap-2">
                    {itemCountEntries.map(([itemName, count]) => (
                      <span key={itemName} className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded font-bold">
                        {itemName}: {count}台
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {routeRows.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500 block mb-1 font-semibold">客先別集計:</span>
                  <div className="overflow-x-auto rounded border border-gray-200">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-2 py-1 text-left text-gray-500 font-medium border-b border-gray-200">客先</th>
                          <th className="px-2 py-1 text-left text-gray-500 font-medium border-b border-gray-200">経路</th>
                          <th className="px-2 py-1 text-left text-gray-500 font-medium border-b border-gray-200">品目</th>
                          <th className="px-2 py-1 text-center text-gray-500 font-medium border-b border-gray-200">回数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {routeRows.map((r, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-1 text-gray-800 font-medium whitespace-nowrap">{r.customer}</td>
                            <td className="px-2 py-1 text-gray-600 whitespace-nowrap">{r.route}</td>
                            <td className="px-2 py-1 text-indigo-700 whitespace-nowrap">{r.item}</td>
                            <td className="px-2 py-1 text-center font-bold text-blue-700">{r.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* アクティビティ - グループ表示（積込/荷降1くくり + 休憩1くくり） */}
        {detail.activities.length > 0 && (() => {
          const sorted = [...detail.activities].sort(
            (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)
          );
type BreakEntry = { start: ActivityRecord; end: ActivityRecord | null };
type ActGroup =
            | { type: 'LOADING_GROUP';   groupNum: number; act: ActivityRecord; breaks: BreakEntry[] }
            | { type: 'UNLOADING_GROUP'; groupNum: number; act: ActivityRecord; breaks: BreakEntry[] }
            | { type: 'BREAK';           start: ActivityRecord; end: ActivityRecord | null }
            | { type: 'SINGLE';          act: ActivityRecord };
          const groups: ActGroup[] = [];
          const used = new Set<string>();
          let lgNum = 0, ugNum = 0;
          // ✅ 積込/荷降レコードへの参照（休憩をどのグループにネストするか判定するため）
          const loadUnloadRefs: { act: ActivityRecord; breaks: BreakEntry[] }[] = [];
          for (let i = 0; i < sorted.length; i++) {
            const a = sorted[i]!;
            if (used.has(a.id)) continue;
            const at = a.activityType;
            if (at === 'LOADING') {
              lgNum++;
              const breaksArr: BreakEntry[] = [];
              groups.push({ type: 'LOADING_GROUP', groupNum: lgNum, act: a, breaks: breaksArr });
              loadUnloadRefs.push({ act: a, breaks: breaksArr });
            } else if (at === 'UNLOADING') {
              ugNum++;
              const breaksArr: BreakEntry[] = [];
              groups.push({ type: 'UNLOADING_GROUP', groupNum: ugNum, act: a, breaks: breaksArr });
              loadUnloadRefs.push({ act: a, breaks: breaksArr });
            } else if (['BREAK_START','BREAK'].includes(at)) {
              const _endAct = sorted.slice(i+1).find(b => !used.has(b.id) && b.activityType === 'BREAK_END');
              const endAct: ActivityRecord | null = _endAct ?? null;
              if (endAct) used.add(endAct.id);
              // ✅ 休憩開始時点で「進行中（未完了）だった」積込/荷降があれば、そのグループへネストする
              const breakStartMs = a.startTime ? new Date(a.startTime).getTime() : null;
              const host = breakStartMs != null
                ? loadUnloadRefs.find(({ act: hAct }) => {
                    const hStart = hAct.startTime ? new Date(hAct.startTime).getTime() : null;
                    const hEnd = hAct.endTime ? new Date(hAct.endTime).getTime() : null;
                    if (hStart == null || hStart > breakStartMs) return false;
                    return hEnd == null || hEnd >= breakStartMs;
                  })
                : undefined;
              if (host) {
                host.breaks.push({ start: a, end: endAct });
              } else {
                groups.push({ type: 'BREAK', start: a, end: endAct });
              }
            } else if (at === 'BREAK_END') {
            } else {
              groups.push({ type: 'SINGLE', act: a });
            }
          }
          const fmtTs = (a: ActivityRecord | null, b?: ActivityRecord | null) => {
            const s = a?.startTime ? new Date(a.startTime).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}) : '--:--';
            const e = b?.startTime ? new Date(b.startTime).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false})
              : (a?.endTime ? new Date(a.endTime).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}) : null);
            return e && e !== s ? `${s} ～ ${e}` : s;
          };
          // ✅ 挿入位置より前の「直前イベントの終了時刻」と「直近の積込イベントの客先」を取得
          const getInsertDefaults = (afterSeq: number) => {
            let prevEndTime: string | null = null;
            let lastLoadingCustomerId: string | undefined;
            let lastLoadingCustomerName: string | undefined;
            for (const a of sorted) {
              if ((a.sequenceNumber ?? 0) > afterSeq) break;
              const endOrStart = a.endTime || a.startTime;
              if (endOrStart) prevEndTime = endOrStart;
              if (a.activityType === 'LOADING') {
                lastLoadingCustomerId = a.customerId;
                lastLoadingCustomerName = a.customerName ?? undefined;
              }
            }
            return { afterSeq, prevEndTime, lastLoadingCustomerId, lastLoadingCustomerName };
          };
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">運行内容</h2>
                <button
                  type="button"
                  onClick={() => { setInsertMode(v => !v); setPickerContext(null); }}
                  className={`text-xs font-medium px-3 py-1 rounded-full border ${insertMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-300'}`}
                >
                  {insertMode ? '追加をやめる' : '＋ イベント追加'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mb-3">タップして編集できます（運行中の画面と同じ操作です）</p>
              <div className="space-y-3">
                {insertMode && (
                  <div onClick={() => setPickerContext(getInsertDefaults(0))} className="flex justify-center py-1 cursor-pointer">
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '2px dashed #60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: 15, fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      ＋
                    </div>
                  </div>
                )}
                {groups.map((g, gi) => {
                  const maxSeqOfGroup = (): number => {
                    if (g.type === 'BREAK') {
                      return g.end ? (g.end.sequenceNumber ?? g.start.sequenceNumber ?? 0) : (g.start.sequenceNumber ?? 0);
                    }
                    return (g.act.sequenceNumber ?? 0);
                  };
                  const groupNode = (() => {
                  if (g.type === 'LOADING_GROUP' || g.type === 'UNLOADING_GROUP') {
                    const isL = g.type === 'LOADING_GROUP';
                    const bdr = isL ? TC.LOADING_BORDER : TC.UNLOADING_BORDER;
                    const hBg = isL ? TC.LOADING_BG : TC.UNLOADING_BG;
                    const hFg = isL ? TC.LOADING_FG : TC.UNLOADING_FG;
                    const lbl = isL ? '積込' : '荷降';
                    const act = g.act;
                    const loc = act.locationName || '';
                    const hasCompleted = !!act.endTime;
                    const itemsLbl = (act.itemNames && act.itemNames.length > 0) ? act.itemNames.join('、') : act.itemName;
                    return (
                      <div key={gi} style={{ border: `2px solid ${bdr}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ background: hBg, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: hFg }}>
                            🚛 {lbl}{g.groupNum > 1 ? `（${g.groupNum}回目）` : ''}
                          </span>
                          {loc && <span style={{ fontSize: 11, color: '#6b7280' }}>─ {loc}</span>}
                          {act.customerName && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: hFg }}>
                              🏢 {act.customerName}
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: hFg, fontWeight: 600 }}>{fmtTs(act, null)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingActivity(act)}
                          style={{ width: '100%', padding: '5px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <span style={{ fontSize: 12, color: '#374151' }}>● 到着</span>
                          <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {formatTime(act.startTime)}
                            <span style={{ fontSize: 11, color: '#d1d5db' }}>✏️</span>
                          </span>
                        </button>
                        {/* ✅ 積込/荷降作業中に取得した休憩をグループ内にネスト表示 */}
                        {g.breaks.map((b, bi) => (
                          <button
                            key={`brk-${bi}`}
                            type="button"
                            onClick={() => setEditingActivity({ ...b.start, endTime: b.end ? b.end.startTime : b.start.endTime, pairId: b.end ? b.end.id : undefined } as any)}
                            style={{ width: '100%', padding: '5px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6, background: TC.BREAK_BG, border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TC.BREAK_BORDER, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: TC.BREAK_FG }}>▶休憩</span>
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: TC.BREAK_FG, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {formatTime(b.start.startTime)}{(b.end ? b.end.startTime : b.start.endTime) ? ` ～ ${formatTime(b.end ? b.end.startTime : b.start.endTime)}` : ''}
                              <span style={{ fontSize: 11, color: '#d1d5db' }}>✏️</span>
                            </span>
                          </button>
                        ))}
                        {hasCompleted && (
                          <button
                            type="button"
                            onClick={() => setEditingActivity(act)}
                            style={{ width: '100%', padding: '5px 12px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 12, color: '#374151' }}>● {lbl}完了</span>
                              <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {formatTime(act.endTime)}
                                <span style={{ fontSize: 11, color: '#d1d5db' }}>✏️</span>
                              </span>
                            </div>
                            {itemsLbl && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2, textAlign: 'left' }}>品目: {itemsLbl} × {act.quantity}{act.unit}</div>}
                          </button>
                        )}
                      </div>
                    );
                  }
                  if (g.type === 'BREAK') {
                    return (
                      <button
                        key={gi}
                        type="button"
                        onClick={() => setEditingActivity({ ...g.start, endTime: g.end ? g.end.startTime : g.start.endTime, pairId: g.end ? g.end.id : undefined } as any)}
                        style={{ border: `2px solid ${TC.BREAK_BORDER}`, borderRadius: 10, overflow: 'hidden', width: '100%', background: '#fff', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                      >
                        <div style={{ background: TC.BREAK_BG, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: TC.BREAK_FG }}>☕ 休憩</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: TC.BREAK_FG, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {fmtTs(g.start, g.end)}
                            <span style={{ fontSize: 11, color: TC.BREAK_FG, opacity: 0.6 }}>✏️</span>
                          </span>
                        </div>
                        {g.start.locationName && <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280' }}>📍 {g.start.locationName}</div>}
                      </button>
                    );
                  }
                  const act = g.act;
                  const info = getActivityInfo(act.activityType);
                  const isF = ['FUELING','FUEL'].includes(act.activityType);
                  const singleItemsLabel = (act.itemNames && act.itemNames.length > 0) ? act.itemNames.join('、') : act.itemName;
                  return (
                    <button
                      key={gi}
                      type="button"
                      onClick={() => setEditingActivity(act)}
                      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: `1.5px solid ${isF ? TC.FUEL_BORDER : TC.OTHER_BORDER}`, borderRadius: 10, padding: '8px 12px', background: isF ? TC.FUEL_BG : TC.OTHER_BG }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: isF ? TC.FUEL_FG : TC.OTHER_FG }}>{info.icon} {info.label}</span>
                        <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {fmtTs(act, null)}
                          <span style={{ fontSize: 11, color: '#d1d5db' }}>✏️</span>
                        </span>
                      </div>
                      {act.locationName && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>📍 {act.locationName}</div>}
                      {singleItemsLabel && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>品目: {singleItemsLabel} × {act.quantity}{act.unit}</div>}
                      {act.notes && !['積込完了','荷降完了','運行開始'].includes(act.notes) && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{act.notes}</div>
                      )}
                    </button>
                  );
                  })();
                  return (
                    <React.Fragment key={gi}>
                      {groupNode}
                      {insertMode && (
                        <div onClick={() => setPickerContext(getInsertDefaults(maxSeqOfGroup()))} className="flex justify-center py-1 cursor-pointer">
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '2px dashed #60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: 15, fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            ＋
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {/* 旧アクティビティ描画削除済み */}
        {false && (
          <div>
            {(() => {
                  return null;
              })()}
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
                        {formatTime(fuel.recordedAt ?? '')}
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

      {pickerContext !== null && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setPickerContext(null)}
        >
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', padding: '14px 16px 20px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10, textAlign: 'center' }}>追加するイベントの種類を選択</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { type: 'LOADING', label: '📦 積込', color: '#1565C0', bg: '#E3F2FD' },
                { type: 'UNLOADING', label: '🚚 荷降', color: '#2E7D32', bg: '#E8F5E9' },
                { type: 'BREAK_START', label: '☕ 休憩・待機', color: '#6A1B9A', bg: '#F3E5F5' },
                { type: 'FUELING', label: '⛽ 給油', color: '#E65100', bg: '#FFF3E0' },
              ].map(t => (
                <div
                  key={t.type}
                  onClick={() => {
                    // ✅ 開始・終了時刻は直前イベントの終了時刻をデフォルトに、
                    // 荷降イベントは直近の積込イベントと同じ客先をデフォルトにする
                    const isUnloadingType = t.type === 'UNLOADING';
                    setCreatingActivity({
                      draft: createDraftActivity(t.type, {
                        startTime: pickerContext!.prevEndTime,
                        customerId: isUnloadingType ? pickerContext!.lastLoadingCustomerId : undefined,
                        customerName: isUnloadingType ? pickerContext!.lastLoadingCustomerName : undefined,
                      }),
                      afterSeq: pickerContext!.afterSeq,
                    });
                    setPickerContext(null);
                    setInsertMode(false);
                  }}
                  style={{ padding: '14px 8px', textAlign: 'center', borderRadius: 10, background: t.bg, border: `1.5px solid ${t.color}`, color: t.color, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {t.label}
                </div>
              ))}
            </div>
            <div onClick={() => setPickerContext(null)} style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: '#9ca3af', padding: 8, cursor: 'pointer' }}>
              キャンセル
            </div>
          </div>
        </div>
      )}

      {creatingActivity && (
        <ActivityEditSheet
          activity={creatingActivity.draft}
          operationId={id || ''}
          createMode={{ insertAfterSequenceNumber: creatingActivity.afterSeq, vehicleId: detail.vehicle?.id }}
          onClose={() => setCreatingActivity(null)}
          onSaved={() => {
            setCreatingActivity(null);
            fetchDetail();
          }}
          customers={detailCustomers}
          items={detailItems}
        />
      )}

      {/* ✅ 運行中の画面（OperationRecord）と全く同じ編集シート。積込・荷降・休憩・給油すべて共通コンポーネントで編集可能 */}
      {editingActivity && (
        <ActivityEditSheet
          activity={{ ...editingActivity, customerName: editingActivity.customerName ?? undefined }}
          operationId={id || ''}
          onClose={() => setEditingActivity(null)}
          onDeleted={() => {
            setEditingActivity(null);
            fetchDetail();
          }}
          onSaved={() => {
            // ✅ 客先変更の積込〜荷降ペアへのカスケード等、サーバー側の最新状態を必ず取り直す
            setEditingActivity(null);
            fetchDetail();
          }}
          customers={detailCustomers}
          items={detailItems}
        />
      )}
    </div>
  );
};

export default OperationHistoryDetail;