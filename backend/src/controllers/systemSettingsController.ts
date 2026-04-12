// backend/src/controllers/systemSettingsController.ts
// システム設定コントローラ（system_settings テーブルの key/value 読み書き）
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../utils/database';
import logger from '../utils/logger';

const db = DatabaseService.getInstance();

// デフォルト値定義
const DEFAULTS: Record<string, string> = {
  departure_alert_distance_m: '200',
};

/**
 * GET /api/v1/settings/system
 * システム設定を全件取得
 */
export const getSystemSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rows = await db.systemSetting.findMany();
    const result: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      if (row.value !== null) result[row.key] = row.value;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('システム設定取得エラー', { error });
    next(error);
  }
};

/**
 * PUT /api/v1/settings/system
 * システム設定を一括更新（upsert）
 * body: { key: string, value: string }[]
 */
export const updateSystemSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updates: { key: string; value: string }[] = req.body;
    if (!Array.isArray(updates)) {
      res.status(400).json({ success: false, message: 'bodyは配列で送信してください' });
      return;
    }
    for (const { key, value } of updates) {
      await db.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    logger.info('システム設定更新完了', { count: updates.length });
    res.json({ success: true, message: '設定を保存しました' });
  } catch (error) {
    logger.error('システム設定更新エラー', { error });
    next(error);
  }
};
