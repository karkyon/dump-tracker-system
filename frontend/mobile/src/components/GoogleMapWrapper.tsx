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
  currentHeading?: number; // 🧭 追加: 初期heading（マーカーSVG向き）
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
  initialPosition,
  currentHeading = 0
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  // currentHeading変化時にマーカー矢印を更新
  useEffect(() => {
    if (currentHeading !== 0) {
      updateMarkerHeading(currentHeading);
    }
  }, [currentHeading]);

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

        // 🧭 Vector Mapを強制有効化（mapId有無に関係なく）
        // setHeading()はVectorマップのみ動作。RasterではAPIエラーも出ないが無効。
        // RenderingType.VECTORを直接指定すればmapIdなしでもVector動作する
        let renderingTypeValue: any = undefined;
        try {
          renderingTypeValue = window.google.maps.RenderingType?.VECTOR;
        } catch (_e) { /* RenderingType未対応ブラウザ */ }

        const mapOptions: any = {
          center: centerPosition,
          zoom: 18,
          // 🔧 VITE_GOOGLE_MAP_ID: Cloud ConsoleでVector有効済みのMapID（793b2cb3013694b0700a2152）
          // hasMapId判定と一致させるため環境変数から取得。未設定時はDEMO_MAP_IDをフォールバック
          renderingType: renderingTypeValue ?? 'VECTOR',
          mapId: import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID',
          heading: 0,
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          tiltInteractionEnabled: false,   // ユーザー操作によるtiltは無効（ナビ用途）
          headingInteractionEnabled: false, // ユーザー操作によるheadingは無効（GPS自動）
        };

        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        console.log('✅ Map作成成功');

        const markerSVG = createCustomMarkerSVG(0, 0, 0);
        const markerDiv = document.createElement('div');
        markerDiv.innerHTML = markerSVG;
        markerDiv.style.cssText = 'width:60px;height:80px;cursor:pointer;';

        // mapId未設定時は AdvancedMarkerElement が使えないため旧Markerにフォールバック
        let marker: any;
        const hasMapId = !!import.meta.env.VITE_GOOGLE_MAP_ID;
        if (hasMapId && window.google.maps.marker?.AdvancedMarkerElement) {
          marker = new window.google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: centerPosition,
            title: '現在位置',
            content: markerDiv,
          });
        } else {
          // フォールバック: 旧 Marker（mapId不要、エラーポップアップなし）
          marker = new window.google.maps.Marker({
            map: map,
            position: centerPosition,
            title: '現在位置',
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSVG)}`,
              scaledSize: new window.google.maps.Size(60, 80),
              anchor: new window.google.maps.Point(30, 28),
            },
          });
        }

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

        // マップ初期化直後にrenderingTypeを確認してログ送信
        setTimeout(() => {
          try {
            const rt = map.getRenderingType?.();
            const VKEY = window.google?.maps?.RenderingType?.VECTOR;
            const isVec = rt === VKEY || String(rt) === 'VECTOR';
            const initMsg = `[MAP_INIT] renderingType=${String(rt)} isVector=${isVec} mapId=${import.meta.env.VITE_GOOGLE_MAP_ID || 'none'}`;
            console.log(initMsg);
            sendDebugLog('[MAP_INIT] renderingType確認', {
              renderingType: String(rt),
              isVector: isVec,
              mapId: import.meta.env.VITE_GOOGLE_MAP_ID || 'none',
              renderingTypeValueUsed: String(renderingTypeValue),
              VECTOR_enum: String(VKEY),
              url: window.location.href,
            });
          } catch(e) { console.warn('renderingType取得エラー:', e); }
        }, 2000);

        map.addListener('renderingtype_changed', () => {
          const renderingType = map.getRenderingType();
          const isVector = (renderingType === window.google.maps.RenderingType?.VECTOR || String(renderingType) === 'VECTOR');
          console.log(`マップレンダリング変更: ${isVector ? 'VECTOR✅' : 'RASTER❌'}`);
          sendDebugLog('[MAP_RENDERING_CHANGED]', { renderingType: String(renderingType), isVector });
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
        // 既存scriptのコールバックを今回の initializeMap に差し替え
        // （古いmapIdのscriptが再実行されないよう上書き）
        window.initGoogleMap = initializeMap;
      }
      return;
    }

    // 初回: callbackを設定してからscriptを追加
    window.initGoogleMap = initializeMap;
    
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    // BUG-012: loading=async で廃止APIの初期化警告を抑制
    // &v=weekly: VectorマップとRenderingTypeを使うために必要
    // stable版ではRenderingType.VECTORが存在せずheadingUp無効になる
    // DEMO_MAP_ID をprecacheして確実にVector Mapを有効化
    const mapIdParam = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';
    // &loading=async: Google公式でVector Mode必須パラメータ（script.async属性とは別物）
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=initGoogleMap&libraries=marker&v=weekly&map_ids=${mapIdParam}`;
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

  const markerSVG = createCustomMarkerSVG(distance, speed, heading);
  // AdvancedMarkerElement(mapId有り) と 旧Marker(mapId無し) の両対応
  if (globalMarkerInstance.content instanceof HTMLElement) {
    // AdvancedMarkerElement
    globalMarkerInstance.content.innerHTML = markerSVG;
  } else if (typeof globalMarkerInstance.setIcon === 'function') {
    // 旧 Marker フォールバック
    globalMarkerInstance.setIcon({
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSVG)}`,
      scaledSize: new window.google.maps.Size(60, 80),
      anchor: new window.google.maps.Point(30, 28),
    });
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

  // AdvancedMarkerElement と旧Marker の両対応
  if (typeof globalMarkerInstance.setPosition === 'function') {
    globalMarkerInstance.setPosition({ lat, lng });
  } else {
    globalMarkerInstance.position = { lat, lng };
  }
};

// 現在のマーカー表示用heading（グローバル管理）
let _currentMarkerHeading = 0;
let _currentMarkerSpeed = 0;
let _currentMarkerDistance = 0;

/**
 * 🧭 マーカーのheadingを更新（SVG再描画）
 * Rasterマップでも矢印が進行方向を向く
 */
export const updateMarkerHeading = (heading: number, speed?: number, distance?: number) => {
  _currentMarkerHeading = heading;
  if (speed !== undefined) _currentMarkerSpeed = speed;
  if (distance !== undefined) _currentMarkerDistance = distance;

  console.log(`🧭 マーカーheading更新: ${_currentMarkerHeading.toFixed(1)}°`);

  if (!globalMarkerInstance) return;

  try {
    const svgStr = createCustomMarkerSVG(_currentMarkerDistance, _currentMarkerSpeed, heading);
    const markerDiv = document.createElement('div');
    markerDiv.innerHTML = svgStr;
    markerDiv.style.cssText = 'width:60px;height:80px;cursor:pointer;';

    if (globalMarkerInstance.content !== undefined) {
      // AdvancedMarkerElement: content を更新
      globalMarkerInstance.content = markerDiv;
    } else if (typeof globalMarkerInstance.setIcon === 'function') {
      // 旧Marker: setIcon でSVGアイコンを更新（回転を反映）
      globalMarkerInstance.setIcon({
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgStr)}`,
        scaledSize: new window.google.maps.Size(60, 80),
        anchor: new window.google.maps.Point(30, 28),
      });
    }
  } catch (e) {
    console.warn('⚠️ マーカー回転更新エラー:', e);
  }
};

