// frontend/mobile/src/components/GoogleMapWrapper.tsx
// 🗺️ Google Mapコンポーネント - Polyline初期化エラー修正版

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

// 📍 三角矢印付きマーカーSVG生成（回転対応）
const createCustomMarkerSVG = (distance: number, speed: number, heading: number = 0): string => {
  return `
    <svg width="60" height="80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <g id="arrow-marker">
          <circle cx="30" cy="30" r="24" fill="rgba(0,0,0,0.3)" />
          <circle cx="30" cy="28" r="22" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
          <path d="M 30 13 L 38 25 L 22 25 Z" fill="#ffffff" stroke="#1a73e8" stroke-width="1.5"/>
          <circle cx="30" cy="28" r="4" fill="#ffffff"/>
        </g>
      </defs>
      <use href="#arrow-marker" transform="rotate(${heading} 30 28)"/>
      <rect x="8" y="52" width="44" height="24" rx="4" fill="#ffffff" stroke="#4285F4" stroke-width="2"/>
      <text x="30" y="62" text-anchor="middle" font-family="Arial" font-size="9" font-weight="bold" fill="#1a73e8">
        ${speed.toFixed(0)} km/h
      </text>
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
      const existingDiv = globalMapInstance.getDiv();
      if (existingDiv && document.contains(existingDiv)) {
        console.log('♻️ 既存マップを再利用');
        setIsLoading(false);
        if (onMapReady) {
          onMapReady(globalMapInstance, globalMarkerInstance, globalPolylineInstance);
        }
        return;
      } else {
        // DOMコンテナが削除済み→グローバル全リセットして再初期化に流る
        console.log('🔄 マップコンテナ消失検出。再初期化');
        isGlobalMapInitialized = false;
        globalMapInstance = null;
        globalMarkerInstance = null;
        globalPolylineInstance = null;
      }
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

        const markerSVG = createCustomMarkerSVG(0, 0, 0);
        // BUG-011: AdvancedMarkerElement に移行済み。markerIcon は不要なので削除(TS6133解消)
        const markerDiv = document.createElement('div');
        markerDiv.innerHTML = markerSVG;
        markerDiv.style.cssText = 'width:60px;height:80px;cursor:pointer;';
        const marker = new window.google.maps.marker.AdvancedMarkerElement({
          map: map,
          position: centerPosition,
          title: '現在位置',
          content: markerDiv,
        });

        console.log('✅ 三角マーカー作成成功');

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

        map.addListener('renderingtype_changed', () => {
          const renderingType = map.getRenderingType();
          const isVector = (renderingType === window.google.maps.RenderingType.VECTOR);
          console.log(`マップレンダリング: ${isVector ? 'VECTOR' : 'RASTER'}`);
        });

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
    // BUG-012: loading=async で廃止APIの初期化警告を抑制
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap&v=weekly&loading=async&libraries=marker`;
    script.async = true;
    script.defer = true;
    
    script.onerror = () => {
      console.error('❌ スクリプトロードエラー');
      initializationInProgress = false;
      setIsLoading(false);
    };
    
    document.head.appendChild(script);

    return () => {
      mountedRef.current = false;
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

export const getGlobalMapInstance = () => globalMapInstance;
export const getGlobalMarkerInstance = () => globalMarkerInstance;
export const getGlobalPolylineInstance = () => globalPolylineInstance;

export const updateMarkerIcon = (distance: number, speed: number, heading: number = 0) => {
  if (!globalMarkerInstance) {
    console.warn('⚠️ マーカー未初期化');
    return;
  }

  // BUG-011: AdvancedMarkerElement は content プロパティで SVG を更新
  const markerSVG = createCustomMarkerSVG(distance, speed, heading);
  if (globalMarkerInstance.content instanceof HTMLElement) {
    globalMarkerInstance.content.innerHTML = markerSVG;
  } else {
    const markerDiv = document.createElement('div');
    markerDiv.innerHTML = markerSVG;
    markerDiv.style.cssText = 'width:60px;height:80px;cursor:pointer;';
    globalMarkerInstance.content = markerDiv;
  }
};

export const updateMarkerPosition = (lat: number, lng: number) => {
  if (!globalMarkerInstance) {
    console.warn('⚠️ マーカー未初期化');
    return;
  }

  // BUG-011: AdvancedMarkerElement は position プロパティで更新
  globalMarkerInstance.position = { lat, lng };
};

export const panMapToPosition = (lat: number, lng: number) => {
  if (!globalMapInstance) {
    console.warn('⚠️ マップ未初期化');
    return;
  }

  globalMapInstance.panTo({ lat, lng });
};

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
 * 🛤️ 走行軌跡に座標を追加 - 修正版（初期化チェック追加）
 */
export const addPathPoint = (lat: number, lng: number) => {
  if (!globalPolylineInstance) {
    console.warn('⚠️ Polyline未初期化 - 座標追加スキップ');
    return;
  }

  try {
    const path = globalPolylineInstance.getPath();
    
    // ✅ 修正: pathがundefinedの場合はエラー回避
    if (!path) {
      console.warn('⚠️ Polyline path未初期化');
      return;
    }

    path.push(new window.google.maps.LatLng(lat, lng));
    console.log(`📍 座標追加: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
  } catch (error) {
    console.error('❌ 座標追加エラー:', error);
  }
};

export const clearPath = () => {
  if (!globalPolylineInstance) {
    console.warn('⚠️ Polyline未初期化');
    return;
  }

  try {
    globalPolylineInstance.setPath([]);
    console.log('🗑️ 走行軌跡クリア');
  } catch (error) {
    console.error('❌ 軌跡クリアエラー:', error);
  }
};

export default GoogleMapWrapper;