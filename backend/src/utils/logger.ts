// backend/src/utils/logger.ts
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// ログディレクトリを確保
const logDir = path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (error) {
  console.warn('Failed to create log directory:', error);
}

// ログレベル定義
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 環境に応じたログレベル
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// カラー設定
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// フォーマット設定
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// トランスポート設定（エラー耐性付き）
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat
  })
];

// ファイルトランスポート（エラーチェック付き）
try {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: logFormat
    })
  );
} catch (error) {
  console.warn('Failed to create file transports:', error);
}

// ロガー作成
const logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports,
  // エラー時のフォールバック
  exceptionHandlers: [
    new winston.transports.Console(),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
  ],
});

// プロダクション環境でのエラーハンドリング
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 安全なログ関数
export const safeLog = (level: keyof typeof levels, message: string, meta?: any) => {
  try {
    logger[level](message, meta);
  } catch (error) {
    console[level === 'error' ? 'error' : 'log'](`[${level.toUpperCase()}] ${message}`, meta || '');
  }
};

export default logger;
