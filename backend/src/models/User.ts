// backend/src/models/User.ts
import { PrismaClient, user_role as PrismaUserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ユーザーモデル - Prismaスキーマ完全準拠版
 * スネークケース命名規則、DB整合性確保
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface UserModel {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  name: string;
  role: PrismaUserRole;
  employee_id?: string | null;
  phone?: string | null;
  is_active: boolean;
  last_login_at?: Date | null;
  password_changed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreateInput {
  username: string;
  email: string;
  password_hash: string;
  name: string;
  role?: PrismaUserRole;
  employee_id?: string;
  phone?: string;
  is_active?: boolean;
}

export interface UserUpdateInput {
  username?: string;
  email?: string;
  password_hash?: string;
  name?: string;
  role?: PrismaUserRole;
  employee_id?: string;
  phone?: string;
  is_active?: boolean;
  last_login_at?: Date;
  password_changed_at?: Date;
}

export interface UserWhereInput {
  id?: string;
  username?: string | { contains?: string; mode?: 'insensitive' };
  email?: string | { contains?: string; mode?: 'insensitive' };
  name?: { contains?: string; mode?: 'insensitive' };
  role?: PrismaUserRole | PrismaUserRole[];
  employee_id?: string;
  is_active?: boolean;
  created_at?: {
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
  employee_id?: 'asc' | 'desc';
  is_active?: 'asc' | 'desc';
  last_login_at?: 'asc' | 'desc';
  created_at?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface UserResponseDTO {
  id: string;
  username: string;
  email: string;
  name: string;
  role: PrismaUserRole;
  employee_id?: string | null;
  phone?: string | null;
  is_active: boolean;
  last_login_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  driver_count: number;
  manager_count: number;
  admin_count: number;
  new_users_this_month: number;
  recent_login_users: number;
}

export interface UserActivity {
  id: string;
  user_id: string;
  action: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_id: string;
  ip_address: string;
  user_agent: string;
  created_at: Date;
  expires_at: Date;
  is_active: boolean;
}

export interface UserPerformanceMetrics {
  user_id: string;
  period: {
    start_date: Date;
    end_date: Date;
  };
  total_operations: number;
  completed_operations: number;
  completion_rate: number;
  total_distance: number;
  average_distance: number;
  safety_score: number;
  efficiency_score: number;
  punctuality_score: number;
  inspection_compliance_rate: number;
}

// =====================================
// ユーザーモデルクラス
// =====================================

export class User {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * ユーザー作成
   */
  async create(data: UserCreateInput): Promise<UserModel> {
    try {
      return await this.prisma.user.create({
        data: {
          ...data,
          role: data.role || PrismaUserRole.DRIVER,
          is_active: data.is_active ?? true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`ユーザー作成エラー: ${error}`);
    }
  }

  /**
   * ユーザー取得（ID指定）
   */
  async findById(id: string): Promise<UserModel | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id }
      });
    } catch (error) {
      throw new Error(`ユーザー取得エラー: ${error}`);
    }
  }

  /**
   * ユーザー取得（ユニーク条件指定）
   */
  async findUnique(where: { 
    id?: string; 
    username?: string; 
    email?: string 
  }): Promise<UserModel | null> {
    try {
      return await this.prisma.user.findUnique({ where });
    } catch (error) {
      throw new Error(`ユーザー取得エラー: ${error}`);
    }
  }

  /**
   * ユーザー一覧取得
   */
  async findMany(params: {
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<UserModel[]> {
    try {
      return await this.prisma.user.findMany({
        where: params.where,
        orderBy: params.orderBy || { name: 'asc' },
        skip: params.skip,
        take: params.take
      });
    } catch (error) {
      throw new Error(`ユーザー一覧取得エラー: ${error}`);
    }
  }

  /**
   * ユーザー更新
   */
  async update(id: string, data: UserUpdateInput): Promise<UserModel> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`ユーザー更新エラー: ${error}`);
    }
  }

  /**
   * ユーザー削除（論理削除）
   */
  async softDelete(id: string): Promise<UserModel> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { 
          is_active: false,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`ユーザー削除エラー: ${error}`);
    }
  }

  /**
   * ユーザー物理削除
   */
  async delete(id: string): Promise<UserModel> {
    try {
      return await this.prisma.user.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`ユーザー物理削除エラー: ${error}`);
    }
  }

  /**
   * ユーザー数カウント
   */
  async count(where?: UserWhereInput): Promise<number> {
    try {
      return await this.prisma.user.count({ where });
    } catch (error) {
      throw new Error(`ユーザー数取得エラー: ${error}`);
    }
  }

  /**
   * パスワード更新
   */
  async updatePassword(id: string, password_hash: string): Promise<UserModel> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { 
          password_hash,
          password_changed_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`パスワード更新エラー: ${error}`);
    }
  }

  /**
   * 最終ログイン時刻更新
   */
  async updateLastLogin(id: string): Promise<UserModel> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          last_login_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`最終ログイン更新エラー: ${error}`);
    }
  }

  /**
   * アクティブユーザー取得
   */
  async findActiveUsers(): Promise<UserModel[]> {
    try {
      return await this.prisma.user.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`アクティブユーザー取得エラー: ${error}`);
    }
  }

  /**
   * 運転手一覧取得
   */
  async findDrivers(): Promise<UserModel[]> {
    try {
      return await this.prisma.user.findMany({
        where: {
          role: PrismaUserRole.DRIVER,
          is_active: true
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`運転手一覧取得エラー: ${error}`);
    }
  }

  /**
   * 管理者一覧取得
   */
  async findManagers(): Promise<UserModel[]> {
    try {
      return await this.prisma.user.findMany({
        where: {
          role: { in: [PrismaUserRole.MANAGER, PrismaUserRole.ADMIN] },
          is_active: true
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`管理者一覧取得エラー: ${error}`);
    }
  }

  /**
   * ユーザー統計取得
   */
  async getStats(): Promise<UserStats> {
    try {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const recentLoginThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30日前

      const [
        total_users,
        active_users,
        driver_count,
        manager_count,
        admin_count,
        new_users_this_month,
        recent_login_users
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { is_active: true } }),
        this.prisma.user.count({ where: { role: PrismaUserRole.DRIVER, is_active: true } }),
        this.prisma.user.count({ where: { role: PrismaUserRole.MANAGER, is_active: true } }),
        this.prisma.user.count({ where: { role: PrismaUserRole.ADMIN, is_active: true } }),
        this.prisma.user.count({ where: { created_at: { gte: thisMonth } } }),
        this.prisma.user.count({ where: { last_login_at: { gte: recentLoginThreshold } } })
      ]);

      return {
        total_users,
        active_users,
        driver_count,
        manager_count,
        admin_count,
        new_users_this_month,
        recent_login_users
      };
    } catch (error) {
      throw new Error(`ユーザー統計取得エラー: ${error}`);
    }
  }

  /**
   * ユーザー検索
   */
  async search(query: string, limit: number = 10): Promise<UserModel[]> {
    try {
      return await this.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { employee_id: { contains: query, mode: 'insensitive' } }
          ],
          is_active: true
        },
        take: limit,
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      throw new Error(`ユーザー検索エラー: ${error}`);
    }
  }

  /**
   * ユーザーロール変更
   */
  async changeRole(id: string, role: PrismaUserRole): Promise<UserModel> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { 
          role,
          updated_at: new Date()
        }
      });
    } catch (error) {
      throw new Error(`ユーザーロール変更エラー: ${error}`);
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(user: UserModel): UserResponseDTO {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      employee_id: user.employee_id,
      phone: user.phone,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }

  /**
   * バルクユーザー作成（CSV等からの一括登録）
   */
  async createMany(users: UserCreateInput[]): Promise<{ count: number }> {
    try {
      const usersWithTimestamps = users.map(user => ({
        ...user,
        role: user.role || PrismaUserRole.DRIVER,
        is_active: user.is_active ?? true,
        created_at: new Date(),
        updated_at: new Date()
      }));

      return await this.prisma.user.createMany({
        data: usersWithTimestamps,
        skipDuplicates: true
      });
    } catch (error) {
      throw new Error(`バルクユーザー作成エラー: ${error}`);
    }
  }

  /**
   * ユーザー存在確認
   */
  async exists(where: { 
    id?: string; 
    username?: string; 
    email?: string 
  }): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({ where });
      return user !== null;
    } catch (error) {
      throw new Error(`ユーザー存在確認エラー: ${error}`);
    }
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const userModel = new User();
export default userModel;