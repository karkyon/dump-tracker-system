// =====================================
// backend/src/middleware/auth.ts
// 認証関連ミドルウェア - 完全アーキテクチャ改修統合版
// JWT認証・権限チェック・セキュリティ強化統合版
// 最終更新: 2025年10月6日
// 依存関係: utils/crypto.ts, utils/errors.ts, utils/response.ts, types/auth.ts
// コンパイルエラー完全修正版
// =====================================

import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

// 🎯 Phase 1完成基盤の活用（重複排除・統合版)
import {
  JWTPayload,
  validateJWTConfig,
  verifyAccessToken
} from '../utils/crypto';
import {
  AuthenticationError,
  AuthorizationError
} from '../utils/errors';
import logger from '../utils/logger';
import { sendError } from '../utils/response';

// 🎯 types/からの統一型定義インポート（重複型定義削除）
import type {
  AuthenticatedRequest,
  AuthenticatedUser as TypesAuthenticatedUser
} from '../types/auth';

// =====================================
// 🔍 デバッグログユーティリティ (汎用)
// =====================================

/**
 * ミドルウェアデバッグログ出力
 * @param middlewareName - ミドルウェア名
 * @param stage - ステージ名
 * @param data - 追加データ (オプション)
 */
const logMiddleware = (middlewareName: string, stage: string, data?: any): void => {
  const isoParts = new Date().toISOString().split('T');
  const timestamp = isoParts[1]?.slice(0, -1) ?? isoParts[0];
  const dataStr = data ? ` | データ: ${JSON.stringify(data)}` : '';
  console.log(`🟦 [${middlewareName}] ${stage} (${timestamp})${dataStr}`);
};

// =====================================
// 型定義（統合版）
// =====================================

/**
 * 認証ミドルウェアオプション
 * 柔軟な認証設定を可能にする
 */
export interface AuthMiddlewareOptions {
  /** 認証をオプションにするか（デフォルト: false） */
  optional?: boolean;
  /** 必要な役割（指定時は該当役割以上のアクセスのみ許可） */
  requiredRole?: UserRole;
  /** 必要な権限リスト */
  requiredPermissions?: string[];
  /** 非アクティブユーザーのアクセスを許可するか */
  allowInactive?: boolean;
  /** カスタム検証関数 */
  customValidator?: (user: JWTPayload) => Promise<boolean> | boolean;
}

/**
 * 認証済みユーザー情報（拡張版）
 * types/auth.tsのAuthenticatedUserを拡張
 */
export interface AuthenticatedUser extends TypesAuthenticatedUser {
  permissions?: string[];
  lastLoginAt?: Date;
  sessionId?: string;
}

// =====================================
// ユーティリティ関数（統合版）
// =====================================

/**
 * 役割階層チェック
 * より高い権限の役割は下位の権限も含む
 *
 * 注意: UserRoleはADMIN, MANAGER, DRIVERの3種のみ（schema.camel.prisma準拠）
 */
const checkRoleHierarchy = (userRole: string, requiredRole: UserRole): boolean => {
  const roleHierarchy: Record<string, number> = {
    'ADMIN': 3,
    'MANAGER': 2,
    'DRIVER': 1
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
};

/**
 * 権限チェック
 * ユーザーが必要な権限を持っているかチェック
 */
const checkPermissions = (userPermissions: string[] = [], requiredPermissions: string[] = []): boolean => {
  if (requiredPermissions.length === 0) return true;

  return requiredPermissions.every(permission =>
    userPermissions.includes(permission) || userPermissions.includes('*')
  );
};

/**
 * JWTトークン抽出
 * AuthorizationヘッダーからBearerトークンを安全に抽出
 */
const extractToken = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  const token = parts[1];
  if (!token || token.length < 10) return null; // 最小長チェック

  return token;
};

// =====================================
// メイン認証ミドルウェア（統合版）
// =====================================

