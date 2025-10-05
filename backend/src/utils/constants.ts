// =====================================
// backend/src/utils/constants.ts
// アプリケーション全体で使用する定数定義 - アーキテクチャ改修対応統合完全版
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: Fri Sep 26 21:00:00 JST 2025 - Phase 1-A-9 完全アーキテクチャ改修対応
// config/constants.ts統合・重複解消・環境変数連携対応
// =====================================

// =====================================
// 型定義（アーキテクチャ指針準拠）
// =====================================

/**
 * HTTPステータスコード型
 * 型安全なHTTPステータスコードの定義
 */
export type HttpStatusCode = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];

/**
 * エラーメッセージキー型
 * エラーメッセージの型安全アクセス
 */
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

/**
 * 成功メッセージキー型
 * 成功メッセージの型安全アクセス
 */
export type SuccessMessageKey = keyof typeof SUCCESS_MESSAGES;

/**
 * ログレベル型
 * ログレベルの型安全定義
 */
export type LogLevelKey = keyof typeof LOG_LEVELS;

/**
 * ファイル形式型
 * 許可されたファイル形式の型定義
 */
export type AllowedImageType = typeof APP_CONSTANTS.ALLOWED_IMAGE_TYPES[number];
export type AllowedDocumentType = typeof APP_CONSTANTS.ALLOWED_DOCUMENT_TYPES[number];
export type AllowedFileType = AllowedImageType | AllowedDocumentType;

/**
 * アプリケーション設定型
 * 型安全なアプリケーション設定の定義
 */
export interface AppConfig {
  readonly MAX_LOGIN_ATTEMPTS: number;
  readonly LOCKOUT_TIME: number;
  readonly SESSION_TIMEOUT: number;
  readonly PASSWORD_MIN_LENGTH: number;
  readonly USERNAME_MIN_LENGTH: number;
  readonly DEFAULT_PAGE_SIZE: number;
  readonly MAX_PAGE_SIZE: number;
  readonly MAX_FILE_SIZE: number;
  readonly UPLOAD_PATH: string;
  readonly TEMP_PATH: string;
  readonly REPORT_PATH: string;
  readonly BACKUP_PATH: string;
  readonly REPORT_RETENTION_DAYS: number;
  readonly API_RATE_LIMIT: number;
  readonly ALLOWED_IMAGE_TYPES: readonly string[];
  readonly ALLOWED_DOCUMENT_TYPES: readonly string[];
  readonly DB_CONNECTION_TIMEOUT: number;
  readonly DB_QUERY_TIMEOUT: number;
}

// =====================================
// 環境変数取得ユーティリティ（config統合）
// =====================================

/**
 * 環境変数の安全な取得
 * config/constants.tsの機能を統合
 */
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    console.warn(`Environment variable ${key} is not set, using fallback`);
    return '';
  }
  return value || defaultValue || '';
};

/**
 * 数値型環境変数の安全な取得
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * パスの安全な構築
 * 相対パスと絶対パスの両方に対応
 */
const resolvePath = (pathStr: string): string => {
  if (!pathStr) return './data';

  // 絶対パスの場合はそのまま返す
  if (pathStr.startsWith('/') || /^[A-Za-z]:/.test(pathStr)) {
    return pathStr;
  }

  // 相対パスの場合はプロジェクトルートからの相対パスとして解釈
  return pathStr.startsWith('./') ? pathStr : `./${pathStr}`;
};

// =====================================
// HTTPステータスコード（既存実装保持）
// =====================================

/**
 * HTTPステータスコード定数
 * RESTful API開発で使用される標準HTTPステータスコード
 */
