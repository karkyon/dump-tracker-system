// backend/src/config/constants.ts
import { config } from './environment';

export const APP_CONSTANTS = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_TIME: 15 * 60 * 1000,
  SESSION_TIMEOUT: 30 * 60 * 1000,
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_FILE_SIZE: config.MAX_FILE_SIZE,
  UPLOAD_PATH: config.UPLOAD_DIR,
  TEMP_PATH: config.TEMP_PATH,
  REPORT_PATH: config.REPORT_PATH,
  BACKUP_PATH: config.BACKUP_PATH,
  REPORT_RETENTION_DAYS: 90,
  API_RATE_LIMIT: config.API_RATE_LIMIT,
  
  // 型安全なファイル形式（readonlyを削除）
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  
  DB_CONNECTION_TIMEOUT: 10000,
  DB_QUERY_TIMEOUT: 30000
} as const;

// エラーメッセージ（別定義で型エラー回避）
export const ERROR_MESSAGES = {
  UNAUTHORIZED: '認証が必要です',
  FORBIDDEN: 'アクセス権限がありません',
  NOT_FOUND: 'リソースが見つかりません',
  VALIDATION_ERROR: '入力データに誤りがあります',
  INTERNAL_ERROR: 'サーバー内部エラーが発生しました',
  FILE_TOO_LARGE: 'ファイルサイズが制限を超えています',
  INVALID_FILE_TYPE: 'サポートされていないファイル形式です'
};

export default APP_CONSTANTS;
