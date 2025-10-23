// frontend/mobile/src/pages/OperationRecord.tsx
// 完全修正版 - 初期化後のメインUI完全実装
// 地図エリアとコントロールパネルを正しく表示

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

const OperationRecord: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  // Google Map関連のref（GoogleMapWrapperから受け取る）
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
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
  
  // ✅ API送信中フラグ（二重送信防止）
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

        // ✅ 運行中データなし → idle状態で待機（ユーザーが運行開始ボタンを押すのを待つ）
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
    autoStart: true,
  });

  // GPS更新ハンドラー
  function handleGPSUpdate(position: any, metadata: any) {
    if (!isMapReady) return;

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
      } catch (error) {
        console.error('Error updating GPS on map:', error);
      }
    }
    
    setOperation(prev => ({
      ...prev,
      distance: metadata.totalDistance,
      averageSpeed: metadata.averageSpeed
    }));
  }

  // マップ準備完了ハンドラー
  const handleMapReady = (map: any, marker: any, polyline: any) => {
    console.log('Map ready callback received');
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


  // 運行開始処理（既存のhandleStartOperationを更新）
  const handleStartOperation = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // ✅ 既に運行中の場合はエラー
    if (operation.status !== 'idle') {
      toast.error('既に運行中です');
      return;
    }
    
    if (isSubmitting) {
      console.warn('⚠️ 送信中です。しばらくお待ちください。');
      return;
    }
    
    if (!currentPosition) {
      toast.error('GPS位置を取得中です。しばらくお待ちください。', {
        duration: 3000
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('📍 運行開始リクエスト送信...', {
        vehicleId: user?.vehicleId,
        driverId: user?.id,
        position: currentPosition.coords,
        timestamp: new Date().toISOString()
      });
      
      const response = await apiService.startOperation({
        vehicleId: user?.vehicleId || '',
        driverId: user?.id || '',
        startLatitude: currentPosition.coords.latitude,
        startLongitude: currentPosition.coords.longitude,
        startLocation: '現在地'
      });
      
      if (response.success && response.data) {
        setOperation({
          id: response.data.id,
          status: 'running',
          startTime: new Date(),
          loadingArrived: false,
          unloadingArrived: false,
          distance: 0,
          duration: 0,
          averageSpeed: 0
        });
        
        await startTracking();
        toast.success('運行を開始しました', {
          duration: 3000
        });
        console.log('✅ 運行開始成功:', response.data);
      }
    } catch (error: any) {
      console.error('❌ 運行開始エラー:', error);
      
      if (error?.response?.status === 401) {
        toast.error('認証エラーが発生しました。再度ログインしてください。', { duration: 5000 });
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        toast.error('サーバーの応答がタイムアウトしました。\nバックエンドサーバーの状態を確認してください。', { 
          duration: 6000,
          style: {
            maxWidth: '400px',
            whiteSpace: 'pre-line'
          }
        });
      } else if (error?.response?.data?.message) {
        toast.error(error.response.data.message, { duration: 4000 });
      } else {
        toast.error('運行開始に失敗しました', { duration: 4000 });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 運行終了
  const handleEndOperation = async () => {
    if (!operation.id || !currentPosition) return;
    
    // ✅ 二重送信防止
    if (isSubmitting) {
      console.warn('⚠️ 送信中です。しばらくお待ちください。');
      return;
    }
    
    setIsSubmitting(true); // ✅ 送信開始
    
    try {
      console.log('📍 運行終了リクエスト送信...', {
        operationId: operation.id,
        position: currentPosition.coords
      });
      
      await apiService.endOperation({
        operationId: operation.id,
        endLatitude: currentPosition.coords.latitude,
        endLongitude: currentPosition.coords.longitude,
        endLocation: '現在地',
        totalDistance: totalDistance
      });
      
      await stopTracking();
      
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
      
      toast.success('運行を終了しました');
      console.log('✅ 運行終了成功');
    } catch (error: any) {
      console.error('❌ 運行終了エラー:', error);
      
      // ✅ 改善: エラーの詳細な処理
      if (error?.response?.status === 401) {
        toast.error('認証エラーが発生しました。再度ログインしてください。', { duration: 5000 });
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        toast.error('サーバーの応答がタイムアウトしました。\nバックエンドサーバーの状態を確認してください。', { 
          duration: 6000,
          style: {
            maxWidth: '400px',
            whiteSpace: 'pre-line'
          }
        });
      } else {
        toast.error('運行終了に失敗しました', { duration: 4000 });
      }
    } finally {
      setIsSubmitting(false); // ✅ 送信完了
    }
  };

  // アクション処理
  const handleAction = async (action: string) => {
    if (!operation.id || !currentPosition) {
      toast.error('運行中のみ操作可能です');
      return;
    }
    
    // ✅ 二重送信防止
    if (isSubmitting) {
      console.warn('⚠️ 送信中です。しばらくお待ちください。');
      return;
    }
    
    setIsSubmitting(true); // ✅ 送信開始
    
    try {
      console.log(`📍 アクション記録送信: ${action}`);
      
      await apiService.recordAction({
        operationId: operation.id,
        actionType: action,
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        location: '現在地'
      });
      
      toast.success(`${action}を記録しました`);
      
      if (action === '積込場所到着') {
        setOperation(prev => ({ ...prev, loadingArrived: true }));
      } else if (action === '積降場所到着') {
        setOperation(prev => ({ ...prev, unloadingArrived: true }));
      }
      
      console.log(`✅ アクション記録成功: ${action}`);
    } catch (error: any) {
      console.error(`❌ アクション記録エラー (${action}):`, error);
      
      // ✅ 改善: エラーの詳細な処理
      if (error?.response?.status === 401) {
        toast.error('認証エラーが発生しました。再度ログインしてください。', { duration: 5000 });
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        toast.error('サーバーの応答がタイムアウトしました。\nバックエンドサーバーの状態を確認してください。', { 
          duration: 6000,
          style: {
            maxWidth: '400px',
            whiteSpace: 'pre-line'
          }
        });
      } else {
        toast.error('記録に失敗しました', { duration: 4000 });
      }
    } finally {
      setIsSubmitting(false); // ✅ 送信完了
    }
  };

  // ========================================================================
  // 初期化中の表示
  // ========================================================================
  // JSX
  if (isInitializing) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Navigation className="w-6 h-6 mr-2" />
            <h1 className="text-lg font-bold">運行記録</h1>
          </div>
          <div className="flex items-center text-sm">
            <Clock className="w-4 h-4 mr-1" />
            {currentTime.toLocaleTimeString('ja-JP')}
          </div>
        </div>

        {/* ✅ 修正: 地図エリア - 明示的な高さ指定 */}
        <div 
          className="relative w-full overflow-hidden"
          style={{ 
            height: '600px',        // 大きめに設定
            backgroundColor: 'red', // 赤色で確認
            border: '5px solid blue', // 青い枠線
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
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg px-3 py-2 text-xs z-10">
            <div className={`flex items-center ${isTracking ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isTracking ? 'GPS追跡中' : 'GPS停止中'}
            </div>
          </div>
        </div>
        
        {/* コントロールパネル */}
        <div className="bg-white px-4 py-4 border-t shadow-lg">
          {/* 運行情報 */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
            <div>
              <div className="text-gray-500">経過時間</div>
              <div className="font-bold text-lg">
                {operation.startTime ? `${elapsedTime.hours}:${String(elapsedTime.minutes).padStart(2, '0')}:${String(elapsedTime.seconds).padStart(2, '0')}` : '0:00:00'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">運行距離</div>
              <div className="font-bold text-lg">{(totalDistance || 0).toFixed(1)} km</div>
            </div>
            <div>
              <div className="text-gray-500">平均速度</div>
              <div className="font-bold text-lg">{(gpsAverageSpeed || 0).toFixed(1)} km/h</div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => handleAction('積込場所到着')}
              disabled={!operation.id || operation.loadingArrived || isSubmitting}
              className={`p-4 rounded-lg font-bold text-sm transition-all ${
                operation.id && !operation.loadingArrived && !isSubmitting
                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <MapPin className="w-5 h-5 mx-auto mb-1" />
              積込到着
            </button>
            
            <button
              onClick={() => handleAction('積降場所到着')}
              disabled={!operation.id || !operation.loadingArrived || operation.unloadingArrived || isSubmitting}
              className={`p-4 rounded-lg font-bold text-sm transition-all ${
                operation.id && operation.loadingArrived && !operation.unloadingArrived && !isSubmitting
                  ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <MapPin className="w-5 h-5 mx-auto mb-1" />
              積降到着
            </button>
            
            <button
              onClick={() => handleAction('休憩・荷待ち')}
              disabled={!operation.id || isSubmitting}
              className={`p-4 rounded-lg font-bold text-sm transition-all ${
                operation.id && !isSubmitting
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Coffee className="w-5 h-5 mx-auto mb-1" />
              休憩
            </button>
            
            <button
              onClick={() => handleAction('給油')}
              disabled={!operation.id || isSubmitting}
              className={`p-4 rounded-lg font-bold text-sm transition-all ${
                operation.id && !isSubmitting
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Fuel className="w-5 h-5 mx-auto mb-1" />
              給油
            </button>
          </div>
          
          {/* 運行開始/終了ボタン */}
          <div className="mt-4">
            {operation.status === 'idle' ? (
              <button
                onClick={handleStartOperation}
                disabled={!currentPosition || isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
              <button
                onClick={handleEndOperation}
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
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
  }
};

export default OperationRecord;