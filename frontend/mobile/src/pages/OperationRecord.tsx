// frontend/mobile/src/pages/OperationRecord.tsx
// 🚛 運行記録画面 - UI/UXデザイン改善版
// 最終更新: 2025-10-24
// 
// 🎨 デザイン改善項目:
//  ✅ グラデーションヘッダー(青系)
//  ✅ 大きな地図表示エリア
//  ✅ 経過時間・距離・速度の2列グリッド表示
//  ✅ グラデーションボタン、影付き
//  ✅ アイコン付きボタン
//  ✅ 改善されたステータスインジケーター
//  ✅ フォント・スタイルの最適化
//  ✅ カスタムSVGマーカー(距離・速度表示)
//  ✅ ヘッドアップ表示、GPS軌跡

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
  Loader2,
  Home
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
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
import HeadingIndicator from '../components/HeadingIndicator';

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

// GPS更新のスロットリング用定数
const MAP_UPDATE_INTERVAL = 3000;    // 地図更新: 3秒に1回
const MARKER_UPDATE_INTERVAL = 5000; // マーカー更新: 5秒に1回

const OperationRecord: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  // 🗺️ Google Map関連のref
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  // ⏱️ 更新タイミング制御用
  const lastMapUpdateRef = useRef<number>(0);
  const lastMarkerUpdateRef = useRef<number>(0);
  
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
  
  // API送信中フラグ(二重送信防止)
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 時刻表示
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // 初期化済みフラグ
  const initializedRef = useRef(false);

  // GPS関連
  const {
    position: currentPosition,
    isTracking,
    error: gpsError,
    startTracking,
    stopTracking,
    heading,
    speed: gpsSpeed,
    totalDistance,
    averageSpeed: gpsAverageSpeed
  } = useGPS();

  // 🗺️ マップ初期化完了時のコールバック
  const handleMapReady = (map: any, marker: any, polyline: any) => {
    console.log('🗺️ [OperationRecord] マップ初期化完了');
    mapInstanceRef.current = map;
    markerRef.current = marker;
    polylineRef.current = polyline;
    setIsMapReady(true);
  };

  // ⏰ 現在時刻の更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // ⏱️ 経過時間の計算
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

  // 📍 GPS位置更新時の処理
  useEffect(() => {
    if (!currentPosition || !isMapReady) return;

    const now = Date.now();
    const lat = currentPosition.coords.latitude;
    const lng = currentPosition.coords.longitude;

    // マーカー位置更新(即座に)
    updateMarkerPosition(lat, lng);

    // 地図の中心移動(スロットリング)
    if (now - lastMapUpdateRef.current >= MAP_UPDATE_INTERVAL) {
      panMapToPosition(lat, lng);
      lastMapUpdateRef.current = now;
    }

    // マーカーアイコン更新(スロットリング)
    if (now - lastMarkerUpdateRef.current >= MARKER_UPDATE_INTERVAL) {
      updateMarkerIcon(totalDistance, gpsSpeed || 0);
      lastMarkerUpdateRef.current = now;
    }

    // ヘッドアップ表示(方位が取得できている場合)
    if (heading !== null && !isNaN(heading)) {
      setMapHeading(heading);
    }

    // 走行軌跡の追加(運行中のみ)
    if (operation.status === 'running') {
      addPathPoint(lat, lng);
    }
  }, [currentPosition, isMapReady, heading, totalDistance, gpsSpeed, operation.status]);

  // 🚀 運行開始
  const handleStartOperation = async () => {
    if (!currentPosition) {
      toast.error('GPS位置情報を取得中です');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await apiService.startOperation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        accuracy: currentPosition.coords.accuracy
      });

      setOperation({
        ...operation,
        id: response.operationId,
        status: 'running',
        startTime: new Date()
      });

      startTracking();
      clearPath(); // 走行軌跡をクリア
      
      toast.success('運行を開始しました');
      console.log('✅ 運行開始:', response);

    } catch (error) {
      console.error('❌ 運行開始エラー:', error);
      toast.error('運行開始に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 📦 積込場所到着
  const handleLoadingArrival = async () => {
    if (!currentPosition || !operation.id) return;

    try {
      setIsSubmitting(true);

      await apiService.recordLoadingArrival(operation.id, {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        timestamp: new Date().toISOString()
      });

      setOperation({
        ...operation,
        loadingArrived: true
      });

      toast.success('積込場所到着を記録しました');

    } catch (error) {
      console.error('❌ 積込場所到着記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🏠 積降場所到着
  const handleUnloadingArrival = async () => {
    if (!currentPosition || !operation.id) return;

    try {
      setIsSubmitting(true);

      await apiService.recordUnloadingArrival(operation.id, {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        timestamp: new Date().toISOString()
      });

      setOperation({
        ...operation,
        unloadingArrived: true
      });

      toast.success('積降場所到着を記録しました');

    } catch (error) {
      console.error('❌ 積降場所到着記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ☕ 休憩・荷待ち
  const handleBreak = async () => {
    if (!currentPosition || !operation.id) return;

    try {
      setIsSubmitting(true);

      await apiService.recordBreak(operation.id, {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        timestamp: new Date().toISOString()
      });

      toast.success('休憩・荷待ちを記録しました');

    } catch (error) {
      console.error('❌ 休憩記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ⛽ 給油
  const handleRefuel = async () => {
    if (!currentPosition || !operation.id) return;

    try {
      setIsSubmitting(true);

      await apiService.recordRefuel(operation.id, {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        timestamp: new Date().toISOString()
      });

      toast.success('給油を記録しました');

    } catch (error) {
      console.error('❌ 給油記録エラー:', error);
      toast.error('記録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🛑 運行終了
  const handleEndOperation = async () => {
    if (!operation.id) return;

    try {
      setIsSubmitting(true);

      await apiService.endOperation(operation.id, {
        latitude: currentPosition?.coords.latitude || 0,
        longitude: currentPosition?.coords.longitude || 0,
        timestamp: new Date().toISOString()
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
      
      // ホーム画面に戻る
      navigate('/');

    } catch (error) {
      console.error('❌ 運行終了エラー:', error);
      toast.error('運行終了に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 📅 日付のフォーマット
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 🕐 時刻のフォーマット
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50" style={{ fontFamily: "'Hiragino Sans', 'Yu Gothic UI', sans-serif" }}>
      {/* 🎨 グラデーションヘッダー */}
      <div 
        className="flex items-center justify-center gap-4 px-5 py-5 text-white relative"
        style={{
          background: 'linear-gradient(135deg, #2c5aa0, #1e3d6f)',
          paddingTop: '20px',
          paddingBottom: '10px'
        }}
      >
        {/* ステータスインジケーター */}
        <div 
          className="px-5 py-3 rounded-full font-bold text-base"
          style={{
            background: operation.status === 'running' ? '#4CAF50' : '#9E9E9E',
            animation: operation.status === 'running' ? 'pulse 2s infinite' : 'none',
            minWidth: '120px',
            textAlign: 'center'
          }}
        >
          {operation.status === 'running' ? '運行中' : '待機中'}
        </div>

        {/* 時刻・日付表示 */}
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold mb-0.5">
            {formatTime(currentTime)}
          </div>
          <div className="text-xs opacity-80">
            {formatDate(currentTime)}
          </div>
        </div>

        {/* 方位: 表示 */}
        <div 
          className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          方位: {heading !== null ? Math.round(heading) : '--'}°
        </div>
      </div>

      {/* 🗺️ 地図エリア */}
      <div className="relative flex-shrink-0" style={{ height: '240px' }}>
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
        
        {/* 🧭 方位インジケーター */}
        {heading !== null && (
          <HeadingIndicator 
            heading={heading} 
            className="absolute top-4 right-4"
          />
        )}
        
        {/* GPS状態表示 */}
        <div 
          className="absolute top-16 right-4 bg-white rounded-lg shadow-lg px-3 py-2 text-xs"
          style={{ zIndex: 100 }}
        >
          <div className={`flex items-center ${isTracking ? 'text-green-600' : 'text-gray-400'}`}>
            <div 
              className={`w-2 h-2 rounded-full mr-2 ${isTracking ? 'bg-green-500' : 'bg-gray-400'}`}
              style={{ animation: isTracking ? 'pulse 2s infinite' : 'none' }}
            />
            {isTracking ? 'GPS追跡中' : 'GPS停止中'}
          </div>
        </div>
      </div>
      
      {/* コントロールパネル */}
      <div 
        className="flex-1 bg-white px-4 py-4 overflow-y-auto"
        style={{ 
          maxHeight: 'calc(100vh - 240px - 80px)',
          paddingBottom: '20px'
        }}
      >
        {/* 📊 運行情報カード(2列グリッド) */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* 経過時間 */}
          <div 
            className="p-3 rounded-lg"
            style={{
              background: '#f8f9fa',
              borderLeft: '4px solid #2c5aa0'
            }}
          >
            <div className="text-xs text-gray-600 mb-1">経過時間</div>
            <div className="text-sm font-bold text-gray-800">
              {operation.startTime ? 
                `${String(elapsedTime.hours).padStart(2, '0')}:${String(elapsedTime.minutes).padStart(2, '0')}:${String(elapsedTime.seconds).padStart(2, '0')}` 
                : '--:--:--'
              }
            </div>
          </div>

          {/* 走行距離 */}
          <div 
            className="p-3 rounded-lg"
            style={{
              background: '#f8f9fa',
              borderLeft: '4px solid #FF5722'
            }}
          >
            <div className="text-xs text-gray-600 mb-1">走行距離</div>
            <div className="text-sm font-bold text-gray-800">
              {totalDistance.toFixed(1)} km
            </div>
          </div>

          {/* 現在速度 */}
          <div 
            className="p-3 rounded-lg"
            style={{
              background: '#f8f9fa',
              borderLeft: '4px solid #4CAF50'
            }}
          >
            <div className="text-xs text-gray-600 mb-1">現在速度</div>
            <div className="text-sm font-bold text-gray-800">
              {(gpsSpeed || 0).toFixed(0)} km/h
            </div>
          </div>

          {/* 平均速度 */}
          <div 
            className="p-3 rounded-lg"
            style={{
              background: '#f8f9fa',
              borderLeft: '4px solid #2196F3'
            }}
          >
            <div className="text-xs text-gray-600 mb-1">平均速度</div>
            <div className="text-sm font-bold text-gray-800">
              {gpsAverageSpeed.toFixed(0)} km/h
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="space-y-3">
          {operation.status === 'idle' ? (
            // 🚀 運行開始ボタン
            <button
              onClick={handleStartOperation}
              disabled={isSubmitting || !currentPosition}
              className="w-full py-4 px-4 rounded-lg font-bold text-sm flex items-center justify-center transition-all"
              style={{
                background: isSubmitting || !currentPosition 
                  ? '#e0e0e0' 
                  : 'linear-gradient(135deg, #4CAF50, #45a049)',
                color: isSubmitting || !currentPosition ? '#999' : 'white',
                boxShadow: isSubmitting || !currentPosition 
                  ? 'none' 
                  : '0 4px 8px rgba(76, 175, 80, 0.3)',
                cursor: isSubmitting || !currentPosition ? 'not-allowed' : 'pointer',
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting && currentPosition) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(76, 175, 80, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isSubmitting || !currentPosition 
                  ? 'none' 
                  : '0 4px 8px rgba(76, 175, 80, 0.3)';
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  運行開始
                </>
              )}
            </button>
          ) : (
            <>
              {/* 📦 積込・積降ボタン */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleLoadingArrival}
                  disabled={isSubmitting || operation.loadingArrived}
                  className="py-4 px-3 rounded-lg font-bold text-sm flex flex-col items-center justify-center transition-all"
                  style={{
                    background: isSubmitting || operation.loadingArrived
                      ? '#e0e0e0'
                      : 'linear-gradient(135deg, #2196F3, #1976D2)',
                    color: isSubmitting || operation.loadingArrived ? '#999' : 'white',
                    boxShadow: isSubmitting || operation.loadingArrived
                      ? 'none'
                      : '0 4px 8px rgba(33, 150, 243, 0.3)',
                    cursor: isSubmitting || operation.loadingArrived ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MapPin className="w-5 h-5 mb-1" />
                  積込場所到着
                </button>
                
                <button
                  onClick={handleUnloadingArrival}
                  disabled={isSubmitting || !operation.loadingArrived || operation.unloadingArrived}
                  className="py-4 px-3 rounded-lg font-bold text-sm flex flex-col items-center justify-center transition-all"
                  style={{
                    background: isSubmitting || !operation.loadingArrived || operation.unloadingArrived
                      ? '#e0e0e0'
                      : 'linear-gradient(135deg, #2196F3, #1976D2)',
                    color: isSubmitting || !operation.loadingArrived || operation.unloadingArrived ? '#999' : 'white',
                    boxShadow: isSubmitting || !operation.loadingArrived || operation.unloadingArrived
                      ? 'none'
                      : '0 4px 8px rgba(33, 150, 243, 0.3)',
                    cursor: isSubmitting || !operation.loadingArrived || operation.unloadingArrived ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Home className="w-5 h-5 mb-1" />
                  積降場所到着
                </button>
              </div>

              {/* ☕⛽ 休憩・給油ボタン */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleBreak}
                  disabled={isSubmitting}
                  className="py-4 px-3 rounded-lg font-bold text-sm flex flex-col items-center justify-center transition-all"
                  style={{
                    background: isSubmitting
                      ? '#e0e0e0'
                      : 'linear-gradient(135deg, #FF9800, #F57C00)',
                    color: isSubmitting ? '#999' : 'white',
                    boxShadow: isSubmitting
                      ? 'none'
                      : '0 4px 8px rgba(255, 152, 0, 0.3)',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Coffee className="w-5 h-5 mb-1" />
                  休憩・荷待ち
                </button>
                
                <button
                  onClick={handleRefuel}
                  disabled={isSubmitting}
                  className="py-4 px-3 rounded-lg font-bold text-sm flex flex-col items-center justify-center transition-all"
                  style={{
                    background: isSubmitting
                      ? '#e0e0e0'
                      : 'linear-gradient(135deg, #FFC107, #FFA000)',
                    color: isSubmitting ? '#999' : 'white',
                    boxShadow: isSubmitting
                      ? 'none'
                      : '0 4px 8px rgba(255, 193, 7, 0.3)',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Fuel className="w-5 h-5 mb-1" />
                  給油
                </button>
              </div>

              {/* 🛑 運行終了ボタン */}
              <button
                onClick={handleEndOperation}
                disabled={isSubmitting}
                className="w-full py-4 px-4 rounded-lg font-bold text-sm flex items-center justify-center transition-all"
                style={{
                  background: isSubmitting
                    ? '#e0e0e0'
                    : 'linear-gradient(135deg, #f44336, #d32f2f)',
                  color: isSubmitting ? '#999' : 'white',
                  boxShadow: isSubmitting
                    ? 'none'
                    : '0 4px 8px rgba(244, 67, 54, 0.3)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Square className="w-5 h-5 mr-2" />
                    運行終了
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 📍 フッター */}
      <div 
        className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t"
        style={{ 
          height: '80px',
          flexShrink: 0
        }}
      >
        <div className="flex items-center text-xs text-gray-600">
          <div 
            className={`w-4 h-4 rounded-full mr-2 relative ${isTracking ? 'bg-green-500' : 'bg-gray-400'}`}
          >
            <div className="absolute inset-1 bg-white rounded-full" />
          </div>
          {isTracking ? 'GPS追跡中' : 'GPS停止中'}
        </div>
        
        <div className="text-xs text-gray-500 text-right">
          {currentPosition && (
            <>
              緯度: {currentPosition.coords.latitude.toFixed(6)}<br />
              経度: {currentPosition.coords.longitude.toFixed(6)}<br />
              精度: ±{Math.round(currentPosition.coords.accuracy)}m
            </>
          )}
        </div>
      </div>

      {/* 🎨 アニメーション用のスタイル */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default OperationRecord;