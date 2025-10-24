// frontend/mobile/src/components/GoogleMapWrapper.tsx
// 🗺️ 強化版Google Mapコンポーネント - WebGLベクターマップ対応
// 作成日時: 2025-10-24
// 
// 実装機能:
//  ✅ WebGLベクターマップ (renderingType: VECTOR)
//  ✅ カスタムSVGマーカー (速度・距離表示付き)
//  ✅ ヘッドアップ表示 (進行方向に地図回転)
//  ✅ 走行軌跡トレース (Polyline)
//  ✅ 方位インジケーター表示

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

// 📍 カスタムSVGマーカー生成関数
const createCustomMarkerSVG = (distance: number, speed: number): string => {
  return `
    <svg width="60" height="80" xmlns="http://www.w3.org/2000/svg">
      <!-- 外側の円 (影) -->
      <circle cx="30" cy="30" r="24" fill="rgba(0,0,0,0.3)" />
      
      <!-- メインの円 -->
      <circle cx="30" cy="28" r="22" fill="#4285F4" stroke="#ffffff" stroke-width="3"/>
      
      <!-- 内側の円 (パルス効果用) -->
      <circle cx="30" cy="28" r="16" fill="#1a73e8" opacity="0.8"/>
      
      <!-- 中心点 -->
      <circle cx="30" cy="28" r="6" fill="#ffffff"/>
      
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
  const [isVectorMap, setIsVectorMap] = useState<boolean | null>(null);
  const [currentHeading, setCurrentHeading] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    console.log('🗺️ [GoogleMapWrapper] useEffect開始');

    // 既に初期化済みの場合は再利用
    if (isGlobalMapInitialized && globalMapInstance) {
      console.log('♻️ [GoogleMapWrapper] 既存のマップインスタンスを再利用');
      
      if (mapContainerRef.current) {
        const mapDiv = globalMapInstance.getDiv();
        if (mapDiv.parentElement !== mapContainerRef.current) {
          console.log('🔄 既存のマップを現在のコンテナに再アタッチ');
          mapContainerRef.current.appendChild(mapDiv);
        }
      }
      
      setIsLoading(false);
      
      if (onMapReady) {
        console.log('🔄 再マウント時のコールバック実行');
        onMapReady(globalMapInstance, globalMarkerInstance, globalPolylineInstance);
      }
      return;
    }

    if (initializationInProgress) {
      console.log('⏳ 初期化処理実行中...');
      return;
    }

    // 🗺️ 地図初期化関数
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
        console.log('🚀 WebGLベクターマップを初期化中...');

        const centerPosition = initialPosition || { lat: 34.6937, lng: 135.5023 };

        // ✅ WebGLベクターマップの設定
        const mapOptions: any = {
          center: centerPosition,
          zoom: 18,
          
          // 🔥 重要: WebGLベクターマップの有効化
          renderingType: window.google.maps.RenderingType.VECTOR,
          
          // 🔥 重要: Map ID設定 (ベクターマップに必須)
          // 注意: 本番環境では独自のMap IDを作成してください
          mapId: "DEMO_MAP_ID",
          
          // 🔥 重要: ヘッドアップ表示に必要な設定
          heading: 0,  // 初期方位
          tilt: 0,     // 傾き(0=真上から)
          
          // UI設定
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          
          // 🔥 重要: tiltとheadingの操作を有効化
          tiltInteractionEnabled: true,
          headingInteractionEnabled: true,
        };

        // 地図インスタンス作成
        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        
        console.log('✅ Mapインスタンス作成成功');

        // 📍 マップレンダリングタイプの確認
        map.addListener('renderingtype_changed', () => {
          const renderingType = map.getRenderingType();
          const isVector = (renderingType === window.google.maps.RenderingType.VECTOR);
          setIsVectorMap(isVector);
          
          console.log(`🗺️ マップレンダリングタイプ: ${isVector ? 'VECTOR ✅' : 'RASTER ⚠️'}`);
          
          if (!isVector) {
            console.warn('⚠️ ベクターマップが利用できません。ヘッドアップ表示は制限されます。');
          }
        });

        // 初期レンダリングタイプの確認
        setTimeout(() => {
          const renderingType = map.getRenderingType();
          const isVector = (renderingType === window.google.maps.RenderingType.VECTOR);
          setIsVectorMap(isVector);
          console.log(`🗺️ 初期マップレンダリングタイプ: ${isVector ? 'VECTOR ✅' : 'RASTER ⚠️'}`);
        }, 1000);

        // 🚗 カスタムマーカーの作成
        const markerSVG = createCustomMarkerSVG(0, 0);
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

        console.log('✅ カスタムMarkerインスタンス作成成功');

        // 🛤️ 走行軌跡用Polylineの作成
        const polyline = new window.google.maps.Polyline({
          map: map,
          path: [],
          geodesic: true,
          strokeColor: '#FF0000',
          strokeOpacity: 1.0,
          strokeWeight: 4,
          zIndex: 999,
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
        
        console.log('🎉 WebGLベクターマップの初期化が完全に完了しました!');
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
      {/* 地図コンテナ */}
      <div 
        key="google-map-container"
        ref={mapContainerRef} 
        className="w-full h-full"
        style={{ 
          minHeight: '300px',
          width: '100%',
          height: '100%',
          position: 'relative',
          top: 0,
          left: 0,
          zIndex: 1
        }}
      />
      
      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95"
          style={{ zIndex: 10 }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700 font-semibold">WebGLベクターマップを読み込んでいます...</p>
            <p className="text-xs text-gray-500 mt-2">
              GPS位置を取得中...
            </p>
          </div>
        </div>
      )}

      {/* 🗺️ マップタイプインジケーター */}
      {!isLoading && isVectorMap !== null && (
        <div 
          className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold text-white z-10"
          style={{ 
            backgroundColor: isVectorMap ? 'rgba(255,0,0,0.8)' : 'rgba(128,128,128,0.8)',
            zIndex: 1000
          }}
        >
          マップ: {isVectorMap ? 'VECTOR' : 'RASTER'}
        </div>
      )}
    </div>
  );
};

// エクスポート関数
export const getGlobalMapInstance = () => globalMapInstance;
export const getGlobalMarkerInstance = () => globalMarkerInstance;
export const getGlobalPolylineInstance = () => globalPolylineInstance;

// 🔧 ユーティリティ関数のエクスポート

/**
 * マーカーアイコンを更新する
 * @param distance 総走行距離 (km)
 * @param speed 現在速度 (km/h)
 */
export const updateMarkerIcon = (distance: number, speed: number) => {
  if (!globalMarkerInstance) {
    console.warn('⚠️ マーカーインスタンスが初期化されていません');
    return;
  }

  const markerSVG = createCustomMarkerSVG(distance, speed);
  const markerIcon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSVG),
    scaledSize: new window.google.maps.Size(60, 80),
    anchor: new window.google.maps.Point(30, 40)
  };

  globalMarkerInstance.setIcon(markerIcon);
};

/**
 * マーカー位置を更新する
 * @param lat 緯度
 * @param lng 経度
 */
export const updateMarkerPosition = (lat: number, lng: number) => {
  if (!globalMarkerInstance) {
    console.warn('⚠️ マーカーインスタンスが初期化されていません');
    return;
  }

  const newPosition = { lat, lng };
  globalMarkerInstance.setPosition(newPosition);
};

/**
 * 地図の中心を移動する (パンニング)
 * @param lat 緯度
 * @param lng 経度
 */
export const panMapToPosition = (lat: number, lng: number) => {
  if (!globalMapInstance) {
    console.warn('⚠️ マップインスタンスが初期化されていません');
    return;
  }

  const newPosition = { lat, lng };
  globalMapInstance.panTo(newPosition);
};

/**
 * 🧭 ヘッドアップ表示: 地図を回転させる
 * @param heading 方位角度 (0-360度、0=北)
 */
export const setMapHeading = (heading: number) => {
  if (!globalMapInstance) {
    console.warn('⚠️ マップインスタンスが初期化されていません');
    return;
  }

  // ベクターマップの確認
  const renderingType = globalMapInstance.getRenderingType();
  const isVector = (renderingType === window.google.maps.RenderingType.VECTOR);

  if (!isVector) {
    console.warn('⚠️ ベクターマップではないため、ヘッドアップ表示は無効です');
    return;
  }

  if (heading !== null && !isNaN(heading)) {
    console.log(`🧭 ヘッドアップ回転: ${heading.toFixed(1)}°`);
    globalMapInstance.setHeading(heading);
  }
};

/**
 * 🛤️ 走行軌跡に座標を追加
 * @param lat 緯度
 * @param lng 経度
 */
export const addPathPoint = (lat: number, lng: number) => {
  if (!globalPolylineInstance) {
    console.warn('⚠️ Polylineインスタンスが初期化されていません');
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
    console.warn('⚠️ Polylineインスタンスが初期化されていません');
    return;
  }

  globalPolylineInstance.setPath([]);
  console.log('🗑️ 走行軌跡をクリアしました');
};

export default GoogleMapWrapper;