// frontend/mobile/src/utils/gpsHelpers.ts
// GPS計算ヘルパー関数 - 距離・方位・平滑化
// ✅ TypeScriptコンパイルエラー完全修正版
// 修正日時: 2025-10-22
// 修正内容: noUncheckedIndexedAccess対応

// =============================================================================
// 定数
// =============================================================================

const EARTH_RADIUS_KM = 6371; // 地球の半径(キロメートル)
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// GPS精度閾値
export const GPS_ACCURACY = {
  HIGH: 10,      // 10m以下: 高精度
  MEDIUM: 30,    // 30m以下: 中精度
  LOW: 50,       // 50m以下: 低精度
  POOR: Infinity // 50m以上: 精度不良
};

// =============================================================================
// 距離計算
// =============================================================================

/**
 * 2点間の距離を計算(Haversine公式)
 * @param lat1 地点1の緯度
 * @param lng1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lng2 地点2の経度
 * @returns 距離(キロメートル)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) *
    Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * 簡易距離計算(高速版・短距離用)
 * @param lat1 地点1の緯度
 * @param lng1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lng2 地点2の経度
 * @returns 距離(キロメートル)
 */
export function calculateDistanceSimple(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const x = (lng2 - lng1) * Math.cos((lat1 + lat2) / 2 * DEG_TO_RAD);
  const y = lat2 - lat1;
  return Math.sqrt(x * x + y * y) * EARTH_RADIUS_KM * DEG_TO_RAD;
}

// =============================================================================
// 方位角計算
// =============================================================================

/**
 * 2点間の方位角を計算(真北を0度とする)
 * @param lat1 地点1の緯度
 * @param lng1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lng2 地点2の経度
 * @returns 方位角(0-360度)
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * RAD_TO_DEG;
  return (bearing + 360) % 360; // 0-360度に正規化
}

/**
 * 方位角を16方位文字列に変換
 * @param degrees 方位角(度)
 * @returns 方位文字列
 */
export function getDirectionText(degrees: number): string {
  const directions = [
    '北', '北北東', '北東', '東北東',
    '東', '東南東', '南東', '南南東',
    '南', '南南西', '南西', '西南西',
    '西', '西北西', '北西', '北北西'
  ];
  const index = Math.round(degrees / 22.5) % 16;
  // ✅ 修正: 配列アクセスがundefinedを返す可能性に対応
  return directions[index] ?? '北';
}

/**
 * 方位角を8方位文字列に変換
 * @param degrees 方位角(度)
 * @returns 方位文字列
 */
export function getDirection8(degrees: number): string {
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const index = Math.round(degrees / 45) % 8;
  // ✅ 修正: 配列アクセスがundefinedを返す可能性に対応
  return directions[index] ?? '北';
}

// =============================================================================
// データ平滑化
// =============================================================================

/**
 * 方位角の平滑化(円周上の平均)
 * @param headings 方位角の配列
 * @returns 平滑化された方位角
 */
export function smoothHeading(headings: number[]): number {
  if (headings.length === 0) return 0;
  // ✅ 修正: 配列の最初の要素がundefinedの可能性に対応
  if (headings.length === 1) return headings[0] ?? 0;
  
  let sumX = 0;
  let sumY = 0;
  
  headings.forEach(heading => {
    sumX += Math.cos(heading * DEG_TO_RAD);
    sumY += Math.sin(heading * DEG_TO_RAD);
  });
  
  const avgHeading = Math.atan2(sumY, sumX) * RAD_TO_DEG;
  return (avgHeading + 360) % 360;
}

/**
 * 速度の平滑化(単純移動平均)
 * @param speeds 速度の配列
 * @returns 平滑化された速度
 */
export function smoothSpeed(speeds: number[]): number {
  if (speeds.length === 0) return 0;
  const sum = speeds.reduce((acc, speed) => acc + speed, 0);
  return sum / speeds.length;
}

/**
 * 指数移動平均
 * @param currentValue 現在の値
 * @param newValue 新しい値
 * @param alpha 平滑化係数(0-1)
 * @returns 平滑化された値
 */
export function exponentialMovingAverage(
  currentValue: number,
  newValue: number,
  alpha: number = 0.3
): number {
  return alpha * newValue + (1 - alpha) * currentValue;
}

// =============================================================================
// GPS座標検証
// =============================================================================

/**
 * GPS座標の有効性チェック
 * @param lat 緯度
 * @param lng 経度
 * @returns 有効かどうか
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// =============================================================================
// GPS精度評価
// =============================================================================

/**
 * GPS精度ステータスの取得
 * @param accuracy 精度(メートル)
 * @returns 精度ステータス
 */
