// backend/src/index.ts - Swaggerアノテーション完全版
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

// 環境変数読み込み
dotenv.config();

// ルートのプレースホルダー
const apiRouter = express.Router();

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
  origin: '*',
  credentials: false,
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
        Vehicle: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'vehicle-123' },
            plateNumber: { type: 'string', example: 'D-001' },
            vehicleType: { type: 'string', example: 'ダンプトラック' },
            model: { type: 'string', example: 'いすゞ ギガ' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'] }
          }
        },
        Operation: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'operation-123' },
            operationNumber: { type: 'string', example: 'OP-2025-001' },
            vehicleId: { type: 'string', example: 'vehicle-123' },
            driverId: { type: 'string', example: 'user-123' },
            status: { type: 'string', enum: ['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] }
          }
        },
        Location: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'location-123' },
            name: { type: 'string', example: '積込場所A' },
            address: { type: 'string', example: '東京都千代田区...' },
            locationType: { type: 'string', enum: ['LOADING', 'UNLOADING', 'STORAGE', 'MAINTENANCE'] }
          }
        },
        Item: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'item-123' },
            name: { type: 'string', example: '砂利' },
            category: { type: 'string', example: '建設資材' },
            unit: { type: 'string', example: 'トン' },
            hazardous: { type: 'boolean', example: false }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
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
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'driver001' },
            password: { type: 'string', example: 'password123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                user: { '$ref': '#/components/schemas/User' }
              }
            },
            message: { type: 'string', example: 'ログインに成功しました' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: [__filename] // 現在のファイルからSwaggerコメントを読み込み
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
  console.warn('⚠️ API will run without documentation');
}

