// frontend/mobile/src/components/GoogleMapWrapper.tsx
// ✅ 完全修正版: 再レンダリングで消えない対応

import React, { useEffect, useRef } from 'react';

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

  useEffect(() => {
    console.log('🗺️ [GoogleMapWrapper] useEffect開始');

    // 既に初期化済みの場合は再利用
    if (isGlobalMapInitialized && globalMapInstance) {
      console.log('♻️ [GoogleMapWrapper] 既存のマップインスタンスを再利用');
      
      // 既存のマップを現在のコンテナに再アタッチ
      if (mapContainerRef.current && globalMapInstance.getDiv().parentElement !== mapContainerRef.current) {
        console.log('🔄 既存のマップを現在のコンテナに再アタッチ');
        mapContainerRef.current.appendChild(globalMapInstance.getDiv());
      }
      
      onMapReady?.(globalMapInstance, globalMarkerInstance, globalPolylineInstance);
      return;
    }

    // 初期化中の場合は待機
    if (initializationInProgress) {
      console.log('⏳ 初期化処理実行中...');
      return;
    }

    // 地図初期化関数
    const initializeMap = () => {
      if (initializationInProgress || isGlobalMapInitialized) {
        return;
      }

      initializationInProgress = true;
      console.log('🔧 [GoogleMapWrapper] initializeMap開始');
      
      if (!mapContainerRef.current) {
        console.error('❌ mapContainerがありません');
        initializationInProgress = false;
        return;
      }

      if (!window.google || !window.google.maps || !window.google.maps.Map) {
        console.error('❌ Google Maps APIが完全に読み込まれていません');
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

        // コールバック実行
        if (onMapReady) {
          onMapReady(map, marker, polyline);
          console.log('✅ onMapReadyコールバック実行完了');
        }
        
        console.log('🎉 地図の初期化が完全に完了しました!');
      } catch (error) {
        console.error('❌ マップ初期化エラー:', error);
        initializationInProgress = false;
      }
    };

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('❌ APIキーが設定されていません');
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
    };
    
    document.head.appendChild(script);

    // クリーンアップ: マップのDOMは削除しない
    return () => {
      console.log('🔄 [GoogleMapWrapper] コンポーネントアンマウント(マップは保持)');
      // グローバルマップは削除しない
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
    <div className="w-full h-full relative" style={{ minHeight: '400px' }}>
      {/* 地図コンテナ - キーを使って安定化 */}
      <div 
        key="google-map-container"
        ref={mapContainerRef} 
        className="w-full h-full bg-gray-100"
        style={{ minHeight: '400px' }}
      />
      
      {/* ローディングオーバーレイ - グローバル状態を直接チェック */}
      {!isGlobalMapInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10 pointer-events-none">
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

export const getGlobalMapInstance = () => globalMapInstance;
export const getGlobalMarkerInstance = () => globalMarkerInstance;
export const getGlobalPolylineInstance = () => globalPolylineInstance;

export default GoogleMapWrapper;