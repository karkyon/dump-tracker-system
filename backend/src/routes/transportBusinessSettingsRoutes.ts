// =====================================
// backend/src/routes/transportBusinessSettingsRoutes.ts
// 貨物運送事業者情報設定ルート
// 新規作成: 2026-03-17 (P2-06)
// =====================================

import { Response, Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireManagerOrAdmin } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { DatabaseService } from '../utils/database';
import { ERROR_CODES, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { sendError, sendSuccess } from '../utils/response';

const router = Router();
const prisma = DatabaseService.getInstance();

router.use(authenticateToken());

// =====================================
// GET /settings/transport-business
// 事業者情報を取得（全体で1レコード）
// =====================================

router.get(
  '/',
  requireManagerOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);

    // 最初の1件を取得（なければ空オブジェクトを返す）
    const settings = await (prisma as any).transportBusinessSettings.findFirst();

    logger.info('事業者情報取得', { userId: req.user.userId });
    return sendSuccess(res, settings ?? {}, '事業者情報を取得しました');
  })
);

// =====================================
// PUT /settings/transport-business
// 事業者情報を保存（upsert: なければ作成、あれば更新）
// =====================================

router.put(
  '/',
  requireManagerOrAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return sendError(res, '認証が必要です', 401, ERROR_CODES.UNAUTHORIZED);

    const {
      businessNumber,
      companyName,
      address,
      representativeName,
      phoneNumber,
      submissionTarget,
      businessTypes,
    } = req.body;

    // businessTypes は最大3件
    if (businessTypes && Array.isArray(businessTypes) && businessTypes.length > 3) {
      throw new ValidationError('事業内容は3項目以内で選択してください');
    }

    // 既存レコードを取得
    const existing = await (prisma as any).transportBusinessSettings.findFirst();

    const data = {
      businessNumber:     businessNumber     ?? null,
      companyName:        companyName        ?? '',
      address:            address            ?? null,
      representativeName: representativeName ?? null,
      phoneNumber:        phoneNumber        ?? null,
      submissionTarget:   submissionTarget   ?? null,
      businessTypes:      businessTypes      ?? [],
    };

    let settings;
    if (existing) {
      settings = await (prisma as any).transportBusinessSettings.update({
        where: { id: existing.id },
        data,
      });
    } else {
      settings = await (prisma as any).transportBusinessSettings.create({ data });
    }

    logger.info('事業者情報更新', { id: settings.id, userId: req.user.userId });
    return sendSuccess(res, settings, '事業者情報を保存しました');
  })
);

export default router;
