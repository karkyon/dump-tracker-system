import React, { useState, useEffect } from 'react';
import { Search, Download, Eye, Edit2, Trash2, Calendar, MapPin, User, Truck } from 'lucide-react';
import Layout from '../components/Layout/Layout';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Table from '../components/common/Table';
import { useOperationStore } from '../store/operationStore';

interface OperationRecord {
  id: string;
  date: string;
  driverName: string;
  vehicleNumber: string;
  clientName: string;
  loadingLocation: string;
  unloadingLocation: string;
  cargoType: string;
  distance: number;
  operationTime: string;
  status: 'completed' | 'in_progress' | 'cancelled';
}

const OperationRecords: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<OperationRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { records, loading, fetchRecords, exportRecords } = useOperationStore();

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      record.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.loadingLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.unloadingLocation.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = !dateFilter || record.date === dateFilter;
    const matchesDriver = !driverFilter || record.driverName === driverFilter;
    const matchesVehicle = !vehicleFilter || record.vehicleNumber === vehicleFilter;

    return matchesSearch && matchesDate && matchesDriver && matchesVehicle;
  });

  const handleViewDetail = (record: OperationRecord) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleExportCSV = async () => {
    const filters = {
      searchQuery,
      dateFilter,
      driverFilter,
      vehicleFilter
    };
    await exportRecords('csv', filters);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: '完了', className: 'bg-green-100 text-green-800' },
      in_progress: { label: '運行中', className: 'bg-blue-100 text-blue-800' },
      cancelled: { label: 'キャンセル', className: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.completed;
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const columns = [
    { key: 'date', label: '運行日', width: '120px' },
    { key: 'driverName', label: '運転手', width: '120px' },
    { key: 'vehicleNumber', label: '車両', width: '100px' },
    { key: 'clientName', label: '客先名', width: '150px' },
    { key: 'loadingLocation', label: '積込場所', width: '150px' },
    { key: 'unloadingLocation', label: '積下場所', width: '150px' },
    { key: 'operationTime', label: '運行時間', width: '100px' },
    { key: 'status', label: 'ステータス', width: '100px' },
    { key: 'actions', label: '操作', width: '120px' }
  ];

  const tableData = filteredRecords.map(record => ({
    date: new Date(record.date).toLocaleDateString('ja-JP'),
    driverName: record.driverName,
    vehicleNumber: record.vehicleNumber,
    clientName: record.clientName,
    loadingLocation: record.loadingLocation,
    unloadingLocation: record.unloadingLocation,
    operationTime: record.operationTime,
    status: getStatusBadge(record.status),
    actions: (
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewDetail(record)}
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {/* TODO: 編集機能 */}}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
      </div>
    )
  }));

  // ユニークな運転手と車両のリストを取得
  const uniqueDrivers = [...new Set(records.map(r => r.driverName))];
  const uniqueVehicles = [...new Set(records.map(r => r.vehicleNumber))];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">運行記録</h1>
          <Button onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV出力 ({filteredRecords.length}件)
          </Button>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">検索・フィルター</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    キーワード検索
                  </label>
                  <Input
                    type="text"
                    placeholder="運転手名、車番、客先名、場所で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="w-4 h-4" />}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    運転手
                  </label>
                  <select
                    value={driverFilter}
                    onChange={(e) => setDriverFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">すべての運転手</option>
                    {uniqueDrivers.map(driver => (
                      <option key={driver} value={driver}>{driver}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    車両
                  </label>
                  <select
                    value={vehicleFilter}
                    onChange={(e) => setVehicleFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">すべての車両</option>
                    {uniqueVehicles.map(vehicle => (
                      <option key={vehicle} value={vehicle}>{vehicle}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    運行日
                  </label>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-900 mb-2">
                運行記録一覧 ({filteredRecords.length}件)
              </h3>
            </div>

            <Table
              columns={columns}
              data={tableData}
              loading={loading}
              emptyMessage="運行記録が見つかりません"
            />
          </div>
        </div>

        {/* 詳細表示モーダル */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="運行記録詳細"
          size="lg"
        >
          {selectedRecord && (
            <div className="space-y-6">
              {/* 基本情報 */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-blue-900 mb-3 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  基本情報
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">運行日:</span>
                    <span className="ml-2">{new Date(selectedRecord.date).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">ステータス:</span>
                    <span className="ml-2">{getStatusBadge(selectedRecord.status)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">運転手:</span>
                    <span className="ml-2">{selectedRecord.driverName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">車両:</span>
                    <span className="ml-2">{selectedRecord.vehicleNumber}</span>
                  </div>
                </div>
              </div>

              {/* 運行情報 */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-green-900 mb-3 flex items-center">
                  <Truck className="w-5 h-5 mr-2" />
                  運行情報
                </h3>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">走行距離:</span>
                    <span className="ml-2">{selectedRecord.distance}km</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">運行時間:</span>
                    <span className="ml-2">{selectedRecord.operationTime}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">荷物種別:</span>
                    <span className="ml-2">{selectedRecord.cargoType}</span>
                  </div>
                </div>
              </div>

              {/* 場所情報 */}
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-orange-900 mb-3 flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  場所情報
                </h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">客先名:</span>
                    <span className="ml-2">{selectedRecord.clientName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">積込場所:</span>
                    <span className="ml-2">{selectedRecord.loadingLocation}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">積下場所:</span>
                    <span className="ml-2">{selectedRecord.unloadingLocation}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  閉じる
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  );
};

export default OperationRecords;