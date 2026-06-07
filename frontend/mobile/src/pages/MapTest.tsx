// frontend/mobile/src/pages/MapTest.tsx
// 🧪 VectorMap調査テスト（認証不要）
// ?mode=legacy   : 8bb68d4再現(DEMO_MAP_ID)
// ?mode=official : 自前APIキー+公式mapId(90f873...)  ← デフォルト
// ?mode=official2: 公式APIキー+公式mapId（公式サンプルと完全同条件）

import React, { useEffect, useRef, useState } from 'react';
declare global { interface Window { google: any; initMapTest?: () => void; } }

const createSVG = (h: number) => {
  const s = `<svg width="60" height="80" xmlns="http://www.w3.org/2000/svg">
    <defs><g id="am">
      <circle cx="30" cy="30" r="24" fill="rgba(0,0,0,0.3)"/>
      <circle cx="30" cy="28" r="22" fill="#4285F4" stroke="#fff" stroke-width="3"/>
      <path d="M 30 13 L 38 25 L 22 25 Z" fill="#fff" stroke="#1a73e8" stroke-width="1.5"/>
      <circle cx="30" cy="28" r="4" fill="#fff"/>
    </g></defs>
    <use href="#am" transform="rotate(${h} 30 28)"/>
    <rect x="8" y="52" width="44" height="18" rx="3" fill="#fff" stroke="#4285F4" stroke-width="1.5"/>
    <text x="30" y="64" text-anchor="middle" font-family="Arial" font-size="8" fill="#1a73e8">${h}°</text>
  </svg>`;
  return s;
};

