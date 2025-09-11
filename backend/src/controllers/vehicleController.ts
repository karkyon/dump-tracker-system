import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 基本型定義
interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    email: string;
  };
}

// 車両一覧取得
export const getAllVehicles = async (req: AuthRequest, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: 'ACTIVE'
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    res.json({
      success: true,
      data: vehicles,
      message: '車両一覧を取得しました'
    });
  } catch (error: unknown) {
    console.error('車両一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '車両一覧の取得に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// 車両詳細取得
export const getVehicleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: '車両が見つかりません'
      });
    }

    res.json({
      success: true,
      data: vehicle,
      message: '車両詳細を取得しました'
    });
  } catch (error: unknown) {
    console.error('車両詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '車両詳細の取得に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// 車両作成
export const createVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { plate_number, model, manufacturer, year, fuel_type } = req.body;

    // 車番号の重複チェック
    const existing = await prisma.vehicle.findFirst({
      where: { plate_number }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'この車番号は既に登録されています'
      });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plate_number,
        model,
        manufacturer,
        year,
        fuel_type,
        status: 'ACTIVE'
      }
    });

    res.status(201).json({
      success: true,
      data: vehicle,
      message: '車両を登録しました'
    });
  } catch (error: unknown) {
    console.error('車両作成エラー:', error);
    res.status(500).json({
      success: false,
      message: '車両の登録に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// 車両更新
export const updateVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 車両存在確認
    const existing = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '車両が見つかりません'
      });
    }

    // 車番号重複チェック（自分以外）
    if (updateData.plate_number && updateData.plate_number !== existing.plate_number) {
      const duplicate = await prisma.vehicle.findFirst({
        where: {
          plate_number: updateData.plate_number,
          id: { not: id }
        }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'この車番号は既に使用されています'
        });
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...updateData,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      data: vehicle,
      message: '車両情報を更新しました'
    });
  } catch (error: unknown) {
    console.error('車両更新エラー:', error);
    res.status(500).json({
      success: false,
      message: '車両情報の更新に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// 車両削除（論理削除）
export const deleteVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 車両存在確認
    const existing = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '車両が見つかりません'
      });
    }

    // 進行中の運行があるかチェック
    const activeOperations = await prisma.operations.findFirst({
      where: {
        vehicle_id: id,
        status: {
          in: ['PLANNING', 'IN_PROGRESS']
        }
      }
    });

    if (activeOperations) {
      return res.status(400).json({
        success: false,
        message: '進行中の運行がある車両は削除できません'
      });
    }

    // 論理削除
    await prisma.vehicle.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      message: '車両を削除しました'
    });
  } catch (error: unknown) {
    console.error('車両削除エラー:', error);
    res.status(500).json({
      success: false,
      message: '車両の削除に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// 車両統計取得
export const getVehicleStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 車両存在確認
    const vehicle = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: '車両が見つかりません'
      });
    }

    // 運行統計計算
    const operationStats = await prisma.operations.aggregate({
      where: {
        vehicle_id: id,
        status: 'COMPLETED'
      },
      _sum: {
        total_distance_km: true,
        fuel_consumed_liters: true,
        fuel_cost_yen: true
      },
      _count: {
        id: true
      }
    });

    // 最新の点検記録
    const latestInspection = await prisma.inspection_records.findFirst({
      where: {
        vehicle_id: id
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const statistics = {
      vehicle,
      totalOperations: operationStats._count.id || 0,
      totalDistance: operationStats._sum.total_distance_km || 0,
      totalFuelConsumed: operationStats._sum.fuel_consumed_liters || 0,
      totalFuelCost: operationStats._sum.fuel_cost_yen || 0,
      latestInspection: latestInspection ? {
        date: latestInspection.created_at,
        status: latestInspection.status,
        type: latestInspection.inspection_type
      } : null
    };

    res.json({
      success: true,
      data: statistics,
      message: '車両統計を取得しました'
    });
  } catch (error: unknown) {
    console.error('車両統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '車両統計の取得に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};