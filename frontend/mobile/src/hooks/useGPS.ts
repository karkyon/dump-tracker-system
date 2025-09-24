// src/hooks/useGPS.ts - 強化版GPS追跡フック

import { useState, useEffect, useRef, useCallback } from 'react';
import { Position, GPSLogData } from '../types';
import { GPS_CONFIG } from '../utils/constants';
import { calculateDistance, calculateBearing, smoothHeading, smoothSpeed, isValidCoordinate } from '../utils/helpers';
import { apiService as mobileApi } from '../services/api';
import { toast } from 'react-hot-toast';

// フック設定オプションの型定義
interface UseGPSOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoStart?: boolean;
  enableLogging?: boolean;
  operationId?: string;
  vehicleId?: string;
  onPositionUpdate?: (position: Position, metadata: GPSMetadata) => void;
  onError?: (error: GeolocationPositionError) => void;
  onAccuracyChange?: (accuracy: number) => void;
  onSpeedChange?: (speed: number) => void;
  onHeadingChange?: (heading: number) => void;
}

// GPS追跡メタデータ
interface GPSMetadata {
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number | null;
  totalDistance: number;
  averageSpeed: number;
  maxSpeed: number;
  trackingDuration: number;
  qualityStatus: 'high' | 'medium' | 'low' | 'poor';
}

// パスポイント
interface PathPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
  speed: number;
  heading: number;
}

// フック戻り値の型定義
interface UseGPSReturn {
  // 現在の状態
  currentPosition: Position | null;
  previousPosition: Position | null;
  isTracking: boolean;
  error: string | null;
  
  // 計測データ
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  
  // 統計データ
  totalDistance: number;
  averageSpeed: number;
  maxSpeed: number;
  trackingDuration: number;
  
  // パスデータ
  gpsLogs: GPSLogData[];
  pathCoordinates: PathPoint[];
  
  // 品質情報
  qualityStatus: 'high' | 'medium' | 'low' | 'poor';
  lastUpdateTime: Date | null;
  
  // アクション
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  clearPath: () => void;
  exportGPSData: () => GPSLogData[];
  
  // 設定
  updateOptions: (newOptions: Partial<UseGPSOptions>) => void;
}

