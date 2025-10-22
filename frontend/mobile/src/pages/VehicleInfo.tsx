// frontend/mobile/src/pages/VehicleInfo.tsx
// D2: 車両情報画面 - 修正版

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  Truck, 
  ArrowRight, 
  ArrowLeft, 
  Loader2,
  User,
  Calendar,
  Gauge
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiService from '../services/api';

interface VehicleData {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  currentMileage: number;
  lastDriver: string;
  lastOperationDate: string;
}

const VehicleInfo: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState<VehicleData | null>(null);
  const [startMileage, setStartMileage] = useState('');
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setIsFetching(true);
    try {
      console.log('🔍 車両情報を取得中...');
      console.log('📡 API Base URL:', import.meta.env.VITE_API_BASE_URL);
      
      // ✅ リトライ機能付きで呼び出し
      const response = await apiService.getVehicleInfo(3); // 3回リトライ
      
      if (response.success && response.data) {
        const dummyVehicles: VehicleData[] = [
          {
            id: '1',
            vehicleNumber: '1号車',
            vehicleType: '4tダンプ',
            currentMileage: 12345,
            lastDriver: '田中太郎',
            lastOperationDate: '2025-10-21'
          },
          {
            id: '2',
            vehicleNumber: '2号車',
            vehicleType: '大型ダンプ',
            currentMileage: 98765,
            lastDriver: '山田花子',
            lastOperationDate: '2025-10-21'
          },
          {
            id: '3',
            vehicleNumber: '3号車',
            vehicleType: '中型ダンプ',
            currentMileage: 45678,
            lastDriver: '佐藤次郎',
            lastOperationDate: '2025-10-20'
          }
        ];
        
        setVehicles(dummyVehicles);
        
        if (user?.vehicleId) {
          setSelectedVehicleId(user.vehicleId);
          const vehicle = dummyVehicles.find(v => v.id === user.vehicleId);
          if (vehicle) {
            setVehicleInfo(vehicle);
            setStartMileage(vehicle.currentMileage.toString());
          }
        }
        
        console.log('✅ 車両情報取得成功');
      }
    } catch (error: any) {
      console.error('❌ 車両情報取得エラー:', error);
      
      // ✅ より詳細なエラーメッセージ
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error(
          'サーバーの応答がタイムアウトしました。\n' +
          'バックエンドサーバーの状態を確認してください。\n' +
          '（URL: ' + (import.meta.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1') + '）',
          { duration: 8000 }
        );
      } else if (error.message?.includes('Network Error') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        toast.error(
          'ネットワークエラーが発生しました。\n' +
          'HTTPSサーバーが起動しているか確認してください。\n' +
          '（ポート: 8443）',
          { duration: 8000 }
        );
      } else if (error.response?.status === 401) {
        toast.error('認証エラー: 再ログインが必要です');
        logout();
        navigate('/login');
      } else if (error.message?.includes('certificate')) {
        toast.error(
          'SSL証明書エラーが発生しました。\n' +
          'ブラウザでhttps://10.1.119.244:8443を開いて証明書を信頼してください。',
          { duration: 10000 }
        );
      } else {
        toast.error(`車両情報の取得に失敗しました: ${error.message}`, { duration: 6000 });
      }
    } finally {
      setIsFetching(false);
    }
  };

  const handleVehicleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vehicleId = e.target.value;
    setSelectedVehicleId(vehicleId);
    
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setVehicleInfo(vehicle);
      setStartMileage(vehicle.currentMileage.toString());
    } else {
      setVehicleInfo(null);
      setStartMileage('');
    }
  };

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setStartMileage(value);
  };

  const validateForm = (): boolean => {
    if (!selectedVehicleId) {
      toast.error('車番を選択してください');
      return false;
    }
    
    if (!startMileage || parseInt(startMileage) <= 0) {
      toast.error('開始距離を入力してください');
      return false;
    }
    
    if (vehicleInfo && parseInt(startMileage) < vehicleInfo.currentMileage) {
      toast.error('開始距離は前回終了距離以上である必要があります');
      return false;
    }
    
    return true;
  };

  const handleNext = () => {
    if (!validateForm()) {
      return;
    }
    
    sessionStorage.setItem('selected_vehicle_id', selectedVehicleId);
    sessionStorage.setItem('start_mileage', startMileage);
    sessionStorage.setItem('vehicle_info', JSON.stringify(vehicleInfo));
    
    toast.success('車両情報を保存しました');
    navigate('/pre-departure-inspection');
  };

  const handleBack = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">車両情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-md mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Truck className="w-7 h-7" />
              <h1 className="text-xl font-bold">車両情報</h1>
            </div>
            <div className="text-sm text-blue-100">
              <User className="w-4 h-4 inline mr-1" />
              {user?.name}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              車番
            </label>
            <select
              value={selectedVehicleId}
              onChange={handleVehicleChange}
              className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-all duration-200 text-gray-800 font-medium cursor-pointer"
            >
              <option value="">車両を選択してください</option>
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.vehicleNumber}
                </option>
              ))}
            </select>
          </div>

          {vehicleInfo && (
            <>
              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  車種
                </label>
                <div className="px-4 py-3.5 bg-blue-50 border-2 border-blue-200 rounded-xl
                  text-gray-800 font-medium flex items-center justify-between">
                  <span>{vehicleInfo.vehicleType}</span>
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <Gauge className="w-4 h-4 mr-2 text-gray-600" />
                  開始距離 (km)
                </label>
                <input
                  type="text"
                  value={startMileage}
                  onChange={handleMileageChange}
                  placeholder="開始距離を入力"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200 text-gray-800 font-medium text-right text-lg"
                />
                <p className="mt-2 text-sm text-gray-500">
                  前回終了距離: {vehicleInfo.currentMileage.toLocaleString()} km
                </p>
              </div>

              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  運転手名
                </label>
                <div className="px-4 py-3.5 bg-green-50 border-2 border-green-200 rounded-xl
                  text-gray-800 font-medium flex items-center justify-between">
                  <span>{user?.name}</span>
                  <User className="w-5 h-5 text-green-600" />
                </div>
              </div>

              <div className="animate-fade-in bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-medium">前回運転手</span>
                  <span className="text-gray-800 font-semibold">{vehicleInfo.lastDriver}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600 font-medium flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    最終運行日
                  </span>
                  <span className="text-gray-800 font-semibold">{vehicleInfo.lastOperationDate}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={handleNext}
            disabled={!selectedVehicleId || !startMileage}
            className={`w-full py-4 rounded-xl font-semibold text-white text-lg
              transition-all duration-200 flex items-center justify-center space-x-3
              ${!selectedVehicleId || !startMileage
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] shadow-lg hover:shadow-xl'
              }`}
          >
            <span>進む</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={handleBack}
            className="w-full py-4 rounded-xl font-semibold text-gray-700 text-lg
              bg-gray-200 hover:bg-gray-300 active:scale-[0.98]
              transition-all duration-200 flex items-center justify-center space-x-3
              shadow-md hover:shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default VehicleInfo;