export function getAccuracyStatus(
  accuracy: number
): 'high' | 'medium' | 'low' | 'poor' {
  if (accuracy <= GPS_ACCURACY.HIGH) return 'high';
  if (accuracy <= GPS_ACCURACY.MEDIUM) return 'medium';
  if (accuracy <= GPS_ACCURACY.LOW) return 'low';
  return 'poor';
}

/**
 * 精度に応じた色コードを取得
 * @param accuracy 精度(メートル)
 * @returns 色コード
 */
export function getAccuracyColor(accuracy: number): string {
  const status = getAccuracyStatus(accuracy);
  const colors = {
    high: '#10b981',    // green-500
    medium: '#f59e0b',  // amber-500
    low: '#ef4444',     // red-500
    poor: '#6b7280'     // gray-500
  };
  return colors[status];
}

// =============================================================================
// 移動判定
// =============================================================================

/**
 * 移動しているかを判定
 * @param speed 速度(km/h)
 * @param threshold 閾値(km/h)
 * @returns 移動中かどうか
 */
export function isMoving(speed: number, threshold: number = 1.0): boolean {
  return speed >= threshold;
}

/**
 * 停止しているかを判定
 * @param speed 速度(km/h)
 * @param threshold 閾値(km/h)
 * @returns 停止中かどうか
 */
export function isStopped(speed: number, threshold: number = 0.5): boolean {
  return speed < threshold;
}

/**
 * km/hをm/sに変換
 * @param kmh 速度(km/h)
 * @returns 速度(m/s)
 */
export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

/**
 * m/sをkm/hに変換
 * @param ms 速度(m/s)
 * @returns 速度(km/h)
 */
export function msToKmh(ms: number): number {
  return ms * 3.6;
}

// =============================================================================
// 時間フォーマット
// =============================================================================

/**
 * 秒を時:分:秒形式に変換
 * @param seconds 秒数
 * @returns フォーマットされた文字列
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 秒を「N時間M分」形式に変換
 * @param seconds 秒数
 * @returns フォーマットされた文字列
 */
export function formatDurationJa(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  if (h > 0) {
    return `${h}時間 ${m}分`;
  }
  return `${m}分`;
}

// =============================================================================
// バウンディングボックス
// =============================================================================

/**
 * 座標配列からバウンディングボックスを計算
 * @param coordinates 座標配列
 * @returns バウンディングボックス
 */
export function calculateBounds(
  coordinates: Array<{ lat: number; lng: number }>
): {
  north: number;
  south: number;
  east: number;
  west: number;
  center: { lat: number; lng: number };
} {
  if (coordinates.length === 0) {
    return {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
      center: { lat: 0, lng: 0 }
    };
  }
  
  // ✅ 修正: 配列の最初の要素がundefinedの可能性に対応
  const firstCoord = coordinates[0];
  if (!firstCoord) {
    return {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
      center: { lat: 0, lng: 0 }
    };
  }
  
  let north = firstCoord.lat;
  let south = firstCoord.lat;
  let east = firstCoord.lng;
  let west = firstCoord.lng;
  
  coordinates.forEach(coord => {
    if (coord.lat > north) north = coord.lat;
    if (coord.lat < south) south = coord.lat;
    if (coord.lng > east) east = coord.lng;
    if (coord.lng < west) west = coord.lng;
  });
  
  return {
    north,
    south,
    east,
    west,
    center: {
      lat: (north + south) / 2,
      lng: (east + west) / 2
    }
  };
}

// =============================================================================
// デバッグ用
// =============================================================================

/**
 * GPS座標情報をコンソールに出力
 * @param position GeolocationPosition
 * @param label ラベル
 */
export function logGPSPosition(position: GeolocationPosition, label: string = 'GPS'): void {
  console.group(`[${label}] GPS Position`);
  console.log('緯度:', position.coords.latitude);
  console.log('経度:', position.coords.longitude);
  console.log('精度:', position.coords.accuracy, 'm');
  console.log('高度:', position.coords.altitude, 'm');
  console.log('速度:', position.coords.speed, 'm/s');
  console.log('方位:', position.coords.heading, '度');
  console.log('タイムスタンプ:', new Date(position.timestamp).toLocaleString('ja-JP'));
  console.groupEnd();
}

export default {
  calculateDistance,
  calculateDistanceSimple,
  calculateBearing,
  getDirectionText,
  getDirection8,
  smoothHeading,
  smoothSpeed,
  exponentialMovingAverage,
  isValidCoordinate,
  getAccuracyStatus,
  getAccuracyColor,
  isMoving,
  isStopped,
  kmhToMs,
  msToKmh,
  formatDuration,
  formatDurationJa,
  calculateBounds,
  logGPSPosition
};