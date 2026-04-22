// frontend/mobile/src/pages/LoadingInput.tsx
// D5 (統合版): 積込場所入力 + 積込確認 (D5a廃止・1画面統合)
// ✅ D5積込場所入力 + D5a積込確認を1画面に統合
// ✅ 「運行開始」ボタンで直接 recordLoadingArrival API を呼び出し D4へ戻る
// ✅ D5a (LoadingConfirmation) は廃止 → /loading-confirmation は /loading-input へリダイレクト
// ✅ 複数品目選択対応
// ✅ e-reverse リンク: https://webpage.e-reverse.com
// 🔧 修正: D5a統合 (2025-03-08)

import React, { useState, useEffect } from 'react';
import { useTLog } from '../hooks/useTLog';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Truck,
  ChevronLeft,
  PlayCircle,
  AlertTriangle,
  CheckSquare
} from 'lucide-react';
import apiService from '../services/api';
import { useOperationStore } from '../stores/operationStore';

// ============================================================
// 型定義
// ============================================================

/** D4(OperationRecord)から渡される初期位置情報 */
interface LocationState {
  locationId: string;
  locationName: string;
  clientName: string;
  address?: string;
}

/** APIから取得する品目マスタ */
interface Item {
  id: string;
  name: string;
  displayOrder?: number;
}

/** フォームデータ型 */
interface FormData {
  locationId: string;
  locationName: string;
  clientName: string;
  selectedItemIds: string[];
  selectedItemNames: string[];
  itemId: string;
  itemName: string;
  customItemName: string;
  cargoConfirmed: boolean;
  quantity?: number;
  notes?: string;
}

// ============================================================
// コンポーネント
// ============================================================

