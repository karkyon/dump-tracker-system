// frontend/mobile/src/components/ActivityEditSheet.tsx
// ✅ 完全版 v2 - 複数品目選択 + 客先変更 + GPS Map全画面Modal + 削除機能
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import apiService from '../services/api';
import { useOperationStore } from '../stores/operationStore';

export interface ActivityRecord {
  id: string;
  activityType: string;
  locationName: string;
  locationId?: string;
  locationLat?: number;
  locationLng?: number;
  itemName?: string;
  itemId?: string;
  // ✅ 複数品目対応: 選択された全品目名・全品目ID
  itemNames?: string[];
  itemIds?: string[];
  // ✅ 手入力品目名
  customItemName?: string;
  quantity?: number;
  // ✅ 給油金額（円）
  fuelCostYen?: number;
  startTime: string | null;
  endTime: string | null;
  notes?: string;
  sequenceNumber: number;
  customerName?: string;
  customerId?: string;
  // ✅ 休憩専用: 休憩終了(BREAK_END)レコードのID。休憩開始(BREAK_START)側から編集する際、
  // ここにペアのIDを入れることで1画面から両レコードを同時編集できるようにする。
  pairId?: string;
}

// ✅ 登録場所（LoadingInputと同様の場所マスタ）
export interface EditLocationOption {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

interface ActivityEditSheetProps {
  activity: ActivityRecord | null;
  operationId: string;
  onClose: () => void;
  onSaved: (updatedActivity: ActivityRecord) => void;
  onDeleted?: (activityId: string) => void;
  customers: { id: string; name: string }[];
  // ✅ 区分グループ表示のため itemType/displayOrder を任意で受け付け
  items: { id: string; name: string; itemType?: string; displayOrder?: number }[];
}

// ── 時分ダイヤル ──
const TimeDial: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  accentColor: string;
}> = ({ label, value, onChange, accentColor }) => {
  const [open, setOpen] = useState(false);
  const [tempH, setTempH] = useState(0);
  const [tempM, setTempM] = useState(0);

  const parts = (value || '').split(':');
  const displayH = parts[0] || '--';
  const displayM = parts[1] || '--';

  const openDial = () => {
    const raw = (value || '00:00').split(':');
    const h = parseInt(raw[0] ?? '0', 10);
    const m = parseInt(raw[1] ?? '0', 10);
    setTempH(isNaN(h) ? 0 : h);
    setTempM(isNaN(m) ? 0 : m);
    setOpen(true);
  };

  const confirm = () => {
    onChange(`${String(tempH).padStart(2, '0')}:${String(tempM).padStart(2, '0')}`);
    setOpen(false);
  };

  const adjH = (d: number) => setTempH(h => (h + d + 24) % 24);
  const adjM = (d: number) => setTempM(m => (m + d + 60) % 60);

  return (
    <div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>{label}</div>
      <div onClick={openDial} style={{ background: '#f3f4f6', border: '0.5px solid #d1d5db', borderRadius: 7, padding: '7px 10px', fontSize: 14, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span>{displayH}:{displayM}</span>
        <span style={{ fontSize: 14, color: '#9ca3af' }}>🕐</span>
      </div>
      {open && (
        <div style={{ marginTop: 4, border: '0.5px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <div style={{ background: `linear-gradient(135deg, ${accentColor}dd 0%, ${accentColor} 100%)`, color: '#fff', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500 }}>{label}を設定</span>
            <span style={{ fontSize: 9, opacity: .8 }}>↑↓ タップで±1</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, padding: '6px 8px 4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 58 }}>
              <div onClick={() => adjH(1)} style={{ fontSize: 12, color: '#9ca3af', padding: '2px 0', textAlign: 'center', width: '100%', cursor: 'pointer', userSelect: 'none' }}>{String((tempH + 1) % 24).padStart(2, '0')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#111827', background: '#f3f4f6', borderRadius: 5, padding: '4px 0', width: '100%', textAlign: 'center', border: `1.5px solid ${accentColor}` }}>{String(tempH).padStart(2, '0')}</div>
              <div onClick={() => adjH(-1)} style={{ fontSize: 12, color: '#9ca3af', padding: '2px 0', textAlign: 'center', width: '100%', cursor: 'pointer', userSelect: 'none' }}>{String((tempH - 1 + 24) % 24).padStart(2, '0')}</div>
              <div style={{ fontSize: 9, color: '#6b7280', marginTop: 3 }}>時</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#6b7280', paddingBottom: 24 }}>:</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 58 }}>
              <div onClick={() => adjM(1)} style={{ fontSize: 12, color: '#9ca3af', padding: '2px 0', textAlign: 'center', width: '100%', cursor: 'pointer', userSelect: 'none' }}>{String((tempM + 1) % 60).padStart(2, '0')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#111827', background: '#f3f4f6', borderRadius: 5, padding: '4px 0', width: '100%', textAlign: 'center', border: `1.5px solid ${accentColor}` }}>{String(tempM).padStart(2, '0')}</div>
              <div onClick={() => adjM(-1)} style={{ fontSize: 12, color: '#9ca3af', padding: '2px 0', textAlign: 'center', width: '100%', cursor: 'pointer', userSelect: 'none' }}>{String((tempM - 1 + 60) % 60).padStart(2, '0')}</div>
              <div style={{ fontSize: 9, color: '#6b7280', marginTop: 3 }}>分</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', padding: '2px 0 4px' }}>上下の数字をタップで変更</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6, padding: '5px 8px 6px', borderTop: '0.5px solid #e5e7eb' }}>
            <div onClick={() => setOpen(false)} style={{ padding: 6, textAlign: 'center', background: '#f3f4f6', borderRadius: 6, fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>取消</div>
            <div onClick={confirm} style={{ padding: 6, textAlign: 'center', background: accentColor, borderRadius: 6, fontSize: 10, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>
              OK — {String(tempH).padStart(2, '0')}:{String(tempM).padStart(2, '0')} に設定
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── GPS ピン調整マップ（Google Maps API + 全画面Modal） ──
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
declare const google: any;

interface GpsPinMapProps {
  accentColor: string;
  initialLat?: number;
  initialLng?: number;
  onPinMoved: (lat: number, lng: number) => void;
}

const GpsPinMap: React.FC<GpsPinMapProps> = ({ accentColor, initialLat, initialLng, onPinMoved }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const fullMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const fullMapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const defaultLat = initialLat ?? 34.6937;
  const defaultLng = initialLng ?? 135.5023;

  const createMap = useCallback((container: HTMLDivElement, existingMarker?: any) => {
    try {
      const map = new google.maps.Map(container, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: 17,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });
      const pos = existingMarker ? existingMarker.getPosition() : { lat: defaultLat, lng: defaultLng };
      const pinEl = document.createElement('div');
      pinEl.style.cssText = `width:20px;height:20px;border-radius:50%;background:${accentColor};border:3px solid #fff;cursor:move;box-shadow:0 2px 6px rgba(0,0,0,.4);`;

      // mapId未設定時は AdvancedMarkerElement が使えないため旧Markerにフォールバック
      const hasMapId = !!(import.meta as any).env?.VITE_GOOGLE_MAP_ID;
      let marker: any;
      if (hasMapId && (google.maps as any).marker?.AdvancedMarkerElement) {
        marker = new (google.maps as any).marker.AdvancedMarkerElement({
          position: pos, map, title: 'ドラッグで位置調整',
          content: pinEl, gmpDraggable: true,
        });
        marker.addListener('dragend', (e: any) => {
          const p = e.latLng ?? marker.position;
          if (p) onPinMoved(typeof p.lat === 'function' ? p.lat() : p.lat, typeof p.lng === 'function' ? p.lng() : p.lng);
        });
        map.addListener('click', (e: any) => {
          marker.position = e.latLng;
          onPinMoved(e.latLng.lat(), e.latLng.lng());
        });
      } else {
        // フォールバック: 旧 Marker
        marker = new google.maps.Marker({ position: pos, map, title: 'ドラッグで位置調整', draggable: true });
        marker.addListener('dragend', (e: any) => {
          const p = e.latLng;
          if (p) onPinMoved(p.lat(), p.lng());
        });
        map.addListener('click', (e: any) => {
          marker.setPosition(e.latLng);
          onPinMoved(e.latLng.lat(), e.latLng.lng());
        });
      }
      return { map, marker };
    } catch (err) {
      console.error('Map init error:', err);
      return null;
    }
  }, [defaultLat, defaultLng, accentColor, onPinMoved]);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const result = createMap(mapRef.current);
    if (result) {
      mapInstanceRef.current = result.map;
      markerRef.current = result.marker;
      setIsLoaded(true);
    }
  }, [createMap]);

  // ✅ FIX-GPSPIN: initialLat/Lng が後から確定した場合（activity変更後）に
  //    地図センターとマーカー位置を更新する
  useEffect(() => {
    if (initialLat == null || initialLng == null) return;
    const pos = { lat: initialLat, lng: initialLng };
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(pos);
    }
    if (markerRef.current) {
      if (typeof markerRef.current.setPosition === 'function') {
        markerRef.current.setPosition(pos);
      } else {
        markerRef.current.position = pos;
      }
    }
  }, [initialLat, initialLng]);

  useEffect(() => {
    const tryInit = (): (() => void) | void => {
      if (typeof google !== 'undefined' && google.maps) {
        initMap();
        return;
      }
      // ✅ Fix③: スクリプトID統一+libraries=marker+重複防止
      const existing = document.getElementById('google-maps-script');
      if (!existing) {
        const s = document.createElement('script');
        s.id = 'google-maps-script';
        s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&loading=async&callback=__gmapEditReady`;
        s.async = true;
        (window as any).__gmapEditReady = () => initMap();
        document.head.appendChild(s);
        return;
      } else if (typeof google !== 'undefined' && google.maps) {
        setTimeout(() => initMap(), 50);
        return;
      } else {
        existing.addEventListener('load', () => initMap());
        return;
      }
      const t = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(t);
          initMap();
        }
      }, 200);
      return () => clearInterval(t);
    };
    return tryInit() ?? undefined;
  }, [initMap]);

  // 全画面Modal開いたとき地図を初期化
  useEffect(() => {
    if (showFullscreen && fullMapRef.current && !fullMapInstanceRef.current) {
      setTimeout(() => {
        if (!fullMapRef.current) return;
        const result = createMap(fullMapRef.current, markerRef.current);
        if (result) {
          fullMapInstanceRef.current = result.map;
          // 全画面の marker を共有（ドラッグ・クリックで同期）
          result.marker.addListener('dragend', () => {
            const p = result.marker.getPosition();
            if (p && markerRef.current) markerRef.current.setPosition(p);
          });
        }
      }, 100);
    }
    if (!showFullscreen && fullMapInstanceRef.current) {
      fullMapInstanceRef.current = null;
    }
  }, [showFullscreen, createMap]);

  return (
    <>
      <div>
        <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>場所ピン調整<span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}> — ドラッグで微調整</span></span>
          <span
            onClick={() => setShowFullscreen(true)}
            style={{ fontSize: 9, color: accentColor, border: `0.5px solid ${accentColor}`, borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}
          >
            拡大 ⛶
          </span>
        </div>
        <div
          ref={mapRef}
          style={{ borderRadius: 7, overflow: 'hidden', height: 100, border: `0.5px solid ${accentColor}33`, background: '#e8f0e4' }}
        />
        {!isLoaded && <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', marginTop: 3 }}>地図を読み込み中...</div>}
        {isLoaded && <div style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', marginTop: 3 }}>📍 ピンをドラッグ または タップで位置を設定</div>}
      </div>

      {/* 全画面Modal */}
      {showFullscreen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', flexDirection: 'column', background: '#000' }}>
          <div style={{ background: accentColor, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>📍 場所ピン調整</span>
            <div
              onClick={() => setShowFullscreen(false)}
              style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              ✕ 閉じる
            </div>
          </div>
          <div ref={fullMapRef} style={{ flex: 1 }} />
          <div style={{ background: '#111', color: '#9ca3af', padding: '8px', fontSize: 11, textAlign: 'center' }}>
            ピンをドラッグ または 地図をタップして位置を調整
          </div>
        </div>
      )}
    </>
  );
};

// 種別ごとのカラー定義
const ACTIVITY_CONFIG: Record<string, {
  label: string; color: string; colorLight: string; badge: string;
  bannerBg: string; bannerText: string; bannerBorder: string;
}> = {
  LOADING:            { label: '積込 編集', color: '#1565C0', colorLight: '#2196F3', badge: '積込到着',  bannerBg: '#E3F2FD', bannerText: '#1565C0', bannerBorder: '#2196F3' },
  LOADING_START:      { label: '積込 編集', color: '#1565C0', colorLight: '#2196F3', badge: '積込到着',  bannerBg: '#E3F2FD', bannerText: '#1565C0', bannerBorder: '#2196F3' },
  LOADING_COMPLETE:   { label: '積込 編集', color: '#1565C0', colorLight: '#2196F3', badge: '積込完了',  bannerBg: '#E3F2FD', bannerText: '#1565C0', bannerBorder: '#2196F3' },
  UNLOADING:          { label: '荷降 編集', color: '#2E7D32', colorLight: '#4CAF50', badge: '荷降完了',  bannerBg: '#E8F5E9', bannerText: '#2E7D32', bannerBorder: '#4CAF50' },
  UNLOADING_START:    { label: '荷降 編集', color: '#2E7D32', colorLight: '#4CAF50', badge: '荷降到着',  bannerBg: '#E8F5E9', bannerText: '#2E7D32', bannerBorder: '#4CAF50' },
  UNLOADING_COMPLETE: { label: '荷降 編集', color: '#2E7D32', colorLight: '#4CAF50', badge: '荷降完了',  bannerBg: '#E8F5E9', bannerText: '#2E7D32', bannerBorder: '#4CAF50' },
  FUELING:            { label: '給油 編集', color: '#E65100', colorLight: '#FF9800', badge: '給油',      bannerBg: '#FFF3E0', bannerText: '#E65100', bannerBorder: '#FF9800' },
  FUEL:               { label: '給油 編集', color: '#E65100', colorLight: '#FF9800', badge: '給油',      bannerBg: '#FFF3E0', bannerText: '#E65100', bannerBorder: '#FF9800' },
  BREAK:              { label: '休憩 編集', color: '#6A1B9A', colorLight: '#9C27B0', badge: '休憩',      bannerBg: '#F3E5F5', bannerText: '#6A1B9A', bannerBorder: '#9C27B0' },
  BREAK_START:        { label: '休憩 編集', color: '#6A1B9A', colorLight: '#9C27B0', badge: '休憩開始',  bannerBg: '#F3E5F5', bannerText: '#6A1B9A', bannerBorder: '#9C27B0' },
  BREAK_END:          { label: '休憩 編集', color: '#6A1B9A', colorLight: '#9C27B0', badge: '休憩終了',  bannerBg: '#F3E5F5', bannerText: '#6A1B9A', bannerBorder: '#9C27B0' },
};

const getCfg = (t: string) => ACTIVITY_CONFIG[t] || { label: '編集', color: '#5048b8', colorLight: '#7c6de0', badge: t, bannerBg: '#F3E5F5', bannerText: '#6A1B9A', bannerBorder: '#9C27B0' };
const isLoad  = (t: string) => ['LOADING','LOADING_START','LOADING_COMPLETE'].includes(t);
const isUnl   = (t: string) => ['UNLOADING','UNLOADING_START','UNLOADING_COMPLETE'].includes(t);
const isFuel  = (t: string) => ['FUELING','FUEL'].includes(t);
const isBreak = (t: string) => ['BREAK','BREAK_START','BREAK_END'].includes(t);

const toHHMM = (iso: string | null): string => {
  if (!iso) return '';
  try { return new Date(iso).toTimeString().slice(0, 5); } catch { return ''; }
};

// ✅ 過去に自動生成された「休憩開始」「休憩終了」という定型文をnotesから除去する。
// これらはユーザーが入力したものではなく、バックエンドが自動で埋めていた文言のため、
// 備考欄にそのまま表示すると「入力していないのに文字が入っている」ように見えてしまう。
const stripBreakAutoNotes = (raw: string): string => {
  if (!raw) return '';
  let s = raw.trim();
  if (s.startsWith('休憩開始') || s.startsWith('休憩終了')) {
    const dashIdx = s.indexOf(' - ');
    s = dashIdx !== -1 ? s.slice(dashIdx + 3).trim() : '';
  }
  return s;
};

const toISO = (base: string | null, hhmm: string): string => {
  if (!hhmm) return base ?? new Date().toISOString();
  const parts = hhmm.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const d = base ? new Date(base) : new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const ActivityEditSheet: React.FC<ActivityEditSheetProps> = ({
  activity, onClose, onSaved, onDeleted, items
}) => {
  const operationStore = useOperationStore();
  const [startHHMM, setStartHHMM] = useState('');
  const [endHHMM,   setEndHHMM]   = useState('');
  const [locationName, setLocationName] = useState('');
  // 客先
  const [currentCustomerId, setCurrentCustomerId] = useState('');
  const [currentCustomerName, setCurrentCustomerName] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<{ id: string; name: string }[]>([]);
  // 品目（複数選択）
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState('');
  // 給油
  const [fuelAmount, setFuelAmount] = useState('');
  const [fuelCost,   setFuelCost]   = useState('');
  const [notes,      setNotes]      = useState('');
  const [isSaving,   setIsSaving]   = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // GPS ピン座標
  const [pinLat, setPinLat] = useState<number | undefined>(undefined);
  const [pinLng, setPinLng] = useState<number | undefined>(undefined);
  // ✅ 手入力品目名
  const [customItemNameInput, setCustomItemNameInput] = useState('');
  // ✅ 場所選択（登録リストからの選択）
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [localLocations, setLocalLocations] = useState<EditLocationOption[]>([]);
  const [locationSearchText, setLocationSearchText] = useState('');

  useEffect(() => {
    if (!activity) return;
    setStartHHMM(toHHMM(activity.startTime));
    setEndHHMM(toHHMM(activity.endTime));
    setLocationName(activity.locationName || '');
    setSelectedLocationId(activity.locationId || '');
    setCurrentCustomerId(activity.customerId || operationStore.customerId || '');
    setCurrentCustomerName(activity.customerName || (operationStore.customerName ?? ''));
    // ✅ 品目初期値: 複数品目（itemIds）を優先し、なければ単一itemIdにフォールバック
    if (activity.itemIds && activity.itemIds.length > 0) {
      setSelectedItemIds(activity.itemIds);
    } else if (activity.itemId) {
      setSelectedItemIds([activity.itemId]);
    } else {
      setSelectedItemIds([]);
    }
    // ✅ 手入力品目名の初期値
    setCustomItemNameInput(activity.customItemName || '');
    setQuantity(activity.quantity != null && activity.quantity > 0 ? String(activity.quantity) : '');
    // ✅ 給油金額・量を既入力値としてプレフィル（ブランク初期化バグ修正）
    setFuelAmount(activity.quantity != null && activity.quantity > 0 ? String(activity.quantity) : '');
    setFuelCost(activity.fuelCostYen != null && activity.fuelCostYen > 0 ? String(activity.fuelCostYen) : '');
    setNotes(isBreak(activity.activityType) ? stripBreakAutoNotes(activity.notes || '') : (activity.notes || ''));
    setPinLat(activity.locationLat ?? undefined);
    setPinLng(activity.locationLng ?? undefined);
    setShowDeleteConfirm(false);
    setShowCustomerPicker(false);
    setShowLocationPicker(false);
  }, [activity]);

  // ✅ 登録地点一覧を取得（積込・荷降の「登録リストから選択」用）
  useEffect(() => {
    if (!showLocationPicker || localLocations.length > 0) return;
    (async () => {
      try {
        const res = await (apiService as any).getLocations({ limit: 100 });
        const arr = res?.data?.locations ?? (Array.isArray(res?.data) ? res.data : []);
        setLocalLocations(Array.isArray(arr) ? arr : []);
      } catch { /* ignore */ }
    })();
  }, [showLocationPicker]);

  // 客先一覧を取得
  useEffect(() => {
    if (!showCustomerPicker || localCustomers.length > 0) return;
    (async () => {
      try {
        const res = await (apiService as any).getCustomers();
        const arr = res?.data?.customers ?? res?.data ?? [];
        setLocalCustomers(Array.isArray(arr) ? arr : []);
      } catch { /* ignore */ }
    })();
  }, [showCustomerPicker]);

  if (!activity) return null;

  const cfg = getCfg(activity.activityType);

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#f3f4f6', border: '0.5px solid #d1d5db',
    borderRadius: 7, padding: '7px 8px', fontSize: 13, color: '#111827',
    boxSizing: 'border-box'
  };

  // 品目トグル
  const toggleItem = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // 客先変更（この積込／荷降だけに反映。運行全体のcustomerIdは変更しない）
  const handleChangeCustomer = (customerId: string, customerName: string) => {
    setCurrentCustomerId(customerId);
    setCurrentCustomerName(customerName);
    setShowCustomerPicker(false);
  };

  const handleSave = async () => {
    if (!startHHMM) { toast.error('開始時刻を入力してください'); return; }
    if (isLoad(activity.activityType) && selectedItemIds.length === 0 && !customItemNameInput.trim()) {
      toast.error('品目を選択してください'); return;
    }
    setIsSaving(true);
    try {
      // ✅ 休憩は開始(BREAK_START)・終了(BREAK_END)が別レコードのため、
      // この画面から両方を個別に更新する（場所名は編集対象外）
      if (isBreak(activity.activityType)) {
        const startIso = toISO(activity.startTime, startHHMM);
        const startRes = await (apiService as any).updateActivityRecord(activity.id, {
          actualStartTime: startIso,
          notes,
        });
        if (!startRes?.success) {
          toast.error(startRes?.message || '休憩開始の保存に失敗しました');
          setIsSaving(false);
          return;
        }
        let endIso: string | null = activity.endTime;
        if (activity.pairId && endHHMM) {
          endIso = toISO(activity.endTime, endHHMM);
          const endRes = await (apiService as any).updateActivityRecord(activity.pairId, {
            actualStartTime: endIso,
            actualEndTime: endIso,
          });
          if (!endRes?.success) {
            toast.error(endRes?.message || '休憩終了の保存に失敗しました');
            setIsSaving(false);
            return;
          }
        }
        toast.success('保存しました');
        onSaved({ ...activity, startTime: startIso, endTime: endIso, notes });
        setIsSaving(false);
        return;
      }
      const body: Record<string, any> = {
        actualStartTime: toISO(activity.startTime, startHHMM),
        actualEndTime:   endHHMM ? toISO(activity.endTime, endHHMM) : undefined,
        notes,
        locationName,
      };
      // ✅ 登録リストから選択した場合は locationId を直接送信（マスタ検索を経由しない）
      if (selectedLocationId) {
        body.locationId = selectedLocationId;
      }
      if (pinLat !== undefined && pinLng !== undefined) {
        body.latitude  = pinLat;
        body.longitude = pinLng;
      }
      if (isLoad(activity.activityType)) {
        // ✅ 複数品目対応: 選択された全品目IDを送信（operation_detail_items を再構築）
        if (selectedItemIds.length > 0) {
          body.itemId = selectedItemIds[0];
          body.selectedItemIds = selectedItemIds;
        }
        if (quantity) body.quantityTons = parseFloat(quantity);
        // ✅ 手入力品目名（マスタにない場合）
        if (customItemNameInput.trim()) {
          body.customItemName = customItemNameInput.trim();
        }
        // ✅ 客先はこの積込だけに保存する（運行全体には波及させない）
        if (currentCustomerId) {
          body.customerId = currentCustomerId;
        }
      }
      if (isFuel(activity.activityType)) {
        if (fuelAmount) body.quantityTons = parseFloat(fuelAmount);
        if (fuelCost)   body.fuelCostYen = parseFloat(fuelCost);  // ✅ 専用カラム
        if (notes)      body.notes = notes;  // 自由記述のみ
      }
      const res = await (apiService as any).updateActivityRecord(activity.id, body);
      if (res?.success) {
        toast.success('保存しました');
        const firstItemId = selectedItemIds[0] ?? activity.itemId;
        const savedItemNames = selectedItemIds.length > 0
          ? selectedItemIds.map(id => items.find(i => i.id === id)?.name || id)
          : activity.itemNames;
        onSaved({
          ...activity,
          startTime: body.actualStartTime,
          endTime: body.actualEndTime ?? activity.endTime,
          locationName: locationName || activity.locationName,
          locationId: selectedLocationId || activity.locationId,
          locationLat: pinLat,
          locationLng: pinLng,
          itemId: firstItemId,
          itemIds: selectedItemIds.length > 0 ? selectedItemIds : activity.itemIds,
          itemNames: savedItemNames,
          customItemName: customItemNameInput.trim() || activity.customItemName,
          quantity: body.quantityTons ?? activity.quantity,
          notes: notes,
          customerId: body.customerId ?? activity.customerId,
          customerName: currentCustomerName,
        });
      } else {
        toast.error(res?.message || '保存に失敗しました');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) { setShowDeleteConfirm(true); return; }
    setIsDeleting(true);
    try {
      // ✅ 休憩はBREAK_START/BREAK_ENDの2レコード1組のため、片方だけ残らないよう両方削除する
      const idsToDelete = (isBreak(activity.activityType) && activity.pairId)
        ? [activity.id, activity.pairId]
        : [activity.id];
      for (const delId of idsToDelete) {
        const res = await (apiService as any).deleteActivityRecord(delId);
        if (!(res?.success || res?.data?.id)) {
          toast.error(res?.message || '削除に失敗しました');
          setShowDeleteConfirm(false);
          setIsDeleting(false);
          return;
        }
      }
      toast.success('イベントを削除しました');
      idsToDelete.forEach(delId => onDeleted?.(delId));
      onClose();
    } catch {
      toast.error('削除に失敗しました');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 3000, display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.2s ease-out' }}>
        {/* ヘッダー */}
        <div style={{ background: `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.colorLight} 100%)`, color: '#fff', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, opacity: .85, cursor: 'pointer', whiteSpace: 'nowrap', color: '#fff' }} onClick={onClose}>← 詳細へ戻る</span>
          <span style={{ fontSize: 14, fontWeight: 500, flex: 1, textAlign: 'center', color: '#fff' }}>{cfg.label}</span>
          <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 8, background: 'rgba(255,255,255,0.22)', color: '#fff' }}>{cfg.badge}</span>
        </div>
        {/* バナー */}
        <div style={{ margin: '10px 12px 0', borderRadius: 7, padding: '6px 10px', fontSize: 10, lineHeight: 1.6, borderLeft: `3px solid ${cfg.bannerBorder}`, background: cfg.bannerBg, color: cfg.bannerText }}>
          {isLoad(activity.activityType)  && '積込の到着・完了時刻、品目・重量を修正できます。'}
          {isUnl(activity.activityType)   && '積降の到着・完了時刻と場所を修正できます。'}
          {isFuel(activity.activityType)  && '給油の時刻・量・金額・場所を修正できます。'}
          {isBreak(activity.activityType) && '休憩の開始時刻・終了時刻を修正できます。'}
        </div>
        {/* フォーム */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', flex: 1 }}>
          {/* 時刻 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <TimeDial label={isBreak(activity.activityType) ? '休憩開始時刻' : '到着時刻'} value={startHHMM} onChange={setStartHHMM} accentColor={cfg.color} />
            {isBreak(activity.activityType) && !activity.pairId ? (
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>休憩終了時刻</div>
                <div style={{ background: '#f3f4f6', border: '0.5px solid #d1d5db', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#9ca3af' }}>
                  未終了（運行中の画面で休憩終了後に編集できます）
                </div>
              </div>
            ) : (
              <TimeDial label={isBreak(activity.activityType) ? '休憩終了時刻' : '完了時刻'} value={endHHMM} onChange={setEndHHMM} accentColor={cfg.color} />
            )}
          </div>

          {/* 積込専用 */}
          {isLoad(activity.activityType) && (<>
            {/* 積込場所名（手入力 + 登録リストから選択） */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>積込場所名</span>
                <span onClick={() => setShowLocationPicker(true)} style={{ fontSize: 9, color: cfg.color, border: `0.5px solid ${cfg.color}`, borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}>登録リストから選択</span>
              </div>
              <input type="text" value={locationName} onChange={e => { setLocationName(e.target.value); setSelectedLocationId(''); }} placeholder="例: 翠香園町ダート" style={{ ...inputStyle, fontSize: 15, height: 44 }} />
            </div>
            {/* 客先（この積込／荷降だけの独立した客先） */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>客先</div>
              <div
                onClick={() => setShowCustomerPicker(true)}
                style={{ ...inputStyle, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff', border: `0.5px solid ${cfg.color}55` }}
              >
                <span style={{ fontSize: 14, color: currentCustomerName ? '#374151' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🏢 {currentCustomerName || '（タップして選択）'}
                </span>
                <span style={{ fontSize: 10, color: cfg.color, flexShrink: 0, marginLeft: 6 }}>変更 ▾</span>
              </div>
            </div>
            {/* 品目（区分ごとにグループ表示・複数選択チップ）※運行中の積込画面と同じ表示 */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
                品目<span style={{ fontSize: 9, color: '#9ca3af', marginLeft: 4 }}>（複数選択可）</span>
              </div>
              {items.length === 0 ? (
                <div style={{ fontSize: 10, color: '#ef4444', padding: '6px 0' }}>※ 品目が読み込まれていません</div>
              ) : (() => {
                const TYPE_LABEL_MAP: Record<string, string> = {
                  RECYCLED_MATERIAL: '再生材',
                  VIRGIN_MATERIAL: 'バージン材',
                  WASTE: '廃棄物',
                };
                const groupKeys = Array.from(new Set(items.map(it => it.itemType || '')));
                const groups = groupKeys.map(key => ({
                  key,
                  label: key ? (TYPE_LABEL_MAP[key] ?? key) : 'その他',
                  list: items
                    .filter(it => (it.itemType || '') === key)
                    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)),
                })).filter(g => g.list.length > 0);
                return groups.map(group => (
                  <div key={group.label} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', letterSpacing: '.04em', marginBottom: 4, paddingBottom: 2, borderBottom: '0.5px solid #f3f4f6' }}>
                      {group.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {group.list.map(item => {
                        const sel = selectedItemIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleItem(item.id)}
                            style={{
                              padding: '6px 12px', borderRadius: 20,
                              fontSize: 13, fontWeight: sel ? 600 : 400,
                              cursor: 'pointer',
                              background: sel ? `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.colorLight} 100%)` : '#f3f4f6',
                              color: sel ? '#fff' : '#374151',
                              border: `1.5px solid ${sel ? cfg.color : '#d1d5db'}`,
                              transition: 'all 0.15s',
                            }}
                          >
                            {sel && '✓ '}{item.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
              {selectedItemIds.length > 0 && (
                <div style={{ fontSize: 10, color: cfg.color, marginTop: 5 }}>
                  選択中: {selectedItemIds.map(id => items.find(i => i.id === id)?.name || id).join('、')}
                </div>
              )}
              {/* 手入力品目（マスタにない品目） */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>手入力品目<span style={{ fontSize: 9, color: '#9ca3af', marginLeft: 4 }}>（マスタにない場合）</span></div>
                <input type="text" value={customItemNameInput} onChange={e => setCustomItemNameInput(e.target.value)} placeholder="例: 特殊土砂" style={inputStyle} />
              </div>
            </div>
            {/* 重量 */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>
                重量（トン）<span style={{ fontSize: 9, color: '#ef4444', marginLeft: 4 }}>必須</span>
              </div>
              <input type="number" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="例: 12.5" step="0.1" min="0" style={{ ...inputStyle, fontSize: 16, height: 44 }} />
            </div>
          </>)}

          {/* 給油専用 */}
          {isFuel(activity.activityType) && (<>
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>スタンド名</div>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="例: ENEOS セルフ" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>給油量（L）</div>
                <input type="number" value={fuelAmount} onChange={e => setFuelAmount(e.target.value)} placeholder="例: 35" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>金額（円）</div>
                <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="例: 6300" style={inputStyle} />
              </div>
            </div>
          </>)}

          {/* 積降のみ: 場所名（手入力 + 登録リストから選択）。✅ 休憩には場所名は不要のため非表示 */}
          {isUnl(activity.activityType) && (
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>場所名</span>
                <span onClick={() => setShowLocationPicker(true)} style={{ fontSize: 9, color: cfg.color, border: `0.5px solid ${cfg.color}`, borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}>登録リストから選択</span>
              </div>
              <input type="text" value={locationName} onChange={e => { setLocationName(e.target.value); setSelectedLocationId(''); }} placeholder="例: ABC建材センター" style={inputStyle} />
            </div>
          )}

          {/* 休憩のみ: 備考 */}
          {isBreak(activity.activityType) && (
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>備考 <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>任意</span></div>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
            </div>
          )}

          {/* GPS ピン調整マップ */}
          <GpsPinMap
            accentColor={cfg.color}
            initialLat={pinLat}
            initialLng={pinLng}
            onPinMoved={(lat, lng) => { setPinLat(lat); setPinLng(lng); }}
          />

          {/* 削除セクション */}
          <div style={{ borderTop: '0.5px solid #fee2e2', paddingTop: 10, marginTop: 4 }}>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} style={{ width: '100%', padding: '9px', background: '#fff', border: '0.5px solid #fca5a5', borderRadius: 7, color: '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                🗑️ このイベントを削除する
              </button>
            ) : (
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #fca5a5' }}>
                <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 500, marginBottom: 8, textAlign: 'center' }}>⚠️ 本当に削除しますか？</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 10, textAlign: 'center' }}>この操作は元に戻せません</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: 9, background: '#f3f4f6', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>キャンセル</button>
                  <button onClick={handleDelete} disabled={isDeleting} style={{ padding: 9, background: isDeleting ? '#fca5a5' : '#ef4444', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                    {isDeleting ? '削除中...' : '削除する'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div style={{ padding: '8px 12px 12px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 7, borderTop: '0.5px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          <div style={{ padding: 9, textAlign: 'center', background: '#f3f4f6', borderRadius: 7, fontSize: 12, color: '#6b7280', border: '0.5px solid #d1d5db', cursor: 'pointer' }} onClick={onClose}>取消</div>
          <div style={{ padding: 9, textAlign: 'center', background: isSaving ? '#9ca3af' : `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.colorLight} 100%)`, borderRadius: 7, fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer' }} onClick={isSaving ? undefined : handleSave}>
            {isSaving ? '保存中...' : '保存する'}
          </div>
        </div>
      </div>

      {/* 客先選択ピッカー Modal */}
      {showCustomerPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>客先を選択</span>
              <div onClick={() => setShowCustomerPicker(false)} style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>✕ 閉じる</div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
              {localCustomers.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>客先を読み込み中...</div>
              ) : localCustomers.map(c => (
                <div
                  key={c.id}
                  onClick={() => handleChangeCustomer(c.id, c.name)}
                  style={{
                    padding: '12px', borderRadius: 8, marginBottom: 6,
                    background: c.id === currentCustomerId ? `${cfg.color}11` : '#f9fafb',
                    border: `0.5px solid ${c.id === currentCustomerId ? cfg.color : '#e5e7eb'}`,
                    cursor: 'pointer', fontSize: 14, color: '#374151',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span>🏢</span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  {c.id === currentCustomerId && <span style={{ color: cfg.color, fontSize: 12 }}>✓ 現在</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 場所選択ピッカー Modal（登録リストから選択） */}
      {showLocationPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>場所を選択</span>
              <div onClick={() => setShowLocationPicker(false)} style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>✕ 閉じる</div>
            </div>
            <div style={{ padding: '8px 16px 0' }}>
              <input
                type="text"
                value={locationSearchText}
                onChange={e => setLocationSearchText(e.target.value)}
                placeholder="場所名で検索"
                style={{ width: '100%', background: '#f3f4f6', border: '0.5px solid #d1d5db', borderRadius: 7, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
              {localLocations.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>場所を読み込み中...</div>
              ) : localLocations
                  .filter(l => !locationSearchText || l.name.includes(locationSearchText))
                  .map(l => (
                <div
                  key={l.id}
                  onClick={() => {
                    setLocationName(l.name);
                    setSelectedLocationId(l.id);
                    if (l.latitude != null && l.longitude != null) {
                      const latNum = Number(l.latitude);
                      const lngNum = Number(l.longitude);
                      if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
                        setPinLat(latNum);
                        setPinLng(lngNum);
                      }
                    }
                    setShowLocationPicker(false);
                  }}
                  style={{
                    padding: '12px', borderRadius: 8, marginBottom: 6,
                    background: l.id === selectedLocationId ? `${cfg.color}11` : '#f9fafb',
                    border: `0.5px solid ${l.id === selectedLocationId ? cfg.color : '#e5e7eb'}`,
                    cursor: 'pointer', fontSize: 14, color: '#374151',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span>📍</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                    {l.address && <div style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.address}</div>}
                  </div>
                  {l.id === selectedLocationId && <span style={{ color: cfg.color, fontSize: 12, flexShrink: 0 }}>✓ 選択中</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ActivityEditSheet;