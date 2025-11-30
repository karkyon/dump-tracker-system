// frontend/mobile/src/components/LocationProximityPopup.tsx
// 近隣地点ポップアップコンポーネント - 完全修正版
// ✅ 全LocationType対応
// ✅ フェードイン/アウトアニメーション
// ✅ 地点情報完全表示

import React, { useEffect, useState } from 'react';
import { NearbyLocationResult } from '../hooks/useNearbyLocationDetection';

interface LocationProximityPopupProps {
  location: NearbyLocationResult;
  visible: boolean;
  onDismiss: () => void;
}

export const LocationProximityPopup: React.FC<LocationProximityPopupProps> = ({
  location,
  visible,
  onDismiss
}) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (visible) {
      // フェードイン
      setTimeout(() => setOpacity(1), 10);
    } else {
      // フェードアウト
      setOpacity(0);
    }
  }, [visible]);

  if (!visible && opacity === 0) {
    return null;
  }

  const distanceText = location.distance < 1
    ? `${Math.round(location.distance * 1000)}m`
    : `${location.distance.toFixed(2)}km`;

  // ✅ 修正: 全LocationTypeに対応
  const getTypeLabel = (locationType: string): string => {
    switch (locationType) {
      case 'DEPOT':
        return '積込場所';
      case 'DESTINATION':
        return '積降場所';
      case 'REST_AREA':
        return '休憩所';
      case 'FUEL_STATION':
        return '給油所';
      default:
        return '地点';
    }
  };

  // ✅ 修正: タイプに応じた色分け
  const getTypeColor = (locationType: string): { color: string; background: string } => {
    switch (locationType) {
      case 'DEPOT':
        return { color: '#2196F3', background: '#E3F2FD' };
      case 'DESTINATION':
        return { color: '#4CAF50', background: '#E8F5E9' };
      case 'REST_AREA':
        return { color: '#FF9800', background: '#FFF3E0' };
      case 'FUEL_STATION':
        return { color: '#FFC107', background: '#FFFDE7' };
      default:
        return { color: '#666', background: '#F5F5F5' };
    }
  };

  const typeLabel = getTypeLabel(location.location.locationType);
  const typeColors = getTypeColor(location.location.locationType);

  return (
    <div style={{
      position: 'absolute',
      top: '80px',
      left: '16px',
      right: '16px',
      zIndex: 1000,
      opacity,
      transition: 'opacity 0.3s ease',
      pointerEvents: visible ? 'auto' : 'none'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: typeColors.color,
            background: typeColors.background,
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {typeLabel}
          </span>
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#666',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* 場所名 */}
        <div style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#333',
          marginBottom: '4px'
        }}>
          {location.location.name}
        </div>

        {/* 距離 */}
        <div style={{
          fontSize: '14px',
          color: '#FF5722',
          fontWeight: 'bold',
          marginBottom: '12px'
        }}>
          約 {distanceText} 先
        </div>

        {/* 住所 */}
        {location.location.address && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>住所:</div>
            <div style={{ fontSize: '14px', color: '#333' }}>{location.location.address}</div>
          </div>
        )}

        {/* GPS座標 */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>GPS:</div>
          <div style={{ fontSize: '14px', color: '#333' }}>
            {location.location.latitude.toFixed(6)}, {location.location.longitude.toFixed(6)}
          </div>
        </div>

        {/* 担当者情報 */}
        {location.location.contactPerson && (
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>担当者:</div>
            <div style={{ fontSize: '14px', color: '#333' }}>
              {location.location.contactPerson}
              {location.location.contactPhone && ` (${location.location.contactPhone})`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};