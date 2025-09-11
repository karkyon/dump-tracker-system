// backend/src/services/inspectionService.ts
import { PrismaClient, Prisma, InspectionType, InputType } from '@prisma/client';
import {
  InspectionItem,
  InspectionRecord,
  CreateInspectionItemRequest,
  UpdateInspectionItemRequest,
  CreateInspectionRecordRequest,
  UpdateInspectionRecordRequest,
  InspectionFilter,
  PaginatedResponse,
  UserRole
} from '../types';
import { AppError } from '../utils/asyncHandler';

const prisma = new PrismaClient();

export class InspectionService {
  /**
   * 点検項目一覧取得
   */
  async getInspectionItems(filter: {
    page: number;
    limit: number;
    inspectionType?: string;
    isActive?: boolean;
    sortBy?: string;
  }): Promise<PaginatedResponse<InspectionItem>> {
    const {
      page = 1,
      limit = 50,
      inspectionType,
      isActive = true,
      sortBy = 'displayOrder'
    } = filter;

    const where: Prisma.InspectionItemWhereInput = {};

    if (inspectionType) {
      where.inspectionType = inspectionType as InspectionType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // 総件数取得
    const totalItems = await prisma.inspectionItem.count({ where });

    // ページネーション計算
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(totalItems / limit);

    // データ取得
    const items = await prisma.inspectionItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: 'asc' },
      include: {
        _count: {
          select: {
            inspectionRecords: true
          }
        }
      }
    });

    return {
      data: items,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit
      }
    };
  }

  /**
   * 点検項目詳細取得
   */
  async getInspectionItemById(id: string): Promise<InspectionItem> {
    const item = await prisma.inspectionItem.findUnique({
      where: { id },
      include: {
        inspectionRecords: {
          take: 10,
          orderBy: { inspectionDate: 'desc' },
          include: {
            inspector: {
              select: {
                id: true,
                name: true,
                username: true
              }
            }
          }
        },
        _count: {
          select: {
            inspectionRecords: true
          }
        }
      }
    });

    if (!item) {
      throw new AppError('点検項目が見つかりません', 404);
    }

    return item;
  }

  /**
   * 点検項目新規作成
   */
  async createInspectionItem(data: CreateInspectionItemRequest): Promise<InspectionItem> {
    // 同一名の点検項目存在チェック
    const existingItem = await prisma.inspectionItem.findFirst({
      where: {
        name: data.name,
        inspectionType: data.inspectionType as InspectionType,
        isActive: true
      }
    });

    if (existingItem) {
      throw new AppError('同じ名前の点検項目が既に存在します', 400);
    }

    // 表示順序が指定されていない場合は最後に追加
    let displayOrder = data.displayOrder;
    if (!displayOrder) {
      const lastItem = await prisma.inspectionItem.findFirst({
        where: {
          inspectionType: data.inspectionType as InspectionType,
          isActive: true
        },
        orderBy: { displayOrder: 'desc' }
      });
      displayOrder = (lastItem?.displayOrder || 0) + 10;
    }

    const item = await prisma.inspectionItem.create({
      data: {
        name: data.name,
        inspectionType: data.inspectionType as InspectionType,
        inputType: (data.inputType as InputType) || InputType.CHECKBOX,
        displayOrder,
        isRequired: data.isRequired || false,
        description: data.description,
        isActive: true
      }
    });

    return item;
  }

  /**
   * 点検項目更新
   */
  async updateInspectionItem(
    id: string,
    data: UpdateInspectionItemRequest
  ): Promise<InspectionItem> {
    const existingItem = await prisma.inspectionItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      throw new AppError('点検項目が見つかりません', 404);
    }

    // 名前の重複チェック（自分以外）
    if (data.name && data.name !== existingItem.name) {
      const duplicateItem = await prisma.inspectionItem.findFirst({
        where: {
          name: data.name,
          inspectionType: data.inspectionType || existingItem.inspectionType,
          isActive: true,
          id: { not: id }
        }
      });

      if (duplicateItem) {
        throw new AppError('同じ名前の点検項目が既に存在します', 400);
      }
    }

    const item = await prisma.inspectionItem.update({
      where: { id },
      data: {
        ...data,
        inspectionType: data.inspectionType ? data.inspectionType as InspectionType : undefined,
        inputType: data.inputType ? data.inputType as InputType : undefined
      }
    });

    return item;
  }

  /**
   * 点検項目削除（論理削除）
   */
  async deleteInspectionItem(id: string): Promise<void> {
    const item = await prisma.inspectionItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inspectionRecords: true
          }
        }
      }
    });

    if (!item) {
      throw new AppError('点検項目が見つかりません', 404);
    }

    // 点検記録が存在する場合は論理削除
    if (item._count.inspectionRecords > 0) {
      await prisma.inspectionItem.update({
        where: { id },
        data: { isActive: false }
      });
    } else {
      // 点検記録が存在しない場合は物理削除
      await prisma.inspectionItem.delete({
        where: { id }
      });
    }
  }

  /**
   * 点検項目表示順更新
   */
  async updateInspectionItemOrder(items: { id: string; displayOrder: number }[]): Promise<void> {
    const updatePromises = items.map(item =>
      prisma.inspectionItem.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder }
      })
    );

    await Promise.all(updatePromises);
  }

  /**
   * 点検記録一覧取得
   */
  async getInspectionRecords(
    filter: InspectionFilter,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<PaginatedResponse<InspectionRecord>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'inspectionDate',
      sortOrder = 'desc',
      operationId,
      driverId,
      vehicleId,
      inspectionType,
      startDate,
      endDate
    } = filter;

    const where: Prisma.inspection_recordsWhereInput = {};

    // フィルター条件
    if (operationId) {
      where.operationId = operationId;
    }

    if (driverId) {
      where.operation = { driverId };
    }

    if (vehicleId) {
      where.operation = { vehicleId };
    }

    if (inspectionType) {
      where.inspectionItem = { inspectionType: inspectionType as InspectionType };
    }

    if (startDate || endDate) {
      where.inspectionDate = {};
      if (startDate) where.inspectionDate.gte = new Date(startDate);
      if (endDate) where.inspectionDate.lte = new Date(endDate);
    }

    // 運転手は自分の点検記録のみ取得可能
    if (requesterRole === UserRole.DRIVER) {
      where.inspectorId = requesterId;
    }

    // 総件数取得
    const totalItems = await prisma.inspection_records.count({ where });

    // ページネーション計算
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(totalItems / limit);

    // データ取得
    const records = await prisma.inspection_records.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        inspectionItem: true,
        inspector: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        operation: {
          include: {
            vehicle: {
              select: {
                id: true,
                vehicleNumber: true,
                vehicleType: true
              }
            },
            driver: {
              select: {
                id: true,
                name: true,
                username: true
              }
            }
          }
        }
      }
    });

    return {
      data: records,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit
      }
    };
  }

  /**
   * 点検記録詳細取得
   */
  async getInspectionRecordById(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<InspectionRecord> {
    const record = await prisma.inspection_records.findUnique({
      where: { id },
      include: {
        inspectionItem: true,
        inspector: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        },
        operation: {
          include: {
            vehicle: {
              select: {
                id: true,
                vehicleNumber: true,
                vehicleType: true
              }
            },
            driver: {
              select: {
                id: true,
                name: true,
                username: true
              }
            }
          }
        }
      }
    });

    if (!record) {
      throw new AppError('点検記録が見つかりません', 404);
    }

    // 運転手は自分の点検記録のみアクセス可能
    if (requesterRole === UserRole.DRIVER && record.inspectorId !== requesterId) {
      throw new AppError('この点検記録にアクセスする権限がありません', 403);
    }

    return record;
  }

  /**
   * 点検記録新規作成
   */
  async createInspectionRecord(data: CreateInspectionRecordRequest): Promise<InspectionRecord> {
    // 点検項目の存在確認
    const inspectionItem = await prisma.inspectionItem.findUnique({
      where: { id: data.inspectionItemId }
    });

    if (!inspectionItem || !inspectionItem.isActive) {
      throw new AppError('指定された点検項目が見つかりません', 404);
    }

    // 運行記録の存在確認
    if (data.operationId) {
      const operation = await prisma.operations.findUnique({
        where: { id: data.operationId }
      });

      if (!operation) {
        throw new AppError('指定された運行記録が見つかりません', 404);
      }
    }

    // 重複チェック（同一運行・同一点検項目）
    if (data.operationId) {
      const existingRecord = await prisma.inspection_records.findFirst({
        where: {
          operationId: data.operationId,
          inspectionItemId: data.inspectionItemId,
          inspectionDate: {
            gte: new Date(data.inspectionDate.toDateString()),
            lt: new Date(new Date(data.inspectionDate).getTime() + 24 * 60 * 60 * 1000)
          }
        }
      });

      if (existingRecord) {
        throw new AppError('同一運行・同一項目の点検記録が既に存在します', 400);
      }
    }

    const record = await prisma.inspection_records.create({
      data: {
        inspectionItemId: data.inspectionItemId,
        operationId: data.operationId,
        inspectorId: data.inspectorId,
        inspectionDate: data.inspectionDate,
        result: data.result,
        notes: data.notes,
        photoUrl: data.photoUrl
      },
      include: {
        inspectionItem: true,
        inspector: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        operation: {
          include: {
            vehicle: {
              select: {
                id: true,
                vehicleNumber: true,
                vehicleType: true
              }
            }
          }
        }
      }
    });

    return record;
  }

  /**
   * 点検記録更新
   */
  async updateInspectionRecord(
    id: string,
    data: UpdateInspectionRecordRequest,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<InspectionRecord> {
    const existingRecord = await prisma.inspection_records.findUnique({
      where: { id },
      include: { operation: true }
    });

    if (!existingRecord) {
      throw new AppError('点検記録が見つかりません', 404);
    }

    // 運転手は自分の点検記録のみ更新可能
    if (requesterRole === UserRole.DRIVER && existingRecord.inspectorId !== requesterId) {
      throw new AppError('この点検記録を更新する権限がありません', 403);
    }

    const record = await prisma.inspection_records.update({
      where: { id },
      data,
      include: {
        inspectionItem: true,
        inspector: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        operation: {
          include: {
            vehicle: {
              select: {
                id: true,
                vehicleNumber: true,
                vehicleType: true
              }
            }
          }
        }
      }
    });

    return record;
  }

  /**
   * 点検記録削除
   */
  async deleteInspectionRecord(id: string): Promise<void> {
    const record = await prisma.inspection_records.findUnique({
      where: { id }
    });

    if (!record) {
      throw new AppError('点検記録が見つかりません', 404);
    }

    await prisma.inspection_records.delete({
      where: { id }
    });
  }

  /**
   * 運行別点検記録取得
   */
  async getInspectionRecordsByOperation(
    operationId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<InspectionRecord[]> {
    // 運行記録の存在確認
    const operation = await prisma.operations.findUnique({
      where: { id: operationId }
    });

    if (!operation) {
      throw new AppError('運行記録が見つかりません', 404);
    }

    // 運転手は自分の運行記録のみアクセス可能
    if (requesterRole === UserRole.DRIVER && operation.driverId !== requesterId) {
      throw new AppError('この運行記録の点検記録にアクセスする権限がありません', 403);
    }

    const records = await prisma.inspection_records.findMany({
      where: { operationId },
      include: {
        inspectionItem: true,
        inspector: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: [
        { inspectionItem: { inspectionType: 'asc' } },
        { inspectionItem: { displayOrder: 'asc' } }
      ]
    });

    return records;
  }

  /**
   * 点検統計取得
   */
  async getInspectionStatistics(params: {
    startDate?: string;
    endDate?: string;
    driverId?: string;
    vehicleId?: string;
    inspectionType?: string;
    requesterId: string;
    requesterRole: UserRole;
  }) {
    const { startDate, endDate, driverId, vehicleId, inspectionType, requesterId, requesterRole } = params;

    const where: Prisma.inspection_recordsWhereInput = {};

    if (startDate || endDate) {
      where.inspectionDate = {};
      if (startDate) where.inspectionDate.gte = new Date(startDate);
      if (endDate) where.inspectionDate.lte = new Date(endDate);
    }

    if (driverId) {
      where.operation = { driverId };
    }

    if (vehicleId) {
      where.operation = { vehicleId };
    }

    if (inspectionType) {
      where.inspectionItem = { inspectionType: inspectionType as InspectionType };
    }

    // 運転手は自分のデータのみ
    if (requesterRole === UserRole.DRIVER) {
      where.inspectorId = requesterId;
    }

    const [
      totalRecords,
      okRecords,
      ngRecords,
      recordsByType
    ] = await Promise.all([
      prisma.inspection_records.count({ where }),
      prisma.inspection_records.count({ 
        where: { ...where, result: 'OK' }
      }),
      prisma.inspection_records.count({ 
        where: { ...where, result: 'NG' }
      }),
      prisma.inspection_records.groupBy({
        by: ['inspectionItem'],
        where,
        _count: {
          id: true
        }
      })
    ]);

    return {
      totalRecords,
      okRecords,
      ngRecords,
      okRate: totalRecords > 0 ? (okRecords / totalRecords) * 100 : 0,
      ngRate: totalRecords > 0 ? (ngRecords / totalRecords) * 100 : 0,
      recordsByType,
      period: { startDate, endDate }
    };
  }

  /**
   * 点検テンプレート取得
   */
  async getInspectionTemplate(inspectionType: string): Promise<InspectionItem[]> {
    const items = await prisma.inspectionItem.findMany({
      where: {
        inspectionType: inspectionType as InspectionType,
        isActive: true
      },
      orderBy: { displayOrder: 'asc' }
    });

    return items;
  }
}