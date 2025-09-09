#!/bin/bash

# ダンプトラッカー APIルート自動生成スクリプト

# カラー設定
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# プロジェクトルート確認
BACKEND_DIR="/home/karkyon/dump-tracker/backend"
ROUTES_DIR="$BACKEND_DIR/src/routes"

log_info "ダンプトラッカー APIルート生成開始..."
log_info "バックエンドディレクトリ: $BACKEND_DIR"
log_info "ルートディレクトリ: $ROUTES_DIR"

# ディレクトリ存在確認
if [ ! -d "$ROUTES_DIR" ]; then
    log_warning "ルートディレクトリが存在しません。作成中..."
    mkdir -p "$ROUTES_DIR"
fi

# ルートファイル定義
declare -A ROUTES=(
    ["vehicles"]="車両管理"
    ["locations"]="積込・積下場所管理"
    ["operations"]="運行記録"
    ["gps"]="GPSモニタリング"
    ["reports"]="帳票出力"
    ["inspections"]="点検項目管理"
    ["cargoTypes"]="品目管理"
    ["settings"]="システム設定"
)

# 車両管理ルート生成
generate_vehicles_route() {
cat > "$ROUTES_DIR/vehicles.ts" << 'EOF'
import { Router, Request, Response } from 'express';

const router = Router();

// テストデータ
const testVehicles = [
  {
    id: 1,
    plateNumber: '大阪 500 あ 1234',
    type: 'dump_truck',
    capacity: 10,
    status: 'active',
    driverId: 1,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z'
  },
  {
    id: 2,
    plateNumber: '大阪 500 あ 5678',
    type: 'dump_truck',
    capacity: 15,
    status: 'maintenance',
    driverId: 2,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z'
  }
];

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: 車両一覧取得
 *     description: 登録済み車両の一覧を取得します
 *     tags: [Vehicles]
 *     responses:
 *       200:
 *         description: 車両一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: testVehicles,
    message: '車両一覧を取得しました'
  });
});

/**
 * @swagger
 * /api/vehicles:
 *   post:
 *     summary: 車両登録
 *     description: 新しい車両を登録します
 *     tags: [Vehicles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plateNumber:
 *                 type: string
 *               type:
 *                 type: string
 *               capacity:
 *                 type: number
 *     responses:
 *       201:
 *         description: 車両登録成功
 */
router.post('/', (req: Request, res: Response) => {
  const { plateNumber, type, capacity } = req.body;
  
  const newVehicle = {
    id: testVehicles.length + 1,
    plateNumber,
    type,
    capacity,
    status: 'active',
    driverId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  res.status(201).json({
    success: true,
    data: newVehicle,
    message: '車両を登録しました'
  });
});

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: 車両詳細取得
 *     tags: [Vehicles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 車両詳細
 */
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const vehicle = testVehicles.find(v => v.id === id);
  
  if (!vehicle) {
    return res.status(404).json({
      success: false,
      error: '車両が見つかりません'
    });
  }

  res.json({
    success: true,
    data: vehicle,
    message: '車両詳細を取得しました'
  });
});

export default router;
EOF
}

# 積込・積下場所管理ルート生成
generate_locations_route() {
cat > "$ROUTES_DIR/locations.ts" << 'EOF'
import { Router, Request, Response } from 'express';

const router = Router();

const testLocations = [
  {
    id: 1,
    name: '大阪建設現場A',
    type: 'loading',
    address: '大阪府大阪市北区梅田1-1-1',
    latitude: 34.7024,
    longitude: 135.4959,
    contactPerson: '田中太郎',
    phone: '06-1234-5678'
  },
  {
    id: 2,
    name: '京都処分場B',
    type: 'unloading',
    address: '京都府京都市下京区烏丸通り1-1-1',
    latitude: 34.9859,
    longitude: 135.7544,
    contactPerson: '佐藤花子',
    phone: '075-9876-5432'
  }
];

/**
 * @swagger
 * /api/locations:
 *   get:
 *     summary: 積込・積下場所一覧取得
 *     tags: [Locations]
 *     responses:
 *       200:
 *         description: 場所一覧
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: testLocations,
    message: '場所一覧を取得しました'
  });
});

/**
 * @swagger
 * /api/locations:
 *   post:
 *     summary: 場所登録
 *     tags: [Locations]
 */
router.post('/', (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: '場所を登録しました'
  });
});

