// =====================================
// SystemSettingModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Tue Sep 16 10:05:28 AM JST 2025
// テーブルアクセサ: systemSetting
// =====================================

import type { 
  SystemSetting as PrismaSystemSetting,
  Prisma,
} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type SystemSettingModel = PrismaSystemSetting;
export type SystemSettingCreateInput = Prisma.SystemSettingCreateInput;
export type SystemSettingUpdateInput = Prisma.SystemSettingUpdateInput;  
export type SystemSettingWhereInput = Prisma.SystemSettingWhereInput;
export type SystemSettingWhereUniqueInput = Prisma.SystemSettingWhereUniqueInput;
export type SystemSettingOrderByInput = Prisma.SystemSettingOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface SystemSettingResponseDTO extends SystemSettingModel {
  _count?: {
    [key: string]: number;
  };
}

export interface SystemSettingListResponse {
  data: SystemSettingModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SystemSettingCreateDTO extends Omit<SystemSettingCreateInput, 'key'> {
  // フロントエンド送信用
}

export interface SystemSettingUpdateDTO extends Partial<SystemSettingCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class SystemSettingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: SystemSettingCreateInput): Promise<SystemSettingModel> {
    return await this.prisma.systemSetting.create({
      data: {
        ...data,

      }
    });
  }

  /**
   * 主キー指定取得
   */
  async findByKey(key: string): Promise<SystemSettingModel | null> {
    return await this.prisma.systemSetting.findUnique({
      where: { key }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: SystemSettingWhereInput;
    orderBy?: SystemSettingOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<SystemSettingModel[]> {
    return await this.prisma.systemSetting.findMany({
      where: params?.where,
      orderBy: params?.orderBy || {},
      skip: params?.skip,
      take: params?.take
    });
  }

  /**
   * ページネーション付き一覧取得
   */
  async findManyWithPagination(params: {
    where?: SystemSettingWhereInput;
    orderBy?: SystemSettingOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<SystemSettingListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.systemSetting.findMany({
        where,
        orderBy: orderBy || {},
        skip,
        take: pageSize
      }),
      this.prisma.systemSetting.count({ where })
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
  async update(key: string, data: SystemSettingUpdateInput): Promise<SystemSettingModel> {
    return await this.prisma.systemSetting.update({
      where: { key },
      data: {
        ...data,

      }
    });
  }

  /**
   * 削除
   */
  async delete(key: string): Promise<SystemSettingModel> {
    return await this.prisma.systemSetting.delete({
      where: { key }
    });
  }

  /**
   * 存在チェック
   */
  async exists(key: string): Promise<boolean> {
    const count = await this.prisma.systemSetting.count({
      where: { key }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: SystemSettingWhereInput): Promise<number> {
    return await this.prisma.systemSetting.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _systemsettingServiceInstance: SystemSettingService | null = null;

export const getSystemSettingService = (prisma?: PrismaClient): SystemSettingService => {
  if (!_systemsettingServiceInstance) {
    _systemsettingServiceInstance = new SystemSettingService(prisma || new PrismaClient());
  }
  return _systemsettingServiceInstance;
};

export type { SystemSettingModel as default };
