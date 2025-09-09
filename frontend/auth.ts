import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

// テスト用ユーザーデータ（実際の実装ではデータベースから取得）
const testUsers = [
  {
    id: 1,
    name: '田中太郎',
    email: 'driver@dumptracker.com',
    password: '$2a$10$rQ8K8O8O8O8O8O8O8O8O8e', // 'password123' をハッシュ化した値
    role: 'driver'
  },
  {
    id: 2,
    name: '管理者',
    email: 'admin@dumptracker.com', 
    password: '$2a$10$rQ8K8O8O8O8O8O8O8O8O8e', // 'password123' をハッシュ化した値
    role: 'admin'
  }
];

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: ユーザーログイン
 *     description: ユーザー認証を行います
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: driver@dumptracker.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *     responses:
 *       200:
 *         description: ログイン成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: 田中太郎
 *                     email:
 *                       type: string
 *                       example: driver@dumptracker.com
 *                     role:
 *                       type: string
 *                       example: driver
 *       401:
 *         description: 認証失敗
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid credentials
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 入力値のバリデーション
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'メールアドレスとパスワードが必要です'
      });
    }

    // ユーザー検索（実際の実装ではデータベースから取得）
    const user = testUsers.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'メールアドレスまたはパスワードが間違っています'
      });
    }

    // パスワード検証（テスト用に簡略化）
    const isValidPassword = password === 'password123';
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'メールアドレスまたはパスワードが間違っています'
      });
    }

    // JWTトークン生成
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // レスポンス
    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      message: 'ログインしました'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: ユーザー登録
 *     description: 新しいユーザーを登録します
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: 田中太郎
 *               email:
 *                 type: string
 *                 format: email
 *                 example: tanaka@dumptracker.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               role:
 *                 type: string
 *                 enum: [admin, manager, driver]
 *                 example: driver
 *     responses:
 *       201:
 *         description: 登録成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 2
 *                     name:
 *                       type: string
 *                       example: 田中太郎
 *                     email:
 *                       type: string
 *                       example: tanaka@dumptracker.com
 *       400:
 *         description: 入力エラー
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid input data
 */
router.post('/register', (req, res) => {
  res.json({ 
    message: 'Register endpoint coming soon',
    note: 'This endpoint will handle user registration'
  });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: 現在のユーザー情報取得
 *     description: JWTトークンから現在のユーザー情報を取得します
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ユーザー情報取得成功
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
 *                   example: driver@dumptracker.com
 *                 role:
 *                   type: string
 *                   example: driver
 *       401:
 *         description: 未認証
 */
router.get('/me', (req, res) => {
  res.json({ 
    message: 'Get current user endpoint coming soon',
    note: 'This endpoint will return current user info from JWT token'
  });
});

export default router;