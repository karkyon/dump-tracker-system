// backend/src/models/Item.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 品目モデル
 * 運送品目の管理
 */

export interface ItemModel {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  standardWeight?: number; // kg
  standardVolume?: number; // m³
  hazardousClass?: string;
  handlingInstructions?: string;
  storageRequirements?: string;
  temperatureRange?: string;
  isFragile: boolean;
  isHazardous: boolean;
  requiresSpecialEquipment: boolean;
  displayOrder: number;
  isActive: boolean;
  photoUrls: string[];
  specificationFileUrl?: string;
  msdsFileUrl?: string; // Material Safety Data Sheet
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemCreateInput {
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  standardWeight?: number;
  standardVolume?: number;
  hazardousClass?: string;
  handlingInstructions?: string;
  storageRequirements?: string;
  temperatureRange?: string;
  isFragile?: boolean;
  isHazardous?: boolean;
  requiresSpecialEquipment?: boolean;
  displayOrder?: number;
  photoUrls?: string[];
  specificationFileUrl?: string;
  msdsFileUrl?: string;
}

export interface ItemUpdateInput {
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  standardWeight?: number;
  standardVolume?: number;
  hazardousClass?: string;
  handlingInstructions?: string;
  storageRequirements?: string;
  temperatureRange?: string;
  isFragile?: boolean;
  isHazardous?: boolean;
  requiresSpecialEquipment?: boolean;
  displayOrder?: number;
  isActive?: boolean;
  photoUrls?: string[];
  specificationFileUrl?: string;
  msdsFileUrl?: string;
}

export interface ItemWhereInput {
  id?: string;
  name?: { contains?: string; mode?: 'insensitive' };
  description?: { contains?: string; mode?: 'insensitive' };
  category?: string;
  isActive?: boolean;
  isHazardous?: boolean;
  isFragile?: boolean;
  requiresSpecialEquipment?: boolean;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface ItemOrderByInput {
  id?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  category?: 'asc' | 'desc';
  displayOrder?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
}

export interface ItemStats {
  totalItems: number;
  activeItems: number;
  categoriesCount: number;
  hazardousItems: number;
  fragileItems: number;
  specialEquipmentItems: number;
  newItemsThisMonth: number;
}

export interface ItemCategory {
  name: string;
  itemCount: number;
  description?: string;
  isActive: boolean;
}

export interface ItemUsageStats {
  itemId: string;
  itemName: string;
  totalTrips: number;
  totalWeight?: number;
  totalVolume?: number;
  averageWeight?: number;
  lastUsed?: Date;
  popularRoutes: Array<{
    fromLocation: string;
    toLocation: string;
    count: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    tripCount: number;
    weight?: number;
    volume?: number;
  }>;
}

export interface ItemPricing {
  id: string;
  itemId: string;
  pricePerUnit?: number;
  pricePerKg?: number;
  pricePerKm?: number;
  minimumCharge?: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface ItemCompatibility {
  itemId: string;
  compatibleItems: string[];
  incompatibleItems: string[];
  warnings: string[];
}

export interface ItemSeasonality {
  itemId: string;
  peakMonths: number[];
  lowMonths: number[];
  seasonalityIndex: number; // 0-1 (0: no seasonality, 1: high seasonality)
}

/**
 * 品目モデルクラス
 */
export class Item {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  /**
   * 品目作成
   */
  async create(data: ItemCreateInput): Promise<ItemModel> {
    // 表示順序が指定されていない場合は最後に追加
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const lastItem = await this.prisma.item.findFirst({
        orderBy: { displayOrder: 'desc' }
      });
      displayOrder = (lastItem?.displayOrder || 0) + 10;
    }

    return await this.prisma.item.create({
      data: {
        ...data,
        displayOrder,
        isFragile: data.isFragile || false,
        isHazardous: data.isHazardous || false,
        requiresSpecialEquipment: data.requiresSpecialEquipment || false,
        photoUrls: data.photoUrls || []
      }
    });
  }

  /**
   * 品目取得
   */
  async findUnique(where: { id?: string; name?: string }): Promise<ItemModel | null> {
    return await this.prisma.item.findUnique({ where });
  }

  /**
   * 品目一覧取得
   */
  async findMany(params: {
    where?: ItemWhereInput;
    orderBy?: ItemOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      trips?: boolean;
      pricing?: boolean;
    };
  }): Promise<ItemModel[]> {
    return await this.prisma.item.findMany(params);
  }

