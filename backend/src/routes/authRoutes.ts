// backend/src/routes/authRoutes.ts
import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { validateLogin } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 安全なコントローラーimport
const getAuthController = () => {
  try {
    const controller = require('../controllers/authController');
    return controller.default || controller;
  } catch (error) {
    console.warn('authController not found or invalid:', error.message);
    return null;
  }
};

const authController = getAuthController();

if (authController) {
  // 公開エンドポイント
  if (authController.login) {
    router.post('/login', validateLogin, asyncHandler(authController.login));
  }
  
  if (authController.refresh || authController.refreshToken) {
    router.post('/refresh', asyncHandler(authController.refresh || authController.refreshToken));
  }

  // 認証が必要なエンドポイント
  if (authController.getCurrentUser || authController.getProfile || authController.me) {
    router.get('/me', authenticateToken, asyncHandler(authController.getCurrentUser || authController.getProfile || authController.me));
  }
  
  if (authController.logout) {
    router.post('/logout', authenticateToken, asyncHandler(authController.logout));
  }
  
  console.log('✓ 認証ルート登録完了');
} else {
  // フォールバックルート
  router.post('/login', (req, res) => {
    res.status(501).json({
      success: false,
      message: '認証機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  router.get('/me', (req, res) => {
    res.status(501).json({
      success: false,
      message: '認証機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  console.log('⚠️ 認証コントローラーが見つからないため、フォールバックルートを設定しました');
}

export default router;
