// =====================================
// backend/src/utils/response.ts
// APIレスポンス統一ユーティリティ
// 作成日時: Fri Sep 26 17:00:00 JST 2025 - 緊急修正版
// アーキテクチャ指針準拠版 - Phase 1基盤拡張
// =====================================

import { Response } from 'express';

// 🎯 Phase 1完成基盤の活用
import type {
  ApiResponse,
  ApiListResponse,
  ListMeta
} from '../types/common';

// =====================================
// レスポンス送信関数
// =====================================

/**
 * 成功レスポンス送信
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message: message || 'Request successful',
    timestamp: new Date().toISOString()
  };

  return res.status(statusCode).json(response);
}

/**
 * エラーレスポンス送信
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  errorCode?: string,
  details?: any
): Response {
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: errorCode || `HTTP_${statusCode}`,
    message,
    timestamp: new Date().toISOString()
  };

  // デバッグ情報を開発環境でのみ含める
  if (process.env.NODE_ENV === 'development' && details) {
    (response as any).details = details;
  }

  return res.status(statusCode).json(response);
}

/**
 * リスト形式の成功レスポンス送信
 */
export function sendListSuccess<T>(
  res: Response,
  data: T[],
  meta: ListMeta,
  message?: string,
  statusCode: number = 200
): Response {
  const response: ApiListResponse<T> = {
    success: true,
    data,
    meta,
    timestamp: new Date().toISOString()
  };

  if (message) {
    (response as any).message = message;
  }

  return res.status(statusCode).json(response);
}

/**
 * 作成成功レスポンス送信
 */
export function sendCreated<T>(
  res: Response,
  data: T,
  message?: string
): Response {
  return sendSuccess(res, data, message || 'Resource created successfully', 201);
}

/**
 * 更新成功レスポンス送信
 */
export function sendUpdated<T>(
  res: Response,
  data: T,
  message?: string
): Response {
  return sendSuccess(res, data, message || 'Resource updated successfully', 200);
}

/**
 * 削除成功レスポンス送信
 */
export function sendDeleted(
  res: Response,
  message?: string
): Response {
  return sendSuccess(res, null, message || 'Resource deleted successfully', 200);
}

// =====================================
// バリデーションエラー関数
// =====================================

/**
 * バリデーションエラーレスポンス送信
 */
export function sendValidationError(
  res: Response,
  errors: Array<{ field: string; message: string; value?: any }>,
  message?: string
): Response {
  return res.status(400).json({
    success: false,
    error: 'VALIDATION_ERROR',
    message: message || 'Validation failed',
    errors,
    timestamp: new Date().toISOString()
  });
}

/**
 * 認証エラーレスポンス送信
 */
export function sendAuthError(
  res: Response,
  message?: string
): Response {
  return sendError(res, message || 'Authentication required', 401, 'AUTHENTICATION_REQUIRED');
}

/**
 * 認可エラーレスポンス送信
 */
export function sendForbiddenError(
  res: Response,
  message?: string
): Response {
  return sendError(res, message || 'Access forbidden', 403, 'ACCESS_FORBIDDEN');
}

/**
 * 404エラーレスポンス送信
 */
export function sendNotFound(
  res: Response,
  resource?: string,
  message?: string
): Response {
  const defaultMessage = resource 
    ? `${resource} not found` 
    : 'Resource not found';
  
  return sendError(res, message || defaultMessage, 404, 'RESOURCE_NOT_FOUND');
}

/**
 * 競合エラーレスポンス送信
 */
export function sendConflict(
  res: Response,
  message?: string,
  conflictDetails?: any
): Response {
  return sendError(res, message || 'Resource conflict', 409, 'RESOURCE_CONFLICT', conflictDetails);
}

// =====================================
// ページネーション関数
// =====================================

/**
 * ページネーション情報作成
 */
export function createPaginationMeta(
  total: number,
  page: number,
  pageSize: number
): ListMeta {
  const totalPages = Math.ceil(total / pageSize);
  
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

/**
 * ページネーション付きレスポンス作成
 */
export function sendPaginatedResponse<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
  message?: string
): Response {
  const meta = createPaginationMeta(total, page, pageSize);
  return sendListSuccess(res, data, meta, message);
}

// =====================================
// ファイルダウンロード関数
// =====================================

/**
 * ファイルダウンロードレスポンス送信
 */
export function sendFileDownload(
  res: Response,
  filePath: string,
  fileName: string,
  contentType?: string
): void {
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.download(filePath, fileName);
}

/**
 * CSVダウンロードレスポンス送信
 */
export function sendCSVDownload(
  res: Response,
  csvData: string,
  fileName: string
): Response {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  return res.status(200).send(csvData);
}