export const panMapToPosition = (lat: number, lng: number) => {
  if (!globalMapInstance) {
    console.warn('⚠️ マップ未初期化');
    return;
  }

  globalMapInstance.panTo({ lat, lng });
};

// 🐛 フロントエンドデバッグログ送信
const sendDebugLog = (message: string, data?: any) => {
  try {
    // VITE_API_BASE_URL=/api/v1 なので mobile/debug/log だけ追加
    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';
    fetch(`${apiBase}/mobile/debug/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'info', message, data }),
      keepalive: true
    }).catch(() => {});
  } catch (_) {}
};
let _lastDebugSentAt = 0;

export const setMapHeading = (heading: number) => {
  if (heading === null || heading === undefined || isNaN(heading)) return;
  updateMarkerHeading(heading);
  if (!globalMapInstance) {
    const now = Date.now();
    if (now - _lastDebugSentAt > 5000) {
      _lastDebugSentAt = now;
      sendDebugLog('setMapHeading: globalMapInstance=null', { heading });
    }
    return;
  }
  const renderingType = globalMapInstance.getRenderingType?.();
  const VECTOR = (window as any).google?.maps?.RenderingType?.VECTOR;
  const hasSetHeading = typeof globalMapInstance.setHeading === 'function';
  if (hasSetHeading) {
    try {
      globalMapInstance.setHeading(heading);
      const now = Date.now();
      if (now - _lastDebugSentAt > 5000) {
        _lastDebugSentAt = now;
        sendDebugLog('setMapHeading: OK', {
          heading: Math.round(heading),
          renderingType: String(renderingType),
          isVector: VECTOR ? renderingType === VECTOR : 'NO_VECTOR_API',
        });
      }
    } catch (e) {
      sendDebugLog('setMapHeading: ERROR', { heading, error: String(e).substring(0, 100) });
      console.warn('⚠️ setHeading:', String(e).substring(0, 80));
    }
  } else {
    const now = Date.now();
    if (now - _lastDebugSentAt > 5000) {
      _lastDebugSentAt = now;
      sendDebugLog('setMapHeading: NO_FUNCTION', {
        heading, renderingType: String(renderingType)
      });
    }
  }
}
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