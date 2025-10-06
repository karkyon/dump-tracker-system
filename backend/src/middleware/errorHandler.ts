// =====================================
// backend/src/middleware/errorHandler.ts
// エラーハンドリングミドルウェア - エラー完全解消版
// 統一エラー処理・レスポンス形式・ログシステム統合版
// 最終更新: 2025年10月05日
// 依存関係: utils/errors.ts, utils/response.ts, utils/logger.ts
// 修正内容: 11件のTypeScriptエラー完全解消・既存機能100%保持
// =====================================

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

// ✅ FIX: 未使用のインポートを削除（TS6133解消）
// 🎯 Phase 1完成基盤の活用（重複排除・統合版）
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  // BusinessLogicError - 削除（未使用）
  // RateLimitError - 削除（未使用）
  SystemError,
  ERROR_CODES
  // type ErrorCode - 削除（未使用）
} from '../utils/errors';

// ✅ FIX: 未使用のインポートを削除（TS6133解消）
import {
  sendError
  // sendValidationError - 削除（未使用）
  // sendAuthError - 削除（未使用）
  // sendForbiddenError - 削除（未使用）
  // sendNotFound - 削除（未使用）
  // sendConflict - 削除（未使用）
} from '../utils/response';

import logger from '../utils/logger';

// 🎯 types/からの統一型定義インポート
import type { AuthenticatedRequest } from '../types';

/**
 * 【エラー解消内容】
 * ✅ TS6133: 未使用インポート削除（BusinessLogicError, RateLimitError, ErrorCode）
 * ✅ TS6133: 未使用インポート削除（sendValidationError, sendAuthError, sendForbiddenError, sendNotFound, sendConflict）
 * ✅ TS2322: 戻り値型の修正（void → Response）
 * ✅ TS6133: 未使用パラメータ削除（res）
 *
 * 【統合効果】
 * ✅ utils/errors.tsの包括的エラークラス体系統合・重複解消
 * ✅ utils/response.tsの統一レスポンス形式統合
 * ✅ utils/logger.tsの統合ログシステム統合
 * ✅ Prisma・JWT・バリデーションエラーの専門的処理
 * ✅ エラー統計・監視機能追加
 * ✅ アーキテクチャ指針準拠（型安全性・レイヤー責務明確化）
 * ✅ 企業レベルエラーハンドリング（統計・監視・ヘルスチェック）
 *
 * 【既存機能100%保持】
 * ✅ グローバルエラーハンドラー（errorHandler）
 * ✅ 404エラーハンドラー（notFound）
 * ✅ 非同期エラーハンドラー（asyncHandler）
 * ✅ エラー統計機能（getErrorStatistics, resetErrorStatistics）
 * ✅ エラーヘルスチェック（getErrorHealthStatus）
 * ✅ デバッグ機能（debugErrorInfo）
 * ✅ Prismaエラー変換（handlePrismaError）
 * ✅ JWTエラー変換（handleJWTError）
 * ✅ バリデーションエラー変換（handleValidationError）
 * ✅ ネットワークエラー変換（handleNetworkError）
 */

// =====================================
// エラー処理統計・監視機能
// =====================================

interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  recentErrors: Array<{
    timestamp: Date;
    type: string;
    endpoint: string;
    statusCode: number;
  }>;
}

// インメモリエラー統計（本番環境では外部ストレージ推奨）
const errorStats: ErrorStatistics = {
  totalErrors: 0,
  errorsByType: {},
  errorsByEndpoint: {},
  recentErrors: []
};

/**
 * エラー統計記録
 * エラーの発生パターンを分析するための統計情報を記録
 */
