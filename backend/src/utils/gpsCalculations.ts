// =====================================
// backend/src/utils/gpsCalculations.ts
// GPS計算ユーティリティ
// Phase 1-A-11 完全アーキテクチャ改修版
// 作成日時: Fri Sep 26 17:00:00 JST 2025
// 最終更新: 2025年10月6日 - TypeScriptコンパイルエラー完全修正
// アーキテクチャ指針準拠 - 既存完全実装統合版
// =====================================

/**
 * 🎯 GPS計算ユーティリティ
 *
 * 【主要機能】
 * ✅ GPS座標バリデーション（緯度・経度・精度チェック)
 * ✅ 距離計算（Haversine公式による高精度計算）
 * ✅ 方位角計算・16方位変換
 * ✅ バウンディングボックス計算
 * ✅ 座標統計・分析（中心点・分散範囲）
 * ✅ 地点検索・フィルタリング（半径内検索・最寄り検索）
 * ✅ 精度を考慮した距離計算
 * ✅ ルート分析・最適化機能
 *
 * 【企業価値】
 * 💼 高精度GPS計算: Haversine公式による正確な距離・方位計算
 * 🗺️ 地点検索機能: 半径内検索・最寄り検索による効率的な地点管理
 * 📊 統計分析: 座標群の中心点・分散範囲計算による運行分析
 * 🎯 ルート最適化: 複数地点の総距離・最適順序計算
 * 🔒 堅牢性: 包括的なバリデーションによるエラー防止
 */

import { ValidationError, AppError } from './errors';

// 🎯 types/location.tsから座標関連型をインポート
import type {
  Coordinates,
  BoundingBox,
  RouteInfo
} from '../types/location';

// =====================================
// 🌍 GPS計算定数
// =====================================

/**
 * 地球の半径（キロメートル）
 * @constant
 */
export const EARTH_RADIUS_KM = 6371;

/**
 * 地球の半径（メートル）
 * @constant
 */
export const EARTH_RADIUS_M = EARTH_RADIUS_KM * 1000;

/**
 * 度からラジアンへの変換係数
 * @constant
 */
export const DEG_TO_RAD = Math.PI / 180;

/**
 * ラジアンから度への変換係数
 * @constant
 */
export const RAD_TO_DEG = 180 / Math.PI;

/**
 * GPS計算制限値
 * @constant
 */
export const GPS_CALCULATION_LIMITS = {
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
  MIN_ACCURACY_METERS: 0,
  MAX_ACCURACY_METERS: 10000,
  MIN_ALTITUDE_METERS: -500,
  MAX_ALTITUDE_METERS: 10000,
  MAX_DISTANCE_KM: 20037.5, // 地球の半周
  MAX_BEARING_DEGREES: 360
} as const;

// =====================================
// 🎯 拡張型定義（calculateRouteInfo用）
// =====================================

/**
 * ルート計算情報（内部使用）
 */
export interface RouteCalculationInfo {
  totalDistance: number;
  startPoint: Coordinates;
  endPoint: Coordinates;
  waypointCount: number;
  boundingBox: BoundingBox;
  startBearing: number;
  endBearing: number;
}

// =====================================
// 🔍 GPS座標バリデーション
// =====================================

/**
 * 緯度の有効性をチェック
 * @param latitude 緯度
 * @returns 有効かどうか
 */
export function isValidLatitude(latitude: number): boolean {
  return !isNaN(latitude) &&
         isFinite(latitude) &&
         latitude >= GPS_CALCULATION_LIMITS.MIN_LATITUDE &&
         latitude <= GPS_CALCULATION_LIMITS.MAX_LATITUDE;
}

/**
 * 経度の有効性をチェック
 * @param longitude 経度
 * @returns 有効かどうか
 */
export function isValidLongitude(longitude: number): boolean {
  return !isNaN(longitude) &&
         isFinite(longitude) &&
         longitude >= GPS_CALCULATION_LIMITS.MIN_LONGITUDE &&
         longitude <= GPS_CALCULATION_LIMITS.MAX_LONGITUDE;
}

