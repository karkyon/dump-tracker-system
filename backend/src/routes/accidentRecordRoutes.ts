// =====================================
// backend/src/routes/accidentRecordRoutes.ts
// 事故記録管理ルート
// 新規作成: 2026-03-17 (P2-04)
// =====================================

import { Router } from 'express';
import { authenticateToken, requireManagerOrAdmin } from '../middleware/auth';
import { validateId } from '../middleware/validation';
import logger from '../utils/logger';
import accidentRecordController from '../controllers/accidentRecordController';

const router = Router();

// 全ルートで認証必須
router.use(authenticateToken());

router.use((req, res, next) => {
  logger.info('🚨 AccidentRecord API access', { method: req.method, path: req.path });
  next();
});

/**
 * @swagger
 * /accident-records:
 *   get:
 *     summary: 事故記録一覧取得（年度フィルター・サマリー付き）
 *     tags: [事故記録管理]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: fiscalYear
 *         schema: { type: integer }
 *         description: "年度（例: 2025 → 2025/4/1〜2026/3/31）"
 *       - in: query
 *         name: accidentType
 *         schema: { type: string, enum: [TRAFFIC, SERIOUS] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 事故記録一覧（サマリー付き）
 */
router.get('/', requireManagerOrAdmin, accidentRecordController.getAll);

/**
 * @swagger
 * /accident-records/{id}:
 *   get:
 *     summary: 事故記録詳細取得
 *     tags: [事故記録管理]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 事故記録詳細
 *       404:
 *         description: 見つかりません
 */
router.get('/:id', requireManagerOrAdmin, validateId, accidentRecordController.getById);

/**
 * @swagger
 * /accident-records:
 *   post:
 *     summary: 事故記録新規登録
 *     tags: [事故記録管理]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accidentDate, accidentType]
 *             properties:
 *               accidentDate: { type: string, format: date }
 *               accidentType: { type: string, enum: [TRAFFIC, SERIOUS] }
 *               vehicleId: { type: string, format: uuid }
 *               driverId: { type: string, format: uuid }
 *               operationId: { type: string, format: uuid }
 *               casualties: { type: integer, minimum: 0 }
 *               injuries: { type: integer, minimum: 0 }
 *               region: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: 登録成功
 */
router.post('/', requireManagerOrAdmin, accidentRecordController.create);

/**
 * @swagger
 * /accident-records/{id}:
 *   put:
 *     summary: 事故記録更新
 *     tags: [事故記録管理]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/:id', requireManagerOrAdmin, validateId, accidentRecordController.update);

/**
 * @swagger
 * /accident-records/{id}:
 *   delete:
 *     summary: 事故記録削除
 *     tags: [事故記録管理]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 削除成功
 */
router.delete('/:id', requireManagerOrAdmin, validateId, accidentRecordController.remove);

export default router;
