// frontend/mobile/src/services/gpsBackgroundService.ts
// ✅ BUG-GPS-NAV: GPS記録途絶バグ根本修正
// 画面遷移（navigate）でuseGPSがアンマウントされてもGPS送信が継続するよう
// モジュールスコープのシングルトンとして実装する。
// Reactコンポーネントのライフサイクルから完全に独立。
//
// 責務:
//   - navigator.geolocation.watchPosition の保持
//   - setInterval による定期バックエンド送信
//   - Screen Wake Lock の保持
//   - 画面遷移をまたいだ継続的なGPS記録
//
// 使用方法:
//   startBackgroundGPS({ operationId, vehicleId }) → GPS追跡開始
//   stopBackgroundGPS()                             → GPS追跡停止（運行終了時のみ）
//   updateBackgroundGPSConfig({ operationId })      → operationId更新（運行開始後）
//   getBackgroundGPSState()                         → 現在の状態取得
//   onBackgroundPosition(callback)                  → 位置更新コールバック登録
//   offBackgroundPosition(callback)                 → コールバック解除
//
// ============================================================

import { GPS_CONFIG } from '../utils/constants';
import { logGPSEvent } from '../utils/gpsLogger';

// ============================================================
// 型定義
// ============================================================

export interface BackgroundGPSConfig {
  operationId: string;
  vehicleId?: string;
  enableHighAccuracy?: boolean;
}

export interface BackgroundGPSState {
  isTracking: boolean;
  operationId: string | null;
  vehicleId: string | null;
  lastPosition: GeolocationPosition | null;
  lastSentAt: number | null;
  errorCount: number;
}

export type PositionCallback = (position: GeolocationPosition) => void;

// ============================================================
// モジュールスコープ変数（シングルトン状態）
// ============================================================

let _watchId: number | null = null;
let _intervalId: ReturnType<typeof setInterval> | null = null;
let _wakeLock: WakeLockSentinel | null = null;
let _visibilityHandler: (() => void) | null = null;
let _sendAbortController: AbortController | null = null; // ②修正: 進行中GPS送信のキャンセル用

let _operationId: string | null = null;
let _vehicleId: string | null = null;
let _isTracking = false;
let _lastPosition: GeolocationPosition | null = null;
let _lastSentAt: number | null = null;
let _errorCount = 0;

// 位置更新コールバック（useGPSが購読する）
const _positionCallbacks = new Set<PositionCallback>();

// ============================================================
// 内部ヘルパー
// ============================================================

function _getGPSOptions(): PositionOptions {
  return {
    enableHighAccuracy: true,
    timeout: GPS_CONFIG.TIMEOUT,
    maximumAge: GPS_CONFIG.MAXIMUM_AGE,
  };
}

function _getSendIntervalMs(): number {
  return GPS_CONFIG.UPDATE_INTERVAL;
}

