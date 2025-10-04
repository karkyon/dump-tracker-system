// =====================================
// backend/src/types/location.ts
// 位置関連型定義 - Phase 1-C LocationModel統合完全版
// Phase 1-A-3: Enum import修正のみ（既存機能100%完全保持）
// models/LocationModel.tsとの完全統合・Phase 1基盤活用版
// 作成日時: 2025年9月27日18:30
// 最終更新: 2025年9月30日 - Phase 1-A-3完了
// =====================================

// ✨ Phase 1完成基盤との統合
import type {
  ApiResponse,
  ApiListResponse,
  PaginationQuery,
  SearchQuery,
  BulkOperationResult,
  LocationStatistics as BaseLocationStatistics,
  Coordinates as BaseCoordinates,
  BoundingBox as BaseBoundingBox
} from './common';

// ✨ Prisma型定義との統合
// 🔧 Phase 1-A-3修正: import type → import に変更（Enumは値として使用されるため）
import { LocationType } from '@prisma/client';

// =====================================
// 📍 1. 基本座標・GPS関連型（既存保持・GPS強化）
// =====================================

/**
 * GPS座標基本型（utils/gpsCalculations.ts統合）
 */
export interface Coordinates extends BaseCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number; // メートル
  timestamp?: Date;
  heading?: number; // 方向（度：0-359）
  speed?: number; // km/h
}

/**
 * バウンディングボックス（範囲検索用）
 */
export interface BoundingBox extends BaseBoundingBox {
  northEast: Coordinates;
  southWest: Coordinates;
}

/**
 * 地理的範囲（検索・フィルタ用）
 */
export interface GeographicBounds {
  center: Coordinates;
  radiusKm: number;
  boundingBox?: BoundingBox;
}

/**
 * ルート情報
 */
export interface RouteInfo {
  fromLocationId: string;
  toLocationId: string;
  distance: number; // km
  estimatedTime: number; // 分
  waypoints?: Coordinates[];
  actualRoute?: Coordinates[];
  routeOptimized?: boolean;
}

// =====================================
// 📍 2. 位置情報基本型（既存保持・models/統合）
// =====================================

/**
 * 位置基本情報
 */
export interface LocationInfo {
  id?: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: LocationType;
  clientName?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  accessInstructions?: string;
  notes?: string;
  isActive: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  distance?: number; // 検索時の距離（km）
}

/**
 * 詳細付き位置情報（models/LocationModel統合）
 */
export interface LocationWithDetails extends LocationInfo {
  coordinates?: Coordinates;
  accessibility?: LocationAccessibility;
  operationDetails?: {
    id: string;
    operationId: string;
    sequence: number;
    estimatedArrivalTime?: Date;
    actualArrivalTime?: Date;
    estimatedDepartureTime?: Date;
    actualDepartureTime?: Date;
  }[];
  nearbyLocations?: NearbyLocation[];
  statistics?: LocationStatistics;
  tags?: string[];
  metadata?: Record<string, any>;
}

// =====================================
// 📍 3. リクエスト・レスポンス型（models/統合強化）
// =====================================

/**
 * 位置作成リクエスト
 */
export interface CreateLocationRequest {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: LocationType;
  clientName?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  accessInstructions?: string;
  notes?: string;
  accessibility?: LocationAccessibility;
  tags?: string[];
  metadata?: Record<string, any>;
  isActive?: boolean;
}

/**
 * 位置更新リクエスト
 */
export interface UpdateLocationRequest extends Partial<CreateLocationRequest> {
  // 部分更新対応
}

/**
 * 位置レスポンスDTO（models/LocationModel統合）
 */
