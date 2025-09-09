import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest,
  UserRole,
  PaginationParams, 
  PaginatedResponse,
  PaginationQuery
} from '../types';
import { 
  NotFoundError, 
  DuplicateError, 
  ValidationError, 
  BusinessLogicError,
  AppError
} from '../utils/asyncHandler';
import { APP_CONSTANTS } from '../utils/constants';
import { logger } from '../middleware/logger';
import { hashPassword } from '../utils/crypto';

const prisma = new PrismaClient();

/**
 * ユーザーサービスクラス
 */
export class UserService {
  /**
   * ユーザー一覧取得（ページング対応）
   */
  async getAllUsers(params: PaginationParams & {
    searchQuery?: string;
    role?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<User>> {
    const { 
      page = 1, 
      limit = APP_CONSTANTS.DEFAULT_PAGE_SIZE, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      searchQuery,
      role,
      isActive
    } = params;

    try {
      // 検索条件を構築
      const where: any = {};

      if (searchQuery) {
        where.OR = [
          { username: { contains: searchQuery, mode: 'insensitive' } },
          { email: { contains: searchQuery, mode: 'insensitive' } },
          { name: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      if (role) {
        where.role = role;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // ソート条件を構築
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      // 総件数を取得
      const totalItems = await prisma.user.count({ where });

      // データを取得
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          userfirstName: true, lastName: true,
          email: true,
          firstName: true, lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      });

      const totalPages = Math.ceil(totalItems / limit);

      return {
        data: users,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
        },
      };

    } catch (error) {
      logger.error('ユーザー一覧取得エラー', error, { params });
      throw error;
    }
  }

  /**
   * ユーザー詳細取得
   */
  async getUserById(id: string, requesterId?: string, requesterRole?: UserRole): Promise<User> {
    try {
      // 権限チェック：運転手は自分の情報のみアクセス可能
      if (requesterRole === UserRole.DRIVER && requesterId && id !== requesterId) {
        throw new AppError('このユーザー情報にアクセスする権限がありません', 403);
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          userfirstName: true, lastName: true,
          email: true,
          firstName: true, lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          lockedUntil: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      return user;

    } catch (error) {
      logger.error('ユーザー詳細取得エラー', error, { userId: id });
      throw error;
    }
  }

  /**
   * ユーザー作成
   */
  async createUser(userData: CreateUserRequest, creatorId?: string): Promise<User> {
    const { username, email, password, name, role, isActive = true } = userData;

    try {
      // 重複チェック
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username },
            { email },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.username === username) {
          throw new DuplicateError('ユーザー名');
        }
        if (existingUser.email === email) {
          throw new DuplicateError('メールアドレス');
        }
      }

      // パスワードをハッシュ化
      const hashedPassword = await hashPassword(password);

      // ユーザーを作成
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          name,
          role,
          isActive,
        },
        select: {
          id: true,
          userfirstName: true, lastName: true,
          email: true,
          firstName: true, lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('ユーザー作成成功', { userId: newUser.id, username, creatorId });

      return newUser;

    } catch (error) {
      logger.error('ユーザー作成エラー', error, { username, email });
      throw error;
    }
  }

  /**
   * ユーザー更新
   */
  async updateUser(
    id: string, 
    updateData: UpdateUserRequest, 
    requesterId?: string, 
    requesterRole?: UserRole
  ): Promise<User> {
    try {
      // 権限チェック：運転手は自分の情報のみ更新可能（ただし権限は変更不可）
      if (requesterRole === UserRole.DRIVER && requesterId && id !== requesterId) {
        throw new AppError('このユーザー情報を更新する権限がありません', 403);
      }

      // 運転手は自分の権限やアクティブ状態を変更できない
      if (requesterRole === UserRole.DRIVER) {
        if (updateData.role || typeof updateData.isActive === 'boolean') {
          throw new AppError('権限やアクティブ状態は変更できません', 403);
        }
      }

      // ユーザーの存在確認
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, userfirstName: true, lastName: true, email: true },
      });

      if (!existingUser) {
        throw new NotFoundError('ユーザー');
      }

