// backend/src/config/jwt.ts
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { config } from './environment';

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  username: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

export const jwtConfig = {
  accessToken: {
    secret: config.JWT_SECRET,
    expiresIn: config.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256' as const,
    issuer: 'dump-truck-system',
    audience: 'dump-truck-users'
  },
  refreshToken: {
    secret: config.JWT_REFRESH_SECRET || config.JWT_SECRET,
    expiresIn: config.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256' as const,
    issuer: 'dump-truck-system',
    audience: 'dump-truck-users'
  }
};

export const generateAccessToken = (payload: JWTPayload): string => {
  const tokenPayload = {
    userId: payload.userId,
    username: payload.username,
    email: payload.email,
    role: payload.role
  };

  const options: SignOptions = {
    expiresIn: jwtConfig.accessToken.expiresIn,
    algorithm: jwtConfig.accessToken.algorithm,
    issuer: jwtConfig.accessToken.issuer,
    audience: jwtConfig.accessToken.audience,
    subject: payload.userId
  };

  return jwt.sign(tokenPayload, jwtConfig.accessToken.secret, options);
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  const tokenPayload = {
    userId: payload.userId,
    username: payload.username,
    tokenVersion: payload.tokenVersion || 0
  };

  const options: SignOptions = {
    expiresIn: jwtConfig.refreshToken.expiresIn,
    algorithm: jwtConfig.refreshToken.algorithm,
    issuer: jwtConfig.refreshToken.issuer,
    audience: jwtConfig.refreshToken.audience,
    subject: payload.userId
  };

  return jwt.sign(tokenPayload, jwtConfig.refreshToken.secret, options);
};

export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    const options: VerifyOptions = {
      algorithms: [jwtConfig.accessToken.algorithm],
      issuer: jwtConfig.accessToken.issuer,
      audience: jwtConfig.accessToken.audience
    };

    const decoded = jwt.verify(token, jwtConfig.accessToken.secret, options) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('無効なアクセストークンです');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new Error('アクセストークンの有効期限が切れています');
    } else {
      throw new Error('アクセストークンの検証に失敗しました');
    }
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const options: VerifyOptions = {
      algorithms: [jwtConfig.refreshToken.algorithm],
      issuer: jwtConfig.refreshToken.issuer,
      audience: jwtConfig.refreshToken.audience
    };

    const decoded = jwt.verify(token, jwtConfig.refreshToken.secret, options) as RefreshTokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('無効なリフレッシュトークンです');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new Error('リフレッシュトークンの有効期限が切れています');
    } else {
      throw new Error('リフレッシュトークンの検証に失敗しました');
    }
  }
};

export const generateTokenPair = (user: {
  id: string;
  username: string;
  email: string;
  role: string;
  tokenVersion?: number;
}) => {
  const accessToken = generateAccessToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
    username: user.username,
    tokenVersion: user.tokenVersion || 0
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: jwtConfig.accessToken.expiresIn,
    refreshTokenExpiresIn: jwtConfig.refreshToken.expiresIn
  };
};

// 安全なJWT設定検証（型エラー解消版）
export const validateJWTConfig = (): boolean => {
  const errors: string[] = [];

  // 基本的な設定チェック
  if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET は32文字以上である必要があります');
  }

  if (jwtConfig.refreshToken.secret === config.JWT_SECRET && !config.JWT_REFRESH_SECRET) {
    console.warn('警告: JWT_REFRESH_SECRETが設定されていません。JWT_SECRETを使用します。');
  }

  // 設定値の簡単な検証（型安全）
  const timeFormats = ['s', 'm', 'h', 'd'];
  const accessExpiresIn = jwtConfig.accessToken.expiresIn;
  const refreshExpiresIn = jwtConfig.refreshToken.expiresIn;

  if (typeof accessExpiresIn === 'string') {
    const hasValidFormat = timeFormats.some(format => accessExpiresIn.endsWith(format));
    if (!hasValidFormat && isNaN(Number(accessExpiresIn))) {
      errors.push(`不正なJWT_EXPIRES_IN: ${accessExpiresIn}`);
    }
  }

  if (typeof refreshExpiresIn === 'string') {
    const hasValidFormat = timeFormats.some(format => refreshExpiresIn.endsWith(format));
    if (!hasValidFormat && isNaN(Number(refreshExpiresIn))) {
      errors.push(`不正なJWT_REFRESH_EXPIRES_IN: ${refreshExpiresIn}`);
    }
  }

  if (errors.length > 0) {
    console.error('JWT設定エラー:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  console.log('JWT設定は正常です');
  return true;
};

// 起動時の設定検証
validateJWTConfig();
