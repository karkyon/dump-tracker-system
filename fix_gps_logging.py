#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_gps_logging.py
GPS動作検証用 詳細ログ実装スクリプト

【バックエンド】
  Log-BE-1: mobileController.ts — GPS受信・精度フィルタ・DB保存の詳細ログ強化
  Log-BE-2: tripService.ts — endTrip距離計算フロー詳細ログ追加
  Log-BE-3: 専用GPSログファイル（gps.log）をWinstonに追加

【フロントエンド mobile】
  Log-FE-1: useGPS.ts — GPS送信・精度・距離の構造化コンソールログ強化
  Log-FE-2: gpsLogger.ts — GPS専用ログユーティリティ新規作成
             （sessionStorage蓄積 + ダウンロード機能）
"""
import os, subprocess, re

REPO = os.path.expanduser("~/dump-tracker")

def r(p):
    with open(os.path.join(REPO, p), encoding='utf-8') as f: return f.read()

def w(p, c):
    os.makedirs(os.path.dirname(os.path.join(REPO, p)), exist_ok=True)
    with open(os.path.join(REPO, p), 'w', encoding='utf-8') as f: f.write(c)
    print(f"  ✅ Written: {p}")

def tsc(d, label):
    res = subprocess.run(["npx","tsc","--noEmit"],
        cwd=os.path.join(REPO,d), capture_output=True, text=True, timeout=120)
    if res.returncode==0: print(f"  ✅ {label} TSC: 0エラー"); return True
    print(f"  ❌ {label} TSC:\n{(res.stdout+res.stderr)[:3000]}"); return False

print("="*60)
print("GPS動作検証ログ実装スクリプト")
print("="*60)

# ============================================================
# Log-BE-3: Winston に gps.log 専用ファイルトランスポート追加
# ============================================================
print("\n[Log-BE-3] logger.ts — gps.log専用トランスポート追加")

logger_path = "backend/src/utils/logger.ts"
lc = r(logger_path)

OLD_WINSTON = """    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    })
  ]
});"""

NEW_WINSTON = """    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    }),
    // ✅ Log-BE-3: GPS専用ログファイル（GPSカテゴリのみ）
    new winston.transports.File({
      filename: path.join(logDir, 'gps.log'),
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.json()
      )
    })
  ]
});"""

if "gps.log" in lc:
    print("  ✅ gps.log トランスポート既存")
elif OLD_WINSTON in lc:
    lc = lc.replace(OLD_WINSTON, NEW_WINSTON, 1)
    print("  ✅ gps.log トランスポート追加")
    w(logger_path, lc)
else:
    print("  ⚠️ パターン不一致")

# ============================================================
# Log-BE-1: mobileController.ts — GPS受信詳細ログ強化
# ============================================================
print("\n[Log-BE-1] mobileController.ts — GPS受信詳細ログ強化")

mc_path = "backend/src/controllers/mobileController.ts"
mc = r(mc_path)

# logGpsPosition の先頭にリクエスト受信ログを追加
OLD_GPS_LOG_START = """      const gpsData = Array.isArray(req.body.coordinates)
        ? req.body.coordinates
        : [req.body];

      const results = await Promise.all(
        gpsData.map(async (coord: any) => {
          try {
            // ✅ Fix-1: 精度バリデーション — accuracy > 150m はDB保存スキップ"""

NEW_GPS_LOG_START = """      const gpsData = Array.isArray(req.body.coordinates)
        ? req.body.coordinates
        : [req.body];

      // ✅ Log-BE-1: GPS受信ログ（検証用）
      logger.info('🛰️ [GPS-RX] GPS受信', {
        count: gpsData.length,
        firstCoord: gpsData[0] ? {
          lat: gpsData[0].latitude,
          lng: gpsData[0].longitude,
          accuracy: gpsData[0].accuracy,
          operationId: gpsData[0].operationId || gpsData[0].tripId || null,
          vehicleId: gpsData[0].vehicleId || null,
          timestamp: gpsData[0].timestamp
        } : null,
        userId: req.user?.userId
      });

      const results = await Promise.all(
        gpsData.map(async (coord: any) => {
          try {
            // ✅ Fix-1: 精度バリデーション — accuracy > 150m はDB保存スキップ"""

if "Log-BE-1" in mc:
    print("  ✅ GPS受信ログ 既存")
elif OLD_GPS_LOG_START in mc:
    mc = mc.replace(OLD_GPS_LOG_START, NEW_GPS_LOG_START, 1)
    print("  ✅ GPS受信ログ 追加")
else:
    print("  ⚠️ パターン不一致")

# accuracy スキップ時のログを強化
OLD_ACC_SKIP = """            if (accuracyValue !== null && accuracyValue > 150) {
              logger.warn('GPS精度不足のため保存スキップ (logGpsPosition)', {
                accuracy: accuracyValue,
                lat: coord.latitude,
                lng: coord.longitude
              });
              return null;
            }"""

NEW_ACC_SKIP = """            if (accuracyValue !== null && accuracyValue > 150) {
              logger.warn('🛰️ [GPS-SKIP] 精度不足スキップ (logGpsPosition)', {
                accuracy: accuracyValue,
                threshold: 150,
                lat: coord.latitude,
                lng: coord.longitude,
                operationId: coord.operationId || coord.tripId || null,
                timestamp: coord.timestamp
              });
              return null;
            }"""

if "[GPS-SKIP]" in mc:
    print("  ✅ accuracyスキップログ 既存")
elif OLD_ACC_SKIP in mc:
    mc = mc.replace(OLD_ACC_SKIP, NEW_ACC_SKIP, 1)
    print("  ✅ accuracyスキップログ 強化")
else:
    print("  ⚠️ accuracyスキップパターン不一致")

# DB保存成功ログ追加
OLD_GPS_CREATE = """            return await this.gpsLogService.create(createData);
          } catch (error) {
            logger.error('個別GPSログ作成エラー', { error, coord });"""

NEW_GPS_CREATE = """            const saved = await this.gpsLogService.create(createData);
            // ✅ Log-BE-1: GPS保存成功ログ
            logger.debug('🛰️ [GPS-SAVE] GPS保存完了', {
              id: saved?.id,
              operationId: (createData.operations as any)?.connect?.id || null,
              lat: Number(createData.latitude),
              lng: Number(createData.longitude),
              accuracy: accuracyValue
            });
            return saved;
          } catch (error) {
            logger.error('個別GPSログ作成エラー', { error, coord });"""

if "[GPS-SAVE]" in mc:
    print("  ✅ GPS保存ログ 既存")
elif OLD_GPS_CREATE in mc:
    mc = mc.replace(OLD_GPS_CREATE, NEW_GPS_CREATE, 1)
    print("  ✅ GPS保存ログ 追加")
else:
    print("  ⚠️ GPS保存パターン不一致")

w(mc_path, mc)

# ============================================================
# Log-BE-2: tripService.ts — endTrip距離計算詳細ログ
# ============================================================
print("\n[Log-BE-2] tripService.ts — endTrip距離計算詳細ログ追加")

trip_path = "backend/src/services/tripService.ts"
tc = r(trip_path)

OLD_DIST_CALC = """      let totalDistance = 0;
      for (let i = 1; i < logsArray.length; i++) {
        const prev = logsArray[i - 1];
        const curr = logsArray[i];
        if (prev && curr && prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
          const distance = calculateDistance(
            Number(prev.latitude),
            Number(prev.longitude),
            Number(curr.latitude),
            Number(curr.longitude)
          );
          // ✅ Fix-S11-3: 10m(0.01km)未満はGPS揺れノイズとして加算しない
          // useGPS.ts側のMIN_DISTANCE_METERS=10mと同一ロジックをバックエンドにも適用
          if (distance >= 0.01) {
            totalDistance += distance;
          }
        }
      }"""

NEW_DIST_CALC = """      let totalDistance = 0;
      let skippedNoise = 0;
      let skippedCount = 0;
      for (let i = 1; i < logsArray.length; i++) {
        const prev = logsArray[i - 1];
        const curr = logsArray[i];
        if (prev && curr && prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
          const distance = calculateDistance(
            Number(prev.latitude),
            Number(prev.longitude),
            Number(curr.latitude),
            Number(curr.longitude)
          );
          // ✅ Fix-S11-3: 10m(0.01km)未満はGPS揺れノイズとして加算しない
          if (distance >= 0.01) {
            totalDistance += distance;
          } else {
            skippedNoise += distance;
            skippedCount++;
          }
        }
      }
      // ✅ Log-BE-2: GPS距離計算サマリーログ
      logger.info('🛣️ [GPS-DIST] バックエンドGPS距離計算完了', {
        operationId,
        gpsLogCount: logsArray.length,
        totalDistanceKm: totalDistance.toFixed(3),
        skippedNoiseSegments: skippedCount,
        skippedNoiseKm: skippedNoise.toFixed(4)
      });"""

if "Log-BE-2" in tc:
    print("  ✅ endTrip距離計算ログ 既存")
elif OLD_DIST_CALC in tc:
    tc = tc.replace(OLD_DIST_CALC, NEW_DIST_CALC, 1)
    print("  ✅ endTrip距離計算ログ 追加")
else:
    print("  ⚠️ パターン不一致")

# フォールバック選択ログを強化
OLD_FALLBACK_LOG = """      if (!updateData.totalDistanceKm) {
        if ((request as any).totalDistanceKm && (request as any).totalDistanceKm > 0) {
          updateData.totalDistanceKm = (request as any).totalDistanceKm;
          logger.info('✅ [endTrip] フロント計算GPS距離を適用', { totalDistanceKm: (request as any).totalDistanceKm });
        } else if (statistics.totalDistance > 0) {
          updateData.totalDistanceKm = statistics.totalDistance;
          logger.info('✅ [endTrip] バックエンドGPS再計算距離を適用', { totalDistance: statistics.totalDistance });
        }
      }"""

NEW_FALLBACK_LOG = """      if (!updateData.totalDistanceKm) {
        if ((request as any).totalDistanceKm && (request as any).totalDistanceKm > 0) {
          updateData.totalDistanceKm = (request as any).totalDistanceKm;
          logger.info('🛣️ [GPS-DIST] フロント計算GPS距離をtotalDistanceKmに採用', {
            source: 'frontend_useGPS',
            totalDistanceKm: (request as any).totalDistanceKm
          });
        } else if (statistics.totalDistance > 0) {
          updateData.totalDistanceKm = statistics.totalDistance;
          logger.info('🛣️ [GPS-DIST] バックエンドGPS再計算距離をtotalDistanceKmに採用', {
            source: 'backend_recalc',
            totalDistance: statistics.totalDistance
          });
        } else {
          logger.warn('🛣️ [GPS-DIST] ⚠️ totalDistanceKm 計算不能 — GPS記録なし・オドメーターなし', {
            operationId: tripId,
            endOdometerProvided: !!request.endOdometer,
            frontendValueProvided: !!(request as any).totalDistanceKm,
            backendCalcResult: statistics.totalDistance
          });
        }
      } else {
        logger.info('🛣️ [GPS-DIST] オドメーター差分からtotalDistanceKmを算出', {
          source: 'odometer_diff',
          totalDistanceKm: updateData.totalDistanceKm,
          endOdometer: request.endOdometer,
          startOdometer: (operation as any).startOdometer
        });
      }"""

if "[GPS-DIST] フロント計算" in tc:
    print("  ✅ フォールバック詳細ログ 既存")
elif OLD_FALLBACK_LOG in tc:
    tc = tc.replace(OLD_FALLBACK_LOG, NEW_FALLBACK_LOG, 1)
    print("  ✅ フォールバック詳細ログ 追加")
else:
    print("  ⚠️ フォールバックパターン不一致")

w(trip_path, tc)

# ============================================================
# Log-FE-2: gpsLogger.ts — GPS専用フロントログユーティリティ新規作成
# ============================================================
print("\n[Log-FE-2] gpsLogger.ts 新規作成")

GPS_LOGGER_TS = '''\
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
'''

gps_logger_path = "frontend/mobile/src/utils/gpsLogger.ts"
full_path = os.path.join(REPO, gps_logger_path)
if os.path.exists(full_path):
    print("  ✅ gpsLogger.ts 既存")
else:
    w(gps_logger_path, GPS_LOGGER_TS)

# ============================================================
# Log-FE-1: useGPS.ts — gpsLogger を呼び出すログ追加
# ============================================================
print("\n[Log-FE-1] useGPS.ts — gpsLogger 呼び出し追加")

gps_hook_path = "frontend/mobile/src/hooks/useGPS.ts"
gh = r(gps_hook_path)

# インポート追加
OLD_IMPORT = "import { apiService as mobileApi } from '../services/api';"
NEW_IMPORT = """import { apiService as mobileApi } from '../services/api';
import { logGPSEvent } from '../utils/gpsLogger'; // ✅ Log-FE-1"""

if "gpsLogger" in gh:
    print("  ✅ gpsLogger import 既存")
elif OLD_IMPORT in gh:
    gh = gh.replace(OLD_IMPORT, NEW_IMPORT, 1)
    print("  ✅ gpsLogger import 追加")
else:
    print("  ⚠️ import パターン不一致")

# Fix-4A (accuracy>100mスキップ) にログ追加
OLD_FE_SKIP = """    if (position.coords.accuracy > 100) {
      console.warn(`⚠️ [Fix-4A] GPS送信スキップ: 精度不足 accuracy=${position.coords.accuracy.toFixed(0)}m (上限:100m)`);
      return;
    }"""

NEW_FE_SKIP = """    if (position.coords.accuracy > 100) {
      console.warn(`⚠️ [Fix-4A] GPS送信スキップ: 精度不足 accuracy=${position.coords.accuracy.toFixed(0)}m (上限:100m)`);
      logGPSEvent({ type: 'ACCURACY_FILTER',
        lat: position.coords.latitude, lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        detail: { threshold: 100, stage: 'sendGPSData' }
      });
      return;
    }"""

if "ACCURACY_FILTER" in gh:
    print("  ✅ accuracyフィルターログ 既存")
elif OLD_FE_SKIP in gh:
    gh = gh.replace(OLD_FE_SKIP, NEW_FE_SKIP, 1)
    print("  ✅ accuracyフィルターログ 追加")
else:
    print("  ⚠️ accuracyフィルターパターン不一致")

# API送信成功ログ
OLD_API_SUCCESS = """      await mobileApi.updateGPSLocation(gpsData);
      console.log('✅ GPS data sent successfully');"""

NEW_API_SUCCESS = """      await mobileApi.updateGPSLocation(gpsData);
      console.log('✅ GPS data sent successfully');
      logGPSEvent({ type: 'API_SUCCESS',
        lat: position.coords.latitude, lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: metadata.speed,
        totalDistanceKm: metadata.totalDistance,
        operationId: options.operationId,
        detail: { totalDistanceKm: gpsData.totalDistanceKm }
      });"""

if "API_SUCCESS" in gh:
    print("  ✅ API送信成功ログ 既存")
elif OLD_API_SUCCESS in gh:
    gh = gh.replace(OLD_API_SUCCESS, NEW_API_SUCCESS, 1)
    print("  ✅ API送信成功ログ 追加")
else:
    print("  ⚠️ API送信成功パターン不一致")

# Fix-4B (accuracy>150mスキップ) にログ追加
OLD_FE_SKIP2 = """    if (coords.accuracy > 150) {
      console.warn(`⚠️ [Fix-4B] GPS位置更新スキップ: 精度不足 accuracy=${coords.accuracy.toFixed(0)}m (上限:150m) — この座標は記録しません`);
      return;
    }"""

NEW_FE_SKIP2 = """    if (coords.accuracy > 150) {
      console.warn(`⚠️ [Fix-4B] GPS位置更新スキップ: 精度不足 accuracy=${coords.accuracy.toFixed(0)}m (上限:150m) — この座標は記録しません`);
      logGPSEvent({ type: 'ACCURACY_FILTER',
        lat: coords.latitude, lng: coords.longitude,
        accuracy: coords.accuracy,
        detail: { threshold: 150, stage: 'handlePositionUpdate' }
      });
      return;
    }"""

if "stage: 'handlePositionUpdate'" in gh:
    print("  ✅ handlePositionUpdate accuracyログ 既存")
elif OLD_FE_SKIP2 in gh:
    gh = gh.replace(OLD_FE_SKIP2, NEW_FE_SKIP2, 1)
    print("  ✅ handlePositionUpdate accuracyログ 追加")
else:
    print("  ⚠️ handlePositionUpdate accuracyパターン不一致")

# 距離加算ログ
OLD_DIST_ADD = """      if (distance > GPS_CONFIG.MIN_DISTANCE_METERS / 1000) {
        setTotalDistance(prev => {
          const newTotal = prev + distance;
          console.log(`🛣️ 総走行距離: ${newTotal.toFixed(3)}km`);
          return newTotal;
        });"""

NEW_DIST_ADD = """      if (distance > GPS_CONFIG.MIN_DISTANCE_METERS / 1000) {
        setTotalDistance(prev => {
          const newTotal = prev + distance;
          console.log(`🛣️ 総走行距離: ${newTotal.toFixed(3)}km`);
          logGPSEvent({ type: 'DISTANCE_ADD',
            lat: newPosition.coords.latitude, lng: newPosition.coords.longitude,
            accuracy: currentAccuracy, speed: smoothedSpeed,
            distanceDeltaKm: distance, totalDistanceKm: newTotal,
            operationId: options.operationId
          });
          return newTotal;
        });"""

if "DISTANCE_ADD" in gh:
    print("  ✅ 距離加算ログ 既存")
elif OLD_DIST_ADD in gh:
    gh = gh.replace(OLD_DIST_ADD, NEW_DIST_ADD, 1)
    print("  ✅ 距離加算ログ 追加")
else:
    print("  ⚠️ 距離加算パターン不一致")

w(gps_hook_path, gh)

# ============================================================
# コンパイルチェック & Push
# ============================================================
print("\n" + "="*60)
print("コンパイルチェック")
print("="*60)

be = tsc("backend", "Backend")
mo = tsc("frontend/mobile", "Mobile")
cm = tsc("frontend/cms", "CMS")

if be and mo and cm:
    print("\n✅ 全コンパイルOK → Git Push実行")
    subprocess.run(["git","add","-A"], cwd=REPO, capture_output=True)
    rc = subprocess.run(
        ["git","commit","-m","feat: GPS verification logging - gpsLogger.ts + BE gps.log (session11)"],
        cwd=REPO, capture_output=True, text=True)
    print(f"  commit: {rc.stdout.strip()}")
    rp = subprocess.run(["git","push","origin","main"],
        cwd=REPO, capture_output=True, text=True)
    if rp.returncode==0: print("  ✅ Push完了")
    else: print(f"  ❌ Push失敗: {rp.stderr[:300]}")
else:
    print("\n❌ コンパイルエラーあり → Push中止")