// backend/src/controllers/customerController.ts
// 客先マスタ コントローラー

import { Request, Response } from 'express';
import { DatabaseService } from '../utils/database';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

const db = DatabaseService.getInstance();

/**
 * 客先一覧取得
 * GET /api/v1/customers
 */
export const getCustomers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { search, isActive, page = '1', limit = '100' } = req.query as Record<string, string>;

  const where: any = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { reading: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { reading: 'asc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    db.customer.count({ where }),
  ]);

  sendSuccess(res, { customers, total }, '客先一覧を取得しました');
});

/**
 * 客先詳細取得
 * GET /api/v1/customers/:id
 */
export const getCustomerById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) return sendError(res, '客先が見つかりません', 404);
  sendSuccess(res, customer, '客先情報を取得しました');
});

/**
 * 客先作成
 * POST /api/v1/customers
 */
export const createCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, reading, address, phone, email, notes } = req.body;
  if (!name?.trim()) return sendError(res, '客先名は必須です', 400);

  const customer = await db.customer.create({
    data: { name: name.trim(), reading, address, phone, email, notes, isActive: true },
  });

  logger.info('客先作成', { customerId: customer.id, userId: req.user?.userId });
  sendSuccess(res, customer, '客先を登録しました', 201);
});

/**
 * 客先更新
 * PUT /api/v1/customers/:id
 */
export const updateCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, reading, address, phone, email, notes, isActive } = req.body;

  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) return sendError(res, '客先が見つかりません', 404);

  const customer = await db.customer.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(reading !== undefined && { reading }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(notes !== undefined && { notes }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    },
  });

  logger.info('客先更新', { customerId: id, userId: req.user?.userId });
  sendSuccess(res, customer, '客先情報を更新しました');
});

/**
 * 客先削除
 * DELETE /api/v1/customers/:id
 */
export const deleteCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) return sendError(res, '客先が見つかりません', 404);

  // 運行記録に紐づいている場合は論理削除
  const operationCount = await db.operation.count({ where: { customerId: id } });
  if (operationCount > 0) {
    await db.customer.update({ where: { id }, data: { isActive: false } });
    return sendSuccess(res, null, '客先を無効化しました（運行記録あり）');
  }

  await db.customer.delete({ where: { id } });
  logger.info('客先削除', { customerId: id, userId: req.user?.userId });
  sendSuccess(res, null, '客先を削除しました');
});
