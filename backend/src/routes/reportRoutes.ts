// backend/src/routes/reportRoutes.ts
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateReport, validateId } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const getReportController = () => {
  try {
    const controller = require('../controllers/reportController');
    return controller.default || controller;
  } catch (error) {
    console.warn('reportController not found or invalid:', error.message);
    return null;
  }
};

const reportController = getReportController();

if (reportController) {
  router.use(authenticateToken);
  
  if (reportController.getAllReports) {
    router.get('/', asyncHandler(reportController.getAllReports));
  }
  
  if (reportController.getReportById) {
    router.get('/:id', validateId, asyncHandler(reportController.getReportById));
  }
  
  console.log('✓ レポートルート登録完了');
} else {
  router.use(authenticateToken);
  router.get('/', (req, res) => {
    res.status(501).json({
      success: false,
      message: 'レポート機能は実装中です',
      error: 'NOT_IMPLEMENTED'
    });
  });
  
  console.log('⚠️ レポートコントローラーが見つからないため、フォールバックルートを設定しました');
}

export default router;
