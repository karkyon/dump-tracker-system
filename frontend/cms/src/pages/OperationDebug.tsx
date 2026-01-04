import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Search, FileText, CheckCircle, XCircle, AlertCircle, 
  ChevronDown, ChevronUp, MapPin, Clock, Fuel, Coffee,
  Truck, Navigation, Package, Play, Square, ClipboardCheck
} from 'lucide-react';
import { debugAPI } from '../utils/api';
import { apiClient } from '../utils/api';

// ===================================
// 型定義
// ===================================

interface OperationListItem {
  id: string;
  operationNumber: string;
  startTime: string;
  endTime: string | null;
  status: string;
  vehiclePlateNumber: string | null;
  driverName: string | null;
}

interface InspectionItemDetail {
  inspectionRecordId: string;
  inspectionType: string;
  inspectionStatus: string;
  inspectionStartedAt: string | null;
  inspectionCompletedAt: string | null;
  inspectionItemId: string;
  inspectionItemName: string;
  inspectionItemDescription: string | null;
  inspectionItemCategory: string | null;
  resultValue: string | null;
  isPassed: boolean | null;
  notes: string | null;
  defectLevel: string | null;
  photoUrls: string[];
  checkedAt: string;
  operationId: string | null;
  vehicleId: string;
  vehiclePlateNumber: string | null;
  inspectorId: string;
  inspectorName: string | null;
}

interface OperationDetail {
  id: string;
  operationNumber: string;
  vehicleId: string;
  driverId: string;
  status: string;
  plannedStartTime: string | null;
  actualStartTime: string | null;
  plannedEndTime: string | null;
  actualEndTime: string | null;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  totalDistanceKm: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    plateNumber: string;
    manufacturer: string;
    model: string;
  };
  driver?: {
    name: string;
    employeeId: string;
  };
}

// ✅ 統合タイムラインイベント型（バックエンドと一致）
interface TimelineEvent {
  id: string;
  sequenceNumber: number;
  eventType: 'TRIP_START' | 'TRIP_END' | 'PRE_INSPECTION' | 'POST_INSPECTION' | 
             'LOADING' | 'UNLOADING' | 'TRANSPORTING' | 'WAITING' | 
             'MAINTENANCE' | 'REFUELING' | 'FUELING' | 
             'BREAK' | 'BREAK_START' | 'BREAK_END' | 'OTHER';
  timestamp: string | null;
  location?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    recordedAt: string;
  } | null;
  notes?: string | null;
  quantityTons?: number;
  items?: {
    id: string;
    name: string;
    unit: string;
  } | null;
  inspectionDetails?: {
    inspectionRecordId: string;
    status: string;
    totalItems: number;
    passedItems: number;
    failedItems: number;
  } | null;
}

// ===================================
// メインコンポーネント
// ===================================

