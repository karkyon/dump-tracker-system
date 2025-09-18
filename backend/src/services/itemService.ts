import { Item, PrismaClient } from '@prisma/client';
import { 
  ItemModel,
  ItemCreateInput,
  ItemUpdateInput,
  ItemWhereInput,
  ItemResponseDTO,
  OperationDetailModel,
  ItemSummary,
  ItemWithUsage,
  ItemUsageStats
} from '../types';
import { 
  PaginationQuery
} from '../types/common';
import { AppError } from '../utils/errors';
import { PaginatedResponse } from '../utils/asyncHandler';

const prisma = new PrismaClient();

export class ItemService {
  /**
   * 品目一覧取得（表示順序でソート）
   * @param query ページネーションクエリ
   * @returns 品目一覧
   */
  async getItems(
    query: PaginationQuery & { search?: string; isActive?: boolean }
  ): Promise<PaginatedResponse<ItemSummary>> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'displayOrder',
      sortOrder = 'asc',
      search,
      isActive
    } = query;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    // 検索条件構築
    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    // 総件数取得
    const total = await prisma.item.count({ where });

    // 品目取得（使用回数も含む）
    const items = await prisma.item.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder
      },
      include: {
        _count: {
          select: {
            operationDetails: true
          }
        }
      }
    });

    const totalPages = Math.ceil(total / take);

    // レスポンス形式に変換
    const formattedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      usageCount: item._count.operationDetails
    }));

    return {
      data: formattedItems,
      total,
      page,
      limit: take,
      totalPages,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: take
      }
    };
  }

  /**
   * 品目詳細取得
   * @param itemId 品目ID
   * @returns 品目情報
   */
  async getItemById(itemId: string): Promise<ItemWithUsage> {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        _count: {
          select: {
            operationDetails : true
          }
        }
      }
    });

    if (!item) {
      throw new AppError('品目が見つかりません', 404);
    }

    // 最近の使用履歴を取得
    const recentUsage = await prisma.operationDetail.findMany({
      where: { itemId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        operations: {
          select: {
            plannedStartTime: true,
            usersOperationsDriverIdTousers: {
              select: {
                name: true
              }
            },
            vehicles: {
              select: {
                plateNumber: true
              }
            }
          }
        },
        locations: {
          select: {
            clientName: true,
            name: true
          }
        }
      }
    });

    return {
      id: item.id,
      name: item.name,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      usageCount: item._count.operationDetails,
      recentUsage: recentUsage.map(usage => ({
        activityType: usage.activityType,
        createdAt: usage.createdAt!,
        operationDate: usage.operations?.plannedStartTime ?? undefined,
        driverName: usage.operations?.usersOperationsDriverIdTousers?.name ?? undefined,
        plateNumber: usage.operations?.vehicles?.plateNumber ?? undefined,
        clientName: usage.locations?.clientName ?? undefined,
        locationName: usage.locations?.name ?? undefined
      }))
    };
  }

  /**
   * 品目作成
   * @param itemData 品目データ
   * @returns 作成された品目
   */
  async createItem(itemData: ItemCreateInput): Promise<ItemSummary> {
    const { name, displayOrder } = itemData;

    // 品目名重複チェック
    const existingItem = await prisma.item.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' }
      }
    });

    if (existingItem) {
      throw new AppError('この品目名は既に存在します', 409);
    }

    // 表示順序が指定されていない場合、最大値+1を設定
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const maxOrderItem = await prisma.item.findFirst({
        orderBy: { displayOrder: 'desc' }
      });
      finalDisplayOrder = (maxOrderItem?.displayOrder || 0) + 1;
    }

    // 品目作成
    const newItem = await prisma.item.create({
      data: {
        name,
        displayOrder: finalDisplayOrder
      }
    });

    return {
      id: newItem.id,
      name: newItem.name,
      displayOrder: newItem.displayOrder,
      isActive: newItem.isActive,
      createdAt: newItem.createdAt,
      updatedAt: newItem.updatedAt
    };
  }

  /**
   * 品目更新
   * @param itemId 品目ID
   * @param updateData 更新データ
   * @returns 更新された品目
   */
  async updateItem(itemId: string, updateData: ItemUpdateInput): Promise<ItemSummary> {
    // 品目存在確認
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      throw new AppError('品目が見つかりません', 404);
    }

    // 品目名重複チェック（更新する場合）
    if (updateData.name && typeof updateData.name === 'string') {
      const duplicateItem = await prisma.item.findFirst({
        where: {
          id: { not: itemId },
          name: { 
            equals: updateData.name,
            mode: 'insensitive' 
          }
        }
      });

      if (duplicateItem) {
        throw new AppError('この品目名は既に存在します', 409);
      }
    }

    // 品目更新
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: updateData
    });

    return {
      id: updatedItem.id,
      name: updatedItem.name,
      displayOrder: updatedItem.displayOrder,
      isActive: updatedItem.isActive,
      createdAt: updatedItem.createdAt,
      updatedAt: updatedItem.updatedAt
    };
  }

  /**
   * 品目削除（論理削除）
   * @param itemId 品目ID
   */
  async deleteItem(itemId: string): Promise<void> {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        operationDetails: {
          where: {
            operations: {
              status: {
                in: ['PLANNING', 'IN_PROGRESS']
              }
            }
          }
        }
      }
    });

    if (!item) {
      throw new AppError('品目が見つかりません', 404);
    }

    // アクティブな運行記録で使用中の場合は削除不可
    if (item.operationDetails.length > 0) {
      throw new AppError('進行中の運行記録で使用されているため、この品目を削除できません', 400);
    }

    // 品目を無効化
    await prisma.item.update({
      where: { id: itemId },
      data: { isActive: false }
    });
  }

  /**
   * アクティブ品目一覧取得（簡易版）
   * @returns アクティブ品目一覧
   */
  async getActiveItems(): Promise<Array<{ id: string; name: string; displayOrder: number }>> {
    const items = await prisma.item.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        displayOrder: true
      },
      orderBy: {
        displayOrder: 'asc'
      }
    });

    // Prisma may return displayOrder as number | null; ensure we return number
    return items.map(i => ({
      id: i.id,
      name: i.name,
      displayOrder: i.displayOrder ?? 0
    }));
  }

  /**
   * 品目検索（オートコンプリート用）
   * @param query 検索クエリ
   * @param limit 取得件数
   * @returns 品目一覧
   */
  async searchItems(query: string, limit: number = 10): Promise<Array<{ id: string; name: string }>> {
    if (!query || query.length < 1) {
      return [];
    }

    return await prisma.item.findMany({
      where: {
        isActive: true,
        name: { contains: query, mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true
      },
      take: limit,
      orderBy: {
        displayOrder: 'asc'
      }
    });
  }

  /**
   * 品目の表示順序更新
   * @param itemId 品目ID
   * @param newDisplayOrder 新しい表示順序
   * @returns 更新された品目
   */
  async updateDisplayOrder(itemId: string, newDisplayOrder: number): Promise<ItemSummary> {
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      throw new AppError('品目が見つかりません', 404);
    }

    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: { displayOrder: newDisplayOrder }
    });

    return {
      id: updatedItem.id,
      name: updatedItem.name,
      displayOrder: updatedItem.displayOrder,
      isActive: updatedItem.isActive,
      createdAt: updatedItem.createdAt,
      updatedAt: updatedItem.updatedAt
    };
  }

  /**
   * 品目の表示順序一括更新
   * @param itemOrders 品目IDと表示順序のペア
   */
  async bulkUpdateDisplayOrder(itemOrders: Array<{ id: string; displayOrder: number }>): Promise<void> {
    await prisma.$transaction(
      itemOrders.map(({ id, displayOrder }) =>
        prisma.item.update({
          where: { id },
          data: { displayOrder }
        })
      )
    );
  }

  /**
   * 品目の使用統計取得
   * @param itemId 品目ID
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 使用統計
   */
  async getItemStats(itemId: string, startDate?: string, endDate?: string) {
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      throw new AppError('品目が見つかりません', 404);
    }

    const whereCondition: any = { itemId };

    if (startDate || endDate) {
      whereCondition.operations = {
        plannedStartTime: {}  // dateではなくplannedStartTimeを使用
      };
      if (startDate) whereCondition.operations.plannedStartTime.gte = new Date(startDate);
      if (endDate) whereCondition.operations.plannedStartTime.lte = new Date(endDate);
    }

    const [
      totalUsage,
      uniqueCustomers,
      uniqueDrivers,
      recentActivity,
      monthlyUsage
    ] = await Promise.all([
      // 総使用回数
      prisma.operationDetail.count({
        where: whereCondition
      }),
      
      // ユニーク客先数
      prisma.operationDetail.groupBy({
        by: ['locationId'],
        where: whereCondition
      }).then(async (results) => {
        const locationIds = results.map(r => r.locationId).filter(id => id);
        if (locationIds.length === 0) return 0;
        
        const uniqueCustomersResult = await prisma.location.groupBy({
          by: ['clientName'],
          where: { id: { in: locationIds } }
        });
        return uniqueCustomersResult.length;
      }),
      
      // ユニーク運転手数
      prisma.operationDetail.groupBy({
        by: ['operationId'],
        where: whereCondition
      }).then(async (results) => {
        const operationIds = results.map(r => r.operationId);
        const uniqueDriverIds = await prisma.operationDetail.findMany({
          where: { id: { in: operationIds } },
          select: {
            operations: {
              select: {
                driverId: true
              }
            }
          }
        });
        const driverIdSet = new Set();
        uniqueDriverIds.forEach(r => {
          if (r.operations.driverId) {
            driverIdSet.add(r.operations.driverId);
          }
        });
        const uniqueDriversCount = driverIdSet.size;

        return uniqueDriversCount;
      }),
      
      // 最近の活動
      prisma.operationDetail.findMany({
        where: whereCondition,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          operations: {
            select: {
              usersOperationsDriverIdTousers: {
                select: { name: true }
              }
            }
          },
          locations: {
            select: {
              clientName: true,
              name: true
            }
          }
        }
      }),
      
      // 月別使用回数（過去12ヶ月）
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', od.created_at) as month,
          COUNT(*) as usage_count
        FROM operation_details od
        INNER JOIN operations o ON od.operation_id = o.id
        WHERE od.item_id = ${itemId}
          AND od.created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', od.created_at)
        ORDER BY month DESC
      `
    ]);

    return {
      itemInfo: {
        name: item.name,
        displayOrder: item.displayOrder,
        isActive: item.isActive
      },
      statistics: {
        totalUsage,
        uniqueCustomers,
        uniqueDrivers,
        monthlyUsage,
        recentActivity: recentActivity.map(activity => ({
          activityType: activity.activityType,
          createdAt: activity.createdAt,
          driverName: activity.operations?.usersOperationsDriverIdTousers?.name || null,
          clientName: activity.locations?.clientName || null,
          locationName: activity.locations?.name || null
        }))
      }
    };
  }

  /**
   * 使用頻度順品目一覧取得
   * @param limit 取得件数
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 使用頻度順品目一覧
   */
  async getItemsByUsageFrequency(
    limit: number = 10,
    startDate?: string,
    endDate?: string
  ): Promise<Array<ItemUsageStats>> {
    const whereCondition: any = {};

    if (startDate || endDate) {
      whereCondition.operations = {
        date: {}
      };
      if (startDate) whereCondition.trip.date.gte = new Date(startDate);
      if (endDate) whereCondition.trip.date.lte = new Date(endDate);
    }

    // 使用回数でグループ化
    const usageStats = await prisma.operationDetail.groupBy({
      by: ['itemId'],
      where: {
        ...whereCondition,
        itemId: { not: null }
      },
      _count: {
        itemId: true
      },
      orderBy: {
        _count: {
          itemId: 'desc'
        }
      },
      take: limit
    });

    // 品目情報を取得
    const itemIds = usageStats.map((stat: { itemId: any; }) => stat.itemId!);
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } }
    });

    // 結果をマージ
    return usageStats.map((stat: { itemId: string; _count: { itemId: any; }; }) => {
      const item = items.find(i => i.id === stat.itemId)!;
      return {
        item: {
          id: item.id,
          name: item.name,
          displayOrder: item.displayOrder,
          isActive: item.isActive,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        },
        usageCount: stat._count.itemId
      };
    });
  }
}