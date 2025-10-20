// frontend/mobile/src/utils/constants.ts
// GPS設定定数とアプリケーション設定

// =============================================================================
// GPS設定
// =============================================================================

export const GPS_CONFIG = {
  // GPS更新間隔（ミリ秒）
  UPDATE_INTERVAL: parseInt(import.meta.env.VITE_GPS_UPDATE_INTERVAL || '5000', 10),
  
  // GPS高精度モード
  ENABLE_HIGH_ACCURACY: true,
  
  // タイムアウト（ミリ秒）
  TIMEOUT: 10000,
  
  // キャッシュ最大使用期限（ミリ秒）
  MAXIMUM_AGE: 0,
  
  // 最小移動距離（メートル） - この距離以上移動した場合のみ記録
  MIN_DISTANCE_METERS: 1,
  
  // 最小速度（km/h） - この速度以上で方位を更新
  MIN_SPEED_FOR_HEADING: 1.0,
  
  // 方位平滑化バッファサイズ
  HEADING_BUFFER_SIZE: 3,
  
  // 速度平滑化バッファサイズ
  SPEED_BUFFER_SIZE: 2,
  
  // 方位更新間隔（ミリ秒）
  HEADING_UPDATE_INTERVAL: 500,
  
  // GPS精度閾値（メートル）
  ACCURACY_THRESHOLD: {
    HIGH: 10,
    MEDIUM: 30,
    LOW: 50,
    POOR: Infinity
  }
};

// =============================================================================
// マップ設定
// =============================================================================

export const MAP_CONFIG = {
  // Google Maps APIキー
  API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  
  // デフォルト中心座標（大阪）
  DEFAULT_CENTER: {
    lat: 34.6937,
    lng: 135.5023
  },
  
  // デフォルトズームレベル
  DEFAULT_ZOOM: 18,
  
  // マップID（WebGL Vector Map用）
  MAP_ID: 'DEMO_MAP_ID',
  
  // マップ設定
  OPTIONS: {
    heading: 0,
    tilt: 0,
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy' as const,
    tiltInteractionEnabled: true,
    headingInteractionEnabled: true
  },
  
  // マーカー設定
  MARKER: {
    SIZE: { width: 60, height: 80 },
    ANCHOR: { x: 30, y: 40 }
  },
  
  // ポリライン設定（軌跡）
  POLYLINE: {
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 4,
    zIndex: 999
  }
};

// =============================================================================
// API設定
// =============================================================================

export const API_CONFIG = {
  // ベースURL
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://10.1.119.244:8000/api/v1',
  
  // タイムアウト（ミリ秒）
  TIMEOUT: 30000,
  
  // リトライ回数
  RETRY_COUNT: 3,
  
  // リトライ間隔（ミリ秒）
  RETRY_DELAY: 1000,
  
  // GPS送信バッチサイズ
  GPS_BATCH_SIZE: 10,
  
  // GPS送信間隔（ミリ秒）
  GPS_SEND_INTERVAL: 30000
};

// =============================================================================
// オフライン設定
// =============================================================================

export const OFFLINE_CONFIG = {
  // オフラインモード有効化
  ENABLED: true,
  
  // 最大保存データ数
  MAX_STORAGE_ITEMS: 1000,
  
  // 自動同期間隔（ミリ秒）
  SYNC_INTERVAL: 60000,
  
  // ローカルストレージキー
  STORAGE_KEYS: {
    GPS_LOGS: 'offline_gps_logs',
    OPERATIONS: 'offline_operations',
    ACTIONS: 'offline_actions'
  }
};

// =============================================================================
// 運行記録設定
// =============================================================================

export const OPERATION_CONFIG = {
  // 運行状態
  STATUS: {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed'
  } as const,
  
  // アクションタイプ
  ACTION_TYPES: {
    LOADING_ARRIVAL: '積込場所到着',
    UNLOADING_ARRIVAL: '積降場所到着',
    BREAK: '休憩・荷待ち',
    REFUEL: '給油'
  } as const,
  
  // 自動保存間隔（ミリ秒）
  AUTO_SAVE_INTERVAL: 60000
};

// =============================================================================
// UI設定
// =============================================================================

export const UI_CONFIG = {
  // トースト表示時間（ミリ秒）
  TOAST_DURATION: 3000,
  
  // ローディング表示遅延（ミリ秒）
  LOADING_DELAY: 300,
  
  // アニメーション時間（ミリ秒）
  ANIMATION_DURATION: 300,
  
  // モバイル画面サイズ
  MOBILE_BREAKPOINT: 640,
  
  // 最大コンテナ幅
  MAX_CONTAINER_WIDTH: 480
};

// =============================================================================
// ローカルストレージキー
// =============================================================================

