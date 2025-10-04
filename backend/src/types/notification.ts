// =====================================
// backend/src/types/notification.ts
// 通知関連型定義 - エラー修正完全版
// 既存完全実装保持 + Prismaスキーマ整合性対応
// 作成日時: 2025年9月27日
// 最終更新: 2025年10月1日 - NotificationFilter/Input拡張・エラー修正
// =====================================

import type { Prisma } from '@prisma/client';
import type {
  ValidationResult,
  StatisticsBase,
  SearchQuery,
  DateRange,
  ApiListResponse,
  BulkOperationResult
} from './common';

// ✅ Prisma名前空間から型を抽出
type PrismaNotificationWhereInput = Prisma.NotificationWhereInput;

// typeとpriorityの型を抽出
type NotificationTypeFilter = PrismaNotificationWhereInput['type'];
type NotificationPriorityFilter = PrismaNotificationWhereInput['priority'];
type NotificationStatusFilter = PrismaNotificationWhereInput['status'];

// =====================================
// 📋 1. Enum型定義（既存完全保持）
// =====================================

/**
 * 通知種別
 */
export enum NotificationType {
  SYSTEM = 'SYSTEM',                                   // システム通知
  OPERATION = 'OPERATION',                             // 運行関連
  MAINTENANCE = 'MAINTENANCE',                         // メンテナンス
  INSPECTION = 'INSPECTION',                           // 点検関連
  ALERT = 'ALERT',                                     // アラート
  WARNING = 'WARNING',                                 // 警告
  INFO = 'INFO',                                       // 情報
  REMINDER = 'REMINDER',                               // リマインダー
  REPORT = 'REPORT',                                   // レポート
  APPROVAL = 'APPROVAL',                               // 承認依頼
  MESSAGE = 'MESSAGE'                                  // メッセージ
}

/**
 * 通知配信チャネル
 */
export enum NotificationChannel {
  IN_APP = 'IN_APP',                                   // アプリ内通知
  PUSH = 'PUSH',                                       // プッシュ通知
  EMAIL = 'EMAIL',                                     // メール
  SMS = 'SMS',                                         // SMS
  WEBHOOK = 'WEBHOOK',                                 // Webhook
  SLACK = 'SLACK',                                     // Slack
  TEAMS = 'TEAMS'                                      // Microsoft Teams
}

/**
 * 通知優先度
 */
export enum NotificationPriority {
  CRITICAL = 'CRITICAL',                               // 緊急
  HIGH = 'HIGH',                                       // 高
  MEDIUM = 'MEDIUM',                                   // 中
  LOW = 'LOW',                                         // 低
  INFO = 'INFO'                                        // 情報
}

/**
 * 通知ステータス
 */
export enum NotificationStatus {
  PENDING = 'PENDING',                                 // 送信待ち
  SENT = 'SENT',                                       // 送信済み
  DELIVERED = 'DELIVERED',                             // 配信済み
  READ = 'READ',                                       // 既読
  FAILED = 'FAILED',                                   // 送信失敗
  CANCELLED = 'CANCELLED',                             // キャンセル
  EXPIRED = 'EXPIRED'                                  // 期限切れ
}

// =====================================
// 📋 2. Prisma型の基本エクスポート（既存保持）
// =====================================

// Prisma生成型をそのまま使用
export type NotificationModel = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  userId: string;
  isRead: boolean;
  readAt: Date | null;
  expiresAt: Date | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
};

// ✅ 修正: NotificationCreateInput（userIdフィールド追加）
export interface NotificationCreateInput {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  userId: string; // ✅ 追加: Prismaスキーマと整合性確保
  isRead?: boolean;
  readAt?: Date | null;
  expiresAt?: Date | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
  // Relations（optional）
  users?: Prisma.UserCreateNestedOneWithoutNotificationsInput;
}

