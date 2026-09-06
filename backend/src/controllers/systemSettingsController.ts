// backend/src/controllers/systemSettingsController.ts
// システム設定コントローラ（system_settings テーブルの key/value 読み書き）
// 🆕 連携設定（Firebase / Backlog）エンドポイント追加
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../utils/database';
import logger from '../utils/logger';

const db = DatabaseService.getInstance();

// デフォルト値定義
const DEFAULTS: Record<string, string> = {
  departure_alert_distance_m: '200',
};

/**
 * 暗号化済みJSON文字列を復号し、末尾4桁のみ返す(CMS表示用ヒント)
 */
async function decryptLast4(encryptedJson: string | undefined): Promise<string | null> {
  if (!encryptedJson) return null;
  try {
    const { decryptData } = await import('../utils/crypto');
    const payload = JSON.parse(encryptedJson);
    const result = decryptData(payload);
    if (result.success && result.data) {
      return result.data.slice(-4);
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * GET /api/v1/settings/system
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

// =============================================
// 🆕 連携設定 API
// =============================================

/**
 * GET /api/v1/settings/system/integration
 * Firebase + Backlog 連携設定を取得（機密情報はマスク）
 */
export const getIntegrationSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rows = await db.systemSetting.findMany({
      where: { key: { startsWith: 'integration.' } },
    });
    const raw: Record<string, string> = {};
    for (const row of rows) {
      if (row.value !== null) raw[row.key] = row.value;
    }

    // Firebase サービスアカウントはマスクして返す（JSONが保存済みかどうかだけ返す）
    const firebaseConfigured = !!(raw['integration.firebase_service_account_json']);
    let firebaseProjectId = '';
    if (firebaseConfigured) {
      try {
        const sa = JSON.parse(raw['integration.firebase_service_account_json'] || '{}');
        firebaseProjectId = sa.project_id || '';
      } catch { /* ignore */ }
    }

    res.json({
      success: true,
      data: {
        firebase: {
          configured: firebaseConfigured,
          projectId: firebaseProjectId,
          storageBucket: raw['integration.firebase_storage_bucket'] || '',
        },
        googleRoutes: {
          apiKeyConfigured: !!(raw['integration.google_routes_api_key_encrypted']),
          last4: await decryptLast4(raw['integration.google_routes_api_key_encrypted']),
        },
        backlog: {
          spaceKey:   raw['integration.backlog_space_key']   || '',
          projectId:  raw['integration.backlog_project_id']  || '',
          projectKey: raw['integration.backlog_project_key'] || '',
          apiKeyConfigured: !!(raw['integration.backlog_api_key_encrypted']),
          last4: await decryptLast4(raw['integration.backlog_api_key_encrypted']),
        },
      },
    });
  } catch (error) {
    logger.error('連携設定取得エラー', { error });
    next(error);
  }
};

/**
 * PUT /api/v1/settings/system/integration/backlog
 * Backlog接続設定を保存(APIキーは暗号化してDBに保存)
 * body: { spaceKey?: string, projectId?: string, projectKey?: string, apiKey?: string }
 */
export const saveBacklogSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { spaceKey, projectId, projectKey, apiKey } = req.body as {
      spaceKey?: string; projectId?: string; projectKey?: string; apiKey?: string;
    };

    if (spaceKey !== undefined) {
      await db.systemSetting.upsert({
        where: { key: 'integration.backlog_space_key' },
        create: { key: 'integration.backlog_space_key', value: spaceKey },
        update: { value: spaceKey },
      });
    }
    if (projectId !== undefined) {
      await db.systemSetting.upsert({
        where: { key: 'integration.backlog_project_id' },
        create: { key: 'integration.backlog_project_id', value: projectId },
        update: { value: projectId },
      });
    }
    if (projectKey !== undefined) {
      await db.systemSetting.upsert({
        where: { key: 'integration.backlog_project_key' },
        create: { key: 'integration.backlog_project_key', value: projectKey },
        update: { value: projectKey },
      });
    }
    if (apiKey && apiKey.trim().length >= 10) {
      const { encryptData } = await import('../utils/crypto');
      const encrypted = encryptData(apiKey.trim());
      if (!encrypted.success || !encrypted.data) {
        res.status(500).json({ success: false, message: `暗号化に失敗しました: ${encrypted.error || '不明なエラー'}` });
        return;
      }
      await db.systemSetting.upsert({
        where: { key: 'integration.backlog_api_key_encrypted' },
        create: { key: 'integration.backlog_api_key_encrypted', value: JSON.stringify(encrypted.data) },
        update: { value: JSON.stringify(encrypted.data) },
      });
    }

    logger.info('Backlog連携設定保存完了');
    res.json({ success: true, message: 'Backlog連携設定を保存しました' });
  } catch (error) {
    logger.error('Backlog連携設定保存エラー', { error });
    next(error);
  }
};