/**
 * GPS座標の有効性をチェック（既存関数との互換性保持）
 * @param latitude 緯度
 * @param longitude 経度
 * @returns 有効かどうか
 */
export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return isValidLatitude(latitude) && isValidLongitude(longitude);
}

/**
 * GPS座標の有効性をチェック（別名エイリアス）
 * @param latitude 緯度
 * @param longitude 経度
 * @returns 有効かどうか
 */
export const isValidCoordinate = isValidCoordinates;

/**
 * Coordinatesオブジェクトの有効性をチェック
 * @param coordinates 座標オブジェクト
 * @returns 有効かどうか
 */
export function hasValidCoordinates(coordinates: Partial<Coordinates>): boolean {
  return !!coordinates &&
         typeof coordinates.latitude === 'number' &&
         typeof coordinates.longitude === 'number' &&
         isValidCoordinates(coordinates.latitude, coordinates.longitude);
}

/**
 * GPS精度の有効性をチェック
 * @param accuracy 精度（メートル）
 * @returns 有効かどうか
 */
export function isValidAccuracy(accuracy: number): boolean {
  return !isNaN(accuracy) &&
         isFinite(accuracy) &&
         accuracy >= GPS_CALCULATION_LIMITS.MIN_ACCURACY_METERS &&
         accuracy <= GPS_CALCULATION_LIMITS.MAX_ACCURACY_METERS;
}

/**
 * GPS高度の有効性をチェック
 * @param altitude 高度（メートル）
 * @returns 有効かどうか
 */
export function isValidAltitude(altitude: number): boolean {
  return !isNaN(altitude) &&
         isFinite(altitude) &&
         altitude >= GPS_CALCULATION_LIMITS.MIN_ALTITUDE_METERS &&
         altitude <= GPS_CALCULATION_LIMITS.MAX_ALTITUDE_METERS;
}

/**
 * 座標検証（エラー送出版）
 * @param latitude 緯度
 * @param longitude 経度
 * @param context コンテキスト情報
 * @throws {ValidationError} 座標が無効な場合
 */
export function validateCoordinates(latitude: number, longitude: number, context: string = '座標'): void {
  if (!isValidLatitude(latitude)) {
    throw new ValidationError(`${context}の緯度が無効です: ${latitude} (有効範囲: ${GPS_CALCULATION_LIMITS.MIN_LATITUDE}〜${GPS_CALCULATION_LIMITS.MAX_LATITUDE})`);
  }

  if (!isValidLongitude(longitude)) {
    throw new ValidationError(`${context}の経度が無効です: ${longitude} (有効範囲: ${GPS_CALCULATION_LIMITS.MIN_LONGITUDE}〜${GPS_CALCULATION_LIMITS.MAX_LONGITUDE})`);
  }
}

/**
 * GPS座標の検証（既存関数との互換性保持）
 * @param latitude 緯度
 * @param longitude 経度
 * @throws {ValidationError} 座標が無効な場合
 */
export function validateGPSCoordinates(latitude: number, longitude: number): void {
  validateCoordinates(latitude, longitude, 'GPS座標');
}

// =====================================
// 📏 距離計算
// =====================================

/**
 * 2点間の距離を計算（Haversine公式）
 * @param lat1 起点緯度
 * @param lon1 起点経度
 * @param lat2 終点緯度
 * @param lon2 終点経度
 * @returns 距離（キロメートル）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  validateCoordinates(lat1, lon1, '起点座標');
  validateCoordinates(lat2, lon2, '終点座標');

  // Haversine公式
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;
  const deltaLatRad = (lat2 - lat1) * DEG_TO_RAD;
  const deltaLonRad = (lon2 - lon1) * DEG_TO_RAD;

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Number(distance.toFixed(3));
}

/**
 * Coordinatesオブジェクト間の距離を計算
 * @param coord1 座標1
 * @param coord2 座標2
 * @returns 距離（キロメートル）
 */
