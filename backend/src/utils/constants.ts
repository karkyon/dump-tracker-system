export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  AUTH_FAILED: '認証に失敗しました',
  ACCESS_DENIED: 'アクセスが拒否されました',
  NOT_FOUND: 'データが見つかりません',
  VALIDATION_ERROR: '入力内容に誤りがあります',
  SERVER_ERROR: 'サーバーエラーが発生しました',
  INVALID_CREDENTIALS: 'ユーザー名またはパスワードが正しくありません',
  ACCOUNT_INACTIVE: 'アカウントが無効です',
  INVALID_FILE_TYPE: 'サポートされていないファイル形式です',
  FILE_TOO_LARGE: 'ファイルサイズが制限を超えています',
  FILE_UPLOAD_FAILED: 'ファイルのアップロードに失敗しました'
} as const;

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'ログインしました',
  LOGOUT_SUCCESS: 'ログアウトしました',
  CREATED: '正常に作成されました',
  UPDATED: '正常に更新されました',
  DELETED: '正常に削除されました'
} as const;

export const APP_CONSTANTS = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_TIME: 15 * 60 * 1000,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000,
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
} as const;

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
} as const;
