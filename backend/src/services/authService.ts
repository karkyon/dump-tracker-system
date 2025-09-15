import { PrismaClient, $Enums } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { 
  UserResponseDTO
} from '../models/UserModel';

const prisma = new PrismaClient();
type OperationType = $Enums.OperationType;

// ローカル型定義（既存機能保持のため）
interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  user: UserResponseDTO;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  name?: string | null;
  role?: 'ADMIN' | 'MANAGER' | 'DRIVER';
  isActive?: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ローカルエラークラス（既存機能保持のため）
class AuthenticationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class NotFoundError extends Error {
  constructor(resource?: string) {
    super(resource ? `${resource} not found` : 'Not found');
    this.name = 'NotFoundError';
  }
}

class DuplicateError extends Error {
  constructor(resource?: string) {
    super(resource ? `${resource} already exists` : 'Duplicate resource');
    this.name = 'DuplicateError';
  }
}

// 定数定義
const APP_CONSTANTS = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_TIME: 30
};

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: '無効な認証情報です',
  ACCOUNT_INACTIVE: 'アカウントが無効です',
  ACCOUNT_LOCKED: 'アカウントがロックされています'
};

const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'ログインに成功しました'
};

// ログ用の仮実装
const logger = {
  info: (message: string, data?: any) => console.log('[INFO]', message, data),
  error: (message: string, error?: any, data?: any) => console.error('[ERROR]', message, error, data),
  debug: (message: string, data?: any) => console.debug('[DEBUG]', message, data),
  warn: (message: string, data?: any) => console.warn('[WARN]', message, data)
};

// セッション ID 生成用
function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * 認証サービスクラス
 */
