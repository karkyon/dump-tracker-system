// frontend/mobile/src/pages/OperationRecord.tsx
// 🚛 運行記録画面 - WebGLベクターマップ完全統合版
// 最終更新: 2025-10-24
// 
// 実装機能:
//  ✅ WebGLベクターマップ統合
//  ✅ カスタムSVGマーカー (速度・距離表示)
//  ✅ ヘッドアップ表示 (進行方向に地図回転)
//  ✅ 走行軌跡トレース (Polyline)
//  ✅ 方位インジケーター表示
//  ✅ 運行状態の自動復元
//  ✅ GPS位置更新の最適化 (スロットリング)
//  ✅ API型定義に完全準拠

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  Play, 
  Square, 
  MapPin, 
  Coffee, 
  Fuel,
  Navigation,
  Clock,
  Loader2,
  Home
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useGPS } from '../hooks/useGPS';
import apiService from '../services/api';
import GoogleMapWrapper, {
  updateMarkerIcon,
  updateMarkerPosition,
  panMapToPosition,
  setMapHeading,
  addPathPoint,
  clearPath
} from '../components/GoogleMapWrapper';
import HeadingIndicator from '../components/HeadingIndicator';

// 運行状態型定義
interface OperationState {
  id: string | null;
  status: 'idle' | 'running' | 'paused';
  startTime: Date | null;
  loadingArrived: boolean;
  unloadingArrived: boolean;
  distance: number;
  duration: number;
  averageSpeed: number;
}

// GPS更新のスロットリング用定数
const MAP_UPDATE_INTERVAL = 3000;    // 地図更新: 3秒に1回
const MARKER_UPDATE_INTERVAL = 5000; // マーカー更新: 5秒に1回

