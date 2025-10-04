// =====================================
// backend/src/utils/logger.ts
// ロギングユーティリティ - Phase 1-B-2完全改修版
// 既存完全実装100%保持 + Phase 1-B-2機能追加版
// 最終更新: 2025年9月30日
// 依存関係: なし（基底層）
// Phase 1-B-2: logger export・setUserId・getStatistics・getHealthStatus実装
// =====================================

import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// 🎯 既存完全実装の統合・活用
import { ValidationError, AppError } from './errors';

// 🎯 types/からの統一型定義インポート  
import type {
  ApiResponse,
  PaginationQuery,
  OperationResult,
  ValidationResult
} from '../types/common';

// 🎯 認証型との統合
import type { AuthenticatedRequest } from '../types/auth';

// =====================================
// 🏷️ ログレベル・定数定義
// =====================================

/**
 * ログレベル列挙型（既存互換性保持）
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  HTTP = 3,
  DEBUG = 4,
}

/**
 * ログレベル文字列定義（既存互換性保持）
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  DEBUG: 'debug',
} as const;

/**
 * ログカテゴリ定義
 */
export enum LogCategory {
  APPLICATION = 'application',
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  GPS = 'gps',
  OPERATION = 'operation',
  AUDIT = 'audit',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ERROR = 'error',
  ACCESS = 'access',
  SYSTEM = 'system',
}

/**
 * ログ設定定数
 */
export const LOG_CONFIG = {
  MAX_FILE_SIZE: '20m',
  MAX_FILES: '14d',
  DATE_PATTERN: 'YYYY-MM-DD',
  DEFAULT_LEVEL: 'info',
  ROTATION_FREQUENCY: 'daily',
  PERFORMANCE_THRESHOLD_MS: 1000,
  SLOW_QUERY_THRESHOLD_MS: 2000,
  COMPRESS_ROTATED: true,
} as const;

// =====================================
// 🏗️ ログエントリ型定義
// =====================================

/**
 * 基本ログエントリ型
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  category?: LogCategory;
  data?: any;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  traceId?: string;
  sessionId?: string;
  operationId?: string;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string | number;
  };
  metadata?: Record<string, any>;
}

/**
 * 監査ログエントリ型
 */
export interface AuditLogEntry extends LogEntry {
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  reason?: string;
}

/**
 * セキュリティログエントリ型
 */
export interface SecurityLogEntry extends LogEntry {
  event: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  target?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'UNKNOWN';
  details?: Record<string, any>;
}

/**
 * パフォーマンスログエントリ型
 */
export interface PerformanceLogEntry extends LogEntry {
  operationType: string;
  duration: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  queryCount?: number;
  cacheHits?: number;
  cacheMisses?: number;
}

/**
 * 🆕 ログ統計情報型（Phase 1-B-2追加）
 */
export interface LogStatistics {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByCategory: Record<string, number>;
  errorRate: number;
  averageResponseTime?: number;
  lastLogTime?: string;
  startTime: string;
  uptime: number;
}

/**
 * 🆕 ログヘルスステータス型（Phase 1-B-2追加）
 */
export interface LogHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  logSystemOperational: boolean;
  fileWriteOperational: boolean;
  lastWriteTime?: string;
  errorCount: number;
  warningCount: number;
  details?: string;
}

// =====================================
// 🗂️ ログディレクトリ・ファイル管理
// =====================================

/**
 * ログディレクトリの確保（既存実装保持）
 */
const logDir = path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (error) {
  console.warn('Failed to create log directory:', error);
}

/**
 * ログファイルパスの生成
 */
export function getLogFilePath(logType: string, category?: LogCategory): string {
  const categoryPrefix = category ? `${category}.` : '';
  return path.join(logDir, `${categoryPrefix}${logType}.log`);
}

/**
 * ログファイルの存在確認とディレクトリ作成
 */
export function ensureLogDirectory(subDir?: string): string {
  const targetDir = subDir ? path.join(logDir, subDir) : logDir;
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
  } catch (error) {
    console.warn(`Failed to create log directory: ${targetDir}`, error);
    return logDir;
  }
}

// =====================================
// 🎨 ログフォーマット定義（既存実装保持）
// =====================================

/**
 * 環境に応じたログレベル設定（既存実装保持）
 */