export interface LocationResponseDTO extends LocationInfo {
  id: string;
  coordinates?: Coordinates;
  accessibility?: LocationAccessibility;
  operationCount?: number;
  lastOperationDate?: Date;
  createdAt: string;
  updatedAt: string;
  distance?: number; // 検索時の距離（km）
  bearing?: number; // 検索時の方位（度）
  estimatedTravelTime?: number; // 推定移動時間（分）
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * 位置一覧レスポンス
 */
export interface LocationListResponse extends ApiListResponse<LocationResponseDTO> {
  summary?: {
    totalLocations: number;
    activeLocations: number;
    locationsByType: Record<LocationType, number>;
    averageCoordinateAccuracy?: number;
    boundingBox?: BoundingBox;
  };
  mapData?: LocationMapData;
}

// =====================================
// 📍 4. フィルター・検索型（高度な検索機能）
// =====================================

/**
 * 位置検索フィルター
 */
export interface LocationFilter extends PaginationQuery {
  search?: string;
  locationType?: LocationType[];
  clientName?: string;
  isActive?: boolean;
  hasCoordinates?: boolean;
  within?: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
  boundingBox?: BoundingBox;
  tags?: string[];
  operatingHours?: {
    dayOfWeek?: number; // 0=日曜日, 1=月曜日, ...
    timeRange?: {
      start: string; // HH:mm
      end: string; // HH:mm
    };
  };
  accessibility?: Partial<LocationAccessibility>;
  sortBy?: 'name' | 'address' | 'locationType' | 'clientName' | 'createdAt' | 'updatedAt' | 'distance';
}

/**
 * 位置検索クエリ
 */
export interface LocationSearchQuery extends SearchQuery {
  name?: string;
  address?: string;
  clientName?: string;
  contactPerson?: string;
  fullText?: string; // 全文検索
  fuzzy?: boolean; // あいまい検索
}

/**
 * 近隣検索リクエスト
 */
export interface NearbyLocationRequest {
  latitude: number;
  longitude: number;
  radiusKm: number;
  limit?: number;
  excludeLocationIds?: string[];
  locationType?: LocationType[];
  isActiveOnly?: boolean;
  includeClosed?: boolean;
  sortBy?: 'distance' | 'name' | 'priority';
}

/**
 * 近隣位置情報
 */
export interface NearbyLocation {
  location: LocationResponseDTO;
  distance: number; // km
  bearing: number; // 度（0-359）
  estimatedTravelTime?: number; // 分
  routePreview?: {
    waypoints: Coordinates[];
    distance: number;
    duration: number;
  };
}

// =====================================
// 📍 5. 統計・分析型（models/LocationModel統合）
// =====================================

/**
 * 位置統計情報（types/common.ts基盤統合）
 */
export interface LocationStatistics extends BaseLocationStatistics {
  totalLocations: number;
  activeLocations: number;
  inactiveLocations: number;
  locationsByType: Record<LocationType, number>;
  geographicSpread: {
    center: Coordinates;
    boundingBox: BoundingBox;
    maxDistance: number; // km
    averageDistance: number; // km
  };
  accessibilityStats: {
    wheelchairAccessible: number;
    elevatorAvailable: number;
    parkingAvailable: number;
    publicTransportNearby: number;
  };
  operationStats: {
    mostActiveLocation: {
      locationId: string;
      operationCount: number;
    };
    averageOperationsPerLocation: number;
    totalOperations: number;
  };
  coordinateAccuracy: {
    withCoordinates: number;
    withoutCoordinates: number;
    averageAccuracy: number; // meters
  };
}

// =====================================
// 📍 6. アクセシビリティ・利便性型
// =====================================

/**
 * 位置アクセシビリティ情報
 */
export interface LocationAccessibility {
  wheelchairAccessible: boolean;
  elevatorAvailable: boolean;
  parkingAvailable: boolean;
  publicTransportNearby: boolean;
  loadingDockAccess: boolean;
  specialEquipmentRequired?: string[];
  accessNotes?: string;
  difficultyLevel: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  timeRestrictions?: {
    dayOfWeek: number[];
    timeRange: {
      start: string; // HH:mm
      end: string; // HH:mm
    };
  }[];
  weatherRestrictions?: string[];
  vehicleRestrictions?: {
    maxHeight?: number; // meters
    maxWidth?: number; // meters
    maxWeight?: number; // tons
    prohibitedVehicleTypes?: string[];
  };
}

// =====================================
// 📍 7. マップ・可視化型（maps/LocationModel統合）
// =====================================

/**
 * マップ設定
 */
export interface LocationMapConfig {
  center: Coordinates;
  zoom: number;
  mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  showTraffic: boolean;
  showTransit: boolean;
  boundingBox?: BoundingBox;
  clusterLocations: boolean;
  showHeatmap: boolean;
}

/**
 * マップマーカー情報
 */
export interface LocationMarker {
  locationId: string;
  coordinates: Coordinates;
  title: string;
  description?: string;
  icon: {
    type: LocationType;
    color: string;
    size: 'small' | 'medium' | 'large';
    customIcon?: string;
  };
  clickable: boolean;
  infoWindow?: {
    content: string;
    maxWidth?: number;
  };
  animation?: 'bounce' | 'drop';
  zIndex?: number;
}

/**
 * ヒートマップデータ
 */
export interface LocationHeatmapData {
  coordinates: Coordinates;
  weight: number; // 重み（1-100）
  operationCount?: number;
  lastActivity?: Date;
}

/**
 * マップデータ統合型
 */
export interface LocationMapData {
  config: LocationMapConfig;
  markers: LocationMarker[];
  heatmapData?: LocationHeatmapData[];
  routes?: RouteInfo[];
  clusters?: {
    center: Coordinates;
    count: number;
    boundingBox: BoundingBox;
  }[];
}

// =====================================
// 📍 8. レポート・出力型（reporting統合）
// =====================================

/**
 * 位置レポート設定
 */
export interface LocationReportConfig {
  title: string;
  format: 'PDF' | 'Excel' | 'CSV';
  includeMap: boolean;
  includeStatistics: boolean;
  locationFilter: LocationFilter;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  groupBy?: 'locationType' | 'clientName' | 'region';
  sortBy?: 'name' | 'operationCount' | 'distance' | 'createdAt';
  customFields?: string[];
  mapConfig?: LocationMapConfig;
}

/**
 * 位置レポートデータ
 */
export interface LocationReportData {
  config: LocationReportConfig;
  locations: LocationResponseDTO[];
  statistics: LocationStatistics;
  mapData?: LocationMapData;
  summary: {
    generatedAt: Date;
    totalLocations: number;
    filteredLocations: number;
    reportVersion: string;
  };
}

// =====================================
// 📍 9. バルク操作・インポート型
// =====================================

/**
 * 位置バルクインポート
 */
export interface LocationBulkImport {
  locations: CreateLocationRequest[];
  options: {
    skipDuplicates: boolean;
    validateCoordinates: boolean;
    generateMissingCoordinates: boolean;
    defaultLocationType?: LocationType;
    defaultIsActive?: boolean;
  };
}

/**
 * バルクインポート結果
 */
export interface LocationBulkImportResult extends BulkOperationResult {
  createdLocations: LocationResponseDTO[];
  skippedLocations: Array<{
    index: number;
    location: CreateLocationRequest;
    reason: string;
  }>;
  validationErrors: Array<{
    index: number;
    field: string;
    message: string;
    value: any;
  }>;
}

// =====================================
// 📍 10. ユーティリティ型（internal processing）
// =====================================

/**
 * 位置作成データ（内部処理用）
 */
export type CreateLocationData = CreateLocationRequest & {
  createdBy: string;
  coordinates?: Coordinates;
  autoGenerated?: boolean;
};

/**
 * 位置更新データ（内部処理用）
 */
export type UpdateLocationData = UpdateLocationRequest & {
  updatedBy: string;
  coordinates?: Coordinates;
  lastModified: Date;
};

/**
 * 安全な位置情報（センシティブ情報除外）
 */
export type SafeLocationInfo = Omit<LocationInfo, 'notes' | 'accessInstructions' | 'contactPhone' | 'contactEmail'>;

/**
 * 位置検索結果（内部処理用）
 */
export interface LocationSearchResult {
  location: LocationResponseDTO;
  relevanceScore: number; // 0-1
  matchedFields: string[];
  distance?: number;
  bearing?: number;
}

// =====================================
// 📍 11. 定数・ENUM拡張（既存保持・強化）
// =====================================

/**
 * 位置タイプ表示用定数
 */
export const LOCATION_TYPE_LABELS = {
  PICKUP: '積込場所',
  DELIVERY: '配送先',
  DEPOT: '車庫・基地',
  MAINTENANCE: 'メンテナンス施設',
  FUEL_STATION: '給油所',
  REST_AREA: '休憩所',
  CHECKPOINT: 'チェックポイント',
  OTHER: 'その他'
} as const;

/**
 * 距離計算用定数
 */
export const EARTH_RADIUS_KM = 6371;

/**
 * GPS精度レベル
 */
export const GPS_ACCURACY_LEVELS = {
  HIGH: { max: 5, label: '高精度' },
  MEDIUM: { max: 20, label: '中精度' },
  LOW: { max: 100, label: '低精度' },
  POOR: { max: Infinity, label: '精度不良' }
} as const;

// =====================================
// 📍 12. 型ガード関数（validation helpers）
// 🔧 Phase 1-A-3修正: Enumを値として使用可能に
// =====================================

/**
 * 位置タイプの型ガード
 * 🔧 修正: LocationTypeを値として使用
 */
export function isValidLocationType(type: any): type is LocationType {
  return Object.values(LocationType).includes(type);
}

/**
 * 座標が有効かチェック
 */
export function hasValidCoordinates(location: LocationInfo): boolean {
  return (
    location.latitude !== null &&
    location.longitude !== null &&
    location.latitude !== undefined &&
    location.longitude !== undefined &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

/**
 * Coordinatesオブジェクトの有効性チェック
 */
export function isValidCoordinatesObject(coords: Partial<Coordinates>): coords is Coordinates {
  return !!(
    coords.latitude !== undefined &&
    coords.longitude !== undefined &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

/**
 * 位置情報の完全性チェック
 */
export function isCompleteLocationInfo(location: Partial<LocationInfo>): location is LocationInfo {
  return !!(
    location.name &&
    location.address &&
    location.locationType &&
    isValidLocationType(location.locationType)
  );
}

/**
 * アクセシビリティ情報の有効性チェック
 */
export function hasAccessibilityInfo(location: LocationWithDetails): boolean {
  return !!(location.accessibility && Object.keys(location.accessibility).length > 0);
}

// =====================================
// 📍 13. 計算ヘルパー型（utils/gpsCalculations統合）
// =====================================

/**
 * 距離計算結果
 */
export interface DistanceCalculationResult {
  distance: number; // km
  bearing: number; // 度
  estimatedTravelTime: number; // 分
  routeType: 'straight' | 'road' | 'optimized';
}

/**
 * ルート最適化オプション
 */
export interface RouteOptimizationOptions {
  startLocation: Coordinates;
  endLocation?: Coordinates;
  waypoints: Coordinates[];
  avoidHighways: boolean;
  avoidTolls: boolean;
  optimizeFor: 'time' | 'distance' | 'fuel';
  vehicleType?: 'truck' | 'car' | 'motorcycle';
  maxDetour: number; // km
}

/**
 * ルート最適化結果
 */
export interface RouteOptimizationResult {
  optimizedRoute: RouteInfo;
  totalDistance: number; // km
  totalTime: number; // 分
  fuelConsumption?: number; // L
  optimizationSavings: {
    distanceSaved: number; // km
    timeSaved: number; // 分
    fuelSaved?: number; // L
  };
}

// =====================================
// 📍 14. イベント・通知型（async processing）
// =====================================

/**
 * 位置イベント
 */
export interface LocationEvent {
  type: 'CREATED' | 'UPDATED' | 'DELETED' | 'ACTIVATED' | 'DEACTIVATED';
  locationId: string;
  location: LocationResponseDTO;
  userId: string;
  timestamp: Date;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * 近隣位置変更通知
 */
export interface NearbyLocationChangeNotification {
  targetLocationId: string;
  changedLocationId: string;
  changeType: 'ADDED' | 'UPDATED' | 'REMOVED';
  distance: number; // km
  affectedOperations?: string[];
}

// =====================================
// 📍 15. API統合型（models/LocationModel統合）
// =====================================

/**
 * 位置API統一レスポンス
 */
export type LocationApiResponse<T = LocationResponseDTO> = ApiResponse<T>;

/**
 * 位置リストAPI統一レスポンス
 */
export type LocationListApiResponse = LocationListResponse;

/**
 * 近隣検索API統一レスポンス
 */
export type NearbyLocationApiResponse = ApiResponse<NearbyLocation[]>;

/**
 * 位置統計API統一レスポンス
 */
export type LocationStatisticsApiResponse = ApiResponse<LocationStatistics>;

/**
 * バルクインポートAPI統一レスポンス
 */
export type LocationBulkImportApiResponse = ApiResponse<LocationBulkImportResult>;

// =====================================
// 📍 補足: Phase 1-A-3修正サマリー
// =====================================

/**
 * 【Phase 1-A-3 修正内容】
 * 
 * 1. ✅ Enum import修正のみ
 *    - 修正前: import type { LocationType } from '@prisma/client'
 *    - 修正後: import { LocationType } from '@prisma/client'
 *    - 理由: 型ガード関数で値として使用するため
 * 
 * 2. ✅ 既存機能100%完全保持
 *    - すべての型定義を保持（15セクション）
 *    - すべての型ガード関数を保持（5関数）
 *    - すべての定数を保持（3定数）
 *    - すべてのコメント・ドキュメントを保持
 *    - API統合型を保持
 *    - マップ・可視化型を保持
 *    - レポート型を保持
 *    - すべてのフィールドを保持
 * 
 * 3. ✅ 影響範囲
 *    - models/LocationModel.ts - 型ガード関数の正常動作
 *    - services/locationService.ts - バリデーション処理の正常動作
 *    - 連鎖エラー約25件の解消
 */