import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Search, FileText, CheckCircle, XCircle, AlertCircle, 
  ChevronDown, ChevronUp, MapPin, Clock, Fuel, Coffee,
  Truck, Navigation, Package
} from 'lucide-react';
import { debugAPI } from '../utils/api';
import { apiClient } from '../utils/api';  // ✅ 追加

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

// ✅ 運行工程の型定義（既存のOperationDetailDialogから）
interface OperationActivity {
  id: string;
  operationId: string;
  sequenceNumber: number;
  activityType: string;
  locationId: string | null;
  itemId: string | null;
  plannedTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  quantityTons: number;
  notes: string | null;
  locations?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  items?: {
    id: string;
    name: string;
    unit: string;
  };
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
  const [operationActivities, setOperationActivities] = useState<OperationActivity[]>([]);  // ✅ 追加
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

  /**
   * 最近の運行一覧取得
   */
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
   * ✅ 運行工程（Activities）を取得
   */
  const fetchOperationActivities = async (opId: string) => {
    try {
      console.log('[OperationDebug] Fetching operation activities:', opId);
      
      const response = await apiClient.get('/operation-details', {
        params: {
          operationId: opId,
          page: 1,
          limit: 100
        }
      });
      
      console.log('[OperationDebug] Activities response:', response);
      
      if (response.success && response.data) {
        let activitiesData: OperationActivity[] = [];
        const data: any = response.data;
        
        if (data.data?.data && Array.isArray(data.data.data)) {
          activitiesData = data.data.data;
        } else if (data.data && Array.isArray(data.data)) {
          activitiesData = data.data;
        } else if (Array.isArray(data)) {
          activitiesData = data;
        }
        
        // シーケンス番号でソート
        activitiesData.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        
        setOperationActivities(activitiesData);
        console.log('[OperationDebug] Activities loaded:', activitiesData.length);
      }
    } catch (err) {
      console.error('[OperationDebug] Error fetching activities:', err);
      // エラーは致命的ではないので、空配列のまま継続
    }
  };

  /**
   * 運行履歴詳細取得
   */
  const fetchOperationDebugInfo = async (opId: string) => {
    if (!opId.trim()) {
      toast.error('運行IDを入力してください');
      return;
    }

    try {
      setIsLoading(true);
      setInspectionItems([]);
      setOperationDetails(null);
      setOperationActivities([]);  // ✅ リセット

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
        
        // ✅ 運行工程を取得
        await fetchOperationActivities(opId);
        
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

  // =====================================
  // イベントハンドラ
  // =====================================

  const handleSearch = () => {
    fetchOperationDebugInfo(operationId);
  };

  const handleSelectOperation = (opId: string) => {
    setOperationId(opId);
    fetchOperationDebugInfo(opId);
  };

  // =====================================
  // useEffect
  // =====================================

  useEffect(() => {
    fetchRecentOperations();
  }, []);

  // =====================================
  // レンダリング用ヘルパー（既存のOperationDetailDialogから）
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

  const getInspectionTypeBadge = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string }> = {
      PRE_OPERATION: { color: 'bg-blue-100 text-blue-800', text: '運行前点検' },
      POST_OPERATION: { color: 'bg-purple-100 text-purple-800', text: '運行後点検' },
      PRE_TRIP: { color: 'bg-blue-100 text-blue-800', text: '運行前点検' },
      POST_TRIP: { color: 'bg-purple-100 text-purple-800', text: '運行後点検' },
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
   * ✅ 運行工程タイプの情報取得（既存のOperationDetailDialogから）
   */
  const getActivityTypeInfo = (activityType: string) => {
    const typeConfig: Record<string, { label: string; icon: string; className: string }> = {
      LOADING: { label: '積込開始', icon: '📦', className: 'bg-blue-100 text-blue-800' },
      UNLOADING: { label: '積込予定・配送', icon: '🚚', className: 'bg-green-100 text-green-800' },
      TRANSPORTING: { label: '運搬中', icon: '🚛', className: 'bg-purple-100 text-purple-800' },
      REFUELING: { label: '給油', icon: '⛽', className: 'bg-orange-100 text-orange-800' },
      BREAK: { label: '休憩', icon: '☕', className: 'bg-yellow-100 text-yellow-800' },
      BREAK_START: { label: '休憩開始', icon: '🟢', className: 'bg-yellow-100 text-yellow-800' },
      BREAK_END: { label: '休憩終了', icon: '🔴', className: 'bg-gray-100 text-gray-800' },
      WAITING: { label: '待機', icon: '⏰', className: 'bg-gray-100 text-gray-800' },
      MAINTENANCE: { label: 'メンテナンス', icon: '🔧', className: 'bg-red-100 text-red-800' },
    };

    return typeConfig[activityType] || { label: activityType, icon: '📍', className: 'bg-gray-100 text-gray-800' };
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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

      {/* ✅ 運行工程タイムライン（既存のOperationDetailDialogから移植） */}
      {operationActivities.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">運行タイムライン</h2>
              <span className="text-sm text-gray-500">({operationActivities.length}件)</span>
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
              {operationActivities.map((activity) => {
                const typeInfo = getActivityTypeInfo(activity.activityType);
                return (
                  <div
                    key={activity.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      {/* シーケンス番号 */}
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">
                          {activity.sequenceNumber}
                        </span>
                      </div>

                      {/* 詳細情報 */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${typeInfo.className}`}>
                            {typeInfo.icon} {typeInfo.label}
                          </span>
                          {activity.actualStartTime && (
                            <span className="text-sm text-gray-500">
                              {new Date(activity.actualStartTime).toLocaleTimeString('ja-JP', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {/* 場所情報 */}
                          {activity.locations && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">{activity.locations.name}</p>
                                <p className="text-gray-500 text-xs">{activity.locations.address}</p>
                              </div>
                            </div>
                          )}

                          {/* 品目情報 */}
                          {activity.items && (
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div>
                                <p className="font-medium">品目: {activity.items.name}</p>
                                {activity.quantityTons > 0 && (
                                  <p className="text-gray-500 text-xs">{activity.quantityTons} {activity.items.unit}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 備考 */}
                          {activity.notes && (
                            <div className="col-span-2 text-gray-600">
                              {activity.notes}
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
                  {JSON.stringify({ operation: operationDetails, activities: operationActivities, inspections: inspectionItems }, null, 2)}
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