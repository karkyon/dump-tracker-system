// =====================================
// LocationModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Tue Sep 16 10:05:28 AM JST 2025
// テーブルアクセサ: location
// =====================================

import type { 
  Location as PrismaLocation,
  Prisma,
  OperationDetail,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type LocationModel = PrismaLocation;
export type LocationCreateInput = Prisma.LocationCreateInput;
export type LocationUpdateInput = Prisma.LocationUpdateInput;  
export type LocationWhereInput = Prisma.LocationWhereInput;
export type LocationWhereUniqueInput = Prisma.LocationWhereUniqueInput;
export type LocationOrderByInput = Prisma.LocationOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface LocationResponseDTO extends LocationModel {
  _count?: {
    [key: string]: number;
  };
}

export interface LocationListResponse {
  data: LocationModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LocationCreateDTO extends Omit<LocationCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface LocationUpdateDTO extends Partial<LocationCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class LocationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: LocationCreateInput): Promise<LocationModel> {
    return await this.prisma.location.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  /**
   * 主キー指定取得
   */
  async findByKey(id: string): Promise<LocationModel | null> {
    return await this.prisma.location.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: LocationWhereInput;
    orderBy?: LocationOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<LocationModel[]> {
    return await this.prisma.location.findMany({
      where: params?.where,
      orderBy: params?.orderBy || { createdAt: 'desc' },
      skip: params?.skip,
      take: params?.take
    });
  }

  /**
   * ページネーション付き一覧取得
   */
  async findManyWithPagination(params: {
    where?: LocationWhereInput;
    orderBy?: LocationOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<LocationListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.location.count({ where })
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * 更新
   */
  async update(id: string, data: LocationUpdateInput): Promise<LocationModel> {
    return await this.prisma.location.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 削除
   */
  async delete(id: string): Promise<LocationModel> {
    return await this.prisma.location.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.location.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: LocationWhereInput): Promise<number> {
    return await this.prisma.location.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _locationServiceInstance: LocationService | null = null;

export const getLocationService = (prisma?: PrismaClient): LocationService => {
  if (!_locationServiceInstance) {
    _locationServiceInstance = new LocationService(prisma || new PrismaClient());
  }
  return _locationServiceInstance;
};

export type { LocationModel as default };
