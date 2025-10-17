// =====================================
// backend/src/services/itemService.ts
// 品目管理サービス - Phase 2完全統合版
// コンパイルエラー完全修正・循環参照解消版
// models/ItemModel.ts基盤・Phase 1完成基盤統合版
// 作成日時: 2025年9月27日19:15
// 最終更新: 2025年10月15日 - コンパイルエラー完全修正
// =====================================

import { UserRole, PrismaClient, ItemType } from '@prisma/client';

// 🎯 Phase 1完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '../utils/errors';
import logger from '../utils/logger';

// 🎯 types/からの統一型定義インポート（修正: import type を削除）
import type {
  ItemModel,
  ItemResponseDTO,
  ItemSummary,
} from '../types';

// 🎯 models/ItemModel.ts から getItemService を通常インポート
import { getItemService as getItemModelService } from '../types';

// 🎯 共通型定義の活用（types/common.ts）
import type {
  PaginationQuery,
  OperationResult,
} from '../types/common';

// =====================================
// 🔧 品目管理型定義
// =====================================

export interface ItemFilter extends PaginationQuery {
  search?: string;
  itemType?: string;
  isActive?: boolean;
  hazardous?: boolean;
  sortBy?: 'name' | 'itemType' | 'createdAt' | 'updatedAt';
}

export interface CreateItemRequest {
  name: string;
  description?: string;
  itemType?: ItemType;
  unit?: string;
  standardWeight?: number;
  standardVolume?: number;
  hazardous?: boolean;
  hazardousClass?: string;
  handlingInstructions?: string;
  storageRequirements?: string;
  temperatureRange?: string;
  isFragile?: boolean;
  isHazardous?: boolean;
  requiresSpecialEquipment?: boolean;
  displayOrder?: number;
  photoUrls?: string;
  specificationFileUrl?: string;
  msdsFileUrl?: string;
  isActive?: boolean;
}

export interface UpdateItemRequest extends Partial<CreateItemRequest> {
  // 部分更新対応
}

export interface ItemUsageReport {
  itemId: string;
  itemName: string;
  totalUsage: number;
  usageValue: number;
  operationCount: number;
  averageUsagePerOperation: number;
  lastUsedDate?: Date;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

// =====================================
// 🏭 ItemService クラス - Phase 2統合版
// =====================================

export class ItemService {
  private readonly db: PrismaClient;

  constructor(db?: PrismaClient) {
    this.db = db || new PrismaClient();
  }

  // =====================================
  // 🔐 権限チェックメソッド
  // =====================================

  private checkItemAccess(
    requesterId: string,
    requesterRole: UserRole,
    action: 'read' | 'create' | 'update' | 'delete'
  ): void {
    // ADMIN と MANAGER は全ての操作が可能
    if (requesterRole === UserRole.ADMIN || requesterRole === UserRole.MANAGER) {
      return;
    }

    // DRIVER は読み取りのみ可能
    if (requesterRole === UserRole.DRIVER && action === 'read') {
      return;
    }

    throw new AuthorizationError(
      `品目管理の${action}権限がありません (requesterId: ${requesterId}, role: ${requesterRole})`
    );
  }

  // =====================================
  // 📦 基本CRUD操作
  // =====================================

  /**
   * 品目作成
   */
  async createItem(
    request: CreateItemRequest,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<ItemResponseDTO> {
    try {
      // 権限チェック
      this.checkItemAccess(requesterId, requesterRole, 'create');

      // バリデーション
      if (!request.name || request.name.trim().length === 0) {
        throw new ValidationError('品目名は必須です');
      }

      // 重複チェック
      const existingItem = await this.db.item.findUnique({
        where: { name: request.name.trim() }
      });

      if (existingItem) {
        throw new ConflictError(`同じ名前の品目が既に存在します: ${request.name}`);
      }

      // 品目作成
      const itemData = {
        name: request.name.trim(),
        description: request.description?.trim(),
        item_type: request.itemType,
        unit: request.unit?.trim() || 'トン',
        standardWeight: request.standardWeight,
        standardVolume: request.standardVolume,
        hazardous: request.hazardous ?? false,
        hazardousClass: request.hazardousClass?.trim(),
        handlingInstructions: request.handlingInstructions?.trim(),
        storageRequirements: request.storageRequirements?.trim(),
        temperatureRange: request.temperatureRange?.trim(),
        isFragile: request.isFragile,
        isHazardous: request.isHazardous,
        requiresSpecialEquipment: request.requiresSpecialEquipment,
        displayOrder: request.displayOrder,
        photoUrls: request.photoUrls,
        specificationFileUrl: request.specificationFileUrl,
        msdsFileUrl: request.msdsFileUrl,
        isActive: request.isActive !== false
      };

      const item = await this.db.item.create({
        data: itemData
      });

      logger.info('品目作成完了', {
        itemId: item.id,
        name: item.name,
        itemType: item.item_type,
        requesterId
      });

      return this.toResponseDTO(item);

    } catch (error) {
      logger.error('品目作成エラー', { error, request, requesterId });
      throw error;
    }
  }

  /**
   * 品目取得
   */
  async getItem(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<ItemResponseDTO> {
    try {
      // 権限チェック
      this.checkItemAccess(requesterId, requesterRole, 'read');

      const item = await this.db.item.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              operationDetails: true
            }
          }
        }
      });