const level = (): string => {
  const env = process.env.NODE_ENV || 'development';
  const configLevel = process.env.LOG_LEVEL?.toLowerCase();
  
  if (configLevel && Object.values(LOG_LEVELS).includes(configLevel as any)) {
    return configLevel;
  }
  
  return env === 'development' ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
};

/**
 * winston用レベル定義（既存実装保持）
 */
const levels = {
  [LOG_LEVELS.ERROR]: 0,
  [LOG_LEVELS.WARN]: 1,
  [LOG_LEVELS.INFO]: 2,
  [LOG_LEVELS.HTTP]: 3,
  [LOG_LEVELS.DEBUG]: 4,
};

/**
 * winston用カラー設定（既存実装保持）
 */
const colors = {
  [LOG_LEVELS.ERROR]: 'red',
  [LOG_LEVELS.WARN]: 'yellow',
  [LOG_LEVELS.INFO]: 'green',
  [LOG_LEVELS.HTTP]: 'magenta',
  [LOG_LEVELS.DEBUG]: 'white',
};

winston.addColors(colors);

/**
 * 構造化ログフォーマット（既存実装保持・拡張）
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.json()
);

/**
 * コンソール用フォーマット（既存実装保持・拡張）
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, category, traceId, ...meta }) => {
    const categoryStr = category ? `[${category.toUpperCase()}]` : '';
    const traceStr = traceId ? `[${traceId.slice(0, 8)}]` : '';
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${categoryStr}${traceStr} [${level}]: ${message} ${metaStr}`;
  })
);

// =====================================
// 🚀 トランスポート設定（既存実装保持・拡張）
// =====================================

/**
 * winston トランスポート配列の生成
 */
function createTransports(): winston.transport[] {
  const transports: winston.transport[] = [
    // コンソール出力（既存実装保持）
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    })
  ];

  // ファイル出力（エラーハンドリング付き既存実装保持）
  try {
    // エラーログファイル
    transports.push(
      new winston.transports.File({
        filename: getLogFilePath('error'),
        level: LOG_LEVELS.ERROR,
        format: logFormat,
        handleExceptions: true,
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 10,
      })
    );

    // 統合ログファイル
    transports.push(
      new winston.transports.File({
        filename: getLogFilePath('combined'),
        format: logFormat,
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 14,
      })
    );

    // 監査ログファイル
    transports.push(
      new winston.transports.File({
        filename: getLogFilePath('audit', LogCategory.AUDIT),
        level: LOG_LEVELS.INFO,
        format: logFormat,
        maxsize: 30 * 1024 * 1024, // 30MB
        maxFiles: 30,
      })
    );

    // セキュリティログファイル
    transports.push(
      new winston.transports.File({
        filename: getLogFilePath('security', LogCategory.SECURITY),
        level: LOG_LEVELS.WARN,
        format: logFormat,
        maxsize: 30 * 1024 * 1024, // 30MB
        maxFiles: 30,
      })
    );

    // パフォーマンスログファイル
    transports.push(
      new winston.transports.File({
        filename: getLogFilePath('performance', LogCategory.PERFORMANCE),
        level: LOG_LEVELS.INFO,
        format: logFormat,
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 7,
      })
    );

  } catch (error) {
    console.warn('Failed to create file transports:', error);
  }

  return transports;
}

// =====================================
// 🏭 Loggerインスタンス作成（既存実装保持・拡張）
// =====================================

/**
 * winston ロガーインスタンス（既存実装保持）
 */
export const winstonLogger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports: createTransports(),
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: getLogFilePath('exceptions'),
      format: logFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: getLogFilePath('rejections'),
      format: logFormat,
    }),
  ],
  exitOnError: false,
});

// =====================================
// 🏗️ 拡張Loggerクラス（既存実装統合・Phase 1-B-2完全拡張）
// =====================================

