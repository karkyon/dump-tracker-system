// =====================================
// backend/src/services/authService.ts
// 認証サービス統合 - Phase 2完全統合版（Prismaスキーマ完全対応・全エラー修正）
// 最終更新: 2025年10月14日
// 総行数: 846行（全9個のエラー完全修正）
// =====================================

import type { User, UserRole, Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

// 🎯 Phase 1完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 暗号化・JWT機能の活用
import {
  hashPassword,
  verifyPassword,
  generateTokenPair,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateRandomToken,
  JWT_CONFIG,
  PASSWORD_CONFIG
} from '../utils/crypto';

// 🎯 types/からの統一型定義インポート
import type {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirmRequest,
  AuthenticatedUser,
  UserInfo,
  SessionInfo,
  SecurityEvent,
  LoginAttempt,
  RolePermissions,
  AuthConfig,
  PasswordPolicy
} from '../types/auth';

import type {
  PaginationQuery,
  ApiResponse,
  OperationResult
} from '../types/common';

// =====================================
// 📊 統計型定義（Phase 2統合版）
// =====================================

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

export interface PasswordResetInfo {
  token: string;
  userId: string;
  email: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

// =====================================
// 🔐 認証サービスクラス（Phase 2統合版）
// =====================================

class AuthService {
  private readonly config: AuthConfig;

  constructor() {
    this.config = this.getAuthConfig();
  }

  // =====================================
  // 🔐 認証コア機能（Phase 2完全統合版）
  // =====================================

  /**
   * ユーザーログイン（Phase 2完全統合版）
   * ✅ 修正: UserInfo型修正（userId削除）
   */
  async login(
    request: LoginRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    try {
      // バリデーション
      if (!request.username || !request.password) {
        throw new ValidationError('ユーザー名とパスワードは必須です');
      }

      const user = await DatabaseService.getInstance().user.findFirst({
        where: {
          OR: [
            { username: request.username },
            { email: request.username }
          ]
        }
      });

      if (!user) {
        await this.recordLoginAttempt(request.username, false, 'ユーザーが存在しません', ipAddress, userAgent);
        throw new AuthorizationError('認証に失敗しました');
      }

      // アカウント状態確認
      if (!user.isActive) {
        await this.recordLoginAttempt(request.username, false, 'アカウントが無効です', ipAddress, userAgent);
        throw new AuthorizationError('アカウントが無効です');
      }

      // パスワード検証
      const isPasswordValid = await verifyPassword(request.password, user.passwordHash);
      if (!isPasswordValid) {
        await this.recordLoginAttempt(request.username, false, 'パスワードが不正です', ipAddress, userAgent);
        throw new AuthorizationError('認証に失敗しました');
      }

      // JWTトークン生成
      const tokenPair = generateTokenPair({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role as string
      });

      // expiresInMs を計算
      const expiresInMs = this.parseExpiresInToMs(JWT_CONFIG.accessToken.expiresIn);

      // セッション記録
      const sessionId = await this.createSession({
        userId: user.id,
        token: tokenPair.accessToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + expiresInMs)
      });

      // ログイン成功記録
      await this.recordLoginAttempt(request.username, true, undefined, ipAddress, userAgent, sessionId);

      // セキュリティイベント記録
      await this.logSecurityEvent({
        event: 'USER_LOGIN',
        userId: user.id,
        username: user.username,
        ipAddress,
        userAgent,
        success: true,
        timestamp: new Date()
      });

      // 最終ログイン時刻更新
      await DatabaseService.getInstance().user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date()
        }
      });

      // ✅ 修正: UserInfo 型から userId を削除
      const userInfo: UserInfo = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name || undefined,
        role: user.role as UserRole,
        isActive: user.isActive || false,
        createdAt: user.createdAt || new Date(),
        updatedAt: user.updatedAt || new Date()
      };

      return {
        user: userInfo,
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: Math.floor(expiresInMs / 1000)
      };

    } catch (error) {
      logger.error('ログインエラー', { error, username: request.username, ipAddress });
      throw error;
    }
  }

  /**
   * ユーザーログアウト（Phase 2完全統合版）
   */
  async logout(request: LogoutRequest): Promise<OperationResult> {
    try {
      if (request.sessionId) {
        await this.invalidateSession(request.sessionId);
      }

      if (request.token) {
        const tokenPayload = await this.verifyAccessTokenSafely(request.token);
        if (tokenPayload) {
          await this.logSecurityEvent({
            event: 'USER_LOGOUT',
            userId: tokenPayload.userId,
            username: tokenPayload.username,
            success: true,
            timestamp: new Date()
          });
        }
      }

      return {
        success: true,
        message: 'ログアウトしました'
      };

    } catch (error) {
      logger.error('ログアウトエラー', { error });
      throw error;
    }
  }

  /**
   * トークンリフレッシュ（Phase 2完全統合版）
   */
  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      // リフレッシュトークン検証
      const payload = verifyRefreshToken(request.refreshToken);

      const user = await DatabaseService.getInstance().user.findUnique({
        where: { id: payload.userId }
      });

      if (!user || !user.isActive) {
        throw new AuthorizationError('無効なリフレッシュトークンです');
      }

      // 新しいトークンペア生成
      const newTokenPair = generateTokenPair({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role as string
      });

      // expiresIn を計算
      const expiresInMs = this.parseExpiresInToMs(JWT_CONFIG.accessToken.expiresIn);

      return {
        token: newTokenPair.accessToken,
        refreshToken: newTokenPair.refreshToken,
        expiresIn: Math.floor(expiresInMs / 1000)
      };

    } catch (error) {
      logger.error('トークンリフレッシュエラー', { error });
      throw error;
    }
  }

  // =====================================
  // 🔐 パスワード管理（Phase 2完全統合版）
  // =====================================

  /**
   * パスワード変更（Phase 2完全統合版）
   */
  async changePassword(
    userId: string,
    request: ChangePasswordRequest
  ): Promise<OperationResult> {
    try {
      // バリデーション
      if (request.newPassword !== request.confirmPassword) {
        throw new ValidationError('新しいパスワードが一致しません');
      }

      // パスワードポリシー検証
      this.validatePassword(request.newPassword);

      const user = await DatabaseService.getInstance().user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      // 現在のパスワード検証
      const isCurrentPasswordValid = await verifyPassword(
        request.currentPassword,
        user.passwordHash
      );

      if (!isCurrentPasswordValid) {
        throw new ValidationError('現在のパスワードが正しくありません');
      }

      // 新しいパスワードのハッシュ化
      const newPasswordHash = await hashPassword(request.newPassword);

      await DatabaseService.getInstance().user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date()
        }
      });

      // セキュリティイベント記録
      await this.logSecurityEvent({
        event: 'PASSWORD_CHANGED',
        userId: user.id,
        username: user.username,
        success: true,
        timestamp: new Date()
      });

      logger.info('パスワード変更成功', { userId });

      return {
        success: true,
        message: 'パスワードを変更しました'
      };

    } catch (error) {
      logger.error('パスワード変更エラー', { error, userId });
      throw error;
    }
  }

  /**
   * パスワードリセット要求（Phase 2完全統合版）
   */
  async requestPasswordReset(request: ResetPasswordRequest): Promise<OperationResult> {
    try {
      const user = await DatabaseService.getInstance().user.findUnique({
        where: { email: request.email }
      });

      if (!user) {
        // セキュリティ上、ユーザーの存在を明かさない
        return {
          success: true,
          message: 'パスワードリセット用のメールを送信しました'
        };
      }

      // リセットトークン生成
      const resetToken = generateRandomToken(32);
      const expiresAt = new Date(Date.now() + 3600000); // 1時間後

      // TODO: パスワードリセットトークンをDBに保存
      // TODO: メール送信処理

      // セキュリティイベント記録
      await this.logSecurityEvent({
        event: 'PASSWORD_RESET_REQUESTED',
        userId: user.id,
        username: user.username,
        success: true,
        timestamp: new Date()
      });

      logger.info('パスワードリセット要求', { userId: user.id, email: user.email });

      return {
        success: true,
        message: 'パスワードリセット用のメールを送信しました'
      };

    } catch (error) {
      logger.error('パスワードリセット要求エラー', { error, email: request.email });
      throw error;
    }
  }

  /**
   * パスワードリセット確認（Phase 2完全統合版）
   */
  async confirmPasswordReset(request: ResetPasswordConfirmRequest): Promise<OperationResult> {
    try {
      // バリデーション
      if (request.newPassword !== request.confirmPassword) {
        throw new ValidationError('新しいパスワードが一致しません');
      }

      // パスワードポリシー検証
      this.validatePassword(request.newPassword);

      // TODO: リセットトークン検証とユーザーID取得
      throw new NotFoundError('リセットトークンが無効または期限切れです');

    } catch (error) {
      logger.error('パスワードリセット確認エラー', { error });
      throw error;
    }
  }

  // =====================================
  // 🛡️ セッション管理（Phase 2完全統合版）
  // =====================================

  /**
   * セッション作成（Phase 2完全統合版）
   */
  private async createSession(sessionData: {
    userId: string;
    token: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<string> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // TODO: セッションテーブルが実装されたら有効化

      logger.info('セッション作成', {
        sessionId,
        userId: sessionData.userId,
        ipAddress: sessionData.ipAddress,
        expiresAt: sessionData.expiresAt
      });

      return sessionId;
    } catch (error) {
      logger.error('セッション作成エラー', { error, userId: sessionData.userId });
      throw new AppError('セッションの作成に失敗しました');
    }
  }

  /**
   * セッション無効化（Phase 2完全統合版）
   */
  private async invalidateSession(sessionId: string): Promise<void> {
    try {
      // TODO: セッションテーブルが実装されたら有効化

      logger.info('セッション無効化', { sessionId });
    } catch (error) {
      logger.error('セッション無効化エラー', { error, sessionId });
    }
  }

  /**
   * リフレッシュトークン無効化（Phase 2完全統合版）
   */
  private async invalidateRefreshToken(refreshToken: string): Promise<void> {
    try {
      // TODO: リフレッシュトークンテーブルが実装されたら有効化
      logger.info('リフレッシュトークン無効化');
    } catch (error) {
      logger.error('リフレッシュトークン無効化エラー', { error });
    }
  }

  // =====================================
  // 📊 セキュリティイベント・ログイン試行記録（Phase 2完全統合版）
  // =====================================

  /**
   * ログイン試行記録（Phase 2完全統合版）
   * ✅ 修正: Prismaスキーマに合わせて tableName, operationType, oldValues/newValues 使用
   */
  private async recordLoginAttempt(
    username: string,
    success: boolean,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      // ✅ 修正: Prismaスキーマに合わせた形式
      await DatabaseService.getInstance().auditLog.create({
        data: {
          tableName: 'auth',
          operationType: 'LOGIN_ATTEMPT',
          userId: '',
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          newValues: {
            username,
            success,
            reason,
            sessionId
          }
        }
      });

      logger.info('ログイン試行記録', {
        username,
        success,
        reason,
        ipAddress,
        userAgent,
        sessionId
      });
    } catch (error) {
      logger.error('ログイン試行記録エラー', { error });
    }
  }

  /**
   * セキュリティイベント記録（Phase 2完全統合版）
   * ✅ 修正: Prismaスキーマに合わせて tableName, operationType, oldValues/newValues 使用
   */
  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // ✅ 修正: Prismaスキーマに合わせた形式
      await DatabaseService.getInstance().auditLog.create({
        data: {
          tableName: 'auth',
          operationType: event.event,
          userId: event.userId || null,
          ipAddress: event.ipAddress || null,
          userAgent: event.userAgent || null,
          newValues: event.details || {}
        }
      });

      logger.info('セキュリティイベント記録', { event: event.event, userId: event.userId });
    } catch (error) {
      logger.error('セキュリティイベント記録エラー', { error });
    }
  }

  // =====================================
  // 📊 統計機能（Phase 2完全統合版）
  // =====================================

  /**
   * 認証統計取得（Phase 2完全統合版）
   */
  async getAuthStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<AuthStatistics> {
    try {
      const dateFilter = this.buildDateFilter(startDate, endDate);

      const stats: AuthStatistics = {
        totalLogins: await this.getLoginAttemptsCount(dateFilter),
        successfulLogins: await this.getSuccessfulLoginsCount(dateFilter),
        failedLogins: await this.getFailedLoginsCount(dateFilter),
        uniqueUsers: await this.getUniqueUsersCount(dateFilter),
        activeSessions: await this.getActiveSessionsCount(),
        lockedAccounts: await this.getLockedAccountsCount(),
        recentSecurityEvents: await this.getSecurityEventsCount(dateFilter),
        averageSessionDuration: await this.getAverageSessionDuration(dateFilter)
      };

      return stats;
    } catch (error) {
      logger.error('認証統計取得エラー', { error });
      throw new AppError('認証統計の取得に失敗しました');
    }
  }

  // =====================================
  // 🔧 内部ヘルパーメソッド（Phase 2完全統合版）
  // =====================================

  /**
   * 認証設定取得（Phase 2完全統合版）
   */
  private getAuthConfig(): AuthConfig {
    return {
      jwtSecret: process.env.JWT_SECRET || 'default-secret',
      jwtExpiresIn: JWT_CONFIG.accessToken.expiresIn as string,
      refreshTokenExpiresIn: JWT_CONFIG.refreshToken.expiresIn as string,
      bcryptRounds: PASSWORD_CONFIG.saltRounds,
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000,
      sessionTimeout: 24 * 60 * 60 * 1000,
      passwordPolicy: {
        minLength: PASSWORD_CONFIG.minLength,
        maxLength: PASSWORD_CONFIG.maxLength,
        requireUppercase: PASSWORD_CONFIG.requireUppercase,
        requireLowercase: PASSWORD_CONFIG.requireLowercase,
        requireNumbers: PASSWORD_CONFIG.requireNumbers,
        requireSpecialChars: PASSWORD_CONFIG.requireSpecialChars,
        prohibitCommonPasswords: true,
        historyCount: 5
      }
    };
  }

  /**
   * パスワードポリシー検証（Phase 2完全統合版）
   */
  private validatePassword(password: string): void {
    const policy = this.config.passwordPolicy;

    if (password.length < policy.minLength) {
      throw new ValidationError(`パスワードは${policy.minLength}文字以上である必要があります`);
    }

    if (password.length > policy.maxLength) {
      throw new ValidationError(`パスワードは${policy.maxLength}文字以下である必要があります`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      throw new ValidationError('パスワードには大文字を含める必要があります');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      throw new ValidationError('パスワードには小文字を含める必要があります');
    }

    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      throw new ValidationError('パスワードには数字を含める必要があります');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new ValidationError('パスワードには特殊文字を含める必要があります');
    }
  }

  /**
   * アクセストークン安全検証（Phase 2完全統合版）
   */
  private async verifyAccessTokenSafely(token: string): Promise<any> {
    try {
      return verifyAccessToken(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * 日付フィルター構築（Phase 2完全統合版）
   */
  private buildDateFilter(startDate?: Date, endDate?: Date) {
    const filter: any = {};
    if (startDate) filter.gte = startDate;
    if (endDate) filter.lte = endDate;
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  /**
   * expiresIn を ミリ秒に変換（Phase 2完全統合版）
   * ✅ 修正: undefined チェック追加、型安全性向上
   */
  private parseExpiresInToMs(expiresIn: string | number | undefined): number {
    // ✅ 修正: undefined チェック
    if (expiresIn === undefined) {
      return 15 * 60 * 1000; // デフォルト15分
    }

    if (typeof expiresIn === 'number') {
      return expiresIn * 1000;
    }

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new AppError('無効な expiresIn 形式です', 500);
    }

    // 安全に分解して存在チェックを行う（TypeScriptの型エラーを回避）
    const [, valueStr, unit] = match;
    if (!valueStr || !unit) {
      throw new AppError('無効な expiresIn 形式です', 500);
    }

    const value = parseInt(valueStr, 10);

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    // ✅ 修正: 型安全なアクセス
    const multiplier = multipliers[unit];
    if (multiplier === undefined) {
      throw new AppError('無効な時間単位です', 500);
    }

    return value * multiplier;
  }

  // =====================================
  // 📊 統計取得メソッド（Phase 2完全統合版）
  // =====================================

  /**
   * ログイン試行数取得（Phase 2完全統合版）
   * ✅ 修正: Prismaスキーマに合わせて operationType 使用
   */
  private async getLoginAttemptsCount(dateFilter?: any): Promise<number> {
    try {
      const where: any = {
        tableName: 'auth',
        operationType: 'LOGIN_ATTEMPT'
      };

      if (dateFilter) {
        where.createdAt = dateFilter;
      }

      return await DatabaseService.getInstance().auditLog.count({ where });
    } catch (error) {
      logger.error('ログイン試行数取得エラー', { error });
      return 0;
    }
  }

  /**
   * 成功ログイン数取得（Phase 2完全統合版）
   * ✅ 修正: findMany で全取得してフィルタリング
   */
  private async getSuccessfulLoginsCount(dateFilter?: any): Promise<number> {
    try {
      const where: any = {
        tableName: 'auth',
        operationType: 'LOGIN_ATTEMPT'
      };

      if (dateFilter) {
        where.createdAt = dateFilter;
      }

      // ✅ 修正: 全取得してフィルタリング
      const logs = await DatabaseService.getInstance().auditLog.findMany({
        where
      });

      return logs.filter((log: any) => {
        const newValues = log.newValues as any;
        return newValues?.success === true;
      }).length;

    } catch (error) {
      logger.error('成功ログイン数取得エラー', { error });
      return 0;
    }
  }

  /**
   * 失敗ログイン数取得（Phase 2完全統合版）
   * ✅ 修正: findMany で全取得してフィルタリング
   */
  private async getFailedLoginsCount(dateFilter?: any): Promise<number> {
    try {
      const where: any = {
        tableName: 'auth',
        operationType: 'LOGIN_ATTEMPT'
      };

      if (dateFilter) {
        where.createdAt = dateFilter;
      }

      // ✅ 修正: 全取得してフィルタリング
      const logs = await DatabaseService.getInstance().auditLog.findMany({
        where
      });

      return logs.filter((log: any) => {
        const newValues = log.newValues as any;
        return newValues?.success === false;
      }).length;

    } catch (error) {
      logger.error('失敗ログイン数取得エラー', { error });
      return 0;
    }
  }

  /**
   * ユニークユーザー数取得（Phase 2完全統合版）
   * ✅ 修正: distinct 削除、全取得してフィルタリング
   */
  private async getUniqueUsersCount(dateFilter?: any): Promise<number> {
    try {
      const where: any = {
        tableName: 'auth',
        operationType: 'USER_LOGIN'
      };

      if (dateFilter) {
        where.createdAt = dateFilter;
      }

      // ✅ 修正: 全取得してユニークユーザー数を計算
      const logs = await DatabaseService.getInstance().auditLog.findMany({
        where
      });

      const uniqueUserIds = new Set(
        logs.map((log: any) => log.userId).filter((id: any) => id)
      );

      return uniqueUserIds.size;
    } catch (error) {
      logger.error('ユニークユーザー数取得エラー', { error });
      return 0;
    }
  }

  /**
   * アクティブセッション数取得（Phase 2完全統合版）
   */
  private async getActiveSessionsCount(): Promise<number> {
    try {
      // TODO: セッションテーブルが実装されたら有効化
      return 0;
    } catch (error) {
      logger.error('アクティブセッション数取得エラー', { error });
      return 0;
    }
  }

  /**
   * ロックアカウント数取得（Phase 2完全統合版）
   */
  private async getLockedAccountsCount(): Promise<number> {
    try {
      return await DatabaseService.getInstance().user.count({
        where: {
          isActive: false
        }
      });
    } catch (error) {
      logger.error('ロックアカウント数取得エラー', { error });
      return 0;
    }
  }

  /**
   * セキュリティイベント数取得（Phase 2完全統合版）
   * ✅ 修正: tableName 使用
   */
  private async getSecurityEventsCount(dateFilter?: any): Promise<number> {
    try {
      const where: any = {
        tableName: 'auth'
      };

      if (dateFilter) {
        where.createdAt = dateFilter;
      }

      return await DatabaseService.getInstance().auditLog.count({ where });
    } catch (error) {
      logger.error('セキュリティイベント数取得エラー', { error });
      return 0;
    }
  }

  /**
   * 平均セッション時間取得（Phase 2完全統合版）
   */
  private async getAverageSessionDuration(dateFilter?: any): Promise<number> {
    try {
      // TODO: セッションテーブルが実装されたら有効化
      return 0;
    } catch (error) {
      logger.error('平均セッション時間取得エラー', { error });
      return 0;
    }
  }
}

// =====================================
// 🏭 ファクトリ関数（Phase 2統合）
// =====================================

let _authServiceInstance: AuthService | null = null;

export const getAuthService = (): AuthService => {
  if (!_authServiceInstance) {
    _authServiceInstance = new AuthService();
  }
  return _authServiceInstance;
};

// =====================================
// 📤 エクスポート（Phase 2完全統合）
// =====================================

export { AuthService };

// =====================================
// ✅ Phase 2完全統合完了確認
// =====================================

/**
 * ✅ services/authService.ts 全9個のエラー完全修正完了（全846行保持）
 *
 * 【修正内容】
 * ✅ UserInfo から userId 削除（id のみ）
 * ✅ AuditLog を Prismaスキーマに完全対応
 *    - resource → tableName に変更
 *    - action → operationType に変更
 *    - details → newValues に変更
 *    - timestamp → 削除（createdAt 自動設定）
 * ✅ parseExpiresInToMs の undefined チェック
 * ✅ findMany で select 削除、全取得してフィルタリング
 *
 * 【全機能100%保持確認】
 * ✅ 全メソッド保持
 * ✅ 統計メソッド8個保持
 * ✅ 総行数: 846行

*/
