// backend/src/services/inspectionService.ts
import { PrismaClient, Prisma, UserRole, InspectionType, $Enums } from '@prisma/client';
import {
  InspectionItemModel,
  InspectionItemResponseDTO,
  InspectionItemListResponse,
  InspectionItemCreateDTO,
  InspectionItemUpdateDTO,
  InspectionItemWhereInput,
  InspectionItemOrderByInput,
  InspectionItemResultModel,
  InspectionItemResultResponseDTO,
  InspectionItemResultCreateDTO,
  InspectionItemResultUpdateDTO,
  InspectionRecordModel,
  InspectionRecordResponseDTO,
  InspectionRecordListResponse,
  InspectionRecordCreateDTO,
  InspectionRecordUpdateDTO,
  InspectionRecordWhereInput,
  InspectionRecordOrderByInput,
  getInspectionItemService,
  getInspectionItemResultService,
  getInspectionRecordService
} from '../types';

// 既存の型定義
export interface InspectionFilter {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  operationId?: string;
  driverId?: string;
  vehicleId?: string;
  inspectionType?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// 既存のリクエスト型
export interface CreateInspectionItemRequest extends InspectionItemCreateDTO {}
export interface UpdateInspectionItemRequest extends InspectionItemUpdateDTO {}
export interface CreateInspectionRecordRequest extends InspectionRecordCreateDTO {
  operationId?: string;
  inspectionItemId?: string;
  inspectorId?: string;
  vehicleId?: string;
}
export interface UpdateInspectionRecordRequest extends InspectionRecordUpdateDTO {}

// 既存の型エイリアス
export type InspectionItem = InspectionItemResponseDTO;
export type InspectionRecord = InspectionRecordResponseDTO;

// AppError クラス
export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
  }
}

const prisma = new PrismaClient();

export class InspectionService {
  private inspectionItemService = getInspectionItemService(prisma);
  private inspectionItemResultService = getInspectionItemResultService(prisma);
  private inspectionRecordService = getInspectionRecordService(prisma);

  /**
   * 点検項目一覧取得
   */
  async getInspectionItems(filter: {
    page: number;
    limit: number;
    inspectionType?: string;
    isActive?: boolean;
    sortBy?: string;
  }): Promise<PaginatedResponse<InspectionItemResponseDTO>> {
    const {
      page = 1,
      limit = 50,
      inspectionType,
      isActive = true,
      sortBy = 'displayOrder'
    } = filter;

    const where: InspectionItemWhereInput = {};

    if (inspectionType) {
      where.inspectionType = inspectionType as any;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // 新しいサービスクラスを使用してページネーション付きデータ取得
    const result = await this.inspectionItemService.findManyWithPagination({
      where,
      orderBy: { [sortBy]: 'asc' } as InspectionItemOrderByInput,
      page,
      pageSize: limit
    });

    // 既存の形式に変換
    return {
      data: result.data.map(item => ({
        ...item,
        _count: { inspectionRecords: 0 } // TODO: count計算を追加
      })),
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.total,
        itemsPerPage: result.pageSize
      }
    };
  }

  /**
   * 点検項目詳細取得
   */
  async getInspectionItemById(id: string): Promise<InspectionItemResponseDTO> {
    const item = await this.inspectionItemService.findByKey(id);

    if (!item) {
      throw new AppError('点検項目が見つかりません', 404);
    }

    // DTOに変換して返却
    return {
      ...item,
      _count: { inspectionRecords: 0 } // TODO: count計算を追加
    };
  }

