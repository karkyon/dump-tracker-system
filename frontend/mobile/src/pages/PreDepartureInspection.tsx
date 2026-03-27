// frontend/mobile/src/pages/PreDepartureInspection.tsx
// D3: 乗車前点検画面 - エラーハンドリング強化版（ハードコードフォールバック完全削除）
// ✅ 全機能保持版（557行）- 文字化けのみ修正

import React, { useState, useEffect } from 'react';
import { useTLog } from '../hooks/useTLog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ClipboardCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2,
  Circle,
  Loader2,
  Truck,
  XCircle,
  RefreshCcw
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
  checked: boolean; // UI用
}

const PreDepartureInspection: React.FC = () => {
  useTLog('PRE_DEPARTURE_INSP', '出発前点検');

  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { 
    vehicleId, 
    vehicleNumber, 
    vehicleType,
    driverId,
    setInspectionCompleted,
    startOperation 
  } = useOperationStore();
  
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCriticalError, setIsCriticalError] = useState(false);

  // 画面初期化
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (!vehicleId) {
      toast.error('車両情報を選択してください');
      navigate('/vehicle-info', { replace: true });
      return;
    }

    // 点検項目取得
    fetchInspectionItems();
  }, [isAuthenticated, vehicleId, navigate]);

  /**
   * 点検項目取得（バックエンドAPIから）
   * ハードコードされたフォールバックは完全削除
   */
  const fetchInspectionItems = async () => {
    setIsFetching(true);
    setError(null);
    setIsCriticalError(false);

    try {
      console.log('[D3] 📋 点検項目取得開始');
      
      const response = await apiService.getInspectionItems({
        inspectionType: 'PRE_TRIP',
        isActive: true
      });

      console.log('[D3] 📡 API レスポンス:', response);

      if (response.success && response.data) {
        // APIレスポンスから点検項目を取得
        const items = Array.isArray(response.data) 
          ? response.data 
          : response.data.data || [];

        if (items.length === 0) {
          // データが0件の場合
          setIsCriticalError(true);
          setError('点検項目マスタが登録されていません。システム管理者に連絡してください。');
          console.error('[D3] ❌ 点検項目が0件です');
          return;
        }

        // UI用のcheckedフィールドを追加
        const itemsWithChecked = items.map((item: any) => ({
          ...item,
          checked: false
        }));

        // displayOrderでソート
        itemsWithChecked.sort((a: any, b: any) => a.displayOrder - b.displayOrder);

        setInspectionItems(itemsWithChecked);
        console.log('[D3] ✅ 点検項目取得成功:', itemsWithChecked.length, '件');
      } else {
        throw new Error(response.message || '点検項目の取得に失敗しました');
      }

    } catch (error: any) {
      console.error('[D3] ❌ 点検項目取得エラー:', error);
      
      // エラーメッセージの詳細化
      let errorMessage = '点検項目の読み込みに失敗しました';
      let isCritical = true;

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'サーバーへの接続がタイムアウトしました。ネットワーク接続を確認してください。';
      } else if (error.response?.status === 500) {
        errorMessage = 'サーバー内部エラーが発生しました。システム管理者に連絡してください。';
      } else if (error.response?.status === 404) {
        errorMessage = '点検項目APIが見つかりません。システム管理者に連絡してください。';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setIsCriticalError(isCritical);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setIsFetching(false);
    }
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
   * 運行開始処理
   * 
   * 🔧 完全修正 (2025年12月9日):
   * - バックエンドレスポンスのフィールド名を実際のログから確認して修正
   * - operationResponse.data.id のみ使用（tripId, operationId は存在しない）
   * - デバッグログ追加
   */
  const handleStartOperation = async () => {
    const allChecked = inspectionItems.every(item => item.checked);
    
    if (!allChecked) {
      toast.error('すべての点検項目を確認してください');
      return;
    }

    if (!vehicleId || !driverId) {
      toast.error('車両情報またはドライバー情報が不足しています');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('[D3] 点検記録作成開始');

      // 1. 点検記録作成
      const inspectionResults = inspectionItems.map(item => ({
        inspectionItemId: item.id,
        resultValue: item.checked ? 'OK' : 'NG',
        isPassed: item.checked,
        notes: ''
      }));

      const inspectionResponse = await apiService.createInspectionRecord({
        vehicleId,
        inspectorId: driverId,
        inspectionType: 'PRE_TRIP',
        results: inspectionResults,
        notes: '乗車前点検完了'
      });

      if (!inspectionResponse.success) {
        throw new Error('点検記録の作成に失敗しました');
      }

      const inspectionRecordId = inspectionResponse.data?.id || '';
      console.log('[D3] 点検記録作成成功:', inspectionRecordId);

      // 2. 運行開始
      console.log('[D3] 運行開始API呼び出し');
      const operationResponse = await apiService.startOperation({
        vehicleId,
        driverId,
        startLatitude: 35.6812,
        startLongitude: 139.7671,
        startLocation: '車庫',
        cargoInfo: ''
      });

      if (!operationResponse.success || !operationResponse.data) {
        throw new Error('運行開始に失敗しました');
      }

      // 🔧 完全修正: 型アサーションでtripIdを取得（OperationInfo型にtripIdがないため）
      const operationId = (operationResponse.data as any).tripId 
                       || (operationResponse.data as any).operationId 
                       || operationResponse.data.id;
      
      console.log('[D3] 🔍 APIレスポンス確認:', {
        fullResponse: operationResponse.data,
        extractedOperationId: operationId
      });
      
      console.log('[D3] 運行開始成功:', operationId);
      
      // 🔧 追加: operationIdがundefinedの場合の警告
      if (!operationId) {
        console.error('[D3] ❌ operationIdが取得できませんでした:', operationResponse.data);
        throw new Error('運行IDの取得に失敗しました。APIレスポンスを確認してください。');
      }

      // 3. Store更新
      setInspectionCompleted(inspectionRecordId);
      startOperation(operationId);

      toast.success('運行を開始しました');
      
      // 4. 運行中画面へ遷移
      setTimeout(() => {
        navigate('/operation-record');
      }, 500);
      
    } catch (error: any) {
      console.error('[D3] 運行開始エラー:', error);
      const errorMessage = error.response?.data?.message || error.message || '運行開始に失敗しました';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/vehicle-info');
  };

  /**
   * リトライボタン
   */
  const handleRetry = () => {
    fetchInspectionItems();
  };

  const checkedCount = inspectionItems.filter(item => item.checked).length;
  const allChecked = inspectionItems.every(item => item.checked);
  const progressPercentage = inspectionItems.length > 0 
    ? (checkedCount / inspectionItems.length) * 100 
    : 0;

  // ローディング中
  if (isFetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">点検項目を読み込み中...</p>
          <p className="text-sm text-gray-400 mt-2">しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  // 致命的エラー（点検項目が取得できない）
  if (isCriticalError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                システムエラー
              </h2>
              <p className="text-gray-600 mb-4">
                {error}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-xl
                  shadow-lg hover:bg-blue-700 transition-all duration-200
                  flex items-center justify-center space-x-2"
              >
                <RefreshCcw className="w-5 h-5" />
                <span>再試行</span>
              </button>

              <button
                onClick={handleBack}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl
                  hover:bg-gray-200 transition-all duration-200"
              >
                車両選択に戻る
              </button>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                📞 サポートが必要な場合
              </p>
              <p className="text-xs text-yellow-700">
                システム管理者またはサポート窓口に以下の情報を伝えてください：
              </p>
              <ul className="text-xs text-yellow-700 mt-2 space-y-1 text-left">
                <li>• エラー: 点検項目取得失敗</li>
                <li>• 画面: D3 乗車前点検</li>
                <li>• 車両ID: {vehicleId}</li>
                <li>• 時刻: {new Date().toLocaleString('ja-JP')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">乗車前点検</h1>
            </div>
            <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-semibold">
              {checkedCount}/{inspectionItems.length}
            </div>
          </div>

          {/* 車両情報表示エリア */}
          {vehicleNumber && vehicleType && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <Truck className="w-5 h-5 text-white/80" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white/70">車番:</span>
                    <span className="font-bold text-lg">{vehicleNumber}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-xs text-white/70">車種:</span>
                    <span className="text-sm font-medium">{vehicleType}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        {/* 進捗バー */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">点検進捗</span>
            <span className="text-sm font-bold text-blue-600">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out shadow-lg"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* 全てチェックボタン */}
        <button
          onClick={handleCheckAll}
          className="w-full mb-6 px-6 py-3.5 bg-gradient-to-r from-green-500 to-green-600 
            text-white font-bold rounded-xl shadow-lg hover:shadow-xl 
            transform hover:scale-[1.02] active:scale-[0.98] 
            transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>{allChecked ? 'すべてクリア' : 'すべてチェック'}</span>
        </button>

        {/* 点検項目リスト */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3">
            <h2 className="text-white font-bold text-lg">点検項目</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {inspectionItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => toggleInspectionItem(item.id)}
                className="w-full px-6 py-4 flex items-center justify-between 
                  hover:bg-blue-50 active:bg-blue-100 transition-all duration-200
                  group"
                style={{
                  animationDelay: `${index * 50}ms`
                }}
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
                      <CheckCircle2 className="w-5 h-5 text-white animate-scale-in" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 group-hover:text-blue-400" />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <span className={`
                      font-medium transition-all duration-200
                      ${item.checked 
                        ? 'text-gray-500 line-through' 
                        : 'text-gray-800 group-hover:text-blue-600'
                      }
                    `}>
                      {item.name}
                    </span>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ボタン群 */}
        <div className="flex space-x-4">
          <button
            onClick={handleBack}
            disabled={isLoading}
            className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl
              shadow-md hover:shadow-lg hover:bg-gray-200 
              transform hover:scale-[1.02] active:scale-[0.98]
              transition-all duration-200 flex items-center justify-center space-x-2
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>

          <button
            onClick={handleStartOperation}
            disabled={!allChecked || isLoading}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 
              text-white font-bold rounded-xl shadow-lg hover:shadow-xl 
              transform hover:scale-[1.02] active:scale-[0.98]
              transition-all duration-200 flex items-center justify-center space-x-2
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>処理中...</span>
              </>
            ) : (
              <>
                <span>運行開始</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* 注意事項 */}
        {!allChecked && (
          <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠️ すべての点検項目を確認してから運行を開始してください
            </p>
          </div>
        )}
      </main>

      {/* アニメーション用CSS */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PreDepartureInspection;