export function calculateDistanceBetweenCoordinates(coord1: Coordinates, coord2: Coordinates): number {
  if (!hasValidCoordinates(coord1) || !hasValidCoordinates(coord2)) {
    throw new ValidationError('無効な座標オブジェクトが指定されました');
  }

  return calculateDistance(
    coord1.latitude,
    coord1.longitude,
    coord2.latitude,
    coord2.longitude
  );
}

/**
 * 複数地点間の総距離を計算
 * @param coordinates 座標配列
 * @returns 総距離（キロメートル）
 */
export function calculateTotalDistance(coordinates: Coordinates[]): number {
  if (coordinates.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistanceBetweenCoordinates(coordinates[i - 1]!, coordinates[i]!);
  }

  return Number(totalDistance.toFixed(3));
}

// =====================================
// 🧭 方位・角度計算
// =====================================

/**
 * 2点間の方位角を計算（北を0度とした時計回り）
 * @param lat1 起点緯度
 * @param lon1 起点経度
 * @param lat2 終点緯度
 * @param lon2 終点経度
 * @returns 方位角（度：0-359）
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  validateCoordinates(lat1, lon1, '起点座標');
  validateCoordinates(lat2, lon2, '終点座標');

  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;
  const deltaLonRad = (lon2 - lon1) * DEG_TO_RAD;

  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

  const bearingRad = Math.atan2(y, x);
  const bearing = (bearingRad * RAD_TO_DEG + 360) % 360;

  return Number(bearing.toFixed(1));
}

/**
 * 方位角を16方位の文字列に変換
 * @param bearing 方位角（度）
 * @returns 方位文字列（例：N, NE, E, SE, S, SW, W, NW）
 */
export function bearingToCompass(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index]!;
}

/**
 * 方位角を8方位の文字列に変換
 * @param bearing 方位角（度）
 * @returns 方位文字列（例：N, NE, E, SE, S, SW, W, NW）
 */
export function bearingToCompass8(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index]!;
}

/**
 * 方位角を日本語の方位に変換
 * @param bearing 方位角（度）
 * @returns 日本語方位（例：北、北東、東、南東、南、南西、西、北西）
 */
export function bearingToJapaneseCompass(bearing: number): string {
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index]!;
}

// =====================================
// 🗺️ 地点検索・フィルタリング
// =====================================

/**
 * 半径内の座標を検索
 * @param centerLat 中心点緯度
 * @param centerLon 中心点経度
 * @param radiusKm 半径（キロメートル）
 * @param coordinates 検索対象座標配列
 * @returns 半径内の座標（距離付き）
 */
