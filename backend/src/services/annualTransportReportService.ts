// =====================================
// backend/src/services/annualTransportReportService.ts
// 貨物自動車運送事業実績報告書 集計サービス
// 貨物自動車運送事業報告規則 第4号様式 対応
// 新規作成: 2026-03-17 (P3-01)
// =====================================

import { TransportRegion } from '@prisma/client';
import { DatabaseService } from '../utils/database';
import logger from '../utils/logger';

const prisma = DatabaseService.getInstance();

// =====================================
// 定数
// =====================================

/** 地方運輸局 全10区分（帳票の行順） */
export const TRANSPORT_REGIONS_ORDERED: TransportRegion[] = [
  TransportRegion.HOKKAIDO,
  TransportRegion.TOHOKU,
  TransportRegion.HOKURIKU,
  TransportRegion.KANTO,
  TransportRegion.CHUBU,
  TransportRegion.KINKI,
  TransportRegion.CHUGOKU,
  TransportRegion.SHIKOKU,
  TransportRegion.KYUSHU,
  TransportRegion.OKINAWA,
];

/** 地方運輸局 日本語ラベル（帳票印字用） */
export const REGION_LABELS: Record<TransportRegion, string> = {
  HOKKAIDO: '北海道',
  TOHOKU:   '東北',
  HOKURIKU: '北陸信越',
  KANTO:    '関東',
  CHUBU:    '中部',
  KINKI:    '近畿',
  CHUGOKU:  '中国',
  SHIKOKU:  '四国',
  KYUSHU:   '九州',
  OKINAWA:  '沖縄',
};

// =====================================
// 型定義
// =====================================

/** 地域別輸送実績（帳票の1行分） */
export interface RegionTransportData {
  region:          TransportRegion;
  regionLabel:     string;
  /** 延実在車両数（日車）: 対象年度内に在籍していた車両の合計在籍日数 */
  vehicleDaysTotal:  number;
  /** 延実働車両数（日車）: 運行実績がある車両の運行日数合計 */
  vehicleDaysWorked: number;
  /** 走行キロ（km）: totalDistanceKm の合計 */
  totalDistanceKm:   number;
  /** 実車キロ（km）: loadedDistanceKm の合計 */
  loadedDistanceKm:  number;
  /** 輸送トン数 実運送（トン）: UNLOADING の quantityTons 合計 */
  transportTons:     number;
  /** 輸送トン数 利用運送（トン）: 常に 0（本システムは実運送のみ） */
  contractTons:      number;
  /** 営業収入（千円）: revenueYen 合計 ÷ 1000 */
  revenueThousandYen: number;
}

/** 全10地域合計行 */
export type TotalTransportData = Omit<RegionTransportData, 'region' | 'regionLabel'>;

/** 事業概況（帳票上部） */
export interface BusinessOverview {
  /** 事業用自動車数（報告基準日 3/31 時点） */
  vehicleCount:     number;
  /** 従業員数（ADMIN + MANAGER + DRIVER の合計） */
  employeeCount:    number;
  /** 運転者数（DRIVER ロールの人数） */
  driverCount:      number;
}

/** 事故件数（帳票下部） */
export interface AccidentSummary {
  trafficAccidents:  number;  // 交通事故件数
  seriousAccidents:  number;  // 重大事故件数
  casualties:        number;  // 死者数
  injuries:          number;  // 負傷者数
}

/** データ充足状況（フロントエンドのプレビュー表示用） */
export interface DataAvailabilityCheck {
  vehicleDays:      'ok' | 'warn' | 'error';
  totalDistance:    'ok' | 'warn' | 'error';
  loadedDistance:   'ok' | 'warn' | 'error';
  transportTons:    'ok' | 'warn' | 'error';
  revenue:          'ok' | 'warn' | 'error';
  regionAssigned:   'ok' | 'warn' | 'error';
  accidentRecords:  'ok';
  businessSettings: 'ok' | 'warn' | 'error';
  /** 管轄区域未設定の車両台数 */
  unassignedRegionCount: number;
  /** 実車キロ未入力の運行件数 */
  missingLoadedDistanceCount: number;
  /** 営業収入未入力の運行件数 */
  missingRevenueCount: number;
}

/** 帳票全体データ */
export interface AnnualTransportReportData {
  fiscalYear:       number;
  /** 対象年度の開始日（YYYY-04-01） */
  fiscalYearStart:  string;
  /** 対象年度の終了日（YYYY+1-03-31） */
  fiscalYearEnd:    string;
  overview:         BusinessOverview;
  byRegion:         RegionTransportData[];
  total:            TotalTransportData;
  accidents:        AccidentSummary;
  businessSettings: any;   // TransportBusinessSettings レコード
  availability:     DataAvailabilityCheck;
}

