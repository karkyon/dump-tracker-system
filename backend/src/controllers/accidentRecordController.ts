// =====================================
// backend/src/controllers/accidentRecordController.ts
// 事故記録管理コントローラー
// 新規作成: 2026-03-17 (P2-05)
// =====================================

import { Response } from 'express';
import { AccidentType, Prisma, TransportRegion } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';
import { DatabaseService } from '../utils/database';
import { ERROR_CODES, NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { sendError, sendSuccess } from '../utils/response';
import type { AccidentRecordFilter, AccidentRecordSummary } from '../models/AccidentRecordModel';

const prisma = DatabaseService.getInstance();

// =====================================
// ヘルパー: 年度の開始日・終了日を計算
// =====================================

function getFiscalYearRange(fiscalYear: number): { start: Date; end: Date } {
  return {
    start: new Date(`${fiscalYear}-04-01T00:00:00.000Z`),
    end:   new Date(`${fiscalYear + 1}-03-31T23:59:59.999Z`),
  };
}

function currentFiscalYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

// =====================================
// ヘルパー: サマリー集計
// =====================================

async function buildSummary(
  fiscalYear: number,
  baseWhere: Prisma.AccidentRecordWhereInput
): Promise<AccidentRecordSummary> {
  const { start, end } = getFiscalYearRange(fiscalYear);
  const dateWhere = { accidentDate: { gte: start, lte: end } };
  const where = { ...baseWhere, ...dateWhere };

  const [trafficCount, seriousCount, aggregate] = await Promise.all([
    prisma.accidentRecord.count({ where: { ...where, accidentType: AccidentType.TRAFFIC } }),
    prisma.accidentRecord.count({ where: { ...where, accidentType: AccidentType.SERIOUS } }),
    prisma.accidentRecord.aggregate({
      where,
      _sum: { casualties: true, injuries: true },
    }),
  ]);

  return {
    fiscalYear,
    trafficAccidents:  trafficCount,
    seriousAccidents:  seriousCount,
    totalCasualties:   aggregate._sum.casualties  ?? 0,
    totalInjuries:     aggregate._sum.injuries    ?? 0,
  };
}

// =====================================
// GET /accident-records
// =====================================

const getAll = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);

  const filter: AccidentRecordFilter = {
    fiscalYear:   req.query.fiscalYear   ? Number(req.query.fiscalYear)  : undefined,
    accidentType: req.query.accidentType as AccidentType | undefined,
    vehicleId:    req.query.vehicleId    as string | undefined,
    driverId:     req.query.driverId     as string | undefined,
    region:       req.query.region       as TransportRegion | undefined,
    page:         req.query.page         ? Number(req.query.page)        : 1,
    limit:        req.query.limit        ? Number(req.query.limit)       : 20,
  };

  const fiscalYear = filter.fiscalYear ?? currentFiscalYear();
  const { start, end } = getFiscalYearRange(fiscalYear);

  const where: Prisma.AccidentRecordWhereInput = {
    accidentDate: { gte: start, lte: end },
    ...(filter.accidentType && { accidentType: filter.accidentType }),
    ...(filter.vehicleId    && { vehicleId:    filter.vehicleId    }),
    ...(filter.driverId     && { driverId:     filter.driverId     }),
    ...(filter.region       && { region:       filter.region       }),
  };

  const page  = filter.page  ?? 1;
  const limit = filter.limit ?? 20;
  const skip  = (page - 1) * limit;

  const [records, total, summary] = await Promise.all([
    prisma.accidentRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { accidentDate: 'desc' },
      include: {
        vehicles: { select: { id: true, plateNumber: true, model: true } },
        users:    { select: { id: true, name: true } },
      },
    }),
    prisma.accidentRecord.count({ where }),
    buildSummary(fiscalYear, {}),
  ]);

  logger.info('事故記録一覧取得', { fiscalYear, total, userId: req.user.userId });

  return sendSuccess(res, {
    data:       records,
    total,
    page,
    pageSize:   limit,
    totalPages: Math.ceil(total / limit),
    summary,
  }, '事故記録一覧を取得しました');
});

// =====================================
// GET /accident-records/:id
// =====================================

const getById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);

  const record = await prisma.accidentRecord.findUnique({
    where: { id: req.params.id },
    include: {
      vehicles: { select: { id: true, plateNumber: true, model: true } },
      users:    { select: { id: true, name: true } },
    },
  });

  if (!record) throw new NotFoundError('事故記録が見つかりません');

  return sendSuccess(res, record, '事故記録を取得しました');
});

// =====================================
// POST /accident-records
// =====================================

const create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);

  const {
    accidentDate, accidentType, vehicleId, driverId, operationId,
    casualties, injuries, region, description,
  } = req.body;

  if (!accidentDate)  throw new ValidationError('事故発生日は必須です');
  if (!accidentType)  throw new ValidationError('事故種別は必須です');
  if (!Object.values(AccidentType).includes(accidentType)) {
    throw new ValidationError('事故種別は TRAFFIC または SERIOUS を指定してください');
  }

  const record = await prisma.accidentRecord.create({
    data: {
      accidentDate:  new Date(accidentDate),
      accidentType,
      vehicleId:     vehicleId   || null,
      driverId:      driverId    || null,
      operationId:   operationId || null,
      casualties:    casualties  ?? 0,
      injuries:      injuries    ?? 0,
      region:        region      || null,
      description:   description || null,
    },
  });

  logger.info('事故記録登録', { id: record.id, userId: req.user.userId });
  return sendSuccess(res, record, '事故記録を登録しました', 201);
});

// =====================================
// PUT /accident-records/:id
// =====================================

const update = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);

  const existing = await prisma.accidentRecord.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('事故記録が見つかりません');

  const {
    accidentDate, accidentType, vehicleId, driverId, operationId,
    casualties, injuries, region, description,
  } = req.body;

  if (accidentType && !Object.values(AccidentType).includes(accidentType)) {
    throw new ValidationError('事故種別は TRAFFIC または SERIOUS を指定してください');
  }

  const record = await prisma.accidentRecord.update({
    where: { id: req.params.id },
    data: {
      ...(accidentDate !== undefined && { accidentDate: new Date(accidentDate) }),
      ...(accidentType !== undefined && { accidentType }),
      ...(vehicleId    !== undefined && { vehicleId:   vehicleId   || null }),
      ...(driverId     !== undefined && { driverId:    driverId    || null }),
      ...(operationId  !== undefined && { operationId: operationId || null }),
      ...(casualties   !== undefined && { casualties }),
      ...(injuries     !== undefined && { injuries }),
      ...(region       !== undefined && { region:      region      || null }),
      ...(description  !== undefined && { description: description || null }),
    },
  });

  logger.info('事故記録更新', { id: record.id, userId: req.user.userId });
  return sendSuccess(res, record, '事故記録を更新しました');
});

// =====================================
// DELETE /accident-records/:id
// =====================================

const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);

  const existing = await prisma.accidentRecord.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('事故記録が見つかりません');

  await prisma.accidentRecord.delete({ where: { id: req.params.id } });

  logger.info('事故記録削除', { id: req.params.id, userId: req.user.userId });
  return sendSuccess(res, { id: req.params.id }, '事故記録を削除しました');
});

export default { getAll, getById, create, update, remove };
