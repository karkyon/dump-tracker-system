import { Router, Request, Response } from 'express';

const router = Router();

// 簡単なテスト用ユーザーデータ
const testUsers = [
  {
    id: 1,
    name: '田中太郎',
    email: 'driver@dumptracker.com',
    password: 'password123',
    role: 'driver'
  },
  {
    id: 2,
    name: '管理者 太郎',
    email: 'admin@dumptracker.com',
    password: 'password123',
    role: 'admin'
  }
];

// ログインエンドポイント
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'メールアドレスとパスワードが必要です'
      });
    }

    console.log('Login attempt:', { email, password });

    const user = testUsers.find(u => u.email === email);
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({
        success: false,
        error: 'メールアドレスまたはパスワードが間違っています'
      });
    }

    if (user.password !== password) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        error: 'メールアドレスまたはパスワードが間違っています'
      });
    }

    const token = `token_${user.id}_${Date.now()}`;

    console.log('Login successful for user:', email);

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

// 他のエンドポイント
router.post('/register', (req, res) => {
  res.json({ 
    message: 'Register endpoint coming soon',
    note: 'This endpoint will handle user registration'
  });
});

router.get('/me', (req, res) => {
  res.json({ 
    message: 'Get current user endpoint coming soon',
    note: 'This endpoint will return current user info from JWT token'
  });
});

export default router;