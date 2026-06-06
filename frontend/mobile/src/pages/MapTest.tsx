// frontend/mobile/src/pages/MapTest.tsx
// 🧪 マップローテーションテスト（旧バージョン8bb68d4 完全再現）
// アクセス: https://dumptracker-s.ddns.net/map-test（認証不要）
// 必ず直接URLでアクセス（他ページ経由だとgoogle-maps-scriptが先にロードされ旧版環境にならない）

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
  const [headingVal, setHeadingVal] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const mapRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  const addLog = (msg: string) => {
    const t = new Date().toLocaleTimeString('ja-JP');
    setLogs(prev => [`[${t}] ${msg}`, ...prev].slice(0, 20));
  };

  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) { setStatus('❌ APIキー未設定'); return; }

    const initializeMap = () => {
      if (!mapContainerRef.current) return;
      if (!window.google?.maps?.Map) { setStatus('❌ Google Maps API未ロード'); return; }

      try {
        addLog('マップ初期化開始');

        // ===== 旧バージョン(8bb68d4) mapOptions 完全再現 =====
        const mapOptions: any = {
          center: { lat: 34.6937, lng: 135.5023 },
          zoom: 18,
          renderingType: window.google.maps.RenderingType.VECTOR, // オプションチェーンなし
          mapId: 'DEMO_MAP_ID',                                    // DEMO_MAP_ID固定
          heading: 0,
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          tiltInteractionEnabled: true,                            // 旧版はtrue
          headingInteractionEnabled: true,                         // 旧版はtrue
        };

        const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
        mapRef.current = map;
        addLog('Map作成成功');

        // ===== 旧バージョン マーカー: 旧Marker固定（AdvancedMarkerElement不使用） =====
        const createSVG = (h: number) => {
          const svgStr = `<svg width="60" height="80" xmlns="http://www.w3.org/2000/svg">
            <defs><g id="am">
              <circle cx="30" cy="30" r="24" fill="rgba(0,0,0,0.3)"/>
              <circle cx="30" cy="28" r="22" fill="#4285F4" stroke="#fff" stroke-width="3"/>
              <path d="M 30 13 L 38 25 L 22 25 Z" fill="#fff" stroke="#1a73e8" stroke-width="1.5"/>
              <circle cx="30" cy="28" r="4" fill="#fff"/>
            </g></defs>
            <use href="#am" transform="rotate(${h} 30 28)"/>
            <rect x="8" y="52" width="44" height="24" rx="4" fill="#fff" stroke="#4285F4" stroke-width="2"/>
            <text x="30" y="65" text-anchor="middle" font-family="Arial" font-size="9" font-weight="bold" fill="#1a73e8">TEST</text>
          </svg>`;
          return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgStr),
            scaledSize: new window.google.maps.Size(60, 80),
            anchor: new window.google.maps.Point(30, 40),
          };
        };

        const marker = new window.google.maps.Marker({
          map,
          position: { lat: 34.6937, lng: 135.5023 },
          title: 'テストマーカー',
          icon: createSVG(0),
          zIndex: 1000,
        });

        // renderingtype_changed 監視
        map.addListener('renderingtype_changed', () => {
          const rt = map.getRenderingType();
          const rtStr = String(rt);
          const isVec = rtStr === 'VECTOR';
          setRenderingType(`${rtStr} ${isVec ? '✅' : '❌'}`);
          setStatus(isVec ? '✅ VECTOR動作中 → 地図が回転するはず' : '❌ RASTERフォールバック → 地図回転不可');
          addLog(`renderingtype_changed: ${rtStr}`);
        });

        // 初期renderingType（2秒後確認）
        setTimeout(() => {
          const rt = map.getRenderingType?.();
          const rtStr = String(rt);
          const isVec = rtStr === 'VECTOR';
          setRenderingType(`${rtStr} ${isVec ? '✅' : '❌'}`);
          setStatus(isVec ? '✅ VECTOR動作中 → 地図が回転するはず' : '❌ RASTERフォールバック → 地図回転不可');
          addLog(`[MAP_INIT] renderingType=${rtStr} mapId=DEMO_MAP_ID`);
        }, 1000);

        // heading自動回転テスト（旧版のsetMapHeadingロジックを再現）
        let h = 0;
        intervalRef.current = setInterval(() => {
          h = (h + 3) % 360;
          setHeadingVal(h);
          const rt = map.getRenderingType?.();
          const isVec = String(rt) === 'VECTOR';
          if (isVec) {
            try { map.setHeading(h); } catch (_) {}
          }
          marker.setIcon(createSVG(h));
        }, 100);

        addLog('heading自動回転テスト開始');
        setStatus('マップ初期化完了 - heading回転テスト中...');

      } catch (e: any) {
        setStatus(`❌ 初期化エラー: ${e?.message}`);
        addLog(`ERROR: ${e?.message}`);
      }
    };

    // 既存google-maps-scriptチェック（他ページ経由でロード済みの場合）
    if (window.google?.maps?.Map) {
      addLog('⚠️ 既存google-maps-scriptを使用（旧版環境ではない可能性あり）');
      initializeMap();
      return;
    }

    const existing = document.getElementById('google-maps-script') ||
                     document.getElementById('google-maps-script-test');
    if (existing) {
      existing.addEventListener('load', initializeMap);
      return;
    }

    // ===== 旧バージョン script.src 完全再現 =====
    // libraries=marker なし、map_ids なし → &v=weekly のみ
    window.initMapTest = initializeMap;
    const script = document.createElement('script');
    script.id = 'google-maps-script-test';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMapTest&v=weekly`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    addLog(`script.src: ...&callback=initMapTest&v=weekly (libraries=marker なし)`);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.88)', color: '#fff',
        padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 3, fontSize: '13px' }}>
          🧪 旧版(8bb68d4)完全再現テスト
        </div>
        <div>状態: <span style={{ color: status.includes('✅') ? '#4ade80' : '#f87171' }}>{status}</span></div>
        <div>renderingType: <span style={{ color: renderingType.includes('✅') ? '#4ade80' : '#fbbf24' }}>{renderingType}</span></div>
        <div>heading: <span style={{ color: '#60a5fa' }}>{headingVal}°</span></div>
        <div style={{ marginTop: 4, borderTop: '1px solid #333', paddingTop: 4, maxHeight: '80px', overflow: 'hidden' }}>
          {logs.slice(0, 5).map((l, i) => (
            <div key={i} style={{ fontSize: '10px', color: '#9ca3af' }}>{l}</div>
          ))}
        </div>
      </div>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default MapTest;
