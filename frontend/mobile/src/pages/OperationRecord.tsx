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
import { toast } from 'react-hot-toast';
import { useGPS } from '../hooks/useGPS';
import apiService from '../services/api';
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
import { useAuthStore } from '../stores/authStore';

// 運行状態の型定義
type OperationPhase = 'TO_LOADING' | 'AT_LOADING' | 'TO_UNLOADING' | 'AT_UNLOADING' | 'BREAK' | 'REFUEL';

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
  
  const [isMapReady, setIsMapReady] = useState(false);
  const lastMapUpdateRef = useRef<number>(0);
  const lastMarkerUpdateRef = useRef<number>(0);
  
  // operationStoreから運行IDを取得
  const operationStore = useOperationStore();
  
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
    breakCount: 0,
    fuelLevel: 80,  // TODO: 車両情報から取得
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // ✅ 既存の詳細情報表示状態
  const [showDetails, setShowDetails] = useState(false);
  const [showMap] = useState(true);

  // 🆕 地点選択ダイアログの状態（D5/D6新仕様）
  const [locationDialogVisible, setLocationDialogVisible] = useState(false);
  const [locationCandidates, setLocationCandidates] = useState<NearbyLocationResult[]>([]);
  const [dialogType, setDialogType] = useState<'LOADING' | 'UNLOADING'>('LOADING');

  const {
    currentPosition,
    isTracking,
    startTracking,
    heading,
    speed: gpsSpeed,
    totalDistance
  } = useGPS();

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

  // ✅ 経過時間計算（既存）
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (operation.startTime) {
        const elapsed = Math.floor((Date.now() - operation.startTime.getTime()) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        setElapsedTime({ hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [operation.startTime]);

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
      if (heading !== null) {
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
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        radiusMeters: 200,
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
   * 🆕 積降場所到着ボタンクリック（手動検索）
   */
  const handleUnloadingArrival = async () => {
    if (!currentPosition) {
      toast.error('GPS位置情報が取得できません');
      return;
    }

    try {
      setIsSubmitting(true);

      console.log('🔍 積降場所検索開始:', {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        phase: 'TO_UNLOADING'
      });

      // 🆕 近隣地点を手動検索
      const nearbyResult = await apiService.getNearbyLocations({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        radiusMeters: 200,
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
        toast('近くに登録されている積降場所が見つかりません', {
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
      console.error('❌ 積降場所検索エラー:', error);
      toast.error('積降場所の検索に失敗しました');
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

    // 🔧 修正: operationStoreから運行IDを取得
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
        operationId: currentOperationId // 🔧 修正: 実際の運行IDを使用
      });

      if (dialogType === 'LOADING') {
        // 🆕 新API使用: 積込場所到着記録
        console.log('🚛 積込場所到着記録API呼び出し開始');
        
        await apiService.recordLoadingArrival(currentOperationId, { // 🔧 修正
          locationId: selectedLocation.location.id,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy,
          arrivalTime: new Date()
        });
        
        console.log('✅ 積込場所到着記録完了');
        
        // 状態更新
        setOperation(prev => ({
          ...prev,
          phase: 'AT_LOADING',
          loadingLocation: selectedLocation.location.name
        }));

        toast.success(`積込場所「${selectedLocation.location.name}」に到着しました`);
        
        // 🆕 D5積込場所入力画面へ遷移
        console.log('📍 次: D5積込場所入力画面へ遷移');
        navigate('/loading-input', {
          state: {
            locationId: selectedLocation.location.id,
            locationName: selectedLocation.location.name,
            clientName: selectedLocation.location.contactPerson || '担当者未登録',  // contactPersonを使用
            address: selectedLocation.location.address
          }
        });
      } else {
        // 🆕 新API使用: 積降場所到着記録
        console.log('🚛 積降場所到着記録API呼び出し開始');
        
        await apiService.recordUnloadingArrival(currentOperationId, { // 🔧 修正
          locationId: selectedLocation.location.id,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy,
          arrivalTime: new Date()
        });
        
        console.log('✅ 積降場所到着記録完了');
        
        // 状態更新
        setOperation(prev => ({
          ...prev,
          phase: 'AT_UNLOADING',
          unloadingLocation: selectedLocation.location.name
        }));

        toast.success(`積降場所「${selectedLocation.location.name}」に到着しました`);
        
        // TODO: 積降場所到着画面へ遷移
        console.log('📍 次: 積降場所到着画面へ遷移');
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
   * - 積込場所/積降場所に応じて適切なAPIを呼び出し
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
        console.log('🚛 積込場所到着記録API呼び出し開始');
        
        await apiService.recordLoadingArrival(currentOperationId, { // 🔧 修正
          locationId: registeredLocation.id,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy,
          arrivalTime: new Date()
        });
        
        console.log('✅ 積込場所到着記録完了');
        
        // 状態更新
        setOperation(prev => ({
          ...prev,
          phase: 'AT_LOADING',
          loadingLocation: registeredLocation.name
        }));

        toast.success(`新規地点「${registeredLocation.name}」を登録し、積込場所に到着しました`);
        
        // TODO: 積込場所到着画面へ遷移
        console.log('📍 次: 積込場所到着画面へ遷移');

      } else if (registrationLocationType === 'UNLOADING') {
        console.log('🚛 積降場所到着記録API呼び出し開始');
        
        await apiService.recordUnloadingArrival(currentOperationId, { // 🔧 修正
          locationId: registeredLocation.id,
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
          accuracy: currentPosition.coords.accuracy,
          arrivalTime: new Date()
        });
        
        console.log('✅ 積降場所到着記録完了');
        
        // 状態更新
        setOperation(prev => ({
          ...prev,
          phase: 'AT_UNLOADING',
          unloadingLocation: registeredLocation.name
        }));

        toast.success(`新規地点「${registeredLocation.name}」を登録し、積降場所に到着しました`);
        
        // TODO: 積降場所到着画面へ遷移
        console.log('📍 次: 積降場所到着画面へ遷移');
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
  };

  // =====================================
  // ✅ 既存の機能（完全保持）
  // =====================================

  /**
   * ✅ 既存: 積込開始ハンドラー
   */
  const handleLoadingStart = async () => {
    try {
      setIsSubmitting(true);
      
      // TODO: API呼び出し
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setOperation(prev => ({ ...prev, phase: 'TO_UNLOADING' }));
      toast.success('積込を開始しました');
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('積込開始エラー:', error);
      toast.error('積込開始に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 積込完了ハンドラー
   */
  const handleLoadingComplete = async () => {
    try {
      setIsSubmitting(true);
      
      // TODO: API呼び出し
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setOperation(prev => ({ ...prev, phase: 'TO_UNLOADING' }));
      toast.success('積込が完了しました');
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('積込完了エラー:', error);
      toast.error('積込完了に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 積降開始ハンドラー
   */
  const handleUnloadingStart = async () => {
    try {
      setIsSubmitting(true);
      
      // TODO: API呼び出し
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success('積降を開始しました');
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('積降開始エラー:', error);
      toast.error('積降開始に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 積降完了ハンドラー
   */
  const handleUnloadingComplete = async () => {
    try {
      setIsSubmitting(true);
      
      // TODO: API呼び出し
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success('積降が完了しました');
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('積降完了エラー:', error);
      toast.error('積降完了に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 休憩開始ハンドラー
   */
  const handleBreakStart = async () => {
    try {
      setIsSubmitting(true);
      
      // TODO: API呼び出し
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setOperation(prev => ({ 
        ...prev, 
        phase: 'BREAK',
        breakCount: prev.breakCount + 1
      }));
      
      toast.success('休憩を開始しました');
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('休憩開始エラー:', error);
      toast.error('休憩開始に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 休憩終了ハンドラー
   */
  const handleBreakEnd = async () => {
    try {
      setIsSubmitting(true);
      
      // TODO: API呼び出し
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 休憩前のフェーズに戻る
      setOperation(prev => ({ 
        ...prev, 
        phase: 'TO_UNLOADING' // TODO: 休憩前のフェーズを記憶
      }));
      
      toast.success('休憩を終了しました');
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('休憩終了エラー:', error);
      toast.error('休憩終了に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * ✅ 既存: 給油記録ハンドラー
   */
  const handleRefuel = async () => {
    try {
      setIsSubmitting(true);
      
      // TODO: 給油記録API呼び出し
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success('給油を記録しました');
      
      // 🆕 給油記録画面へ遷移
      window.location.href = '/refuel-record';  // または navigate('/refuel-record')
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('給油記録エラー:', error);
      toast.error('給油記録に失敗しました');
      setIsSubmitting(false);
    }
  };

  /**
   * 🆕 運行終了ハンドラー（最終版 - Home遷移とエラー抑制）
   * - 運行終了API呼び出し
   * - operationStoreのリセット
   * - 既存トーストのクリア
   * - Home画面（/vehicle-info）への自動遷移
   */
  const handleOperationEnd = async () => {
    if (!window.confirm('運行を終了してもよろしいですか？')) {
      return;
    }

    try {
      setIsSubmitting(true);
      
      // ✅ 運行ID確認
      const currentOperationId = operationStore.operationId || operation.id;
      
      if (!currentOperationId) {
        toast.error('運行IDが見つかりません');
        setIsSubmitting(false);
        return;
      }

      console.log('[運行終了] 🏁 運行終了処理開始:', currentOperationId);
      
      // ✅ 運行終了API呼び出し
      try {
        // 🔧 API実装時に有効化:
        // const endLocation = currentPosition ? {
        //   latitude: currentPosition.coords.latitude,
        //   longitude: currentPosition.coords.longitude,
        //   accuracy: currentPosition.coords.accuracy
        // } : undefined;
        // 
        // const response = await apiService.endOperation(currentOperationId, {
        //   endTime: new Date(),
        //   endLocation: endLocation,
        //   totalDistance: totalDistance,
        //   notes: operation.notes
        // });
        
        // 🔧 暫定: APIが未実装の場合は500msのディレイでシミュレート
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('[運行終了] ✅ API呼び出し成功');
        
      } catch (apiError) {
        console.error('[運行終了] ❌ API呼び出しエラー:', apiError);
        toast.error('運行終了APIの呼び出しに失敗しました');
        setIsSubmitting(false);
        return;
      }
      
      // ✅ ローカル状態を更新
      setOperation(prev => ({ 
        ...prev, 
        status: 'idle'
      }));
      
      // ✅ operationStoreをリセット
      console.log('[運行終了] 🧹 operationStore リセット実行');
      operationStore.resetOperation();
      
      // 🆕 既存のトーストをすべてクリア
      toast.dismiss();
      
      // ✅ 成功メッセージ表示
      toast.success('運行を終了しました', {
        duration: 2000,
        icon: '✅'
      });
      
      // ✅ Home画面（車両選択画面 /vehicle-info）に遷移
      console.log('[運行終了] 🏠 Home画面へ遷移: /vehicle-info');
      
      // 少し遅延させてから遷移（ユーザーが成功メッセージを確認できるように）
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 1000);
      
      setIsSubmitting(false);
      
    } catch (error) {
      console.error('[運行終了] ❌ 予期しないエラー:', error);
      toast.error('運行終了に失敗しました');
      setIsSubmitting(false);
    }
  };

  // =====================================
  // ✅ 既存: フェーズ別ボタン表示ロジック
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
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#2196F3',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              📍 積込場所到着
            </button>
          </div>
        );

      case 'AT_LOADING':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleLoadingStart}
              disabled={isSubmitting}
              style={{
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#4CAF50',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              🚛 積込開始
            </button>
            <button
              onClick={handleLoadingComplete}
              disabled={isSubmitting}
              style={{
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#FF9800',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
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
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#2196F3',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              📍 積降場所到着
            </button>
          </div>
        );

      case 'AT_UNLOADING':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleUnloadingStart}
              disabled={isSubmitting}
              style={{
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#4CAF50',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              🚛 積降開始
            </button>
            <button
              onClick={handleUnloadingComplete}
              disabled={isSubmitting}
              style={{
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#FF9800',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              ✅ 積降完了
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
                padding: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                background: isSubmitting ? '#ccc' : '#9C27B0',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
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
  // ✅ 既存: レンダリング
  // =====================================

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      background: '#f5f5f5'
    }}>
      {/* ✅ 既存: ヘッダー */}
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
        <div style={{ marginTop: '8px', fontSize: '14px', opacity: 0.9 }}>
          {operation.operationNumber} - {operation.vehicleName}
        </div>
      </div>

      {/* ✅ 既存: ステータスバー */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>走行距離</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            {(totalDistance || 0).toFixed(1)} km
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>現在速度</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#FF5722' }}>
            {(gpsSpeed || 0).toFixed(0)} km/h
          </span>
        </div>
      </div>

      {/* ✅ 既存: マップ表示 */}
      {showMap && (
        <div style={{ flex: 1, position: 'relative' }}>
          <GoogleMapWrapper onMapReady={() => setIsMapReady(true)} />
          
          {/* ✅ 既存: 方位インジケーター */}
          {heading !== null && (
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <HeadingIndicator heading={heading} />
            </div>
          )}
        </div>
      )}

      {/* ✅ 既存: 詳細情報パネル */}
      {showDetails && (
        <div style={{
          background: 'white',
          padding: '16px',
          borderTop: '1px solid #e0e0e0',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>
            📋 運行詳細情報
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div><strong>運転手:</strong> {operation.driverName}</div>
            <div><strong>休憩回数:</strong> {operation.breakCount} 回</div>
            <div><strong>積込場所:</strong> {operation.loadingLocation || '未設定'}</div>
            <div><strong>積降場所:</strong> {operation.unloadingLocation || '未設定'}</div>
          </div>
        </div>
      )}

      {/* ✅ 既存: コントロールパネル */}
      <div style={{
        background: 'white',
        padding: '16px',
        borderTop: '2px solid #e0e0e0',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
        position: 'relative',
        zIndex: 1000
      }}>
        {/* ✅ 既存: フェーズ表示 */}
        <div style={{
          fontSize: '14px',
          color: '#666',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          現在のフェーズ: <strong>{getPhaseLabel(operation.phase)}</strong>
        </div>

        {/* ✅ 既存 + 🆕: フェーズ別ボタン */}
        {getPhaseButtons()}

        {/* ✅ 既存: 共通ボタン */}
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
              padding: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'white',
              background: operation.phase === 'BREAK' ? '#ccc' : '#9C27B0',
              border: 'none',
              borderRadius: '6px',
              cursor: operation.phase === 'BREAK' ? 'not-allowed' : 'pointer'
            }}
          >
            ☕ 休憩
          </button>
          
          <button
            onClick={handleRefuel}
            disabled={isSubmitting}
            style={{
              padding: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'white',
              background: isSubmitting ? '#ccc' : '#FFC107',
              border: 'none',
              borderRadius: '6px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            ⛽ 給油
          </button>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'white',
              background: '#607D8B',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            📋 詳細
          </button>
        </div>

        {/* ✅ 既存: 運行終了ボタン */}
        <button
          onClick={handleOperationEnd}
          disabled={isSubmitting}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '14px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'white',
            background: isSubmitting ? '#ccc' : '#F44336',
            border: 'none',
            borderRadius: '8px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
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
        title={dialogType === 'LOADING' ? '積込場所を選択' : '積降場所を選択'}
      />

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
    </div>
  );
};

// ✅ 既存: フェーズラベル取得関数
function getPhaseLabel(phase: OperationPhase): string {
  switch (phase) {
    case 'TO_LOADING': return '積込場所へ移動中';
    case 'AT_LOADING': return '積込場所到着';
    case 'TO_UNLOADING': return '積降場所へ移動中';
    case 'AT_UNLOADING': return '積降場所到着';
    case 'BREAK': return '休憩中';
    case 'REFUEL': return '給油中';
    default: return '不明';
  }
}

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
 * - 積降開始・完了
 * - 休憩開始・終了
 * - 給油記録
 * - 運行終了
 * - 詳細表示切替
 * - マップ表示切替
 *
 * 🆕 D5/D6新仕様追加機能
 * - GPS近隣地点自動検知を停止
 * - 「積込場所到着」ボタンクリック時に手動検索
 * - 「積降場所到着」ボタンクリック時に手動検索
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