#!/bin/bash

# APIエンドポイント追加スクリプト
# backend/scripts/add_api_endpoints.sh

echo "🚛 ダンプトラック運行記録システム - APIエンドポイント追加スクリプト"
echo "================================================================"

# 1. 必要なディレクトリ作成
echo "📁 ディレクトリ構造を作成中..."
mkdir -p src/controllers
mkdir -p src/routes
mkdir -p src/services
mkdir -p src/middleware
mkdir -p src/types
mkdir -p src/validators
mkdir -p src/utils

# 2. 車両管理API追加
echo "🚛 車両管理APIを追加中..."
cat > src/routes/vehicles.ts << 'EOF'
import { Router } from 'express';
import * as vehicleController from '../controllers/vehicleController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateVehicle, validateVehicleUpdate } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 車両一覧取得
router.get('/', vehicleController.getAllVehicles);

// 車両詳細取得
router.get('/:id', vehicleController.getVehicleById);

// 車両新規作成（管理者・マネージャーのみ）
router.post('/', 
  requireRole(['ADMIN', 'MANAGER']),
  validateVehicle,
  vehicleController.createVehicle
);

// 車両情報更新（管理者・マネージャーのみ）
router.put('/:id',
  requireRole(['ADMIN', 'MANAGER']),
  validateVehicleUpdate,
  vehicleController.updateVehicle
);

// 車両削除（管理者のみ）
router.delete('/:id',
  requireRole(['ADMIN']),
  vehicleController.deleteVehicle
);

// 車両統計取得
router.get('/:id/statistics', vehicleController.getVehicleStatistics);

export default router;
EOF

# 3. 運行記録API追加
echo "📱 運行記録APIを追加中..."
cat > src/routes/trips.ts << 'EOF'
import { Router } from 'express';
import * as tripController from '../controllers/tripController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateTrip, validateGPSLocation } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 運行記録一覧取得
router.get('/', tripController.getAllTrips);

// 運行記録詳細取得
router.get('/:id', tripController.getTripById);

// 運行開始
router.post('/', validateTrip, tripController.startTrip);

// 運行終了
router.patch('/:id/end', tripController.endTrip);

// GPS位置情報更新
router.patch('/:id/gps', 
  validateGPSLocation,
  tripController.updateGPSLocation
);

// 給油記録追加
router.post('/:id/fuel', tripController.addFuelRecord);

// 積込記録追加
router.post('/:id/loading', tripController.addLoadingRecord);

// 積下記録追加
router.post('/:id/unloading', tripController.addUnloadingRecord);

export default router;
EOF

# 4. 場所管理API追加
echo "📍 場所管理APIを追加中..."
cat > src/routes/locations.ts << 'EOF'
import { Router } from 'express';
import * as locationController from '../controllers/locationController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateLocation } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 場所一覧取得
router.get('/', locationController.getAllLocations);

// 場所詳細取得
router.get('/:id', locationController.getLocationById);

// 場所新規作成
router.post('/', 
  requireRole(['ADMIN', 'MANAGER']),
  validateLocation,
  locationController.createLocation
);

// 場所情報更新
router.put('/:id',
  requireRole(['ADMIN', 'MANAGER']),
  locationController.updateLocation
);

// 積込場所一覧取得
router.get('/loading/list', locationController.getLoadingLocations);

// 積降場所一覧取得
router.get('/unloading/list', locationController.getUnloadingLocations);

// 近隣場所検索
router.get('/nearby/:latitude/:longitude', 
  locationController.getNearbyLocations
);

export default router;
EOF

# 5. 品目管理API追加
echo "📦 品目管理APIを追加中..."
cat > src/routes/items.ts << 'EOF'
import { Router } from 'express';
import * as itemController from '../controllers/itemController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateItem } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 品目一覧取得
router.get('/', itemController.getAllItems);

// 品目詳細取得
router.get('/:id', itemController.getItemById);

// 品目新規作成（管理者・マネージャーのみ）
router.post('/', 
  requireRole(['ADMIN', 'MANAGER']),
  validateItem,
  itemController.createItem
);

// 品目情報更新
router.put('/:id',
  requireRole(['ADMIN', 'MANAGER']),
  itemController.updateItem
);

// 品目使用統計取得
router.get('/:id/statistics', itemController.getItemStatistics);

export default router;
EOF

# 6. GPS追跡API追加
echo "🗺️ GPS追跡APIを追加中..."
cat > src/routes/gps.ts << 'EOF'
import { Router } from 'express';
import * as gpsController from '../controllers/gpsController';
import { authenticateToken } from '../middleware/auth';
import { validateGPSData } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// GPS位置データ送信
router.post('/', validateGPSData, gpsController.recordGPSLocation);

// 車両の位置履歴取得
router.get('/vehicle/:vehicleId', gpsController.getVehicleLocationHistory);

// 運行中の車両位置取得
router.get('/active', gpsController.getActiveVehicleLocations);

// GPS統計取得
router.get('/statistics/:vehicleId', gpsController.getGPSStatistics);

export default router;
EOF

# 7. レポートAPI追加
echo "📊 レポートAPIを追加中..."
cat > src/routes/reports.ts << 'EOF'
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
EOF

# 8. 点検記録API追加
echo "🔧 点検記録APIを追加中..."
cat > src/routes/inspections.ts << 'EOF'
import { Router } from 'express';
import * as inspectionController from '../controllers/inspectionController';
import { authenticateToken } from '../middleware/auth';
import { validateInspection } from '../middleware/validation';

const router = Router();
router.use(authenticateToken);

// 点検記録一覧取得
router.get('/', inspectionController.getAllInspections);

// 点検記録詳細取得
router.get('/:id', inspectionController.getInspectionById);

// 乗車前点検記録
router.post('/pre-trip', 
  validateInspection,
  inspectionController.recordPreTripInspection
);

// 定期点検記録
router.post('/periodic', 
  validateInspection,
  inspectionController.recordPeriodicInspection
);

// 点検統計取得
router.get('/statistics/:vehicleId', 
  inspectionController.getInspectionStatistics
);

export default router;
EOF

# 9. メインルートファイル更新
echo "🔗 メインルートファイルを更新中..."
cat > src/routes/index.ts << 'EOF'
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
EOF

# 10. app.tsファイル更新
echo "⚙️ app.tsファイルを更新中..."
cat >> src/app.ts << 'EOF'

// 追加されたAPIルート
import routes from './routes';
app.use('/api/v1', routes);

EOF

echo "✅ APIエンドポイント追加完了！"
echo ""
echo "🎯 次のステップ:"
echo "1. コントローラーファイルの実装"
echo "2. サービスレイヤーの実装"
echo "3. バリデーションの実装"
echo "4. テストの作成"
echo ""
echo "📝 利用可能なエンドポイント:"
echo "- GET /api/v1/vehicles      - 車両一覧"
echo "- GET /api/v1/trips         - 運行記録"
echo "- GET /api/v1/locations     - 場所管理"
echo "- GET /api/v1/items         - 品目管理"
echo "- POST /api/v1/gps          - GPS位置送信"
echo "- GET /api/v1/reports/daily - 日報生成"
echo "- GET /api/v1/inspections   - 点検記録"