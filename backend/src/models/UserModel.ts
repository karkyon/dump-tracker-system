// =====================================
// backend/src/models/UserModel.ts
// ユーザー管理モデル - エラー0件完全達成版
// =====================================

import type {
  User as PrismaUser,
  Prisma,
  UserRole
} from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

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
  comparePassword
} from '../utils/crypto';

import type {
  PaginationQuery,
  OperationResult
} from '../types/common';

import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserFilter,
  RolePermissions,
  CreateUserData
} from '../types/auth';

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

export interface UserCreateDTO extends Omit<UserCreateInput, 'id' | 'createdAt' | 'updatedAt'> {}

export interface UserUpdateDTO extends Partial<UserCreateDTO> {}

// =====================================
// 拡張型定義
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
// UserServiceクラス
// =====================================

class UserService {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = DatabaseService.getInstance();
  }

  async create(data: UserCreateInput): Promise<UserModel> {
    try {
      logger.info('ユーザー作成開始', { username: data.username });
      await this.validateUniqueFields(data.username, data.email);

      const result = await this.prisma.user.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('ユーザー作成完了', { userId: result.id });
      return result;
    } catch (error) {
      logger.error('ユーザー作成エラー', { error, data });
      throw error;
    }
  }

  async createUserWithAuth(request: CreateUserRequest): Promise<UserModel> {
    try {
      logger.info('認証付きユーザー作成開始', { username: request.username });

      this.validatePassword(request.password);
      await this.validateUniqueFields(request.username, request.email);

      const passwordHash = await hashPassword(request.password);

      // ✅ undefined の場合のデフォルト値を明示的に設定
      const result = await this.prisma.user.create({
        data: {
          username: request.username,
          email: request.email,
          passwordHash,
          name: request.name || '',  // ✅ undefined対策
          role: request.role || 'DRIVER',
          isActive: request.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('認証付きユーザー作成完了', { userId: result.id });
      return result;
    } catch (error) {
      logger.error('認証付きユーザー作成エラー', { error });
      throw error;
    }
  }

  async findByKey(id: string): Promise<UserModel | null> {
    try {
      const result = await this.prisma.user.findUnique({
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

  async findByUsername(username: string): Promise<UserModel | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { username }
      });
    } catch (error) {
      logger.error('ユーザー名検索エラー', { error, username });
      throw new AppError('ユーザー検索に失敗しました', 500);
    }
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email }
      });
    } catch (error) {
      logger.error('メールアドレス検索エラー', { error, email });
      throw new AppError('ユーザー検索に失敗しました', 500);
    }
  }

  async findMany(params?: {
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<UserModel[]> {
    try {
      return await this.prisma.user.findMany({
        where: params?.where,
        orderBy: params?.orderBy || { createdAt: 'desc' },
        skip: params?.skip,
        take: params?.take
      });
    } catch (error) {
      logger.error('ユーザー一覧取得エラー', { error });
      throw new AppError('ユーザー一覧取得に失敗しました', 500);
    }
  }

  async findManyWithPagination(params: {
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    page?: number;
    limit?: number;
  }): Promise<UserListResponse> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.user.findMany({
          where: params.where,
          orderBy: params.orderBy || { createdAt: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.user.count({ where: params.where })
      ]);

      return {
        data,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('ページネーション取得エラー', { error });
      throw new AppError('ユーザー一覧取得に失敗しました', 500);
    }
  }

  async searchUsers(filter: UserFilter): Promise<UserListResponse> {
    try {
      const {
        search,
        role,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = filter;

      const where: UserWhereInput = {
        ...(search && {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } }
          ]
        }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive })
      };

      const skip = (page - 1) * limit;
      const orderBy: UserOrderByInput = {
        [sortBy]: sortOrder
      };

      const [data, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          orderBy,
          skip,
          take: limit
        }),
        this.prisma.user.count({ where })
      ]);

      return {
        data,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('検索エラー', { error });
      throw new AppError('ユーザー検索に失敗しました', 500);
    }
  }

  async update(id: string, data: UserUpdateInput): Promise<UserModel> {
    try {
      logger.info('ユーザー更新開始', { id });
      await this.checkUserExists(id);

      const result = await this.prisma.user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      logger.info('ユーザー更新完了', { id });
      return result;
    } catch (error) {
      logger.error('ユーザー更新エラー', { error, id });
      throw error;
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      logger.info('パスワード変更開始', { userId });

      const user = await this.findByKey(userId);
      if (!user) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      const isValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new AuthenticationError('現在のパスワードが正しくありません');
      }

      this.validatePassword(newPassword);
      const newPasswordHash = await hashPassword(newPassword);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('パスワード変更完了', { userId });
    } catch (error) {
      logger.error('パスワード変更エラー', { error, userId });
      throw error;
    }
  }

  async delete(id: string): Promise<UserModel> {
    try {
      logger.info('ユーザー削除開始', { id });
      await this.checkUserExists(id);

      const result = await this.prisma.user.delete({
        where: { id }
      });

      logger.info('ユーザー削除完了', { id });
      return result;
    } catch (error) {
      logger.error('ユーザー削除エラー', { error, id });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.user.count({
        where: { id }
      });
      return count > 0;
    } catch (error) {
      logger.error('存在チェックエラー', { error, id });
      throw new AppError('ユーザー存在チェックに失敗しました', 500);
    }
  }

  async count(where?: UserWhereInput): Promise<number> {
    try {
      return await this.prisma.user.count({ where });
    } catch (error) {
      logger.error('カウントエラー', { error });
      throw new AppError('ユーザーカウントに失敗しました', 500);
    }
  }

  async getUserStatistics(): Promise<UserStatistics> {
    try {
      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        roleStats,
        recentLogins,
        newRegistrations
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { isActive: false } }),
        this.getUserStatsByRole(),
        this.getRecentLoginsCount(),
        this.getNewRegistrationsCount()
      ]);

      return {
        total: totalUsers,
        activeCount: activeUsers,
        inactiveCount: inactiveUsers,
        byRole: roleStats,
        recentLogins,
        lastSevenDaysRegistrations: newRegistrations,
        passwordExpiringCount: 0,
        lockedAccountsCount: inactiveUsers
      };
    } catch (error) {
      logger.error('統計取得エラー', { error });
      throw new AppError('ユーザー統計取得に失敗しました', 500);
    }
  }

  async getUserWithDetails(id: string): Promise<UserWithDetails | null> {
    try {
      const user = await this.findByKey(id);
      if (!user) {
        return null;
      }

      const statistics = await this.getUserStatistics();

      return {
        ...user,
        statistics,
        lastLoginInfo: {
          lastLoginAt: user.lastLoginAt,
          lastLoginIp: null,
          loginCount: 0
        },
        securityInfo: {
          passwordLastChanged: user.passwordChangedAt,
          failedLoginAttempts: 0,
          isLocked: !(user.isActive ?? true),
          lockExpiry: null
        },
        permissions: {
          canViewUsers: user.role === 'ADMIN',
          canCreateUsers: user.role === 'ADMIN',
          canUpdateUsers: user.role === 'ADMIN',
          canDeleteUsers: user.role === 'ADMIN',
          canViewVehicles: true,
          canCreateVehicles: user.role === 'ADMIN' || user.role === 'MANAGER',
          canUpdateVehicles: user.role === 'ADMIN' || user.role === 'MANAGER',
          canDeleteVehicles: user.role === 'ADMIN',
          canViewOperations: true,
          canCreateOperations: user.role !== 'DRIVER',
          canUpdateOperations: user.role !== 'DRIVER',
          canDeleteOperations: user.role === 'ADMIN',
          canViewReports: true,
          canExportReports: user.role !== 'DRIVER',
          canViewSystemSettings: user.role === 'ADMIN',
          canUpdateSystemSettings: user.role === 'ADMIN',
          canViewAuditLogs: user.role === 'ADMIN'
        }
      };
    } catch (error) {
      logger.error('詳細取得エラー', { error, id });
      throw new AppError('ユーザー詳細取得に失敗しました', 500);
    }
  }

  private async checkUserExists(id: string): Promise<void> {
    const exists = await this.exists(id);
    if (!exists) {
      throw new NotFoundError('ユーザーが見つかりません');
    }
  }

  async validateUniqueFields(username: string, email: string): Promise<void> {
    try {
      const byUsername = await this.prisma.user.findUnique({ where: { username } });
      const byEmail = await this.prisma.user.findUnique({ where: { email } });

      if (byUsername) {
        throw new ConflictError('このユーザー名は既に使用されています');
      }
      if (byEmail) {
        throw new ConflictError('このメールアドレスは既に使用されています');
      }
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      logger.error('重複チェックエラー', { error });
      throw new AppError('重複チェックに失敗しました', 500);
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
    const stats = await this.prisma.user.groupBy({
      by: ['role'],
      _count: {
        id: true
      }
    });

    const roleStats: Record<UserRole, number> = {
      ADMIN: 0,
      MANAGER: 0,
      DRIVER: 0
    };

    // ✅ null チェックを追加してインデックスエラーを回避
    for (const stat of stats) {
      if (stat.role !== null) {
        roleStats[stat.role] = stat._count.id;
      }
    }

    return roleStats;
  }

  private async getRecentLoginsCount(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await this.prisma.user.count({
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

    return await this.prisma.user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });
  }
}

// =====================================
// ファクトリ関数
// =====================================

let _userServiceInstance: UserService | null = null;

export const getUserService = (): UserService => {
  if (!_userServiceInstance) {
    _userServiceInstance = new UserService();
  }
  return _userServiceInstance;
};

// =====================================
// エクスポート
// =====================================

export { UserService };
