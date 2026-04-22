// frontend/mobile/src/pages/LoadingConfirmation.tsx
// D5a: 積荷確認画面
// ✅ D5で入力した積込場所、客先名、品目を表示
// ✅ 積み荷確認のチェックボックス
// ✅ 「運行開始」ボタンで運行中メイン画面(D4)に戻る
// ✅ API呼び出し: recordLoadingArrival
// ✅ 「戻る」ボタンで積込場所入力画面(D5)に戻る
// 🔧 修正: 運行開始時にフェーズをTO_UNLOADINGに更新（2025-12-12）

import React, { useState, useEffect } from 'react';
import { useTLog } from '../hooks/useTLog';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  MapPin, 
  Package, 
  CheckCircle, 
  ChevronLeft, 
  PlayCircle 
} from 'lucide-react';
import apiService from '../services/api';
import { useOperationStore } from '../stores/operationStore';

/**
 * D5から渡される積込情報の型
 * 🆕 複数選択対応: selectedItemIds, selectedItemNames 追加
 * ✅ 既存互換性: itemId, itemName は単一選択時の後方互換用に保持
 */
interface LoadingInputData {
  locationId: string;
  locationName: string;
  clientName: string;
  selectedItemIds?: string[]; // 🆕 複数選択品目ID配列(optional: 既存データ互換性)
  selectedItemNames?: string[]; // 🆕 複数選択品目名配列(optional: 既存データ互換性)
  itemId: string; // ✅ 既存互換性保持(単一選択時)
  itemName: string; // ✅ 既存互換性保持(単一選択時)
  customItemName: string;
  cargoConfirmed: boolean;
  quantity?: number;
  notes?: string;
}