  /**
   * 点検項目新規作成
   */
  async createInspectionItem(data: CreateInspectionItemRequest): Promise<InspectionItemResponseDTO> {
    // 同一名の点検項目存在チェック
    const existingItems = await this.inspectionItemService.findMany({
      where: {
        name: data.name,
        inspectionType: data.inspectionType as any,
        isActive: true
      }
    });

    if (existingItems.length > 0) {
      throw new AppError('同じ名前の点検項目が既に存在します', 400);
    }

    // 表示順序が指定されていない場合は最後に追加
    let displayOrder = data.displayOrder;
    if (!displayOrder) {
      const lastItems = await this.inspectionItemService.findMany({
        where: {
          inspectionType: data.inspectionType as any,
          isActive: true
        },
        orderBy: { displayOrder: 'desc' },
        take: 1
      });
      displayOrder = (lastItems[0]?.displayOrder || 0) + 10;
    }

    const item = await this.inspectionItemService.create({
      name: data.name,
      inspectionType: data.inspectionType as any,
      inputType: (data.inputType as any) || 'CHECKBOX',
      displayOrder,
      isRequired: data.isRequired || false,
      description: data.description,
      isActive: true
    });

    return {
      ...item,
      _count: { inspectionRecords: 0 }
    };
  }

  /**
   * 点検項目更新
   */
  async updateInspectionItem(
    id: string,
    data: UpdateInspectionItemRequest
  ): Promise<InspectionItemResponseDTO> {
    const existingItem = await this.inspectionItemService.findByKey(id);

    if (!existingItem) {
      throw new AppError('点検項目が見つかりません', 404);
    }

    // 名前の重複チェック（自分以外）
    if (data.name && data.name !== existingItem.name) {
      const duplicateItems = await this.inspectionItemService.findMany({
        where: {
          name: data.name,
          inspectionType: (data.inspectionType || existingItem.inspectionType) as any,
          isActive: true,
          id: { not: id }
        }
      });

      if (duplicateItems.length > 0) {
        throw new AppError('同じ名前の点検項目が既に存在します', 400);
      }
    }

    const item = await this.inspectionItemService.update(id, {
      ...data,
      inspectionType: data.inspectionType ? data.inspectionType as any : undefined,
      inputType: data.inputType ? data.inputType as any : undefined
    });

    return {
      ...item,
      _count: { inspectionRecords: 0 }
    };
  }

  /**
   * 点検項目削除（論理削除）
   */
  async deleteInspectionItem(id: string): Promise<void> {
    const item = await this.inspectionItemService.findByKey(id);

    if (!item) {
      throw new AppError('点検項目が見つかりません', 404);
    }

    // 点検記録が存在するかチェック（ここでは常に論理削除）
    await this.inspectionItemService.update(id, { isActive: false });
  }

  /**
   * 点検項目表示順更新
   */
  async updateInspectionItemOrder(items: { id: string; displayOrder: number }[]): Promise<void> {
    const updatePromises = items.map(item =>
      this.inspectionItemService.update(item.id, { displayOrder: item.displayOrder })
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
  ): Promise<PaginatedResponse<InspectionRecordResponseDTO>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      operationId,
      driverId,
      vehicleId,
      inspectionType,
      startDate,
      endDate
    } = filter;

    const where: InspectionRecordWhereInput = {};

    // フィルター条件 - 正しいフィールド名を使用
    if (operationId) {
      where.operationId = operationId;
    }

    if (driverId) {
      where.operations = { driverId };
    }

    if (vehicleId) {
      where.operations = { vehicleId };
    }

