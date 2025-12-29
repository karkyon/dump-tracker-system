// =====================================
// backend/src/services/debugService.ts
// デバッグ専用サービス - 運行・点検履歴詳細取得
// 作成日: 2025年12月29日
// 目的: ストアドファンクションを使用した運行履歴のデバッグ確認
// =====================================

import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * デバッグサービスクラス
 * 開発・デバッグモード専用の詳細データ取得機能
 */
export class DebugService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * 点検項目詳細取得
   * ストアドファンクション: get_inspection_item_details
   */
  async getInspectionItemDetails(operationId: string) {
    try {
      logger.info(`🔍 [DEBUG] 点検項目詳細取得開始`, { operationId });

      const result = await this.prisma.$queryRawUnsafe(`
        SELECT * FROM get_inspection_item_details($1::uuid)
      `, operationId);

      logger.info(`✅ [DEBUG] 点検項目詳細取得成功`, {
        operationId,
        resultCount: Array.isArray(result) ? result.length : 0
      });

      return {
        success: true,
        data: result,
        count: Array.isArray(result) ? result.length : 0,
      };
    } catch (error) {
      logger.error(`❌ [DEBUG] 点検項目詳細取得エラー`, {
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        `点検項目詳細の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'INSPECTION_DETAILS_FETCH_ERROR'
      );
    }
  }

  /**
   * 運行・点検統合詳細取得
   * ストアドファンクション: get_operation_inspection_detail
   */
  async getOperationInspectionDetail(operationId: string) {
    try {
      logger.info(`🔍 [DEBUG] 運行・点検統合詳細取得開始`, { operationId });

      const result = await this.prisma.$queryRawUnsafe(`
        SELECT * FROM get_operation_inspection_detail($1::uuid)
      `, operationId);

      logger.info(`✅ [DEBUG] 運行・点検統合詳細取得成功`, {
        operationId,
        resultCount: Array.isArray(result) ? result.length : 0
      });

      return {
        success: true,
        data: result,
        count: Array.isArray(result) ? result.length : 0,
      };
    } catch (error) {
      logger.error(`❌ [DEBUG] 運行・点検統合詳細取得エラー`, {
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        `運行・点検統合詳細の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'OPERATION_DETAILS_FETCH_ERROR'
      );
    }
  }

  /**
   * 運行履歴の完全デバッグ情報取得
   * 両方のストアドファンクションを実行して統合データを返す
   */
  async getOperationDebugInfo(operationId: string) {
    try {
      logger.info(`🔍 [DEBUG] 運行履歴完全デバッグ情報取得開始`, { operationId });

      // 並列実行で両方のデータを取得
      const [inspectionItems, operationDetail] = await Promise.all([
        this.getInspectionItemDetails(operationId),
        this.getOperationInspectionDetail(operationId),
      ]);

      logger.info(`✅ [DEBUG] 運行履歴完全デバッグ情報取得成功`, {
        operationId,
        inspectionItemsCount: inspectionItems.count,
        operationDetailCount: operationDetail.count,
      });

      return {
        success: true,
        data: {
          operationId,
          operationDetail: operationDetail.data,
          inspectionItems: inspectionItems.data,
          summary: {
            totalInspectionItems: inspectionItems.count,
            operationRecords: operationDetail.count,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`❌ [DEBUG] 運行履歴完全デバッグ情報取得エラー`, {
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 運行ID一覧取得（デバッグ用）
   * 最近の運行20件を取得
   */
  async getRecentOperationIds(limit: number = 20) {
    try {
      logger.info(`🔍 [DEBUG] 最近の運行ID一覧取得`, { limit });

      const operations = await this.prisma.operation.findMany({
        select: {
          id: true,
          operationNumber: true,
          actualStartTime: true,
          actualEndTime: true,
          status: true,
          vehicles: {
            select: {
              plateNumber: true,
            },
          },
          usersOperationsDriverIdTousers: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          actualStartTime: 'desc',
        },
        take: limit,
      });

      logger.info(`✅ [DEBUG] 運行ID一覧取得成功`, { count: operations.length });

      return {
        success: true,
        data: operations.map((op) => ({
          id: op.id,
          operationNumber: op.operationNumber,
          startTime: op.actualStartTime,
          endTime: op.actualEndTime,
          status: op.status,
          vehiclePlateNumber: op.vehicles?.plateNumber,
          driverName: op.usersOperationsDriverIdTousers?.name,
        })),
        count: operations.length,
      };
    } catch (error) {
      logger.error(`❌ [DEBUG] 運行ID一覧取得エラー`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        `運行ID一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'OPERATION_LIST_FETCH_ERROR'
      );
    }
  }
}

// =====================================
// ファクトリ関数
// =====================================

let debugServiceInstance: DebugService | null = null;

export function getDebugService(db?: PrismaClient): DebugService {
  if (!debugServiceInstance) {
    debugServiceInstance = new DebugService(db);
  }
  return debugServiceInstance;
}

export default DebugService;