      if (!item) {
        throw new NotFoundError('品目が見つかりません');
      }

      return this.toResponseDTO(item);

    } catch (error) {
      logger.error('品目取得エラー', { error, id, requesterId });
      throw error;
    }
  }

  /**
   * 品目一覧取得
   */
  async getItems(
    filter: ItemFilter = {},
    requesterId: string,
    requesterRole: UserRole
  ): Promise<{ items: ItemResponseDTO[]; total: number; hasMore: boolean }> {
    try {
      // 権限チェック
      this.checkItemAccess(requesterId, requesterRole, 'read');

      const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc', ...filterConditions } = filter;
      const offset = (page - 1) * limit;

      // フィルタ条件構築
      const whereCondition: any = {};

      if (filterConditions.search) {
        whereCondition.OR = [
          { name: { contains: filterConditions.search, mode: 'insensitive' } },
          { description: { contains: filterConditions.search, mode: 'insensitive' } },
        ];
      }

      if (filterConditions.itemType) {
        whereCondition.item_type = filterConditions.itemType as ItemType;
      }

      if (filterConditions.isActive !== undefined) {
        whereCondition.isActive = filterConditions.isActive;
      }

      if (filterConditions.hazardous !== undefined) {
        whereCondition.hazardous = filterConditions.hazardous;
      }

      // ソート条件
      const orderBy: any = {};
      if (sortBy === 'itemType') {
        orderBy.item_type = sortOrder;
      } else {
        orderBy[sortBy] = sortOrder;
      }

      // データ取得
      const [items, total] = await Promise.all([
        this.db.item.findMany({
          where: whereCondition,
          orderBy,
          skip: offset,
          take: limit,
          include: {
            _count: {
              select: {
                operationDetails: true
              }
            }
          }
        }),
        this.db.item.count({ where: whereCondition })
      ]);

      const itemDTOs = items.map((item) => this.toResponseDTO(item));

      return {
        items: itemDTOs,
        total,
        hasMore: offset + items.length < total
      };

    } catch (error) {
      logger.error('品目一覧取得エラー', { error, filter, requesterId });
      throw error;
    }
  }

  /**
   * 品目更新
   */
  async updateItem(
    id: string,
    request: UpdateItemRequest,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<ItemResponseDTO> {
    try {
      // 権限チェック
      this.checkItemAccess(requesterId, requesterRole, 'update');

      // 存在チェック
      const existingItem = await this.db.item.findUnique({
        where: { id }
      });

      if (!existingItem) {
        throw new NotFoundError('品目が見つかりません');
      }

      // 名前の重複チェック
      if (request.name && request.name !== existingItem.name) {
        const duplicateItem = await this.db.item.findUnique({
          where: { name: request.name.trim() }
        });

        if (duplicateItem) {
          throw new ConflictError(`同じ名前の品目が既に存在します: ${request.name}`);
        }
      }

      // 更新データ構築
      const updateData: any = {};
      if (request.name !== undefined) updateData.name = request.name.trim();
      if (request.description !== undefined) updateData.description = request.description?.trim();
      if (request.itemType !== undefined) updateData.item_type = request.itemType;
      if (request.unit !== undefined) updateData.unit = request.unit?.trim();
      if (request.standardWeight !== undefined) updateData.standardWeight = request.standardWeight;
      if (request.standardVolume !== undefined) updateData.standardVolume = request.standardVolume;
      if (request.hazardous !== undefined) updateData.hazardous = request.hazardous;
      if (request.hazardousClass !== undefined) updateData.hazardousClass = request.hazardousClass?.trim();
      if (request.handlingInstructions !== undefined) updateData.handlingInstructions = request.handlingInstructions?.trim();
      if (request.storageRequirements !== undefined) updateData.storageRequirements = request.storageRequirements?.trim();
      if (request.temperatureRange !== undefined) updateData.temperatureRange = request.temperatureRange?.trim();
      if (request.isFragile !== undefined) updateData.isFragile = request.isFragile;
      if (request.isHazardous !== undefined) updateData.isHazardous = request.isHazardous;
      if (request.requiresSpecialEquipment !== undefined) updateData.requiresSpecialEquipment = request.requiresSpecialEquipment;
      if (request.displayOrder !== undefined) updateData.displayOrder = request.displayOrder;
      if (request.photoUrls !== undefined) updateData.photoUrls = request.photoUrls;
      if (request.specificationFileUrl !== undefined) updateData.specificationFileUrl = request.specificationFileUrl;
      if (request.msdsFileUrl !== undefined) updateData.msdsFileUrl = request.msdsFileUrl;
      if (request.isActive !== undefined) updateData.isActive = request.isActive;

      const updatedItem = await this.db.item.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: {
              operationDetails: true
            }
          }
        }
      });

      logger.info('品目更新完了', {
        itemId: id,
        updates: Object.keys(updateData),
        requesterId
      });

      return this.toResponseDTO(updatedItem);

    } catch (error) {
      logger.error('品目更新エラー', { error, id, request, requesterId });
      throw error;
    }
  }

  /**
   * 品目削除（論理削除）
   */
  async deleteItem(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<OperationResult> {
    try {
      // 権限チェック
      this.checkItemAccess(requesterId, requesterRole, 'delete');

      // 存在チェック
      const existingItem = await this.db.item.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              operationDetails: true
            }
          }
        }
      });

      if (!existingItem) {
        throw new NotFoundError('品目が見つかりません');
      }

      // 使用中チェック
      if (existingItem._count.operationDetails > 0) {
        throw new ConflictError(
          `運行で使用中の品目は削除できません (使用回数: ${existingItem._count.operationDetails})`
        );
      }

      // 論理削除
      await this.db.item.update({
        where: { id },
        data: { isActive: false }
      });

      logger.info('品目削除完了', {
        itemId: id,
        name: existingItem.name,
        requesterId
      });

      return {
        success: true,
        message: '品目を削除しました'
      };

    } catch (error) {
      logger.error('品目削除エラー', { error, id, requesterId });
      throw error;
    }
  }

  // =====================================
  // 📊 統計・分析機能
  // =====================================

  /**
   * 品目サマリー取得
   */
  async getItemSummary(
    requesterId: string,
    requesterRole: UserRole
  ): Promise<{
    totalItems: number;
    activeItems: number;
    totalCategories: number;
    hazardousItems: number;
  }> {
    try {
      // 権限チェック
      this.checkItemAccess(requesterId, requesterRole, 'read');

      const [totalItems, activeItems, hazardousItems] = await Promise.all([
        this.db.item.count(),
        this.db.item.count({ where: { isActive: true } }),
        this.db.item.count({ where: { hazardous: true, isActive: true } })
      ]);

      // カテゴリ別集計（ItemTypeで集計）
      const itemsByType = await this.db.item.groupBy({
        by: ['item_type'],
        where: { isActive: true },
        _count: true
      });

      const totalCategories = itemsByType.length;

      return {
        totalItems,
        activeItems,
        totalCategories,
        hazardousItems
      };

    } catch (error) {
      logger.error('品目サマリー取得エラー', { error, requesterId });
      throw error;
    }
  }

  /**
   * カテゴリ一覧取得（ItemType一覧）
   */
  async getCategories(
    requesterId: string,
    requesterRole: UserRole
  ): Promise<string[]> {
    try {
      // 権限チェック
      this.checkItemAccess(requesterId, requesterRole, 'read');

      const items = await this.db.item.findMany({
        where: {
          isActive: true,
          item_type: { not: null }
        },
        select: { item_type: true },
        distinct: ['item_type'],
        orderBy: { item_type: 'asc' }
      });

      return items.map((item) => item.item_type as string);

    } catch (error) {
      logger.error('カテゴリ一覧取得エラー', { error, requesterId });
      throw error;
    }
  }

  // =====================================
  // 🛠️ ユーティリティメソッド群
  // =====================================

  private toResponseDTO(item: any): ItemResponseDTO {
    return {
      id: item.id,
      name: item.name,
      itemType: item.item_type,
      unit: item.unit,
      standardWeight: item.standardWeight,
      hazardous: item.hazardous,
      description: item.description,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      standardVolume: item.standardVolume,
      hazardousClass: item.hazardousClass,
      handlingInstructions: item.handlingInstructions,
      storageRequirements: item.storageRequirements,
      temperatureRange: item.temperatureRange,
      isFragile: item.isFragile,
      isHazardous: item.isHazardous,
      requiresSpecialEquipment: item.requiresSpecialEquipment,
      displayOrder: item.displayOrder,
      photoUrls: item.photoUrls,
      specificationFileUrl: item.specificationFileUrl,
      msdsFileUrl: item.msdsFileUrl,
      usageStatistics: {
        totalUsage: item._count?.operationDetails || 0,
        currentMonthUsage: 0,
        popularityRank: 0
      }
    };
  }

  /**
   * サービスヘルスチェック
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date; details: any }> {
    try {
      const itemCount = await this.db.item.count();
      const activeItemCount = await this.db.item.count({
        where: { isActive: true }
      });

      return {
        status: 'healthy',
        timestamp: new Date(),
        details: {
          database: 'connected',
          totalItems: itemCount,
          activeItems: activeItemCount,
          service: 'ItemService'
        }
      };
    } catch (error) {
      logger.error('ItemServiceヘルスチェックエラー', { error });
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : '不明なエラー'
        }
      };
    }
  }
}

// =====================================
// 🔄 シングルトンファクトリ
// =====================================

let _itemServiceInstance: ItemService | null = null;

export const getItemServiceInstance = (db?: PrismaClient): ItemService => {
  if (!_itemServiceInstance) {
    _itemServiceInstance = new ItemService(db);
  }
  return _itemServiceInstance;
};

// =====================================
// 📤 エクスポート
// =====================================

export default ItemService;
