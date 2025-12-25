// backend/src/services/summaryService.ts
// 今日の運行サマリー取得サービス
// 作成日: 2025-12-25

import { OperationStatus } from '@prisma/client';
import { DatabaseService } from '../utils/database';
import logger from '../utils/logger';

export interface TodaysSummaryData {
  operationCount: number;
  totalDistance: number;
  totalDuration: number;
  lastOperationEndTime?: string;
}

export class SummaryService {
  private prisma = DatabaseService.getInstance();

  /**
   * 今日の運行サマリーを取得
   */
  async getTodaysSummary(userId: string): Promise<TodaysSummaryData> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 今日の運行データを取得
      const operations = await this.prisma.operations.findMany({
        where: {
          driverId: userId,
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        },
        select: {
          id: true,
          status: true,
          totalDistanceKm: true,
          actualStartTime: true,
          actualEndTime: true
        }
      });

      const operationCount = operations.length;

      const totalDistance = operations.reduce((sum, op) => {
        return sum + (op.totalDistanceKm ? Number(op.totalDistanceKm) : 0);
      }, 0);

      const totalDuration = operations.reduce((sum, op) => {
        if (op.actualStartTime && op.actualEndTime) {
          const duration = (op.actualEndTime.getTime() - op.actualStartTime.getTime()) / 1000 / 60;
          return sum + duration;
        }
        return sum;
      }, 0);

      const completedOps = operations
        .filter(op => op.status === OperationStatus.COMPLETED && op.actualEndTime)
        .sort((a, b) => {
          if (!a.actualEndTime || !b.actualEndTime) return 0;
          return b.actualEndTime.getTime() - a.actualEndTime.getTime();
        });

      const lastOperationEndTime = completedOps.length > 0 && completedOps[0].actualEndTime
        ? completedOps[0].actualEndTime.toISOString()
        : undefined;

      logger.info('今日の運行サマリー取得成功', {
        userId,
        operationCount,
        totalDistance,
        totalDuration
      });

      return {
        operationCount,
        totalDistance,
        totalDuration: Math.round(totalDuration),
        lastOperationEndTime
      };

    } catch (error) {
      logger.error('今日の運行サマリー取得エラー', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      throw error;
    }
  }
}

let summaryServiceInstance: SummaryService | null = null;

export function getSummaryService(): SummaryService {
  if (!summaryServiceInstance) {
    summaryServiceInstance = new SummaryService();
  }
  return summaryServiceInstance;
}

export default SummaryService;
