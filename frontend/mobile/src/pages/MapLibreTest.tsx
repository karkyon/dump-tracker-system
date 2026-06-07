// frontend/mobile/src/pages/MapLibreTest.tsx
// 🧪 MapLibre GL JS テスト（認証不要）
// URL: https://dumptracker-s.ddns.net/map-libre
// CDN経由でMapLibre GL JSをロード（npmインストール不要）
// iOS SafariでもWebGL Vector Mapが動作するか確認

import React, { useEffect, useRef, useState } from 'react';

const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const MAPLIBRE_JS  = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';

const MapLibreTest: React.FC = () => {
  const mapRef   = useRef<HTMLDivElement>(null);
  const [status, setStatus]   = useState('読み込み中...');
  const [heading, setHeading] = useState(0);
  const [logs, setLogs]       = useState<string[]>([]);
  const mapInstanceRef = useRef<any>(null);
  const itvRef = useRef<any>(null);

  const addLog = (m: string) => {
    const t = new Date().toLocaleTimeString('ja-JP');
    setLogs(p => [`[${t}] ${m}`, ...p].slice(0, 12));
  };

  useEffect(() => {
    // WebGL確認
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
      addLog(`WebGL: ${gl ? '✅ 利用可能' : '❌ 利用不可'}`);
    } catch { addLog('WebGL: ❌ エラー'); }

    // CSSロード
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);

    // MapLibre JS CDNロード
    if ((window as any).maplibregl) {
      addLog('✅ MapLibre 既ロード済み');
      initMap();
      return;
    }
    const script = document.createElement('script');
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.onload = () => { addLog('✅ MapLibre CDNロード完了'); initMap(); };
    script.onerror = () => { setStatus('❌ MapLibre CDNロード失敗'); addLog('ERROR: CDN失敗'); };
    document.head.appendChild(script);
    addLog('MapLibre GL JS CDNロード中...');

    return () => { if (itvRef.current) clearInterval(itvRef.current); };
  }, []);

  const initMap = () => {
    const ml = (window as any).maplibregl;
    if (!ml || !mapRef.current) { setStatus('❌ 初期化失敗'); return; }

    try {
      addLog('MapLibreマップ初期化開始');

      // MapLibreはOpenStreetMapなどのフリータイルを使用（APIキー不要）
      const map = new ml.Map({
        container: mapRef.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [135.5023, 34.6937], // 大阪
        zoom: 14,
        bearing: 0,   // heading相当
        pitch: 0,
        attributionControl: false,
      });
      mapInstanceRef.current = map;

      map.on('load', () => {
        addLog('✅ MapLibreマップロード完了');
        setStatus('✅ MapLibre動作中 → heading回転テスト中');

        // 現在位置マーカー追加
        const el = document.createElement('div');
        el.innerHTML = `<div style="
          width:40px; height:40px; border-radius:50%;
          background:#4285F4; border:3px solid #fff;
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);">
          <div style="width:0;height:0;
            border-left:8px solid transparent;
            border-right:8px solid transparent;
            border-bottom:16px solid #fff;
            margin-bottom:4px;"></div>
        </div>`;

        new ml.Marker({ element: el })
          .setLngLat([135.5023, 34.6937])
          .addTo(map);
        addLog('マーカー追加完了');

        // heading自動回転テスト（bearing = Google MapsのheadingのMapLibre版）
        let h = 0;
        itvRef.current = setInterval(() => {
          h = (h + 2) % 360;
          setHeading(h);
          map.setBearing(h); // ← これがheadingに相当
        }, 50);
        addLog('bearing(heading)自動回転開始');
      });

      map.on('error', (e: any) => {
        addLog(`ERROR: ${e?.error?.message || JSON.stringify(e)}`);
      });

    } catch(e: any) {
      setStatus(`❌ エラー: ${e?.message}`);
      addLog(`ERROR: ${e?.message}`);
    }
  };

  return (
    <div style={{width:'100vw', height:'100vh', position:'relative', background:'#111'}}>
      {/* ステータスパネル */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:1000,
        background:'rgba(0,0,0,0.88)', color:'#fff',
        padding:'8px 12px', fontFamily:'monospace', fontSize:'12px',
      }}>
        <div style={{fontWeight:'bold', marginBottom:2}}>
          🗺️ MapLibre GL JS テスト（CDN / APIキー不要）
        </div>
        <div>状態: <span style={{color: status.includes('✅') ? '#4ade80':'#f87171'}}>{status}</span></div>
        <div>bearing(heading): <span style={{color:'#60a5fa'}}>{heading}°</span>
          <span style={{marginLeft:6, fontSize:'10px', color:'#9ca3af'}}>
            ← 地図が回転していればVectorMapとして動作
          </span>
        </div>
        <div style={{marginTop:3, borderTop:'1px solid #333', paddingTop:3}}>
          {logs.map((l,i) => (
            <div key={i} style={{fontSize:'10px', color: i===0?'#e5e7eb':'#6b7280'}}>{l}</div>
          ))}
        </div>
      </div>
      {/* 比較リンク */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, zIndex:1000,
        background:'rgba(0,0,0,0.80)', padding:'6px 12px',
        display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center',
      }}>
        <span style={{color:'#9ca3af', fontSize:'11px'}}>比較:</span>
        <a href="/map-test" style={{color:'#fbbf24', fontSize:'11px', textDecoration:'underline'}}>
          Google Maps テスト
        </a>
        <span style={{color:'#6b7280', fontSize:'11px'}}>|</span>
        <span style={{color:'#9ca3af', fontSize:'11px'}}>
          MapLibreはOSMタイル使用（スタイルが異なる）
        </span>
      </div>
      {/* マップコンテナ */}
      <div ref={mapRef} style={{width:'100%', height:'100%'}} />
    </div>
  );
};

export default MapLibreTest;
