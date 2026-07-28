#!/bin/bash

# 構文エラー修正スクリプト
echo "🔧 構文エラー修正開始..."

# 1. authController.tsの完全書き直し
echo "📝 authController.ts完全修正中..."
cat > "src/controllers/authController.ts" << 'EOF'
// backend/src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';

const prisma = new PrismaClient();

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// JWTトークン生成
const generateAccessToken = (payload: any) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const generateRefreshToken = (payload: any) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

/**
 * ユーザーログイン
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new AppError('ユーザー名とパスワードが必要です', 400);
  }

  // ユーザー検索
  const user = await prisma.users.findFirst({
    where: {
      OR: [
        { username },
        { email: username }
      ],
      is_active: true
    }
  });

  if (!user) {
    throw new AppError('認証に失敗しました', 401);
  }

  // パスワード確認
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    throw new AppError('認証に失敗しました', 401);
  }

  // トークン生成
  const tokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // 最終ログイン時刻更新
  await prisma.users.update({
    where: { id: user.id },
    data: { last_login_at: new Date() }
  });

  res.json({
    success: true,
    message: 'ログインに成功しました',
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      },
      accessToken,
      refreshToken
    }
  });
});

/**
 * ユーザー登録
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, name, role = 'DRIVER' } = req.body;

  if (!username || !email || !password || !name) {
    throw new AppError('必要な情報が不足しています', 400);
  }

  // 既存ユーザー確認
  const existingUser = await prisma.users.findFirst({
    where: {
      OR: [
        { username },
        { email }
      ]
    }
  });

  if (existingUser) {
    throw new AppError('ユーザー名またはメールアドレスが既に使用されています', 400);
  }

  // パスワードハッシュ化
  const hashedPassword = await bcrypt.hash(password, 10);

  // ユーザー作成
  const newUser = await prisma.users.create({
    data: {
      username,
      email,
      password_hash: hashedPassword,
      name,
      role,
      is_active: true
    }
  });

  // トークン生成
  const tokenPayload = {
    userId: newUser.id,
    username: newUser.username,
    role: newUser.role
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  res.status(201).json({
    success: true,
    message: 'ユーザー登録が完了しました',
    data: {
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      },
      accessToken,
      refreshToken
    }
  });
});

/**
 * トークンリフレッシュ
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new AppError('リフレッシュトークンが必要です', 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // ユーザー存在確認
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.is_active) {
      throw new AppError('無効なトークンです', 401);
    }

    // 新しいトークン生成
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    res.json({
      success: true,
      message: 'トークンをリフレッシュしました',
      data: {
        accessToken: newAccessToken
      }
    });

  } catch (error) {
    throw new AppError('無効なリフレッシュトークンです', 401);
  }
});

/**
 * ログアウト
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  // 実装：セッション管理やトークンブラックリスト等
  res.json({
    success: true,
    message: 'ログアウトしました'
  });
});

/**
 * 現在のユーザー情報取得
 */
export const getCurrentUser = asyncHandler(async (req: any, res: Response) => {
  const user = await prisma.users.findUnique({
    where: { id: req.user?.userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      is_active: true,
      last_login_at: true
    }
  });

  if (!user) {
    throw new AppError('ユーザーが見つかりません', 404);
  }

  res.json({
    success: true,
    data: user
  });
});

export default {
  login,
  register,
  refreshToken,
  logout,
  getCurrentUser
};
EOF

# 2. userController.tsの修正
echo "📝 userController.ts修正中..."
cat > "src/controllers/userController.ts" << 'EOF'
// backend/src/controllers/userController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { userService } from '../services/userService';

const prisma = new PrismaClient();

/**
 * ユーザー一覧取得
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    role,
    is_active,
    search
  } = req.query;

  const users = await userService.getUsers({
    page: Number(page),
    limit: Number(limit),
    role: role as string,
    isActive: is_active === 'true',
    search: search as string
  });

  res.json({
    success: true,
    data: users
  });
});

/**
 * ユーザー詳細取得
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await userService.getUserProfile(id);

  res.json({
    success: true,
    data: user
  });
});

/**
 * ユーザー作成
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const userData = req.body;

  const newUser = await userService.createUser(userData);

  res.status(201).json({
    success: true,
    message: 'ユーザーを作成しました',
    data: newUser
  });
});

/**
 * ユーザー更新
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedUser = await userService.updateUser(id, updateData);

  res.json({
    success: true,
    message: 'ユーザー情報を更新しました',
    data: updatedUser
  });
});

/**
 * ユーザー削除（無効化）
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await userService.deleteUser(id);

  res.json({
    success: true,
    message: result.message
  });
});

/**
 * ユーザー統計取得
 */
export const getUserStatistics = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const statistics = await userService.getUserStatistics(
    id,
    startDate as string,
    endDate as string
  );

  res.json({
    success: true,
    data: statistics
  });
});

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStatistics
};
EOF

# 3. vehicleController.tsの修正
echo "📝 vehicleController.ts修正中..."
cat > "src/controllers/vehicleController.ts" << 'EOF'
// backend/src/controllers/vehicleController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { vehicleService } from '../services/vehicleService';

const prisma = new PrismaClient();

/**
 * 車両一覧取得
 */
export const getAllVehicles = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    status,
    search
  } = req.query;

  const vehicles = await vehicleService.getVehicles({
    page: Number(page),
    limit: Number(limit),
    status: status as string,
    search: search as string
  });

  res.json({
    success: true,
    data: vehicles
  });
});

/**
 * 車両詳細取得
 */
export const getVehicleById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const vehicle = await prisma.vehicles.findUnique({
    where: { id }
  });

  if (!vehicle) {
    throw new AppError('車両が見つかりません', 404);
  }

  res.json({
    success: true,
    data: vehicle
  });
});

/**
 * 車両作成
 */
export const createVehicle = asyncHandler(async (req: Request, res: Response) => {
  const vehicleData = req.body;

  const newVehicle = await vehicleService.createVehicle(vehicleData);

  res.status(201).json({
    success: true,
    message: '車両を作成しました',
    data: newVehicle
  });
});

/**
 * 車両更新
 */
export const updateVehicle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedVehicle = await vehicleService.updateVehicle(id, updateData);

  res.json({
    success: true,
    message: '車両情報を更新しました',
    data: updatedVehicle
  });
});

/**
 * 車両削除
 */
export const deleteVehicle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await vehicleService.deleteVehicle(id);

  res.json({
    success: true,
    message: '車両を削除しました'
  });
});

export default {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
EOF

# 4. inspectionController.tsの修正
echo "📝 inspectionController.ts修正中..."
cat > "src/controllers/inspectionController.ts" << 'EOF'
// backend/src/controllers/inspectionController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { inspectionService } from '../services/inspectionService';

const prisma = new PrismaClient();

/**
 * 点検記録一覧取得
 */
export const getAllInspections = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    vehicleId,
    inspectorId,
    status,
    inspectionType
  } = req.query;

  const inspections = await inspectionService.getInspections({
    page: Number(page),
    limit: Number(limit),
    vehicle_id: vehicleId as string,
    inspector_id: inspectorId as string,
    status: status as string,
    inspection_type: inspectionType as string
  });

  res.json({
    success: true,
    data: inspections
  });
});

/**
 * 点検記録詳細取得
 */
export const getInspectionById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const inspection = await inspectionService.getInspectionById(id);

  res.json({
    success: true,
    data: inspection
  });
});

/**
 * 点検記録作成
 */
export const createInspection = asyncHandler(async (req: Request, res: Response) => {
  const inspectionData = req.body;

  const newInspection = await inspectionService.create(inspectionData);

  res.status(201).json({
    success: true,
    message: '点検記録を作成しました',
    data: newInspection
  });
});

/**
 * 点検記録更新
 */
export const updateInspection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedInspection = await inspectionService.update(id, updateData);

  res.json({
    success: true,
    message: '点検記録を更新しました',
    data: updatedInspection
  });
});

export default {
  getAllInspections,
  getInspectionById,
  createInspection,
  updateInspection
};
EOF

echo "✅ 構文エラー修正完了!"
echo ""
echo "📋 修正内容:"
echo "  ✅ authController.ts - 完全書き直し"
echo "  ✅ userController.ts - getPool参照削除・Prisma使用"
echo "  ✅ vehicleController.ts - getPool参照削除・Prisma使用"
echo "  ✅ inspectionController.ts - import構文修正・関数統一"
echo ""
echo "🔄 次のステップ:"
echo "  npx tsc --noEmit でエラー確認"
