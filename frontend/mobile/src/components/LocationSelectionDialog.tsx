// frontend/mobile/src/components/LocationSelectionDialog.tsx
// 🆕 地点選択ダイアログコンポーネント
// ✅ 複数候補地点の表示
// ✅ 単一候補時は確認ボタン
// ✅ 複数候補時は選択リスト

import React, { useState, useEffect } from 'react';
import { NearbyLocationResult } from '../hooks/useNearbyLocationDetection';

interface LocationSelectionDialogProps {
  locations: NearbyLocationResult[];
  visible: boolean;
  onSelect: (location: NearbyLocationResult) => void;
  onCancel: () => void;
  title: string;
}

export const LocationSelectionDialog: React.FC<LocationSelectionDialogProps> = ({
  locations,
  visible,
  onSelect,
  onCancel,
  title
}) => {
  const [selectedLocation, setSelectedLocation] = useState<NearbyLocationResult | null>(
    locations.length === 1 && locations[0] ? locations[0] : null
  );

  // locationsが変更されたら、単一候補の場合は自動選択
  useEffect(() => {
    if (locations.length === 1 && locations[0]) {
      setSelectedLocation(locations[0]);
    } else if (locations.length === 0) {
      setSelectedLocation(null);
    }
  }, [locations]);

  if (!visible) {
    return null;
  }

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect(selectedLocation);
    }
  };

  const getTypeLabel = (locationType: string): string => {
    switch (locationType) {
      case 'DEPOT':
      case 'PICKUP':
        return '積込場所';
      case 'DESTINATION':
      case 'DELIVERY':
        return '積降場所';
      case 'REST_AREA':
        return '休憩所';
      case 'FUEL_STATION':
        return '給油所';
      default:
        return '地点';
    }
  };

  const getTypeColor = (locationType: string): { color: string; background: string } => {
    switch (locationType) {
      case 'DEPOT':
      case 'PICKUP':
        return { color: '#2196F3', background: '#E3F2FD' };
      case 'DESTINATION':
      case 'DELIVERY':
        return { color: '#4CAF50', background: '#E8F5E9' };
      case 'REST_AREA':
        return { color: '#FF9800', background: '#FFF3E0' };
      case 'FUEL_STATION':
        return { color: '#FFC107', background: '#FFFDE7' };
      default:
        return { color: '#666', background: '#F5F5F5' };
    }
  };

  const formatDistance = (distance: number): string => {
    return distance < 1
      ? `${Math.round(distance * 1000)}m`
      : `${distance.toFixed(2)}km`;
  };

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
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
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
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
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
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#333'
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: '14px',
                color: '#666'
              }}
            >
              {locations.length === 1
                ? 'この地点でよろしいですか?'
                : `${locations.length}件の候補が見つかりました。選択してください。`}
            </p>
          </div>

          {/* 候補リスト */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px'
            }}
          >
            {locations.map((location, index) => {
              const typeLabel = getTypeLabel(location.location.locationType);
              const typeColors = getTypeColor(location.location.locationType);
              const isSelected = selectedLocation?.location.id === location.location.id;

              return (
                <div
                  key={location.location.id}
                  onClick={() => setSelectedLocation(location)}
                  style={{
                    padding: '16px',
                    marginBottom: index < locations.length - 1 ? '12px' : 0,
                    border: isSelected ? '2px solid #2196F3' : '1px solid #e0e0e0',
                    borderRadius: '12px',
                    background: isSelected ? '#E3F2FD' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* タイプラベル */}
                  <div
                    style={{
                      display: 'inline-block',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: typeColors.color,
                      background: typeColors.background,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      marginBottom: '8px'
                    }}
                  >
                    {typeLabel}
                  </div>

                  {/* 場所名 */}
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#333',
                      marginBottom: '4px'
                    }}
                  >
                    {location.location.name}
                  </div>

                  {/* 距離 */}
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#FF5722',
                      fontWeight: 'bold',
                      marginBottom: '8px'
                    }}
                  >
                    約 {formatDistance(location.distance)} 先
                  </div>

                  {/* 住所 */}
                  {location.location.address && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#666',
                        marginBottom: '4px'
                      }}
                    >
                      📍 {location.location.address}
                    </div>
                  )}

                  {/* 担当者情報 */}
                  {location.location.contactPerson && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#666'
                      }}
                    >
                      👤 {location.location.contactPerson}
                      {location.location.contactPhone && ` (${location.location.contactPhone})`}
                    </div>
                  )}
                </div>
              );
            })}
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
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#666',
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedLocation}
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: 'white',
                background: selectedLocation ? '#2196F3' : '#ccc',
                border: 'none',
                borderRadius: '8px',
                cursor: selectedLocation ? 'pointer' : 'not-allowed'
              }}
            >
              {locations.length === 1 ? '確認' : '選択'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};