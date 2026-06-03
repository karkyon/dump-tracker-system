// =====================================
// frontend/cms/src/pages/GPSMonitoring.tsx
// GPSモニタリング画面 - 改修版
// 変更内容:
//   1. ステータス体系再設計（運転中廃止→運行中が親概念）
//      運行中の中に: 積込中/荷降中/休憩中/給油中/運行中オフライン
//   2. MAPエリア拡大
//   3. 車両マーカー: ダンプSVGアイコン + リストNo表示
//   4. 車両カードクリック: pingアニメーション + 本日経路トレース
// 最終更新: 2026年5月
// =====================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTLog } from '../hooks/useTLog';
import { RefreshCw, MapPin, Truck, Clock, Navigation, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { apiClient } from '../utils/api';

// =====================================
// 型定義
// =====================================

/** バックエンドAPIレスポンスの車両位置情報 */
interface ApiVehiclePosition {
  vehicleId: string;
  plateNumber: string;
  vehicleModel: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  position: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
    recordedAt: string;
  } | null;
  activeOperation: {
    id: string;
    status: string;
    driver: {
      id: string;
      name: string;
    } | null;
    // 🆕 最新のOperationDetailのactivityType
    lastActivityType: string | null;
  } | null;
}

/** フロントエンド表示用の車両位置情報 */
interface VehicleLocation {
  id: string;
  vehicleNumber: string;
  driverName: string;
  latitude: number | null;
  longitude: number | null;
  // ステータス体系（2026年5月改修）
  // 「運行中」が親概念:
  //   - loading       : 積込中
  //   - unloading     : 荷降中
  //   - break         : 休憩中
  //   - refueling     : 給油中
  //   - in_op_offline : 運行中だがオフライン
  // 「運行外」:
  //   - offline       : 運行していない
  status: 'loading' | 'unloading' | 'break' | 'refueling' | 'in_operation' | 'in_op_offline' | 'offline';
  lastUpdate: string | null;
  speed: number;
  currentAddress: string;
  vehicleModel: string;
  operationId: string | null;
}

/** ステータス表示設定 */
interface StatusConfig {
  label: string;
  className: string;
  icon: string;
  color: string;
  isInOperation: boolean;
}

/** 本日の運行経路ポイント */
interface RoutePoint {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh: number | null;
}

// =====================================
// ユーティリティ関数
// =====================================

/**
 * バックエンドのステータスをフロントエンド表示用ステータスに変換
 *
 * 「運転中」ステータスは廃止。
 * 1. MAINTENANCE / OUT_OF_SERVICE → offline
 * 2. IN_USE または activeOperation(IN_PROGRESS) あり → 運行中
 *    → position あり（オンライン）: loading（停車中の代表表現）
 *    → position なし（オフライン）: in_op_offline
 * 3. それ以外 → offline
 */
const mapVehicleStatus = (
  apiStatus: ApiVehiclePosition['status'],
  hasActiveOperation: boolean,
  hasPosition: boolean,
  lastActivityType: string | null
): VehicleLocation['status'] => {
  if (apiStatus === 'MAINTENANCE' || apiStatus === 'OUT_OF_SERVICE') return 'offline';

  if (apiStatus === 'IN_USE' || hasActiveOperation) {
    if (!hasPosition) return 'in_op_offline';

    // 最新のOperationDetailのactivityTypeでサブステータスを判別
    if (lastActivityType) {
      const t = lastActivityType.toUpperCase();
      if (t.includes('LOADING'))   return 'loading';
      if (t.includes('UNLOADING')) return 'unloading';
      if (t.includes('BREAK'))     return 'break';
      if (t.includes('REFUEL') || t === 'REFUELING') return 'refueling';
    }
    // activityTypeが取れない場合は運行中（汎用）
    return 'in_operation';
  }

  return 'offline';
};

/**
 * APIレスポンスをフロントエンド表示用に変換
 */
