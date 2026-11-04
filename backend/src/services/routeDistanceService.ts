// =====================================
// backend/src/services/routeDistanceService.ts
// 運行距離補完サービス（GPS欠落区間をGoogle Routes APIで推定）
// 関連資料: 運行距離補完機能_要件検討_2026-08-01.md
// 作成日: 2026-08-05
// =====================================

import { PrismaClient } from '@prisma/client';
import { DatabaseService } from '../utils/database';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import { calculateDistance } from '../utils/gpsCalculations';

type DistanceSource = 'GPS_ACTUAL' | 'GPS_PARTIAL_ESTIMATE' | 'FULL_ESTIMATE' | 'FALLBACK_STRAIGHT';

interface StopPoint {
  sequenceNumber: number;
  activityType: string;
  time: Date;
  latitude: number;
  longitude: number;
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  recordedAt: Date;
}

interface SegmentResult {
  segmentIndex: number;
  fromActivityType: string;
  toActivityType: string;
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
  distanceSource: DistanceSource;
  distanceKm: number;
  routePolyline: string | null;
  inputWaypoints: any;
  apiRequestSnapshot: any;
}

const GPS_GAP_THRESHOLD_SECONDS = 90;
const CACHE_LOOKBACK_DAYS = 30;
const CACHE_COORD_ROUND = 4;
const MAX_WAYPOINTS = 20;
const SIMPLIFY_EPSILON_METERS = 30;
const FALLBACK_STRAIGHT_FACTOR = 1.3;
const ZERO_DISTANCE_THRESHOLD_KM = 0.05;

// ✅ FIX No.23: 距離計算ログを console.log ではなく logger（logs/combined.log）に出す
const rlog = (...args: any[]): void => {
  logger.info(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
};

// ✅ FIX No.4/8（FB mSSww8VJ・ULL7kXwz）: 高速道路・有料道路を使わない経路で推定する。
//   CMS「運行設定」の route.avoid_highways / route.avoid_tolls（既定: true）で切替。
let _routeModCache: { v: { avoidHighways: boolean; avoidTolls: boolean }; exp: number } | null = null;
export async function getRouteModifiers(): Promise<{ avoidHighways: boolean; avoidTolls: boolean }> {
  if (_routeModCache && _routeModCache.exp > Date.now()) return _routeModCache.v;
  let avoidHighways = true, avoidTolls = true;
  try {
    const rows = await DatabaseService.getInstance().systemSetting.findMany({
      where: { key: { in: ['route.avoid_highways', 'route.avoid_tolls'] } }
    });
    for (const r of rows) {
      if (r.key === 'route.avoid_highways') avoidHighways = r.value !== 'false';
      if (r.key === 'route.avoid_tolls') avoidTolls = r.value !== 'false';
    }
  } catch { /* 既定値 */ }
  const v = { avoidHighways, avoidTolls };
  _routeModCache = { v, exp: Date.now() + 60_000 };
  return v;
}

/** GPS点の間隔がこの秒数を超えたら「途切れ」とみなして、その間だけ道路距離を推定する */
const GAP_FILL_MIN_STRAIGHT_KM = 0.3;   // これ未満の途切れは直線距離で十分（APIを呼ばない）
const MAX_GAP_FILL_CALLS = 10;          // 1区間あたりのRoutes API呼び出し上限

const ROUTES_API_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// =====================================
// Douglas-Peucker 経路簡略化
// =====================================

function perpendicularDistanceMeters(point: GpsPoint, lineStart: GpsPoint, lineEnd: GpsPoint): number {
  const latToM = 111320;
  const lngToM = 111320 * Math.cos((lineStart.latitude * Math.PI) / 180);

  const x = point.longitude * lngToM;
  const y = point.latitude * latToM;
  const x1 = lineStart.longitude * lngToM;
  const y1 = lineStart.latitude * latToM;
  const x2 = lineEnd.longitude * lngToM;
  const y2 = lineEnd.latitude * latToM;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  }

  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
}