export const HTTP_STATUS = {
  // 成功レスポンス (2xx)
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // リダイレクト (3xx)
  NOT_MODIFIED: 304,

  // クライアントエラー (4xx)
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // サーバーエラー (5xx)
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

// =====================================
// エラーメッセージ（統合版）
// =====================================

/**
 * エラーメッセージ定数
 * utils版とconfig版を統合し、重複を解消
 */
export const ERROR_MESSAGES = {
  // ネットワーク・接続関連
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  CONNECTION_FAILED: '接続に失敗しました',
  TIMEOUT_ERROR: 'タイムアウトが発生しました',

  // 認証・認可関連（統合版）
  AUTH_FAILED: '認証に失敗しました',
  UNAUTHORIZED: '認証が必要です',
  ACCESS_DENIED: 'アクセスが拒否されました',
  FORBIDDEN: 'アクセス権限がありません',
  INVALID_CREDENTIALS: 'ユーザー名またはパスワードが正しくありません',
  TOKEN_EXPIRED: 'トークンの有効期限が切れています',
  TOKEN_INVALID: 'トークンが無効です',
  ACCOUNT_INACTIVE: 'アカウントが無効です',
  INSUFFICIENT_PERMISSIONS: '権限が不足しています',

  // データ・リソース関連（統合版）
  NOT_FOUND: 'データが見つかりません',
  RESOURCE_NOT_FOUND: 'リソースが見つかりません',
  DUPLICATE_ENTRY: '重複するデータが存在します',
  DATA_CONFLICT: 'データの競合が発生しました',

  // バリデーション関連（統合版）
  VALIDATION_ERROR: '入力内容に誤りがあります',
  REQUIRED_FIELD_MISSING: '必須項目が入力されていません',
  INVALID_FORMAT: '入力形式が正しくありません',
  VALUE_OUT_OF_RANGE: '入力値が範囲外です',
  INVALID_ENUM_VALUE: '無効な選択値です',

  // ファイル関連（統合版）
  INVALID_FILE_TYPE: 'サポートされていないファイル形式です',
  FILE_TOO_LARGE: 'ファイルサイズが制限を超えています',
  FILE_UPLOAD_FAILED: 'ファイルのアップロードに失敗しました',
  FILE_NOT_FOUND: 'ファイルが見つかりません',
  FILE_PROCESSING_ERROR: 'ファイルの処理中にエラーが発生しました',

  // サーバー・システム関連（統合版）
  SERVER_ERROR: 'サーバーエラーが発生しました',
  INTERNAL_ERROR: 'サーバー内部エラーが発生しました',
  DATABASE_ERROR: 'データベースエラーが発生しました',
  EXTERNAL_SERVICE_ERROR: '外部サービスとの通信でエラーが発生しました',
  CONFIGURATION_ERROR: '設定エラーが発生しました',

  // レート制限関連
  RATE_LIMIT_EXCEEDED: 'リクエスト制限を超えました',
  TOO_MANY_REQUESTS: 'リクエストが多すぎます。しばらく時間をおいてから再度お試しください',

  // 業務固有エラー
  OPERATION_NOT_ALLOWED: 'この操作は許可されていません',
  INVALID_STATE_TRANSITION: '無効な状態遷移です',
  BUSINESS_RULE_VIOLATION: 'ビジネスルールに違反しています'
} as const;

// =====================================
// 成功メッセージ（既存実装保持＋拡張）
// =====================================

/**
 * 成功メッセージ定数
 * 各種操作の成功時に使用するメッセージ
 */
export const SUCCESS_MESSAGES = {
  // 認証関連
  LOGIN_SUCCESS: 'ログインしました',
  LOGOUT_SUCCESS: 'ログアウトしました',
  PASSWORD_CHANGED: 'パスワードが変更されました',
  ACCOUNT_ACTIVATED: 'アカウントが有効化されました',

  // CRUD操作
  CREATED: '正常に作成されました',
  UPDATED: '正常に更新されました',
  DELETED: '正常に削除されました',
  SAVED: '正常に保存されました',

  // ファイル操作
  FILE_UPLOADED: 'ファイルがアップロードされました',
  FILE_DOWNLOADED: 'ファイルがダウンロードされました',
  FILE_DELETED: 'ファイルが削除されました',

  // データ処理
  DATA_IMPORTED: 'データがインポートされました',
  DATA_EXPORTED: 'データがエクスポートされました',
  REPORT_GENERATED: 'レポートが生成されました',

  // システム操作
  SETTINGS_UPDATED: '設定が更新されました',
  BACKUP_COMPLETED: 'バックアップが完了しました',
  MAINTENANCE_COMPLETED: 'メンテナンスが完了しました'
} as const;

// =====================================
// アプリケーション定数（統合版）
// =====================================

/**
 * アプリケーション定数
 * utils版とconfig版を統合し、環境変数連携機能を追加
 */
export const APP_CONSTANTS: AppConfig = {
  // 認証・セキュリティ設定
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_TIME: 15 * 60 * 1000, // 15分
  SESSION_TIMEOUT: getEnvNumber('SESSION_TIMEOUT', 24 * 60 * 60 * 1000), // 24時間（デフォルト）
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,

  // ページネーション設定
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // ファイル・アップロード設定（config統合）
  MAX_FILE_SIZE: getEnvNumber('MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB（デフォルト）
  UPLOAD_PATH: resolvePath(getEnvVar('UPLOAD_DIR', './uploads')),
  TEMP_PATH: resolvePath(getEnvVar('TEMP_PATH', './temp')),
  REPORT_PATH: resolvePath(getEnvVar('REPORT_PATH', './reports')),
  BACKUP_PATH: resolvePath(getEnvVar('BACKUP_PATH', './backups')),
  REPORT_RETENTION_DAYS: getEnvNumber('REPORT_RETENTION_DAYS', 90),

  // API制限設定
  API_RATE_LIMIT: getEnvNumber('API_RATE_LIMIT', 100),

  // 許可ファイル形式（config統合）
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml'
  ] as const,

  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ] as const,

  // データベース設定（config統合）
  DB_CONNECTION_TIMEOUT: getEnvNumber('DB_CONNECTION_TIMEOUT', 10000),
  DB_QUERY_TIMEOUT: getEnvNumber('DB_QUERY_TIMEOUT', 30000)
} as const;