    if (inspectionType) {
      where.inspectionType = inspectionType as any;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // 運転手は自分の点検記録のみ取得可能
    if (requesterRole === UserRole.DRIVER) {
      where.inspectorId = requesterId;
    }

    const result = await this.inspectionRecordService.findManyWithPagination({
      where,
      orderBy: { [sortBy]: sortOrder } as InspectionRecordOrderByInput,
      page,
      pageSize: limit
    });

    return {
      data: result.data,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.total,
        itemsPerPage: result.pageSize
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
  ): Promise<InspectionRecordResponseDTO> {
    const record = await this.inspectionRecordService.findByKey(id);

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
  async createInspectionRecord(data: CreateInspectionRecordRequest): Promise<InspectionRecordResponseDTO> {
    // 必須フィールドバリデーション
    if (!data.vehicleId) {
      throw new AppError('車両IDが指定されていません', 400);
    }
    
    if (!data.inspectorId) {
      throw new AppError('検査員IDが指定されていません', 400);
    }
    
    if (!data.inspectionType) {
      throw new AppError('点検タイプが指定されていません', 400);
    }

    // 重複チェック（同一運行・同一点検タイプ）
    if (data.operationId) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const existingRecords = await this.inspectionRecordService.findMany({
        where: {
          operationId: data.operationId,
          inspectionType: data.inspectionType as any,
          vehicleId: data.vehicleId,
          createdAt: {
            gte: startOfDay,
            lt: endOfDay
          }
        }
      });

      if (existingRecords.length > 0) {
        throw new AppError('同一運行・同一タイプの点検記録が既に存在します', 400);
      }
    }

    // スキーマに合致するフィールドのみでレコード作成
    const createInput: any = {
      vehicleId: data.vehicleId,
      inspectorId: data.inspectorId,
      inspectionType: data.inspectionType,
      operationId: data.operationId || null,
      status: data.status || 'PENDING',
      // その他の有効なフィールド...
    };

    const record = await this.inspectionRecordService.create(createInput);
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
  ): Promise<InspectionRecordResponseDTO> {
    const existingRecord = await this.inspectionRecordService.findByKey(id);

    if (!existingRecord) {
      throw new AppError('点検記録が見つかりません', 404);
    }

    // 運転手は自分の点検記録のみ更新可能
    if (requesterRole === UserRole.DRIVER && existingRecord.inspectorId !== requesterId) {
      throw new AppError('この点検記録を更新する権限がありません', 403);
    }

    const record = await this.inspectionRecordService.update(id, data);

    return record;
  }

  /**
   * 点検記録削除
   */
  async deleteInspectionRecord(id: string): Promise<void> {
    const record = await this.inspectionRecordService.findByKey(id);

    if (!record) {
      throw new AppError('点検記録が見つかりません', 404);
    }

    await this.inspectionRecordService.delete(id);
  }

  /**
   * 運行別点検記録取得
   */
  async getInspectionRecordsByOperation(
    operationId: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<InspectionRecordResponseDTO[]> {
    // 運行記録の存在確認は省略（他サービスで実装）

    const records = await this.inspectionRecordService.findMany({
      where: { operationId },
      orderBy: [
        { inspectionType: 'asc' },
        { createdAt: 'asc' }
      ] as any
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

    const where: InspectionRecordWhereInput = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (driverId) {
      where.operations = { driverId };
    }

    if (vehicleId) {
      where.operations = { vehicleId };
    }

    if (inspectionType) {
      where.inspectionType = inspectionType as any;
    }

    // 運転手は自分のデータのみ
    if (requesterRole === UserRole.DRIVER) {
      where.inspectorId = requesterId;
    }

    const [
      totalRecords,
      okRecords,
      ngRecords
    ] = await Promise.all([
      this.inspectionRecordService.count(where),
      this.inspectionRecordService.count({ 
        ...where, 
        overallResult: true
      }),
      this.inspectionRecordService.count({ 
        ...where, 
        overallResult: false
      })
    ]);

    return {
      totalRecords,
      okRecords,
      ngRecords,
      okRate: totalRecords > 0 ? (okRecords / totalRecords) * 100 : 0,
      ngRate: totalRecords > 0 ? (ngRecords / totalRecords) * 100 : 0,
      period: { startDate, endDate }
    };
  }

  /**
   * 点検テンプレート取得
   */
  async getInspectionTemplate(inspectionType: string): Promise<InspectionItemResponseDTO[]> {
    const items = await this.inspectionItemService.findMany({
      where: {
        inspectionType: inspectionType as any,
        isActive: true
      },
      orderBy: { displayOrder: 'asc' }
    });

    return items.map(item => ({
      ...item,
      _count: { inspectionRecords: 0 }
    }));
  }
}