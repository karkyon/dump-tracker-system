// backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

// 安全なログ関数
const safeLog = (level: 'info' | 'error', message: string, data?: any) => {
  try {
    const logger = require('../utils/logger');
    if (logger && logger.default) {
      logger.default[level](message, data);
    } else if (logger && logger[level]) {
      logger[level](message, data);
    } else {
      console[level](`[${level.toUpperCase()}] ${message}`, data || '');
    }
  } catch (error) {
    console[level](`[${level.toUpperCase()}] ${message}`, data || '');
  }
};

// カスタムエラークラス
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404エラーハンドラー
 */
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`要求されたリソースが見つかりません: ${req.originalUrl}`, 404);
  next(error);
};

/**
 * グローバルエラーハンドラー
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'サーバー内部エラーが発生しました';
  let errorCode = 'INTERNAL_SERVER_ERROR';

  // AppErrorの場合
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = 'APP_ERROR';
  }

  // データベースエラー
  if (error.message.includes('duplicate key value')) {
    statusCode = 409;
    message = 'データが既に存在します';
    errorCode = 'DUPLICATE_ENTRY';
  }

  // JWT関連エラー
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '無効なトークンです';
    errorCode = 'INVALID_TOKEN';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'トークンの有効期限が切れています';
    errorCode = 'TOKEN_EXPIRED';
  }

  // バリデーションエラー
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'バリデーションエラーが発生しました';
    errorCode = 'VALIDATION_ERROR';
  }

  // TypeScriptコンパイルエラー対策
  if (error.message.includes('Cannot find module')) {
    statusCode = 500;
    message = 'モジュールの読み込みに失敗しました';
    errorCode = 'MODULE_NOT_FOUND';
  }

  // ログ出力（安全）
  safeLog('error', 'エラー発生:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // レスポンス送信
  try {
    res.status(statusCode).json({
      success: false,
      message,
      error: errorCode,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        originalError: error.message 
      })
    });
  } catch (responseError) {
    // レスポンス送信に失敗した場合のフォールバック
    console.error('Failed to send error response:', responseError);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
};

/**
 * 非同期エラーハンドラー
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
