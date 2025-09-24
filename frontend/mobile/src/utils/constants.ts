// API設定
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://10.1.119.244:8443/api/v1',
  TIMEOUT: 30000,
  GPS_UPDATE_INTERVAL: parseInt(import.meta.env.VITE_GPS_UPDATE_INTERVAL || '5000'),
  OFFLINE_DATA_RETENTION: parseInt(import.meta.env.VITE_OFFLINE_DATA_RETENTION || '24') * 60 * 60 * 1000
};

// ストレージキー
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  REMEMBER_LOGIN: 'remember_login',
  OFFLINE_DATA: 'offline_data',
  GPS_CACHE: 'gps_cache'
};

// GPS設定
export const GPS_CONFIG = {
  HIGH_ACCURACY: true,
  TIMEOUT: 10000,
  MAXIMUM_AGE: 0,
  MIN_DISTANCE_FOR_UPDATE: 0.001, // 1m
  MIN_SPEED_FOR_HEADING: 1.0, // 1km/h
  HEADING_SMOOTHING_FACTOR: 3,
  SPEED_SMOOTHING_FACTOR: 2,
  GPS_UPDATE_INTERVAL: parseInt(import.meta.env.VITE_GPS_UPDATE_INTERVAL || '5000')
};

// 地図設定
export const MAP_CONFIG = {
  DEFAULT_LAT: 34.6937, // 大阪
  DEFAULT_LNG: 135.5023,
  DEFAULT_ZOOM: 18,
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
};

// 運行アクション
export const OPERATION_ACTIONS = {
  LOAD_ARRIVAL: '積込場所到着',
  UNLOAD_ARRIVAL: '積降場所到着',
  BREAK: '休憩・荷待ち',
  FUEL: '給油'
} as const;

// 運行ステータス
export const OPERATION_STATUS = {
  WAITING: 'waiting',
  LOADING: 'loading', 
  IN_TRANSIT: 'in_transit',
  UNLOADING: 'unloading',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

// 運行履歴アクションタイプ
export const ACTION_TYPES = {
  START_LOADING: 'start_loading',
  END_LOADING: 'end_loading',
  START_TRANSIT: 'start_transit',
  ARRIVE_UNLOADING: 'arrive_unloading',
  START_UNLOADING: 'start_unloading',
  END_UNLOADING: 'end_unloading',
  COMPLETE_OPERATION: 'complete_operation'
} as const;