// frontend/mobile/src/pages/OperationRecord.tsx
// GoogleMapWrapper統合版 - React Strict Mode完全対応

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
  Clock
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
  
  // 時刻表示
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  // GPS追跡フック
  const {
    currentPosition,
    isTracking,
    heading,
    speed,
    accuracy,
    totalDistance,
    averageSpeed: gpsAverageSpeed,
    pathCoordinates,
    startTracking,
    stopTracking,
  } = useGPS({
    enableHighAccuracy: true,
    enableLogging: operation.id !== null,
    operationId: operation.id || undefined,
    vehicleId: user?.vehicleId,
    onPositionUpdate: handleGPSUpdate,
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
    if (!isMapReady || !currentPosition || !mapInstanceRef.current || !markerRef.current) {
      return;
    }

    const pos = {
      lat: currentPosition.coords.latitude,
      lng: currentPosition.coords.longitude
    };
    
    try {
      mapInstanceRef.current.setCenter(pos);
      markerRef.current.setPosition(pos);
    } catch (error) {
      console.error('Failed to update map position:', error);
    }
  }, [currentPosition, isMapReady]);

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

  // 運行開始
  const handleStartOperation = async () => {
    if (!currentPosition) {
      toast.error('GPS位置を取得中です。しばらくお待ちください。');
      return;
    }
    
    try {
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
      }
    } catch (error) {
      console.error('運行開始エラー:', error);
      toast.error('運行開始に失敗しました');
    }
  };

  // 運行終了
  const handleEndOperation = async () => {
    if (!operation.id || !currentPosition) return;
    
    try {
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
    } catch (error) {
      console.error('運行終了エラー:', error);
      toast.error('運行終了に失敗しました');
    }
  };

  // アクション処理
  const handleAction = async (action: string) => {
    if (!operation.id || !currentPosition) {
      toast.error('運行中のみ操作可能です');
      return;
    }
    
    try {
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
    } catch (error) {
      console.error('アクション記録エラー:', error);
      toast.error('記録に失敗しました');
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
        
        {!isMapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">地図を読み込んでいます...</p>
            </div>
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
            disabled={!operation.id || operation.loadingArrived}
            className={`p-4 rounded-lg font-bold text-sm transition-all ${
              operation.id && !operation.loadingArrived
                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <MapPin className="w-5 h-5 mx-auto mb-1" />
            積込到着
          </button>
          
          <button
            onClick={() => handleAction('積降場所到着')}
            disabled={!operation.id || !operation.loadingArrived || operation.unloadingArrived}
            className={`p-4 rounded-lg font-bold text-sm transition-all ${
              operation.id && operation.loadingArrived && !operation.unloadingArrived
                ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <MapPin className="w-5 h-5 mx-auto mb-1" />
            積降到着
          </button>
          
          <button
            onClick={() => handleAction('休憩・荷待ち')}
            disabled={!operation.id}
            className={`p-4 rounded-lg font-bold text-sm transition-all ${
              operation.id
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Coffee className="w-5 h-5 mx-auto mb-1" />
            休憩
          </button>
          
          <button
            onClick={() => handleAction('給油')}
            disabled={!operation.id}
            className={`p-4 rounded-lg font-bold text-sm transition-all ${
              operation.id
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
              disabled={!currentPosition}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Play className="w-6 h-6 mr-2" />
              運行開始
            </button>
          ) : (
            <button
              onClick={handleEndOperation}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl active:scale-95 transition-all flex items-center justify-center"
            >
              <Square className="w-6 h-6 mr-2" />
              運行終了
            </button>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-600">
          <div className="w-4 h-4 bg-green-500 rounded-full mr-2 relative">
            <div className="absolute inset-1 bg-white rounded-full" />
          </div>
          GPS接続中
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