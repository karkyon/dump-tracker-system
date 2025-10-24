// frontend/mobile/src/components/GoogleMapWrapper.tsx
// ✅ 完全修正版 - 地図表示問題を全て解決
// 修正日時: 2025-10-24
// 修正内容:
//  1. position: absolute を削除 → relative に変更
//  2. top/left オフセットを削除
//  3. z-index を適切に設定
//  4. ローディング表示の改善

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google: any;
    initGoogleMap?: () => void;
  }
}

interface GoogleMapWrapperProps {
  onMapReady?: (map: any, marker: any, polyline: any) => void;
  initialPosition?: { lat: number; lng: number };
}

// グローバル状態
let globalMapInstance: any = null;
let globalMarkerInstance: any = null;
let globalPolylineInstance: any = null;
let isGlobalMapInitialized = false;
let initializationInProgress = false;

const GoogleMapWrapper: React.FC<GoogleMapWrapperProps> = ({ 
  onMapReady, 
  initialPosition 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    // ✅ React Strict Mode対応
    mountedRef.current = true;
    console.log('🗺️ [GoogleMapWrapper] useEffect開始');

    // 既に初期化済みの場合は再利用
    if (isGlobalMapInitialized && globalMapInstance) {
      console.log('♻️ [GoogleMapWrapper] 既存のマップインスタンスを再利用');
      
      // 既存のマップを現在のコンテナに再アタッチ
      if (mapContainerRef.current) {
        const mapDiv = globalMapInstance.getDiv();
        if (mapDiv.parentElement !== mapContainerRef.current) {
          console.log('🔄 既存のマップを現在のコンテナに再アタッチ');
          mapContainerRef.current.appendChild(mapDiv);
        }
      }
      
      setIsLoading(false);
      
      // ✅ 再マウント時もコールバックを実行
      if (onMapReady) {
        console.log('🔄 再マウント時のコールバック実行');
        onMapReady(globalMapInstance, globalMarkerInstance, globalPolylineInstance);
      }
      return;
    }

    // 初期化中の場合は待機
    if (initializationInProgress) {
      console.log('⏳ 初期化処理実行中...');
      return;
    }

    // 地図初期化関数
    const initializeMap = () => {
      if (!mapContainerRef.current) {
        console.error('❌ mapContainerがありません');
        return;
      }

      if (initializationInProgress || isGlobalMapInitialized) {
        console.log('⚠️ 既に初期化済みまたは初期化中');
        return;
      }

      initializationInProgress = true;
      console.log('🔧 [GoogleMapWrapper] initializeMap開始');

      if (!window.google || !window.google.maps || !window.google.maps.Map) {
        console.error('❌ Google Maps APIが読み込まれていません');
        initializationInProgress = false;
        return;
      }

      try {
        console.log('🚀 地図を初期化中...');

        const centerPosition = initialPosition || { lat: 34.6937, lng: 135.5023 };

        // 地図作成
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: centerPosition,
          zoom: 18,
          disableDefaultUI: false,
          zoomControl: true,
          gestureHandling: 'greedy',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        
        console.log('✅ Mapインスタンス作成成功');

        // マーカー作成
        const marker = new window.google.maps.Marker({
          map: map,
          position: centerPosition,
          title: '現在位置',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });

        console.log('✅ Markerインスタンス作成成功');

        // ポリライン作成
        const polyline = new window.google.maps.Polyline({
          map: map,
          path: [],
          strokeColor: '#4285F4',
          strokeOpacity: 0.8,
          strokeWeight: 4,
        });

        console.log('✅ Polylineインスタンス作成成功');

        // グローバル変数に保存
        globalMapInstance = map;
        globalMarkerInstance = marker;
        globalPolylineInstance = polyline;
        isGlobalMapInitialized = true;
        initializationInProgress = false;

        // ローディング状態を解除
        setIsLoading(false);

        // コールバック実行
        if (onMapReady) {
          onMapReady(map, marker, polyline);
          console.log('✅ onMapReadyコールバック実行完了');
        }
        
        console.log('🎉 地図の初期化が完全に完了しました!');
      } catch (error) {
        console.error('❌ マップ初期化エラー:', error);
        initializationInProgress = false;
        setIsLoading(false);
      }
    };

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('❌ APIキーが設定されていません');
      setIsLoading(false);
      return;
    }

    // 既にスクリプトが読み込まれている場合
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      if (window.google && window.google.maps && window.google.maps.Map) {
        console.log('✅ Google Maps APIは完全にロード済み');
        setTimeout(initializeMap, 100);
      } else {
        window.initGoogleMap = initializeMap;
      }
      return;
    }

    // 新しくスクリプトを追加
    window.initGoogleMap = initializeMap;
    
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap`;
    script.async = true;
    script.defer = true;
    
    script.onerror = () => {
      console.error('❌ スクリプトロードエラー');
      initializationInProgress = false;
      setIsLoading(false);
    };
    
    document.head.appendChild(script);

    // ✅ React Strict Mode対応
    return () => {
      console.log('🔄 [GoogleMapWrapper] クリーンアップ実行');
    };
  }, []);

  // 初期位置が変わったときの処理
  useEffect(() => {
    if (isGlobalMapInitialized && globalMapInstance && globalMarkerInstance && initialPosition) {
      console.log('📍 初期位置を更新:', initialPosition);
      globalMapInstance.setCenter(initialPosition);
      globalMarkerInstance.setPosition(initialPosition);
    }
  }, [initialPosition]);

  return (
    <div className="w-full h-full relative bg-gray-200" style={{ minHeight: '300px' }}>
      {/* ✅ 修正: 地図コンテナ - position: relative、オフセット削除 */}
      <div 
        key="google-map-container"
        ref={mapContainerRef} 
        className="w-full h-full"
        style={{ 
          minHeight: '300px',
          width: '100%',
          height: '100%',
          position: 'relative',  // ✅ absolute → relative に変更
          top: 0,                // ✅ 10 → 0 に変更
          left: 0,               // ✅ 10 → 0 に変更
          zIndex: 1              // ✅ z-index を明示的に指定
        }}
      />
      
      {/* ローディングオーバーレイ - z-index を地図より上に */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95"
          style={{ zIndex: 10 }}  // ✅ 地図より上に表示
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700 font-semibold">地図を読み込んでいます...</p>
            <p className="text-xs text-gray-500 mt-2">
              GPS位置を取得中...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// エクスポート関数
export const getGlobalMapInstance = () => globalMapInstance;
export const getGlobalMarkerInstance = () => globalMarkerInstance;
export const getGlobalPolylineInstance = () => globalPolylineInstance;

export default GoogleMapWrapper;