// frontend/mobile/src/pages/OperationMain.tsx
// D4: 運行中画面 - F5リロード対応版（運行中なら復元、未運行なら開始）

import React, { useState, useEffect, useRef } from 'react';
import { useTLog } from '../hooks/useTLog';
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
  Play,
  AlertCircle,
  Loader2
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
  useTLog('OPERATION_MAIN', '運行メイン');

  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  // 運行状態
  const [operation, setOperation] = useState<OperationState>({
    id: null,
    status: 'running',
    startTime: null,
    elapsedSeconds: 0,
    currentLatitude: 35.6812,
    currentLongitude: 139.7671,
    distanceTraveled: 0
  });
  
  // GPS状態
  const [gpsPosition, setGpsPosition] = useState<GPSPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [isTracking] = useState(true);
  
  // ✅ 追加: API送信中・初期化中フラグ
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Refs
  const watchIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // ✅ 追加: 初期化済みフラグ（React Strict Mode対応）
  const initializedRef = useRef(false);

  // ========================================================================
  // ✅ 修正: 初期化処理 - 運行中チェック → 復元 or 新規開始
  // ========================================================================
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    
    const inspectionCompleted = sessionStorage.getItem('inspection_completed');
    if (!inspectionCompleted) {
      toast.error('乗車前点検を完了してください');
      navigate('/pre-departure-inspection', { replace: true });
      return;
    }
    
    // ✅ 一度だけ実行
    if (!initializedRef.current) {
      initializedRef.current = true;
      initializeOperation();
    }
  }, [isAuthenticated, navigate]);

  // ========================================================================
  // ✅ 新規追加: 運行初期化処理
  // ========================================================================
  const initializeOperation = async () => {
    setIsInitializing(true);
    
    try {
      console.log('🔄 運行状態を確認中...');
      
      // ✅ 現在の運行中データを取得
      const response = await apiService.getCurrentOperation();
      
      if (response.success && response.data) {
        // ✅ 運行中データが存在 → 復元
        console.log('✅ 運行中データを復元:', response.data);
        
        const currentOp = response.data;
        const startTime = currentOp.startTime ? new Date(currentOp.startTime) : new Date();
        
        setOperation({
          id: currentOp.tripId || currentOp.id,
          status: 'running',
          startTime: startTime,
          elapsedSeconds: Math.floor((Date.now() - startTime.getTime()) / 1000),
          currentLatitude: 35.6812,
          currentLongitude: 139.7671,
          distanceTraveled: currentOp.totalDistance || 0
        });
        
        toast.success('運行中データを復元しました', { duration: 2000 });
      } else {
        // ✅ 運行中データなし → 新規運行開始
        console.log('📝 運行中データなし。新規運行を開始します');
        await startNewOperation();
      }
    } catch (error: any) {
      console.error('❌ 運行状態確認エラー:', error);
      
      // エラーが404（運行なし）の場合は新規開始
      if (error?.response?.status === 404) {
        console.log('📝 運行データが見つかりません。新規運行を開始します');
        await startNewOperation();
      } else {
        toast.error('運行状態の確認に失敗しました');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  // ========================================================================
  // ✅ 新規追加: 新規運行開始
  // ========================================================================
  const startNewOperation = async () => {
    if (isSubmitting) {
      console.warn('⚠️ 既に運行開始処理中です');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const vehicleId = sessionStorage.getItem('selected_vehicle_id');
      if (!vehicleId) {
        throw new Error('車両情報が見つかりません');
      }
      
      console.log('📍 新規運行開始リクエスト送信...', {
        vehicleId,
        driverId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      const response = await apiService.startOperation({
        vehicleId: vehicleId,
        driverId: user?.id || '',
        startLatitude: operation.currentLatitude,
        startLongitude: operation.currentLongitude,
        startLocation: '出発地点',
        cargoInfo: '土砂'
      });
      
      if (response.success && response.data?.id) {
        setOperation(prev => ({
          ...prev,
          id: response.data?.id || null,
          startTime: new Date()
        }));
        
        toast.success('運行を開始しました');
        console.log('✅ 運行開始成功:', response.data);
      }
    } catch (error: any) {
      console.error('❌ 運行開始エラー:', error);
      
      if (error?.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error('運行開始に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
    if (isTracking && !isInitializing) {
      startGPSTracking();
    } else {
      stopGPSTracking();
    }
    
    return () => {
      stopGPSTracking();
    };
  }, [isTracking, isInitializing]);

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
        
        setOperation(prev => ({
          ...prev,
          currentLatitude: newPosition.latitude,
          currentLongitude: newPosition.longitude
        }));
        
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
  };

  // 積降場所到着
  const handleUnloadingArrival = () => {
    setOperation(prev => ({ ...prev, status: 'unloading' }));
    toast.success('積降場所に到着しました');
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
  };

  // 車庫到着
  const handleGarageArrival = () => {
    toast.success('車庫に到着しました');
  };

  // ステータス表示用のテキスト
  const getStatusText = (): string => {
    if (isInitializing) return '初期化中...';
    
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
    if (isInitializing) return 'bg-gray-500';
    
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

  // ✅ ローディング画面
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-700 font-semibold">運行状態を確認中...</p>
          <p className="text-gray-500 text-sm mt-2">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

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

        {/* 簡易マップ表示 */}
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

          <button
            onClick={handleRefueling}
            className="w-full py-4 bg-gray-200 hover:bg-gray-300 text-gray-800 
              font-semibold rounded-xl shadow-md hover:shadow-lg active:scale-[0.98]
              transition-all duration-200 flex items-center justify-center space-x-3"
          >
            <Fuel className="w-5 h-5" />
            <span>給油</span>
          </button>

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