// =====================================
// ログレベル（既存実装保持＋拡張）
// =====================================

/**
 * ログレベル定数
 * logger.tsとの整合性を保持
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  DEBUG: 'debug'
} as const;

// =====================================
// 業務固有定数
// =====================================

/**
 * 車両管理関連定数
 * ダンプトラッカー固有の業務定数
 */
export const VEHICLE_CONSTANTS = {
  // 車両タイプ
  VEHICLE_TYPES: {
    DUMP_TRUCK: 'dump_truck',
    MIXER_TRUCK: 'mixer_truck',
    TRAILER: 'trailer',
    OTHER: 'other'
  },

  // 車両ステータス
  VEHICLE_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    MAINTENANCE: 'maintenance',
    RETIRED: 'retired'
  },

  // 点検タイプ
  INSPECTION_TYPES: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    ANNUAL: 'annual'
  },

  // 点検ステータス
  INSPECTION_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },

  // 運行ステータス
  OPERATION_STATUS: {
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  }
} as const;

/**
 * GPS・位置情報関連定数
 */
export const GPS_CONSTANTS = {
  // GPS精度設定
  DEFAULT_ACCURACY_THRESHOLD: 10, // メートル
  HIGH_ACCURACY_THRESHOLD: 5,     // メートル

  // 位置更新間隔
  POSITION_UPDATE_INTERVAL: 30000, // 30秒
  HIGH_FREQUENCY_INTERVAL: 10000,  // 10秒

  // 地図関連
  DEFAULT_ZOOM_LEVEL: 13,
  MIN_ZOOM_LEVEL: 8,
  MAX_ZOOM_LEVEL: 18,

  // 距離計算設定
  EARTH_RADIUS_KM: 6371,
  NEARBY_THRESHOLD_KM: 1,     // 1km以内を近隣とみなす
  GEOFENCE_RADIUS_M: 500      // ジオフェンス半径（メートル）
} as const;

/**
 * 通知関連定数
 */
