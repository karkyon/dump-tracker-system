// backend/src/controllers/vehicleController.ts
import { Request, Response } from 'express';
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

// 車両一覧取得
export const getAllVehicles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereClause = 'WHERE v.is_active = true';
    const params: any[] = [];
    let paramCount = 0;

    // ステータスフィルタ
    if (status) {
      whereClause += ` AND v.status = ${++paramCount}`;
      params.push(status);
    }

    // 検索フィルタ
    if (search) {
      whereClause += ` AND (v.plate_number ILIKE ${++paramCount} OR v.model ILIKE ${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`);
      paramCount++;
    }

    const pool = getPool();
    
    // 総件数取得
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM vehicles v ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // 車両データ取得
    const vehiclesResult = await pool.query(
      `SELECT 
        v.*,
        u1.name as created_by_name,
        u2.name as updated_by_name,
        (SELECT COUNT(*) FROM operations WHERE vehicle_id = v.id) as total_operations,
        (SELECT MAX(operation_date) FROM operations WHERE vehicle_id = v.id) as last_operation_date
       FROM vehicles v
       LEFT JOIN users u1 ON v.created_by_id = u1.id
       LEFT JOIN users u2 ON v.updated_by_id = u2.id
       ${whereClause}
       ORDER BY v.created_at DESC
       LIMIT ${++paramCount} OFFSET ${++paramCount}`,
      [...params, Number(limit), offset]
    );

    const totalPages = Math.ceil(totalCount / Number(limit));

    res.json({
      success: true,
      data: {
        vehicles: vehiclesResult.rows,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          limit: Number(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      message: '車両一覧の取得でエラーが発生しました',
      error: 'VEHICLES_FETCH_ERROR'
    });
  }
};

// 車両詳細取得
export const getVehicleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
        v.*,
        u1.name as created_by_name,
        u2.name as updated_by_name
       FROM vehicles v
       LEFT JOIN users u1 ON v.created_by_id = u1.id
       LEFT JOIN users u2 ON v.updated_by_id = u2.id
       WHERE v.id = $1 AND v.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '車両が見つかりません',
        error: 'VEHICLE_NOT_FOUND'
      });
      return;
    }

    // 統計情報取得
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_operations,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_operations,
        SUM(CASE WHEN status = 'COMPLETED' THEN (end_mileage - start_mileage) END) as total_distance,
        SUM(fuel_amount_liters) as total_fuel_consumed,
        MAX(operation_date) as last_operation_date
       FROM operations 
       WHERE vehicle_id = $1`,
      [id]
    );

    const vehicle = result.rows[0];
    vehicle.statistics = statsResult.rows[0];

    res.json({
      success: true,
      data: { vehicle }
    });
  } catch (error) {
    logger.error('Get vehicle by ID error:', error);
    res.status(500).json({
      success: false,
      message: '車両詳細の取得でエラーが発生しました',
      error: 'VEHICLE_FETCH_ERROR'
    });
  }
};

// 車両作成
export const createVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      plateNumber,
      model,
      manufacturer,
      year,
      fuelType,
      capacityTons,
      currentMileage,
      purchaseDate,
      inspectionDueDate,
      insuranceExpiryDate,
      gpsDeviceId,
      notes
    } = req.body;

    const pool = getPool();

    // ナンバープレート重複チェック
    const duplicateResult = await pool.query(
      'SELECT id FROM vehicles WHERE plate_number = $1 AND is_active = true',
      [plateNumber]
    );

    if (duplicateResult.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'このナンバープレートの車両は既に登録されています',
        error: 'DUPLICATE_PLATE_NUMBER'
      });
      return;
    }

    // 車両作成
    const result = await pool.query(
      `INSERT INTO vehicles (
        plate_number, model, manufacturer, year, fuel_type, capacity_tons,
        current_mileage, purchase_date, inspection_due_date, insurance_expiry_date,
        gps_device_id, notes, created_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        plateNumber, model, manufacturer, year, fuelType, capacityTons,
        currentMileage || 0, purchaseDate, inspectionDueDate, insuranceExpiryDate,
        gpsDeviceId, notes, req.user?.id
      ]
    );

    logger.info(`Vehicle created: ${plateNumber}`, { 
      vehicleId: result.rows[0].id, 
      createdBy: req.user?.username 
    });

    res.status(201).json({
      success: true,
      message: '車両が正常に作成されました',
      data: { vehicle: result.rows[0] }
    });
  } catch (error) {
    logger.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      message: '車両の作成でエラーが発生しました',
      error: 'VEHICLE_CREATE_ERROR'
    });
  }
};

