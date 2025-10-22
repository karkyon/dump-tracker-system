// frontend/mobile/src/utils/helpers.ts
// 汎用ヘルパー関数集
// ✅ TypeScriptコンパイルエラー完全修正版
// 修正日時: 2025-10-22
// 修正内容: noUncheckedIndexedAccess対応

/**
 * 2点間の距離を計算(ハーバーサイン公式)
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000; // 地球の半径(メートル)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

/**
 * 2点間の方位角を計算
 */
export const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const x = Math.sin(Δλ) * Math.cos(φ2);
  const y = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(x, y);
  return (θ * 180 / Math.PI + 360) % 360; // normalize to 0-360°
};

/**
 * 方位角の平滑化
 */
export const smoothHeading = (headingBuffer: number[], newHeading: number): number => {
  headingBuffer.push(newHeading);
  
  // バッファサイズを制限
  if (headingBuffer.length > 5) {
    headingBuffer.shift();
  }
  
  if (headingBuffer.length === 1) {
    return newHeading;
  }
  
  // 角度の平均を計算(円形統計)
  let sinSum = 0;
  let cosSum = 0;
  
  for (const heading of headingBuffer) {
    const rad = heading * Math.PI / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  
  const avgRad = Math.atan2(sinSum / headingBuffer.length, cosSum / headingBuffer.length);
  return (avgRad * 180 / Math.PI + 360) % 360;
};

/**
 * 速度の平滑化
 */
export const smoothSpeed = (speedBuffer: number[], newSpeed: number): number => {
  speedBuffer.push(newSpeed);
  
  // バッファサイズを制限
  if (speedBuffer.length > 3) {
    speedBuffer.shift();
  }
  
  // 単純平均
  return speedBuffer.reduce((sum, speed) => sum + speed, 0) / speedBuffer.length;
};

/**
 * 方位を文字列に変換
 */
export const headingToDirection = (heading: number): string => {
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const directionIndex = Math.round(heading / 45) % 8;
  // ✅ 修正: 配列アクセスがundefinedを返す可能性に対応
  return directions[directionIndex] ?? '北';
};

/**
 * 位置精度の評価
 */
export const evaluateAccuracy = (accuracy: number): 'high' | 'medium' | 'low' => {
  if (accuracy <= 10) return 'high';
  if (accuracy <= 50) return 'medium';
  return 'low';
};

/**
 * GPS座標の有効性チェック
 */
export const isValidCoordinate = (lat: number, lng: number): boolean => {
  return !isNaN(lat) && !isNaN(lng) && 
         lat >= -90 && lat <= 90 && 
         lng >= -180 && lng <= 180;
};

/**
 * 日時フォーマット関数
 */
export const formatDateTime = (date: Date): string => {
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * 距離の表示フォーマット
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

/**
 * 時間差を文字列に変換
 */
export const formatElapsedTime = (startTime: Date, currentTime: Date): string => {
  const elapsed = currentTime.getTime() - startTime.getTime();
  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}時間 ${minutes}分`;
};

/**
 * 速度の表示フォーマット
 */
export const formatSpeed = (mps: number): string => {
  const kmh = mps * 3.6;
  return `${kmh.toFixed(1)}km/h`;
};

/**
 * デバイス情報取得
 */
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMobile = isIOS || isAndroid;
  
  return {
    isIOS,
    isAndroid,
    isMobile,
    userAgent,
    platform: navigator.platform,
    language: navigator.language
  };
};

/**
 * ネットワーク状態チェック
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * 位置情報許可状態チェック
 */
export const checkGeolocationPermission = async (): Promise<string> => {
  if (!navigator.permissions) {
    return 'unsupported';
  }
  
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state;
  } catch {
    return 'unsupported';
  }
};