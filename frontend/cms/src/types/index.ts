// frontend/cms/src/types/index.ts - Item型統一版（CargoType完全廃止）
// 🔧 修正内容: 
// 1. CargoType → Item に完全変更（品目管理の正しい命名）
// 2. CargoType のエイリアスを完全削除
// 3. Location型をバックエンドAPIレスポンスに完全対応
// 4. フィールド名を統一: name, locationType, latitude, longitude
// 既存機能: すべての型定義を完全保持
// 🆕 P4-01: 実績報告書機能用型定義を追加（2026-03-17）

// =====================================
// 認証関連
// =====================================
export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  status?: 'active' | 'inactive';
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  lastLoginAt?: string;
  employeeId?: string;
  phone?: string;
  password?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// =====================================
// 車両関連
// ✅ 修正: バックエンドとフロントエンドの両方に対応できるよう完全統一
// 🆕 P4-03: region（管轄区域）フィールドを追加
// =====================================
export interface Vehicle {
  id: string;
  
  // ✅ バックエンド形式（優先）
  plateNumber?: string;       // バックエンド: ナンバープレート
  model?: string;             // バックエンド: 車種・モデル
  manufacturer?: string;      // バックエンド: 製造元
  capacity?: number;          // バックエンド: 積載量（capacityTons の省略形）
  capacityTons?: number;      // バックエンド: 積載量（完全形）
  
  // ✅ フロントエンド形式（互換性維持）
  vehicleNumber?: string;     // フロントエンド: 車番（plateNumber のエイリアス）
  vehicleType?: string;       // フロントエンド: 車種（model のエイリアス）
  
  // ✅ 共通フィールド
  year?: number;
  fuelType?: 'GASOLINE' | 'DIESEL' | 'HYBRID' | 'ELECTRIC';
  currentMileage?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  purchaseDate?: string;
  insuranceExpiry?: string;
  inspectionExpiry?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // 🆕 P4-03: 管轄区域（地方運輸局）実績報告書の地域別集計に使用
  region?: TransportRegion | null;
}

// =====================================
// 点検項目関連
// =====================================
export interface InspectionItem {
  id: string;
  name: string;
  description?: string;
  category?: 'pre' | 'post';
  type?: string;
  inputType?: 'CHECKBOX' | 'TEXT' | 'NUMBER' | 'SELECT' | 'TEXTAREA';  // 追加
  order?: number;
  isRequired?: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================================
// 場所関連（完全修正版）
// ✅ バックエンドAPIレスポンスと完全一致
// =====================================
export interface Location {
  id: string;
  
  // ✅ バックエンドの標準フィールド
  name: string;                    // 場所名（バックエンド標準）
  address: string;                 // 住所
  latitude?: number;               // 緯度（バックエンド標準）
  longitude?: number;              // 経度（バックエンド標準）
  locationType: 'PICKUP' | 'DELIVERY' | 'DEPOT' | 'MAINTENANCE' | 'FUEL_STATION' | 'REST_AREA' | 'CHECKPOINT' | 'OTHER';  // 場所種別（バックエンド標準）
  clientName?: string;             // 客先名
  contactPerson?: string;          // 担当者名
  contactPhone?: string;           // 電話番号
  contactEmail?: string;           // メールアドレス
  operatingHours?: string;         // 営業時間
  accessInstructions?: string;     // アクセス方法
  specialInstructions?: string;    // 特記事項
  notes?: string;                  // 備考
  isActive?: boolean;              // 有効フラグ
  registrationMethod?: 'admin' | 'app';  // 登録方法
  operationCount?: number;         // 運行回数
  createdAt: string;               // 作成日時
  updatedAt: string;               // 更新日時
  
