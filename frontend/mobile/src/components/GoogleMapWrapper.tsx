// frontend/mobile/src/components/GoogleMapWrapper.tsx
// 🗺️ Google Mapコンポーネント - 完全版
// ✅ ヘッドアップ表示（地図回転）
// ✅ 走行軌跡（赤いライン）
// ✅ 三角矢印マーカー（進行方向を示す）

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

let globalMapInstance: any = null;
let globalMarkerInstance: any = null;
let globalPolylineInstance: any = null;
let isGlobalMapInitialized = false;
let initializationInProgress = false;

// 📍 三角矢印付きマーカーSVG生成
const createCustomMarkerSVG = (distance: number, speed: number, heading: number = 0): string => {
  return `
    <svg width="60" height="80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 回転用のグループ -->
        <g id="arrow-marker">
          <!-- 外側の円 (影) -->
          <circle cx="30" cy="30" r="24" fill="rgba(0,0,0,0.3)" />
          
          <!-- メインの円 -->
          <circle cx="30" cy="28" r="22" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
          
          <!-- 🔺 進行方向を示す三角形 (上向き) -->
          <path d="M 30 13 L 38 25 L 22 25 Z" fill="#ffffff" stroke="#1a73e8" stroke-width="1.5"/>
          
          <!-- 中心点 -->
          <circle cx="30" cy="28" r="4" fill="#ffffff"/>
        </g>
      </defs>
      
      <!-- 回転適用 (headingに基づいて回転) -->
      <use href="#arrow-marker" transform="rotate(${heading} 30 28)"/>
      
      <!-- 情報ボックス背景 -->
      <rect x="8" y="52" width="44" height="24" rx="4" fill="#ffffff" stroke="#4285F4" stroke-width="2"/>
      
      <!-- 速度表示 -->
      <text x="30" y="62" text-anchor="middle" font-family="Arial" font-size="9" font-weight="bold" fill="#1a73e8">
        ${speed.toFixed(0)} km/h
      </text>
      
      <!-- 距離表示 -->
      <text x="30" y="71" text-anchor="middle" font-family="Arial" font-size="8" fill="#666">
        ${distance.toFixed(1)} km
      </text>
    </svg>
  `;
};

