// frontend/mobile/src/pages/OperationMain.tsx
// D4: 運行中画面 - 仕様概案書完全準拠版

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  MapPin, 
  Package, 
  Coffee,
  Fuel,
  Home,
  Navigation,
  Clock,
  Loader2,
  Play,
  Pause,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiService from '../services/api';

// 運行状態
type OperationStatus = 'running' | 'resting' | 'loading' | 'unloading' | 'refueling';

interface OperationState {
  id: string | null;
  status: OperationStatus;
  startTime: Date | null;
  elapsedSeconds: number;
  currentLatitude: number;
  currentLongitude: number;
  distanceTraveled: number;
}

interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

const OperationMain: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  // 運行状態
  const [operation, setOperation] = useState<OperationState>({
    id: null,
    status: 'running',
    startTime: new Date(),
    elapsedSeconds: 0,
    currentLatitude: 35.6812,  // デフォルト位置(東京)
    currentLongitude: 139.7671,
    distanceTraveled: 0
  });
  
  // GPS状態
  const [gpsPosition, setGpsPosition] = useState<GPSPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  
  // UI状態
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(true);
  
  // Refs
  const watchIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // 認証チェック
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    
    // 点検完了チェック
    const inspectionCompleted = sessionStorage.getItem('inspection_completed');
    if (!inspectionCompleted) {
      toast.error('乗車前点検を完了してください');
      navigate('/pre-departure-inspection', { replace: true });
      return;
    }
    
    // 運行開始
    startOperation();
  }, [isAuthenticated, navigate]);

  // タイマー開始
  useEffect(() => {
    if (operation.status === 'running' && operation.startTime) {
      timerIntervalRef.current = setInterval(() => {
        setOperation(prev => ({
          ...prev,
          elapsedSeconds: Math.floor((new Date().getTime() - (prev.startTime?.getTime() || 0)) / 1000)
        }));
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [operation.status, operation.startTime]);

  // GPS追跡開始
  useEffect(() => {
    if (isTracking) {
      startGPSTracking();
    } else {
      stopGPSTracking();
    }
    
    return () => {
      stopGPSTracking();
    };
  }, [isTracking]);

  // 運行開始
  const startOperation = async () => {
    setIsLoading(true);
    
    try {
      const vehicleId = sessionStorage.getItem('selected_vehicle_id');
      if (!vehicleId) {
        throw new Error('車両情報が見つかりません');
      }
      
      // バックエンドAPI呼び出し(実装例)
      const response = await apiService.startOperation({
        vehicleId: vehicleId,
        driverId: user?.id || '',
        startLatitude: operation.currentLatitude,
        startLongitude: operation.currentLongitude,
        startLocation: '出発地点',
        cargoInfo: '土砂'
      });
      
      if (response.success && response.data) {
        setOperation(prev => ({
          ...prev,
          id: response.data.id,
          startTime: new Date()
        }));
        
        toast.success('運行を開始しました');
      }
    } catch (error: any) {
      console.error('運行開始エラー:', error);
      toast.error('運行開始に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // GPS追跡開始
  const startGPSTracking = () => {
    if (!navigator.geolocation) {
      setGpsError('お使いのブラウザは位置情報をサポートしていません');
      return;
    }
    
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPosition: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp)
        };
        
        setGpsPosition(newPosition);
        setGpsError(null);
        setIsGpsActive(true);
        
        // 運行状態更新
        setOperation(prev => ({
          ...prev,
          currentLatitude: newPosition.latitude,
          currentLongitude: newPosition.longitude
        }));
        
        // バックエンドにGPS位置を送信
        sendGPSToBackend(newPosition);
      },
      (error) => {
        console.error('GPS エラー:', error);
        setGpsError(getGPSErrorMessage(error.code));
        setIsGpsActive(false);
      },
      options
    );
  };

  // GPS追跡停止
  const stopGPSTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsGpsActive(false);
    }
  };

  // GPSエラーメッセージ取得
  const getGPSErrorMessage = (code: number): string => {
    switch (code) {
      case 1:
        return '位置情報の利用が許可されていません';
      case 2:
        return '位置情報を取得できませんでした';
      case 3:
        return '位置情報の取得がタイムアウトしました';
      default:
        return '不明なエラーが発生しました';
    }
  };

  // バックエンドにGPS位置を送信
  const sendGPSToBackend = async (position: GPSPosition) => {
    try {
      await apiService.updateGPSLocation({
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        timestamp: position.timestamp.toISOString(),
        operationId: operation.id || undefined,
        vehicleId: sessionStorage.getItem('selected_vehicle_id') || undefined
      });
    } catch (error) {
      console.error('GPS送信エラー:', error);
    }
  };

  // 経過時間のフォーマット
  const formatElapsedTime = (): string => {
    const hours = Math.floor(operation.elapsedSeconds / 3600);
    const minutes = Math.floor((operation.elapsedSeconds % 3600) / 60);
    const seconds = operation.elapsedSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 積込場所到着
  const handleLoadingArrival = () => {
    setOperation(prev => ({ ...prev, status: 'loading' }));
    toast.success('積込場所に到着しました');
    // 積込場所画面へ遷移(実装時)
    // navigate('/loading-location');
  };

  // 積降場所到着
  const handleUnloadingArrival = () => {
    setOperation(prev => ({ ...prev, status: 'unloading' }));
    toast.success('積降場所に到着しました');
    // 積降場所画面へ遷移(実装時)
    // navigate('/unloading-location');
  };

  // 休憩・荷待ち
  const handleRest = () => {
    if (operation.status === 'resting') {
      setOperation(prev => ({ ...prev, status: 'running' }));
      toast.success('運行を再開しました');
    } else {
      setOperation(prev => ({ ...prev, status: 'resting' }));
      toast.success('休憩を開始しました');
    }
  };

  // 給油
  const handleRefueling = () => {
    setOperation(prev => ({ ...prev, status: 'refueling' }));
    toast.success('給油を記録します');
    // 給油画面へ遷移(実装時)
    // navigate('/refueling');
  };

  // 車庫到着
  const handleGarageArrival = () => {
    toast.success('車庫に到着しました');
    // 乗車後点検画面へ遷移(実装時)
    // navigate('/post-departure-inspection');
  };

  // ステータス表示用のテキスト
  const getStatusText = (): string => {
    switch (operation.status) {
      case 'running':
        return '運行中';
      case 'resting':
        return '休憩中';
      case 'loading':
        return '積込中';
      case 'unloading':
        return '積降中';
      case 'refueling':
        return '給油中';
      default:
        return '運行中';
    }
  };

  // ステータス表示用の色
  const getStatusColor = (): string => {
    switch (operation.status) {
      case 'running':
        return 'bg-blue-600';
      case 'resting':
        return 'bg-gray-600';
      case 'loading':
        return 'bg-orange-600';
      case 'unloading':
        return 'bg-purple-600';
      case 'refueling':
        return 'bg-yellow-600';
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className={`${getStatusColor()} text-white shadow-lg`}>
        <div className="max-w-md mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Navigation className="w-7 h-7" />
              <h1 className="text-xl font-bold">{getStatusText()}</h1>
            </div>
            <div className="text-sm">
              {user?.name}
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-md mx-auto w-full px-6 py-6 overflow-y-auto">
        {/* 運行時間・GPS表示カード */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          {/* 経過時間 */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">運行時間</span>
            </div>
            <div className={`text-2xl font-bold ${
              operation.status === 'resting' ? 'text-gray-400' : 'text-blue-600'
            }`}>
              {formatElapsedTime()}
            </div>
          </div>
          
          {/* GPS状態 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className={`w-5 h-5 ${isGpsActive ? 'text-green-600' : 'text-red-600'}`} />
                <span className="text-sm font-semibold text-gray-700">GPS状態</span>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                isGpsActive 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {isGpsActive ? '取得中' : '未取得'}
              </span>
            </div>
            
            {gpsError && (
              <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">{gpsError}</p>
              </div>
            )}
            
            {gpsPosition && (
              <div className="text-xs text-gray-500 space-y-1">
                <p>緯度: {gpsPosition.latitude.toFixed(6)}</p>
                <p>経度: {gpsPosition.longitude.toFixed(6)}</p>
                <p>精度: ±{gpsPosition.accuracy.toFixed(0)}m</p>
              </div>
            )}
          </div>
        </div>

        {/* 簡易マップ表示(プレースホルダー) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">現在地マップ</h3>
            <span className="text-xs text-gray-500">Google Maps</span>
          </div>
          
          <div 
            ref={mapContainerRef}
            className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl 
              flex items-center justify-center border-2 border-blue-300"
          >
            <div className="text-center">
              <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-2 animate-bounce" />
              <p className="text-sm font-semibold text-blue-800">GPS追跡中...</p>
              <p className="text-xs text-blue-600 mt-1">
                {isGpsActive ? '位置情報を取得しています' : '位置情報を許可してください'}
              </p>
            </div>
          </div>
        </div>

        {/* 操作ボタングループ */}
        <div className="space-y-3">
          {/* 積込場所到着 */}
          <button
            onClick={handleLoadingArrival}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 
              hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl
              shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200
              flex items-center justify-center space-x-3"
          >
            <Package className="w-5 h-5" />
            <span>積込場所到着</span>
          </button>

          {/* 積降場所到着 */}
          <button
            onClick={handleUnloadingArrival}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 
              hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl
              shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200
              flex items-center justify-center space-x-3"
          >
            <Package className="w-5 h-5" />
            <span>積降場所到着</span>
          </button>

          {/* 休憩・荷待ち */}
          <button
            onClick={handleRest}
            className={`w-full py-4 font-semibold rounded-xl shadow-md hover:shadow-lg 
              active:scale-[0.98] transition-all duration-200 flex items-center justify-center space-x-3
              ${operation.status === 'resting'
                ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
          >
            {operation.status === 'resting' ? (
              <>
                <Play className="w-5 h-5" />
                <span>運行再開</span>
              </>
            ) : (
              <>
                <Coffee className="w-5 h-5" />
                <span>休憩・荷待ち</span>
              </>
            )}
          </button>

          {/* 給油 */}
          <button
            onClick={handleRefueling}
            className="w-full py-4 bg-gray-200 hover:bg-gray-300 text-gray-800 
              font-semibold rounded-xl shadow-md hover:shadow-lg active:scale-[0.98]
              transition-all duration-200 flex items-center justify-center space-x-3"
          >
            <Fuel className="w-5 h-5" />
            <span>給油</span>
          </button>

          {/* 車庫到着 */}
          <button
            onClick={handleGarageArrival}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 
              hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl
              shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200
              flex items-center justify-center space-x-3"
          >
            <Home className="w-5 h-5" />
            <span>車庫到着</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default OperationMain;