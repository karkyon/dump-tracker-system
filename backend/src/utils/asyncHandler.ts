// =====================================
// backend/src/utils/asyncHandler.ts
// 非同期エラーハンドリングユーティリティ
// 作成日時: Fri Sep 26 17:05:00 JST 2025 - 緊急修正版
// アーキテクチャ指針準拠版 - Phase 1基盤拡張
// =====================================

import { Request, Response, NextFunction } from 'express';

// 🎯 Phase 1完成基盤の活用
import { 
  AppError, 
  ValidationError, 
  AuthorizationError, 
  NotFoundError, 
  ConflictError 
} from './errors';

// =====================================
// 基本的な非同期ハンドラー
// =====================================

/**
 * 非同期ルートハンドラーをラップしてエラーを適切に処理
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =====================================
// 認証付き非同期ハンドラー
// =====================================

/**
 * 認証が必要な非同期ルートハンドラーをラップ
 */
export function asyncAuthHandler(
  fn: (req: any, res: Response, next: NextFunction) => Promise<any>
) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // 認証チェック
    const authReq = req as any;
    if (!authReq.user) {
      throw new AuthorizationError(
        '認証が必要です',
        'authentication_required',
        'GUEST'
      );
    }
    
    return await fn(authReq, res, next);
  });
}

// =====================================
// ロール別非同期ハンドラー
// =====================================

/**
 * 管理者権限が必要な非同期ルートハンドラーをラップ
 */
export function asyncAdminHandler(
  fn: (req: any, res: Response, next: NextFunction) => Promise<any>
) {
  return asyncAuthHandler(async (req: any, res: Response, next: NextFunction) => {
    if (req.user.role !== 'ADMIN') {
      throw new AuthorizationError(
        '管理者権限が必要です',
        'admin_required',
        req.user.role
      );
    }
    
    return await fn(req, res, next);
  });
}

/**
 * マネージャー以上の権限が必要な非同期ルートハンドラーをラップ
 */
export function asyncManagerHandler(
  fn: (req: any, res: Response, next: NextFunction) => Promise<any>
) {
  return asyncAuthHandler(async (req: any, res: Response, next: NextFunction) => {
    const allowedRoles = ['ADMIN', 'MANAGER'];
    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError(
        'マネージャー以上の権限が必要です',
        'manager_required',
        req.user.role
      );
    }
    
    return await fn(req, res, next);
  });
}

// =====================================
// バリデーション付き非同期ハンドラー
// =====================================

/**
 * リクエストバリデーション付き非同期ハンドラー
 */
export function asyncValidatedHandler<T>(
  validator: (data: any) => T | Promise<T>,
  fn: (req: Request & { validatedData: T }, res: Response, next: NextFunction) => Promise<any>
) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // リクエストデータのバリデーション
      const validatedData = await Promise.resolve(validator(req.body));
      
      // バリデーション済みデータをリクエストに追加
      const validatedReq = req as Request & { validatedData: T };
      validatedReq.validatedData = validatedData;
      
      return await fn(validatedReq, res, next);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // バリデーションエラーとして再スロー
      throw new ValidationError(
        'リクエストデータのバリデーションに失敗しました',
        'validation_failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  });
}

// =====================================
// トランザクション付き非同期ハンドラー
// =====================================

/**
 * データベーストランザクション付き非同期ハンドラー
 * PrismaClientを使用したトランザクション処理
 */
export function asyncTransactionHandler(
  fn: (req: Request, res: Response, next: NextFunction, tx: any) => Promise<any>
) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // 注意: この関数を使用する場合は、呼び出し側でPrismaClientのトランザクションを適切に処理する必要があります
    // 実装例:
    // const { DatabaseService } = require('./database');
    // const db = DatabaseService.getInstance();
    // 
    // return await db.$transaction(async (tx) => {
    //   return await fn(req, res, next, tx);
    // });
    
    throw new AppError(
      'トランザクションハンドラーは現在実装中です',
      500,
      'TRANSACTION_HANDLER_NOT_IMPLEMENTED'
    );
  });
}

// =====================================
// ファイルアップロード付き非同期ハンドラー
// =====================================

/**
 * ファイルアップロード処理付き非同期ハンドラー
 */
export function asyncFileUploadHandler(
  maxFileSize: number = 10 * 1024 * 1024, // 10MB default
  allowedMimeTypes: string[] = ['image/jpeg', 'image/png', 'application/pdf'],
  fn: (req: Request & { uploadedFiles?: any[] }, res: Response, next: NextFunction) => Promise<any>
) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // ファイルアップロードの前処理
    const files = (req as any).files;
    
    if (files) {
      // ファイルサイズとMIMEタイプの検証
      for (const file of Array.isArray(files) ? files : [files]) {
        if (file.size > maxFileSize) {
          throw new ValidationError(
            `ファイルサイズが上限（${Math.round(maxFileSize / 1024 / 1024)}MB）を超えています`,
            'file_too_large',
            file.name
          );
        }
        
        if (!allowedMimeTypes.includes(file.mimetype)) {
          throw new ValidationError(
            `許可されていないファイル形式です: ${file.mimetype}`,
            'invalid_file_type',
            file.mimetype
          );
        }
      }
    }
    
    const fileReq = req as Request & { uploadedFiles?: any[] };
    fileReq.uploadedFiles = files;
    
    return await fn(fileReq, res, next);
  });
}

// =====================================
// レート制限付き非同期ハンドラー
// =====================================

/**
 * レート制限付き非同期ハンドラー
 * 簡易的なメモリベースのレート制限実装
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function asyncRateLimitedHandler(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = rateLimitStore.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // 新しいウィンドウの開始
      rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
    } else if (clientData.count >= maxRequests) {
      // レート制限に達している
      throw new AppError(
        'レート制限に達しました。しばらく時間をおいて再試行してください',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    } else {
      // リクエストカウントを増加
      clientData.count++;
      rateLimitStore.set(clientId, clientData);
    }
    
    return await fn(req, res, next);
  });
}

// =====================================
// デフォルトエクスポート
// =====================================

export default asyncHandler;