async function _sendToBackend(position: GeolocationPosition): Promise<void> {
  if (!_operationId) {
    console.warn('[GPS-BG] ⚠️ operationId未設定 - 送信スキップ');
    return;
  }

  // ②修正: 前回の送信が進行中なら中断してスキップ（キュー蓄積防止）
  if (_sendAbortController) {
    console.warn('[GPS-BG] ⚠️ 前回送信進行中 - スキップ');
    return;
  }

  const { latitude, longitude, accuracy, speed, heading } = position.coords;

  // Fix-4A: accuracy > 100m はスキップ
  if (accuracy > 100) {
    console.warn(`[GPS-BG] ⚠️ 精度不足スキップ: accuracy=${accuracy.toFixed(0)}m`);
    logGPSEvent({ type: 'ACCURACY_FILTER', lat: latitude, lng: longitude, accuracy,
      detail: { threshold: 100, stage: 'gpsBackgroundService' } });
    return;
  }

  _sendAbortController = new AbortController();
  try {
    // apiService を動的 import してモジュール循環参照を回避
    const { apiService } = await import('./api');
    await apiService.updateGPSLocation({
      operationId: _operationId,
      vehicleId: _vehicleId || undefined,
      latitude,
      longitude,
      accuracy,
      heading: heading ?? undefined,
      speed: speed != null ? speed * 3.6 : undefined, // m/s → km/h
      timestamp: new Date(position.timestamp).toISOString(),
    });

    _lastSentAt = Date.now();
    _errorCount = 0;

    logGPSEvent({ type: 'API_SUCCESS', lat: latitude, lng: longitude, accuracy,
      operationId: _operationId,
      detail: { source: 'gpsBackgroundService' } });

    console.log(`[GPS-BG] ✅ 送信完了: ${latitude.toFixed(6)},${longitude.toFixed(6)} acc=${accuracy.toFixed(0)}m`);

  } catch (err) {
    _errorCount++;
    // ②修正: AbortError は正常中断（バックグラウンド移行時）のためエラーカウントしない
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[GPS-BG] ⚠️ 送信中断（バックグラウンド移行）');
    } else {
      console.error(`[GPS-BG] ❌ 送信エラー(${_errorCount}回目):`, err);
      logGPSEvent({ type: 'API_ERROR', lat: latitude, lng: longitude,
        detail: { error: String(err), errorCount: _errorCount } });
    }
  } finally {
    _sendAbortController = null; // ②修正: 送信完了/失敗後にリセット
  }
}

function _handlePosition(position: GeolocationPosition): void {
  _lastPosition = position;

  // useGPS などの購読者に通知
  _positionCallbacks.forEach(cb => {
    try { cb(position); } catch (e) { console.error('[GPS-BG] callback error:', e); }
  });
}

function _handleError(err: GeolocationPositionError): void {
  _errorCount++;
  const detail = { code: err.code, message: err.message };
  console.error('[GPS-BG] ❌ watchPosition error:', detail);
  logGPSEvent({ type: 'API_ERROR', detail });
}

function _startWatch(): void {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
  _watchId = navigator.geolocation.watchPosition(
    _handlePosition,
    _handleError,
    _getGPSOptions()
  );
  console.log(`[GPS-BG] 🛰 watchPosition開始 watchId=${_watchId}`);
}

function _stopWatch(): void {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
    console.log('[GPS-BG] 🛑 watchPosition停止');
  }
}

function _startInterval(): void {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  const ms = _getSendIntervalMs();
  console.log(`[GPS-BG] ⏱ 送信インターバル開始: ${ms}ms`);
  _intervalId = setInterval(() => {
    if (_lastPosition && _isTracking) {
      _sendToBackend(_lastPosition);
    }
  }, ms);
}

function _stopInterval(): void {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
    console.log('[GPS-BG] ⏹ 送信インターバル停止');
  }
}

async function _acquireWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  try {
    _wakeLock = await (navigator as any).wakeLock.request('screen');
    console.log('[GPS-BG] 🔒 Wake Lock取得');
    if (_wakeLock) _wakeLock.addEventListener('release', () => {
      console.warn('[GPS-BG] ⚠️ Wake Lock解放');
      _wakeLock = null;
    });
  } catch (e) {
    console.warn('[GPS-BG] ⚠️ Wake Lock取得失敗:', e);
  }
}

function _releaseWakeLock(): void {
  if (_wakeLock) {
    _wakeLock.release().catch(() => {});
    _wakeLock = null;
    console.log('[GPS-BG] 🔓 Wake Lock解放');
  }
}

