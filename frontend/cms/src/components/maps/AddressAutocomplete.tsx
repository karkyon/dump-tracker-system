// frontend/cms/src/components/maps/AddressAutocomplete.tsx
import React, { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { Coordinates } from '../../types/maps';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, coordinates: Coordinates) => void;
  placeholder?: string;
  error?: string;
  label?: string;
  required?: boolean;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = '住所を入力してください',
  error,
  label = '住所',
  required = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!window.google || !inputRef.current) return;

    // Google Places Autocompleteの初期化
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'jp' },
      fields: ['formatted_address', 'geometry', 'address_components', 'name'],
      types: ['address'],
    });

    // 場所選択時のイベントリスナー
    const listener = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();

      if (!place || !place.geometry || !place.geometry.location) {
        return;
      }

      const address = place.formatted_address || '';
      const coordinates: Coordinates = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };

      onChange(address);
      onSelect(address, coordinates);
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [onChange, onSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  return (
    <div className="relative">
      <div className="relative">
        <div className="mb-2">
          {label && (
            <label className="block text-sm font-medium text-gray-700">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          className={`w-full px-4 py-2 pr-10 border ${
            error ? 'border-red-500' : 'border-gray-300'
          } rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
        <div className="absolute right-3 top-9 flex items-center pointer-events-none">
          <MapPin className="h-5 w-5 text-gray-400" />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* サジェスト表示エリア（Google Places Autocompleteが自動で表示） */}
      <p className="mt-1 text-xs text-gray-500">
        📍 住所を入力すると候補が表示されます
      </p>
    </div>
  );
};

export default AddressAutocomplete;