const GoogleMapWrapper: React.FC<GoogleMapWrapperProps> = ({ 
  onMapReady, 
  initialPosition 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    console.log('🗺️ GoogleMapWrapper 初期化開始');

    if (isGlobalMapInitialized && globalMapInstance) {
      console.log('♻️ 既存マップを再利用');
      setIsLoading(false);
      if (onMapReady) {
        onMapReady(globalMapInstance, globalMarkerInstance, globalPolylineInstance);
      }
      return;
    }

    if (initializationInProgress) {
      console.log('⏳ 初期化実行中');
      return;
    }

    const initializeMap = () => {
      if (!mapContainerRef.current || initializationInProgress || isGlobalMapInitialized) {
        return;
      }

      initializationInProgress = true;
      console.log('🚀 マップ初期化開始');

      if (!window.google?.maps?.Map) {
        console.error('❌ Google Maps API未読み込み');
        initializationInProgress = false;
        return;
      }

      try {
        const centerPosition = initialPosition || { lat: 34.6937, lng: 135.5023 };

        const mapOptions: any = {
          center: centerPosition,
          zoom: 18,
          renderingType: window.google.maps.RenderingType.VECTOR,
          mapId: "DEMO_MAP_ID",
          heading: 0,
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          tiltInteractionEnabled: true,
          headingInteractionEnabled: true,
        };

        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        console.log('✅ Map作成成功');

        // 🚗 三角矢印マーカー作成
        const markerSVG = createCustomMarkerSVG(0, 0, 0);
        const markerIcon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSVG),
          scaledSize: new window.google.maps.Size(60, 80),
          anchor: new window.google.maps.Point(30, 40)
        };

        const marker = new window.google.maps.Marker({
          map: map,
          position: centerPosition,
          title: '現在位置',
          icon: markerIcon,
          zIndex: 1000,
        });

        console.log('✅ 三角マーカー作成成功');

        // 🛤️ 走行軌跡用Polyline
        const polyline = new window.google.maps.Polyline({
          map: map,
          path: [],
          geodesic: true,
          strokeColor: '#FF0000',
          strokeOpacity: 1.0,
          strokeWeight: 4,
          zIndex: 999,
        });

        console.log('✅ Polyline作成成功');

        globalMapInstance = map;
        globalMarkerInstance = marker;
        globalPolylineInstance = polyline;
        isGlobalMapInitialized = true;
        initializationInProgress = false;

        setIsLoading(false);

        if (onMapReady) {
          onMapReady(map, marker, polyline);
        }
        
        console.log('🎉 マップ初期化完了!');
      } catch (error) {
        console.error('❌ マップ初期化エラー:', error);
        initializationInProgress = false;
        setIsLoading(false);
      }
    };

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('❌ APIキー未設定');
      setIsLoading(false);
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      if (window.google?.maps?.Map) {
        console.log('✅ Google Maps APIロード済み');
        setTimeout(initializeMap, 100);
      } else {
        window.initGoogleMap = initializeMap;
      }
      return;
    }

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

    return () => {
      console.log('🔄 クリーンアップ');
    };
  }, []);

  useEffect(() => {
    if (isGlobalMapInitialized && globalMapInstance && globalMarkerInstance && initialPosition) {
      globalMapInstance.setCenter(initialPosition);
      globalMarkerInstance.setPosition(initialPosition);
    }
  }, [initialPosition]);

  return (
    <div className="w-full h-full relative bg-gray-200" style={{ minHeight: '300px' }}>
      <div 
        key="google-map-container"
        ref={mapContainerRef} 
        className="w-full h-full"
        style={{ 
          minHeight: '300px',
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      />
      
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95"
          style={{ zIndex: 10 }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700 font-semibold">地図を読み込んでいます...</p>
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

/**
 * 🔺 マーカーアイコンを更新（三角矢印の向きも更新）
 */
export const updateMarkerIcon = (distance: number, speed: number, heading: number = 0) => {
  if (!globalMarkerInstance) {
    console.warn('⚠️ マーカー未初期化');
    return;
  }

  const markerSVG = createCustomMarkerSVG(distance, speed, heading);
  const markerIcon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSVG),
    scaledSize: new window.google.maps.Size(60, 80),
    anchor: new window.google.maps.Point(30, 40)
  };

  globalMarkerInstance.setIcon(markerIcon);
};

/**
 * マーカー位置を更新
 */
export const updateMarkerPosition = (lat: number, lng: number) => {
  if (!globalMarkerInstance) {
    console.warn('⚠️ マーカー未初期化');
    return;
  }

  globalMarkerInstance.setPosition({ lat, lng });
};

/**
 * 地図の中心を移動
 */
export const panMapToPosition = (lat: number, lng: number) => {
  if (!globalMapInstance) {
    console.warn('⚠️ マップ未初期化');
    return;
  }

  globalMapInstance.panTo({ lat, lng });
};

/**
 * 🧭 ヘッドアップ表示: 地図を回転
 */
export const setMapHeading = (heading: number) => {
  if (!globalMapInstance) {
    console.warn('⚠️ マップ未初期化');
    return;
  }

  const renderingType = globalMapInstance.getRenderingType();
  const isVector = (renderingType === window.google.maps.RenderingType.VECTOR);

  if (!isVector) {
    console.warn('⚠️ ベクターマップではないため、ヘッドアップ無効');
    return;
  }

  if (heading !== null && !isNaN(heading)) {
    console.log(`🧭 ヘッドアップ回転: ${heading.toFixed(1)}°`);
    globalMapInstance.setHeading(heading);
  }
};

/**
 * 🛤️ 走行軌跡に座標を追加
 */
export const addPathPoint = (lat: number, lng: number) => {
  if (!globalPolylineInstance) {
    console.warn('⚠️ Polyline未初期化');
    return;
  }

  const path = globalPolylineInstance.getPath();
  path.push(new window.google.maps.LatLng(lat, lng));
};

/**
 * 走行軌跡をクリア
 */
export const clearPath = () => {
  if (!globalPolylineInstance) {
    console.warn('⚠️ Polyline未初期化');
    return;
  }

  globalPolylineInstance.setPath([]);
  console.log('🗑️ 走行軌跡クリア');
};

export default GoogleMapWrapper;