function _registerVisibilityHandler(): void {
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
  }
  _visibilityHandler = async () => {
    if (!_isTracking) return;

    if (document.visibilityState === 'visible') {
      console.log('[GPS-BG] 📱 フォアグラウンド復帰 → watchPosition再開');
      // ②修正: 進行中送信を中断してコントローラをリセット
      if (_sendAbortController) {
        _sendAbortController.abort();
        _sendAbortController = null;
      }
      // BUG-052修正: 復帰時は旧watchをクリアしてから再開
      _stopWatch();
      _startWatch();
      if (!_wakeLock) await _acquireWakeLock();
    } else {
      console.log('[GPS-BG] 📱 バックグラウンド移行 → 送信キューリセット');
      // ②修正: バックグラウンド移行時に進行中送信を中断
      if (_sendAbortController) {
        _sendAbortController.abort();
        _sendAbortController = null;
      }
      // ②修正: lastPositionをリセットしてインターバル送信をスキップさせる
      _lastPosition = null;
    }
  };
  document.addEventListener('visibilitychange', _visibilityHandler);
}

function _unregisterVisibilityHandler(): void {
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
    _visibilityHandler = null;
  }
}

// ============================================================
// 公開API
// ============================================================

/**
 * GPS バックグラウンド追跡を開始する。
 * 運行開始時に1回だけ呼ぶ。画面遷移しても継続する。
 */
export async function startBackgroundGPS(config: BackgroundGPSConfig): Promise<void> {
  if (_isTracking) {
    console.warn('[GPS-BG] ⚠️ すでに追跡中。updateBackgroundGPSConfig() で設定を更新してください。');
    // operationId が変わっていれば更新
    if (config.operationId !== _operationId) {
      updateBackgroundGPSConfig(config);
    }
    return;
  }

  if (!navigator.geolocation) {
    console.error('[GPS-BG] ❌ Geolocation API 非対応');
    return;
  }

  _operationId = config.operationId;
  _vehicleId = config.vehicleId ?? null;
  _isTracking = true;
  _errorCount = 0;

  console.log(`[GPS-BG] 🚀 追跡開始 operationId=${_operationId}`);
  logGPSEvent({ type: 'TRACKING_START', operationId: _operationId,
    detail: { source: 'gpsBackgroundService' } });

  _startWatch();
  _startInterval();
  await _acquireWakeLock();
  _registerVisibilityHandler();
}

/**
 * GPS バックグラウンド追跡を停止する。
 * 運行終了・ログアウト時のみ呼ぶ。画面遷移では呼ばない。
 */
export function stopBackgroundGPS(): void {
  if (!_isTracking) return;

  _isTracking = false;
  _stopWatch();
  _stopInterval();
  _releaseWakeLock();
  _unregisterVisibilityHandler();
  _lastPosition = null;
  _lastSentAt = null;

  console.log(`[GPS-BG] 🛑 追跡停止 operationId=${_operationId}`);
  logGPSEvent({ type: 'TRACKING_STOP', operationId: _operationId ?? undefined,
    detail: { source: 'gpsBackgroundService' } });

  _operationId = null;
  _vehicleId = null;
}

/**
 * operationId / vehicleId を更新する（運行開始後に確定した場合など）。
 */
export function updateBackgroundGPSConfig(config: Partial<BackgroundGPSConfig>): void {
  if (config.operationId !== undefined) _operationId = config.operationId;
  if (config.vehicleId !== undefined) _vehicleId = config.vehicleId ?? null;
  console.log(`[GPS-BG] 🔄 設定更新 operationId=${_operationId} vehicleId=${_vehicleId}`);
}

/**
 * 現在の追跡状態を返す。
 */
export function getBackgroundGPSState(): BackgroundGPSState {
  return {
    isTracking: _isTracking,
    operationId: _operationId,
    vehicleId: _vehicleId,
    lastPosition: _lastPosition,
    lastSentAt: _lastSentAt,
    errorCount: _errorCount,
  };
}

/**
 * 位置更新コールバックを登録する（useGPS が地図表示用に使用）。
 */
export function onBackgroundPosition(callback: PositionCallback): void {
  _positionCallbacks.add(callback);
}

/**
 * 位置更新コールバックを解除する。
 */
export function offBackgroundPosition(callback: PositionCallback): void {
  _positionCallbacks.delete(callback);
}