function douglasPeucker(points: GpsPoint[], epsilonMeters: number): GpsPoint[] {
  if (points.length < 3) return points;

  let maxDistance = 0;
  let maxIndex = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistanceMeters(points[i]!, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > epsilonMeters) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilonMeters);
    const right = douglasPeucker(points.slice(maxIndex), epsilonMeters);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function simplifyWaypoints(points: GpsPoint[]): GpsPoint[] {
  let simplified = douglasPeucker(points, SIMPLIFY_EPSILON_METERS);

  if (simplified.length > MAX_WAYPOINTS) {
    const step = Math.ceil(simplified.length / MAX_WAYPOINTS);
    const reduced: GpsPoint[] = [];
    for (let i = 0; i < simplified.length; i += step) {
      reduced.push(simplified[i]!);
    }
    const lastOriginal = simplified[simplified.length - 1]!;
    if (reduced[reduced.length - 1] !== lastOriginal) {
      reduced.push(lastOriginal);
    }
    simplified = reduced;
  }

  return simplified;
}

// =====================================
// GPS欠落パターン判定
// =====================================

function classifyGpsAvailability(gpsPoints: GpsPoint[]): 'ACTUAL' | 'PARTIAL' | 'FULL' {
  if (gpsPoints.length === 0) return 'FULL';
  if (gpsPoints.length < 2) return 'PARTIAL';

  for (let i = 1; i < gpsPoints.length; i++) {
    const gapSeconds = (gpsPoints[i]!.recordedAt.getTime() - gpsPoints[i - 1]!.recordedAt.getTime()) / 1000;
    if (gapSeconds > GPS_GAP_THRESHOLD_SECONDS) {
      return 'PARTIAL';
    }
  }

  return 'ACTUAL';
}

// =====================================
// Google Routes API 呼び出し
// =====================================

interface RoutesApiResult {
  distanceMeters: number;
  encodedPolyline: string;
  rawResponse: any;
}

// =====================================
// Routes APIキー取得(CMS/DB暗号化保存を優先、.envへフォールバック)
// =====================================
let _routesApiKeyCache: { key: string | undefined; expiresAt: number } | null = null;
const ROUTES_API_KEY_CACHE_MS = 60 * 1000;

async function getRoutesApiKey(): Promise<string | undefined> {
  const now = Date.now();
  if (_routesApiKeyCache && _routesApiKeyCache.expiresAt > now) {
    return _routesApiKeyCache.key;
  }

  let resolvedKey: string | undefined;
  try {
    const prisma = DatabaseService.getInstance();
    const row = await (prisma as any).systemSetting.findUnique({
      where: { key: 'integration.google_routes_api_key_encrypted' }
    });
    if (row?.value) {
      const { decryptData } = await import('../utils/crypto');
      const payload = JSON.parse(row.value);
      const result = decryptData(payload);
      if (result.success && result.data) {
        resolvedKey = result.data;
      } else {
        logger.warn('Google Routes APIキーの復号に失敗しました。.envにフォールバックします', { error: result.error });
      }
    }
  } catch (error) {
    logger.warn('Google Routes APIキーのDB取得に失敗しました。.envにフォールバックします', {
      error: error instanceof Error ? error.message : error
    });
  }

  if (!resolvedKey) {
    logger.error('[GPS補完機能] Google Routes APIキーがDBに設定されていません。CMS「システム設定→連携設定」から設定してください(.envは参照しません)');
  }

  _routesApiKeyCache = { key: resolvedKey, expiresAt: now + ROUTES_API_KEY_CACHE_MS };
  return resolvedKey;
}