const recordErrorStatistics = (error: Error, req: Request): void => {
  try {
    const errorType = error.constructor.name;
    const endpoint = `${req.method} ${req.route?.path || req.originalUrl}`;
    const statusCode = (error as any).statusCode || 500;

    // 統計更新
    errorStats.totalErrors++;
    errorStats.errorsByType[errorType] = (errorStats.errorsByType[errorType] || 0) + 1;
    errorStats.errorsByEndpoint[endpoint] = (errorStats.errorsByEndpoint[endpoint] || 0) + 1;

    // 最近のエラー記録（最新100件を保持）
    errorStats.recentErrors.unshift({
      timestamp: new Date(),
      type: errorType,
      endpoint,
      statusCode
    });

    if (errorStats.recentErrors.length > 100) {
      errorStats.recentErrors = errorStats.recentErrors.slice(0, 100);
    }

    // 高頻度エラーの警告（1分間に同じエラーが10回以上）
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentSameErrors = errorStats.recentErrors.filter(
      e => e.type === errorType &&
           e.endpoint === endpoint &&
           e.timestamp > oneMinuteAgo
    );

    if (recentSameErrors.length >= 10) {
      logger.warn('高頻度エラー検出', {
        errorType,
        endpoint,
        count: recentSameErrors.length,
        period: '1分間'
      });
    }
  } catch (statsError) {
    // 統計記録エラーはログのみ（主処理には影響させない）
    logger.error('エラー統計記録失敗', { error: statsError });
  }
};

// =====================================
// エラー変換関数（統合版）
// =====================================

/**
 * Prismaエラー判定・変換
 * Prisma特有のエラーコードを適切なAppErrorに変換
 */
const handlePrismaError = (error: any): AppError => {
  // Prisma Client Known Request Error
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const target = error.meta?.target as string[];
        return new ConflictError(
          `既に登録されています: ${target?.join(', ') || '対象フィールド'}`,
          target?.join('.'),
          ERROR_CODES.DUPLICATE_ENTRY
        );

      case 'P2025':
        // Record not found
        return new NotFoundError(
          '指定されたレコードが見つかりません',
          ERROR_CODES.RESOURCE_NOT_FOUND
        );

      case 'P2003':
        // Foreign key constraint violation
        return new ConflictError(
          '関連データが存在しないため、操作できません',
          undefined,
          ERROR_CODES.DATA_CONFLICT
        );

      case 'P2014':
        // Required relation violation
        return new ValidationError(
          '必須の関連データが指定されていません',
          undefined,
          undefined,
          undefined,
          ERROR_CODES.REQUIRED_FIELD_MISSING
        );

      default:
        return new DatabaseError(
          `データベースエラー: ${error.message}`,
          'prisma',           // 第2引数: query（クエリタイプ）
          error.code,         // 第3引数にはPrismaエラーコード文字列を渡す
          undefined,          // 第4引数: table（不明な場合はundefined）
          'DATABASE_ERROR'    // 第5引数: エラーコード
        );
    }
  }

  // Prisma Validation Error
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError(
      'データベースクエリのバリデーションエラー',
      undefined,
      undefined,
      undefined,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Prisma Client Initialization Error
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new DatabaseError(
      'データベース接続エラー',
      'connection',                              // 第2引数: query（接続タイプ）
      error.errorCode || 'INIT_ERROR',           // 第3引数にはエラーコード文字列を渡す
      undefined,                                 // 第4引数: table（接続エラーなので不明）
      ERROR_CODES.DATABASE_CONNECTION_FAILED     // 第5引数: エラーコード
    );
  }

  // その他のPrismaエラー
  return new DatabaseError(
    `データベースエラー: ${error.message}`,
    'unknown',
    error
  );
};

/**
 * JWTエラー判定・変換
 */
const handleJWTError = (error: any): AppError => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError(
      '無効なトークンです',
      ERROR_CODES.TOKEN_INVALID
    );
  }

  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError(
      'トークンの有効期限が切れています',
      ERROR_CODES.TOKEN_EXPIRED
    );
  }

  if (error.name === 'NotBeforeError') {
    return new AuthenticationError(
      'トークンがまだ有効ではありません',
      ERROR_CODES.TOKEN_INVALID
    );
  }

  return new AuthenticationError(
    '認証エラーが発生しました',
    ERROR_CODES.AUTHENTICATION_REQUIRED
  );
};

/**
 * バリデーションエラー判定・変換
 */
