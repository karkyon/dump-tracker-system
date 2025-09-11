import { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import config from '../config/environment';
import logger from '../utils/logger';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

// JWT トークン生成関数を追加
const generateAccessToken = (payload: any, secret: string, options: any) => {
  return jwt.sign(payload, secret, options);
};

// jwtConfig オブジェクトを追加
const jwtConfig = {
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'refresh-secret'
  }
};

// ログイン
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'ユーザー名とパスワードが必要です',
        error: 'MISSING_CREDENTIALS'
      });
      return;
    }

    // ユーザー検索（Prismaを使用）
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ],
        is_active: true
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: '認証に失敗しました',
        error: 'INVALID_CREDENTIALS'
      });
      return;
    }

    // パスワード確認
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      // ログイン試行回数更新
      await prisma.user.update({
        where: { id: user.id },
        data: {
          // failed_login_attempts: (user.failed_login_attempts || 0) + 1,
          // locked_until: 必要に応じて実装
        }
      });

      res.status(401).json({
        success: false,
        message: '認証に失敗しました',
        error: 'INVALID_CREDENTIALS'
      });
      return;
    }

    // ログイン成功時の処理
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // failed_login_attempts: 0,
        // locked_until: null,
        last_login_at: new Date()
      }
    });

    // JWTトークン生成
    const accessToken = generateAccessToken(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    const refreshToken = generateAccessToken(
      { userId: user.id },
      jwtConfig.refreshToken.secret,
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    // リフレッシュトークンをデータベースに保存（セッション管理）
    // 注意: user_sessionsテーブルが存在する場合のみ有効
    try {
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      // await prisma.userSession.create({
      //   data: {
      //     user_id: user.id,
      //     refresh_token_hash: refreshTokenHash,
      //     ip_address: req.ip,
      //     user_agent: req.get('User-Agent'),
      //     expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日後
      //   }
      // });
    } catch (sessionError) {
      logger.warn('Session creation failed:', sessionError);
      // セッション作成に失敗してもログインは続行
    }

    logger.info(`User logged in: ${user.username}`, { userId: user.id, ip: req.ip });

    res.json({
      success: true,
      message: 'ログインに成功しました',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Login error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'ログイン処理でエラーが発生しました',
      error: 'LOGIN_ERROR'
    });
  }
};

// 現在のユーザー情報取得
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        employee_id: true,
        phone: true,
        created_at: true,
        last_login_at: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get current user error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'ユーザー情報の取得でエラーが発生しました',
      error: 'USER_FETCH_ERROR'
    });
  }
};

// ログアウト
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken && req.user?.id) {
      // リフレッシュトークンを無効化
      // 注意: user_sessionsテーブルが存在する場合のみ有効
      try {
        // await prisma.userSession.updateMany({
        //   where: { user_id: req.user.id },
        //   data: { is_active: false }
        // });
      } catch (sessionError) {
        logger.warn('Session invalidation failed:', sessionError);
        // セッション無効化に失敗してもログアウトは続行
      }
    }

    logger.info(`User logged out: ${req.user?.username}`, { userId: req.user?.id });

    res.json({
      success: true,
      message: 'ログアウトしました'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Logout error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'ログアウト処理でエラーが発生しました',
      error: 'LOGOUT_ERROR'
    });
  }
};

// リフレッシュトークン
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: 'リフレッシュトークンが必要です',
        error: 'MISSING_REFRESH_TOKEN'
      });
      return;
    }

    // リフレッシュトークン検証
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshToken.secret) as any;
    
    // セッション確認（user_sessionsテーブルが存在する場合）
    // const sessionResult = await prisma.userSession.findFirst({
    //   where: {
    //     user_id: decoded.userId,
    //     is_active: true,
    //     expires_at: {
    //       gte: new Date()
    //     }
    //   },
    //   include: {
    //     user: true
    //   }
    // });

    // 簡易実装: ユーザー存在確認のみ
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        message: '無効なリフレッシュトークンです',
        error: 'INVALID_REFRESH_TOKEN'
      });
      return;
    }

    // 新しいアクセストークン生成
    const newAccessToken = generateAccessToken(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'トークンをリフレッシュしました',
      data: {
        accessToken: newAccessToken
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Refresh token error:', errorMessage);
    res.status(401).json({
      success: false,
      message: '無効なリフレッシュトークンです',
      error: 'INVALID_REFRESH_TOKEN'
    });
  }
};