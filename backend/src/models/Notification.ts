// backend/src/models/Notification.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 通知モデル - Prismaスキーマ完全準拠版
 * ユーザー通知の管理
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface NotificationModel {
  id: string;
  user_id?: string | null;
  title?: string | null;
  message?: string | null;
  is_read: boolean;
}

export interface NotificationCreateInput {
  user_id?: string;
  title?: string;
  message?: string;
  is_read?: boolean;
}

export interface NotificationUpdateInput {
  user_id?: string;
  title?: string;
  message?: string;
  is_read?: boolean;
}

export interface NotificationWhereInput {
  id?: string;
  user_id?: string;
  title?: string | { contains?: string; mode?: 'insensitive' };
  message?: { contains?: string; mode?: 'insensitive' };
  is_read?: boolean;
}

export interface NotificationOrderByInput {
  id?: 'asc' | 'desc';
  user_id?: 'asc' | 'desc';
  title?: 'asc' | 'desc';
  is_read?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
  MAINTENANCE = 'MAINTENANCE',
  OPERATION = 'OPERATION',
  INSPECTION = 'INSPECTION',
  ALERT = 'ALERT'
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ExtendedNotificationModel extends NotificationModel {
  type: NotificationType;
  priority: NotificationPriority;
  action_url?: string;
  action_text?: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationResponseDTO {
  id: string;
  user_id?: string | null;
  title?: string | null;
  message?: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  is_read: boolean;
  action_url?: string;
  action_text?: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  // リレーションデータ
  user?: {
    name: string;
    username: string;
    employee_id?: string;
  };
}

export interface NotificationStats {
  total_notifications: number;
  unread_notifications: number;
  read_notifications: number;
  notifications_today: number;
  notifications_this_week: number;
  notifications_by_type: {
    [K in NotificationType]: number;
  };
  notifications_by_priority: {
    [K in NotificationPriority]: number;
  };
  expired_notifications: number;
  active_users_with_notifications: number;
}

export interface UserNotificationSummary {
  user_id: string;
  user_name: string;
  username: string;
  total_notifications: number;
  unread_notifications: number;
  latest_notification?: Date;
  critical_notifications: number;
  notification_preferences?: UserNotificationPreferences;
}

export interface UserNotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  notification_types: {
    [K in NotificationType]: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start_time: string; // HH:MM format
    end_time: string;   // HH:MM format
  };
  frequency: 'IMMEDIATE' | 'HOURLY' | 'DAILY' | 'WEEKLY';
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  title_template: string;
  message_template: string;
  priority: NotificationPriority;
  action_url_template?: string;
  action_text?: string;
  expires_after_hours?: number;
  variables: string[]; // テンプレート変数リスト
}

export interface BulkNotificationRequest {
  user_ids?: string[]; // 指定ユーザーへ送信
  user_roles?: string[]; // 指定ロールのユーザーへ送信
  broadcast?: boolean; // 全ユーザーへ送信
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  action_url?: string;
  action_text?: string;
  expires_after_hours?: number;
}

// =====================================
// 通知モデルクラス
// =====================================

export class Notification {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * 通知作成
   */
  async create(data: NotificationCreateInput): Promise<NotificationModel> {
    try {
      return await this.prisma.notifications.create({
        data: {
          ...data,
          is_read: data.is_read ?? false
        }
      });
    } catch (error) {
      throw new Error(`通知作成エラー: ${error}`);
    }
  }

  /**
   * 拡張通知作成（追加フィールド付き）
   */
  async createExtended(data: {
    user_id?: string;
    title?: string;
    message?: string;
    type: NotificationType;
    priority: NotificationPriority;
    action_url?: string;
    action_text?: string;
    expires_after_hours?: number;
    is_read?: boolean;
  }): Promise<ExtendedNotificationModel> {
    try {
      // 基本通知を作成
      const notification = await this.create({
        user_id: data.user_id,
        title: data.title,
        message: data.message,
        is_read: data.is_read
      });

      // 拡張フィールドを追加して返す
      const expires_at = data.expires_after_hours ? 
        new Date(Date.now() + data.expires_after_hours * 60 * 60 * 1000) : undefined;

      return {
        ...notification,
        type: data.type,
        priority: data.priority,
        action_url: data.action_url,
        action_text: data.action_text,
        expires_at,
        created_at: new Date(),
        updated_at: new Date()
      };
    } catch (error) {
      throw new Error(`拡張通知作成エラー: ${error}`);
    }
  }

