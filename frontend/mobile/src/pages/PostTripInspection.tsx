// frontend/mobile/src/pages/PostTripInspection.tsx
// D8: 降車後点検画面 - endOdometer/endFuelLevel送信対応版
// ✅ 修正: 運行終了APIにendOdometerとendFuelLevelを送信
// ✅ 追加: 終了走行距離入力フィールド（必須）
// ✅ 追加: 終了燃料レベル入力フィールド（オプション）

import React, { useState, useEffect } from 'react';
import { useTLog } from '../hooks/useTLog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ClipboardCheck, 
  ArrowLeft, 
  CheckCircle2,
  Circle,
  Loader2,
  Truck,
  XCircle,
  RefreshCcw,
  Gauge,
  Droplet
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useOperationStore } from '../stores/operationStore';
import { apiService } from '../services/api';

interface InspectionItem {
  id: string;
  name: string;
  description?: string;
  inspectionType: 'PRE_TRIP' | 'POST_TRIP';
  inputType: 'CHECKBOX' | 'TEXT' | 'NUMBER' | 'SELECT';
  category?: string;
  displayOrder: number;
  isRequired: boolean;
  isActive: boolean;
  checked: boolean;
}

const PostTripInspection: React.FC = () => {
  useTLog('POST_TRIP_INSP', '帰着後点検');

  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { 
    operationId,
    vehicleId, 
    vehicleNumber, 
    vehicleType,
    driverId,
    resetOperation,
    // ✅ Fix-S11-8: フロント累積走行距離をendOperation送信に含める
    totalDistanceKm: storedTotalDistanceKm
  } = useOperationStore();
  
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCriticalError, setIsCriticalError] = useState(false);
  const [notes, setNotes] = useState('');
  
  // ============================================
  // ✅ 追加: 終了走行距離と終了燃料レベルの状態
  // ============================================
  const [endOdometer, setEndOdometer] = useState<number | null>(null);
  const [endFuelLevel, setEndFuelLevel] = useState<number | null>(null);

  // 画面初期化
  useEffect(() => {
    console.log('[D8] 画面初期化開始');
    
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (!operationId || !vehicleId) {
      toast.error('運行情報が見つかりません');
      navigate('/home', { replace: true });
      return;
    }

    // BUG-007: vehicleIdのDB存在確認
    const validateVehicleId = async () => {
      try {
        await apiService.getVehicleById(vehicleId);
        fetchInspectionItems();
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 400) {
          console.error('[D8] BUG-007: 不正なvehicleId検出、Storeリセット:', vehicleId);
          toast.error('車両情報が無効です。\n再度車両を選択してください。', { duration: 6000 });
          resetOperation();
          navigate('/vehicle-info', { replace: true });
        } else {
          console.warn('[D8] BUG-007: vehicleId検証エラー（続行）:', err.message);
          fetchInspectionItems();
        }
      }
    };
    validateVehicleId();
  }, [isAuthenticated, operationId, vehicleId, navigate]);


  // BUG-014: キャッシュユーティリティ
  const INSPECTION_CACHE_KEY = 'inspection_items_cache_post_trip';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  const loadFromCache = (): any[] | null => {
    try {
      const raw = localStorage.getItem(INSPECTION_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
        localStorage.removeItem(INSPECTION_CACHE_KEY);
        return null;
      }
      return parsed.items;
    } catch { return null; }
  };

  const saveToCache = (items: any[]) => {
    try {
      localStorage.setItem(INSPECTION_CACHE_KEY, JSON.stringify({ items, savedAt: Date.now() }));
    } catch { /* ignore */ }
  };

  const fetchInspectionItems = async () => {
    setIsFetching(true);
    setError(null);
    setIsCriticalError(false);

    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[D8] 📋 点検項目取得 (試行 ${attempt}/${MAX_RETRIES})`);

        const response = await apiService.getInspectionItems({
          inspectionType: 'POST_TRIP',
          isActive: true
        });

        if (response.success && response.data) {
          const raw = Array.isArray(response.data) ? response.data : (response.data.data || []);

          if (raw.length === 0) {
            setIsCriticalError(true);
            setError('点検項目マスタが登録されていません。システム管理者に連絡してください。');
            setIsFetching(false);
            return;
          }

          const items = raw
            .map((item: any) => ({ ...item, checked: false }))
            .sort((a: any, b: any) => a.displayOrder - b.displayOrder);

          setInspectionItems(items);
          saveToCache(items);
          console.log(`[D8] ✅ 点検項目取得成功: ${items.length}件`);
          setIsFetching(false);
          return;
        }
        throw new Error(response.message || '点検項目の取得に失敗しました');

      } catch (err: any) {
        lastError = err;
        console.warn(`[D8] ⚠️ 試行 ${attempt} 失敗:`, err.message);
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[D8] ⏳ ${delay}ms 後に再試行...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // 全リトライ失敗 → キャッシュ確認
    const cached = loadFromCache();
    if (cached && cached.length > 0) {
      const restored = cached.map((item: any) => ({ ...item, checked: false }));
      setInspectionItems(restored);
      setError('オフラインモード: 前回取得した点検項目を使用しています');
      setIsCriticalError(false);
      toast('ネットワーク不可のため前回の点検項目を使用します', { icon: '📦', duration: 4000 });
    } else {
      let msg = '点検項目の読み込みに失敗しました（3回試行済み）';
      if (lastError?.code === 'ECONNABORTED' || lastError?.message?.includes('timeout')) {
        msg = 'タイムアウトしました。ネットワーク接続を確認してください。';
      } else if (lastError?.response?.status === 500) {
        msg = 'サーバーエラーが発生しました。管理者に連絡してください。';
      } else if (lastError?.message) {
        msg = lastError.message;
      }
      setError(msg);
      setIsCriticalError(true);
      toast.error(msg, { duration: 5000 });
    }
    setIsFetching(false);
  };

  /**
   * 点検項目チェック切り替え
   */
  const toggleInspectionItem = (id: string) => {
    setInspectionItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  /**
   * 全てチェック/クリア
   */
  const handleCheckAll = () => {
    const allChecked = inspectionItems.every(item => item.checked);
    setInspectionItems(prev =>
      prev.map(item => ({ ...item, checked: !allChecked }))
    );
  };

  /**
   * 運行終了処理
   * ✅ 修正: endOdometerとendFuelLevelを送信
   */
  const handleComplete = async () => {
    try {
      // ============================================
      // ✅ 追加: 必須チェック
      // ============================================
      if (!endOdometer) {
        toast.error('運行終了時の走行距離を入力してください');
        return;
      }

      // ✅ TypeScript修正: vehicleId/driverId/operationIdのnullチェック
      if (!vehicleId || !driverId || !operationId) {
        toast.error('運行情報が不足しています');
        navigate('/home', { replace: true });
        return;
      }

      const allChecked = inspectionItems.every(item => item.checked);
      if (!allChecked) {
        toast.error('すべての点検項目を確認してください');
        return;
      }

      setIsLoading(true);
      console.log('[D8] 🏁 運行終了処理開始');

      // 1. 点検記録作成
      console.log('[D8] 📝 降車時点検記録作成開始');
      const inspectionResults = inspectionItems.map(item => ({
        inspectionItemId: item.id,
        resultValue: item.checked ? 'OK' : 'NG',
        isPassed: item.checked,
        notes: ''
      }));

      const inspectionResponse = await apiService.createInspectionRecord({
        vehicleId,
        inspectorId: driverId,
        inspectionType: 'POST_TRIP',
        results: inspectionResults,
        notes: notes || '降車後点検完了'
      });

      if (!inspectionResponse.success) {
        throw new Error('点検記録の作成に失敗しました');
      }

      console.log('[D8] ✅ 降車時点検記録作成成功:', inspectionResponse.data?.id);

      // ============================================
      // ✅ 修正: endOdometerとendFuelLevelを送信
      // ============================================
      // 🆕 GPS座標取得
      let endPosition: { latitude: number; longitude: number; accuracy?: number } | undefined;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,   // ✅ BUG-033: GPS_CONFIG.TIMEOUT と同一値
            maximumAge: 0     // ✅ BUG-033: キャッシュ無効（Fix-5A と同一設定）
          });
        });
        endPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        console.log('[D8] 📍 GPS座標取得成功:', endPosition);
      } catch (gpsError) {
        console.warn('[D8] ⚠️ GPS座標取得失敗（運行終了は続行）:', gpsError);
      }

      console.log('[D8] 🏁 運行終了API呼び出し:', operationId);
      console.log('[D8] 📊 送信データ:', {
        endTime: new Date(),
        endOdometer,
        endFuelLevel,
        endPosition,
        notes: notes || ''
      });

      const endResponse = await apiService.endOperation(operationId, {
        endTime: new Date(),
        endOdometer,
        endFuelLevel: endFuelLevel ?? undefined,
        endPosition,             // 🆕 GPS座標送信
        notes: notes || '',
        // ✅ Fix-S11-8: フロント(useGPS)累積走行距離をバックエンドに送信
        // endOdometer/startOdometer 未設定の場合のtotalDistanceKmフォールバックとして使用
        ...(storedTotalDistanceKm !== undefined && storedTotalDistanceKm !== null && {
          totalDistanceKm: Number(storedTotalDistanceKm)
        })
      });

      if (!endResponse.success) {
        throw new Error('運行終了に失敗しました');
      }

      console.log('[D8] ✅ 運行終了成功');

      // Store リセット
      console.log('[D8] 🧹 operationStore リセット');
      resetOperation();

      toast.success('運行を終了しました');

      // Home画面へ遷移
      console.log('[D8] 🏠 Home画面へ遷移');
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 500);

    } catch (error: any) {
      console.error('[D8] ❌ 運行終了エラー:', error);
      const errorMessage = error.response?.data?.message || error.message || '運行終了に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/operation-record');
  };

  const handleRetry = () => {
    fetchInspectionItems();
  };

  const checkedCount = inspectionItems.filter(item => item.checked).length;
  const allChecked = inspectionItems.every(item => item.checked);
  const progressPercentage = inspectionItems.length > 0 
    ? Math.round((checkedCount / inspectionItems.length) * 100) 
    : 0;

  // ローディング中の表示
  if (isFetching) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">点検項目を読み込んでいます...</p>
        </div>
      </div>
    );
  }

  // エラー表示
  if (isCriticalError && error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white p-6">
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">読み込みエラー</h2>
              <p className="text-gray-600">{error}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg 
                  flex items-center justify-center space-x-2 transition-colors"
              >
                <RefreshCcw className="w-5 h-5" />
                <span>再試行</span>
              </button>

              <button
                onClick={handleBack}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg 
                  transition-colors"
              >
                運行中画面に戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">降車後点検</h1>
            </div>
            <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-semibold">
              {checkedCount}/{inspectionItems.length}
            </div>
          </div>

          {/* 車両情報 */}
          {vehicleNumber && vehicleType && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <Truck className="w-5 h-5 text-white/80" />
                <div className="text-sm">
                  <p className="font-semibold">{vehicleNumber}</p>
                  <p className="text-white/80 text-xs">{vehicleType}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto px-6 py-6">
        {/* 進捗バー */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">点検進捗</span>
            <span className="text-sm font-bold text-blue-600">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* 全てチェックボタン */}
        <button
          onClick={handleCheckAll}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 
            text-white font-bold py-3 px-4 rounded-lg shadow-lg mb-4 
            transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>{allChecked ? 'すべてクリア' : 'すべてチェック'}</span>
        </button>

        {/* 点検項目リスト */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3">
            <h2 className="text-white font-bold text-lg">点検項目</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {inspectionItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleInspectionItem(item.id)}
                className="w-full px-6 py-4 flex items-center justify-between 
                  hover:bg-blue-50 active:bg-blue-100 transition-all duration-200 group"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`
                    flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                    transition-all duration-300
                    ${item.checked 
                      ? 'bg-blue-600 border-blue-600 scale-110' 
                      : 'border-gray-300 group-hover:border-blue-400'
                    }
                  `}>
                    {item.checked ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 group-hover:text-blue-400" />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <span className={`
                      font-medium transition-all duration-200
                      ${item.checked 
                        ? 'text-gray-400 line-through' 
                        : 'text-gray-800'
                      }
                    `}>
                      {item.name}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ============================================ */}
        {/* ✅ 追加: 終了走行距離入力フィールド */}
        {/* ============================================ */}
        <div className="bg-amber-50 rounded-xl shadow-md p-5 mb-4 border-2 border-amber-200">
          <label className="flex items-center space-x-2 mb-3">
            <Gauge className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-bold text-gray-800">
              <span className="text-red-600">*</span> 運行終了時の走行距離 (km)
            </span>
          </label>
          <input
            type="number"
            step="0.1"
            value={endOdometer || ''}
            onChange={(e) => setEndOdometer(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="例: 12567.5"
            className="w-full px-4 py-3 text-lg font-semibold border-2 border-amber-300 rounded-lg
              focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200
              transition-all duration-200"
          />
          <p className="text-xs text-gray-600 mt-2">
            ※ 開始時からの走行距離を自動計算するため、正確な値を入力してください
          </p>
        </div>

        {/* ============================================ */}
        {/* ✅ 追加: 終了燃料レベル入力フィールド */}
        {/* ============================================ */}
        <div className="bg-blue-50 rounded-xl shadow-md p-5 mb-4 border-2 border-blue-200">
          <label className="flex items-center space-x-2 mb-3">
            <Droplet className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold text-gray-800">
              終了燃料レベル (L) - オプション
            </span>
          </label>
          <input
            type="number"
            step="0.1"
            value={endFuelLevel || ''}
            onChange={(e) => setEndFuelLevel(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="例: 45.2"
            className="w-full px-4 py-3 text-lg font-semibold border-2 border-blue-300 rounded-lg
              focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200
              transition-all duration-200"
          />
          <p className="text-xs text-gray-600 mt-2">
            ※ 燃料消費量を自動計算したい場合は入力してください
          </p>
        </div>

        {/* 備考欄 */}
        <div className="bg-white rounded-xl shadow-md p-5 mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            備考・特記事項
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="運行中の気づきや特記事項があれば記入してください"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg 
              focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200
              resize-none transition-all duration-200"
          />
        </div>

        {/* 運行終了ボタン */}
        <div className="space-y-3">
          <button
            onClick={handleComplete}
            disabled={isLoading || !allChecked || !endOdometer}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 
              hover:from-green-600 hover:to-green-700 
              disabled:from-gray-400 disabled:to-gray-500
              text-white font-bold py-4 px-6 rounded-xl shadow-lg
              transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
              disabled:cursor-not-allowed disabled:transform-none
              flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>処理中...</span>
              </>
            ) : (
              <span>🏁 運行終了</span>
            )}
          </button>

          <button
            onClick={handleBack}
            disabled={isLoading}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg 
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>運行中画面に戻る</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostTripInspection;