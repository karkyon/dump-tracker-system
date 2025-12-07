// frontend/mobile/src/components/LocationRegistrationDialog.tsx
// 🆕 新規地点登録ダイアログコンポーネント
// ✅ 近隣地点が見つからない場合に新規登録を促す
// ✅ GPS座標・住所を自動入力
// ✅ 地点名は手入力
// 作成日: 2025年12月7日

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// 注意: Google Maps API の型定義は GoogleMapWrapper.tsx で既に定義されているため
// ここでは定義しない（型競合を回避）

interface LocationRegistrationDialogProps {
  visible: boolean;
  locationType: 'LOADING' | 'UNLOADING'; // 積込 or 積降
  currentPosition: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  onRegister: (locationData: NewLocationData) => Promise<void>;
  onCancel: () => void;
}

export interface NewLocationData {
  name: string;
  latitude: number;
  longitude: number;
  locationType: 'DEPOT' | 'DESTINATION'; // DEPOT=積込場所, DESTINATION=積降場所
  address: string;
}

export const LocationRegistrationDialog: React.FC<LocationRegistrationDialogProps> = ({
  visible,
  locationType,
  currentPosition,
  onRegister,
  onCancel
}) => {
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('住所を取得中...');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  // 逆ジオコーディング（GPS座標から住所を取得）
  useEffect(() => {
    if (!visible || !currentPosition) return;

    const fetchAddress = async () => {
      setAddressLoading(true);
      try {
        // Google Maps Geocoding API を使用して住所を取得
        // window.google は GoogleMapWrapper.tsx で定義済み
        if (typeof window.google !== 'undefined' && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          const latlng = {
            lat: currentPosition.latitude,
            lng: currentPosition.longitude
          };

          geocoder.geocode({ location: latlng }, (results: any, status: string) => {
            if (status === 'OK' && results && results[0]) {
              setAddress(results[0].formatted_address);
            } else {
              setAddress('住所の取得に失敗しました');
            }
            setAddressLoading(false);
          });
        } else {
          setAddress('Google Maps APIが読み込まれていません');
          setAddressLoading(false);
        }
      } catch (error) {
        console.error('住所取得エラー:', error);
        setAddress('住所の取得に失敗しました');
        setAddressLoading(false);
      }
    };

    fetchAddress();
  }, [visible, currentPosition]);

  // ダイアログを閉じる際にリセット
  useEffect(() => {
    if (!visible) {
      setLocationName('');
      setAddress('住所を取得中...');
      setIsSubmitting(false);
    }
  }, [visible]);

  const handleRegister = async () => {
    // バリデーション
    if (!locationName.trim()) {
      toast.error('地点名を入力してください');
      return;
    }

    if (locationName.trim().length < 2) {
      toast.error('地点名は2文字以上で入力してください');
      return;
    }

    if (addressLoading) {
      toast.error('住所の取得中です。しばらくお待ちください');
      return;
    }

    setIsSubmitting(true);

    try {
      const newLocationData: NewLocationData = {
        name: locationName.trim(),
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        locationType: locationType === 'LOADING' ? 'DEPOT' : 'DESTINATION',
        address: address === '住所を取得中...' || address === '住所の取得に失敗しました' || address === 'Google Maps APIが読み込まれていません'
          ? '' 
          : address
      };

      await onRegister(newLocationData);
      toast.success('新しい地点を登録しました');
    } catch (error) {
      console.error('地点登録エラー:', error);
      toast.error('地点の登録に失敗しました');
      setIsSubmitting(false);
    }
  };

  if (!visible) {
    return null;
  }

  const typeLabel = locationType === 'LOADING' ? '積込場所' : '積降場所';
  const typeColor = locationType === 'LOADING' ? '#2196F3' : '#4CAF50';

  return (
    <>
      {/* オーバーレイ */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease'
        }}
        onClick={onCancel}
      >
        {/* ダイアログ */}
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '90%',
            width: '400px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.3s ease'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              background: '#f5f5f5'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '24px' }}>📍</span>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#333'
                }}
              >
                新しい{typeLabel}を登録
              </h2>
            </div>
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: '14px',
                color: '#666'
              }}
            >
              近くに登録されている{typeLabel}が見つかりません。<br />
              この場所を新規登録しますか?
            </p>
          </div>

          {/* コンテンツ */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }}
          >
            {/* 地点種別ラベル */}
            <div
              style={{
                display: 'inline-block',
                fontSize: '12px',
                fontWeight: 'bold',
                color: 'white',
                background: typeColor,
                padding: '6px 12px',
                borderRadius: '6px',
                marginBottom: '16px'
              }}
            >
              {typeLabel}
            </div>

            {/* 地点名入力 */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#333',
                  marginBottom: '8px'
                }}
              >
                地点名 <span style={{ color: '#F44336' }}>*</span>
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="例: ○○建材センター"
                maxLength={100}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = typeColor}
                onBlur={(e) => e.target.style.borderColor = '#ccc'}
              />
              <div
                style={{
                  fontSize: '12px',
                  color: '#999',
                  marginTop: '4px',
                  textAlign: 'right'
                }}
              >
                {locationName.length}/100
              </div>
            </div>

            {/* GPS座標情報 */}
            <div
              style={{
                padding: '16px',
                background: '#F5F5F5',
                borderRadius: '8px',
                marginBottom: '16px'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>
                📍 GPS座標
              </div>
              <div style={{ fontSize: '13px', color: '#333' }}>
                緯度: {currentPosition.latitude.toFixed(6)}<br />
                経度: {currentPosition.longitude.toFixed(6)}
                {currentPosition.accuracy && (
                  <>
                    <br />
                    精度: ±{Math.round(currentPosition.accuracy)}m
                  </>
                )}
              </div>
            </div>

            {/* 住所情報 */}
            <div
              style={{
                padding: '16px',
                background: '#F5F5F5',
                borderRadius: '8px'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>
                🏠 住所
              </div>
              <div style={{ fontSize: '13px', color: '#333' }}>
                {addressLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="spinner-small" />
                    <span>住所を取得中...</span>
                  </div>
                ) : (
                  address
                )}
              </div>
            </div>
          </div>

          {/* フッター（ボタン） */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '12px'
            }}
          >
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#666',
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handleRegister}
              disabled={isSubmitting || !locationName.trim() || addressLoading}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                background: (isSubmitting || !locationName.trim() || addressLoading) 
                  ? '#ccc' 
                  : typeColor,
                border: 'none',
                borderRadius: '8px',
                cursor: (isSubmitting || !locationName.trim() || addressLoading) 
                  ? 'not-allowed' 
                  : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner-small" />
                  <span>登録中...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>登録する</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CSSアニメーション */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #666;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};