export class AuthService {
  /**
   * ユーザーログイン
   */
  async login(loginData: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { username, password } = loginData;
    const rememberMe: boolean = loginData.rememberMe ?? false;

    try {
      // ユーザーを取得
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          passwordHash: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        await this.logSecurityEvent('LOGIN_FAILED', { username, reason: 'User not found', ipAddress });
        throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
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
      const passwordHash = user.passwordHash;
      const isPasswordValid = await bcrypt.compare(password, passwordHash);

      if (!isPasswordValid) {
        await this.handleFailedLogin(String(user.id), String(username), ipAddress);
        throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // ログイン成功時の処理
      await this.handleSuccessfulLogin(String(user.id));

      // JWTトークンを生成
      const tokenExpiry = rememberMe ? '7d' : '24h';
      const token = this.generateToken({
        userId: String(user.id),
        username: String(user.username),
        role: String(user.role),
      }, tokenExpiry);

      const refreshToken = this.generateRefreshToken(String(user.id));

      // セッションを保存
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000));

      try {
        await (prisma as any).refreshToken?.create({
          data: {
            userId: user.id,
            token: refreshToken,
            expiresAt,
          },
        });
      } catch (error) {
        // RefreshTokenテーブルが存在しない場合は無視
        logger.debug('RefreshToken table not found, skipping token storage', error);
      }

      // セッション作成
      const sessionId = generateSessionId();
      try {
        await (prisma as any).userSession?.create({
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
      } catch (error) {
        // UserSessionテーブルが存在しない場合は無視
        logger.debug('UserSession table not found, skipping session storage', error);
      }

      // ログイン成功をログに記録
      await this.logSecurityEvent('LOGIN_SUCCESS', { userId: user.id, username, ipAddress });

      // レスポンス用のユーザー情報（パスワードを除外）
      const { passwordHash: _, ...userInfo } = user;
      
      const userResponseDTO: UserResponseDTO = {
        ...userInfo,
        name: userInfo.name || '',
        role: userInfo.role || 'DRIVER',
        isActive: userInfo.isActive ?? true,
        createdAt: userInfo.createdAt ?? new Date(),
        updatedAt: userInfo.updatedAt ?? new Date(),
        passwordHash: '',
        employeeId: null,
        phone: null,
        passwordChangedAt: null
      };

      const response: LoginResponse = {
        user: userResponseDTO,
        token,
        refreshToken,
        expiresIn: rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60,
      };

      return response;

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
      let payload: JWTPayload;
      try {
        payload = jwt.verify(refreshToken, process.env.JWT_SECRET!) as JWTPayload;
      } catch (error) {
        throw new AuthenticationError('無効なリフレッシュトークンです');
      }

      // データベースでリフレッシュトークンを確認
      let storedToken;
      try {
        storedToken = await (prisma as any).refreshToken?.findFirst({
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
      } catch (error) {
        // RefreshTokenテーブルが存在しない場合は、JWTの検証のみで進行
        logger.debug('RefreshToken table not found, relying on JWT verification only');
      }

      // ユーザーの存在確認
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new AuthenticationError('無効なリフレッシュトークンです');
      }

      // 新しいトークンを生成
      const newAccessToken = this.generateToken({
        userId: String(user.id),
        username: user.username,
        role: String(user.role)
      }, '24h');

      const newRefreshToken = this.generateRefreshToken(String(user.id));

      // 古いリフレッシュトークンを無効化
      if (storedToken) {
        try {
          await (prisma as any).refreshToken?.update({
            where: { id: storedToken.id },
            data: { isRevoked: true }
          });
        } catch (error) {
          logger.debug('Failed to revoke old refresh token', error);
        }
      }

      // 新しいリフレッシュトークンを保存
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      try {
        await (prisma as any).refreshToken?.create({
          data: {
            userId: user.id,
            token: newRefreshToken,
            expiresAt
          }
        });
      } catch (error) {
        logger.debug('Failed to store new refresh token', error);
      }

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
        try {
          await (prisma as any).userSession?.updateMany({
            where: { userId },
            data: { isActive: false },
          });
        } catch (error) {
          logger.debug('UserSession table not found for logout all', error);
        }
        
        // 全リフレッシュトークンを無効化
        try {
          await (prisma as any).refreshToken?.updateMany({
            where: { userId, isRevoked: false },
            data: { isRevoked: true },
          });
        } catch (error) {
          logger.debug('RefreshToken table not found for logout all', error);
        }
        
        logger.info('全セッションからログアウト', { userId });
      } else {
        // 指定されたセッションのみ無効化
        if (sessionId) {
          try {
            await (prisma as any).userSession?.updateMany({
              where: {
                userId,
                sessionId,
                isActive: true
              },
              data: { isActive: false },
            });
          } catch (error) {
            logger.debug('Failed to deactivate session by sessionId', error);
          }
        } else if (token) {
          try {
            await (prisma as any).userSession?.updateMany({
              where: {
                userId,
                token,
                isActive: true
              },
              data: { isActive: false },
            });
          } catch (error) {
            logger.debug('Failed to deactivate session by token', error);
          }
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
        select: { id: true, passwordHash: true, username: true },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
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
        data: { passwordHash: hashedNewPassword },
      });

      // セキュリティのため、他のセッションを無効化
      try {
        await (prisma as any).userSession?.updateMany({
          where: { userId },
          data: { isActive: false },
        });
      } catch (error) {
        logger.debug('Failed to deactivate sessions after password change', error);
      }

      // リフレッシュトークンも無効化
      try {
        await (prisma as any).refreshToken?.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true },
        });
      } catch (error) {
        logger.debug('Failed to revoke refresh tokens after password change', error);
      }

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
  async createUser(userData: CreateUserRequest, creatorId: string): Promise<UserResponseDTO> {
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
          passwordHash: hashedPassword,
          name: name ?? '',
          role: (role ?? 'DRIVER') as any,
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

      const userResponseDTO: UserResponseDTO = {
        ...newUser,
        name: newUser.name ?? '',
        role: newUser.role ?? 'DRIVER',
        isActive: newUser.isActive ?? true,
        createdAt: newUser.createdAt ?? new Date(),
        updatedAt: newUser.updatedAt ?? new Date(),
        passwordHash: '',
        employeeId: null,
        phone: null,
        lastLoginAt: null,
        passwordChangedAt: null
      };

      return userResponseDTO;

    } catch (error) {
      logger.error('ユーザー作成エラー', error, { username, email, creatorId });
      throw error;
    }
  }

  /**
   * セッション検証
   */
  async validateSession(token: string): Promise<UserResponseDTO | null> {
    try {
      // JWTトークンを検証
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

      // セッションの存在確認
      let session;
      try {
        session = await (prisma as any).userSession?.findFirst({
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
      } catch (error) {
        logger.debug('UserSession table not found, validating with JWT only', error);
      }

      // セッションが存在する場合はセッションのユーザー情報を使用
      if (session && session.user && session.user.isActive) {
        const userResponseDTO: UserResponseDTO = {
          ...session.user,
          name: session.user.name ?? '',
          role: session.user.role ?? 'DRIVER',
          isActive: session.user.isActive ?? true,
          createdAt: session.user.createdAt ?? new Date(),
          updatedAt: session.user.updatedAt ?? new Date(),
        };
        return userResponseDTO;
      }

      // セッションがない場合は、JWTからユーザーを取得
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
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

      if (!user || !user.isActive) {
        return null;
      }

      const userResponseDTO: UserResponseDTO = {
        ...user,
        name: user.name ?? '',
        role: user.role ?? 'DRIVER',
        isActive: user.isActive ?? true,
        createdAt: user.createdAt ?? new Date(),
        updatedAt: user.updatedAt ?? new Date(),
        passwordHash: '',
        employeeId: null,
        phone: null,
        lastLoginAt: null,
        passwordChangedAt: null
      };

      return userResponseDTO;

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
      // 基本的なユーザー更新（loginAttemptsとlockedUntilフィールドがない場合は無視）
      await prisma.user.update({
        where: { id: userId },
        data: {},
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
  private generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string | number = '24h'): string {
    const secret = process.env.JWT_SECRET as jwt.Secret | undefined;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    const options: jwt.SignOptions = { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] };
    return jwt.sign(payload as string | object | Buffer, secret, options);
  }

  /**
   * セキュリティイベントを操作タイプにマッピング
   */
  private mapToOperationType(event: string): OperationType {
    const eventMap: Record<string, OperationType> = {
      'LOGIN_SUCCESS': 'AUTH',
      'LOGIN_FAILED': 'AUTH', 
      'PASSWORD_CHANGED': 'AUTH',
      'ACCOUNT_LOCKED': 'AUTH',
      'ACCOUNT_UNLOCKED': 'AUTH',
      'LOGOUT': 'AUTH'
    };
    
    return eventMap[event] || 'SYSTEM';
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
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        name: true,
        role: true,
        employeeId: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return;

    await this.logSecurityEvent('LOGIN_FAILED', { 
      userId, 
      username, 
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
        lastLoginAt: new Date(),
      },
    });

    await this.logSecurityEvent('LOGIN_SUCCESS_MAINT', { userId });
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
            tableName: 'AUTH',
            operationType: this.mapToOperationType(event),
            recordId: details.userId || null,
            userId: details.userId || null,
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
      let deletedSessions = { count: 0 };
      let deletedTokens = { count: 0 };

      try {
        deletedSessions = await (prisma as any).userSession?.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: new Date() } },
              { isActive: false }
            ]
          },
        }) || { count: 0 };
      } catch (error) {
        logger.debug('UserSession cleanup failed', error);
      }

      try {
        deletedTokens = await (prisma as any).refreshToken?.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: new Date() } },
              { isRevoked: true }
            ]
          },
        }) || { count: 0 };
      } catch (error) {
        logger.debug('RefreshToken cleanup failed', error);
      }

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