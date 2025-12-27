// =====================================
// backend/src/services/operationService.ts
// 運行管理サービス - 超詳細ログ版（完全追跡モード）
// ✅✅✅ 点検記録自動紐付け機能 + 完全ログ追跡
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
    logger.info('🔧🔧🔧 [OperationService] コンストラクタ実行 - 超詳細ログ版');
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

      if (!operation) {
        throw new NotFoundError('運行が見つかりません');
      }

      return operation;
    } catch (error) {
      logger.error('運行詳細取得エラー', { error, id });
      if (error instanceof ValidationError) throw error;
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError('運行詳細の取得に失敗しました');
    }
  }

  /**
   * 運行開始
   *
   * ✅✅✅ 超詳細ログ版 - 全処理を追跡
   */
  async startTrip(request: StartOperationRequest) {
    logger.info('🚀🚀🚀 ============================================');
    logger.info('🚀🚀🚀 [OperationService.startTrip] メソッド開始');
    logger.info('🚀🚀🚀 ============================================');
    logger.info('🚀🚀🚀 [LINE 1] startTrip メソッドに入りました', { request });

    try {
      logger.info('🚀 [LINE 2] try ブロック開始');

      // バリデーション
      logger.info('🚀 [LINE 3] バリデーション開始', {
        vehicleId: request.vehicleId,
        driverId: request.driverId
      });

      if (!request.vehicleId || !request.driverId) {
        logger.error('❌ [LINE 4] バリデーションエラー: vehicleId または driverId がない');
        throw new ValidationError('車両IDとドライバーIDは必須です');
      }

      logger.info('✅ [LINE 5] バリデーション成功');

      // ユーザーと車両の存在確認
      logger.info('🚀 [LINE 6] ユーザーと車両の存在確認開始');

      const [user, vehicle] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: request.driverId } }),
        this.prisma.vehicle.findUnique({ where: { id: request.vehicleId } })
      ]);

      logger.info('🚀 [LINE 7] ユーザー検索結果', { found: !!user, userId: request.driverId });
      logger.info('🚀 [LINE 8] 車両検索結果', { found: !!vehicle, vehicleId: request.vehicleId });

      if (!user) {
        logger.error('❌ [LINE 9] ユーザーが見つかりません');
        throw new NotFoundError('指定されたドライバーが見つかりません');
      }

      if (!vehicle) {
        logger.error('❌ [LINE 10] 車両が見つかりません');
        throw new NotFoundError('指定された車両が見つかりません');
      }

      logger.info('✅ [LINE 11] ユーザーと車両の存在確認成功');

      // 運行番号生成
      logger.info('🚀 [LINE 12] 運行番号生成開始');
      const operationNumber = await this.generateOperationNumber();
      logger.info('✅ [LINE 13] 運行番号生成完了', { operationNumber });

      // 運行データ準備
      logger.info('🚀 [LINE 14] 運行データ準備開始');
      const operationData = {
        operationNumber,
        vehicleId: request.vehicleId,
        driverId: request.driverId,
        status: 'IN_PROGRESS' as OperationStatus,
        plannedStartTime: request.plannedStartTime || new Date(),
        actualStartTime: new Date(),
        plannedEndTime: request.plannedEndTime,
        notes: request.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      logger.info('✅ [LINE 15] 運行データ準備完了', { operationData });

      // 運行作成
      logger.info('🚀 [LINE 16] 運行レコード作成開始（Prisma INSERT）');
      const operation = await this.prisma.operation.create({
        data: operationData,
        include: {
          vehicles: true,
          usersOperationsDriverIdTousers: true
        }
      });
      logger.info('✅ [LINE 17] 運行レコード作成成功', {
        operationId: operation.id,
        operationNumber: operation.operationNumber
      });

      logger.info('🚀 [LINE 18] 運行開始完了ログ出力');
      logger.info('運行開始完了', {
        driverId: request.driverId,
        operationId: operation.id,
        operationNumber: operation.operationNumber,
        vehicleId: request.vehicleId
      });

      // ================================================================
      // ✅✅✅ 点検記録の自動紐付け処理開始
      // ================================================================
      logger.info('🔗🔗🔗 ============================================');
      logger.info('🔗🔗🔗 [LINE 19] 点検記録の自動紐付け処理開始！！！');
      logger.info('🔗🔗🔗 ============================================');

      try {
        logger.info('🔗 [LINE 20] try ブロック開始（紐付け処理）');
        logger.info('🔗 [LINE 21] 🔗 点検記録の自動紐付け開始', {
          operationId: operation.id,
          driverId: request.driverId,
          vehicleId: request.vehicleId,
          現在時刻: new Date().toISOString(),
          検索範囲: '直近5分以内'
        });

        // 検索条件のログ
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        logger.info('🔗 [LINE 22] 検索条件詳細', {
          where: {
            inspectorId: request.driverId,
            vehicleId: request.vehicleId,
            operationId: null,
            inspectionType: 'PRE_TRIP',
            createdAt: { gte: fiveMinutesAgo }
          },
          fiveMinutesAgo: fiveMinutesAgo.toISOString()
        });

        logger.info('🔗 [LINE 23] Prisma検索実行開始（inspection_records）');

        // 1. 最新の点検記録を検索
        const latestInspection = await this.prisma.inspectionRecord.findFirst({
          where: {
            inspectorId: request.driverId,
            vehicleId: request.vehicleId,
            operationId: null,
            inspectionType: 'PRE_TRIP',
            createdAt: {
              gte: fiveMinutesAgo
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        logger.info('🔗 [LINE 24] Prisma検索完了', {
          found: !!latestInspection,
          inspectionId: latestInspection?.id,
          createdAt: latestInspection?.createdAt
        });

        // 2. 見つかった場合、operation_idを更新
        if (latestInspection) {
          logger.info('🔗 [LINE 25] ✅ 点検記録が見つかりました！更新処理開始');
          logger.info('🔗 [LINE 26] 更新前の点検記録', {
            inspectionId: latestInspection.id,
            currentOperationId: latestInspection.operationId,
            vehicleId: latestInspection.vehicleId,
            inspectorId: latestInspection.inspectorId,
            inspectionType: latestInspection.inspectionType,
            createdAt: latestInspection.createdAt
          });

          logger.info('🔗 [LINE 27] Prisma UPDATE実行開始');
          await this.prisma.inspectionRecord.update({
            where: { id: latestInspection.id },
            data: {
              operationId: operation.id,
              updatedAt: new Date()
            }
          });
          logger.info('🔗 [LINE 28] Prisma UPDATE実行完了');

          logger.info('🔗 [LINE 29] ✅✅✅ 点検記録を運行に紐付けました', {
            inspectionRecordId: latestInspection.id,
            operationId: operation.id,
            inspectionType: latestInspection.inspectionType,
            vehicleId: latestInspection.vehicleId,
            createdAt: latestInspection.createdAt,
            更新時刻: new Date().toISOString()
          });

          // 確認のためもう一度読み込み
          logger.info('🔗 [LINE 30] 更新後の確認読み込み開始');
          const updatedInspection = await this.prisma.inspectionRecord.findUnique({
            where: { id: latestInspection.id }
          });
          logger.info('🔗 [LINE 31] 更新後の点検記録', {
            inspectionId: updatedInspection?.id,
            operationId: updatedInspection?.operationId,
            updatedAt: updatedInspection?.updatedAt
          });

        } else {
          logger.warn('🔗 [LINE 32] ⚠️ 点検記録が見つかりませんでした');
          logger.warn('⚠️ 紐付け可能な点検記録が見つかりませんでした', {
            driverId: request.driverId,
            vehicleId: request.vehicleId,
            operationId: operation.id,
            reason: '直近5分以内のPRE_TRIP点検記録が存在しません',
            検索範囲: `${fiveMinutesAgo.toISOString()} 以降`,
            現在時刻: new Date().toISOString()
          });

          // デバッグ用: 全点検記録を表示
          logger.warn('🔗 [LINE 33] デバッグ: 全点検記録を検索（時間制限なし）');
          const allInspections = await this.prisma.inspectionRecord.findMany({
            where: {
              inspectorId: request.driverId,
              vehicleId: request.vehicleId,
              inspectionType: 'PRE_TRIP'
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          });
          logger.warn('🔗 [LINE 34] デバッグ: 見つかった点検記録', {
            count: allInspections.length,
            inspections: allInspections.map(i => ({
              id: i.id,
              operationId: i.operationId,
              createdAt: i.createdAt,
              経過秒数: Math.floor((Date.now() - new Date(i.createdAt).getTime()) / 1000)
            }))
          });
        }

        logger.info('🔗 [LINE 35] 点検記録紐付け処理完了');

      } catch (linkError) {
        logger.error('🔗 [LINE 36] ❌❌❌ 点検記録紐付けエラー発生', {
          operationId: operation.id,
          driverId: request.driverId,
          vehicleId: request.vehicleId,
          error: linkError instanceof Error ? linkError.message : linkError,
          stack: linkError instanceof Error ? linkError.stack : undefined
        });
        // エラーでも運行開始は継続（throw しない）
      }

      logger.info('🔗🔗🔗 ============================================');
      logger.info('🔗🔗🔗 [LINE 37] 点検記録の自動紐付け処理終了');
      logger.info('🔗🔗🔗 ============================================');
      // ================================================================

      logger.info('🚀 [LINE 38] startTrip メソッド正常終了 - 運行レコードを返却');
      logger.info('🚀🚀🚀 ============================================');
      logger.info('🚀🚀🚀 [OperationService.startTrip] メソッド終了');
      logger.info('🚀🚀🚀 ============================================');

      return operation;

    } catch (error) {
      logger.error('🚀 [LINE 39] ❌ startTrip エラー発生', { error, request });
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

      const operation = await this.prisma.operation.findUnique({
        where: { id: operationId }
      });

      if (!operation) {
        throw new NotFoundError('指定された運行が見つかりません');
      }

      const updated = await this.prisma.operation.update({
        where: { id: operationId },
        data: {
          status: 'COMPLETED',
          actualEndTime: endData.endTime || new Date(),
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

      const totalDistance = operations.reduce((sum, op) =>
        sum + (op.totalDistanceKm ? Number(op.totalDistanceKm) : 0), 0
      );

      const durations = operations
        .filter(op => op.actualStartTime && op.actualEndTime)
        .map(op => {
          const start = new Date(op.actualStartTime!).getTime();
          const end = new Date(op.actualEndTime!).getTime();
          return (end - start) / (1000 * 60);
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

logger.info('🔧🔧🔧 [operationService.ts] ファイル読み込み完了 - 超詳細ログ版');

export const operationService = new OperationService();
export default operationService;

logger.info('🔧🔧🔧 [operationService.ts] エクスポート完了');