const mapApiToVehicleLocation = (api: ApiVehiclePosition): VehicleLocation => {
  const speed = api.position?.speed ?? 0;
  const hasActiveOperation =
    api.activeOperation !== null &&
    api.activeOperation?.status === 'IN_PROGRESS';
  const hasPosition = api.position !== null;
  const lastActivityType = api.activeOperation?.lastActivityType ?? null;
  const status = mapVehicleStatus(api.status, hasActiveOperation, hasPosition, lastActivityType);
  const driverName = api.activeOperation?.driver?.name ?? '未割当';
  const currentAddress = api.position
    ? `${api.position.latitude.toFixed(5)}, ${api.position.longitude.toFixed(5)}`
    : '位置情報なし';
  return {
    id: api.vehicleId,
    vehicleNumber: api.plateNumber,
    driverName,
    latitude: api.position?.latitude ?? null,
    longitude: api.position?.longitude ?? null,
    status,
    lastUpdate: api.position?.recordedAt ?? null,
    speed,
    currentAddress,
    vehicleModel: api.vehicleModel,
    operationId: api.activeOperation?.id ?? null,
  };
};

/**
 * ステータス設定を取得
 */
const getStatusConfig = (status: string): StatusConfig => {
  const configs: Record<string, StatusConfig> = {
    loading: {
      label: '積込中',
      className: 'bg-orange-100 text-orange-800',
      icon: '📦',
      color: '#c2410c',
      isInOperation: true,
    },
    unloading: {
      label: '荷降中',
      className: 'bg-purple-100 text-purple-800',
      icon: '📤',
      color: '#7e22ce',
      isInOperation: true,
    },
    break: {
      label: '休憩中',
      className: 'bg-yellow-100 text-yellow-800',
      icon: '☕',
      color: '#a16207',
      isInOperation: true,
    },
    refueling: {
      label: '給油中',
      className: 'bg-green-100 text-green-800',
      icon: '⛽',
      color: '#15803d',
      isInOperation: true,
    },
    in_operation: {
      label: '運行中',
      className: 'bg-blue-100 text-blue-800',
      icon: '🚛',
      color: '#1d4ed8',
      isInOperation: true,
    },
    in_op_offline: {
      label: '運行中（オフライン）',
      className: 'bg-red-100 text-red-700',
      icon: '📵',
      color: '#b91c1c',
      isInOperation: true,
    },
    offline: {
      label: 'オフライン',
      className: 'bg-gray-100 text-gray-600',
      icon: '⚪',
      color: '#4b5563',
      isInOperation: false,
    },
  };
  return configs[status] ?? configs.offline;
};

/**
 * 最終更新からの経過時間を日本語で返す
 */
const getTimeSinceUpdate = (lastUpdate: string): string => {
  const updateTime = new Date(lastUpdate);
  if (isNaN(updateTime.getTime())) return '不明';
  const diffInMinutes = Math.floor((Date.now() - updateTime.getTime()) / (1000 * 60));
  if (diffInMinutes < 1) return '1分未満前';
  if (diffInMinutes < 60) return `${diffInMinutes}分前`;
  const hours = Math.floor(diffInMinutes / 60);
  return `${hours}時間前`;
};

// =====================================
// Google Maps ユーティリティ
// =====================================

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
    console.warn('[GPSMonitoring] Google Maps APIキーが未設定');
    return;
  }
  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker,places&language=ja&region=JP`;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  script.onerror = () => console.error('[GPSMonitoring] Google Maps API読み込み失敗');
  document.head.appendChild(script);
};

// =====================================
// ダンプトラックSVGマーカー生成
// =====================================

const createDumpTruckMarkerElement = (color: string, listNo: number): HTMLElement => {
  const container = document.createElement('div');
  container.style.cssText = 'position:relative;display:inline-block;cursor:pointer;';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 36 24');
  svg.setAttribute('width', '42');
  svg.setAttribute('height', '28');
  svg.style.cssText = 'display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.5));';

  const addRect = (x: string, y: string, w: string, h: string, rx: string, fill: string) => {
    const el = document.createElementNS(svgNS, 'rect');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('width', w); el.setAttribute('height', h);
    el.setAttribute('rx', rx); el.setAttribute('fill', fill);
    svg.appendChild(el);
  };
  const addCircle = (cx: string, cy: string, r: string, fill: string) => {
    const el = document.createElementNS(svgNS, 'circle');
    el.setAttribute('cx', cx); el.setAttribute('cy', cy);
    el.setAttribute('r', r); el.setAttribute('fill', fill);
    svg.appendChild(el);
  };

  addRect('0', '2', '24', '14', '2', color);          // 荷台
  addRect('24', '6', '12', '10', '2', color);          // キャブ
  addRect('26', '8', '8', '5', '1', 'rgba(255,255,255,0.7)'); // 窓
  addCircle('29', '18', '3.5', '#1f2937');             // 前輪
  addCircle('29', '18', '1.5', '#9ca3af');
  addCircle('8',  '18', '3.5', '#1f2937');             // 後輪1
  addCircle('8',  '18', '1.5', '#9ca3af');
  addCircle('16', '18', '3.5', '#1f2937');             // 後輪2
  addCircle('16', '18', '1.5', '#9ca3af');

  container.appendChild(svg);

  const badge = document.createElement('div');
  badge.textContent = String(listNo);
  badge.style.cssText = `position:absolute;top:-6px;right:-6px;background:white;color:#1f2937;font-size:9px;font-weight:700;border:1.5px solid ${color};border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;line-height:1;`;
  container.appendChild(badge);

  return container;
};

