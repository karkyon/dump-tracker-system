// =====================================
// backend/src/app.ts
// Express アプリケーション設定 - 完全アーキテクチャ改修統合版
// middleware層100%活用・企業レベル設定最適化・統合基盤連携・モバイル機能統合
// 最終更新: 2025年9月29日
// 依存関係: middleware/auth.ts, middleware/errorHandler.ts, middleware/validation.ts, utils層, config層
// 統合基盤: middleware層100%・utils層100%・config層100%・完成基盤連携
// =====================================

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// 🎯 完成済み7層統合基盤の100%活用（middleware層）
import { 
  authenticateToken,
  authorize,
  requireRole,
  requireAdmin,
  requireManager,
  requireDriver,
  optionalAuth,
  createRateLimiter
} from './middleware/auth';
import { 
  asyncHandler,
  errorHandler,
  globalErrorHandler,
  notFoundHandler,
  requestLogger,
  performanceLogger,
  auditLogger,
  securityLogger,
  getErrorStatistics
} from './middleware/errorHandler';
import { 
  validateRequest,
  validateId,
  validatePaginationQuery
} from './middleware/validation';
import { uploadMiddleware } from './middleware/upload';

// 🎯 完成済み統合基盤の100%活用（utils層）
import { 
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  SystemError,
  DatabaseError,
  ERROR_CODES
} from './utils/errors';
import { 
  sendSuccess,
  sendError,
  sendNotFound,
  sendValidationError,
  sendUnauthorized
} from './utils/response';
import logger from './utils/logger';
import { 
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  hashPassword,
  generateSecureHash
} from './utils/crypto';
import { DATABASE_SERVICE } from './utils/database';
import { APP_CONSTANTS, HTTP_STATUS, ERROR_MESSAGES } from './utils/constants';

// 🎯 完成済み統合基盤の100%活用（config層）
import { environmentConfig } from './config/environment';
import { databaseConfig } from './config/database';

// 🎯 統一型定義インポート（types層）
import type { AuthenticatedRequest } from './types';

// 🎯 モバイルルート統合（既存機能保持）
let mobileRoutes: any;
try {
  mobileRoutes = require('./routes/mobile').default || require('./routes/mobile');
} catch (error) {
  logger.warn('モバイルルート読み込み失敗 - フォールバック機能提供', { error: error instanceof Error ? error.message : String(error) });
  mobileRoutes = null;
}