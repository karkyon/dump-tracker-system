// frontend/mobile/src/pages/OperationRecord.tsx
// 🚛 運行記録画面 - 完全版
// ✅ ヘッドアップ表示（地図回転）
// ✅ 走行軌跡（赤いライン）
// ✅ 三角矢印マーカー（進行方向）
// ✅ HeadingIndicator実装
// ✅ ボタン状態遷移実装

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useGPS } from '../hooks/useGPS';
import apiService from '../services/api';
import GoogleMapWrapper, {
  updateMarkerIcon,
  updateMarkerPosition,
  panMapToPosition,
  setMapHeading,
  addPathPoint
} from '../components/GoogleMapWrapper';
import HeadingIndicator from '../components/HeadingIndicator';

// 運行状態の型定義
type OperationPhase = 'TO_LOADING' | 'AT_LOADING' | 'TO_UNLOADING' | 'AT_UNLOADING' | 'BREAK' | 'REFUEL';

interface OperationState {
  id: string | null;
  status: 'idle' | 'running';
  phase: OperationPhase;
  startTime: Date | null;
  loadingLocation: string;
  unloadingLocation: string;
  cargoInfo: string;
}

const MAP_UPDATE_INTERVAL = 3000;
const MARKER_UPDATE_INTERVAL = 1000;

const OperationRecord: React.FC = () => {
  
  const [isMapReady, setIsMapReady] = useState(false);
  const lastMapUpdateRef = useRef<number>(0);
  const lastMarkerUpdateRef = useRef<number>(0);
  
  // 運行状態（フェーズ管理を追加）
  const [operation, setOperation] = useState<OperationState>({
    id: null,
    status: 'running',
    phase: 'TO_LOADING', // 初期状態: 積込場所へ向かう
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

    console.log('🗺️ 地図更新:', {
      heading: currentHeading,
      speed: currentSpeed,
      distance: totalDistance,
      position: { lat, lng }
    });

    // マーカー位置を即座に更新
    updateMarkerPosition(lat, lng);

    // 🔺 マーカーの三角矢印を回転（進行方向を示す）
    if (now - lastMarkerUpdateRef.current >= MARKER_UPDATE_INTERVAL) {
      updateMarkerIcon(totalDistance, currentSpeed, currentHeading);
      lastMarkerUpdateRef.current = now;
    }

    // 地図の中心移動
    if (now - lastMapUpdateRef.current >= MAP_UPDATE_INTERVAL) {
      panMapToPosition(lat, lng);
      
      // 🧭 ヘッドアップ表示: 地図を回転（進行方向が常に上）
      if (currentSpeed > 1 && currentHeading !== null && !isNaN(currentHeading)) {
        setMapHeading(currentHeading);
      }
      
      lastMapUpdateRef.current = now;
    }

    // 🛤️ 走行軌跡に座標を追加
    if (operation.status === 'running') {
      addPathPoint(lat, lng);
    }
  }, [currentPosition, isMapReady, heading, gpsSpeed, totalDistance, operation.status]);

  // 🔄 積込場所到着
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
      
      // 状態遷移: TO_LOADING → AT_LOADING
      setOperation(prev => ({ ...prev, phase: 'AT_LOADING' }));
      toast.success('積込場所到着を記録しました');
      
      console.log('🚚 積込場所到着 → 次は積降場所へ');
    } catch (error) {
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔄 積降場所到着
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
      
      // 状態遷移: AT_LOADING → TO_UNLOADING → AT_UNLOADING
      setOperation(prev => ({ ...prev, phase: 'TO_LOADING' })); // 次のサイクルへ
      toast.success('積降場所到着を記録しました');
      
      console.log('📦 積降場所到着 → 次は積込場所へ');
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
      
      setOperation(prev => ({ ...prev, phase: 'BREAK' }));
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
      
      setOperation(prev => ({ ...prev, phase: 'REFUEL' }));
      toast.success('給油を記録しました');
    } catch (error) {
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🎨 ボタンスタイル決定（フェーズに応じて有効/無効を切り替え）
  const getButtonStyle = (buttonType: 'LOADING' | 'UNLOADING' | 'BREAK' | 'REFUEL') => {
    const baseStyle = {
      border: 'none',
      borderRadius: '8px',
      padding: '16px',
      fontSize: '14px',
      fontWeight: 'bold' as const,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: '70px',
      cursor: 'pointer' as const,
      transition: 'all 0.3s ease'
    };

    // 積込場所到着ボタン: TO_LOADING時のみ有効
    if (buttonType === 'LOADING') {
      if (operation.phase === 'TO_LOADING') {
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #4CAF50, #45a049)',
          color: 'white'
        };
      } else {
        return {
          ...baseStyle,
          background: '#e0e0e0',
          color: '#999',
          cursor: 'not-allowed' as const
        };
      }
    }

    // 積降場所到着ボタン: AT_LOADING時のみ有効
    if (buttonType === 'UNLOADING') {
      if (operation.phase === 'AT_LOADING') {
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #4CAF50, #45a049)',
          color: 'white'
        };
      } else {
        return {
          ...baseStyle,
          background: '#e0e0e0',
          color: '#999',
          cursor: 'not-allowed' as const
        };
      }
    }

    // 休憩・給油ボタン: 常に有効
    if (buttonType === 'BREAK') {
      return {
        ...baseStyle,
        background: 'linear-gradient(135deg, #FF9800, #F57C00)',
        color: 'white'
      };
    }

    if (buttonType === 'REFUEL') {
      return {
        ...baseStyle,
        background: 'linear-gradient(135deg, #FFC107, #FFA000)',
        color: 'white'
      };
    }

    return baseStyle;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // フェーズに応じたステータス表示
  const getStatusText = (): string => {
    switch (operation.phase) {
      case 'TO_LOADING': return '積込場所へ移動中';
      case 'AT_LOADING': return '積込場所到着';
      case 'TO_UNLOADING': return '積降場所へ移動中';
      case 'AT_UNLOADING': return '積降場所到着';
      case 'BREAK': return '休憩中';
      case 'REFUEL': return '給油中';
      default: return '運行中';
    }
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
          {getStatusText()}
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

        {/* 🧭 方位表示 - HeadingIndicatorコンポーネント使用 */}
        {heading !== null && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000
          }}>
            <HeadingIndicator heading={heading} />
          </div>
        )}
      </div>

      {/* コンテンツエリア */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        background: '#f5f5f5'
      }}>
        {/* 運行情報グリッド */}
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
          {/* 積込場所到着ボタン */}
          <button
            onClick={handleLoadingArrival}
            disabled={isSubmitting || operation.phase !== 'TO_LOADING'}
            style={getButtonStyle('LOADING')}
          >
            <div>積込場所</div>
            <div>到着</div>
          </button>

          {/* 積降場所到着ボタン */}
          <button
            onClick={handleUnloadingArrival}
            disabled={isSubmitting || operation.phase !== 'AT_LOADING'}
            style={getButtonStyle('UNLOADING')}
          >
            <div>積降場所</div>
            <div>到着</div>
          </button>

          {/* 休憩・荷待ちボタン */}
          <button
            onClick={handleBreak}
            disabled={isSubmitting}
            style={getButtonStyle('BREAK')}
          >
            休憩・荷待ち
          </button>

          {/* 給油ボタン */}
          <button
            onClick={handleRefuel}
            disabled={isSubmitting}
            style={getButtonStyle('REFUEL')}
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