      // メールアドレスの重複チェック
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email: updateData.email,
            NOT: { id },
          },
        });

        if (emailExists) {
          throw new DuplicateError('メールアドレス');
        }
      }

      // ユーザー名の重複チェック
      if (updateData.username && updateData.username !== existingUser.username) {
        const usernameExists = await prisma.user.findFirst({
          where: {
            username: updateData.username,
            NOT: { id },
          },
        });

        if (usernameExists) {
          throw new DuplicateError('ユーザー名');
        }
      }

      // データを更新
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          userfirstName: true, lastName: true,
          email: true,
          firstName: true, lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('ユーザー更新成功', { userId: id, requesterId });

      return updatedUser;

    } catch (error) {
      logger.error('ユーザー更新エラー', error, { userId: id });
      throw error;
    }
  }

  /**
   * ユーザー削除（論理削除）
   */
  async deleteUser(id: string, requesterId: string): Promise<void> {
    try {
      // 自分自身は削除できない
      if (id === requesterId) {
        throw new AppError('自分自身を削除することはできません', 400);
      }

      // ユーザーの存在確認
      const user = await prisma.user.findUnique({
        where: { id },
        select: { 
          id: true, 
          userfirstName: true, lastName: true,
          trips: { select: { id: true } },
        },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      // 運行記録が存在する場合は物理削除を禁止
      if (user.trips.length > 0) {
        // アクティブフラグを false に設定（論理削除）
        await prisma.user.update({
          where: { id },
          data: { isActive: false },
        });

        logger.info('ユーザー論理削除成功', { userId: id });
      } else {
        // 運行記録がない場合は物理削除可能
        await prisma.user.delete({
          where: { id },
        });

        logger.info('ユーザー物理削除成功', { userId: id });
      }

      // セッションを削除
      await prisma.userSession.deleteMany({
        where: { userId: id },
      });

      // リフレッシュトークンも削除
      await prisma.refreshToken.deleteMany({
        where: { userId: id },
      });

    } catch (error) {
      logger.error('ユーザー削除エラー', error, { userId: id });
      throw error;
    }
  }

  /**
   * ユーザーのパスワードリセット
   */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, userfirstName: true, lastName: true },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      // パスワードをハッシュ化
      const hashedPassword = await hashPassword(newPassword);

      // パスワードを更新
      await prisma.user.update({
        where: { id },
        data: {
          password: hashedPassword,
          lockedUntil: null, // ロック状態を解除
        },
      });

      // セキュリティのため、全セッションを無効化
      await prisma.userSession.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });

      // リフレッシュトークンも無効化
      await prisma.refreshToken.updateMany({
        where: { userId: id },
        data: { isRevoked: true },
      });

      logger.info('パスワードリセット成功', { userId: id });

    } catch (error) {
      logger.error('パスワードリセットエラー', error, { userId: id });
      throw error;
    }
  }

  /**
   * ユーザーアカウントのロック/アンロック
   */
  async toggleUserLock(id: string, lock: boolean): Promise<User> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, userfirstName: true, lastName: true, lockedUntil: true },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      const updateData: any = {
      };

      if (lock) {
        // アカウントをロック（1年間）
        updateData.lockedUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      } else {
        // ロックを解除
        updateData.lockedUntil = null;
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          userfirstName: true, lastName: true,
          email: true,
          firstName: true, lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          lockedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // ロック時は全セッションを削除
      if (lock) {
        await prisma.userSession.updateMany({
          where: { userId: id },
          data: { isActive: false },
        });

        await prisma.refreshToken.updateMany({
          where: { userId: id },
          data: { isRevoked: true },
        });
      }

      logger.info(`ユーザーアカウント${lock ? 'ロック' : 'アンロック'}成功`, { userId: id });

      return updatedUser;

    } catch (error) {
      logger.error(`ユーザーアカウント${lock ? 'ロック' : 'アンロック'}エラー`, error, { userId: id });
      throw error;
    }
  }

  /**
   * ユーザー統計情報取得
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    lockedUsers: number;
    recentUsers: number;
    usersByRole: { [key: string]: number };
  }> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 基本統計
      const [totalUsers, activeUsers, lockedUsers, recentUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ 
          where: { 
            lockedUntil: { 
              gt: now 
            } 
          } 
        }),
        prisma.user.count({ 
          where: { 
            createdAt: { 
              gte: oneDayAgo 
            } 
          } 
        }),
      ]);

      // ロール別統計
      const usersByRoleResult = await prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true,
        },
        where: {
          isActive: true,
        },
      });

      const usersByRole: { [key: string]: number } = {};
      usersByRoleResult.forEach(item => {
        usersByRole[item.role] = item._count.id;
      });

      return {
        totalUsers,
        activeUsers,
        lockedUsers,
        recentUsers,
        usersByRole,
      };

    } catch (error) {
      logger.error('ユーザー統計取得エラー', error);
      throw error;
    }
  }

  /**
   * ユーザーの運行記録統計取得
   */
  async getUserTripStats(id: string, startDate?: string, endDate?: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      if (user.role !== UserRole.DRIVER) {
        return {
          totalTrips: 0,
          completedTrips: 0,
          totalDistance: 0,
          totalHours: 0,
          averageDistance: 0,
          recentActivity: null,
          fuelEfficiency: 0,
          completionRate: '0',
        };
      }

      const whereCondition: any = { driverId: id };

      if (startDate || endDate) {
        whereCondition.startTime = {};
        if (startDate) whereCondition.startTime.gte = new Date(startDate);
        if (endDate) whereCondition.startTime.lte = new Date(endDate);
      }

      const [
        totalTrips,
        completedTrips,
        totalDistance,
        totalFuelAmount,
        averageTripDistance,
        recentTrip
      ] = await Promise.all([
        // 総運行回数
        prisma.trip.count({
          where: whereCondition
        }),
        
        // 完了した運行回数
        prisma.trip.count({
          where: { ...whereCondition, status: 'COMPLETED' }
        }),
        
        // 総走行距離
        prisma.trip.aggregate({
          where: { ...whereCondition, status: 'COMPLETED' },
          _sum: { totalDistance: true }
        }).then(result => result._sum.totalDistance || 0),
        
        // 総給油量
        prisma.fuelRecord.aggregate({
          where: {
            trip: whereCondition
          },
          _sum: { amount: true }
        }).then(result => result._sum.amount || 0),
        
        // 平均運行距離
        prisma.trip.aggregate({
          where: { ...whereCondition, status: 'COMPLETED' },
          _avg: { totalDistance: true }
        }).then(result => result._avg.totalDistance || 0),

        // 最新の運行記録
        prisma.trip.findFirst({
          where: whereCondition,
          orderBy: { startTime: 'desc' },
          select: { startTime: true }
        })
      ]);

      // 燃費計算
      const fuelEfficiency = totalFuelAmount > 0 ? Number(totalDistance) / Number(totalFuelAmount) : 0;

      // 総運行時間は実際の運行データから計算する必要があるが、
      // 簡易実装として操作回数 * 平均時間で概算
      const totalHours = completedTrips * 8; // 1運行あたり平均8時間と仮定

      return {
        totalTrips,
        completedTrips,
        totalDistance: Number(totalDistance.toFixed(2)),
        totalFuelAmount: Number(totalFuelAmount.toFixed(2)),
        averageDistance: Number(averageTripDistance.toFixed(2)),
        totalHours,
        fuelEfficiency: Number(fuelEfficiency.toFixed(2)),
        completionRate: totalTrips > 0 ? ((completedTrips / totalTrips) * 100).toFixed(1) : '0',
        recentActivity: recentTrip?.startTime || null,
      };

    } catch (error) {
      logger.error('ユーザー運行統計取得エラー', error, { userId: id });
      throw error;
    }
  }

  /**
   * アクティブなドライバー一覧取得
   */
  async getActiveDrivers(): Promise<User[]> {
    try {
      const drivers = await prisma.user.findMany({
        where: {
          role: UserRole.DRIVER,
          isActive: true,
        },
        select: {
          id: true,
          userfirstName: true, lastName: true,
          email: true,
          firstName: true, lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return drivers;

    } catch (error) {
      logger.error('アクティブドライバー取得エラー', error);
      throw error;
    }
  }

  /**
   * ユーザーのログイン履歴取得
   */
  async getUserLoginHistory(id: string, limit: number = 10): Promise<any[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      // 監査ログからログイン情報を取得
      const loginHistory = await prisma.auditLog.findMany({
        where: {
          userId: id,
          action: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] },
        },
        select: {
          action: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return loginHistory;

    } catch (error) {
      logger.error('ユーザーログイン履歴取得エラー', error, { userId: id });
      throw error;
    }
  }

  /**
   * ユーザー名またはメールでユーザー検索
   */
  async findUserByUsernameOrEmail(identifier: string): Promise<User | null> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: identifier },
            { email: identifier },
          ],
          isActive: true,
        },
        select: {
          id: true,
          userfirstName: true, lastName: true,
          email: true,
          firstName: true, lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;

    } catch (error) {
      logger.error('ユーザー検索エラー', error, { identifier });
      throw error;
    }
  }

  /**
   * ユーザー検索（オートコンプリート用）
   */
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      return await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          userfirstName: true, lastName: true,
          firstName: true, lastName: true,
          email: true,
          role: true,
        },
        take: limit,
        orderBy: {
          name: 'asc'
        }
      });

    } catch (error) {
      logger.error('ユーザー検索エラー', error, { query });
      throw error;
    }
  }

  /**
   * ユーザーロール変更
   */
  async changeUserRole(userId: string, newRole: UserRole, requesterId: string): Promise<User> {
    try {
      // 自分自身のロールは変更できない
      if (userId === requesterId) {
        throw new AppError('自分自身の権限は変更できません', 400);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
        select: {
          id: true,
          userfirstName: true, lastName: true,
          email: true,
          firstName: true, lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      // ロール変更により既存のセッションを無効化
      await prisma.userSession.updateMany({
        where: { userId },
        data: { isActive: false }
      });

      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true }
      });

      logger.info('ユーザーロール変更成功', { userId, newRole, requesterId });

      return updatedUser;

    } catch (error) {
      logger.error('ユーザーロール変更エラー', error, { userId, newRole });
      throw error;
    }
  }
}

// デフォルトエクスポート
export const userService = new UserService();