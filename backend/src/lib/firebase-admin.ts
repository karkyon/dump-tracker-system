// backend/src/lib/firebase-admin.ts
// Firebase Admin SDK 初期化
// フィードバック管理: Firestore読取・更新・Storage署名URL生成

import * as admin from 'firebase-admin';
import logger from '../utils/logger';

let firebaseApp: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID が .env に設定されていません');
  }

  const credPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (credPath && require('fs').existsSync(credPath)) {
    // サービスアカウントJSONファイルがある場合
    const serviceAccount = require(credPath);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    logger.info('✅ Firebase Admin SDK 初期化完了（サービスアカウント）', { projectId });
  } else {
    // ADC (Application Default Credentials) を使用
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    logger.info('✅ Firebase Admin SDK 初期化完了（ADC）', { projectId });
  }

  return firebaseApp;
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseAdmin().firestore();
}

export function getStorage(): admin.storage.Storage {
  return getFirebaseAdmin().storage();
}

export default { getFirebaseAdmin, getFirestore, getStorage };
