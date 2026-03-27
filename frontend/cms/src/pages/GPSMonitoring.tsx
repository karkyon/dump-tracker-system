// =====================================
// frontend/cms/src/pages/GPSMonitoring.tsx
// GPSモニタリング画面 - 実データ連携版
// バックエンド GET /api/v1/gps/realtime/vehicles と連携
// Google Maps マーカー表示 + 30秒ポーリング実装
// 最終更新: 2026年2月12日
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
  } | null;
}

/** フロントエンド表示用の車両位置情報 */
interface VehicleLocation {
  id: string;
  vehicleNumber: string;
  driverName: string;
  latitude: number | null;
  longitude: number | null;
  status: 'driving' | 'loading' | 'unloading' | 'break' | 'refueling' | 'offline';
  lastUpdate: string | null;
  speed: number;
  currentAddress: string;
  vehicleModel: string;
}

/** ステータス表示設定 */
interface StatusConfig {
  label: string;
  className: string;
  icon: string;
  color: string;
  markerIcon: string;
}

// =====================================
// コンポーネント外ユーティリティ関数
// （コンポーネントに依存しないため module level に定義）
// =====================================

/**
 * バックエンドのステータスをフロントエンド表示用ステータスに変換
 *
 * 判定優先順位:
 * 1. MAINTENANCE / OUT_OF_SERVICE → オフライン
 * 2. IN_USE、または activeOperation(IN_PROGRESS) あり
 *    → speed > 3km/h: 運転中 / それ以外: 積込中（停車中）
 * 3. それ以外 → オフライン
 *
 * ※ vehicles.status の更新タイミング遅延に備え、
 *    activeOperation の有無も運行中判定に使用する
 */
const mapVehicleStatus = (
  apiStatus: ApiVehiclePosition['status'],
  speed: number | null,
  hasActiveOperation: boolean   // ★追加: activeOperation(IN_PROGRESS)の有無
): VehicleLocation['status'] => {
  if (apiStatus === 'MAINTENANCE' || apiStatus === 'OUT_OF_SERVICE') return 'offline';

  // ★修正: vehicle.status=IN_USE「または」activeOperation=IN_PROGRESS なら運行中扱い
  // vehicles.statusの更新タイミング遅延に備えてactiveOperationも判定に使用する
  if (apiStatus === 'IN_USE' || hasActiveOperation) {
    if (speed !== null && speed > 3) return 'driving';
    return 'loading';
  }

  return 'offline';
};

/**
 * APIレスポンスをフロントエンド表示用に変換
 */
const mapApiToVehicleLocation = (api: ApiVehiclePosition): VehicleLocation => {
  const speed = api.position?.speed ?? 0;

  // ★修正: activeOperation が IN_PROGRESS なら「運行中」とみなす
  const hasActiveOperation =
    api.activeOperation !== null &&
    api.activeOperation?.status === 'IN_PROGRESS';

  const status = mapVehicleStatus(api.status, api.position?.speed ?? null, hasActiveOperation);
  const driverName = api.activeOperation?.driver?.name ?? '未割当';

  // 座標テキスト（Google Maps未連携時のフォールバック）
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
  };
};

/**
 * ステータス設定を取得
 */
