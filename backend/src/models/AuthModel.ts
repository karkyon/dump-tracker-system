// =====================================
// backend/src/models/AuthModel.ts
// 認証管理モデル - Phase 1-A基盤統合版
// 作成日時: 2025年9月27日07:00
// 最終更新: Phase 1-B-5完全統合版
// アーキテクチャ指針準拠 + 既存完全実装保持 + types/auth.ts重複解消
// =====================================

import { Request } from 'express';
import { UserRole } from '@prisma/client';

// 🎯 Phase 1-A完成基盤の活用
import { DatabaseService } from '../utils/database';
import { 
  AppError, 
  ValidationError, 
  AuthorizationError, 
  NotFoundError,
  AuthenticationError,
  ConflictError 
} from '../utils/errors';
import logger from '../utils/logger';
import { 
  hashPassword, 
  comparePassword, 
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  type JWTPayload,
  type RefreshTokenPayload,
  type TokenPair
} from '../utils/crypto';

// 🎯 types/共通型定義の活用（Phase 1-A完成）
import type {
  PaginationQuery,
  ApiResponse,
  OperationResult,
  ValidationResult
} from '../types/common';

// 🎯 UserModel.tsとの連携
import type { UserModel } from './UserModel';

// =====================================
// 基本型定義（既存完全実装保持）
// =====================================

/**
 * ログインリクエストの型定義（既存保持）
 */
export interface AuthLoginRequest {
  username: string;
  password: string;
}

/**
 * ログインレスポンスの型定義（既存保持）
 */
export interface AuthLoginResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      username: string;
      email: string;
      fullName: string;
      role: string;
    };
    token: string;
    refreshToken: string;
  };
  message: string;
}

/**
 * JWTペイロードの型定義（既存保持）
 */
export interface AuthJWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * 認証済みリクエストにユーザ情報を追加（既存保持）
 */
export interface AuthenticatedRequest extends Request {
  user: AuthJWTPayload;
}

// =====================================
// 標準DTO（既存完全実装保持）
// =====================================

export interface AuthResponseDTO {
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
  };
  token: string;
  refreshToken: string;
}

export interface AuthCreateDTO {
  username: string;
  password: string;
}

export interface AuthUpdateDTO {
  password?: string;
  refreshToken?: string;
}

// =====================================
// 拡張認証型定義（types/auth.ts統合版）
// =====================================

/**
 * 認証済みユーザー情報（統合版）
 */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * 認証設定
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
  passwordPolicy: PasswordPolicy;
}

/**
 * パスワードポリシー
 */
export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  prohibitCommonPasswords: boolean;
  historyCount: number;
}

/**
 * ログイン試行情報
 */
export interface LoginAttempt {
  username: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  timestamp: Date;
  sessionId?: string;
}

/**
 * セッション情報
 */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * セキュリティイベント
 */
export interface SecurityEvent {
  event: string;
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  success: boolean;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * 認証統計情報
 */
export interface AuthStatistics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueUsers: number;
  activeSessions: number;
  lockedAccounts: number;
  recentSecurityEvents: number;
  averageSessionDuration: number;
}

/**
 * パスワードリセット情報
 */
export interface PasswordResetInfo {
  token: string;
  userId: string;
  email: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

// =====================================
// 認証サービスクラス（新規統合機能）
// =====================================

export class AuthService {
  private readonly db: DatabaseService;
  private readonly config: AuthConfig;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.config = this.getAuthConfig();
  }