/**
 * DELETE /api/v1/settings/system/integration/backlog
 */
export const deleteBacklogSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await db.systemSetting.deleteMany({
      where: { key: { startsWith: 'integration.backlog_' } },
    });
    logger.info('Backlog連携設定削除完了');
    res.json({ success: true, message: 'Backlog連携設定を削除しました' });
  } catch (error) {
    logger.error('Backlog連携設定削除エラー', { error });
    next(error);
  }
};

/**
 * PUT /api/v1/settings/system/integration/google-routes
 * Google Routes APIキーを暗号化してDBに保存
 * body: { apiKey: string }
 */
export const saveGoogleRoutesSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { apiKey } = req.body as { apiKey?: string };
    if (!apiKey || apiKey.trim().length < 10) {
      res.status(400).json({ success: false, message: 'apiKey は必須です（10文字以上）' });
      return;
    }

    const { encryptData } = await import('../utils/crypto');
    const encrypted = encryptData(apiKey.trim());
    if (!encrypted.success || !encrypted.data) {
      res.status(500).json({ success: false, message: `暗号化に失敗しました: ${encrypted.error || '不明なエラー'}` });
      return;
    }

    await db.systemSetting.upsert({
      where: { key: 'integration.google_routes_api_key_encrypted' },
      create: { key: 'integration.google_routes_api_key_encrypted', value: JSON.stringify(encrypted.data) },
      update: { value: JSON.stringify(encrypted.data) },
    });

    logger.info('Google Routes APIキー保存完了（暗号化済み）');
    res.json({ success: true, message: 'Google Routes APIキーを保存しました' });
  } catch (error) {
    logger.error('Google Routes APIキー保存エラー', { error });
    next(error);
  }
};

/**
 * DELETE /api/v1/settings/system/integration/google-routes
 */
export const deleteGoogleRoutesSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await db.systemSetting.deleteMany({
      where: { key: 'integration.google_routes_api_key_encrypted' },
    });
    logger.info('Google Routes APIキー削除完了');
    res.json({ success: true, message: 'Google Routes APIキー設定を削除しました' });
  } catch (error) {
    logger.error('Google Routes APIキー削除エラー', { error });
    next(error);
  }
};

/**
 * PUT /api/v1/settings/system/integration/firebase
 * Firebase サービスアカウント JSON を保存
 * body: { serviceAccountJson: string (JSON文字列), storageBucket?: string }
 */
export const saveFirebaseSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { serviceAccountJson, storageBucket } = req.body as {
      serviceAccountJson: string;
      storageBucket?: string;
    };

    if (!serviceAccountJson) {
      res.status(400).json({ success: false, message: 'serviceAccountJson は必須です' });
      return;
    }

    // JSONとして parse できるか検証
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch {
      res.status(400).json({ success: false, message: '無効なJSON形式です' });
      return;
    }

    // 必須フィールド確認
    const required = ['type', 'project_id', 'private_key', 'client_email'];
    const missing = required.filter(k => !parsed[k]);
    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        message: `サービスアカウントJSONに必須フィールドがありません: ${missing.join(', ')}`,
      });
      return;
    }

    // type チェック
    if (parsed['type'] !== 'service_account') {
      res.status(400).json({ success: false, message: 'typeが "service_account" ではありません' });
      return;
    }

    const projectId = String(parsed['project_id'] || '');
    const bucket = storageBucket || `${projectId}.firebasestorage.app`;

    // DB に保存
    await db.systemSetting.upsert({
      where: { key: 'integration.firebase_service_account_json' },
      create: { key: 'integration.firebase_service_account_json', value: serviceAccountJson },
      update: { value: serviceAccountJson },
    });
    await db.systemSetting.upsert({
      where: { key: 'integration.firebase_storage_bucket' },
      create: { key: 'integration.firebase_storage_bucket', value: bucket },
      update: { value: bucket },
    });

    logger.info('Firebase設定保存完了', { projectId, bucket });
    res.json({
      success: true,
      message: 'Firebase設定を保存しました',
      data: { projectId, storageBucket: bucket },
    });
  } catch (error) {
    logger.error('Firebase設定保存エラー', { error });
    next(error);
  }
};

/**
 * DELETE /api/v1/settings/system/integration/firebase
 * Firebase 設定を削除
 */
export const deleteFirebaseSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await db.systemSetting.deleteMany({
      where: { key: { startsWith: 'integration.firebase_' } },
    });
    logger.info('Firebase設定削除完了');
    res.json({ success: true, message: 'Firebase設定を削除しました' });
  } catch (error) {
    logger.error('Firebase設定削除エラー', { error });
    next(error);
  }
};
