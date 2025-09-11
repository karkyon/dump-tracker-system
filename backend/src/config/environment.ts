// backend/src/config/environment.ts
import * as dotenv from 'dotenv';

dotenv.config();

export interface Config {
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  MAX_FILE_SIZE: number;
  UPLOAD_DIR: string;
  TEMP_PATH: string;
  REPORT_PATH: string;
  BACKUP_PATH: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  REDIS_URL?: string;
  LOG_LEVEL: string;
  LOG_FILE?: string;
  CORS_ORIGIN: string;
  SESSION_SECRET: string;
  API_RATE_LIMIT: number;
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config: Config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseNumber(process.env.PORT, 3000),
  HOST: process.env.HOST || '0.0.0.0',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/dump_tracker',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key-32-characters-long',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback-refresh-secret-32-characters-long',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  MAX_FILE_SIZE: parseNumber(process.env.MAX_FILE_SIZE, 10 * 1024 * 1024),
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  TEMP_PATH: process.env.TEMP_PATH || './temp',
  REPORT_PATH: process.env.REPORT_PATH || './reports',
  BACKUP_PATH: process.env.BACKUP_PATH || './backups',
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseNumber(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@dump-tracker.com',
  REDIS_URL: process.env.REDIS_URL,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  SESSION_SECRET: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-session-secret',
  API_RATE_LIMIT: parseNumber(process.env.API_RATE_LIMIT, 100)
};

export default config;