/**
 * 高機能Loggerクラス（既存実装統合版）
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private traceId?: string;
  private userId?: string; // 🆕 Phase 1-B-2追加
  private metadata: Record<string, any> = {};
  
  // 🆕 Phase 1-B-2: 統計情報収集用
  private statistics: {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByCategory: Record<string, number>;
    errorCount: number;
    warningCount: number;
    startTime: Date;
    lastLogTime?: Date;
    lastWriteTime?: Date;
    lastError?: string;
  };

  constructor() {
    // 環境変数からログレベルを設定（既存実装保持）
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLogLevel) {
      case 'ERROR':
        this.logLevel = LogLevel.ERROR;
        break;
      case 'WARN':
        this.logLevel = LogLevel.WARN;
        break;
      case 'DEBUG':
        this.logLevel = LogLevel.DEBUG;
        break;
      case 'HTTP':
        this.logLevel = LogLevel.HTTP;
        break;
      default:
        this.logLevel = LogLevel.INFO;
    }

    // 🆕 Phase 1-B-2: 統計情報初期化
    this.statistics = {
      totalLogs: 0,
      logsByLevel: {},
      logsByCategory: {},
      errorCount: 0,
      warningCount: 0,
      startTime: new Date(),
    };
  }

  /**
   * シングルトンインスタンス取得（既存実装保持）
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * ログレベル判定（既存実装保持）
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  /**
   * トレースID設定
   */
  setTraceId(traceId: string): Logger {
    this.traceId = traceId;
    return this;
  }

  /**
   * 🆕 ユーザーID設定（Phase 1-B-2追加）
   */
  setUserId(userId?: string): Logger {
    this.userId = userId;
    return this;
  }

  /**
   * メタデータ設定
   */
  setMetadata(metadata: Record<string, any>): Logger {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * メタデータクリア
   */
  clearMetadata(): Logger {
    this.metadata = {};
    this.traceId = undefined;
    this.userId = undefined; // 🆕 Phase 1-B-2追加
    return this;
  }

  /**
   * 🆕 統計情報更新（Phase 1-B-2追加）
   */
  private updateStatistics(level: string, category?: LogCategory): void {
    this.statistics.totalLogs++;
    this.statistics.lastLogTime = new Date();
    
    // レベル別カウント
    this.statistics.logsByLevel[level] = (this.statistics.logsByLevel[level] || 0) + 1;
    
    // カテゴリ別カウント
    if (category) {
      this.statistics.logsByCategory[category] = 
        (this.statistics.logsByCategory[category] || 0) + 1;
    }
    
    // エラー・警告カウント
    if (level === LOG_LEVELS.ERROR) {
      this.statistics.errorCount++;
    } else if (level === LOG_LEVELS.WARN) {
      this.statistics.warningCount++;
    }
  }

  /**
   * 基本ログ出力（既存実装拡張）
   */
  log(
    level: string,
    message: string,
    data?: any,
    context?: Partial<LogEntry>
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      traceId: this.traceId,
      userId: this.userId, // 🆕 Phase 1-B-2追加
      ...this.metadata,
      ...context,
    };

    // 🆕 統計情報更新
    this.updateStatistics(level, context?.category);

    try {
      winstonLogger.log(level, message, logEntry);
      this.statistics.lastWriteTime = new Date();
    } catch (error) {
      this.statistics.lastError = error instanceof Error ? error.message : String(error);
      console.error('Logger write error:', error);
    }
  }

  /**
   * エラーログ（既存実装保持・拡張）
   */
  error(message: string, error?: Error | any, context?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorData = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : error;

      this.log(LOG_LEVELS.ERROR, message, errorData, {
        category: LogCategory.ERROR,
        ...context,
      });
    }
  }

  /**
   * 警告ログ（既存実装保持・拡張）
   */
  warn(message: string, data?: any, context?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LOG_LEVELS.WARN, message, data, context);
    }
  }

  /**
   * 情報ログ（既存実装保持・拡張）
   */
  info(message: string, data?: any, context?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LOG_LEVELS.INFO, message, data, context);
    }
  }

  /**
   * HTTPログ（既存実装保持・拡張）
   */
  http(message: string, data?: any, context?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.HTTP)) {
      this.log(LOG_LEVELS.HTTP, message, data, {
        category: LogCategory.ACCESS,
        ...context,
      });
    }
  }

  /**
   * デバッグログ（既存実装保持・拡張）
   */
  debug(message: string, data?: any, context?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LOG_LEVELS.DEBUG, message, data, context);
    }
  }

  /**
   * 🆕 認証ログ（Phase 1-B-2追加）
   */
  auth(message: string, data?: any, context?: Partial<LogEntry>): void {
    this.log(LOG_LEVELS.INFO, message, data, {
      category: LogCategory.AUTHENTICATION,
      ...context,
    });
  }

  /**
   * 🆕 認可ログ（Phase 1-B-2追加）
   */
  authorization(message: string, data?: any, context?: Partial<LogEntry>): void {
    this.log(LOG_LEVELS.INFO, message, data, {
      category: LogCategory.AUTHORIZATION,
      ...context,
    });
  }

  /**
   * 🆕 データベースログ（Phase 1-B-2追加）
   */
  database(message: string, data?: any, context?: Partial<LogEntry>): void {
    this.log(LOG_LEVELS.INFO, message, data, {
      category: LogCategory.DATABASE,
      ...context,
    });
  }

  /**
   * 🆕 GPSログ（Phase 1-B-2追加）
   */
  gps(message: string, data?: any, context?: Partial<LogEntry>): void {
    this.log(LOG_LEVELS.INFO, message, data, {
      category: LogCategory.GPS,
      ...context,
    });
  }

  /**
   * 🆕 運行ログ（Phase 1-B-2追加）
   */
  operation(message: string, data?: any, context?: Partial<LogEntry>): void {
    this.log(LOG_LEVELS.INFO, message, data, {
      category: LogCategory.OPERATION,
      ...context,
    });
  }

  /**
   * 監査ログ記録
   */
  audit(auditEntry: AuditLogEntry): void {
    const level = auditEntry.result === 'FAILURE' 
      ? LOG_LEVELS.WARN 
      : LOG_LEVELS.INFO;

    this.log(level, auditEntry.message, auditEntry, {
      category: LogCategory.AUDIT,
    });
  }

  /**
   * セキュリティログ記録
   */
  security(securityEntry: SecurityLogEntry): void {
    const level = securityEntry.severity === 'HIGH' || securityEntry.severity === 'CRITICAL'
      ? LOG_LEVELS.ERROR
      : LOG_LEVELS.WARN;

    this.log(level, securityEntry.message, securityEntry, {
      category: LogCategory.SECURITY,
    });
  }

  /**
   * パフォーマンスログ記録
   */
  performance(performanceEntry: PerformanceLogEntry): void {
    const level = performanceEntry.duration > LOG_CONFIG.PERFORMANCE_THRESHOLD_MS
      ? LOG_LEVELS.WARN
      : LOG_LEVELS.INFO;

    this.log(level, performanceEntry.message, performanceEntry, {
      category: LogCategory.PERFORMANCE,
    });
  }

  /**
   * 🆕 ログ統計情報取得（Phase 1-B-2追加）
   */
  getStatistics(): LogStatistics {
    const uptime = Date.now() - this.statistics.startTime.getTime();
    const errorRate = this.statistics.totalLogs > 0
      ? (this.statistics.errorCount / this.statistics.totalLogs) * 100
      : 0;

    return {
      totalLogs: this.statistics.totalLogs,
      logsByLevel: { ...this.statistics.logsByLevel },
      logsByCategory: { ...this.statistics.logsByCategory },
      errorRate: Math.round(errorRate * 100) / 100,
      lastLogTime: this.statistics.lastLogTime?.toISOString(),
      startTime: this.statistics.startTime.toISOString(),
      uptime: Math.round(uptime / 1000), // 秒単位
    };
  }

  /**
   * 🆕 ログヘルスステータス取得（Phase 1-B-2追加）
   */
  getHealthStatus(): LogHealthStatus {
    const now = Date.now();
    const lastWriteTime = this.statistics.lastWriteTime?.getTime();
    const timeSinceLastWrite = lastWriteTime ? now - lastWriteTime : Infinity;
    
    // 5分間ログ書き込みがない場合は異常
    const fileWriteOperational = timeSinceLastWrite < 5 * 60 * 1000;
    
    // ログシステムが動作しているか
    const logSystemOperational = !this.statistics.lastError;
    
    // 全体ステータス判定
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (logSystemOperational && fileWriteOperational) {
      status = 'healthy';
    } else if (logSystemOperational || fileWriteOperational) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      logSystemOperational,
      fileWriteOperational,
      lastWriteTime: this.statistics.lastWriteTime?.toISOString(),
      errorCount: this.statistics.errorCount,
      warningCount: this.statistics.warningCount,
      details: this.statistics.lastError,
    };
  }
}