/**
 * JWT認証ミドルウェア（統合版）
 * utils/crypto.tsの包括的JWT機能を活用した企業レベル認証
 *
 * 【統合機能】
 * - utils/crypto.tsのJWT検証機能統合
 * - utils/errors.tsの統一エラーハンドリング
 * - utils/response.tsの統一レスポンス形式
 * - 役割階層・権限チェック機能
 * - セキュリティログ記録
 *
 * @param options - 認証オプション（省略可能）
 * @returns Express middleware function
 */
export function authenticateToken(options: AuthMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logMiddleware('authenticateToken', '開始', { url: req.originalUrl });

    try {
      // JWT設定の事前検証
      logMiddleware('authenticateToken', 'JWT設定検証開始');

      if (!validateJWTConfig()) {
        logger.error('JWT設定が無効です');
        sendError(res, 'サーバー設定エラー', 500, 'JWT_CONFIG_ERROR');
        return;
      }

      logMiddleware('authenticateToken', 'JWT設定検証完了');

      const authHeader = req.headers['authorization'];
      const token = extractToken(authHeader);

      // トークン未提供時の処理
      if (!token) {
        if (options.optional) {
          logMiddleware('authenticateToken', 'トークンなし(オプショナル) - スキップ');
          return next();
        }

        logMiddleware('authenticateToken', 'トークンなし - エラー');
        logger.warn('認証トークンが提供されていません', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          method: req.method
        });

        throw new AuthenticationError('アクセストークンが必要です', 'Bearer');
      }

      // JWT検証（utils/crypto.ts統合機能使用）
      logMiddleware('authenticateToken', 'JWT検証開始');

      let decoded: JWTPayload;
      try {
        decoded = verifyAccessToken(token);
        logMiddleware('authenticateToken', 'JWT検証成功', { userId: decoded.userId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';

        logMiddleware('authenticateToken', 'JWT検証失敗', { error: errorMessage });

        logger.warn('JWT検証失敗', {
          error: errorMessage,
          ip: req.ip,
          url: req.originalUrl
        });

        throw new AuthenticationError(
          'トークンが無効または期限切れです',
          'Bearer'  // ✅ 修正: 第3引数を削除
        );
      }

      // ユーザーのアクティブ状態チェック
      logMiddleware('authenticateToken', 'アクティブ状態チェック', { isActive: decoded.isActive });

      if (!options.allowInactive && decoded.isActive === false) {
        logMiddleware('authenticateToken', '非アクティブユーザー - 拒否');

        logger.warn('非アクティブユーザーのアクセス試行', {
          userId: decoded.userId,
          username: decoded.username,
          ip: req.ip
        });

        throw new AuthorizationError(
          'このアカウントは無効化されています',
          'INACTIVE_USER'
        );
      }

      // 役割チェック
      if (options.requiredRole && !checkRoleHierarchy(decoded.role, options.requiredRole)) {
        logMiddleware('authenticateToken', '役割チェック開始', {
          userRole: decoded.role,
          requiredRole: options.requiredRole
        });

        if (!checkRoleHierarchy(decoded.role, options.requiredRole)) {
          logMiddleware('authenticateToken', '役割チェック失敗 - 権限不足');

          logger.warn('権限不足アクセス試行', {
            userId: decoded.userId,
            userRole: decoded.role,
            requiredRole: options.requiredRole,
            url: req.originalUrl
          });

          throw new AuthorizationError(
            'この操作を実行する権限がありません',
            'INSUFFICIENT_PERMISSIONS'
          );
        }
        logMiddleware('authenticateToken', '役割チェック成功');
      }

      // カスタム検証
      if (options.customValidator) {
        logMiddleware('authenticateToken', 'カスタム検証開始');

        const isValid = await Promise.resolve(options.customValidator(decoded));
        if (!isValid) {
          logMiddleware('authenticateToken', 'カスタム検証失敗');

          logger.warn('カスタム検証失敗', {
            userId: decoded.userId,
            url: req.originalUrl
          });

          throw new AuthorizationError(
            'カスタム認証検証に失敗しました',
            'CUSTOM_VALIDATION_FAILED'
          );
        }
        logMiddleware('authenticateToken', 'カスタム検証成功');
      }

      // 認証成功ログ
      logMiddleware('authenticateToken', '認証完了 - next()呼び出し', { userId: decoded.userId });

      logger.info('認証成功', {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        ip: req.ip,
        url: req.originalUrl,
        method: req.method
      });

      // リクエストオブジェクトに認証済みユーザー情報を設定
      (req as AuthenticatedRequest).user = {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email || '',
        name: decoded.name,
        role: decoded.role,
        isActive: decoded.isActive !== false,
        sessionId: `${decoded.userId}_${Date.now()}`
      } as AuthenticatedUser;

      next();

    } catch (error) {
      logMiddleware('authenticateToken', 'エラー発生', {
        error: error instanceof Error ? error.message : 'unknown'
      });

      // エラーハンドリング（utils/errors.ts統合）
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        sendError(res, error.message, error.statusCode, error.code);
        return;
      }

      logger.error('予期しない認証エラー', { error, url: req.originalUrl });
      sendError(res, 'サーバー内部エラー', 500, 'INTERNAL_AUTH_ERROR');
    }
  };
}

