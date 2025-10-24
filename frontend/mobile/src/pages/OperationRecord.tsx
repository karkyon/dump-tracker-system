// frontend/mobile/src/pages/OperationRecord.tsx
// 🚛 運行記録画面 - 完全版
// ✅ ヘッドアップ表示（地図回転）
// ✅ 走行軌跡（赤いライン）
// ✅ 三角矢印マーカー（進行方向）
// ✅ 全ボタン機能実装

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useGPS } from '../hooks/useGPS';
import apiService from '../services/api';
import GoogleMapWrapper, {
  updateMarkerIcon,
  updateMarkerPosition,
  panMapToPosition,
  setMapHeading,
  addPathPoint,
  clearPath
} from '../components/GoogleMapWrapper';

interface OperationState {
  id: string | null;
  status: 'idle' | 'running';
  startTime: Date | null;
  loadingLocation: string;
  unloadingLocation: string;
  cargoInfo: string;
}

const MAP_UPDATE_INTERVAL = 3000;
const MARKER_UPDATE_INTERVAL = 1000; // マーカー矢印は1秒ごとに更新

const OperationRecord: React.FC = () => {
  const navigate = useNavigate();
  
  const [isMapReady, setIsMapReady] = useState(false);
  const lastMapUpdateRef = useRef<number>(0);
  const lastMarkerUpdateRef = useRef<number>(0);
  
  const [operation, setOperation] = useState<OperationState>({
    id: null,
    status: 'running',
    startTime: new Date(),
    loadingLocation: '○○建設資材置場',
    unloadingLocation: '△△工事現場',
    cargoInfo: '砂利 12t'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  const {
    currentPosition,
    isTracking,
    startTracking,
    stopTracking,
    heading,
    speed: gpsSpeed,
    totalDistance,
    averageSpeed: gpsAverageSpeed
  } = useGPS();

  // GPS追跡自動開始
  useEffect(() => {
    startTracking();
  }, []);

  const handleMapReady = () => {
    setIsMapReady(true);
    console.log('🗺️ マップ準備完了');
  };

  // 時刻更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 経過時間計算
  useEffect(() => {
    if (!operation.startTime) {
      setElapsedTime({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const timer = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - operation.startTime!.getTime()) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setElapsedTime({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [operation.startTime]);

  // 🎯 GPS位置更新 - ヘッドアップ・軌跡・三角矢印すべて対応
  useEffect(() => {
    if (!currentPosition || !isMapReady) return;

    const now = Date.now();
    const lat = currentPosition.coords.latitude;
    const lng = currentPosition.coords.longitude;
    const currentHeading = heading !== null ? heading : 0;
    const currentSpeed = gpsSpeed || 0;

    // マーカー位置を即座に更新
    updateMarkerPosition(lat, lng);

    // 🔺 マーカーの三角矢印を回転（進行方向を示す）
    if (now - lastMarkerUpdateRef.current >= MARKER_UPDATE_INTERVAL) {
      updateMarkerIcon(totalDistance, currentSpeed, currentHeading);
      lastMarkerUpdateRef.current = now;
      console.log(`🔺 マーカー更新: ${currentHeading.toFixed(1)}°, ${currentSpeed.toFixed(1)}km/h`);
    }

    // 地図の中心移動
    if (now - lastMapUpdateRef.current >= MAP_UPDATE_INTERVAL) {
      panMapToPosition(lat, lng);
      
      // 🧭 ヘッドアップ表示: 地図を回転（進行方向が常に上）
      if (currentSpeed > 1 && currentHeading !== null && !isNaN(currentHeading)) {
        setMapHeading(currentHeading);
        console.log(`🧭 ヘッドアップ: ${currentHeading.toFixed(1)}°`);
      }
      
      lastMapUpdateRef.current = now;
    }

    // 🛤️ 走行軌跡に座標を追加
    if (operation.status === 'running') {
      addPathPoint(lat, lng);
    }
  }, [currentPosition, isMapReady, heading, gpsSpeed, totalDistance, operation.status]);

  // 積込場所到着
  const handleLoadingArrival = async () => {
    if (!currentPosition) return;
    try {
      setIsSubmitting(true);
      await apiService.recordAction({
        operationId: operation.id || 'temp-id',
        actionType: 'LOADING_ARRIVAL',
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        location: operation.loadingLocation
      });
      toast.success('積込場所到着を記録しました');
    } catch (error) {
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 積降場所到着
  const handleUnloadingArrival = async () => {
    if (!currentPosition) return;
    try {
      setIsSubmitting(true);
      await apiService.recordAction({
        operationId: operation.id || 'temp-id',
        actionType: 'UNLOADING_ARRIVAL',
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        location: operation.unloadingLocation
      });
      toast.success('積降場所到着を記録しました');
    } catch (error) {
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 休憩・荷待ち
  const handleBreak = async () => {
    if (!currentPosition) return;
    try {
      setIsSubmitting(true);
      await apiService.recordAction({
        operationId: operation.id || 'temp-id',
        actionType: 'BREAK',
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        location: '休憩場所'
      });
      toast.success('休憩・荷待ちを記録しました');
    } catch (error) {
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 給油
  const handleRefuel = async () => {
    if (!currentPosition) return;
    try {
      setIsSubmitting(true);
      await apiService.recordAction({
        operationId: operation.id || 'temp-id',
        actionType: 'REFUEL',
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        location: '給油所'
      });
      toast.success('給油を記録しました');
    } catch (error) {
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '428px',
      height: '100vh',
      margin: '0 auto',
      background: 'white',
      fontFamily: "'Hiragino Sans', 'Yu Gothic UI', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* ヘッダー */}
      <div style={{
        background: 'linear-gradient(135deg, #2c5aa0, #1e3d6f)',
        color: 'white',
        padding: '15px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{
          background: '#4CAF50',
          color: 'white',
          padding: '10px 24px',
          borderRadius: '25px',
          fontSize: '15px',
          fontWeight: 'bold',
          animation: 'pulse 2s infinite'
        }}>
          運行中
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {formatTime(currentTime)}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.9 }}>
            {formatDate(currentTime)}
          </div>
        </div>
      </div>

      {/* 地図エリア */}
      <div style={{
        height: '280px',
        position: 'relative',
        flexShrink: 0
      }}>
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

        {/* 方位表示 */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 1000
        }}>
          方位: {heading !== null ? Math.round(heading) : 0}° (北)
        </div>
      </div>

      {/* コンテンツエリア */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: '#f5f5f5'
      }}>
        {/* 場所情報 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px'
        }}>
          <div>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginBottom: '4px',
              borderLeft: '3px solid #2196F3',
              paddingLeft: '8px'
            }}>
              積込場所
            </div>
            <div style={{
              background: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid #e0e0e0'
            }}>
              {operation.loadingLocation}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginBottom: '4px',
              borderLeft: '3px solid #2196F3',
              paddingLeft: '8px'
            }}>
              積降場所
            </div>
            <div style={{
              background: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid #e0e0e0'
            }}>
              {operation.unloadingLocation}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginBottom: '4px',
              borderLeft: '3px solid #666',
              paddingLeft: '8px'
            }}>
              積荷
            </div>
            <div style={{
              background: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid #e0e0e0'
            }}>
              {operation.cargoInfo}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginBottom: '4px',
              borderLeft: '3px solid #666',
              paddingLeft: '8px'
            }}>
              経過時間
            </div>
            <div style={{
              background: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid #e0e0e0'
            }}>
              {elapsedTime.hours}時間 {elapsedTime.minutes}分
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginBottom: '4px',
              borderLeft: '3px solid #FF5722',
              paddingLeft: '8px'
            }}>
              走行距離
            </div>
            <div style={{
              background: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid #e0e0e0'
            }}>
              {totalDistance.toFixed(1)} km
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '11px',
              color: '#666',
              marginBottom: '4px',
              borderLeft: '3px solid #FF5722',
              paddingLeft: '8px'
            }}>
              平均速度
            </div>
            <div style={{
              background: 'white',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              border: '1px solid #e0e0e0'
            }}>
              {gpsAverageSpeed.toFixed(1)} km/h
            </div>
          </div>
        </div>

        {/* ボタングループ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <button
            onClick={handleLoadingArrival}
            disabled={isSubmitting}
            style={{
              background: 'linear-gradient(135deg, #4CAF50, #45a049)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '70px'
            }}
          >
            <div>積込場所</div>
            <div>到着</div>
          </button>

          <button
            onClick={handleUnloadingArrival}
            disabled={isSubmitting}
            style={{
              background: '#e0e0e0',
              color: '#999',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'not-allowed',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '70px'
            }}
          >
            <div>積降場所</div>
            <div>到着</div>
          </button>

          <button
            onClick={handleBreak}
            disabled={isSubmitting}
            style={{
              background: 'linear-gradient(135deg, #FF9800, #F57C00)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              minHeight: '70px'
            }}
          >
            休憩・荷待ち
          </button>

          <button
            onClick={handleRefuel}
            disabled={isSubmitting}
            style={{
              background: 'linear-gradient(135deg, #FFC107, #FFA000)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              minHeight: '70px'
            }}
          >
            給油
          </button>
        </div>
      </div>

      {/* フッター */}
      <div style={{
        background: '#f8f9fa',
        borderTop: '1px solid #ddd',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#666'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isTracking ? '#4CAF50' : '#999'
          }}></div>
          GPS追跡中
        </div>

        <div style={{
          fontSize: '10px',
          color: '#999',
          textAlign: 'right',
          lineHeight: '1.4'
        }}>
          {currentPosition && (
            <>
              緯度: {currentPosition.coords.latitude.toFixed(6)}<br />
              経度: {currentPosition.coords.longitude.toFixed(6)}<br />
              精度: {Math.round(currentPosition.coords.accuracy)}m<br />
              速度: {(gpsSpeed || 0).toFixed(1)}km/h<br />
              GPS方位: {heading !== null ? heading.toFixed(1) : '--'}°
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default OperationRecord;