// =====================================
// ヘルパー関数
// =====================================

/** 年度の開始日・終了日を返す */
export function getFiscalYearRange(fiscalYear: number): { start: Date; end: Date } {
  return {
    start: new Date(`${fiscalYear}-04-01T00:00:00.000Z`),
    end:   new Date(`${fiscalYear + 1}-03-31T23:59:59.999Z`),
  };
}

/** 現在の年度を返す（4月始まり） */
export function currentFiscalYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

// =====================================
// メイン集計関数
// =====================================

/**
 * 実績報告書の全データを集計する
 * @param fiscalYear 年度（例: 2025 → 2025/4/1〜2026/3/31）
 */
export async function aggregateAnnualTransportReport(
  fiscalYear: number
): Promise<AnnualTransportReportData> {
  const { start, end } = getFiscalYearRange(fiscalYear);

  logger.info('[AnnualReport] 集計開始', { fiscalYear, start, end });

  // 並列で全データを取得
  const [
    vehicles,
    operations,
    users,
    accidentRecords,
    businessSettings,
  ] = await Promise.all([
    fetchVehicles(),
    fetchOperations(start, end),
    fetchUsers(),
    fetchAccidents(start, end),
    fetchBusinessSettings(),
  ]);

  // ① 事業概況
  const overview = buildOverview(vehicles, users);

  // ② 地域別集計
  const byRegion = buildRegionData(fiscalYear, vehicles, operations);

  // ③ 全国計
  const total = buildTotal(byRegion);

  // ④ 事故件数
  const accidents = buildAccidentSummary(accidentRecords);

  // ⑤ データ充足チェック
  const availability = buildAvailabilityCheck(
    vehicles,
    operations,
    businessSettings
  );

  logger.info('[AnnualReport] 集計完了', { fiscalYear, totalOps: operations.length });

  return {
    fiscalYear,
    fiscalYearStart: `${fiscalYear}-04-01`,
    fiscalYearEnd:   `${fiscalYear + 1}-03-31`,
    overview,
    byRegion,
    total,
    accidents,
    businessSettings,
    availability,
  };
}

// =====================================
// データ取得関数群
// =====================================

async function fetchVehicles() {
  return prisma.vehicle.findMany({
    where: { status: { not: 'RETIRED' } },
    select: {
      id: true,
      region: true,
      status: true,
      createdAt: true,
    },
  });
}

async function fetchOperations(start: Date, end: Date) {
  return prisma.operation.findMany({
    where: {
      OR: [
        { actualStartTime: { gte: start, lte: end } },
        { plannedStartTime: { gte: start, lte: end } },
      ],
      status: 'COMPLETED',
    },
    select: {
      id: true,
      vehicleId: true,
      actualStartTime: true,
      totalDistanceKm: true,
      loadedDistanceKm: true,
      revenueYen: true,
      vehicles: { select: { region: true } },
      operationDetails: {
        where: { activityType: 'UNLOADING' },
        select: { quantityTons: true },
      },
    },
  });
}

async function fetchUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true },
  });
}

async function fetchAccidents(start: Date, end: Date) {
  return (prisma as any).accidentRecord.findMany({
    where: { accidentDate: { gte: start, lte: end } },
    select: {
      accidentType: true,
      casualties: true,
      injuries: true,
    },
  });
}

async function fetchBusinessSettings() {
  return (prisma as any).transportBusinessSettings.findFirst();
}

// =====================================
// 集計ロジック
// =====================================

function buildOverview(vehicles: any[], users: any[]): BusinessOverview {
  return {
    vehicleCount:  vehicles.length,
    employeeCount: users.length,
    driverCount:   users.filter((u: any) => u.role === 'DRIVER').length,
  };
}

