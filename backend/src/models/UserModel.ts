// =====================================
// UserModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Tue Sep 16 10:05:28 AM JST 2025
// テーブルアクセサ: user
// =====================================

import type { 
  User as PrismaUser,
  Prisma,
  AuditLog,
  InspectionItem,
  InspectionItemResult,
  InspectionRecord,
  MaintenanceRecord,
  Notification,
  Operation,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type UserModel = PrismaUser;
export type UserCreateInput = Prisma.UserCreateInput;
export type UserUpdateInput = Prisma.UserUpdateInput;  
export type UserWhereInput = Prisma.UserWhereInput;
export type UserWhereUniqueInput = Prisma.UserWhereUniqueInput;
export type UserOrderByInput = Prisma.UserOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface UserResponseDTO extends UserModel {
  _count?: {
    [key: string]: number;
  };
}

export interface UserListResponse {
  data: UserModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserCreateDTO extends Omit<UserCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // フロントエンド送信用
}

export interface UserUpdateDTO extends Partial<UserCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: UserCreateInput): Promise<UserModel> {
    return await this.prisma.user.create({
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
  async findByKey(id: string): Promise<UserModel | null> {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<UserModel[]> {
    return await this.prisma.user.findMany({
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
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<UserListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prisma.user.count({ where })
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
  async update(id: string, data: UserUpdateInput): Promise<UserModel> {
    return await this.prisma.user.update({
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
  async delete(id: string): Promise<UserModel> {
    return await this.prisma.user.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: UserWhereInput): Promise<number> {
    return await this.prisma.user.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _userServiceInstance: UserService | null = null;

export const getUserService = (prisma?: PrismaClient): UserService => {
  if (!_userServiceInstance) {
    _userServiceInstance = new UserService(prisma || new PrismaClient());
  }
  return _userServiceInstance;
};

export type { UserModel as default };
