// ✅✅✅ TypeScriptエラー完全修正版
import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, Eye, Truck, User, MapPin, Package, 
  Clock, Navigation, CheckCircle, AlertCircle, TrendingUp, Edit,
  Calendar
} from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Table from '../components/common/Table';
import { apiClient } from '../utils/api';

interface Operation {
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
  gpsLogs?: GpsRecord[];
}

interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  manufacturer: string;
}

interface Driver {
  id: string;
  name: string;
  username: string;
  employeeId: string;
}

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

interface GpsRecord {
  id: string;
  latitude: number | string;
  longitude: number | string;
  recordedAt: string;
  speedKmh?: number | string;
}

interface InspectionRecord {
  id: string;
  operationId: string;
  vehicleId: string;
  inspectorId: string;
  inspectionType: 'PRE_TRIP' | 'POST_TRIP';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string | null;
  completedAt: string | null;
  overallResult: 'PASS' | 'FAIL' | 'WARNING' | null;
  overallNotes: string | null;
  inspectionItems?: InspectionItem[];
}

interface InspectionItem {
  id: string;
  inspectionRecordId: string;
  inspectionItemId: string;
  result: 'OK' | 'NG' | 'ATTENTION' | 'NOT_APPLICABLE';
  notes: string | null;
  photoUrls: string[] | null;
  inspectionItemsInspectionItemIdToinspection_items?: {
    id: string;
    name: string;
    category: string;
    description: string | null;
  };
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const OperationDetailDialog: React.FC<{
  operationId: string;
  isOpen: boolean;
  onClose: () => void;
}> = ({ operationId, isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [activities, setActivities] = useState<OperationActivity[]>([]);
  const [gpsRecords, setGpsRecords] = useState<GpsRecord[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'basic' | 'timeline' | 'gps' | 'inspection'>('basic');
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const fetchOperationDetail = async () => {
    try {
      const response = await apiClient.get(`/operations/${operationId}`);
      
      if (response.success && response.data) {
        const responseData: any = response.data;
        let operationData: Operation;
        
        if (responseData.data?.data) {
          operationData = responseData.data.data as Operation;
        } else if (responseData.data) {
          operationData = responseData.data as Operation;
        } else {
          operationData = responseData as Operation;
        }
        
        setOperation(operationData);
        
        if (operationData.gpsLogs && operationData.gpsLogs.length > 0) {
          const gpsData = operationData.gpsLogs.sort((a, b) => 
            new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
          );
          setGpsRecords(gpsData);
        }
      } else {
        setError('運行記録の取得に失敗しました');
      }
    } catch (err) {
      setError('運行記録の取得中にエラーが発生しました');
    }
  };

  const fetchOperationActivities = async () => {
    try {
      const response = await apiClient.get('/operation-details', {
        params: { operationId, page: 1, limit: 100 }
      });
      
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
        
        activitiesData.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        setActivities(activitiesData);
      }
    } catch (err) {
      console.error('Activities fetch error:', err);
    }
  };

  const fetchInspections = async () => {
    if (!operation) return;
    
    try {
      const response = await apiClient.get('/inspections', {
        params: { operationId: operationId, page: 1, limit: 100 }
      });
      
      if (response.success && response.data) {
        let inspectionsData: InspectionRecord[] = [];
        const data: any = response.data;
        
        if (data.data?.data && Array.isArray(data.data.data)) {
          inspectionsData = data.data.data;
        } else if (data.data && Array.isArray(data.data)) {
          inspectionsData = data.data;
        } else if (Array.isArray(data)) {
          inspectionsData = data;
        }
        
        const inspectionsWithItems = await Promise.all(
          inspectionsData.map(async (inspection) => {
            try {
              const itemsResponse = await apiClient.get(`/inspections/${inspection.id}/items`);
              if (itemsResponse.success && itemsResponse.data) {
                const itemsData: any = itemsResponse.data;
                let items: InspectionItem[] = [];
                
                if (itemsData.data?.data && Array.isArray(itemsData.data.data)) {
                  items = itemsData.data.data;
                } else if (itemsData.data && Array.isArray(itemsData.data)) {
                  items = itemsData.data;
                } else if (Array.isArray(itemsData)) {
                  items = itemsData;
                }
                
                return { ...inspection, inspectionItems: items };
              }
              return inspection;
            } catch {
              return inspection;
            }
          })
        );
        
        setInspections(inspectionsWithItems);
      }
    } catch (err) {
      console.error('Inspections fetch error:', err);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await fetchOperationDetail();
      await fetchOperationActivities();
    } catch (err) {
      setError('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && operationId) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, operationId]);

  useEffect(() => {
    if (operation) {
      fetchInspections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation]);

  useEffect(() => {
    if (activeTab === 'gps' && gpsRecords.length > 0 && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, gpsRecords]);

  const initializeMap = () => {
    if (!window.google || !mapRef.current || gpsRecords.length === 0) return;

    const firstPoint = gpsRecords[0];
    const lat = toNumber(firstPoint.latitude);
    const lng = toNumber(firstPoint.longitude);

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 14,
      mapTypeId: 'roadmap',
    });

    mapInstanceRef.current = map;

    gpsRecords.forEach((record, idx) => {
      const position = {
        lat: toNumber(record.latitude),
        lng: toNumber(record.longitude)
      };

      if (idx === 0) {
        new window.google.maps.Marker({
          position,
          map,
          label: 'S',
          title: `出発: ${new Date(record.recordedAt).toLocaleString('ja-JP')}`,
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
          }
        });
      } else if (idx === gpsRecords.length - 1) {
        new window.google.maps.Marker({
          position,
          map,
          label: 'G',
          title: `到着: ${new Date(record.recordedAt).toLocaleString('ja-JP')}`,
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
          }
        });
      }
    });

    if (gpsRecords.length > 1) {
      const path = gpsRecords.map(record => ({
        lat: toNumber(record.latitude),
        lng: toNumber(record.longitude)
      }));

      new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#4F46E5',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      COMPLETED: { label: '完了', className: 'bg-green-100 text-green-800' },
      IN_PROGRESS: { label: '運行中', className: 'bg-blue-100 text-blue-800' },
      CANCELLED: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
      PLANNING: { label: '計画中', className: 'bg-yellow-100 text-yellow-800' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PLANNING;
    return <span className={`px-3 py-1 text-sm font-semibold rounded-full ${config.className}`}>{config.label}</span>;
  };

  const getActivityTypeInfo = (activityType: string) => {
    const typeConfig = {
      LOADING: { label: '積込開始', icon: '📦', className: 'bg-blue-100 text-blue-800' },
      UNLOADING: { label: '積込予定・配送', icon: '🚚', className: 'bg-green-100 text-green-800' },
      FUELING: { label: '給油', icon: '⛽', className: 'bg-orange-100 text-orange-800' },
      BREAK: { label: '休憩', icon: '☕', className: 'bg-gray-100 text-gray-800' },
      MAINTENANCE: { label: 'メンテナンス', icon: '🔧', className: 'bg-purple-100 text-purple-800' }
    };
    return typeConfig[activityType as keyof typeof typeConfig] || { label: activityType, icon: '📌', className: 'bg-gray-100 text-gray-800' };
  };

  const getInspectionResultBadge = (result: string | null) => {
    if (!result) return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">未実施</span>;
    const resultConfig = {
      PASS: { label: '合格', className: 'bg-green-100 text-green-800' },
      FAIL: { label: '不合格', className: 'bg-red-100 text-red-800' },
      WARNING: { label: '警告', className: 'bg-yellow-100 text-yellow-800' }
    };
    const config = resultConfig[result as keyof typeof resultConfig] || resultConfig.WARNING;
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>{config.label}</span>;
  };

  const getItemResultBadge = (result: string) => {
    const resultConfig = {
      OK: { label: '正常', className: 'bg-green-100 text-green-800', icon: '✓' },
      NG: { label: '異常', className: 'bg-red-100 text-red-800', icon: '✗' },
      ATTENTION: { label: '要注意', className: 'bg-yellow-100 text-yellow-800', icon: '⚠' },
      NOT_APPLICABLE: { label: '対象外', className: 'bg-gray-100 text-gray-800', icon: '−' }
    };
    const config = resultConfig[result as keyof typeof resultConfig] || resultConfig.NOT_APPLICABLE;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded ${config.className}`}>
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  const toNumber = (value: number | string | undefined | null): number => {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="運行記録詳細" size="xl">
      <div className="space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">データを読み込み中...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {!loading && !error && operation && (
          <>
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8">
                {(['basic', 'timeline', 'gps', 'inspection'] as const).map((tab) => {
                  const icons = { basic: Truck, timeline: Clock, gps: Navigation, inspection: CheckCircle };
                  const labels = { basic: '基本情報', timeline: '運行タイムライン', gps: 'GPSルート', inspection: '点検項目' };
                  const Icon = icons[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {labels[tab]}
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-6">
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-gray-600" />基本情報
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-sm text-gray-500 mb-1">運行番号</p><p className="font-medium text-lg">{operation.operationNumber}</p></div>
                      <div><p className="text-sm text-gray-500 mb-1">ステータス</p>{getStatusBadge(operation.status)}</div>
                      <div><p className="text-sm text-gray-500 mb-1">運転手</p><div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /><p className="font-medium">{operation.usersOperationsDriverIdTousers?.name || '-'}</p></div></div>
                      <div><p className="text-sm text-gray-500 mb-1">車両</p><div className="flex items-center gap-2"><Truck className="w-4 h-4 text-gray-400" /><p className="font-medium">{operation.vehicles?.plateNumber || '-'}{operation.vehicles?.model && ` (${operation.vehicles.model})`}</p></div></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-600" />運行情報</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-sm text-gray-500 mb-1">出発時刻</p><p className="font-medium">{operation.actualStartTime ? new Date(operation.actualStartTime).toLocaleString('ja-JP') : '-'}</p></div>
                      <div><p className="text-sm text-gray-500 mb-1">到着時刻</p><p className="font-medium">{operation.actualEndTime ? new Date(operation.actualEndTime).toLocaleString('ja-JP') : '-'}</p></div>
                      <div><p className="text-sm text-gray-500 mb-1">総走行距離</p><div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-gray-400" /><p className="font-medium">{operation.totalDistanceKm ? `${operation.totalDistanceKm} km` : '-'}</p></div></div>
                      <div><p className="text-sm text-gray-500 mb-1">燃料消費</p><p className="font-medium">{operation.fuelConsumedLiters ? `${operation.fuelConsumedLiters} L` : '-'}</p></div>
                    </div>
                  </div>
                  {operation.notes && <div className="bg-gray-50 rounded-lg p-6"><h3 className="text-lg font-semibold mb-2">備考</h3><p className="text-gray-700">{operation.notes}</p></div>}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-600" />運行タイムライン ({activities.length}件)</h3>
                  {activities.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">運行詳細データがありません</div>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity) => {
                        const typeInfo = getActivityTypeInfo(activity.activityType);
                        return (
                          <div key={activity.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-semibold text-blue-600">{activity.sequenceNumber}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded ${typeInfo.className}`}>{typeInfo.icon} {typeInfo.label}</span>
                                  {activity.actualStartTime && <span className="text-sm text-gray-500">{new Date(activity.actualStartTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  {activity.locations && (
                                    <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" /><div><p className="font-medium">{activity.locations.name}</p><p className="text-gray-500 text-xs">{activity.locations.address}</p></div></div>
                                  )}
                                  {activity.items && (
                                    <div className="flex items-center gap-2"><Package className="w-4 h-4 text-gray-400 flex-shrink-0" /><div><p className="font-medium">{activity.items.name}</p>{activity.quantityTons && <p className="text-gray-500 text-xs">{activity.quantityTons} {activity.items.unit || 't'}</p>}</div></div>
                                  )}
                                </div>
                                {activity.notes && <p className="mt-2 text-sm text-gray-600 italic">{activity.notes}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'gps' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Navigation className="w-5 h-5 text-gray-600" />GPSルート ({gpsRecords.length}ポイント)</h3>
                  {gpsRecords.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">GPS記録がありません</div>
                  ) : (
                    <div className="space-y-4">
                      <div 
                        ref={mapRef} 
                        className="w-full h-96 bg-gray-100 rounded-lg border-2 border-gray-300"
                        style={{ minHeight: '400px' }}
                      ></div>
                      
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold">GPS記録サマリー</h4>
                          <div className="text-sm text-gray-600">
                            総距離: {operation.totalDistanceKm || 0} km | 記録数: {gpsRecords.length}
                          </div>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {gpsRecords.slice(0, 10).map((record, idx) => (
                            <div key={record.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-500">#{idx + 1}</span>
                                <div>
                                  <p className="text-sm font-medium">{new Date(record.recordedAt).toLocaleString('ja-JP')}</p>
                                  <p className="text-xs text-gray-500">
                                    {toNumber(record.latitude).toFixed(6)}, {toNumber(record.longitude).toFixed(6)}
                                  </p>
                                </div>
                              </div>
                              {record.speedKmh !== undefined && record.speedKmh !== null && (
                                <div className="text-sm text-gray-600">{toNumber(record.speedKmh)} km/h</div>
                              )}
                            </div>
                          ))}
                          {gpsRecords.length > 10 && <p className="text-sm text-gray-500 text-center py-2">他 {gpsRecords.length - 10} 件の記録</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'inspection' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-gray-600" />点検項目 ({inspections.length}件)</h3>
                  {inspections.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">点検記録がありません</div>
                  ) : (
                    <div className="space-y-4">
                      {inspections.map((inspection) => (
                        <div key={inspection.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b border-gray-200">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg font-bold text-gray-900">
                                    {inspection.inspectionType === 'PRE_TRIP' ? '🔍 運行前点検' : '🔍 運行後点検'}
                                  </span>
                                  {inspection.overallResult && getInspectionResultBadge(inspection.overallResult)}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {inspection.startedAt && `開始: ${new Date(inspection.startedAt).toLocaleString('ja-JP')}`}
                                </p>
                                {inspection.completedAt && (
                                  <p className="text-sm text-gray-600">
                                    完了: {new Date(inspection.completedAt).toLocaleString('ja-JP')}
                                  </p>
                                )}
                              </div>
                              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                                inspection.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                                inspection.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {inspection.status === 'COMPLETED' ? '完了' : 
                                 inspection.status === 'IN_PROGRESS' ? '実施中' : 
                                 inspection.status === 'PENDING' ? '待機中' : 'キャンセル'}
                              </span>
                            </div>
                            {inspection.overallNotes && (
                              <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                <p className="text-sm font-medium text-gray-700 mb-1">総合コメント:</p>
                                <p className="text-sm text-gray-600">{inspection.overallNotes}</p>
                              </div>
                            )}
                          </div>

                          {inspection.inspectionItems && inspection.inspectionItems.length > 0 && (
                            <div className="p-4">
                              <h4 className="font-semibold mb-3 text-gray-700">点検項目詳細 ({inspection.inspectionItems.length}項目)</h4>
                              <div className="space-y-2">
                                {inspection.inspectionItems.map((item) => (
                                  <div 
                                    key={item.id} 
                                    className={`p-3 rounded-lg border-l-4 ${
                                      item.result === 'OK' ? 'bg-green-50 border-green-500' :
                                      item.result === 'NG' ? 'bg-red-50 border-red-500' :
                                      item.result === 'ATTENTION' ? 'bg-yellow-50 border-yellow-500' :
                                      'bg-gray-50 border-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-medium text-gray-900">
                                            {item.inspectionItemsInspectionItemIdToinspection_items?.name || '点検項目'}
                                          </span>
                                          {getItemResultBadge(item.result)}
                                        </div>
                                        {item.inspectionItemsInspectionItemIdToinspection_items?.category && (
                                          <p className="text-xs text-gray-500 mb-1">
                                            カテゴリ: {item.inspectionItemsInspectionItemIdToinspection_items.category}
                                          </p>
                                        )}
                                        {item.inspectionItemsInspectionItemIdToinspection_items?.description && (
                                          <p className="text-xs text-gray-600 mb-2">
                                            {item.inspectionItemsInspectionItemIdToinspection_items.description}
                                          </p>
                                        )}
                                        {item.notes && (
                                          <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                                            <p className="text-xs font-medium text-gray-600 mb-1">備考:</p>
                                            <p className="text-sm text-gray-700">{item.notes}</p>
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
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <Button variant="outline" onClick={onClose}>閉じる</Button>
              <Button variant="outline"><Edit className="w-4 h-4 mr-2" />編集</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

const loadGoogleMapsScript = (callback: () => void) => {
  if (window.google && window.google.maps) {
    callback();
    return;
  }

  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    existingScript.addEventListener('load', callback);
    return;
  }

  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places`;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.head.appendChild(script);
};

const OperationRecords: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<Operation | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });

  useEffect(() => {
    loadGoogleMapsScript(() => {
      console.log('Google Maps loaded');
    });
  }, []);

  const fetchOperations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/operations', {
        params: {
          page: pagination.page,
          limit: pagination.pageSize,
          ...(vehicleFilter && { vehicleId: vehicleFilter }),
          ...(driverFilter && { driverId: driverFilter }),
          ...(dateFilter && { startDate: dateFilter })
        }
      });
      if (response.success && response.data) {
        const innerData: any = response.data;
        const backendData: any = innerData.data || innerData;
        const operationsData = backendData.data || [];
        setOperations(operationsData);
        setPagination(prev => ({ ...prev, total: backendData.total || 0, totalPages: backendData.totalPages || 0 }));
      } else {
        setError('運行記録の取得に失敗しました');
      }
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await apiClient.get('/vehicles', { params: { limit: 100, page: 1 } });
      if (response.success && response.data) {
        let vehiclesData: Vehicle[] = [];
        const data: any = response.data;
        if (data.vehicles && Array.isArray(data.vehicles)) vehiclesData = data.vehicles;
        else if (data.data?.vehicles && Array.isArray(data.data.vehicles)) vehiclesData = data.data.vehicles;
        else if (data.data?.data && Array.isArray(data.data.data)) vehiclesData = data.data.data;
        else if (data.data && Array.isArray(data.data)) vehiclesData = data.data;
        setVehicles(vehiclesData);
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await apiClient.get('/users', { params: { limit: 100, page: 1, role: 'DRIVER' } });
      if (response.success && response.data) {
        let driversData: Driver[] = [];
        const data: any = response.data;
        if (data.users && Array.isArray(data.users)) driversData = data.users;
        else if (data.data?.users && Array.isArray(data.data.users)) driversData = data.data.users;
        else if (data.data?.data && Array.isArray(data.data.data)) driversData = data.data.data;
        else if (data.data && Array.isArray(data.data)) driversData = data.data;
        setDrivers(driversData);
      }
    } catch (err) {
      console.error('Failed to load drivers:', err);
    }
  };

  useEffect(() => {
    fetchOperations();
    fetchVehicles();
    fetchDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { 
    fetchOperations(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize]);
  
  useEffect(() => {
    if (vehicleFilter || driverFilter || dateFilter) {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOperations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleFilter, driverFilter, dateFilter]);

  const filteredRecords = operations.filter((record) => {
    const vehiclePlate = record.vehicles?.plateNumber || '';
    const driverName = record.usersOperationsDriverIdTousers?.name || '';
    const opNumber = record.operationNumber || '';
    const matchesSearch = vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase()) || driverName.toLowerCase().includes(searchQuery.toLowerCase()) || opNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleViewDetail = (record: Operation) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleExportCSV = () => {
    console.log('Export CSV');
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination(prev => ({ ...prev, page: 1, pageSize: newPageSize }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      COMPLETED: { label: '完了', className: 'bg-green-100 text-green-800' },
      IN_PROGRESS: { label: '運行中', className: 'bg-blue-100 text-blue-800' },
      CANCELLED: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
      PLANNING: { label: '計画中', className: 'bg-yellow-100 text-yellow-800' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PLANNING;
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>{config.label}</span>;
  };

  const columns = [
    { key: 'date', header: '運行日', render: (_value: any, record: Operation) => record?.actualStartTime ? <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /><span>{new Date(record.actualStartTime).toLocaleDateString('ja-JP')}</span></div> : <span>-</span> },
    { key: 'driver', header: '運転手', render: (_value: any, record: Operation) => <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /><span>{record?.usersOperationsDriverIdTousers?.name || '-'}</span></div> },
    { key: 'vehicle', header: '車両', render: (_value: any, record: Operation) => <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-gray-400" /><span>{record?.vehicles?.plateNumber || '-'}</span></div> },
    { key: 'operationNumber', header: '運行番号', render: (_value: any, record: Operation) => <span className="font-medium">{record?.operationNumber || '-'}</span> },
    { key: 'status', header: 'ステータス', render: (_value: any, record: Operation) => record?.status ? getStatusBadge(record.status) : <span>-</span> },
    { key: 'distance', header: '走行距離', render: (_value: any, record: Operation) => <span>{record?.totalDistanceKm ? `${record.totalDistanceKm} km` : '-'}</span> },
    { key: 'actions', header: '操作', render: (_value: any, record: Operation) => record ? <Button variant="outline" size="sm" onClick={() => handleViewDetail(record)}><Eye className="w-4 h-4" /></Button> : <span>-</span> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">運行記録</h1>
        <Button onClick={handleExportCSV} variant="outline"><Download className="w-4 h-4 mr-2" />CSV出力 ({pagination.total}件)</Button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">検索・フィルター</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input label="キーワード検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="運転手名、車両、等々で検索" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">運転手 ({drivers.length}人)</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
              <option value="">すべての運転手</option>
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} ({driver.employeeId})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">車両 ({vehicles.length}台)</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
              <option value="">すべての車両</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber} - {vehicle.model}</option>)}
            </select>
          </div>
          <Input label="運行日" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">運行記録一覧 ({filteredRecords.length}件)</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">表示件数:</label>
            <select className="px-3 py-1 border border-gray-300 rounded-md text-sm" value={pagination.pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
              {[10, 20, 30, 50, 100].map(size => <option key={size} value={size}>{size}件</option>)}
            </select>
          </div>
        </div>
        {loading ? <div className="p-8 text-center">読み込み中...</div> : error ? <div className="p-8 text-center text-red-600">{error}</div> : filteredRecords.length === 0 ? <div className="p-8 text-center text-gray-500">運行記録が見つかりません</div> : (
          <>
            <Table columns={columns} data={filteredRecords} />
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-600">{pagination.total}件中 {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)}件を表示</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1}>前へ</Button>
                <span className="px-3 py-1 text-sm">{pagination.page} / {pagination.totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>次へ</Button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedRecord && <OperationDetailDialog operationId={selectedRecord.id} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />}
    </div>
  );
};

export default OperationRecords;