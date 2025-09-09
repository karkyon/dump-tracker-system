// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateUser, validateId } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// 安全なコントローラーimport
const getUserController = () => {
  try {
    const controller = require('../controllers/userController');
    return controller.default || controller;
  } catch (error) {
    console.warn('userController not found or invalid:', error.message);
    return null;
  }
};

const userController = getUserController();

if (userController) {
  // 全てのルートで認証が必要
  router.use(authenticateToken);

  // ユーザー一覧（管理者・マネージャーのみ）
  if (userController.getAllUsers) {
    router.get('/', requireRole(['ADMIN', 'MANAGER']), asyncHandler(userController.getAllUsers));
  }

  // ユーザー詳細
  if (userController.getUserById) {
    router.get('/:id', validateId, asyncHandler(userController.getUserById));
  }

  // ユーザー作成（管理者・マネージャーのみ）
  if (userController.createUser) {
    router.post('/', requireRole(['ADMIN', 'MANAGER']), validateUser, asyncHandler(userController.createUser));
  }

  // ユーザー更新
  if (userController.updateUser) {
    router.put('/:id', validateId, asyncHandler(userController.updateUser));
  }

  // ユーザー削除（管理者のみ）
  if (userController.deleteUser) {
    router.delete('/:id', requireRole(['ADMIN']), validateId, asyncHandler(userController.deleteUser));
  }
  
  console.log('✓ ユーザールート登録完了');
} else {
  // フォールバックルート
  router.use(authenticateToken);
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'ユーザー管理機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  console.log('⚠️ ユーザーコントローラーが見つからないため、フォールバックルートを設定しました');
}

export default router;