const LoadingConfirmation: React.FC = () => {
  useTLog('LOADING_CONFIRMATION', '積載確認');

  const navigate = useNavigate();
  const location = useLocation();
  const operationStore = useOperationStore();
  
  // D5から渡された積込情報
  const loadingData = location.state as LoadingInputData | undefined;

  // 状態管理
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // BUG-017: useRefで送信中フラグを管理
  const isSubmittingRef = React.useRef(false);

  // D5から情報が渡されていない場合はエラー
  useEffect(() => {
    if (!loadingData) {
      toast.error('積込情報が見つかりません', {
        duration: 3000
      });
      navigate('/loading-input', { replace: true });
    }
  }, [loadingData, navigate]);

  /**
   * 最終確認チェックボックスハンドラー
   */
  const handleFinalConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFinalConfirmed(e.target.checked);
  };

  /**
   * 「運行開始」ボタンハンドラー
   * - API呼び出し: recordLoadingArrival
   * - 🔧 修正: フェーズをTO_UNLOADINGに更新
   * - 成功後、D4(運行中画面)に戻る
   */
  const handleStartOperation = async () => {
    if (!loadingData) {
      toast.error('積込情報が見つかりません');
      return;
    }

    if (!finalConfirmed) {
      toast.error('積み荷確認にチェックを入れてください');
      return;
    }

    // 運行IDの確認
    const currentOperationId = operationStore.operationId;
    if (!currentOperationId) {
      toast.error('運行IDが見つかりません。運行を開始してください。', {
        duration: 5000
      });
      console.error('❌ 運行ID未設定:', {
        operationStoreId: operationStore.operationId
      });
      navigate('/operation-record', { replace: true });
      return;
    }

    // GPS位置情報の取得
    if (!navigator.geolocation) {
      toast.error('GPS機能が利用できません');
      return;
    }

    try {
      // BUG-017: useRefによる確実な二重送信防止
    if (isSubmittingRef.current) {
      console.warn('[LoadingConfirmation] ⚠️ BUG-017: 送信中のため多重タップを無視');
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);

      // GPS位置を取得
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      console.log('🚛 積込場所到着記録API呼び出し開始');
      console.log('📍 運行ID:', currentOperationId);
      console.log('📍 地点ID:', loadingData.locationId);
      console.log('📍 品目:', loadingData.itemName || loadingData.customItemName);
      console.log('📍 複数品目:', loadingData.selectedItemNames);

      // 品目IDの決定
      const itemId = loadingData.itemId || undefined;
      
      // 🆕 複数品目対応: notesに全品目を記載
      let notesContent = loadingData.notes || '';
      if (loadingData.selectedItemNames && loadingData.selectedItemNames.length > 0) {
        notesContent = `品目: ${loadingData.selectedItemNames.join(', ')}${notesContent ? '\n' + notesContent : ''}`;
      } else {
        notesContent = `品目: ${loadingData.itemName || loadingData.customItemName}${notesContent ? '\n' + notesContent : ''}`;
      }

      // ✅ API呼び出し: recordLoadingArrival
      const response = await apiService.recordLoadingArrival(currentOperationId, {
        locationId: loadingData.locationId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        arrivalTime: new Date(),
        itemId: itemId,
        quantity: loadingData.quantity,
        notes: notesContent
      });

      console.log('✅ 積込場所到着記録完了');
      console.log('📦 API応答:', response);

      // 🔧 修正: operationStoreのフェーズを TO_UNLOADING に更新
      console.log('🔄 フェーズ更新: AT_LOADING → TO_UNLOADING');
      operationStore.setPhase('TO_UNLOADING');
      
      // 🔧 修正: 積込場所情報も更新
      operationStore.setLoadingLocation(loadingData.locationName);

      // 運行ステータス更新を待つ(少し待機)
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success(`積込を完了しました。積降場所へ移動してください。`, {
        duration: 3000,
        icon: '🚛'
      });

      // D4(運行中画面)に戻る
      navigate('/operation-record', { replace: true });

    } catch (error: any) {
      console.error('❌ 積込場所到着記録エラー:', error);
      
      if (error.name === 'GeolocationPositionError') {
        toast.error('GPS位置情報の取得に失敗しました。位置情報を有効にしてください。', {
          duration: 5000
        });
      } else {
        toast.error(error.message || '積込記録の登録に失敗しました', {
          duration: 5000
        });
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  /**
   * 「戻る」ボタンハンドラー(D5積込場所入力画面に戻る)
   */
  const handleBack = () => {
    navigate('/loading-input', {
      state: loadingData
    });
  };

  // loadingDataがない場合は何も表示しない
  if (!loadingData) {
    return null;
  }

  // 表示用の品目名(複数選択対応 + 既存互換性保持)
  const displayItemName = loadingData.customItemName || loadingData.itemName;
  const hasMultipleItems = loadingData.selectedItemNames && loadingData.selectedItemNames.length > 0;
  const displayItemNames: string[] = hasMultipleItems 
    ? loadingData.selectedItemNames! // ✅ non-null assertion(hasMultipleItemsでチェック済み)
    : (displayItemName ? [displayItemName] : []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      {/* ヘッダー */}
      <header style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: 'white',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CheckCircle className="w-7 h-7" />
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              積荷確認
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              入力内容を確認してください
            </p>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          {/* 確認情報カード */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#333',
              paddingBottom: '12px',
              borderBottom: '2px solid #e5e7eb'
            }}>
              入力内容の確認
            </h2>

            {/* 積込場所情報 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <MapPin className="w-5 h-5" style={{ color: '#667eea' }} />
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#333'
                }}>
                  積込場所
                </h3>
              </div>

              <div style={{
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div>
                  <span style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    客先名
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>
                    {loadingData.clientName || loadingData.locationName}
                  </span>
                </div>

                <div>
                  <span style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    場所
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>
                    {loadingData.locationName}
                  </span>
                </div>
              </div>
            </div>

            {/* 品目情報 */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <Package className="w-5 h-5" style={{ color: '#667eea' }} />
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#333'
                }}>
                  品目
                  {hasMultipleItems && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '13px',
                      color: '#667eea',
                      fontWeight: '500'
                    }}>
                      ({displayItemNames.length}種類)
                    </span>
                  )}
                </h3>
              </div>

              <div style={{
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '8px'
              }}>
                {/* 🆕 複数品目対応: タグ表示 */}
                {hasMultipleItems ? (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    {displayItemNames.map((name, index) => (
                      <span
                        key={index}
                        style={{
                          display: 'inline-block',
                          padding: '8px 12px',
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#667eea',
                          background: 'white',
                          border: '2px solid #667eea',
                          borderRadius: '8px'
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  /* ✅ 既存UI保持: 単一品目表示 */
                  <>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#1f2937'
                    }}>
                      {displayItemName}
                    </span>
                    {loadingData.customItemName && (
                      <span style={{
                        display: 'inline-block',
                        marginLeft: '8px',
                        padding: '2px 8px',
                        fontSize: '12px',
                        background: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}>
                        手入力
                      </span>
                    )}
                  </>
                )}

                {loadingData.quantity !== undefined && loadingData.quantity > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      display: 'block',
                      marginBottom: '4px'
                    }}>
                      数量
                    </span>
                    <span style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      {loadingData.quantity} トン
                    </span>
                  </div>
                )}

                {loadingData.notes && (
                  <div style={{ marginTop: '12px' }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      display: 'block',
                      marginBottom: '4px'
                    }}>
                      備考
                    </span>
                    <span style={{
                      fontSize: '14px',
                      color: '#1f2937'
                    }}>
                      {loadingData.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* 最終確認チェックボックス */}
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
              border: '2px solid #10b981',
              borderRadius: '12px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={finalConfirmed}
                  onChange={handleFinalConfirmChange}
                  style={{
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    accentColor: '#10b981'
                  }}
                />
                <div>
                  <span style={{
                    fontSize: '17px',
                    fontWeight: '700',
                    color: '#065f46',
                    display: 'block'
                  }}>
                    上記の内容で間違いありません
                  </span>
                  <span style={{
                    fontSize: '13px',
                    color: '#047857',
                    display: 'block',
                    marginTop: '4px'
                  }}>
                    積み荷の確認が完了しました
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 注意事項 */}
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px'
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#92400e',
              lineHeight: '1.5'
            }}>
              <strong>⚠️ 注意:</strong> 「運行開始」ボタンを押すと、GPS位置と共に積込記録が登録され、積降場所への移動フェーズに移行します。
            </p>

            {/* 🆕 URLリンク追加 */}
            <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#666' }}>
              注意: 産業廃棄物マニフェストを登録する場合は、
              <a 
                href="https://idp.e-reverse.com/webid/auth/Account/Login"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#2196F3',
                  textDecoration: 'underline',
                  marginLeft: '4px'
                }}
              >
                こちら
              </a>
              からログインしてください。
            </p>
          </div>
        </div>
      </main>

      {/* フッター(ボタン) */}
      <footer style={{
        background: 'white',
        padding: '16px 20px',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px'
        }}>
          {/* 戻るボタン */}
          <button
            onClick={handleBack}
            disabled={isSubmitting}
            style={{
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#374151',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: isSubmitting ? 0.5 : 1
            }}
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          {/* 運行開始ボタン */}
          <button
            onClick={handleStartOperation}
            disabled={!finalConfirmed || isSubmitting}
            style={{
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              background: finalConfirmed && !isSubmitting
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : '#d1d5db',
              border: 'none',
              borderRadius: '8px',
              cursor: finalConfirmed && !isSubmitting
                ? 'pointer'
                : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting ? (
              <>処理中...</>
            ) : (
              <>
                <PlayCircle className="w-5 h-5" />
                運行開始
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LoadingConfirmation;

/**
 * 🔧 修正内容 (2025-12-12)
 * 
 * 1. handleStartOperation 内で recordLoadingArrival API 呼び出し成功後:
 *    - operationStore.setPhase('TO_UNLOADING') を追加
 *    - operationStore.setLoadingLocation(loadingData.locationName) を追加
 * 
 * 2. トーストメッセージを変更:
 *    - 「積込を開始しました」→「積込を完了しました。積降場所へ移動してください。」
 * 
 * 3. 注意事項メッセージを更新:
 *    - フェーズ移行についての説明を追加
 * 
 * これにより、D5a で「運行開始」ボタンをクリックすると:
 * - フェーズが TO_UNLOADING に更新される
 * - D4 運行中画面に戻った時、正しく「積降場所へ移動中」と表示される
 * - ボタンが「積降場所到着」に変わる
 */