export interface NotificationUpdateInput {
  title?: string;
  message?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  userId?: string;
  isRead?: boolean;
  readAt?: Date | null;
  expiresAt?: Date | null;
  metadata?: Record<string, any> | null;
  updatedAt?: Date;
  // Relations（optional）
  users?: Prisma.UserUpdateOneWithoutNotificationsNestedInput;
}

// NotificationWhereInput（isReadフィールド追加）
export interface NotificationWhereInput {
  id?: string | Prisma.StringFilter;
  title?: string | Prisma.StringFilter;
  message?: string | Prisma.StringFilter;

  // Prismaから抽出した型を使用
  type?: NotificationTypeFilter;
  priority?: NotificationPriorityFilter;
  status?: NotificationStatusFilter;

  userId?: string | Prisma.StringFilter;
  isRead?: boolean | Prisma.BoolFilter;
  readAt?: Date | null | Prisma.DateTimeNullableFilter;
  expiresAt?: Date | null | Prisma.DateTimeNullableFilter;
  createdAt?: Date | Prisma.DateTimeFilter;
  updatedAt?: Date | Prisma.DateTimeFilter;

  // Logical operators
  AND?: NotificationWhereInput | NotificationWhereInput[];
  OR?: NotificationWhereInput | NotificationWhereInput[];
  NOT?: NotificationWhereInput | NotificationWhereInput[];

  // Relations
  users?: Prisma.UserWhereInput;
}

export interface NotificationWhereUniqueInput {
  id?: string;
}

// NotificationOrderByInput（isRead, createdAtフィールド追加）
export interface NotificationOrderByInput {
  id?: Prisma.SortOrder;
  title?: Prisma.SortOrder;
  message?: Prisma.SortOrder;
  type?: Prisma.SortOrder;
  priority?: Prisma.SortOrder;
  status?: Prisma.SortOrder;
  userId?: Prisma.SortOrder;
  isRead?: Prisma.SortOrder; // ソート対応
  readAt?: Prisma.SortOrder;
  expiresAt?: Prisma.SortOrder;
  createdAt?: Prisma.SortOrder; // ソート対応
  updatedAt?: Prisma.SortOrder;
  // Relations
  users?: Prisma.UserOrderByWithRelationInput;
}

// =====================================
// 📋 3. 通知詳細情報（拡張機能）
// =====================================

/**
 * 通知詳細情報（拡張機能）
 */
export interface NotificationDetails {
  // 基本情報
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  status: NotificationStatus;

  // コンテンツ情報
  subject?: string;
  body: string;
  htmlBody?: string;
  shortMessage?: string;                               // SMS用短縮メッセージ

  // メディア・添付ファイル
  iconUrl?: string;
  imageUrl?: string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    downloadUrl: string;
  }>;

  // アクション・リンク
  actionButtons?: Array<{
    label: string;
    action: 'OPEN_URL' | 'CALL_API' | 'NAVIGATE' | 'DISMISS';
    url?: string;
    apiEndpoint?: string;
    navigationPath?: string;
  }>;

  // 配信設定
  scheduleType: 'IMMEDIATE' | 'SCHEDULED' | 'RECURRING';
  scheduledAt?: Date;
  recurringPattern?: {
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval: number;
    endDate?: Date;
  };
  expiresAt?: Date;

  // ターゲティング
  targetAudience: {
    userIds?: string[];
    roles?: string[];
    departments?: string[];
    locations?: string[];
    vehicles?: string[];
    customFilters?: Record<string, any>;
  };

  // 配信結果
  deliveryResults?: Array<{
    channel: NotificationChannel;
    recipientId: string;
    status: NotificationStatus;
    deliveredAt?: Date;
    readAt?: Date;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }>;

  // カスタマイズ・パーソナライゼーション
  personalization?: {
    variables: Record<string, string>;
    templateId?: string;
    locale?: string;
  };

  // 分析・追跡
  analytics?: {
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    clickCount: number;
    conversionCount: number;
  };

  // 関連情報
  relatedEntityType?: 'OPERATION' | 'VEHICLE' | 'USER' | 'INSPECTION' | 'MAINTENANCE';
  relatedEntityId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

