import { Router } from 'express';
import * as reportController from '../controllers/reportController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// 日報生成
router.get('/daily', reportController.generateDailyReport);

// 月報生成
router.get('/monthly', reportController.generateMonthlyReport);

// 車両別レポート
router.get('/vehicle/:vehicleId', reportController.generateVehicleReport);

// 運転手別レポート
router.get('/driver/:driverId', reportController.generateDriverReport);

// 燃費レポート
router.get('/fuel-efficiency', reportController.generateFuelEfficiencyReport);

// 運行実績レポート
router.get('/trip-summary', reportController.generateTripSummaryReport);

export default router;