const LoadingInput: React.FC = () => {
  useTLog('LOADING_INPUT', '積載入力');

  const navigate = useNavigate();
  const location = useLocation();
  const operationStore = useOperationStore();

  // D4から渡された位置情報（またはD5a廃止後のstate引き継ぎ）
  const locationState = location.state as LocationState | undefined;

  // ---- 品目マスタ ----
  const [items, setItems] = useState<Item[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // ---- フォームデータ ----
  const [formData, setFormData] = useState<FormData>({
    locationId: locationState?.locationId || '',
    locationName: locationState?.locationName || '',
    clientName: locationState?.clientName || '担当者未登録',
    selectedItemIds: [],
    selectedItemNames: [],
    itemId: '',
    itemName: '',
    customItemName: '',
    cargoConfirmed: false,
    quantity: undefined,
    notes: undefined,
  });

  // ---- 最終確認チェックボックス（D5a統合: "上記の内容で間違いありません"） ----
  const [finalConfirmed, setFinalConfirmed] = useState(false);

  // ---- 送信中フラグ ----
  const [isSubmitting, setIsSubmitting] = useState(false);
  // BUG-017: useRefで送信中フラグを管理（React state更新の非同期性による多重タップ防止）
  const isSubmittingRef = React.useRef(false);

  // ------------------------------------------------------------
  // 品目マスタ取得
  // ------------------------------------------------------------
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setIsLoadingItems(true);
        const response = await apiService.getItems();
        if (response.success && response.data) {
          setItems(response.data);
        }
      } catch (error) {
        console.error('品目取得エラー:', error);
        toast.error('品目の取得に失敗しました');
      } finally {
        setIsLoadingItems(false);
      }
    };
    fetchItems();
  }, []);

  // ------------------------------------------------------------
  // 位置情報がない場合は D4 に戻す
  // ------------------------------------------------------------
  useEffect(() => {
    if (!locationState?.locationId) {
      console.warn('⚠️ 積込場所情報がありません。D4に戻ります。');
      navigate('/operation-record', { replace: true });
    }
  }, [locationState, navigate]);

  // ============================================================
  // ハンドラー群
  // ============================================================

  /** 品目選択トグル（複数選択対応） */
  const handleItemToggle = (itemId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedItemIds.includes(itemId);
      const newSelection = isSelected
        ? prev.selectedItemIds.filter(id => id !== itemId)
        : [...prev.selectedItemIds, itemId];

      const selectedItems = items.filter(item => newSelection.includes(item.id));
      const firstItemId = newSelection.length > 0 && newSelection[0] ? newSelection[0] : '';
      const firstItemName = selectedItems.length > 0 && selectedItems[0] ? selectedItems[0].name : '';

      return {
        ...prev,
        selectedItemIds: newSelection,
        selectedItemNames: selectedItems.map(item => item.name),
        itemId: firstItemId,
        itemName: firstItemName,
      };
    });
  };

  /** 「その他」手入力ハンドラー */
  const handleCustomItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, customItemName: e.target.value }));
  };

  /** 数量入力ハンドラー */
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      quantity: value ? parseFloat(value) : undefined,
    }));
  };

  /** 備考入力ハンドラー */
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, notes: e.target.value }));
  };

  /** 戻るボタン → D4 運行中画面へ */
  const handleBack = () => {
    navigate('/operation-record');
  };

  // ============================================================
  // 「運行開始」ボタンハンドラー
  // ※ 旧D5の「進む」+ 旧D5aの「運行開始」を統合
  // ============================================================
  const handleStartOperation = async () => {
    // ---- バリデーション ----
    if (
      formData.selectedItemIds.length === 0 &&
      !formData.itemId &&
      !formData.customItemName
    ) {
      toast.error('品目を選択するか、「その他」に入力してください');
      return;
    }

    if (!finalConfirmed) {
      toast.error('「上記の内容で間違いありません」にチェックを入れてください');
      return;
    }

    // ---- 運行ID確認 ----
    const currentOperationId = operationStore.operationId;
    if (!currentOperationId) {
      toast.error('運行IDが見つかりません。運行を開始してください。', { duration: 5000 });
      console.error('❌ 運行ID未設定:', { operationStoreId: operationStore.operationId });
      navigate('/operation-record', { replace: true });
      return;
    }

    // ---- GPS確認 ----
    if (!navigator.geolocation) {
      toast.error('GPS機能が利用できません');
      return;
    }

    try {
      // BUG-017: useRefによる確実な二重送信防止
    if (isSubmittingRef.current) {
      console.warn('[LoadingInput] ⚠️ BUG-017: 送信中のため多重タップを無視');
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);

      // GPS位置取得
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      console.log('🚛 積込場所到着記録API呼び出し開始');
      console.log('📍 運行ID:', currentOperationId);
      console.log('📍 地点ID:', formData.locationId);
      console.log('📍 品目:', formData.itemName || formData.customItemName);
      console.log('📍 複数品目:', formData.selectedItemNames);

      // 品目IDの決定
      const itemId = formData.itemId || undefined;

      // 複数品目対応: notes に全品目を記載
      let notesContent = formData.notes || '';
      if (formData.selectedItemNames && formData.selectedItemNames.length > 0) {
        notesContent = `品目: ${formData.selectedItemNames.join(', ')}${notesContent ? '\n' + notesContent : ''}`;
      } else if (formData.itemName || formData.customItemName) {
        notesContent = `品目: ${formData.itemName || formData.customItemName}${notesContent ? '\n' + notesContent : ''}`;
      }

      // API呼び出し: recordLoadingArrival
      const response = await apiService.recordLoadingArrival(currentOperationId, {
        locationId: formData.locationId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        arrivalTime: new Date(),
        itemId: itemId,
        quantity: formData.quantity,
        notes: notesContent,
      });

      console.log('✅ 積込場所到着記録完了');
      console.log('📦 API応答:', response);

      // フェーズ更新: AT_LOADING → TO_UNLOADING
      console.log('🔄 フェーズ更新: AT_LOADING → TO_UNLOADING');
      operationStore.setPhase('TO_UNLOADING');
      operationStore.setLoadingLocation(formData.locationName);

      // 少し待機して状態更新を確実にする
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success('積込を完了しました。積降場所へ移動してください。', {
        duration: 3000,
        icon: '🚛',
      });

      // D4 運行中画面へ戻る
      navigate('/operation-record', { replace: true });

    } catch (error: any) {
      console.error('❌ 積込場所到着記録エラー:', error);
      if (error.name === 'GeolocationPositionError') {
        toast.error('GPS位置情報の取得に失敗しました。位置情報を有効にしてください。', {
          duration: 5000,
        });
      } else {
        toast.error(error.message || '積込記録の登録に失敗しました', { duration: 5000 });
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // 表示用の計算値
  // ============================================================
  const hasItemSelected =
    formData.selectedItemIds.length > 0 ||
    !!formData.itemId ||
    !!formData.customItemName;

  const isStartButtonEnabled = hasItemSelected && finalConfirmed && !isSubmitting;

  const displayItemLabels =
    formData.selectedItemNames.length > 0
      ? formData.selectedItemNames.join('、')
      : formData.itemName || formData.customItemName || '';

  // ============================================================
  // レンダリング
  // ============================================================
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: '#f5f5f5',
      }}
    >
      {/* ===== ヘッダー ===== */}
      <header
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Truck style={{ width: '28px', height: '28px' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              積込場所入力
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              品目と積み込み量を確認してください
            </p>
          </div>
        </div>
      </header>

      {/* ===== メインコンテンツ ===== */}
      <main style={{ flex: 1, padding: '16px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>

        {/* ----- 積込場所セクション ----- */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '18px' }}>📍</span>
            積込場所
          </h2>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              客先名
            </label>
            <div
              style={{
                padding: '10px 12px',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '15px',
                color: '#374151',
              }}
            >
              {formData.clientName || '担当者未登録'}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              場所
            </label>
            <div
              style={{
                padding: '10px 12px',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '15px',
                color: '#374151',
              }}
            >
              {formData.locationName || '場所未設定'}
            </div>
          </div>
        </div>

        {/* ----- 品目選択セクション ----- */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <h2
            style={{
              margin: '0 0 4px 0',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '18px' }}>📦</span>
            品目選択
          </h2>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6b7280' }}>
            品目を選択＊（複数選択可能）
          </p>

          {isLoadingItems ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
              品目を読み込み中...
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              {items.map(item => {
                const isSelected = formData.selectedItemIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemToggle(item.id)}
                    style={{
                      padding: '10px 6px',
                      fontSize: '14px',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      color: isSelected ? 'white' : '#374151',
                      background: isSelected
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'white',
                      border: `2px solid ${isSelected ? '#667eea' : '#d1d5db'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {isSelected ? `✓ ${item.name}` : item.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* 選択中表示 */}
          {displayItemLabels && (
            <p
              style={{
                margin: '8px 0 12px 0',
                fontSize: '13px',
                color: '#667eea',
                fontWeight: '500',
              }}
            >
              選択中: {displayItemLabels}
            </p>
          )}

          {/* その他（手入力） */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              その他（手入力）
            </label>
            <input
              type="text"
              value={formData.customItemName}
              onChange={handleCustomItemChange}
              placeholder="上記にない品目を入力"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '15px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>
              ※ 上記のリストにない品目を入力できます
            </p>
          </div>

          {/* 数量 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              数量（トン）
            </label>
            <input
              type="number"
              value={formData.quantity !== undefined ? formData.quantity : ''}
              onChange={handleQuantityChange}
              placeholder="例: 10.5"
              step="0.1"
              min="0"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '15px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 備考 */}
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              備考
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={handleNotesChange}
              placeholder="特記事項があれば入力"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '15px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* ----- 最終確認チェックボックス（D5a統合）----- */}
        <div
          style={{
            background: finalConfirmed ? '#d1fae5' : '#f9fafb',
            border: `2px solid ${finalConfirmed ? '#10b981' : '#d1d5db'}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            transition: 'all 0.2s ease',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={finalConfirmed}
              onChange={e => setFinalConfirmed(e.target.checked)}
              style={{
                width: '22px',
                height: '22px',
                marginTop: '2px',
                cursor: 'pointer',
                flexShrink: 0,
                accentColor: '#10b981',
              }}
            />
            <div>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: finalConfirmed ? '#065f46' : '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {finalConfirmed && (
                  <CheckSquare style={{ width: '18px', height: '18px', color: '#10b981' }} />
                )}
                上記の内容で間違いありません
              </span>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: finalConfirmed ? '#047857' : '#6b7280',
                }}
              >
                積み込みの確認が完了しました
              </p>
            </div>
          </label>
        </div>

        {/* ----- 警告・注意事項（D5a統合・文字拡大）----- */}
        <div
          style={{
            background: '#fffbeb',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '18px 16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
            <AlertTriangle
              style={{
                width: '24px',
                height: '24px',
                color: '#d97706',
                flexShrink: 0,
                marginTop: '2px',
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: '700',
                color: '#92400e',
                lineHeight: '1.6',
              }}
            >
               注意: 「運行開始」ボタンを押すと、GPS位置と共に積込記録が登録され、積降場所への移動フェーズに移行します。
            </p>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#78350f',
              lineHeight: '1.7',
              fontWeight: '600',
              paddingLeft: '34px',
            }}
          >
            注意: 産業廃棄物マニフェストを登録する場合は、
            <a
              href="https://webpage.e-reverse.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#1d4ed8',
                textDecoration: 'underline',
                fontWeight: '700',
                fontSize: '15px',
              }}
            >
              こちら
            </a>
            からログインしてください。
          </p>
        </div>

      </main>

      {/* ===== フッター（ボタン）===== */}
      <footer
        style={{
          background: 'white',
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
          position: 'sticky',
          bottom: 0,
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1.5fr',
            gap: '12px',
          }}
        >
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
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            <ChevronLeft style={{ width: '20px', height: '20px' }} />
            戻る
          </button>

          {/* 運行開始ボタン */}
          <button
            onClick={handleStartOperation}
            disabled={!isStartButtonEnabled}
            style={{
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              background: isStartButtonEnabled
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : '#d1d5db',
              border: 'none',
              borderRadius: '8px',
              cursor: isStartButtonEnabled ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isStartButtonEnabled ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {isSubmitting ? (
              <>処理中...</>
            ) : (
              <>
                <PlayCircle style={{ width: '20px', height: '20px' }} />
                運行開始
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LoadingInput;