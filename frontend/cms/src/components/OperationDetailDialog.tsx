// ✅✅✅ 運行記録詳細ダイアログ - Google Maps完全実装版
// 基本情報・運行情報・場所情報・タイムライン・GPSルート・点検項目管理を完全実装
// ✅ 修正: GPSルートタブにGoogle Maps実装追加
// ✅ 修正: routeGpsLogs の走行軌跡を localStorage 設定に依存せず常時描画
//          (Edge の Tracking Prevention による localStorage ブロック対策)
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  User, Truck, MapPin, Package, Clock,
  Navigation, CheckCircle, AlertCircle, TrendingUp,
  Coffee, Fuel, Play, Square, ClipboardCheck,
  ChevronDown, ChevronUp, XCircle,
  Pencil, Trash2, X, Save
} from 'lucide-react';
import Button from './common/Button';
import Modal from './common/Modal';
import { apiClient } from '../utils/api';

/**
 * 運行記録詳細情報のインターフェース
 */
interface OperationDetail {
  id: string;
  operationNumber: string;
  vehicleId: string;
  driverId: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedStartTime: string | null;
  actualStartTime: string | null;
  plannedEndTime: string | null;
  actualEndTime: string | null;
  totalDistanceKm: number | null;
  fuelConsumedLiters: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicles?: {
    id: string;
    plateNumber: string;
    model: string;
    manufacturer: string;
  };
  usersOperationsDriverIdTousers?: {
    id: string;
    name: string;
    username: string;
  };
}

/**
 * 運行詳細（積込・積下）のインターフェース
 */
interface OperationActivity {
  id: string;
  operationId: string;
  sequenceNumber: number;
  activityType: 'LOADING' | 'UNLOADING' | 'FUELING' | 'REFUELING' | 'BREAK' | 'MAINTENANCE' | 
                'BREAK_START' | 'BREAK_END' | 'TRIP_START' | 'TRIP_END' | 
                'TRANSPORTING' | 'WAITING' | 'PRE_INSPECTION' | 'POST_INSPECTION' | 'OTHER';
  locationId: string;
  itemId: string;
  plannedTime: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  quantityTons: number | null;
  notes: string | null;
  locations?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  items?: {
    id: string;
    name: string;
    unit: string;
  };
}

/**
 * GPS記録のインターフェース
 */
interface GpsRecord {
  id: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh?: number;
}

/**
 * 点検記録のインターフェース
 */
interface InspectionRecord {
  id: string;
  vehicleId: string;
  inspectorId: string;
  inspectionType: 'PRE_TRIP' | 'POST_TRIP';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string | null;
  completedAt: string | null;
  overallResult: 'PASS' | 'FAIL' | 'WARNING';
  latitude?: number;
  longitude?: number;
  locationName?: string;
  weatherCondition?: string;
  temperature?: number;
  overallNotes?: string;
  defectsFound?: number;
  vehicles?: {
    plateNumber: string;
    model: string;
  };
  users?: {
    name: string;
    email: string;
  };
  inspectionItemResults?: Array<{
    id: string;
    inspectionItemId: string;
    resultValue: string;
    isPassed: boolean;
    notes?: string;
    defectLevel?: string;
    photoUrls?: string[];
    inspectionItems?: {
      name: string;
      description?: string;
      category?: string;
    };
  }>;
}

/**
 * タイムラインイベントの統合型定義
 */
interface TimelineEvent {
  id: string;
  type: 'activity' | 'inspection';
  timestamp: Date;
  sequenceNumber?: number;
  data: OperationActivity | InspectionRecord;
}

/**
 * ✅ OperationDebug統合タイムラインイベント型
 */
interface OperationDebugTimelineEvent {
  id: string;
  sequenceNumber: number;
  eventType: 'TRIP_START' | 'TRIP_END' | 'PRE_INSPECTION' | 'POST_INSPECTION' | 
             'LOADING' | 'UNLOADING' | 'TRANSPORTING' | 'WAITING' | 
             'MAINTENANCE' | 'REFUELING' | 'FUELING' | 
             'BREAK' | 'BREAK_START' | 'BREAK_END' | 'OTHER' |
             'LOADING_ARRIVED' | 'LOADING_COMPLETED' |
             'UNLOADING_ARRIVED' | 'UNLOADING_COMPLETED';
  timestamp: string | null;
  location?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    recordedAt: string;
  } | null;
  notes?: string | null;
  quantityTons?: number;
  items?: {
    id: string;
    name: string;
    unit: string;
  } | null;
  inspectionDetails?: {
    inspectionRecordId: string;
    status: string;
    totalItems: number;
    passedItems: number;
    failedItems: number;
  } | null;
}

/**
 * ✅ OperationDebug点検項目詳細型
 */
interface InspectionItemDetail {
  inspectionRecordId: string;
  inspectionType: string;
  inspectionStatus: string;
  inspectionStartedAt: string | null;
  inspectionCompletedAt: string | null;
  inspectionItemId: string;
  inspectionItemName: string;
  inspectionItemDescription: string | null;
  inspectionItemCategory: string | null;
  resultValue: string | null;
  isPassed: boolean | null;
  notes: string | null;
  defectLevel: string | null;
  photoUrls: string[];
  checkedAt: string;
  operationId: string | null;
  vehicleId: string;
  vehiclePlateNumber: string | null;
  inspectorId: string;
  inspectorName: string | null;
}

interface OperationDetailDialogProps {
  operationId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 運行記録詳細ダイアログコンポーネント
 * 
 * @description
 * 仕様書A7「運行記録 > 詳細画面（ダイアログ）」に準拠した完全実装
 * ✅ Google Maps実装追加
 * ✅ routeGpsLogs 走行軌跡を常時描画（localStorage依存を排除）
 */

// =====================================================================
// ✅ CmsGpsPinMap - CMSタイムライン編集用 GPS ピン調整マップ
// =====================================================================
const CMS_MAPS_SCRIPT_ID = 'gmap-script-cms-edit';

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

  const initMap = React.useCallback((container: HTMLDivElement, existingMarker?: any) => {
    if (!(window as any).google?.maps) return null;
    const g = (window as any).google.maps;
    const map = new g.Map(container, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 17, disableDefaultUI: true, zoomControl: true,
    });
    const pos = existingMarker ? existingMarker.getPosition() : { lat: centerLat, lng: centerLng };
    const marker = new g.Marker({
      position: pos, map, draggable: true,
      icon: { path: g.SymbolPath.CIRCLE, scale: 10,
        fillColor: '#1d4ed8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
    });
    const move = () => { const p = marker.getPosition(); if (p) onPinMoved(p.lat(), p.lng()); };
    marker.addListener('dragend', move);
    map.addListener('click', (e: any) => { marker.setPosition(e.latLng); onPinMoved(e.latLng.lat(), e.latLng.lng()); });
    return { map, marker };
  }, [centerLat, centerLng, onPinMoved]);

  React.useEffect(() => {
    if (mapInst.current && markerInst.current && lat != null && lng != null) {
      const pos = { lat, lng };
      mapInst.current.panTo(pos);
      markerInst.current.setPosition(pos);
      onPinMoved(lat, lng);
    }
  }, [lat, lng]);

  React.useEffect(() => {
    const tryInit = () => {
      if ((window as any).google?.maps) {
        if (mapRef.current && !mapInst.current) {
          const r = initMap(mapRef.current);
          if (r) { mapInst.current = r.map; markerInst.current = r.marker; setLoaded(true); }
        }
        return;
      }
      if (!document.getElementById(CMS_MAPS_SCRIPT_ID)) {
        const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
        const s = document.createElement('script');
        s.id = CMS_MAPS_SCRIPT_ID;
        s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__cmsMapsReady`;
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

interface CmsEditEvent {
  id: string;
  realDetailId: string;
  eventType: string;
  timestamp: string | null;
  // ✅ 複数品目リスト（LOADING/UNLOADING_COMPLETED用）
  detailItems?: Array<{
    id: string;
    itemId: string;
    itemName: string;
    quantityTons: number;
    sequenceOrder: number;
  }> | null;
  // ✅ 給油金額専用フィールド
  fuelCostYen?: number | null;
  notes?: string | null;
  quantityTons?: number;
  locationName?: string;
  locationId?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  itemId?: string | null;
  itemName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  preinspMemo?: string | null;
}

interface CmsActivityEditModalProps {
  event: CmsEditEvent | null;
  operationId: string;
  items: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: (id: string) => void;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  LOADING: '積込', LOADING_ARRIVED: '積込(到着)', LOADING_COMPLETED: '積込(完了)',
  UNLOADING: '積降', UNLOADING_ARRIVED: '積降(到着)', UNLOADING_COMPLETED: '積降(完了)',
  FUELING: '給油', REFUELING: '給油',
  BREAK_START: '休憩開始', BREAK_END: '休憩終了', BREAK: '休憩',
  TRIP_START: '運行開始', TRIP_END: '運行終了',
  PRE_INSPECTION: '運行前点検', POST_INSPECTION: '運行後点検',
  TRANSPORTING: '運搬中', WAITING: '待機',
};

const isLoadEvt  = (t: string) => ['LOADING','LOADING_ARRIVED','LOADING_COMPLETED'].includes(t);
// isUnlEvt: 個別分岐済み
// const isUnlEvt = (t: string) => ['UNLOADING','UNLOADING_ARRIVED','UNLOADING_COMPLETED'].includes(t);
const isFuelEvt  = (t: string) => ['FUELING','REFUELING'].includes(t);
const isBreakEvt = (t: string) => ['BREAK','BREAK_START','BREAK_END'].includes(t);

const toHM = (iso: string | null): string => {
  if (!iso) return '';
  try {
    // ✅ JST変換（+9h）
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${String(jst.getUTCHours()).padStart(2,'0')}:${String(jst.getUTCMinutes()).padStart(2,'0')}`;
  } catch { return ''; }
};

const mergeHM = (base: string | null, hhmm: string): string => {
  if (!hhmm) return base ?? new Date().toISOString();
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const baseDate = base ? new Date(base) : new Date();
  const jstOff = 9 * 60 * 60 * 1000;
  const jstBase = new Date(baseDate.getTime() + jstOff);
  const y = jstBase.getUTCFullYear();
  const mo = jstBase.getUTCMonth();
  const day = jstBase.getUTCDate();
  const utcMs = Date.UTC(y, mo, day, h, m, 0, 0) - jstOff;
  return new Date(utcMs).toISOString();
};

// ヘルパー: イベント種別判定
const isInspEvt  = (t: string) => ['PRE_INSPECTION','POST_INSPECTION'].includes(t);
const isTripEvt  = (t: string) => ['TRIP_START','TRIP_END'].includes(t);
const isPostInsp = (t: string) => t === 'POST_INSPECTION';
const isDeletable = (t: string) => !isInspEvt(t) && !isTripEvt(t);
const isBreakStart = (t: string) => t === 'BREAK_START';
const isBreakEnd   = (t: string) => t === 'BREAK_END';

const CmsActivityEditModal: React.FC<CmsActivityEditModalProps> = ({
  event, operationId, items, customers, onClose, onSaved, onDeleted
}) => {
  const [startHHMM, setStartHHMM] = React.useState('');
  // endHHMM削除済み（到着編集の完了時刻フィールドなし）
  const [locationName, setLocationName] = React.useState('');
  const [notes,     setNotes]     = React.useState('');
  const [quantity,  setQuantity]  = React.useState('');
  const [fuelAmt,   setFuelAmt]   = React.useState('');
  const [fuelCost,  setFuelCost]  = React.useState('');
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const [pinLat, setPinLat] = React.useState<number | undefined>(undefined);
  const [pinLng, setPinLng] = React.useState<number | undefined>(undefined);
  const [currentCustomerId,   setCurrentCustomerId]   = React.useState('');
  const [currentCustomerName, setCurrentCustomerName] = React.useState('');
  const [showCustomerPicker,  setShowCustomerPicker]  = React.useState(false);
  const [preinspMemo, setPreinspMemo] = React.useState('');
  const [odometer,    setOdometer]    = React.useState('');
  const [fuelLevel,   setFuelLevel]   = React.useState('');
  const [inspMemo,    setInspMemo]    = React.useState('');
  const [saving, setSaving]   = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!event) return;
    setStartHHMM(toHM(event.timestamp));
    setLocationName(event.locationName ?? '');
    setNotes(event.notes ?? '');
    setQuantity(event.quantityTons && event.quantityTons > 0 ? String(event.quantityTons) : '');
    if (event.eventType === 'POST_INSPECTION') {
      // ✅ 正しいフィールドから初期値を取得
      // overall_notes → 点検メモ
      const overallNotes = (event as any).overallNotes ?? '';
      setInspMemo(overallNotes);
      // operations.total_distance_km → 走行距離
      setOdometer((event as any).totalDistanceKm ? String((event as any).totalDistanceKm) : '');
      // operations.fuel_consumed_liters → 燃料
      setFuelLevel((event as any).fuelConsumedLiters ? String((event as any).fuelConsumedLiters) : '');
    } else { setOdometer(''); setFuelLevel(''); setInspMemo(''); }
    // ✅ 給油: 専用カラムから初期値取得（notes regex解析廃止）
    if (['FUELING','REFUELING'].includes(event.eventType ?? '')) {
      setFuelAmt(event.quantityTons && event.quantityTons > 0 ? String(event.quantityTons) : '');
      setFuelCost(event.fuelCostYen ? String(event.fuelCostYen) : '');
    } else {
      setFuelAmt(''); setFuelCost('');
    }
    // ✅ 複数品目: detailItems があれば優先、なければ itemId にフォールバック
    if (event.detailItems && event.detailItems.length > 0) {
      setSelectedItemIds(event.detailItems.map(di => di.itemId));
    } else {
      setSelectedItemIds(event.itemId ? [event.itemId] : []);
    }
    setPinLat(event.locationLat != null ? event.locationLat : undefined);
    setPinLng(event.locationLng != null ? event.locationLng : undefined);
    setCurrentCustomerId(event.customerId ?? '');
    setCurrentCustomerName(event.customerName ?? '');
    setShowCustomerPicker(false);
    setOdometer(''); setFuelLevel(''); setInspMemo(''); setPreinspMemo(event.preinspMemo ?? '');
    setConfirmDel(false);
    setSaveError(null);
  }, [event]);