// =====================================
// 📋 4. 通知統計情報（高度分析）
// =====================================

/**
 * 通知統計情報（高度分析）
 */
export interface NotificationStatistics extends StatisticsBase {
  // 基本統計
  totalNotifications: number;
  sentNotifications: number;
  deliveredNotifications: number;
  readNotifications: number;
  failedNotifications: number;

  // 配信率・開封率
  deliveryRate: number;                                // 配信率（%）
  readRate: number;                                    // 開封率（%）
  clickThroughRate: number;                            // クリック率（%）
  conversionRate: number;                              // コンバージョン率（%）

  // チャネル別統計
  channelPerformance: Record<NotificationChannel, {
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    deliveryRate: number;
    readRate: number;
    averageDeliveryTime: number;                       // 平均配信時間（秒）
  }>;

  // 種別別統計
  typeBreakdown: Record<NotificationType, {
    count: number;
    readRate: number;
    averageResponseTime: number;                       // 平均応答時間（秒）
  }>;

  // 時間別分析
  timeAnalysis: {
    hourlyDistribution: Array<{
      hour: number;
      count: number;
      readRate: number;
    }>;
    dailyTrends: Array<{
      date: string;
      sentCount: number;
      readCount: number;
    }>;
  };

  // 効果測定
  effectivenessMetrics: {
    averageTimeToRead: number;                         // 平均既読時間（秒）
    peakEngagementHour: number;
    leastEngagementHour: number;
    mostEffectiveChannel: NotificationChannel;
    recommendedSendTime: string;
  };

  // 問題分析
  issueAnalysis: {
    topFailureReasons: Array<{
      reason: string;
      count: number;
      percentage: number;
    }>;
    undeliveredUsers: Array<{
      userId: string;
      reason: string;
      lastSuccessfulDelivery: Date;
    }>;
  };
}

// =====================================
// 📋 5. 通知検索・フィルタ条件（高度検索）
// =====================================

// ✅ 修正: NotificationFilter（query, isRead等のフィールド追加）
/**
 * 通知検索・フィルタ条件（高度検索）
 */
export interface NotificationFilter extends SearchQuery {
  // ✅ 追加: 基本検索クエリ
  query?: string; // タイトル・メッセージの全文検索用

  // 基本フィルタ
  types?: NotificationType[];
  channels?: NotificationChannel[];
  priorities?: NotificationPriority[];
  statuses?: NotificationStatus[];

  // ユーザー・受信者フィルタ
  recipientIds?: string[];
  roles?: string[];
  departments?: string[];

  // 日時フィルタ
  sentDateRange?: DateRange;
  scheduledDateRange?: DateRange;
  readDateRange?: DateRange;

  // 関連エンティティフィルタ
  relatedEntityTypes?: string[];
  relatedEntityIds?: string[];

  // ✅ 追加: ステータスフィルタ
  isRead?: boolean; // 既読/未読フィルタ
  isDelivered?: boolean;
  hasFailed?: boolean;
  isExpired?: boolean;

  // 統計・分析オプション
  includeStatistics?: boolean;
  includeDeliveryResults?: boolean;
  includeAnalytics?: boolean;
  groupBy?: 'type' | 'channel' | 'priority' | 'recipient' | 'date';

  // ✅ 追加: ページネーション・ソート（ExtendedFilterOptions互換）
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// =====================================
// 📋 6. 通知設定
// =====================================

/**
 * 通知設定
 */
export interface NotificationSettings {
  userId: string;

  // チャネル別設定
  channelPreferences: Record<NotificationChannel, {
    enabled: boolean;
    minimumPriority: NotificationPriority;
    quietHours?: {
      start: string;                                   // HH:mm形式
      end: string;                                     // HH:mm形式
      timezone: string;
    };
  }>;

