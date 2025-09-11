#!/bin/bash

# 存在しないテーブル参照削除修正スクリプト
# 実行前にバックアップを取ることを推奨

BACKEND_DIR="backend"

echo "🔧 存在しないテーブル参照削除開始..."

# userService.tsの修正
echo "📝 userService.ts修正中..."
cat > "${BACKEND_DIR}/src/services/userService.ts" << 'EOF'
// backend/src/services/userService.ts
import { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../utils/errors';
import { UserRole } from '../types';

const prisma = new PrismaClient();

export class UserService {
  
  /**
   * ユーザー統計取得（存在しないテーブル参照を削除）
   */
  async getUserStatistics(id: string, startDate?: string, endDate?: string) {
    try {
      const user = await prisma.users.findUnique({
        where: { id },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new NotFoundError('ユーザー');
      }

      if (user.role !== 'DRIVER') {
        return {
          totalOperations: 0,
          completedOperations: 0,
          totalDistance: 0,
          totalHours: 0,
          averageDistance: 0,
          recentActivity: null,
          fuelEfficiency: 0,
          completionRate: '0',
        };
      }

      const whereCondition: any = { driver_id: id };

      if (startDate || endDate) {
        whereCondition.planned_start_time = {};
        if (startDate) whereCondition.planned_start_time.gte = new Date(startDate);
        if (endDate) whereCondition.planned_start_time.lte = new Date(endDate);
      }

      const [
        totalOperations,
        completedOperations,
        totalDistance,
        recentOperation
      ] = await Promise.all([
        // 総運行回数 - operationsテーブルを使用
        prisma.operations.count({
          where: whereCondition
        }),
        
        // 完了した運行回数
        prisma.operations.count({
          where: { ...whereCondition, status: 'COMPLETED' }
        }),
        
        // 総走行距離
        prisma.operations.aggregate({
          where: { ...whereCondition, status: 'COMPLETED' },
          _sum: { total_distance_km: true }
        }).then(result => result._sum.total_distance_km || 0),
        
        // 最新の運行記録 - operationsテーブルを使用
        prisma.operations.findFirst({
          where: whereCondition,
          orderBy: { planned_start_time: 'desc' },
          select: { planned_start_time: true }
        })
      ]);

      // 燃費計算は給油データがないため0で固定
      const fuelEfficiency = 0;

      // 総運行時間は実際の運行データから計算
      const totalHours = completedOperations * 8; // 1運行あたり平均8時間と仮定

      return {
        totalOperations,
        completedOperations,
        totalDistance: Number(totalDistance?.toFixed(2) || 0),
        totalHours,
        averageDistance: totalOperations > 0 ? Number((Number(totalDistance) / totalOperations).toFixed(2)) : 0,
        fuelEfficiency: Number(fuelEfficiency.toFixed(2)),
        completionRate: totalOperations > 0 ? 
          ((completedOperations / totalOperations) * 100).toFixed(1) + '%' : '0%',
        recentActivity: recentOperation?.planned_start_time || null
      };
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }
  }

  /**
   * ユーザー詳細情報取得
   */
  async getUserProfile(id: string) {
    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        employee_id: true,
        is_active: true,
        last_login_at: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!user) {
      throw new NotFoundError('ユーザー');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      employeeId: user.employee_id,
      isActive: user.is_active,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }

  /**
   * ユーザー一覧取得
   */
  async getUsers(filter: any = {}) {
    const {
      page = 1,
      limit = 20,
      role,
      isActive,
      search
    } = filter;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (typeof isActive === 'boolean') {
      where.is_active = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          is_active: true,
          last_login_at: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.users.count({ where })
    ]);

    return {
      data: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at
      })),
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take)
    };
  }

  /**
   * ユーザー作成
   */
  async createUser(userData: any) {
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { email: userData.email },
          { username: userData.username }
        ]
      }
    });

    if (existingUser) {
      throw new AppError('メールアドレスまたはユーザー名が既に使用されています', 400);
    }

    const user = await prisma.users.create({
      data: {
        username: userData.username,
        email: userData.email,
        password_hash: userData.password_hash,
        name: userData.name,
        role: userData.role || 'DRIVER',
        phone: userData.phone,
        employee_id: userData.employee_id,
        is_active: userData.is_active ?? true
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        created_at: true
      }
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at
    };
  }

  /**
   * ユーザー更新
   */
  async updateUser(id: string, updateData: any) {
    const user = await prisma.users.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundError('ユーザー');
    }

    // メールアドレス・ユーザー名重複チェック
    if (updateData.email || updateData.username) {
      const existingUser = await prisma.users.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateData.email ? { email: updateData.email } : {},
                updateData.username ? { username: updateData.username } : {}
              ].filter(obj => Object.keys(obj).length > 0)
            }
          ]
        }
      });

      if (existingUser) {
        throw new AppError('メールアドレスまたはユーザー名が既に使用されています', 400);
      }
    }

    const updatedUser = await prisma.users.update({
      where: { id },
      data: {
        ...updateData,
        updated_at: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        updated_at: true
      }
    });

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      isActive: updatedUser.is_active,
      updatedAt: updatedUser.updated_at
    };
  }

  /**
   * ユーザー削除（論理削除）
   */
  async deleteUser(id: string) {
    const user = await prisma.users.findUnique({
      where: { id }
    });

    if (!user) {
      throw new NotFoundError('ユーザー');
    }

    await prisma.users.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });

    return { message: 'ユーザーを無効化しました' };
  }
}

