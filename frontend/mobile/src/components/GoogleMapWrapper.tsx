// frontend/mobile/src/components/GoogleMapWrapper.tsx
// React管理外でGoogle Mapsを完全に制御するラッパーコンポーネント

import React, { useEffect, useRef } from 'react';

// 🔧 TypeScript型定義を追加
declare global {
  interface Window {
    google: any;
  }
}

interface GoogleMapWrapperProps {
  onMapReady?: (map: any, marker: any, polyline: any) => void;
  initialPosition?: { lat: number; lng: number };
}

// グローバル状態（コンポーネント外で管理）
let globalMapInstance: any = null;
let globalMarkerInstance: any = null;
let globalPolylineInstance: any = null;
let isGlobalMapInitialized = false;

const GoogleMapWrapper: React.FC<GoogleMapWrapperProps> = ({ 
  onMapReady, 
  initialPosition 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const initializationAttemptedRef = useRef(false);

  useEffect(() => {
    // 既に初期化済みの場合
    if (isGlobalMapInitialized && globalMapInstance) {
      console.log('[GoogleMapWrapper] Using existing map instance');
      onMapReady?.(globalMapInstance, globalMarkerInstance, globalPolylineInstance);
      return;
    }

    // 初期化を1度だけ試行
    if (initializationAttemptedRef.current) {
      console.log('[GoogleMapWrapper] Initialization already attempted');
      return;
    }

    initializationAttemptedRef.current = true;

    const initializeMap = () => {
      if (!mapContainerRef.current || !window.google || !window.google.maps) {
        console.warn('[GoogleMapWrapper] Cannot initialize: missing requirements');
        return;
      }

      if (isGlobalMapInitialized) {
        console.log('[GoogleMapWrapper] Map already initialized globally');
        return;
      }

      try {
        console.log('[GoogleMapWrapper] Initializing Google Map...');

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: initialPosition || { lat: 34.6937, lng: 135.5023 },
          zoom: 18,
          mapId: 'DEMO_MAP_ID',
          heading: 0,
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          tiltInteractionEnabled: true,
          headingInteractionEnabled: true
        });

        const createMarkerIcon = (distance: number, speed: number) => {
          const svg = `
            <svg width="60" height="80" viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="40" r="28" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
              <circle cx="30" cy="40" r="22" fill="rgba(255,255,255,0.9)" stroke="#4285F4" stroke-width="1"/>
              <path d="M30 15 L25 25 L35 25 Z" fill="#4285F4"/>
              <text x="30" y="35" text-anchor="middle" font-family="Arial" font-size="8" font-weight="bold" fill="#333">
                ${distance.toFixed(1)}km
              </text>
              <text x="30" y="47" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#4285F4">
                ${Math.round(speed)}
              </text>
              <text x="30" y="55" text-anchor="middle" font-family="Arial" font-size="6" fill="#666">
                km/h
              </text>
            </svg>
          `;
          return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
            scaledSize: new window.google.maps.Size(60, 80),
            anchor: new window.google.maps.Point(30, 40)
          };
        };

        const marker = new window.google.maps.Marker({
          position: initialPosition || { lat: 34.6937, lng: 135.5023 },
          map: map,
          icon: createMarkerIcon(0, 0),
          title: '現在地',
          zIndex: 1000
        });

        const polyline = new window.google.maps.Polyline({
          path: [],
          geodesic: true,
          strokeColor: '#FF0000',
          strokeOpacity: 1.0,
          strokeWeight: 4,
          zIndex: 999
        });

        polyline.setMap(map);

        // グローバルに保存
        globalMapInstance = map;
        globalMarkerInstance = marker;
        globalPolylineInstance = polyline;
        isGlobalMapInitialized = true;

        console.log('[GoogleMapWrapper] Map initialized successfully');
        onMapReady?.(map, marker, polyline);
      } catch (error) {
        console.error('[GoogleMapWrapper] Failed to initialize map:', error);
      }
    };

    // Google Maps APIの読み込み
    if (window.google && window.google.maps) {
      initializeMap();
    } else {
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        const checkGoogleMaps = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkGoogleMaps);
            initializeMap();
          }
        }, 100);

        setTimeout(() => clearInterval(checkGoogleMaps), 10000);
      } else {
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&v=weekly&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initializeMap;
        document.head.appendChild(script);
      }
    }

    // クリーンアップは何もしない（グローバルインスタンスを維持）
    return () => {
      console.log('[GoogleMapWrapper] Component unmounting (keeping global map)');
    };
  }, []);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
};

// グローバルインスタンスへのアクセス用ヘルパー
export const getGlobalMapInstance = () => globalMapInstance;
export const getGlobalMarkerInstance = () => globalMarkerInstance;
export const getGlobalPolylineInstance = () => globalPolylineInstance;

export default GoogleMapWrapper;