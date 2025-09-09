// backend/src/utils/crypto.ts
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { generateAccessToken, generateRefreshToken, JWTPayload, RefreshTokenPayload } from '../config/jwt';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: JWTPayload): string {
  return generateAccessToken(payload);
}

export function generateRefreshTokenCrypto(payload: RefreshTokenPayload): string {
  return generateRefreshToken(payload);
}

export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateSessionId(): string {
  return generateRandomToken(64);
}

export function generateRandomString(length: number = 32): string {
  return generateRandomToken(length);
}
