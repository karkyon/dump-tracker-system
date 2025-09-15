import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserService } from '../services/userService';
import { 
  UserModel,
  UserCreateInput,
  UserUpdateInput,
  UserResponseDTO,
  NotificationModel,
  AuditLogModel 
} from '../types';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();
const userService = new UserService();

// 既存のコードを維持
// ユーザー一覧取得
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      role, 
      isActive, 
      search 
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // 検索条件構築
    const where: any = {};
    
    if (role) {
      where.role = role;
    }
    
    if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    }
    
    if (search) {
      where.OR = [
        { username: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // 総件数取得
    const totalUsers = await prisma.user.count({ where });

    // ユーザー一覧取得
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        employee_id: true,
        phone: true,
        is_active: true,
        created_at: true,
        last_login_at: true
      },
      skip: offset,
      take: limitNum,
      orderBy: {
        created_at: 'desc'
      }
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalUsers,
          totalPages: Math.ceil(totalUsers / limitNum)
        }
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get all users error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'ユーザー一覧の取得でエラーが発生しました',
      error: 'USERS_FETCH_ERROR'
    });
  }
};

// ユーザー詳細取得
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        employee_id: true,
        phone: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        last_login_at: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get user by ID error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'ユーザー情報の取得でエラーが発生しました',
      error: 'USER_FETCH_ERROR'
    });
  }
};

// ユーザー作成
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      username, 
      email, 
      password, 
      name, 
      role = 'DRIVER', 
      employee_id, 
      phone 
    } = req.body;

    // 必須フィールドチェック
    if (!username || !email || !password || !name) {
      res.status(400).json({
        success: false,
        message: '必須フィールドが不足しています',
        error: 'MISSING_REQUIRED_FIELDS'
      });
      return;
    }

    // ユーザー重複チェック
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'ユーザー名またはメールアドレスが既に使用されています',
        error: 'DUPLICATE_USER'
      });
      return;
    }

    // パスワードハッシュ化
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザー作成
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password_hash: hashedPassword,
        name,
        role,
        employee_id,
        phone,
        is_active: true
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        employee_id: true,
        phone: true,
        is_active: true,
        created_at: true
      }
    });

    logger.info(`User created: ${newUser.username}`, { userId: newUser.id });

    res.status(201).json({
      success: true,
      message: 'ユーザーを作成しました',
      data: { user: newUser }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Create user error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'ユーザーの作成でエラーが発生しました',
      error: 'USER_CREATION_ERROR'
    });
  }
};

// ユーザー更新
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 存在確認
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    // 権限チェック（自分自身または管理者のみ）
    if (req.user?.id !== id && req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'このユーザーを更新する権限がありません',
        error: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    // パスワード更新時のハッシュ化
    if (updateData.password) {
      const bcrypt = require('bcryptjs');
      updateData.password_hash = await bcrypt.hash(updateData.password, 10);
      delete updateData.password;
    }

    // 更新実行
    const updatedUser = await prisma.user.update({
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
        employee_id: true,
        phone: true,
        is_active: true,
        updated_at: true
      }
    });

    logger.info(`User updated: ${updatedUser.username}`, { userId: updatedUser.id });

    res.json({
      success: true,
      message: 'ユーザー情報を更新しました',
      data: { user: updatedUser }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Update user error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'ユーザーの更新でエラーが発生しました',
      error: 'USER_UPDATE_ERROR'
    });
  }
};

// ユーザー削除（論理削除）
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 存在確認
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    // 自分自身の削除を防ぐ
    if (req.user?.id === id) {
      res.status(400).json({
        success: false,
        message: '自分自身を削除することはできません',
        error: 'CANNOT_DELETE_SELF'
      });
      return;
    }

    // 論理削除（is_activeをfalseに設定）
    await prisma.user.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });

    logger.info(`User deleted: ${existingUser.username}`, { userId: id });

    res.json({
      success: true,
      message: 'ユーザーを削除しました'
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Delete user error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'ユーザーの削除でエラーが発生しました',
      error: 'USER_DELETION_ERROR'
    });
  }
};