  // 種別別設定
  typePreferences: Record<NotificationType, {
    enabled: boolean;
    preferredChannels: NotificationChannel[];
    customThresholds?: Record<string, number>;
  }>;

  // 一般設定
  generalSettings: {
    language: string;
    groupSimilarNotifications: boolean;
    maxNotificationsPerHour: number;
    autoMarkAsRead: boolean;
    retentionDays: number;
  };

  // デバイス設定
  deviceSettings?: {
    pushTokens: Array<{
      token: string;
      platform: 'iOS' | 'Android' | 'Web';
      lastUpdated: Date;
    }>;
    emailAddress?: string;
    phoneNumber?: string;
  };
}

// =====================================
// 📋 7. 通知テンプレート
// =====================================

/**
 * 通知テンプレート
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channels: NotificationChannel[];

  // コンテンツテンプレート
  templates: Record<NotificationChannel, {
    subject?: string;
    body: string;
    htmlBody?: string;
    variables: string[];                               // 使用可能変数一覧
  }>;

  // デザイン設定
  styling?: {
    primaryColor: string;
    backgroundColor: string;
    fontFamily: string;
    logoUrl?: string;
  };

  // 多言語対応
  localizations?: Record<string, {
    templates: Record<NotificationChannel, {
      subject?: string;
      body: string;
      htmlBody?: string;
    }>;
  }>;

  // 設定
  isActive: boolean;
  priority: NotificationPriority;
  expirationHours?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================
// 📋 8. 通知バリデーション結果
// =====================================

/**
 * 通知バリデーション結果
 */
export interface NotificationValidationResult extends ValidationResult {
  checks?: {
    type: 'RECIPIENT_VALIDATION' | 'CONTENT_VALIDATION' | 'CHANNEL_AVAILABILITY' | 'RATE_LIMIT_CHECK';
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    details?: any;
  }[];

  deliveryEstimate?: {
    estimatedDeliveryTime: Date;
    estimatedRecipientCount: number;
    channelAvailability: Record<NotificationChannel, boolean>;
    rateLimitStatus: {
      remaining: number;
      resetTime: Date;
    };
  };

  contentAnalysis?: {
    readabilityScore: number;
    sentimentScore: number;
    spamLikelihood: number;
    recommendations: string[];
  };
}

// =====================================
// 📋 9. 標準DTO（既存実装保持・拡張）
// =====================================

export interface NotificationResponseDTO extends NotificationModel {
  // 関連データ
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };

  // 拡張情報
  details?: NotificationDetails;

  // 計算フィールド
  timeAgo?: string;
  isExpired?: boolean;
  deliveryStatus?: string;
  readStatus?: string;

  // 統計情報
  interactionStats?: {
    viewCount: number;
    clickCount: number;
    shareCount: number;
    lastInteraction?: Date;
  };

  // カウント情報
  _count?: {
    recipients: number;
    deliveries: number;
    failures: number;
  };
}

export interface NotificationListResponse extends ApiListResponse<NotificationResponseDTO> {
  summary?: {
    totalNotifications: number;
    unreadNotifications: number;
    priorityBreakdown: Record<NotificationPriority, number>;
    typeBreakdown: Record<NotificationType, number>;
    recentActivity: number;
  };

  statistics?: NotificationStatistics;

  // チャネル集計
  channelSummary?: Record<NotificationChannel, {
    count: number;
    deliveryRate: number;
    readRate: number;
  }>;

  // 優先度分析
  priorityAnalysis?: {
    criticalPending: number;
    averageResponseTime: Record<NotificationPriority, number>;
    escalationNeeded: NotificationResponseDTO[];
  };
}

export interface NotificationCreateDTO extends Omit<NotificationCreateInput, 'id' | 'createdAt' | 'updatedAt'> {
  // 拡張フィールド
  details?: NotificationDetails;

