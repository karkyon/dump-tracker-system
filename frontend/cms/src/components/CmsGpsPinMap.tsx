// frontend/cms/src/components/CmsGpsPinMap.tsx
// OperationDetailDialog.tsx から分割: GPS地点ピン調整マップ

import React, { useRef } from 'react';

interface CmsGpsPinMapProps {
  lat?: number;
  lng?: number;
  onPinMoved: (lat: number, lng: number) => void;
}

const CmsGpsPinMap: React.FC<CmsGpsPinMapProps> = ({ lat, lng, onPinMoved }) => {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInst    = useRef<any>(null);
  const markerInst = useRef<any>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const fullRef = useRef<HTMLDivElement>(null);
  const fullMap = useRef<any>(null);

  const centerLat = lat ?? 34.6937;
  const centerLng = lng ?? 135.5023;

  const markerIsAdvancedRef = useRef(false);

  const initMap = React.useCallback((container: HTMLDivElement, existingMarker?: any) => {
    if (!(window as any).google?.maps) return null;
    const g = (window as any).google.maps;
    // ✅ 修正【根本原因】: mapIdは常に設定する（環境変数 → サンプルIDフォールバック）。
    // 他の正常動作しているマップ（GPS軌跡表示）と同じ方式に統一する。
    // mapId未設定のままAdvancedMarkerElementを生成すると、Google Maps側が
    // 「このページではGoogleマップが正しく読み込まれませんでした」エラーを表示する。
    const resolvedMapId = (import.meta as any).env?.VITE_GOOGLE_MAP_ID || '90f87356969d889c';
    const map = new g.Map(container, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 17, disableDefaultUI: true, zoomControl: true,
      mapId: resolvedMapId,
    });
    // ✅ 修正【根本原因】: AdvancedMarkerElementが利用できない場合はレガシーMarkerへ
    // フォールバックする（GPS軌跡表示マップと同じ防御的パターン）。
    const isAdvanced = !!(g as any).marker?.AdvancedMarkerElement;
    markerIsAdvancedRef.current = isAdvanced;
    const pos = existingMarker
      ? (isAdvanced ? existingMarker.position : existingMarker.getPosition())
      : { lat: centerLat, lng: centerLng };
    let marker: any;
    if (isAdvanced) {
      // BUG-011: AdvancedMarkerElement 移行
      const pinCmsEl = document.createElement('div');
      pinCmsEl.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;cursor:move;box-shadow:0 2px 6px rgba(0,0,0,.4);';
      marker = new (g as any).marker.AdvancedMarkerElement({
        position: pos, map, title: 'ドラッグで位置調整',
        content: pinCmsEl, gmpDraggable: true,
      });
    } else {
      // フォールバック: 旧 google.maps.Marker（mapId不要）
      marker = new g.Marker({
        position: pos, map, title: 'ドラッグで位置調整', draggable: true,
      });
    }
    const move = (e: any) => {
      const p = e.latLng ?? (isAdvanced ? marker.position : marker.getPosition());
      if (p) onPinMoved(typeof p.lat==='function'?p.lat():p.lat, typeof p.lng==='function'?p.lng():p.lng);
    };
    marker.addListener('dragend', move);
    map.addListener('click', (e: any) => {
      if (isAdvanced) { marker.position = e.latLng; } else { marker.setPosition(e.latLng); }
      onPinMoved(e.latLng.lat(), e.latLng.lng());
    });
    return { map, marker };
  }, [centerLat, centerLng, onPinMoved]);

  React.useEffect(() => {
    if (mapInst.current && markerInst.current && lat != null && lng != null) {
      const pos = { lat, lng };
      mapInst.current.panTo(pos);
      // ✅ 修正: AdvancedMarkerElementはpositionプロパティ、旧Markerはsetposition()で更新
      if (markerIsAdvancedRef.current) { markerInst.current.position = pos; }
      else { markerInst.current.setPosition(pos); }
      onPinMoved(lat, lng);
    } else if (!mapInst.current && lat != null && lng != null && (window as any).google?.maps) {
      // ✅ FIX-GPSPIN-CMS: mapInstが未初期化かつlat/lngが後から確定した場合に再初期化
      if (mapRef.current) {
        const r = initMap(mapRef.current);
        if (r) { mapInst.current = r.map; markerInst.current = r.marker; setLoaded(true); }
      }
    }
  }, [lat, lng, initMap]);

  React.useEffect(() => {
    const tryInit = () => {
      if ((window as any).google?.maps) {
        if (mapRef.current && !mapInst.current) {
          const r = initMap(mapRef.current);
          if (r) { mapInst.current = r.map; markerInst.current = r.marker; setLoaded(true); }
        }
        return;
      }
      // ✅ Fix③: google-maps-scriptが既にある場合は再利用、なければ新規作成
      if (!document.getElementById('google-maps-script')) {
        const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
        const s = document.createElement('script');
        s.id = 'google-maps-script';
        s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,places&loading=async&callback=__cmsMapsReady`;
        s.async = true;
        (window as any).__cmsMapsReady = () => {
          if (mapRef.current && !mapInst.current) {
            const r = initMap(mapRef.current);
            if (r) { mapInst.current = r.map; markerInst.current = r.marker; setLoaded(true); }
          }
        };
        document.head.appendChild(s);
      }
    };
    tryInit();
  }, [initMap]);

  React.useEffect(() => {
    if (fullscreen && fullRef.current && !fullMap.current && (window as any).google?.maps) {
      setTimeout(() => {
        if (!fullRef.current) return;
        const r = initMap(fullRef.current, markerInst.current);
        if (r) { fullMap.current = r.map; }
      }, 100);
    }
    if (!fullscreen && fullMap.current) fullMap.current = null;
  }, [fullscreen, initMap]);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500">
            場所ピン調整 <span className="text-gray-400 font-normal">— ドラッグで微調整</span>
          </span>
          <button type="button" onClick={() => setFullscreen(true)}
            className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50">
            拡大 ⛶
          </button>
        </div>
        <div ref={mapRef} className="w-full rounded-lg border border-gray-200 overflow-hidden"
          style={{ height: 120, background: '#e5e7eb' }} />
        {!loaded && <p className="text-xs text-gray-400 text-center mt-1">地図を読み込み中...</p>}
        {loaded  && <p className="text-xs text-gray-400 text-center mt-1">📍 ピンをドラッグ または タップで位置を設定</p>}
      </div>
      {fullscreen && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-2 bg-blue-700 text-white flex-shrink-0">
            <span className="font-medium">📍 場所ピン調整</span>
            <button onClick={() => setFullscreen(false)} className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm">✕ 閉じる</button>
          </div>
          <div ref={fullRef} className="flex-1" />
          <div className="bg-gray-900 text-gray-400 text-xs text-center py-2">ピンをドラッグまたは地図をタップして位置を調整</div>
        </div>
      )}
    </>
  );
};


// =====================================================================
// ✅ CmsActivityEditModal
// CMSタイムラインからイベントを編集するモーダル（mobile ActivityEditSheet相当）
// =====================================================================


export default CmsGpsPinMap;