  /**
   * 品目更新
   */
  async update(where: { id: string }, data: ItemUpdateInput): Promise<ItemModel> {
    return await this.prisma.item.update({ where, data });
  }

  /**
   * 品目削除（論理削除）
   */
  async softDelete(id: string): Promise<ItemModel> {
    return await this.prisma.item.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * 品目数カウント
   */
  async count(where?: ItemWhereInput): Promise<number> {
    return await this.prisma.item.count({ where });
  }

  /**
   * アクティブ品目取得
   */
  async findActiveItems(): Promise<ItemModel[]> {
    return await this.prisma.item.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });
  }

  /**
   * カテゴリ別品目取得
   */
  async findByCategory(category: string): Promise<ItemModel[]> {
    return await this.prisma.item.findMany({
      where: {
        category,
        isActive: true
      },
      orderBy: { displayOrder: 'asc' }
    });
  }

  /**
   * 品目カテゴリ一覧取得
   */
  async getCategories(): Promise<ItemCategory[]> {
    const categories = await this.prisma.item.groupBy({
      by: ['category'],
      where: {
        isActive: true,
        category: { not: null }
      },
      _count: { id: true }
    });

    return categories
      .filter(cat => cat.category)
      .map(cat => ({
        name: cat.category!,
        itemCount: cat._count.id,
        isActive: true
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 品目統計取得
   */
  async getStats(): Promise<ItemStats> {
    const [
      total,
      active,
      categories,
      hazardous,
      fragile,
      specialEquipment,
      newThisMonth
    ] = await Promise.all([
      this.prisma.item.count(),
      this.prisma.item.count({ where: { isActive: true } }),
      this.prisma.item.findMany({
        where: { isActive: true, category: { not: null } },
        select: { category: true },
        distinct: ['category']
      }),
      this.prisma.item.count({ where: { isHazardous: true, isActive: true } }),
      this.prisma.item.count({ where: { isFragile: true, isActive: true } }),
      this.prisma.item.count({ where: { requiresSpecialEquipment: true, isActive: true } }),
      this.prisma.item.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    return {
      totalItems: total,
      activeItems: active,
      categoriesCount: categories.length,
      hazardousItems: hazardous,
      fragileItems: fragile,
      specialEquipmentItems: specialEquipment,
      newItemsThisMonth: newThisMonth
    };
  }

  /**
   * 品目検索
   */
  async search(query: string): Promise<ItemModel[]> {
    return await this.prisma.item.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } },
              { handlingInstructions: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      orderBy: { displayOrder: 'asc' }
    });
  }

  /**
   * 危険物品目取得
   */
  async findHazardousItems(): Promise<ItemModel[]> {
    return await this.prisma.item.findMany({
      where: {
        isHazardous: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * 特殊装備必要品目取得
   */
  async findSpecialEquipmentItems(): Promise<ItemModel[]> {
    return await this.prisma.item.findMany({
      where: {
        requiresSpecialEquipment: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * 品目使用統計取得
   */
  async getItemUsageStats(itemId: string): Promise<ItemUsageStats> {
    const item = await this.findUnique({ id: itemId });
    if (!item) {
      throw new Error('品目が見つかりません');
    }

    const trips = await this.prisma.trip.findMany({
      where: { itemId },
      include: {
        loadingLocation: { select: { name: true } },
        unloadingLocation: { select: { name: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    const totalTrips = trips.length;
    const lastUsed = trips.length > 0 ? trips[0].startTime : undefined;

    // 重量・容量の統計
    const weights = trips.filter(trip => trip.actualWeight).map(trip => trip.actualWeight!);
    const volumes = trips.filter(trip => trip.actualVolume).map(trip => trip.actualVolume!);

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const totalVolume = volumes.reduce((sum, volume) => sum + volume, 0);
    const averageWeight = weights.length > 0 ? totalWeight / weights.length : undefined;

    // 人気ルート分析
    const routeStats = new Map<string, { from: string; to: string; count: number }>();
    trips.forEach(trip => {
      if (trip.loadingLocation && trip.unloadingLocation) {
        const routeKey = `${trip.loadingLocation.name}->${trip.unloadingLocation.name}`;
        const existing = routeStats.get(routeKey) || {
          from: trip.loadingLocation.name,
          to: trip.unloadingLocation.name,
          count: 0
        };
        existing.count++;
        routeStats.set(routeKey, existing);
      }
    });

    const popularRoutes = Array.from(routeStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(route => ({
        fromLocation: route.from,
        toLocation: route.to,
        count: route.count
      }));

    // 月別トレンド
    const monthlyStats = new Map<string, { tripCount: number; weight: number; volume: number }>();
    trips.forEach(trip => {
      if (trip.startTime) {
        const monthKey = trip.startTime.toISOString().substring(0, 7); // YYYY-MM
        const existing = monthlyStats.get(monthKey) || { tripCount: 0, weight: 0, volume: 0 };
        existing.tripCount++;
        if (trip.actualWeight) existing.weight += trip.actualWeight;
        if (trip.actualVolume) existing.volume += trip.actualVolume;
        monthlyStats.set(monthKey, existing);
      }
    });

    const monthlyTrends = Array.from(monthlyStats.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, stats]) => ({
        month,
        tripCount: stats.tripCount,
        weight: stats.weight > 0 ? stats.weight : undefined,
        volume: stats.volume > 0 ? stats.volume : undefined
      }));

    return {
      itemId,
      itemName: item.name,
      totalTrips,
      totalWeight: totalWeight > 0 ? totalWeight : undefined,
      totalVolume: totalVolume > 0 ? totalVolume : undefined,
      averageWeight,
      lastUsed,
      popularRoutes,
      monthlyTrends
    };
  }

  /**
   * 品目の人気度ランキング取得
   */
  async getPopularItems(limit: number = 10): Promise<Array<{ item: ItemModel; tripCount: number }>> {
    const itemStats = await this.prisma.trip.groupBy({
      by: ['itemId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit
    });

    const popularItems = await Promise.all(
      itemStats.map(async (stat) => {
        const item = await this.findUnique({ id: stat.itemId });
        return {
          item: item!,
          tripCount: stat._count.id
        };
      })
    );

    return popularItems.filter(item => item.item);
  }

  /**
   * 品目の季節性分析
   */
  async analyzeSeasonality(itemId: string): Promise<ItemSeasonality> {
    const trips = await this.prisma.trip.findMany({
      where: { itemId },
      select: { startTime: true }
    });

    const monthlyCount = new Array(12).fill(0);
    trips.forEach(trip => {
      if (trip.startTime) {
        const month = trip.startTime.getMonth();
        monthlyCount[month]++;
      }
    });

    const totalTrips = trips.length;
    const averageMonthly = totalTrips / 12;

    // ピーク月と低調月を特定
    const monthlyData = monthlyCount.map((count, index) => ({ month: index, count }));
    const sortedByCount = [...monthlyData].sort((a, b) => b.count - a.count);

    const peakMonths = sortedByCount
      .filter(data => data.count > averageMonthly * 1.2)
      .map(data => data.month + 1); // 1-based month

    const lowMonths = sortedByCount
      .filter(data => data.count < averageMonthly * 0.8)
      .map(data => data.month + 1); // 1-based month

    // 季節性指数計算（標準偏差に基づく）
    const variance = monthlyCount.reduce((sum, count) => sum + Math.pow(count - averageMonthly, 2), 0) / 12;
    const standardDeviation = Math.sqrt(variance);
    const seasonalityIndex = Math.min(standardDeviation / (averageMonthly || 1), 1);

    return {
      itemId,
      peakMonths,
      lowMonths,
      seasonalityIndex
    };
  }

  /**
   * 品目表示順更新
   */
  async updateDisplayOrder(items: Array<{ id: string; displayOrder: number }>): Promise<void> {
    const updatePromises = items.map(item =>
      this.prisma.item.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder }
      })
    );

    await Promise.all(updatePromises);
  }

  /**
   * 重複品目検出
   */
  async findDuplicates(): Promise<ItemModel[][]> {
    const items = await this.prisma.item.findMany({
      where: { isActive: true }
    });

    const duplicateGroups: ItemModel[][] = [];
    const processed = new Set<string>();

    for (const item of items) {
      if (processed.has(item.id)) continue;

      const duplicates = [item];
      processed.add(item.id);

      for (const other of items) {
        if (processed.has(other.id) || item.id === other.id) continue;

        // 名前の類似度チェック（簡易版）
        if (this.calculateSimilarity(item.name, other.name) > 0.8) {
          duplicates.push(other);
          processed.add(other.id);
        }
      }

      if (duplicates.length > 1) {
        duplicateGroups.push(duplicates);
      }
    }

    return duplicateGroups;
  }

  /**
   * 文字列類似度計算（Levenshtein距離ベース）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }
}