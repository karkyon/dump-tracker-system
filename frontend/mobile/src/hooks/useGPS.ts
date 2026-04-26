// frontend/mobile/src/hooks/useGPS.ts
// 🔧 GPS方位検知完全改善版 v2
// 修正日時: 2025-10-26
// 修正内容:
//  1. 速度閾値を0.3km/hに引き下げ（より敏感に方向変化を検知）
//  2. 最小移動距離を2mに引き下げ（より細かい移動でも方位計算）
//  3. 方位計算の優先順位を完全に最適化（実際の移動を最優先）
//  4. 停止中でも一定の移動があれば方位を更新
//  5. 角度差分による方位更新の判定を追加
//  6. GPS方位と計算方位のインテリジェントな併用
//  7. 🔧 距離単位の修正（helpers.tsに合わせてキロメートルで統一）
//  8. 🔧 平滑化関数の呼び出し方法を修正（バッファ二重追加を防止）

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
import { logGPSEvent } from '../utils/gpsLogger'; // ✅ Log-FE-1
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
  currentPosition: Position | null;
  previousPosition: Position | null;
  isTracking: boolean;
  error: string | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  totalDistance: number;
  averageSpeed: number;
  maxSpeed: number;
  trackingDuration: number;
  gpsLogs: GPSLogData[];
  pathCoordinates: PathPoint[];
  qualityStatus: 'high' | 'medium' | 'low' | 'poor';
  lastUpdateTime: Date | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  clearPath: () => void;
  exportGPSData: () => GPSLogData[];
  updateOptions: (newOptions: Partial<UseGPSOptions>) => void;
}

// 🔧 改善された定数（キロメートル単位で統一）
const HEADING_BUFFER_SIZE = 5;
const SPEED_BUFFER_SIZE = 3;
const MIN_SPEED_FOR_HEADING = 0.3; // km/h
const MIN_DISTANCE_FOR_HEADING = 0.002; // km (約2m)
const MIN_HEADING_CHANGE = 5; // 度
const HIGH_SPEED_THRESHOLD = 5; // km/h
const LONG_DISTANCE_THRESHOLD = 0.01; // km (約10m)