export function findCoordinatesWithinRadius(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  coordinates: Coordinates[]
): Array<Coordinates & { distance: number }> {
  validateCoordinates(centerLat, centerLon, '中心点座標');

  if (radiusKm <= 0) {
    throw new ValidationError(`無効な半径: ${radiusKm}km (正の値である必要があります)`);
  }

  return coordinates
    .filter(coord => hasValidCoordinates(coord))
    .map(coord => {
      const distance = calculateDistance(centerLat, centerLon, coord.latitude, coord.longitude);
      return {
        ...coord,
        distance
      };
    })
    .filter(coord => coord.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * 最寄りの座標をN件取得
 * @param targetLat 基準点緯度
 * @param targetLon 基準点経度
 * @param coordinates 検索対象座標配列
 * @param limit 取得件数（デフォルト: 10）
 * @returns 最寄りの座標（距離・方位付き）
 */
export function findNearestCoordinates(
  targetLat: number,
  targetLon: number,
  coordinates: Coordinates[],
  limit = 10
): Array<Coordinates & { distance: number; bearing: number }> {
  validateCoordinates(targetLat, targetLon, '基準点座標');

  if (limit <= 0 || limit > 1000) {
    throw new ValidationError(`無効な制限数: ${limit} (有効範囲: 1〜1000)`);
  }

  return coordinates
    .filter(coord => hasValidCoordinates(coord))
    .map(coord => {
      const distance = calculateDistance(targetLat, targetLon, coord.latitude, coord.longitude);
      const bearing = calculateBearing(targetLat, targetLon, coord.latitude, coord.longitude);

      return {
        ...coord,
        distance,
        bearing
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * ✅ findNearbyLocations関数（新規追加）
 * 既存のfindCoordinatesWithinRadius関数へのエイリアス
 *
 * 【追加理由】
 * - models/GpsLogModel.tsで参照されている
 * - エラーメッセージ: Module '"../utils/gpsCalculations"' has no exported member 'findNearbyLocations'
 * - 既存の動作を変更せず、名前の互換性を提供
 *
 * @param centerLat 中心点緯度
 * @param centerLon 中心点経度
 * @param radiusKm 半径（キロメートル）
 * @param coordinates 検索対象座標配列
 * @returns 半径内の座標（距離付き）
 */
export const findNearbyLocations = findCoordinatesWithinRadius;

// =====================================
// 📦 バウンディングボックス計算
// =====================================

/**
 * 指定地点から半径のバウンディングボックスを計算
 * @param centerLat 中心点緯度
 * @param centerLon 中心点経度
 * @param radiusKm 半径（キロメートル）
 * @returns バウンディングボックス
 */
export function calculateBoundingBox(
  centerLat: number,
  centerLon: number,
  radiusKm: number
): BoundingBox {
  validateCoordinates(centerLat, centerLon, '中心点座標');

  if (radiusKm <= 0) {
    throw new ValidationError(`無効な半径: ${radiusKm}km (正の値である必要があります)`);
  }

  // 地球の円周から角度を計算
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * RAD_TO_DEG;
  const lonDelta = latDelta / Math.cos(centerLat * DEG_TO_RAD);

  return {
    northEast: {
      latitude: Math.min(centerLat + latDelta, GPS_CALCULATION_LIMITS.MAX_LATITUDE),
      longitude: Math.min(centerLon + lonDelta, GPS_CALCULATION_LIMITS.MAX_LONGITUDE)
    },
    southWest: {
      latitude: Math.max(centerLat - latDelta, GPS_CALCULATION_LIMITS.MIN_LATITUDE),
      longitude: Math.max(centerLon - lonDelta, GPS_CALCULATION_LIMITS.MIN_LONGITUDE)
    }
  };
}

/**
 * 複数座標のバウンディングボックスを計算
 * @param coordinates 座標配列
 * @returns バウンディングボックス
 */
export function calculateBoundingBoxFromCoordinates(coordinates: Coordinates[]): BoundingBox {
  if (coordinates.length === 0) {
    throw new ValidationError('座標配列が空です');
  }

  const validCoordinates = coordinates.filter(coord => hasValidCoordinates(coord));

  if (validCoordinates.length === 0) {
    throw new ValidationError('有効な座標が見つかりません');
  }

  // 最初の要素は存在することが保証されている
  const firstCoord = validCoordinates[0]!;
  let minLat = firstCoord.latitude;
  let maxLat = firstCoord.latitude;
  let minLon = firstCoord.longitude;
  let maxLon = firstCoord.longitude;

  for (const coord of validCoordinates) {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLon = Math.min(minLon, coord.longitude);
    maxLon = Math.max(maxLon, coord.longitude);
  }

  return {
    northEast: { latitude: maxLat, longitude: maxLon },
    southWest: { latitude: minLat, longitude: minLon }
  };
}

// =====================================
// 📊 座標統計・分析
// =====================================

/**
 * 座標群の中心点を計算
 * @param coordinates 座標配列
 * @returns 中心座標
 */
export function calculateCenterPoint(coordinates: Coordinates[]): Coordinates {
  const validCoordinates = coordinates.filter(coord => hasValidCoordinates(coord));

  if (validCoordinates.length === 0) {
    throw new ValidationError('有効な座標が見つかりません');
  }

  const totalLat = validCoordinates.reduce((sum, coord) => sum + coord.latitude, 0);
  const totalLon = validCoordinates.reduce((sum, coord) => sum + coord.longitude, 0);

  return {
    latitude: Number((totalLat / validCoordinates.length).toFixed(6)),
    longitude: Number((totalLon / validCoordinates.length).toFixed(6))
  };
}

/**
 * 座標群の分散範囲を計算
 * @param coordinates 座標配列
 * @returns 分散情報
 */
export function calculateCoordinatesSpread(coordinates: Coordinates[]) {
  const validCoordinates = coordinates.filter(coord => hasValidCoordinates(coord));

  if (validCoordinates.length === 0) {
    throw new ValidationError('有効な座標が見つかりません');
  }

  const center = calculateCenterPoint(validCoordinates);
  const distances = validCoordinates.map(coord =>
    calculateDistanceBetweenCoordinates(center, coord)
  );

  const maxDistance = Math.max(...distances);
  const avgDistance = distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
  const minDistance = Math.min(...distances);

  return {
    center,
    maxDistance: Number(maxDistance.toFixed(3)),
    avgDistance: Number(avgDistance.toFixed(3)),
    minDistance: Number(minDistance.toFixed(3)),
    boundingBox: calculateBoundingBoxFromCoordinates(validCoordinates),
    coordinateCount: validCoordinates.length
  };
}

// =====================================
// 🚀 高度な計算機能
// =====================================

/**
 * GPS精度を考慮した距離計算
 * @param coord1 座標1（精度情報付き）
 * @param coord2 座標2（精度情報付き）
 * @returns 距離と精度情報
 */
export function calculateDistanceWithAccuracy(
  coord1: Coordinates,
  coord2: Coordinates
): { distance: number; accuracyRange: { min: number; max: number } } {
  if (!hasValidCoordinates(coord1) || !hasValidCoordinates(coord2)) {
    throw new ValidationError('無効な座標オブジェクトが指定されました');
  }

  const distance = calculateDistanceBetweenCoordinates(coord1, coord2);

  // 精度情報がある場合は誤差範囲を計算
  const accuracy1 = coord1.accuracy || 0;
  const accuracy2 = coord2.accuracy || 0;
  const maxAccuracyKm = Math.max(accuracy1, accuracy2) / 1000; // メートルからキロメートルへ変換

  return {
    distance: Number(distance.toFixed(3)),
    accuracyRange: {
      min: Math.max(0, Number((distance - maxAccuracyKm).toFixed(3))),
      max: Number((distance + maxAccuracyKm).toFixed(3))
    }
  };
}

/**
 * 座標が指定エリア内にあるかチェック
 * @param coord チェック対象座標
 * @param boundingBox バウンディングボックス
 * @returns エリア内かどうか
 */
export function isCoordinateInBoundingBox(coord: Coordinates, boundingBox: BoundingBox): boolean {
  if (!hasValidCoordinates(coord)) {
    return false;
  }

  return coord.latitude >= boundingBox.southWest.latitude &&
         coord.latitude <= boundingBox.northEast.latitude &&
         coord.longitude >= boundingBox.southWest.longitude &&
         coord.longitude <= boundingBox.northEast.longitude;
}

/**
 * 最も近い座標を見つける
 * @param targetCoord 基準座標
 * @param candidates 候補座標配列
 * @returns 最も近い座標とその距離
 */
export function findClosestCoordinate(
  targetCoord: Coordinates,
  candidates: Coordinates[]
): { coordinate: Coordinates; distance: number } | null {
  if (!hasValidCoordinates(targetCoord)) {
    throw new ValidationError('無効な基準座標が指定されました');
  }

  const validCandidates = candidates.filter(coord => hasValidCoordinates(coord));

  if (validCandidates.length === 0) {
    return null;
  }

  let closestCoord = validCandidates[0]!;
  let minDistance = calculateDistanceBetweenCoordinates(targetCoord, closestCoord);

  for (let i = 1; i < validCandidates.length; i++) {
    const candidate = validCandidates[i]!;
    const distance = calculateDistanceBetweenCoordinates(targetCoord, candidate);
    if (distance < minDistance) {
      minDistance = distance;
      closestCoord = candidate;
    }
  }

  return {
    coordinate: closestCoord,
    distance: Number(minDistance.toFixed(3))
  };
}

/**
 * 最も遠い座標を見つける
 * @param targetCoord 基準座標
 * @param candidates 候補座標配列
 * @returns 最も遠い座標とその距離
 */
export function findFarthestCoordinate(
  targetCoord: Coordinates,
  candidates: Coordinates[]
): { coordinate: Coordinates; distance: number } | null {
  if (!hasValidCoordinates(targetCoord)) {
    throw new ValidationError('無効な基準座標が指定されました');
  }

  const validCandidates = candidates.filter(coord => hasValidCoordinates(coord));

  if (validCandidates.length === 0) {
    return null;
  }

  let farthestCoord = validCandidates[0]!;
  let maxDistance = calculateDistanceBetweenCoordinates(targetCoord, farthestCoord);

  for (let i = 1; i < validCandidates.length; i++) {
    const candidate = validCandidates[i]!;
    const distance = calculateDistanceBetweenCoordinates(targetCoord, candidate);
    if (distance > maxDistance) {
      maxDistance = distance;
      farthestCoord = candidate;
    }
  }

  return {
    coordinate: farthestCoord,
    distance: Number(maxDistance.toFixed(3))
  };
}

// =====================================
// 🗺️ ルート分析・最適化
// =====================================

/**
 * ルート情報を計算
 * @param coordinates ルート座標配列
 * @returns ルート計算情報
 */
export function calculateRouteInfo(coordinates: Coordinates[]): RouteCalculationInfo {
  if (coordinates.length < 2) {
    throw new ValidationError('ルート計算には最低2つの座標が必要です');
  }

  const validCoordinates = coordinates.filter(coord => hasValidCoordinates(coord));

  if (validCoordinates.length < 2) {
    throw new ValidationError('有効な座標が不足しています');
  }

  const totalDistance = calculateTotalDistance(validCoordinates);
  const boundingBox = calculateBoundingBoxFromCoordinates(validCoordinates);

  // 最初と最後の要素は存在することが保証されている
  const firstCoord = validCoordinates[0]!;
  const lastCoord = validCoordinates[validCoordinates.length - 1]!;

  // 開始点と終了点の方位角を計算
  const startBearing = validCoordinates.length > 1
    ? calculateBearing(
        firstCoord.latitude,
        firstCoord.longitude,
        validCoordinates[1]!.latitude,
        validCoordinates[1]!.longitude
      )
    : 0;

  const endBearing = validCoordinates.length > 1
    ? calculateBearing(
        validCoordinates[validCoordinates.length - 2]!.latitude,
        validCoordinates[validCoordinates.length - 2]!.longitude,
        lastCoord.latitude,
        lastCoord.longitude
      )
    : 0;

  return {
    totalDistance,
    startPoint: firstCoord,
    endPoint: lastCoord,
    waypointCount: validCoordinates.length - 2,
    boundingBox,
    startBearing,
    endBearing
  };
}

/**
 * 座標配列を最適な順序に並べ替え（最近傍法）
 * @param startCoord 開始座標
 * @param coordinates 並べ替え対象座標配列
 * @returns 最適化された座標配列
 */
export function optimizeRouteOrder(startCoord: Coordinates, coordinates: Coordinates[]): Coordinates[] {
  if (!hasValidCoordinates(startCoord)) {
    throw new ValidationError('無効な開始座標が指定されました');
  }

  const validCoordinates = coordinates.filter(coord => hasValidCoordinates(coord));

  if (validCoordinates.length === 0) {
    return [];
  }

  const result: Coordinates[] = [];
  const remaining = [...validCoordinates];
  let currentCoord = startCoord;

  while (remaining.length > 0) {
    const closest = findClosestCoordinate(currentCoord, remaining);
    if (!closest) break;

    result.push(closest.coordinate);
    const index = remaining.findIndex(
      coord => coord.latitude === closest.coordinate.latitude &&
               coord.longitude === closest.coordinate.longitude
    );

    if (index !== -1) {
      remaining.splice(index, 1);
    }

    currentCoord = closest.coordinate;
  }

  return result;
}

/**
 * 座標配列の最適ルート距離を計算
 * @param startCoord 開始座標
 * @param coordinates 経由座標配列
 * @returns 最適化されたルートの総距離
 */
export function calculateOptimizedRouteDistance(startCoord: Coordinates, coordinates: Coordinates[]): number {
  const optimizedRoute = optimizeRouteOrder(startCoord, coordinates);

  if (optimizedRoute.length === 0) {
    return 0;
  }

  const fullRoute = [startCoord, ...optimizedRoute];
  return calculateTotalDistance(fullRoute);
}

// =====================================
// 📦 統合完了確認・エクスポート
// =====================================

/**
 * ✅ utils/gpsCalculations.ts統合完了
 *
 * 【完了項目】
 * ✅ GPS座標バリデーション（緯度・経度・精度チェック）
 * ✅ 距離計算（Haversine公式による高精度計算）
 * ✅ 方位角計算・16方位/8方位/日本語方位変換
 * ✅ バウンディングボックス計算
 * ✅ 座標統計・分析（中心点・分散範囲）
 * ✅ 地点検索・フィルタリング（半径内検索・最寄り検索）
 * ✅ 精度を考慮した距離計算
 * ✅ ルート分析・最適化機能
 * ✅ findNearbyLocations関数追加（models/GpsLogModel.ts等との互換性確保）
 * ✅ TypeScriptコンパイルエラー完全修正（2025年10月6日）
 *
 * 【企業価値】
 * 💼 高精度GPS計算: Haversine公式による正確な距離・方位計算
 * 🗺️ 地点検索機能: 半径内検索・最寄り検索による効率的な地点管理
 * 📊 統計分析: 座標群の中心点・分散範囲計算による運行分析
 * 🎯 ルート最適化: 複数地点の総距離・最適順序計算
 * 🔒 堅牢性: 包括的なバリデーションによるエラー防止
 * 🔄 後方互換性: 既存コードへの影響最小化
 */

// デフォルトエクスポート（後方互換性）
const gpsCalculations = {
  // バリデーション
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  isValidCoordinate,
  hasValidCoordinates,
  isValidAccuracy,
  isValidAltitude,
  validateCoordinates,
  validateGPSCoordinates,

  // 距離計算
  calculateDistance,
  calculateDistanceBetweenCoordinates,
  calculateTotalDistance,
  calculateDistanceWithAccuracy,

  // 方位計算
  calculateBearing,
  bearingToCompass,
  bearingToCompass8,
  bearingToJapaneseCompass,

  // 地点検索
  findCoordinatesWithinRadius,
  findNearestCoordinates,
  findNearbyLocations, // ✅ 新規追加エイリアス
  findClosestCoordinate,
  findFarthestCoordinate,

  // バウンディングボックス
  calculateBoundingBox,
  calculateBoundingBoxFromCoordinates,
  isCoordinateInBoundingBox,

  // 座標統計
  calculateCenterPoint,
  calculateCoordinatesSpread,

  // ルート分析
  calculateRouteInfo,
  optimizeRouteOrder,
  calculateOptimizedRouteDistance,

  // 定数
  EARTH_RADIUS_KM,
  EARTH_RADIUS_M,
  DEG_TO_RAD,
  RAD_TO_DEG,
  GPS_CALCULATION_LIMITS
} as const;

export default gpsCalculations;
