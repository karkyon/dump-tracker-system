// frontend/mobile/src/pages/MapTest.tsx
// 🧪 8bb68d4 完全再現テスト（認証不要）
// URL: https://dumptracker-s.ddns.net/map-test
// 必ず直接URLでアクセス（他ページ経由不可）
// script.src = &callback=initMapLegacy&v=weekly のみ（libraries=marker なし）

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google: any;
    initMapLegacy?: () => void;
  }
}

// ===== 8bb68d4 の createCustomMarkerSVG をそのまま移植 =====
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

const MapTest: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus]     = useState('読み込み中...');
  const [rtDisplay, setRtDisplay] = useState('不明');
  const [headingVal, setHeadingVal] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const intervalRef = useRef<any>(null);

  const addLog = (msg: string) => {
    const t = new Date().toLocaleTimeString('ja-JP');
    setLogs(prev => [`[${t}] ${msg}`, ...prev].slice(0, 8));
  };

  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) { setStatus('❌ APIキー未設定'); return; }

    // ===== 8bb68d4 の initializeMap をそのまま移植 =====

    const initializeMap = () => {
      if (!mapContainerRef.current) return;
      if (!window.google?.maps?.Map) {
        setStatus('❌ Google Maps API未ロード');
        return;
      }

      try {
        addLog('マップ初期化開始');

        // 8bb68d4 mapOptions そのまま
        const mapOptions: any = {
          center: { lat: 34.6937, lng: 135.5023 },
          zoom: 18,
          renderingType: window.google.maps.RenderingType.VECTOR,
          mapId: 'DEMO_MAP_ID',
          heading: 0,
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          tiltInteractionEnabled: true,
          headingInteractionEnabled: true,
        };

        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        addLog('Map作成成功');

        // 8bb68d4 マーカー: 旧Marker固定
        const markerSVG = createCustomMarkerSVG(0, 0, 0);
        const markerIcon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSVG),
          scaledSize: new window.google.maps.Size(60, 80),
          anchor: new window.google.maps.Point(30, 40),
        };
        const marker = new window.google.maps.Marker({
          map,
          position: { lat: 34.6937, lng: 135.5023 },
          title: '現在位置',
          icon: markerIcon,
          zIndex: 1000,
        });
        addLog('マーカー作成成功（旧Marker）');

        // 8bb68d4 renderingtype_changed
        map.addListener('renderingtype_changed', () => {
          const rt = map.getRenderingType();
          const isVec = (rt === window.google.maps.RenderingType.VECTOR);
          const rtStr = String(rt);
          setRtDisplay(`${rtStr} ${isVec ? '✅' : '❌'}`);
          setStatus(isVec ? '✅ VECTOR → 地図が回転するはず' : '❌ RASTER → 地図回転不可');
          addLog(`renderingtype_changed: ${rtStr}`);
        });

        // 初期renderingType確認（1秒後）
        setTimeout(() => {
          const rt = map.getRenderingType?.();
          const isVec = (rt === window.google.maps.RenderingType?.VECTOR);
          const rtStr = String(rt);
          setRtDisplay(`${rtStr} ${isVec ? '✅' : '❌'}`);
          setStatus(isVec ? '✅ VECTOR → 地図が回転するはず' : '❌ RASTER → 地図回転不可');
          addLog(`[MAP_INIT] renderingType=${rtStr} mapId=DEMO_MAP_ID`);
        }, 1000);

        // heading自動回転テスト
        let h = 0;
        intervalRef.current = setInterval(() => {
          h = (h + 3) % 360;
          setHeadingVal(h);

          // 8bb68d4 の setMapHeading ロジックそのまま
          const rt = map.getRenderingType?.();
          const isVec = (rt === window.google.maps.RenderingType?.VECTOR);
          if (isVec && !isNaN(h)) {
            map.setHeading(h);
          }
          // マーカー矢印更新
          const svg = createCustomMarkerSVG(0, 0, h);
          marker.setIcon({
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
            scaledSize: new window.google.maps.Size(60, 80),
            anchor: new window.google.maps.Point(30, 40),
          });
        }, 100);

        addLog('heading自動回転テスト開始');

      } catch (e: any) {
        setStatus(`❌ 初期化エラー: ${e?.message}`);
        addLog(`ERROR: ${e?.message}`);
      }
    };

    // 既存スクリプトチェック
    if (window.google?.maps?.Map) {
      addLog('⚠️ 既存API使用中（他ページ経由の可能性）');
      initializeMap();
      return;
    }
    if (document.getElementById('google-maps-script') ||
        document.getElementById('google-maps-script-legacy')) {
      addLog('⚠️ 既存scriptタグあり');
      const existing = document.getElementById('google-maps-script') ||
                       document.getElementById('google-maps-script-legacy');
      existing?.addEventListener('load', initializeMap);
      return;
    }

    // ===== 8bb68d4 の script.src そのまま: &callback=xxx&v=weekly のみ =====
    window.initMapLegacy = initializeMap;
    const script = document.createElement('script');
    script.id = 'google-maps-script-legacy';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMapLegacy&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setStatus('❌ スクリプトロードエラー');
      addLog('ERROR: script load failed');
    };
    document.head.appendChild(script);
    addLog(`script.src: ...&callback=initMapLegacy&v=weekly`);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#111' }}>
      {/* ステータスパネル */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.88)', color: '#fff',
        padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 2 }}>
          🔬 8bb68d4 完全再現テスト（libraries=markerなし / &v=weekly のみ）
        </div>
        <div>状態: <span style={{ color: status.includes('✅') ? '#4ade80' : '#f87171' }}>{status}</span></div>
        <div>renderingType: <span style={{ color: rtDisplay.includes('✅') ? '#4ade80' : '#fbbf24' }}>{rtDisplay}</span></div>
        <div>heading: <span style={{ color: '#60a5fa' }}>{headingVal}°</span>
          <span style={{ marginLeft: 8, fontSize: '10px', color: '#9ca3af' }}>
            {rtDisplay.includes('✅') ? '↑地図も回転中' : '↑マーカーのみ回転'}
          </span>
        </div>
        <div style={{ marginTop: 3, borderTop: '1px solid #333', paddingTop: 3 }}>
          {logs.map((l, i) => (
            <div key={i} style={{ fontSize: '10px', color: i === 0 ? '#e5e7eb' : '#6b7280' }}>{l}</div>
          ))}
        </div>
      </div>
      {/* マップ */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default MapTest;
