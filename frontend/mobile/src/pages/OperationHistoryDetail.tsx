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
import ActivityAddSheet from '../components/ActivityAddSheet';

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
  customerName?: string | null;
  locationLat?: number;
  locationLng?: number;
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
  const [addEventOpen, setAddEventOpen] = useState(false);

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

        {/* アクティビティ - グループ表示（積込/荷降1くくり + 休憩1くくり） */}
        {detail.activities.length > 0 && (() => {
          const sorted = [...detail.activities].sort(
            (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)
          );
          type ActGroup =
            | { type: 'LOADING_GROUP';   groupNum: number; arrived: ActivityRecord; completed: ActivityRecord | null }
            | { type: 'UNLOADING_GROUP'; groupNum: number; arrived: ActivityRecord; completed: ActivityRecord | null }
            | { type: 'BREAK';           start: ActivityRecord; end: ActivityRecord | null }
            | { type: 'SINGLE';          act: ActivityRecord };
          const groups: ActGroup[] = [];
          const used = new Set<string>();
          let lgNum = 0, ugNum = 0;
          for (let i = 0; i < sorted.length; i++) {
            const a = sorted[i]!; // noUncheckedIndexedAccess対応
            if (used.has(a.id)) continue;
            const at = a.activityType;
            if (['LOADING','LOADING_START'].includes(at)) {
              lgNum++;
              const _comp = sorted.slice(i+1).find(b => !used.has(b.id) && ['LOADING_COMPLETE','LOADING_COMPLETED'].includes(b.activityType));
              const comp: ActivityRecord | null = _comp ?? null;
              if (comp) used.add(comp.id);
              groups.push({ type: 'LOADING_GROUP', groupNum: lgNum, arrived: a, completed: comp });
            } else if (['UNLOADING','UNLOADING_START'].includes(at)) {
              ugNum++;
              const _comp2 = sorted.slice(i+1).find(b => !used.has(b.id) && ['UNLOADING_COMPLETE','UNLOADING_COMPLETED'].includes(b.activityType));
              const comp2: ActivityRecord | null = _comp2 ?? null;
              if (comp2) used.add(comp2.id);
              groups.push({ type: 'UNLOADING_GROUP', groupNum: ugNum, arrived: a, completed: comp2 });
            } else if (['LOADING_COMPLETE','LOADING_COMPLETED','UNLOADING_COMPLETE','UNLOADING_COMPLETED'].includes(at)) {
              groups.push({ type: 'SINGLE', act: a });
            } else if (['BREAK_START','BREAK'].includes(at)) {
              const _endAct = sorted.slice(i+1).find(b => !used.has(b.id) && b.activityType === 'BREAK_END');
              const endAct: ActivityRecord | null = _endAct ?? null;
              if (endAct) used.add(endAct.id);
              groups.push({ type: 'BREAK', start: a, end: endAct });
            } else if (at === 'BREAK_END') {
              // 孤立 BREAK_END スキップ
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
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">運行内容</h2>
              <div className="space-y-3">
                {groups.map((g, gi) => {
                  if (g.type === 'LOADING_GROUP' || g.type === 'UNLOADING_GROUP') {
                    const isL = g.type === 'LOADING_GROUP';
                    const bdr = isL ? TC.LOADING_BORDER : TC.UNLOADING_BORDER;
                    const hBg = isL ? TC.LOADING_BG : TC.UNLOADING_BG;
                    const hFg = isL ? TC.LOADING_FG : TC.UNLOADING_FG;
                    const lbl = isL ? '積込' : '荷降';
                    const loc = g.arrived.locationName || g.completed?.locationName || '';
                    return (
                      <div key={gi} style={{ border: `2px solid ${bdr}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ background: hBg, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: hFg }}>
                            🚛 {lbl}{g.groupNum > 1 ? `（${g.groupNum}回目）` : ''}
                          </span>
                          {loc && <span style={{ fontSize: 11, color: '#6b7280' }}>─ {loc}</span>}
                          {(g.arrived.customerName || g.completed?.customerName) && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: hFg }}>
                              🏢 {g.arrived.customerName || g.completed?.customerName}
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: hFg, fontWeight: 600 }}>{fmtTs(g.arrived, g.completed)}</span>
                        </div>
                        <div style={{ padding: '5px 12px', borderBottom: g.completed ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: '#374151' }}>● 到着</span>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{formatTime(g.arrived.startTime)}</span>
                        </div>
                        {g.completed && (
                          <div style={{ padding: '5px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 12, color: '#374151' }}>● {lbl}完了</span>
                              <span style={{ fontSize: 11, color: '#6b7280' }}>{formatTime(g.completed.startTime || g.completed.endTime)}</span>
                            </div>
                            {g.completed.itemName && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>品目: {g.completed.itemName} × {g.completed.quantity}{g.completed.unit}</div>}
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (g.type === 'BREAK') {
                    return (
                      <div key={gi} style={{ border: `2px solid ${TC.BREAK_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ background: TC.BREAK_BG, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: TC.BREAK_FG }}>☕ 休憩</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: TC.BREAK_FG, fontWeight: 600 }}>{fmtTs(g.start, g.end)}</span>
                        </div>
                        {g.start.locationName && <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280' }}>📍 {g.start.locationName}</div>}
                      </div>
                    );
                  }
                  const act = g.act;
                  const info = getActivityInfo(act.activityType);
                  const isF = ['FUELING','FUEL'].includes(act.activityType);
                  return (
                    <div key={gi} style={{ border: `1.5px solid ${isF ? TC.FUEL_BORDER : TC.OTHER_BORDER}`, borderRadius: 10, padding: '8px 12px', background: isF ? TC.FUEL_BG : TC.OTHER_BG }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: isF ? TC.FUEL_FG : TC.OTHER_FG }}>{info.icon} {info.label}</span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{formatTime(act.startTime)}</span>
                      </div>
                      {act.locationName && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>📍 {act.locationName}</div>}
                      {act.itemName && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>品目: {act.itemName} × {act.quantity}{act.unit}</div>}
                      {act.notes && !['積込完了','荷降完了','運行開始'].includes(act.notes) && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{act.notes}</div>
                      )}
                    </div>
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

      {/* 🆕 イベント追加 FAB（記録漏れの後追い登録用） */}
      <button
        type="button"
        onClick={() => setAddEventOpen(true)}
        style={{
          position: 'fixed', right: 20, bottom: 24, width: 56, height: 56, borderRadius: '50%',
          background: '#1565C0', color: '#fff', border: 'none', fontSize: 28, lineHeight: '56px',
          textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', cursor: 'pointer', zIndex: 500,
        }}
        aria-label="イベントを追加"
      >
        +
      </button>

      {addEventOpen && (
        <ActivityAddSheet
          operationId={id || ''}
          vehicleId={detail.vehicle?.id}
          onClose={() => setAddEventOpen(false)}
          onSaved={() => {
            setAddEventOpen(false);
            fetchDetail();
          }}
        />
      )}
    </div>
  );
};

export default OperationHistoryDetail;