  // ✅ 互換性のための古いフィールド名（非推奨だが互換性維持）
  locationName?: string;           // @deprecated name を使用
  gpsLatitude?: number;            // @deprecated latitude を使用
  gpsLongitude?: number;           // @deprecated longitude を使用
  type?: 'pickup' | 'delivery';    // @deprecated locationType を使用
}

// =====================================
// 品目関連（完全修正版）
// ✅ Item のみ使用、CargoType は完全廃止
// =====================================
export interface Item {
  id: string;
  name: string;
  item_type?: 'RECYCLED_MATERIAL' | 'VIRGIN_MATERIAL' | 'WASTE';  // ✅ 品目区分（再生材/バージン材/廃棄物）
  description?: string;
  category?: string;
  unit?: string;
  standardPrice?: number;
  displayOrder?: number;
  order?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================================
// 運行記録関連（完全版）
// =====================================
export interface OperationRecord {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime?: string;
  startLocation: string;
  endLocation?: string;
  itemId: string;                   // ✅ 品目ID
  cargoTypeId?: string;             // ✅ 後方互換性維持（バックエンドが返す可能性）
  loadWeight?: number;
  status: 'ongoing' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // ✅ 追加: 表示用プロパティ（APIレスポンスまたはフロントエンドで計算）
  date?: string;                    // 運行日
  driverName?: string;              // 運転手名
  vehicleNumber?: string;           // 車両番号
  clientName?: string;              // 客先名
  loadingLocation?: string;         // 積込場所名
  unloadingLocation?: string;       // 積下場所名
  item?: string;                    // ✅ 品目名
  cargoType?: string;               // ✅ 後方互換性維持（バックエンドが返す可能性）
  distance?: number;                // 走行距離
  operationTime?: string;           // 運行時間
}

// =====================================
// GPS位置情報関連（完全版）
// =====================================
export interface GPSLocation {
  id: string;
  vehicleId: string;
  vehicleNumber?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
  status?: 'moving' | 'stopped' | 'idle';
}

// =====================================
// 帳票関連
// =====================================
export interface ReportFilter {
  startDate: string;
  endDate: string;
  vehicleIds?: string[];
  driverIds?: string[];
  itemIds?: string[];               // ✅ 品目ID配列
  cargoTypeIds?: string[];          // ✅ 後方互換性維持（バックエンドが使用する可能性）
  status?: string[];
  format?: 'pdf' | 'excel';
}

// =====================================
// API レスポンス
// =====================================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// =====================================
// システム設定
// =====================================
export interface SystemSettings {
  companyName: string;
  systemName: string;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
}

// =====================================
// フィルター・検索 (完全版)
// =====================================
export interface FilterOptions {
  search?: string;
  searchTerm?: string;  // UserManagement, VehicleManagement用
  category?: string;
  role?: string;  // UserManagement用
  status?: string;  // UserManagement, VehicleManagement用
  vehicleType?: string;  // VehicleManagement用
  manufacturer?: string;  // ✅ 追加: VehicleManagement用（製造元フィルター）
  isActive?: boolean;
  page?: number;
  limit?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =====================================
// テーブル関連
// =====================================
export interface Column<T> {
  key: string;
  header: string;
  label?: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

// =====================================
// マスタストア関連（完全修正版）
// ✅ Item のみ使用、CargoType は完全廃止
// =====================================
export interface MasterState {
  locations: Location[];
  locationLoading: boolean;
  locationError: string | null;

  items: Item[];                    // ✅ 品目配列
  itemLoading: boolean;             // ✅ 品目ローディング
  itemError: string | null;         // ✅ 品目エラー
  loading: boolean;                 // ItemManagement用

  fetchLocations: () => Promise<void>;
  createLocation: (data: Partial<Location>) => Promise<boolean>;
  updateLocation: (id: string, data: Partial<Location>) => Promise<boolean>;
  deleteLocation: (id: string) => Promise<boolean>;

  fetchItems: () => Promise<void>;                                      // ✅ 品目取得
  createItem: (data: Partial<Item>) => Promise<boolean>;               // ✅ 品目作成
  updateItem: (id: string, data: Partial<Item>) => Promise<boolean>;   // ✅ 品目更新
  deleteItem: (id: string) => Promise<boolean>;                        // ✅ 品目削除
  updateItemOrder: (items: { id: string; order: number }[]) => Promise<boolean>;  // ✅ 品目順序更新

  clearErrors: () => void;
}

// =====================================
// オペレーションストア関連（完全版）
// =====================================
export interface OperationState {
  operations: OperationRecord[];
  records: OperationRecord[];  // OperationRecords用
  selectedOperation: OperationRecord | null;
  
  gpsLocations: GPSLocation[];
  currentLocations: GPSLocation[];
  
  isLoading: boolean;
  loading: boolean;  // OperationRecords用
  error: string | null;
  
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  
  filters: FilterOptions;

  fetchOperations: (filters?: FilterOptions) => Promise<void>;
  fetchRecords: (filters?: FilterOptions) => Promise<void>;  // OperationRecords用
  createOperation: (data: Partial<OperationRecord>) => Promise<boolean>;
  updateOperation: (id: string, data: Partial<OperationRecord>) => Promise<boolean>;
  deleteOperation: (id: string) => Promise<boolean>;
  selectOperation: (operation: OperationRecord | null) => void;
  exportRecords: (filters?: FilterOptions) => Promise<void>;  // OperationRecords用
  
  fetchGPSLocations: (vehicleId: string, startDate?: string, endDate?: string) => Promise<void>;
  fetchCurrentLocations: () => Promise<void>;
  fetchGpsLocations: (vehicleId?: string) => Promise<void>;  // 互換性維持
  
