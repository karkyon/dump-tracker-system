// =====================================
// VehicleModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Tue Sep 16 10:05:28 AM JST 2025
// テーブルアクセサ: vehicle
// =====================================

import type { 
  Vehicle as PrismaVehicle,
  Prisma,
  GpsLog,
  InspectionRecord,
  MaintenanceRecord,
  Operation,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type VehicleModel = PrismaVehicle;
export type VehicleCreateInput = Prisma.VehicleCreateInput;
export type VehicleUpdateInput = Prisma.VehicleUpdateInput;  
export type VehicleWhereInput = Prisma.VehicleWhereInput;
export type VehicleWhereUniqueInput = Prisma.VehicleWhereUniqueInput;
export type VehicleOrderByInput = Prisma.VehicleOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface VehicleResponseDTO extends VehicleModel {
  _count?: {
    [key: string]: number;
  };
}

export interface VehicleListResponse {
  data: VehicleModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface VehicleCreateDTO extends Omit<VehicleCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface VehicleUpdateDTO extends Partial<VehicleCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class VehicleService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: VehicleCreateInput): Promise<VehicleModel> {
    return await this.prisma.vehicle.create({
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
  async findByKey(id: string): Promise<VehicleModel | null> {
    return await this.prisma.vehicle.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: VehicleWhereInput;
    orderBy?: VehicleOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<VehicleModel[]> {
    return await this.prisma.vehicle.findMany({
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
    where?: VehicleWhereInput;
    orderBy?: VehicleOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<VehicleListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.vehicle.count({ where })
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
  async update(id: string, data: VehicleUpdateInput): Promise<VehicleModel> {
    return await this.prisma.vehicle.update({
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
  async delete(id: string): Promise<VehicleModel> {
    return await this.prisma.vehicle.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.vehicle.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: VehicleWhereInput): Promise<number> {
    return await this.prisma.vehicle.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _vehicleServiceInstance: VehicleService | null = null;

export const getVehicleService = (prisma?: PrismaClient): VehicleService => {
  if (!_vehicleServiceInstance) {
    _vehicleServiceInstance = new VehicleService(prisma || new PrismaClient());
  }
  return _vehicleServiceInstance;
};

export type { VehicleModel as default };
