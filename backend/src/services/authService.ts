import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { LoginRequest, LoginResponse, User, JwtPayload, CreateUserRequest } from '../types';
import { 
  AuthenticationError, 
  ValidationError, 
  DuplicateError,
  NotFoundError,
  BusinessLogicError 
} from '../utils/asyncHandler';
import { APP_CONSTANTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants';
import { logger } from '../middleware/logger';
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  generateRefreshToken,
  verifyRefreshToken,
  generateSessionId,
  generateRandomString
} from '../utils/crypto';

const prisma = new PrismaClient();

/**
 * 認証サービスクラス
 */
export class AuthService {
  /**
   * ユーザーログイン
   */
  async login(loginData: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { username, password, rememberMe = false } = loginData;

    try {
      // ユーザーを取得
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          password: true,
          name: true,
          role: true,
          isActive: true,
          loginAttempts: true,
          lockedUntil: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        await this.logSecurityEvent('LOGIN_FAILED', { username, reason: 'User not found', ipAddress });
        throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // アカウントロック状態をチェック
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const lockTimeRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
        await this.logSecurityEvent('LOGIN_BLOCKED', { 
          userId: user.id, 
          username, 
          lockTimeRemaining,
          ipAddress 
        });
        throw new AuthenticationError(
          `アカウントがロックされています。${lockTimeRemaining}分後に再試行してください。`
        );
      }

      // アカウント状態をチェック
      if (!user.isActive) {
        await this.logSecurityEvent('LOGIN_FAILED', { 
          userId: user.id, 
          username, 
          reason: 'Account inactive',
          ipAddress 
        });
        throw new AuthenticationError(ERROR_MESSAGES.ACCOUNT_INACTIVE);
      }

      // パスワードを検証
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        await this.handleFailedLogin(user.id, username, ipAddress);
        throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // ログイン成功時の処理
      await this.handleSuccessfulLogin(user.id);

      // JWTトークンを生成
      const tokenExpiry = rememberMe ? '7d' : '24h';
      const token = this.generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      }, tokenExpiry);

      const refreshToken = this.generateRefreshToken(user.id);

      // セッションを保存
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000));

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt,
        },
      });

      // セッション作成
      const sessionId = generateSessionId();
      await prisma.userSession.create({
        data: {
          userId: user.id,
          sessionId,
          token,
          ipAddress,
          userAgent,
          expiresAt,
          isActive: true,
        },
      });

      // ログイン成功をログに記録
      await this.logSecurityEvent('LOGIN_SUCCESS', { userId: user.id, username, ipAddress });

      // レスポンス用のユーザー情報（パスワードを除外）
      const { password: _, loginAttempts, lockedUntil, ...userInfo } = user;

      return {
        user: userInfo,
        token,
        refreshToken,
        expiresIn: rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60,
      };

    } catch (error) {
      logger.error('ログイン処理エラー', error, { username, ipAddress });
      throw error;
    }
  }

  /**
   * トークンリフレッシュ
   */
  async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      // リフレッシュトークンの検証
      let payload: JwtPayload;
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch (error) {
        throw new AuthenticationError('無効なリフレッシュトークンです');
      }

      // データベースでリフレッシュトークンを確認
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: payload.userId,
          isRevoked: false,
          expiresAt: {
            gte: new Date()
          }
        },
        include: {
          user: true
        }
      });

      if (!storedToken) {
        throw new AuthenticationError('無効なリフレッシュトークンです');
      }

      if (!storedToken.user.isActive) {
        throw new AuthenticationError(ERROR_MESSAGES.ACCOUNT_INACTIVE);
      }

      // 新しいトークンを生成
      const newAccessToken = this.generateToken({
        userId: storedToken.user.id,
        username: storedToken.user.username,
        role: storedToken.user.role
      }, '24h');

      const newRefreshToken = this.generateRefreshToken(storedToken.user.id);

      // 古いリフレッシュトークンを無効化
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true }
      });

      // 新しいリフレッシュトークンを保存
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          userId: storedToken.user.id,
          token: newRefreshToken,
          expiresAt
        }
      });

      return {
        token: newAccessToken,
        refreshToken: newRefreshToken
      };

    } catch (error) {
      logger.error('トークンリフレッシュエラー', error);
      throw error;
    }
  }

  /**
   * ログアウト
   */
  async logout(userId: string, token?: string, sessionId?: string, logoutAll: boolean = false): Promise<void> {
    try {
      if (logoutAll) {
        // 全セッションを無効化
        await prisma.userSession.updateMany({
          where: { userId },
          data: { isActive: false },
        });
        
        // 全リフレッシュトークンを無効化
        await prisma.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true },
        });
        
        logger.info('全セッションからログアウト', { userId });
      } else {
        // 指定されたセッションのみ無効化
        if (sessionId) {
          await prisma.userSession.updateMany({
            where: {
              userId,
              sessionId,
              isActive: true
            },
            data: { isActive: false },
          });
        } else if (token) {
          await prisma.userSession.updateMany({
            where: {
              userId,
              token,
              isActive: true
            },
            data: { isActive: false },
          });
        }
        
        logger.info('セッションからログアウト', { userId, sessionId });
      }

      await this.logSecurityEvent('LOGOUT', { userId, logoutAll });

    } catch (error) {
      logger.error('ログアウト処理エラー', error, { userId });
      throw error;
    }
  }

  /**
   * パスワード変更
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true, username: true },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        await this.logSecurityEvent('PASSWORD_CHANGE_FAILED', { 
          userId, 
          reason: 'Invalid current password' 
        });
        throw new AuthenticationError('現在のパスワードが正しくありません');
      }

      // 新しいパスワードをハッシュ化
      const hashedNewPassword = await this.hashPassword(newPassword);

      // パスワードを更新
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      // セキュリティのため、他のセッションを無効化
      await prisma.userSession.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      // リフレッシュトークンも無効化
      await prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });

      await this.logSecurityEvent('PASSWORD_CHANGED', { userId });
      logger.info('パスワード変更成功', { userId });

    } catch (error) {
      logger.error('パスワード変更エラー', error, { userId });
      throw error;
    }
  }

  /**
   * ユーザー作成（管理者用）
   */
  async createUser(userData: CreateUserRequest, creatorId: string): Promise<User> {
    const { username, email, password, name, role, isActive = true } = userData;

    try {
      // 既存ユーザーチェック
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username },
            { email },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.username === username) {
          throw new DuplicateError('ユーザー名');
        }
        if (existingUser.email === email) {
          throw new DuplicateError('メールアドレス');
        }
      }

      // パスワードをハッシュ化
      const hashedPassword = await this.hashPassword(password);

      // ユーザーを作成
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          name,
          role,
          isActive,
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('ユーザー作成成功', { userId: newUser.id, username, creatorId });

      return newUser;

    } catch (error) {
      logger.error('ユーザー作成エラー', error, { username, email, creatorId });
      throw error;
    }
  }

  /**
   * セッション検証
   */
  async validateSession(token: string): Promise<User | null> {
    try {
      // JWTトークンを検証
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      // セッションの存在確認
      const session = await prisma.userSession.findFirst({
        where: { 
          token,
          isActive: true,
          expiresAt: { gte: new Date() }
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!session || !session.user.isActive) {
        return null;
      }

      return session.user;

    } catch (error) {
      logger.debug('セッション検証失敗', error);
      return null;
    }
  }

  /**
   * アカウントロック解除
   */
  async unlockAccount(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
        },
      });

      await this.logSecurityEvent('ACCOUNT_UNLOCKED', { userId });
      logger.info('アカウントロック解除', { userId });

    } catch (error) {
      logger.error('アカウントロック解除エラー', error, { userId });
      throw error;
    }
  }

  // ============================================================================
  // プライベートメソッド
  // ============================================================================

  /**
   * JWTトークンを生成
   */
  private generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresIn: string = '24h'): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn });
  }

  /**
   * リフレッシュトークンを生成
   */
  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  }

  /**
   * パスワードをハッシュ化
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * ログイン失敗時の処理
   */
  private async handleFailedLogin(userId: string, username: string, ipAddress?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { loginAttempts: true },
    });

    if (!user) return;

    const newLoginAttempts = user.loginAttempts + 1;
    const updateData: any = { loginAttempts: newLoginAttempts };

    // ログイン試行回数が上限に達した場合、アカウントをロック
    if (newLoginAttempts >= APP_CONSTANTS.MAX_LOGIN_ATTEMPTS) {
      const lockDuration = APP_CONSTANTS.LOCKOUT_TIME_MINUTES * 60 * 1000;
      updateData.lockedUntil = new Date(Date.now() + lockDuration);

      await this.logSecurityEvent('ACCOUNT_LOCKED', { 
        userId, 
        username, 
        attempts: newLoginAttempts,
        lockDurationMinutes: APP_CONSTANTS.LOCKOUT_TIME_MINUTES,
        ipAddress
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await this.logSecurityEvent('LOGIN_FAILED', { 
      userId, 
      username, 
      attempts: newLoginAttempts,
      ipAddress 
    });
  }

  /**
   * ログイン成功時の処理
   */
  private async handleSuccessfulLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * セキュリティイベントをログに記録
   */
  private async logSecurityEvent(event: string, details: any): Promise<void> {
    logger.warn(`セキュリティイベント: ${event}`, details);
    
    // 重要なセキュリティイベントは監査ログにも記録
    if (['LOGIN_FAILED', 'ACCOUNT_LOCKED', 'PASSWORD_CHANGED'].includes(event)) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: details.userId || null,
            action: event,
            resource: 'AUTH',
            resourceId: details.userId || null,
            newValues: details,
            ipAddress: details.ipAddress || null,
            userAgent: details.userAgent || null,
          },
        });
      } catch (error) {
        logger.error('監査ログ記録エラー', error);
      }
    }
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const deletedSessions = await prisma.userSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isActive: false }
          ]
        },
      });

      const deletedTokens = await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isRevoked: true }
          ]
        },
      });

      if (deletedSessions.count > 0 || deletedTokens.count > 0) {
        logger.info(`期限切れセッションを削除しました`, { 
          sessions: deletedSessions.count,
          tokens: deletedTokens.count
        });
      }
    } catch (error) {
      logger.error('期限切れセッションクリーンアップエラー', error);
    }
  }
}

// デフォルトエクスポート
export const authService = new AuthService();