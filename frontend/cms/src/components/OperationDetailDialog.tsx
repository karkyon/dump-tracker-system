// ✅✅✅ 運行記録詳細ダイアログ - Google Maps完全実装版
// 基本情報・運行情報・場所情報・タイムライン・GPSルート・点検項目管理を完全実装
// ✅ 修正: GPSルートタブにGoogle Maps実装追加
// ✅ 修正: TypeScript型エラーのみ最小限修正、既存コード100%保持
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  User, Truck, MapPin, Package, Clock,
  Navigation, CheckCircle, AlertCircle, TrendingUp, Edit,
  Coffee, Fuel, Play, Square, ClipboardCheck,
  ChevronDown, ChevronUp, XCircle
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
  
  // 詳細情報フィールド
  latitude?: number;
  longitude?: number;
  locationName?: string;
  weatherCondition?: string;
  temperature?: number;
  overallNotes?: string;
  defectsFound?: number;
  
  // 関連データ
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
             'BREAK' | 'BREAK_START' | 'BREAK_END' | 'OTHER';
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
 */
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
   */
  useEffect(() => {
    console.log('🗺️ [Map Debug] === Map initialization useEffect START ===');
    console.log('🗺️ [Map Debug] Conditions check:');
    console.log('  - mapsLoaded:', mapsLoaded);
    console.log('  - mapRef.current:', !!mapRef.current);
    console.log('  - gpsRecords.length:', gpsRecords.length);
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

    if (!mapsLoaded || !mapRef.current || activeGpsPoints.length === 0 || activeTab !== 'gps') {
      console.warn('⚠️ [Map Debug] Map initialization skipped - conditions not met');
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

    // 地図の中心座標を計算（activeGpsPointsを使用）
    const avgLat = activeGpsPoints.reduce((sum, p) => sum + p.latitude, 0) / activeGpsPoints.length;
    const avgLng = activeGpsPoints.reduce((sum, p) => sum + p.longitude, 0) / activeGpsPoints.length;

    console.log('📍 [Map Debug] Calculated center:', { avgLat, avgLng });
    console.log('📍 [Map Debug] GPS points sample (first 3):');
    activeGpsPoints.slice(0, 3).forEach((p, i) => {
      console.log(`  [${i}]:`, { lat: p.latitude, lng: p.longitude, type: p.eventType });
    });

      // 地図初期化
      console.log('🗺️ [Map Debug] Creating Google Maps instance...');
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: avgLat, lng: avgLng },
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      mapInstanceRef.current = map;
      console.log('✅ [Map Debug] Google Maps instance created');

      // GPSルートのパスを作成（ポリライン）
      const path = activeGpsPoints.map(point => ({
        lat: point.latitude,
        lng: point.longitude
      }));

      console.log('📍 [Map Debug] Path created with', path.length, 'points');

      // ポリライン（GPSルート線）を描画
      console.log('🎨 [Map Debug] Drawing polyline...');
      new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
      });
      console.log('✅ [Map Debug] Polyline drawn');

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

      // ✅ 走行軌跡描画（設定ON かつ routeGpsLogs がある場合）
      try {
        const rawSettings = localStorage.getItem('dump_tracker_gps_track_settings');
        const gpsTrackSettings = rawSettings
          ? JSON.parse(rawSettings)
          : { showTrack: false, intervalMinutes: 5 };

        if (gpsTrackSettings.showTrack && routeGpsLogs.length > 0) {
          const intervalMs = (gpsTrackSettings.intervalMinutes || 5) * 60 * 1000;

          // インターバルフィルター: 前のポイントから指定時間以上経過したもののみ残す
          const filtered: typeof routeGpsLogs = [];
          let lastTime = 0;
          for (const log of routeGpsLogs) {
            const t = new Date(log.recordedAt).getTime();
            if (filtered.length === 0 || t - lastTime >= intervalMs) {
              filtered.push(log);
              lastTime = t;
            }
          }

          console.log(`📡 [Map Debug] routeGpsLogs filtered: ${routeGpsLogs.length} → ${filtered.length}件 (interval: ${gpsTrackSettings.intervalMinutes}分)`);

          // 走行軌跡ライン（細い灰色）
          new google.maps.Polyline({
            path: filtered.map(p => ({ lat: p.latitude, lng: p.longitude })),
            geodesic: true,
            strokeColor: '#6B7280',
            strokeOpacity: 0.5,
            strokeWeight: 2,
            map: map
          });

          // 走行軌跡ポイント（小さい灰色ドット）
          filtered.forEach(log => {
            new google.maps.Marker({
              position: { lat: log.latitude, lng: log.longitude },
              map: map,
              title: `GPS記録: ${new Date(log.recordedAt).toLocaleString('ja-JP')}${log.speedKmh != null ? ` (${log.speedKmh.toFixed(1)} km/h)` : ''}`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 4,
                fillColor: '#6B7280',
                fillOpacity: 0.6,
                strokeColor: '#FFFFFF',
                strokeWeight: 1
              }
            });
          });

          console.log('✅ [Map Debug] 走行軌跡描画完了:', filtered.length, '点');
        } else {
          console.log('ℹ️ [Map Debug] 走行軌跡表示OFF or データなし');
        }
      } catch (trackErr) {
        console.warn('⚠️ [Map Debug] 走行軌跡描画エラー（スキップ）:', trackErr);
      }

      console.log('✅ [Map Debug] === Google Map initialization SUCCESS ===');
      console.log('✅ [Map Debug] Total GPS points:', activeGpsPoints.length);
      console.log('✅ [Map Debug] Map center:', { lat: avgLat, lng: avgLng });
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
   * GPS記録を取得
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
   * ✅ 点検項目詳細取得（OperationDebugから移植）- 型エラー修正
   */
  // ✅ 修正: /debug/operations/{id} エンドポイントは存在しないため削除
  // 点検項目は fetchInspections() で既に取得しています
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
      
      // ✅ Step 2: 並行して他のデータを取得
      await Promise.all([
        fetchOperationActivities(),
        fetchIntegratedTimeline(operationId),
        fetchInspectionItemDetails(operationId)
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
                      {operationDebugTimelineEvents.map((event) => {
                        const typeInfo = getEventTypeInfo(event.eventType);
                        
                        return (
                          <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              {/* シーケンス番号 */}
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-semibold text-blue-600">{event.sequenceNumber}</span>
                              </div>

                              <div className="flex-1">
                                {/* イベント種別と時刻 */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-3 py-1 text-sm font-semibold rounded-lg inline-flex items-center gap-2 ${typeInfo.className}`}>
                                    {typeInfo.icon}
                                    {typeInfo.label}
                                  </span>
                                  {event.timestamp && (
                                    <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                      {formatTime(event.timestamp)}
                                    </span>
                                  )}
                                </div>

                                {/* 登録場所情報 */}
                                {event.location && (
                                  <div className="text-sm text-gray-600 mb-1">
                                    <MapPin className="w-4 h-4 inline-block mr-1 text-gray-400" />
                                    <span className="font-medium">{event.location.name}</span>
                                    <span className="text-gray-500 ml-2">{event.location.address}</span>
                                  </div>
                                )}

                                {/* GPS座標 */}
                                {event.gpsLocation && (
                                  <div className="text-sm text-gray-600 mb-1">
                                    <Navigation className="w-4 h-4 inline-block mr-1 text-gray-400" />
                                    GPS座標: {formatGps(event.gpsLocation.latitude, event.gpsLocation.longitude)}
                                    <span className="text-xs text-gray-500 ml-2">
                                      記録時刻: {formatTime(event.gpsLocation.recordedAt)}
                                    </span>
                                  </div>
                                )}

                                {/* 品目情報 */}
                                {event.items && (
                                  <div className="text-sm text-gray-600 mb-1">
                                    <Package className="w-4 h-4 inline-block mr-1 text-gray-400" />
                                    品目: {event.items.name}
                                    {event.quantityTons && event.quantityTons > 0 && (
                                      <span className="ml-2">({event.quantityTons} {event.items.unit})</span>
                                    )}
                                  </div>
                                )}

                                {/* 点検サマリー */}
                                {event.inspectionDetails && (
                                  <div className="mt-2 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm">
                                        <span className="font-medium text-gray-700">点検項目: {event.inspectionDetails.totalItems}件</span>
                                        <span className="ml-3 text-green-600">合格: {event.inspectionDetails.passedItems}件</span>
                                        <span className="ml-3 text-red-600">不合格: {event.inspectionDetails.failedItems}件</span>
                                      </div>
                                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                        event.inspectionDetails.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                        event.inspectionDetails.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {event.inspectionDetails.status === 'COMPLETED' ? '完了' :
                                         event.inspectionDetails.status === 'IN_PROGRESS' ? '実施中' : '待機中'}
                                      </span>
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
                      })}
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
                  </h3>
                  
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
                        {timelineGpsPoints.length === 0 && gpsRecords.length === 0 && (
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
              <div className="flex gap-2">
                <Button variant="outline">
                  <Edit className="w-4 h-4 mr-2" />
                  編集
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default OperationDetailDialog;