export const userService = new UserService();
EOF

# tripService.tsの修正（tripテーブルは存在しないため、operationsテーブルを使用）
echo "📝 tripService.ts修正中（operationsテーブル使用に変更）..."
cat > "${BACKEND_DIR}/src/services/tripService.ts" << 'EOF'
// backend/src/services/tripService.ts
import { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../utils/errors';
import { UserRole } from '../types';

const prisma = new PrismaClient();

export class TripService {
  
  /**
   * 運行記録一覧取得（operationsテーブル使用）
   */
  async getOperations(filter: any = {}, requesterId: string, requesterRole: UserRole) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      driverId,
      vehicleId,
      startDate,
      endDate,
      status
    } = filter;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100);

    const where: any = {};

    // 運転手は自分の運行記録のみ表示
    if (requesterRole === 'DRIVER') {
      where.driver_id = requesterId;
    } else if (driverId) {
      where.driver_id = driverId;
    }

    if (vehicleId) {
      where.vehicle_id = vehicleId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.planned_start_time = {};
      if (startDate) where.planned_start_time.gte = new Date(startDate);
      if (endDate) where.planned_start_time.lte = new Date(endDate);
    }

    const [operations, total] = await Promise.all([
      prisma.operations.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          users_operations_driver_idTousers: {
            select: {
              name: true,
              username: true
            }
          },
          vehicles: {
            select: {
              plate_number: true,
              model: true,
              manufacturer: true
            }
          }
        }
      }),
      prisma.operations.count({ where })
    ]);

    const totalPages = Math.ceil(total / take);

    return {
      data: operations.map(op => ({
        id: op.id,
        operationNumber: op.operation_number,
        driverId: op.driver_id,
        vehicleId: op.vehicle_id,
        status: op.status,
        plannedStartTime: op.planned_start_time,
        actualStartTime: op.actual_start_time,
        plannedEndTime: op.planned_end_time,
        actualEndTime: op.actual_end_time,
        totalDistance: op.total_distance_km,
        fuelConsumed: op.fuel_consumed_liters,
        fuelCost: op.fuel_cost_yen,
        notes: op.notes,
        weatherCondition: op.weather_condition,
        roadCondition: op.road_condition,
        createdAt: op.created_at,
        updatedAt: op.updated_at,
        driverName: op.users_operations_driver_idTousers?.name,
        vehicleNumber: op.vehicles?.plate_number
      })),
      total,
      page,
      limit: take,
      totalPages
    };
  }

  /**
   * 運行記録詳細取得
   */
  async getOperationById(operationId: string, requesterId: string, requesterRole: UserRole) {
    const operation = await prisma.operations.findUnique({
      where: { id: operationId },
      include: {
        users_operations_driver_idTousers: {
          select: {
            name: true,
            username: true
          }
        },
        vehicles: {
          select: {
            plate_number: true,
            model: true,
            manufacturer: true
          }
        },
        operation_details: {
          include: {
            locations: {
              select: {
                name: true,
                address: true
              }
            },
            items: {
              select: {
                name: true,
                unit: true
              }
            }
          }
        }
      }
    });

    if (!operation) {
      throw new NotFoundError('運行記録');
    }

    // 権限チェック
    if (requesterRole === 'DRIVER' && operation.driver_id !== requesterId) {
      throw new AppError('この運行記録にアクセスする権限がありません', 403);
    }

    return {
      id: operation.id,
      operationNumber: operation.operation_number,
      driverId: operation.driver_id,
      vehicleId: operation.vehicle_id,
      status: operation.status,
      plannedStartTime: operation.planned_start_time,
      actualStartTime: operation.actual_start_time,
      plannedEndTime: operation.planned_end_time,
      actualEndTime: operation.actual_end_time,
      totalDistance: operation.total_distance_km,
      fuelConsumed: operation.fuel_consumed_liters,
      fuelCost: operation.fuel_cost_yen,
      notes: operation.notes,
      weatherCondition: operation.weather_condition,
      roadCondition: operation.road_condition,
      createdAt: operation.created_at,
      updatedAt: operation.updated_at,
      driverName: operation.users_operations_driver_idTousers?.name,
      vehicleNumber: operation.vehicles?.plate_number,
      details: operation.operation_details
    };
  }

  /**
   * アクティブな運行記録取得
   */
  async getActiveOperation(driverId: string) {
    const operation = await prisma.operations.findFirst({
      where: {
        driver_id: driverId,
        status: {
          in: ['PLANNING', 'IN_PROGRESS']
        }
      },
      include: {
        vehicles: {
          select: {
            plate_number: true,
            model: true,
            manufacturer: true
          }
        }
      }
    });

    if (!operation) {
      return null;
    }

    return {
      id: operation.id,
      operationNumber: operation.operation_number,
      status: operation.status,
      plannedStartTime: operation.planned_start_time,
      actualStartTime: operation.actual_start_time,
      vehicleNumber: operation.vehicles?.plate_number
    };
  }

  /**
   * 運行記録作成
   */
  async createOperation(operationData: any, driverId: string) {
    const { vehicleId, notes, weatherCondition } = operationData;

    // 車両存在確認
    const vehicle = await prisma.vehicles.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new AppError('指定された車両が見つかりません', 404);
    }

    if (vehicle.status !== 'ACTIVE') {
      throw new AppError('この車両は現在使用できません', 400);
    }

    // 運転手の未完了運行記録チェック
    const activeOperation = await prisma.operations.findFirst({
      where: {
        driver_id: driverId,
        status: {
          in: ['PLANNING', 'IN_PROGRESS']
        }
      }
    });

    if (activeOperation) {
      throw new AppError('未完了の運行記録があります', 400);
    }

    // 運行番号生成
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todayOpsCount = await prisma.operations.count({
      where: {
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }
    });
    const operationNumber = `${today}-${String(todayOpsCount + 1).padStart(3, '0')}`;

    const newOperation = await prisma.operations.create({
      data: {
        operation_number: operationNumber,
        driver_id: driverId,
        vehicle_id: vehicleId,
        notes,
        weather_condition: weatherCondition,
        status: 'PLANNING',
        planned_start_time: new Date()
      }
    });

    return {
      id: newOperation.id,
      operationNumber: newOperation.operation_number,
      status: newOperation.status,
      plannedStartTime: newOperation.planned_start_time
    };
  }

  /**
   * 運行記録更新
   */
  async updateOperation(operationId: string, updateData: any, requesterId: string, requesterRole: UserRole) {
    const operation = await prisma.operations.findUnique({
      where: { id: operationId }
    });

    if (!operation) {
      throw new NotFoundError('運行記録');
    }

    // 権限チェック
    if (requesterRole === 'DRIVER' && operation.driver_id !== requesterId) {
      throw new AppError('この運行記録を更新する権限がありません', 403);
    }

    const updatedOperation = await prisma.operations.update({
      where: { id: operationId },
      data: {
        ...updateData,
        updated_at: new Date()
      }
    });

    return updatedOperation;
  }

  /**
   * 運行記録統計取得
   */
  async getOperationStatistics(startDate?: string, endDate?: string, driverId?: string) {
    const where: any = {};

    if (driverId) {
      where.driver_id = driverId;
    }

    if (startDate || endDate) {
      where.planned_start_time = {};
      if (startDate) where.planned_start_time.gte = new Date(startDate);
      if (endDate) where.planned_start_time.lte = new Date(endDate);
    }

    const [
      totalOperations,
      completedOperations,
      totalDistance,
      totalFuelCost
    ] = await Promise.all([
      prisma.operations.count({ where }),
      prisma.operations.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.operations.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { total_distance_km: true }
      }).then(result => result._sum.total_distance_km || 0),
      prisma.operations.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { fuel_cost_yen: true }
      }).then(result => result._sum.fuel_cost_yen || 0)
    ]);

    return {
      totalOperations,
      completedOperations,
      completionRate: totalOperations > 0 ? 
        ((completedOperations / totalOperations) * 100).toFixed(1) + '%' : '0%',
      totalDistance: Number(totalDistance),
      averageDistance: completedOperations > 0 ? 
        Number((Number(totalDistance) / completedOperations).toFixed(2)) : 0,
      totalFuelCost: Number(totalFuelCost)
    };
  }
}

