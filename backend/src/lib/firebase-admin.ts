// backend/src/lib/firebase-admin.ts
// Firebase Admin SDK 初期化
// 設定値はシステム設定テーブル（system_settings）から読み込む
// 優先度: DB設定 > 環境変数

import * as admin from 'firebase-admin';
import logger from '../utils/logger';

let firebaseApp: admin.app.App | null = null;

/**
 * DB経由でサービスアカウントJSONを取得
 */
async function loadServiceAccountFromDB(): Promise<{
  credential: admin.credential.Credential;
  projectId: string;
  storageBucket: string;
} | null> {
  try {
    // DBアクセスは遅延importで循環依存を回避
    const { DatabaseService } = await import('../utils/database');
    const db = DatabaseService.getInstance();

    const jsonRow = await db.systemSetting.findUnique({
      where: { key: 'integration.firebase_service_account_json' },
    });
    const bucketRow = await db.systemSetting.findUnique({
      where: { key: 'integration.firebase_storage_bucket' },
    });

    if (!jsonRow?.value) return null;

    const sa = JSON.parse(jsonRow.value);
    const credential = admin.credential.cert(sa as admin.ServiceAccount);
    const projectId = String(sa.project_id || '');
    const storageBucket = bucketRow?.value || `${projectId}.firebasestorage.app`;

    return { credential, projectId, storageBucket };
  } catch (e) {
    logger.warn('Firebase: DBからの設定読み込み失敗', { error: String(e) });
    return null;
  }
}

/**
 * 環境変数からサービスアカウントを取得（フォールバック）
 */
function loadServiceAccountFromEnv(): {
  credential: admin.credential.Credential;
  projectId: string;
  storageBucket: string;
} | null {
  const projectId = process.env['FIREBASE_PROJECT_ID'];
  if (!projectId) return null;

  const credPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  const storageBucket = process.env['FIREBASE_STORAGE_BUCKET'] || `${projectId}.firebasestorage.app`;

  try {
    if (credPath) {
      const fs = require('fs');
      if (fs.existsSync(credPath)) {
        const sa = require(credPath);
        return { credential: admin.credential.cert(sa), projectId, storageBucket };
      }
    }
    // ADC (Application Default Credentials)
    return { credential: admin.credential.applicationDefault(), projectId, storageBucket };
  } catch {
    return null;
  }
}

/**
 * Firebase Admin SDKを初期化して返す
 * 初回呼び出し時にDBまたは環境変数から設定を読み込む
 */
export async function getFirebaseAdmin(): Promise<admin.app.App> {
  if (firebaseApp) return firebaseApp;

  // 既存のアプリがあれば再利用
  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0]!;
    return firebaseApp;
  }

  // DB から設定を読み込み
  const dbConfig = await loadServiceAccountFromDB();
  if (dbConfig) {
    firebaseApp = admin.initializeApp({
      credential: dbConfig.credential,
      storageBucket: dbConfig.storageBucket,
    });
    logger.info('✅ Firebase Admin SDK 初期化完了（DBのシステム設定から）', {
      projectId: dbConfig.projectId,
    });
    return firebaseApp;
  }

  // フォールバック: 環境変数
  const envConfig = loadServiceAccountFromEnv();
  if (envConfig) {
    firebaseApp = admin.initializeApp({
      credential: envConfig.credential,
      storageBucket: envConfig.storageBucket,
    });
    logger.info('✅ Firebase Admin SDK 初期化完了（環境変数から）', {
      projectId: envConfig.projectId,
    });
    return firebaseApp;
  }

  throw new Error(
    'Firebase Admin SDK の設定が見つかりません。\n' +
    'システム設定 → 連携設定 → Firebase でサービスアカウントJSONをアップロードしてください。'
  );
}

export async function getFirestore(): Promise<admin.firestore.Firestore> {
  const app = await getFirebaseAdmin();
  return app.firestore();
}

export async function getStorage(): Promise<admin.storage.Storage> {
  const app = await getFirebaseAdmin();
  return app.storage();
}

export default { getFirebaseAdmin, getFirestore, getStorage };
