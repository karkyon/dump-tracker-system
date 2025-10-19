// =====================================
// backend/src/utils/database.ts
// PrismaClientのシングルトン管理とDB接続統一クラス
// 配置: utils/ - データベース接続の統一管理層
// 全サービス層からのDB接続をこのファイル経由で統一
// 作成日時: 2025年9月26日
// 最終更新: 2025年10月19日 - Prisma 5.0+ beforeExit対応
// =====================================

import { Prisma, PrismaClient } from '@prisma/client';

// =====================================
// 型定義（export: config/database.tsから参照）
// =====================================

export interface DatabaseConfig {
  url?: string;
  maxConnections?: number;
  connectionTimeout?: number;
  logLevel?: Prisma.LogLevel[];
}

export interface ConnectionInfo {
  isConnected: boolean;
  connectionCount: number;
  lastConnectionAt?: Date;
  lastErrorAt?: Date;
  lastError?: string;
}

// =====================================
// DatabaseService クラス
// =====================================

export class DatabaseService {
  private static instance: PrismaClient | null = null;
  private static isInitializing = false;
  private static connectionInfo: ConnectionInfo = {
    isConnected: false,
    connectionCount: 0
  };

  /**
   * シングルトンPrismaClientインスタンス取得
   */
  static getInstance(config?: DatabaseConfig): PrismaClient {
    if (DatabaseService.instance) {
      return DatabaseService.instance;
    }

    if (DatabaseService.isInitializing) {
      throw new Error('Database is currently initializing. Please wait.');
    }

    return DatabaseService.createInstance(config);
  }

  /**
   * 新しいPrismaClientインスタンス作成（Prisma 5.0+対応）
   */
  private static createInstance(config?: DatabaseConfig): PrismaClient {
    DatabaseService.isInitializing = true;

    try {
      const options: Prisma.PrismaClientOptions = {
        // datasources設定（schema.prismaのdatasource名と一致）
        datasources: config?.url ? {
          db: { url: config.url }
        } : undefined,

        // ログ設定（開発環境でstdoutに出力・Prisma v6対応）
        log: config?.logLevel || [
          { level: 'query', emit: 'stdout' },
          { level: 'info', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
          { level: 'error', emit: 'stdout' }
        ],

        // エラーフォーマット設定
        errorFormat: 'minimal'
      };

      const client = new PrismaClient(options);

      // ✅ Prisma 5.0+ 対応: beforeExitフックを削除
      // Prisma 5.0以降、beforeExitはlibrary engineでサポートされていない
      // 代わりに、processレベルでイベントリスナーを登録

      // 接続情報更新
      DatabaseService.connectionInfo.isConnected = true;
      DatabaseService.connectionInfo.connectionCount++;
      DatabaseService.connectionInfo.lastConnectionAt = new Date();

      DatabaseService.instance = client;

      console.log(`[DatabaseService] PrismaClient initialized successfully (Connection #${DatabaseService.connectionInfo.connectionCount})`);

      return client;

    } catch (error) {
      DatabaseService.connectionInfo.lastErrorAt = new Date();
      DatabaseService.connectionInfo.lastError = error instanceof Error ? error.message : 'Unknown error';
      DatabaseService.connectionInfo.isConnected = false;

      console.error('[DatabaseService] Failed to initialize PrismaClient:', error);
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

    } finally {
      DatabaseService.isInitializing = false;
    }
  }

  /**
   * データベース接続テスト
   */
  static async testConnection(): Promise<boolean> {
    try {
      const prisma = DatabaseService.getInstance();
      await prisma.$queryRaw`SELECT 1 as test`;

      DatabaseService.connectionInfo.isConnected = true;
      console.log('[DatabaseService] Connection test successful');
      return true;

    } catch (error) {
      DatabaseService.connectionInfo.isConnected = false;
      DatabaseService.connectionInfo.lastErrorAt = new Date();
      DatabaseService.connectionInfo.lastError = error instanceof Error ? error.message : 'Unknown error';

      console.error('[DatabaseService] Connection test failed:', error);
      return false;
    }
  }

  /**
   * データベース切断
   */
  static async disconnect(): Promise<void> {
    if (DatabaseService.instance) {
      try {
        await DatabaseService.instance.$disconnect();
        DatabaseService.connectionInfo.isConnected = false;
        DatabaseService.instance = null;
        console.log('[DatabaseService] Database disconnected successfully');
      } catch (error) {
        console.error('[DatabaseService] Error during disconnect:', error);
        throw error;
      }
    }
  }

  /**
   * 接続情報取得
   */
  static getConnectionInfo(): ConnectionInfo {
    return { ...DatabaseService.connectionInfo };
  }

  /**
   * トランザクション実行ヘルパー
   */
  static async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    const prisma = DatabaseService.getInstance();
    return await prisma.$transaction(fn);
  }

  /**
   * ヘルスチェック
   */
  static async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    connectionInfo: ConnectionInfo;
    timestamp: Date;
    details: string;
  }> {
    const timestamp = new Date();

    try {
      const isConnected = await DatabaseService.testConnection();

      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        connectionInfo: DatabaseService.getConnectionInfo(),
        timestamp,
        details: isConnected ? 'Connection successful' : 'Connection failed'
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        connectionInfo: DatabaseService.getConnectionInfo(),
        timestamp,
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// =====================================
// 便利関数のエクスポート
// =====================================

/**
 * デフォルトPrismaClientインスタンス取得
 */
export const getPrismaClient = (config?: DatabaseConfig): PrismaClient => {
  return DatabaseService.getInstance(config);
};

/**
 * データベース接続テスト用
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  return DatabaseService.testConnection();
};

/**
 * ヘルスチェック実行（export: config/database.tsから参照）
 */
export const getDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  connectionInfo: ConnectionInfo;
  timestamp: Date;
  details: string;
}> => {
  return DatabaseService.healthCheck();
};

/**
 * DATABASE_SERVICE インスタンス（export: index.tsから参照）
 */
export const DATABASE_SERVICE = DatabaseService;

// =====================================
// プロセス終了時のクリーンアップ（Prisma 5.0+ 対応）
// =====================================

// ✅ Prisma 5.0+ では、processレベルで直接イベントリスナーを登録
process.on('beforeExit', async () => {
  console.log('[DatabaseService] Process beforeExit event received');
  await DatabaseService.disconnect();
});

process.on('SIGINT', async () => {
  console.log('[DatabaseService] Received SIGINT, cleaning up...');
  await DatabaseService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[DatabaseService] Received SIGTERM, cleaning up...');
  await DatabaseService.disconnect();
  process.exit(0);
});

// =====================================
// デフォルトエクスポート
// =====================================

export default DatabaseService;