// 車両更新
export const updateVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const pool = getPool();

    // 車両存在確認
    const existingResult = await pool.query(
      'SELECT * FROM vehicles WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '車両が見つかりません',
        error: 'VEHICLE_NOT_FOUND'
      });
      return;
    }

    // ナンバープレート重複チェック（自分以外）
    if (updateData.plateNumber) {
      const duplicateResult = await pool.query(
        'SELECT id FROM vehicles WHERE plate_number = $1 AND id != $2 AND is_active = true',
        [updateData.plateNumber, id]
      );

      if (duplicateResult.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: 'このナンバープレートの車両は既に登録されています',
          error: 'DUPLICATE_PLATE_NUMBER'
        });
        return;
      }
    }

    // 更新フィールドを動的に構築
    const setClause = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'plate_number', 'model', 'manufacturer', 'year', 'fuel_type',
      'capacity_tons', 'current_mileage', 'status', 'purchase_date',
      'inspection_due_date', 'insurance_expiry_date', 'gps_device_id', 'notes'
    ];

    allowedFields.forEach(field => {
      const camelField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (updateData[camelField] !== undefined) {
        setClause.push(`${field} = ${++paramCount}`);
        values.push(updateData[camelField]);
      }
    });

    if (setClause.length === 0) {
      res.status(400).json({
        success: false,
        message: '更新するフィールドが指定されていません',
        error: 'NO_UPDATE_FIELDS'
      });
      return;
    }

    setClause.push(`updated_by_id = ${++paramCount}`);
    values.push(req.user?.id);
    values.push(id);

    const result = await pool.query(
      `UPDATE vehicles SET ${setClause.join(', ')}, updated_at = NOW() 
       WHERE id = ${++paramCount} 
       RETURNING *`,
      values
    );

    logger.info(`Vehicle updated: ${id}`, { 
      updatedBy: req.user?.username,
      fields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: '車両情報が正常に更新されました',
      data: { vehicle: result.rows[0] }
    });
  } catch (error) {
    logger.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      message: '車両の更新でエラーが発生しました',
      error: 'VEHICLE_UPDATE_ERROR'
    });
  }
};

// 車両削除（論理削除）
export const deleteVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // 車両存在確認
    const existingResult = await pool.query(
      'SELECT * FROM vehicles WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '車両が見つかりません',
        error: 'VEHICLE_NOT_FOUND'
      });
      return;
    }

    // 進行中の運行がないかチェック
    const activeOperationsResult = await pool.query(
      'SELECT COUNT(*) FROM operations WHERE vehicle_id = $1 AND status IN (\'PLANNING\', \'IN_PROGRESS\')',
      [id]
    );

    if (parseInt(activeOperationsResult.rows[0].count) > 0) {
      res.status(409).json({
        success: false,
        message: '進行中の運行がある車両は削除できません',
        error: 'ACTIVE_OPERATIONS_EXIST'
      });
      return;
    }

    // 論理削除実行
    await pool.query(
      'UPDATE vehicles SET is_active = false, updated_by_id = $1, updated_at = NOW() WHERE id = $2',
      [req.user?.id, id]
    );

    logger.info(`Vehicle deleted: ${id}`, { 
      deletedBy: req.user?.username 
    });

    res.json({
      success: true,
      message: '車両が正常に削除されました'
    });
  } catch (error) {
    logger.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      message: '車両の削除でエラーが発生しました',
      error: 'VEHICLE_DELETE_ERROR'
    });
  }
};

export default {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
