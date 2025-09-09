import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { LOG_LEVELS } from '../utils/constants';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ログディレクトリの作成
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * ログレベル定義
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * ログエントリーの型定義
 */
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
}

/**
 * ログファイルに書き込む関数
 */
const writeLogToFile = (logEntry: LogEntry, logType: 'access' | 'error' | 'app' = 'app'): void => {
  const logFile = path.join(logDir, `${logType}.log`);
  const logLine = JSON.stringify(logEntry) + '\n';
  
  fs.appendFile(logFile, logLine, (err) => {
    if (err) {
      console.error('ログファイル書き込みエラー:', err);
    }
  });
};

/**
 * コンソールにログを出力する関数
 */
const writeLogToConsole = (logEntry: LogEntry): void => {
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

/**
 * ログ出力クラス
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  constructor() {
    // 環境変数からログレベルを設定（デフォルトはINFO）
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
      default:
        this.logLevel = LogLevel.INFO;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private log(level: string, message: string, data?: any, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      ...context,
    };

    writeLogToConsole(logEntry);
    writeLogToFile(logEntry);
  }

  error(message: string, data?: any, context?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(LOG_LEVELS.ERROR, message, data, context);
      writeLogToFile({ ...arguments[0], level: LOG_LEVELS.ERROR }, 'error');
    }
  }

  warn(message: string, data?: any, context?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LOG_LEVELS.WARN, message, data, context);
    }
  }

  info(message: string, data?: any, context?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LOG_LEVELS.INFO, message, data, context);
    }
  }

  debug(message: string, data?: any, context?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LOG_LEVELS.DEBUG, message, data, context);
    }
  }
}

// シングルトンインスタンス
export const logger = Logger.getInstance();

/**
 * アクセスログミドルウェア
 * 全てのHTTPリクエストをログに記録する
 */
export const accessLogger = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // レスポンス完了時にログを出力
  res.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const logEntry: LogEntry = {
      timestamp: new Date(startTime).toISOString(),
      level: LOG_LEVELS.INFO,
      message: 'HTTP Request',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
    };

    writeLogToConsole(logEntry);
    writeLogToFile(logEntry, 'access');
  });

  next();
};

/**
 * 監査ログミドルウェア
 * 重要な操作（CRUD操作など）を監査ログとして記録する
 */
export const auditLogger = (action: string, resource: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send;
    const originalJson = res.json;
    let responseData: any;

    // レスポンスデータを取得
    res.send = function(data: any) {
      responseData = data;
      return originalSend.call(this, data);
    };

    res.json = function(data: any) {
      responseData = data;
      return originalJson.call(this, data);
    };

    // リクエスト処理前のデータを保存（更新・削除の場合）
    let oldValues: any;
    const resourceId = req.params.id || req.params.operationId || req.params.vehicleId;

    if (['UPDATE', 'DELETE'].includes(action) && resourceId) {
      try {
        // リソースに応じて既存データを取得
        switch (resource.toLowerCase()) {
          case 'user':
            oldValues = await prisma.user.findUnique({ where: { id: resourceId } });
            break;
          case 'vehicle':
            oldValues = await prisma.vehicle.findUnique({ where: { id: resourceId } });
            break;
          case 'operation':
            oldValues = await prisma.operation.findUnique({ where: { id: resourceId } });
            break;
          // 他のリソースも必要に応じて追加
        }
      } catch (error) {
        logger.error('監査ログ: 既存データ取得エラー', error);
      }
    }

    // レスポンス完了時に監査ログを記録
    res.on('finish', async () => {
      try {
        // 成功時のみ監査ログを記録
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await prisma.auditLog.create({
            data: {
              userId: req.user?.id,
              action,
              resource,
              resourceId,
              oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
              newValues: responseData && typeof responseData === 'object' 
                ? JSON.parse(JSON.stringify(responseData)) 
                : null,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
            },
          });

          logger.info('監査ログ記録', {
            userId: req.user?.id,
            action,
            resource,
            resourceId,
            ip: req.ip,
          });
        }
      } catch (error) {
        logger.error('監査ログ記録エラー', error);
      }
    });

    next();
  };
};

