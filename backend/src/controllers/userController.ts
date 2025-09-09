// backend/src/controllers/userController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../config/database';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    email: string;
  };
}

// ユーザー一覧取得
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = 'WHERE is_active = true';
    const params: any[] = [];
    let paramCount = 0;

    // 役割フィルタ
    if (role) {
      whereClause += ` AND role = ${++paramCount}`;
      params.push(role);
    }

    // 検索フィルタ
    if (search) {
      whereClause += ` AND (username ILIKE ${++paramCount} OR name ILIKE ${++paramCount} OR email ILIKE ${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 2;
    }

    const pool = getPool();
    
    // 総件数取得
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // ユーザーデータ取得（パスワードハッシュは除外）
    const usersResult = await pool.query(
      `SELECT 
        id, username, email, name, role, phone, employee_id,
        is_active, last_login_at, created_at, updated_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${++paramCount} OFFSET ${++paramCount}`,
      [...params, Number(limit), offset]
    );

    const totalPages = Math.ceil(totalCount / Number(limit));

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          limit: Number(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
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
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
        id, username, email, name, role, phone, employee_id,
        is_active, last_login_at, created_at, updated_at
       FROM users 
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    // ドライバーの場合は運行統計も取得
    let statistics = null;
    if (result.rows[0].role === 'DRIVER') {
      const statsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_operations,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_operations,
          SUM(CASE WHEN status = 'COMPLETED' THEN (end_mileage - start_mileage) END) as total_distance,
          MAX(operation_date) as last_operation_date
         FROM operations 
         WHERE driver_id = $1`,
        [id]
      );
      statistics = statsResult.rows[0];
    }

    const user = result.rows[0];
    if (statistics) {
      user.statistics = statistics;
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー詳細の取得でエラーが発生しました',
      error: 'USER_FETCH_ERROR'
    });
  }
};

export default { getAllUsers, getUserById };
