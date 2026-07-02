// frontend/mobile/src/pages/OperationRecord.tsx
// 🚛 運行記録画面 - 完全版（既存機能100%保持 + D5/D6新仕様対応 + 新規地点登録機能）
// ✅ 既存機能を完全保持
// ✅ GPS近隣地点自動検知を停止（常時）
// ✅ D5/D6ボタンクリック時に手動で地点検索
// ✅ 複数候補の選択ダイアログ表示
// ✅ 新APIエンドポイント使用 (recordLoadingArrival/recordUnloadingArrival)
// 🆕 近隣地点0件時の新規地点登録ダイアログ表示（2025年12月7日）
// 🔧 修正: operation-temp-id → operationStore.operationId を使用（2025年12月7日）
// 🔧 修正: 運行終了後のHome遷移とエラー抑制（2025年12月26日）

import React, { useState, useEffect, useRef } from 'react';
import { useTLog } from '../hooks/useTLog';
import { toast } from 'react-hot-toast';
import { useGPS } from '../hooks/useGPS';
import apiService, { retryWithBackoff } from '../services/api';
import { calculateDistance } from '../utils/helpers';
import GoogleMapWrapper, {
  updateMarkerPosition,
  panMapToPosition,
  setMapHeading,
  addPathPoint
} from '../components/GoogleMapWrapper';
import { useNavigate } from 'react-router-dom';
import HeadingIndicator from '../components/HeadingIndicator';
import { LocationSelectionDialog } from '../components/LocationSelectionDialog';
import type { NearbyLocationResult } from '../hooks/useNearbyLocationDetection';
import { LocationRegistrationDialog, type NewLocationData } from '../components/LocationRegistrationDialog';
import { useOperationStore } from '../stores/operationStore';
import ActivityEditSheet from '../components/ActivityEditSheet';
import type { ActivityRecord } from '../components/ActivityEditSheet';
import { useAuthStore } from '../stores/authStore';

// 運行状態の型定義（operationStore.ts の OperationPhase を使用）
import type { OperationPhase } from '../stores/operationStore';

interface OperationState {
  id: string | null;
  status: 'idle' | 'running';
  phase: OperationPhase;
  startTime: Date | null;
  loadingLocation: string;
  unloadingLocation: string;
  cargoInfo: string;
  // ✅ 既存の追加フィールド
  vehicleId: string;
  vehicleName: string;
  driverName: string;
  operationNumber: string;
  plannedRoute: string;
  estimatedDistance: number;
  estimatedDuration: number;
  breakCount: number;
  fuelLevel: number;
  notes: string;
}

const MAP_UPDATE_INTERVAL = 3000;
const MARKER_UPDATE_INTERVAL = 1000;

