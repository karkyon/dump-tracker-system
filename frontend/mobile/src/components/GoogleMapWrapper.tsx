// frontend/mobile/src/components/GoogleMapWrapper.tsx
// ✅ 完全修正版: DOMを確実に保持 + TypeScriptエラー修正

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
let globalMapContainer: HTMLDivElement | null = null;

const GoogleMapWrapper: React.FC<GoogleMapWrapperProps> = ({ 
  onMapReady, 
  initialPosition 
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    console.log('🗺️ [GoogleMapWrapper] 初期化開始');

    // 既存のマップがある場合は再利用
    if (isGlobalMapInitialized && globalMapInstance && globalMapContainer) {
      console.log('♻️ 既存のマップを再利用');
      if (wrapperRef.current && !wrapperRef.current.contains(globalMapContainer)) {
        wrapperRef.current.appendChild(globalMapContainer);
      }
      onMapReady?.(globalMapInstance, globalMarkerInstance, globalPolylineInstance);
      return;
    }

    const initializeMap = () => {
      if (!wrapperRef.current || isGlobalMapInitialized) return;

      console.log('🔧 地図初期化中...');

      // 永続的なコンテナを作成
      globalMapContainer = document.createElement('div');
      globalMapContainer.id = 'permanent-map-container';
      globalMapContainer.style.width = '100%';
      globalMapContainer.style.height = '100%';
      globalMapContainer.style.minHeight = '400px';
      
      wrapperRef.current.appendChild(globalMapContainer);

      try {
        const centerPosition = initialPosition || { lat: 34.6937, lng: 135.5023 };

        const map = new window.google.maps.Map(globalMapContainer, {
          center: centerPosition,
          zoom: 18,
          disableDefaultUI: false,
          zoomControl: true,
          gestureHandling: 'greedy',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        
        console.log('✅ Map作成成功');

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

        console.log('✅ Marker作成成功');

        const polyline = new window.google.maps.Polyline({
          map: map,
          path: [],
          strokeColor: '#4285F4',
          strokeOpacity: 0.8,
          strokeWeight: 4,
        });

        console.log('✅ Polyline作成成功');

        globalMapInstance = map;
        globalMarkerInstance = marker;
        globalPolylineInstance = polyline;
        isGlobalMapInitialized = true;

        onMapReady?.(map, marker, polyline);
        
        console.log('🎉 地図初期化完了!');
      } catch (error) {
        console.error('❌ 地図初期化エラー:', error);
      }
    };

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('❌ APIキーが設定されていません');
      return;
    }

    if (window.google && window.google.maps && window.google.maps.Map) {
      console.log('✅ Google Maps API読み込み済み');
      setTimeout(initializeMap, 100);
    } else {
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        window.initGoogleMap = initializeMap;
      } else {
        window.initGoogleMap = initializeMap;
        
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap`;
        script.async = true;
        script.defer = true;
        script.onerror = () => console.error('❌ スクリプトロードエラー');
        
        document.head.appendChild(script);
      }
    }

    return () => {
      console.log('🔄 アンマウント(マップは保持)');
    };
  }, [onMapReady, initialPosition]);

  // 初期位置変更時
  useEffect(() => {
    if (isGlobalMapInitialized && globalMapInstance && globalMarkerInstance && initialPosition) {
      globalMapInstance.setCenter(initialPosition);
      globalMarkerInstance.setPosition(initialPosition);
    }
  }, [initialPosition]);

  return (
    <div 
      ref={wrapperRef} 
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        position: 'relative',
        backgroundColor: '#f3f4f6'
      }}
    >
      {!isGlobalMapInitialized && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          zIndex: 10
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 16px',
              border: '2px solid #e5e7eb',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ color: '#374151', fontWeight: 600 }}>地図を読み込んでいます...</p>
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