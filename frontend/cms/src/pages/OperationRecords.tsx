// ✅✅✅ OperationDetailDialog定義削除、import追加版
// 既存のOperationRecordsコンポーネント機能は100%保持
// ✅ 修正: Google Maps APIキーを環境変数から取得するように変更
import React, { useState, useEffect } from 'react';
import { useTLog } from '../hooks/useTLog';
import { 
  Download, Eye, Truck, User, Calendar
} from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Table from '../components/common/Table';
import { apiClient } from '../utils/api';
// ✅ 修正: OperationDetailDialogをインポート
import OperationDetailDialog from '../components/OperationDetailDialog';
import OperationsMapView from '../components/OperationsMapView';

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

interface GpsRecord {
  id: string;
  latitude: number | string;
  longitude: number | string;
  recordedAt: string;
  speedKmh?: number | string;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

// ✅ 修正: Google Maps APIキーを環境変数から取得するように変更
const loadGoogleMapsScript = (callback: () => void) => {
  if (window.google && window.google.maps) {
    callback();
    return;
  }

  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    if (window.google && window.google.maps) {
      callback();
    } else {
      existingScript.addEventListener('load', callback);
    }
    return;
  }

  // ✅ 修正: 環境変数からGoogle Maps APIキーを取得
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker,places`;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  script.onerror = () => {
    console.error('[OperationRecords] Google Maps APIの読み込みに失敗しました');
  };
  document.head.appendChild(script);
};

const OperationRecords: React.FC = () => {
  useTLog('OPERATION_RECORDS', '運行記録');

  const [activeView, setActiveView] = useState<'LIST' | 'MAP'>('LIST');
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
          ...(dateFilter && { startDate: dateFilter }),
          ...(searchQuery.trim() && { search: searchQuery.trim() })
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

  // ✅ キーワード検索: 入力後500msデバウンスして再検索（マップ表示からのジャンプ含む）
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOperations();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ✅ 修正: 検索は既にバックエンド（/operations?search=...）で行われているため、
  //    ここでのクライアント側再フィルタは行わない（二重フィルタによる0件化バグの原因だった）。
  //    場所名・客先名等の検索キーワードはバックエンドのwhere句でのみ判定する。
  const filteredRecords = operations;

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
    { key: 'date', header: '運行日', render: (_value: any, record: Operation) => record?.actualStartTime ? <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /><span>{new Date(record.actualStartTime).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span></div> : <span>-</span> },
    { key: 'customer', header: '客先', render: (_value: any, record: Operation) => <span className="text-sm">{(record as any)?.customer?.name || '-'}</span> },
    { key: 'driver', header: '運転手', render: (_value: any, record: Operation) => <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /><span>{record?.usersOperationsDriverIdTousers?.name || '-'}</span></div> },
    { key: 'vehicle', header: '車両', render: (_value: any, record: Operation) => <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-gray-400" /><span>{record?.vehicles?.plateNumber || '-'}</span></div> },
    { key: 'operationNumber', header: '運行番号', render: (_value: any, record: Operation) => <span className="font-medium">{record?.operationNumber || '-'}</span> },
    { key: 'status', header: 'ステータス', render: (_value: any, record: Operation) => record?.status ? getStatusBadge(record.status) : <span>-</span> },
    { key: 'distance', header: '走行距離', render: (_value: any, record: Operation) => <span>{record?.totalDistanceKm ? `${record.totalDistanceKm} km` : '-'}</span> },
    { key: 'actions', header: '操作', render: (_value: any, record: Operation) => record ? <Button variant="outline" size="sm" onClick={() => handleViewDetail(record)}><Eye className="w-4 h-4" /></Button> : <span>-</span> }
  ];

  // マップビューの「詳細」ボタン押下時: 一覧表示タブへ切替＋場所名で絞り込み
  const handleJumpToList = (locationName: string) => {
    setActiveView('LIST');
    setSearchQuery(locationName);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">運行記録</h1>
        {activeView === 'LIST' && (
          <Button onClick={handleExportCSV} variant="outline"><Download className="w-4 h-4 mr-2" />CSV出力 ({pagination.total}件)</Button>
        )}
      </div>

      {/* タブ＋検索フィルタ＋一覧/実績表示を1枚の白カードに統合 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* 表示切替タブ */}
        <div className="flex gap-1 px-4 pt-3 border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveView('LIST')}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-t border-l border-r -mb-px ${
              activeView === 'LIST'
                ? 'bg-white border-gray-200 text-gray-900'
                : 'bg-transparent border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 一覧表示
          </button>
          <button
            onClick={() => setActiveView('MAP')}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-t border-l border-r -mb-px ${
              activeView === 'MAP'
                ? 'bg-white border-gray-200 text-gray-900'
                : 'bg-transparent border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 実績表示
          </button>
        </div>

      {activeView === 'MAP' ? (
        <OperationsMapView onJumpToList={handleJumpToList} />
      ) : (
      <>
      <div className="p-6">
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

      <div className="border border-gray-200 rounded-lg mt-4">
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
            <Table columns={columns} data={filteredRecords} scrollClassName="max-h-[calc(100vh-340px)]" />
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

      {selectedRecord && <OperationDetailDialog operationId={selectedRecord.id}
          initialOperation={selectedRecord} isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} />}
      </>
      )}
      </div>
    </div>
  );
};

export default OperationRecords;