const OperationRecord: React.FC = () => {
  useTLog('OPERATION_RECORD', '運行記録');

  
  const [isMapReady, setIsMapReady] = useState(false);
  const lastMapUpdateRef = useRef<number>(0);
  const lastMarkerUpdateRef = useRef<number>(0);
  
  // operationStoreから運行IDを取得
  const operationStore = useOperationStore();
  const customerName = operationStore.customerName ?? null; // 🆕 客先名
  
  // authStoreから認証情報を取得
  const authStore = useAuthStore();

  // ナビゲーションフック
  const navigate = useNavigate();
  
  // 🆕 新規地点登録ダイアログ用の状態
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [registrationLocationType, setRegistrationLocationType] = useState<'LOADING' | 'UNLOADING' | null>(null);
  
  // ✅ 既存の運行状態（完全保持） 
  const [operation, setOperation] = useState<OperationState>({
    id: null, // 🔧 修正: operationStoreから取得するためnullに変更
    status: 'running',
    phase: operationStore.phase || 'TO_LOADING',
    startTime: new Date(),
    loadingLocation: operationStore.loadingLocation || '',
    unloadingLocation: operationStore.unloadingLocation || '',
    cargoInfo: '',
    vehicleId: operationStore.vehicleId || '',
    vehicleName: operationStore.vehicleNumber || '車両未選択',
    driverName: authStore.user?.name || operationStore.driverName || 'ドライバー未設定',
    operationNumber: operationStore.operationId || 'OP-未設定',
    plannedRoute: '',  // 未使用フィールド
    estimatedDistance: 0,  // 未使用フィールド
    estimatedDuration: 0,  // 未使用フィールド
    breakCount: operationStore.breakCount || 0,  // 🔧 storeから復元 (2026-02-01)
    fuelLevel: 80,  // TODO: 車両情報から取得
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  // REQ-011: 別客先へ切替
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [customerList, setCustomerList] = useState<{ id: string; name: string }[]>([]);
  const [isCustomerChanging, setIsCustomerChanging] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  // ✅ FB-J1o6dgv8: 経過時間を「積込開始から」「休憩中は停止」に変更
  const firstLoadingStartRef = React.useRef<Date | null>(null);
  const breakStartRef        = React.useRef<Date | null>(null);
  const breakTotalSecondsRef = React.useRef<number>(0);

  // ✅ 既存の詳細情報表示状態
  // 旧 showDetails state は削除済み（showDetailPanel に統合）
  const [showMap] = useState(true);

  // 🆕 詳細パネル用state
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [detailActivities, setDetailActivities] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCustomers, setDetailCustomers] = useState<{ id: string; name: string }[]>([]);
  const [detailItems, setDetailItems] = useState<{ id: string; name: string; itemType?: string; displayOrder?: number }[]>([]);
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);
  // ✅ BUG-051完全修正: APIレスポンスの運行客先名を保持（storeのcustomerNameに依存しない）
  const [detailOperationCustomerName, setDetailOperationCustomerName] = useState<string | null>(null);
  // ✅ BUG-051最終修正: NOTE含む全アクティビティ（客先変更履歴参照用）
  const [detailAllActivities, setDetailAllActivities] = useState<any[]>([]);

  // 🆕 地点選択ダイアログの状態（D5/D6新仕様）
  const [locationDialogVisible, setLocationDialogVisible] = useState(false);
  const [locationCandidates, setLocationCandidates] = useState<NearbyLocationResult[]>([]);
  const [dialogType, setDialogType] = useState<'LOADING' | 'UNLOADING'>('LOADING');

  // ✅ BUG-031修正: enableLogging/operationId/vehicleId を useGPS に渡す
  // これがないと sendGPSData の先頭ガードで常に return してGPS未送信になる
  const {
    currentPosition,
    isTracking,
    startTracking,
    stopTracking,    // ✅ BUG-039修正: GPS停止用
    heading,
    speed: _gpsSpeed,
    totalDistance,
    updateOptions: updateGPSOptions
  } = useGPS({
    enableLogging: true,
    operationId: operationStore.operationId || undefined,
    vehicleId: operationStore.vehicleId || undefined,
  });

  // ✅ Fix-S11-8: GPS累積走行距離をoperationStoreに同期（運行終了時のフォールバック用）
  // totalDistance は上の useGPS() から取得後、変化時にstoreへ保存
  useEffect(() => {
    if (totalDistance > 0 && operationStore.operationId) {
      operationStore.setTotalDistanceKm(totalDistance);
    }
  }, [totalDistance]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ BUG-031補足: operationId が確定したら useGPS のオプションを更新
  // （初回マウント時に operationId が null の場合の対応）
  useEffect(() => {
    if (operationStore.operationId && operationStore.vehicleId) {
      updateGPSOptions({
        enableLogging: true,
        operationId: operationStore.operationId,
        vehicleId: operationStore.vehicleId,
      });
      console.log('✅ [BUG-031] useGPS オプション更新:', {
        operationId: operationStore.operationId,
        vehicleId: operationStore.vehicleId
      });
    }
  }, [operationStore.operationId, operationStore.vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // operationStoreから運行IDを取得して状態に反映
  // 🔧 修正: 運行ID未設定時の処理を改善（エラー抑制）
  useEffect(() => {
    if (operationStore.operationId) {
      setOperation(prev => ({
        ...prev,
        id: operationStore.operationId
      }));
      console.log('✅ 運行ID設定完了:', operationStore.operationId);
      return undefined; // 明示的にundefinedを返す（TypeScriptエラー回避）
    }
    
    // 🔧 修正: エラートーストを表示せず、静かに車両選択画面に戻る
    console.warn('[OperationRecord] ⚠️ 運行IDが未設定 - 車両選択画面に戻ります');
    
    // すぐに車両選択画面に戻る（エラー表示なし）
    const timer = setTimeout(() => {
      navigate('/home', { replace: true });
    }, 100);
    
    return () => clearTimeout(timer);
  }, [operationStore.operationId, navigate]);


  // operationStoreのフェーズ変更を監視して同期
  useEffect(() => {
    setOperation(prev => ({
      ...prev,
      phase: operationStore.phase,
      loadingLocation: operationStore.loadingLocation || prev.loadingLocation,
      unloadingLocation: operationStore.unloadingLocation || prev.unloadingLocation
    }));
    console.log('🔄 フェーズ同期完了:', {
      newPhase: operationStore.phase,
      loadingLocation: operationStore.loadingLocation,
      unloadingLocation: operationStore.unloadingLocation
    });
  }, [operationStore.phase, operationStore.loadingLocation, operationStore.unloadingLocation]);

  // 車両情報とドライバー情報の同期
  useEffect(() => {
    setOperation(prev => ({
      ...prev,
      vehicleId: operationStore.vehicleId || prev.vehicleId,
      vehicleName: operationStore.vehicleNumber || prev.vehicleName,
      driverName: authStore.user?.name || operationStore.driverName || prev.driverName,
      operationNumber: operationStore.operationId || prev.operationNumber
    }));
  }, [operationStore.vehicleId, operationStore.vehicleNumber, operationStore.driverName, authStore.user, operationStore.operationId]);

  // ✅ GPS追跡開始（既存）
  useEffect(() => {
    if (!isTracking) {
      startTracking();
    }
  }, [isTracking, startTracking]);

  // 🆕 距離検知: 積込/荷降場所から離れたら自動フェーズ移行
  const departureAlertFiredRef = React.useRef(false);
  useEffect(() => {
    if (!currentPosition) return;

    const phase = operation.phase;
    const alertDistanceKm = 0.2; // デフォルト200m = 0.2km（将来: system_settingsから取得）

    // 積込完了後（TO_UNLOADING移動中）でない場合はスキップ
    // 積込場所到着 v2.1中（AT_LOADING）に積込場所から離れたら自動的に TO_UNLOADING へ
    if (phase === 'AT_LOADING' || phase === 'LOADING_IN_PROGRESS') {
      const loadingLat = operationStore.loadingLocationLat;
      const loadingLng = operationStore.loadingLocationLng;
      if (loadingLat == null || loadingLng == null) return;

      const dist = calculateDistance(
        currentPosition.coords.latitude,
        currentPosition.coords.longitude,
        loadingLat,
        loadingLng
      );

      if (dist >= alertDistanceKm && !departureAlertFiredRef.current) {
        departureAlertFiredRef.current = true;
        toast('📦 積込場所から離れました。荷降場所へ移動中に切り替えます', {
          icon: '🚛',
          duration: 4000,
          style: { background: '#FF9800', color: '#fff', fontWeight: 'bold' }
        });
        setOperation(prev => ({ ...prev, phase: 'TO_UNLOADING' }));
        operationStore.setPhase('TO_UNLOADING');
        console.log('🚛 自動フェーズ移行: AT_LOADING → TO_UNLOADING (距離:', (dist * 1000).toFixed(0), 'm)');
      }
      if (dist < alertDistanceKm) {
        departureAlertFiredRef.current = false; // 戻ってきたらリセット
      }
    }

    // 荷降場所到着中（AT_UNLOADING）に荷降場所から離れたら自動的に TO_LOADING へ
    if (phase === 'AT_UNLOADING') {
      const selectedUnloading = (window as any).selectedUnloadingLocation;
      if (!selectedUnloading?.latitude || !selectedUnloading?.longitude) return;

      const dist = calculateDistance(
        currentPosition.coords.latitude,
        currentPosition.coords.longitude,
        selectedUnloading.latitude,
        selectedUnloading.longitude
      );

      if (dist >= alertDistanceKm && !departureAlertFiredRef.current) {
        departureAlertFiredRef.current = true;
        toast('✅ 荷降場所から離れました。次の積込場所へ移動中に切り替えます', {
          icon: '🔄',
          duration: 4000,
          style: { background: '#4CAF50', color: '#fff', fontWeight: 'bold' }
        });

        // 荷降完了APIを自動呼び出し
        const currentOperationId = operationStore.operationId;
        if (currentOperationId) {
          apiService.completeUnloadingAtLocation(currentOperationId, {
            endTime: new Date(),
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy,
            notes: '自動荷降完了（離脱検知）'
          }).catch(err => console.error('自動荷降完了エラー:', err));
        }

        setOperation(prev => ({ ...prev, phase: 'TO_LOADING' }));
        operationStore.setPhase('TO_LOADING');
        (window as any).selectedUnloadingLocation = null;
        departureAlertFiredRef.current = false;
        console.log('🔄 自動フェーズ移行: AT_UNLOADING → TO_LOADING (距離:', (dist * 1000).toFixed(0), 'm)');
      }
      if (dist < alertDistanceKm) {
        departureAlertFiredRef.current = false;
      }
    }
  }, [currentPosition, operation.phase]);

  // 🆕 距離検知: 積込/荷降場所から離れたら自動フェーズ移行
  useEffect(() => {
    if (!currentPosition) return;

    const phase = operation.phase;
    const alertDistanceKm = 0.2; // デフォルト200m = 0.2km（将来: system_settingsから取得）

    // 積込完了後（TO_UNLOADING移動中）でない場合はスキップ
    // 積込場所到着中（AT_LOADING）に積込場所から離れたら自動的に TO_UNLOADING へ
    if (phase === 'AT_LOADING' || phase === 'LOADING_IN_PROGRESS') {
      const loadingLat = operationStore.loadingLocationLat;
      const loadingLng = operationStore.loadingLocationLng;
      if (loadingLat == null || loadingLng == null) return;

      const dist = calculateDistance(
        currentPosition.coords.latitude,
        currentPosition.coords.longitude,
        loadingLat,
        loadingLng
      );

      if (dist >= alertDistanceKm && !departureAlertFiredRef.current) {
        departureAlertFiredRef.current = true;
        toast('📦 積込場所から離れました。荷降場所へ移動中に切り替えます', {
          icon: '🚛',
          duration: 4000,
          style: { background: '#FF9800', color: '#fff', fontWeight: 'bold' }
        });
        setOperation(prev => ({ ...prev, phase: 'TO_UNLOADING' }));
        operationStore.setPhase('TO_UNLOADING');
        console.log('🚛 自動フェーズ移行: AT_LOADING → TO_UNLOADING (距離:', (dist * 1000).toFixed(0), 'm)');
      }
      if (dist < alertDistanceKm) {
        departureAlertFiredRef.current = false; // 戻ってきたらリセット
      }
    }

    // 荷降場所到着中（AT_UNLOADING）に荷降場所から離れたら自動的に TO_LOADING へ
    if (phase === 'AT_UNLOADING') {
      const selectedUnloading = (window as any).selectedUnloadingLocation;
      if (!selectedUnloading?.latitude || !selectedUnloading?.longitude) return;

      const dist = calculateDistance(
        currentPosition.coords.latitude,
        currentPosition.coords.longitude,
        selectedUnloading.latitude,
        selectedUnloading.longitude
      );

      if (dist >= alertDistanceKm && !departureAlertFiredRef.current) {
        departureAlertFiredRef.current = true;
        toast('✅ 荷降場所から離れました。次の積込場所へ移動中に切り替えます', {
          icon: '🔄',
          duration: 4000,
          style: { background: '#4CAF50', color: '#fff', fontWeight: 'bold' }
        });

        // 荷降完了APIを自動呼び出し
        const currentOperationId = operationStore.operationId;
        if (currentOperationId) {
          apiService.completeUnloadingAtLocation(currentOperationId, {
            endTime: new Date(),
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy,
            notes: '自動荷降完了（離脱検知）'
          }).catch(err => console.error('自動荷降完了エラー:', err));
        }

        setOperation(prev => ({ ...prev, phase: 'TO_LOADING' }));
        operationStore.setPhase('TO_LOADING');
        (window as any).selectedUnloadingLocation = null;
        departureAlertFiredRef.current = false;
        console.log('🔄 自動フェーズ移行: AT_UNLOADING → TO_LOADING (距離:', (dist * 1000).toFixed(0), 'm)');
      }
      if (dist < alertDistanceKm) {
        departureAlertFiredRef.current = false;
      }
    }
  }, [currentPosition, operation.phase]);

  // ✅ FB-J1o6dgv8: 経過時間 = 積込開始から / 休憩中は停止
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      const baseRef = firstLoadingStartRef.current;
      if (!baseRef) {
        // 積込未開始は 00:00:00 固定
        setElapsedTime({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      // BREAK 中: 現在の休憩経過もポーズ計算から除外
      const currentBreakSec = (operation.phase === 'BREAK' && breakStartRef.current)
        ? Math.floor((Date.now() - breakStartRef.current.getTime()) / 1000)
        : 0;
      const totalExcludeSec = breakTotalSecondsRef.current + currentBreakSec;
      const elapsed = Math.max(0, Math.floor((Date.now() - baseRef.getTime()) / 1000) - totalExcludeSec);
      const hours   = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setElapsedTime({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [operation.startTime, operation.phase]);

  // ✅ マップ更新処理（既存）
  useEffect(() => {
    if (!currentPosition || !isMapReady) return;

    const now = Date.now();
    
    // マーカー更新（高頻度）
    if (now - lastMarkerUpdateRef.current >= MARKER_UPDATE_INTERVAL) {
      updateMarkerPosition(currentPosition.coords.latitude, currentPosition.coords.longitude);
      lastMarkerUpdateRef.current = now;
    }

    // マップ移動（低頻度）
    if (now - lastMapUpdateRef.current >= MAP_UPDATE_INTERVAL) {
      panMapToPosition(currentPosition.coords.latitude, currentPosition.coords.longitude);
      // 🧭 headingUp: GPS heading（移動方向）でマップ回転
      // _gpsSpeed > 3km/h の場合はGPS heading、低速時はheadingをそのまま使用
      if (heading !== null && heading !== undefined) {
        setMapHeading(heading);
      }
      addPathPoint(currentPosition.coords.latitude, currentPosition.coords.longitude);
      lastMapUpdateRef.current = now;
    }
  }, [currentPosition, heading, isMapReady]);

  // =====================================
  // 🆕 D5/D6 新仕様: 手動地点検索機能
  // =====================================

  /**
   * 🆕 積込場所到着ボタンクリック（手動検索）
   */
  const handleLoadingArrival = async () => {
    if (!currentPosition) {
      toast.error('GPS位置情報が取得できません');
      return;
    }

    try {
      setIsSubmitting(true);

      console.log('🔍 積込場所検索開始:', {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        phase: 'TO_LOADING'
      });

      // 🆕 近隣地点を手動検索
      const nearbyResult = await apiService.getNearbyLocations({
        operationId: operationStore.operationId || '',
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        radiusMeters: 500,  // 🔧 修正: 200→500m（GPS誤差・登録座標ずれを考慮）
        phase: 'TO_LOADING'
      });

      console.log('📡 近隣地点検索レスポンス:', nearbyResult);

      // 🔧 修正: レスポンス構造に合わせてデータ取得
      const locations = nearbyResult.data?.locations || [];
      
      console.log('📍 検索結果:', {
        count: locations.length,
        locations: locations
      });
      
      if (locations.length === 0) {
        // 🆕 近隣地点が見つからない場合 → 新規登録ダイアログを表示
        toast('近くに登録されている積込場所が見つかりません', {
          icon: 'ℹ️',
          duration: 3000
        });
        setRegistrationLocationType('LOADING');
        setShowRegistrationDialog(true);
        setIsSubmitting(false);
        return;
      }

      // 🆕 ダイアログ表示
      setLocationCandidates(locations);
      setDialogType('LOADING');
      setLocationDialogVisible(true);
      setIsSubmitting(false);

    } catch (error) {
      console.error('❌ 積込場所検索エラー:', error);
      toast.error('積込場所の検索に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * 🆕 荷降場所到着ボタンクリック（手動検索）
   */
  const handleUnloadingArrival = async () => {
    if (!currentPosition) {
      toast.error('GPS位置情報が取得できません');
      return;
    }

    try {
      setIsSubmitting(true);

      console.log('🔍 荷降場所検索開始:', {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        phase: 'TO_UNLOADING'
      });

      // 🆕 近隣地点を手動検索
      const nearbyResult = await apiService.getNearbyLocations({
        operationId: operationStore.operationId || '',
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        radiusMeters: 500,  // 🔧 修正: 200→500m（GPS誤差・登録座標ずれを考慮）
        phase: 'TO_UNLOADING'
      });

      console.log('📡 近隣地点検索レスポンス:', nearbyResult);

      // 🔧 修正: レスポンス構造に合わせてデータ取得
      const locations = nearbyResult.data?.locations || [];
      
      console.log('📍 検索結果:', {
        count: locations.length,
        locations: locations
      });
      
      if (locations.length === 0) {
        // 🆕 近隣地点が見つからない場合 → 新規登録ダイアログを表示
        toast('近くに登録されている荷降場所が見つかりません', {
          icon: 'ℹ️',
          duration: 3000
        });
        setRegistrationLocationType('UNLOADING');
        setShowRegistrationDialog(true);
        setIsSubmitting(false);
        return;
      }

      // 🆕 ダイアログ表示
      setLocationCandidates(locations);
      setDialogType('UNLOADING');
      setLocationDialogVisible(true);
      setIsSubmitting(false);

    } catch (error) {
      console.error('❌ 荷降場所検索エラー:', error);
      toast.error('荷降場所の検索に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * 🆕 地点選択完了ハンドラー
   */
  const handleLocationSelected = async (selectedLocation: NearbyLocationResult) => {
    if (!currentPosition) {
      toast.error('GPS位置情報が取得できません');
      return;
    }

    const currentOperationId = operationStore.operationId;
    
    console.log('🔍 運行ID確認:', {
      operationStoreId: currentOperationId,
      operationStateId: operation.id,
      vehicleId: operationStore.vehicleId,
      status: operationStore.status
    });
    
    if (!currentOperationId) {
      toast.error('運行IDが見つかりません。乗車前点検から運行を開始してください。', {
        duration: 5000
      });
      console.error('❌ 運行ID未設定:', {
        operationStoreId: operationStore.operationId,
        operationStateId: operation.id,
        operationStore: {
          ...operationStore
        }
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setLocationDialogVisible(false);

      console.log('📍 地点選択完了:', {
        type: dialogType,
        locationId: selectedLocation.location.id,
        locationName: selectedLocation.location.name,
        operationId: currentOperationId
      });

      if (dialogType === 'LOADING') {
        console.log('🚛 積込場所選択完了 → startLoadingAtLocation呼び出し後LoadingInput画面へ遷移');

        // ★ GPS状態修正: navigate前にLOADINGレコードをDBに作成
        // これによりGPSモニタリングが「運行中」→「積込中」に正しく変わる
        try {
          await apiService.startLoadingAtLocation(currentOperationId, {
            locationId: selectedLocation.location.id,
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy,
            startTime: new Date(),
          });
          console.log('✅ startLoadingAtLocation完了 → GPSステータス: 積込中');
        } catch (startLoadingErr) {
          // 失敗しても遷移は継続（LoadingInputで再度API呼ぶフローは維持）
          console.warn('⚠️ startLoadingAtLocation失敗（遷移は継続）:', startLoadingErr);
        }

        // 状態更新（座標も保存）
        setOperation(prev => ({
          ...prev,
          phase: 'AT_LOADING',
          loadingLocation: selectedLocation.location.name
        }));
        // 積込場所の座標をstoreに保存（距離検知用）
        operationStore.setLoadingLocationWithCoords(
          selectedLocation.location.name,
          selectedLocation.location.latitude ?? currentPosition.coords.latitude,
          selectedLocation.location.longitude ?? currentPosition.coords.longitude
        );

        toast.success(`積込場所「${selectedLocation.location.name}」に到着しました`);

        console.log('📍 次: D5積込場所入力画面へ遷移');
        navigate('/loading-input', {
          state: {
            locationId: selectedLocation.location.id,
            locationName: selectedLocation.location.name,
            clientName: selectedLocation.location.contactPerson || '担当者未登録',
            address: selectedLocation.location.address
          }
        });
      } else {
        // 荷降場所選択後は画面遷移せず地図表示のまま
        console.log('📦 荷降場所選択 - 地図画面のまま');

        // ✅ FIX-U1: U1パターンは recordUnloadingArrival を呼ばない
        //    → handleUnloadingStart(荷降開始ボタン)で startUnloading → レコード作成
        //    U2/U3: recordUnloadingArrival を呼ぶ
        const _upNow: number = Number(operationStore.unloadingPattern ?? 2);
        if (_upNow !== 1) {
          console.log(`🚛 荷降場所到着記録API呼び出し開始 (U${_upNow})`);
          await apiService.recordUnloadingArrival(currentOperationId, {
            locationId: selectedLocation.location.id,
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy,
            arrivalTime: new Date(),
            // ✅ この荷降だけの独立した客先（作成時点の運行客先を引き継ぐ）
            customerId: operationStore.customerId || undefined,
            // U3: 即時完了
            ...(_upNow === 3 ? { endTime: new Date() } : {}),
          } as any);
          console.log('✅ 荷降場所到着記録完了');
        } else {
          console.log('[U1] 荷降場所到着: recordUnloadingArrival スキップ。handleUnloadingStartで記録。');
          // U1: 場所情報をstoreに保存（handleUnloadingStartで使用）
          (operationStore as any).unloadingLocationLat = currentPosition.coords.latitude;
          (operationStore as any).unloadingLocationLng = currentPosition.coords.longitude;
          (operationStore as any).unloadingLocationAccuracy = currentPosition.coords.accuracy;
        }

        // 状態更新
        setOperation(prev => ({
          ...prev,
          phase: 'AT_UNLOADING',
          unloadingLocation: selectedLocation.location.name
        }));

        // operationStoreにも保存（locationId を渡す）
        operationStore.setUnloadingLocation(selectedLocation.location.name, selectedLocation.location.id);
        operationStore.setPhase('AT_UNLOADING');

        // 地図を保持したまま、地点情報を保存
        (window as any).selectedUnloadingLocation = {
          id: selectedLocation.location.id,
          name: selectedLocation.location.name,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy
        };

        toast.success(`荷降場所「${selectedLocation.location.name}」を選択しました`);
        console.log('📍 次: 荷降開始ボタンをクリックしてください');
      }

      setIsSubmitting(false);

    } catch (error) {
      console.error('❌ 到着記録エラー:', error);
      toast.error('到着記録に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * 🆕 地点選択キャンセル
   */
  const handleLocationDialogCancel = () => {
    setLocationDialogVisible(false);
    setLocationCandidates([]);
  };

  /**
   * 🆕 新規地点登録ハンドラー
   * 
   * 【機能概要】
   * - LocationRegistrationDialogから呼び出される
   * - 新規地点をAPIに登録
   * - 登録成功後、その地点を使用して到着記録
   * - 積込場所/荷降場所に応じて適切なAPIを呼び出し
   * 
   * 【処理フロー】
   * 1. バリデーション（GPS位置・運行IDの確認）
   * 2. createQuickLocation API呼び出し
   * 3. 登録成功 → locationId取得
   * 4. recordLoadingArrival または recordUnloadingArrival 呼び出し
   * 5. 状態更新（phase, loadingLocation/unloadingLocation）
   * 6. トースト通知
   * 7. ダイアログを閉じる
   * 
   * 【エラーハンドリング】
   * - GPS位置未取得: エラー表示してダイアログを閉じる
   * - 運行ID未設定: エラー表示してダイアログを閉じる
   * - API エラー: エラーログ出力、トースト表示、例外をスロー
   * - LocationRegistrationDialog側でisSubmittingをfalseに戻す
   */
  const handleLocationRegister = async (newLocationData: NewLocationData) => {
    if (!currentPosition) {
      toast.error('GPS位置情報が取得できません');
      setShowRegistrationDialog(false);
      return;
    }

    // 🔧 修正: operationStoreから運行IDを取得
    const currentOperationId = operationStore.operationId;
    
    if (!currentOperationId) {
      toast.error('運行IDが見つかりません。運行を開始してください。');
      console.error('❌ 運行ID未設定:', {
        operationStoreId: operationStore.operationId,
        operationStateId: operation.id
      });
      setShowRegistrationDialog(false);
      return;
    }

    try {
      console.log('🆕 新規地点登録開始:', newLocationData);

      // APIサービスを使用して新規地点を登録
      const response = await apiService.createQuickLocation(newLocationData);

      if (!response.success || !response.data) {
        throw new Error('地点登録に失敗しました');
      }

      const registeredLocation = response.data;
      console.log('✅ 地点登録成功:', registeredLocation);

      // 登録完了後、登録した地点を使用して到着記録
      if (registrationLocationType === 'LOADING') {
        console.log('🚛 積込場所登録完了 → LoadingInput画面へ遷移');

        // ✅ 【修正】recordLoadingArrival はLoadingConfirmationで呼ぶため、ここでは呼ばない
        //    （既存地点選択フローと同じ挙動に統一）

        // 状態更新
        setOperation(prev => ({
          ...prev,
          phase: 'AT_LOADING',
          loadingLocation: registeredLocation.name
        }));

        toast.success(`新規地点「${registeredLocation.name}」を登録しました`);

        // ★ GPS状態修正: navigate前にLOADINGレコードをDBに作成
        try {
          await apiService.startLoadingAtLocation(currentOperationId, {
            locationId: registeredLocation.id,
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy,
            startTime: new Date(),
          });
          console.log('✅ [新規地点] startLoadingAtLocation完了 → GPSステータス: 積込中');
        } catch (startLoadingErr) {
          console.warn('⚠️ [新規地点] startLoadingAtLocation失敗（遷移は継続）:', startLoadingErr);
        }

        // LoadingInput画面へ遷移（既存地点選択フローと同じ）
        setShowRegistrationDialog(false);
        setRegistrationLocationType(null);
        navigate('/loading-input', {
          state: {
            locationId: registeredLocation.id,
            locationName: registeredLocation.name,
            clientName: '',
            address: registeredLocation.address || ''
          }
        });
        return; // navigate後は後続のsetShowRegistrationDialog等不要
      } else if (registrationLocationType === 'UNLOADING') {
          // ✅ FIX-U1: U1パターンは recordUnloadingArrival を呼ばない
          //    → handleUnloadingStart(荷降開始ボタン)で startUnloading → レコード作成
          const _upReg: number = Number(operationStore.unloadingPattern ?? 2);
          if (_upReg !== 1) {
            console.log(`🚛 荷降場所到着記録API呼び出し開始 (U${_upReg}) [新規地点登録]`);
            await apiService.recordUnloadingArrival(currentOperationId, {
              locationId: registeredLocation.id,
              latitude: currentPosition.coords.latitude,
              longitude: currentPosition.coords.longitude,
              accuracy: currentPosition.coords.accuracy,
              arrivalTime: new Date(),
              customerId: operationStore.customerId || undefined,
              ...(_upReg === 3 ? { endTime: new Date() } : {}),
            } as any);
            console.log('✅ 荷降場所到着記録完了');
          } else {
            console.log('[U1新規地点] recordUnloadingArrival スキップ。handleUnloadingStartで記録。');
            (operationStore as any).unloadingLocationLat = currentPosition.coords.latitude;
            (operationStore as any).unloadingLocationLng = currentPosition.coords.longitude;
            (operationStore as any).unloadingLocationAccuracy = currentPosition.coords.accuracy;
          }
          
          // 状態更新
          setOperation(prev => ({
            ...prev,
            phase: 'AT_UNLOADING',
            unloadingLocation: registeredLocation.name
          }));

          // operationStoreにも保存
          operationStore.setUnloadingLocation(registeredLocation.name, registeredLocation.id);
          operationStore.setPhase('AT_UNLOADING');

          // window.selectedUnloadingLocation を設定（handleUnloadingStart/完了で使用）
          (window as any).selectedUnloadingLocation = {
            id: registeredLocation.id,
            name: registeredLocation.name,
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy
          };
          console.log('✅ window.selectedUnloadingLocation を設定しました:', (window as any).selectedUnloadingLocation);

          toast.success(`新規地点「${registeredLocation.name}」を登録し、荷降場所に到着しました`);
          console.log('📍 次: 荷降開始ボタンをクリックしてください');
        }

      // ダイアログを閉じる
      setShowRegistrationDialog(false);
      setRegistrationLocationType(null);

    } catch (error) {
      console.error('❌ 地点登録エラー:', error);
      toast.error('地点の登録に失敗しました');
      throw error; // LocationRegistrationDialogでキャッチしてisSubmittingをfalseにする
    }
  };

  /**
   * 🆕 新規地点登録キャンセルハンドラー
   * 
   * 【機能概要】
   * - LocationRegistrationDialogのキャンセルボタンから呼び出される
   * - ダイアログを閉じて状態をリセット
   */
  const handleLocationRegisterCancel = () => {
    setShowRegistrationDialog(false);
    setRegistrationLocationType(null);
  }

  // =====================================
  // REQ-011: 別客先へ切替ハンドラー
  // =====================================
  // ─── 詳細パネル: データ取得 ───
  const fetchDetailActivities = async () => {
    const opId = operationStore.operationId;
    if (!opId) return;
    setDetailLoading(true);
    try {
      const res = await (apiService as any).getOperationDetail(opId);
      const detail = res?.data ?? res;
      // ✅ BUG-051完全修正: 運行全体の客先名をstateに保存（storeのcustomerNameに依存しない）
      if (detail?.customerName) {
        setDetailOperationCustomerName(detail.customerName);
      }
      if (detail?.activities && Array.isArray(detail.activities)) {
        // ✅ BUG-051最終修正: NOTE含む全件を保存（客先変更履歴の参照用）
        setDetailAllActivities(detail.activities);
        // 表示用はNOTE/OTHERを除く
        setDetailActivities(detail.activities.filter((a: any) =>
          !['NOTE', 'OTHER'].includes(a.activityType || '')
        ).map((a: any) => ({
          ...a,
          // ✅ FIX-GPSPIN: APIレスポンスの locationLat/locationLng をActivityRecordに確保
          locationLat: a.locationLat ?? undefined,
          locationLng: a.locationLng ?? undefined,
          locationId: a.locationId ?? undefined,
        })));
      }
      try {
        const cr = await apiService.getCustomers();
        const ci = cr?.data?.customers ?? cr?.data ?? cr;
        if (Array.isArray(ci)) setDetailCustomers(ci);
      } catch {}
      try {
        const ir = await (apiService as any).getItems();
        // getItems レスポンス: { success, data: { items: [...] } } または { success, data: [...] }
        const ii = ir?.data?.items ?? (Array.isArray(ir?.data) ? ir.data : null) ?? ir;
        const itemList = Array.isArray(ii) ? ii : [];
        setDetailItems(itemList);
        console.log('[詳細パネル] 品目取得:', itemList.length, '件');
      } catch (e) {
        console.error('[詳細パネル] 品目取得失敗:', e);
      }
    } catch (e) {
      console.error('[詳細パネル] 取得失敗:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenCustomerDialog = async () => {
    try {
      const res = await apiService.getCustomers();
      if (res.success) {
        const inner = res.data?.data || res.data;
        const list = inner?.customers || (Array.isArray(inner) ? inner : []);
        setCustomerList(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      toast.error('客先一覧の取得に失敗しました');
    }
    setShowCustomerDialog(true);
  };

  const handleChangeCustomer = async (customerId: string, customerName: string) => {
    const currentOperationId = operationStore.operationId;
    if (!currentOperationId) {
      toast.error('運行IDが見つかりません');
      return;
    }
    setIsCustomerChanging(true);
    try {
      // BUG-019: retryWithBackoff追加（客先変更API）
      const res = await retryWithBackoff(
        () => apiService.changeOperationCustomer(currentOperationId, customerId),
        3, 1000, '客先変更'
      );
      if (res.success) {
        operationStore.setCustomerInfo({ customerId, customerName });
        toast.success(`客先を「${customerName}」に変更しました`);
        setShowCustomerDialog(false);
      } else {
        toast.error(res.message || '客先の変更に失敗しました');
      }
    } catch (e) {
      toast.error('客先の変更に失敗しました');
    } finally {
      setIsCustomerChanging(false);
    }
  };
;

  // =====================================
  // ✅ 既存の機能（完全保持）
  // =====================================

  /**
   * REQ-019: 積込開始ハンドラー（積込作業時間計測開始）
   * POST /trips/:id/loading/start で actualStartTime を記録
   */
  /**
   * 🆕 P1専用: 積込開始ハンドラー
   * startLoadingAtLocation API → actualStartTime(S) 記録
   * → LOADING_IN_PROGRESS フェーズへ（この状態の時間が積込作業時間）
   */
  const handleLoadingStart = async () => {
    const currentOperationId = operationStore.operationId;
    console.log('[D4-ボタン] 積込開始ボタン押下(P1):', { operationId: currentOperationId, phase: operation.phase });
    if (!currentOperationId) { toast.error('運行IDが見つかりません'); return; }
    const loadingLocationId = operationStore.loadingLocationId;
    if (!loadingLocationId) { toast.error('積込場所IDが見つかりません'); return; }
    try {
      setIsSubmitting(true);
      // ✅ FIX-P1: startLoading に品目・GPS情報も渡す
      const _p1ItemId = (operationStore as any).loadingItemId as string | undefined;
      const _p1CustomItemName = (operationStore as any).loadingCustomItemName as string | undefined;
      const _p1SelectedItemIds = (operationStore as any).loadingSelectedItemIds as string[] | undefined;
      const _p1Quantity = (operationStore as any).loadingQuantity as number | undefined;
      const _p1Notes = (operationStore as any).loadingNotes as string | undefined;
      const _p1Lat = (operationStore as any).loadingLocationLat as number | undefined;
      const _p1Lng = (operationStore as any).loadingLocationLng as number | undefined;
      const _p1Acc = (operationStore as any).loadingLocationAccuracy as number | undefined;
      const _p1CustomerId = (operationStore as any).loadingCustomerId as string | undefined;
      await retryWithBackoff(
        () => apiService.startLoadingAtLocation(currentOperationId, {
          locationId: loadingLocationId,
          startTime: new Date(),
          latitude: _p1Lat ?? currentPosition?.coords.latitude ?? undefined,
          longitude: _p1Lng ?? currentPosition?.coords.longitude ?? undefined,
          accuracy: _p1Acc ?? currentPosition?.coords.accuracy ?? undefined,
          notes: _p1Notes || '積込開始',
          // ✅ P1: 場所選択時に保存した品目情報を startLoading に渡す
          itemId: _p1ItemId,
          selectedItemIds: _p1SelectedItemIds,
          quantity: _p1Quantity,
          customItemName: _p1CustomItemName,
          // ✅ この積込だけの独立した客先
          customerId: _p1CustomerId,
        } as any),
        3, 1000, '積込開始'
      );
      setOperation(prev => ({ ...prev, phase: 'LOADING_IN_PROGRESS' }));
      operationStore.setPhase('LOADING_IN_PROGRESS');
      // ✅ FB-J1o6dgv8: 最初の積込開始時刻を記録（経過時間のゼロ点）
      if (!firstLoadingStartRef.current) {
        firstLoadingStartRef.current = new Date();
        breakTotalSecondsRef.current = 0;
      }
      toast.success('積込を開始しました（積込完了ボタンで完了してください）');
      apiService.logOperationEvent({
        eventType: 'LOADING_ARRIVED', operationId: currentOperationId,
        locationId: loadingLocationId, locationName: operationStore.loadingLocation || undefined,
        phase: 'LOADING_IN_PROGRESS', result: 'success',
      }).catch(() => {});
    } catch (error) {
      console.error('積込開始エラー:', error);
      toast.error('積込開始に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * REQ-019: 積込完了ハンドラー（積込作業時間計測終了）
   * POST /trips/:id/loading/complete で actualEndTime を記録
   * → actualStartTime〜actualEndTime の差分が積込作業時間（荷待ち含む）
   */
  const handleLoadingComplete = async () => {
    const currentOperationId = operationStore.operationId;
    console.log('[D4-ボタン] 積込完了ボタン押下:', { operationId: currentOperationId, phase: operation.phase, loadingLocation: operationStore.loadingLocation, loadingLocationId: operationStore.loadingLocationId });
    if (!currentOperationId) {
      toast.error('運行IDが見つかりません');
      return;
    }
    try {
      setIsSubmitting(true);
      // ✅ 修正: operationStore に保存された品目情報を completeLoading に渡す
      const loadingItemId = (operationStore as any).loadingItemId as string | undefined;
      const loadingCustomItemName = (operationStore as any).loadingCustomItemName as string | undefined;
      console.log('[D4-積込完了] 品目情報:', { loadingItemId, loadingCustomItemName });
      await retryWithBackoff(
        () => apiService.completeLoadingAtLocation(currentOperationId, {
          endTime: new Date(),
          notes: '積込完了',
          ...(loadingItemId ? { itemId: loadingItemId } : {}),
          ...(loadingCustomItemName ? { customItemName: loadingCustomItemName } : {}),
        }),
        3, 1000, '積込完了'
      );
      // フェーズを荷降場所移動中に更新
      setOperation(prev => ({ ...prev, phase: 'TO_UNLOADING' }));
      operationStore.setPhase('TO_UNLOADING');
      toast.success('積込が完了しました。荷降場所へ移動してください。');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'LOADING_COMPLETED',
        operationId: currentOperationId,
        locationId: operationStore.loadingLocationId || undefined,
        locationName: operationStore.loadingLocation || undefined,
        phase: operationStore.phase,
        result: 'success',
      }).catch(() => {});
      setIsSubmitting(false);
    } catch (error) {
      console.error('積込完了エラー:', error);
      toast.error('積込完了に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * 🆕 U1専用: 荷降開始ハンドラー（UNLOADING_IN_PROGRESSフェーズへ）
   * startUnloadingAtLocation API → actualStartTime(S) 記録
   * この状態の時間が荷降作業時間
   */
  const handleUnloadingStart = async () => {
    const currentOperationId = operationStore.operationId;
    console.log('[D4-ボタン] 荷降開始ボタン押下(U1):', { operationId: currentOperationId, phase: operation.phase });
    if (!currentOperationId) { toast.error('運行IDが見つかりません'); return; }
    const unloadingLocationId = operationStore.unloadingLocationId
      ?? (window as any).selectedUnloadingLocation?.id ?? undefined;
    if (!unloadingLocationId) { toast.error('荷降場所IDが見つかりません'); return; }
    try {
      setIsSubmitting(true);
      // ✅ FIX-U1: storeに保存されたGPS情報を使用
      const _u1Lat = (operationStore as any).unloadingLocationLat as number | undefined;
      const _u1Lng = (operationStore as any).unloadingLocationLng as number | undefined;
      const _u1Acc = (operationStore as any).unloadingLocationAccuracy as number | undefined;
      await retryWithBackoff(
        () => apiService.startUnloadingAtLocation(currentOperationId, {
          locationId: unloadingLocationId,
          startTime: new Date(),
          latitude: _u1Lat ?? currentPosition?.coords.latitude ?? undefined,
          longitude: _u1Lng ?? currentPosition?.coords.longitude ?? undefined,
          accuracy: _u1Acc ?? currentPosition?.coords.accuracy ?? undefined,
          notes: '荷降開始',
          customerId: operationStore.customerId || undefined,
        } as any),
        3, 1000, '荷降開始'
      );
      setOperation(prev => ({ ...prev, phase: 'UNLOADING_IN_PROGRESS' }));
      operationStore.setPhase('UNLOADING_IN_PROGRESS');
      toast.success('荷降を開始しました（荷降完了ボタンで完了してください）');
    } catch (error) {
      console.error('荷降開始エラー:', error);
      toast.error('荷降開始に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 荷降完了ハンドラー
   */
  const handleUnloadingComplete = async () => {
    // 確認ダイアログ
    const confirmed = window.confirm('積降を完了しますか？');
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      
      const currentOperationId = operationStore.operationId;
      if (!currentOperationId) {
        toast.error('運行IDが見つかりません');
        setIsSubmitting(false);
        return;
      }

      console.log('[D4-ボタン] 荷降完了ボタン押下:', JSON.stringify({ operationId: currentOperationId, phase: operation.phase, unloadingLocation: operationStore.unloadingLocation, unloadingLocationId: operationStore.unloadingLocationId }));
      console.log('📦 荷降完了API呼び出し:', {
        tripId: currentOperationId
      });

      // 🔧 修正: locationId を operationStore から取得して送信
      const unloadingLocationId = operationStore.unloadingLocationId
        ?? (window as any).selectedUnloadingLocation?.id
        ?? undefined;
      console.log('📦 荷降完了 locationId:', unloadingLocationId);
      await retryWithBackoff(
        () => apiService.completeUnloadingAtLocation(currentOperationId, {
          locationId: unloadingLocationId,
          endTime: new Date(),
          latitude: currentPosition?.coords.latitude,
          longitude: currentPosition?.coords.longitude,
          accuracy: currentPosition?.coords.accuracy,
          notes: '荷降完了',
        }),
        3, 1000, '荷降完了'
      );

      console.log('✅ 荷降完了');

      // フェーズ更新: TO_LOADING（次の積込場所へ移動）
      setOperation(prev => ({
        ...prev,
        phase: 'TO_LOADING'
      }));
      operationStore.setPhase('TO_LOADING');
      (window as any).selectedUnloadingLocation = null;
      departureAlertFiredRef.current = false;

      toast.success('荷降が完了しました。次の積込場所へ移動してください。');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'UNLOADING_COMPLETED',
        operationId: currentOperationId,
        locationId: unloadingLocationId || undefined,
        locationName: operationStore.unloadingLocation || undefined,
        phase: 'TO_LOADING',
        result: 'success',
      }).catch(() => {});
      setIsSubmitting(false);

    } catch (error) {
      console.error('❌ 荷降完了エラー:', error);
      toast.error('荷降完了に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 休憩開始ハンドラー
   * 🆕 2025年12月28日修正: API呼び出し実装
   */
  const handleBreakStart = async () => {
    try {
      setIsSubmitting(true);
      
      // 🔧 修正: operationStoreから運行IDを取得
      const currentOperationId = operationStore.operationId || operation.id;
      
      if (!currentOperationId) {
        toast.error('運行IDが見つかりません');
        setIsSubmitting(false);
        return;
      }
      
      console.log('[D4-ボタン] 休憩開始ボタン押下:', { operationId: currentOperationId, phase: operation.phase, gps: currentPosition ? { lat: currentPosition.coords.latitude, lng: currentPosition.coords.longitude } : null });
      console.log('☕ 休憩開始処理開始:', currentOperationId);
      
      // BUG-019: リトライ付き
      const response = await retryWithBackoff(
        () => apiService.startBreak(currentOperationId, {
        latitude: currentPosition?.coords.latitude,
        longitude: currentPosition?.coords.longitude,
        accuracy: currentPosition?.coords.accuracy,  // 🆕 追加
        location: '',  // 休憩場所名（任意）
        notes: ''  // メモ（任意）
      }),
        3, 1000, '休憩開始'
      );
      
      console.log('✅ 休憩開始API成功:', response);
      
      // operationStoreに現在phaseを保存してからBREAKに切り替え（永続化）
      operationStore.savePreviousPhase(operation.phase);
      // ✅ FB-J1o6dgv8: 休憩開始時刻を記録（経過時間停止用）
      breakStartRef.current = new Date();
      operationStore.setPhase('BREAK');
      operationStore.incrementBreakCount();  // 🔧 永続化に反映 (2026-02-01)
      setOperation(prev => ({ 
        ...prev, 
        phase: 'BREAK',
        breakCount: prev.breakCount + 1
      }));
      toast.success('休憩を開始しました');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'BREAK_START',
        operationId: currentOperationId,
        gps: currentPosition ? { lat: currentPosition.coords.latitude, lng: currentPosition.coords.longitude, accuracy: currentPosition.coords.accuracy } : undefined,
        phase: 'BREAK',
        result: 'success',
      }).catch(() => {});
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('❌ 休憩開始エラー:', error);
      toast.error('休憩開始に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 休憩終了ハンドラー
   * 🆕 2025年12月28日修正: API呼び出し実装
   */
  const handleBreakEnd = async () => {
    try {
      setIsSubmitting(true);
      
      // 🔧 修正: operationStoreから運行IDを取得
      const currentOperationId = operationStore.operationId || operation.id;
      
      if (!currentOperationId) {
        toast.error('運行IDが見つかりません');
        setIsSubmitting(false);
        return;
      }
      
      console.log('[D4-ボタン] 休憩終了ボタン押下:', { operationId: currentOperationId, phase: operation.phase, previousPhase: operationStore.previousPhase });
      console.log('⏱️ 休憩終了処理開始:', currentOperationId);
      
      // BUG-019: リトライ付き
      const response = await retryWithBackoff(
        () => apiService.endBreak(currentOperationId, {
        latitude: currentPosition?.coords.latitude,
        longitude: currentPosition?.coords.longitude,
        accuracy: currentPosition?.coords.accuracy,
        notes: ''
      }),
        3, 1000, '休憩終了'
      );
      
      console.log('✅ 休憩終了API成功:', response);
      
      // 🔧 修正: operationStore.previousPhase から休憩前のフェーズを復元
      // (operationStore.phaseはBREAKのため使用不可)
      const restoredPhase = operationStore.previousPhase || 'TO_UNLOADING';
      console.log('⏱️ 休憩終了: フェーズ復元', restoredPhase);

      // ✅ FB-J1o6dgv8: 休憩経過秒を累計に加算（経過時間の再開用）
      if (breakStartRef.current) {
        const breakSec = Math.floor((Date.now() - breakStartRef.current.getTime()) / 1000);
        breakTotalSecondsRef.current += breakSec;
        breakStartRef.current = null;
      }

      // operationStoreのphaseも更新（永続化）
      operationStore.setPhase(restoredPhase);
      
      // 休憩前のフェーズに戻る
      setOperation(prev => ({ 
        ...prev, 
        phase: restoredPhase
      }));
      
      toast.success('休憩を終了しました');
      // 🚛 運行イベントログ
      apiService.logOperationEvent({
        eventType: 'BREAK_END',
        operationId: currentOperationId,
        phase: restoredPhase,
        result: 'success',
      }).catch(() => {});
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('❌ 休憩終了エラー:', error);
      toast.error('休憩終了に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 給油記録ハンドラー
   */
  const handleRefuel = () => {
    // ✅ 給油開始時刻（ボタンクリック時刻）を保存（運行時event発生時刻定義準拠）
    try { sessionStorage.setItem('fuelStartTime', new Date().toISOString()); } catch { /* ignore */ }
    // 給油記録画面へ遷移（実際の記録はRefuelRecord.tsx内で行う）
    navigate('/refuel-record'); // ✅ BUG-GPS-NAV: navigate統一（GPS停止しない）
  };

  /**
   * 🆕 新規地点登録ハンドラー
   * LocationSelectionDialogの「新規登録」ボタンから呼び出される
   */
  const handleCreateNewLocation = () => {
    console.log('🆕 新規地点登録ボタンがクリックされました');
    
    // 地点選択ダイアログを閉じる
    setLocationDialogVisible(false);
    setLocationCandidates([]);
    
    // GPS座標確認
    if (!currentPosition) {
      toast.error('GPS座標を取得できません');
      return;
    }
    
    // 🔧 修正: dialogTypeをそのまま使用（'LOADING' | 'UNLOADING'）
    setRegistrationLocationType(dialogType);
    
    // 🆕 新規登録ダイアログを表示
    setShowRegistrationDialog(true);
    
    console.log('📍 新規地点登録ダイアログを表示:', {
      locationType: dialogType,
      latitude: currentPosition.coords.latitude,
      longitude: currentPosition.coords.longitude
    });
  };

  /**
   * 🆕 運行終了ハンドラー（最終版 - Home遷移とエラー抑制）
   * - 運行終了API呼び出し
   * - operationStoreのリセット
   * - 既存トーストのクリア
   * - Home画面（/vehicle-info）への自動遷移
   */
  const handleOperationEnd = () => {
    if (!window.confirm('降車時点検を実施します。よろしいですか?')) {
      return;
    }
    // ✅ BUG-039修正: 降車時点検に遷移する前にGPS追跡を完全停止
    // stopTracking()内でstopGPSInterval()+clearWatch()+isTrackingRef=false が実行される
    stopTracking();
    console.log('🛑 [BUG-039] 運行終了前GPS追跡停止完了');
    // 降車時点検画面に遷移
    navigate('/post-trip-inspection');
  };

  // =====================================
  // フェーズ別ボタン表示ロジック
  // =====================================

  const getPhaseButtons = () => {
    switch (operation.phase) {
      case 'TO_LOADING':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleLoadingArrival}
              disabled={isSubmitting || !currentPosition}
              style={{
                padding: '20px 16px',
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#2196F3',
                border: 'none',
                borderRadius: '10px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              📍 積込場所到着
            </button>

          </div>
        );

      case 'AT_LOADING': {
        // P1: 積込開始ボタン（startLoadingAtLocation API → LOADING_IN_PROGRESS）
        // P2: 積込完了ボタン（completeLoading API → TO_UNLOADING）
        // P3: 即時完了（LoadingInputで既に完了済み）→ AT_LOADINGになるはずがないがフォールバック
        const _lp: number = Number(operationStore.loadingPattern ?? 2);
        // P3フォールバック: 万一AT_LOADINGに留まっていたら自動でTO_UNLOADINGへ
        if (_lp === 3) {
          console.warn('[P3フォールバック] AT_LOADING+P3を検出 → TO_UNLOADINGに自動遷移');
          operationStore.setPhase('TO_UNLOADING');
          setOperation(prev => ({ ...prev, phase: 'TO_UNLOADING' }));
          return null;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {_lp === 1 ? (
              <button
                onClick={handleLoadingStart}
                disabled={isSubmitting}
                style={{
                  padding: '20px 16px', fontSize: '20px', fontWeight: 'bold',
                  color: 'white', background: isSubmitting ? '#ccc' : '#4CAF50',
                  border: 'none', borderRadius: '10px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer', width: '100%'
                }}
              >
                🚛 積込開始
              </button>
            ) : (
              <>
                <div style={{
                  padding: '10px 16px', fontSize: '13px', color: '#666',
                  background: '#E3F2FD', borderRadius: '8px', textAlign: 'center'
                }}>
                  📍 積込場所に到着中 — 積込が完了したら下のボタンを押してください
                </div>
                <button
                  onClick={handleLoadingComplete}
                  disabled={isSubmitting}
                  style={{
                    padding: '20px 16px', fontSize: '20px', fontWeight: 'bold',
                    color: 'white', background: isSubmitting ? '#ccc' : '#FF9800',
                    border: 'none', borderRadius: '10px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer', width: '100%'
                  }}
                >
                  ✅ 積込完了
                </button>
              </>
            )}
          </div>
        );
      }

      case 'LOADING_IN_PROGRESS':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleLoadingComplete}
              disabled={isSubmitting}
              style={{
                padding: '20px 16px',
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#FF9800',
                border: 'none',
                borderRadius: '10px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              ✅ 積込完了
            </button>
          </div>
        );

      case 'TO_UNLOADING':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleUnloadingArrival}
              disabled={isSubmitting || !currentPosition}
              style={{
                padding: '20px 16px',
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#4CAF50',
                border: 'none',
                borderRadius: '10px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              📍 荷降場所到着
            </button>
          </div>
        );

      case 'AT_UNLOADING': {
        // U1: 荷降開始ボタン（startUnloadingAtLocation API → UNLOADING_IN_PROGRESS）
        // U2: 荷降完了ボタン（completeUnloading API → TO_LOADING）
        // U3: 即時完了（UnloadingArrivalで既に完了済み）→ AT_UNLOADINGになるはずがないがフォールバック
        const _up: number = Number(operationStore.unloadingPattern ?? 2);
        // U3フォールバック: 万一AT_UNLOADINGに留まっていたら自動でTO_LOADINGへ
        if (_up === 3) {
          console.warn('[U3フォールバック] AT_UNLOADING+U3を検出 → TO_LOADINGに自動遷移');
          operationStore.setPhase('TO_LOADING');
          setOperation(prev => ({ ...prev, phase: 'TO_LOADING' }));
          return null;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {_up === 1 ? (
              <button
                onClick={handleUnloadingStart}
                disabled={isSubmitting}
                style={{
                  padding: '20px 16px', fontSize: '20px', fontWeight: 'bold',
                  color: 'white', background: isSubmitting ? '#ccc' : '#4CAF50',
                  border: 'none', borderRadius: '10px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer', width: '100%'
                }}
              >
                🏗️ 荷降開始
              </button>
            ) : (
              <>
                <div style={{
                  padding: '10px 16px', fontSize: '13px', color: '#666',
                  background: '#FFF3E0', borderRadius: '8px', textAlign: 'center'
                }}>
                  📍 荷降場所に到着中 — 積降が完了したら下のボタンを押してください
                </div>
                <button
                  onClick={handleUnloadingComplete}
                  disabled={isSubmitting}
                  style={{
                    padding: '20px 16px', fontSize: '20px', fontWeight: 'bold',
                    color: 'white', background: isSubmitting ? '#ccc' : '#FF9800',
                    border: 'none', borderRadius: '10px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer', width: '100%'
                  }}
                >
                  ✅ 荷降完了
                </button>
              </>
            )}
          </div>
        );
      }

      case 'UNLOADING_IN_PROGRESS':
        // U1専用: 荷降作業中（UNLOADING_IN_PROGRESS）→ 荷降完了ボタン
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '10px 16px', fontSize: '13px', color: '#666',
              background: '#E8F5E9', borderRadius: '8px', textAlign: 'center'
            }}>
              🏗️ 荷降作業中 — 完了したら下のボタンを押してください
            </div>
            <button
              onClick={handleUnloadingComplete}
              disabled={isSubmitting}
              style={{
                padding: '20px 16px', fontSize: '20px', fontWeight: 'bold',
                color: 'white', background: isSubmitting ? '#ccc' : '#FF9800',
                border: 'none', borderRadius: '10px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer', width: '100%'
              }}
            >
              ✅ 荷降完了
            </button>
          </div>
        );

      case 'BREAK':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleBreakEnd}
              disabled={isSubmitting}
              style={{
                padding: '20px 16px',
                fontSize: '20px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#9C27B0',
                border: 'none',
                borderRadius: '10px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              ⏱️ 休憩終了
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // =====================================
  // レンダリング
  // =====================================

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      background: '#f5f5f5'
    }}>
      {/* ヘッダー */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            🚛 運行記録
          </h1>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            {currentTime.toLocaleTimeString('ja-JP')}
          </div>
        </div>
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', opacity: 1.0 }}>
            {operation.vehicleName || operationStore.vehicleNumber || ''}
          </span>
          <span style={{ fontSize: '15px', opacity: 0.85 }}>
            {operation.driverName || authStore.user?.name || ''}
          </span>
        </div>
        {/* REQ-011: 客先名 + 切替ボタン */}
        <div style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.15)',
          border: '1.5px solid rgba(255,255,255,0.5)',
          borderRadius: '8px',
          padding: '6px 10px',
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flex: 1,
            minWidth: 0,
          }}>
            <span>🏢</span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {customerName || '客先未設定'}
            </span>
          </div>
          {/* REQ-011: 切替ボタンはD5（LoadingInput）へ移動したため非表示 */}
          <button
            onClick={handleOpenCustomerDialog}
            disabled={isSubmitting || operation.phase === 'BREAK'}
            title="別客先へ切替"
            style={{
              display: 'none',
              marginLeft: '8px',
              flexShrink: 0,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.7)',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '18px',
              cursor: (isSubmitting || operation.phase === 'BREAK') ? 'not-allowed' : 'default',
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* ステータスバー */}
      <div style={{
        background: 'white',
        padding: '16px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>経過時間</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            {String(elapsedTime.hours).padStart(2, '0')}:
            {String(elapsedTime.minutes).padStart(2, '0')}:
            {String(elapsedTime.seconds).padStart(2, '0')}
          </span>
        </div>
        {/* ✅ FB-LUKAeaX8/3YRGMstF: 走行距離は非表示（ドライバー要望） */}
      </div>

      {/* フェーズバナー */}
      <div style={{
        background: getPhaseColor(operation.phase),
        color: 'white',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: '16px',
        fontWeight: 'bold',
        letterSpacing: '0.5px',
        flexShrink: 0,
      }}>
        現在のフェーズ: {getPhaseLabel(operation.phase)}
     </div>
      {showMap && (
        <div style={{ height: '50vh', position: 'relative', flexShrink: 0 }}>
          <GoogleMapWrapper onMapReady={() => setIsMapReady(true)} />
          
          {/* ✅ 既存: 方位インジケーター */}
          {heading !== null && (
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <HeadingIndicator heading={heading} />
            </div>
          )}
        </div>
      )}

      {/* 詳細パネル（全画面オーバーレイ - 修正: position:fixed でスクロール完全対応）*/}
      {showDetailPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            {/* ヘッダー */}
            <div style={{ background: '#5048b8', color: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>運行詳細情報</span>
              <button onClick={() => setShowDetailPanel(false)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            {/* サマリー */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e5e7eb', flexShrink: 0 }}>
              {[
                { val: operation.driverName || '-', lbl: '運転手' },
                { val: operation.vehicleName || '-', lbl: '車番' },
                { val: `${detailActivities.filter(a => ['LOADING','LOADING_START','LOADING_COMPLETE'].includes(a.activityType)).length}回`, lbl: '積込回数' },
                { val: `${detailActivities.filter(a => ['UNLOADING','UNLOADING_START','UNLOADING_COMPLETE'].includes(a.activityType)).length}回`, lbl: '荷降回数' },
              ].map(({ val, lbl }) => (
                <div key={lbl} style={{ background: '#f9fafb', padding: '5px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{val}</div>
                  <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>{lbl}</div>
                </div>
              ))}
            </div>
            {/* リスト（運行履歴詳細画面と同じグループ表示スタイル） */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#fff', WebkitOverflowScrolling: 'touch', padding: '8px 10px' }}>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#6b7280', padding: '2px 2px 6px', letterSpacing: '.05em', textTransform: 'uppercase' }}>運行内容 — タップで編集</div>
              {detailLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>読み込み中...</div>
              ) : detailActivities.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>アクティビティなし</div>
              ) : (() => {
                // トレードカラー定数（運行履歴詳細画面と統一）
                const TC = {
                  LOADING_BG: '#E3F2FD', LOADING_FG: '#1565C0', LOADING_BORDER: '#2196F3',
                  UNLOADING_BG: '#E8F5E9', UNLOADING_FG: '#2E7D32', UNLOADING_BORDER: '#4CAF50',
                  BREAK_BG: '#F3E5F5', BREAK_FG: '#6A1B9A', BREAK_BORDER: '#9C27B0',
                  FUEL_BG: '#FFF3E0', FUEL_FG: '#E65100', FUEL_BORDER: '#FF9800',
                  OTHER_BG: '#F9FAFB', OTHER_FG: '#6B7280', OTHER_BORDER: '#E5E7EB',
                };
                // ✅ すべてのイベントで「開始 ～ 終了」形式に統一表示
                const fmtRange = (startIso: string | null, endIso: string | null): string => {
                  const s = startIso ? new Date(startIso).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
                  const e = endIso ? new Date(endIso).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }) : null;
                  return e ? `${s} ～ ${e}` : s;
                };
                const itemsLabel = (act: any): string => {
                  const names: string[] = Array.isArray(act.itemNames) && act.itemNames.length > 0
                    ? act.itemNames
                    : (act.itemName ? [act.itemName] : []);
                  if (act.customItemName && !names.includes(act.customItemName)) names.push(act.customItemName);
                  return names.join('、');
                };
                const getCustomerAtTime = (loadingSeq: number): string => {
                  const changeHistory: { seq: number; to: string }[] = [];
                  for (const a of [...detailAllActivities].sort(
                    (x: any, y: any) => (x.sequenceNumber ?? 0) - (y.sequenceNumber ?? 0)
                  )) {
                    if ((a.activityType === 'NOTE' || a.activityType === 'OTHER') && a.notes) {
                      const m = String(a.notes).match(/客先変更[:：]\s*.+?[→\-]+\s*(.+)/);
                      if (m && m[1]) changeHistory.push({ seq: a.sequenceNumber ?? 0, to: m[1].trim() });
                    }
                  }
                  let currentCustomer = detailOperationCustomerName || '';
                  for (const ch of changeHistory) {
                    if (ch.seq <= loadingSeq) currentCustomer = ch.to;
                  }
                  return currentCustomer;
                };

                // グループ化（積込/荷降/休憩1くくり）
                // ✅ 重要: LOADING/UNLOADING は「1レコードに到着(startTime)〜完了(endTime)を記録する」単一行モデル。
                //   BREAK のみ BREAK_START/BREAK_END の2レコードモデル。
                type ActGroup =
                  | { type: 'LOADING_GROUP';   groupNum: number; act: any }
                  | { type: 'UNLOADING_GROUP'; groupNum: number; act: any }
                  | { type: 'BREAK';           start: any; end: any | null }
                  | { type: 'SINGLE';          act: any };
                const sorted = [...detailActivities].sort((a: any, b: any) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
                const groups: ActGroup[] = [];
                const used = new Set<string>();
                let lgNum = 0, ugNum = 0;
                for (let i = 0; i < sorted.length; i++) {
                  const a = sorted[i];
                  if (used.has(a.id)) continue;
                  const at = a.activityType;
                  if (at === 'LOADING') {
                    lgNum++;
                    groups.push({ type: 'LOADING_GROUP', groupNum: lgNum, act: a });
                  } else if (at === 'UNLOADING') {
                    ugNum++;
                    groups.push({ type: 'UNLOADING_GROUP', groupNum: ugNum, act: a });
                  } else if (['BREAK_START', 'BREAK'].includes(at)) {
                    const endAct = sorted.slice(i + 1).find((b: any) => !used.has(b.id) && b.activityType === 'BREAK_END') ?? null;
                    if (endAct) used.add(endAct.id);
                    groups.push({ type: 'BREAK', start: a, end: endAct });
                  } else if (at === 'BREAK_END') {
                    // 孤立 BREAK_END はスキップ
                  } else {
                    groups.push({ type: 'SINGLE', act: a });
                  }
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groups.map((g, gi) => {
                      if (g.type === 'LOADING_GROUP' || g.type === 'UNLOADING_GROUP') {
                        const isLd = g.type === 'LOADING_GROUP';
                        const bdr = isLd ? TC.LOADING_BORDER : TC.UNLOADING_BORDER;
                        const hBg = isLd ? TC.LOADING_BG : TC.UNLOADING_BG;
                        const hFg = isLd ? TC.LOADING_FG : TC.UNLOADING_FG;
                        const lbl = isLd ? '積込' : '荷降';
                        const act = g.act;
                        const loc = act.locationName || '';
                        const custName = isLd
                          ? (act.customerName || getCustomerAtTime(act.sequenceNumber ?? 0))
                          : act.customerName;
                        const hasCompleted = !!act.endTime;
                        return (
                          <div key={gi} style={{ border: `2px solid ${bdr}`, borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ background: hBg, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: hFg }}>
                                🚛 {lbl}{g.groupNum > 1 ? `（${g.groupNum}回目）` : ''}
                              </span>
                              {loc && <span style={{ fontSize: 11, color: '#6b7280' }}>─ {loc}</span>}
                              {custName && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: hFg }}>🏢 {custName}</span>
                              )}
                              <span style={{ marginLeft: 'auto', fontSize: 11, color: hFg, fontWeight: 600 }}>
                                {fmtRange(act.startTime, act.endTime)}
                              </span>
                            </div>
                            <button
                              onClick={() => setEditingActivity(act)}
                              style={{ width: '100%', padding: '5px 12px', borderBottom: hasCompleted ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                            >
                              <span style={{ fontSize: 12, color: '#374151' }}>● 到着</span>
                              <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {fmtRange(act.startTime, null)}
                                <span style={{ fontSize: 11, color: '#d1d5db' }}>✏️</span>
                              </span>
                            </button>
                            {hasCompleted && (
                              <button
                                onClick={() => setEditingActivity(act)}
                                style={{ width: '100%', padding: '5px 12px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 12, color: '#374151' }}>● {lbl}完了</span>
                                  <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {fmtRange(act.endTime, null)}
                                    <span style={{ fontSize: 11, color: '#d1d5db' }}>✏️</span>
                                  </span>
                                </div>
                                {itemsLabel(act) && (
                                  <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2, textAlign: 'left' }}>
                                    品目: {itemsLabel(act)}
                                    {act.quantity != null && Number(act.quantity) > 0 ? ` × ${act.quantity}t` : ''}
                                  </div>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      }
                      if (g.type === 'BREAK') {
                        return (
                          <button
                            key={gi}
                            onClick={() => setEditingActivity(g.start)}
                            style={{ border: `2px solid ${TC.BREAK_BORDER}`, borderRadius: 10, overflow: 'hidden', width: '100%', background: '#fff', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                          >
                            <div style={{ background: TC.BREAK_BG, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: TC.BREAK_FG }}>☕ 休憩</span>
                              <span style={{ marginLeft: 'auto', fontSize: 11, color: TC.BREAK_FG, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {fmtRange(g.start.startTime, g.end ? g.end.startTime : g.start.endTime)}
                                <span style={{ fontSize: 11, color: TC.BREAK_FG, opacity: 0.6 }}>✏️</span>
                              </span>
                            </div>
                            {g.start.locationName && <div style={{ padding: '4px 12px', fontSize: 11, color: '#6b7280' }}>📍 {g.start.locationName}</div>}
                          </button>
                        );
                      }
                      const act = g.act;
                      const isF = ['FUELING', 'FUEL'].includes(act.activityType);
                      const LABELS: Record<string, string> = {
                        FUELING: '給油', FUEL: '給油',
                      };
                      const ICONS: Record<string, string> = {
                        FUELING: '⛽', FUEL: '⛽',
                      };
                      const label = LABELS[act.activityType] || act.activityType;
                      const icon = ICONS[act.activityType] || '•';
                      return (
                        <button
                          key={gi}
                          onClick={() => setEditingActivity(act)}
                          style={{
                            width: '100%', textAlign: 'left', cursor: 'pointer',
                            border: `1.5px solid ${isF ? TC.FUEL_BORDER : TC.OTHER_BORDER}`, borderRadius: 10,
                            padding: '8px 12px', background: isF ? TC.FUEL_BG : TC.OTHER_BG,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: isF ? TC.FUEL_FG : TC.OTHER_FG }}>{icon} {label}</span>
                            <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {fmtRange(act.startTime, act.endTime)}
                              <span style={{ fontSize: 11, color: '#d1d5db' }}>✏️</span>
                            </span>
                          </div>
                          {act.locationName && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>📍 {act.locationName}</div>}
                          {itemsLabel(act) && (
                            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
                              品目: {itemsLabel(act)}{act.quantity != null && Number(act.quantity) > 0 ? ` × ${act.quantity}t` : ''}
                            </div>
                          )}
                          {act.notes && !['積込完了', '荷降完了', '運行開始'].includes(act.notes) && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{act.notes}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* コントロールパネル */}
      <div style={{
        background: 'white',
        padding: '16px',
        borderTop: '2px solid #e0e0e0',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
        position: 'relative',
        zIndex: 1000
      }}>

        {/* フェーズ別ボタン */}
        {getPhaseButtons()}

        {/* 共通ボタン */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr', 
          gap: '8px',
          marginTop: '12px'
        }}>
          <button
            onClick={handleBreakStart}
            disabled={isSubmitting || operation.phase === 'BREAK'}
            style={{
              padding: '20px 12px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              background: operation.phase === 'BREAK' ? '#ccc' : '#9C27B0',
              border: 'none',
              borderRadius: '10px',
              cursor: operation.phase === 'BREAK' ? 'not-allowed' : 'pointer'
            }}
          >
            ☕ 休憩
          </button>
          
          <button
            onClick={handleRefuel}
            disabled={isSubmitting || operation.phase === 'BREAK'}
            style={{
              padding: '20px 12px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              background: (isSubmitting || operation.phase === 'BREAK') ? '#ccc' : '#FFC107',
              border: 'none',
              borderRadius: '10px',
              cursor: (isSubmitting || operation.phase === 'BREAK') ? 'not-allowed' : 'pointer'
            }}
          >
            ⛽ 給油
          </button>
          
          <button
            onClick={() => {
              if (!showDetailPanel) fetchDetailActivities();
              setShowDetailPanel(p => !p);
            }}
            style={{
              padding: '20px 12px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              background: showDetailPanel ? '#37474F' : '#607D8B',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            {showDetailPanel ? '📋 詳細 ▲' : '📋 詳細'}
          </button>
        </div>

        {/* 運行終了ボタン */}
        <button
          onClick={handleOperationEnd}
          disabled={isSubmitting || operation.phase === 'BREAK'}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '20px',
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'white',
            background: (isSubmitting || operation.phase === 'BREAK') ? '#ccc' : '#F44336',
            border: 'none',
            borderRadius: '10px',
            cursor: (isSubmitting || operation.phase === 'BREAK') ? 'not-allowed' : 'pointer'
          }}
        >
          🏁 運行終了
        </button>
      </div>

      {/* 🆕 地点選択ダイアログ */}
      <LocationSelectionDialog
        locations={locationCandidates}
        visible={locationDialogVisible}
        onSelect={handleLocationSelected}
        onCancel={handleLocationDialogCancel}
        onCreateNew={handleCreateNewLocation}  // 🆕 ハンドラーを追加
        title={dialogType === 'LOADING' ? '積込場所を選択' : '荷降場所を選択'}
      />

      
      {/* REQ-011: 別客先へ切替ダイアログ */}
      {showCustomerDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            width: '100%', maxWidth: '360px', maxHeight: '80vh', overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
              🔄 別客先へ切替
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>
              変更する客先を選択してください
            </p>
            {customerList.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                客先が登録されていません
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customerList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleChangeCustomer(c.id, c.name)}
                    disabled={isCustomerChanging}
                    style={{
                      padding: '12px 16px',
                      fontSize: '15px',
                      textAlign: 'left',
                      background: isCustomerChanging ? '#f5f5f5' : '#f8f9fa',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      cursor: isCustomerChanging ? 'not-allowed' : 'pointer',
                      color: '#333'
                    }}
                  >
                    🏢 {c.name}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowCustomerDialog(false)}
              style={{
                marginTop: '16px', width: '100%', padding: '12px',
                fontSize: '15px', background: '#e0e0e0', border: 'none',
                borderRadius: '8px', cursor: 'pointer', color: '#333'
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

{/* 🆕 新規地点登録ダイアログ */}
      {currentPosition && registrationLocationType && (
        <LocationRegistrationDialog
          visible={showRegistrationDialog}
          locationType={registrationLocationType}
          currentPosition={{
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
            accuracy: currentPosition.coords.accuracy
          }}
          onRegister={handleLocationRegister}
          onCancel={handleLocationRegisterCancel}
        />
      )}

      {/* 編集シート（全画面スライドイン）*/}
      {editingActivity && (
        <ActivityEditSheet
          activity={editingActivity}
          operationId={operationStore.operationId || ''}
          onClose={() => setEditingActivity(null)}
          onDeleted={(deletedId) => {
            setDetailActivities(prev => prev.filter(a => a.id !== deletedId));
            setEditingActivity(null);
          }}
          onSaved={(updated) => {
            setDetailActivities(prev =>
              prev.map(a => a.id === updated.id ? { ...a, ...updated } : a)
            );
            setEditingActivity(null);
          }}
          customers={detailCustomers}
          items={detailItems}
        />
      )}
    </div>
  );
};

// ✅ 既存: フェーズラベル取得関数
function getPhaseLabel(phase: OperationPhase): string {
  switch (phase) {
    case 'TO_LOADING': return '積込場所へ移動中';
    case 'AT_LOADING': return '積込場所到着';
    case 'LOADING_IN_PROGRESS': return '積込中';
    case 'TO_UNLOADING': return '荷降場所へ移動中';
    case 'AT_UNLOADING': return '荷降場所到着';
    // UNLOADING_IN_PROGRESS: 廃止
    case 'BREAK': return '休憩中';
    case 'REFUEL': return '給油中';
    default: return '不明';
  }
}

// 🆕 フェーズカラー取得
const getPhaseColor = (phase: string): string => {
  switch (phase) {
    case 'TO_LOADING':    return '#2196F3';
    case 'AT_LOADING':    return '#4CAF50';
    case 'LOADING_IN_PROGRESS': return '#FF9800';
    case 'TO_UNLOADING':  return '#4CAF50';
    case 'AT_UNLOADING':  return '#FF9800';
    case 'BREAK':         return '#9C27B0';
    default:              return '#607D8B';
  }
};

export default OperationRecord;

// =====================================
// ✅ 既存機能100%保持 + D5/D6新仕様対応 + 新規地点登録機能完了
// =====================================

/**
 * ✅ 既存機能（完全保持）
 * - 運行状態管理（全フィールド）
 * - 経過時間計算
 * - GPS追跡・マップ表示
 * - 方位インジケーター
 * - 詳細情報パネル
 * - ステータスバー（経過時間、走行距離、速度、燃料）
 * - フェーズ別ボタン表示
 * - 積込開始・完了
 * - 荷降開始・完了
 * - 休憩開始・終了
 * - 給油記録
 * - 運行終了
 * - 詳細表示切替
 * - マップ表示切替
 *
 * 🆕 D5/D6新仕様追加機能
 * - GPS近隣地点自動検知を停止
 * - 「積込場所到着」ボタンクリック時に手動検索
 * - 「荷降場所到着」ボタンクリック時に手動検索
 * - 複数候補地点の選択ダイアログ
 * - 新API使用（recordLoadingArrival/recordUnloadingArrival）
 * - locationId取得フロー実装
 * - 詳細なコンソールログ出力（デバッグ用）
 * 
 * 🆕 新規地点登録機能（2025年12月7日）
 * - 近隣地点0件時に新規登録ダイアログ表示
 * - LocationRegistrationDialogコンポーネント統合
 * - createQuickLocation API呼び出し
 * - 登録後の自動到着記録
 * - 状態管理とエラーハンドリング
 * 
 * 🔧 修正内容（2025年12月7日）
 * - ❌ 削除: operation-temp-id ハードコード
 * - ✅ 追加: operationStore.operationId を使用
 * - ✅ 追加: 運行ID未設定時のエラーハンドリング
 * - ✅ 追加: 運行IDのnullチェック（handleLocationSelected, handleLocationRegister）
 * - ✅ 追加: useEffect で operationStore.operationId を監視し operation.id に反映
 * - ✅ 追加: コンソールログで operationStoreId と operationStateId を出力（デバッグ用）
 * - ✅ 追加: import { useOperationStore } from '../stores/operationStore'
 * 
 * 🔧 修正内容（2025年12月26日 - 最新版）
 * - ✅ 修正: handleOperationEnd に toast.dismiss() 追加（既存トーストクリア）
 * - ✅ 修正: handleOperationEnd の遷移先を /vehicle-info に確定
 * - ✅ 修正: useEffect の運行ID未設定時のエラー表示を削除（静かに遷移）
 * - ✅ 追加: 運行終了後のクリーンな画面遷移を実現
 */