  setFilters: (filters: Partial<FilterOptions>) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  clearSelectedOperation: () => void;
}

// =====================================
// 🆕 P4-01: 貨物自動車運送事業実績報告書 機能用型定義
// （貨物自動車運送事業報告規則 第4号様式 対応）
// =====================================

/**
 * 地方運輸局管轄区域
 * 実績報告書の地域別輸送実績集計に使用する10区分
 */
export type TransportRegion =
  | 'HOKKAIDO'
  | 'TOHOKU'
  | 'HOKURIKU'
  | 'KANTO'
  | 'CHUBU'
  | 'KINKI'
  | 'CHUGOKU'
  | 'SHIKOKU'
  | 'KYUSHU'
  | 'OKINAWA';

/**
 * 地方運輸局ラベルマップ（日本語表示用）
 * 帳票の行ラベル・フォーム選択肢に使用
 */
export const TRANSPORT_REGION_LABELS: Record<TransportRegion, string> = {
  HOKKAIDO: '北海道',
  TOHOKU:   '東北',
  HOKURIKU: '北陸信越',
  KANTO:    '関東',
  CHUBU:    '中部',
  KINKI:    '近畿',
  CHUGOKU:  '中国',
  SHIKOKU:  '四国',
  KYUSHU:   '九州',
  OKINAWA:  '沖縄',
};

/**
 * 事故種別
 * - TRAFFIC: 交通事故（道路交通法第72条第1項）
 * - SERIOUS: 重大事故（自動車事故報告規則第2条）
 */
export type AccidentType = 'TRAFFIC' | 'SERIOUS';

/**
 * 事故記録（accident_records テーブル対応）
 * 実績報告書の事故件数欄に使用
 */
export interface AccidentRecord {
  id: string;
  accidentDate: string;
  accidentType: AccidentType;
  vehicleId: string | null;
  driverId: string | null;
  operationId: string | null;
  casualties: number;   // 死者数
  injuries: number;     // 負傷者数
  region: TransportRegion | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  // リレーション（include 時）
  vehicles?: { id: string; plateNumber: string; model: string } | null;
  users?:    { id: string; name: string } | null;
}

/** 事故記録 年度別サマリー（APIレスポンス） */
export interface AccidentRecordSummary {
  fiscalYear: number;
  trafficAccidents: number;
  seriousAccidents: number;
  totalCasualties: number;
  totalInjuries: number;
}

/**
 * 貨物運送事業者情報（transport_business_settings テーブル対応）
 * 実績報告書ヘッダーの印字用データ（全体で1レコード運用）
 */
export interface TransportBusinessSettings {
  id?: string;
  businessNumber: string;       // 事業者番号（国交省発行）
  companyName: string;          // 事業者名（会社名）
  address: string;              // 住所
  representativeName: string;   // 代表者名（役職及び氏名）
  phoneNumber: string;          // 電話番号
  submissionTarget: string;     // 提出先（例: 中国運輸局長）
  businessTypes: string[];      // 事業内容（最大3項目）
}

/** 実績報告書 地域別輸送実績データ（帳票1行分） */
export interface RegionTransportData {
  region: TransportRegion;
  regionLabel: string;
  vehicleDaysTotal: number;     // 延実在車両数（日車）
  vehicleDaysWorked: number;    // 延実働車両数（日車）
  totalDistanceKm: number;      // 走行キロ（km）
  loadedDistanceKm: number;     // 実車キロ（km）
  transportTons: number;        // 輸送トン数 実運送（トン）
  contractTons: number;         // 輸送トン数 利用運送（トン）
  revenueThousandYen: number;   // 営業収入（千円）
}

/** 実績報告書 データ充足チェック結果（プレビュー表示用） */
export interface DataAvailabilityCheck {
  vehicleDays:      'ok' | 'warn' | 'error';
  totalDistance:    'ok' | 'warn' | 'error';
  loadedDistance:   'ok' | 'warn' | 'error';
  transportTons:    'ok' | 'warn' | 'error';
  revenue:          'ok' | 'warn' | 'error';
  regionAssigned:   'ok' | 'warn' | 'error';
  accidentRecords:  'ok';
  businessSettings: 'ok' | 'warn' | 'error';
  unassignedRegionCount: number;       // 管轄区域未設定の車両台数
  missingLoadedDistanceCount: number;  // 実車キロ未入力の運行件数
  missingRevenueCount: number;         // 営業収入未入力の運行件数
}

/**
 * 実績報告書 集計プレビューデータ
 * GET /api/v1/reports/annual-transport/preview/:fiscalYear のレスポンス
 */
export interface AnnualTransportPreview {
  fiscalYear: number;
  fiscalYearStart: string;  // 'YYYY-04-01'
  fiscalYearEnd: string;    // 'YYYY+1-03-31'
  overview: {
    vehicleCount: number;   // 事業用自動車数
    employeeCount: number;  // 従業員数
    driverCount: number;    // 運転者数
  };
  byRegion: RegionTransportData[];
  total: Omit<RegionTransportData, 'region' | 'regionLabel'>;
  accidents: {
    trafficAccidents: number;
    seriousAccidents: number;
    casualties: number;
    injuries: number;
  };
  businessSettings: TransportBusinessSettings | null;
  availability: DataAvailabilityCheck;
}