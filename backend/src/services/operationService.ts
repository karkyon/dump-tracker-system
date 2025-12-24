// =====================================
// backend/src/services/operationService.ts
// 運行管理サービス - ビジネスロジック分離版
// tripService.tsパターン完全準拠
// 作成日時: 2025-12-24
// 依存関係: models/OperationModel.ts, utils/database.ts
// =====================================

import { DatabaseService } from '../utils/database';
import {
  NotFoundError,
  ValidationError,
  DatabaseError
} from '../utils/errors';
import logger from '../utils/logger';

// Prisma型定義
import type {
  Operation as PrismaOperation,
  OperationStatus,
  Prisma
} from '@prisma/client';

// 共通型定義
import type { PaginationQuery } from '../types/common';

// =====================================
// 型定義
// =====================================

export interface OperationCreateInput {
  operationNumber?: string;
  vehicleId: string;
  driverId: string;
  status?: OperationStatus;
  plannedStartTime?: Date;
  actualStartTime?: Date;
  plannedEndTime?: Date;
  actualEndTime?: Date;
  startOdometer?: number;
  endOdometer?: number;
  totalDistance?: number;
  notes?: string;
}

export interface OperationUpdateInput {
  status?: OperationStatus;
  plannedStartTime?: Date;
  actualStartTime?: Date;
  plannedEndTime?: Date;
  actualEndTime?: Date;
  startOdometer?: number;
  endOdometer?: number;
  totalDistance?: number;
  notes?: string;
}

export interface OperationFilter extends PaginationQuery {
  status?: OperationStatus | OperationStatus[];
  vehicleId?: string | string[];
  driverId?: string | string[];
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

export interface OperationStatistics {
  totalOperations: number;
  activeOperations: number;
  completedOperations: number;
  cancelledOperations: number;
  averageDuration: number;
  totalDistance: number;
  averageDistance: number;
}

export interface StartOperationRequest {
  vehicleId: string;
  driverId: string;
  plannedStartTime?: Date;
  plannedEndTime?: Date;
  notes?: string;
}

export interface EndOperationRequest {
  operationId: string;
  actualEndTime?: Date;
  endOdometer?: number;
  notes?: string;
}

// =====================================
// 運行管理サービスクラス
// =====================================

export class OperationService {
  private readonly prisma: ReturnType<typeof DatabaseService.getInstance>;

  constructor() {
    this.prisma = DatabaseService.getInstance();
  }

