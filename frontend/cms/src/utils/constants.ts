// frontend/cms/src/utils/constants.ts - 完全修正版
// 🔧 修正内容: NAVIGATION_ITEMS を Sidebar.tsx で使用可能に
// - path を '/cargo-types' → '/items' に修正
// - Sidebar.tsx からインポートされるように設計
// 既存機能: すべての定数・設定を100%保持
// 🆕 P4-07: 事故記録管理ナビ項目を追加（2026-03-17）

/// <reference types="vite/client" />

// API 設定
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://dumptracker-s.ddns.net/api/v1';

// ローカルストレージキー
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  REMEMBER_LOGIN: 'remember_login',
  THEME: 'theme_preference',
} as const;

// ページサイズ
export const PAGE_SIZE = 10;

// ✅ 修正: ナビゲーションメニュー - Sidebar.tsx で使用
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
    name: '車両管理',
    path: '/vehicles',
    icon: 'Truck'
  },
  {
    id: 'inspection-items',
    name: '点検項目管理',
    path: '/inspection-items',
    icon: 'CheckSquare'
  },
  {
    id: 'customers',
    name: '客先管理',
    path: '/customers',
    icon: 'Building2'
  },
  {
    id: 'locations',
    name: '積込・積下場所管理',
    path: '/locations',
    icon: 'MapPin'
  },
  {
    id: 'items',                    // ✅ 修正: 'cargo-types' → 'items'
    name: '品目管理',
    path: '/items',                 // ✅ 修正: '/cargo-types' → '/items'
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
  // =====================================
  // 🆕 P4-07: 事故記録管理
  // 帳票出力の直後に配置（実績報告書の事故件数欄用）
  // ADMIN / MANAGER のみ表示（adminOnly フラグで Sidebar が制御）
  // =====================================
  {
    id: 'accident-records',
    name: '事故記録管理',
    path: '/accident-records',
    icon: 'AlertTriangle',
    adminOnly: true,   // ADMIN / MANAGER のみ表示
  },
  {
    id: 'settings',
    name: 'システム設定',
    path: '/settings',
    icon: 'Settings'
  },
  // デバッグメニュー（管理者専用）
  {
    id: 'debug',
    name: '運行・点検デバッグ',
    path: '/debug/operations',
    icon: 'Bug',
    adminOnly: true  // 管理者のみ表示
  },
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
  { value: 'driving', label: '運転中', color: 'green' },
  { value: 'stopped', label: '停車中', color: 'yellow' },
  { value: 'offline', label: 'オフライン', color: 'red' }
] as const;

// 日付フォーマット
export const DATE_FORMAT = 'YYYY/MM/DD';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'YYYY/MM/DD HH:mm';
export const DATE_FORMATS = {
  DISPLAY: 'YYYY/MM/DD',
  INPUT: 'YYYY-MM-DD',
  DATETIME: 'YYYY/MM/DD HH:mm',
  TIME: 'HH:mm'
} as const;

// タイムゾーン
export const TIMEZONE = 'Asia/Tokyo';

// バリデーション
export const VALIDATION_RULES = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[0-9-]+$/,
} as const;

// ファイルアップロード
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
} as const;

// デフォルト設定
export const DEFAULTS = {
  PAGE_SIZE: 10,
  DEBOUNCE_DELAY: 500,
  REQUEST_TIMEOUT: 30000,
} as const;