export const STORAGE_KEYS = {
  // 認証
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  
  // 設定
  USER_PREFERENCES: 'user_preferences',
  GPS_ENABLED: 'gps_enabled',
  
  // オフラインデータ
  OFFLINE_GPS_LOGS: 'offline_gps_logs',
  OFFLINE_OPERATIONS: 'offline_operations',
  OFFLINE_ACTIONS: 'offline_actions',
  
  // 統計
  TOTAL_DISTANCE: 'total_distance',
  TOTAL_DURATION: 'total_duration'
};

// =============================================================================
// エラーメッセージ
// =============================================================================

export const ERROR_MESSAGES = {
  // GPS関連
  GPS_PERMISSION_DENIED: 'GPS位置情報の使用が許可されていません。ブラウザの設定を確認してください。',
  GPS_POSITION_UNAVAILABLE: 'GPS位置情報を取得できません。GPS機能を確認してください。',
  GPS_TIMEOUT: 'GPS位置情報の取得がタイムアウトしました。',
  GPS_UNKNOWN_ERROR: 'GPS位置情報の取得中にエラーが発生しました。',
  
  // 認証関連
  AUTH_FAILED: 'ログインに失敗しました。ユーザー名とパスワードを確認してください。',
  AUTH_TOKEN_EXPIRED: '認証トークンの有効期限が切れました。再度ログインしてください。',
  AUTH_UNAUTHORIZED: 'この操作を実行する権限がありません。',
  
  // ネットワーク関連
  NETWORK_ERROR: 'ネットワークエラーが発生しました。接続を確認してください。',
  SERVER_ERROR: 'サーバーエラーが発生しました。しばらくしてから再度お試しください。',
  
  // 運行関連
  OPERATION_START_FAILED: '運行開始に失敗しました。',
  OPERATION_END_FAILED: '運行終了に失敗しました。',
  OPERATION_NOT_FOUND: '運行情報が見つかりません。',
  
  // データ保存関連
  SAVE_FAILED: 'データの保存に失敗しました。',
  LOAD_FAILED: 'データの読み込みに失敗しました。'
};

// =============================================================================
// 成功メッセージ
// =============================================================================

export const SUCCESS_MESSAGES = {
  // 認証関連
  LOGIN_SUCCESS: 'ログインしました',
  LOGOUT_SUCCESS: 'ログアウトしました',
  
  // 運行関連
  OPERATION_STARTED: '運行を開始しました',
  OPERATION_ENDED: '運行を終了しました',
  ACTION_RECORDED: 'アクションを記録しました',
  
  // GPS関連
  GPS_ENABLED: 'GPS追跡を開始しました',
  GPS_DISABLED: 'GPS追跡を停止しました',
  
  // データ同期
  SYNC_SUCCESS: 'データを同期しました',
  SAVE_SUCCESS: 'データを保存しました'
};

// =============================================================================
// アプリケーション情報
// =============================================================================

export const APP_INFO = {
  NAME: 'ダンプ運行記録アプリ',
  VERSION: '1.0.0',
  DESCRIPTION: 'ダンプトラック運行記録・GPS追跡・運行管理システム',
  DEVELOPER: 'Development Team',
  COPYRIGHT: '© 2025 Dump Tracker. All rights reserved.'
};

// =============================================================================
// デバッグ設定
// =============================================================================

export const DEBUG_CONFIG = {
  // デバッグモード
  ENABLED: import.meta.env.MODE === 'development',
  
  // ログレベル
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL || 'info',
  
  // GPS座標ログ出力
  LOG_GPS_POSITION: true,
  
  // API通信ログ出力
  LOG_API_CALLS: true,
  
  // パフォーマンス計測
  MEASURE_PERFORMANCE: true
};

// =============================================================================
// 地図マーカーSVG生成用定数
// =============================================================================

export const MARKER_CONFIG = {
  WIDTH: 60,
  HEIGHT: 80,
  
  // 色設定
  COLORS: {
    PRIMARY: '#4285F4',
    BACKGROUND: 'rgba(255,255,255,0.9)',
    BORDER: '#ffffff',
    TEXT: '#333',
    SPEED_TEXT: '#4285F4',
    SUBTITLE: '#666'
  },
  
  // フォント設定
  FONTS: {
    DISTANCE: { size: 8, weight: 'bold' },
    SPEED: { size: 10, weight: 'bold' },
    UNIT: { size: 6, weight: 'normal' }
  }
};

// =============================================================================
// 方位テキスト
// =============================================================================

export const DIRECTION_NAMES = {
  // 8方位
  DIRECTION_8: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'],
  
  // 16方位
  DIRECTION_16: [
    '北', '北北東', '北東', '東北東',
    '東', '東南東', '南東', '南南東',
    '南', '南南西', '南西', '西南西',
    '西', '西北西', '北西', '北北西'
  ]
};

// =============================================================================
// デフォルトエクスポート
// =============================================================================

export default {
  GPS_CONFIG,
  MAP_CONFIG,
  API_CONFIG,
  OFFLINE_CONFIG,
  OPERATION_CONFIG,
  UI_CONFIG,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  APP_INFO,
  DEBUG_CONFIG,
  MARKER_CONFIG,
  DIRECTION_NAMES
};