  /**
   * ユーザーログイン（Phase 1-A統合版）
   */
  async login(
    request: AuthLoginRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthLoginResponse> {
    try {
      logger.info('ログイン試行開始', { username: request.username, ipAddress });

      // ログイン試行回数チェック
      await this.checkLoginAttempts(request.username, ipAddress);

      // ユーザー検索
      const user = await this.findUserForAuth(request.username);
      if (!user) {
        await this.recordLoginAttempt(request.username, ipAddress, false, 'ユーザーが見つかりません');
        throw new AuthenticationError('ユーザー名またはパスワードが正しくありません');
      }

      // アカウント状態チェック
      await this.checkAccountStatus(user);

      // パスワード検証
      const isPasswordValid = await comparePassword(request.password, user.passwordHash);
      if (!isPasswordValid) {
        await this.recordLoginAttempt(request.username, ipAddress, false, 'パスワードが正しくありません');
        throw new AuthenticationError('ユーザー名またはパスワードが正しくありません');
      }

      // JWT生成
      const tokenPair = await generateTokenPair(user);

      // ログイン成功記録
      await this.recordLoginAttempt(request.username, ipAddress, true);
      await this.updateLastLogin(user.id, ipAddress);

      // セキュリティイベント記録
      await this.recordSecurityEvent({
        event: 'LOGIN_SUCCESS',
        userId: user.id,
        username: user.username,
        ipAddress,
        userAgent,
        success: true,
        timestamp: new Date()
      });

      const response: AuthLoginResponse = {
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.name || user.username,
            role: user.role
          },
          token: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken
        },
        message: 'ログインに成功しました'
      };

      logger.info('ログイン成功', { userId: user.id, username: user.username });
      return response;

    } catch (error) {
      logger.error('ログインエラー', { error, username: request.username, ipAddress });
      throw error;
    }
  }

  /**
   * トークンリフレッシュ（Phase 1-A統合版）
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      logger.info('トークンリフレッシュ開始');

      // リフレッシュトークン検証
      const payload = verifyRefreshToken(refreshToken);

      // ユーザー存在確認
      const user = await this.findUserById(payload.userId);
      if (!user) {
        throw new AuthenticationError('無効なリフレッシュトークンです');
      }

      // アカウント状態チェック
      await this.checkAccountStatus(user);

      // 新しいトークンペア生成
      const newTokenPair = await generateTokenPair(user);

      logger.info('トークンリフレッシュ成功', { userId: user.id });
      return newTokenPair;

    } catch (error) {
      logger.error('トークンリフレッシュエラー', { error });
      throw error;
    }
  }

  /**
   * ログアウト（セッション管理統合）
   */
  async logout(
    userId: string,
    token?: string,
    logoutAll: boolean = false
  ): Promise<void> {
    try {
      logger.info('ログアウト開始', { userId, logoutAll });

      if (logoutAll) {
        // 全セッション無効化
        await this.invalidateAllSessions(userId);
      } else if (token) {
        // 特定セッション無効化
        await this.invalidateSession(token);
      }

      // セキュリティイベント記録
      await this.recordSecurityEvent({
        event: logoutAll ? 'LOGOUT_ALL' : 'LOGOUT',
        userId,
        success: true,
        timestamp: new Date()
      });

      logger.info('ログアウト完了', { userId, logoutAll });

    } catch (error) {
      logger.error('ログアウトエラー', { error, userId });
      throw error;
    }
  }

  /**
   * 認証統計生成（Phase 1-A統合機能）
   */
  async generateAuthStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<AuthStatistics> {
    try {
      logger.info('認証統計生成開始', { startDate, endDate });

      const dateFilter = this.buildDateFilter(startDate, endDate);

      const [
        totalLogins,
        successfulLogins,
        failedLogins,
        uniqueUsers,
        activeSessions,
        lockedAccounts,
        securityEvents
      ] = await Promise.all([
        this.getLoginAttemptsCount(dateFilter),
        this.getSuccessfulLoginsCount(dateFilter),
        this.getFailedLoginsCount(dateFilter),
        this.getUniqueUsersCount(dateFilter),
        this.getActiveSessionsCount(),
        this.getLockedAccountsCount(),
        this.getSecurityEventsCount(dateFilter)
      ]);

      const statistics: AuthStatistics = {
        totalLogins,
        successfulLogins,
        failedLogins,
        uniqueUsers,
        activeSessions,
        lockedAccounts,
        recentSecurityEvents: securityEvents,
        averageSessionDuration: await this.getAverageSessionDuration(dateFilter)
      };

      logger.info('認証統計生成完了', { statistics });
      return statistics;

    } catch (error) {
      logger.error('認証統計生成エラー', { error });
      throw new AppError('認証統計生成に失敗しました', 500);
    }
  }

  /**
   * セキュリティ監査（不審な活動検出）
   */
  async detectSuspiciousActivity(userId?: string): Promise<SecurityEvent[]> {
    try {
      logger.info('セキュリティ監査開始', { userId });

      const suspiciousEvents = await this.getSuspiciousSecurityEvents(userId);
      
      if (suspiciousEvents.length > 0) {
        logger.warn('不審な活動を検出', { 
          count: suspiciousEvents.length, 
          userId 
        });
      }

      return suspiciousEvents;

    } catch (error) {
      logger.error('セキュリティ監査エラー', { error, userId });
      throw new AppError('セキュリティ監査に失敗しました', 500);
    }
  }

  /**
   * アカウントロック管理
   */
  async lockAccount(
    userId: string, 
    reason: string,
    duration?: number
  ): Promise<void> {
    try {
      logger.info('アカウントロック開始', { userId, reason, duration });

      const lockExpiry = duration 
        ? new Date(Date.now() + duration * 60 * 1000)
        : new Date(Date.now() + this.config.lockoutDuration * 60 * 1000);

      await this.db.getClient().user.update({
        where: { id: userId },
        data: {
          isLocked: true,
          lockExpiry,
          lockReason: reason,
          updatedAt: new Date()
        }
      });

      // セキュリティイベント記録
      await this.recordSecurityEvent({
        event: 'ACCOUNT_LOCKED',
        userId,
        success: true,
        details: { reason, lockExpiry },
        timestamp: new Date()
      });

      logger.info('アカウントロック完了', { userId, lockExpiry });

    } catch (error) {
      logger.error('アカウントロックエラー', { error, userId });
      throw error;
    }
  }

  /**
   * アカウントロック解除
   */
  async unlockAccount(userId: string): Promise<void> {
    try {
      logger.info('アカウントロック解除開始', { userId });

      await this.db.getClient().user.update({
        where: { id: userId },
        data: {
          isLocked: false,
          lockExpiry: null,
          lockReason: null,
          failedLoginAttempts: 0,
          updatedAt: new Date()
        }
      });

      // セキュリティイベント記録
      await this.recordSecurityEvent({
        event: 'ACCOUNT_UNLOCKED',
        userId,
        success: true,
        timestamp: new Date()
      });

      logger.info('アカウントロック解除完了', { userId });

    } catch (error) {
      logger.error('アカウントロック解除エラー', { error, userId });
      throw error;
    }
  }

  // =====================================
  // プライベートメソッド（ユーティリティ）
  // =====================================

  private async findUserForAuth(username: string): Promise<UserModel | null> {
    return await this.db.getClient().user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }
        ]
      }
    });
  }

  private async findUserById(id: string): Promise<UserModel | null> {
    return await this.db.getClient().user.findUnique({
      where: { id }
    });
  }

  private async checkAccountStatus(user: UserModel): Promise<void> {
    if (!user.isActive) {
      throw new AuthenticationError('アカウントが無効化されています');
    }

    if (user.lockExpiry && user.lockExpiry > new Date()) {
      throw new AuthenticationError('アカウントがロックされています');
    }
  }

  private async checkLoginAttempts(
    username: string, 
    ipAddress?: string
  ): Promise<void> {
    const recentAttempts = await this.getRecentFailedAttempts(username, ipAddress);
    
    if (recentAttempts >= this.config.maxLoginAttempts) {
      const user = await this.findUserForAuth(username);
      if (user) {
        await this.lockAccount(user.id, 'ログイン試行回数超過');
      }
      throw new AuthenticationError('ログイン試行回数が上限に達しました');
    }
  }

  private async recordLoginAttempt(
    username: string,
    ipAddress?: string,
    success: boolean = false,
    failureReason?: string
  ): Promise<void> {
    const attempt: LoginAttempt = {
      username,
      ipAddress: ipAddress || '',
      success,
      failureReason,
      timestamp: new Date()
    };

    // データベースに記録（実装は具体的なテーブル設計に依存）
    logger.info('ログイン試行記録', attempt);
  }

  private async updateLastLogin(
    userId: string, 
    ipAddress?: string
  ): Promise<void> {
    await this.db.getClient().user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        loginCount: { increment: 1 },
        failedLoginAttempts: 0,
        updatedAt: new Date()
      }
    });
  }

  private async recordSecurityEvent(event: SecurityEvent): Promise<void> {
    // セキュリティイベントのログ記録
    logger.info('セキュリティイベント記録', event);
    
    // 必要に応じてデータベースに永続化
    // await this.db.getClient().securityEvent.create({ data: event });
  }

  private async invalidateSession(token: string): Promise<void> {
    // トークンブラックリスト機能（実装は要件に応じて）
    logger.info('セッション無効化', { token: token.substring(0, 20) + '...' });
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    // ユーザーの全セッション無効化
    logger.info('全セッション無効化', { userId });
  }

  private getAuthConfig(): AuthConfig {
    return {
      jwtSecret: process.env.JWT_SECRET || 'default-secret',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
      refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30'),
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60'),
      passwordPolicy: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        prohibitCommonPasswords: true,
        historyCount: 5
      }
    };
  }

  private buildDateFilter(startDate?: Date, endDate?: Date) {
    const filter: any = {};
    if (startDate) filter.gte = startDate;
    if (endDate) filter.lte = endDate;
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  private async getLoginAttemptsCount(dateFilter?: any): Promise<number> {
    // 実装は具体的なログテーブル設計に依存
    return 0;
  }

  private async getSuccessfulLoginsCount(dateFilter?: any): Promise<number> {
    // 実装は具体的なログテーブル設計に依存
    return 0;
  }

  private async getFailedLoginsCount(dateFilter?: any): Promise<number> {
    // 実装は具体的なログテーブル設計に依存
    return 0;
  }

  private async getUniqueUsersCount(dateFilter?: any): Promise<number> {
    // 実装は具体的なログテーブル設計に依存
    return 0;
  }

  private async getActiveSessionsCount(): Promise<number> {
    // 実装は具体的なセッションテーブル設計に依存
    return 0;
  }

  private async getLockedAccountsCount(): Promise<number> {
    return await this.db.getClient().user.count({
      where: {
        isLocked: true,
        lockExpiry: { gt: new Date() }
      }
    });
  }

  private async getSecurityEventsCount(dateFilter?: any): Promise<number> {
    // 実装は具体的なセキュリティイベントテーブル設計に依存
    return 0;
  }

  private async getAverageSessionDuration(dateFilter?: any): Promise<number> {
    // 実装は具体的なセッションテーブル設計に依存
    return 0;
  }

  private async getRecentFailedAttempts(
    username: string, 
    ipAddress?: string
  ): Promise<number> {
    // 実装は具体的なログテーブル設計に依存
    return 0;
  }

  private async getSuspiciousSecurityEvents(userId?: string): Promise<SecurityEvent[]> {
    // 実装は具体的なセキュリティポリシーに依存
    return [];
  }
}

// =====================================
// 互換性のための型エイリアス（既存完全実装保持）
// =====================================

export type LoginRequest = AuthLoginRequest;
export type LoginResponse = AuthLoginResponse;
export type JWTPayload = AuthJWTPayload;

// =====================================
// ファクトリ関数（Phase 1-A統合）
// =====================================

let _authServiceInstance: AuthService | null = null;

export const getAuthService = (): AuthService => {
  if (!_authServiceInstance) {
    _authServiceInstance = new AuthService();
  }
  return _authServiceInstance;
};

// =====================================
// エクスポート（既存完全実装保持 + 新機能）
// =====================================

export type { AuthLoginRequest as default };
export {
  AuthService,
  type AuthenticatedUser,
  type AuthConfig,
  type PasswordPolicy,
  type LoginAttempt,
  type SessionInfo,
  type SecurityEvent,
  type AuthStatistics,
  type PasswordResetInfo
};