// frontend/mobile/src/hooks/useGPS.ts
// 🔧 方位更新即時反映版
// ✅ デモスクリプトのロジックを忠実に再現
// 修正日時: 2025-10-24
// 修正内容:
//  1. refを使用して即座に方位を更新
//  2. stateとrefの両方で値を管理
//  3. 依存配列の問題を解決

import { useState, useEffect, useRef, useCallback } from 'react';
import { Position } from '../types';
import { GPS_CONFIG } from '../utils/constants';
import { 
  calculateDistance, 
  calculateBearing, 
  smoothHeading, 
  smoothSpeed, 
  isValidCoordinate 
} from '../utils/helpers';
import { apiService as mobileApi } from '../services/api';
import { toast } from 'react-hot-toast';

// GPSログデータ型定義
export interface GPSLogData {
  id: string;
  operationId?: string;
  vehicleId?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number;
  speed: number;
  timestamp: Date;
  createdAt?: Date;
}

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

// 平滑化バッファサイズ
const HEADING_BUFFER_SIZE = 5;
const SPEED_BUFFER_SIZE = 3;

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

  // 測定データ（stateとrefの両方で管理）
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);

  // 🔧 重要: refで即座にアクセス可能な値を保持
  const headingRef = useRef<number>(0);
  const speedRef = useRef<number>(0);

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
  const previousPositionRef = useRef<Position | null>(null);
  const currentPositionRef = useRef<Position | null>(null);

  // 品質評価関数
  const evaluateQuality = (acc: number): 'high' | 'medium' | 'low' | 'poor' => {
    if (acc <= 5) return 'high';
    if (acc <= 15) return 'medium';
    if (acc <= 50) return 'low';
    return 'poor';
  };

  // 統計計算
  const updateStatistics = () => {
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
  };

  // GPS データ送信
  const sendGPSData = async (position: GeolocationPosition, metadata: GPSMetadata) => {
    if (!options.enableLogging || !options.operationId) return;

    try {
      const gpsData = {
        operationId: options.operationId,
        vehicleId: options.vehicleId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: metadata.heading,
        speed: metadata.speed,
        timestamp: new Date(position.timestamp).toISOString()
      };

      await mobileApi.updateGPSLocation(gpsData);
      console.log('✅ GPS data sent successfully');
    } catch (error) {
      console.error('❌ GPS データ送信エラー:', error);
    }
  };

  // 位置更新処理
  const handlePositionUpdate = (position: GeolocationPosition) => {
    if (isPaused) return;

    const now = Date.now();
    const coords = position.coords;

    // 座標の有効性チェック
    if (!isValidCoordinate(coords.latitude, coords.longitude)) {
      console.warn('⚠️ Invalid coordinates received:', coords);
      return;
    }

    console.log('📍 GPS位置更新:', {
      lat: coords.latitude.toFixed(6),
      lng: coords.longitude.toFixed(6),
      speed: coords.speed,
      heading: coords.heading,
      accuracy: coords.accuracy
    });

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

    const prevPos = previousPositionRef.current;

    if (prevPos) {
      // 距離計算
      const distance = calculateDistance(
        prevPos.coords.latitude,
        prevPos.coords.longitude,
        newPosition.coords.latitude,
        newPosition.coords.longitude
      );

      console.log(`📏 移動距離: ${(distance * 1000).toFixed(2)}m`);

      // 🔧 速度計算（GPS速度がある場合は優先、なければ距離/時間で計算）
      if (coords.speed !== null && coords.speed !== undefined && coords.speed >= 0) {
        calculatedSpeed = coords.speed * 3.6; // m/s to km/h
        console.log(`📡 GPS速度使用: ${calculatedSpeed.toFixed(1)}km/h`);
      } else if (now - lastGPSUpdateRef.current > 0) {
        const timeDiff = (now - lastGPSUpdateRef.current) / 1000; // seconds
        calculatedSpeed = (distance / timeDiff) * 3.6; // km/h
        console.log(`🧮 計算速度使用: ${calculatedSpeed.toFixed(1)}km/h`);
      }

      // 🔧 方位計算 - デモスクリプトと同じロジック
      // GPS方位がある場合は優先
      if (coords.heading !== null && coords.heading !== undefined && coords.heading >= 0) {
        calculatedHeading = coords.heading;
        console.log(`📡 GPS方位使用: ${calculatedHeading.toFixed(1)}°`);
      } 
      // GPS方位がない、または速度が十分にある場合は2点間の方位を計算
      else if (calculatedSpeed >= 0.5) { // 0.5km/h以上で方位を計算
        calculatedHeading = calculateBearing(
          prevPos.coords.latitude,
          prevPos.coords.longitude,
          newPosition.coords.latitude,
          newPosition.coords.longitude
        );
        console.log(`🧮 計算方位使用: ${calculatedHeading.toFixed(1)}° (速度: ${calculatedSpeed.toFixed(1)}km/h)`);
      } 
      // 速度が遅すぎる場合は前回の方位を維持
      else {
        calculatedHeading = headingRef.current;
        console.log(`⏸️ 方位維持: ${calculatedHeading.toFixed(1)}° (速度不足: ${calculatedSpeed.toFixed(1)}km/h)`);
      }

      // バッファに値を追加
      speedBufferRef.current.push(calculatedSpeed);
      if (speedBufferRef.current.length > SPEED_BUFFER_SIZE) {
        speedBufferRef.current.shift();
      }

      // 方位バッファ更新（移動中のみ）
      if (calculatedSpeed >= 0.5) {
        headingBufferRef.current.push(calculatedHeading);
        if (headingBufferRef.current.length > HEADING_BUFFER_SIZE) {
          headingBufferRef.current.shift();
        }
      }

      // 平滑化
      const smoothedSpeed: number = smoothSpeed(speedBufferRef.current, calculatedSpeed);
      const smoothedHeading: number = headingBufferRef.current.length > 0 
        ? smoothHeading(headingBufferRef.current, calculatedHeading) 
        : calculatedHeading;

      console.log(`🎯 平滑化結果 - 速度: ${smoothedSpeed.toFixed(1)}km/h, 方位: ${smoothedHeading.toFixed(1)}°`);

      // 🔧 重要: refに即座に保存（stateの更新を待たない）
      speedRef.current = smoothedSpeed;
      headingRef.current = smoothedHeading;

      // stateも更新（UIの再レンダリング用）
      setSpeed(smoothedSpeed);
      setHeading(smoothedHeading);

      // 統計データ更新
      if (distance > GPS_CONFIG.MIN_DISTANCE_METERS / 1000) {
        setTotalDistance(prev => {
          const newTotal = prev + distance;
          console.log(`🛣️ 総走行距離: ${newTotal.toFixed(3)}km`);
          return newTotal;
        });
        
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

      if (distance > GPS_CONFIG.MIN_DISTANCE_METERS / 1000) {
        setPathCoordinates(prev => [...prev, pathPoint]);
      }
    } else {
      // 初回位置設定
      console.log('🎬 初回GPS位置設定');
      setSpeed(0);
      setHeading(0);
      speedRef.current = 0;
      headingRef.current = 0;
      speedBufferRef.current = [0];
      headingBufferRef.current = [0];
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
    if (now - lastGPSUpdateRef.current > GPS_CONFIG.UPDATE_INTERVAL) {
      setGpsLogs(prev => [...prev, gpsLog]);
      
      // サーバーへのデータ送信
      sendGPSData(position, metadata);
      
      lastGPSUpdateRef.current = now;
    }

    // 位置参照の更新
    previousPositionRef.current = currentPositionRef.current;
    currentPositionRef.current = newPosition;

    // 状態更新
    setPreviousPosition(previousPositionRef.current);
    setCurrentPosition(newPosition);
    setLastUpdateTime(new Date());

    // 統計更新
    updateStatistics();

    // コールバック実行
    options.onPositionUpdate?.(newPosition, metadata);
    options.onAccuracyChange?.(currentAccuracy);
    options.onSpeedChange?.(calculatedSpeed);
    options.onHeadingChange?.(calculatedHeading);
  };

  // エラーハンドリング
  const handleError = (error: GeolocationPositionError) => {
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
    console.error('❌ GPS Error:', error);

    options.onError?.(error);
  };

  // 追跡開始
  const startTracking = useCallback(async (): Promise<void> => {
    if (!navigator.geolocation) {
      const errorMsg = 'このデバイスは位置情報をサポートしていません';
      setError(errorMsg);
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (isTracking) {
      console.warn('⚠️ GPS tracking is already active');
      return;
    }

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? GPS_CONFIG.TIMEOUT,
      maximumAge: options.maximumAge ?? GPS_CONFIG.MAXIMUM_AGE
    };

    console.log('🚀 GPS追跡開始 - オプション:', gpsOptions);

    try {
      // 初回位置取得
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ 初回GPS位置取得成功');
          handlePositionUpdate(position);
        },
        handleError,
        gpsOptions
      );

      // 継続追跡開始
      const watchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handleError,
        gpsOptions
      );

      watchIdRef.current = watchId;
      startTimeRef.current = Date.now();
      lastGPSUpdateRef.current = Date.now();
      setIsTracking(true);
      setIsPaused(false);
      setError(null);

      toast.success('GPS追跡を開始しました');
      console.log('🛰️ GPS追跡開始 - Watch ID:', watchId);
    } catch (err) {
      console.error('❌ GPS追跡開始エラー:', err);
      handleError(err as GeolocationPositionError);
      throw err;
    }
  }, [isTracking, options]);

  // 追跡停止
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(false);
    setIsPaused(false);
    startTimeRef.current = null;
    
    console.log('🛑 GPS追跡停止');
    toast.success('GPS追跡を停止しました');
  }, []);

  // 追跡一時停止
  const pauseTracking = useCallback(() => {
    setIsPaused(true);
    console.log('⏸️ GPS追跡一時停止');
    toast('GPS追跡を一時停止しました');
  }, []);

  // 追跡再開
  const resumeTracking = useCallback(() => {
    setIsPaused(false);
    console.log('▶️ GPS追跡再開');
    toast('GPS追跡を再開しました');
  }, []);

  // パスクリア
  const clearPath = useCallback(() => {
    setPathCoordinates([]);
    setGpsLogs([]);
    setTotalDistance(0);
    setAverageSpeed(0);
    setMaxSpeed(0);
    speedHistoryRef.current = [];
    console.log('🗑️ パスデータクリア');
  }, []);

  // GPSデータエクスポート
  const exportGPSData = useCallback((): GPSLogData[] => {
    return gpsLogs;
  }, [gpsLogs]);

  // オプション更新
  const updateOptions = useCallback((newOptions: Partial<UseGPSOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  // 自動開始
  useEffect(() => {
    if (options.autoStart) {
      startTracking();
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [options.autoStart]);

  return {
    // 状態
    currentPosition,
    previousPosition,
    isTracking,
    error,
    
    // 測定データ
    accuracy,
    heading,
    speed,
    altitude,
    
    // 統計
    totalDistance,
    averageSpeed,
    maxSpeed,
    trackingDuration,
    
    // パスデータ
    gpsLogs,
    pathCoordinates,
    
    // 品質
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