// =====================================
// 🔧 ユーティリティ関数（既存実装保持・拡張）
// =====================================

/**
 * 安全なログ関数（既存実装保持）
 */
export const safeLog = (level: keyof typeof levels, message: string, meta?: any): void => {
  try {
    (winstonLogger as any)[level](message, meta);
  } catch (error) {
    const consoleLevel = level === LOG_LEVELS.ERROR ? 'error' : 'log';
    console[consoleLevel](`[${level.toUpperCase()}] ${message}`, meta || '');
  }
};

/**
 * ログファイル書き込み（既存実装保持・拡張）
 */
export const writeLogToFile = (
  logEntry: LogEntry,
  logType: 'access' | 'error' | 'app' | 'audit' | 'security' = 'app'
): void => {
  const logFile = getLogFilePath(logType, logEntry.category);
  const logLine = JSON.stringify(logEntry) + '\n';
  
  fs.appendFile(logFile, logLine, (err) => {
    if (err) {
      console.error('ログファイル書き込みエラー:', err);
    }
  });
};

/**
 * コンソールログ出力（既存実装保持）
 */
export const writeLogToConsole = (logEntry: LogEntry): void => {
  const { timestamp, level, message, data } = logEntry;
  const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  
  switch (level.toLowerCase()) {
    case LOG_LEVELS.ERROR:
      console.error(logMessage, data || '');
      break;
    case LOG_LEVELS.WARN:
      console.warn(logMessage, data || '');
      break;
    case LOG_LEVELS.INFO:
      console.info(logMessage, data || '');
      break;
    case LOG_LEVELS.DEBUG:
      console.debug(logMessage, data || '');
      break;
    default:
      console.log(logMessage, data || '');
  }
};

