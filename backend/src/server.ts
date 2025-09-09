// backend/src/server.ts
import app from './app';
import { config, initializeConfig } from './config/environment';
import { connectDatabase } from './config/database';
import logger from './utils/logger';

const PORT = config.PORT || 8000;

const startServer = async () => {
  try {
    // 設定の初期化
    initializeConfig();
    
    // データベース接続
    await connectDatabase();
    
    // サーバー起動
    const server = app.listen(PORT, config.HOST, () => {
      logger.info(`🚀 Server is running on http://${config.HOST}:${PORT}`);
      logger.info(`📝 API Documentation: http://${config.HOST}:${PORT}/api/v1/docs`);
      logger.info(`💓 Health Check: http://${config.HOST}:${PORT}/health`);
      logger.info(`🌍 Environment: ${config.NODE_ENV}`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();
