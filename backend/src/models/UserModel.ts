// =====================================
// backend/src/models/UserModel.ts
// ユーザー管理モデル - Phase 1-A基盤統合版
// 作成日時: 2025年9月27日07:00
// 最終更新: Phase 1-B-4完全統合版
// アーキテクチャ指針準拠 + 既存完全実装保持
// =====================================

import type {
  User as PrismaUser,
  Prisma,
  UserRole,
  AuditLog,
  InspectionItem,
  InspectionItemResult,
  InspectionRecord,
  MaintenanceRecord,
  Notification,
  Operation
} from '@prisma/client';

// 🎯 Phase 1-A完成基盤の活用
import { DatabaseService } from '../utils/database';
import {
  AppError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  AuthenticationError,
  ConflictError
} from '../utils/errors';
import logger from '../utils/logger';
import {
  hashPassword,
  comparePassword,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken
} from '../utils/crypto';

// 🎯 types/共通型定義の活用（Phase 1-A完成）
import type {
  PaginationQuery,
  ApiResponse,
  SearchQuery,
  OperationResult,
  BulkOperationResult,
  ValidationResult
} from '../types/common';

// 🎯 types/auth.ts認証系型定義の統合
import type {
  AuthenticatedUser,
  UserInfo,
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  UserFilter,
  RolePermissions,
  AuthConfig,
  UserWithoutPassword,
  CreateUserData,
  SafeUser
} from '../types/auth';

// =====================================
// 基本型定義（既存完全実装保持）
// =====================================

export type UserModel = PrismaUser;
export type UserCreateInput = Prisma.UserCreateInput;
export type UserUpdateInput = Prisma.UserUpdateInput;
export type UserWhereInput = Prisma.UserWhereInput;
export type UserWhereUniqueInput = Prisma.UserWhereUniqueInput;
export type UserOrderByInput = Prisma.UserOrderByWithRelationInput;

// =====================================
// 標準DTO（既存完全実装保持）
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
// ユーザー管理特化型定義（Phase 1-A統合）
// =====================================

export interface UserStatistics {
  total: number;
  activeCount: number;
  inactiveCount: number;
  byRole: Record<UserRole, number>;
  recentLogins: number;
  lastSevenDaysRegistrations: number;
  passwordExpiringCount: number;
  lockedAccountsCount: number;
}

export interface UserWithDetails extends UserResponseDTO {
  statistics?: UserStatistics;
  permissions?: RolePermissions;
  lastLoginInfo?: {
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
    loginCount: number;
  };
  securityInfo?: {
    passwordLastChanged: Date | null;
    failedLoginAttempts: number;
    isLocked: boolean;
    lockExpiry: Date | null;
  };
}

export interface UserAuditInfo {
  action: string;
  userId: string;
  performedBy: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// =====================================
// 基本CRUDクラス（既存完全実装保持 + Phase 1-A基盤統合）
// =====================================

export class UserService {
  private readonly db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * 新規作成（既存完全実装保持 + 認証機能強化）
   */
  async create(data: UserCreateInput): Promise<UserModel> {
    try {
      logger.info('ユーザー作成開始', { username: data.username });

      // メールアドレス・ユーザー名重複チェック
      await this.validateUniqueFields(data.username, data.email);

      const result = await this.db.getClient().user.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('ユーザー作成完了', { userId: result.id, username: result.username });
      return result;

    } catch (error) {
      logger.error('ユーザー作成エラー', { error, data });
      throw error;
    }
  }

