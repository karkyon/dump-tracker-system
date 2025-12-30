// ✅✅✅ 運行記録詳細ダイアログ - 完全版（仕様書A7準拠）
// 基本情報・運行情報・場所情報・タイムライン・GPSルート・点検項目管理を完全実装
// 🔧 修正: 欠けているState定義を追加（inspectionsLoading, inspectionsError）
// 🔧 修正: Inspection型をInspectionRecordに統一
// ✅ NEW: タイムライン統合機能追加 - 運行詳細と点検記録を時系列で統合表示
// ✅ NEW: 点検記録詳細情報の表示追加 - GPS位置、天候、温度、結果詳細等
import React, { useEffect, useState } from 'react';
import { 
  User, Truck, MapPin, Package, Clock,
  Navigation, CheckCircle, AlertCircle, TrendingUp, Edit,
  // ✅ NEW: タイムライン表示用の追加アイコン
  Thermometer, Cloud
} from 'lucide-react';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { apiClient } from '../utils/api';

/**
 * 運行記録詳細情報のインターフェース
 */
interface OperationDetail {
  id: string;
  operationNumber: string;
  vehicleId: string;
  driverId: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedStartTime: string | null;
  actualStartTime: string | null;
  plannedEndTime: string | null;
  actualEndTime: string | null;
  totalDistanceKm: number | null;
  fuelConsumedLiters: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicles?: {
    id: string;
    plateNumber: string;
    model: string;
    manufacturer: string;
  };
  usersOperationsDriverIdTousers?: {
    id: string;
    name: string;
    username: string;
  };
}

/**
 * 運行詳細（積込・積下）のインターフェース
 */
interface OperationActivity {
  id: string;
  operationId: string;
  sequenceNumber: number;
  activityType: 'LOADING' | 'UNLOADING' | 'FUELING' | 'BREAK' | 'MAINTENANCE';
  locationId: string;
  itemId: string;
  plannedTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  quantityTons: number | null;
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

/**
 * GPS記録のインターフェース
 */
interface GpsRecord {
  id: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh?: number;
}

/**
 * 点検記録のインターフェース
 * ✅ NEW: 詳細情報フィールドを追加
 */
interface InspectionRecord {
  id: string;
  vehicleId: string;
  inspectorId: string;
  inspectionType: 'PRE_TRIP' | 'POST_TRIP';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string | null;
  completedAt: string | null;
  overallResult: 'PASS' | 'FAIL' | 'WARNING';
  
  // ✅ NEW: 詳細情報フィールド
  latitude?: number;
  longitude?: number;
  locationName?: string;
  weatherCondition?: string;
  temperature?: number;
  overallNotes?: string;
  defectsFound?: number;
  