const OperationRecord: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  // 🗺️ Google Map関連のref
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  // ⏱️ 更新タイミング制御用
  const lastMapUpdateRef = useRef<number>(0);
  const lastMarkerUpdateRef = useRef<number>(0);
  
  // 運行状態
  const [operation, setOperation] = useState<OperationState>({
    id: null,
    status: 'idle',
    startTime: null,
    loadingArrived: false,
    unloadingArrived: false,
    distance: 0,
    duration: 0,
    averageSpeed: 0
  });
  
  // API送信中フラグ(二重送信防止)
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 時刻表示
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // 初期化済みフラグ
  const initializedRef = useRef(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // 🛰️ GPS追跡フックの使用
  const {
    currentPosition,
    isTracking,
    heading,
    speed,
    totalDistance,
    averageSpeed: gpsAverageSpeed,
    pathCoordinates,
    startTracking,
    stopTracking,
    error: gpsError
  } = useGPS({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
    autoStart: false,
    enableLogging: operation.id !== null,
    operationId: operation.id || undefined,
    vehicleId: user?.vehicleId,
  });

  // ========================================================================
  // 🔄 運行状態確認と復元
  // ========================================================================
  const checkAndRestoreOperation = async () => {
    setIsInitializing(true);
    
    try {
      console.log('🔄 運行状態を確認中...');
      
      const response = await apiService.getCurrentOperation();
      
      if (response.success && response.data) {
        // 運行中データが存在 → 復元
        console.log('✅ 運行中データを復元:', response.data);
        
        const currentOp = response.data;
        const startTime = currentOp.startTime ? new Date(currentOp.startTime) : new Date();
        
        setOperation({
          id: currentOp.tripId || currentOp.id,
          status: 'running',
          startTime: startTime,
          loadingArrived: false,
          unloadingArrived: false,
          distance: currentOp.totalDistance || 0,
          duration: Math.floor((Date.now() - startTime.getTime()) / 1000),
          averageSpeed: 0
        });
        
        // GPS追跡を開始
        await startTracking();

        toast.success('運行中データを復元しました', { duration: 2000 });
      } else {
        console.log('📝 運行中データなし。運行開始待機中');
        setOperation(prev => ({ ...prev, status: 'idle' }));
      }
    } catch (error: any) {
      console.error('❌ 運行状態確認エラー:', error);
      
      if (error?.response?.status === 404) {
        console.log('📝 運行データなし。運行開始待機中');
        setOperation(prev => ({ ...prev, status: 'idle' }));
      } else {
        toast.error('運行状態の確認に失敗しました');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  // ========================================================================
  // 🗺️ 地図準備完了時のコールバック
  // ========================================================================
  const handleMapReady = (map: any, marker: any, polyline: any) => {
    console.log('🗺️ 地図の準備が完了しました');
    mapInstanceRef.current = map;
    markerRef.current = marker;
    polylineRef.current = polyline;
    setIsMapReady(true);

    // 初期位置を設定
    if (currentPosition) {
      const pos = {
        lat: currentPosition.coords.latitude,
        lng: currentPosition.coords.longitude
      };
      try {
        map.setCenter(pos);
        marker.setPosition(pos);
      } catch (error) {
        console.error('Error setting initial position:', error);
      }
    }
  };

  // ========================================================================
  // 📍 GPS位置更新時の地図更新処理
  // ========================================================================
  useEffect(() => {
    if (!isMapReady || !currentPosition || operation.status !== 'running') return;

    const now = Date.now();
    const lat = currentPosition.coords.latitude;
    const lng = currentPosition.coords.longitude;

    // 🔄 地図の中心位置を更新 (スロットリング)
    if (now - lastMapUpdateRef.current > MAP_UPDATE_INTERVAL) {
      console.log('📍 地図の中心位置を更新:', { lat, lng });
      
      // 地図をパンニング
      panMapToPosition(lat, lng);
      
      // マーカー位置を更新
      updateMarkerPosition(lat, lng);
      
      // 🧭 ヘッドアップ表示: 進行方向に地図を回転
      if (heading !== null && !isNaN(heading) && speed && speed > 1) {
        console.log(`🧭 地図を回転: ${heading.toFixed(1)}°`);
        setMapHeading(heading);
      }
      
      // 🛤️ 走行軌跡に座標を追加
      addPathPoint(lat, lng);
      
      lastMapUpdateRef.current = now;
    }

    // 🚗 マーカーアイコンの更新 (より低頻度)
    if (now - lastMarkerUpdateRef.current > MARKER_UPDATE_INTERVAL) {
      console.log('🚗 マーカーアイコンを更新');
      const currentSpeed = speed || 0;
      updateMarkerIcon(totalDistance, currentSpeed);
      
      lastMarkerUpdateRef.current = now;
    }

    // 統計データ更新
    setOperation(prev => ({
      ...prev,
      distance: totalDistance,
      averageSpeed: gpsAverageSpeed
    }));

  }, [currentPosition, isMapReady, heading, speed, totalDistance, gpsAverageSpeed, operation.status]);

  // ========================================================================
  // 🚀 運行開始処理
  // ========================================================================
  const handleStartOperation = async () => {
    if (!currentPosition) {
      toast.error('GPS位置情報を取得してから開始してください');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await apiService.startOperation({
        vehicleId: user?.vehicleId || 'test-vehicle',
        driverId: user?.userId || 'test-driver',
        startLatitude: currentPosition.coords.latitude,
        startLongitude: currentPosition.coords.longitude,
        startLocation: '出発地',
      });

      if (response.success && response.data) {
        setOperation({
          id: response.data.id,
          status: 'running',
          startTime: new Date(response.data.startTime),
          loadingArrived: false,
          unloadingArrived: false,
          distance: 0,
          duration: 0,
          averageSpeed: 0
        });

        // GPS追跡を開始
        await startTracking();
        
        // 走行軌跡をクリア
        clearPath();
        
        toast.success('運行を開始しました');
      } else {
        throw new Error(response.message || '運行開始に失敗しました');
      }
    } catch (error: any) {
      console.error('❌ 運行開始エラー:', error);
      
      if (error?.response?.status === 401) {
        toast.error('認証エラー。再ログインしてください。', { duration: 5000 });
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else {
        toast.error('運行開始に失敗しました', { duration: 4000 });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // 🛑 運行終了処理
  // ========================================================================
  const handleEndOperation = async () => {
    if (!operation.id || !currentPosition) return;
    
    setIsSubmitting(true);
    
    try {
      await apiService.endOperation({
        operationId: operation.id,
        endLatitude: currentPosition.coords.latitude,
        endLongitude: currentPosition.coords.longitude,
        endLocation: '到着地',
        totalDistance: totalDistance,
      });
      
      // GPS追跡を停止
      stopTracking();
      
      // 走行軌跡をクリア
      clearPath();
      
      toast.success('運行を終了しました');
      
      // 状態をリセット
      setOperation({
        id: null,
        status: 'idle',
        startTime: null,
        loadingArrived: false,
        unloadingArrived: false,
        distance: 0,
        duration: 0,
        averageSpeed: 0
      });
    } catch (error) {
      console.error('運行終了エラー:', error);
      toast.error('運行終了に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // 📦 積込場所到着処理
  // ========================================================================
  const handleLoadingArrival = async () => {
    if (!operation.id || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      await apiService.recordAction({
        operationId: operation.id,
        actionType: 'LOADING_ARRIVAL',
        latitude: currentPosition?.coords.latitude || 0,
        longitude: currentPosition?.coords.longitude || 0,
        location: '積込場所',
      });
      
      setOperation(prev => ({ ...prev, loadingArrived: true }));
      toast.success('積込場所到着を記録しました');
    } catch (error) {
      console.error('積込場所到着記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // 🚚 積降場所到着処理
  // ========================================================================
  const handleUnloadingArrival = async () => {
    if (!operation.id || !operation.loadingArrived || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      await apiService.recordAction({
        operationId: operation.id,
        actionType: 'UNLOADING_ARRIVAL',
        latitude: currentPosition?.coords.latitude || 0,
        longitude: currentPosition?.coords.longitude || 0,
        location: '積降場所',
      });
      
      setOperation(prev => ({ ...prev, unloadingArrived: true }));
      toast.success('積降場所到着を記録しました');
    } catch (error) {
      console.error('積降場所到着記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // ☕ 休憩・荷待ち処理
  // ========================================================================
  const handleBreak = async () => {
    if (!operation.id || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      await apiService.recordAction({
        operationId: operation.id,
        actionType: 'BREAK',
        latitude: currentPosition?.coords.latitude || 0,
        longitude: currentPosition?.coords.longitude || 0,
        location: '休憩・荷待ち',
      });
      
      toast.success('休憩・荷待ちを記録しました');
    } catch (error) {
      console.error('休憩記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // ⛽ 給油処理
  // ========================================================================
  const handleRefuel = async () => {
    if (!operation.id || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      await apiService.recordAction({
        operationId: operation.id,
        actionType: 'REFUEL',
        latitude: currentPosition?.coords.latitude || 0,
        longitude: currentPosition?.coords.longitude || 0,
        location: '給油所',
      });
      
      toast.success('給油を記録しました');
    } catch (error) {
      console.error('給油記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================================
  // ⏰ 時刻更新
  // ========================================================================
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      if (operation.startTime && operation.status === 'running') {
        const elapsed = Date.now() - operation.startTime.getTime();
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setElapsedTime({ hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [operation.startTime, operation.status]);

  // ========================================================================
  // 🔄 ページロード時の運行状態チェック
  // ========================================================================
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      checkAndRestoreOperation();
    }
  }, []);

  // ========================================================================
  // 初期化中の表示
  // ========================================================================
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold">運行状態を確認中...</p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // JSX - メイン画面
  // ========================================================================
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between safe-area-inset-top">
        <div className="flex items-center">
          <Navigation className="w-6 h-6 mr-2" />
          <h1 className="text-lg font-bold">運行記録</h1>
        </div>
        <div className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-1" />
          {currentTime.toLocaleTimeString('ja-JP')}
        </div>
      </div>

      {/* 🗺️ 地図エリア - WebGLベクターマップ */}
      <div 
        className="relative w-full flex-1 overflow-hidden"
        style={{ 
          minHeight: '300px',
          maxHeight: 'calc(100vh - 400px)',
          backgroundColor: '#f3f4f6',
        }}
      >
        <GoogleMapWrapper
          onMapReady={handleMapReady}
          initialPosition={
            currentPosition
              ? {
                  lat: currentPosition.coords.latitude,
                  lng: currentPosition.coords.longitude,
                }
              : undefined
          }
        />
        
        {/* 🧭 方位インジケーター */}
        {heading !== null && (
          <HeadingIndicator 
            heading={heading} 
            className="absolute top-4 right-4"
          />
        )}
        
        {/* GPS状態表示 */}
        <div 
          className="absolute top-16 right-4 bg-white rounded-lg shadow-lg px-3 py-2 text-xs"
          style={{ zIndex: 100 }}
        >
          <div className={`flex items-center ${isTracking ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {isTracking ? 'GPS追跡中' : 'GPS停止中'}
          </div>
        </div>
      </div>
      
      {/* コントロールパネル */}
      <div className="bg-white px-4 py-4 border-t shadow-lg safe-area-inset-bottom" style={{ zIndex: 50 }}>
        {/* 運行情報 */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
          <div>
            <div className="text-gray-500">経過時間</div>
            <div className="font-bold text-lg">
              {operation.startTime ? 
                `${String(elapsedTime.hours).padStart(2, '0')}:${String(elapsedTime.minutes).padStart(2, '0')}:${String(elapsedTime.seconds).padStart(2, '0')}` 
                : '--:--:--'
              }
            </div>
          </div>
          <div>
            <div className="text-gray-500">走行距離</div>
            <div className="font-bold text-lg">{totalDistance.toFixed(1)} km</div>
          </div>
          <div>
            <div className="text-gray-500">平均速度</div>
            <div className="font-bold text-lg">{gpsAverageSpeed.toFixed(0)} km/h</div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="space-y-2">
          {operation.status === 'idle' ? (
            // 運行開始ボタン
            <button
              onClick={handleStartOperation}
              disabled={isSubmitting || !currentPosition}
              className="btn-primary w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 mr-2" />
                  運行開始
                </>
              )}
            </button>
          ) : (
            // 運行中のボタン群
            <>
              {/* 積込・積降ボタン */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleLoadingArrival}
                  disabled={isSubmitting || operation.loadingArrived}
                  className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                    operation.loadingArrived
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                  }`}
                >
                  <MapPin className="w-5 h-5 mx-auto mb-1" />
                  積込場所到着
                </button>
                
                <button
                  onClick={handleUnloadingArrival}
                  disabled={isSubmitting || !operation.loadingArrived || operation.unloadingArrived}
                  className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                    !operation.loadingArrived || operation.unloadingArrived
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                  }`}
                >
                  <Home className="w-5 h-5 mx-auto mb-1" />
                  積降場所到着
                </button>
              </div>

              {/* 休憩・給油ボタン */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleBreak}
                  disabled={isSubmitting}
                  className="py-3 px-4 rounded-lg font-semibold text-sm bg-orange-500 text-white hover:bg-orange-600 active:scale-95 disabled:opacity-50 transition-all"
                >
                  <Coffee className="w-5 h-5 mx-auto mb-1" />
                  休憩・荷待ち
                </button>
                
                <button
                  onClick={handleRefuel}
                  disabled={isSubmitting}
                  className="py-3 px-4 rounded-lg font-semibold text-sm bg-yellow-500 text-white hover:bg-yellow-600 active:scale-95 disabled:opacity-50 transition-all"
                >
                  <Fuel className="w-5 h-5 mx-auto mb-1" />
                  給油
                </button>
              </div>

              {/* 運行終了ボタン */}
              <button
                onClick={handleEndOperation}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-lg font-semibold text-sm bg-red-600 text-white hover:bg-red-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Square className="w-5 h-5 mr-2" />
                    運行終了
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between" style={{ zIndex: 40 }}>
        <div className="flex items-center text-xs text-gray-600">
          <div className={`w-4 h-4 rounded-full mr-2 relative ${isTracking ? 'bg-green-500' : 'bg-gray-400'}`}>
            <div className="absolute inset-1 bg-white rounded-full" />
          </div>
          {isTracking ? 'GPS追跡中' : 'GPS停止中'}
        </div>
        
        <div className="text-xs text-gray-500 text-right">
          {currentPosition && (
            <>
              緯度: {currentPosition.coords.latitude.toFixed(6)}<br />
              経度: {currentPosition.coords.longitude.toFixed(6)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationRecord;