// =====================================
// NotificationModel.ts
// クリーン生成されたモデルファイル  
// 生成日時: Sat Sep 13 10:52:23 PM JST 2025
// テーブルアクセサ: notification
// =====================================

import type { 
  Notification as PrismaNotification,
  Prisma,
  User,} from '@prisma/client';

// PrismaClientを通常のimportとして追加
import { PrismaClient } from '@prisma/client';

// =====================================
// 基本型定義
// =====================================

export type NotificationModel = PrismaNotification;
export type NotificationCreateInput = Prisma.NotificationCreateInput;
export type NotificationUpdateInput = Prisma.NotificationUpdateInput;  
export type NotificationWhereInput = Prisma.NotificationWhereInput;
export type NotificationWhereUniqueInput = Prisma.NotificationWhereUniqueInput;
export type NotificationOrderByInput = Prisma.NotificationOrderByWithRelationInput;

// =====================================
// 標準DTO
// =====================================

export interface NotificationResponseDTO extends NotificationModel {
  _count?: {
    [key: string]: number;
  };
}

export interface NotificationListResponse {
  data: NotificationModel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NotificationCreateDTO extends Omit<NotificationCreateInput, 'id'> {
  // フロントエンド送信用
}

export interface NotificationUpdateDTO extends Partial<NotificationCreateDTO> {
  // 更新用（部分更新対応）
}

// =====================================
// 基本CRUDクラス
// =====================================

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 新規作成
   */
  async create(data: NotificationCreateInput): Promise<NotificationModel> {
    return await this.prisma.notification.create({
      data: {
        ...data,

      }
    });
  }

  /**
   * 主キー指定取得
   */
  async findByKey(id: string): Promise<NotificationModel | null> {
    return await this.prisma.notification.findUnique({
      where: { id }
    });
  }

  /**
   * 条件指定一覧取得
   */
  async findMany(params?: {
    where?: NotificationWhereInput;
    orderBy?: NotificationOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<NotificationModel[]> {
    return await this.prisma.notification.findMany({
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
    where?: NotificationWhereInput;
    orderBy?: NotificationOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<NotificationListResponse> {
    const { page, pageSize, where, orderBy } = params;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: orderBy || {},
        skip,
        take: pageSize
      }),
      this.prisma.notification.count({ where })
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
  async update(id: string, data: NotificationUpdateInput): Promise<NotificationModel> {
    return await this.prisma.notification.update({
      where: { id },
      data: {
        ...data,

      }
    });
  }

  /**
   * 削除
   */
  async delete(id: string): Promise<NotificationModel> {
    return await this.prisma.notification.delete({
      where: { id }
    });
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.notification.count({
      where: { id }
    });
    return count > 0;
  }

  /**
   * カウント取得
   */
  async count(where?: NotificationWhereInput): Promise<number> {
    return await this.prisma.notification.count({ where });
  }
}

// =====================================
// インスタンス作成・エクスポート
// =====================================

let _notificationServiceInstance: NotificationService | null = null;

export const getNotificationService = (prisma?: PrismaClient): NotificationService => {
  if (!_notificationServiceInstance) {
    _notificationServiceInstance = new NotificationService(prisma || new PrismaClient());
  }
  return _notificationServiceInstance;
};

export type { NotificationModel as default };