  if (!event) return null;

  const toggleItem = (id: string) =>
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleChangeCustomer = async (cid: string, cname: string) => {
    try {
      await apiClient.patch(`/mobile/operations/${operationId}/customer`, { customerId: cid });
      setCurrentCustomerId(cid); setCurrentCustomerName(cname);
    } catch { setSaveError('客先変更に失敗しました'); }
    setShowCustomerPicker(false);
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!startHHMM) { setSaveError('記録時刻を入力してください'); return; }
    setSaving(true);
    try {
      // ✅ 統合エンドポイントで全イベント種別を処理
      const body: Record<string, any> = {
        actualStartTime: mergeHM(event.timestamp, startHHMM),
      };
      // 場所名（点検・運行開始終了以外）
      if (locationName && !isInspEvt(event.eventType) && !isTripEvt(event.eventType)) {
        body.locationName = locationName;
      }
      // GPS座標
      if (pinLat !== undefined && pinLng !== undefined) {
        body.latitude  = pinLat;
        body.longitude = pinLng;
      }
      // 備考（点検・運行開始終了以外）
      if (!isInspEvt(event.eventType) && !isTripEvt(event.eventType)) {
        if (notes) body.notes = notes;
      }
      // 積込完了 / 積降完了: 完了時刻・品目・重量
      if (event.eventType === 'LOADING_COMPLETED' || event.eventType === 'UNLOADING_COMPLETED') {
        body.actualEndTime = mergeHM(event.timestamp, startHHMM);
        delete body.actualStartTime;
        if (selectedItemIds.length > 0) {
          body.itemId = selectedItemIds[0];             // 後方互換（単一品目時）
          body.selectedItemIds = selectedItemIds;       // ✅ 複数品目はDBの専用テーブルへ
          // ✅ notes への品目名埋め込みは廃止
        }
        if (quantity) body.quantityTons = parseFloat(quantity);
      }
      // ✅ 給油: 専用カラムに保存（notes 埋め込み廃止）
      if (isFuelEvt(event.eventType)) {
        if (fuelAmt) body.quantityTons = parseFloat(fuelAmt);
        if (fuelCost) body.fuelCostYen = parseFloat(fuelCost);  // ✅ 専用カラム
        // notes は自由記述のみ
      }
      // 運行前点検: overall_notes に保存
      if (event.eventType === 'PRE_INSPECTION') {
        if (preinspMemo) body.overallNotes = preinspMemo;
        delete body.notes;
      }
      // 運行後点検: 正しいカラムに保存
      if (isPostInsp(event.eventType)) {
        // overall_notes → inspection_records.overall_notes
        if (inspMemo) body.overallNotes = inspMemo;
        // 走行距離 → operations.total_distance_km
        if (odometer) body.totalDistanceKm = odometer;
        // 燃料消費量 → operations.fuel_consumed_liters
        if (fuelLevel) body.fuelConsumedLiters = fuelLevel;
        delete body.notes; // notesには保存しない
      }
      // 客先変更があれば body に含める（timeline-event で直接DB更新）
      if (isLoadEvt(event.eventType) && currentCustomerId) {
        body._updateCustomer = true;
        body.customerId = currentCustomerId;
        body.operationId = operationId;
      }
      // ✅ 統合エンドポイント使用（event.id = 合成IDそのまま）
      const res = await apiClient.put(`/operation-details/timeline-event/${event.id}`, body);
      if ((res as any).success || (res as any).data || (res as any).id || (res as any).eventId) {
        onSaved();
        onClose();
      } else {
        setSaveError('保存に失敗しました');
      }
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || e?.message || '保存に失敗しました');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      await apiClient.delete(`/operation-details/${event.realDetailId}`);
      onDeleted(event.id);
      onClose();
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || '削除に失敗しました');
      setConfirmDel(false);
    } finally { setDeleting(false); }
  };

  const accentColors: Record<string, string> = {
    LOADING: '#1565C0', LOADING_ARRIVED: '#1565C0', LOADING_COMPLETED: '#1565C0',
    UNLOADING: '#2E7D32', UNLOADING_ARRIVED: '#2E7D32', UNLOADING_COMPLETED: '#2E7D32',
    FUELING: '#E65100', REFUELING: '#E65100',
    BREAK: '#6A1B9A', BREAK_START: '#6A1B9A', BREAK_END: '#6A1B9A',
  };
  const accent = accentColors[event.eventType] || '#1d4ed8';
  const label  = EVENT_TYPE_LABEL[event.eventType] || event.eventType;

  return (
    <div
      className="fixed inset-0 z-[9900] flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}>
          <span className="font-semibold text-base">{label} — 編集</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{saveError}
            </div>
          )}

          {/* 時刻: イベント種別ごとに完全制御 */}
          {(() => {
            const et = event.eventType;
            const isCompleted = et === 'LOADING_COMPLETED' || et === 'UNLOADING_COMPLETED';
            const isArrived   = et === 'LOADING_ARRIVED'   || et === 'UNLOADING_ARRIVED';
            if (isBreakStart(et)) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">開始時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            if (isBreakEnd(et)) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">終了時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            if (isInspEvt(et) || isTripEvt(et)) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">記録時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            if (isCompleted) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">完了時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            if (isArrived) return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">到着時刻<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
            const startLabel = isFuelEvt(et) ? '給油時刻' : '記録時刻';
            return (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{startLabel}<span className="text-red-500 ml-1">*</span></label>
                <input type="time" value={startHHMM} onChange={e => setStartHHMM(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            );
          })()}

          {/* ── 積込(到着): 場所名・客先・GPS地図のみ ── */}
          {event.eventType === 'LOADING_ARRIVED' && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">積込場所名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: 翠香園町ダート"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">客先</label>
              <button type="button" onClick={() => setShowCustomerPicker(true)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-blue-400 transition-colors">
                <span className={currentCustomerName ? 'text-gray-800' : 'text-gray-400'}>
                  🏢 {currentCustomerName || '（タップして変更）'}
                </span>
                <span className="text-xs text-blue-600 ml-2">変更 ▾</span>
              </button>
            </div>
            <CmsGpsPinMap lat={pinLat} lng={pinLng}
              onPinMoved={(lat, lng) => { setPinLat(lat); setPinLng(lng); }} />
          </>)}

          {/* ── 積込(完了): 品目（カテゴリグリッド）・重量のみ ── */}
          {event.eventType === 'LOADING_COMPLETED' && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                品目 <span className="font-normal text-gray-400">（複数選択可）</span>
              </label>
              {items.length === 0 ? (
                <div className="text-xs text-amber-600 py-2">
                  ⏳ 品目を読み込み中...
                  {event.itemId && (
                    <p className="mt-1 text-gray-600">
                      現在選択中: <span className="font-semibold text-blue-600">{event.itemName ?? '（品目名取得中）'}</span>
                    </p>
                  )}
                </div>
              ) : (() => {
                const TYPE_LABEL: Record<string, string> = {
                  RECYCLED_MATERIAL: '再生材', VIRGIN_MATERIAL: 'バージン材', WASTE: '廃棄物',
                };
                const ORDER: ('RECYCLED_MATERIAL'|'VIRGIN_MATERIAL'|'WASTE'|undefined)[] =
                  ['RECYCLED_MATERIAL','VIRGIN_MATERIAL','WASTE',undefined];
                const grouped = ORDER.map(k => ({
                  key: k,
                  label: k ? (TYPE_LABEL[k] ?? k) : 'その他',
                  items: (items as any[])
                    .filter((it: any) => it.itemType === k || (k === undefined && !it.itemType))
                    .sort((a: any, b: any) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)),
                })).filter(g => g.items.length > 0);
                return (
                  <div className="space-y-3">
                    {grouped.map(group => (
                      <div key={group.label}>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 mb-2 border-b border-gray-100">
                          {group.label}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {group.items.map((item: any) => {
                            const sel = selectedItemIds.includes(item.id);
                            return (
                              <button key={item.id} type="button" onClick={() => toggleItem(item.id)}
                                className="py-2.5 px-2 text-sm font-medium rounded-lg border-2 text-center transition-all leading-tight"
                                style={{
                                  background: sel ? 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' : '#fff',
                                  color: sel ? '#fff' : '#374151',
                                  borderColor: sel ? '#667eea' : '#d1d5db',
                                  fontWeight: sel ? 'bold' : 'normal',
                                }}
                              >{sel ? `✓ ${item.name}` : item.name}</button>
                            );
                          })}
                        </div>
                        {group.key === 'WASTE' && (
                          <div className="mt-2 p-3 bg-amber-50 border-2 border-amber-300 rounded-lg text-xs text-amber-800">
                            📋 産業廃棄物マニフェストを登録する場合は、
                            <a href="https://webpage.e-reverse.com" target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 underline font-bold">こちら</a>からログインしてください。
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
              {selectedItemIds.length > 0 && (
                <p className="text-xs mt-2" style={{ color: accent }}>
                  選択中: {selectedItemIds.map(id => (items as any[]).find((i: any) => i.id === id)?.name || id).join('、')}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">重量（トン）</label>
              <input type="number" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="例: 12.5" step="0.1" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </>)}

          {/* ── 積降(到着): 場所名・GPS地図 ── */}
          {event.eventType === 'UNLOADING_ARRIVED' && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">積降場所名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: ABC建材センター"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <CmsGpsPinMap lat={pinLat} lng={pinLng}
              onPinMoved={(lat, lng) => { setPinLat(lat); setPinLng(lng); }} />
          </>)}

          {/* ── 積降(完了): 完了時刻のみ（追加項目なし） ── */}

          {/* 給油専用 */}
          {isFuelEvt(event.eventType) && (<>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">スタンド名</label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: ENEOS セルフ"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">給油量（L）</label>
                <input type="number" value={fuelAmt} onChange={e => setFuelAmt(e.target.value)} placeholder="例: 35"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">金額（円）</label>
                <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="例: 6300"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          </>)}

          {/* 休憩専用 */}
          {isBreakEvt(event.eventType) && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">場所名 <span className="font-normal text-gray-400">（任意）</span></label>
              <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder="例: コンビニ駐車場"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          )}

          {/* 運行前点検専用: 点検メモ */}
          {event.eventType === 'PRE_INSPECTION' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                📝 点検メモ <span className="font-normal text-gray-400">（気になった点・軽微な問題があれば記載）</span>
              </label>
              <textarea value={preinspMemo} onChange={e => setPreinspMemo(e.target.value)}
                placeholder="気になった点・軽微な問題など..." rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>
          )}

          {/* 運行後点検専用 */}
          {isPostInsp(event.eventType) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-700">📋 運行後点検 追加情報</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">走行距離 (km)</label>
                  <input type="number" inputMode="decimal" value={odometer} onChange={e => setOdometer(e.target.value)}
                    placeholder="例: 3855"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">燃料レベル (L) <span className="font-normal text-gray-400">任意</span></label>
                  <input type="number" inputMode="decimal" value={fuelLevel} onChange={e => setFuelLevel(e.target.value)}
                    placeholder="例: 45"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">📝 点検メモ・特記事項</label>
                <textarea value={inspMemo} onChange={e => setInspMemo(e.target.value)}
                  placeholder="気になった点・軽微な問題など..." rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
          )}

          {/* 備考: 給油・休憩のみ */}
          {isFuelEvt(event.eventType) || isBreakEvt(event.eventType) ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">備考 <span className="font-normal text-gray-400">（任意）</span></label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="メモを入力..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          ) : null}

          {/* 削除: 点検・運行開始終了は不可 */}
          {isDeletable(event.eventType) && (
            <div className="border-t border-red-100 pt-4">
              {!confirmDel ? (
                <button type="button" onClick={() => setConfirmDel(true)}
                  className="w-full py-2 border border-red-300 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 transition-colors">
                  <Trash2 className="w-4 h-4" />このイベントを削除する
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700 text-center">⚠️ 本当に削除しますか？</p>
                  <p className="text-xs text-gray-500 text-center">この操作は元に戻せません</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirmDel(false)}
                      className="py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors">
                      キャンセル
                    </button>
                    <button type="button" onClick={handleDelete} disabled={deleting}
                      className="py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ background: '#ef4444' }}>
                      {deleting ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 客先ピッカー */}
          {showCustomerPicker && (
            <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black bg-opacity-50"
              onClick={e => { if (e.target === e.currentTarget) setShowCustomerPicker(false); }}>
              <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[60vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="font-semibold text-sm">客先を選択</span>
                  <button onClick={() => setShowCustomerPicker(false)} className="text-gray-500 text-sm">✕ 閉じる</button>
                </div>
                <div className="overflow-y-auto flex-1 p-3 space-y-2">
                  {customers.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">客先を読み込み中...</p>
                  ) : customers.map(c => (
                    <button key={c.id} type="button" onClick={() => handleChangeCustomer(c.id, c.name)}
                      className="w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center gap-3"
                      style={{ background: c.id === currentCustomerId ? '#eff6ff' : '#f9fafb', borderColor: c.id === currentCustomerId ? '#3b82f6' : '#e5e7eb' }}>
                      <span>🏢</span>
                      <span className="flex-1 text-sm text-gray-800">{c.name}</span>
                      {c.id === currentCustomerId && <span className="text-blue-600 text-xs font-medium">✓ 現在</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            キャンセル
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-[2] py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            style={{ background: saving ? '#9ca3af' : accent }}>
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
};

const OperationDetailDialog: React.FC<OperationDetailDialogProps> = ({
  operationId,
  isOpen,
  onClose
}) => {
  console.log('[OperationDetailDialog] Rendering:', { operationId, isOpen });

  // ===================================================================
  // State管理
  // ===================================================================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // データ state
  const [operation, setOperation] = useState<OperationDetail | null>(null);
  const [activities, setActivities] = useState<OperationActivity[]>([]);
  const [gpsRecords, setGpsRecords] = useState<GpsRecord[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  
  // @ts-ignore - 将来使用する可能性があるため保持
  const [inspectionsLoading, setInspectionsLoading] = useState(false);
  // @ts-ignore - 将来使用する可能性があるため保持
  const [inspectionsError, setInspectionsError] = useState<string | null>(null);

  // ✅ OperationDebug統合タイムライン用State
  const [operationDebugTimelineEvents, setOperationDebugTimelineEvents] = useState<OperationDebugTimelineEvent[]>([]);
  const [inspectionItemDetails, _setInspectionItemDetails] = useState<InspectionItemDetail[]>([]);

  // ✅ 走行軌跡用GPSログ state（イベントPINとは別）
  const [routeGpsLogs, setRouteGpsLogs] = useState<Array<{
    latitude: number;
    longitude: number;
    recordedAt: string;
    speedKmh: number | null;
  }>>([]);

  // ✅ タイムラインイベントからGPSポイントを抽出（地図表示用）
  const timelineGpsPoints = useMemo(() => {
    return operationDebugTimelineEvents
      .filter(event => event.gpsLocation != null)
      .map(event => ({
        latitude: event.gpsLocation!.latitude,
        longitude: event.gpsLocation!.longitude,
        recordedAt: event.gpsLocation!.recordedAt,
        eventType: event.eventType,
        sequenceNumber: event.sequenceNumber,
        notes: event.notes || ''
      }));
  }, [operationDebugTimelineEvents]);

  // タブ切り替え state
  const [activeTab, setActiveTab] = useState<'basic' | 'timeline' | 'gps' | 'inspection'>('basic');

  // ✅ UI制御用State
  const [showOperationTimeline, setShowOperationTimeline] = useState(true);
  const [showInspectionDetails, setShowInspectionDetails] = useState(true);

  // ✅ イベント編集モーダル
  const [editEvent, setEditEvent] = useState<CmsEditEvent | null>(null);
  const [editItems, setEditItems] = useState<{ id: string; name: string }[]>([]);
  const [editCustomers, setEditCustomers] = useState<{ id: string; name: string }[]>([]);

  // ✅ Google Maps用State
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // ===================================================================
  // Google Maps初期化
  // ===================================================================

  /**
   * ✅ Google Mapsスクリプト読み込み
   */
  useEffect(() => {
    console.log('🌍 [Maps Loading Debug] === Google Maps loading useEffect START ===');
    console.log('🌍 [Maps Loading Debug] isOpen:', isOpen);
    console.log('🌍 [Maps Loading Debug] activeTab:', activeTab);
    
    const loadGoogleMaps = () => {
      console.log('🌍 [Maps Loading Debug] loadGoogleMaps function called');
      
      if (window.google && window.google.maps) {
        console.log('✅ [Maps Loading Debug] Google Maps already loaded');
        setMapsLoaded(true);
        return;
      }

      const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
      console.log('🔑 [Maps Loading Debug] API Key exists?', !!GOOGLE_MAPS_API_KEY);
      console.log('🔑 [Maps Loading Debug] API Key length:', GOOGLE_MAPS_API_KEY.length);

      if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        console.error('❌ [Maps Loading Debug] Invalid or missing API key');
        setMapError('Google Maps APIキーが設定されていません');
        return;
      }

      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        console.log('✅ [Maps Loading Debug] Google Maps script already exists');
        existingScript.addEventListener('load', () => {
          console.log('✅ [Maps Loading Debug] Existing script loaded');
          setMapsLoaded(true);
        });
        return;
      }

      console.log('📥 [Maps Loading Debug] Creating new Google Maps script tag...');
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('✅ [Maps Loading Debug] Google Maps script loaded successfully');
        setMapsLoaded(true);
      };
      script.onerror = () => {
        console.error('❌ [Maps Loading Debug] Google Maps script loading failed');
        setMapError('Google Mapsの読み込みに失敗しました');
      };
      document.head.appendChild(script);
      console.log('📥 [Maps Loading Debug] Script tag appended to document.head');
    };

    if (isOpen && activeTab === 'gps') {
      console.log('✅ [Maps Loading Debug] Conditions met - calling loadGoogleMaps()');
      loadGoogleMaps();
    } else {
      console.log('⚠️ [Maps Loading Debug] Conditions not met - skipping');
    }
    
    console.log('🌍 [Maps Loading Debug] === Google Maps loading useEffect END ===');
  }, [isOpen, activeTab]);

  /**
   * ✅ Google Map初期化とGPSルート描画
   * ✅ 修正: routeGpsLogs を localStorage 設定に依存せず常時描画
   */
  useEffect(() => {
    console.log('🗺️ [Map Debug] === Map initialization useEffect START ===');
    console.log('🗺️ [Map Debug] Conditions check:');
    console.log('  - mapsLoaded:', mapsLoaded);
    console.log('  - mapRef.current:', !!mapRef.current);
    console.log('  - gpsRecords.length:', gpsRecords.length);
    console.log('  - routeGpsLogs.length:', routeGpsLogs.length);
    console.log('  - activeTab:', activeTab);
    console.log('  - activeTab === "gps":', activeTab === 'gps');
    
    // ✅ timelineGpsPointsを優先、なければgpsRecordsにフォールバック
    const activeGpsPoints = timelineGpsPoints.length > 0
      ? timelineGpsPoints
      : gpsRecords.map(r => ({
          latitude: r.latitude,
          longitude: r.longitude,
          recordedAt: r.recordedAt,
          eventType: 'GPS_LOG' as const,
          sequenceNumber: 0,
          notes: ''
        }));

    // routeGpsLogsがある場合はactiveGpsPointsが0でも地図を初期化する
    const hasAnyGpsData = activeGpsPoints.length > 0 || routeGpsLogs.length > 0;

    if (!mapsLoaded || !mapRef.current || !hasAnyGpsData || activeTab !== 'gps') {
      console.warn('⚠️ [Map Debug] Map initialization skipped - conditions not met');
      console.warn('  - mapsLoaded:', mapsLoaded);
      console.warn('  - mapRef.current:', !!mapRef.current);
      console.warn('  - hasAnyGpsData:', hasAnyGpsData);
      console.warn('  - activeTab === "gps":', activeTab === 'gps');
      return;
    }

    console.log('✅ [Map Debug] All conditions met - initializing map...');

    try {
      // ✅ イベントタイプ→日本語ラベルのマッピング
      const getEventLabel = (eventType: string): { short: string; full: string; color: string } => {
        const labels: Record<string, { short: string; full: string; color: string }> = {
          TRIP_START:      { short: 'S',  full: '運行開始',   color: '#10B981' },
          TRIP_END:        { short: 'E',  full: '運行終了',   color: '#EF4444' },
          PRE_INSPECTION:  { short: '前', full: '運行前点検', color: '#6366F1' },
          POST_INSPECTION: { short: '後', full: '運行後点検', color: '#8B5CF6' },
          LOADING:         { short: '積', full: '積込',       color: '#F59E0B' },
          UNLOADING:       { short: '降', full: '積降',       color: '#F97316' },
          BREAK_START:     { short: '休', full: '休憩開始',   color: '#64748B' },
          BREAK_END:       { short: '再', full: '休憩終了',   color: '#64748B' },
          FUELING:         { short: '油', full: '給油',       color: '#06B6D4' },
          REFUELING:       { short: '油', full: '給油',       color: '#06B6D4' },
          TRANSPORTING:    { short: '運', full: '輸送中',     color: '#3B82F6' },
          WAITING:         { short: '待', full: '待機中',     color: '#94A3B8' },
          GPS_LOG:         { short: '●', full: 'GPS記録',    color: '#3B82F6' },
        };
        return labels[eventType] || { short: '?', full: eventType, color: '#9CA3AF' };
      };

      // ✅ 地図の中心座標を計算
      // routeGpsLogs があればそこから、なければ activeGpsPoints から計算
      let centerLat = 34.6937;  // 大阪デフォルト
      let centerLng = 135.5023;

      if (routeGpsLogs.length > 0) {
        centerLat = routeGpsLogs.reduce((sum, p) => sum + p.latitude, 0) / routeGpsLogs.length;
        centerLng = routeGpsLogs.reduce((sum, p) => sum + p.longitude, 0) / routeGpsLogs.length;
        console.log('📍 [Map Debug] Center from routeGpsLogs:', { centerLat, centerLng });
      } else if (activeGpsPoints.length > 0) {
        centerLat = activeGpsPoints.reduce((sum, p) => sum + p.latitude, 0) / activeGpsPoints.length;
        centerLng = activeGpsPoints.reduce((sum, p) => sum + p.longitude, 0) / activeGpsPoints.length;
        console.log('📍 [Map Debug] Center from activeGpsPoints:', { centerLat, centerLng });
      }

      // 地図初期化
      console.log('🗺️ [Map Debug] Creating Google Maps instance...');
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      mapInstanceRef.current = map;
      console.log('✅ [Map Debug] Google Maps instance created');

      // =====================================================================
      // ✅ Step1: 走行軌跡描画（routeGpsLogs）
      // ✅ 修正: localStorage 設定に依存せず、routeGpsLogs がある場合は常時描画
      //          Edge の Tracking Prevention による localStorage ブロック対策
      // =====================================================================
      if (routeGpsLogs.length > 0) {
        // ✅ Fix-A: インターバルフィルターを廃止し全GPS点を描画
        // 理由: デフォルト5分間隔フィルタにより数件しか描画されず
        //       「三角形軌跡」になっていた。DBにある全点を描画する。
        // 「描画インターバル設定」はシステム設定で引き続き保持するが
        // ここでは使用せず常に全点描画とする。
        console.log(`📡 [Map Debug] routeGpsLogs全点描画: ${routeGpsLogs.length}件`);

        // 走行軌跡ライン（青色・視認しやすく）
        new google.maps.Polyline({
          path: routeGpsLogs.map(p => ({ lat: p.latitude, lng: p.longitude })),
          geodesic: true,
          strokeColor: '#2563EB',  // blue-600
          strokeOpacity: 0.75,
          strokeWeight: 3,
          map: map
        });

        // 走行軌跡ポイント（小さい青ドット）
        routeGpsLogs.forEach(log => {
          new google.maps.Marker({
            position: { lat: log.latitude, lng: log.longitude },
            map: map,
            title: `GPS記録: ${new Date(log.recordedAt).toLocaleString('ja-JP')}${log.speedKmh != null ? ` (${log.speedKmh.toFixed(1)} km/h)` : ''}`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 4,
              fillColor: '#3B82F6',  // blue-500
              fillOpacity: 0.7,
              strokeColor: '#FFFFFF',
              strokeWeight: 1
            }
          });
        });

        console.log('✅ [Map Debug] 走行軌跡描画完了:', routeGpsLogs.length, '点');
      } else {
        console.log('ℹ️ [Map Debug] routeGpsLogs なし - 走行軌跡描画スキップ');
      }

      // =====================================================================
      // ✅ Step2: イベントPINポイントのポリライン（activeGpsPoints）
      // =====================================================================
      if (activeGpsPoints.length > 0) {
        const path = activeGpsPoints.map(point => ({
          lat: point.latitude,
          lng: point.longitude
        }));

        console.log('📍 [Map Debug] Event path created with', path.length, 'points');

        // イベント間をつなぐポリライン（細い緑色の点線）
        new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#10B981',  // emerald-500
          strokeOpacity: 0.6,
          strokeWeight: 2,
          map: map
        });
        console.log('✅ [Map Debug] Event polyline drawn');

        // ✅ イベントごとのマーカーを描画
        const infoWindow = new google.maps.InfoWindow();

        activeGpsPoints.forEach((point, index) => {
          const label = getEventLabel(point.eventType);
          const isFirst = index === 0;
          const isLast = index === activeGpsPoints.length - 1;
          const scale = isFirst || isLast ? 12 : 9;

          const marker = new google.maps.Marker({
            position: { lat: point.latitude, lng: point.longitude },
            map: map,
            title: `${point.sequenceNumber > 0 ? point.sequenceNumber + '. ' : ''}${label.full}`,
            label: {
              text: label.short,
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 'bold'
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: scale,
              fillColor: label.color,
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2
            }
          });

          // クリックで情報ウィンドウ表示
          marker.addListener('click', () => {
            const content = `
              <div style="padding:8px;min-width:160px;font-family:sans-serif;font-size:12px;">
                <div style="font-weight:bold;font-size:13px;margin-bottom:4px;color:#1f2937;">
                  ${point.sequenceNumber > 0 ? point.sequenceNumber + '. ' : ''}${label.full}
                </div>
                <div style="color:#6b7280;margin-bottom:2px;">
                  📍 ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}
                </div>
                <div style="color:#6b7280;margin-bottom:2px;">
                  🕐 ${new Date(point.recordedAt).toLocaleString('ja-JP')}
                </div>
                ${point.notes ? `<div style="color:#374151;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:4px;">${point.notes}</div>` : ''}
              </div>
            `;
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
          });
        });

        console.log('✅ [Map Debug] Event markers drawn:', activeGpsPoints.length, '件');
      }

      // =====================================================================
      // ✅ Step3: 地図の表示範囲を全ポイントが収まるように調整
      // =====================================================================
      const allPoints: google.maps.LatLngLiteral[] = [];
      if (routeGpsLogs.length > 0) {
        routeGpsLogs.forEach(p => allPoints.push({ lat: p.latitude, lng: p.longitude }));
      }
      if (activeGpsPoints.length > 0) {
        activeGpsPoints.forEach(p => allPoints.push({ lat: p.latitude, lng: p.longitude }));
      }

      if (allPoints.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        allPoints.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        console.log('✅ [Map Debug] Map bounds fitted to', allPoints.length, 'points');
      }

      console.log('✅ [Map Debug] === Google Map initialization SUCCESS ===');
      console.log('✅ [Map Debug] routeGpsLogs:', routeGpsLogs.length, '件');
      console.log('✅ [Map Debug] Event GPS points:', activeGpsPoints.length, '件');
      console.log('✅ [Map Debug] Map center:', { lat: centerLat, lng: centerLng });
    } catch (err) {
      console.error('❌ [Map Debug] === Google Map initialization FAILED ===');
      console.error('❌ [Map Debug] Error:', err);
      console.error('❌ [Map Debug] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setMapError('地図の表示中にエラーが発生しました');
    }
  }, [mapsLoaded, gpsRecords, timelineGpsPoints, routeGpsLogs, activeTab, mapRef]);

  // ===================================================================
  // データ取得
  // ===================================================================
  
  /**
   * 運行基本情報を取得
   */
  const fetchOperationDetail = async () => {
    console.log('📋 [Operation Debug] === fetchOperationDetail START ===');
    console.log('📋 [Operation Debug] operationId:', operationId);
    
    try {
      const response = await apiClient.get(`/operations/${operationId}`);
      
      console.log('📡 [Operation Debug] API Response:', response);
      console.log('📡 [Operation Debug] response.success:', response.success);
      console.log('📡 [Operation Debug] response.data:', response.data);
      
      if (response.success && response.data) {
        const responseData: any = response.data;
        let operationData: OperationDetail;
        
        console.log('🔍 [Operation Debug] Parsing response data...');
        console.log('🔍 [Operation Debug] responseData.data?.data exists?', !!responseData.data?.data);
        console.log('🔍 [Operation Debug] responseData.data exists?', !!responseData.data);
        
        // データ構造に応じて柔軟に対応
        if (responseData.data?.data) {
          operationData = responseData.data.data as OperationDetail;
          console.log('✅ [Operation Debug] Using responseData.data.data');
        } else if (responseData.data) {
          operationData = responseData.data as OperationDetail;
          console.log('✅ [Operation Debug] Using responseData.data');
        } else {
          operationData = responseData as OperationDetail;
          console.log('✅ [Operation Debug] Using responseData directly');
        }
        
        console.log('📋 [Operation Debug] Extracted operation data:', {
          id: operationData.id,
          vehicleId: operationData.vehicleId,
          driverId: operationData.driverId,
          status: operationData.status,
          hasVehicles: !!operationData.vehicles,
          vehiclesId: operationData.vehicles?.id
        });
        
        setOperation(operationData);
        console.log('✅ [Operation Debug] Operation state updated');
      } else {
        console.error('❌ [Operation Debug] Response not successful or no data');
        setError('運行記録の取得に失敗しました');
      }
    } catch (err) {
      console.error('❌ [Operation Debug] Error fetching operation:', err);
      console.error('❌ [Operation Debug] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setError('運行記録の取得中にエラーが発生しました');
    }
    
    console.log('📋 [Operation Debug] === fetchOperationDetail END ===');
  };

  /**
   * 運行詳細（積込・積下）を取得
   */
  const fetchOperationActivities = async () => {
    try {
      console.log('[OperationDetailDialog] Fetching operation activities:', operationId);
      const response = await apiClient.get('/operation-details', {
        params: {
          operationId: operationId,
          page: 1,
          limit: 100
        }
      });
      
      console.log('[OperationDetailDialog] Activities response:', response);
      
      if (response.success && response.data) {
        // データ構造に応じて柔軟に対応
        let activitiesData: OperationActivity[] = [];
        const data: any = response.data;
        
        if (data.data?.data && Array.isArray(data.data.data)) {
          activitiesData = data.data.data;
        } else if (data.data && Array.isArray(data.data)) {
          activitiesData = data.data;
        } else if (Array.isArray(data)) {
          activitiesData = data;
        }
        
        // シーケンス番号でソート
        activitiesData.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        
        setActivities(activitiesData);
        console.log('[OperationDetailDialog] Activities loaded:', activitiesData.length);
      }
    } catch (err) {
      console.error('[OperationDetailDialog] Error fetching activities:', err);
      // エラーは致命的ではないので、空配列のまま継続
    }
  };

  /**
   * GPS記録を取得（フォールバック用）
   */
  const fetchGpsRecords = async () => {
    console.log('🗺️ [GPS Debug] === fetchGpsRecords START ===');
    console.log('🗺️ [GPS Debug] operationId:', operationId);
    console.log('🗺️ [GPS Debug] operation:', operation);
    
    try {
      // 運行情報からvehicleIdと期間を取得
      if (!operation) {
        console.warn('⚠️ [GPS Debug] Operation data not loaded yet - ABORTING');
        return;
      }

      const vehicleId = operation.vehicleId || operation.vehicles?.id;
      const startDate = operation.actualStartTime || operation.plannedStartTime;
      const endDate = operation.actualEndTime || new Date().toISOString();

      console.log('🗺️ [GPS Debug] Extracted params:', { 
        vehicleId, 
        startDate, 
        endDate,
        hasVehicles: !!operation.vehicles,
        vehiclesId: operation.vehicles?.id
      });

      if (!vehicleId) {
        console.error('❌ [GPS Debug] Vehicle ID not found - ABORTING');
        return;
      }

      console.log('✅ [GPS Debug] Calling API /gps/tracks with params:', { 
        vehicleIds: vehicleId, 
        startDate, 
        endDate, 
        simplify: false 
      });

      // ✅ 正しいエンドポイント: /gps/tracks
      const response = await apiClient.get('/gps/tracks', {
        params: {
          vehicleIds: vehicleId,
          startDate: startDate,
          endDate: endDate,
          simplify: false
        }
      });
      
      console.log('📡 [GPS Debug] API Response:', response);
      console.log('📡 [GPS Debug] response.success:', response.success);
      console.log('📡 [GPS Debug] response.data type:', typeof response.data);
      console.log('📡 [GPS Debug] response.data:', response.data);
      
      if (response.success && response.data) {
        let gpsData: GpsRecord[] = [];
        const data: any = response.data;
        
        console.log('🔍 [GPS Debug] Processing response data...');
        console.log('🔍 [GPS Debug] Is data array?', Array.isArray(data));
        
        // レスポンス構造の解析
        if (Array.isArray(data)) {
          console.log('📊 [GPS Debug] Data is array, length:', data.length);
          console.log('📊 [GPS Debug] First element:', data[0]);
          
          // tracks配列から最初の車両のtrackを取得
          const vehicleTrack = data.find((t: any) => t.vehicleId === vehicleId);
          
          console.log('🚗 [GPS Debug] Found vehicleTrack:', vehicleTrack);
          console.log('🚗 [GPS Debug] vehicleTrack.track exists?', !!vehicleTrack?.track);
          console.log('🚗 [GPS Debug] vehicleTrack.track length:', vehicleTrack?.track?.length);
          
          if (vehicleTrack && Array.isArray(vehicleTrack.track)) {
            console.log('✅ [GPS Debug] Processing track points...');
            gpsData = vehicleTrack.track.map((point: any, index: number) => {
              if (index < 3) {  // 最初の3ポイントのみログ
                console.log(`📍 [GPS Debug] Point ${index}:`, point);
              }
              return {
                id: `gps-${index}`,
                latitude: point.latitude,
                longitude: point.longitude,
                recordedAt: point.timestamp,
                speedKmh: point.speed || 0,
                altitude: point.altitude,
                accuracyMeters: point.accuracy,
                heading: point.heading
              };
            });
          } else {
            console.warn('⚠️ [GPS Debug] No vehicleTrack or track array found');
          }
        } else {
          console.warn('⚠️ [GPS Debug] Response data is not an array');
        }
        
        // 時刻でソート
        gpsData.sort((a, b) => 
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        );
        
        console.log('✅ [GPS Debug] Final gpsData length:', gpsData.length);
        console.log('✅ [GPS Debug] First GPS record:', gpsData[0]);
        console.log('✅ [GPS Debug] Last GPS record:', gpsData[gpsData.length - 1]);
        
        setGpsRecords(gpsData);
        console.log('✅ [GPS Debug] GPS records state updated');
      } else {
        console.warn('⚠️ [GPS Debug] Response not successful or no data');
      }
    } catch (err) {
      console.error('❌ [GPS Debug] Error fetching GPS records:', err);
      console.error('❌ [GPS Debug] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    }
    
    console.log('🗺️ [GPS Debug] === fetchGpsRecords END ===');
  };

  /**
   * 点検記録を取得
   */
  const fetchInspections = async () => {
    console.log('🔍 [Debug] fetchInspections開始', { operationId });
    
    try {
      setInspectionsLoading(true);
      
      console.log('🔍 [Debug] operationId使用', { operationId });
      
      if (!operationId) {
        console.warn('⚠️ [Debug] operationIdがnull/undefined');
        setInspectionsError('運行情報が見つかりません');
        return;
      }

      const response: any = await apiClient.get('/inspections', {
        params: { 
          operationId: operationId,
          page: 1, 
          limit: 100 
        }
      });
      
      console.log('✅ [Debug] 点検記録API応答', {
        status: response?.status,
        hasData: !!response?.data,
        dataType: typeof response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : []
      });

      // レスポンス処理
      const responseData: any = response.data;
      let inspectionsData: InspectionRecord[];
      
      if (responseData.data?.data) {
        inspectionsData = responseData.data.data as InspectionRecord[];
      } else if (responseData.data) {
        inspectionsData = responseData.data as InspectionRecord[];
      } else {
        inspectionsData = responseData as InspectionRecord[];
      }

      console.log('✅ [Debug] 点検記録データ解析完了', {
        inspectionsCount: inspectionsData.length,
        inspections: inspectionsData
      });

      setInspections(inspectionsData);
      setInspectionsError(null);

    } catch (error: any) {
      console.error('❌ [Debug] 点検記録取得エラー', {
        error: error?.message,
        response: error?.response?.data
      });
      setInspectionsError('点検記録の取得に失敗しました');
    } finally {
      setInspectionsLoading(false);
    }
  };

  /**
   * ✅ 統合タイムライン取得（OperationDebugから完全移植）
   */
  const fetchIntegratedTimeline = async (opId: string) => {
    try {
      console.log('[OperationDetailDialog] Fetching integrated timeline:', opId);
      
      const response = await apiClient.get('/operation-details', {
        params: {
          operationId: opId,
          page: 1,
          limit: 100
        }
      });
      
      console.log('[OperationDetailDialog] Timeline response:', response);
      
      if (response.success && response.data) {
        let eventsData: OperationDebugTimelineEvent[] = [];
        let operationData: OperationDetail | null = null;
        
        // ✅ 3層ネスト対応（response.data.data.data）
        const outerData: any = response.data;
        const innerData: any = outerData.data || outerData;
        
        // イベントデータ抽出（複数パターン対応）
        if (innerData.data && Array.isArray(innerData.data)) {
          eventsData = innerData.data;
          console.log('[OperationDetailDialog] ✅ Pattern 1: innerData.data (3-level nesting)');
        } else if (Array.isArray(innerData)) {
          eventsData = innerData;
          console.log('[OperationDetailDialog] ✅ Pattern 2: innerData is array');
        } else if (outerData.data && Array.isArray(outerData.data)) {
          eventsData = outerData.data;
          console.log('[OperationDetailDialog] ✅ Pattern 3: outerData.data');
        } else if (Array.isArray(outerData)) {
          eventsData = outerData;
          console.log('[OperationDetailDialog] ✅ Pattern 4: outerData is array');
        }
        
        // 運行情報抽出
        if (innerData.operation) {
          operationData = innerData.operation;
        } else if (outerData.operation) {
          operationData = outerData.operation;
        }
        
        console.log('[OperationDetailDialog] 📊 Extracted data:', {
          eventsCount: eventsData.length,
          eventTypes: eventsData.length > 0 ? Array.from(new Set(eventsData.map(e => e.eventType))) : [],
          hasOperation: !!operationData
        });
        
        setOperationDebugTimelineEvents(eventsData);
        if (operationData && !operation) {
          setOperation(operationData);
        }

        // ✅ routeGpsLogs を抽出してstateにセット
        const routeLogs = innerData.routeGpsLogs || outerData.routeGpsLogs || [];
        setRouteGpsLogs(routeLogs);
        console.log('[OperationDetailDialog] 📡 routeGpsLogs:', routeLogs.length, '件');
      }
    } catch (err) {
      console.error('[OperationDetailDialog] Error fetching timeline:', err);
    }
  };

  /**
   * ✅ 点検項目詳細取得（no-op: /debug/operations エンドポイントは存在しないため）
   */
  const fetchInspectionItemDetails = async (opId: string) => {
    console.log('[OperationDetailDialog] fetchInspectionItemDetails called (no-op):', opId);
    // この関数は何もしません（/debug/operations エンドポイントが存在しないため）
  };

  /**
   * 全データを取得
   * ✅ 修正: GPS記録はoperation情報取得後に実行
   */
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ Step 1: 運行基本情報を先に取得
      await fetchOperationDetail();
      
      // ✅ Step 2: 並行して他のデータを取得（items も取得して編集モーダルで使用）
      await Promise.all([
        fetchOperationActivities(),
        fetchIntegratedTimeline(operationId),
        fetchInspectionItemDetails(operationId),
        (async () => {
          try {
            const res = await apiClient.get('/items', { params: { page: 1, limit: 100 } });
            const d: any = res;
            const arr = d?.data?.data?.data ?? d?.data?.data ?? d?.data ?? [];
            setEditItems(Array.isArray(arr) ? arr : []);
          } catch { /* items 取得失敗は致命的ではない */ }
        })(),
        (async () => {
          try {
            const res = await apiClient.get('/customers', { params: { page: 1, limit: 200 } });
            const d: any = res;
            const arr = d?.data?.data?.customers ?? d?.data?.customers ?? d?.data?.data?.data ?? d?.data?.data ?? d?.data ?? [];
            setEditCustomers(Array.isArray(arr) ? arr : []);
          } catch { /* customers 取得失敗は致命的ではない */ }
        })(),
      ]);
      
    } catch (err) {
      console.error('[OperationDetailDialog] Error fetching data:', err);
      setError('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ===================================================================
  // Effects
  // ===================================================================
  
  useEffect(() => {
    if (isOpen && operationId) {
      // ✅ 追加: operationId変更時に全stateをリセット（古いデータの残留防止）
      setOperation(null);
      setActivities([]);
      setGpsRecords([]);
      setInspections([]);
      setOperationDebugTimelineEvents([]);
      setRouteGpsLogs([]);
      setError(null);
      setActiveTab('basic');  // タブも基本情報に戻す
      // Google Mapsインスタンスをクリア（次の運行で再初期化させる）
      mapInstanceRef.current = null;

      console.log('[OperationDetailDialog] Dialog opened, fetching data');
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, operationId]);

  // タイムラインGPSポイントがない場合のみGPS生ログをフォールバック取得
  useEffect(() => {
    if (operation && isOpen && activeTab === 'gps' && timelineGpsPoints.length === 0 && gpsRecords.length === 0) {
      console.log('🔄 [GPS Auto-fetch] No timeline GPS points, fetching raw GPS records as fallback...');
      fetchGpsRecords();
    }
  }, [operation, isOpen, activeTab, timelineGpsPoints.length]);

  // 運行情報取得後に点検記録を取得
  useEffect(() => {
    if (operation) {
      fetchInspections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation]);

  // ===================================================================
  // タイムライン統合ヘルパー関数
  // ===================================================================

  /**
   * 運行詳細と点検記録を統合したタイムラインイベントを生成
   */
  // @ts-ignore - 将来使用する可能性があるため保持
  const getTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    
    console.log('🔍 [Timeline] タイムラインイベント生成開始', {
      activitiesCount: activities.length,
      inspectionsCount: inspections.length
    });
    
    // 運行詳細（積込・積下等）をイベントに追加
    activities.forEach(activity => {
      const timestamp = activity.actualStartTime || activity.plannedTime;
      if (timestamp) {
        events.push({
          id: `activity-${activity.id}`,
          type: 'activity',
          timestamp: new Date(timestamp),
          sequenceNumber: activity.sequenceNumber,
          data: activity
        });
      }
    });
    
    // 点検記録をイベントに追加
    inspections.forEach(inspection => {
      const timestamp = inspection.startedAt;
      if (timestamp) {
        events.push({
          id: `inspection-${inspection.id}`,
          type: 'inspection',
          timestamp: new Date(timestamp),
          data: inspection
        });
      }
    });
    
    // 時系列順にソート
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    console.log('✅ [Timeline] タイムラインイベント生成完了', {
      totalEvents: events.length,
      activityEvents: events.filter(e => e.type === 'activity').length,
      inspectionEvents: events.filter(e => e.type === 'inspection').length
    });
    
    return events;
  };

  // ===================================================================
  // ヘルパー関数 - ✅ OperationDebugと完全統一
  // ===================================================================
  
  /**
   * ステータスバッジを取得
   */
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      COMPLETED: { label: '完了', className: 'bg-green-100 text-green-800' },
      IN_PROGRESS: { label: '運行中', className: 'bg-blue-100 text-blue-800' },
      CANCELLED: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
      PLANNING: { label: '計画中', className: 'bg-yellow-100 text-yellow-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PLANNING;
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  /**
   * ✅ 作業種別の情報取得 - OperationDebugと完全統一（Lucideアイコン使用）
   */
  // @ts-ignore - 将来使用する可能性があるため保持
  const getActivityTypeInfo = (activityType: string) => {
    const typeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      LOADING: { label: '積込', icon: <Truck className="w-5 h-5" />, className: 'bg-indigo-100 text-indigo-800' },
      UNLOADING: { label: '積降', icon: <Truck className="w-5 h-5" />, className: 'bg-purple-100 text-purple-800' },
      FUELING: { label: '給油', icon: <Fuel className="w-5 h-5" />, className: 'bg-orange-100 text-orange-800' },
      REFUELING: { label: '給油', icon: <Fuel className="w-5 h-5" />, className: 'bg-orange-100 text-orange-800' },
      BREAK: { label: '休憩', icon: <Coffee className="w-5 h-5" />, className: 'bg-yellow-100 text-yellow-800' },
      BREAK_START: { label: '休憩開始', icon: <Coffee className="w-5 h-5" />, className: 'bg-yellow-100 text-yellow-800' },
      BREAK_END: { label: '休憩終了', icon: <Coffee className="w-5 h-5" />, className: 'bg-amber-100 text-amber-800' },
      MAINTENANCE: { label: 'メンテナンス', icon: <AlertCircle className="w-5 h-5" />, className: 'bg-red-100 text-red-800' },
      TRANSPORTING: { label: '運搬中', icon: <Navigation className="w-5 h-5" />, className: 'bg-cyan-100 text-cyan-800' },
      WAITING: { label: '待機', icon: <Clock className="w-5 h-5" />, className: 'bg-gray-100 text-gray-800' },
      TRIP_START: { label: '運行開始', icon: <Play className="w-5 h-5" />, className: 'bg-green-100 text-green-800' },
      TRIP_END: { label: '運行終了', icon: <Square className="w-5 h-5" />, className: 'bg-red-100 text-red-800' },
      PRE_INSPECTION: { label: '運行前点検', icon: <ClipboardCheck className="w-5 h-5" />, className: 'bg-blue-100 text-blue-800' },
      POST_INSPECTION: { label: '運行後点検', icon: <ClipboardCheck className="w-5 h-5" />, className: 'bg-emerald-100 text-emerald-800' }
    };

    return typeConfig[activityType] || {
      label: activityType,
      icon: <MapPin className="w-5 h-5" />,
      className: 'bg-gray-100 text-gray-800'
    };
  };

  /**
   * ✅ イベントタイプの情報取得（OperationDebugから完全移植）
   */
  const getEventTypeInfo = (eventType: string) => {
    const typeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      TRIP_START: { label: '運行開始', icon: <Play className="w-5 h-5" />, className: 'bg-green-100 text-green-800' },
      TRIP_END: { label: '運行終了', icon: <Square className="w-5 h-5" />, className: 'bg-red-100 text-red-800' },
      PRE_INSPECTION: { label: '運行前点検', icon: <ClipboardCheck className="w-5 h-5" />, className: 'bg-blue-100 text-blue-800' },
      POST_INSPECTION: { label: '運行後点検', icon: <ClipboardCheck className="w-5 h-5" />, className: 'bg-emerald-100 text-emerald-800' },
      LOADING: { label: '積込', icon: <Truck className="w-5 h-5" />, className: 'bg-indigo-100 text-indigo-800' },
      UNLOADING: { label: '積降', icon: <Truck className="w-5 h-5" />, className: 'bg-purple-100 text-purple-800' },
      FUELING: { label: '給油', icon: <Fuel className="w-5 h-5" />, className: 'bg-orange-100 text-orange-800' },
      REFUELING: { label: '給油', icon: <Fuel className="w-5 h-5" />, className: 'bg-orange-100 text-orange-800' },
      BREAK: { label: '休憩', icon: <Coffee className="w-5 h-5" />, className: 'bg-yellow-100 text-yellow-800' },
      BREAK_START: { label: '休憩開始', icon: <Coffee className="w-5 h-5" />, className: 'bg-yellow-100 text-yellow-800' },
      BREAK_END: { label: '休憩終了', icon: <Coffee className="w-5 h-5" />, className: 'bg-amber-100 text-amber-800' },
      MAINTENANCE: { label: 'メンテナンス', icon: <AlertCircle className="w-5 h-5" />, className: 'bg-red-100 text-red-800' },
      TRANSPORTING: { label: '運搬中', icon: <Navigation className="w-5 h-5" />, className: 'bg-cyan-100 text-cyan-800' },
      WAITING: { label: '待機', icon: <Clock className="w-5 h-5" />, className: 'bg-gray-100 text-gray-800' },
      LOADING_ARRIVED:    { label: '積込場所 到着', icon: <MapPin />, className: 'bg-blue-100 text-blue-800' },
      LOADING_COMPLETED:  { label: '積込完了',     icon: <CheckCircle />, className: 'bg-indigo-100 text-indigo-800' },
      UNLOADING_ARRIVED:  { label: '積降場所 到着', icon: <MapPin />, className: 'bg-orange-100 text-orange-800' },
      UNLOADING_COMPLETED:{ label: '積降完了',     icon: <CheckCircle />, className: 'bg-purple-100 text-purple-800' },
    };

    return typeConfig[eventType] || {
      label: eventType,
      icon: <MapPin className="w-5 h-5" />,
      className: 'bg-gray-100 text-gray-800'
    };
  };

  /**
   * ✅ ヘルパー関数（OperationDebugから完全移植）
   */
  const getPassedIcon = (isPassed: boolean | null) => {
    if (isPassed === null || isPassed === undefined) {
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
    return isPassed ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const getInspectionTypeBadge = (type: string) => {
    const typeConfig: Record<string, { color: string; text: string }> = {
      PRE_OPERATION: { color: 'bg-blue-100 text-blue-800', text: '運行前点検' },
      POST_OPERATION: { color: 'bg-emerald-100 text-emerald-800', text: '運行後点検' },
      PRE_TRIP: { color: 'bg-blue-100 text-blue-800', text: '運行前点検' },
      POST_TRIP: { color: 'bg-emerald-100 text-emerald-800', text: '運行後点検' },
      PERIODIC: { color: 'bg-yellow-100 text-yellow-800', text: '定期点検' },
    };

    const config = typeConfig[type] || { color: 'bg-gray-100 text-gray-800', text: type };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  /**
   * 点検結果のバッジを取得
   */
  // @ts-ignore - 将来使用する可能性があるため保持
  const getInspectionResultBadge = (result: string) => {
    const resultConfig = {
      PASS: { label: '合格', className: 'bg-green-100 text-green-800' },
      FAIL: { label: '不合格', className: 'bg-red-100 text-red-800' },
      WARNING: { label: '警告', className: 'bg-yellow-100 text-yellow-800' }
    };

    const config = resultConfig[result as keyof typeof resultConfig] || resultConfig.WARNING;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  /**
   * 点検種別の情報取得 - OperationDebugと完全統一（Lucideアイコン使用）
   */
  // @ts-ignore - 将来使用する可能性があるため保持
  const getInspectionTypeInfo = (inspectionType: string) => {
    const typeConfig: Record<string, { label: string; icon: React.ReactNode; className: string; description: string }> = {
      PRE_TRIP: { 
        label: '運行前点検', 
        icon: <ClipboardCheck className="w-5 h-5" />, 
        className: 'bg-blue-100 text-blue-800',
        description: '運行開始前の車両点検'
      },
      POST_TRIP: { 
        label: '運行後点検', 
        icon: <ClipboardCheck className="w-5 h-5" />, 
        className: 'bg-emerald-100 text-emerald-800',
        description: '運行終了後の車両点検'
      }
    };

    return typeConfig[inspectionType] || {
      label: inspectionType,
      icon: <CheckCircle className="w-5 h-5" />,
      className: 'bg-gray-100 text-gray-800',
      description: '点検'
    };
  };

  /**
   * ✅ 時刻フォーマット - OperationDebugと統一
   */
  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  /**
   * ✅ GPS座標フォーマット - OperationDebugと統一
   */
  const formatGps = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // ===================================================================
  // レンダリング
  // ===================================================================
  
  if (!isOpen) return null;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="運行記録詳細"
      size="xl"
    >
      <div className="space-y-6">
        {/* ローディング表示 */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">データを読み込み中...</p>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* データ表示 */}
        {!loading && !error && operation && (
          <>
            {/* タブナビゲーション */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'basic'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    基本情報
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'timeline'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    運行タイムライン
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('gps')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'gps'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    GPSルート
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('inspection')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'inspection'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    点検項目
                  </div>
                </button>
              </nav>
            </div>

            {/* タブコンテンツ */}
            <div className="mt-6">
              {/* 基本情報タブ */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  {/* 基本情報セクション */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-gray-600" />
                      基本情報
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">運行番号</p>
                        <p className="font-medium text-lg">{operation.operationNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">ステータス</p>
                        {getStatusBadge(operation.status)}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">運転手</p>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <p className="font-medium">
                            {operation.usersOperationsDriverIdTousers?.name || '-'}
                          </p>
                        </div>
                      </div>
                      {(operation as any)?.customer?.name && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">客先</p>
                          <p className="font-medium text-green-700">🏢 {(operation as any).customer.name}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-500 mb-1">車両</p>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-gray-400" />
                          <p className="font-medium">
                            {operation.vehicles?.plateNumber || '-'}
                            {operation.vehicles?.model && ` (${operation.vehicles.model})`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 運行情報セクション */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-gray-600" />
                      運行情報
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">出発時刻</p>
                        <p className="font-medium">
                          {operation.actualStartTime
                            ? new Date(operation.actualStartTime).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">到着時刻</p>
                        <p className="font-medium">
                          {operation.actualEndTime
                            ? new Date(operation.actualEndTime).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">予定開始時刻</p>
                        <p className="font-medium">
                          {operation.plannedStartTime
                            ? new Date(operation.plannedStartTime).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">予定終了時刻</p>
                        <p className="font-medium">
                          {operation.plannedEndTime
                            ? new Date(operation.plannedEndTime).toLocaleString('ja-JP')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">総走行距離</p>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                          <p className="font-medium">
                            {operation.totalDistanceKm ? `${operation.totalDistanceKm} km` : '-'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">燃料消費</p>
                        <p className="font-medium">
                          {operation.fuelConsumedLiters ? `${operation.fuelConsumedLiters} L` : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 備考 */}
                  {operation.notes && (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-2">備考</h3>
                      <p className="text-gray-700">{operation.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ 運行タイムラインタブ - OperationDebugと完全統一 */}
              {activeTab === 'timeline' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-gray-600" />
                      <h2 className="text-lg font-semibold text-gray-900">運行タイムライン（統合版）</h2>
                      <span className="text-sm text-gray-500">({operationDebugTimelineEvents.length}件)</span>
                    </div>
                    <button
                      onClick={() => setShowOperationTimeline(!showOperationTimeline)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                    >
                      {showOperationTimeline ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {showOperationTimeline && operationDebugTimelineEvents.length > 0 && (
                    <div className="space-y-3">
                      {/* ─────────────────────────────────────────────
                          1日の運搬サマリカード
                      ───────────────────────────────────────────── */}
                      {(() => {
                        const _evs = operationDebugTimelineEvents;
                        // 積込・積降回数（ARRIVED = 到着した回数）
                        const loadingCount   = _evs.filter(e => e.eventType === 'LOADING_ARRIVED').length;
                        const unloadingCount = _evs.filter(e => e.eventType === 'UNLOADING_ARRIVED').length;
                        // 積込完了イベントから重量・品目を集計
                        const completedLoadings = _evs.filter(e => e.eventType === 'LOADING_COMPLETED');
                        const uniqueItems = [...new Set(
                          completedLoadings.filter(e => e.items).map(e => e.items!.name)
                        )];
                        const totalWeight = completedLoadings.reduce((sum, e) => sum + (e.quantityTons || 0), 0);
                        // 走行距離は operation state から取得
                        const distanceKm = operation?.totalDistanceKm ?? null;
                        return (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                            <div className="text-sm font-bold text-blue-800 mb-3">
                              📊 1日の運搬サマリ
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {/* 積込回数 */}
                              <div className="bg-white rounded-lg p-3 border border-blue-100 text-center shadow-sm">
                                <div className="text-2xl font-bold text-indigo-600">{loadingCount}</div>
                                <div className="text-xs text-gray-500 mt-0.5">積込回数</div>
                              </div>
                              {/* 積降回数 */}
                              <div className="bg-white rounded-lg p-3 border border-blue-100 text-center shadow-sm">
                                <div className="text-2xl font-bold text-purple-600">{unloadingCount}</div>
                                <div className="text-xs text-gray-500 mt-0.5">積降回数</div>
                              </div>
                              {/* 総重量 */}
                              <div className="bg-white rounded-lg p-3 border border-blue-100 text-center shadow-sm">
                                <div className="text-2xl font-bold text-green-600">
                                  {totalWeight > 0 ? totalWeight.toFixed(1) : '-'}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">総重量 (t)</div>
                              </div>
                              {/* 走行距離 */}
                              <div className="bg-white rounded-lg p-3 border border-blue-100 text-center shadow-sm">
                                <div className="text-2xl font-bold text-orange-600">
                                  {distanceKm != null ? Number(distanceKm).toFixed(1) : '-'}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">走行距離 (km)</div>
                              </div>
                            </div>
                            {/* 運搬品目タグ＋品目別台数 */}
                            {uniqueItems.length > 0 && (
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-gray-500 flex-shrink-0">運搬品目:</span>
                                {uniqueItems.map((name, i) => (
                                  <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* 品目別台数集計（LOADING_COMPLETEDイベントから集計） */}
                            {(() => {
                              const itemCountMap: Record<string, number> = {};
                              completedLoadings.forEach(e => {
                                if (e.items?.name) {
                                  itemCountMap[e.items.name] = (itemCountMap[e.items.name] || 0) + 1;
                                }
                              });
                              const entries = Object.entries(itemCountMap);
                              if (entries.length === 0) return null;
                              return (
                                <div className="mt-2">
                                  <span className="text-xs text-gray-500 block mb-1">品目別台数:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {entries.map(([itemName, count]) => (
                                      <span key={itemName} className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded font-bold">
                                        {itemName}: {count}台
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                      {/* ─────────────────────────────────────────────
                          タイムラインイベント一覧
                      ───────────────────────────────────────────── */}
                      {(() => {
                        // ─────────────────────────────────────────────
                        // イベントをグループ化:
                        //   LOADING_ARRIVED + LOADING_COMPLETED   → 積込セクション
                        //   UNLOADING_ARRIVED + UNLOADING_COMPLETED → 積降セクション
                        //   それ以外 → 単独イベント（既存表示）
                        // ─────────────────────────────────────────────
                        type RenderGroup =
                          | { type: 'LOADING_GROUP';   groupNum: number; arrivedEvent: OperationDebugTimelineEvent; completedEvent: OperationDebugTimelineEvent | null }
                          | { type: 'UNLOADING_GROUP'; groupNum: number; arrivedEvent: OperationDebugTimelineEvent; completedEvent: OperationDebugTimelineEvent | null }
                          | { type: 'SINGLE'; event: OperationDebugTimelineEvent };
 
                        const groups: RenderGroup[] = [];
                        let loadingGroupNum  = 0;
                        let unloadingGroupNum = 0;
                        let idx = 0;
                        const evs = operationDebugTimelineEvents;
 
                        while (idx < evs.length) {
                          const ev = evs[idx];
                          if (ev.eventType === 'LOADING_ARRIVED') {
                            loadingGroupNum++;
                            const next = idx + 1 < evs.length && evs[idx + 1].eventType === 'LOADING_COMPLETED'
                              ? evs[idx + 1] : null;
                            groups.push({ type: 'LOADING_GROUP', groupNum: loadingGroupNum, arrivedEvent: ev, completedEvent: next });
                            idx += next ? 2 : 1;
                          } else if (ev.eventType === 'UNLOADING_ARRIVED') {
                            unloadingGroupNum++;
                            const next = idx + 1 < evs.length && evs[idx + 1].eventType === 'UNLOADING_COMPLETED'
                              ? evs[idx + 1] : null;
                            groups.push({ type: 'UNLOADING_GROUP', groupNum: unloadingGroupNum, arrivedEvent: ev, completedEvent: next });
                            idx += next ? 2 : 1;
                          } else {
                            // LOADING_COMPLETED / UNLOADING_COMPLETED が孤立している場合も単独表示
                            groups.push({ type: 'SINGLE', event: ev });
                            idx++;
                          }
                        }
 
                        // ─────────────────────────────────────────────
                        // タイムスタンプ整形ユーティリティ
                        // ─────────────────────────────────────────────
                        const fmtTs = (ts: string | null) =>
                          ts ? new Date(ts).toLocaleString('ja-JP', {
                            month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          }) : '-';
 
                        // ─────────────────────────────────────────────
                        // サブイベント1行のレンダリングヘルパー
                        // isArrived=true の場合: 場所・GPS・時刻のみ表示（コンテンツ非表示）
                        // isArrived=false の場合: items・重量・手書き備考を表示
                        // ─────────────────────────────────────────────
                        // 自動生成されたデフォルト備考 → 表示しない
                        const AUTO_NOTES = ['積込完了', '積降完了'];

                        const renderSubRow = (
                          subEvent: OperationDebugTimelineEvent,
                          labelText: string,
                          dotColor: string,
                          isFirst: boolean,
                          isArrived: boolean = false,
                          editBtn?: React.ReactNode
                        ) => (
                          <div className={`px-4 py-3 flex items-start gap-3 ${isFirst ? '' : 'border-t border-gray-100'}`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-800">▶ {labelText}</span>
                                {subEvent.timestamp && (
                                  <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                                    記録時刻: {fmtTs(subEvent.timestamp)}
                                  </span>
                                )}
                                {editBtn && <span className="ml-auto">{editBtn}</span>}
                              </div>
                              {subEvent.location && (
                                <div className="flex items-start gap-1 mt-1 text-xs text-gray-600">
                                  <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <span className="break-all">{subEvent.location.name} {subEvent.location.address}</span>
                                </div>
                              )}
                              {subEvent.gpsLocation && (
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                                  <Navigation className="w-3 h-3 flex-shrink-0" />
                                  <span>
                                    GPS座標: {subEvent.gpsLocation.latitude.toFixed(6)}, {subEvent.gpsLocation.longitude.toFixed(6)}
                                  </span>
                                </div>
                              )}
                              {/* 品目 - 完了イベントのみ表示（到着行は場所情報のみ） */}
                              {!isArrived && subEvent.items && (
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-600">
                                  <Package className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  <span>
                                    品目: {subEvent.items.name}
                                    {subEvent.items.unit ? ` (${subEvent.items.unit})` : ''}
                                  </span>
                                </div>
                              )}
                              {/* ⚖️ 重量 - 完了イベントのみ表示 */}
                              {!isArrived && subEvent.quantityTons !== undefined && subEvent.quantityTons > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="inline-flex items-center text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                                    ⚖️ 重量: {Number(subEvent.quantityTons).toFixed(1)} t
                                  </span>
                                </div>
                              )}
                              {/* 備考（手書き内容）- 完了イベントのみ、自動生成テキストは非表示 */}
                              {!isArrived && subEvent.notes && !AUTO_NOTES.includes(subEvent.notes) && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  備考: {subEvent.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        );
 
                        // ─────────────────────────────────────────────
                        // グループ描画
                        // ─────────────────────────────────────────────
                        return groups.map((group, gIdx) => {
                          if (group.type === 'LOADING_GROUP' || group.type === 'UNLOADING_GROUP') {
                            const isLoading     = group.type === 'LOADING_GROUP';
                            const groupLabel    = isLoading ? '積込' : '積降';
                            const borderCls     = isLoading ? 'border-indigo-400' : 'border-purple-400';
                            const headerBg      = isLoading ? 'bg-indigo-50 border-indigo-200' : 'bg-purple-50 border-purple-200';
                            const headerTextCls = isLoading ? 'text-indigo-800' : 'text-purple-800';
                            const arrivedDot    = isLoading ? 'bg-blue-400' : 'bg-orange-400';
                            const completedDot  = 'bg-green-400';
 
                            return (
                              <div key={`group-${gIdx}`} className={`border-2 ${borderCls} rounded-lg overflow-hidden`}>
                                {/* グループヘッダー */}
                                <div className={`${headerBg} border-b px-4 py-2 flex items-center gap-2`}>
                                  <Truck className={`w-4 h-4 ${headerTextCls} flex-shrink-0`} />
                                  <span className={`text-sm font-bold ${headerTextCls}`}>
                                    {groupLabel}
                                    {group.groupNum > 1 && `（${group.groupNum}回目）`}
                                  </span>
                                  {group.arrivedEvent.location && (
                                    <span className="text-xs text-gray-500 truncate flex-1">
                                      ─ {group.arrivedEvent.location.name}
                                    </span>
                                  )}
                                  {/* ヘッダー編集ボタンは廃止 → 各サブ行に個別ボタンを配置 */}
                                </div>
                                {/* サブイベント */}
                                <div className="bg-white">
                                  {renderSubRow(group.arrivedEvent, '到着', arrivedDot, true, true,
                                    <button type="button"
                                      onClick={() => setEditEvent({
                                        id: group.arrivedEvent.id,
                                        realDetailId: group.arrivedEvent.id.replace(/-arrived$|-completed$/, ''),
                                        eventType: group.arrivedEvent.eventType,
                                        timestamp: group.arrivedEvent.timestamp,
                                        notes: group.arrivedEvent.notes,
                                        quantityTons: group.arrivedEvent.quantityTons,
                                        locationName: group.arrivedEvent.location?.name ?? '',
                                        locationId: group.arrivedEvent.location?.id ?? '',
                                        // ✅ Fix3: GPS記録座標を優先、なければ場所マスター座標
                                        locationLat: group.arrivedEvent.gpsLocation?.latitude ?? group.arrivedEvent.location?.latitude ?? null,
                                        locationLng: group.arrivedEvent.gpsLocation?.longitude ?? group.arrivedEvent.location?.longitude ?? null,
                                        itemId: group.arrivedEvent.items?.id ?? null,
                                        itemName: group.arrivedEvent.items?.name ?? null,
                                        customerId: (group.arrivedEvent as any).customerId ?? null,
                                        customerName: (group.arrivedEvent as any).customerName ?? null,
                                      })}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                    ><Pencil className="w-3 h-3" /> 編集</button>
                                  )}
                                  {group.completedEvent && renderSubRow(
                                    group.completedEvent,
                                    isLoading ? '積込完了' : '積降完了',
                                    completedDot,
                                    false,
                                    false,
                                    <button type="button"
                                      onClick={() => setEditEvent({
                                        id: group.completedEvent!.id,
                                        realDetailId: group.completedEvent!.id.replace(/-arrived$|-completed$/, ''),
                                        eventType: group.completedEvent!.eventType,
                                        timestamp: group.completedEvent!.timestamp,
                                        notes: group.completedEvent!.notes,
                                        quantityTons: group.completedEvent!.quantityTons,
                                        locationName: group.completedEvent!.location?.name ?? '',
                                        locationId: group.completedEvent!.location?.id ?? '',
                                        // ✅ Fix3: GPS記録座標を優先
                                        locationLat: group.completedEvent!.gpsLocation?.latitude ?? group.completedEvent!.location?.latitude ?? null,
                                        locationLng: group.completedEvent!.gpsLocation?.longitude ?? group.completedEvent!.location?.longitude ?? null,
                                        detailItems: (group.completedEvent as any).detailItems ?? null,
                                        itemId: group.completedEvent!.items?.id ?? null,
                                        itemName: group.completedEvent!.items?.name ?? null,
                                        customerId: (group.completedEvent as any).customerId ?? null,
                                        customerName: (group.completedEvent as any).customerName ?? null,
                                      })}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                    ><Pencil className="w-3 h-3" /> 編集</button>
                                  )}
                                </div>
                              </div>
                            );
                          }
 
                          // ─────────────────────────────────────────
                          // 通常イベント（TRIP_START/END, 点検, 給油, 休憩等）
                          // ─────────────────────────────────────────
                          const { event } = group;
                          const typeInfo = getEventTypeInfo(event.eventType);
                          return (
                            <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                {/* シーケンス番号 */}
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm font-semibold text-blue-600">{event.sequenceNumber}</span>
                                </div>
 
                                <div className="flex-1">
                                  {/* イベント種別と時刻 + 編集ボタン */}
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className={`px-3 py-1 text-sm font-semibold rounded-lg inline-flex items-center gap-2 ${typeInfo.className}`}>
                                      {typeInfo.icon}
                                      {typeInfo.label}
                                    </span>
                                    {event.timestamp && (
                                      <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                        記録時刻: {fmtTs(event.timestamp)}
                                      </span>
                                    )}
                                    {/* ✅ 編集ボタン */}
                                    <button
                                      type="button"
                                      onClick={() => setEditEvent({
                                        id: event.id,
                                        realDetailId: event.id.replace(/-arrived$|-completed$/, ''),
                                        eventType: event.eventType,
                                        timestamp: event.timestamp,
                                        notes: event.notes,
                                        quantityTons: event.quantityTons,
                                        fuelCostYen: (event as any).fuelCostYen ?? null,
                                        detailItems: (event as any).detailItems ?? null,
                                        locationName: event.location?.name ?? '',
                                        locationId: event.location?.id ?? '',
                                        locationLat: event.gpsLocation?.latitude ?? event.location?.latitude ?? null,
                                        locationLng: event.gpsLocation?.longitude ?? event.location?.longitude ?? null,
                                        itemId: event.items?.id ?? null,
                                        itemName: event.items?.name ?? null,
                                        customerId: (event as any).customerId ?? null,
                                        customerName: (event as any).customerName ?? null,
                                        preinspMemo: event.eventType === 'PRE_INSPECTION' ? ((event as any).overallNotes ?? '') : null,
                                      })}
                                      className="ml-auto flex items-center gap-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                      title="このイベントを編集"
                                    >
                                      <Pencil className="w-3 h-3" /> 編集
                                    </button>
                                  </div>
 
                                  {/* 場所情報 */}
                                  {event.location && (
                                    <div className="flex items-start gap-2 text-sm text-gray-600 mb-2">
                                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="font-medium">{event.location.name}</p>
                                        <p className="text-xs text-gray-500">{event.location.address}</p>
                                      </div>
                                    </div>
                                  )}
 
                                  {/* GPS座標 */}
                                  {event.gpsLocation && (
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                      <Navigation className="w-3 h-3 flex-shrink-0" />
                                      <span>
                                        GPS座標: {event.gpsLocation.latitude.toFixed(6)}, {event.gpsLocation.longitude.toFixed(6)}
                                      </span>
                                    </div>
                                  )}
 
                                  {/* 品目・数量 */}
                                  {event.items && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                      <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      <span>
                                        品目: {event.items.name}
                                        {event.quantityTons ? ` ${event.quantityTons}t` : ''}
                                      </span>
                                    </div>
                                  )}
 
                                  {/* 点検詳細 */}
                                  {event.inspectionDetails && (
                                    <div className="bg-gray-50 rounded-lg p-3 mb-2">
                                      <div className="flex items-center gap-4 text-sm">
                                        <span className="text-gray-600">
                                          ステータス:
                                          <span className={`ml-1 font-medium ${
                                            event.inspectionDetails.status === 'COMPLETED' ? 'text-green-600' :
                                            event.inspectionDetails.status === 'IN_PROGRESS' ? 'text-blue-600' :
                                            'text-gray-600'
                                          }`}>
                                            {event.inspectionDetails.status === 'COMPLETED' ? '完了' :
                                             event.inspectionDetails.status === 'IN_PROGRESS' ? '実施中' : '待機中'}
                                          </span>
                                        </span>
                                        <span className="text-gray-600">
                                          合格: <span className="font-medium text-green-600">{event.inspectionDetails.passedItems}</span>
                                          /{event.inspectionDetails.totalItems}項目
                                        </span>
                                        {event.inspectionDetails.failedItems > 0 && (
                                          <span className="text-red-600 font-medium">
                                            不合格: {event.inspectionDetails.failedItems}件
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
 
                                  {/* 備考 */}
                                  {event.notes && (
                                    <div className="text-sm text-gray-600 mt-2">
                                      <span className="font-medium">備考:</span> {event.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {operationDebugTimelineEvents.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      タイムラインデータがありません
                    </div>
                  )}
                </div>
              )}

              {/* ✅ GPSルートタブ - Google Maps実装 */}
              {activeTab === 'gps' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-gray-600" />
                    GPSルート ({timelineGpsPoints.length > 0 ? timelineGpsPoints.length : gpsRecords.length}ポイント)
                    {routeGpsLogs.length > 0 && (
                      <span className="text-sm font-normal text-blue-600 ml-2">
                        走行軌跡: {routeGpsLogs.length}件
                      </span>
                    )}
                  </h3>

                  {/* 凡例 */}
                  {(routeGpsLogs.length > 0 || timelineGpsPoints.length > 0) && (
                    <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                      <span className="font-medium text-gray-700">凡例:</span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-6 h-0.5 bg-blue-600 rounded" style={{ height: '3px' }}></span>
                        走行軌跡（GPS実測ログ）
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-6 h-0.5 bg-emerald-500 rounded" style={{ height: '2px' }}></span>
                        イベント接続線
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                        S: 運行開始
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                        E: 運行終了
                      </span>
                    </div>
                  )}
                  
                  {/* ✅ 常に地図エリアを表示 */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
                    {/* Google Mapsエラー表示 */}
                    {mapError ? (
                      <div className="flex items-center justify-center h-96 bg-red-50">
                        <div className="text-center p-8">
                          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                          <h4 className="text-lg font-semibold text-red-900 mb-2">地図の読み込みエラー</h4>
                          <p className="text-red-700">{mapError}</p>
                        </div>
                      </div>
                    ) : !mapsLoaded ? (
                      <div className="flex items-center justify-center h-96 bg-blue-50">
                        <div className="text-center p-8">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <h4 className="text-lg font-semibold text-blue-900 mb-2">Google Mapsを読み込み中...</h4>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        {/* ✅ Google Maps コンテナ - 常に表示 */}
                        <div 
                          ref={mapRef}
                          className="w-full h-96"
                          style={{ minHeight: '400px', backgroundColor: '#e5e7eb' }}
                        />
                        
                        {/* ✅ GPS記録なしオーバーレイ */}
                        {timelineGpsPoints.length === 0 && gpsRecords.length === 0 && routeGpsLogs.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
                            <div className="text-center p-8">
                              <Navigation className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                              <h4 className="text-lg font-semibold text-gray-700 mb-2">GPS記録がありません</h4>
                              <p className="text-sm text-gray-500">この運行にはGPS記録が存在しません</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 地図情報パネル */}
                    <div className="bg-gray-50 p-4 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">総走行距離</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {operation?.totalDistanceKm || 0} km
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">GPS記録ポイント</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {timelineGpsPoints.length > 0 ? timelineGpsPoints.length : gpsRecords.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">運行時間</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {operation?.actualStartTime && operation?.actualEndTime
                              ? `${Math.round(
                                  (new Date(operation.actualEndTime).getTime() -
                                    new Date(operation.actualStartTime).getTime()) /
                                    (1000 * 60)
                                )} 分`
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GPS記録リスト */}
                  {gpsRecords.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">GPS記録サマリー</h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {gpsRecords.slice(0, 10).map((record, index) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between bg-white p-3 rounded border border-gray-200"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                              <div>
                                <p className="text-sm font-medium">
                                  {new Date(record.recordedAt).toLocaleString('ja-JP')}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatGps(record.latitude, record.longitude)}
                                </p>
                              </div>
                            </div>
                            {record.speedKmh !== undefined && (
                              <div className="text-sm text-gray-600">{record.speedKmh} km/h</div>
                            )}
                          </div>
                        ))}
                        {gpsRecords.length > 10 && (
                          <p className="text-sm text-gray-500 text-center py-2">
                            他 {gpsRecords.length - 10} 件の記録
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ 点検項目詳細タブ - OperationDebugテーブル表示に完全置き換え */}
              {activeTab === 'inspection' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-gray-600" />
                      <h2 className="text-lg font-semibold text-gray-900">点検項目 ({inspectionItemDetails.length}件)</h2>
                    </div>
                    <button
                      onClick={() => setShowInspectionDetails(!showInspectionDetails)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                    >
                      {showInspectionDetails ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {showInspectionDetails && inspectionItemDetails.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検種別</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検項目名</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">結果</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">判定</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">不具合レベル</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">備考</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点検日時</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {inspectionItemDetails.map((item) => (
                            <tr key={`${item.inspectionRecordId}-${item.inspectionItemId}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">
                                {getInspectionTypeBadge(item.inspectionType)}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {item.inspectionItemName}
                                {item.inspectionItemDescription && (
                                  <p className="text-xs text-gray-500 mt-1">{item.inspectionItemDescription}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                  {item.inspectionItemCategory || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{item.resultValue || '-'}</td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  {getPassedIcon(item.isPassed)}
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    item.isPassed === null ? 'bg-gray-100 text-gray-700' :
                                    item.isPassed ? 'bg-green-100 text-green-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {item.isPassed === null ? '未実施' : item.isPassed ? '合格' : '不合格'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{item.defectLevel || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{item.notes || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{formatTime(item.checkedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {inspectionItemDetails.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      点検項目データがありません
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* フッター - アクションボタン */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <Button variant="outline" onClick={onClose}>
                閉じる
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>

    {/* ✅ イベント編集モーダル */}
    {editEvent && (
      <CmsActivityEditModal
        event={editEvent}
        operationId={operationId}
        items={editItems}
        customers={editCustomers}
        onClose={() => setEditEvent(null)}
        onSaved={() => {
          setEditEvent(null);
          fetchIntegratedTimeline(operationId);
        }}
        onDeleted={(id) => {
          setEditEvent(null);
          setOperationDebugTimelineEvents(prev => prev.filter(e => e.id !== id));
        }}
      />
    )}
    </>
  );
};

export default OperationDetailDialog;