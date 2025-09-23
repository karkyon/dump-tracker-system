// frontend/mobile/src/types/index.ts
export interface User {
  id: string;
  userId: string;
  name: string;
  role: string;
  vehicleId: string;
}

export interface Position {
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

export interface OperationInfo {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime?: string;
  loadingLocation?: string;
  unloadingLocation?: string;
  cargoInfo?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  totalDistance?: number;
}

export interface GPSLogData {
  operationId: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speedKmh?: number | null;
  heading?: number | null;
  accuracyMeters?: number | null;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// frontend/mobile/src/utils/constants.ts
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1',
  TIMEOUT: 30000,
  GPS_UPDATE_INTERVAL: parseInt(import.meta.env.VITE_GPS_UPDATE_INTERVAL || '5000'),
  OFFLINE_DATA_RETENTION: parseInt(import.meta.env.VITE_OFFLINE_DATA_RETENTION || '24') * 60 * 60 * 1000
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  REMEMBER_LOGIN: 'remember_login',
  OFFLINE_DATA: 'offline_data',
  GPS_CACHE: 'gps_cache'
};

export const GPS_CONFIG = {
  HIGH_ACCURACY: true,
  TIMEOUT: 10000,
  MAXIMUM_AGE: 0,
  MIN_DISTANCE_FOR_UPDATE: 0.001, // 1m
  MIN_SPEED_FOR_HEADING: 1.0, // 1km/h
  HEADING_SMOOTHING_FACTOR: 3,
  SPEED_SMOOTHING_FACTOR: 2
};

export const MAP_CONFIG = {
  DEFAULT_LAT: 34.6937, // 大阪
  DEFAULT_LNG: 135.5023,
  DEFAULT_ZOOM: 18,
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
};

export const OPERATION_ACTIONS = {
  LOAD_ARRIVAL: '積込場所到着',
  UNLOAD_ARRIVAL: '積降場所到着',
  BREAK: '休憩・荷待ち',
  FUEL: '給油'
} as const;

// frontend/mobile/src/utils/helpers.ts
import { GPS_CONFIG } from './constants';

/**
 * 2点間の距離を計算（ハーバーサイン公式）
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // 地球の半径（km）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * 2点間の方位角を計算
 */
export const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
           Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

/**
 * 方位角の平滑化
 */
export const smoothHeading = (headingBuffer: number[], newHeading: number): number => {
  headingBuffer.push(newHeading);
  if (headingBuffer.length > GPS_CONFIG.HEADING_SMOOTHING_FACTOR) {
    headingBuffer.shift();
  }

  if (headingBuffer.length > 1) {
    const lastHeading = headingBuffer[headingBuffer.length - 2];
    const diff = Math.abs(newHeading - lastHeading);
    const adjustedDiff = Math.min(diff, 360 - diff);
    
    if (adjustedDiff > 30) {
      return newHeading;
    }
  }

  let sumX = 0, sumY = 0;
  headingBuffer.forEach(heading => {
    sumX += Math.cos(heading * Math.PI / 180);
    sumY += Math.sin(heading * Math.PI / 180);
  });
  
  let avgHeading = Math.atan2(sumY, sumX) * 180 / Math.PI;
  return (avgHeading + 360) % 360;
};

/**
 * 速度の平滑化
 */
export const smoothSpeed = (speedBuffer: number[], newSpeed: number): number => {
  speedBuffer.push(newSpeed);
  if (speedBuffer.length > GPS_CONFIG.SPEED_SMOOTHING_FACTOR) {
    speedBuffer.shift();
  }
  return speedBuffer.reduce((sum, speed) => sum + speed, 0) / speedBuffer.length;
};

/**
 * 方位を文字列に変換
 */
export const headingToDirection = (heading: number): string => {
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const directionIndex = Math.round(heading / 45) % 8;
  return directions[directionIndex];
};

/**
 * 時間差を文字列に変換
 */
export const formatElapsedTime = (startTime: Date, currentTime: Date): string => {
  const elapsed = currentTime.getTime() - startTime.getTime();
  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}時間 ${minutes}分`;
};

/**
 * デバイス情報取得
 */
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid;
  
  return {
    isIOS,
    isAndroid,
    isMobile,
    userAgent,
    platform: navigator.platform,
    language: navigator.language
  };
};

/**
 * ネットワーク状態チェック
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * 位置情報許可状態チェック
 */
export const checkGeolocationPermission = async (): Promise<string> => {
  if (!navigator.permissions) {
    return 'unsupported';
  }
  
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state;
  } catch {
    return 'unsupported';
  }
};

// frontend/mobile/src/hooks/useGPS.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Position, GPSLogData } from '../types';
import { GPS_CONFIG, MAP_CONFIG } from '../utils/constants';
import { calculateDistance, calculateBearing, smoothHeading, smoothSpeed } from '../utils/helpers';
import { mobileApi } from '../services/api';
import { toast } from 'react-hot-toast';

interface UseGPSOptions {
  onPositionUpdate?: (position: Position) => void;
  onError?: (error: GeolocationPositionError) => void;
  enableLogging?: boolean;
  operationId?: string;
}

export const useGPS = (options: UseGPSOptions = {}) => {
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [previousPosition, setPreviousPosition] = useState<Position | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const headingBufferRef = useRef<number[]>([]);
  const speedBufferRef = useRef<number[]>([]);
  const lastGPSUpdateRef = useRef<number>(0);
  const pathCoordinatesRef = useRef<{ lat: number; lng: number }[]>([]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsTracking(false);
    }
  }, []);

  const sendGPSData = useCallback(async (position: Position) => {
    if (!options.enableLogging || !options.operationId) return;

    try {
      const gpsData: GPSLogData = {
        operationId: options.operationId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude || null,
        speedKmh: position.coords.speed ? position.coords.speed * 3.6 : currentSpeed,
        heading: currentHeading,
        accuracyMeters: position.coords.accuracy,
        timestamp: new Date().toISOString()
      };

      await mobileApi.logGPS(gpsData);
    } catch (error) {
      console.error('GPS データ送信エラー:', error);
    }
  }, [options.enableLogging, options.operationId, currentSpeed, currentHeading]);

  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
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
      const smoothedSpeed = smoothSpeed(speedBufferRef.current, rawSpeed);
      setCurrentSpeed(smoothedSpeed);

      if (distance > GPS_CONFIG.MIN_DISTANCE_FOR_UPDATE) {
        setTotalDistance(prev => prev + distance);

        if (smoothedSpeed >= GPS_CONFIG.MIN_SPEED_FOR_HEADING) {
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

          const smoothedHeading = smoothHeading(headingBufferRef.current, newHeading);
          setCurrentHeading(smoothedHeading);
        }

        pathCoordinatesRef.current.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      }
    }

    setPreviousPosition(currentPosition);
    setCurrentPosition(pos);

    // 定期的にGPSデータを送信
    if (now - lastGPSUpdateRef.current > GPS_CONFIG.GPS_UPDATE_INTERVAL) {
      sendGPSData(pos);
      lastGPSUpdateRef.current = now;
    }

    options.onPositionUpdate?.(pos);
  }, [currentPosition, previousPosition, currentHeading, sendGPSData, options]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = '位置情報の取得に失敗しました';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = '位置情報の使用が許可されていません';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = '位置情報が利用できません';
        break;
      case error.TIMEOUT:
        errorMessage = '位置情報の取得がタイムアウトしました';
        break;
    }

    setError(errorMessage);
    options.onError?.(error);
    toast.error(errorMessage);
  }, [options]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      const errorMsg = 'このデバイスは位置情報をサポートしていません';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: GPS_CONFIG.HIGH_ACCURACY,
      timeout: GPS_CONFIG.TIMEOUT,
      maximumAge: GPS_CONFIG.MAXIMUM_AGE
    };

    // 初回位置取得
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionUpdate(position);
        setError(null);
      },
      handleError,
      gpsOptions
    );

    // 継続的な位置監視
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleError,
      gpsOptions
    );

    setIsTracking(true);
  }, [handlePositionUpdate, handleError]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    currentPosition,
    previousPosition,
    totalDistance,
    currentSpeed,
    currentHeading,
    isTracking,
    error,
    pathCoordinates: pathCoordinatesRef.current,
    startTracking,
    stopTracking
  };
};

// frontend/mobile/src/hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // ネットワーク情報API（対応ブラウザのみ）
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      setConnectionType(connection.effectiveType || 'unknown');

      const handleConnectionChange = () => {
        setConnectionType(connection.effectiveType || 'unknown');
      };

      connection.addEventListener('change', handleConnectionChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    connectionType,
    isSlowConnection: connectionType === 'slow-2g' || connectionType === '2g'
  };
};

// frontend/mobile/src/hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  const removeValue = () => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  };

  // ストレージイベントリスナー（他のタブでの変更を検知）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error(`Error parsing storage event for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue] as const;
};