import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import vehicleRoutes from './vehicles';
import tripRoutes from './trips';
import locationRoutes from './locations';
import itemRoutes from './items';
import gpsRoutes from './gps';
import reportRoutes from './reports';
import inspectionRoutes from './inspections';

const router = Router();

// API情報エンドポイント
router.get('/info', (req, res) => {
  res.json({
    name: 'ダンプ運行記録システム API',
    version: '1.0.0',
    description: 'ダンプトラック運行記録管理システム',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      vehicles: '/api/v1/vehicles',
      trips: '/api/v1/trips',
      locations: '/api/v1/locations',
      items: '/api/v1/items',
      gps: '/api/v1/gps',
      reports: '/api/v1/reports',
      inspections: '/api/v1/inspections'
    },
    features: [
      '🚛 車両管理',
      '👥 運転手管理',
      '📍 GPS追跡',
      '📊 運行記録',
      '📄 レポート生成',
      '🔐 JWT認証',
      '🗺️ 地理空間データ',
      '🔧 車両点検'
    ]
  });
});

// ルート設定
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/trips', tripRoutes);
router.use('/locations', locationRoutes);
router.use('/items', itemRoutes);
router.use('/gps', gpsRoutes);
router.use('/reports', reportRoutes);
router.use('/inspections', inspectionRoutes);

export default router;