const handleValidationError = (error: any): AppError => {
  // Joi バリデーションエラー
  if (error.isJoi) {
    const details = error.details || [];
    const firstError = details[0];

    return new ValidationError(
      firstError?.message || 'バリデーションエラーが発生しました',
      firstError?.path?.join('.') || details[0]?.context?.key || details[0]?.path?.[0] || firstError?.field,
      firstError?.value,
      details.map((d: any) => d.message),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Express-validator エラー
  if (Array.isArray(error.array)) {
    const errors = error.array();
    const firstError = errors[0];

    return new ValidationError(
      firstError?.msg || 'バリデーションエラーが発生しました',
      firstError?.param,
      firstError?.value,
      errors.map((e: any) => e.msg),
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  return new ValidationError('バリデーションエラーが発生しました');
};

/**
 * ネットワーク・外部サービスエラー判定・変換
 */
const handleNetworkError = (error: any): AppError => {
  const errorMessage = error.message?.toLowerCase() || '';

  if (errorMessage.includes('econnrefused') || errorMessage.includes('enotfound')) {
    return new ExternalServiceError(
      '外部サービスに接続できません',
      error.hostname || 'unknown',
      error.config?.url,
      undefined,
      ERROR_CODES.EXTERNAL_SERVICE_UNAVAILABLE
    );
  }

  if (errorMessage.includes('timeout')) {
    return new ExternalServiceError(
      'リクエストタイムアウトが発生しました',
      undefined,
      error.config?.url,
      408,
      'REQUEST_TIMEOUT'
    );
  }

  if (error.response?.status) {
    return new ExternalServiceError(
      `外部サービスエラー: ${error.response.statusText || 'Unknown'}`,
      error.response.config?.baseURL,
      error.config?.url,
      error.response.status
    );
  }

  return new ExternalServiceError('外部サービスとの通信でエラーが発生しました');
};

// =====================================
// メインエラーハンドラー（統合版）
// =====================================

/**
 * グローバルエラーハンドラー（統合版）
 * utils/errors.ts、utils/response.ts、utils/logger.tsの統合機能を活用
 *
 * ✅ FIX: 戻り値型を Response に変更（TS2322解消）
 *
 * 【統合機能】
 * - utils/errors.tsの包括的エラークラス体系活用
 * - utils/response.tsの統一レスポンス形式活用
 * - utils/logger.tsの統合ログシステム活用
 * - Prisma・JWT・バリデーションエラーの専門的処理
 * - エラー統計・監視機能
 * - 本番環境・開発環境の適切な情報制御
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    // レスポンス送信済みチェック
    if (res.headersSent) {
      logger.warn('レスポンス送信済みのためエラーハンドリングをスキップ', {
        url: req.originalUrl,
        method: req.method
      });
      return next(error);
    }

    // エラー統計記録
    recordErrorStatistics(error, req);

    // AppError（既に適切に分類済み）の場合
    if (error instanceof AppError) {
      // 詳細ログ記録
      logger.error('アプリケーションエラー', {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        code: error.code,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as AuthenticatedRequest).user?.userId,
        timestamp: error.timestamp
      });

      // 統一レスポンス送信（utils/response.ts活用）
      return sendError(
        res,
        error.message,
        error.statusCode,
        error.code,
        process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          errorInfo: error.toJSON()
        } : undefined
      );
    }

    // 各種エラーの判定・変換処理
    let appError: AppError;

    // Prismaエラー
    if (error.name?.startsWith('Prisma') ||
        error.constructor?.name?.startsWith('Prisma')) {
      appError = handlePrismaError(error);
    }
    // JWTエラー
    else if (error.name?.includes('JsonWebToken') ||
             error.name?.includes('Token') ||
             error.message?.toLowerCase().includes('jwt')) {
      appError = handleJWTError(error);
    }
    // バリデーションエラー
    else if (error.name === 'ValidationError' ||
             (error as any).isJoi ||
             Array.isArray((error as any).array)) {
      appError = handleValidationError(error);
    }
    // ネットワーク・外部サービスエラー
    else if (error.message?.toLowerCase().includes('econnrefused') ||
             error.message?.toLowerCase().includes('timeout') ||
             (error as any).response?.status) {
      appError = handleNetworkError(error);
    }
    // TypeScriptコンパイルエラー
    else if (error.message?.includes('Cannot find module') ||
             error.message?.includes('Module not found')) {
      appError = new SystemError(
        'モジュールの読み込みに失敗しました',
        'module_loader',
        error,
        ERROR_CODES.CONFIGURATION_ERROR
      );
    }
    // 権限関連エラー
    else if (error.message?.toLowerCase().includes('permission') ||
             error.message?.toLowerCase().includes('forbidden')) {
      appError = new AuthorizationError(
        error.message || 'アクセス権限がありません',
        undefined,
        undefined,
        ERROR_CODES.INSUFFICIENT_PERMISSIONS
      );
    }
    // その他の予期しないエラー
    else {
      appError = new SystemError(
        error.message || '予期しないエラーが発生しました',
        'unknown',
        error,
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }

    // 変換されたエラーの詳細ログ記録
    logger.error('システムエラー（変換済み）', {
      original: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      converted: {
        name: appError.name,
        message: appError.message,
        statusCode: appError.statusCode,
        code: appError.code
      },
      request: {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as AuthenticatedRequest).user?.userId
      },
      timestamp: new Date().toISOString()
    });

    // 統一レスポンス送信
    return sendError(
      res,
      appError.message,
      appError.statusCode,
      appError.code,
      process.env.NODE_ENV === 'development' ? {
        originalError: error.message,
        stack: error.stack,
        convertedError: appError.toJSON()
      } : undefined
    );

  } catch (handlerError) {
    // エラーハンドラー自体でエラーが発生した場合のフォールバック
    logger.error('エラーハンドラー内でエラーが発生', {
      originalError: error.message,
      handlerError: handlerError instanceof Error ? handlerError.message : 'Unknown',
      url: req.originalUrl
    });

    // 最終フォールバック
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'サーバー内部エラーが発生しました',
        error: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
};

// =====================================
// 404エラーハンドラー（統合版）
// =====================================

/**
 * 404エラーハンドラー（統合版）
 * 定義されていないルートへのアクセス時に呼び出される
 */
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const notFoundError = new NotFoundError(
    `要求されたリソースが見つかりません: ${req.originalUrl}`,
    ERROR_CODES.RESOURCE_NOT_FOUND
  );

  // 404アクセスのログ記録（過度にログを増やさないよう注意）
  logger.info('404エラー', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer')
  });

  next(notFoundError);
};

// =====================================
// 非同期エラーハンドラー（統合版）
// =====================================

/**
 * 非同期関数ラッパー（統合版）
 * async/await関数内で発生したエラーを適切にキャッチ
 *
 * @param fn - ラップする非同期関数
 * @returns Express middleware function
 */
export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: T, res: Response, next: NextFunction): void => {
    const fnReturn = fn(req, res, next);
    Promise.resolve(fnReturn).catch(next);
  };
};

