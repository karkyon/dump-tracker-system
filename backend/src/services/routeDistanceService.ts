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

async function callRoutesApi(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  intermediates: { latitude: number; longitude: number }[]
): Promise<RoutesApiResult> {
  // ✅ 修正: Routes API専用キーが無ければ、既存のMaps用キー（同一GCPプロジェクトで
  //    Routes APIが有効化されていれば動作する）にフォールバックする。
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_ROUTES_API_KEY / GOOGLE_MAPS_API_KEY のいずれも設定されていません（.envに追加が必要）');
  }

  const requestBody = {
    origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
    destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
    intermediates: intermediates.map((p) => ({
      location: { latLng: { latitude: p.latitude, longitude: p.longitude } }
    })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
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

  if (!response.ok || !json.routes || json.routes.length === 0) {
    logger.error('Routes API呼び出し失敗', { status: response.status, body: json });
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
      distanceSource: { in: ['GPS_PARTIAL_ESTIMATE', 'FULL_ESTIMATE'] },
      computedAt: { gte: cutoff }
    },
    orderBy: { computedAt: 'desc' },
    take: 200
  });

  const match = candidates.find((seg: any) => {
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

  const cached = await findCachedSegment(
    prisma,
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude }
  );
  if (cached) {
    return {
      ...base,
      distanceSource: availability === 'PARTIAL' ? 'GPS_PARTIAL_ESTIMATE' : 'FULL_ESTIMATE',
      distanceKm: cached.distanceKm,
      routePolyline: cached.routePolyline,
      inputWaypoints: { cached: true },
      apiRequestSnapshot: { cached: true }
    };
  }

  const intermediates =
    availability === 'PARTIAL'
      ? simplifyWaypoints(gpsPoints).map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
      : [];

  try {
    const result = await callRoutesApi(
      { latitude: from.latitude, longitude: from.longitude },
      { latitude: to.latitude, longitude: to.longitude },
      intermediates
    );

    return {
      ...base,
      distanceSource: availability === 'PARTIAL' ? 'GPS_PARTIAL_ESTIMATE' : 'FULL_ESTIMATE',
      distanceKm: result.distanceMeters / 1000,
      routePolyline: result.encodedPolyline,
      inputWaypoints: { origin: from, intermediates, destination: to },
      apiRequestSnapshot: result.rawResponse
    };
  } catch (error) {
    logger.warn('Routes API失敗、直線距離フォールバックを使用', {
      error: error instanceof Error ? error.message : error,
      segmentIndex
    });
    return {
      ...base,
      distanceSource: 'FALLBACK_STRAIGHT',
      distanceKm: straightKm * FALLBACK_STRAIGHT_FACTOR,
      routePolyline: null,
      inputWaypoints: { origin: from, destination: to },
      apiRequestSnapshot: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

// =====================================
// メインエントリポイント
// =====================================

export async function computeAndSaveRouteSegments(operationId: string): Promise<SegmentResult[]> {
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

  if (stops.length < 2) {
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

  logger.info('運行区間距離の算出・保存完了', {
    operationId,
    segmentCount: results.length,
    sources: results.map((r) => r.distanceSource)
  });

  return results;
}

export async function getRouteSegments(operationId: string) {
  const prisma = DatabaseService.getInstance();
  return (prisma as any).operationRouteSegment.findMany({
    where: { operationId },
    orderBy: { segmentIndex: 'asc' }
  });
}
