// frontend/cms/src/components/OperationsMapView.tsx
// 運行記録「マップ表示」タブ本体
// 積込・積下場所をGoogle Maps上にピン表示し、ピンクリックで実績回数を表示する。
// 「詳細」ボタン押下で一覧表示タブへ場所名で絞り込みジャンプする（onJumpToList経由）。
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../utils/api';

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const loadGoogleMapsScript = (callback: () => void): void => {
  if (window.google && window.google.maps) { callback(); return; }
  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    if (window.google && window.google.maps) callback();
    else existingScript.addEventListener('load', callback);
    return;
  }
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    console.warn('[OperationsMapView] Google Maps APIキーが未設定');
    return;
  }
  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker,places&language=ja&region=JP`;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  script.onerror = () => console.error('[OperationsMapView] Google Maps API読み込み失敗');
  document.head.appendChild(script);
};

interface LocationMapSummary {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  locationType: string;
  customerName: string | null;
  operationCount: number;
  lastUsedAt: string | null;
}

interface OperationsMapViewProps {
  /** 「詳細」ボタン押下時: 一覧表示タブへ切替＋場所名で絞り込み */
  onJumpToList: (locationName: string) => void;
}

const PERIOD_OPTIONS = [
  { value: 'ALL', label: '全期間' },
  { value: '30', label: '直近30日' },
  { value: '90', label: '直近90日' },
  { value: 'FY', label: '今年度' }
];

const formatLastUsed = (iso: string | null): string => {
  if (!iso) return '利用実績なし';
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (diffDays <= 0) return `${dateStr}（本日）`;
  return `${dateStr}（${diffDays}日前）`;
};

const buildDateRange = (period: string): { dateFrom?: string; dateTo?: string } => {
  if (period === 'ALL') return {};
  const now = new Date();
  if (period === 'FY') {
    // 4月始まりの年度
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const from = new Date(fyStartYear, 3, 1);
    return { dateFrom: from.toISOString().slice(0, 10) };
  }
  const days = parseInt(period, 10);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { dateFrom: from.toISOString().slice(0, 10) };
};

const OperationsMapView: React.FC<OperationsMapViewProps> = ({ onJumpToList }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [locations, setLocations] = useState<LocationMapSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PICKUP' | 'DELIVERY'>('ALL');
  const [period, setPeriod] = useState('ALL');

  // ---- Google Maps スクリプト読み込み ----
  useEffect(() => {
    loadGoogleMapsScript(() => setMapsLoaded(true));
  }, []);

  // ---- データ取得 ----
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { dateFrom, dateTo } = buildDateRange(period);
      const params: Record<string, string> = {};
      if (searchText.trim()) params.search = searchText.trim();
      if (typeFilter !== 'ALL') params.locationType = typeFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await apiClient.get('/locations/map-summary', { params });
      if (response.success && response.data) {
        const data: any = response.data;
        const list: LocationMapSummary[] = Array.isArray(data) ? data : (data.data || []);
        setLocations(list);
      } else {
        setLocations([]);
      }
    } catch (err) {
      console.error('[OperationsMapView] サマリー取得エラー:', err);
      setError('場所データの取得に失敗しました');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, period]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // ---- 地図初期化 ----
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 34.6937, lng: 135.5023 }, // デフォルト: 大阪近辺
      zoom: 10,
      mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
  }, [mapsLoaded]);

  // ---- ピン描画 ----
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current) return;

    // 既存マーカーを削除
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];

    const withCoords = locations.filter(l => l.latitude != null && l.longitude != null);
    if (withCoords.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    withCoords.forEach(loc => {
      const color = loc.locationType === 'DELIVERY' ? '#dc2626' : '#2563eb';
      const pinSvg = {
        path: 'M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z',
        fillColor: color,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 1.2,
        scale: 1,
        anchor: new window.google.maps.Point(13, 34)
      };

      const marker = new window.google.maps.Marker({
        position: { lat: loc.latitude as number, lng: loc.longitude as number },
        map: mapInstanceRef.current,
        title: loc.name,
        icon: pinSvg
      });

      marker.addListener('click', () => {
        const typeLabel = loc.locationType === 'DELIVERY' ? '積下場所' : '積込場所';
        const typeBg = loc.locationType === 'DELIVERY' ? '#fee2e2' : '#dbeafe';
        const typeColor = loc.locationType === 'DELIVERY' ? '#b91c1c' : '#1d4ed8';

        const content = document.createElement('div');
        content.style.minWidth = '230px';
        content.style.fontFamily = "'Noto Sans JP', sans-serif";
        content.innerHTML = `
          <div style="font-size:14px;font-weight:800;color:#1e293b;margin-bottom:4px;">${loc.name}</div>
          <span style="display:inline-block;background:${typeBg};color:${typeColor};font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:99px;margin-bottom:8px;">${typeLabel}</span>
          ${loc.customerName ? `<div style="font-size:11.5px;color:#64748b;margin-bottom:6px;">客先: ${loc.customerName}</div>` : ''}
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">
            <span style="font-size:22px;font-weight:900;color:#166534;">${loc.operationCount}</span>
            <span style="font-size:11.5px;color:#64748b;font-weight:600;">回の実績</span>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;line-height:1.6;">
            📍 ${loc.address}<br/>
            🕐 最終利用: ${formatLastUsed(loc.lastUsedAt)}
          </div>
          <button id="jump-btn-${loc.id}" style="width:100%;background:#1e293b;color:white;border:none;border-radius:6px;padding:7px 0;font-size:12.5px;font-weight:700;cursor:pointer;">
            📋 詳細（運行記録に絞り込み）
          </button>
        `;

        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(mapInstanceRef.current, marker);

        // ボタンのイベントは DOM 挿入後に紐付ける
        window.google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
          const btn = document.getElementById(`jump-btn-${loc.id}`);
          if (btn) {
            btn.addEventListener('click', () => onJumpToList(loc.name));
          }
        });
      });

      markersRef.current.push(marker);
      bounds.extend(marker.getPosition());
    });

    if (withCoords.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, 60);
    } else if (withCoords.length === 1) {
      mapInstanceRef.current.setCenter(bounds.getCenter());
      mapInstanceRef.current.setZoom(14);
    }
  }, [locations, mapsLoaded, onJumpToList]);

  // ---- 実績ランキング（上位10件） ----
  const ranking = [...locations]
    .filter(l => l.operationCount > 0)
    .sort((a, b) => b.operationCount - a.operationCount)
    .slice(0, 10);

  const handlePanTo = (loc: LocationMapSummary) => {
    if (!mapInstanceRef.current || loc.latitude == null || loc.longitude == null) return;
    mapInstanceRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
    mapInstanceRef.current.setZoom(15);
    const marker = markersRef.current.find(
      m => m.getPosition().lat() === loc.latitude && m.getPosition().lng() === loc.longitude
    );
    if (marker) {
      window.google.maps.event.trigger(marker, 'click');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-b-lg rounded-tr-lg p-4">
      {/* 検索・フィルターエリア */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">🔍 場所・客先名で検索</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="場所名・客先名を入力..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">場所種別</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'PICKUP' | 'DELIVERY')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="ALL">すべて（積込・積下）</option>
              <option value="PICKUP">積込のみ</option>
              <option value="DELIVERY">積下のみ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">実績集計期間</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchSummary}
            className="bg-gray-900 text-white rounded-md px-4 py-2 text-sm font-semibold"
          >
            検索
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* 地図エリア */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-bold text-gray-800">
              📍 場所ピン表示（{locations.length}件{loading ? ' / 読込中...' : ''}）
            </div>
          </div>
          <div ref={mapRef} style={{ width: '100%', height: '560px', borderRadius: '10px', background: '#e2e8f0' }} />
        </div>

        {/* 実績ランキングパネル */}
        <div>
          <div className="text-sm font-bold text-gray-800 mb-2">📊 実績回数ランキング</div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            {ranking.length === 0 ? (
              <div className="text-xs text-gray-400 p-4 text-center">実績データがありません</div>
            ) : (
              ranking.map((loc, idx) => (
                <div
                  key={loc.id}
                  onClick={() => handlePanTo(loc)}
                  className={`flex justify-between items-center px-3 py-2.5 cursor-pointer hover:bg-blue-50 ${idx !== ranking.length - 1 ? 'border-b border-gray-200' : ''}`}
                >
                  <div>
                    <div className="text-xs font-bold text-gray-800">{loc.name}</div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: loc.locationType === 'DELIVERY' ? '#fee2e2' : '#dbeafe',
                        color: loc.locationType === 'DELIVERY' ? '#b91c1c' : '#1d4ed8'
                      }}
                    >
                      {loc.locationType === 'DELIVERY' ? '積下' : '積込'}
                    </span>
                  </div>
                  <div className="text-base font-extrabold text-green-700">
                    {loc.operationCount}<span className="text-[10px] text-gray-400 font-semibold">回</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
            💡 ランキングは現在の検索・フィルター条件と連動します
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsMapView;