// =====================================
// 役割ベース認証ミドルウェア（統合版）
// =====================================

/**
 * 役割要求ミドルウェア
 * 指定された役割以上のアクセスのみ許可
 *
 * @param roles - 許可される役割の配列
 * @returns Express middleware function
 */
export function requireRole(roles: UserRole | UserRole[]) {
  const roleArray = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction): void => {
    logMiddleware('requireRole', '開始', { requiredRoles: roleArray });

    try {
      const authReq = req as AuthenticatedRequest;

      if (!authReq.user) {
        logMiddleware('requireRole', 'ユーザー情報なし - エラー');

        logger.warn('requireRole: ユーザー情報がありません', {
          url: req.originalUrl,
          ip: req.ip
        });

        sendError(res, '認証が必要です', 401, 'AUTHENTICATION_REQUIRED');
        return;
      }

      logMiddleware('requireRole', '役割確認', {
        userRole: authReq.user.role,
        requiredRoles: roleArray
      });

      const hasRequiredRole = roleArray.some(role =>
        checkRoleHierarchy(authReq.user!.role, role)
      );

      if (!hasRequiredRole) {
        logMiddleware('requireRole', '役割不一致 - 拒否', {
          userRole: authReq.user.role
        });

        logger.warn('requireRole: 権限不足', {
          userId: authReq.user.userId,
          userRole: authReq.user.role,
          requiredRoles: roleArray,
          url: req.originalUrl
        });

        sendError(
          res,
          'この操作を実行する権限がありません',
          403,
          'INSUFFICIENT_PERMISSIONS'
        );
        return;
      }

      logMiddleware('requireRole', '役割確認成功 - next()呼び出し');
      next();

    } catch (error) {
      logMiddleware('requireRole', 'エラー発生', {
        error: error instanceof Error ? error.message : 'unknown'
      });

      logger.error('requireRole: 予期しないエラー', {
        error,
        url: req.originalUrl
      });

      sendError(res, 'サーバー内部エラー', 500, 'ROLE_CHECK_ERROR');
    }
  };
}


/**
 * 役割要求ミドルウェア（エイリアス）
 * requireRoleの別名 - routesファイルでの使用を想定
 *
 * @param roles - 許可される役割の配列
 * @returns Express middleware function
 *
 * @example
 * router.get('/', authorize(['ADMIN', 'MANAGER']), controller.method);
 */
export const authorize = requireRole;

/**
 * 権限要求ミドルウェア
 * 指定された権限を持つユーザーのみアクセス許可
 *
 * @param permissions - 必要な権限の配列
 * @returns Express middleware function
 */
export function requirePermissions(permissions: string | string[]) {
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  return authenticateToken({ requiredPermissions: permissionArray });
}

// =====================================
// 事前定義認証ミドルウェア（既存互換性維持）
// =====================================

/**
 * 管理者権限要求（ADMIN以上）
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * マネージャー権限要求（MANAGER以上）
 */
export const requireManager = requireRole('MANAGER');

/**
 * ドライバー権限要求（DRIVER以上）
 */
export const requireDriver = requireRole('DRIVER');

/**
 * マネージャーまたは管理者権限要求
 */
