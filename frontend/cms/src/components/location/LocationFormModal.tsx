// frontend/cms/src/components/location/LocationFormModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Loader, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Button from '../common/Button';
import Input, { Select } from '../common/Input';
import AddressAutocomplete from '../maps/AddressAutocomplete';
import LocationMapPicker from '../maps/LocationMapPicker';
import { Coordinates } from '../../types/maps';
import { useZipCodeSearch, useGeocoding, useGoogleMapsLoader } from '../../hooks/useGoogleMaps';

interface LocationFormData {
  clientName: string;
  name: string;
  address: string;
  locationType: 'PICKUP' | 'DELIVERY';
  latitude: number;
  longitude: number;
  postalCode?: string;
}

interface LocationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<LocationFormData, 'postalCode'>) => Promise<void>;
  initialData?: Partial<LocationFormData>;
  title?: string;
  loading?: boolean;
}

const LocationFormModal: React.FC<LocationFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title = '場所情報編集',
  loading = false,
}) => {
  // Google Maps API Key（環境変数から取得）
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  
  // APIキーが未設定の場合の警告
  const isApiKeyMissing = !GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
  
  const { isLoaded: isMapsLoaded, error: mapsError } = useGoogleMapsLoader(GOOGLE_MAPS_API_KEY);
  const { searchByZipCode, loading: zipLoading } = useZipCodeSearch();
  const { geocodeAddress } = useGeocoding();

  const [formData, setFormData] = useState<LocationFormData>({
    clientName: '',
    name: '',
    address: '',
    locationType: 'DELIVERY',
    latitude: 0,
    longitude: 0,
    postalCode: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [mapKey, setMapKey] = useState(0); // 地図を再レンダリングするためのキー

  // 初期データの設定
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        postalCode: initialData.postalCode || '',
      }));
      
      // 地図を更新
      if (initialData.latitude && initialData.longitude) {
        setMapKey(prev => prev + 1);
      }
    }
  }, [initialData]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // 郵便番号検索
  const handleZipCodeSearch = async () => {
    if (!formData.postalCode) {
      toast.error('郵便番号を入力してください');
      return;
    }

    try {
      const result = await searchByZipCode(formData.postalCode);
      
      // 住所フィールドを更新
      setFormData(prev => ({
        ...prev,
        address: result.fullAddress,
      }));

      // 座標を取得
      const coordinates = await geocodeAddress(result.fullAddress);
      setFormData(prev => ({
        ...prev,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      }));

      // 地図を更新
      setMapKey(prev => prev + 1);
      
      toast.success('住所を取得しました');
    } catch (error) {
      toast.error('郵便番号から住所の取得に失敗しました');
    }
  };

  // 住所選択時
  const handleAddressSelect = (address: string, coordinates: Coordinates) => {
    setFormData(prev => ({
      ...prev,
      address,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
    }));

    // 地図を更新
    if ((window as any).updateMapPosition) {
      (window as any).updateMapPosition(coordinates);
    }
  };

  // 地図上の位置変更時
  const handleMapPositionChange = (coordinates: Coordinates, address: string) => {
    setFormData(prev => ({
      ...prev,
      address,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
    }));
  };

  // バリデーション
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.clientName.trim()) {
      errors.clientName = '客先名は必須です';
    }

    if (!formData.name.trim()) {
      errors.name = '場所名は必須です';
    }

    if (!formData.address.trim()) {
      errors.address = '住所は必須です';
    }

    if (!formData.latitude || !formData.longitude) {
      errors.coordinates = '地図上で位置を指定してください';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('入力内容を確認してください');
      return;
    }

    try {
      // postalCodeを除外してonSubmitに渡す
      const { postalCode, ...submitData } = formData;
      await onSubmit(submitData);
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* 背景オーバーレイ */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* モーダル */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:w-full sm:max-w-6xl">
          {/* ヘッダー */}
          <div className="bg-white px-6 pt-5 pb-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {title}
              </h3>
              <button
                onClick={onClose}
                disabled={loading}
                className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* コンテンツ */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-6 py-5">
              {/* APIキー未設定エラー */}
              {isApiKeyMissing && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    ⚠️ Google Maps APIキーが未設定です
                  </h4>
                  <p className="text-sm text-yellow-700 mb-2">
                    地図機能を使用するには、Google Maps APIキーを設定してください。
                  </p>
                  <ol className="text-xs text-yellow-600 list-decimal list-inside space-y-1">
                    <li>Google Cloud Consoleでプロジェクトを作成</li>
                    <li>Maps JavaScript API, Places API, Geocoding APIを有効化</li>
                    <li>APIキーを取得</li>
                    <li><code className="bg-yellow-100 px-1 rounded">frontend/cms/.env.production</code>に<code className="bg-yellow-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code>を設定</li>
                  </ol>
                </div>
              )}

              {/* Google Maps APIエラー */}
              {mapsError && !isApiKeyMissing && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">
                    地図機能の読み込みに失敗しました。APIキーを確認してください。
                  </p>
                </div>
              )}

              {/* Google Maps読み込み中 */}
              {!isMapsLoaded && !mapsError && !isApiKeyMissing && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <Loader className="h-5 w-5 text-blue-600 animate-spin" />
                    <p className="text-sm text-blue-800">地図を読み込み中...</p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* 基本情報 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="客先名"
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    error={formErrors.clientName}
                    placeholder="例: 株式会社○○"
                    required
                  />

                  <Input
                    label="場所名"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    error={formErrors.name}
                    placeholder="例: 大阪工場、○○現場"
                    required
                  />
                </div>

                {/* 郵便番号検索 */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    郵便番号から住所を検索（任意）
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="123-4567"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleZipCodeSearch}
                      disabled={zipLoading || !formData.postalCode}
                      className="whitespace-nowrap"
                    >
                      {zipLoading ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-1" />
                      )}
                      住所検索
                    </Button>
                  </div>
                </div>

                {/* 住所入力（自動補完） */}
                {isMapsLoaded && !isApiKeyMissing && (
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(value) => setFormData({ ...formData, address: value })}
                    onSelect={handleAddressSelect}
                    error={formErrors.address}
                    required
                  />
                )}

                {/* APIキー未設定時の通常の住所入力 */}
                {isApiKeyMissing && (
                  <Input
                    label="住所"
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    error={formErrors.address}
                    placeholder="例: 大阪府枚方市春日西町２丁目２８−２６"
                    required
                  />
                )}

                {/* 場所種別 */}
                <Select
                  label="場所種別"
                  options={[
                    { value: 'PICKUP', label: '積込' },
                    { value: 'DELIVERY', label: '積降' },
                  ]}
                  value={formData.locationType}
                  onChange={(e) => setFormData({ ...formData, locationType: e.target.value as 'PICKUP' | 'DELIVERY' })}
                  required
                />

                {/* 地図表示 */}
                {isMapsLoaded && !isApiKeyMissing && (
                  <div className="border-t pt-4">
                    <LocationMapPicker
                      key={mapKey}
                      initialPosition={{
                        lat: formData.latitude || 34.8036,
                        lng: formData.longitude || 135.6799,
                      }}
                      onPositionChange={handleMapPositionChange}
                      height={400}
                      zoom={formData.latitude ? 17 : 15}
                    />
                    {formErrors.coordinates && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.coordinates}</p>
                    )}
                  </div>
                )}

                {/* GPS座標（readonly） - APIキー有効時のみ */}
                {!isApiKeyMissing && (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      GPS座標情報（自動取得）
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">緯度</p>
                        <p className="text-sm font-mono font-medium text-gray-900">
                          {formData.latitude ? formData.latitude.toFixed(6) : '0.000000'}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">経度</p>
                        <p className="text-sm font-mono font-medium text-gray-900">
                          {formData.longitude ? formData.longitude.toFixed(6) : '0.000000'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      ※ 地図上のピン位置から自動的に設定されます
                    </p>
                  </div>
                )}

                {/* APIキー未設定時の手動GPS座標入力 */}
                {isApiKeyMissing && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">GPS座標情報（任意）</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="緯度"
                        type="number"
                        step="0.000001"
                        min="-90"
                        max="90"
                        value={formData.latitude}
                        onChange={(e) => setFormData({ ...formData, latitude: Number(e.target.value) })}
                        placeholder="例: 34.803682"
                      />
                      <Input
                        label="経度"
                        type="number"
                        step="0.000001"
                        min="-180"
                        max="180"
                        value={formData.longitude}
                        onChange={(e) => setFormData({ ...formData, longitude: Number(e.target.value) })}
                        placeholder="例: 135.679942"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      GPS座標を設定すると、モバイルアプリで自動入力が可能になります
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* フッター */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={loading}
              >
                保存
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LocationFormModal;