const OperationDebug: React.FC = () => {
  // ステート管理
  const [operationId, setOperationId] = useState<string>('');
  const [recentOperations, setRecentOperations] = useState<OperationListItem[]>([]);
  const [inspectionItems, setInspectionItems] = useState<InspectionItemDetail[]>([]);
  const [operationDetails, setOperationDetails] = useState<OperationDetail | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  
  // 折りたたみステート
  const [showRecentOperations, setShowRecentOperations] = useState(true);
  const [showInspectionItems, setShowInspectionItems] = useState(true);
  const [showOperationTimeline, setShowOperationTimeline] = useState(true);
  const [showRawData, setShowRawData] = useState(false);

  // =====================================
  // API呼び出し
  // =====================================

  const fetchRecentOperations = async () => {
    try {
      setIsLoadingRecent(true);
      
      const response = await debugAPI.getRecentOperations({ limit: 20 });

      if (response.success && response.data) {
        let operationsData: OperationListItem[] = [];
        
        if (Array.isArray(response.data)) {
          operationsData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          operationsData = response.data.data;
        } else if (response.data.operations && Array.isArray(response.data.operations)) {
          operationsData = response.data.operations;
        }

        setRecentOperations(operationsData);
        
        if (operationsData.length === 0) {
          toast('運行データが見つかりませんでした', { icon: 'ℹ️' });
        }
      } else {
        throw new Error(response.message || '運行一覧の取得に失敗しました');
      }
    } catch (error) {
      console.error('❌ 運行一覧取得エラー:', error);
      toast.error(error instanceof Error ? error.message : '運行一覧の取得に失敗しました');
    } finally {
      setIsLoadingRecent(false);
    }
  };

  /**
   * ✅ 統合タイムライン取得（バックエンドの拡張APIを使用）
   * ✅ 修正: 3層ネスト対応（response.data.data.data）
   */
  const fetchIntegratedTimeline = async (opId: string) => {
    try {
      console.log('[OperationDebug] Fetching integrated timeline:', opId);
      
      const response = await apiClient.get('/operation-details', {
        params: {
          operationId: opId,
          page: 1,
          limit: 100
        }
      });
      
      console.log('[OperationDebug] Timeline response:', response);
      
      if (response.success && response.data) {
        let eventsData: TimelineEvent[] = [];
        let operationData: OperationDetail | null = null;
        
        // ✅ 修正: 3層ネスト対応（response.data.data.data）
        const outerData: any = response.data;
        const innerData: any = outerData.data || outerData;
        
        // イベントデータ抽出（複数パターン対応）
        if (innerData.data && Array.isArray(innerData.data)) {
          // パターン1: response.data.data.data (最も深いネスト)
          eventsData = innerData.data;
          console.log('[OperationDebug] ✅ Pattern 1: innerData.data (3-level nesting)');
        } else if (Array.isArray(innerData)) {
          // パターン2: response.data.data が配列
          eventsData = innerData;
          console.log('[OperationDebug] ✅ Pattern 2: innerData is array');
        } else if (outerData.data && Array.isArray(outerData.data)) {
          // パターン3: response.data.data (2-level nesting)
          eventsData = outerData.data;
          console.log('[OperationDebug] ✅ Pattern 3: outerData.data');
        } else if (Array.isArray(outerData)) {
          // パターン4: response.data が配列
          eventsData = outerData;
          console.log('[OperationDebug] ✅ Pattern 4: outerData is array');
        }
        
        // 運行情報抽出（複数パターン対応）
        if (innerData.operation) {
          operationData = innerData.operation;
        } else if (outerData.operation) {
          operationData = outerData.operation;
        }
        
        console.log('[OperationDebug] 📊 Extracted data:', {
          eventsCount: eventsData.length,
          eventTypes: eventsData.length > 0 ? Array.from(new Set(eventsData.map(e => e.eventType))) : [],
          hasOperation: !!operationData
        });
        
        setTimelineEvents(eventsData);
        if (operationData) {
          setOperationDetails(operationData);
        }
        
        console.log('[OperationDebug] Timeline loaded:', {
          eventsCount: eventsData.length,
          eventTypes: eventsData.length > 0 ? Array.from(new Set(eventsData.map(e => e.eventType))) : []
        });
      }
    } catch (err) {
      console.error('[OperationDebug] Error fetching timeline:', err);
    }
  };

  const fetchOperationDebugInfo = async (opId: string) => {
    if (!opId.trim()) {
      toast.error('運行IDを入力してください');
      return;
    }

    try {
      setIsLoading(true);
      setInspectionItems([]);
      setOperationDetails(null);
      setTimelineEvents([]);

      console.log('[OperationDebug] Fetching debug info for:', opId);

      const response = await debugAPI.getOperationDebugInfo(opId);

      console.log('[OperationDebug] Debug info response:', response);

      if (response.success && response.data) {
        const debugData = response.data.data || response.data;
        
        const items = debugData.inspectionItems || [];
        const details = debugData.operationDetail;
        
        setInspectionItems(items);
        
        if (Array.isArray(details) && details.length > 0) {
          setOperationDetails(details[0]);
        } else if (details && typeof details === 'object') {
          setOperationDetails(details);
        }
        
        // ✅ 統合タイムライン取得
        await fetchIntegratedTimeline(opId);
        
        toast.success(`デバッグ情報を取得しました（点検項目: ${items.length}件）`);
      } else {
        throw new Error(response.message || 'デバッグ情報の取得に失敗しました');
      }
    } catch (error) {
      console.error('❌ デバッグ情報取得エラー:', error);
      toast.error(error instanceof Error ? error.message : 'デバッグ情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchOperationDebugInfo(operationId);
  };

  const handleSelectOperation = (opId: string) => {
    setOperationId(opId);
    fetchOperationDebugInfo(opId);
  };

  useEffect(() => {
    fetchRecentOperations();
  }, []);

  // =====================================
  // レンダリング用ヘルパー
  // ===================================== 

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      PLANNED: { color: 'bg-gray-100 text-gray-800', text: '計画中' },
      IN_PROGRESS: { color: 'bg-blue-100 text-blue-800', text: '運行中' },
      COMPLETED: { color: 'bg-green-100 text-green-800', text: '完了' },
      CANCELLED: { color: 'bg-red-100 text-red-800', text: 'キャンセル' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', text: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const getPassedIcon = (isPassed: boolean | null) => {
    if (isPassed === null || isPassed === undefined) {
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
    return isPassed ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  /**
   * ✅ 点検種別バッジ（運行前=青、運行後=緑）
   */
  const getInspectionTypeBadge = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string }> = {
      PRE_OPERATION: { color: 'bg-blue-100 text-blue-800', text: '運行前点検' },
      POST_OPERATION: { color: 'bg-emerald-100 text-emerald-800', text: '運行後点検' },
      PRE_TRIP: { color: 'bg-blue-100 text-blue-800', text: '運行前点検' },
      POST_TRIP: { color: 'bg-emerald-100 text-emerald-800', text: '運行後点検' },
      PERIODIC: { color: 'bg-yellow-100 text-yellow-800', text: '定期点検' },
    };

    const config = typeConfig[type] || { color: 'bg-gray-100 text-gray-800', text: type };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  /**
   * ✅ イベントタイプの情報取得（全タイプ対応）
   */
  const getEventTypeInfo = (eventType: string) => {
    const typeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      TRIP_START: { label: '運行開始', icon: <Play className="w-5 h-5" />, className: 'bg-green-100 text-green-800' },
      TRIP_END: { label: '運行終了', icon: <Square className="w-5 h-5" />, className: 'bg-red-100 text-red-800' },
      PRE_INSPECTION: { label: '運行前点検', icon: <ClipboardCheck className="w-5 h-5" />, className: 'bg-blue-100 text-blue-800' },
      POST_INSPECTION: { label: '運行後点検', icon: <ClipboardCheck className="w-5 h-5" />, className: 'bg-emerald-100 text-emerald-800' },
      LOADING: { label: '積込', icon: <Truck className="w-5 h-5" />, className: 'bg-indigo-100 text-indigo-800' },
      UNLOADING: { label: '積降', icon: <Truck className="w-5 h-5" />, className: 'bg-purple-100 text-purple-800' },
      TRANSPORTING: { label: '運搬中', icon: <Navigation className="w-5 h-5" />, className: 'bg-cyan-100 text-cyan-800' },
      REFUELING: { label: '給油', icon: <Fuel className="w-5 h-5" />, className: 'bg-orange-100 text-orange-800' },
      FUELING: { label: '給油', icon: <Fuel className="w-5 h-5" />, className: 'bg-orange-100 text-orange-800' },
      BREAK: { label: '休憩', icon: <Coffee className="w-5 h-5" />, className: 'bg-yellow-100 text-yellow-800' },
      BREAK_START: { label: '休憩開始', icon: <Coffee className="w-5 h-5" />, className: 'bg-yellow-100 text-yellow-800' },
      BREAK_END: { label: '休憩終了', icon: <Coffee className="w-5 h-5" />, className: 'bg-amber-100 text-amber-800' },
      WAITING: { label: '待機', icon: <Clock className="w-5 h-5" />, className: 'bg-gray-100 text-gray-800' },
      MAINTENANCE: { label: 'メンテナンス', icon: <AlertCircle className="w-5 h-5" />, className: 'bg-red-100 text-red-800' },
      OTHER: { label: 'その他', icon: <MapPin className="w-5 h-5" />, className: 'bg-gray-100 text-gray-800' },
    };

    return typeConfig[eventType] || { label: eventType, icon: <MapPin className="w-5 h-5" />, className: 'bg-gray-100 text-gray-800' };
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatGps = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // =====================================
  // レンダリング
  // =====================================

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-4">
          <FileText className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">運行・点検デバッグ</h1>
        </div>
        <p className="text-gray-600">
          運行IDを指定して詳細なデバッグ情報を確認できます（管理者専用）
        </p>
      </div>

      {/* 検索フォーム */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label htmlFor="operationId" className="block text-sm font-medium text-gray-700 mb-2">
              運行ID (UUID) を入力してください
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="operationId"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="例: 3eca5da4-89f6-4919-8ee2-491190745ec4"
                value={operationId}
                onChange={(e) => setOperationId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading || !operationId.trim()}
            className="mt-7 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '検索中...' : '検索'}
          </button>
        </div>
      </div>

      {/* 最近の運行一覧 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900">最近の運行一覧</h2>
            <span className="text-sm text-gray-500">({recentOperations.length}件)</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchRecentOperations}
              disabled={isLoadingRecent}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {isLoadingRecent ? '読み込み中...' : '更新'}
            </button>
            <button
              onClick={() => setShowRecentOperations(!showRecentOperations)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              {showRecentOperations ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {showRecentOperations && (
          <>
            {isLoadingRecent ? (
              <div className="text-center py-8 text-gray-500">読み込み中...</div>
            ) : recentOperations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">運行データがありません</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">運行番号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">車両</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">運転手</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">開始時刻</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentOperations.map((op) => (
                      <tr key={op.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{op.operationNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getStatusBadge(op.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{op.vehiclePlateNumber || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{op.driverName || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatTime(op.startTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleSelectOperation(op.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            詳細を表示
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* 点検項目詳細 */}
      {inspectionItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-gray-900">点検項目詳細</h2>
              <span className="text-sm text-gray-500">({inspectionItems.length}件)</span>
            </div>
            <button
              onClick={() => setShowInspectionItems(!showInspectionItems)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              {showInspectionItems ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>

          {showInspectionItems && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検種別</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検項目名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">結果</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">判定</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">不具合レベル</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">備考</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検日時</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inspectionItems.map((item, idx) => (
                    <tr key={`${item.inspectionRecordId}-${item.inspectionItemId}-${idx}`}>
                      <td className="px-4 py-3 text-sm">{getInspectionTypeBadge(item.inspectionType)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.inspectionItemName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.inspectionItemCategory || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.resultValue || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center space-x-2">
                          {getPassedIcon(item.isPassed)}
                          <span>{item.isPassed === null ? '未実施' : item.isPassed ? '合格' : '不合格'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.defectLevel || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.notes || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatTime(item.checkedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ✅ 統合運行タイムライン */}
      {timelineEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">運行タイムライン（統合版）</h2>
              <span className="text-sm text-gray-500">({timelineEvents.length}件)</span>
            </div>
            <button
              onClick={() => setShowOperationTimeline(!showOperationTimeline)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              {showOperationTimeline ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>

          {showOperationTimeline && (
            <div className="space-y-3">
              {timelineEvents.map((event) => {
                const typeInfo = getEventTypeInfo(event.eventType);
                return (
                  <div
                    key={event.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      {/* シーケンス番号 */}
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">
                          {event.sequenceNumber}
                        </span>
                      </div>

                      {/* 詳細情報 */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-3 py-1 text-sm font-semibold rounded-lg inline-flex items-center gap-2 ${typeInfo.className}`}>
                            {typeInfo.icon}
                            {typeInfo.label}
                          </span>
                          {event.timestamp && (
                            <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {formatTime(event.timestamp)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-sm">
                          {/* 場所情報 */}
                          {event.location && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-900">{event.location.name}</p>
                                <p className="text-gray-500 text-xs">{event.location.address}</p>
                                <p className="text-gray-400 text-xs">
                                  GPS: {formatGps(event.location.latitude, event.location.longitude)}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* GPS位置情報（場所IDがない場合） */}
                          {!event.location && event.gpsLocation && (
                            <div className="flex items-start gap-2">
                              <Navigation className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-gray-700 font-medium">
                                  GPS座標: {formatGps(event.gpsLocation.latitude, event.gpsLocation.longitude)}
                                </p>
                                <p className="text-gray-400 text-xs">
                                  記録時刻: {formatTime(event.gpsLocation.recordedAt)}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 品目情報 */}
                          {event.items && (
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-900">品目: {event.items.name}</p>
                                {event.quantityTons !== undefined && event.quantityTons > 0 && (
                                  <p className="text-gray-500 text-xs">{event.quantityTons} {event.items.unit}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 点検詳細 */}
                          {event.inspectionDetails && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-600">点検項目:</span>
                                  <span className="ml-1 font-semibold">{event.inspectionDetails.totalItems}件</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">合格:</span>
                                  <span className="ml-1 font-semibold text-green-600">{event.inspectionDetails.passedItems}件</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">不合格:</span>
                                  <span className="ml-1 font-semibold text-red-600">{event.inspectionDetails.failedItems}件</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 備考 */}
                          {event.notes && (
                            <div className="text-gray-600 italic">
                              {event.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 運行詳細情報 */}
      {operationDetails && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">運行詳細情報</h2>

          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
            <div>
              <p className="text-sm text-gray-600">運行番号</p>
              <p className="font-semibold">{operationDetails.operationNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">ステータス</p>
              <p>{getStatusBadge(operationDetails.status)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">車両</p>
              <p className="font-semibold">
                {operationDetails.vehicle?.plateNumber || '-'}
                {operationDetails.vehicle && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({operationDetails.vehicle.manufacturer} {operationDetails.vehicle.model})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">運転手</p>
              <p className="font-semibold">
                {operationDetails.driver?.name || '-'}
                {operationDetails.driver?.employeeId && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({operationDetails.driver.employeeId})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">走行距離</p>
              <p className="font-semibold">
                {operationDetails.totalDistanceKm ? `${operationDetails.totalDistanceKm} km` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">開始時刻</p>
              <p className="font-semibold">{formatTime(operationDetails.actualStartTime)}</p>
            </div>
          </div>

          {/* 生データ表示 */}
          <div className="border-t pt-4">
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {showRawData ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <span>生データを{showRawData ? '非表示' : '表示'}</span>
            </button>

            {showRawData && (
              <div className="mt-4 border rounded-lg p-4 bg-gray-50">
                <pre className="text-xs text-gray-700 overflow-auto max-h-96">
                  {JSON.stringify({ operation: operationDetails, timeline: timelineEvents, inspections: inspectionItems }, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 結果がない場合のメッセージ */}
      {!isLoading && inspectionItems.length === 0 && !operationDetails && operationId && (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          検索結果がありません。運行IDを確認してください。
        </div>
      )}
    </div>
  );
};

export default OperationDebug;