const getStatusConfig = (status: string): StatusConfig => {
  const configs: Record<string, StatusConfig> = {
    driving:   {
      label: '運転中',
      className: 'bg-blue-100 text-blue-800',
      icon: '🚛',
      color: '#1d4ed8',
      markerIcon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
    },
    loading:   {
      label: '積込中',
      className: 'bg-orange-100 text-orange-800',
      icon: '📦',
      color: '#c2410c',
      markerIcon: 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png',
    },
    unloading: {
      label: '積下中',
      className: 'bg-purple-100 text-purple-800',
      icon: '📤',
      color: '#7e22ce',
      markerIcon: 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png',
    },
    break:     {
      label: '休憩中',
      className: 'bg-yellow-100 text-yellow-800',
      icon: '☕',
      color: '#a16207',
      markerIcon: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
    },
    refueling: {
      label: '給油中',
      className: 'bg-green-100 text-green-800',
      icon: '⛽',
      color: '#15803d',
      markerIcon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
    },
    offline:   {
      label: 'オフライン',
      className: 'bg-gray-100 text-gray-600',
      icon: '📵',
      color: '#4b5563',
      markerIcon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
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

/** Google Maps スクリプト読み込み（重複防止） */
const loadGoogleMapsScript = (callback: () => void): void => {
  // 既にロード済み
  if (window.google && window.google.maps) {
    callback();
    return;
  }
  // 既にスクリプトタグが存在
  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    existingScript.addEventListener('load', callback);
    return;
  }
  // APIキー未設定
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    console.warn('[GPSMonitoring] Google Maps APIキーが未設定のため地図を表示できません');
    return;
  }

  const script = document.createElement('script');
  script.id = 'google-maps-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=ja&region=JP`;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  script.onerror = () => console.error('[GPSMonitoring] Google Maps APIの読み込みに失敗しました');
  document.head.appendChild(script);
};

// =====================================
// 定数
// =====================================

/** ポーリング間隔（30秒） */
const POLL_INTERVAL_MS = 30_000;

/** デフォルト地図中心（岡山県倉敷市周辺） */
const DEFAULT_CENTER = { lat: 34.6617, lng: 133.9349 };

/** すべてのステータスキー */
const ALL_STATUS_KEYS: VehicleLocation['status'][] = [
  'driving', 'loading', 'unloading', 'break', 'refueling', 'offline'
];

// =====================================
// メインコンポーネント
// =====================================

const GPSMonitoring: React.FC = () => {
  useTLog('GPS_MONITORING', 'GPS監視');

  // --- State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Google Maps 用 ref
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // =====================================
  // データ取得 & ポーリング
  // =====================================

  const fetchVehiclePositions = useCallback(async (isManual = false): Promise<void> => {
    if (isManual) setLoading(true);

    try {
      const response = await apiClient.get<any>('/gps/realtime/vehicles');

      if (!response.success) {
        throw new Error(response.message ?? '車両位置情報の取得に失敗しました');
      }

      // レスポンス構造: response.data = { success, data: [...positions], message }
      // apiClient.get が axios response.data をラップするため
      const rawData = response.data;
      const apiPositions: ApiVehiclePosition[] = Array.isArray(rawData?.data)
        ? rawData.data
        : Array.isArray(rawData)
        ? rawData
        : [];

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

  /** 手動更新 */
  const handleRefresh = (): void => {
    fetchVehiclePositions(true);
  };

  /** 初回取得 + 30秒ポーリング */
  useEffect(() => {
    fetchVehiclePositions(true);

    const timer = setInterval(() => fetchVehiclePositions(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchVehiclePositions]);

  // =====================================
  // Google Maps 初期化（マウント時1回）
  // =====================================

  useEffect(() => {
    const initMap = (): void => {
      if (!mapRef.current || !window.google) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new window.google.maps.InfoWindow();
      setMapsLoaded(true);
    };

    loadGoogleMapsScript(initMap);
  }, []);

  // =====================================
  // Google Maps マーカー更新（車両データ変更時）
  // =====================================

  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current || !infoWindowRef.current) return;

    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;
    const existingMarkers = markersRef.current;
    const currentIds = new Set<string>();

    vehicles.forEach(vehicle => {
      if (vehicle.latitude === null || vehicle.longitude === null) return;

      currentIds.add(vehicle.id);
      const position = { lat: vehicle.latitude, lng: vehicle.longitude };
      const cfg = getStatusConfig(vehicle.status);

      // マーカーの情報ウィンドウ HTML
      const infoContent = `
        <div style="padding:10px;min-width:200px;font-family:sans-serif;font-size:13px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#1f2937;">${vehicle.vehicleNumber}</div>
          <div style="color:#6b7280;margin-bottom:4px;">${vehicle.vehicleModel}</div>
          <div style="margin-bottom:4px;">👤 ${vehicle.driverName}</div>
          <div style="margin-bottom:6px;">${cfg.icon}
            <span style="font-weight:600;color:${cfg.color}">${cfg.label}</span>
          </div>
          ${vehicle.speed > 0 ? `<div style="margin-bottom:4px;">🚗 ${vehicle.speed.toFixed(1)} km/h</div>` : ''}
          <div style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:6px;margin-top:4px;">
            📍 ${vehicle.latitude?.toFixed(5)}, ${vehicle.longitude?.toFixed(5)}<br/>
            🕐 ${vehicle.lastUpdate ? getTimeSinceUpdate(vehicle.lastUpdate) : '未更新'}
          </div>
        </div>
      `;

      if (existingMarkers.has(vehicle.id)) {
        // 既存マーカーを位置・アイコン更新
        const marker = existingMarkers.get(vehicle.id)!;
        marker.setPosition(position);
        marker.setIcon(cfg.markerIcon);
      } else {
        // 新規マーカーを作成
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: vehicle.vehicleNumber,
          icon: cfg.markerIcon,
          animation: window.google.maps.Animation.DROP,
        });

        marker.addListener('click', () => {
          infoWindow.setContent(infoContent);
          infoWindow.open(map, marker);
        });

        existingMarkers.set(vehicle.id, marker);
      }

      // InfoWindow コンテンツも更新（クリック時に最新情報が表示されるよう）
      const marker = existingMarkers.get(vehicle.id)!;
      marker.addListener('click', () => {
        infoWindow.setContent(infoContent);
        infoWindow.open(map, marker);
      });
    });

    // 消えた車両のマーカーを削除
    existingMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        existingMarkers.delete(id);
      }
    });
  }, [vehicles, mapsLoaded]);

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

  const vehiclesWithPosition = vehicles.filter(v => v.latitude !== null).length;

  // =====================================
  // レンダリング
  // =====================================

  return (
    <div className="space-y-6">

      {/* ===== ヘッダー ===== */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">GPSモニタリング</h1>
        <Button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {/* ===== サブヘッダー（接続状態 / 最終更新） ===== */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          リアルタイム位置追跡・位置情報管理
          <br />
          最終更新: {lastRefresh.toLocaleString('ja-JP')}
          <span className="ml-2 text-xs text-gray-400">（30秒ごと自動更新）</span>
        </div>
        <div className="flex items-center gap-1">
          {isConnected ? (
            <span className="flex items-center text-green-600 text-xs font-medium">
              <Wifi className="w-3.5 h-3.5 mr-1" />
              API接続中
            </span>
          ) : (
            <span className="flex items-center text-red-500 text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5 mr-1" />
              接続エラー
            </span>
          )}
        </div>
      </div>

      {/* ===== エラーバナー ===== */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">データ取得エラー</p>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ===== メインコンテンツ ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ---- 地図表示エリア (左2/3) ---- */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              地図表示 ({vehiclesWithPosition}台)
              <span className="ml-2 text-sm font-normal text-gray-500">
                / 全{vehicles.length}台（位置情報あり）
              </span>
            </h2>

            {/* Google Maps コンテナ */}
            <div className="relative rounded-lg overflow-hidden" style={{ height: '420px' }}>
              <div ref={mapRef} className="w-full h-full bg-gray-100" />

              {/* 地図未ロード時フォールバック */}
              {!mapsLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col items-center justify-center">
                  <Navigation className="w-12 h-12 text-blue-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-base font-medium text-gray-600">
                    {GOOGLE_MAPS_API_KEY
                      ? '地図を読み込んでいます...'
                      : 'Google Maps Integration'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {GOOGLE_MAPS_API_KEY
                      ? '少々お待ちください'
                      : 'VITE_GOOGLE_MAPS_API_KEY を設定すると地図が表示されます'}
                  </p>
                </div>
              )}

              {/* ステータス凡例オーバーレイ */}
              <div className="absolute top-3 left-3 bg-white bg-opacity-95 p-3 rounded-lg shadow-md text-xs z-10">
                <div className="font-semibold text-gray-700 mb-2">ステータス</div>
                <div className="space-y-1">
                  {ALL_STATUS_KEYS.map(s => {
                    const cfg = getStatusConfig(s);
                    const count = statusCounts[s] ?? 0;
                    return (
                      <div key={s} className="flex items-center justify-between gap-4">
                        <span>{cfg.icon} {cfg.label}</span>
                        <span className="font-medium text-gray-800">{count}台</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 更新中オーバーレイ */}
              {loading && (
                <div className="absolute inset-0 bg-white bg-opacity-40 flex items-center justify-center z-20">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- 車両一覧 (右1/3) ---- */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Truck className="w-5 h-5 mr-2" />
              車両一覧 ({filteredVehicles.length}台)
            </h2>

            {/* 検索ボックス */}
            <div className="mb-3">
              <Input
                placeholder="車番、運転手名、住所で検索..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(e.target.value)
                }
                className="text-sm"
              />
            </div>

            {/* ステータスフィルター */}
            <div className="mb-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">すべてのステータス</option>
                {ALL_STATUS_KEYS.map(s => (
                  <option key={s} value={s}>{getStatusConfig(s).label}</option>
                ))}
              </select>
            </div>

            {/* 車両カードリスト */}
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {loading && vehicles.length === 0 ? (
                /* 初回ローディング */
                <div className="text-center py-8 text-gray-400">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">データを取得中...</p>
                </div>
              ) : filteredVehicles.length === 0 ? (
                /* 該当なし */
                <div className="text-center py-8 text-gray-500">
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">条件に一致する車両がありません</p>
                </div>
              ) : (
                filteredVehicles.map(vehicle => {
                  const cfg = getStatusConfig(vehicle.status);
                  return (
                    <div
                      key={vehicle.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50
                                 cursor-pointer transition-colors"
                    >
                      {/* 車番 & ステータスバッジ */}
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {vehicle.vehicleNumber}
                          </div>
                          <div className="text-xs text-gray-400">{vehicle.vehicleModel}</div>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${cfg.className}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>

                      {/* ドライバー名 */}
                      <div className="text-sm text-gray-600 mb-1">
                        👤 {vehicle.driverName}
                      </div>

                      {/* 現在地 */}
                      <div className="text-xs text-gray-400 mb-1 flex items-center">
                        <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{vehicle.currentAddress}</span>
                      </div>

                      {/* 更新時刻 & 速度 */}
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {vehicle.lastUpdate
                            ? getTimeSinceUpdate(vehicle.lastUpdate)
                            : '未更新'}
                        </div>
                        {vehicle.status === 'driving' && vehicle.speed > 0 ? (
                          <div className="font-medium text-blue-600">
                            🚗 {vehicle.speed.toFixed(1)} km/h
                          </div>
                        ) : vehicle.latitude === null ? (
                          <div className="text-gray-400">📵 位置不明</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 稼働なし */}
            {!loading && vehicles.length === 0 && !error && (
              <div className="mt-3 text-center text-xs text-gray-400">
                現在稼働中の車両がありません
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPSMonitoring;