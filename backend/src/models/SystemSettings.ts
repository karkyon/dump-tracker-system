// backend/src/models/SystemSetting.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * システム設定モデル - Prismaスキーマ完全準拠版
 * システム全体の設定・パラメータ管理
 * key-value形式の設定ストア
 */

// =====================================
// 基本型定義（Prismaスキーマ準拠）
// =====================================

export interface SystemSettingModel {
  key: string;
  value?: string | null;
  description?: string | null;
}

export interface SystemSettingCreateInput {
  key: string;
  value?: string;
  description?: string;
}

export interface SystemSettingUpdateInput {
  value?: string;
  description?: string;
}

export interface SystemSettingWhereInput {
  key?: string | { contains?: string; mode?: 'insensitive' };
  value?: string | { contains?: string; mode?: 'insensitive' };
  description?: { contains?: string; mode?: 'insensitive' };
}

export interface SystemSettingOrderByInput {
  key?: 'asc' | 'desc';
  value?: 'asc' | 'desc';
  description?: 'asc' | 'desc';
}

// =====================================
// フロントエンド用追加型
// =====================================

export interface SystemSettingResponseDTO {
  key: string;
  value?: string | null;
  description?: string | null;
  category?: string;
  data_type?: 'string' | 'number' | 'boolean' | 'json';
  is_readonly?: boolean;
  validation_rule?: string;
}

export interface SystemSettingGroup {
  category: string;
  display_name: string;
  description?: string;
  settings: SystemSettingResponseDTO[];
}

export interface SystemConfigSnapshot {
  timestamp: Date;
  total_settings: number;
  categories: string[];
  settings_by_category: { [category: string]: number };
  recent_changes: RecentSettingChange[];
}

export interface RecentSettingChange {
  key: string;
  old_value?: string;
  new_value?: string;
  changed_at: Date;
  changed_by?: string;
  description?: string;
}

export interface SystemHealthCheck {
  database_connection: boolean;
  required_settings_present: boolean;
  configuration_valid: boolean;
  missing_settings: string[];
  invalid_settings: string[];
  warnings: string[];
}

// =====================================
// 定数定義（デフォルト設定）
// =====================================

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingCreateInput[] = [
  // 基本設定
  { key: 'COMPANY_NAME', value: 'ダンプ運送株式会社', description: '会社名' },
  { key: 'SYSTEM_NAME', value: 'ダンプ運行記録システム', description: 'システム名' },
  { key: 'TIMEZONE', value: 'Asia/Tokyo', description: 'タイムゾーン' },
  { key: 'LANGUAGE', value: 'ja', description: '言語設定' },
  { key: 'DATE_FORMAT', value: 'YYYY/MM/DD', description: '日付形式' },
  { key: 'TIME_FORMAT', value: '24h', description: '時刻形式' },
  
  // GPS・位置情報設定
  { key: 'GPS_UPDATE_INTERVAL', value: '30', description: 'GPS更新間隔（秒）' },
  { key: 'GPS_ACCURACY_THRESHOLD', value: '50', description: 'GPS精度閾値（メートル）' },
  { key: 'GEOFENCE_RADIUS', value: '100', description: 'ジオフェンス半径（メートル）' },
  
  // 運行管理設定
  { key: 'AUTO_OPERATION_COMPLETE', value: 'false', description: '自動運行完了機能' },
  { key: 'OPERATION_TIMEOUT_HOURS', value: '24', description: '運行タイムアウト（時間）' },
  { key: 'FUEL_EFFICIENCY_THRESHOLD', value: '3.5', description: '燃費効率閾値（km/L）' },
  
  // 点検・メンテナンス設定
  { key: 'INSPECTION_REMINDER_DAYS', value: '7', description: '点検リマインダー（日前）' },
  { key: 'MAINTENANCE_ALERT_MILEAGE', value: '1000', description: 'メンテナンス警告走行距離（km）' },
  { key: 'VEHICLE_INSPECTION_INTERVAL', value: '365', description: '車検間隔（日）' },
  
  // データ管理設定
  { key: 'DATA_RETENTION_DAYS', value: '1095', description: 'データ保持期間（日）' },
  { key: 'BACKUP_INTERVAL_HOURS', value: '24', description: 'バックアップ間隔（時間）' },
  { key: 'LOG_LEVEL', value: 'INFO', description: 'ログレベル' },
  
  // 通知設定
  { key: 'EMAIL_NOTIFICATIONS', value: 'true', description: 'メール通知有効' },
  { key: 'SMS_NOTIFICATIONS', value: 'false', description: 'SMS通知有効' },
  { key: 'PUSH_NOTIFICATIONS', value: 'true', description: 'プッシュ通知有効' },
  
  // セキュリティ設定
  { key: 'SESSION_TIMEOUT_MINUTES', value: '480', description: 'セッションタイムアウト（分）' },
  { key: 'PASSWORD_MIN_LENGTH', value: '8', description: 'パスワード最小長' },
  { key: 'LOGIN_ATTEMPT_LIMIT', value: '5', description: 'ログイン試行回数制限' },
  
  // 帳票設定
  { key: 'REPORT_FORMAT_DEFAULT', value: 'PDF', description: 'デフォルト帳票形式' },
  { key: 'REPORT_LOGO_URL', value: '', description: '帳票ロゴURL' },
  { key: 'REPORT_FOOTER_TEXT', value: '', description: '帳票フッターテキスト' }
];

export const SETTING_CATEGORIES = {
  BASIC: '基本設定',
  GPS: 'GPS・位置情報',
  OPERATION: '運行管理',
  INSPECTION: '点検・メンテナンス',
  DATA: 'データ管理',
  NOTIFICATION: '通知設定',
  SECURITY: 'セキュリティ',
  REPORT: '帳票設定'
};

// =====================================
// システム設定モデルクラス
// =====================================

export class SystemSetting {
  constructor(private prisma: PrismaClient = prisma) {}

  /**
   * システム設定作成
   */
  async create(data: SystemSettingCreateInput): Promise<SystemSettingModel> {
    try {
      return await this.prisma.system_settings.create({
        data
      });
    } catch (error) {
      throw new Error(`システム設定作成エラー: ${error}`);
    }
  }

  /**
   * システム設定取得（キー指定）
   */
  async findByKey(key: string): Promise<SystemSettingModel | null> {
    try {
      return await this.prisma.system_settings.findUnique({
        where: { key }
      });
    } catch (error) {
      throw new Error(`システム設定取得エラー: ${error}`);
    }
  }

  /**
   * システム設定一覧取得
   */
  async findMany(params: {
    where?: SystemSettingWhereInput;
    orderBy?: SystemSettingOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<SystemSettingModel[]> {
    try {
      return await this.prisma.system_settings.findMany({
        where: params.where,
        orderBy: params.orderBy || { key: 'asc' },
        skip: params.skip,
        take: params.take
      });
    } catch (error) {
      throw new Error(`システム設定一覧取得エラー: ${error}`);
    }
  }

  /**
   * システム設定更新
   */
  async update(key: string, data: SystemSettingUpdateInput): Promise<SystemSettingModel> {
    try {
      return await this.prisma.system_settings.update({
        where: { key },
        data
      });
    } catch (error) {
      throw new Error(`システム設定更新エラー: ${error}`);
    }
  }

  /**
   * システム設定削除
   */
  async delete(key: string): Promise<SystemSettingModel> {
    try {
      return await this.prisma.system_settings.delete({
        where: { key }
      });
    } catch (error) {
      throw new Error(`システム設定削除エラー: ${error}`);
    }
  }

  /**
   * システム設定数カウント
   */
  async count(where?: SystemSettingWhereInput): Promise<number> {
    try {
      return await this.prisma.system_settings.count({ where });
    } catch (error) {
      throw new Error(`システム設定数取得エラー: ${error}`);
    }
  }

  /**
   * 設定値取得（型安全）
   */
  async getValue<T>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const setting = await this.findByKey(key);
      if (!setting?.value) {
        return defaultValue || null;
      }

      // 型変換の試行
      const value = setting.value;
      
      // 数値の場合
      if (!isNaN(Number(value))) {
        return Number(value) as T;
      }
      
      // ブール値の場合
      if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
        return (value.toLowerCase() === 'true') as T;
      }
      
      // JSONの場合
      try {
        return JSON.parse(value) as T;
      } catch {
        // 文字列として返す
        return value as T;
      }
    } catch (error) {
      throw new Error(`設定値取得エラー: ${error}`);
    }
  }

  /**
   * 設定値更新（型安全）
   */
  async setValue(key: string, value: any, description?: string): Promise<SystemSettingModel> {
    try {
      let stringValue: string;
      
      if (typeof value === 'object') {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }

      const existing = await this.findByKey(key);
      
      if (existing) {
        return await this.update(key, { 
          value: stringValue,
          description: description || existing.description
        });
      } else {
        return await this.create({ 
          key, 
          value: stringValue, 
          description 
        });
      }
    } catch (error) {
      throw new Error(`設定値更新エラー: ${error}`);
    }
  }

  /**
   * カテゴリ別設定取得
   */
  async getSettingsByCategory(): Promise<SystemSettingGroup[]> {
    try {
      const allSettings = await this.findMany({});
      const groups: { [category: string]: SystemSettingResponseDTO[] } = {};

      // カテゴリ別にグループ化
      allSettings.forEach(setting => {
        const category = this.getCategoryFromKey(setting.key);
        if (!groups[category]) {
          groups[category] = [];
        }
        
        groups[category].push({
          ...setting,
          category,
          data_type: this.getDataType(setting.value),
          is_readonly: this.isReadonlySetting(setting.key),
          validation_rule: this.getValidationRule(setting.key)
        });
      });

      // グループをソート済み配列に変換
      return Object.entries(groups).map(([category, settings]) => ({
        category,
        display_name: SETTING_CATEGORIES[category as keyof typeof SETTING_CATEGORIES] || category,
        description: this.getCategoryDescription(category),
        settings: settings.sort((a, b) => a.key.localeCompare(b.key))
      })).sort((a, b) => a.display_name.localeCompare(b.display_name));
    } catch (error) {
      throw new Error(`カテゴリ別設定取得エラー: ${error}`);
    }
  }

  /**
   * デフォルト設定の初期化
   */
  async initializeDefaultSettings(): Promise<{ created: number; skipped: number }> {
    try {
      let created = 0;
      let skipped = 0;

      for (const defaultSetting of DEFAULT_SYSTEM_SETTINGS) {
        const existing = await this.findByKey(defaultSetting.key);
        if (!existing) {
          await this.create(defaultSetting);
          created++;
        } else {
          skipped++;
        }
      }

      return { created, skipped };
    } catch (error) {
      throw new Error(`デフォルト設定初期化エラー: ${error}`);
    }
  }

  /**
   * システムヘルスチェック
   */
  async performHealthCheck(): Promise<SystemHealthCheck> {
    try {
      const allSettings = await this.findMany({});
      const requiredKeys = DEFAULT_SYSTEM_SETTINGS.map(s => s.key);
      const existingKeys = allSettings.map(s => s.key);
      
      const missing_settings = requiredKeys.filter(key => !existingKeys.includes(key));
      const invalid_settings: string[] = [];
      const warnings: string[] = [];

      // 設定値の検証
      for (const setting of allSettings) {
        const validation = this.validateSetting(setting.key, setting.value);
        if (!validation.isValid) {
          invalid_settings.push(`${setting.key}: ${validation.error}`);
        }
        if (validation.warning) {
          warnings.push(`${setting.key}: ${validation.warning}`);
        }
      }

      return {
        database_connection: true,
        required_settings_present: missing_settings.length === 0,
        configuration_valid: invalid_settings.length === 0,
        missing_settings,
        invalid_settings,
        warnings
      };
    } catch (error) {
      return {
        database_connection: false,
        required_settings_present: false,
        configuration_valid: false,
        missing_settings: [],
        invalid_settings: [`データベース接続エラー: ${error}`],
        warnings: []
      };
    }
  }

  /**
   * バルク設定更新
   */
  async updateMultiple(updates: { key: string; value: string; description?: string }[]): Promise<{ updated: number; errors: string[] }> {
    try {
      let updated = 0;
      const errors: string[] = [];

      for (const update of updates) {
        try {
          await this.setValue(update.key, update.value, update.description);
          updated++;
        } catch (error) {
          errors.push(`${update.key}: ${error}`);
        }
      }

      return { updated, errors };
    } catch (error) {
      throw new Error(`バルク設定更新エラー: ${error}`);
    }
  }

  /**
   * 設定存在確認
   */
  async exists(key: string): Promise<boolean> {
    try {
      const setting = await this.findByKey(key);
      return setting !== null;
    } catch (error) {
      throw new Error(`設定存在確認エラー: ${error}`);
    }
  }

  // =====================================
  // プライベートヘルパーメソッド
  // =====================================

  private getCategoryFromKey(key: string): string {
    if (key.startsWith('GPS_')) return 'GPS';
    if (key.startsWith('OPERATION_')) return 'OPERATION';
    if (key.startsWith('INSPECTION_') || key.startsWith('MAINTENANCE_') || key.startsWith('VEHICLE_')) return 'INSPECTION';
    if (key.startsWith('DATA_') || key.startsWith('BACKUP_') || key.startsWith('LOG_')) return 'DATA';
    if (key.includes('NOTIFICATION')) return 'NOTIFICATION';
    if (key.startsWith('SESSION_') || key.startsWith('PASSWORD_') || key.startsWith('LOGIN_')) return 'SECURITY';
    if (key.startsWith('REPORT_')) return 'REPORT';
    return 'BASIC';
  }

  private getDataType(value?: string | null): 'string' | 'number' | 'boolean' | 'json' {
    if (!value) return 'string';
    if (!isNaN(Number(value))) return 'number';
    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') return 'boolean';
    if (value.startsWith('{') || value.startsWith('[')) return 'json';
    return 'string';
  }

  private isReadonlySetting(key: string): boolean {
    const readonlyKeys = ['SYSTEM_NAME', 'TIMEZONE'];
    return readonlyKeys.includes(key);
  }

  private getValidationRule(key: string): string {
    const rules: { [key: string]: string } = {
      'GPS_UPDATE_INTERVAL': 'min:10,max:300',
      'SESSION_TIMEOUT_MINUTES': 'min:30,max:1440',
      'PASSWORD_MIN_LENGTH': 'min:6,max:128',
      'LOGIN_ATTEMPT_LIMIT': 'min:3,max:10',
      'DATA_RETENTION_DAYS': 'min:30,max:3650'
    };
    return rules[key] || '';
  }

  private getCategoryDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
      'BASIC': 'システムの基本的な設定項目',
      'GPS': 'GPS追跡・位置情報に関する設定',
      'OPERATION': '運行管理・効率化に関する設定',
      'INSPECTION': '点検・メンテナンスに関する設定',
      'DATA': 'データ管理・バックアップに関する設定',
      'NOTIFICATION': '通知機能に関する設定',
      'SECURITY': 'セキュリティ・認証に関する設定',
      'REPORT': '帳票出力に関する設定'
    };
    return descriptions[category] || '';
  }

  private validateSetting(key: string, value?: string | null): { isValid: boolean; error?: string; warning?: string } {
    if (!value) return { isValid: true };

    try {
      switch (key) {
        case 'GPS_UPDATE_INTERVAL':
          const interval = Number(value);
          if (interval < 10 || interval > 300) {
            return { isValid: false, error: '10-300秒の範囲で設定してください' };
          }
          break;
        
        case 'SESSION_TIMEOUT_MINUTES':
          const timeout = Number(value);
          if (timeout < 30 || timeout > 1440) {
            return { isValid: false, error: '30-1440分の範囲で設定してください' };
          }
          break;
        
        case 'EMAIL_NOTIFICATIONS':
        case 'SMS_NOTIFICATIONS':
        case 'PUSH_NOTIFICATIONS':
          if (!['true', 'false'].includes(value.toLowerCase())) {
            return { isValid: false, error: 'true または false で設定してください' };
          }
          break;
      }
      
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `検証エラー: ${error}` };
    }
  }

  /**
   * フロントエンド用データ変換
   */
  toResponseDTO(setting: SystemSettingModel): SystemSettingResponseDTO {
    return {
      key: setting.key,
      value: setting.value,
      description: setting.description,
      category: this.getCategoryFromKey(setting.key),
      data_type: this.getDataType(setting.value),
      is_readonly: this.isReadonlySetting(setting.key),
      validation_rule: this.getValidationRule(setting.key)
    };
  }
}

// =====================================
// デフォルトエクスポート
// =====================================

export const systemSettingModel = new SystemSetting();
export default systemSettingModel;