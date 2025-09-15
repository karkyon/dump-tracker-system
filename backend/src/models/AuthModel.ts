// =====================================
// AuthModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:22 PM JST 2025
// テーブルアクセサ: auth (認証関連型定義)
// =====================================

import { Request } from 'express';

// =====================================
// 基本型定義
// =====================================

// ログインリクエストの型定義
export interface AuthLoginRequest {
  username: string;
  password: string;
}

// ログインレスポンスの型定義  
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

// JWTペイロードの型定義
export interface AuthJWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// 認証済みリクエストにユーザ情報を追加
export interface AuthenticatedRequest extends Request {
  user: AuthJWTPayload;
}

// =====================================
// 標準DTO（他のモデルと統一）
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
// 互換性のための型エイリアス
// =====================================

// 旧名称との互換性維持
export type LoginRequest = AuthLoginRequest;
export type LoginResponse = AuthLoginResponse;
export type JWTPayload = AuthJWTPayload;

// =====================================
// エクスポート
// =====================================

export type { AuthLoginRequest as default };