// =====================================
// pingアニメーションCSS（1回だけ注入）
// =====================================
let pingCssInjected = false;
const injectPingCss = (): void => {
  if (pingCssInjected) return;
  pingCssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes gps-ping {
      0%   { transform: scale(1);   opacity: 1; }
      50%  { transform: scale(2.8); opacity: 0.4; }
      100% { transform: scale(1);   opacity: 1; }
    }
    .gps-ping-ring {
      position:absolute;top:50%;left:50%;
      width:48px;height:28px;
      margin:-14px 0 0 -24px;
      border-radius:50%;
      border:3px solid #ef4444;
      animation: gps-ping 0.65s ease-in-out infinite;
      pointer-events:none;
      z-index:10;
    }
  `;
  document.head.appendChild(style);
};

// =====================================
// 定数
// =====================================

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_CENTER = { lat: 34.6617, lng: 133.9349 };

const ALL_STATUS_KEYS: VehicleLocation['status'][] = [
  'loading', 'unloading', 'break', 'refueling', 'in_operation', 'in_op_offline', 'offline'
];

// =====================================
// メインコンポーネント
// =====================================

const GPSMonitoring: React.FC = () => {
  useTLog('GPS_MONITORING', 'GPS監視');

  const [searchQuery, setSearchQuery]       = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const [vehicles, setVehicles]             = useState<VehicleLocation[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [lastRefresh, setLastRefresh]       = useState(new Date());
  const [isConnected, setIsConnected]       = useState(true);
  const [mapsLoaded, setMapsLoaded]         = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const mapRef          = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<google.maps.Map | null>(null);
  const markersRef      = useRef<Map<string, any>>(new Map());
  const infoWindowRef   = useRef<google.maps.InfoWindow | null>(null);
  const routePolyRef    = useRef<any>(null);
  const pingRingRef     = useRef<HTMLElement | null>(null);

  // =====================================
  // データ取得 & ポーリング
  // =====================================

  const fetchVehiclePositions = useCallback(async (isManual = false): Promise<void> => {
    if (isManual) setLoading(true);
    try {
      const response = await apiClient.get<any>('/gps/realtime/vehicles');
      if (!response.success) throw new Error(response.message ?? '車両位置情報の取得に失敗しました');
      const rawData = response.data;
      const apiPositions: ApiVehiclePosition[] = Array.isArray(rawData?.data)
        ? rawData.data : Array.isArray(rawData) ? rawData : [];
      setVehicles(apiPositions.map(mapApiToVehicleLocation));
      setLastRefresh(new Date());
      setIsConnected(true);
      setError(null);
    } catch (err: any) {
      console.error('[GPSMonitoring] データ取得エラー:', err);
      setIsConnected(false);
      setError(err.message ?? 'データの取得中にエラーが発生しました');
    } finally {
      if (isManual) setLoading(false);
    }
  }, []);

  const handleRefresh = (): void => { fetchVehiclePositions(true); };

  useEffect(() => {
    fetchVehiclePositions(true);
    const timer = setInterval(() => fetchVehiclePositions(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchVehiclePositions]);

  // =====================================
  // Google Maps 初期化
  // =====================================

  useEffect(() => {
    injectPingCss();
    const initMap = (): void => {
      if (!mapRef.current || !window.google) return;
      const map = new window.google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapId: 'DEMO_MAP_ID',
      });
      mapInstanceRef.current = map;
      infoWindowRef.current  = new window.google.maps.InfoWindow();
      setMapsLoaded(true);
    };
    loadGoogleMapsScript(initMap);
  }, []);

  // =====================================
  // マーカー更新（車両データ変更時）
  // =====================================

  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current || !infoWindowRef.current) return;
    const map          = mapInstanceRef.current;
    const infoWindow   = infoWindowRef.current;
    const existingMarkers = markersRef.current;
    const currentIds   = new Set<string>();

    const allWithPos = vehicles.filter(v => v.latitude !== null && v.longitude !== null);

    allWithPos.forEach((vehicle, idx) => {
      currentIds.add(vehicle.id);
      const position = { lat: vehicle.latitude!, lng: vehicle.longitude! };
      const cfg      = getStatusConfig(vehicle.status);
      const listNo   = idx + 1;

      const infoContent = `
        <div style="padding:10px;min-width:200px;font-family:sans-serif;font-size:13px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#1f2937;">
            <span style="background:${cfg.color};color:white;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;margin-right:6px;">${listNo}</span>
            ${vehicle.vehicleNumber}
          </div>
          <div style="color:#6b7280;margin-bottom:4px;">${vehicle.vehicleModel}</div>
          <div style="margin-bottom:4px;">👤 ${vehicle.driverName}</div>
          <div style="margin-bottom:6px;">${cfg.icon} <span style="font-weight:600;color:${cfg.color}">${cfg.label}</span></div>
          ${vehicle.speed > 0 ? `<div style="margin-bottom:4px;">🚛 ${vehicle.speed.toFixed(1)} km/h</div>` : ''}
          <div style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:6px;margin-top:4px;">
            📍 ${vehicle.latitude?.toFixed(5)}, ${vehicle.longitude?.toFixed(5)}<br/>
            🕐 ${vehicle.lastUpdate ? getTimeSinceUpdate(vehicle.lastUpdate) : '未更新'}
          </div>
        </div>`;

      if (existingMarkers.has(vehicle.id)) {
        const marker = existingMarkers.get(vehicle.id)!;
        marker.position = position;
        marker.content  = createDumpTruckMarkerElement(cfg.color, listNo);
      } else {
        const markerEl = createDumpTruckMarkerElement(cfg.color, listNo);
        const marker   = new window.google.maps.marker.AdvancedMarkerElement({
          position, map, title: vehicle.vehicleNumber, content: markerEl,
        });
        marker.addListener('click', () => {
          infoWindow.setContent(infoContent);
          infoWindow.open(map, marker);
        });
        existingMarkers.set(vehicle.id, marker);
      }
      // InfoWindow内容を常に最新に
      const marker = existingMarkers.get(vehicle.id)!;
      marker.addListener('click', () => {
        infoWindow.setContent(infoContent);
        infoWindow.open(map, marker);
      });
    });

    existingMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.setMap(null); existingMarkers.delete(id); }
    });
  }, [vehicles, mapsLoaded]);

  // =====================================
  // 車両カードクリック: ping + 経路トレース
  // =====================================

  const handleVehicleCardClick = useCallback(async (vehicle: VehicleLocation): Promise<void> => {
    setSelectedVehicleId(vehicle.id);
    if (!mapsLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // 地図フォーカス
    if (vehicle.latitude !== null && vehicle.longitude !== null) {
      map.panTo({ lat: vehicle.latitude, lng: vehicle.longitude });
      map.setZoom(15);
    }

    // 旧pingリング削除
    if (pingRingRef.current?.parentNode) {
      pingRingRef.current.parentNode.removeChild(pingRingRef.current);
      pingRingRef.current = null;
    }
    // pingリング付与
    const marker = markersRef.current.get(vehicle.id);
    if (marker?.content) {
      const ring = document.createElement('div');
      ring.className = 'gps-ping-ring';
      (marker.content as HTMLElement).style.position = 'relative';
      (marker.content as HTMLElement).appendChild(ring);
      pingRingRef.current = ring;
      setTimeout(() => { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 5000);
    }

    // 旧ポリライン削除
    if (routePolyRef.current) { routePolyRef.current.setMap(null); routePolyRef.current = null; }

    if (!vehicle.operationId) return;

    try {
      const res = await apiClient.get<any>(`/operation-details/${vehicle.operationId}/timeline`);
      let routePoints: RoutePoint[] = [];
      if (res.success) {
        const data = res.data?.data ?? res.data;
        if (Array.isArray(data?.routeGpsLogs)) {
          routePoints = data.routeGpsLogs.map((log: any) => ({
            latitude:   Number(log.latitude),
            longitude:  Number(log.longitude),
            recordedAt: log.recordedAt,
            speedKmh:   log.speedKmh !== null ? Number(log.speedKmh) : null,
          }));
        }
      }
      if (routePoints.length < 2) return;

      const path = routePoints.map(p => ({ lat: p.latitude, lng: p.longitude }));
      const polyline = new window.google.maps.Polyline({
        path, geodesic: true,
        strokeColor: '#2563eb', strokeOpacity: 0.85, strokeWeight: 4, map,
      });
      routePolyRef.current = polyline;

      const bounds = new window.google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    } catch (err) {
      console.error('[GPSMonitoring] 経路取得エラー:', err);
    }
  }, [mapsLoaded]);

  // =====================================
  // フィルタリング & 集計
  // =====================================

  const filteredVehicles = vehicles.filter(vehicle => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      vehicle.vehicleNumber.toLowerCase().includes(q) ||
      vehicle.driverName.toLowerCase().includes(q) ||
      vehicle.currentAddress.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || vehicle.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = vehicles.reduce<Record<string, number>>((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1;
    return acc;
  }, {});

  const inOperationCount  = vehicles.filter(v => getStatusConfig(v.status).isInOperation).length;
  const vehiclesWithPosition = vehicles.filter(v => v.latitude !== null).length;

  // =====================================
  // レンダリング
  // =====================================

  return (
    <div className="space-y-4">

      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">GPSモニタリング</h1>
        <Button onClick={handleRefresh} disabled={loading} className="flex items-center">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {/* サブヘッダー */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          リアルタイム位置追跡・位置情報管理
          <br />
          最終更新: {lastRefresh.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
          <span className="ml-2 text-xs text-gray-400">（30秒ごと自動更新）</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
            🚛 運行中: {inOperationCount}台
          </span>
          {isConnected ? (
            <span className="flex items-center text-green-600 text-xs font-medium">
              <Wifi className="w-3.5 h-3.5 mr-1" />API接続中
            </span>
          ) : (
            <span className="flex items-center text-red-500 text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5 mr-1" />接続エラー
            </span>
          )}
        </div>
      </div>

      {/* エラーバナー */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">データ取得エラー</p>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* メインコンテンツ: 地図(広く) + 右側車両一覧 */}
      <div className="flex gap-4" style={{ minHeight: '600px' }}>

        {/* 地図エリア（flex-1で最大幅確保） */}
        <div className="flex-1 min-w-0">
          <div className="bg-white shadow rounded-lg p-4 h-full flex flex-col">
            <h2 className="text-base font-medium text-gray-900 mb-3 flex items-center shrink-0">
              <MapPin className="w-4 h-4 mr-2" />
              地図表示 ({vehiclesWithPosition}台 / 全{vehicles.length}台)
              {selectedVehicleId && (
                <span className="ml-3 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  経路表示中
                </span>
              )}
            </h2>

            <div className="relative rounded-lg overflow-hidden flex-1" style={{ minHeight: '550px' }}>
              <div ref={mapRef} className="w-full h-full bg-gray-100" style={{ minHeight: '550px' }} />

              {!mapsLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col items-center justify-center">
                  <Navigation className="w-12 h-12 text-blue-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-base font-medium text-gray-600">
                    {GOOGLE_MAPS_API_KEY ? '地図を読み込んでいます...' : 'Google Maps Integration'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {GOOGLE_MAPS_API_KEY ? '少々お待ちください' : 'VITE_GOOGLE_MAPS_API_KEY を設定すると地図が表示されます'}
                  </p>
                </div>
              )}

              {/* ステータス凡例 */}
              <div className="absolute top-3 left-3 bg-white bg-opacity-95 p-3 rounded-lg shadow-md text-xs z-10">
                <div className="font-semibold text-gray-700 mb-1">ステータス</div>
                <div className="text-gray-400 font-medium text-xs mb-1">▼ 運行中</div>
                <div className="space-y-0.5 pl-2">
                  {ALL_STATUS_KEYS.filter(s => getStatusConfig(s).isInOperation).map(s => {
                    const cfg = getStatusConfig(s);
                    return (
                      <div key={s} className="flex items-center justify-between gap-3">
                        <span>{cfg.icon} {cfg.label}</span>
                        <span className="font-medium text-gray-800">{statusCounts[s] ?? 0}台</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t pt-1 mt-1">
                  {ALL_STATUS_KEYS.filter(s => !getStatusConfig(s).isInOperation).map(s => {
                    const cfg = getStatusConfig(s);
                    return (
                      <div key={s} className="flex items-center justify-between gap-3">
                        <span>{cfg.icon} {cfg.label}</span>
                        <span className="font-medium text-gray-800">{statusCounts[s] ?? 0}台</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {loading && (
                <div className="absolute inset-0 bg-white bg-opacity-40 flex items-center justify-center z-20">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 車両一覧（右側固定幅） */}
        <div className="shrink-0" style={{ width: '300px' }}>
          <div className="bg-white shadow rounded-lg p-4 h-full flex flex-col">
            <h2 className="text-base font-medium text-gray-900 mb-3 flex items-center shrink-0">
              <Truck className="w-4 h-4 mr-2" />
              車両一覧 ({filteredVehicles.length}台)
            </h2>

            <div className="mb-2 shrink-0">
              <Input
                placeholder="車番、運転手名で検索..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="mb-3 shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">すべてのステータス</option>
                <optgroup label="運行中">
                  {ALL_STATUS_KEYS.filter(s => getStatusConfig(s).isInOperation).map(s => (
                    <option key={s} value={s}>{getStatusConfig(s).icon} {getStatusConfig(s).label}</option>
                  ))}
                </optgroup>
                <optgroup label="非運行">
                  {ALL_STATUS_KEYS.filter(s => !getStatusConfig(s).isInOperation).map(s => (
                    <option key={s} value={s}>{getStatusConfig(s).icon} {getStatusConfig(s).label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {loading && vehicles.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">データを取得中...</p>
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">条件に一致する車両がありません</p>
                </div>
              ) : (
                filteredVehicles.map((vehicle, idx) => {
                  const cfg      = getStatusConfig(vehicle.status);
                  const listNo   = idx + 1;
                  const isSelected = vehicle.id === selectedVehicleId;
                  return (
                    <div
                      key={vehicle.id}
                      onClick={() => handleVehicleCardClick(vehicle)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {/* No + 車番 & ステータスバッジ */}
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                            style={{ background: cfg.color }}
                          >
                            {listNo}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{vehicle.vehicleNumber}</div>
                            <div className="text-xs text-gray-400">{vehicle.vehicleModel}</div>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full shrink-0 ${cfg.className}`}>
                          {cfg.icon}
                        </span>
                      </div>
                      {/* ステータスラベル */}
                      <div className={`text-xs font-medium mb-1 inline-block px-2 py-0.5 rounded-full ${cfg.className}`}>
                        {cfg.label}
                      </div>
                      {/* ドライバー名 */}
                      <div className="text-sm text-gray-600 mb-1">👤 {vehicle.driverName}</div>
                      {/* 現在地 */}
                      <div className="text-xs text-gray-400 mb-1 flex items-center">
                        <MapPin className="w-3 h-3 mr-1 shrink-0" />
                        <span className="truncate">{vehicle.currentAddress}</span>
                      </div>
                      {/* 更新時刻 & 速度 */}
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {vehicle.lastUpdate ? getTimeSinceUpdate(vehicle.lastUpdate) : '未更新'}
                        </div>
                        {vehicle.speed > 0 ? (
                          <div className="font-medium text-blue-600">🚛 {vehicle.speed.toFixed(1)} km/h</div>
                        ) : vehicle.latitude === null ? (
                          <div className="text-gray-400">📵 位置不明</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {!loading && vehicles.length === 0 && !error && (
              <div className="mt-3 text-center text-xs text-gray-400">現在稼働中の車両がありません</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPSMonitoring;
