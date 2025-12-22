// frontend/cms/src/hooks/useGoogleMaps.ts
import { useState, useEffect, useCallback } from 'react';
import { Coordinates, ZipCloudResponse } from '../types/maps';

// Google Maps APIの読み込み状態
let isGoogleMapsLoaded = false;
let googleMapsLoadPromise: Promise<void> | null = null;

/**
 * Google Maps APIを読み込むフック
 */
export const useGoogleMapsLoader = (apiKey: string) => {
  const [isLoaded, setIsLoaded] = useState(isGoogleMapsLoaded);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (isGoogleMapsLoaded) {
      setIsLoaded(true);
      return;
    }

    if (!googleMapsLoadPromise) {
      googleMapsLoadPromise = new Promise<void>((resolve, reject) => {
        // 既にスクリプトが読み込まれているかチェック
        if (window.google && window.google.maps) {
          isGoogleMapsLoaded = true;
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja&region=JP&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          isGoogleMapsLoaded = true;
          resolve();
        };

        script.onerror = () => {
          reject(new Error('Google Maps APIの読み込みに失敗しました'));
        };

        document.head.appendChild(script);
      });
    }

    googleMapsLoadPromise
      .then(() => setIsLoaded(true))
      .catch((err) => setError(err));
  }, [apiKey]);

  return { isLoaded, error };
};

/**
 * 郵便番号から住所を取得する
 */
export const useZipCodeSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchByZipCode = useCallback(async (zipCode: string) => {
    setLoading(true);
    setError(null);

    try {
      // ハイフンを除去
      const cleanZipCode = zipCode.replace(/-/g, '');

      if (cleanZipCode.length !== 7) {
        throw new Error('郵便番号は7桁で入力してください');
      }

      const response = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZipCode}`
      );

      if (!response.ok) {
        throw new Error('郵便番号検索に失敗しました');
      }

      const data: ZipCloudResponse = await response.json();

      if (data.status !== 200 || !data.results || data.results.length === 0) {
        throw new Error('該当する住所が見つかりませんでした');
      }

      const result = data.results[0];
      const fullAddress = `${result.address1}${result.address2}${result.address3}`;

      setLoading(false);
      return {
        prefecture: result.address1,
        city: result.address2,
        town: result.address3,
        fullAddress,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '郵便番号検索エラー';
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  return { searchByZipCode, loading, error };
};

/**
 * 住所から座標を取得する（ジオコーディング）
 */
export const useGeocoding = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocodeAddress = useCallback(async (address: string): Promise<Coordinates> => {
    setLoading(true);
    setError(null);

    try {
      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps APIが読み込まれていません');
      }

      const geocoder = new google.maps.Geocoder();

      return new Promise((resolve, reject) => {
        geocoder.geocode(
          { address, region: 'JP' },
          (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
            setLoading(false);

            if (status === 'OK' && results && results[0]) {
              const location = results[0].geometry.location;
              resolve({
                lat: location.lat(),
                lng: location.lng(),
              });
            } else {
              const errorMsg = '住所から座標の取得に失敗しました';
              setError(errorMsg);
              reject(new Error(errorMsg));
            }
          }
        );
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ジオコーディングエラー';
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  return { geocodeAddress, loading, error };
};

/**
 * 座標から住所を取得する（リバースジオコーディング）
 */
export const useReverseGeocoding = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reverseGeocode = useCallback(async (coordinates: Coordinates): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps APIが読み込まれていません');
      }

      const geocoder = new google.maps.Geocoder();
      const latLng = new google.maps.LatLng(coordinates.lat, coordinates.lng);

      return new Promise((resolve, reject) => {
        geocoder.geocode(
          { location: latLng },
          (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
            setLoading(false);

            if (status === 'OK' && results && results[0]) {
              resolve(results[0].formatted_address);
            } else {
              const errorMsg = '座標から住所の取得に失敗しました';
              setError(errorMsg);
              reject(new Error(errorMsg));
            }
          }
        );
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'リバースジオコーディングエラー';
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  return { reverseGeocode, loading, error };
};