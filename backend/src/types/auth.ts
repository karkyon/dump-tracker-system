// =====================================
// types/auth.ts
// 認証・認可関連の型定義
// =====================================

import { Request } from 'express';

// =====================================
// 認証済みリクエスト型
// =====================================

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  };
}

// =====================================
// JWTペイロード型
// =====================================

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// =====================================
// ログイン関連型
// =====================================

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: UserInfo;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

// =====================================
// ユーザー作成関連型
// =====================================

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  name?: string | null;
  role?: 'ADMIN' | 'MANAGER' | 'DRIVER';
  isActive?: boolean;
}

// =====================================
// パスワード関連型
// =====================================

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordConfirmRequest {
  token: string;
  newPassword: string;
}

// =====================================
// セッション関連型
// =====================================

export interface SessionInfo {
  sessionId: string;
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  isActive: boolean;
}

// =====================================
// 権限・ロール関連型
// =====================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'DRIVER';

export interface RolePermissions {
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canUpdateUsers: boolean;
  canDeleteUsers: boolean;
  canViewVehicles: boolean;
  canCreateVehicles: boolean;
  canUpdateVehicles: boolean;
  canDeleteVehicles: boolean;
  canViewOperations: boolean;
  canCreateOperations: boolean;
  canUpdateOperations: boolean;
  canDeleteOperations: boolean;
  canViewReports: boolean;
  canViewSystemSettings: boolean;
  canUpdateSystemSettings: boolean;
}

// =====================================
// エラー関連型
// =====================================

export interface AuthError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// =====================================
// API レスポンス関連型
// =====================================

export interface AuthApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AuthError;
  message?: string;
  timestamp: string;
}

// =====================================
// ミドルウェア関連型
// =====================================

export interface AuthMiddlewareOptions {
  optional?: boolean;
  requiredRole?: UserRole;
  requiredPermissions?: string[];
}

// =====================================
// 監査ログ関連型
// =====================================

export interface SecurityEvent {
  event: string;
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
  timestamp: Date;
}

// =====================================
// リフレッシュトークン関連型
// =====================================

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

// =====================================
// ログアウト関連型
// =====================================

export interface LogoutRequest {
  token?: string;
  sessionId?: string;
  logoutAll?: boolean;
}

// =====================================
// ユーティリティ型
// =====================================

export type AuthenticatedUser = NonNullable<AuthenticatedRequest['user']>;

export type UserWithoutPassword = Omit<UserInfo, 'password'>;

export type CreateUserData = Omit<CreateUserRequest, 'password'> & {
  passwordHash: string;
};

// =====================================
// 設定関連型
// =====================================

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
}