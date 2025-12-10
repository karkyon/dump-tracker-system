// frontend/mobile/src/pages/LoadingInput.tsx
// D5: 積込場所入力画面
// ✅ 品目マスタから動的に品目を取得
// ✅ 「その他」選択時はテキスト入力可能
// ✅ 積み荷確認チェックボックス
// ✅ 「進む」ボタンでD5a（積荷確認画面）へ遷移
// ✅ 「戻る」ボタンでD4（運行中画面）へ戻る

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Truck, MapPin, Package, CheckSquare, ChevronRight, ChevronLeft } from 'lucide-react';
import { apiService } from '../services/api';

/**
 * D4から渡される地点情報の型
 */
interface LocationInfo {
  locationId: string;
  locationName: string;
  clientName?: string;
  address?: string;
}

/**
 * 品目マスタの型
 */
interface Item {
  id: string;
  name: string;
  itemType?: string;
  isActive: boolean;
}

/**
 * D5積込情報の型
 * 🆕 複数選択対応: selectedItemIds, selectedItemNames 追加
 * ✅ 既存互換性: itemId, itemName は単一選択時の後方互換用に保持
 */
interface LoadingInputData {
  locationId: string;
  locationName: string;
  clientName: string;
  selectedItemIds: string[]; // 🆕 複数選択品目ID配列
  selectedItemNames: string[]; // 🆕 複数選択品目名配列
  itemId: string; // ✅ 既存互換性保持（単一選択時）
  itemName: string; // ✅ 既存互換性保持（単一選択時）
  customItemName: string; // 「その他」手入力時
  cargoConfirmed: boolean;
  quantity?: number;
  notes?: string;
}

