// frontend/mobile/src/pages/OperationRecord.tsx
// 完全版GPS運行記録画面 - index.html機能完全統合版

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  Play, 
  Square, 
  MapPin, 
  Coffee, 
  Fuel,
  Navigation,
  Activity,
  Clock
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useGPS } from '../hooks/useGPS';
import apiService from '../services/api';

// Google Maps型定義
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

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
  
  // Google Map関連のref
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  
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
    averageSpeed,
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
    // マップ更新
    if (mapInstanceRef.current && markerRef.current) {
      const newPos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
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
        const path = pathCoordinates.map(p => ({ lat: p.lat, lng: p.lng }));
        polylineRef.current.setPath(path);
      }
    }
    
    // 運行統計更新
    setOperation(prev => ({
      ...prev,
      distance: metadata.totalDistance,
      averageSpeed: metadata.averageSpeed
    }));
  }

  // Google Maps初期化
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&v=weekly`;
    script.async = true;
    script.defer = true;
    
    window.initMap = () => {
      if (!mapRef.current) return;
      
      // WebGL Vector Map初期化
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 34.6937, lng: 135.5023 }, // 大阪デフォルト
        zoom: 18,
        mapId: 'DEMO_MAP_ID', // Vector Map有効化
        heading: 0,
        tilt: 0,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        tiltInteractionEnabled: true,
        headingInteractionEnabled: true
      });
      
      mapInstanceRef.current = map;
      
      // カスタムマーカー作成
      const createMarkerIcon = (distance: number, speed: number) => {
        const svg = `
          <svg width="60" height="80" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="40" r="28" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
            <circle cx="30" cy="40" r="22" fill="rgba(255,255,255,0.9)" stroke="#4285F4" stroke-width="1"/>
            <path d="M30 15 L25 25 L35 25 Z" fill="#4285F4"/>
            <text x="30" y="35" text-anchor="middle" font-family="Arial" font-size="8" font-weight="bold" fill="#333">
              ${distance.toFixed(1)}km
            </text>
            <text x="30" y="47" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#4285F4">
              ${Math.round(speed)}
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
      
      // マーカー配置
      const marker = new window.google.maps.Marker({
        position: { lat: 34.6937, lng: 135.5023 },
        map: map,
        icon: createMarkerIcon(0, 0),
        zIndex: 1000
      });
      
      markerRef.current = marker;
      
      // 軌跡ポリライン
      const polyline = new window.google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 4,
        zIndex: 999
      });
      
      polyline.setMap(map);
      polylineRef.current = polyline;
      
      // GPS位置取得後にマップ移動
      if (currentPosition) {
        const pos = {
          lat: currentPosition.coords.latitude,
          lng: currentPosition.coords.longitude
        };
        map.setCenter(pos);
        marker.setPosition(pos);
      }
    };
    
    script.onload = () => window.initMap();
    document.head.appendChild(script);
    
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
  
  // マーカーアイコン更新
  useEffect(() => {
    if (markerRef.current && window.google) {
      const createMarkerIcon = (distance: number, speed: number) => {
        const svg = `
          <svg width="60" height="80" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="40" r="28" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
            <circle cx="30" cy="40" r="22" fill="rgba(255,255,255,0.9)" stroke="#4285F4" stroke-width="1"/>
            <path d="M30 15 L25 25 L35 25 Z" fill="#4285F4"/>
            <text x="30" y="35" text-anchor="middle" font-family="Arial" font-size="8" font-weight="bold" fill="#333">
              ${distance.toFixed(1)}km
            </text>
            <text x="30" y="47" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#4285F4">
              ${Math.round(speed)}
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
      
      markerRef.current.setIcon(createMarkerIcon(totalDistance, speed || 0));
    }
  }, [totalDistance, speed]);

  // 時刻更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // 経過時間計算
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
      
      stopTracking();
      
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

  // アクション記録
  const handleAction = async (actionType: string) => {
    if (!operation.id || !currentPosition) {
      toast.error('運行中のみ操作可能です');
      return;
    }
    
    try {
      await apiService.recordAction({
        operationId: operation.id,
        actionType,
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        location: '現在地'
      });
      
      if (actionType === '積込場所到着') {
        setOperation(prev => ({ ...prev, loadingArrived: true }));
      } else if (actionType === '積降場所到着') {
        setOperation(prev => ({ ...prev, unloadingArrived: true }));
      }
      
      toast.success(`${actionType}を記録しました`);
    } catch (error) {
      console.error('アクション記録エラー:', error);
      toast.error('記録に失敗しました');
    }
  };

  // 方位を16方位に変換
  const getDirection = (degrees: number): string => {
    const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-900 to-blue-700">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          {/* ステータス */}
          <div className={`px-4 py-2 rounded-full font-bold text-sm ${
            operation.status === 'running' 
              ? 'bg-green-500 animate-pulse' 
              : 'bg-gray-500'
          }`}>
            {operation.status === 'running' ? '運行中' : '待機中'}
          </div>
          
          {/* 時刻 */}
          <div className="text-center">
            <div className="text-xl font-bold">
              {currentTime.toLocaleTimeString('ja-JP')}
            </div>
            <div className="text-xs opacity-80">
              {currentTime.toLocaleDateString('ja-JP', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </div>

      {/* マップ */}
      <div className="relative h-64 bg-gray-200">
        <div ref={mapRef} className="w-full h-full" />
        
        {/* 方位表示 */}
        {heading !== null && (
          <div className="absolute top-2 right-2 bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold">
            方位: {Math.round(heading)}° ({getDirection(heading)})
          </div>
        )}
        
        {/* 精度表示 */}
        {accuracy !== null && (
          <div className="absolute top-10 right-2 bg-black/70 text-white px-3 py-1 rounded-full text-xs">
            精度: {Math.round(accuracy)}m
          </div>
        )}
      </div>

      {/* 情報グリッド */}
      <div className="bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-600">
            <div className="text-xs text-gray-600 mb-1">積込場所</div>
            <div className="font-bold text-sm">◯◯建設資材置場</div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-600">
            <div className="text-xs text-gray-600 mb-1">積降場所</div>
            <div className="font-bold text-sm">△△工事現場</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">積荷</div>
            <div className="font-bold text-sm">砂利 12t</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs text-gray-600 mb-1 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              経過時間
            </div>
            <div className="font-bold text-sm">
              {elapsedTime.hours}時間 {elapsedTime.minutes}分
            </div>
          </div>
          
          <div className="bg-orange-50 p-3 rounded-lg border-l-4 border-orange-500">
            <div className="text-xs text-gray-600 mb-1 flex items-center">
              <Navigation className="w-3 h-3 mr-1" />
              運行距離
            </div>
            <div className="font-bold text-sm text-orange-700">
              {totalDistance.toFixed(1)} km
            </div>
          </div>
          
          <div className="bg-orange-50 p-3 rounded-lg border-l-4 border-orange-500">
            <div className="text-xs text-gray-600 mb-1 flex items-center">
              <Activity className="w-3 h-3 mr-1" />
              平均速度
            </div>
            <div className="font-bold text-sm text-orange-700">
              {averageSpeed.toFixed(1)} km/h
            </div>
          </div>
        </div>
      </div>

      {/* ボタングリッド */}
      <div className="flex-1 bg-white p-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {/* 積込場所到着 */}
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
            積込場所<br />到着
          </button>
          
          {/* 積降場所到着 */}
          <button
            onClick={() => handleAction('積降場所到着')}
            disabled={!operation.id || !operation.loadingArrived || operation.unloadingArrived}
            className={`p-4 rounded-lg font-bold text-sm transition-all ${
              operation.id && operation.loadingArrived && !operation.unloadingArrived
                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <MapPin className="w-5 h-5 mx-auto mb-1" />
            積降場所<br />到着
          </button>
          
          {/* 休憩・荷待ち */}
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
            休憩・荷待ち
          </button>
          
          {/* 給油 */}
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