// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database';
import config from '../config/environment';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    email: string;
  };
}

// ログイン
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    const pool = getPool();

    // ユーザー検索
    const userResult = await pool.query(
      'SELECT id, username, email, name, role, password_hash, is_active, failed_login_attempts, locked_until FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'ユーザー名またはパスワードが正しくありません',
        error: 'INVALID_CREDENTIALS'
      });
      return;
    }

    const user = userResult.rows[0];

    // アカウントロック確認
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      res.status(423).json({
        success: false,
        message: 'アカウントがロックされています。しばらく待ってから再試行してください',
        error: 'ACCOUNT_LOCKED'
      });
      return;
    }

    // アクティブユーザー確認
    if (!user.is_active) {
      res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています',
        error: 'ACCOUNT_DISABLED'
      });
      return;
    }

    // パスワード検証
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // ログイン失敗回数を増加
      await pool.query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, locked_until = CASE WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL \'30 minutes\' ELSE NULL END WHERE id = $1',
        [user.id]
      );

      res.status(401).json({
        success: false,
        message: 'ユーザー名またはパスワードが正しくありません',
        error: 'INVALID_CREDENTIALS'
      });
      return;
    }

    // ログイン成功 - 失敗カウンターリセット
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

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

    // リフレッシュトークンをデータベースに保存
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await pool.query(
      'INSERT INTO user_sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [
        user.id,
        refreshTokenHash,
        req.ip,
        req.get('User-Agent'),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日後
      ]
    );

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
  } catch (error) {
    logger.error('Login error:', error);
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
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, username, email, name, role, employee_id, phone, created_at, last_login_at FROM users WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    res.json({
      success: true,
      data: { user: result.rows[0] }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
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
    
    if (refreshToken) {
      const pool = getPool();
      // リフレッシュトークンを無効化
      await pool.query(
        'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
        [req.user?.id]
      );
    }

    logger.info(`User logged out: ${req.user?.username}`, { userId: req.user?.id });

    res.json({
      success: true,
      message: 'ログアウトしました'
    });
  } catch (error) {
    logger.error('Logout error:', error);
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
    
    const pool = getPool();
    const sessionResult = await pool.query(
      'SELECT us.*, u.username, u.role FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.user_id = $1 AND us.is_active = true AND us.expires_at > NOW()',
      [decoded.userId]
    );

    if (sessionResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: '無効なリフレッシュトークンです',
        error: 'INVALID_REFRESH_TOKEN'
      });
      return;
    }

    // 新しいアクセストークン生成
    const session = sessionResult.rows[0];
    const newAccessToken = generateAccessToken(
      { 
        userId: session.user_id, 
        username: session.username, 
        role: session.role 
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    // セッション更新
    await pool.query(
      'UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1',
      [session.id]
    );

    res.json({
      success: true,
      message: 'トークンが更新されました',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'トークンの更新に失敗しました',
      error: 'TOKEN_REFRESH_ERROR'
    });
  }
};

export default { login, getCurrentUser, logout, refreshToken };
