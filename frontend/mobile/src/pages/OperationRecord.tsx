// frontend/mobile/src/pages/OperationRecord.tsx
// GoogleMapWrapper統合版 - React Strict Mode完全対応
// 修正: GPS取得中表示追加 + エラーハンドリング改善

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
  Loader2  // ✅ 追加: ローディングアイコン
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
  
  // ✅ 追加: API送信中フラグ（二重送信防止）
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 時刻表示
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  // GPS追跡フック
  const {
    currentPosition,
    isTracking,
    // heading,  // ✅ 削除: 未使用変数
    speed,
    // accuracy,  // ✅ 削除: 未使用変数
    totalDistance,
    averageSpeed: gpsAverageSpeed,
    pathCoordinates,
    startTracking,
    stopTracking,
    error: gpsError  // ✅ 追加: GPSエラー取得
  } = useGPS({
    enableHighAccuracy: true,
    enableLogging: operation.id !== null,
    operationId: operation.id || undefined,
    vehicleId: user?.vehicleId,
    onPositionUpdate: handleGPSUpdate,
    autoStart: true,  // ページ読み込み時にGPS開始
  });

  // GPS更新ハンドラー
  function handleGPSUpdate(position: any, metadata: any) {
    if (!isMapReady) return;

    // マップ更新
    if (mapInstanceRef.current && markerRef.current) {
      const newPos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      try {
        // マーカー位置更新
        markerRef.current.setPosition(newPos);
        
        // マップ中心移動
        mapInstanceRef.current.panTo(newPos);
        
        // ヘッドアップ回転(方位角)
        if (metadata.heading !== null && metadata.speed > 1) {
          mapInstanceRef.current.setHeading(metadata.heading);
        }
        
        // 軌跡更新
        if (polylineRef.current && pathCoordinates.length > 0) {
          const path = pathCoordinates.map((p: any) => ({ lat: p.lat, lng: p.lng }));
          polylineRef.current.setPath(path);
        }
      } catch (error) {
        console.error('Error updating GPS on map:', error);
      }
    }
    
    // 運行統計更新
    setOperation(prev => ({
      ...prev,
      distance: metadata.totalDistance,
      averageSpeed: metadata.averageSpeed
    }));
  }

  // ========================================================================
  // マップ準備完了ハンドラー
  // ========================================================================
  const handleMapReady = (map: any, marker: any, polyline: any) => {
    console.log('Map ready callback received');
    mapInstanceRef.current = map;
    markerRef.current = marker;
    polylineRef.current = polyline;
    setIsMapReady(true);

    // 現在位置があれば移動
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
  // マーカーアイコン動的更新
  // ========================================================================
  useEffect(() => {
    if (!isMapReady || !markerRef.current || !window.google || !window.google.maps) {
      return;
    }

    const createMarkerIcon = (distance: number, speedKmh: number) => {
      const svg = `
        <svg width="60" height="80" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
          <circle cx="30" cy="40" r="28" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
          <circle cx="30" cy="40" r="22" fill="rgba(255,255,255,0.9)" stroke="#4285F4" stroke-width="1"/>
          <path d="M30 15 L25 25 L35 25 Z" fill="#4285F4"/>
          <text x="30" y="35" text-anchor="middle" font-family="Arial" font-size="8" font-weight="bold" fill="#333">
            ${distance.toFixed(1)}km
          </text>
          <text x="30" y="47" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#4285F4">
            ${Math.round(speedKmh)}
          </text>
          <text x="30" y="55" text-anchor="middle" font-family="Arial" font-size="6" fill="#666">
            km/h
          </text>
        </svg>
      `;
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new window.google.maps.Size(60, 80),
        anchor: new window.google.maps.Point(30, 40)
      };
    };

    try {
      markerRef.current.setIcon(createMarkerIcon(totalDistance || 0, speed || 0));
    } catch (error) {
      console.error('Failed to update marker icon:', error);
    }
  }, [totalDistance, speed, isMapReady]);
  
  // ========================================================================
  // GPS位置更新時にマップを更新
  // ========================================================================
  useEffect(() => {
    if (currentPosition && isMapReady && mapInstanceRef.current) {
      const pos = {
        lat: currentPosition.coords.latitude,
        lng: currentPosition.coords.longitude
      };
      
      // 初回GPS取得時に地図を強制移動
      mapInstanceRef.current.setCenter(pos);
      mapInstanceRef.current.setZoom(18);
      
      if (markerRef.current) {
        markerRef.current.setPosition(pos);
      }
    }
  }, [currentPosition, isMapReady]); // currentPositionの変更を監視
  
  // 時刻更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      if (operation.startTime) {
        const elapsed = Date.now() - operation.startTime.getTime();
        const hours = Math.floor(elapsed / (1000 * 60 * 60));
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
        setElapsedTime({ hours, minutes, seconds });
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [operation.startTime]);

  // ========================================================================
  // ✅ 追加: GPSエラー監視（タイムアウトは警告のみ、権限エラーは強調表示）
  // ========================================================================
  useEffect(() => {
    if (gpsError) {
      // タイムアウトエラーは警告レベル（位置取得中の可能性）
      if (gpsError.includes('タイムアウト') || gpsError.includes('Timeout')) {
        console.warn('⚠️ GPS Timeout:', gpsError);
        // タイムアウトはトーストを表示しない（煩わしいため）
      } else {
        // 権限エラーなどはユーザーに通知
        console.error('❌ GPS Error:', gpsError);
        toast.error(gpsError, { duration: 5000 });
      }
    }
  }, [gpsError]);

  // 運行開始
  const handleStartOperation = async () => {
    // ✅ 二重送信防止
    if (isSubmitting) {
      console.warn('⚠️ 送信中です。しばらくお待ちください。');
      return;
    }
    
    if (!currentPosition) {
      toast.error('GPS位置を取得中です。しばらくお待ちください。');
      return;
    }
    
    setIsSubmitting(true); // ✅ 送信開始
    
    try {
      console.log('📍 運行開始リクエスト送信...', {
        vehicleId: user?.vehicleId,
        driverId: user?.id,
        position: currentPosition.coords
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
        toast.success('運行を開始しました');
        console.log('✅ 運行開始成功:', response.data);
      }
    } catch (error: any) {
      console.error('❌ 運行開始エラー:', error);
      
      // ✅ 改善: エラーの詳細な処理
      if (error?.response?.status === 401) {
        // 認証エラー - ログアウトして再ログインを促す
        toast.error('認証エラーが発生しました。再度ログインしてください。', { duration: 5000 });
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        // ✅ タイムアウトエラー - より詳細なメッセージ
        toast.error('サーバーの応答がタイムアウトしました。\nバックエンドサーバーの状態を確認してください。', { 
          duration: 6000,
          style: {
            maxWidth: '400px',
            whiteSpace: 'pre-line'
          }
        });
        console.error('🔴 バックエンドタイムアウト: サーバーが30秒以内に応答しませんでした');
      } else if (error?.message?.includes('Network Error')) {
        // ネットワークエラー
        toast.error('ネットワークエラーが発生しました。接続を確認してください。', { duration: 5000 });
      } else {
        // その他のエラー
        const errorMsg = error?.response?.data?.message || error?.message || '運行開始に失敗しました';
        toast.error(errorMsg, { duration: 4000 });
      }
    } finally {
      setIsSubmitting(false); // ✅ 送信完了（成功・失敗に関わらず）
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

  // JSX
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

      {/* 地図エリア */}
      <div className="flex-1 relative bg-gray-100">
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
        
        {/* 地図ローディング表示 */}
        {!isMapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">地図を読み込んでいます...</p>
            </div>
          </div>
        )}
        
        {/* ✅ 追加: GPS位置取得中の明示的な表示 */}
        {isMapReady && !currentPosition && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg z-20 flex items-center">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span className="text-sm font-medium">GPS位置を取得しています...</span>
          </div>
        )}
        
        {/* ✅ 追加: GPSエラー表示（権限エラーなど） */}
        {isMapReady && gpsError && !gpsError.includes('タイムアウト') && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-800 px-4 py-2 rounded-lg shadow-lg z-20 flex items-center max-w-md">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">{gpsError}</span>
          </div>
        )}
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
};

export default OperationRecord;