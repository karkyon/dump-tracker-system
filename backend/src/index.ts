// backend/src/index.ts - 修正版: authRoutes統合完全版
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';
import path from 'path';
import https from 'https';
import http from 'http';
import fs from 'fs';
import authRoutes from './routes/authRoutes';

// 環境変数読み込み
dotenv.config();

const app = express();
const HOST = process.env.HOST || '0.0.0.0';

// SSL証明書の読み込み
let sslOptions: { key: Buffer; cert: Buffer } | null = null;
let useHttps = false;

try {
  const keyPath = path.join(__dirname, '../ssl/key.pem');
  const certPath = path.join(__dirname, '../ssl/cert.pem');
  
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    sslOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    useHttps = true;
    console.log('✅ SSL証明書が見つかりました。HTTPSサーバーで起動します。');
  } else {
    console.warn('⚠️ SSL証明書が見つかりません。HTTPサーバーで起動します。');
  }
} catch (error) {
  console.warn('⚠️ SSL証明書の読み込みに失敗しました。HTTPサーバーで起動します。', error);
}

const PROTOCOL = useHttps ? 'https' : 'http';
const PORT = parseInt(process.env.PORT || (useHttps ? '8443' : '8000'), 10);

// セキュリティ・基本ミドルウェア
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'"],
      formAction: ["'self'"]
    },
  },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: ['https://10.1.119.244:3001', 'http://10.1.119.244:3001', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Swagger設定
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dump Tracker API',
      version: '1.0.0',
      description: `
# ダンプトラック運行記録システム API

このAPIは、ダンプトラックの運行記録、車両管理、GPS追跡、レポート生成などを行うシステムです。

## 主要機能
- 🚛 **車両管理** - 車両の登録・管理
- 👥 **ユーザー管理** - 運転手・管理者の管理  
- 📍 **GPS追跡** - リアルタイム位置情報
- 📊 **運行記録** - 運行データの記録・管理
- 📄 **レポート** - 各種統計・レポート生成
- 🔧 **点検管理** - 車両点検記録
- 📦 **品目管理** - 積載物管理
- 📍 **場所管理** - 積込・積下場所管理

## 認証
このAPIは、JWT Bearer認証を使用しています。ほとんどのエンドポイントは認証が必要です。

## プロトコル
- **${PROTOCOL.toUpperCase()}**: ${PROTOCOL}://10.1.119.244:${PORT}
- **セキュア通信**: ${useHttps ? '有効' : '無効 (開発環境)'}
      `,
      contact: {
        name: 'Dump Tracker Development Team',
        email: 'dev@dump-tracker.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `${PROTOCOL}://10.1.119.244:${PORT}/api/v1`,
        description: `Development API Server (${PROTOCOL.toUpperCase()})`,
      },
      {
        url: `${PROTOCOL}://localhost:${PORT}/api/v1`,
        description: `Local Development Server (${PROTOCOL.toUpperCase()})`,
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT認証トークンを入力してください'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user-123' },
            username: { type: 'string', example: 'driver001' },
            email: { type: 'string', example: 'driver@example.com' },
            firstName: { type: 'string', example: '運転手' },
            lastName: { type: 'string', example: '太郎' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'DRIVER'] },
            isActive: { type: 'boolean', example: true }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'driver001' },
            password: { type: 'string', example: 'password123' },
            rememberMe: { type: 'boolean', example: false }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { '$ref': '#/components/schemas/User' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'エラーメッセージ' },
            error: { type: 'string', example: 'ERROR_CODE' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: [__filename]
};

// Swagger設定（安全な実装）
let swaggerSpec: any = null;
let swaggerEnabled = false;

try {
  swaggerSpec = swaggerJsdoc(swaggerOptions);
  swaggerEnabled = true;
  console.log('✅ Swagger documentation loaded successfully');
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.warn('⚠️ Swagger documentation failed to load:', errorMessage);
}

