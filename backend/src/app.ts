// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

const app = express();

// 安全な設定読み込み
let config: any;
try {
  config = require('./config/environment');
  config = config.default || config;
} catch (error) {
  console.warn('Config not found, using defaults:', (error instanceof Error ? error.message : String(error)));
  config = {
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
    NODE_ENV: process.env.NODE_ENV || 'development'
  };
}

// 安全なロガー読み込み
let logger: any;
try {
  logger = require('./utils/logger');
  logger = logger.default || logger;
} catch (error) {
  console.warn(
    'Logger not found, using console:',
    error instanceof Error ? error.message : String(error)
  );
  logger = console;
}

// セキュリティミドルウェア
try {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
} catch (error) {
  console.warn('Helmet setup failed:', error instanceof Error ? error.message : String(error));
}

// CORS設定
try {
  app.use(cors({
    origin: config.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
} catch (error) {
  console.warn('CORS setup failed:', error instanceof Error ? error.message : String(error));
}

// 基本ミドルウェア
try {
  app.use(compression());
} catch (error) {
  console.warn(
    'Compression setup failed:',
    error instanceof Error ? error.message : String(error)
  );
}

// ログミドルウェア
try {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        if (logger && logger.info) {
          logger.info(message.trim());
        } else {
          console.log(message.trim());
        }
      }
    }
  }));
} catch (error) {
  console.warn(
    'Morgan setup failed:',
    error instanceof Error ? error.message : String(error)
  );
  app.use(morgan('combined'));
}

// ボディパーサー
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// レート制限（安全版）
try {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // 最大100リクエスト
    message: {
      success: false,
      message: 'レート制限に達しました。しばらくしてから再試行してください。',
      error: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
} catch (error) {
  console.warn(
    'Rate limiting setup failed:',
    error instanceof Error ? error.message : String(error)
  );
}

// 静的ファイル配信（安全版）
try {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
} catch (error) {
  console.warn(
    'Static files setup failed:',
    error instanceof Error ? error.message : String(error)
  );
}

// ルート設定（安全版）
try {
  const apiRoutes = require('./routes');
  const routes = apiRoutes.default || apiRoutes;
  app.use('/api/v1', routes);
} catch (error) {
  console.error(
    'Failed to load API routes:',
    error instanceof Error ? error.message : String(error)
  );
  
  // フォールバックルート
  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'API is running (fallback mode)',
      timestamp: new Date().toISOString(),
      error: 'Routes not fully loaded'
    });
  });
  
  app.get('/api/v1', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'API routes are not available',
      error: 'SERVICE_UNAVAILABLE'
    });
  });
}

// ルートレベルヘルスチェック
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.NODE_ENV || 'unknown'
  });
});

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    name: 'ダンプ運行記録システム API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      docs: '/api/docs'
    },
    timestamp: new Date().toISOString()
  });
});

// エラーハンドリング（安全版）
try {
  const { errorHandler, notFound } = require('./middleware/errorHandler');
  app.use(notFound);
  app.use(errorHandler);
} catch (error) {
  console.warn(
    'Error handlers not found, using fallback:',
    error instanceof Error ? error.message : String(error)
  );
  
  // フォールバック404ハンドラー
  app.use((req, res, next) => {
    res.status(404).json({
      success: false,
      message: `要求されたリソースが見つかりません: ${req.originalUrl}`,
      error: 'NOT_FOUND'
    });
  });
  
  // フォールバックエラーハンドラー
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      message: 'サーバー内部エラーが発生しました',
      error: 'INTERNAL_SERVER_ERROR'
    });
  });
}

export default app;