async function callRoutesApi(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  intermediates: { latitude: number; longitude: number }[]
): Promise<RoutesApiResult> {
  // ✅ 修正: Routes API専用キーが無ければ、既存のMaps用キー（同一GCPプロジェクトで
  //    Routes APIが有効化されていれば動作する）にフォールバックする。
  const apiKey = await getRoutesApiKey();
  rlog(`[RouteSegments] 🔑 Routes APIキー確認: ${apiKey ? `設定あり(末尾4桁=...${apiKey.slice(-4)})` : '未設定'}`);
  if (!apiKey) {
    rlog('[RouteSegments] ❌ Google Routes APIキーが未設定のため Routes API呼び出し不可');
    throw new Error('APIKEY_NOT_CONFIGURED: Google Routes APIキーが設定されていません（CMS「システム設定→連携設定」または.envのGOOGLE_ROUTES_API_KEYを設定してください）');
  }

  const requestBody = {
    origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
    destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
    intermediates: intermediates.map((p) => ({
      location: { latLng: { latitude: p.latitude, longitude: p.longitude } }
    })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    routeModifiers: await getRouteModifiers(),
    computeAlternativeRoutes: false,
    languageCode: 'ja-JP',
    units: 'METRIC'
  };

  const response = await fetch(ROUTES_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline'
    },
    body: JSON.stringify(requestBody)
  });

  const json: any = await response.json();
  rlog(`[RouteSegments] 📡 Routes APIレスポンス: HTTP ${response.status}, routes件数=${json?.routes?.length ?? 0}`);

  if (!response.ok || !json.routes || json.routes.length === 0) {
    rlog(`[RouteSegments] ❌ Routes APIエラー詳細: ${JSON.stringify(json).slice(0, 500)}`);
    const errStatus = json?.error?.status || '';
    const errMessage = json?.error?.message || '';
    const isAuthError = response.status === 400 || response.status === 401 || response.status === 403
      || errStatus === 'PERMISSION_DENIED' || errStatus === 'UNAUTHENTICATED'
      || /api key not valid|api_key_invalid/i.test(errMessage);
    logger.error('Routes API呼び出し失敗', { status: response.status, errStatus, errMessage, body: json });
    if (isAuthError) {
      throw new Error(`APIKEY_INVALID: Google Routes APIキーが無効です（認証エラー: HTTP ${response.status} ${errStatus} ${errMessage}）。CMS「システム設定→連携設定」でキーを再設定するか、Google Cloud ConsoleでのAPI有効化/IP制限設定を確認してください。`);
    }
    throw new Error(`Routes API呼び出し失敗: ${response.status} ${JSON.stringify(json).slice(0, 300)}`);
  }

  const route = json.routes[0];
  return {
    distanceMeters: route.distanceMeters,
    encodedPolyline: route.polyline?.encodedPolyline ?? '',
    rawResponse: json
  };
}

// =====================================
// キャッシュ（同一地点ペアの再利用）
// =====================================