/**
 * エラーログミドルウェア
 * エラーが発生した場合に詳細な情報をログに記録する
 */
export const errorLogger = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LOG_LEVELS.ERROR,
    message: error.message || 'Unknown error',
    data: {
      stack: error.stack,
      name: error.name,
      code: error.code,
    },
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as AuthenticatedRequest).user?.id,
  };

  writeLogToConsole(logEntry);
  writeLogToFile(logEntry, 'error');

  next(error);
};

/**
 * パフォーマンスログミドルウェア
 * 遅いAPIエンドポイントを特定するためのログ
 */
export const performanceLogger = (slowThreshold: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      if (responseTime > slowThreshold) {
        logger.warn('パフォーマンス警告: 遅いリクエスト', {
          method: req.method,
          url: req.originalUrl,
          responseTime,
          statusCode: res.statusCode,
          threshold: slowThreshold,
        });
      }
    });

    next();
  };
};

/**
 * セキュリティログミドルウェア
 * セキュリティに関連するイベントをログに記録する
 */
export const securityLogger = (event: string, details?: any) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    logger.warn(`セキュリティイベント: ${event}`, {
      ...details,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      url: req.originalUrl,
      method: req.method,
    });

    next();
  };
};

/**
 * ログファイルローテーション
 * 古いログファイルを削除またはアーカイブする
 */
export const rotateLogFiles = (): void => {
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30日
  const logFiles = ['access.log', 'error.log', 'app.log'];

  logFiles.forEach(logFile => {
    const filePath = path.join(logDir, logFile);
    
    fs.stat(filePath, (err, stats) => {
      if (err) return;
      
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();
      
      if (fileAge > maxAge) {
        // 古いログファイルをアーカイブ
        const archiveName = `${logFile}.${stats.mtime.toISOString().split('T')[0]}.gz`;
        const archivePath = path.join(logDir, 'archive', archiveName);
        
        // アーカイブディレクトリを作成
        const archiveDir = path.join(logDir, 'archive');
        if (!fs.existsSync(archiveDir)) {
          fs.mkdirSync(archiveDir, { recursive: true });
        }
        
        // ファイルを移動（実際の運用では圧縮処理を実装）
        fs.rename(filePath, archivePath, (renameErr) => {
          if (renameErr) {
            logger.error('ログファイルローテーションエラー', renameErr);
          } else {
            logger.info(`ログファイルをアーカイブしました: ${archiveName}`);
          }
        });
      }
    });
  });
};

// 毎日午前2時にログローテーションを実行
const scheduleLogRotation = (): void => {
  const now = new Date();
  const tomorrow2AM = new Date();
  tomorrow2AM.setDate(now.getDate() + 1);
  tomorrow2AM.setHours(2, 0, 0, 0);
  
  const timeUntilRotation = tomorrow2AM.getTime() - now.getTime();
  
  setTimeout(() => {
    rotateLogFiles();
    // 次の実行をスケジュール（24時間後）
    setInterval(rotateLogFiles, 24 * 60 * 60 * 1000);
  }, timeUntilRotation);
};

// アプリケーション起動時にログローテーションをスケジュール
if (process.env.NODE_ENV === 'production') {
  scheduleLogRotation();
}

/**
 * ログ統計情報を取得
 */
export const getLogStats = async (): Promise<{
  totalErrors: number;
  recentErrors: number;
  slowRequests: number;
  auditLogCount: number;
}> => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const auditLogCount = await prisma.auditLog.count();
    
    return {
      totalErrors: 0, // ファイルベースのログから計算が必要
      recentErrors: 0, // 過去24時間のエラー数
      slowRequests: 0, // 遅いリクエスト数
      auditLogCount,
    };
  } catch (error) {
    logger.error('ログ統計取得エラー', error);
    return {
      totalErrors: 0,
      recentErrors: 0,
      slowRequests: 0,
      auditLogCount: 0,
    };
  }
};