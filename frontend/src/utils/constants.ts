/// <reference types="vite/client" />

// API 設定
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1',
  TIMEOUT: 30000,
  GPS_UPDATE_INTERVAL: parseInt(import.meta.env.VITE_GPS_UPDATE_INTERVAL || '5000'),
  OFFLINE_DATA_RETENTION: parseInt(import.meta.env.VITE_OFFLINE_DATA_RETENTION || '24') * 60 * 60 * 1000
};

// ローカルストレージキー
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  REMEMBER_LOGIN: 'remember_login',
  OFFLINE_DATA: 'offline_data',
  GPS_CACHE: 'gps_cache'
};

// マップ設定
export const MAP_CONFIG = {
  DEFAULT_LAT: 34.6937,
  DEFAULT_LNG: 135.5023,
  DEFAULT_ZOOM: 18,
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
};

// GPS 設定
export const GPS_CONFIG = {
  HIGH_ACCURACY: true,
  TIMEOUT: 10000,
  MAXIMUM_AGE: 0,
  MIN_DISTANCE_FOR_UPDATE: 0.001,
  MIN_SPEED_FOR_HEADING: 1.0,
  HEADING_SMOOTHING_FACTOR: 3,
  SPEED_SMOOTHING_FACTOR: 2,
  GPS_UPDATE_INTERVAL: parseInt(import.meta.env.VITE_GPS_UPDATE_INTERVAL || '5000')
};

// 運行アクション
export const OPERATION_ACTIONS = {
  LOAD_ARRIVAL: '積込場所到着',
  UNLOAD_ARRIVAL: '積降場所到着',
  BREAK: '休憩・荷待ち',
  FUEL: '給油'
} as const;

// ページサイズ
export const PAGE_SIZE = 10;

// ナビゲーションメニュー
export const NAVIGATION_ITEMS = [
  {
    id: 'dashboard',
    name: 'ダッシュボード',
    path: '/dashboard',
    icon: 'BarChart3'
  },
  {
    id: 'users',
    name: 'ユーザー管理',
    path: '/users',
    icon: 'Users'
  },
  {
    id: 'vehicles',
    name: '車両マスタ',
    path: '/vehicles',
    icon: 'Truck'
  },
  {
    id: 'inspection-items',
    name: '点検項目マスタ',
    path: '/inspection-items',
    icon: 'CheckSquare'
  },
  {
    id: 'locations',
    name: '積込・積下場所マスタ',
    path: '/locations',
    icon: 'MapPin'
  },
  {
    id: 'cargo-types',
    name: '品目マスタ管理',
    path: '/cargo-types',
    icon: 'Package'
  },
  {
    id: 'operations',
    name: '運行記録',
    path: '/operations',
    icon: 'FileText'
  },
  {
    id: 'gps-monitoring',
    name: 'GPSモニタリング',
    path: '/gps-monitoring',
    icon: 'Navigation'
  },
  {
    id: 'reports',
    name: '帳票出力',
    path: '/reports',
    icon: 'Download'
  },
  {
    id: 'settings',
    name: 'システム設定',
    path: '/settings',
    icon: 'Settings'
  }
] as const;

// ステータス定義
export const USER_STATUSES = [
  { value: 'active', label: 'アクティブ', color: 'green' },
  { value: 'inactive', label: '非アクティブ', color: 'red' }
] as const;

export const USER_ROLES = [
  { value: 'admin', label: '管理者', color: 'blue' },
  { value: 'driver', label: '運転手', color: 'gray' }
] as const;

export const VEHICLE_STATUSES = [
  { value: 'active', label: '稼働中', color: 'green' },
  { value: 'inactive', label: '非稼働', color: 'red' },
  { value: 'maintenance', label: '整備中', color: 'yellow' }
] as const;

export const OPERATION_STATUSES = [
  { value: 'ongoing', label: '運行中', color: 'blue' },
  { value: 'completed', label: '完了', color: 'green' },
  { value: 'cancelled', label: 'キャンセル', color: 'red' }
] as const;

export const GPS_STATUSES = [
  { value: 'driving', label: '運転中', color: 'blue' },
  { value: 'loading', label: '積込中', color: 'orange' },
  { value: 'unloading', label: '積下中', color: 'purple' },
  { value: 'resting', label: '休憩中', color: 'gray' },
  { value: 'refueling', label: '給油中', color: 'yellow' },
  { value: 'offline', label: 'オフライン', color: 'red' }
] as const;

// 品目リスト
export const CARGO_TYPES = [
  'RC', 'RM', '砂', '改良土', 'その他', 'コンガラ', 'アスガラ', 
  '汚泥', '残土', 'バキューム'
] as const;

// 点検項目
export const INSPECTION_ITEMS = {
  PRE: [
    'エンジンオイル',
    'タイヤの摩耗・亀裂',
    '各作動油の漏れ',
    'ライト',
    '車作動の清潔'
  ],
  POST: [
    'エンジンオイル',
    'タイヤの摩耗・亀裂',
    '各作動油の漏れ',
    '終了距離',
    '備考'
  ]
} as const;

// 日付フォーマット
export const DATE_FORMATS = {
  DISPLAY: 'YYYY/MM/DD',
  INPUT: 'YYYY-MM-DD',
  DATETIME: 'YYYY/MM/DD HH:mm',
  TIME: 'HH:mm'
} as const;

// エラーメッセージ
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  AUTH_FAILED: '認証に失敗しました',
  ACCESS_DENIED: 'アクセスが拒否されました',
  NOT_FOUND: 'データが見つかりません',
  VALIDATION_ERROR: '入力内容に誤りがあります',
  SERVER_ERROR: 'サーバーエラーが発生しました'
} as const;