// Swagger UI設定
if (swaggerEnabled && swaggerSpec) {
  app.use('/docs', swaggerUi.serve);
  app.get('/docs', swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1f2937; }
    `,
    customSiteTitle: 'Dump Tracker API Documentation',
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true
    }
  }));
  
  app.get('/api-docs', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(swaggerSpec);
  });
}

// ===== ★ 重要: authRoutesの正しい使用 ★ =====
app.use('/api/v1/auth', authRoutes);

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({ 
    name: 'Dump Tracker API Server',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    protocol: PROTOCOL,
    secure: useHttps,
    endpoints: {
      health: '/health',
      api: '/api/v1',
      auth: '/api/v1/auth',
      documentation: swaggerEnabled ? '/docs' : null
    },
    features: [
      '🚛 車両管理',
      '👥 ユーザー管理', 
      '📍 GPS追跡',
      '📊 運行記録',
      '📄 レポート生成',
      '🔧 点検管理',
      '📦 品目管理',
      '📍 場所管理'
    ],
    timestamp: new Date().toISOString()
  });
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      protocol: PROTOCOL,
      port: PORT,
      secure: useHttps
    },
    services: {
      swagger: swaggerEnabled,
      auth: 'active',
      database: 'pending',
      api: 'active',
      ssl: useHttps ? 'enabled' : 'disabled'
    }
  });
});

// APIルート
const apiRouter = express.Router();

// API情報エンドポイント
apiRouter.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      apiVersion: '1.0.0',
      protocol: PROTOCOL,
      availableEndpoints: [
        'GET /api/v1/health - ヘルスチェック',
        'POST /api/v1/auth/login - ログイン',
        'GET /api/v1/auth/me - 現在のユーザー情報',
        'POST /api/v1/auth/logout - ログアウト',
        'GET /api/v1/users - ユーザー一覧',
        'GET /api/v1/vehicles - 車両一覧'
      ],
      documentation: swaggerEnabled ? '/docs' : 'Swagger documentation is disabled',
      security: {
        https: useHttps,
        authentication: 'JWT Bearer Token required for most endpoints'
      }
    },
    message: 'Dump Tracker API v1.0',
    timestamp: new Date().toISOString()
  });
});

// API ヘルスチェック
apiRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      secure: useHttps
    },
    message: 'API is running successfully'
  });
});

// 他のAPIエンドポイント（501実装中）
apiRouter.get('/users', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'ユーザー管理機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

apiRouter.get('/vehicles', (req, res) => {
  res.status(501).json({
    success: false,
    message: '車両管理機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

// APIルート登録
app.use('/api/v1', apiRouter);

// 静的ファイル配信（本番環境用）
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../dist');
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
  }
}

// エラーハンドリング
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('⛔ Unhandled error:', err);
  
  let statusCode = 500;
  let message = 'サーバーエラーが発生しました';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let stack: string | undefined;

  if (err instanceof Error) {
    message = err.message;
    stack = err.stack;
    
    if ('statusCode' in err && typeof err.statusCode === 'number') {
      statusCode = err.statusCode;
    } else if ('status' in err && typeof err.status === 'number') {
      statusCode = err.status;
    }
  }
  
  try {
    res.status(statusCode).json({
      success: false,
      message,
      error: errorCode,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack })
    });
  } catch (responseError) {
    console.error('Failed to send error response:', responseError);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Critical server error',
        error: 'RESPONSE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'エンドポイントが見つかりません',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET / (API情報)',
      'GET /health (ヘルスチェック)', 
      'GET /docs (API文書)',
      'GET /api/v1 (API エンドポイント一覧)',
      'POST /api/v1/auth/login (ログイン)',
      'GET /api/v1/auth/me (ユーザー情報)'
    ],
    documentation: swaggerEnabled ? `${PROTOCOL}://10.1.119.244:${PORT}/docs` : null,
    timestamp: new Date().toISOString()
  });
});

// サーバー起動（HTTP/HTTPS対応）
const server = useHttps && sslOptions 
  ? https.createServer(sslOptions, app)
  : http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 ============================================');
  console.log('   Dump Tracker API Server Started');
  console.log('🚀 ============================================');
  console.log('');
  console.log(`🌐 Server URL: ${PROTOCOL}://${HOST}:${PORT}`);
  console.log(`🌍 Network URL: ${PROTOCOL}://10.1.119.244:${PORT}`);
  if (swaggerEnabled) {
    console.log(`📚 API Documentation: ${PROTOCOL}://10.1.119.244:${PORT}/docs`);
  }
  console.log(`🏥 Health Check: ${PROTOCOL}://10.1.119.244:${PORT}/health`);
  console.log(`🔗 API Base URL: ${PROTOCOL}://10.1.119.244:${PORT}/api/v1`);
  console.log(`🔐 Auth Endpoints: ${PROTOCOL}://10.1.119.244:${PORT}/api/v1/auth/*`);
  console.log('');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Protocol: ${PROTOCOL.toUpperCase()}`);
  console.log(`🛡️ SSL/TLS: ${useHttps ? 'Enabled' : 'Disabled'}`);
  console.log(`⚡ Node.js: ${process.version}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('   - GET /           (API Information)');
  console.log('   - GET /health     (Health Check)');
  if (swaggerEnabled) {
    console.log('   - GET /docs       (API Documentation)');
  }
  console.log('   - GET /api/v1     (API Endpoints List)');
  console.log('   - POST /api/v1/auth/login  (User Login)');
  console.log('   - GET /api/v1/auth/me      (Current User)');
  console.log('');
  if (useHttps) {
    console.log('🔐 HTTPS証明書情報:');
    console.log('   - 自己署名証明書を使用');
    console.log('   - ブラウザで証明書の警告が表示される場合があります');
    console.log('   - 「詳細設定」→「安全でないサイトに進む」をクリック');
    console.log('');
  }
  console.log('🛑 Press Ctrl+C to stop the server');
  console.log('============================================');
});

// プロセス終了処理
const gracefulShutdown = (signal: string) => {
  console.log(`🛑 ${signal} received, shutting down gracefully`);
  server.close((err) => {
    if (err) {
      console.error('⛔ Error during server shutdown:', err);
      process.exit(1);
    }
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('⛔ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;