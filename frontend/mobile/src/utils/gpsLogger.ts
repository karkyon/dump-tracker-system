// frontend/mobile/src/utils/gpsLogger.ts
// ✅ Log-FE-2: GPS動作検証用ログユーティリティ
// 機能:
//   1. sessionStorage にGPSイベントを蓄積
//   2. コンソールに構造化ログを出力
//   3. downloadGPSLog() でJSONダウンロード可能（デバッグ用）
//   4. GPS精度・距離・送信フローを一元管理

export type GPSLogEventType =
  | 'ACCURACY_FILTER'   // 精度不足でスキップ
  | 'GPS_SEND'          // バックエンドへ送信
  | 'DISTANCE_ADD'      // 距離加算
  | 'DISTANCE_SKIP'     // 距離スキップ（ノイズ）
  | 'TRACKING_START'    // 追跡開始
  | 'TRACKING_STOP'     // 追跡停止
  | 'API_SUCCESS'       // API送信成功
  | 'API_ERROR'         // API送信失敗
  | 'OPERATION_END';    // 運行終了送信

export interface GPSLogEvent {
  ts: string;           // ISO timestamp
  type: GPSLogEventType;
  lat?: number;
  lng?: number;
  accuracy?: number;
  speed?: number;
  distanceDeltaKm?: number;
  totalDistanceKm?: number;
  operationId?: string;
  detail?: Record<string, any>;
}

const SESSION_KEY = 'gps_debug_log';
const MAX_EVENTS = 2000;

// ----------------------------------------
// 内部ヘルパー
// ----------------------------------------
function getLog(): GPSLogEvent[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLog(log: GPSLogEvent[]): void {
  try {
    // 最大2000件を超えたら古いものを削除
    const trimmed = log.slice(-MAX_EVENTS);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(trimmed));
  } catch {
    // sessionStorage容量オーバー時は無視
  }
}

// ----------------------------------------
// 公開API
// ----------------------------------------

/** GPSイベントを記録 */
export function logGPSEvent(event: Omit<GPSLogEvent, 'ts'>): void {
  const entry: GPSLogEvent = {
    ts: new Date().toISOString(),
    ...event
  };

  // コンソール出力
  const emoji: Record<GPSLogEventType, string> = {
    ACCURACY_FILTER: '🚫',
    GPS_SEND:        '📡',
    DISTANCE_ADD:    '📏',
    DISTANCE_SKIP:   '⏭️',
    TRACKING_START:  '🟢',
    TRACKING_STOP:   '🔴',
    API_SUCCESS:     '✅',
    API_ERROR:       '❌',
    OPERATION_END:   '🏁'
  };

  const e = emoji[event.type] || '•';
  console.log(
    `${e} [GPS-LOG] ${event.type}`,
    {
      lat: entry.lat?.toFixed(6),
      lng: entry.lng?.toFixed(6),
      accuracy: entry.accuracy != null ? `${entry.accuracy.toFixed(0)}m` : undefined,
      speed: entry.speed != null ? `${entry.speed.toFixed(1)}km/h` : undefined,
      delta: entry.distanceDeltaKm != null ? `${(entry.distanceDeltaKm*1000).toFixed(1)}m` : undefined,
      total: entry.totalDistanceKm != null ? `${entry.totalDistanceKm.toFixed(3)}km` : undefined,
      ...entry.detail
    }
  );

  // sessionStorageへ蓄積
  const log = getLog();
  log.push(entry);
  saveLog(log);
}

/** 蓄積ログの取得 */
export function getGPSLog(): GPSLogEvent[] {
  return getLog();
}

/** ログをクリア */
export function clearGPSLog(): void {
  sessionStorage.removeItem(SESSION_KEY);
  console.log('🗑️ [GPS-LOG] ログをクリアしました');
}

/** ログをJSONファイルとしてダウンロード */
export function downloadGPSLog(): void {
  const log = getLog();
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gps_debug_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log(`📥 [GPS-LOG] ${log.length}件のGPSログをダウンロードしました`);
}

/** ログのサマリーをコンソール出力 */
export function printGPSSummary(): void {
  const log = getLog();
  const byType = log.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const distAdds = log.filter(e => e.type === 'DISTANCE_ADD');
  const totalDist = distAdds.reduce((s, e) => s + (e.distanceDeltaKm || 0), 0);
  const lastTotal = log.filter(e => e.totalDistanceKm != null).pop()?.totalDistanceKm ?? 0;

  console.group('📊 [GPS-LOG] セッションサマリー');
  console.table(byType);
  console.log('累積距離（加算分合計）:', `${totalDist.toFixed(3)}km`);
  console.log('最終totalDistance:', `${lastTotal.toFixed(3)}km`);
  console.log('総イベント数:', log.length);
  console.groupEnd();
}

// ブラウザグローバルに公開（devtoolsから呼び出せるように）
if (typeof window !== 'undefined') {
  (window as any).__gpsLog = {
    get: getGPSLog,
    clear: clearGPSLog,
    download: downloadGPSLog,
    summary: printGPSSummary
  };
  console.log('🛠️ [GPS-LOG] デバッグツール: window.__gpsLog.summary() / .download() / .clear()');
}
