// frontend/mobile/src/pages/OperationRecord.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  LogOut, 
  Navigation, 
  MapPin, 
  Clock, 
  Truck,
  Package,
  Play,
  Square,
  Coffee,
  Fuel
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { mobileApi } from '../services/api';

// Google Maps types (簡易版)
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

interface Position {
  coords: {
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    heading?: number;
    accuracy: number;
  };
  timestamp: number;
}

interface OperationInfo {
  id: string;
  loadingLocation: string;
  unloadingLocation: string;
  cargoInfo: string;
  vehicleId: string;
  startTime: Date;
}

const OperationRecord: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  
  // 状態管理
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [startTime] = useState(new Date());
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [previousPosition, setPreviousPosition] = useState<Position | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [operationInfo, setOperationInfo] = useState<OperationInfo | null>(null);
  const [status, setStatus] = useState('運行中');
  const [buttonStates, setButtonStates] = useState({
    load: { enabled: true, text: '積込場所到着' },
    unload: { enabled: false, text: '積降場所到着' },
    break: { enabled: true, text: '休憩・荷待ち' },
    fuel: { enabled: true, text: '給油' }
  });

  // マップ関連
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const pathRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const pathCoordinates = useRef<{ lat: number; lng: number }[]>([]);

  // GPS更新頻度制御
  const lastGPSUpdate = useRef<number>(0);
  const GPS_UPDATE_INTERVAL = 5000; // 5秒間隔でサーバーに送信

  // 認証チェック
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login', { replace: true });
      return;
    }
  }, [isAuthenticated, user, navigate]);

  // 時刻更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 距離計算（ハーバーサイン公式）
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // 方位角計算
  const calculateBearing = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
             Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }, []);

  // カスタムマーカーSVG生成
  const createCustomMarkerSVG = useCallback((distance: number, speed: number): string => {
    const distanceText = distance.toFixed(1);
    const speedText = Math.round(speed);
    
    return `
      <svg width="60" height="80" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="40" r="28" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
        <circle cx="30" cy="40" r="22" fill="rgba(255,255,255,0.9)" stroke="#4285F4" stroke-width="1"/>
        <path d="M30 15 L25 25 L35 25 Z" fill="#4285F4"/>
        <text x="30" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="#333">
          ${distanceText}km
        </text>
        <text x="30" y="47" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#4285F4">
          ${speedText}
        </text>
        <text x="30" y="55" text-anchor="middle" font-family="Arial, sans-serif" font-size="6" fill="#666">
          km/h
        </text>
      </svg>
    `;
  }, []);

  // Google Maps初期化
  const initializeMap = useCallback((lat: number, lng: number) => {
    if (!mapRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 18,
      renderingType: window.google.maps.RenderingType.VECTOR,
      heading: currentHeading,
      tilt: 0,
      mapId: "DEMO_MAP_ID",
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      tiltInteractionEnabled: true,
      headingInteractionEnabled: true
    });

    mapInstanceRef.current = map;

    const markerSVG = createCustomMarkerSVG(totalDistance, currentSpeed);
    const markerIcon = {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSVG),
      scaledSize: new window.google.maps.Size(60, 80),
      anchor: new window.google.maps.Point(30, 40)
    };

    markerRef.current = new window.google.maps.Marker({
      position: { lat, lng },
      map: map,
      title: '現在位置',
      icon: markerIcon,
      zIndex: 1000
    });

    pathRef.current = new window.google.maps.Polyline({
      path: pathCoordinates.current,
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 4,
      zIndex: 999
    });
    pathRef.current.setMap(map);

    setIsLoading(false);
    toast.success('GPSマップを初期化しました');
  }, [currentHeading, totalDistance, currentSpeed, createCustomMarkerSVG]);

  // マップ上の位置更新
  const updateMapLocation = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    const newPosition = { lat, lng };
    markerRef.current.setPosition(newPosition);
    
    // マーカーアイコン更新（パフォーマンス考慮で確率的に更新）
    if (Math.random() < 0.3) {
      const markerSVG = createCustomMarkerSVG(totalDistance, currentSpeed);
      const markerIcon = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSVG),
        scaledSize: new window.google.maps.Size(60, 80),
        anchor: new window.google.maps.Point(30, 40)
      };
      markerRef.current.setIcon(markerIcon);
    }
    
    mapInstanceRef.current.panTo(newPosition);
    
    // ヘッドアップ回転
    const renderingType = mapInstanceRef.current.getRenderingType();
    if (renderingType === window.google.maps.RenderingType.VECTOR && !isNaN(currentHeading)) {
      mapInstanceRef.current.setHeading(currentHeading);
    }
  }, [totalDistance, currentSpeed, currentHeading, createCustomMarkerSVG]);

  // 走行軌跡更新
  const updatePath = useCallback(() => {
    if (pathRef.current) {
      pathRef.current.setPath(pathCoordinates.current);
    }
  }, []);

  // GPSデータをサーバーに送信
  const sendGPSData = useCallback(async (position: Position) => {
    try {
      if (!operationInfo) return;

      const gpsData = {
        operationId: operationInfo.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude || null,
        speedKmh: position.coords.speed ? position.coords.speed * 3.6 : currentSpeed,
        heading: currentHeading,
        accuracyMeters: position.coords.accuracy,
        timestamp: new Date().toISOString()
      };

      await mobileApi.logGPS(gpsData);
      console.log('GPS データ送信:', gpsData);
    } catch (error) {
      console.error('GPS データ送信エラー:', error);
      // エラーが発生してもGPS記録は継続
    }
  }, [operationInfo, currentSpeed, currentHeading]);

  // GPS位置監視
  const initializeGPS = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('このデバイスは位置情報をサポートしていません');
      setIsLoading(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // 初回位置取得
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = position as Position;
        setCurrentPosition(pos);
        setPreviousPosition(pos);
        setCurrentSpeed(pos.coords.speed ? pos.coords.speed * 3.6 : 0);
        
        if (pos.coords.heading !== null && pos.coords.heading !== undefined) {
          setCurrentHeading(pos.coords.heading);
        }
        
        pathCoordinates.current.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        
        initializeMap(pos.coords.latitude, pos.coords.longitude);
        sendGPSData(pos);
      },
      (error) => {
        console.error('位置情報取得エラー:', error);
        // エラー時は大阪の座標をデフォルトとして使用
        const defaultLat = 34.6937;
        const defaultLng = 135.5023;
        initializeMap(defaultLat, defaultLng);
        toast.error('位置情報の取得に失敗しました。デフォルト位置を表示します。');
      },
      options
    );

    // 継続的な位置監視
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const pos = position as Position;
        
        if (previousPosition) {
          const distance = calculateDistance(
            previousPosition.coords.latitude,
            previousPosition.coords.longitude,
            pos.coords.latitude,
            pos.coords.longitude
          );
          
          const rawSpeed = pos.coords.speed ? pos.coords.speed * 3.6 : 0;
          setCurrentSpeed(rawSpeed);
          
          if (distance > 0.001) { // 1m以上の移動
            setTotalDistance(prev => prev + distance);

            if (rawSpeed >= 1.0) { // 速度が1km/h以上の場合
              let newHeading = currentHeading;
              
              if (pos.coords.heading !== null && pos.coords.heading !== undefined && pos.coords.heading >= 0) {
                newHeading = pos.coords.heading;
              } else {
                newHeading = calculateBearing(
                  previousPosition.coords.latitude,
                  previousPosition.coords.longitude,
                  pos.coords.latitude,
                  pos.coords.longitude
                );
              }
              
              setCurrentHeading(newHeading);
            }
            
            pathCoordinates.current.push({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
            updatePath();
          }
        }
        
        setPreviousPosition(currentPosition);
        setCurrentPosition(pos);
        
        updateMapLocation(pos.coords.latitude, pos.coords.longitude);
        
        // 定期的にGPSデータを送信
        if (now - lastGPSUpdate.current > GPS_UPDATE_INTERVAL) {
          sendGPSData(pos);
          lastGPSUpdate.current = now;
        }
      },
      (error) => {
        console.error('位置監視エラー:', error);
      },
      options
    );
  }, [
    calculateDistance, 
    calculateBearing, 
    currentPosition, 
    previousPosition, 
    currentHeading, 
    initializeMap, 
    updateMapLocation, 
    updatePath, 
    sendGPSData
  ]);

  // 運行情報取得
  const loadOperationInfo = useCallback(async () => {
    try {
      const response = await mobileApi.getCurrentOperation();
      
      if (response.success && response.data) {
        setOperationInfo(response.data);
      } else {
        // 新規運行開始
        const startResponse = await mobileApi.startOperation({
          vehicleId: user?.vehicleId || '',
          startTime: new Date().toISOString(),
          startLocation: currentPosition ? {
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude
          } : null
        });
        
        if (startResponse.success && startResponse.data) {
          setOperationInfo(startResponse.data);
        }
      }
    } catch (error) {
      console.error('運行情報取得エラー:', error);
      // ダミーデータで継続
      setOperationInfo({
        id: 'operation_' + Date.now(),
        loadingLocation: '○○建設資材置場',
        unloadingLocation: '△△工事現場',
        cargoInfo: '砂利 12t',
        vehicleId: user?.vehicleId || '',
        startTime: new Date()
      });
    }
  }, [user?.vehicleId, currentPosition]);

  // Google Maps API読み込み
  useEffect(() => {
    if (typeof window.google === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyC1LrD7xMN_sLZ5iELaLpPzXPeQeEoH6pY&callback=initMap&v=weekly';
      script.async = true;
      script.defer = true;
      
      window.initMap = () => {
        loadOperationInfo();
        initializeGPS();
      };
      
      script.onerror = () => {
        toast.error('Google Maps APIの読み込みに失敗しました');
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    } else {
      loadOperationInfo();
      initializeGPS();
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [loadOperationInfo, initializeGPS]);

  // ボタンクリック処理
  const handleButtonClick = async (action: string) => {
    try {
      if (!operationInfo) return;

      await mobileApi.recordAction({
        operationId: operationInfo.id,
        action,
        timestamp: new Date().toISOString(),
        location: currentPosition ? {
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude
        } : null
      });

      toast.success(`${action}を記録しました`);

      // ボタンの状態を更新
      if (action === '積込場所到着') {
        setButtonStates(prev => ({
          ...prev,
          load: { enabled: false, text: '積込場所到着' },
          unload: { enabled: true, text: '積降場所到着' }
        }));
        setStatus('積荷確認中');
      } else if (action === '積降場所到着') {
        setButtonStates(prev => ({
          ...prev,
          load: { enabled: true, text: '積込場所到着' },
          unload: { enabled: false, text: '積降場所到着' }
        }));
        setStatus('空車運行中');
      }
    } catch (error) {
      console.error('運行記録送信エラー:', error);
      toast.error('記録の送信に失敗しました');
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？\n運行データは自動保存されます。')) {
      return;
    }

    try {
      // GPS監視停止
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      // 運行終了をサーバーに通知
      if (operationInfo) {
        await mobileApi.endOperation(operationInfo.id, {
          endTime: new Date().toISOString(),
          totalDistance,
          finalLocation: currentPosition ? {
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude
          } : null
        });
      }

      logout();
      toast.success('ログアウトしました');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('ログアウトエラー:', error);
      // エラーが発生してもログアウト処理は継続
      logout();
      navigate('/login', { replace: true });
    }
  };

  // 経過時間計算
  const getElapsedTime = () => {
    const elapsed = currentTime.getTime() - startTime.getTime();
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}時間 ${minutes}分`;
  };

  // 平均速度計算
  const getAverageSpeed = () => {
    const elapsed = currentTime.getTime() - startTime.getTime();
    const elapsedHours = elapsed / (1000 * 60 * 60);
    if (elapsedHours > 0 && totalDistance > 0) {
      return (totalDistance / elapsedHours).toFixed(1);
    }
    return '0.0';
  };

  // 方位表示
  const getDirectionText = () => {
    const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    const directionIndex = Math.round(currentHeading / 45) % 8;
    return `${Math.round(currentHeading)}° (${directions[directionIndex]})`;
  };

  // ローディング画面
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">位置情報を取得中...</p>
          <p className="text-xs text-gray-500 mt-2">WebGLベクターマップを初期化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-sm mx-auto">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
        <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
          status === '運行中' ? 'bg-green-500' : 
          status === '積荷確認中' ? 'bg-orange-500' : 'bg-blue-500'
        } animate-pulse`}>
          {status}
        </div>
        
        <div className="text-center">
          <div className="text-xl font-bold">
            {currentTime.toLocaleTimeString('ja-JP', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            })}
          </div>
          <div className="text-xs opacity-90">
            {currentTime.toLocaleDateString('ja-JP')}
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* マップセクション */}
      <div className="h-56 relative bg-gray-200">
        <div ref={mapRef} className="w-full h-full" />
        
        {/* 方位インジケーター */}
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-lg text-xs font-semibold">
          方位: {getDirectionText()}
        </div>
        
        {/* マップタイプインジケーター */}
        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs">
          マップ: VECTOR
        </div>
      </div>

      {/* 運行情報グリッド */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-lg border-l-4 border-blue-600">
            <div className="text-xs text-gray-600 mb-1">積込場所</div>
            <div className="text-sm font-semibold text-gray-800">
              {operationInfo?.loadingLocation || '○○建設資材置場'}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border-l-4 border-blue-600">
            <div className="text-xs text-gray-600 mb-1">積降場所</div>
            <div className="text-sm font-semibold text-gray-800">
              {operationInfo?.unloadingLocation || '△△工事現場'}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border-l-4 border-blue-600">
            <div className="text-xs text-gray-600 mb-1">積荷</div>
            <div className="text-sm font-semibold text-gray-800">
              {operationInfo?.cargoInfo || '砂利 12t'}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border-l-4 border-blue-600">
            <div className="text-xs text-gray-600 mb-1">経過時間</div>
            <div className="text-sm font-semibold text-gray-800">
              {getElapsedTime()}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border-l-4 border-orange-500">
            <div className="text-xs text-gray-600 mb-1">運行距離</div>
            <div className="text-sm font-semibold text-gray-800">
              {totalDistance.toFixed(1)} km
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border-l-4 border-orange-500">
            <div className="text-xs text-gray-600 mb-1">平均速度</div>
            <div className="text-sm font-semibold text-gray-800">
              {getAverageSpeed()} km/h
            </div>
          </div>
        </div>

        {/* アクションボタングリッド */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleButtonClick('積込場所到着')}
            disabled={!buttonStates.load.enabled}
            className={`p-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
              buttonStates.load.enabled
                ? 'bg-green-500 text-white shadow-lg hover:bg-green-600 active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Truck className="w-5 h-5 mx-auto mb-1" />
            積込場所<br />到着
          </button>
          
          <button
            onClick={() => handleButtonClick('積降場所到着')}
            disabled={!buttonStates.unload.enabled}
            className={`p-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
              buttonStates.unload.enabled
                ? 'bg-green-500 text-white shadow-lg hover:bg-green-600 active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Package className="w-5 h-5 mx-auto mb-1" />
            積降場所<br />到着
          </button>
          
          <button
            onClick={() => handleButtonClick('休憩・荷待ち')}
            className="p-4 rounded-lg font-semibold text-sm bg-orange-500 text-white shadow-lg hover:bg-orange-600 active:scale-95 transition-all duration-200"
          >
            <Coffee className="w-5 h-5 mx-auto mb-1" />
            休憩・荷待ち
          </button>
          
          <button
            onClick={() => handleButtonClick('給油')}
            className="p-4 rounded-lg font-semibold text-sm bg-orange-500 text-white shadow-lg hover:bg-orange-600 active:scale-95 transition-all duration-200"
          >
            <Fuel className="w-5 h-5 mx-auto mb-1" />
            給油
          </button>
        </div>
      </div>

      {/* 底部情報 */}
      <div className="mt-auto bg-gray-50 px-4 py-3 flex justify-between items-center text-xs border-t">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-gray-600">GPS接続中</span>
        </div>
        
        <div className="text-right text-gray-500 leading-tight">
          {currentPosition && (
            <>
              <div>緯度: {currentPosition.coords.latitude.toFixed(6)}</div>
              <div>経度: {currentPosition.coords.longitude.toFixed(6)}</div>
              <div>精度: {Math.round(currentPosition.coords.accuracy)}m</div>
              <div>速度: {currentSpeed.toFixed(1)}km/h</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationRecord;