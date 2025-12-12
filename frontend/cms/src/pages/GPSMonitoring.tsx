import React, { useState, useEffect } from 'react';
import { RefreshCw, MapPin, Truck, Clock, Navigation } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

interface VehicleLocation {
  id: string;
  vehicleNumber: string;
  driverName: string;
  latitude: number;
  longitude: number;
  status: 'driving' | 'loading' | 'unloading' | 'break' | 'refueling' | 'offline';
  lastUpdate: string;
  speed: number;
  currentAddress: string;
}

const GPSMonitoring: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ダミーデータ
  const mockVehicles: VehicleLocation[] = [
    {
      id: '1',
      vehicleNumber: '倉敷500あ1234',
      driverName: '山田太郎',
      latitude: 34.6617,
      longitude: 133.9349,
      status: 'driving',
      lastUpdate: new Date().toISOString(),
      speed: 45,
      currentAddress: '岡山県倉敷市中央町1-1'
    },
    {
      id: '2',
      vehicleNumber: '倉敷500あ5678',
      driverName: '佐藤花子',
      latitude: 34.6851,
      longitude: 133.9198,
      status: 'loading',
      lastUpdate: new Date(Date.now() - 300000).toISOString(),
      speed: 0,
      currentAddress: '岡山県倉敷市玉島中央町2-1-1'
    },
    {
      id: '3',
      vehicleNumber: '倉敷500あ9012',
      driverName: '鈴木次郎',
      latitude: 34.6519,
      longitude: 133.9165,
      status: 'break',
      lastUpdate: new Date(Date.now() - 900000).toISOString(),
      speed: 0,
      currentAddress: '岡山県倉敷市西阿知町新田1-1-1'
    }
  ];

  useEffect(() => {
    setVehicles(mockVehicles);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    // 実際のAPIコールをシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastRefresh(new Date());
    setLoading(false);
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = 
      vehicle.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.currentAddress.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || vehicle.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: string) => {
    const statusConfig = {
      driving: { label: '運転中', className: 'bg-blue-100 text-blue-800', icon: '🚛' },
      loading: { label: '積込中', className: 'bg-orange-100 text-orange-800', icon: '📦' },
      unloading: { label: '積下中', className: 'bg-purple-100 text-purple-800', icon: '📤' },
      break: { label: '休憩中', className: 'bg-yellow-100 text-yellow-800', icon: '☕' },
      refueling: { label: '給油中', className: 'bg-green-100 text-green-800', icon: '⛽' },
      offline: { label: 'オフライン', className: 'bg-gray-100 text-gray-800', icon: '📵' }
    };

    return statusConfig[status as keyof typeof statusConfig] || statusConfig.offline;
  };

  const getTimeSinceUpdate = (lastUpdate: string) => {
    const now = new Date();
    const updateTime = new Date(lastUpdate);
    const diffInMinutes = Math.floor((now.getTime() - updateTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return '1分未満前';
    if (diffInMinutes < 60) return `${diffInMinutes}分前`;
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}時間前`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">GPSモニタリング</h1>
        <Button 
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      <div className="text-sm text-gray-600">
        リアルタイム位置追跡・位置情報管理
        <br />
        最終更新: {lastRefresh.toLocaleString('ja-JP')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 地図表示エリア */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              地図表示 (5台)
            </h2>
            
            {/* 地図プレースホルダー */}
            <div className="relative bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center">
                <Navigation className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                <p className="text-lg font-medium text-gray-700">Google Maps Integration</p>
                <p className="text-sm text-gray-500">車両の現在位置をリアルタイムで表示</p>
              </div>
              
              {/* ステータス凡例 */}
              <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-sm">
                <div className="text-sm font-medium text-gray-700 mb-2">ステータス</div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center"><span className="mr-2">🚛</span>運転中: 2台</div>
                  <div className="flex items-center"><span className="mr-2">📦</span>積込中: 1台</div>
                  <div className="flex items-center"><span className="mr-2">☕</span>休憩中: 1台</div>
                  <div className="flex items-center"><span className="mr-2">📵</span>オフライン: 1台</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 車両一覧 */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Truck className="w-5 h-5 mr-2" />
              車両一覧 (3台)
            </h2>

            {/* 検索・フィルター */}
            <div className="space-y-3 mb-6">
              <Input
                type="text"
                placeholder="車番、運転手名、住所で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">すべてのステータス</option>
                <option value="driving">運転中</option>
                <option value="loading">積込中</option>
                <option value="unloading">積下中</option>
                <option value="break">休憩中</option>
                <option value="refueling">給油中</option>
                <option value="offline">オフライン</option>
              </select>
            </div>

            {/* 車両リスト */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredVehicles.map(vehicle => {
                const statusConfig = getStatusConfig(vehicle.status);
                return (
                  <div 
                    key={vehicle.id} 
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.vehicleNumber}
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig.className}`}>
                        {statusConfig.icon} {statusConfig.label}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-1">
                      👤 {vehicle.driverName}
                    </div>
                    
                    <div className="text-xs text-gray-500 mb-2">
                      📍 {vehicle.currentAddress}
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimeSinceUpdate(vehicle.lastUpdate)}
                      </div>
                      {vehicle.status === 'driving' && (
                        <div className="flex items-center">
                          <span className="mr-1">🚗</span>
                          {vehicle.speed}km/h
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredVehicles.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>条件に一致する車両がありません</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPSMonitoring;