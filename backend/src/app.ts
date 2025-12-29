// =====================================
// backend/src/app.ts
// Express アプリケーション設定 - 包括的最適化版
// middleware層100%活用・CORS完全対応・favicon対応・環境変数統一
// 最終更新: 2025年10月20日
// 修正内容: PORT統一・CORS最適化・favicon追加・ルートリダイレクト
// デバッグルート追加: 2025年12月29日
// =====================================

import compression from 'compression';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { v4 as uuidv4 } from 'uuid';

// 🎯 完成済み7層統合基盤の100%活用（middleware層）
import {
  authenticateToken,
  requireAdmin
} from './middleware/auth';

import {
  asyncHandler,
  errorHandler,
  getErrorStatistics,
  notFound
} from './middleware/errorHandler';

import {
  performanceLogger,
  requestLogger
} from './middleware/logger';

// 🎯 完成済み統合基盤の100%活用（utils層）
import {
  sendSuccess
} from './utils/response';

import { DATABASE_SERVICE } from './utils/database';
import logger from './utils/logger';

// 🎯 完成済み統合基盤の100%活用（config層）
import { swaggerSpec, swaggerUiOptions } from './config/swagger';

// 🎯 統一型定義インポート（types層）
import type { AuthenticatedRequest } from './types';

// 🎯 モバイルルート統合（既存機能保持）
let mobileRoutes: any;
try {
  mobileRoutes = require('./routes/mobile').default || require('./routes/mobile');
} catch (error) {
  logger.warn('モバイルルート読み込み失敗 - フォールバック機能提供', {
    error: error instanceof Error ? error.message : String(error)
  });
  mobileRoutes = null;
}

/**
 * Expressアプリケーション統合クラス
 * 包括的最適化: CORS・favicon・PORT統一・ルートリダイレクト
 *
 * 【最適化内容】
 * ✅ PORT設定の統一（環境変数からの正確な読み取り）
 * ✅ CORS設定の最適化（開発・本番環境別）
 * ✅ faviconハンドリング追加
 * ✅ ルートエンドポイント追加（/docs へリダイレクト）
 * ✅ Swagger UI完全対応
 */
export class ExpressApp {
  public app: Application;
  private readonly PORT: number;
  private readonly HOST: string;
  private readonly useHttps: boolean;
  private readonly PROTOCOL: string;

  constructor() {
    this.app = express();

    // 🎯 環境変数から正確に設定を読み取る
    this.PORT = parseInt(process.env.PORT || '8000', 10);
    this.HOST = process.env.HOST || '10.1.119.244';
    this.useHttps = process.env.USE_HTTPS === 'true';
    this.PROTOCOL = this.useHttps ? 'https' : 'http';

    // 初期化
    this.initializeMiddlewares();
    this.initializeSwagger();
    this.initializeRoutes();
    this.initializeErrorHandling();

    logger.info('✅ ExpressApp初期化完了 - 包括的最適化版', {
      port: this.PORT,
      host: this.HOST,
      protocol: this.PROTOCOL
    });
  }

  /**
   * ミドルウェア設定（包括的最適化版）
   * CORS・セキュリティ・パフォーマンス統合
   */
  private initializeMiddlewares(): void {
    logger.info('🔧 ミドルウェア設定開始 - 包括的最適化');

    // 🛡️ セキュリティミドルウェア（環境別最適化）
    const helmetConfig = this.useHttps ? {
      // HTTPS環境: 厳格なセキュリティ
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:']
        }
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' as const },
      crossOriginEmbedderPolicy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    } : {
      // HTTP環境: Swagger UI互換性優先
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "http:", "https:"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http:", "https:"],
          imgSrc: ["'self'", 'data:', 'http:', 'https:'],
          fontSrc: ["'self'", 'data:', 'http:', 'https:'],
          connectSrc: ["'self'", 'http:', 'https:', 'ws:', 'wss:']
        }
      },
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: false
    };

    this.app.use(helmet(helmetConfig));
    logger.info(`✅ Helmet設定完了 - ${this.useHttps ? 'HTTPS厳格モード' : 'HTTP開発モード'}`);

    // 🌐 CORS設定（包括的最適化版）
    this.configureCORS();

    // 📦 リクエストボディパーサー
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 🗜️ 圧縮ミドルウェア
    this.app.use(compression());

    // 📝 HTTPリクエストログ（Morgan）
    this.app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: {
        write: (message: string) => {
          logger.info(message.trim());
        }
      }
    }));

    // 🎯 統合基盤活用: リクエストログ・パフォーマンス監視
    this.app.use(requestLogger());
    this.app.use(performanceLogger());

    // 🆔 リクエストID付与
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      (req as any).requestId = uuidv4();
      res.setHeader('X-Request-ID', (req as any).requestId);
      next();
    });

    logger.info('✅ ミドルウェア設定完了');
  }

  /**
   * CORS設定（包括的最適化版）
   * 開発環境・本番環境別の適切な設定
   */
  private configureCORS(): void {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // 🎯 許可するオリジンリスト（環境別）
    const allowedOrigins = isDevelopment ? [
      // 開発環境: ローカル・開発サーバー
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      `http://${this.HOST}:3000`,
      `http://${this.HOST}:3001`,
      `http://${this.HOST}:${this.PORT}`,
      `https://${this.HOST}:3000`,
      `https://${this.HOST}:3001`,
      `https://${this.HOST}:${this.PORT}`,
      // 環境変数からの追加
      ...(process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [])
    ] : [
      // 本番環境: 環境変数からのみ
      ...(process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [])
    ];

    this.app.use(cors({
      origin: (origin, callback) => {
        // originがundefined = 同一オリジン、または開発環境での全許可
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else if (isDevelopment) {
          // 開発環境: 警告を出して許可
          logger.warn(`CORS: 未登録のオリジンからのリクエスト: ${origin} (開発環境のため許可)`);
          callback(null, true);
        } else {
          // 本番環境: 拒否
          logger.error(`CORS: 拒否されたオリジン: ${origin}`);
          callback(new Error(`CORS policy: Origin ${origin} is not allowed`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
      maxAge: 86400 // 24時間キャッシュ
    }));

    logger.info('✅ CORS設定完了', {
      mode: isDevelopment ? '開発環境（寛容）' : '本番環境（厳格）',
      allowedOrigins: allowedOrigins.length
    });
  }

  /**
   * Swagger API文書設定
   */
  private initializeSwagger(): void {
    logger.info('📚 Swagger API文書設定開始');

    try {
      // Swagger UI用の専用ミドルウェア（CSP緩和）
      this.app.use('/docs', (req: Request, res: Response, next: NextFunction) => {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; " +
          "style-src 'self' 'unsafe-inline' http: https:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; " +
          "img-src 'self' data: http: https:; " +
          "font-src 'self' data: http: https:; " +
          "connect-src 'self' http: https: ws: wss:;"
        );
        next();
      });

      // Swagger UI設定
      this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

      // Swagger JSON エンドポイント
      this.app.get('/docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
      });

      logger.info(`✅ Swagger API文書設定完了: ${this.PROTOCOL}://${this.HOST}:${this.PORT}/docs`);
    } catch (error) {
      logger.error('❌ Swagger設定エラー', error);
    }
  }

  /**
   * ルート設定（包括的最適化版）
   */
  private initializeRoutes(): void {
    logger.info('🚀 ルート設定開始');

    // 🏠 ルートエンドポイント（/docsへリダイレクト）
    this.app.get('/', (req: Request, res: Response) => {
      res.redirect(301, '/docs');
    });

    // 🖼️ favicon ハンドリング（404エラー解消）
    this.app.get('/favicon.ico', (req: Request, res: Response) => {
      // 実際のfaviconファイルがあればそれを返す
      const faviconPath = path.join(__dirname, '../public/favicon.ico');
      try {
        const fs = require('fs');
        if (fs.existsSync(faviconPath)) {
          res.sendFile(faviconPath);
        } else {
          // faviconがない場合は204 No Contentを返す（エラーログを出さない）
          res.status(204).end();
        }
      } catch (error) {
        res.status(204).end();
      }
    });

    // 🏥 ヘルスチェックエンドポイント
    this.app.get('/health', asyncHandler(async (req: Request, res: Response) => {
      const health = await DATABASE_SERVICE.healthCheck();
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      sendSuccess(res, {
        status: 'healthy',
        uptime: Math.floor(uptime),
        timestamp: new Date().toISOString(),
        database: health,
        memory: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
        },
        server: {
          protocol: this.PROTOCOL,
          host: this.HOST,
          port: this.PORT,
          url: `${this.PROTOCOL}://${this.HOST}:${this.PORT}`
        },
        environment: process.env.NODE_ENV || 'development'
      }, 'システム正常稼働中');
    }));

    // 📊 統計情報エンドポイント（管理者のみ）
    this.app.get('/api/stats',
      authenticateToken,
      requireAdmin,
      asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const errorStats = getErrorStatistics();

        sendSuccess(res, {
          errors: errorStats,
          timestamp: new Date().toISOString()
        }, '統計情報取得成功');
      })
    );

    // 🎯 統合APIルート設定
    let routes: any;
    try {
      routes = require('./routes/index').default || require('./routes/index');
      this.app.use('/api/v1', routes);
      logger.info('✅ 完成済み統合APIルート登録完了');
    } catch (error) {
      logger.error('❌ routes/index.ts 読み込みエラー', error);
      logger.warn('⚠️ 個別ルート登録にフォールバック');
      this.registerIndividualRoutes();
    }

    // 🔍 デバッグAPIルート（管理者専用）
    try {
      const debugRoutes = require('./routes/debugRoutes').default || require('./routes/debugRoutes');
      this.app.use('/api/debug', debugRoutes);
      logger.info('✅ デバッグAPIルート登録完了');
    } catch (error) {
      logger.warn('⚠️ デバッグルート読み込み失敗（オプション機能）', error);
    }

    // 🎯 モバイルAPI統合
    if (mobileRoutes) {
      this.app.use('/api/mobile', mobileRoutes);
      logger.info('✅ モバイルAPI登録完了');
    }

    // 🎯 静的ファイル配信（本番環境用）
    if (process.env.NODE_ENV === 'production') {
      const staticPath = path.join(__dirname, '../dist');
      try {
        const fs = require('fs');
        if (fs.existsSync(staticPath)) {
          this.app.use(express.static(staticPath, {
            maxAge: '1y',
            etag: true,
            lastModified: true
          }));
          logger.info('✅ 静的ファイル配信設定完了');
        }
      } catch (error) {
        logger.warn('静的ファイル配信スキップ', error);
      }
    }

    logger.info('✅ ルート設定完了');
  }

  /**
   * 個別ルート登録（フォールバック）
   */
  private registerIndividualRoutes(): void {
    const routeConfigs = [
      { path: '/api/v1/auth', module: './routes/authRoutes', name: '認証' },
      { path: '/api/v1/users', module: './routes/userRoutes', name: 'ユーザー' },
      { path: '/api/v1/vehicles', module: './routes/vehicleRoutes', name: '車両' },
      { path: '/api/v1/trips', module: './routes/tripRoutes', name: '運行' },
      { path: '/api/v1/inspections', module: './routes/inspectionRoutes', name: '点検' }
    ];

    for (const { path, module, name } of routeConfigs) {
      try {
        const router = require(module).default;
        this.app.use(path, router);
        logger.info(`✅ ${name}ルート登録完了`);
      } catch (error) {
        logger.warn(`${name}ルート読み込み失敗`, error);
      }
    }
  }

  /**
   * エラーハンドリング設定
   */
  private initializeErrorHandling(): void {
    logger.info('🚨 エラーハンドリング設定');

    // 404ハンドラー
    this.app.use(notFound);

    // グローバルエラーハンドラー
    this.app.use(errorHandler);

    // プロセスレベルエラーハンドリング
    process.on('uncaughtException', (error: Error) => {
      logger.error('🔥 未捕捉例外', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any) => {
      logger.error('🔥 未処理Promise拒否', { reason });
      process.exit(1);
    });

    logger.info('✅ エラーハンドリング設定完了');
  }

  /**
   * Expressアプリケーションインスタンス取得
   */
  public getApp(): Application {
    return this.app;
  }

  /**
   * サーバー情報取得
   */
  public getServerInfo() {
    return {
      protocol: this.PROTOCOL,
      host: this.HOST,
      port: this.PORT,
      url: `${this.PROTOCOL}://${this.HOST}:${this.PORT}`
    };
  }
}

// エクスポート
let _expressAppInstance: ExpressApp | null = null;

export const getExpressApp = (): ExpressApp => {
  if (!_expressAppInstance) {
    _expressAppInstance = new ExpressApp();
  }
  return _expressAppInstance;
};

export default ExpressApp;

// =====================================
// ✅ 包括的最適化完了
// =====================================

/**
 * 【最適化サマリー】
 *
 * ✅ PORT設定の統一
 *   - 環境変数から正確に読み取り
 *   - デフォルト値の一貫性確保
 *
 * ✅ CORS設定の最適化
 *   - 開発環境: 柔軟な許可（警告付き）
 *   - 本番環境: 厳格な制御
 *   - オリジンリストの動的生成
 *
 * ✅ faviconハンドリング追加
 *   - 404エラー解消
 *   - 204 No Contentレスポンス
 *
 * ✅ ルートエンドポイント追加
 *   - / → /docs へ301リダイレクト
 *   - APIドキュメントへの直接アクセス
 *
 * ✅ デバッグAPIルート追加（2025-12-29）
 *   - /api/debug エンドポイント
 *   - 管理者専用デバッグ機能
 *   - オプション機能（読み込み失敗時も継続）
 *
 * ✅ ヘルスチェック強化
 *   - サーバー情報の追加
 *   - メモリ使用状況の詳細表示
 */