  /**
   * 運行一覧取得（ページネーション）
   */
  async findManyWithPagination(params: {
    where?: Prisma.OperationWhereInput;
    page?: number;
    pageSize?: number;
  }) {
    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        this.prisma.operation.findMany({
          where: params.where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            vehicles: {
              select: {
                id: true,
                plateNumber: true,
                model: true,
                manufacturer: true,
                status: true,
                vehicleType: true
              }
            },
            usersOperationsDriverIdTousers: {
              select: {
                id: true,
                username: true,
                name: true,
                role: true,
                employeeId: true
              }
            }
          }
        }),
        this.prisma.operation.count({ where: params.where })
      ]);

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      logger.error('運行一覧取得エラー', { error, params });
      throw new DatabaseError('運行一覧の取得に失敗しました');
    }
  }

  /**
   * 運行詳細取得（リレーション込み）
   */
  async findWithRelations(id: string) {
    try {
      if (!id) {
        throw new ValidationError('運行IDは必須です');
      }

      const operation = await this.prisma.operation.findUnique({
        where: { id },
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true,
          operationDetails: {
            include: {
              locations: true,
              items: true
            }
          },
          gpsLogs: {
            orderBy: { recordedAt: 'desc' },
            take: 100
          }
        }
      });

      return operation;
    } catch (error) {
      logger.error('運行詳細取得エラー', { error, id });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行詳細の取得に失敗しました');
    }
  }

  /**
   * 運行開始
   */
  async startTrip(request: StartOperationRequest) {
    try {
      logger.info('運行開始処理開始', { request });

      // バリデーション
      if (!request.vehicleId || !request.driverId) {
        throw new ValidationError('車両IDとドライバーIDは必須です');
      }

      // ユーザーと車両の存在確認
      const [user, vehicle] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: request.driverId } }),
        this.prisma.vehicle.findUnique({ where: { id: request.vehicleId } })
      ]);

      if (!user) {
        throw new NotFoundError('指定されたドライバーが見つかりません');
      }

      if (!vehicle) {
        throw new NotFoundError('指定された車両が見つかりません');
      }

      // 運行番号生成（YYYYMMDD-XXX形式）
      const operationNumber = await this.generateOperationNumber();

      // 運行作成
      const operation = await this.prisma.operation.create({
        data: {
          operationNumber,
          vehicleId: request.vehicleId,
          driverId: request.driverId,
          status: 'IN_PROGRESS',
          plannedStartTime: request.plannedStartTime || new Date(),
          actualStartTime: new Date(),
          plannedEndTime: request.plannedEndTime,
          notes: request.notes
        },
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
      });

      logger.info('運行開始完了', { operationId: operation.id });

      return operation;
    } catch (error) {
      logger.error('運行開始エラー', { error, request });
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('運行の開始に失敗しました');
    }
  }

  /**
   * 運行終了
   */
  async endTrip(operationId: string, endData: {
    endTime?: Date;
    endOdometer?: number;
    notes?: string;
  }) {
    try {
      logger.info('運行終了処理開始', { operationId, endData });

      if (!operationId) {
        throw new ValidationError('運行IDは必須です');
      }

      // 運行の存在確認
      const operation = await this.prisma.operation.findUnique({
        where: { id: operationId }
      });

      if (!operation) {
        throw new NotFoundError('指定された運行が見つかりません');
      }

      // 走行距離計算
      const totalDistance = endData.endOdometer && operation.startOdometer
        ? endData.endOdometer - operation.startOdometer
        : operation.totalDistance;

      // 運行更新
      const updated = await this.prisma.operation.update({
        where: { id: operationId },
        data: {
          status: 'COMPLETED',
          actualEndTime: endData.endTime || new Date(),
          endOdometer: endData.endOdometer,
          totalDistance,
          notes: endData.notes ? `${operation.notes || ''}\n${endData.notes}` : operation.notes
        },
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
      });

      logger.info('運行終了完了', { operationId });

      return updated;
    } catch (error) {
      logger.error('運行終了エラー', { error, operationId });
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('運行の終了に失敗しました');
    }
  }

  /**
   * 車両IDによる運行取得
   */
  async findByVehicleId(vehicleId: string, limit?: number) {
    try {
      if (!vehicleId) {
        throw new ValidationError('車両IDは必須です');
      }

      return await this.prisma.operation.findMany({
        where: { vehicleId },
        orderBy: { actualStartTime: 'desc' },
        take: limit,
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
      });
    } catch (error) {
      logger.error('車両運行取得エラー', { error, vehicleId });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行の取得に失敗しました');
    }
  }

  /**
   * ステータスによる運行取得
   */
  async findByStatus(status: OperationStatus, limit?: number) {
    try {
      if (!status) {
        throw new ValidationError('ステータスは必須です');
      }

      return await this.prisma.operation.findMany({
        where: { status },
        orderBy: { actualStartTime: 'desc' },
        take: limit,
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
      });
    } catch (error) {
      logger.error('ステータス運行取得エラー', { error, status });
      if (error instanceof ValidationError) throw error;
      throw new DatabaseError('運行の取得に失敗しました');
    }
  }

  /**
   * 運行統計取得
   */
  async getStatistics(filter?: OperationFilter): Promise<OperationStatistics> {
    try {
      const where = this.buildWhereClause(filter);

      const [
        totalOperations,
        activeOperations,
        completedOperations,
        cancelledOperations,
        operations
      ] = await Promise.all([
        this.prisma.operation.count({ where }),
        this.prisma.operation.count({ where: { ...where, status: 'IN_PROGRESS' } }),
        this.prisma.operation.count({ where: { ...where, status: 'COMPLETED' } }),
        this.prisma.operation.count({ where: { ...where, status: 'CANCELLED' } }),
        this.prisma.operation.findMany({ where })
      ]);

      // 統計計算
      const totalDistance = operations.reduce((sum, op) =>
        sum + (op.totalDistance || 0), 0
      );

      const durations = operations
        .filter(op => op.actualStartTime && op.actualEndTime)
        .map(op => {
          const start = new Date(op.actualStartTime!).getTime();
          const end = new Date(op.actualEndTime!).getTime();
          return (end - start) / (1000 * 60); // 分単位
        });

      const averageDuration = durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

      return {
        totalOperations,
        activeOperations,
        completedOperations,
        cancelledOperations,
        averageDuration,
        totalDistance,
        averageDistance: totalOperations > 0 ? totalDistance / totalOperations : 0
      };
    } catch (error) {
      logger.error('運行統計取得エラー', { error, filter });
      throw new DatabaseError('運行統計の取得に失敗しました');
    }
  }

  /**
   * 運行更新
   */
  async update(
    where: Prisma.OperationWhereUniqueInput,
    data: OperationUpdateInput
  ) {
    try {
      return await this.prisma.operation.update({
        where,
        data: {
          ...data,
          updatedAt: new Date()
        },
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
      });
    } catch (error) {
      logger.error('運行更新エラー', { error, where, data });
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('指定された運行が見つかりません');
      }
      throw new DatabaseError('運行の更新に失敗しました');
    }
  }

  /**
   * 運行削除
   */
  async delete(where: Prisma.OperationWhereUniqueInput) {
    try {
      return await this.prisma.operation.delete({ where });
    } catch (error) {
      logger.error('運行削除エラー', { error, where });
      if ((error as any).code === 'P2025') {
        throw new NotFoundError('指定された運行が見つかりません');
      }
      throw new DatabaseError('運行の削除に失敗しました');
    }
  }

  /**
   * WHERE句構築
   */
  private buildWhereClause(filter?: OperationFilter): Prisma.OperationWhereInput {
    if (!filter) return {};

    const where: Prisma.OperationWhereInput = {};

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        where.status = { in: filter.status };
      } else {
        where.status = filter.status;
      }
    }

    if (filter.vehicleId) {
      if (Array.isArray(filter.vehicleId)) {
        where.vehicleId = { in: filter.vehicleId };
      } else {
        where.vehicleId = filter.vehicleId;
      }
    }

    if (filter.driverId) {
      if (Array.isArray(filter.driverId)) {
        where.driverId = { in: filter.driverId };
      } else {
        where.driverId = filter.driverId;
      }
    }

    if (filter.startDate || filter.endDate) {
      where.actualStartTime = {};
      if (filter.startDate) {
        where.actualStartTime.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.actualStartTime.lte = filter.endDate;
      }
    }

    if (filter.searchTerm) {
      where.OR = [
        { operationNumber: { contains: filter.searchTerm, mode: 'insensitive' } },
        { notes: { contains: filter.searchTerm, mode: 'insensitive' } }
      ];
    }

    return where;
  }

  /**
   * 運行番号生成（YYYYMMDD-XXX形式）
   */
  private async generateOperationNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `OP${year}${month}${day}`;

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const count = await this.prisma.operation.count({
          where: {
            operationNumber: {
              startsWith: prefix
            }
          }
        });

        const sequence = String(count + 1).padStart(4, '0');
        const operationNumber = `${prefix}-${sequence}`;

        // 重複チェック
        const existing = await this.prisma.operation.findUnique({
          where: { operationNumber }
        });

        if (!existing) {
          return operationNumber;
        }

        attempts++;
        logger.warn('運行番号の重複を検出、再生成します', {
          operationNumber,
          attempt: attempts
        });

        await new Promise(resolve => setTimeout(resolve, 10 * attempts));
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        logger.warn('運行番号生成エラー、再試行します', {
          error,
          attempt: attempts
        });
        await new Promise(resolve => setTimeout(resolve, 10 * attempts));
      }
    }

    throw new Error('運行番号の生成に失敗しました（最大試行回数を超えました）');
  }
}