// =====================================
// 🎭 Express ミドルウェア（既存実装保持・拡張）
// =====================================

/**
 * リクエストログミドルウェア（既存実装保持・拡張）
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const traceId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // リクエストにトレースIDを追加
  (req as any).traceId = traceId;

  const user = (req as AuthenticatedRequest).user;
  const loggerInstance = Logger.getInstance().setTraceId(traceId);

  // リクエスト開始ログ
  loggerInstance.http('リクエスト開始', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: user?.userId,
    sessionId: req.sessionID,
    timestamp: new Date().toISOString(),
  });

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // レスポンス完了ログ
    const logLevel = res.statusCode >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.HTTP;
    loggerInstance[logLevel === LOG_LEVELS.WARN ? 'warn' : 'http']('リクエスト完了', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      ip: req.ip,
      userId: user?.userId,
      contentLength: res.get('Content-Length'),
    });

    // パフォーマンス警告
    if (responseTime > LOG_CONFIG.PERFORMANCE_THRESHOLD_MS) {
      loggerInstance.performance({
        timestamp: new Date().toISOString(),
        level: LOG_LEVELS.WARN,
        message: `遅いリクエスト検出: ${req.method} ${req.originalUrl}`,
        category: LogCategory.PERFORMANCE,
        operationType: 'HTTP_REQUEST',
        duration: responseTime,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
      });
    }
  });

  next();
};

/**
 * 監査ログミドルウェア（既存実装保持・拡張）
 */
export const auditLogger = (
  action: string,
  resource: string,
  options: {
    logResponse?: boolean;
    captureBody?: boolean;
    level?: string;
  } = {}
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    const resourceId = req.params.id || req.body?.id;
    const oldValues = options.captureBody ? req.body : undefined;

    res.on('finish', () => {
      try {
        if (res.statusCode < 400) { // 成功時のみ監査ログを記録
          const responseData = options.logResponse ? (res as any).body : null;
          
          const auditEntry: AuditLogEntry = {
            timestamp: new Date().toISOString(),
            level: LOG_LEVELS.INFO,
            message: `監査ログ: ${action}`,
            category: LogCategory.AUDIT,
            action,
            resource,
            resourceId,
            result: 'SUCCESS',
            userId: user?.userId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            oldValues: oldValues && typeof oldValues === 'object' 
              ? JSON.parse(JSON.stringify(oldValues)) : null,
            newValues: responseData && typeof responseData === 'object' 
              ? JSON.parse(JSON.stringify(responseData)) 
              : null,
          };

          Logger.getInstance().audit(auditEntry);
        }
      } catch (error) {
        Logger.getInstance().error('監査ログ記録エラー', error);
      }
    });

    next();
  };
};

/**
 * パフォーマンスログミドルウェア（既存実装保持・拡張）
 */