// =====================================
// エラー監視・統計機能
// =====================================

/**
 * エラー統計取得
 * システム管理者向けのエラー統計情報を取得
 */
export const getErrorStatistics = (): ErrorStatistics => {
  return {
    ...errorStats,
    recentErrors: [...errorStats.recentErrors] // コピーを返す
  };
};

/**
 * エラー統計リセット
 * メンテナンス・テスト時の統計クリア
 */
export const resetErrorStatistics = (): void => {
  errorStats.totalErrors = 0;
  errorStats.errorsByType = {};
  errorStats.errorsByEndpoint = {};
  errorStats.recentErrors = [];

  logger.info('エラー統計をリセットしました');
};

/**
 * エラーヘルスチェック
 * システムの健全性を評価
 */
export const getErrorHealthStatus = (): {
  status: 'healthy' | 'warning' | 'critical';
  errorRate: number;
  recentErrorCount: number;
} => {
  const recentErrorCount = errorStats.recentErrors.length;
  const totalRequests = Math.max(errorStats.totalErrors * 10, 1000); // 推定
  const errorRate = (errorStats.totalErrors / totalRequests) * 100;

  let status: 'healthy' | 'warning' | 'critical';

  if (errorRate < 1) {
    status = 'healthy';
  } else if (errorRate < 5) {
    status = 'warning';
  } else {
    status = 'critical';
  }

  return {
    status,
    errorRate: parseFloat(errorRate.toFixed(2)),
    recentErrorCount
  };
};