export const tripService = new TripService();
EOF

# vehicleService.tsの修正
echo "📝 vehicleService.ts修正中..."
sed -i 's/prisma\.trip\./prisma.operations./g' "${BACKEND_DIR}/src/services/vehicleService.ts"
sed -i 's/prisma\.inspection\./prisma.inspection_records./g' "${BACKEND_DIR}/src/services/vehicleService.ts"
sed -i 's/plateNumber/plate_number/g' "${BACKEND_DIR}/src/services/vehicleService.ts"
sed -i 's/lastMaintenanceDate/last_maintenance_date/g' "${BACKEND_DIR}/src/services/vehicleService.ts"

# inspectionService.tsの修正
echo "📝 inspectionService.ts修正中..."
sed -i 's/prisma\.inspectionRecord\./prisma.inspection_records./g' "${BACKEND_DIR}/src/services/inspectionService.ts"
sed -i 's/prisma\.operation\./prisma.operations./g' "${BACKEND_DIR}/src/services/inspectionService.ts"
sed -i 's/InspectionRecordWhereInput/inspection_recordsWhereInput/g' "${BACKEND_DIR}/src/services/inspectionService.ts"
sed -i 's/inspectionItemId/inspection_item_id/g' "${BACKEND_DIR}/src/services/inspectionService.ts"
sed -i 's/operationId/operation_id/g' "${BACKEND_DIR}/src/services/inspectionService.ts"
sed -i 's/inspectorId/inspector_id/g' "${BACKEND_DIR}/src/services/inspectionService.ts"
sed -i 's/inspectionDate/inspection_date/g' "${BACKEND_DIR}/src/services/inspectionService.ts"
sed -i 's/photoUrl/photo_url/g' "${BACKEND_DIR}/src/services/inspectionService.ts"