  // 配信オプション
  scheduleOptions?: {
    sendImmediately?: boolean;
    scheduledAt?: Date;
    timezone?: string;
    respectQuietHours?: boolean;
  };

  // ターゲティングオプション
  audienceOptions?: {
    useUserPreferences?: boolean;
    respectChannelPreferences?: boolean;
    fallbackChannels?: NotificationChannel[];
  };
}

export interface NotificationUpdateDTO extends Partial<Omit<NotificationCreateDTO, 'userId'>> {
  // ステータス更新
  statusUpdate?: {
    status: NotificationStatus;
    readAt?: Date;
    interactionType?: 'VIEW' | 'CLICK' | 'SHARE' | 'DISMISS';
    metadata?: Record<string, any>;
  };

  // 再送オプション
  resendOptions?: {
    channels?: NotificationChannel[];
    newRecipients?: string[];
    updateContent?: boolean;
  };
}

export interface NotificationBulkCreateDTO {
  notifications: NotificationCreateDTO[];
  batchOptions?: {
    validateAll?: boolean;
    respectRateLimits?: boolean;
    groupSimilar?: boolean;
    maxBatchSize?: number;
  };
}

// =====================================
// 📋 10. Service層インターフェース（既存保持）
// =====================================

export interface INotificationService {
  // CRUD操作
  create(data: NotificationCreateInput, options?: any): Promise<NotificationModel>;
  findById(id: string): Promise<NotificationResponseDTO | null>;
  findMany(filter: NotificationFilter): Promise<NotificationListResponse>;
  update(id: string, data: NotificationUpdateInput): Promise<NotificationModel>;
  delete(id: string): Promise<void>;

  // 通知配信
  send(notificationId: string): Promise<void>;
  sendBulk(notificationIds: string[]): Promise<BulkOperationResult>;

  // ユーザー操作
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<number>;

  // 統計・分析
  getStatistics(filter?: NotificationFilter): Promise<NotificationStatistics>;

  // 設定管理
  updateUserSettings(userId: string, settings: Partial<NotificationSettings>): Promise<NotificationSettings>;

  // テンプレート管理
  createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate>;

  // 一括操作
  bulkCreate(data: NotificationBulkCreateDTO): Promise<BulkOperationResult>;

  // バリデーション
  validateNotification(data: NotificationCreateInput): Promise<NotificationValidationResult>;
}

// =====================================
// 📋 11. ヘルパー関数型（既存保持）
// =====================================

export type NotificationFilterBuilder = (base: NotificationWhereInput) => NotificationWhereInput;
export type NotificationTransformer = (notification: NotificationModel) => NotificationResponseDTO;
export type NotificationValidator = (data: NotificationCreateInput) => Promise<NotificationValidationResult>;

// =====================================
// エクスポート完全性チェック
// =====================================

/**
 * このファイルからエクスポートされるすべての型：
 *
 * ✅ Enum: NotificationType, NotificationChannel, NotificationPriority, NotificationStatus
 * ✅ 基本型: NotificationModel, NotificationCreateInput, NotificationUpdateInput
 * ✅ フィルタ: NotificationWhereInput, NotificationWhereUniqueInput, NotificationOrderByInput
 * ✅ 詳細: NotificationDetails
 * ✅ 統計: NotificationStatistics
 * ✅ 検索: NotificationFilter
 * ✅ 設定: NotificationSettings
 * ✅ テンプレート: NotificationTemplate
 * ✅ バリデーション: NotificationValidationResult
 * ✅ DTO: NotificationResponseDTO, NotificationListResponse, NotificationCreateDTO, NotificationUpdateDTO
 * ✅ 一括: NotificationBulkCreateDTO
 * ✅ Service: INotificationService
 * ✅ ヘルパー: NotificationFilterBuilder, NotificationTransformer, NotificationValidator
 */
