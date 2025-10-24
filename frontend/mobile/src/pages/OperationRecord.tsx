// frontend/mobile/src/pages/OperationRecord.tsx
// ✅ 型エラー完全修正版 - API型定義に準拠
// 修正日時: 2025-10-24
// 修正内容:
//  1. startOperation の引数を API型定義に合わせて修正
//  2. recordAction の引数を API型定義に合わせて修正
//  3. 地図表示問題とGPS更新頻度の問題を解決
//  4. デバッグコード削除

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
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useGPS } from '../hooks/useGPS';
import apiService from '../services/api';
import GoogleMapWrapper from '../components/GoogleMapWrapper';

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

// ✅ GPS更新のスロットリング用定数
const MAP_UPDATE_INTERVAL = 5000; // 地図更新は最大5秒に1回

const OperationRecord: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  // Google Map関連のref
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  // ✅ 最後に地図を更新した時刻を記録
  const lastMapUpdateRef = useRef<number>(0);
  
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
  
  // ✅ API送信中フラグ(二重送信防止)
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 時刻表示
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // 初期化済みフラグ
  const initializedRef = useRef(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // ========================================================================
  // ✅ 運行状態確認と復元
  // ========================================================================
  const checkAndRestoreOperation = async () => {
    setIsInitializing(true);
    
    try {
      console.log('🔄 運行状態を確認中...');
      
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
        setOperation(prev => ({
          ...prev,
          status: 'idle'
        }));
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

  // GPS追跡フック
  const {
    currentPosition,
    isTracking,
    totalDistance,
    averageSpeed: gpsAverageSpeed,
    pathCoordinates,
    startTracking,
    stopTracking,
    error: gpsError
  } = useGPS({
    enableHighAccuracy: true,
    enableLogging: operation.id !== null,
    operationId: operation.id || undefined,
    vehicleId: user?.vehicleId,
    onPositionUpdate: handleGPSUpdate,
    autoStart: false, // ✅ 自動開始をオフ(手動で制御)
  });

  // ✅ GPS更新ハンドラー - スロットリング追加
  function handleGPSUpdate(position: any, metadata: any) {
    if (!isMapReady) return;

    const now = Date.now();
    
    // ✅ 地図更新は最大1秒に1回に制限
    if (now - lastMapUpdateRef.current < MAP_UPDATE_INTERVAL) {
      // 統計データのみ更新(地図更新はスキップ)
      setOperation(prev => ({
        ...prev,
        distance: metadata.totalDistance,
        averageSpeed: metadata.averageSpeed
      }));
      return;
    }

    // 地図更新を実行
    if (mapInstanceRef.current && markerRef.current) {
      const newPos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      try {
        markerRef.current.setPosition(newPos);
        mapInstanceRef.current.panTo(newPos);
        
        if (metadata.heading !== null && metadata.speed > 1) {
          mapInstanceRef.current.setHeading(metadata.heading);
        }
        
        if (polylineRef.current && pathCoordinates.length > 0) {
          const path = pathCoordinates.map((p: any) => ({ lat: p.lat, lng: p.lng }));
          polylineRef.current.setPath(path);
        }
        
        // ✅ 最後の更新時刻を記録
        lastMapUpdateRef.current = now;
        
        console.log('📍 地図位置を更新:', newPos);
      } catch (error) {
        console.error('Error updating GPS on map:', error);
      }
    }
    
    // 統計データ更新
    setOperation(prev => ({
      ...prev,
      distance: metadata.totalDistance,
      averageSpeed: metadata.averageSpeed
    }));
  }

  // マップ準備完了ハンドラー
  const handleMapReady = (map: any, marker: any, polyline: any) => {
    console.log('🗺️ Map ready callback received');
    mapInstanceRef.current = map;
    markerRef.current = marker;
    polylineRef.current = polyline;
    setIsMapReady(true);

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

  // ページロード時の運行状態チェック
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      checkAndRestoreOperation();
    }
  }, []);

  // 経過時間更新
  useEffect(() => {
    if (operation.startTime && operation.status === 'running') {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - operation.startTime!.getTime()) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        setElapsedTime({ hours, minutes, seconds });
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [operation.startTime, operation.status]);

  // 現在時刻更新
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // GPSエラー監視
  useEffect(() => {
    if (gpsError) {
      if (gpsError.includes('タイムアウト') || gpsError.includes('Timeout')) {
        console.warn('⚠️ GPS Timeout:', gpsError);
      } else {
        console.error('❌ GPS Error:', gpsError);
        toast.error(gpsError, { duration: 5000 });
      }
    }
  }, [gpsError]);

  // ✅ 修正: 運行開始処理 - API型定義に準拠
  const handleStartOperation = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (isSubmitting) {
      console.warn('⚠️ 既に送信中です');
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('🚀 運行開始リクエスト送信');
      
      // ✅ 修正: API型定義に合わせてデータ構造を変更
      const requestData = {
        vehicleId: user?.vehicleId || 'UNKNOWN',
        driverId: user?.id || '',
        startLatitude: currentPosition?.coords.latitude || 0,   // ✅ 別々のフィールドに
        startLongitude: currentPosition?.coords.longitude || 0, // ✅ 別々のフィールドに
        startLocation: '出発地', // ✅ オプショナル: 住所などの文字列
      };
      
      const response = await apiService.startOperation(requestData);
      
      if (response.success && response.data) {
        toast.success('運行を開始しました', { duration: 3000 });
        
        setOperation({
          id: response.data.tripId || response.data.id,
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

  // ✅ 修正: 積込場所到着処理 - API型定義に準拠
  const handleLoadingArrival = async () => {
    if (!operation.id || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // ✅ 修正: API型定義に合わせてデータ構造を変更
      await apiService.recordAction({
        operationId: operation.id,
        actionType: 'LOADING_ARRIVAL',
        latitude: currentPosition?.coords.latitude || 0,   // ✅ 別々のフィールドに
        longitude: currentPosition?.coords.longitude || 0, // ✅ 別々のフィールドに
        location: '積込場所', // ✅ オプショナル: 住所などの文字列
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

  // ✅ 修正: 積降場所到着処理 - API型定義に準拠
  const handleUnloadingArrival = async () => {
    if (!operation.id || !operation.loadingArrived || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // ✅ 修正: API型定義に合わせてデータ構造を変更
      await apiService.recordAction({
        operationId: operation.id,
        actionType: 'UNLOADING_ARRIVAL',
        latitude: currentPosition?.coords.latitude || 0,   // ✅ 別々のフィールドに
        longitude: currentPosition?.coords.longitude || 0, // ✅ 別々のフィールドに
        location: '積降場所', // ✅ オプショナル: 住所などの文字列
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

  // ✅ 修正: 休憩・荷待ち記録 - API型定義に準拠
  const handleBreak = async () => {
    if (!operation.id || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // ✅ 修正: API型定義に合わせてデータ構造を変更
      await apiService.recordAction({
        operationId: operation.id,
        actionType: 'BREAK',
        latitude: currentPosition?.coords.latitude || 0,   // ✅ 別々のフィールドに
        longitude: currentPosition?.coords.longitude || 0, // ✅ 別々のフィールドに
        location: '休憩場所', // ✅ オプショナル: 住所などの文字列
      });
      
      toast.success('休憩・荷待ちを記録しました');
    } catch (error) {
      console.error('休憩記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ 修正: 給油記録 - API型定義に準拠
  const handleRefuel = async () => {
    if (!operation.id || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // ✅ 修正: API型定義に合わせてデータ構造を変更
      await apiService.recordAction({
        operationId: operation.id,
        actionType: 'REFUEL',
        latitude: currentPosition?.coords.latitude || 0,   // ✅ 別々のフィールドに
        longitude: currentPosition?.coords.longitude || 0, // ✅ 別々のフィールドに
        location: '給油所', // ✅ オプショナル: 住所などの文字列
      });
      
      toast.success('給油を記録しました');
    } catch (error) {
      console.error('給油記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 運行終了処理
  const handleEndOperation = async () => {
    if (!operation.id || isSubmitting) return;
    
    if (!window.confirm('運行を終了しますか?')) return;
    
    setIsSubmitting(true);
    
    try {
      // operationIdを含む1つのオブジェクトとして渡す
      await apiService.endOperation({
        operationId: operation.id,              // operationIdを含める
        endLatitude: currentPosition?.coords.latitude || 0,
        endLongitude: currentPosition?.coords.longitude || 0,
        endLocation: '到着地',
        totalDistance: operation.distance,
      });
      
      // GPS追跡を停止
      stopTracking();
      
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

  // 初期化中の表示
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

  // JSX
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

      {/* ✅ 修正: 地図エリア - デバッグコード削除、適切な高さ設定 */}
      <div 
        className="relative w-full flex-1 overflow-hidden"
        style={{ 
          minHeight: '300px',
          maxHeight: 'calc(100vh - 300px)',
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
        
        {/* GPS状態表示 */}
        <div 
          className="absolute top-4 right-4 bg-white rounded-lg shadow-lg px-3 py-2 text-xs"
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
            <div className="font-bold text-lg">{operation.distance.toFixed(1)} km</div>
          </div>
          <div>
            <div className="text-gray-500">平均速度</div>
            <div className="font-bold text-lg">{operation.averageSpeed.toFixed(0)} km/h</div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="space-y-2">
          {operation.status === 'idle' ? (
            <button
              onClick={handleStartOperation}
              disabled={isSubmitting || !currentPosition}
              className="btn-primary w-full flex items-center justify-center"
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
            <>
              <button
                onClick={handleLoadingArrival}
                disabled={operation.loadingArrived || isSubmitting}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-lg flex items-center justify-center"
              >
                <MapPin className="w-5 h-5 mr-2" />
                積込場所到着
              </button>

              <button
                onClick={handleUnloadingArrival}
                disabled={!operation.loadingArrived || operation.unloadingArrived || isSubmitting}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-xl shadow-lg flex items-center justify-center"
              >
                <MapPin className="w-5 h-5 mr-2" />
                積降場所到着
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleBreak}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-semibold rounded-xl shadow-md flex items-center justify-center"
                >
                  <Coffee className="w-4 h-4 mr-1" />
                  休憩・荷待ち
                </button>

                <button
                  onClick={handleRefuel}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-semibold rounded-xl shadow-md flex items-center justify-center"
                >
                  <Fuel className="w-4 h-4 mr-1" />
                  給油
                </button>
              </div>

              <button
                onClick={handleEndOperation}
                disabled={isSubmitting}
                className="btn-success w-full flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Square className="w-6 h-6 mr-2" />
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