export const requireManagerOrAdmin = requireRole(['MANAGER', 'ADMIN']);

/**
 * ドライバー以上の権限要求（全ログインユーザー）
 */
export const requireDriverOrHigher = requireRole('DRIVER');

/**
 * オプション認証（認証失敗時もアクセス許可）
 */
export const optionalAuth = authenticateToken({ optional: true });

// =====================================
// セキュリティミドルウェア（追加機能）
// =====================================

/**
 * APIレート制限チェック
 * 同一ユーザーからの過度なリクエストを制限
 */
export function rateLimitByUser(maxRequests: number = 100, windowMs: number = 60000) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next();

    const now = Date.now();
    const userKey = user.userId;
    const userLimit = requestCounts.get(userKey);

    // リセット時刻を過ぎている場合はカウンターをリセット
    if (!userLimit || now > userLimit.resetTime) {
      requestCounts.set(userKey, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    // リクエスト数チェック
    if (userLimit.count >= maxRequests) {
      logger.warn('レート制限超過', {
        userId: user.userId,
        count: userLimit.count,
        maxRequests,
        ip: req.ip
      });

      sendError(
        res,
        'リクエスト数が制限を超えました。しばらくしてから再試行してください',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
      return;
    }

    // カウントを増やす
    userLimit.count++;
    requestCounts.set(userKey, userLimit);
    next();
  };
}

/**
 * IP制限チェック
 * 許可されたIPアドレスからのみアクセスを許可
 */
export function requireAllowedIp(allowedIps: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket.remoteAddress || '';

    if (!allowedIps.includes(clientIp)) {
      logger.warn('許可されていないIPからのアクセス試行', {
        ip: clientIp,
        url: req.originalUrl,
        user: (req as AuthenticatedRequest).user
      });

      sendError(
        res,
        'アクセスが許可されていません',
        403,
        'IP_NOT_ALLOWED'
      );
      return;
    }

    next();
  };
}

/**
 * アクティブユーザーのみ許可
 */
export const requireActiveUser = authenticateToken({ allowInactive: false });

/**
 * 非アクティブユーザーも許可
 */
export const allowInactiveUser = authenticateToken({ allowInactive: true });

// =====================================
// ヘルパー関数（エクスポート）
// =====================================

/**
 * 現在の認証済みユーザーを取得
 *
 * @param req - Express Request
 * @returns 認証済みユーザー情報またはundefined
 */
export function getCurrentUser(req: Request): AuthenticatedUser | undefined {
  return (req as AuthenticatedRequest).user;
}

/**
 * ユーザーが特定の役割を持っているか確認
 *
 * @param req - Express Request
 * @param role - 確認する役割
 * @returns 役割を持っている場合true
 */
export function hasRole(req: Request, role: UserRole): boolean {
  const user = getCurrentUser(req);
  if (!user) return false;

  return checkRoleHierarchy(user.role, role);
}

/**
 * ユーザーが管理者か確認
 */
export function isAdmin(req: Request): boolean {
  return hasRole(req, 'ADMIN');
}

/**
 * ユーザーがマネージャー以上か確認
 */
export function isManagerOrHigher(req: Request): boolean {
  return hasRole(req, 'MANAGER');
}

/**
 * ユーザーが特定の権限を持っているか確認
 *
 * @param req - Express Request
 * @param permissions - 確認する権限
 * @returns 権限を持っている場合true
 */
export function hasPermissions(req: Request, permissions: string | string[]): boolean {
  const user = getCurrentUser(req);
  if (!user) return false;

  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  return checkPermissions(user.permissions || [], permissionArray);
}

// =====================================
// デフォルトエクスポート
// =====================================

export default {
  authenticateToken,
  authorize,
  requireRole,
  requirePermissions,
  requireAdmin,
  requireManager,
  requireDriver,
  requireManagerOrAdmin,
  requireDriverOrHigher,
  optionalAuth,
  rateLimitByUser,
  requireAllowedIp,
  requireActiveUser,
  allowInactiveUser,
  getCurrentUser,
  hasRole,
  isAdmin,
  isManagerOrHigher,
  hasPermissions
};