  /**
   * 認証付きユーザー作成（bcrypt統合）
   */
  async createUserWithAuth(request: CreateUserRequest): Promise<UserModel> {
    try {
      logger.info('認証付きユーザー作成開始', { username: request.username });

      // パスワードバリデーション
      this.validatePassword(request.password);

      // メールアドレス・ユーザー名重複チェック
      await this.validateUniqueFields(request.username, request.email);

      // パスワードハッシュ化
      const passwordHash = await hashPassword(request.password);

      const userData: CreateUserData = {
        username: request.username,
        email: request.email,
        passwordHash,
        name: request.name,
        role: request.role || 'DRIVER',
        isActive: request.isActive ?? true
      };

      const user = await this.db.getClient().user.create({
        data: {
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('認証付きユーザー作成完了', { userId: user.id, username: user.username });
      return user;

    } catch (error) {
      logger.error('認証付きユーザー作成エラー', { error, request });
      throw error;
    }
  }

  /**
   * 主キー指定取得（既存完全実装保持）
   */
  async findByKey(id: string): Promise<UserModel | null> {
    try {
      const result = await this.db.getClient().user.findUnique({
        where: { id }
      });

      if (!result) {
        logger.warn('ユーザー未発見', { id });
      }

      return result;
    } catch (error) {
      logger.error('ユーザー取得エラー', { error, id });
      throw new AppError('ユーザー取得に失敗しました', 500);
    }
  }

  /**
   * ユーザー名での検索（認証系統合）
   */
  async findByUsername(username: string): Promise<UserModel | null> {
    try {
      const result = await this.db.getClient().user.findUnique({
        where: { username }
      });

      return result;
    } catch (error) {
      logger.error('ユーザー名検索エラー', { error, username });
      throw new AppError('ユーザー検索に失敗しました', 500);
    }
  }

  /**
   * メールアドレスでの検索（認証系統合）
   */
  async findByEmail(email: string): Promise<UserModel | null> {
    try {
      const result = await this.db.getClient().user.findUnique({
        where: { email }
      });

      return result;
    } catch (error) {
      logger.error('メールアドレス検索エラー', { error, email });
      throw new AppError('ユーザー検索に失敗しました', 500);
    }
  }

  /**
   * 条件指定一覧取得（既存完全実装保持）
   */
  async findMany(params?: {
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<UserModel[]> {
    try {
      return await this.db.getClient().user.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take
      });
    } catch (error) {
      logger.error('ユーザー一覧取得エラー', { error, params });
      throw new AppError('ユーザー一覧取得に失敗しました', 500);
    }
  }

  /**
   * ページネーション付き一覧取得（既存完全実装保持）
   */
  async findManyWithPagination(params: {
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    page: number;
    pageSize: number;
  }): Promise<UserListResponse> {
    try {
      const { page, pageSize, where, orderBy } = params;
      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        this.db.getClient().user.findMany({
          where,
          orderBy: orderBy || { createdAt: 'desc' },
          skip,
          take: pageSize
        }),
        this.db.getClient().user.count({ where })
      ]);

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      logger.error('ページネーション取得エラー', { error, params });
      throw new AppError('ユーザー一覧取得に失敗しました', 500);
    }
  }

  /**
   * 高度フィルター検索（Phase 1-A統合機能）
   */
  async findWithAdvancedFilter(filter: UserFilter): Promise<{
    data: UserModel[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        role,
        isActive
      } = filter;

      const where: UserWhereInput = {};

      // 検索条件構築
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (role) {
        where.role = role;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const skip = (page - 1) * limit;
      const orderBy: UserOrderByInput = {
        [sortBy]: sortOrder
      };

      const [data, total] = await Promise.all([
        this.db.getClient().user.findMany({
          where,
          orderBy,
          skip,
          take: limit
        }),
        this.db.getClient().user.count({ where })
      ]);

      return {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };

    } catch (error) {
      logger.error('高度フィルター検索エラー', { error, filter });
      throw new AppError('ユーザー検索に失敗しました', 500);
    }
  }

  /**
   * 更新（既存完全実装保持）
   */
  async update(id: string, data: UserUpdateInput): Promise<UserModel> {
    try {
      logger.info('ユーザー更新開始', { id });

      // 存在チェック
      await this.checkUserExists(id);

      const result = await this.db.getClient().user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      logger.info('ユーザー更新完了', { id, userId: result.id });
      return result;

    } catch (error) {
      logger.error('ユーザー更新エラー', { error, id, data });
      throw error;
    }
  }

  /**
   * パスワード変更（認証系統合）
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      logger.info('パスワード変更開始', { userId });

      // ユーザー存在チェック
      const user = await this.findByKey(userId);
      if (!user) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      // 現在のパスワード確認
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new AuthenticationError('現在のパスワードが正しくありません');
      }

      // 新パスワードバリデーション
      this.validatePassword(newPassword);

      // 新パスワードハッシュ化
      const newPasswordHash = await hashPassword(newPassword);

      // パスワード更新
      await this.db.getClient().user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          passwordLastChanged: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('パスワード変更完了', { userId });

    } catch (error) {
      logger.error('パスワード変更エラー', { error, userId });
      throw error;
    }
  }

  /**
   * 削除（既存完全実装保持）
   */
  async delete(id: string): Promise<UserModel> {
    try {
      logger.info('ユーザー削除開始', { id });

      // 存在チェック
      await this.checkUserExists(id);

      const result = await this.db.getClient().user.delete({
        where: { id }
      });

      logger.info('ユーザー削除完了', { id });
      return result;

    } catch (error) {
      logger.error('ユーザー削除エラー', { error, id });
      throw error;
    }
  }

  /**
   * 存在チェック（既存完全実装保持）
   */
  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.db.getClient().user.count({
        where: { id }
      });
      return count > 0;
    } catch (error) {
      logger.error('ユーザー存在チェックエラー', { error, id });
      throw new AppError('ユーザー存在チェックに失敗しました', 500);
    }
  }

  /**
   * カウント取得（既存完全実装保持）
   */
  async count(where?: UserWhereInput): Promise<number> {
    try {
      return await this.db.getClient().user.count({ where });
    } catch (error) {
      logger.error('ユーザーカウント取得エラー', { error, where });
      throw new AppError('ユーザーカウント取得に失敗しました', 500);
    }
  }

