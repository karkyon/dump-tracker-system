import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { 
  AppError, 
  ValidationError, 
  NotFoundError,
  AuthenticationError
} from '../utils/errors';
import { logger } from '../middleware/logger';

const prisma = new PrismaClient();

// DTOの型定義
interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole | null;
  employeeId?: string | null;
  phone?: string | null;
  isActive: boolean | null;
  lastLoginAt?: Date | null;
  passwordChangedAt?: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  employeeId?: string;
  phone?: string;
  isActive?: boolean;
}

interface UpdateUserRequest {
  username?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  employeeId?: string;
  phone?: string;
  isActive?: boolean;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// 定数
const APP_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
};

// パスワードハッシュ化関数
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 12);
};

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
          username: true,
          email: true,
          name: true,
          role: true,
          employeeId: true,
          phone: true,
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

      // DTOに変換
      const userDTOs: User[] = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        phone: user.phone,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      return {
        data: userDTOs,
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
      if (requesterRole === 'DRIVER' && requesterId && id !== requesterId) {
        throw new AppError('このユーザー情報にアクセスする権限がありません', 403);
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          employeeId: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          passwordChangedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        phone: user.phone,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        passwordChangedAt: user.passwordChangedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

    } catch (error) {
      logger.error('ユーザー詳細取得エラー', error, { userId: id });
      throw error;
    }
  }

  /**
   * ユーザー作成
   */
  async createUser(userData: CreateUserRequest, creatorId?: string): Promise<User> {
    const { username, email, password, name, role, employeeId, phone, isActive = true } = userData;

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
          throw new ValidationError('ユーザー名は既に使用されています');
        }
        if (existingUser.email === email) {
          throw new ValidationError('メールアドレスは既に使用されています');
        }
      }

      // パスワードをハッシュ化
      const hashedPassword = await hashPassword(password);

      // ユーザーを作成
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash: hashedPassword,
          name,
          role: role || 'DRIVER',
          employeeId: employeeId,
          phone,
          isActive: isActive,
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          employeeId: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('ユーザー作成成功', { userId: newUser.id, username, creatorId });

      return {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        employeeId: newUser.employeeId,
        phone: newUser.phone,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      };

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
      if (requesterRole === 'DRIVER' && requesterId && id !== requesterId) {
        throw new AppError('このユーザー情報を更新する権限がありません', 403);
      }

      // 運転手は自分の権限やアクティブ状態を変更できない
      if (requesterRole === 'DRIVER') {
        if (updateData.role || typeof updateData.isActive === 'boolean') {
          throw new AppError('権限やアクティブ状態は変更できません', 403);
        }
      }

      // ユーザーの存在確認
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, username: true, email: true },
      });

      if (!existingUser) {
        throw new NotFoundError('ユーザーが見つかりません');
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
          throw new ValidationError('メールアドレスは既に使用されています');
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
          throw new ValidationError('ユーザー名は既に使用されています');
        }
      }

      // データを更新
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          username: updateData.username,
          email: updateData.email,
          name: updateData.name,
          role: updateData.role,
          employeeId: updateData.employeeId,
          phone: updateData.phone,
          isActive: updateData.isActive,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          employeeId: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info('ユーザー更新成功', { userId: id, requesterId });

      return {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        employeeId: updatedUser.employeeId,
        phone: updatedUser.phone,
        isActive: updatedUser.isActive,
        lastLoginAt: updatedUser.lastLoginAt,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      };

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
          username: true,
          operationsOperationsDriverIdTousers: { select: { id: true } },
        },
      });

      if (!user) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      // 運行記録が存在する場合は物理削除を禁止
      if (user.operationsOperationsDriverIdTousers.length > 0) {
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
        select: { id: true, username: true },
      });

      if (!user) {
        throw new NotFoundError('ユーザーが見つかりません');
      }

      // パスワードをハッシュ化
      const hashedPassword = await hashPassword(newPassword);

      // パスワードを更新
      await prisma.user.update({
        where: { id },
        data: {
          passwordHash: hashedPassword,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info('パスワードリセット成功', { userId: id });

    } catch (error) {
      logger.error('パスワードリセットエラー', error, { userId: id });
      throw error;
    }
  }

  /**
   * ユーザー統計情報取得
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    recentUsers: number;
    usersByRole: { [key: string]: number };
  }> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // 基本統計
      const [totalUsers, activeUsers, recentUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
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
        if (item.role) {
          usersByRole[item.role] = item._count.id;
        }
      });

      return {
        totalUsers,
        activeUsers,
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
        throw new NotFoundError('ユーザーが見つかりません');
      }

      if (user.role !== 'DRIVER') {
        return {
          totalTrips: 0,
          completedTrips: 0,
          totalDistance: 0,
          totalHours: 0,
          averageDistance: 0,
          recentActivity: null,
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
        averageTripDistance,
        recentTrip
      ] = await Promise.all([
        // 総運行回数
        prisma.operation.count({
          where: whereCondition
        }),
        
        // 完了した運行回数
        prisma.operation.count({
          where: { ...whereCondition, status: 'COMPLETED' }
        }),
        
        // 総走行距離
        prisma.operation.aggregate({
          where: { ...whereCondition, status: 'COMPLETED' },
          _sum: { totalDistanceKm: true }
        }).then(result => result._sum.totalDistanceKm || 0),
        
        // 平均運行距離
        prisma.operation.aggregate({
          where: { ...whereCondition, status: 'COMPLETED' },
          _avg: { totalDistanceKm: true }
        }).then(result => result._avg.totalDistanceKm || 0),

        // 最新の運行記録
        prisma.operation.findFirst({
          where: whereCondition,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        })
      ]);

      // 総運行時間は実際の運行データから計算する必要があるが、
      // 簡易実装として操作回数 * 平均時間で概算
      const totalHours = completedTrips * 8; // 1運行あたり平均8時間と仮定

      return {
        totalTrips,
        completedTrips,
        totalDistance: Number(totalDistance?.toFixed(2) || 0),
        averageDistance: Number(averageTripDistance?.toFixed(2) || 0),
        totalHours,
        completionRate: totalTrips > 0 ? ((completedTrips / totalTrips) * 100).toFixed(1) : '0',
        recentActivity: recentTrip?.createdAt || null,
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
          role: 'DRIVER',
          isActive: true,
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          employeeId: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return drivers.map(driver => ({
        id: driver.id,
        username: driver.username,
        email: driver.email,
        name: driver.name,
        role: driver.role,
        employeeId: driver.employeeId,
        phone: driver.phone,
        isActive: driver.isActive,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      }));

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
        throw new NotFoundError('ユーザーが見つかりません');
      }

      // 監査ログからログイン情報を取得
      const loginHistory = await prisma.auditLog.findMany({
        where: {
          userId: id,
          operationType: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] },
        },
        select: {
          operationType: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return loginHistory.map(log => ({
        action: log.operationType,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      }));

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
          username: true,
          email: true,
          name: true,
          role: true,
          employeeId: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

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
      const users = await prisma.user.findMany({
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
          username: true,
          name: true,
          email: true,
          role: true,
        },
        take: limit,
        orderBy: {
          name: 'asc'
        }
      });

      return users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: true,
        createdAt: null,
        updatedAt: null,
      }));

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
        throw new NotFoundError('ユーザーが見つかりません');
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { 
          role: newRole,
          updatedAt: new Date()
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          employeeId: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      logger.info('ユーザーロール変更成功', { userId, newRole, requesterId });

      return {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        employeeId: updatedUser.employeeId,
        phone: updatedUser.phone,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      };

    } catch (error) {
      logger.error('ユーザーロール変更エラー', error, { userId, newRole });
      throw error;
    }
  }
}

// デフォルトエクスポート
export const userService = new UserService();