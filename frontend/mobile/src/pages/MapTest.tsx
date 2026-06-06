// frontend/mobile/src/pages/MapTest.tsx
// 🧪 マップローテーションテスト用ページ（認証不要）
// 旧バージョン(commit 8bb68d4)のGoogleMapWrapper実装を再現
// 現行コードには一切影響なし
// アクセスURL: https://dumptracker-s.ddns.net/map-test

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google: any;
    initMapTest?: () => void;
  }
}

const MapTest: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('読み込み中...');
  const [renderingType, setRenderingType] = useState('不明');
  const [heading, setHeadingState] = useState(0);
  const mapRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      setStatus('❌ APIキー未設定');
      return;
    }

    const initializeMap = () => {
      if (!mapContainerRef.current) return;
      if (!window.google?.maps?.Map) {
        setStatus('❌ Google Maps API 未ロード');
        return;
      }

      try {
        // ===== 旧バージョン(8bb68d4)そのままの実装 =====
        const mapOptions: any = {
          center: { lat: 34.6937, lng: 135.5023 },
          zoom: 18,
          mapId: 'DEMO_MAP_ID',
          renderingType: window.google.maps.RenderingType.VECTOR,
          heading: 0,
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        };

        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        mapRef.current = map;

        // SVG矢印マーカー（旧版スタイル）
        const createSVG = (h: number) => `
          <svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="24" fill="rgba(0,0,0,0.3)"/>
            <circle cx="30" cy="30" r="22" fill="#4285F4" stroke="#fff" stroke-width="3"/>
            <path d="M 30 12 L 38 26 L 22 26 Z" fill="#fff" stroke="#1a73e8" stroke-width="1.5"
              transform="rotate(${h} 30 30)"/>
          </svg>`;

        const markerDiv = document.createElement('div');
        markerDiv.innerHTML = createSVG(0);
        markerDiv.style.cssText = 'width:60px;height:60px;cursor:pointer;';

        let marker: any;
        if (window.google.maps.marker?.AdvancedMarkerElement) {
          marker = new window.google.maps.marker.AdvancedMarkerElement({
            map,
            position: { lat: 34.6937, lng: 135.5023 },
            title: 'テストマーカー',
            content: markerDiv,
          });
        } else {
          marker = new window.google.maps.Marker({
            map,
            position: { lat: 34.6937, lng: 135.5023 },
            title: 'テストマーカー',
          });
        }

        // renderingtype_changed 監視
        map.addListener('renderingtype_changed', () => {
          const rt = map.getRenderingType();
          const isVec = String(rt) === 'VECTOR';
          setRenderingType(`${String(rt)} ${isVec ? '✅' : '❌'}`);
          setStatus(isVec ? '✅ VECTOR動作中' : '❌ RASTERにフォールバック');
        });

        // 初期renderingType確認
        setTimeout(() => {
          const rt = map.getRenderingType?.();
          const isVec = String(rt) === 'VECTOR';
          setRenderingType(`${String(rt)} ${isVec ? '✅' : '❌'}`);
          setStatus(isVec ? '✅ VECTOR動作中' : '❌ RASTERにフォールバック（Rasterではheading回転不可）');
        }, 1000);

        // 自動でheadingを0→360°回転させてテスト
        let h = 0;
        intervalRef.current = setInterval(() => {
          h = (h + 5) % 360;
          setHeadingState(h);
          try {
            map.setHeading(h);
            // マーカーSVGも更新
            if (marker.content) {
              marker.content.innerHTML = createSVG(h);
            }
          } catch (e) {
            // RasterではsetHeadingは無効（エラーなし）
          }
        }, 100);

        setStatus('マップ初期化完了 - heading回転テスト中...');
      } catch (e: any) {
        setStatus(`❌ 初期化エラー: ${e?.message}`);
      }
    };

    // 既存スクリプトチェック（現行コードのgoogle-maps-scriptと共存）
    if (window.google?.maps?.Map) {
      initializeMap();
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', initializeMap);
      // 既にロード済みの場合
      if (window.google?.maps?.Map) initializeMap();
      return;
    }

    // 専用スクリプトを追加（IDを別にして現行と衝突しない）
    window.initMapTest = initializeMap;
    const script = document.createElement('script');
    script.id = 'google-maps-script-test';
    const mapId = (import.meta as any).env?.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMapTest&libraries=marker&v=weekly&map_ids=${mapId}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#1a1a2e' }}>
      {/* ステータス表示 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '12px 16px',
        fontFamily: 'monospace', fontSize: '13px',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>🗺️ マップローテーションテスト（旧バージョン実装）</div>
        <div>状態: <span style={{ color: status.includes('✅') ? '#4ade80' : '#f87171' }}>{status}</span></div>
        <div>renderingType: <span style={{ color: renderingType.includes('✅') ? '#4ade80' : '#fbbf24' }}>{renderingType}</span></div>
        <div>heading: <span style={{ color: '#60a5fa' }}>{heading}°</span></div>
        <div style={{ marginTop: 4, fontSize: '11px', color: '#9ca3af' }}>
          ✅ VECTORなら地図が自動回転します | ❌ RASTERなら地図は回転しません（マーカー矢印のみ回転）
        </div>
      </div>
      {/* マップコンテナ */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default MapTest;