async function findCachedSegment(
  prisma: PrismaClient,
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): Promise<{ distanceKm: number; routePolyline: string | null } | null> {
  const round = (n: number) => Number(n.toFixed(CACHE_COORD_ROUND));
  const cutoff = new Date(Date.now() - CACHE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await (prisma as any).operationRouteSegment.findMany({
    where: {
      // ✅ FIX No.4: キャッシュはGPSを全く使わない完全推定のみ。一部推定は当日のGPSで計算する
      distanceSource: 'FULL_ESTIMATE',
      computedAt: { gte: cutoff }
    },
    orderBy: { computedAt: 'desc' },
    take: 200
  });

  const mods = await getRouteModifiers();
  const match = candidates.find((seg: any) => {
    // ✅ FIX No.4: 高速回避の条件が同じもののみ再利用（高速経由で計算された過去区間を使い回さない）
    const iw = seg.inputWaypoints || {};
    if (iw.avoidHighways !== mods.avoidHighways || iw.avoidTolls !== mods.avoidTolls) return false;
    return (
      round(Number(seg.fromLatitude)) === round(from.latitude) &&
      round(Number(seg.fromLongitude)) === round(from.longitude) &&
      round(Number(seg.toLatitude)) === round(to.latitude) &&
      round(Number(seg.toLongitude)) === round(to.longitude)
    );
  });

  if (!match) return null;

  return {
    distanceKm: Number(match.distanceKm),
    routePolyline: match.routePolyline ?? null
  };
}

// =====================================
// 区間ごとの距離算出
// =====================================

async function resolveSegment(
  prisma: PrismaClient,
  segmentIndex: number,
  from: StopPoint,
  to: StopPoint,
  gpsPoints: GpsPoint[]
): Promise<SegmentResult> {
  const base = {
    segmentIndex,
    fromActivityType: from.activityType,
    toActivityType: to.activityType,
    fromLatitude: from.latitude,
    fromLongitude: from.longitude,
    toLatitude: to.latitude,
    toLongitude: to.longitude
  };

  const availability = classifyGpsAvailability(gpsPoints);
  rlog(`[RouteSegments] 🧭 区間#${segmentIndex} (${from.activityType}→${to.activityType}) GPS可用性判定: ${availability} (GPS点数=${gpsPoints.length})`);

  if (availability === 'ACTUAL') {
    let distanceKm = 0;
    for (let i = 1; i < gpsPoints.length; i++) {
      distanceKm += calculateDistance(
        gpsPoints[i - 1]!.latitude,
        gpsPoints[i - 1]!.longitude,
        gpsPoints[i]!.latitude,
        gpsPoints[i]!.longitude
      );
    }
    rlog(`[RouteSegments] ✅ 区間#${segmentIndex}: GPS実測のみで距離算出 = ${distanceKm.toFixed(3)}km（Routes API呼び出しなし）`);
    return {
      ...base,
      distanceSource: 'GPS_ACTUAL',
      distanceKm,
      routePolyline: null,
      inputWaypoints: null,
      apiRequestSnapshot: null
    };
  }

  const straightKm = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);

  // ✅ FIX No.4（FB mSSww8VJ）: GPSが一部途切れた区間は、途切れた部分だけを道路距離で補い、
  //   GPSが取れている部分は実測距離を使う。従来は1か所でも途切れると区間全体を
  //   間引いたGPS点経由のRoutes API推定に置き換えており、過大（59km→76km）になっていた。
  if (availability === 'PARTIAL') {
    const mods = await getRouteModifiers();
    const pts = [{ latitude: from.latitude, longitude: from.longitude, recordedAt: from.time } as GpsPoint, ...gpsPoints,
                 { latitude: to.latitude, longitude: to.longitude, recordedAt: to.time } as GpsPoint];
    let actualKm = 0, filledKm = 0, apiCalls = 0, fallbackGaps = 0;
    const gaps: any[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      const d = calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
      const gapSec = (new Date(b.recordedAt as any).getTime() - new Date(a.recordedAt as any).getTime()) / 1000;
      if (gapSec <= GPS_GAP_THRESHOLD_SECONDS || d < GAP_FILL_MIN_STRAIGHT_KM) { actualKm += d; continue; }
      if (apiCalls < MAX_GAP_FILL_CALLS) {
        try {
          apiCalls++;
          const r = await callRoutesApi({ latitude: a.latitude, longitude: a.longitude }, { latitude: b.latitude, longitude: b.longitude }, []);
          const km = r.distanceMeters / 1000;
          filledKm += km;
          gaps.push({ gapSec: Math.round(gapSec), straightKm: +d.toFixed(3), routeKm: +km.toFixed(3) });
          continue;
        } catch (e) {
          rlog(`[RouteSegments] ⚠️ 途切れ補完のRoutes API失敗 → 直線×${FALLBACK_STRAIGHT_FACTOR}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      fallbackGaps++;
      filledKm += d * FALLBACK_STRAIGHT_FACTOR;
      gaps.push({ gapSec: Math.round(gapSec), straightKm: +d.toFixed(3), fallbackKm: +(d * FALLBACK_STRAIGHT_FACTOR).toFixed(3) });
    }
    const totalKm = actualKm + filledKm;
    rlog(`[RouteSegments] 🧩 区間#${segmentIndex}: GPS実測=${actualKm.toFixed(3)}km + 途切れ補完=${filledKm.toFixed(3)}km（${gaps.length}か所, API=${apiCalls}回, 直線代替=${fallbackGaps}） = ${totalKm.toFixed(3)}km`);
    return {
      ...base,
      distanceSource: 'GPS_PARTIAL_ESTIMATE',
      distanceKm: totalKm,
      routePolyline: null,
      inputWaypoints: { method: 'GAP_FILL', actualKm, filledKm, gaps, ...mods },
      apiRequestSnapshot: { apiCalls, fallbackGaps }
    };
  }

  const cached = await findCachedSegment(
    prisma,
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude }
  );
  if (cached) {
    rlog(`[RouteSegments] 💾 区間#${segmentIndex}: キャッシュ済み区間を再利用 = ${cached.distanceKm.toFixed(3)}km（Routes API呼び出しなし）`);
    return {
      ...base,
      distanceSource: 'FULL_ESTIMATE',
      distanceKm: cached.distanceKm,
      routePolyline: cached.routePolyline,
      inputWaypoints: { cached: true },
      apiRequestSnapshot: { cached: true }
    };
  }

  // PARTIAL は上で処理済み。ここは GPS が全く無い区間（FULL）のみ
  const intermediates: { latitude: number; longitude: number }[] = [];

  rlog(`[RouteSegments] 🌐 区間#${segmentIndex}: Google Routes APIを呼び出します (availability=${availability}, 中間点=${intermediates.length}件)`);

  try {
    const result = await callRoutesApi(
      { latitude: from.latitude, longitude: from.longitude },
      { latitude: to.latitude, longitude: to.longitude },
      intermediates
    );

    rlog(`[RouteSegments] ✅ 区間#${segmentIndex}: Routes API成功 = ${(result.distanceMeters / 1000).toFixed(3)}km, polyline長=${result.encodedPolyline?.length ?? 0}文字`);

    return {
      ...base,
      distanceSource: 'FULL_ESTIMATE',
      distanceKm: result.distanceMeters / 1000,
      routePolyline: result.encodedPolyline,
      inputWaypoints: { origin: from, intermediates, destination: to, ...(await getRouteModifiers()) },
      apiRequestSnapshot: result.rawResponse
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    rlog(`[RouteSegments] ❌ 区間#${segmentIndex}: Routes API失敗、直線距離フォールバックへ切替 = ${(straightKm * FALLBACK_STRAIGHT_FACTOR).toFixed(3)}km / エラー: ${errMsg}`);
    if (errMsg.startsWith('APIKEY_NOT_CONFIGURED')) {
      logger.error('[GPS補完機能] Routes APIキーが未設定のため道路ルート補完が機能していません。CMS「システム設定→連携設定」からAPIキーを設定してください。', { segmentIndex });
    } else if (errMsg.startsWith('APIKEY_INVALID')) {
      logger.error('[GPS補完機能] Routes APIキーが無効(認証エラー)です。キーの値・API有効化・IP制限設定を確認してください。', { segmentIndex, detail: errMsg });
    } else {
      logger.warn('Routes API失敗、直線距離フォールバックを使用', { error: errMsg, segmentIndex });
    }
    return {
      ...base,
      distanceSource: 'FALLBACK_STRAIGHT',
      distanceKm: straightKm * FALLBACK_STRAIGHT_FACTOR,
      routePolyline: null,
      inputWaypoints: { origin: from, destination: to },
      apiRequestSnapshot: { error: errMsg }
    };
  }
}

// =====================================
// メインエントリポイント
// =====================================

export async function computeAndSaveRouteSegments(operationId: string): Promise<SegmentResult[]> {
  rlog(`[RouteSegments] ▶️▶️▶️ computeAndSaveRouteSegments 開始: operationId=${operationId}`);
  const prisma = DatabaseService.getInstance();

  if (!operationId) {
    throw new ValidationError('運行IDは必須です');
  }

  const operation = await prisma.operation.findUnique({
    where: { id: operationId },
    include: {
      // 🔧 修正: locationIdの有無で絞り込まない。積込・荷降だけでなく
      //    休憩・給油・その他すべてのイベントを区間の起点/終点候補にする。
      operationDetails: {
        orderBy: { sequenceNumber: 'asc' },
        include: { locations: true }
      }
    }
  });

  if (!operation) {
    throw new NotFoundError('指定された運行が見つかりません');
  }

  const gpsLogs = await prisma.gpsLog.findMany({
    where: { operationId },
    orderBy: { recordedAt: 'asc' },
    select: { latitude: true, longitude: true, recordedAt: true, accuracyMeters: true }
  });
  rlog(`[RouteSegments] 📍 GPSログ件数: ${gpsLogs.length}件`);

  const stops: StopPoint[] = (operation as any).operationDetails
    .map((detail: any) => {
      const lat =
        detail.latitude != null
          ? Number(detail.latitude)
          : detail.locations?.latitude != null
          ? Number(detail.locations.latitude)
          : null;
      const lng =
        detail.longitude != null
          ? Number(detail.longitude)
          : detail.locations?.longitude != null
          ? Number(detail.locations.longitude)
          : null;
      const time = detail.actualStartTime || detail.plannedTime;

      if (lat === null || lng === null || !time) return null;

      return {
        sequenceNumber: detail.sequenceNumber,
        activityType: detail.activityType,
        time: new Date(time),
        latitude: lat,
        longitude: lng
      } as StopPoint;
    })
    .filter((s: StopPoint | null): s is StopPoint => s !== null);

  // 🆕 運行開始（出庫）・運行終了（帰庫）の仮想stopを追加する。
  //    operations テーブルには出庫/帰庫地点のカラムが無いため、
  //    バックグラウンドで常時記録されているGPSログ(gps_logs)の
  //    最初/最後の1点を、それぞれ運行開始地点・運行終了地点とみなす。
  if (gpsLogs.length > 0) {
    const firstLog = gpsLogs[0]!;
    const lastLog = gpsLogs[gpsLogs.length - 1]!;
    const firstLogTime = new Date(firstLog.recordedAt as any);
    const lastLogTime = new Date(lastLog.recordedAt as any);

    const earliestStopTime = stops.length > 0 ? stops[0]!.time.getTime() : Infinity;
    const latestStopTime = stops.length > 0 ? stops[stops.length - 1]!.time.getTime() : -Infinity;

    if (firstLogTime.getTime() < earliestStopTime) {
      stops.unshift({
        sequenceNumber: -1,
        activityType: 'TRIP_START',
        time: firstLogTime,
        latitude: Number(firstLog.latitude),
        longitude: Number(firstLog.longitude),
      });
    }
    if (lastLogTime.getTime() > latestStopTime) {
      stops.push({
        sequenceNumber: 999999,
        activityType: 'TRIP_END',
        time: lastLogTime,
        latitude: Number(lastLog.latitude),
        longitude: Number(lastLog.longitude),
      });
    }
  }

  rlog(`[RouteSegments] 🛑 停車地点(stops)数: ${stops.length}`, stops.map((s: any) => `${s.activityType}@${s.time.toISOString()}`));

  if (stops.length < 2) {
    rlog(`[RouteSegments] ⚠️ 停車地点が2未満のため区間計算をスキップします (operationId=${operationId})`);
    logger.info('区間計算対象となる停車地点が不足しているためスキップ', {
      operationId,
      stopCount: stops.length
    });
    return [];
  }

  const allGpsPoints: GpsPoint[] = gpsLogs
    .filter((log: any) => !log.accuracyMeters || Number(log.accuracyMeters) <= 150)
    .map((log: any) => ({
      latitude: Number(log.latitude),
      longitude: Number(log.longitude),
      recordedAt: log.recordedAt as Date
    }));

  const results: SegmentResult[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i]!;
    const to = stops[i + 1]!;

    const straightKm = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    if (straightKm < ZERO_DISTANCE_THRESHOLD_KM) {
      results.push({
        segmentIndex: i,
        fromActivityType: from.activityType,
        toActivityType: to.activityType,
        fromLatitude: from.latitude,
        fromLongitude: from.longitude,
        toLatitude: to.latitude,
        toLongitude: to.longitude,
        distanceSource: 'GPS_ACTUAL',
        distanceKm: straightKm,
        routePolyline: null,
        inputWaypoints: null,
        apiRequestSnapshot: null
      });
      continue;
    }

    const segmentGpsPoints = allGpsPoints.filter((p) => p.recordedAt >= from.time && p.recordedAt <= to.time);

    try {
      const segment = await resolveSegment(prisma, i, from, to, segmentGpsPoints);
      results.push(segment);
    } catch (error) {
      logger.error('区間距離算出エラー', { operationId, segmentIndex: i, error });
      throw new DatabaseError('区間距離の算出に失敗しました');
    }
  }

  await (prisma as any).operationRouteSegment.deleteMany({ where: { operationId } });

  await (prisma as any).operationRouteSegment.createMany({
    data: results.map((r) => ({
      operationId,
      segmentIndex: r.segmentIndex,
      fromActivityType: r.fromActivityType,
      toActivityType: r.toActivityType,
      fromLatitude: r.fromLatitude,
      fromLongitude: r.fromLongitude,
      toLatitude: r.toLatitude,
      toLongitude: r.toLongitude,
      distanceSource: r.distanceSource,
      distanceKm: r.distanceKm,
      routePolyline: r.routePolyline,
      inputWaypoints: r.inputWaypoints,
      apiRequestSnapshot: r.apiRequestSnapshot
    }))
  });

  rlog(`[RouteSegments] 🏁 computeAndSaveRouteSegments 完了: operationId=${operationId}, 区間数=${results.length}, sources=[${results.map((r) => r.distanceSource).join(', ')}]`);
  logger.info('運行区間距離の算出・保存完了', {
    operationId,
    segmentCount: results.length,
    sources: results.map((r) => r.distanceSource)
  });

  try {
    let loadedState = false;
    let sumTotal = 0;
    let sumLoaded = 0;
    let hasActual = false;
    let hasEstimated = false;
    for (const seg of results) {
      const fromType = String((seg as any).fromActivityType).toUpperCase();
      if (fromType === 'LOADING') {
        loadedState = true;
      } else if (fromType === 'UNLOADING') {
        loadedState = false;
      }
      const km = Number(seg.distanceKm) || 0;
      sumTotal += km;
      if (loadedState) sumLoaded += km;
      if (seg.distanceSource === 'GPS_ACTUAL') {
        hasActual = true;
      } else {
        hasEstimated = true;
      }
    }
    const distanceSourceLabel = hasEstimated && hasActual ? 'MIXED' : hasEstimated ? 'ESTIMATED' : 'ACTUAL';

    const currentOperation = await prisma.operation.findUnique({
      where: { id: operationId },
      select: { totalDistanceKm: true, loadedDistanceKm: true, startOdometer: true, endOdometer: true }
    });
    // ✅ FIX No.4: メーター値（終了−開始）が入力されていれば、それを総走行距離とする。
    //   実車距離はGPS/推定の実車比率で按分する。GPS推定値は route_segment_* に別途残す。
    const odoStart = currentOperation?.startOdometer != null ? Number(currentOperation.startOdometer) : NaN;
    const odoEnd = currentOperation?.endOdometer != null ? Number(currentOperation.endOdometer) : NaN;
    const odoDiff = odoEnd - odoStart;
    const useOdometer = Number.isFinite(odoDiff) && odoDiff > 0 && odoDiff < 5000;

    // 🆕 方針転換: オドメーター入力値の有無に関係なく、
    // 常にGPS実測+Routes API推定の区間距離合計を
    // totalDistanceKm / loadedDistanceKm として採用する。
    // （テスト入力等の不正確な手入力値が「実測値」として
    // 残り続けるのを防ぐため。生のオドメーター値(startOdometer/
    // endOdometer)自体は別カラムとして残るため監査記録は失われない）
    const opUpdateData: any = {
      routeSegmentDistanceKm: sumTotal,
      routeSegmentLoadedDistanceKm: sumLoaded,
      routeSegmentDistanceSource: distanceSourceLabel,
      totalDistanceKm: useOdometer ? odoDiff : sumTotal,
      loadedDistanceKm: useOdometer
        ? (sumTotal > 0 ? Math.round(odoDiff * (sumLoaded / sumTotal) * 100) / 100 : 0)
        : sumLoaded
    };
    rlog(`[RouteSegments] 📏 総距離の採用元: ${useOdometer ? `メーター差 ${odoDiff}km` : 'GPS/推定の合計'}（GPS/推定=${sumTotal.toFixed(3)}km）`);
    const previousTotalDistanceKm = currentOperation?.totalDistanceKm ?? null;
    const previousLoadedDistanceKm = currentOperation?.loadedDistanceKm ?? null;
    await prisma.operation.update({ where: { id: operationId }, data: opUpdateData });
    rlog(`[RouteSegments] 📝 Operationへ反映(常時上書き): total=${sumTotal.toFixed(3)}km(旧値=${previousTotalDistanceKm}), loaded=${sumLoaded.toFixed(3)}km(旧値=${previousLoadedDistanceKm}), source=${distanceSourceLabel}`);
  } catch (updateErr) {
    rlog(`[RouteSegments] ⚠️ Operationへの距離反映に失敗: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`);
    logger.warn('運行距離のOperationへの反映に失敗', {
      operationId,
      error: updateErr instanceof Error ? updateErr.message : updateErr
    });
  }

  return results;
}

export async function getRouteSegments(operationId: string) {
  rlog(`[RouteSegments] 🔍 getRouteSegments 呼び出し: operationId=${operationId}`);
  const prisma = DatabaseService.getInstance();
  const segments = await (prisma as any).operationRouteSegment.findMany({
    where: { operationId },
    orderBy: { segmentIndex: 'asc' }
  });
  rlog(`[RouteSegments] 🔍 getRouteSegments 結果: ${segments.length}件, sources=[${segments.map((s: any) => s.distanceSource).join(', ')}]`);
  return segments;
}

// =====================================
// 🆕 デバウンス+直列化トリガー
// =====================================
// 積込・休憩・給油・荷降など、短時間（1秒未満）に連続してイベントが
// 発生した場合、computeAndSaveRouteSegments の delete→再作成が並行実行
// されるとレースコンディションで不整合な区間データが混入する。
// これを防ぐため、operationIdごとに:
//   1) 一定時間(DEBOUNCE_MS)デバウンスし、連続イベントの最後の1回だけを
//      実際にトリガーする
//   2) 実行中のcomputeが終わるまで次のcomputeを開始しない（直列化）
// という2段構えで防止する。

const DEBOUNCE_MS = 1500;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const runningPromises = new Map<string, Promise<void>>();
const pendingRerun = new Set<string>();

async function runSerialized(operationId: string): Promise<void> {
  if (runningPromises.has(operationId)) {
    // 既に実行中なら、完了後にもう一度だけ再実行するようマークして戻る
    pendingRerun.add(operationId);
    return;
  }

  const exec = (async () => {
    try {
      await computeAndSaveRouteSegments(operationId);
    } catch (err) {
      logger.warn('区間距離の自動再計算に失敗しました', {
        operationId,
        error: err instanceof Error ? err.message : err,
      });
    } finally {
      runningPromises.delete(operationId);
      if (pendingRerun.has(operationId)) {
        pendingRerun.delete(operationId);
        // 実行中に新たなイベントが来ていた場合、最新状態で1回だけ追いかけ実行する
        void runSerialized(operationId);
      }
    }
  })();

  runningPromises.set(operationId, exec);
  await exec;
}

/**
 * 到着イベント記録の都度呼び出す、デバウンス付き区間距離再計算トリガー。
 * fire-and-forget前提（呼び出し元でawaitしない）。
 */
export function triggerRouteSegmentRecompute(operationId: string): void {
  if (!operationId) return;

  const existing = debounceTimers.get(operationId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    debounceTimers.delete(operationId);
    void runSerialized(operationId);
  }, DEBOUNCE_MS);

  debounceTimers.set(operationId, timer);
}
