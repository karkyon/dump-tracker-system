// =====================================
// backend/src/types/auth.ts
// 認証・認可関連の型定義
// 作成日時: Tue Sep 16 10:05:28 AM JST 2025
// 最終更新: Fri Sep 26 16:45:00 JST 2025 - 完全アーキテクチャ改修対応
// アーキテクチャ指針準拠版 - Phase 1最終対応
// =====================================

import { Request } from 'express';

// 🎯 共通型のインポート
import type {
  ApiResponse,
  PaginationQuery
} from './common';

// types/index.ts経由でインポート（ハブ設計）
import { UserRole } from '@prisma/client'

// =====================================
// 認証済みリクエスト型（統一版）
// =====================================

/**
 * 認証済みリクエスト
 * 全コントローラー、ミドルウェアで統一使用
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * 認証済みユーザー情報
 * JWTペイロードから展開される標準ユーザー情報
 */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
}

// =====================================
// JWT関連型定義
// =====================================

/**
 * JWTペイロード
 * トークンに含まれる最小限の認証情報
 */
export interface JWTPayload {
  userId: string;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
  sub?: string;
}

/**
 * JWT設定
 */
export interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  issuer?: string;
  audience?: string;
}

// =====================================
// 認証・ログイン関連型
// =====================================

/**
 * ログインリクエスト
 */
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * ログインレスポンス
 */
export interface LoginResponse {
  user: UserInfo;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * ユーザー基本情報
 * ログイン後に返される安全なユーザー情報
 */
export interface UserInfo {
  id: string;
  username: string;
  email: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================
// ユーザー作成・管理関連型
// =====================================

/**
 * ユーザー作成リクエスト
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * ユーザー更新リクエスト
 */
export interface UpdateUserRequest {
  username?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

// =====================================
// パスワード関連型
// =====================================

/**
 * パスワード変更リクエスト
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * パスワードリセットリクエスト
 */
export interface ResetPasswordRequest {
  email: string;
}

/**
 * パスワードリセット確認リクエスト
 */
export interface ResetPasswordConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// =====================================
// トークン・セッション関連型
// =====================================

/**
 * リフレッシュトークンリクエスト
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * リフレッシュトークンレスポンス
 */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * ログアウトリクエスト
 */
export interface LogoutRequest {
  token?: string;
  sessionId?: string;
  logoutAll?: boolean;
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

// =====================================
// 権限・認可関連型
// =====================================

/**
 * 権限設定
 */
export interface RolePermissions {
  // ユーザー管理権限
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canUpdateUsers: boolean;
  canDeleteUsers: boolean;

  // 車両管理権限
  canViewVehicles: boolean;
  canCreateVehicles: boolean;
  canUpdateVehicles: boolean;
  canDeleteVehicles: boolean;

  // 運行管理権限
  canViewOperations: boolean;
  canCreateOperations: boolean;
  canUpdateOperations: boolean;
  canDeleteOperations: boolean;

  // レポート権限
  canViewReports: boolean;
  canExportReports: boolean;

  // システム設定権限
  canViewSystemSettings: boolean;
  canUpdateSystemSettings: boolean;

  // 監査ログ権限
  canViewAuditLogs: boolean;
}

/**
 * 権限チェックオプション
 */
export interface PermissionCheckOptions {
  userId: string;
  resource: string;
  action: string;
  resourceId?: string;
}

// =====================================
// 認証ミドルウェア関連型
// =====================================

/**
 * 認証ミドルウェアオプション
 */
export interface AuthMiddlewareOptions {
  optional?: boolean;
  requiredRole?: UserRole;
  requiredPermissions?: string[];
  allowInactive?: boolean;
}

// =====================================
// セキュリティ・監査関連型
// =====================================

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
 * ログイン試行情報
 */
export interface LoginAttempt {
  username: string;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  timestamp: Date;
}

// =====================================
// エラー関連型
// =====================================

/**
 * 認証エラー
 */
export interface AuthError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

/**
 * バリデーションエラー
 */
export interface AuthValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

// =====================================
// API レスポンス関連型
// =====================================

/**
 * 認証APIレスポンス
 */
export interface AuthApiResponse<T = any> extends ApiResponse<T> {
  user?: UserInfo;
  token?: string;
  refreshToken?: string;
  permissions?: RolePermissions;
}

/**
 * ユーザー一覧レスポンス
 */
export interface UserListResponse extends ApiResponse<UserInfo[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// =====================================
// フィルター・検索関連型
// =====================================

/**
 * ユーザー検索フィルター
 */
export interface UserFilter extends PaginationQuery {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  createdFrom?: string;
  createdTo?: string;
}

// =====================================
// 設定関連型
// =====================================

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

// =====================================
// ユーティリティ型
// =====================================

/**
 * パスワード除外ユーザー型
 */
export type UserWithoutPassword = Omit<UserModel, 'passwordHash'>;

/**
 * ユーザー作成データ（内部処理用）
 */
export type CreateUserData = Omit<CreateUserRequest, 'password'> & {
  passwordHash: string;
};

/**
 * 安全なユーザー型
 */
export type SafeUser = Pick<UserModel, 'id' | 'username' | 'email' | 'name' | 'role' | 'isActive' | 'createdAt' | 'updatedAt'>;

// =====================================
// 型ガード関数
// =====================================

/**
 * 認証済みリクエストの型ガード
 */
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return 'user' in req && req.user !== undefined;
}

/**
 * 特定ロールの型ガード
 */
export function hasRole(user: AuthenticatedUser, role: UserRole): boolean {
  return user.role === role;
}

/**
 * 管理者権限の型ガード
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'ADMIN';
}

/**
 * マネージャー以上権限の型ガード
 */
export function isManagerOrAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'ADMIN' || user.role === 'MANAGER';
}