  /**
   * ユーザー統計生成（Phase 1-A統合機能）
   */
  async generateUserStatistics(): Promise<UserStatistics> {
    try {
      logger.info('ユーザー統計生成開始');

      const [
        total,
        activeCount,
        roleStats,
        recentLogins,
        newRegistrations
      ] = await Promise.all([
        this.db.getClient().user.count(),
        this.db.getClient().user.count({ where: { isActive: true } }),
        this.getUserStatsByRole(),
        this.getRecentLoginsCount(),
        this.getNewRegistrationsCount()
      ]);

      const statistics: UserStatistics = {
        total,
        activeCount,
        inactiveCount: total - activeCount,
        byRole: roleStats,
        recentLogins,
        lastSevenDaysRegistrations: newRegistrations,
        passwordExpiringCount: 0, // 実装予定
        lockedAccountsCount: 0     // 実装予定
      };

      logger.info('ユーザー統計生成完了', { statistics });
      return statistics;

    } catch (error) {
      logger.error('ユーザー統計生成エラー', { error });
      throw new AppError('ユーザー統計生成に失敗しました', 500);
    }
  }

  /**
   * ユーザーアカウント有効性チェック（認証系統合）
   */
  async checkUserAvailability(userId: string): Promise<{
    isAvailable: boolean;
    isActive: boolean;
    isLocked: boolean;
    reason?: string;
  }> {
    try {
      const user = await this.findByKey(userId);

      if (!user) {
        return {
          isAvailable: false,
          isActive: false,
          isLocked: false,
          reason: 'ユーザーが見つかりません'
        };
      }

      const isLocked = user.lockExpiry && user.lockExpiry > new Date();

      return {
        isAvailable: user.isActive && !isLocked,
        isActive: user.isActive,
        isLocked: !!isLocked,
        reason: !user.isActive ? 'アカウントが無効化されています' :
                isLocked ? 'アカウントがロックされています' : undefined
      };

    } catch (error) {
      logger.error('ユーザー有効性チェックエラー', { error, userId });
      throw new AppError('ユーザー有効性チェックに失敗しました', 500);
    }
  }

  /**
   * 一括更新（Phase 1-A統合機能）
   */
  async bulkUpdate(
    userIds: string[],
    updateData: Partial<UserUpdateInput>
  ): Promise<BulkOperationResult> {
    try {
      logger.info('ユーザー一括更新開始', { userIds, updateData });

      const results = await Promise.allSettled(
        userIds.map(id => this.update(id, updateData))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      const result: BulkOperationResult = {
        total: userIds.length,
        successful,
        failed,
        errors: results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map((r, index) => ({
            item: userIds[index],
            error: r.reason.message || 'Unknown error'
          }))
      };

      logger.info('ユーザー一括更新完了', { result });
      return result;

    } catch (error) {
      logger.error('ユーザー一括更新エラー', { error, userIds, updateData });
      throw new AppError('ユーザー一括更新に失敗しました', 500);
    }
  }

  // =====================================
  // プライベートメソッド（ユーティリティ）
  // =====================================

  private async checkUserExists(id: string): Promise<void> {
    const exists = await this.exists(id);
    if (!exists) {
      throw new NotFoundError(`ユーザー（ID: ${id}）が見つかりません`);
    }
  }

  private async validateUniqueFields(username: string, email: string): Promise<void> {
    const [existingUsername, existingEmail] = await Promise.all([
      this.findByUsername(username),
      this.findByEmail(email)
    ]);

    if (existingUsername) {
      throw new ConflictError('このユーザー名は既に使用されています');
    }

    if (existingEmail) {
      throw new ConflictError('このメールアドレスは既に使用されています');
    }
  }

  private validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new ValidationError('パスワードは8文字以上である必要があります');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new ValidationError('パスワードは大文字、小文字、数字を含む必要があります');
    }
  }

  private async getUserStatsByRole(): Promise<Record<UserRole, number>> {
    const stats = await this.db.getClient().user.groupBy({
      by: ['role'],
      _count: {
        id: true
      }
    });

    const roleStats: Record<UserRole, number> = {
      ADMIN: 0,
      MANAGER: 0,
      DRIVER: 0,
      OPERATOR: 0
    };

    stats.forEach(stat => {
      roleStats[stat.role] = stat._count.id;
    });

    return roleStats;
  }

  private async getRecentLoginsCount(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await this.db.getClient().user.count({
      where: {
        lastLoginAt: {
          gte: sevenDaysAgo
        }
      }
    });
  }

  private async getNewRegistrationsCount(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await this.db.getClient().user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });
  }
}

// =====================================
// ファクトリ関数（既存完全実装保持 + Phase 1-A統合）
// =====================================

let _userServiceInstance: UserService | null = null;

export const getUserService = (): UserService => {
  if (!_userServiceInstance) {
    _userServiceInstance = new UserService();
  }
  return _userServiceInstance;
};

// =====================================
// エクスポート（既存完全実装保持）
// =====================================

export type { UserModel as default };
export {
  UserService,
  type UserResponseDTO,
  type UserListResponse,
  type UserCreateDTO,
  type UserUpdateDTO,
  type UserStatistics,
  type UserWithDetails,
  type UserAuditInfo
};