export default router;
EOF
}

# 運行記録ルート生成
generate_operations_route() {
cat > "$ROUTES_DIR/operations.ts" << 'EOF'
import { Router, Request, Response } from 'express';

const router = Router();

const testOperations = [
  {
    id: 1,
    vehicleId: 1,
    driverId: 1,
    startTime: '2025-01-15T08:00:00Z',
    endTime: '2025-01-15T17:00:00Z',
    startLocation: '大阪建設現場A',
    endLocation: '京都処分場B',
    cargoType: 'RC',
    weight: 10.5,
    status: 'completed'
  }
];

/**
 * @swagger
 * /api/operations:
 *   get:
 *     summary: 運行記録一覧取得
 *     tags: [Operations]
 *     responses:
 *       200:
 *         description: 運行記録一覧
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: testOperations,
    message: '運行記録一覧を取得しました'
  });
});

/**
 * @swagger
 * /api/operations:
 *   post:
 *     summary: 運行記録登録
 *     tags: [Operations]
 */
router.post('/', (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: '運行記録を登録しました'
  });
});

export default router;
EOF
}

# GPSモニタリングルート生成
generate_gps_route() {
cat > "$ROUTES_DIR/gps.ts" << 'EOF'
import { Router, Request, Response } from 'express';

const router = Router();

const testGpsData = [
  {
    id: 1,
    vehicleId: 1,
    latitude: 34.7024,
    longitude: 135.4959,
    speed: 45,
    heading: 180,
    status: 'driving',
    timestamp: '2025-01-15T10:30:00Z'
  }
];

/**
 * @swagger
 * /api/gps:
 *   get:
 *     summary: GPSデータ取得
 *     tags: [GPS]
 *     responses:
 *       200:
 *         description: GPS位置情報
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: testGpsData,
    message: 'GPS位置情報を取得しました'
  });
});

/**
 * @swagger
 * /api/gps/vehicles/{vehicleId}:
 *   get:
 *     summary: 特定車両のGPS情報取得
 *     tags: [GPS]
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/vehicles/:vehicleId', (req: Request, res: Response) => {
  const vehicleId = parseInt(req.params.vehicleId);
  const gpsData = testGpsData.filter(data => data.vehicleId === vehicleId);
  
  res.json({
    success: true,
    data: gpsData,
    message: `車両${vehicleId}のGPS情報を取得しました`
  });
});

export default router;
EOF
}

# レポートルート生成
generate_reports_route() {
cat > "$ROUTES_DIR/reports.ts" << 'EOF'
import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @swagger
 * /api/reports/daily:
 *   get:
 *     summary: 日次運行レポート取得
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 日次レポート
 */
router.get('/daily', (req: Request, res: Response) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  
  res.json({
    success: true,
    data: {
      date,
      totalTrips: 12,
      totalDistance: 245.6,
      totalWeight: 125.8,
      vehiclesUsed: 3,
      driversWorked: 3
    },
    message: '日次レポートを取得しました'
  });
});

/**
 * @swagger
 * /api/reports/monthly:
 *   get:
 *     summary: 月次運行レポート取得
 *     tags: [Reports]
 */
router.get('/monthly', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      month: '2025-01',
      totalTrips: 360,
      totalDistance: 7380.5,
      totalWeight: 3780.2
    },
    message: '月次レポートを取得しました'
  });
});

export default router;
EOF
}