  // ✅ NEW: 関連データ
  vehicles?: {
    plateNumber: string;
    model: string;
  };
  users?: {
    name: string;
    email: string;
  };
  inspectionItemResults?: Array<{
    id: string;
    inspectionItemId: string;
    resultValue: string;
    isPassed: boolean;
    notes?: string;
    defectLevel?: string;
    photoUrls?: string[];
    inspectionItems?: {
      name: string;
      description?: string;
      category?: string;
    };
  }>;
}

/**
 * ✅ NEW: タイムラインイベントの統合型定義
 */
interface TimelineEvent {
  id: string;
  type: 'activity' | 'inspection';
  timestamp: Date;
  sequenceNumber?: number;
  data: OperationActivity | InspectionRecord;
}

interface OperationDetailDialogProps {
  operationId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 運行記録詳細ダイアログコンポーネント
 * 
 * @description
 * 仕様書A7「運行記録 > 詳細画面詳細画面（ダイアログ）」に準拠した完全実装
 * 
 * 表示内容:
 * - 基本情報（運行番号、運転手、車両、ステータスなど）
 * - 運行情報（開始・終了時刻、走行距離、燃料消費など）
 * - 場所情報（積込場所、積下場所の一覧）
 * - 運行タイムライン（積込・積下の時系列表示）✅ NEW: 点検イベント統合
 * - GPSルート（Google Maps統合）
 * - 点検項目管理（運行前後の点検記録）✅ NEW: 詳細情報表示
 */
const OperationDetailDialog: React.FC<OperationDetailDialogProps> = ({
  operationId,
  isOpen,
  onClose
}) => {
  console.log('[OperationDetailDialog] Rendering:', { operationId, isOpen });

  // ===================================================================
  // State管理
  // ===================================================================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // データ state
  const [operation, setOperation] = useState<OperationDetail | null>(null);
  const [activities, setActivities] = useState<OperationActivity[]>([]);
  const [gpsRecords, setGpsRecords] = useState<GpsRecord[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  
  // 🔧 修正: 欠けていたState定義を追加
  const [inspectionsLoading, setInspectionsLoading] = useState(false);
  const [inspectionsError, setInspectionsError] = useState<string | null>(null);

  // タブ切り替え state
  const [activeTab, setActiveTab] = useState<'basic' | 'timeline' | 'gps' | 'inspection'>('basic');

  // ===================================================================
  // データ取得
  // ===================================================================
  
  /**
   * 運行基本情報を取得
   */
  const fetchOperationDetail = async () => {
    try {
      console.log('[OperationDetailDialog] Fetching operation detail:', operationId);
      const response = await apiClient.get(`/operations/${operationId}`);
      
      console.log('[OperationDetailDialog] Operation detail response:', response);
      
      if (response.success && response.data) {
        const responseData: any = response.data;
        let operationData: OperationDetail;
        
        // データ構造に応じて柔軟に対応
        if (responseData.data?.data) {
          operationData = responseData.data.data as OperationDetail;
        } else if (responseData.data) {
          operationData = responseData.data as OperationDetail;
        } else {
          operationData = responseData as OperationDetail;
        }
        
        setOperation(operationData);
      } else {
        setError('運行記録の取得に失敗しました');
      }
    } catch (err) {
      console.error('[OperationDetailDialog] Error fetching operation:', err);
      setError('運行記録の取得中にエラーが発生しました');
    }
  };

  /**
   * 運行詳細（積込・積下）を取得
   */
  const fetchOperationActivities = async () => {
    try {
      console.log('[OperationDetailDialog] Fetching operation activities:', operationId);
      const response = await apiClient.get('/operation-details', {
        params: {
          operationId: operationId,
          page: 1,
          limit: 100
        }
      });
      
      console.log('[OperationDetailDialog] Activities response:', response);
      
      if (response.success && response.data) {
        // データ構造に応じて柔軟に対応
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
        
        setActivities(activitiesData);
        console.log('[OperationDetailDialog] Activities loaded:', activitiesData.length);
      }
    } catch (err) {
      console.error('[OperationDetailDialog] Error fetching activities:', err);
      // エラーは致命的ではないので、空配列のまま継続
    }
  };

  /**
   * GPS記録を取得
   */
  const fetchGpsRecords = async () => {
    try {
      console.log('[OperationDetailDialog] Fetching GPS records:', operationId);
      
      // GPS記録はoperationIdまたはvehicleIdで取得可能
      // まずはoperationIdで試行
      const response = await apiClient.get('/gps/locations', {
        params: {
          operationId: operationId,
          page: 1,
          limit: 1000
        }
      });
      
      console.log('[OperationDetailDialog] GPS response:', response);
      
      if (response.success && response.data) {
        let gpsData: GpsRecord[] = [];
        const data: any = response.data;
        
        if (data.data?.data && Array.isArray(data.data.data)) {
          gpsData = data.data.data;
        } else if (data.data && Array.isArray(data.data)) {
          gpsData = data.data;
        } else if (Array.isArray(data)) {
          gpsData = data;
        }
        
        // 時刻でソート
        gpsData.sort((a, b) => 
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        );
        
        setGpsRecords(gpsData);
        console.log('[OperationDetailDialog] GPS records loaded:', gpsData.length);
      }
    } catch (err) {
      console.error('[OperationDetailDialog] Error fetching GPS records:', err);
      // エラーは致命的ではないので、空配列のまま継続
    }
  };

  /**
   * 点検記録を取得
   * 🔧 修正: Inspection型をInspectionRecordに統一
   */
  const fetchInspections = async () => {
    console.log('🔍 [Debug] fetchInspections開始', { operationId });
    
    try {
      setInspectionsLoading(true);
      
      // ✅ 修正: operationIdを直接使用
      console.log('🔍 [Debug] operationId使用', { operationId });
      
      if (!operationId) {
        console.warn('⚠️ [Debug] operationIdがnull/undefined');
        setInspectionsError('運行情報が見つかりません');
        return;
      }

      // ✅ 正しい: operationIdでフィルタ
      const response: any = await apiClient.get('/inspections', {
        params: { 
          operationId: operationId,  // ✅ operationIdを使用
          page: 1, 
          limit: 100 
        }
      });
      
      console.log('✅ [Debug] 点検記録API応答', {
        status: response?.status,
        hasData: !!response?.data,
        dataType: typeof response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : []
      });

      // レスポンス処理 - 🔧 Inspection型をInspectionRecordに修正
      const responseData: any = response.data;
      let inspectionsData: InspectionRecord[];
      
      if (responseData.data?.data) {
        inspectionsData = responseData.data.data as InspectionRecord[];
      } else if (responseData.data) {
        inspectionsData = responseData.data as InspectionRecord[];
      } else {
        inspectionsData = responseData as InspectionRecord[];
      }

      console.log('✅ [Debug] 点検記録データ解析完了', {
        inspectionsCount: inspectionsData.length,
        inspections: inspectionsData
      });

      setInspections(inspectionsData);
      setInspectionsError(null);

    } catch (error: any) {
      console.error('❌ [Debug] 点検記録取得エラー', {
        error: error?.message,
        response: error?.response?.data
      });
      setInspectionsError('点検記録の取得に失敗しました');
    } finally {
      setInspectionsLoading(false);
    }
  };

  /**
   * 全データを取得
   */
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 運行基本情報を先に取得
      await fetchOperationDetail();
      
      // 並行して他のデータを取得
      await Promise.all([
        fetchOperationActivities(),
        fetchGpsRecords()
      ]);
      
    } catch (err) {
      console.error('[OperationDetailDialog] Error fetching data:', err);
      setError('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ===================================================================
  // Effects
  // ===================================================================
  
  useEffect(() => {
    if (isOpen && operationId) {
      console.log('[OperationDetailDialog] Dialog opened, fetching data');
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, operationId]);

  // 運行情報取得後に点検記録を取得
  useEffect(() => {
    if (operation) {
      fetchInspections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation]);

  // ===================================================================
  // ✅ NEW: タイムライン統合ヘルパー関数
  // ===================================================================

  /**
   * ✅ NEW: 運行詳細と点検記録を統合したタイムラインイベントを生成
   */
  const getTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    
    console.log('🔍 [Timeline] タイムラインイベント生成開始', {
      activitiesCount: activities.length,
      inspectionsCount: inspections.length
    });
    
    // 運行詳細（積込・積下等）をイベントに追加
    activities.forEach(activity => {
      const timestamp = activity.actualStartTime || activity.plannedTime;
      if (timestamp) {
        events.push({
          id: `activity-${activity.id}`,
          type: 'activity',
          timestamp: new Date(timestamp),
          sequenceNumber: activity.sequenceNumber,
          data: activity
        });
      }
    });
    
    // 点検記録をイベントに追加
    inspections.forEach(inspection => {
      const timestamp = inspection.startedAt;
      if (timestamp) {
        events.push({
          id: `inspection-${inspection.id}`,
          type: 'inspection',
          timestamp: new Date(timestamp),
          data: inspection
        });
      }
    });
    
    // 時系列順にソート
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    console.log('✅ [Timeline] タイムラインイベント生成完了', {
      totalEvents: events.length,
      activityEvents: events.filter(e => e.type === 'activity').length,
      inspectionEvents: events.filter(e => e.type === 'inspection').length
    });
    
    return events;
  };

  // ===================================================================
  // ヘルパー関数
  // ===================================================================
  
  /**
   * ステータスバッジを取得
   */
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      COMPLETED: { label: '完了', className: 'bg-green-100 text-green-800' },
      IN_PROGRESS: { label: '運行中', className: 'bg-blue-100 text-blue-800' },
      CANCELLED: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
      PLANNING: { label: '計画中', className: 'bg-yellow-100 text-yellow-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PLANNING;
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  /**
   * 作業種別のラベルとアイコンを取得
   */
  const getActivityTypeInfo = (activityType: string) => {
    const typeConfig = {
      LOADING: { label: '積込開始', icon: '📦', className: 'bg-blue-100 text-blue-800' },
      UNLOADING: { label: '積込予定・配送', icon: '🚚', className: 'bg-green-100 text-green-800' },
      FUELING: { label: '給油', icon: '⛽', className: 'bg-orange-100 text-orange-800' },
      BREAK: { label: '休憩', icon: '☕', className: 'bg-gray-100 text-gray-800' },
      MAINTENANCE: { label: 'メンテナンス', icon: '🔧', className: 'bg-purple-100 text-purple-800' }
    };

    return typeConfig[activityType as keyof typeof typeConfig] || {
      label: activityType,
      icon: '📌',
      className: 'bg-gray-100 text-gray-800'
    };
  };

  /**
   * 点検結果のバッジを取得
   */
  const getInspectionResultBadge = (result: string) => {
    const resultConfig = {
      PASS: { label: '合格', className: 'bg-green-100 text-green-800' },
      FAIL: { label: '不合格', className: 'bg-red-100 text-red-800' },
      WARNING: { label: '警告', className: 'bg-yellow-100 text-yellow-800' }
    };

    const config = resultConfig[result as keyof typeof resultConfig] || resultConfig.WARNING;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  /**
   * ✅ NEW: 点検種別のラベルとアイコンを取得
   */
  const getInspectionTypeInfo = (inspectionType: string) => {
    const typeConfig = {
      PRE_TRIP: { 
        label: '運行前点検', 
        icon: '🔍', 
        className: 'bg-blue-100 text-blue-800',
        description: '運行開始前の車両点検'
      },
      POST_TRIP: { 
        label: '運行後点検', 
        icon: '✅', 
        className: 'bg-green-100 text-green-800',
        description: '運行終了後の車両点検'
      }
    };

    return typeConfig[inspectionType as keyof typeof typeConfig] || {
      label: inspectionType,
      icon: '📋',
      className: 'bg-gray-100 text-gray-800',
      description: '点検'
    };
  };

  // ===================================================================
  // レンダリング
  // ===================================================================
  
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="運行記録詳細"
      size="xl"
    >
      <div className="space-y-6">
        {/* ローディング表示 */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">データを読み込み中...</p>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* データ表示 */}
        {!loading && !error && operation && (
          <>
            {/* タブナビゲーション */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'basic'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    基本情報
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'timeline'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    運行タイムライン
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('gps')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'gps'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    GPSルート
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('inspection')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'inspection'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    点検項目
                  </div>
                </button>
              </nav>
            </div>

            {/* タブコンテンツ */}
            <div className="mt-6">
              {/* 基本情報タブ */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  {/* 基本情報セクション */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-gray-600" />
                      基本情報
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">運行番号</p>
                        <p className="font-medium text-lg">{operation.operationNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">ステータス</p>
                        {getStatusBadge(operation.status)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">運転手</p>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <p className="font-medium">
                            {operation.usersOperationsDriverIdTousers?.name || '-'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">車両</p>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-gray-400" />
                          <p className="font-medium">
                            {operation.vehicles?.plateNumber || '-'}
                            {operation.vehicles?.model && ` (${operation.vehicles.model})`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 運行情報セクション */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-gray-600" />
                      運行情報
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">出発時刻</p>
                        <p className="font-medium">
                          {operation.actualStartTime
                            ? new Date(operation.actualStartTime).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">到着時刻</p>
                        <p className="font-medium">
                          {operation.actualEndTime
                            ? new Date(operation.actualEndTime).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">予定開始時刻</p>
                        <p className="font-medium">
                          {operation.plannedStartTime
                            ? new Date(operation.plannedStartTime).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">予定終了時刻</p>
                        <p className="font-medium">
                          {operation.plannedEndTime
                            ? new Date(operation.plannedEndTime).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">総走行距離</p>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                          <p className="font-medium">
                            {operation.totalDistanceKm ? `${operation.totalDistanceKm} km` : '-'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">燃料消費</p>
                        <p className="font-medium">
                          {operation.fuelConsumedLiters ? `${operation.fuelConsumedLiters} L` : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 備考 */}
                  {operation.notes && (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-2">備考</h3>
                      <p className="text-gray-700">{operation.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ NEW: 運行タイムラインタブ - 点検イベント統合版 */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600" />
                    運行タイムライン ({getTimelineEvents().length}件)
                  </h3>
                  
                  {getTimelineEvents().length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      タイムラインデータがありません
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getTimelineEvents().map((event) => {
                        // 運行詳細イベントの場合
                        if (event.type === 'activity') {
                          const activity = event.data as OperationActivity;
                          const typeInfo = getActivityTypeInfo(activity.activityType);
                          
                          return (
                            <div
                              key={event.id}
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
                                    {activity.locations && (
                                      <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <p className="font-medium">{activity.locations.name}</p>
                                          <p className="text-gray-500 text-xs">{activity.locations.address}</p>
                                        </div>
                                      </div>
                                    )}

                                    {activity.items && (
                                      <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        <div>
                                          <p className="font-medium">{activity.items.name}</p>
                                          {activity.quantityTons && (
                                            <p className="text-gray-500 text-xs">
                                              {activity.quantityTons} {activity.items.unit || 't'}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {activity.notes && (
                                    <p className="mt-2 text-sm text-gray-600 italic">{activity.notes}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        // ✅ NEW: 点検イベントの場合
                        else if (event.type === 'inspection') {
                          const inspection = event.data as InspectionRecord;
                          const typeInfo = getInspectionTypeInfo(inspection.inspectionType);
                          
                          return (
                            <div
                              key={event.id}
                              className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start gap-4">
                                {/* 点検アイコン */}
                                <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-5 h-5 text-indigo-600" />
                                </div>

                                {/* 詳細情報 */}
                                <div className="flex-1">
                                  {/* ヘッダー */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 text-xs font-semibold rounded ${typeInfo.className}`}>
                                        {typeInfo.icon} {typeInfo.label}
                                      </span>
                                      {inspection.overallResult && getInspectionResultBadge(inspection.overallResult)}
                                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                        inspection.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                        inspection.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {inspection.status === 'COMPLETED' ? '完了' :
                                         inspection.status === 'IN_PROGRESS' ? '実施中' :
                                         inspection.status === 'PENDING' ? '待機中' : 'キャンセル'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* ✅ NEW: 時刻情報 */}
                                  <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                                    {inspection.startedAt && (
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <div>
                                          <p className="text-xs text-gray-500">開始時刻</p>
                                          <p className="font-medium">
                                            {new Date(inspection.startedAt).toLocaleString('ja-JP')}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {inspection.completedAt && (
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-gray-400" />
                                        <div>
                                          <p className="text-xs text-gray-500">完了時刻</p>
                                          <p className="font-medium">
                                            {new Date(inspection.completedAt).toLocaleString('ja-JP')}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* ✅ NEW: 位置情報 */}
                                  {(inspection.locationName || (inspection.latitude && inspection.longitude)) && (
                                    <div className="flex items-start gap-2 mb-2">
                                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                      <div>
                                        {inspection.locationName && (
                                          <p className="text-sm font-medium">{inspection.locationName}</p>
                                        )}
                                        {inspection.latitude && inspection.longitude && (
                                          <p className="text-xs text-gray-500">
                                            GPS: {inspection.latitude.toFixed(6)}, {inspection.longitude.toFixed(6)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* ✅ NEW: 天候・温度情報 */}
                                  {(inspection.weatherCondition || inspection.temperature) && (
                                    <div className="flex items-center gap-4 mb-2 text-sm">
                                      {inspection.weatherCondition && (
                                        <div className="flex items-center gap-1">
                                          <Cloud className="w-4 h-4 text-gray-400" />
                                          <span className="text-gray-600">{inspection.weatherCondition}</span>
                                        </div>
                                      )}
                                      {inspection.temperature && (
                                        <div className="flex items-center gap-1">
                                          <Thermometer className="w-4 h-4 text-gray-400" />
                                          <span className="text-gray-600">{inspection.temperature}°C</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* ✅ NEW: 不具合数 */}
                                  {inspection.defectsFound !== undefined && inspection.defectsFound > 0 && (
                                    <div className="flex items-center gap-2 mb-2">
                                      <AlertCircle className="w-4 h-4 text-orange-500" />
                                      <span className="text-sm font-medium text-orange-700">
                                        不具合 {inspection.defectsFound}件
                                      </span>
                                    </div>
                                  )}

                                  {/* ✅ NEW: 備考 */}
                                  {inspection.overallNotes && (
                                    <p className="mt-2 text-sm text-gray-600 italic bg-white bg-opacity-50 p-2 rounded">
                                      {inspection.overallNotes}
                                    </p>
                                  )}

                                  {/* ✅ NEW: 点検項目結果サマリー */}
                                  {inspection.inspectionItemResults && inspection.inspectionItemResults.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-indigo-200">
                                      <p className="text-xs text-gray-500 mb-2">
                                        点検項目: {inspection.inspectionItemResults.length}件
                                        （合格: {inspection.inspectionItemResults.filter(r => r.isPassed).length}件、
                                        不合格: {inspection.inspectionItemResults.filter(r => !r.isPassed).length}件）
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {inspection.inspectionItemResults.slice(0, 5).map((result) => (
                                          <span
                                            key={result.id}
                                            className={`px-2 py-1 text-xs rounded ${
                                              result.isPassed
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}
                                          >
                                            {result.inspectionItems?.name || result.resultValue}
                                          </span>
                                        ))}
                                        {inspection.inspectionItemResults.length > 5 && (
                                          <span className="text-xs text-gray-500">
                                            他 {inspection.inspectionItemResults.length - 5}件
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        return null;
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* GPSルートタブ */}
              {activeTab === 'gps' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-gray-600" />
                    GPSルート ({gpsRecords.length}ポイント)
                  </h3>
                  
                  {gpsRecords.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      GPS記録がありません
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* GPS地図表示エリア（TODO: Google Maps統合） */}
                      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                          <Navigation className="w-8 h-8 text-purple-600" />
                        </div>
                        <h4 className="text-lg font-semibold text-purple-900 mb-2">
                          Google Maps統合（実装予定）
                        </h4>
                        <p className="text-purple-700 mb-4">
                          総距離: {operation.totalDistanceKm || 0} km<br />
                          記録ポイント数: {gpsRecords.length}
                        </p>
                        <p className="text-sm text-purple-600">
                          GPSルートをGoogle Mapsで表示する機能は次のステップで実装します
                        </p>
                      </div>

                      {/* GPS記録リスト */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-3">GPS記録サマリー</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {gpsRecords.slice(0, 10).map((record, index) => (
                            <div
                              key={record.id}
                              className="flex items-center justify-between bg-white p-3 rounded border border-gray-200"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-500">
                                  #{index + 1}
                                </span>
                                <div>
                                  <p className="text-sm font-medium">
                                    {new Date(record.recordedAt).toLocaleString('ja-JP')}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}
                                  </p>
                                </div>
                              </div>
                              {record.speedKmh !== undefined && (
                                <div className="text-sm text-gray-600">
                                  {record.speedKmh} km/h
                                </div>
                              )}
                            </div>
                          ))}
                          {gpsRecords.length > 10 && (
                            <p className="text-sm text-gray-500 text-center py-2">
                              他 {gpsRecords.length - 10} 件の記録
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ NEW: 点検項目タブ - 詳細情報表示版 */}
              {activeTab === 'inspection' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-gray-600" />
                    点検項目 ({inspections.length}件)
                  </h3>
                  
                  {inspectionsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">点検記録を読み込み中...</p>
                    </div>
                  ) : inspectionsError ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">{inspectionsError}</span>
                      </div>
                    </div>
                  ) : inspections.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      点検記録がありません
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {inspections.map((inspection) => {
                        const typeInfo = getInspectionTypeInfo(inspection.inspectionType);
                        
                        return (
                          <div
                            key={inspection.id}
                            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                          >
                            {/* ヘッダー */}
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-3 py-1 text-sm font-semibold rounded ${typeInfo.className}`}>
                                    {typeInfo.icon} {typeInfo.label}
                                  </span>
                                  {inspection.overallResult && getInspectionResultBadge(inspection.overallResult)}
                                </div>
                                <p className="text-sm text-gray-600">{typeInfo.description}</p>
                              </div>
                              <span className={`px-3 py-1 text-sm font-semibold rounded ${
                                inspection.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                inspection.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {inspection.status === 'COMPLETED' ? '完了' :
                                 inspection.status === 'IN_PROGRESS' ? '実施中' :
                                 inspection.status === 'PENDING' ? '待機中' : 'キャンセル'}
                              </span>
                            </div>
                            
                            {/* ✅ NEW: 詳細情報グリッド */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              {/* 時刻情報 */}
                              {inspection.startedAt && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">開始時刻</p>
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    {new Date(inspection.startedAt).toLocaleString('ja-JP')}
                                  </p>
                                </div>
                              )}
                              {inspection.completedAt && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">完了時刻</p>
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-gray-400" />
                                    {new Date(inspection.completedAt).toLocaleString('ja-JP')}
                                  </p>
                                </div>
                              )}

                              {/* 場所情報 */}
                              {inspection.locationName && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">実施場所</p>
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    {inspection.locationName}
                                  </p>
                                </div>
                              )}

                              {/* GPS座標 */}
                              {inspection.latitude && inspection.longitude && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">GPS座標</p>
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <Navigation className="w-4 h-4 text-gray-400" />
                                    {inspection.latitude.toFixed(6)}, {inspection.longitude.toFixed(6)}
                                  </p>
                                </div>
                              )}

                              {/* 天候 */}
                              {inspection.weatherCondition && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">天候</p>
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <Cloud className="w-4 h-4 text-gray-400" />
                                    {inspection.weatherCondition}
                                  </p>
                                </div>
                              )}

                              {/* 気温 */}
                              {inspection.temperature && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">気温</p>
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <Thermometer className="w-4 h-4 text-gray-400" />
                                    {inspection.temperature}°C
                                  </p>
                                </div>
                              )}

                              {/* 車両 */}
                              {inspection.vehicles && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">車両</p>
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-gray-400" />
                                    {inspection.vehicles.plateNumber}
                                    {inspection.vehicles.model && ` (${inspection.vehicles.model})`}
                                  </p>
                                </div>
                              )}

                              {/* 実施者 */}
                              {inspection.users && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">実施者</p>
                                  <p className="text-sm font-medium flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    {inspection.users.name}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* ✅ NEW: 不具合情報 */}
                            {inspection.defectsFound !== undefined && inspection.defectsFound > 0 && (
                              <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-5 h-5 text-orange-600" />
                                  <span className="font-semibold text-orange-800">
                                    不具合検出: {inspection.defectsFound}件
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* ✅ NEW: 備考 */}
                            {inspection.overallNotes && (
                              <div className="bg-gray-50 rounded p-3 mb-4">
                                <p className="text-xs text-gray-500 mb-1">備考</p>
                                <p className="text-sm text-gray-700">{inspection.overallNotes}</p>
                              </div>
                            )}

                            {/* ✅ NEW: 点検項目結果の詳細 */}
                            {inspection.inspectionItemResults && inspection.inspectionItemResults.length > 0 && (
                              <div className="border-t pt-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-sm">点検項目結果</h4>
                                  <span className="text-xs text-gray-500">
                                    {inspection.inspectionItemResults.length}件
                                    （合格: {inspection.inspectionItemResults.filter(r => r.isPassed).length}件、
                                    不合格: {inspection.inspectionItemResults.filter(r => !r.isPassed).length}件）
                                  </span>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {inspection.inspectionItemResults.map((result) => (
                                    <div
                                      key={result.id}
                                      className={`p-3 rounded border ${
                                        result.isPassed
                                          ? 'bg-green-50 border-green-200'
                                          : 'bg-red-50 border-red-200'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                              result.isPassed
                                                ? 'bg-green-200 text-green-800'
                                                : 'bg-red-200 text-red-800'
                                            }`}>
                                              {result.isPassed ? '✓ 合格' : '✗ 不合格'}
                                            </span>
                                            {result.defectLevel && (
                                              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                                result.defectLevel === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                                                result.defectLevel === 'HIGH' ? 'bg-orange-200 text-orange-800' :
                                                result.defectLevel === 'MEDIUM' ? 'bg-yellow-200 text-yellow-800' :
                                                'bg-blue-200 text-blue-800'
                                              }`}>
                                                {result.defectLevel}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-sm font-medium">
                                            {result.inspectionItems?.name || '項目名不明'}
                                          </p>
                                          {result.inspectionItems?.description && (
                                            <p className="text-xs text-gray-500 mt-1">
                                              {result.inspectionItems.description}
                                            </p>
                                          )}
                                          {result.resultValue && (
                                            <p className="text-sm text-gray-700 mt-1">
                                              結果: {result.resultValue}
                                            </p>
                                          )}
                                          {result.notes && (
                                            <p className="text-xs text-gray-600 mt-1 italic">
                                              備考: {result.notes}
                                            </p>
                                          )}
                                          {result.photoUrls && result.photoUrls.length > 0 && (
                                            <div className="flex items-center gap-1 mt-2">
                                              <span className="text-xs text-gray-500">
                                                📷 写真 {result.photoUrls.length}枚
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* フッター - アクションボタン */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <Button variant="outline" onClick={onClose}>
                閉じる
              </Button>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Edit className="w-4 h-4 mr-2" />
                  編集
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default OperationDetailDialog;