// backend/src/models/User.ts
import { PrismaClient, UserRole as PrismaUserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ユーザーモデル
 * Prismaを使用した型安全なユーザー管理
 */

export interface UserModel {
  id: string;
  username: string;
  email: string;
  password: string;
  name: string;
  role: PrismaUserRole;
  isActive: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  profileImage?: string;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
  licenseNumber?: string;
  licenseExpiryDate?: Date;
  employeeId?: string;
  department?: string;
  hireDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateInput {
  username: string;
  email: string;
  password: string;
  name: string;
  role?: PrismaUserRole;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
  licenseNumber?: string;
  licenseExpiryDate?: Date;
  employeeId?: string;
  department?: string;
  hireDate?: Date;
}

export interface UserUpdateInput {
  email?: string;
  name?: string;
  role?: PrismaUserRole;
  isActive?: boolean;
  profileImage?: string;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyContactPhone?: string;
  licenseNumber?: string;
  licenseExpiryDate?: Date;
  employeeId?: string;
  department?: string;
}

export interface UserWhereInput {
  id?: string;
  username?: string;
  email?: string;
  name?: { contains?: string; mode?: 'insensitive' };
  role?: PrismaUserRole | PrismaUserRole[];
  isActive?: boolean;
  department?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface UserOrderByInput {
  id?: 'asc' | 'desc';
  username?: 'asc' | 'desc';
  email?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  role?: 'asc' | 'desc';
  isActive?: 'asc' | 'desc';
  lastLogin?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  driverCount: number;
  managerCount: number;
  adminCount: number;
  newUsersThisMonth: number;
  lastLoginUsers: number;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface UserNotificationSettings {
  userId: string;
  emailOperationStart: boolean;
  emailOperationComplete: boolean;
  emailInspectionAlert: boolean;
  emailMaintenanceDue: boolean;
  emailReportGeneration: boolean;
  smsEmergencyAlert: boolean;
  smsMaintenanceAlert: boolean;
  pushNotifications: boolean;
  updatedAt: Date;
}

export interface UserPerformanceMetrics {
  userId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalOperations: number;
  completedOperations: number;
  completionRate: number;
  totalDistance: number;
  averageDistance: number;
  safetyScore: number;
  efficiencyScore: number;
  punctualityScore: number;
  inspectionComplianceRate: number;
}

/**
 * ユーザーモデルクラス
 */
export class User {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  /**
   * ユーザー作成
   */
  async create(data: UserCreateInput): Promise<UserModel> {
    return await this.prisma.user.create({
      data: {
        ...data,
        role: data.role || PrismaUserRole.DRIVER
      }
    });
  }

  /**
   * ユーザー取得
   */
  async findUnique(where: { id?: string; username?: string; email?: string }): Promise<UserModel | null> {
    return await this.prisma.user.findUnique({ where });
  }

  /**
   * ユーザー一覧取得
   */
  async findMany(params: {
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    skip?: number;
    take?: number;
    include?: {
      operations?: boolean;
      sessions?: boolean;
      lastVehicle?: boolean;
    };
  }): Promise<UserModel[]> {
    return await this.prisma.user.findMany(params);
  }

  /**
   * ユーザー更新
   */
  async update(where: { id: string }, data: UserUpdateInput): Promise<UserModel> {
    return await this.prisma.user.update({ where, data });
  }

  /**
   * ユーザー削除（論理削除）
   */
  async softDelete(id: string): Promise<UserModel> {
    return await this.prisma.user.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * ユーザー数カウント
   */
  async count(where?: UserWhereInput): Promise<number> {
    return await this.prisma.user.count({ where });
  }

  /**
   * パスワード更新
   */
  async updatePassword(id: string, hashedPassword: string): Promise<UserModel> {
    return await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });
  }

  /**
   * ログイン試行回数更新
   */
  async updateLoginAttempts(id: string, attempts: number, lockedUntil?: Date): Promise<UserModel> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        loginAttempts: attempts,
        lockedUntil
      }
    });
  }

  /**
   * 最終ログイン時刻更新
   */
  async updateLastLogin(id: string): Promise<UserModel> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        lastLogin: new Date(),
        loginAttempts: 0,
        lockedUntil: null
      }
    });
  }

  /**
   * アクティブユーザー取得
   */
  async findActiveUsers(): Promise<UserModel[]> {
    return await this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * 運転手一覧取得
   */
  async findDrivers(): Promise<UserModel[]> {
    return await this.prisma.user.findMany({
      where: {
        role: PrismaUserRole.DRIVER,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * ユーザー統計取得
   */
  async getStats(): Promise<UserStats> {
    const [
      total,
      active,
      drivers,
      managers,
      admins,
      newThisMonth,
      recentLogin
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: PrismaUserRole.DRIVER, isActive: true } }),
      this.prisma.user.count({ where: { role: PrismaUserRole.MANAGER, isActive: true } }),
      this.prisma.user.count({ where: { role: PrismaUserRole.ADMIN, isActive: true } }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      this.prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30日以内
          }
        }
      })
    ]);

    return {
      totalUsers: total,
      activeUsers: active,
      driverCount: drivers,
      managerCount: managers,
      adminCount: admins,
      newUsersThisMonth: newThisMonth,
      lastLoginUsers: recentLogin
    };
  }

  /**
   * ユーザー検索
   */
  async search(query: string): Promise<UserModel[]> {
    return await this.prisma.user.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { username: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { employeeId: { contains: query, mode: 'insensitive' } }
            ]
          }
        ]
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * ライセンス期限切れユーザー取得
   */
  async findUsersWithExpiredLicenses(): Promise<UserModel[]> {
    return await this.prisma.user.findMany({
      where: {
        licenseExpiryDate: {
          lte: new Date()
        },
        isActive: true
      }
    });
  }

  /**
   * ライセンス期限間近ユーザー取得
   */
  async findUsersWithExpiringLicenses(daysBeforeExpiry: number = 30): Promise<UserModel[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysBeforeExpiry);

    return await this.prisma.user.findMany({
      where: {
        licenseExpiryDate: {
          lte: expiryDate,
          gt: new Date()
        },
        isActive: true
      }
    });
  }
}