// 強化版GPS追跡フック
export const useGPS = (initialOptions: UseGPSOptions = {}): UseGPSReturn => {
  // 設定
  const [options, setOptions] = useState<UseGPSOptions>({
    enableHighAccuracy: true,
    timeout: GPS_CONFIG.TIMEOUT,
    maximumAge: GPS_CONFIG.MAXIMUM_AGE,
    autoStart: false,
    enableLogging: false,
    ...initialOptions
  });

  // 基本状態
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [previousPosition, setPreviousPosition] = useState<Position | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 測定データ
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);

  // 統計データ
  const [totalDistance, setTotalDistance] = useState(0);
  const [averageSpeed, setAverageSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [trackingDuration, setTrackingDuration] = useState(0);
  const [qualityStatus, setQualityStatus] = useState<'high' | 'medium' | 'low' | 'poor'>('medium');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // パスデータ
  const [gpsLogs, setGpsLogs] = useState<GPSLogData[]>([]);
  const [pathCoordinates, setPathCoordinates] = useState<PathPoint[]>([]);

  // Refs
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastGPSUpdateRef = useRef<number>(0);
  const headingBufferRef = useRef<number[]>([]);
  const speedBufferRef = useRef<number[]>([]);
  const speedHistoryRef = useRef<number[]>([]);
  const accuracyHistoryRef = useRef<number[]>([]);

  // 品質評価関数
  const evaluateQuality = useCallback((acc: number): 'high' | 'medium' | 'low' | 'poor' => {
    if (acc <= 5) return 'high';
    if (acc <= 15) return 'medium';
    if (acc <= 50) return 'low';
    return 'poor';
  }, []);

  // 統計計算
  const updateStatistics = useCallback(() => {
    if (speedHistoryRef.current.length > 0) {
      const avgSpeed = speedHistoryRef.current.reduce((sum, s) => sum + s, 0) / speedHistoryRef.current.length;
      setAverageSpeed(avgSpeed);
      
      const maxSpeedValue = Math.max(...speedHistoryRef.current);
      setMaxSpeed(maxSpeedValue);
    }

    if (startTimeRef.current) {
      const duration = (Date.now() - startTimeRef.current) / 1000; // seconds
      setTrackingDuration(duration);
    }
  }, []);

  // GPS データ送信
  const sendGPSData = useCallback(async (position: GeolocationPosition, metadata: GPSMetadata) => {
    if (!options.enableLogging || !options.operationId) return;

    try {
      const gpsData: GPSLogData = {
        id: crypto.randomUUID(),
        operationId: options.operationId,
        vehicleId: options.vehicleId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: metadata.heading,
        speed: metadata.speed,
        timestamp: new Date(position.timestamp)
      };

      const requestData = {
        ...gpsData,
        timestamp: gpsData.timestamp.toISOString()
      };
      await mobileApi.logGPS(requestData);
      console.log('GPS data sent successfully');
    } catch (error) {
      console.error('GPS データ送信エラー:', error);
    }
  }, [options.enableLogging, options.operationId, options.vehicleId]);

  // 位置更新処理
  const handlePositionUpdate = useCallback(async (position: GeolocationPosition) => {
    if (isPaused) return;

    const now = Date.now();
    const coords = position.coords;

    // 座標の有効性チェック
    if (!isValidCoordinate(coords.latitude, coords.longitude)) {
      console.warn('Invalid coordinates received:', coords);
      return;
    }

    // 新しいPosition オブジェクト
    const newPosition: Position = {
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude ?? undefined,
        speed: coords.speed ?? undefined,
        heading: coords.heading ?? undefined
      },
      timestamp: position.timestamp
    };

    // 精度データ更新
    const currentAccuracy = coords.accuracy;
    setAccuracy(currentAccuracy);
    accuracyHistoryRef.current.push(currentAccuracy);
    if (accuracyHistoryRef.current.length > 10) {
      accuracyHistoryRef.current.shift();
    }

    // 高度データ更新
    if (coords.altitude !== null && coords.altitude !== undefined) {
      setAltitude(coords.altitude);
    }

    // 速度と方位の計算
    let calculatedSpeed = 0;
    let calculatedHeading = 0;

    if (previousPosition) {
      // 距離計算
      const distance = calculateDistance(
        previousPosition.coords.latitude,
        previousPosition.coords.longitude,
        newPosition.coords.latitude,
        newPosition.coords.longitude
      );

      // 速度計算（GPS速度がある場合は優先、なければ距離/時間で計算）
      if (coords.speed !== null && coords.speed !== undefined && coords.speed >= 0) {
        calculatedSpeed = coords.speed * 3.6; // m/s to km/h
      } else if (now - lastGPSUpdateRef.current > 0) {
        const timeDiff = (now - lastGPSUpdateRef.current) / 1000; // seconds
        calculatedSpeed = (distance / timeDiff) * 3.6; // km/h
      }

      // 方位計算（GPS方位がある場合は優先、なければ計算）
      if (coords.heading !== null && coords.heading !== undefined && coords.heading >= 0) {
        calculatedHeading = coords.heading;
      } else if (calculatedSpeed >= GPS_CONFIG.MIN_SPEED_FOR_HEADING) {
        calculatedHeading = calculateBearing(
          previousPosition.coords.latitude,
          previousPosition.coords.longitude,
          newPosition.coords.latitude,
          newPosition.coords.longitude
        );
      }

      // 平滑化処理
      const smoothedSpeed = smoothSpeed(speedBufferRef.current, calculatedSpeed);
      const smoothedHeading = smoothHeading(headingBufferRef.current, calculatedHeading);

      setSpeed(smoothedSpeed);
      setHeading(smoothedHeading);

      // 統計データ更新
      if (distance > GPS_CONFIG.MIN_DISTANCE_FOR_UPDATE) {
        setTotalDistance(prev => prev + distance);
        
        speedHistoryRef.current.push(smoothedSpeed);
        if (speedHistoryRef.current.length > 50) {
          speedHistoryRef.current.shift();
        }
      }

      // パスポイント追加
      const pathPoint: PathPoint = {
        lat: newPosition.coords.latitude,
        lng: newPosition.coords.longitude,
        timestamp: now,
        accuracy: currentAccuracy,
        speed: smoothedSpeed,
        heading: smoothedHeading
      };

      if (distance > GPS_CONFIG.MIN_DISTANCE_FOR_UPDATE) {
        setPathCoordinates(prev => [...prev, pathPoint]);
      }
    } else {
      // 初回位置設定
      setSpeed(0);
      setHeading(0);
      speedHistoryRef.current = [0];
    }

    // 品質評価
    const quality = evaluateQuality(currentAccuracy);
    setQualityStatus(quality);

    // メタデータ作成
    const metadata: GPSMetadata = {
      accuracy: currentAccuracy,
      speed: calculatedSpeed,
      heading: calculatedHeading,
      altitude: coords.altitude,
      totalDistance: totalDistance,
      averageSpeed: averageSpeed,
      maxSpeed: maxSpeed,
      trackingDuration: trackingDuration,
      qualityStatus: quality
    };

    // GPS ログ追加
    const gpsLog: GPSLogData = {
      id: crypto.randomUUID(),
      operationId: options.operationId,
      vehicleId: options.vehicleId,
      latitude: newPosition.coords.latitude,
      longitude: newPosition.coords.longitude,
      accuracy: currentAccuracy,
      heading: calculatedHeading,
      speed: calculatedSpeed,
      timestamp: new Date(position.timestamp),
      createdAt: new Date()
    };

    // 定期間隔でのみログに追加
    if (now - lastGPSUpdateRef.current > GPS_CONFIG.GPS_UPDATE_INTERVAL) {
      setGpsLogs(prev => [...prev, gpsLog]);
      
      // サーバーへのデータ送信
      await sendGPSData(position, metadata);
      
      lastGPSUpdateRef.current = now;
    }

    // 状態更新
    setPreviousPosition(currentPosition);
    setCurrentPosition(newPosition);
    setLastUpdateTime(new Date());

    // 統計更新
    updateStatistics();

    // コールバック実行
    options.onPositionUpdate?.(newPosition, metadata);
    options.onAccuracyChange?.(currentAccuracy);
    options.onSpeedChange?.(calculatedSpeed);
    options.onHeadingChange?.(calculatedHeading);

  }, [
    isPaused, previousPosition, currentPosition, totalDistance, averageSpeed, maxSpeed, 
    trackingDuration, options, sendGPSData, updateStatistics, evaluateQuality
  ]);

  // エラーハンドリング
  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = '位置情報の取得に失敗しました';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = '位置情報の使用が許可されていません。ブラウザの設定を確認してください。';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = '位置情報が利用できません。GPS信号を確認してください。';
        break;
      case error.TIMEOUT:
        errorMessage = '位置情報の取得がタイムアウトしました。';
        break;
    }

    setError(errorMessage);
    toast.error(errorMessage);
    console.error('GPS Error:', error);

    options.onError?.(error);
  }, [options]);

  // 追跡開始
  const startTracking = useCallback(async (): Promise<void> => {
    if (!navigator.geolocation) {
      const errorMsg = 'このデバイスは位置情報をサポートしていません';
      setError(errorMsg);
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (isTracking) {
      console.warn('GPS tracking is already active');
      return;
    }

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? GPS_CONFIG.TIMEOUT,
      maximumAge: options.maximumAge ?? GPS_CONFIG.MAXIMUM_AGE
    };

    try {
      // 初回位置取得
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, gpsOptions);
      });

      await handlePositionUpdate(position);
      setError(null);
      setIsTracking(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();

      // 継続監視開始
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handleError,
        gpsOptions
      );

      toast.success('GPS追跡を開始しました');
      console.log('GPS tracking started');

    } catch (error) {
      handleError(error as GeolocationPositionError);
      throw error;
    }
  }, [isTracking, options, handlePositionUpdate, handleError]);

  // 追跡停止
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(false);
    setIsPaused(false);
    startTimeRef.current = null;
    
    toast.success('GPS追跡を停止しました');
    console.log('GPS tracking stopped');
  }, []);

  // 追跡一時停止
  const pauseTracking = useCallback(() => {
    if (isTracking) {
      setIsPaused(true);
      toast('GPS追跡を一時停止しました');
    }
  }, [isTracking]);

  // 追跡再開
  const resumeTracking = useCallback(() => {
    if (isTracking && isPaused) {
      setIsPaused(false);
      toast.success('GPS追跡を再開しました');
    }
  }, [isTracking, isPaused]);

  // パスクリア
  const clearPath = useCallback(() => {
    setPathCoordinates([]);
    setGpsLogs([]);
    setTotalDistance(0);
    setAverageSpeed(0);
    setMaxSpeed(0);
    setTrackingDuration(0);
    speedHistoryRef.current = [];
    accuracyHistoryRef.current = [];
    
    toast.success('パスデータをクリアしました');
  }, []);

  // GPSデータエクスポート
  const exportGPSData = useCallback((): GPSLogData[] => {
    return [...gpsLogs];
  }, [gpsLogs]);

  // 設定更新
  const updateOptions = useCallback((newOptions: Partial<UseGPSOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  // 自動開始
  useEffect(() => {
    if (options.autoStart && !isTracking) {
      startTracking().catch(console.error);
    }
  }, [options.autoStart, isTracking, startTracking]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    // 現在の状態
    currentPosition,
    previousPosition,
    isTracking,
    error,
    
    // 計測データ
    accuracy,
    heading,
    speed,
    altitude,
    
    // 統計データ
    totalDistance,
    averageSpeed,
    maxSpeed,
    trackingDuration,
    
    // パスデータ
    gpsLogs,
    pathCoordinates,
    
    // 品質情報
    qualityStatus,
    lastUpdateTime,
    
    // アクション
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    clearPath,
    exportGPSData,
    
    // 設定
    updateOptions
  };
};