# 点検項目管理ルート生成
generate_inspections_route() {
cat > "$ROUTES_DIR/inspections.ts" << 'EOF'
import { Router, Request, Response } from 'express';

const router = Router();

const testInspectionItems = [
  {
    id: 1,
    name: 'エンジンオイル',
    type: 'pre',
    description: 'エンジンオイル量・汚れの確認',
    required: true
  },
  {
    id: 2,
    name: 'タイヤ摩耗',
    type: 'pre',
    description: 'タイヤの摩耗・亀裂の確認',
    required: true
  }
];

/**
 * @swagger
 * /api/inspections:
 *   get:
 *     summary: 点検項目一覧取得
 *     tags: [Inspections]
 *     responses:
 *       200:
 *         description: 点検項目一覧
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: testInspectionItems,
    message: '点検項目一覧を取得しました'
  });
});

/**
 * @swagger
 * /api/inspections:
 *   post:
 *     summary: 点検項目登録
 *     tags: [Inspections]
 */
router.post('/', (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: '点検項目を登録しました'
  });
});

export default router;
EOF
}

# 品目管理ルート生成
generate_cargo_types_route() {
cat > "$ROUTES_DIR/cargoTypes.ts" << 'EOF'
import { Router, Request, Response } from 'express';

const router = Router();

const testCargoTypes = [
  { id: 1, name: 'RC', description: '鉄筋コンクリート' },
  { id: 2, name: 'RM', description: '鉄筋モルタル' },
  { id: 3, name: '砂', description: '建設用砂' },
  { id: 4, name: '改良土', description: '改良された土壌' },
  { id: 5, name: 'その他', description: 'その他の品目' }
];

/**
 * @swagger
 * /api/cargo-types:
 *   get:
 *     summary: 品目一覧取得
 *     tags: [CargoTypes]
 *     responses:
 *       200:
 *         description: 品目一覧
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: testCargoTypes,
    message: '品目一覧を取得しました'
  });
});

/**
 * @swagger
 * /api/cargo-types:
 *   post:
 *     summary: 品目登録
 *     tags: [CargoTypes]
 */
router.post('/', (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: '品目を登録しました'
  });
});

export default router;
EOF
}

# システム設定ルート生成
generate_settings_route() {
cat > "$ROUTES_DIR/settings.ts" << 'EOF'
import { Router, Request, Response } from 'express';

const router = Router();

const testSettings = {
  companyName: '株式会社ヨシハラ機工',
  systemName: 'ダンプ運行記録システム',
  timezone: 'Asia/Tokyo',
  language: '日本語',
  dateFormat: 'YYYY/MM/DD',
  timeFormat: '24時間形式',
  gpsUpdateInterval: 30,
  reportRetentionDays: 365
};

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: システム設定取得
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: システム設定
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: testSettings,
    message: 'システム設定を取得しました'
  });
});

/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: システム設定更新
 *     tags: [Settings]
 */
router.put('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'システム設定を更新しました'
  });
});

export default router;
EOF
}

# メイン実行
main() {
    log_info "ルートファイル生成開始..."
    
    # 各ルートファイル生成
    log_info "車両管理ルート生成中..."
    generate_vehicles_route
    log_success "vehicles.ts 生成完了"
    
    log_info "積込・積下場所ルート生成中..."
    generate_locations_route
    log_success "locations.ts 生成完了"
    
    log_info "運行記録ルート生成中..."
    generate_operations_route
    log_success "operations.ts 生成完了"
    
    log_info "GPSモニタリングルート生成中..."
    generate_gps_route
    log_success "gps.ts 生成完了"
    
    log_info "レポートルート生成中..."
    generate_reports_route
    log_success "reports.ts 生成完了"
    
    log_info "点検項目ルート生成中..."
    generate_inspections_route
    log_success "inspections.ts 生成完了"
    
    log_info "品目管理ルート生成中..."
    generate_cargo_types_route
    log_success "cargoTypes.ts 生成完了"
    
    log_info "システム設定ルート生成中..."
    generate_settings_route
    log_success "settings.ts 生成完了"
    
    log_success "全ルートファイル生成完了!"
    
    echo ""
    log_info "生成されたファイル:"
    ls -la "$ROUTES_DIR"/*.ts
    
    echo ""
    log_warning "次の手順:"
    echo "1. app.ts にルート登録を追加"
    echo "2. バックエンドサーバーを再起動"
    echo "3. Swagger UI で新しいエンドポイントを確認"
}

# スクリプト実行
main "$@"