// Swagger UI設定（型安全・シンプル版）
if (swaggerEnabled && swaggerSpec) {
  app.use('/docs', swaggerUi.serve);
  
  // 型安全なSwagger UI設定
  app.get('/docs', swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1f2937; }
      .swagger-ui .info .description { color: #374151; }
      .swagger-ui .scheme-container { background: #f3f4f6; padding: 10px; border-radius: 4px; }
    `,
    customSiteTitle: 'Dump Tracker API Documentation',
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      showRequestHeaders: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
      validatorUrl: null,
      tryItOutEnabled: true
    },
    explorer: true
  }));
  
  // Swagger JSON（完全CORS対応）
  app.get('/api-docs', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(swaggerSpec);
  });
}

/**
 * @swagger
 * /:
 *   get:
 *     summary: API情報取得
 *     description: APIサーバーの基本情報を取得します
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API情報
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: Dump Tracker API Server
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 status:
 *                   type: string
 *                   example: running
 */
apiRouter.get('/reports', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'レポート機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

// APIルーター登録
app.use('/api/v1', apiRouter);

// 静的ファイル配信（本番環境用）
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../dist');
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
  }
}

// エラーハンドリング（完全型安全）
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Unhandled error:', err);
  
  let statusCode = 500;
  let message = 'サーバーエラーが発生しました';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let stack: string | undefined;

  // 型安全なエラー処理
  if (err instanceof Error) {
    message = err.message;
    stack = err.stack;
    
    if ('statusCode' in err && typeof err.statusCode === 'number') {
      statusCode = err.statusCode;
    } else if ('status' in err && typeof err.status === 'number') {
      statusCode = err.status;
    }
    
    if ('code' in err && typeof err.code === 'string') {
      errorCode = err.code;
    }
  } else if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, any>;
    message = errorObj.message || String(err);
    statusCode = errorObj.statusCode || errorObj.status || 500;
    errorCode = errorObj.code || 'INTERNAL_SERVER_ERROR';
  } else {
    message = String(err);
  }
  
  // レスポンス送信（安全な実装）
  try {
    res.status(statusCode).json({
      success: false,
      message,
      error: errorCode,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { 
        stack,
        details: err 
      })
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
      'GET /api/v1/health (API ヘルスチェック)'
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
    console.log('   - GET /api-docs   (Swagger JSON)');
  }
  console.log('   - GET /api/v1     (API Endpoints List)');
  console.log('   - GET /api/v1/*   (REST API)');
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

// プロセス終了処理（安全な実装）
const gracefulShutdown = (signal: string) => {
  console.log('');
  console.log(`🛑 ${signal} received, shutting down gracefully`);
  
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
  
  // 強制終了のタイムアウト（10秒）
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未処理の例外キャッチ
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;
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
      documentation: swaggerEnabled ? '/docs' : null,
      apiDocs: swaggerEnabled ? '/api-docs' : null
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
    links: {
      documentation: swaggerEnabled ? `${PROTOCOL}://10.1.119.244:${PORT}/docs` : null,
      apiHealth: `${PROTOCOL}://10.1.119.244:${PORT}/health`,
      apiBase: `${PROTOCOL}://10.1.119.244:${PORT}/api/v1`
    },
    security: {
      https: useHttps,
      cors: 'enabled',
      helmet: 'enabled',
      compression: 'enabled'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: ヘルスチェック
 *     description: サーバーの稼働状況とシステム情報を取得します
 *     tags: [System]
 *     responses:
 *       200:
 *         description: システム状況
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                   example: 3600.5
 *                 memory:
 *                   type: object
 *                 services:
 *                   type: object
 */
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
      database: 'pending',
      api: 'active',
      ssl: useHttps ? 'enabled' : 'disabled'
    }
  });
});

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: API ヘルスチェック
 *     description: API の稼働状況を確認します
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API稼働中
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
app.use('/api/v1/health', (req, res) => {
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

/**
 * @swagger
 * /api/v1:
 *   get:
 *     summary: API エンドポイント一覧
 *     description: 利用可能なAPIエンドポイントの一覧を取得します
 *     tags: [System]
 *     responses:
 *       200:
 *         description: エンドポイント一覧
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    data: {
      apiVersion: '1.0.0',
      protocol: PROTOCOL,
      availableEndpoints: [
        'GET /api/v1/health - ヘルスチェック',
        'POST /api/v1/auth/login - ログイン',
        'GET /api/v1/users - ユーザー一覧',
        'GET /api/v1/vehicles - 車両一覧',
        'GET /api/v1/operations - 運行記録一覧',
        'GET /api/v1/locations - 場所一覧',
        'GET /api/v1/items - 品目一覧'
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

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: ユーザーログイン
 *     description: ユーザー名とパスワードでログインし、JWTトークンを取得します
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: ログイン成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: 認証失敗
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       501:
 *         description: 実装中
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
apiRouter.post('/auth/login', (req, res) => {
  res.status(501).json({
    success: false,
    message: '認証機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: ユーザー一覧取得
 *     description: システム内の全ユーザーの一覧を取得します（管理者権限必要）
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: ページ番号
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 1ページあたりの件数
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, MANAGER, DRIVER]
 *         description: 役割でフィルター
 *     responses:
 *       200:
 *         description: ユーザー一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: 認証が必要
 *       403:
 *         description: 権限不足
 *       501:
 *         description: 実装中
 */
apiRouter.get('/users', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'ユーザー管理機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/v1/vehicles:
 *   get:
 *     summary: 車両一覧取得
 *     description: 登録されている車両の一覧を取得します
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, MAINTENANCE]
 *         description: 車両ステータスでフィルター
 *       - in: query
 *         name: vehicleType
 *         schema:
 *           type: string
 *         description: 車両タイプでフィルター
 *     responses:
 *       200:
 *         description: 車両一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vehicle'
 *       401:
 *         description: 認証が必要
 *       501:
 *         description: 実装中
 */
apiRouter.get('/vehicles', (req, res) => {
  res.status(501).json({
    success: false,
    message: '車両管理機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/v1/operations:
 *   get:
 *     summary: 運行記録一覧取得
 *     description: 運行記録の一覧を取得します
 *     tags: [Operations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PLANNING, IN_PROGRESS, COMPLETED, CANCELLED]
 *         description: 運行ステータスでフィルター
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *         description: 車両IDでフィルター
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 開始日でフィルター
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 終了日でフィルター
 *     responses:
 *       200:
 *         description: 運行記録一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Operation'
 *       401:
 *         description: 認証が必要
 *       501:
 *         description: 実装中
 */
apiRouter.get('/operations', (req, res) => {
  res.status(501).json({
    success: false,
    message: '運行管理機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/v1/locations:
 *   get:
 *     summary: 場所一覧取得
 *     description: 積込・積下場所の一覧を取得します
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: locationType
 *         schema:
 *           type: string
 *           enum: [LOADING, UNLOADING, STORAGE, MAINTENANCE]
 *         description: 場所タイプでフィルター
 *     responses:
 *       200:
 *         description: 場所一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Location'
 *       401:
 *         description: 認証が必要
 *       501:
 *         description: 実装中
 */
apiRouter.get('/locations', (req, res) => {
  res.status(501).json({
    success: false,
    message: '場所管理機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/v1/items:
 *   get:
 *     summary: 品目一覧取得
 *     description: 積載可能な品目の一覧を取得します
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: カテゴリでフィルター
 *       - in: query
 *         name: hazardous
 *         schema:
 *           type: boolean
 *         description: 危険物フラグでフィルター
 *     responses:
 *       200:
 *         description: 品目一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Item'
 *       401:
 *         description: 認証が必要
 *       501:
 *         description: 実装中
 */
apiRouter.get('/items', (req, res) => {
  res.status(501).json({
    success: false,
    message: '品目管理機能は実装中です',
    error: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     summary: レポート一覧取得
 *     description: 各種レポートと統計情報を取得します
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: reportType
 *         schema:
 *           type: string
 *           enum: [DAILY, WEEKLY, MONTHLY, CUSTOM]
 *         description: レポートタイプ
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 対象期間開始日
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 対象期間終了日
 *     responses:
 *       200:
 *         description: レポート一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     reportType:
 *                       type: string
 *                     period:
 *                       type: string
 *                     statistics:
 *                       type: object
 *       401:
 *         description: 認証が必要
 *       501:
 *         description: 実装中
 */