/**
 * エラー詳細情報取得（デバッグ用）
 * 開発環境でのみ詳細情報を返す
 *
 * ✅ FIX: 未使用パラメータ res を削除（TS6133解消）
 */
export const debugErrorInfo = (error: Error): Record<string, any> => {
  if (process.env.NODE_ENV !== 'development') {
    return {};
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n').map(line => line.trim()),
    prototype: Object.getPrototypeOf(error).constructor.name,
    properties: Object.getOwnPropertyNames(error),
    enumerable: Object.keys(error)
  };
};

// =====================================
// 初期化・設定検証
// =====================================

/**
 * エラーハンドラー初期化
 */
const initializeErrorHandler = (): void => {
  try {
    // ログシステムの動作確認
    logger.info('✅ エラーハンドラー初期化完了', {
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });

    // 開発環境での追加設定
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🔧 開発環境: 詳細エラー情報を有効化');
    }

  } catch (error) {
    console.error('❌ エラーハンドラー初期化失敗', error);
  }
};

// 初期化実行
if (process.env.NODE_ENV !== 'test') {
  initializeErrorHandler();
}

// =====================================
// デフォルトエクスポート（後方互換性）
// =====================================

export default {
  errorHandler,
  notFound,
  asyncHandler,
  getErrorStatistics,
  resetErrorStatistics,
  getErrorHealthStatus,
  debugErrorInfo
};

// =====================================
// 修正完了確認
// =====================================

/**
 * ✅ middleware/errorHandler.ts 完全修正版
 *
 * 【解消したエラー - 全11件】
 * ✅ TS6133: 'BusinessLogicError' 未使用インポート削除
 * ✅ TS6133: 'RateLimitError' 未使用インポート削除
 * ✅ TS6133: 'ErrorCode' 未使用インポート削除
 * ✅ TS6133: 'sendValidationError' 未使用インポート削除
 * ✅ TS6133: 'sendAuthError' 未使用インポート削除
 * ✅ TS6133: 'sendForbiddenError' 未使用インポート削除
 * ✅ TS6133: 'sendNotFound' 未使用インポート削除
 * ✅ TS6133: 'sendConflict' 未使用インポート削除
 * ✅ TS2322: errorHandler戻り値型を Response | void に修正
 * ✅ TS2322: sendError の戻り値を return
 * ✅ TS6133: debugErrorInfo の未使用パラメータ res 削除
 *
 * 【既存機能100%保持】
 * ✅ グローバルエラーハンドラー（errorHandler）
 * ✅ 404エラーハンドラー（notFound）
 * ✅ 非同期エラーハンドラー（asyncHandler）
 * ✅ エラー統計機能（recordErrorStatistics）
 * ✅ エラー統計取得（getErrorStatistics）
 * ✅ エラー統計リセット（resetErrorStatistics）
 * ✅ エラーヘルスチェック（getErrorHealthStatus）
 * ✅ デバッグ機能（debugErrorInfo）
 * ✅ Prismaエラー変換（handlePrismaError）
 * ✅ JWTエラー変換（handleJWTError）
 * ✅ バリデーションエラー変換（handleValidationError）
 * ✅ ネットワークエラー変換（handleNetworkError）
 * ✅ 高頻度エラー検出
 * ✅ 開発環境・本番環境の情報制御
 * ✅ エラーハンドラー内エラーのフォールバック
 *
 * 【改善内容】
 * ✅ 型安全性向上（未使用コード削除）
 * ✅ コード品質向上（明確な戻り値型）
 * ✅ 保守性向上（必要最小限のインポート）
 *
 * 【次の作業】
 * 🎯 utils/logger.ts の修正（8件のエラー）
 */