  /**
   * 通知取得（ID指定）
   */
  async findById(id: string, includeRelations: boolean = false): Promise<NotificationModel | null> {
    try {
      return await this.prisma.notifications.findUnique({
        where: { id },
        include: includeRelations ? {
          users: true
        } : undefined
      });
    } catch (error) {
      throw new Error(`通知取得エラー: ${error}`);
    }
  }

  /**
   * 通知一覧取得
   */
  async findMany(params: {
    where?: NotificationWhereInput;
    orderBy?: NotificationOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      user?: boolean;
    };
  }): Promise<NotificationModel[]> {
    try {
      return await this.prisma.notifications.findMany({
        where: params.where,
        orderBy: params.orderBy || { id: 'desc' },
        skip: params.skip,
        take: params.take,
        include: params.include ? {
          users: params.include.user
        } : undefined
      });
    } catch (error) {
      throw new Error(`通知一覧取得エラー: ${error}`);
    }
  }

  /**
   * 通知更新
   */
  async update(id: string, data: NotificationUpdateInput): Promise<NotificationModel> {
    try {
      return await this.prisma.notifications.update({
        where: { id },
        data
      });
    } catch (error) {
      throw new Error(`通知更新エラー: ${error}`);
    }
  }

  /**
   * 通知削除
   */
  async delete(id: string): Promise<NotificationModel> {
    try {
      return await this.prisma.notifications.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`通知削除エラー: ${error}`);
    }
  }

  /**
   * 通知数カウント
   */
  async count(where?: NotificationWhereInput): Promise<number> {
    try {
      return await this.prisma.notifications.count({ where });
    } catch (error) {
      throw new Error(`通知数取得エラー: ${error}`);
    }
  }

  /**
   * ユーザーの通知取得
   */
  async findByUserId(user_id: string, limit?: number): Promise<NotificationModel[]> {
    try {
      return await this.prisma.notifications.findMany({
        where: { user_id },
        orderBy: { id: 'desc' },
        take: limit
      });
    } catch (error) {
      throw new Error(`ユーザー通知取得エラー: ${error}`);
    }
  }

  /**
   * 未読通知取得
   */
  async findUnreadByUserId(user_id: string): Promise<NotificationModel[]> {
    try {
      return await this.prisma.notifications.findMany({
        where: { 
          user_id,
          is_read: false 
        },
        orderBy: { id: 'desc' }
      });
    } catch (error) {
      throw new Error(`未読通知取得エラー: ${error}`);
    }
  }

  /**
   * 通知を既読にする
   */
  async markAsRead(id: string): Promise<NotificationModel> {
    try {
      return await this.update(id, { is_read: true });
    } catch (error) {
      throw new Error(`既読マークエラー: ${error}`);
    }
  }

  /**
   * 複数通知を既読にする
   */
  async markMultipleAsRead(ids: string[]): Promise<{ count: number }> {
    try {
      return await this.prisma.notifications.updateMany({
        where: { id: { in: ids } },
        data: { is_read: true }
      });
    } catch (error) {
      throw new Error(`複数既読マークエラー: ${error}`);
    }
  }

  /**
   * ユーザーの全通知を既読にする
   */
  async markAllAsReadByUserId(user_id: string): Promise<{ count: number }> {
    try {
      return await this.prisma.notifications.updateMany({
        where: { 
          user_id,
          is_read: false 
        },
        data: { is_read: true }
      });
    } catch (error) {
      throw new Error(`全通知既読マークエラー: ${error}`);
    }
  }

  /**
   * 運行関連通知作成
   */
  async createOperationNotification(params: {
    user_id: string;
    operation_id: string;
    operation_number: string;
    type: 'STARTED' | 'COMPLETED' | 'DELAYED' | 'CANCELLED';
    priority?: NotificationPriority;
  }): Promise<ExtendedNotificationModel> {
    try {
      const messages = {
        STARTED: {
          title: '運行開始',
          message: `運行 ${params.operation_number} が開始されました`,
          type: NotificationType.OPERATION
        },
        COMPLETED: {
          title: '運行完了',
          message: `運行 ${params.operation_number} が完了しました`,
          type: NotificationType.SUCCESS
        },
        DELAYED: {
          title: '運行遅延',
          message: `運行 ${params.operation_number} に遅延が発生しています`,
          type: NotificationType.WARNING
        },
        CANCELLED: {
          title: '運行キャンセル',
          message: `運行 ${params.operation_number} がキャンセルされました`,
          type: NotificationType.ERROR
        }
      };

      const notification_data = messages[params.type];

      return await this.createExtended({
        user_id: params.user_id,
        title: notification_data.title,
        message: notification_data.message,
        type: notification_data.type,
        priority: params.priority || NotificationPriority.MEDIUM,
        action_url: `/operations/${params.operation_id}`,
        action_text: '詳細を確認',
        expires_after_hours: 24
      });
    } catch (error) {
      throw new Error(`運行通知作成エラー: ${error}`);
    }
  }

  /**
   * 点検関連通知作成
   */
  async createInspectionNotification(params: {
    user_id: string;
    vehicle_plate_number: string;
    inspection_type: string;
    type: 'DUE' | 'FAILED' | 'COMPLETED';
    priority?: NotificationPriority;
  }): Promise<ExtendedNotificationModel> {
    try {
      const messages = {
        DUE: {
          title: '点検期限',
          message: `車両 ${params.vehicle_plate_number} の${params.inspection_type}点検が期限です`,
          type: NotificationType.WARNING,
          priority: NotificationPriority.HIGH
        },
        FAILED: {
          title: '点検不合格',
          message: `車両 ${params.vehicle_plate_number} の点検で不具合が発見されました`,
          type: NotificationType.ERROR,
          priority: NotificationPriority.CRITICAL
        },
        COMPLETED: {
          title: '点検完了',
          message: `車両 ${params.vehicle_plate_number} の点検が完了しました`,
          type: NotificationType.SUCCESS,
          priority: NotificationPriority.LOW
        }
      };

      const notification_data = messages[params.type];

      return await this.createExtended({
        user_id: params.user_id,
        title: notification_data.title,
        message: notification_data.message,
        type: notification_data.type,
        priority: params.priority || notification_data.priority,
        action_url: `/vehicles/${params.vehicle_plate_number}/inspections`,
        action_text: '点検履歴を確認',
        expires_after_hours: 72
      });
    } catch (error) {
      throw new Error(`点検通知作成エラー: ${error}`);
    }
  }

  /**
   * メンテナンス関連通知作成
   */
  async createMaintenanceNotification(params: {
    user_id: string;
    vehicle_plate_number: string;
    maintenance_type: string;
    due_date: Date;
    priority?: NotificationPriority;
  }): Promise<ExtendedNotificationModel> {
    try {
      const days_until_due = Math.ceil((params.due_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      let priority = params.priority || NotificationPriority.MEDIUM;
      let type = NotificationType.MAINTENANCE;

      if (days_until_due <= 0) {
        priority = NotificationPriority.CRITICAL;
        type = NotificationType.ERROR;
      } else if (days_until_due <= 7) {
        priority = NotificationPriority.HIGH;
        type = NotificationType.WARNING;
      }

      const message = days_until_due <= 0 ? 
        `車両 ${params.vehicle_plate_number} の${params.maintenance_type}が期限切れです` :
        `車両 ${params.vehicle_plate_number} の${params.maintenance_type}まで${days_until_due}日です`;

      return await this.createExtended({
        user_id: params.user_id,
        title: 'メンテナンス期限',
        message,
        type,
        priority,
        action_url: `/vehicles/${params.vehicle_plate_number}/maintenance`,
        action_text: 'メンテナンス予定を確認',
        expires_after_hours: 168 // 1週間
      });
    } catch (error) {
      throw new Error(`メンテナンス通知作成エラー: ${error}`);
    }
  }

  /**
   * システム通知作成
   */
  async createSystemNotification(params: {
    title: string;
    message: string;
    type: NotificationType;
    priority: NotificationPriority;
    broadcast?: boolean;
    user_ids?: string[];
    expires_after_hours?: number;
  }): Promise<ExtendedNotificationModel[]> {
    try {
      let target_user_ids: string[] = [];

      if (params.broadcast) {
        // 全ユーザーに送信
        const users = await this.prisma.users.findMany({
          where: { is_active: true },
          select: { id: true }
        });
        target_user_ids = users.map(user => user.id);
      } else if (params.user_ids) {
        target_user_ids = params.user_ids;
      }

      const notifications: ExtendedNotificationModel[] = [];

      for (const user_id of target_user_ids) {
        const notification = await this.createExtended({
          user_id,
          title: params.title,
          message: params.message,
          type: params.type,
          priority: params.priority,
          expires_after_hours: params.expires_after_hours || 72
        });
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      throw new Error(`システム通知作成エラー: ${error}`);
    }
  }

  /**
   * 通知統計取得
   */
  async getStats(): Promise<NotificationStats> {
    try {
      const now = new Date();
      const today = new Date(now.setHours(0, 0, 0, 0));
      const week_ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        total_notifications,
        unread_notifications,
        read_notifications,
        notifications_today,
        notifications_this_week,
        active_users_count
      ] = await Promise.all([
        this.prisma.notifications.count(),
        this.prisma.notifications.count({ where: { is_read: false } }),
        this.prisma.notifications.count({ where: { is_read: true } }),
        this.prisma.notifications.count({ where: { id: { gte: today.toISOString() } } }),
        this.prisma.notifications.count({ where: { id: { gte: week_ago.toISOString() } } }),
        this.prisma.notifications.groupBy({
          by: ['user_id'],
          where: { user_id: { not: null } }
        })
      ]);

      // 仮の統計データ（実際の実装では適切にカウント）
      const notifications_by_type = Object.values(NotificationType).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as { [K in NotificationType]: number });

      const notifications_by_priority = Object.values(NotificationPriority).reduce((acc, priority) => {
        acc[priority] = 0;
        return acc;
      }, {} as { [K in NotificationPriority]: number });

      return {
        total_notifications,
        unread_notifications,
        read_notifications,
        notifications_today,
        notifications_this_week,
        notifications_by_type,
        notifications_by_priority,
        expired_notifications: 0,
        active_users_with_notifications: active_users_count.length
      };
    } catch (error) {
      throw new Error(`通知統計取得エラー: ${error}`);
    }
  }

  /**
   * ユーザー通知サマリー取得
   */
  async getUserNotificationSummary(user_id: string): Promise<UserNotificationSummary | null> {
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: user_id }
      });

      if (!user) {
        return null;
      }

      const [
        total_notifications,
        unread_notifications,
        latest_notification,
        critical_notifications
      ] = await Promise.all([
        this.prisma.notifications.count({ where: { user_id } }),
        this.prisma.notifications.count({ where: { user_id, is_read: false } }),
        this.prisma.notifications.findFirst({
          where: { user_id },
          orderBy: { id: 'desc' }
        }),
        this.prisma.notifications.count({ 
          where: { 
            user_id,
            // 優先度が高い通知をカウント（実際の実装では適切にフィルタ）
            title: { contains: '緊急' }
          }
        })
      ]);

      return {
        user_id,
        user_name: user.name,
        username: user.username,
        total_notifications,
        unread_notifications,
        latest_notification: latest_notification ? new Date() : undefined,
        critical_notifications
      };
    } catch (error) {
      throw new Error(`ユーザー通知サマリー取得エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(notification: any): NotificationResponseDTO {
    return {
      id: notification.id,
      user_id: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: NotificationType.INFO, // デフォルト値
      priority: NotificationPriority.MEDIUM, // デフォルト値
      is_read: notification.is_read,
      created_at: new Date(),
      updated_at: new Date(),
      user: notification.users ? {
        name: notification.users.name,
        username: notification.users.username,
        employee_id: notification.users.employee_id
      } : undefined
    };
  }

  /**
   * 古い通知の削除
   */
  async deleteOldNotifications(days_to_keep: number = 30): Promise<{ count: number }> {
    try {
      const cutoff_date = new Date(Date.now() - days_to_keep * 24 * 60 * 60 * 1000);
      
      return await this.prisma.notifications.deleteMany({
        where: {
          is_read: true,
          // created_at相当のフィールドが無いため、IDベースで代用
          id: { lt: cutoff_date.toISOString() }
        }
      });
    } catch (error) {
      throw new Error(`古い通知削除エラー: ${error}`);
    }
  }

  /**
   * 通知存在確認
   */
  async exists(where: { 
    id?: string; 
    user_id?: string;
    title?: string;
  }): Promise<boolean> {
    try {
      const notification = await this.prisma.notifications.findFirst({ where });
      return notification !== null;
    } catch (error) {
      throw new Error(`通知存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const notificationModel = new Notification();
export default notificationModel;