const LoadingInput: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // D4から渡された地点情報
  const locationInfo = location.state as LocationInfo | undefined;

  // 状態管理
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  // 🆕 複数選択用のstate追加
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<LoadingInputData>({
    locationId: locationInfo?.locationId || '',
    locationName: locationInfo?.locationName || '',
    clientName: locationInfo?.clientName || '',
    selectedItemIds: [], // 🆕 複数選択品目ID
    selectedItemNames: [], // 🆕 複数選択品目名
    itemId: '', // ✅ 既存互換性保持
    itemName: '', // ✅ 既存互換性保持
    customItemName: '',
    cargoConfirmed: false,
    quantity: undefined,
    notes: ''
  });

  // 品目マスタを取得
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoadingItems(true);

        // ✅ apiService.getInspectionItems()と同じパターンで実装
        // api.tsに getItems() メソッドは存在しないため、axiosインスタンスを直接使用
        // または汎用的な方法でfetchを使用
        
        console.log('[LoadingInput] 📋 品目マスタ取得開始');
        
        // 方法1: api.tsのaxiosInstanceパターンを踏襲
        const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1';
        const token = apiService.getToken();
        
        const response = await fetch(`${baseURL}/items?isActive=true&limit=100`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[LoadingInput] 📡 API レスポンス:', data);

        if (data.success && data.data) {
          // APIレスポンスから品目を取得
          const items = Array.isArray(data.data) 
            ? data.data 
            : data.data.items || data.data.data || [];

          if (items.length === 0) {
            console.warn('[LoadingInput] ⚠️ 品目マスタが0件です');
            toast('品目マスタが登録されていません', { icon: 'ℹ️' });
          }

          setItems(items);
          console.log('[LoadingInput] ✅ 品目マスタ取得成功:', items.length, '件');
        } else {
          throw new Error(data.message || '品目マスタの取得に失敗しました');
        }

      } catch (error: any) {
        console.error('[LoadingInput] ❌ 品目マスタ取得エラー:', error);
        
        let errorMessage = '品目マスタの読み込みに失敗しました';
        if (error.message?.includes('timeout')) {
          errorMessage = 'サーバーへの接続がタイムアウトしました';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast.error(errorMessage);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, []);

  // D4から地点情報が渡されていない場合はエラー
  useEffect(() => {
    if (!locationInfo) {
      toast.error('積込場所情報が見つかりません', {
        duration: 3000
      });
      navigate('/operation-record', { replace: true });
    }
  }, [locationInfo, navigate]);

  /**
   * ✅ 既存実装100%保持（コメントアウト）
   * 品目選択ハンドラー（既存ドロップダウン用）
   * 📝 トグルボタン実装により現在未使用
   * 🔄 ドロップダウンに戻す場合は下記のコメントを解除してください
   */
  /*
  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedItemId = e.target.value;
    
    if (!selectedItemId) {
      setFormData(prev => ({
        ...prev,
        itemId: '',
        itemName: '',
        customItemName: ''
      }));
      return;
    }

    const selectedItem = items.find(item => item.id === selectedItemId);
    
    setFormData(prev => ({
      ...prev,
      itemId: selectedItemId,
      itemName: selectedItem?.name || '',
      customItemName: '' // 品目選択時はカスタム入力をクリア
    }));
  };
  */

  /**
   * 🆕 トグルボタン品目選択ハンドラー（複数選択対応）
   */
  const handleToggleItemSelect = (itemId: string) => {
    setSelectedItemIds(prev => {
      const isSelected = prev.includes(itemId);
      const newSelection = isSelected
        ? prev.filter(id => id !== itemId) // 選択解除
        : [...prev, itemId]; // 選択追加
      
      // formDataも更新
      const selectedItems = items.filter(item => newSelection.includes(item.id));
      
      // ✅ 型安全: itemIdとitemNameを確実にstring型にする
      const firstItemId = newSelection.length > 0 && newSelection[0] ? newSelection[0] : '';
      const firstItemName = selectedItems.length > 0 && selectedItems[0] ? selectedItems[0].name : '';
      
      setFormData(prevForm => ({
        ...prevForm,
        selectedItemIds: newSelection,
        selectedItemNames: selectedItems.map(item => item.name),
        // ✅ 既存互換性: 最初の選択品目をitemId/itemNameにセット（型安全）
        itemId: firstItemId,
        itemName: firstItemName
      }));
      
      return newSelection;
    });
  };

  /**
   * 「その他」手入力ハンドラー
   */
  const handleCustomItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      customItemName: e.target.value
    }));
  };

  /**
   * 積み荷確認チェックボックスハンドラー
   */
  const handleCargoConfirmedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      cargoConfirmed: e.target.checked
    }));
  };

  /**
   * 数量入力ハンドラー
   */
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      quantity: value ? parseFloat(value) : undefined
    }));
  };

  /**
   * 備考入力ハンドラー
   */
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      notes: e.target.value
    }));
  };

  /**
   * 「進む」ボタンハンドラー（D5a積荷確認画面へ遷移）
   * ✅ 既存ロジック100%保持 + 複数選択対応
   */
  const handleNext = () => {
    // バリデーション（既存ロジック保持）
    if (!formData.itemId && !formData.customItemName && formData.selectedItemIds.length === 0) {
      toast.error('品目を選択するか、「その他」に入力してください');
      return;
    }

    if (!formData.cargoConfirmed) {
      toast.error('積み荷確認にチェックを入れてください');
      return;
    }

    console.log('✅ D5積込情報入力完了:', formData);

    // D5a（積荷確認画面）へ遷移
    navigate('/loading-confirmation', {
      state: formData
    });
  };

  /**
   * 「戻る」ボタンハンドラー（D4運行中画面へ戻る）
   */
  const handleBack = () => {
    navigate('/operation-record');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      {/* ヘッダー */}
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Truck className="w-7 h-7" />
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              積込場所入力
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              品目と積み荷を確認してください
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
          {/* 積込場所情報カード */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <MapPin className="w-5 h-5" style={{ color: '#667eea' }} />
              <h2 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                積込場所
              </h2>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  color: '#666',
                  marginBottom: '4px'
                }}>
                  客先名
                </label>
                <div style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  fontSize: '16px',
                  color: '#333',
                  fontWeight: '500'
                }}>
                  {formData.clientName || formData.locationName}
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  color: '#666',
                  marginBottom: '4px'
                }}>
                  場所
                </label>
                <div style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  fontSize: '16px',
                  color: '#333',
                  fontWeight: '500'
                }}>
                  {formData.locationName}
                </div>
              </div>
            </div>
          </div>

          {/* 品目選択カード */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <Package className="w-5 h-5" style={{ color: '#667eea' }} />
              <h2 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                品目選択
              </h2>
            </div>

            {loadingItems ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#666'
              }}>
                品目マスタを読み込み中...
              </div>
            ) : (
              <>
                {/* 🆕 トグルボタン品目選択（複数選択可能） */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    品目を選択 <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>
                      （複数選択可能）
                    </span>
                  </label>
                  
                  {/* トグルボタングリッド（3列） */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    {items.map(item => {
                      const isSelected = selectedItemIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleToggleItemSelect(item.id)}
                          style={{
                            padding: '12px',
                            fontSize: '15px',
                            fontWeight: '600',
                            color: isSelected ? 'white' : '#374151',
                            background: isSelected 
                              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                              : 'white',
                            border: isSelected ? '2px solid #667eea' : '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected 
                              ? '0 4px 6px rgba(102, 126, 234, 0.3)' 
                              : '0 1px 3px rgba(0,0,0,0.1)'
                          }}
                        >
                          {isSelected && '✓ '}
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* 選択中の品目表示 */}
                  {selectedItemIds.length > 0 && (
                    <div style={{
                      padding: '12px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#1e40af'
                    }}>
                      <strong>選択中:</strong> {formData.selectedItemNames.join(', ')}
                    </div>
                  )}
                </div>

                {/* ✅ 既存ドロップダウン（参考用にコメントアウト保持）
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    品目を選択 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.itemId}
                    onChange={handleItemSelect}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">-- 品目を選択してください --</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                */}

                {/* 「その他」手入力欄 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    その他（手入力）
                  </label>
                  <input
                    type="text"
                    value={formData.customItemName}
                    onChange={handleCustomItemChange}
                    placeholder="上記にない品目を入力"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: '#9ca3af'
                  }}>
                    ※ 上記のリストにない品目を入力できます
                  </p>
                </div>

                {/* 数量入力（オプション） */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    数量（トン）
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.quantity || ''}
                    onChange={handleQuantityChange}
                    placeholder="例: 10.5"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                </div>

                {/* 備考入力（オプション） */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px',
                    fontWeight: '500'
                  }}>
                    備考
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={handleNotesChange}
                    placeholder="特記事項があれば入力"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* 積み荷確認チェックボックス */}
                <div style={{
                  padding: '16px',
                  background: '#f0f9ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.cargoConfirmed}
                      onChange={handleCargoConfirmedChange}
                      style={{
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1e40af'
                    }}>
                      <CheckSquare 
                        className="w-5 h-5" 
                        style={{ 
                          display: 'inline-block', 
                          marginRight: '8px',
                          verticalAlign: 'middle'
                        }} 
                      />
                      積み荷確認済み
                    </span>
                  </label>
                  <p style={{
                    margin: '8px 0 0 36px',
                    fontSize: '13px',
                    color: '#3b82f6'
                  }}>
                    積み荷の種類と量を確認しました
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* フッター（ボタン） */}
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
            style={{
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#374151',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          {/* 進むボタン */}
          <button
            onClick={handleNext}
            disabled={!formData.cargoConfirmed || (!formData.itemId && !formData.customItemName && formData.selectedItemIds.length === 0)}
            style={{
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'white',
              background: formData.cargoConfirmed && (formData.itemId || formData.customItemName || formData.selectedItemIds.length > 0)
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#d1d5db',
              border: 'none',
              borderRadius: '8px',
              cursor: formData.cargoConfirmed && (formData.itemId || formData.customItemName || formData.selectedItemIds.length > 0)
                ? 'pointer'
                : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            進む
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LoadingInput;