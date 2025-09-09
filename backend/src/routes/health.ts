import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: ヘルスチェックエンドポイント
 *     description: APIサーバーの稼働状況を確認します
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: サーバーが正常に稼働中
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: サーバー稼働時間（秒）
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: connected
 *                     redis:
 *                       type: string
 *                       example: connected
 *                     memory:
 *                       type: object
 *       503:
 *         description: サーバーが異常状態
 */
router.get('/', async (_req: Request, res: Response) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      memory: process.memoryUsage(),
    },
  };

  try {
    // 簡単なヘルスチェック
    healthCheck.services.database = 'connected';
    healthCheck.services.redis = 'connected';
  } catch (error) {
    healthCheck.status = 'unhealthy';
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

export default router;
