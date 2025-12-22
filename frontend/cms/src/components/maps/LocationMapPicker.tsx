// frontend/cms/src/components/maps/LocationMapPicker.tsx
import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader } from 'lucide-react';
import { Coordinates } from '../../types/maps';
import { useReverseGeocoding } from '../../hooks/useGoogleMaps';

interface LocationMapPickerProps {
  initialPosition?: Coordinates;
  onPositionChange: (position: Coordinates, address: string) => void;
  height?: number;
  zoom?: number;
}

const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  initialPosition = { lat: 34.8036, lng: 135.6799 }, // デフォルト: 大阪府枚方市
  onPositionChange,
  height = 400,
  zoom = 15,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const { reverseGeocode } = useReverseGeocoding();

  // 地図の初期化
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Google Map初期化
    const map = new google.maps.Map(mapRef.current, {
      center: initialPosition,
      zoom: zoom,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    googleMapRef.current = map;

    // マーカー作成
    const marker = new google.maps.Marker({
      position: initialPosition,
      map: map,
      draggable: true,
      title: 'ドラッグして位置を調整',
      animation: google.maps.Animation.DROP,
    });

    markerRef.current = marker;

    // マーカードラッグ終了時のイベント
    marker.addListener('dragend', async () => {
      const position = marker.getPosition();
      if (!position) return;

      const coordinates: Coordinates = {
        lat: position.lat(),
        lng: position.lng(),
      };

      setIsLoadingAddress(true);
      try {
        const address = await reverseGeocode(coordinates);
        setCurrentAddress(address);
        onPositionChange(coordinates, address);
      } catch (error) {
        console.error('住所取得エラー:', error);
      } finally {
        setIsLoadingAddress(false);
      }
    });

    // 初期位置の住所を取得
    reverseGeocode(initialPosition)
      .then(address => setCurrentAddress(address))
      .catch(err => {
        console.warn('[LocationMapPicker] 初期住所取得をスキップ:', err.message);
        setCurrentAddress('住所を取得できませんでした');
      });

    return () => {
      // クリーンアップ
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [initialPosition, zoom, onPositionChange, reverseGeocode]);

  // 地図内検索ボックスの初期化
  useEffect(() => {
    if (!googleMapRef.current || !window.google) return;

    const input = document.getElementById('map-search-input') as HTMLInputElement;
    if (!input) return;

    const searchBox = new google.maps.places.SearchBox(input, {
      bounds: googleMapRef.current.getBounds() || undefined,
    });

    searchBoxRef.current = searchBox;

    // 検索結果選択時
    searchBox.addListener('places_changed', () => {
      const places = searchBox.getPlaces();
      if (!places || places.length === 0) return;

      const place = places[0];
      if (!place.geometry || !place.geometry.location) return;

      const coordinates: Coordinates = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };

      // 地図を移動
      googleMapRef.current?.setCenter(coordinates);
      googleMapRef.current?.setZoom(17);

      // マーカーを移動
      markerRef.current?.setPosition(coordinates);

      // 住所を更新
      const address = place.formatted_address || '';
      setCurrentAddress(address);
      onPositionChange(coordinates, address);
    });
  }, [onPositionChange]);

  // 外部から位置を更新
  const updatePosition = (coordinates: Coordinates) => {
    if (!googleMapRef.current || !markerRef.current) return;

    googleMapRef.current.setCenter(coordinates);
    markerRef.current.setPosition(coordinates);

    reverseGeocode(coordinates)
      .then(address => {
        setCurrentAddress(address);
        onPositionChange(coordinates, address);
      })
      .catch(err => console.error('住所取得エラー:', err));
  };

  // 親コンポーネントから呼び出せるようにする
  useEffect(() => {
    (window as any).updateMapPosition = updatePosition;
  }, []);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        地図で位置を指定
      </label>

      {/* 地図内検索ボックス */}
      <div className="relative">
        <input
          id="map-search-input"
          type="text"
          placeholder="地図で検索（例: 枚方市役所）"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <MapPin className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
      </div>

      {/* 地図表示エリア */}
      <div
        ref={mapRef}
        style={{ height: `${height}px` }}
        className="w-full rounded-lg border border-gray-300 shadow-sm"
      />

      {/* 現在の位置情報 */}
      <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
        <div className="flex items-start space-x-2">
          <MapPin className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 mb-1">現在の位置</p>
            {isLoadingAddress ? (
              <div className="flex items-center space-x-2">
                <Loader className="h-4 w-4 text-gray-400 animate-spin" />
                <span className="text-sm text-gray-500">住所を取得中...</span>
              </div>
            ) : (
              <p className="text-sm text-gray-900 break-words">
                {currentAddress || '住所を取得できませんでした'}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 マーカーをドラッグして位置を微調整できます
        </p>
      </div>
    </div>
  );
};

export default LocationMapPicker;