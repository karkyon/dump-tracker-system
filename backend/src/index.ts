import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';
import path from 'path';

// 既存のルートをインポート
import routes from './routes';

// 環境変数読み込み
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// セキュリティ・基本ミドルウェア
// 修正: helmet の型エラー解決
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
    crossOriginEmbedderPolicy: false
  }));
} catch (error) {
  console.warn('Helmet setup failed:', error);
  // フォールバック: 基本的なhelmet設定
  (app as any).use(helmet());
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:3001', 'http://10.1.119.244:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 修正: compression の型エラー解決  
app.use(compression() as unknown as express.RequestHandler);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
このAPIはJWT Bearer認証を使用しています。ほとんどのエンドポイントは認証が必要です。
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
        url: `http://10.1.119.244:8000/api/v1`,
        description: 'Development API Server',
      },
      {
        url: `http://localhost:8000/api/v1`,
        description: 'Local Development Server',
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
            name: { type: 'string', example: '運転手 太郎' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'DRIVER'] },
            isActive: { type: 'boolean', example: true }
          }
        },
        Vehicle: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'vehicle-123' },
            vehicleNumber: { type: 'string', example: 'D-001' },
            vehicleType: { type: 'string', example: 'ダンプトラック' },
            model: { type: 'string', example: 'いすゞ ギガ' },
            isActive: { type: 'boolean', example: true }
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
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

try {
  const swaggerSpec = (swaggerJsdoc as any)(swaggerOptions);
  app.use('/docs', (swaggerUi as any).serve);
  app.get('/docs', (swaggerUi as any).setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1f2937; }
      .swagger-ui .info .description { color: #374151; }
    `,
    customSiteTitle: 'Dump Tracker API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      showRequestHeaders: true
    }
  }));
  
  // Swagger JSON
  app.get('/api-docs', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  console.log('✅ Swagger documentation loaded successfully');
} catch (error: any) {
  console.warn('⚠️ Swagger documentation failed to load:', error.message);
}

// ルートエンドポイント - API情報表示  
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    name: 'Dump Tracker API Server',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      documentation: '/docs',
      apiDocs: '/api-docs'
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
      documentation: `http://10.1.119.244:8000/docs`,
      apiHealth: `http://10.1.119.244:8000/health`,
      apiBase: `http://10.1.119.244:8000/api/v1`
    },
    timestamp: new Date().toISOString()
  });
});

// グローバルヘルスチェック
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    system: {
      platform: process.platform,
      nodeVersion: process.version
    }
  });
});

// API v1 ルート設定
app.use('/api/v1', routes);

// 静的ファイル配信（オプション）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// エラーハンドリング
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Unhandled error:', err);
  
  const statusCode: number = err.statusCode || err.status || 500;
  
  (res as any).status(statusCode).json({
    success: false,
    message: err.message || 'サーバーエラーが発生しました',
    error: err.code || 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
});

// 404ハンドラー
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'エンドポイントが見つかりません',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET / (API情報)',
      'GET /health (ヘルスチェック)', 
      'GET /docs (API文書)',
      'GET /api/v1/* (API エンドポイント)'
    ],
    documentation: `http://10.1.119.244:8000/docs`,
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 ============================================');
  console.log('   Dump Tracker API Server Started');
  console.log('🚀 ============================================');
  console.log('');
  console.log(`🌐 Server URL: http://${HOST}:${PORT}`);
  console.log(`🌍 Network URL: http://10.1.119.244:${PORT}`);
  console.log(`📚 API Documentation: http://10.1.119.244:${PORT}/docs`);
  console.log(`🏥 Health Check: http://10.1.119.244:${PORT}/health`);
  console.log(`🔗 API Base URL: http://10.1.119.244:${PORT}/api/v1`);
  console.log('');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Node.js: ${process.version}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('   - GET /           (API Information)');
  console.log('   - GET /health     (Health Check)');
  console.log('   - GET /docs       (API Documentation)');
  console.log('   - GET /api/v1/*   (REST API)');
  console.log('');
  console.log('🛑 Press Ctrl+C to stop the server');
  console.log('============================================');
});

// プロセス終了処理
process.on('SIGTERM', () => {
  console.log('');
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

export default app;