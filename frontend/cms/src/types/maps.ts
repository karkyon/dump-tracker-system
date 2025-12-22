// frontend/cms/src/types/maps.ts
// Google Maps API用の型定義

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AddressSuggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface AddressComponents {
  postalCode?: string;
  prefecture?: string;
  city?: string;
  town?: string;
  fullAddress: string;
}

export interface ZipCloudResponse {
  message: string | null;
  results: Array<{
    address1: string; // 都道府県
    address2: string; // 市区町村
    address3: string; // 町域
    kana1: string;
    kana2: string;
    kana3: string;
    prefcode: string;
    zipcode: string;
  }> | null;
  status: number;
}

export interface MapPickerProps {
  initialPosition?: Coordinates;
  onPositionChange: (position: Coordinates, address: string) => void;
  height?: number;
  zoom?: number;
}

export interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, coordinates: Coordinates) => void;
  placeholder?: string;
  error?: string;
}