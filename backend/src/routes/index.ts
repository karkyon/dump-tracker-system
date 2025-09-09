// backend/src/routes/index.ts
import { Router } from 'express';

const router = Router();

// 安全なコントローラーimport関数
const safeImportRoute = (routeName: string, path: string): boolean => {
  try {
    const routeModule = require(`./${routeName}`);
    const routeHandler = routeModule.default || routeModule;
    
    if (typeof routeHandler === 'function' || (routeHandler && typeof routeHandler.use === 'function')) {
      router.use(path, routeHandler);
      console.log(`✓ ルート登録成功: ${path} -> ${routeName}`);
      return true;
    } else {
      console.warn(`⚠️ ルートハンドラーが無効: ${routeName}`);
      return false;
    }
  } catch (error) {
    console.warn(`⚠️ ルート登録スキップ: ${routeName} (${error.message})`);
    return false;
  }
};

// ヘルスチェックエンドポイント
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API情報エンドポイント
router.get('/', (req, res) => {
  res.json({
    name: 'ダンプ運行記録システム API',
    version: '1.0.0',
    description: 'ダンプトラック運行記録・管理システムのREST API',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      vehicles: '/api/v1/vehicles',
      trips: '/api/v1/trips',
      locations: '/api/v1/locations',
      items: '/api/v1/items',
      inspections: '/api/v1/inspections',
      reports: '/api/v1/reports'
    },
    health: '/api/v1/health',
    documentation: '/api/docs',
    timestamp: new Date().toISOString()
  });
});

// 動的ルート登録（堅牢版）
const routes = [
  { name: 'authRoutes', path: '/auth' },
  { name: 'auth', path: '/auth' },
  { name: 'userRoutes', path: '/users' },
  { name: 'users', path: '/users' },
  { name: 'vehicleRoutes', path: '/vehicles' },
  { name: 'tripRoutes', path: '/trips' },
  { name: 'locationRoutes', path: '/locations' },
  { name: 'itemRoutes', path: '/items' },
  { name: 'inspectionRoutes', path: '/inspections' },
  { name: 'reportRoutes', path: '/reports' }
];

let registeredRoutes = 0;
routes.forEach(({ name, path }) => {
  if (safeImportRoute(name, path)) {
    registeredRoutes++;
  }
});

console.log(`📊 ルート登録完了: ${registeredRoutes}/${routes.length} routes registered`);

export default router;