const MapTest: React.FC = () => {
  const mapRef  = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('読み込み中...');
  const [rt, setRt]         = useState('不明');
  const [hval, setHval]     = useState(0);
  const [logs, setLogs]     = useState<string[]>([]);
  const itvRef = useRef<any>(null);

  const params   = new URLSearchParams(window.location.search);
  const mode     = params.get('mode') || 'official';
  const isLegacy = mode === 'legacy';
  const isOff2   = mode === 'official2';
  const isStatic = mode === 'static'; // index.htmlの静的scriptタグ使用

  const addLog = (m: string) => {
    const t = new Date().toLocaleTimeString('ja-JP');
    setLogs(p => [`[${t}] ${m}`, ...p].slice(0, 10));
  };

  useEffect(() => {
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
      addLog(`WebGL: ${gl ? '✅ 利用可能' : '❌ 利用不可'}`);
    } catch { addLog('WebGL: ❌ エラー'); }

    // APIキー選択
    const myKey     = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
    const officialKey = 'AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg';
    const apiKey    = isOff2 ? officialKey : myKey;

    if (!apiKey) { setStatus('❌ APIキー未設定'); return; }

    const modeLabel = isLegacy ? 'legacy(DEMO_MAP_ID)'
                    : isOff2   ? 'official2(公式Key+90f873...)'
                               : 'official(自前Key+90f873...)';
    addLog(`モード: ${modeLabel}`);

    const init = () => {
      if (!mapRef.current || !window.google?.maps?.Map) {
        setStatus('❌ API未ロード'); return;
      }
      try {
        // staticモード: index.htmlで静的ロード済みのAPIを使用（公式サンプルと同じ方式）
        const mapOptions: any = isLegacy
          ? { center:{lat:34.6937,lng:135.5023}, zoom:18,
              renderingType: window.google.maps.RenderingType.VECTOR,
              mapId:'DEMO_MAP_ID', heading:0, tilt:0,
              disableDefaultUI:true, zoomControl:true, gestureHandling:'greedy',
              tiltInteractionEnabled:true, headingInteractionEnabled:true }
          : { center:{lat:37.7893719,lng:-122.3942}, zoom:16,
              heading:320, tilt:47.5, mapId:'90f87356969d889c' };

        const map = new window.google.maps.Map(mapRef.current, mapOptions);
        addLog('Map作成成功');

        map.addListener('renderingtype_changed', () => {
          const r = map.getRenderingType();
          const v = String(r)==='VECTOR';
          setRt(`${String(r)} ${v?'✅':'❌'}`);
          setStatus(v ? '✅ VECTOR → 地図回転有効' : '❌ RASTER → 地図回転不可');
          addLog(`renderingtype_changed: ${String(r)}`);
        });
        setTimeout(() => {
          const r = map.getRenderingType?.();
          const v = String(r)==='VECTOR';
          setRt(`${String(r)} ${v?'✅':'❌'}`);
          setStatus(v ? '✅ VECTOR → 地図回転有効' : '❌ RASTER → 地図回転不可');
          addLog(`[MAP_INIT] renderingType=${String(r)}`);
        }, 1000);

        const marker = new window.google.maps.Marker({
          map, position: mapOptions.center, title:'TEST',
          icon:{ url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(createSVG(0)),
                 scaledSize:new window.google.maps.Size(60,80),
                 anchor:new window.google.maps.Point(30,40) },
          zIndex:1000,
        });
        let h = isLegacy ? 0 : 320;
        itvRef.current = setInterval(() => {
          h=(h+3)%360; setHval(h);
          if (String(map.getRenderingType?.())==='VECTOR') map.setHeading(h);
          marker.setIcon({ url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(createSVG(h)),
                           scaledSize:new window.google.maps.Size(60,80),
                           anchor:new window.google.maps.Point(30,40) });
        }, 100);
        addLog('heading自動回転開始');
      } catch(e:any) { setStatus(`❌ ${e?.message}`); addLog(`ERROR: ${e?.message}`); }
    };

    if (isStatic) {
      addLog('静的scriptタグ方式（index.html）でロード済み確認中...');
      // index.htmlのscriptタグは defer なので DOMContentLoaded後に利用可能
      if (window.google?.maps?.Map) {
        addLog('✅ 静的ロード済み API使用');
        init(); return;
      }
      // まだロード中の場合はgoogle-maps-script-staticのloadイベント待機
      const staticScript = document.getElementById('google-maps-script-static');
      if (staticScript) {
        staticScript.addEventListener('load', init);
        addLog('静的script loadイベント待機中...');
      } else {
        addLog('⚠️ google-maps-script-static が見つからない');
        init();
      }
      return;
    }
    if (window.google?.maps?.Map) { addLog('⚠️ 既存API使用'); init(); return; }
    const existing = document.getElementById('google-maps-script') ||
                     document.getElementById('google-maps-script-test');
    if (existing) { existing.addEventListener('load', init); return; }

    window.initMapTest = init;
    const s = document.createElement('script');
    s.id = 'google-maps-script-test';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMapTest&v=weekly`;
    s.async=true; s.defer=true;
    s.onerror = () => { setStatus('❌ scriptロードエラー'); addLog('ERROR: script失敗'); };
    document.head.appendChild(s);
    addLog(`script: &v=weekly (libraries=markerなし) key=${isOff2?'公式':'自前'}`);

    return () => { if (itvRef.current) clearInterval(itvRef.current); };
  }, []);

  const modeTitle = isLegacy ? '旧版(8bb68d4)再現' : isOff2 ? '公式Key+公式mapId（完全同条件）' : isStatic ? '静的scriptタグ方式(index.html)' : '自前Key+公式mapId';

  return (
    <div style={{width:'100vw',height:'100vh',position:'relative',background:'#111'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:1000,
        background:'rgba(0,0,0,0.88)',color:'#fff',padding:'8px 12px',fontFamily:'monospace',fontSize:'12px'}}>
        <div style={{fontWeight:'bold',marginBottom:2}}>🔬 {modeTitle}</div>
        <div>状態: <span style={{color:status.includes('✅')?'#4ade80':'#f87171'}}>{status}</span></div>
        <div>renderingType: <span style={{color:rt.includes('✅')?'#4ade80':'#fbbf24'}}>{rt}</span></div>
        <div>heading: <span style={{color:'#60a5fa'}}>{hval}°</span>
          <span style={{marginLeft:6,fontSize:'10px',color:'#9ca3af'}}>
            {rt.includes('✅')?'↑地図も回転中':'↑マーカーのみ回転'}
          </span>
        </div>
        <div style={{marginTop:3,borderTop:'1px solid #333',paddingTop:3}}>
          {logs.map((l,i)=>(
            <div key={i} style={{fontSize:'10px',color:i===0?'#e5e7eb':'#6b7280'}}>{l}</div>
          ))}
        </div>
      </div>
      <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:1000,
        background:'rgba(0,0,0,0.80)',padding:'6px 12px',display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
        {!isLegacy && <a href="/map-test?mode=legacy" style={{color:'#fbbf24',fontSize:'11px',textDecoration:'underline'}}>🔄 旧版(DEMO_MAP_ID)</a>}
        {isLegacy  && <a href="/map-test?mode=official" style={{color:'#fbbf24',fontSize:'11px',textDecoration:'underline'}}>🔄 自前Key+公式mapId</a>}
        <span style={{color:'#6b7280',fontSize:'11px'}}>|</span>
        <a href="/map-test?mode=official2" style={{color:'#a78bfa',fontSize:'11px',textDecoration:'underline'}}>🔑 公式Key+公式mapId</a>
        <span style={{color:'#6b7280',fontSize:'11px'}}>|</span>
        <a href="/map-test?mode=static" style={{color:'#34d399',fontSize:'11px',textDecoration:'underline'}}>📌 静的script方式</a>
        <span style={{color:'#6b7280',fontSize:'11px'}}>|</span>
        <a href="https://developers.google.com/maps/documentation/javascript/examples/webgl/webgl-tilt-rotation"
           target="_blank" rel="noreferrer" style={{color:'#60a5fa',fontSize:'11px',textDecoration:'underline'}}>
          📖 Google公式サンプル
        </a>
      </div>
      <div ref={mapRef} style={{width:'100%',height:'100%'}} />
    </div>
  );
};
export default MapTest;
