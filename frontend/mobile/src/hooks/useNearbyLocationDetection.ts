// frontend/mobile/src/hooks/useNearbyLocationDetection.ts
// 近隣地点自動検知カスタムHook - 完全修正版
// ✅ ブラウザ環境対応（NodeJS.Timeout → number）
// ✅ APIレスポンス構造完全対応
// ✅ TypeScript厳格型チェック対応
// ✅ 重複検知防止
// ✅ 自動フェードアウト

import { useState, useEffect, useRef } from 'react';
import apiService from '../services/api';

export interface NearbyLocationResult {
  location: {
    id: string;
    name: string;
    address: string;
    locationType: string;
    latitude: number;
    longitude: number;
    contactPerson?: string;
    contactPhone?: string;
  };
  distance: number;
  bearing: number;
}

export interface UseNearbyLocationDetectionParams {
  currentLocation: { latitude: number; longitude: number } | null;
  operationPhase: 'TO_LOADING' | 'AT_LOADING' | 'TO_UNLOADING' | 'AT_UNLOADING' | 'BREAK' | 'REFUEL' | null;
  enabled: boolean;
  radiusMeters?: number;
  checkIntervalMs?: number;
  popupDurationMs?: number;
}

export const useNearbyLocationDetection = ({
  currentLocation,
  operationPhase,
  enabled,
  radiusMeters = 150,
  checkIntervalMs = 5000,
  popupDurationMs = 5000
}: UseNearbyLocationDetectionParams) => {
  const [detectedLocation, setDetectedLocation] = useState<NearbyLocationResult | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const lastDetectedIdRef = useRef<string | null>(null);
  const popupTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !currentLocation || !operationPhase) {
      return;
    }

    const checkNearbyLocations = async () => {
      try {
        console.log('🔍 近隣地点検索開始:', {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radiusMeters,
          phase: operationPhase
        });

        // ✅ apiService.getNearbyLocationsを使用
        const response = await apiService.getNearbyLocations({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          radiusMeters,
          phase: operationPhase
        });

        console.log('📡 APIレスポンス:', response);

        // ✅ 正しいレスポンス構造に対応
        // response.data.locations を参照
        const locationsData = response.data?.locations;

        if (locationsData && Array.isArray(locationsData) && locationsData.length > 0) {
          const nearest = locationsData[0];
          
          // ✅ 修正: nearestのundefinedチェックを追加
          if (!nearest) {
            console.log('⚠️ 近隣地点データが不正です');
            return;
          }

          console.log('✅ 近隣地点検知:', {
            name: nearest.location.name,
            distance: nearest.distance,
            id: nearest.location.id
          });

          // 同じ地点を連続表示しない
          if (nearest.location.id !== lastDetectedIdRef.current) {
            lastDetectedIdRef.current = nearest.location.id;
            setDetectedLocation(nearest);
            setIsPopupVisible(true);

            // 既存のタイムアウトをクリア
            if (popupTimeoutRef.current !== null) {
              window.clearTimeout(popupTimeoutRef.current);
            }

            // 指定時間後に自動フェードアウト
            popupTimeoutRef.current = window.setTimeout(() => {
              setIsPopupVisible(false);
              window.setTimeout(() => {
                setDetectedLocation(null);
              }, 300);
            }, popupDurationMs);
          }
        } else {
          console.log('ℹ️ 近隣に地点なし');
          
          // 範囲外に出たらリセット
          if (lastDetectedIdRef.current) {
            lastDetectedIdRef.current = null;
          }
        }
      } catch (error) {
        console.error('❌ 近隣地点チェックエラー:', error);
      }
    };

    // 初回実行
    checkNearbyLocations();

    // 定期実行
    const intervalId = window.setInterval(checkNearbyLocations, checkIntervalMs);

    // クリーンアップ
    return () => {
      window.clearInterval(intervalId);
      if (popupTimeoutRef.current !== null) {
        window.clearTimeout(popupTimeoutRef.current);
      }
    };
  }, [currentLocation, operationPhase, enabled, radiusMeters, checkIntervalMs, popupDurationMs]);

  const dismissPopup = () => {
    setIsPopupVisible(false);
    if (popupTimeoutRef.current !== null) {
      window.clearTimeout(popupTimeoutRef.current);
    }
    window.setTimeout(() => {
      setDetectedLocation(null);
    }, 300);
  };

  return {
    detectedLocation,
    isPopupVisible,
    dismissPopup
  };
};