export const performanceLogger = (slowThreshold: number = LOG_CONFIG.PERFORMANCE_THRESHOLD_MS) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const startUsage = process.cpuUsage();
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      if (responseTime > slowThreshold) {
        const endUsage = process.cpuUsage(startUsage);
        const endMemory = process.memoryUsage();

        const performanceEntry: PerformanceLogEntry = {
          timestamp: new Date().toISOString(),
          level: LOG_LEVELS.WARN,
          message: `パフォーマンス警告: 遅いリクエスト ${req.method} ${req.originalUrl}`,
          category: LogCategory.PERFORMANCE,
          operationType: 'HTTP_REQUEST',
          duration: responseTime,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          cpuUsage: endUsage,
          memoryUsage: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external,
            rss: endMemory.rss - startMemory.rss,
            arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
          } as NodeJS.MemoryUsage,
        };

        Logger.getInstance().performance(performanceEntry);
      }
    });

    next();
  };
};

/**
 * セキュリティログミドルウェア（既存実装保持・拡張）
 */
export const securityLogger = (
  event: string,
  details?: Record<string, any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    const securityEntry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVELS.WARN,
      message: `セキュリティイベント: ${event}`,
      category: LogCategory.SECURITY,
      event,
      severity: 'MEDIUM',
      source: req.ip || '',
      target: req.originalUrl,
      outcome: 'UNKNOWN',
      userId: user?.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.originalUrl,
      details,
    };

    res.on('finish', () => {
      securityEntry.outcome = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
      securityEntry.statusCode = res.statusCode;
      
      if (res.statusCode === 401 || res.statusCode === 403) {
        securityEntry.severity = 'HIGH';
      }

      Logger.getInstance().security(securityEntry);
    });

    next();
  };
};

/**
 * エラーログミドルウェア（既存実装保持・拡張）
 */
export const errorLogger = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as AuthenticatedRequest).user;
  const traceId = (req as any).traceId;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LOG_LEVELS.ERROR,
    message: error.message || 'Unknown error',
    category: LogCategory.ERROR,
    data: {
      stack: error.stack,
      name: error.name,
      code: error.code,
    },
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: user?.userId,
    traceId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
  };

  writeLogToConsole(logEntry);
  writeLogToFile(logEntry, 'error');

  Logger.getInstance().setTraceId(traceId || '').error(
    `アプリケーションエラー: ${error.message}`,
    error,
    {
      method: req.method,
      url: req.originalUrl,
      userId: user?.userId,
    }
  );

  next(error);
};

// =====================================
// 📊 ログ統計・監視機能（既存実装保持）
// =====================================

/**
 * ログ統計情報取得
 */
export const getLogStatistics = () => {
  return Logger.getInstance().getStatistics();
};

/**
 * ログヘルスチェック
 */
export const getLogHealthStatus = () => {
  return Logger.getInstance().getHealthStatus();
};

// =====================================
// 🏷️ 便利なログ関数エクスポート（既存実装保持）
// =====================================

/**
 * 認証ログ
 */
export const logAuthentication = (message: string, data?: any, userId?: string) => {
  Logger.getInstance().setUserId(userId).auth(message, data);
};

/**
 * 認可ログ
 */
export const logAuthorization = (message: string, data?: any, userId?: string) => {
  Logger.getInstance().setUserId(userId).authorization(message, data);
};

/**
 * データベースログ
 */
export const logDatabase = (message: string, data?: any, userId?: string) => {
  Logger.getInstance().setUserId(userId).database(message, data);
};

/**
 * GPSログ
 */
export const logGPS = (message: string, data?: any, userId?: string) => {
  Logger.getInstance().setUserId(userId).gps(message, data);
};

/**
 * 運行ログ
 */
export const logOperation = (message: string, data?: any, userId?: string) => {
  Logger.getInstance().setUserId(userId).operation(message, data);
};

// =====================================
// 🎯 デフォルトLoggerインスタンス（Phase 1-B-2完全版）
// =====================================

/**
 * デフォルトLoggerインスタンス（既存実装保持）
 */
const logger = Logger.getInstance();

// 🆕 Phase 1-B-2: 名前付きexport追加（重要）
export { logger };

// デフォルトエクスポート（既存互換性）
export default logger;

// 既存関数の互換性エイリアス
export {
  Logger as LoggerClass,
  LogLevel as LogLevelEnum,
  LOG_LEVELS as LogLevels,
  LogCategory as LogCategories,
};