export const NOTIFICATION_CONSTANTS = {
  // 通知タイプ
  TYPES: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    SUCCESS: 'success'
  },

  // 通知優先度
  PRIORITY: {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent'
  },

  // 通知期限設定
  DEFAULT_RETENTION_DAYS: 30,
  URGENT_RETENTION_DAYS: 90
} as const;

// =====================================
// ユーティリティ関数
// =====================================

/**
 * HTTPステータスコードの検証
 */
export const isValidHttpStatus = (status: number): status is HttpStatusCode => {
  return Object.values(HTTP_STATUS).includes(status as HttpStatusCode);
};

/**
 * ファイル形式の検証
 */
export const isAllowedImageType = (mimeType: string): mimeType is AllowedImageType => {
  return APP_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(mimeType as AllowedImageType);
};

export const isAllowedDocumentType = (mimeType: string): mimeType is AllowedDocumentType => {
  return APP_CONSTANTS.ALLOWED_DOCUMENT_TYPES.includes(mimeType as AllowedDocumentType);
};

export const isAllowedFileType = (mimeType: string): mimeType is AllowedFileType => {
  return isAllowedImageType(mimeType) || isAllowedDocumentType(mimeType);
};

/**
 * ファイルサイズの検証
 */
export const isValidFileSize = (size: number): boolean => {
  return size > 0 && size <= APP_CONSTANTS.MAX_FILE_SIZE;
};

/**
 * ページネーションパラメータの正規化
 */
export const normalizePaginationParams = (
  page?: number | string,
  limit?: number | string
): { page: number; limit: number } => {
  const normalizedPage = Math.max(1, parseInt(String(page)) || 1);
  const normalizedLimit = Math.min(
    APP_CONSTANTS.MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(limit)) || APP_CONSTANTS.DEFAULT_PAGE_SIZE)
  );

  return { page: normalizedPage, limit: normalizedLimit };
};

/**
 * 環境設定の健全性チェック
 */
export const validateConfiguration = (): {
  isValid: boolean;
  errors: string[]
} => {
  const errors: string[] = [];

  // ファイルサイズ制限チェック
  if (APP_CONSTANTS.MAX_FILE_SIZE <= 0) {
    errors.push('MAX_FILE_SIZE must be greater than 0');
  }

  // パスの存在チェック（相対パスの場合はスキップ）
  if (!APP_CONSTANTS.UPLOAD_PATH) {
    errors.push('UPLOAD_PATH is required');
  }

  // API制限値チェック
  if (APP_CONSTANTS.API_RATE_LIMIT <= 0) {
    errors.push('API_RATE_LIMIT must be greater than 0');
  }

  // セッションタイムアウトチェック
  if (APP_CONSTANTS.SESSION_TIMEOUT <= 0) {
    errors.push('SESSION_TIMEOUT must be greater than 0');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// =====================================
// デフォルトエクスポート（後方互換性）
// =====================================

/**
 * 後方互換性のためのデフォルトエクスポート
 * 既存のインポート文との互換性を保持
 */
const constants = {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  APP_CONSTANTS,
  LOG_LEVELS,
  VEHICLE_CONSTANTS,
  GPS_CONSTANTS,
  NOTIFICATION_CONSTANTS,

  // ユーティリティ関数
  isValidHttpStatus,
  isAllowedImageType,
  isAllowedDocumentType,
  isAllowedFileType,
  isValidFileSize,
  normalizePaginationParams,
  validateConfiguration
} as const;

/**
 * 使用例コメント:
 *
 * // HTTPステータスコード
 * res.status(HTTP_STATUS.OK).json(data);
 *
 * // エラーメッセージ
 * throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
 *
 * // ファイル検証
 * if (!isAllowedImageType(file.mimetype)) {
 *   throw new ValidationError(ERROR_MESSAGES.INVALID_FILE_TYPE);
 * }
 *
 * // ページネーション
 * const { page, limit } = normalizePaginationParams(req.query.page, req.query.limit);
 *
 * // 設定検証
 * const validation = validateConfiguration();
 * if (!validation.isValid) {
 *   console.error('Configuration errors:', validation.errors);
 * }
 */

export default constants;
