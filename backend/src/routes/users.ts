import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: ユーザー一覧取得
 *     description: 登録されているユーザーの一覧を取得します
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: ページ番号
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 1ページあたりの件数
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, driver]
 *         description: ロールでフィルタ
 *     responses:
 *       200:
 *         description: ユーザー一覧取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: 田中太郎
 *                       email:
 *                         type: string
 *                         example: tanaka@dumptracker.com
 *                       role:
 *                         type: string
 *                         example: driver
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 25
 *       401:
 *         description: 未認証
 */
router.get('/', (req, res) => {
  res.json({ 
    message: 'Get users endpoint coming soon',
    note: 'This endpoint will return paginated user list'
  });
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: ユーザー詳細取得
 *     description: 指定されたIDのユーザー詳細情報を取得します
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ユーザーID
 *     responses:
 *       200:
 *         description: ユーザー詳細取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: 田中太郎
 *                 email:
 *                   type: string
 *                   example: tanaka@dumptracker.com
 *                 role:
 *                   type: string
 *                   example: driver
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: ユーザーが見つかりません
 *       401:
 *         description: 未認証
 */
router.get('/:id', (req, res) => {
  res.json({ 
    message: 'Get user by ID endpoint coming soon',
    requestedId: req.params.id
  });
});

export default router;