export const useGPS = (initialOptions: UseGPSOptions = {}): UseGPSReturn => {
  const [options, setOptions] = useState<UseGPSOptions>({
    enableHighAccuracy: true,
    timeout: GPS_CONFIG.TIMEOUT,
    maximumAge: GPS_CONFIG.MAXIMUM_AGE,
    autoStart: false,
    enableLogging: false,
    ...initialOptions
  });

  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [previousPosition, setPreviousPosition] = useState<Position | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);
  
  const headingRef = useRef<number>(0);
  const speedRef = useRef<number>(0);
  
  const [totalDistance, setTotalDistance] = useState(0);
  const [averageSpeed, setAverageSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [trackingDuration, setTrackingDuration] = useState(0);
  const [qualityStatus, setQualityStatus] = useState<'high' | 'medium' | 'low' | 'poor'>('medium');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [gpsLogs, setGpsLogs] = useState<GPSLogData[]>([]);
  const [pathCoordinates, setPathCoordinates] = useState<PathPoint[]>([]);
  
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastGPSUpdateRef = useRef<number>(0);
  const headingBufferRef = useRef<number[]>([]);
  const speedBufferRef = useRef<number[]>([]);
  const speedHistoryRef = useRef<number[]>([]);
  const accuracyHistoryRef = useRef<number[]>([]);
  const previousPositionRef = useRef<Position | null>(null);
  const currentPositionRef = useRef<Position | null>(null);
  // BUG-020: iOS バックグラウンド復帰時のGPS再開用ref
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // ✅ Session12: setIntervalでGPS送信を確実にインターバル制御
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 最新のGPS位置とmetadataを保持するref（setInterval内で参照するためref必須）
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const latestMetadataRef = useRef<GPSMetadata | null>(null);
  const isTrackingRef = useRef<boolean>(false);

  const evaluateQuality = (acc: number): 'high' | 'medium' | 'low' | 'poor' => {
    if (acc <= 5) return 'high';
    if (acc <= 15) return 'medium';
    if (acc <= 50) return 'low';
    return 'poor';
  };

  const updateStatistics = () => {
    if (speedHistoryRef.current.length > 0) {
      const avgSpeed = speedHistoryRef.current.reduce((sum, s) => sum + s, 0) / speedHistoryRef.current.length;
      setAverageSpeed(avgSpeed);
      const maxSpeedValue = Math.max(...speedHistoryRef.current);
      setMaxSpeed(maxSpeedValue);
    }
    if (startTimeRef.current) {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      setTrackingDuration(duration);
    }
  };

  const sendGPSData = async (position: GeolocationPosition, metadata: GPSMetadata) => {
    if (!options.enableLogging || !options.operationId) return;
    // ✅ Fix-4A: accuracy > 100m の座標はバックエンドに送信しない（屋内誤差防止）
    if (position.coords.accuracy > 100) {
      console.warn(`⚠️ [Fix-4A] GPS送信スキップ: 精度不足 accuracy=${position.coords.accuracy.toFixed(0)}m (上限:100m)`);
      logGPSEvent({ type: 'ACCURACY_FILTER',
        lat: position.coords.latitude, lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        detail: { threshold: 100, stage: 'sendGPSData' }
      });
      return;
    }
    try {
      const gpsData = {
        operationId: options.operationId,
        vehicleId: options.vehicleId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: metadata.heading,
        speed: metadata.speed,
        timestamp: new Date(position.timestamp).toISOString(),
        // ✅ Fix-S11-7: 累積走行距離をバックエンドに送信（endOperation時のフォールバック用）
        totalDistanceKm: metadata.totalDistance
      };
      await mobileApi.updateGPSLocation(gpsData);
      console.log('✅ GPS data sent successfully');
      logGPSEvent({ type: 'API_SUCCESS',
        lat: position.coords.latitude, lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: metadata.speed,
        totalDistanceKm: metadata.totalDistance,
        operationId: options.operationId,
        detail: { totalDistanceKm: gpsData.totalDistanceKm }
      });
    } catch (error) {
      console.error('❌ GPS データ送信エラー:', error);
    }
  };

// 🔧 改善された位置更新処理
  const handlePositionUpdate = (position: GeolocationPosition) => {
    if (isPaused) return;

    const now = Date.now();
    const coords = position.coords;

    if (!isValidCoordinate(coords.latitude, coords.longitude)) {
      console.warn('⚠️ Invalid coordinates received:', coords);
      return;
    }

    // ✅ Fix-4B: accuracy > 150m の座標は位置更新・距離計算・pathCoordinatesに使用しない
    // テスト環境や屋内での誤った走行距離（数百km）を防ぐためのガード
    if (coords.accuracy > 150) {
      console.warn(`⚠️ [Fix-4B] GPS位置更新スキップ: 精度不足 accuracy=${coords.accuracy.toFixed(0)}m (上限:150m) — この座標は記録しません`);
      logGPSEvent({ type: 'ACCURACY_FILTER',
        lat: coords.latitude, lng: coords.longitude,
        accuracy: coords.accuracy,
        detail: { threshold: 150, stage: 'handlePositionUpdate' }
      });
      return;
    }

    console.log('📍 GPS位置更新:', {
      lat: coords.latitude.toFixed(6),
      lng: coords.longitude.toFixed(6),
      speed: coords.speed,
      heading: coords.heading,
      accuracy: coords.accuracy
    });

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

    const currentAccuracy = coords.accuracy;
    setAccuracy(currentAccuracy);
    accuracyHistoryRef.current.push(currentAccuracy);
    if (accuracyHistoryRef.current.length > 10) {
      accuracyHistoryRef.current.shift();
    }

    if (coords.altitude !== null && coords.altitude !== undefined) {
      setAltitude(coords.altitude);
    }

    let calculatedSpeed = 0;
    let calculatedHeading = 0;
    let headingSource = 'none';

    const prevPos = previousPositionRef.current;

    if (prevPos) {
      // 🔧 距離計算（キロメートルを返す）
      const distance = calculateDistance(
        prevPos.coords.latitude,
        prevPos.coords.longitude,
        newPosition.coords.latitude,
        newPosition.coords.longitude
      );

      console.log(`📏 移動距離: ${(distance * 1000).toFixed(2)}m`);

      // 🔧 速度計算
      if (coords.speed !== null && coords.speed !== undefined && coords.speed >= 0) {
        calculatedSpeed = coords.speed * 3.6; // m/s to km/h
        console.log(`📡 GPS速度使用: ${calculatedSpeed.toFixed(1)}km/h`);
      } else if (now - lastGPSUpdateRef.current > 0) {
        const timeDiff = (now - lastGPSUpdateRef.current) / 1000;
        calculatedSpeed = (distance / timeDiff) * 3600; // km/h
        console.log(`🧮 計算速度使用: ${calculatedSpeed.toFixed(1)}km/h`);
      }

      // 🔧 改善された方位計算ロジック
      let shouldCalculateBearing = false;
      
      if (distance >= MIN_DISTANCE_FOR_HEADING) {
        shouldCalculateBearing = true;
        console.log(`✅ 移動距離十分 (${(distance * 1000).toFixed(2)}m >= 2m)`);
      }
      
      if (calculatedSpeed >= MIN_SPEED_FOR_HEADING) {
        shouldCalculateBearing = true;
        console.log(`✅ 速度十分 (${calculatedSpeed.toFixed(1)}km/h >= ${MIN_SPEED_FOR_HEADING}km/h)`);
      }

      if (shouldCalculateBearing) {
        const bearingFromMovement = calculateBearing(
          prevPos.coords.latitude,
          prevPos.coords.longitude,
          newPosition.coords.latitude,
          newPosition.coords.longitude
        );
        
        console.log(`🧭 計算方位: ${bearingFromMovement.toFixed(1)}°`);
        
        if (coords.heading !== null && coords.heading !== undefined && coords.heading >= 0) {
          console.log(`📡 GPS方位: ${coords.heading.toFixed(1)}°`);
          
          let headingDiff = Math.abs(coords.heading - bearingFromMovement);
          if (headingDiff > 180) {
            headingDiff = 360 - headingDiff;
          }
          
          console.log(`📊 方位差分: ${headingDiff.toFixed(1)}°`);
          
          if (calculatedSpeed > HIGH_SPEED_THRESHOLD || distance > LONG_DISTANCE_THRESHOLD) {
            calculatedHeading = bearingFromMovement;
            headingSource = 'calculated_priority';
            console.log(`🚀 計算方位優先: ${calculatedHeading.toFixed(1)}° (高速/長距離移動)`);
          } 
          else if (headingDiff > 30) {
            calculatedHeading = bearingFromMovement;
            headingSource = 'calculated_large_diff';
            console.log(`⚠️ 計算方位優先: ${calculatedHeading.toFixed(1)}° (大きな差分: ${headingDiff.toFixed(1)}°)`);
          }
          else {
            if (headingDiff > 90) {
              const adjustedGPS = coords.heading < 180 ? coords.heading + 360 : coords.heading;
              const adjustedBearing = bearingFromMovement < 180 ? bearingFromMovement + 360 : bearingFromMovement;
              calculatedHeading = ((adjustedGPS + adjustedBearing) / 2) % 360;
            } else {
              calculatedHeading = (coords.heading + bearingFromMovement) / 2;
            }
            headingSource = 'averaged';
            console.log(`📊 方位平均: ${calculatedHeading.toFixed(1)}° (GPS: ${coords.heading.toFixed(1)}°, 計算: ${bearingFromMovement.toFixed(1)}°)`);
          }
        } else {
          calculatedHeading = bearingFromMovement;
          headingSource = 'calculated_only';
          console.log(`🧮 計算方位のみ: ${calculatedHeading.toFixed(1)}° (GPS方位なし)`);
        }
      } 
      else if (coords.heading !== null && coords.heading !== undefined && coords.heading >= 0) {
        const currentHeading = headingRef.current;
        let headingDiff = Math.abs(coords.heading - currentHeading);
        if (headingDiff > 180) {
          headingDiff = 360 - headingDiff;
        }
        
        console.log(`📡 GPS方位のみ有効: ${coords.heading.toFixed(1)}° (前回: ${currentHeading.toFixed(1)}°, 差分: ${headingDiff.toFixed(1)}°)`);
        
        if (headingDiff >= MIN_HEADING_CHANGE || currentHeading === 0) {
          calculatedHeading = coords.heading;
          headingSource = 'gps_changed';
          console.log(`📡 GPS方位更新: ${calculatedHeading.toFixed(1)}° (変化: ${headingDiff.toFixed(1)}°)`);
        } else {
          calculatedHeading = currentHeading;
          headingSource = 'maintained_small_change';
          console.log(`⏸️ 方位維持（変化小）: ${calculatedHeading.toFixed(1)}° (変化: ${headingDiff.toFixed(1)}°)`);
        }
      } 
      else {
        calculatedHeading = headingRef.current;
        headingSource = 'maintained';
        console.log(`⏸️ 方位維持: ${calculatedHeading.toFixed(1)}° (移動不足、GPS方位なし)`);
      }

      // 🔧 バッファ管理
      speedBufferRef.current.push(calculatedSpeed);
      if (speedBufferRef.current.length > SPEED_BUFFER_SIZE) {
        speedBufferRef.current.shift();
      }

      if (headingSource !== 'maintained' && headingSource !== 'maintained_small_change') {
        headingBufferRef.current.push(calculatedHeading);
        if (headingBufferRef.current.length > HEADING_BUFFER_SIZE) {
          headingBufferRef.current.shift();
        }
        console.log(`📝 方位バッファ更新: [${headingBufferRef.current.map(h => h.toFixed(0)).join(', ')}]`);
      }

      // 🔧 平滑化（バッファのみを渡す）
      const smoothedSpeed: number = smoothSpeed(speedBufferRef.current);
      const smoothedHeading: number = headingBufferRef.current.length > 1
        ? smoothHeading(headingBufferRef.current) 
        : calculatedHeading;

      console.log(`🎯 平滑化結果 - 速度: ${smoothedSpeed.toFixed(1)}km/h, 方位: ${smoothedHeading.toFixed(1)}° (ソース: ${headingSource})`);

      speedRef.current = smoothedSpeed;
      headingRef.current = smoothedHeading;
      setSpeed(smoothedSpeed);
      setHeading(smoothedHeading);

      if (distance > GPS_CONFIG.MIN_DISTANCE_METERS / 1000) {
        setTotalDistance(prev => {
          const newTotal = prev + distance;
          console.log(`🛣️ 総走行距離: ${newTotal.toFixed(3)}km`);
          logGPSEvent({ type: 'DISTANCE_ADD',
            lat: newPosition.coords.latitude, lng: newPosition.coords.longitude,
            accuracy: currentAccuracy, speed: smoothedSpeed,
            distanceDeltaKm: distance, totalDistanceKm: newTotal,
            operationId: options.operationId
          });
          return newTotal;
        });
        
        speedHistoryRef.current.push(smoothedSpeed);
        if (speedHistoryRef.current.length > 50) {
          speedHistoryRef.current.shift();
        }
      }

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
      console.log('🎬 初回GPS位置設定');
      
      if (coords.heading !== null && coords.heading !== undefined && coords.heading >= 0) {
        calculatedHeading = coords.heading;
        setHeading(coords.heading);
        headingRef.current = coords.heading;
        headingBufferRef.current = [coords.heading];
        console.log(`📡 初回GPS方位: ${coords.heading.toFixed(1)}°`);
      } else {
        setHeading(0);
        headingRef.current = 0;
        headingBufferRef.current = [0];
      }
      
      setSpeed(0);
      speedRef.current = 0;
      speedBufferRef.current = [0];
      speedHistoryRef.current = [0];
    }

    const quality = evaluateQuality(currentAccuracy);
    setQualityStatus(quality);

    // BUG-008修正: 精度閾値チェック（500m超で警告、4000m超でエラー相当）
    if (currentAccuracy > 4000) {
      console.error(`❌ GPS精度異常: accuracy=${currentAccuracy.toFixed(0)}m — 位置情報が信頼できません`);
      toast.error(
        `GPS精度が非常に低い状態です（誤差 ${Math.round(currentAccuracy)}m）\nGPS信号を確認してください`,
        { duration: 6000 }
      );
    } else if (currentAccuracy > 500) {
      console.warn(`⚠️ GPS精度低下: accuracy=${currentAccuracy.toFixed(0)}m`);
      toast(`GPS精度が低い状態です（誤差 ${Math.round(currentAccuracy)}m）`, { icon: '⚠️', duration: 4000 });
    }

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

    // ✅ Session12: 最新位置・metadataをrefに保存（setIntervalから参照）
    latestPositionRef.current = position;
    latestMetadataRef.current = metadata;
    // GPS Logはローカル配列に追加（表示用）
    setGpsLogs(prev => {
      const next = [...prev, gpsLog];
      return next.slice(-500); // 最大500件保持
    });
    // ※ 実際の送信は startGPSInterval の setInterval が担当

    previousPositionRef.current = currentPositionRef.current;
    currentPositionRef.current = newPosition;
    setPreviousPosition(previousPositionRef.current);
    setCurrentPosition(newPosition);
    setLastUpdateTime(new Date());
    updateStatistics();

    options.onPositionUpdate?.(newPosition, metadata);
    options.onAccuracyChange?.(currentAccuracy);
    options.onSpeedChange?.(calculatedSpeed);
    options.onHeadingChange?.(calculatedHeading);
  };

  const handleError = (error: GeolocationPositionError) => {
    // BUG-008修正: GeolocationPositionError は JSON.stringify すると {} になるため
    // code / message を明示的に展開してログ出力する
    const errorDetail = {
      code: error.code,
      message: error.message,
      codeLabel:
        error.code === error.PERMISSION_DENIED    ? 'PERMISSION_DENIED'    :
        error.code === error.POSITION_UNAVAILABLE ? 'POSITION_UNAVAILABLE' :
        error.code === error.TIMEOUT              ? 'TIMEOUT'              :
        `UNKNOWN(${error.code})`
    };
    console.error('❌ GPS Error:', errorDetail);

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
    options.onError?.(error);
  };

  // ✅ Session12: setInterval方式でGPS送信を確実制御
  const startGPSInterval = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
    }
    const intervalMs = GPS_CONFIG.UPDATE_INTERVAL; // getterなので毎回最新値
    console.log(`⏱️ [GPS-INTERVAL] GPS送信インターバル開始: ${intervalMs}ms (${intervalMs/1000}秒)`);
    gpsIntervalRef.current = setInterval(() => {
      const pos = latestPositionRef.current;
      const meta = latestMetadataRef.current;
      if (pos && meta) {
        sendGPSData(pos, meta);
      }
    }, intervalMs);
  }, []);

  const stopGPSInterval = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
      console.log('⏹️ [GPS-INTERVAL] GPS送信インターバル停止');
    }
  }, []);

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
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ 初回GPS位置取得成功');
          handlePositionUpdate(position);
        },
        handleError,
        gpsOptions
      );
      const watchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handleError,
        gpsOptions
      );
      watchIdRef.current = watchId;
      startTimeRef.current = Date.now();
    // ✅ Session12: setInterval GPS送信開始
    startGPSInterval();
      lastGPSUpdateRef.current = Date.now();
      setIsTracking(true);
      isTrackingRef.current = true; // BUG-020: ref経由でvisibilitychangeから参照
      setIsPaused(false);
      setError(null);
      toast.success('GPS追跡を開始しました');
      console.log('🛰️ GPS追跡開始 - Watch ID:', watchId);
      // BUG-020: Screen Wake Lock 取得（iOS画面OFFでJS停止を防ぐ）
      if ('wakeLock' in navigator) {
        try {
          const wl = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current = wl;
          console.log('🔒 Screen Wake Lock 取得成功');
          wl.addEventListener('release', () => {
            console.warn('⚠️ Screen Wake Lock が解放されました');
            wakeLockRef.current = null;
          });
        } catch (wlErr) {
          console.warn('⚠️ Screen Wake Lock 取得失敗（非対応デバイス）:', wlErr);
        }
      }
    } catch (err) {
      console.error('❌ GPS追跡開始エラー:', err);
      handleError(err as GeolocationPositionError);
      throw err;
    }
  }, [isTracking, options]);

  const stopTracking = useCallback(() => {
    // ✅ BUG-040修正: setIntervalも確実に停止する
    stopGPSInterval();
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    isTrackingRef.current = false; // BUG-020
    setIsPaused(false);
    startTimeRef.current = null;
    // BUG-020: Screen Wake Lock 解放
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch((e: any) => console.warn('Wake Lock 解放エラー:', e));
      wakeLockRef.current = null;
    }
    console.log('🛑 GPS追跡停止');
    toast.success('GPS追跡を停止しました');
  }, []);

  const pauseTracking = useCallback(() => {
    setIsPaused(true);
    console.log('⏸️ GPS追跡一時停止');
    toast('GPS追跡を一時停止しました');
  }, []);

  const resumeTracking = useCallback(() => {
    setIsPaused(false);
    console.log('▶️ GPS追跡再開');
    toast('GPS追跡を再開しました');
  }, []);

  const clearPath = useCallback(() => {
    setPathCoordinates([]);
    setGpsLogs([]);
    setTotalDistance(0);
    setAverageSpeed(0);
    setMaxSpeed(0);
    speedHistoryRef.current = [];
    console.log('🗑️ パスデータクリア');
  }, []);

  const exportGPSData = useCallback((): GPSLogData[] => {
    return gpsLogs;
  }, [gpsLogs]);

  const updateOptions = useCallback((newOptions: Partial<UseGPSOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  // BUG-020: Page Visibility API — バックグラウンド復帰時にGPS追跡を再開
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isTrackingRef.current) {
        console.log('📱 [BUG-020] アプリ復帰検知 — GPS追跡状態を確認中...');

        // watchPosition が生きているか確認（iOSではバックグラウンドで自動解除される）
        // 既存 watchId をクリアして再登録することで確実に再開する
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
          console.log('🔄 [BUG-020] 旧 watchPosition をクリア');
        }

        const gpsOptions: PositionOptions = {
          enableHighAccuracy: true,
          timeout: GPS_CONFIG.TIMEOUT,
          maximumAge: GPS_CONFIG.MAXIMUM_AGE
        };

        const newWatchId = navigator.geolocation.watchPosition(
          handlePositionUpdate,
          handleError,
          gpsOptions
        );
        watchIdRef.current = newWatchId;
        console.log('✅ [BUG-020] GPS追跡を再開しました - 新 Watch ID:', newWatchId);
        toast('GPS追跡を再開しました（バックグラウンドからの復帰）', { icon: '📍', duration: 3000 });

        // Screen Wake Lock も再取得（バックグラウンド移行で解放されているため）
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            console.log('🔒 [BUG-020] Screen Wake Lock 再取得成功');
          } catch (wlErr) {
            console.warn('⚠️ [BUG-020] Screen Wake Lock 再取得失敗:', wlErr);
          }
        }
      } else if (document.visibilityState === 'hidden') {
        console.log('📱 [BUG-020] バックグラウンド移行検知 — GPS追跡中:', isTrackingRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // マウント時1回のみ登録（isTrackingRef で最新状態を参照）

  useEffect(() => {
    if (options.autoStart) {
      startTracking();
    }
    return () => {
      stopGPSInterval(); // ✅ Session12
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      // BUG-020: アンマウント時も Wake Lock 解放
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [options.autoStart]);

  return {
    currentPosition,
    previousPosition,
    isTracking,
    error,
    accuracy,
    heading,
    speed,
    altitude,
    totalDistance,
    averageSpeed,
    maxSpeed,
    trackingDuration,
    gpsLogs,
    pathCoordinates,
    qualityStatus,
    lastUpdateTime,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    clearPath,
    exportGPSData,
    updateOptions
  };
};