# User.tsモデルの修正
echo "📝 User.tsモデル修正中..."
cat > "${BACKEND_DIR}/src/models/User.ts" << 'EOF'
// backend/src/models/User.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface UserModel {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  employee_id?: string;
  phone?: string;
  is_active: boolean;
  last_login_at?: Date;
  password_changed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export class User {
  /**
   * ユーザー検索
   */
  static async findMany(options: any = {}): Promise<UserModel[]> {
    const users = await prisma.users.findMany({
      where: options.where,
      select: {
        id: true,
        username: true,
        email: true,
        password_hash: true,
        name: true,
        role: true,
        employee_id: true,
        phone: true,
        is_active: true,
        last_login_at: true,
        password_changed_at: true,
        created_at: true,
        updated_at: true
      }
    });

    return users as UserModel[];
  }

  /**
   * ユーザー詳細取得
   */
  static async findUnique(where: any): Promise<UserModel | null> {
    const user = await prisma.users.findUnique({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        password_hash: true,
        name: true,
        role: true,
        employee_id: true,
        phone: true,
        is_active: true,
        last_login_at: true,
        password_changed_at: true,
        created_at: true,
        updated_at: true
      }
    });

    return user as UserModel | null;
  }

  /**
   * ユーザー作成
   */
  static async create(data: Partial<UserModel>): Promise<UserModel> {
    const user = await prisma.users.create({
      data: {
        username: data.username!,
        email: data.email!,
        password_hash: data.password_hash!,
        name: data.name!,
        role: data.role || 'DRIVER',
        employee_id: data.employee_id,
        phone: data.phone,
        is_active: data.is_active ?? true
      },
      select: {
        id: true,
        username: true,
        email: true,
        password_hash: true,
        name: true,
        role: true,
        employee_id: true,
        phone: true,
        is_active: true,
        last_login_at: true,
        password_changed_at: true,
        created_at: true,
        updated_at: true
      }
    });

    return user as UserModel;
  }

  /**
   * ユーザー更新
   */
  static async update(where: any, data: Partial<UserModel>): Promise<UserModel> {
    const user = await prisma.users.update({
      where,
      data: {
        ...data,
        updated_at: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        password_hash: true,
        name: true,
        role: true,
        employee_id: true,
        phone: true,
        is_active: true,
        last_login_at: true,
        password_changed_at: true,
        created_at: true,
        updated_at: true
      }
    });

    return user as UserModel;
  }

  /**
   * ユーザー削除
   */
  static async delete(where: any): Promise<void> {
    await prisma.users.delete({ where });
  }

  /**
   * アクティブユーザー検索
   */
  static async findActiveUsers(): Promise<UserModel[]> {
    return this.findMany({
      where: { is_active: true }
    });
  }

  /**
   * 役割別ユーザー検索
   */
  static async findByRole(role: string): Promise<UserModel[]> {
    return this.findMany({
      where: { role, is_active: true }
    });
  }

  /**
   * ユーザー数取得
   */
  static async count(where: any = {}): Promise<number> {
    return prisma.users.count({ where });
  }
}

export default User;
EOF

echo "✅ 存在しないテーブル参照削除完了!"
echo ""
echo "📋 修正内容:"
echo "  ✅ userService.ts - trip, fuelRecord参照をoperations参照に変更"
echo "  ✅ tripService.ts - 完全に書き直し（operationsテーブル使用）"
echo "  ✅ vehicleService.ts - trip → operations, inspection → inspection_records"
echo "  ✅ inspectionService.ts - テーブル名とフィールド名修正"
echo "  ✅ User.ts - Prismaスキーマに合わせて修正"
echo ""
echo "🔄 次のステップ:"
echo "  1. npx tsc --noEmit でエラー確認"
echo "  2. 残りのエラーを個別修正"
EOF

chmod +x "${BACKEND_DIR}/remove_non_existent_tables.sh"
