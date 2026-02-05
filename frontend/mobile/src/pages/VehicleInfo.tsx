// frontend/mobile/src/pages/VehicleInfo.tsx
// D2: 車両情報画面 - データベース連携版

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useOperationStore } from '../stores/operationStore';

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
import axios from 'axios';

// ✅ 修正: バックエンドAPIのレスポンス型に合わせる
interface VehicleData {
  id: string;  // UUID形式
  plateNumber: string;
  vehicleType: string;
  model: string;
  manufacturer: string;
  currentMileage: number;
  status: string;
  notes?: string;
}

// ✅ 修正: 表示用の車両データ型
interface VehicleDisplay {
  id: string;
  vehicleNumber: string;  // 表示用(車番)
  vehicleType: string;
  currentMileage: number;
  lastDriver?: string;
  lastOperationDate?: string;
}

const VehicleInfo: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  // 別名をつけて Store の関数を取得
  const { setVehicleInfo: saveVehicleToStore, setDriverInfo: saveDriverToStore } = useOperationStore();
  
  const [vehicles, setVehicles] = useState<VehicleDisplay[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState<VehicleDisplay | null>(null);
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

  // ✅ 修正: 実際にAPIから車両データを取得
  const fetchVehicles = async () => {
    setIsFetching(true);
    try {
      console.log('🔍 車両情報を取得中...');
      console.log('📡 API Base URL:', import.meta.env.VITE_API_BASE_URL);
      
      // ✅ 修正: axiosを直接使用してAPIを呼び出す
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1';
      const token = apiService.getToken();
      
      const axiosInstance = axios.create({
        baseURL,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      // GET /api/v1/mobile/vehicles (モバイル専用 - 高速)
      const response = await axiosInstance.get('/mobile/vehicles', {
        params: {
          page: 1,
          limit: 100
        }
      });
      
      console.log('📦 APIレスポンス:', response.data);
      
      if (response.data.success && response.data.data) {
        // ✅ バックエンドからのデータを変換
        const apiVehicles = response.data.data.vehicles || response.data.data;
        
        if (!Array.isArray(apiVehicles)) {
          console.error('❌ 車両データが配列ではありません:', apiVehicles);
          throw new Error('車両データの形式が不正です');
        }
        
        // ✅ APIレスポンスを表示用データに変換
        const vehicleList: VehicleDisplay[] = apiVehicles.map((v: VehicleData) => {
          // notesから運転手名と最終運行日を抽出(存在する場合)
          let lastDriver: string | undefined;
          let lastOperationDate: string | undefined;
          
          if (v.notes) {
            const driverMatch = v.notes.match(/運転手[:：]\s*([^\s/]+)/);
            const dateMatch = v.notes.match(/最終運行[:：]\s*(\d{4}-\d{2}-\d{2})/);
            
            // ✅ 修正: undefinedチェックを追加
            if (driverMatch && driverMatch[1]) {
              lastDriver = driverMatch[1];
            }
            if (dateMatch && dateMatch[1]) {
              lastOperationDate = dateMatch[1];
            }
          }
          
          return {
            id: v.id,  // ✅ UUID形式のIDをそのまま使用
            vehicleNumber: v.plateNumber,  // 車番(ナンバープレート)
            vehicleType: v.vehicleType || v.model || '未設定',  // 🆕 フォールバック追加
            currentMileage: v.currentMileage,
            lastDriver: lastDriver || '未割当',
            lastOperationDate: lastOperationDate || '－'
          };
        });
        
        console.log('✅ 車両リスト取得成功:', vehicleList);
        setVehicles(vehicleList);
        
        // ✅ ユーザーに割り当てられた車両がある場合は自動選択
        if (user?.vehicleId && vehicleList.length > 0) {
          const assignedVehicle = vehicleList.find(v => v.id === user.vehicleId);
          if (assignedVehicle) {
            setSelectedVehicleId(assignedVehicle.id);
            setVehicleInfo(assignedVehicle);
            setStartMileage(assignedVehicle.currentMileage.toString());
          }
        }
      } else {
        console.error('❌ APIレスポンスが不正:', response.data);
        throw new Error('車両データの取得に失敗しました');
      }
      
    } catch (error: any) {
      console.error('❌ 車両情報取得エラー:', error);
      
      // ✅ エラーメッセージを詳細に表示
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error(
          'サーバーの応答がタイムアウトしました。\n' +
          'バックエンドサーバーの状態を確認してください。',
          { duration: 6000 }
        );
      } else if (error.message?.includes('Network Error') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        toast.error(
          'サーバーに接続できません。\n' +
          'バックエンドサーバーが起動しているか確認してください。',
          { duration: 6000 }
        );
      } else if (error.response?.status === 401) {
        toast.error('認証エラー: 再ログインが必要です');
        logout();
        navigate('/login', { replace: true });
        return;
      } else if (error.response?.status === 404) {
        toast.error('車両情報のAPIエンドポイントが見つかりません');
      } else {
        toast.error(
          `車両情報の取得に失敗しました\n${error.message}`,
          { duration: 6000 }
        );
      }
      
      // ✅ エラー時は空のリストを設定
      setVehicles([]);
      
    } finally {
      setIsFetching(false);
    }
  };

  // ✅ 車両選択時の処理
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
    
    // ✅ operationStoreに車両情報を保存（sessionStorageは使わない）
    if (vehicleInfo) {
      saveVehicleToStore({
        vehicleId: selectedVehicleId,
        vehicleNumber: vehicleInfo.vehicleNumber,
        vehicleType: vehicleInfo.vehicleType,
        startMileage: parseInt(startMileage)
      });
      
      if (user) {
        saveDriverToStore({
          driverId: user.id,
          driverName: user.name
        });
      }
      
      toast.success('車両情報を保存しました');
      navigate('/pre-departure-inspection');
    } else {
      toast.error('車両情報の取得に失敗しました');
    }
  };

  // ✅ 修正: ログアウトせずにHome画面に戻る
  const handleBack = () => {
    navigate('/home');
  };

  // ✅ ローディング中の表示
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

  // ✅ 車両データが取得できなかった場合の表示
  if (vehicles.length === 0) {
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
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-center py-8">
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">利用可能な車両がありません</p>
              <button
                onClick={() => fetchVehicles()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                再読み込み
              </button>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl
                hover:bg-gray-300 transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>戻る</span>
            </button>
          </div>
        </main>
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
          {/* ✅ 車番選択 */}
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
                  {vehicle.vehicleNumber} ({vehicle.vehicleType})
                </option>
              ))}
            </select>
          </div>

          {/* ✅ 選択した車両の詳細情報 */}
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
                    transition-all duration-200 text-gray-800 font-medium"
                />
                <p className="mt-2 text-sm text-gray-500">
                  前回終了距離: <span className="font-semibold">{vehicleInfo.currentMileage.toLocaleString()} km</span>
                </p>
              </div>

              <div className="animate-fade-in grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">運転手名</label>
                  <div className="text-sm font-medium text-gray-800">
                    {user?.name || '未設定'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    前回運転手
                  </label>
                  <div className="text-sm font-medium text-gray-800">
                    {vehicleInfo.lastDriver || '－'}
                  </div>
                </div>
              </div>

              {vehicleInfo.lastOperationDate && (
                <div className="animate-fade-in">
                  <label className="block text-xs text-gray-500 mb-1">最終運行日</label>
                  <div className="text-sm font-medium text-gray-800">
                    {vehicleInfo.lastOperationDate}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ✅ 進む・戻るボタン */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl
              hover:bg-gray-300 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>

          <button
            onClick={handleNext}
            disabled={!selectedVehicleId || !startMileage}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700
              text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200
              font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>進む</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default VehicleInfo;