// =====================================
// エクスポート
// =====================================

export const operationService = new OperationService();
export default operationService;

// =====================================
// ✅ services/operationService.ts 作成完了
// =====================================

/**
 * 【実装内容】
 *
 * ✅ tripService.tsパターン完全適用
 *    - ビジネスロジック完全分離
 *    - DatabaseService活用
 *    - エラーハンドリング統一
 *    - logger統合
 *
 * ✅ 全メソッド実装
 *    - findManyWithPagination: 運行一覧取得
 *    - findWithRelations: 運行詳細取得
 *    - startTrip: 運行開始
 *    - endTrip: 運行終了
 *    - findByVehicleId: 車両別運行取得
 *    - findByStatus: ステータス別運行取得
 *    - getStatistics: 運行統計取得
 *    - update: 運行更新
 *    - delete: 運行削除
 *    - buildWhereClause: WHERE句構築
 *    - generateOperationNumber: 運行番号生成
 *
 * ✅ Prisma完全統合
 *    - operations テーブル操作
 *    - リレーション (vehicles, users) 取得
 *    - N+1問題回避（Promise.all）
 *    - トランザクション対応準備
 *
 * ✅ エラーハンドリング
 *    - ValidationError
 *    - NotFoundError
 *    - DatabaseError
 *    - ログ出力
 */