function buildRegionData(
  fiscalYear: number,
  vehicles: any[],
  operations: any[]
): RegionTransportData[] {
  const { start, end } = getFiscalYearRange(fiscalYear);
  const totalDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  return TRANSPORT_REGIONS_ORDERED.map(region => {
    // この地域に所属する車両
    const regionVehicles = vehicles.filter((v: any) => v.region === region);
    const regionVehicleIds = new Set(regionVehicles.map((v: any) => v.id));

    // この地域の運行（車両の region で判定）
    const regionOps = operations.filter(
      (op: any) => regionVehicleIds.has(op.vehicleId)
    );

    // 延実在車両数（日車）= 車両台数 × 年度日数（簡略計算）
    const vehicleDaysTotal = regionVehicles.length * totalDays;

    // 延実働車両数（日車）= 運行がある車両ごとの運行日数を集計
    const vehicleWorkDays = new Map<string, Set<string>>();
    regionOps.forEach((op: any) => {
      if (!op.actualStartTime) return;
      const dateStr = new Date(op.actualStartTime).toISOString().split('T')[0]!;
      if (!vehicleWorkDays.has(op.vehicleId)) {
        vehicleWorkDays.set(op.vehicleId, new Set());
      }
      vehicleWorkDays.get(op.vehicleId)!.add(dateStr);
    });
    const vehicleDaysWorked = Array.from(vehicleWorkDays.values())
      .reduce((sum, days) => sum + days.size, 0);

    // 走行キロ
    const totalDistanceKm = regionOps.reduce(
      (sum: number, op: any) =>
        sum + (op.totalDistanceKm ? Number(op.totalDistanceKm) : 0),
      0
    );

    // 実車キロ
    const loadedDistanceKm = regionOps.reduce(
      (sum: number, op: any) =>
        sum + (op.loadedDistanceKm ? Number(op.loadedDistanceKm) : 0),
      0
    );

    // 輸送トン数（UNLOADING の量）
    const transportTons = regionOps.reduce((sum: number, op: any) => {
      const opTons = (op.operationDetails ?? []).reduce(
        (s: number, d: any) => s + (d.quantityTons ? Number(d.quantityTons) : 0),
        0
      );
      return sum + opTons;
    }, 0);

    // 営業収入（千円）
    const revenueYen = regionOps.reduce(
      (sum: number, op: any) => sum + (op.revenueYen ?? 0),
      0
    );

    return {
      region,
      regionLabel:       REGION_LABELS[region],
      vehicleDaysTotal,
      vehicleDaysWorked,
      totalDistanceKm:   Math.round(totalDistanceKm),
      loadedDistanceKm:  Math.round(loadedDistanceKm),
      transportTons:     Math.round(transportTons * 10) / 10,
      contractTons:      0,
      revenueThousandYen: Math.round(revenueYen / 1000),
    };
  });
}

function buildTotal(byRegion: RegionTransportData[]): TotalTransportData {
  return {
    vehicleDaysTotal:   byRegion.reduce((s, r) => s + r.vehicleDaysTotal,   0),
    vehicleDaysWorked:  byRegion.reduce((s, r) => s + r.vehicleDaysWorked,  0),
    totalDistanceKm:    byRegion.reduce((s, r) => s + r.totalDistanceKm,    0),
    loadedDistanceKm:   byRegion.reduce((s, r) => s + r.loadedDistanceKm,   0),
    transportTons:      Math.round(byRegion.reduce((s, r) => s + r.transportTons, 0) * 10) / 10,
    contractTons:       0,
    revenueThousandYen: byRegion.reduce((s, r) => s + r.revenueThousandYen, 0),
  };
}

function buildAccidentSummary(accidentRecords: any[]): AccidentSummary {
  return {
    trafficAccidents: accidentRecords.filter((a: any) => a.accidentType === 'TRAFFIC').length,
    seriousAccidents: accidentRecords.filter((a: any) => a.accidentType === 'SERIOUS').length,
    casualties:       accidentRecords.reduce((s: number, a: any) => s + (a.casualties ?? 0), 0),
    injuries:         accidentRecords.reduce((s: number, a: any) => s + (a.injuries  ?? 0), 0),
  };
}

function buildAvailabilityCheck(
  vehicles: any[],
  operations: any[],
  businessSettings: any
): DataAvailabilityCheck {
  const unassignedRegionCount = vehicles.filter((v: any) => !v.region).length;
  const missingLoadedDistanceCount = operations.filter(
    (op: any) => op.loadedDistanceKm === null || op.loadedDistanceKm === undefined
  ).length;
  const missingRevenueCount = operations.filter(
    (op: any) => op.revenueYen === null || op.revenueYen === undefined
  ).length;

  return {
    vehicleDays:      operations.length > 0 ? 'ok' : 'warn',
    totalDistance:    operations.some((op: any) => op.totalDistanceKm) ? 'ok' : 'warn',
    loadedDistance:   missingLoadedDistanceCount === 0 ? 'ok'
                        : missingLoadedDistanceCount < operations.length ? 'warn' : 'error',
    transportTons:    operations.some((op: any) => (op.operationDetails ?? []).length > 0) ? 'ok' : 'warn',
    revenue:          missingRevenueCount === 0 ? 'ok'
                        : missingRevenueCount < operations.length ? 'warn' : 'error',
    regionAssigned:   unassignedRegionCount === 0 ? 'ok'
                        : unassignedRegionCount < vehicles.length ? 'warn' : 'error',
    accidentRecords:  'ok',
    businessSettings: businessSettings?.companyName ? 'ok' : 'warn',
    unassignedRegionCount,
    missingLoadedDistanceCount,
    missingRevenueCount,
  };
}
