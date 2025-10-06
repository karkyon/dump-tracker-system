// =====================================
// backend/src/utils/validation.ts
// バリデーションユーティリティ
// 作成日時: Fri Sep 26 17:10:00 JST 2025 - 緊急修正版
// アーキテクチャ指針準拠版 - Phase 1基盤拡張
// =====================================

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

// 🎯 Phase 1完成基盤の活用
import { ValidationError } from './errors';
import { sendValidationError } from './response';

// =====================================
// バリデーション結果型
// =====================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

export interface FieldValidation {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

// =====================================
// 基本バリデーション関数
// =====================================

/**
 * 空文字・null・undefined チェック
 */
export function isRequired(value: any): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * 文字列長チェック
 */
export function isLength(value: string, min: number, max?: number): boolean {
  if (typeof value !== 'string') return false;
  const length = value.length;
  return length >= min && (max === undefined || length <= max);
}

/**
 * メールアドレス形式チェック
 */
export function isEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * 数値チェック
 */
export function isNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 整数チェック
 */
export function isInteger(value: any): boolean {
  return Number.isInteger(value);
}

/**
 * 正の数チェック
 */
export function isPositive(value: number): boolean {
  return isNumber(value) && value > 0;
}

/**
 * 範囲チェック
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return isNumber(value) && value >= min && value <= max;
}

/**
 * 日付チェック
 */
export function isDate(value: any): boolean {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
}

/**
 * URLチェック
 */
export function isURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 配列チェック
 */
export function isArray(value: any): boolean {
  return Array.isArray(value);
}

/**
 * 文字列配列内チェック
 */
export function isInArray(value: any, allowedValues: any[]): boolean {
  return allowedValues.includes(value);
}

// =====================================
// 複合バリデーション関数
// =====================================

/**
 * ユーザー名バリデーション
 */
export function validateUsername(username: string): FieldValidation[] {
  const errors: FieldValidation[] = [];

  if (!isRequired(username)) {
    errors.push({
      field: 'username',
      message: 'ユーザー名は必須です',
      constraint: 'required'
    });
  } else {
    if (!isLength(username, 3, 50)) {
      errors.push({
        field: 'username',
        message: 'ユーザー名は3文字以上50文字以下である必要があります',
        value: username,
        constraint: 'length'
      });
    }

    // 英数字とアンダースコアのみ許可
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      errors.push({
        field: 'username',
        message: 'ユーザー名は英数字とアンダースコアのみ使用できます',
        value: username,
        constraint: 'pattern'
      });
    }
  }

  return errors;
}

/**
 * パスワードバリデーション
 */
export function validatePassword(password: string): FieldValidation[] {
  const errors: FieldValidation[] = [];

  if (!isRequired(password)) {
    errors.push({
      field: 'password',
      message: 'パスワードは必須です',
      constraint: 'required'
    });
  } else {
    if (!isLength(password, 8, 100)) {
      errors.push({
        field: 'password',
        message: 'パスワードは8文字以上100文字以下である必要があります',
        value: '***hidden***',
        constraint: 'length'
      });
    }

    // 強いパスワード要件
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUppercase) {
      errors.push({
        field: 'password',
        message: 'パスワードには大文字を含める必要があります',
        constraint: 'uppercase_required'
      });
    }

    if (!hasLowercase) {
      errors.push({
        field: 'password',
        message: 'パスワードには小文字を含める必要があります',
        constraint: 'lowercase_required'
      });
    }

    if (!hasNumber) {
      errors.push({
        field: 'password',
        message: 'パスワードには数字を含める必要があります',
        constraint: 'number_required'
      });
    }

    if (!hasSpecialChar) {
      errors.push({
        field: 'password',
        message: 'パスワードには特殊文字を含める必要があります',
        constraint: 'special_char_required'
      });
    }
  }

  return errors;
}

/**
 * メールアドレスバリデーション
 */
export function validateEmail(email: string): FieldValidation[] {
  const errors: FieldValidation[] = [];

  if (!isRequired(email)) {
    errors.push({
      field: 'email',
      message: 'メールアドレスは必須です',
      constraint: 'required'
    });
  } else {
    if (!isEmail(email)) {
      errors.push({
        field: 'email',
        message: '正しいメールアドレス形式で入力してください',
        value: email,
        constraint: 'email_format'
      });
    }
  }

  return errors;
}

// =====================================
// ドメイン固有バリデーション
// =====================================

/**
 * 車両番号バリデーション
 */
export function validatePlateNumber(plateNumber: string): FieldValidation[] {
  const errors: FieldValidation[] = [];

  if (!isRequired(plateNumber)) {
    errors.push({
      field: 'plateNumber',
      message: '車両番号は必須です',
      constraint: 'required'
    });
  } else {
    // 日本の車両番号パターン（簡易版）
    const plateRegex = /^[ぁ-んァ-ヶ一-龯0-9\s\-]{3,20}$/;
    if (!plateRegex.test(plateNumber)) {
      errors.push({
        field: 'plateNumber',
        message: '正しい車両番号形式で入力してください',
        value: plateNumber,
        constraint: 'plate_number_format'
      });
    }
  }

  return errors;
}

/**
 * 座標バリデーション
 */
export function validateCoordinates(latitude: number, longitude: number): FieldValidation[] {
  const errors: FieldValidation[] = [];

  if (!isNumber(latitude) || !isInRange(latitude, -90, 90)) {
    errors.push({
      field: 'latitude',
      message: '緯度は-90から90の範囲で入力してください',
      value: latitude,
      constraint: 'coordinate_range'
    });
  }

  if (!isNumber(longitude) || !isInRange(longitude, -180, 180)) {
    errors.push({
      field: 'longitude',
      message: '経度は-180から180の範囲で入力してください',
      value: longitude,
      constraint: 'coordinate_range'
    });
  }

  return errors;
}

// =====================================
// スキーマベースバリデーション
// =====================================

/**
 * レポートバリデーション
 */
export const reportValidation = {
  createReport: (data: any): FieldValidation[] => {
    const errors: FieldValidation[] = [];

    if (!isRequired(data.reportType)) {
      errors.push({
        field: 'reportType',
        message: 'レポート種別は必須です',
        constraint: 'required'
      });
    } else {
      const allowedTypes = [
        'DAILY_OPERATION',
        'MONTHLY_OPERATION',
        'VEHICLE_UTILIZATION',
        'DRIVER_PERFORMANCE',
        'TRANSPORTATION_SUMMARY',
        'INSPECTION_SUMMARY',
        'CUSTOM'
      ];
      if (!isInArray(data.reportType, allowedTypes)) {
        errors.push({
          field: 'reportType',
          message: '無効なレポート種別です',
          value: data.reportType,
          constraint: 'invalid_enum'
        });
      }
    }

    if (data.startDate && !isDate(data.startDate)) {
      errors.push({
        field: 'startDate',
        message: '正しい開始日付を入力してください',
        value: data.startDate,
        constraint: 'invalid_date'
      });
    }

    if (data.endDate && !isDate(data.endDate)) {
      errors.push({
        field: 'endDate',
        message: '正しい終了日付を入力してください',
        value: data.endDate,
        constraint: 'invalid_date'
      });
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (start > end) {
        errors.push({
          field: 'endDate',
          message: '終了日付は開始日付より後である必要があります',
          constraint: 'date_range'
        });
      }
    }

    return errors;
  }
};

/**
 * ユーザーバリデーション
 */
export const userValidation = {
  createUser: (data: any): FieldValidation[] => {
    const errors: FieldValidation[] = [];

    errors.push(...validateUsername(data.username || ''));
    errors.push(...validateEmail(data.email || ''));
    errors.push(...validatePassword(data.password || ''));

    if (data.role && !isInArray(data.role, ['ADMIN', 'MANAGER', 'DRIVER'])) {
      errors.push({
        field: 'role',
        message: '無効な役割です',
        value: data.role,
        constraint: 'invalid_enum'
      });
    }

    return errors;
  },

  updateUser: (data: any): FieldValidation[] => {
    const errors: FieldValidation[] = [];

    if (data.username !== undefined) {
      errors.push(...validateUsername(data.username));
    }

    if (data.email !== undefined) {
      errors.push(...validateEmail(data.email));
    }

    if (data.password !== undefined) {
      errors.push(...validatePassword(data.password));
    }

    if (data.role !== undefined && !isInArray(data.role, ['ADMIN', 'MANAGER', 'DRIVER'])) {
      errors.push({
        field: 'role',
        message: '無効な役割です',
        value: data.role,
        constraint: 'invalid_enum'
      });
    }

    return errors;
  }
};

/**
 * 車両バリデーション
 */
export const vehicleValidation = {
  createVehicle: (data: any): FieldValidation[] => {
    const errors: FieldValidation[] = [];

    errors.push(...validatePlateNumber(data.plateNumber || ''));

    if (!isRequired(data.model)) {
      errors.push({
        field: 'model',
        message: '車両モデルは必須です',
        constraint: 'required'
      });
    }

    if (!isRequired(data.manufacturer)) {
      errors.push({
        field: 'manufacturer',
        message: 'メーカーは必須です',
        constraint: 'required'
      });
    }

    if (data.year !== undefined) {
      const currentYear = new Date().getFullYear();
      if (!isInteger(data.year) || !isInRange(data.year, 1900, currentYear + 1)) {
        errors.push({
          field: 'year',
          message: `年式は1900年から${currentYear + 1}年の範囲で入力してください`,
          value: data.year,
          constraint: 'year_range'
        });
      }
    }

    if (data.capacity !== undefined && (!isNumber(data.capacity) || !isPositive(data.capacity))) {
      errors.push({
        field: 'capacity',
        message: '積載量は正の数で入力してください',
        value: data.capacity,
        constraint: 'positive_number'
      });
    }

    if (data.fuelType && !isInArray(data.fuelType, ['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC'])) {
      errors.push({
        field: 'fuelType',
        message: '無効な燃料種別です',
        value: data.fuelType,
        constraint: 'invalid_enum'
      });
    }

    return errors;
  }
};

/**
 * 運行バリデーション
 */
export const tripValidation = {
  createTrip: (data: any): FieldValidation[] => {
    const errors: FieldValidation[] = [];

    if (!isRequired(data.vehicleId)) {
      errors.push({
        field: 'vehicleId',
        message: '車両IDは必須です',
        constraint: 'required'
      });
    }

    if (!isRequired(data.driverId)) {
      errors.push({
        field: 'driverId',
        message: '運転手IDは必須です',
        constraint: 'required'
      });
    }

    if (!isRequired(data.startTime)) {
      errors.push({
        field: 'startTime',
        message: '開始時刻は必須です',
        constraint: 'required'
      });
    } else if (!isDate(data.startTime)) {
      errors.push({
        field: 'startTime',
        message: '正しい開始時刻を入力してください',
        value: data.startTime,
        constraint: 'invalid_date'
      });
    }

    if (data.plannedEndTime && !isDate(data.plannedEndTime)) {
      errors.push({
        field: 'plannedEndTime',
        message: '正しい予定終了時刻を入力してください',
        value: data.plannedEndTime,
        constraint: 'invalid_date'
      });
    }

    if (data.startTime && data.plannedEndTime) {
      const start = new Date(data.startTime);
      const plannedEnd = new Date(data.plannedEndTime);
      if (start >= plannedEnd) {
        errors.push({
          field: 'plannedEndTime',
          message: '予定終了時刻は開始時刻より後である必要があります',
          constraint: 'time_range'
        });
      }
    }

    return errors;
  },

  addActivity: (data: any): FieldValidation[] => {
    const errors: FieldValidation[] = [];

    if (!isRequired(data.locationId)) {
      errors.push({
        field: 'locationId',
        message: '場所IDは必須です',
        constraint: 'required'
      });
    }

    if (!isRequired(data.activityType)) {
      errors.push({
        field: 'activityType',
        message: 'アクティビティ種別は必須です',
        constraint: 'required'
      });
    } else {
      const allowedTypes = ['LOADING', 'UNLOADING', 'INSPECTION', 'MAINTENANCE', 'BREAK', 'OTHER'];
      if (!isInArray(data.activityType, allowedTypes)) {
        errors.push({
          field: 'activityType',
          message: '無効なアクティビティ種別です',
          value: data.activityType,
          constraint: 'invalid_enum'
        });
      }
    }

    if (!isRequired(data.startTime)) {
      errors.push({
        field: 'startTime',
        message: '開始時刻は必須です',
        constraint: 'required'
      });
    } else if (!isDate(data.startTime)) {
      errors.push({
        field: 'startTime',
        message: '正しい開始時刻を入力してください',
        value: data.startTime,
        constraint: 'invalid_date'
      });
    }

    if (data.endTime && !isDate(data.endTime)) {
      errors.push({
        field: 'endTime',
        message: '正しい終了時刻を入力してください',
        value: data.endTime,
        constraint: 'invalid_date'
      });
    }

    if (data.quantity !== undefined && (!isNumber(data.quantity) || data.quantity < 0)) {
      errors.push({
        field: 'quantity',
        message: '数量は0以上の数値で入力してください',
        value: data.quantity,
        constraint: 'non_negative_number'
      });
    }

    if (data.gpsLocation) {
      errors.push(...validateCoordinates(
        data.gpsLocation.latitude,
        data.gpsLocation.longitude
      ));
    }

    return errors;
  }
};

// =====================================
// メインバリデーション関数
// =====================================

/**
 * バリデーション実行とレスポンス送信
 */
export function validate(
  validationSchema: (data: any) => FieldValidation[],
  options: {
    continueOnError?: boolean;
    customErrorMessage?: string;
  } = {}
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationSchema(req.body);

      if (errors.length > 0) {
        sendValidationError(
          res,
          errors,
          options.customErrorMessage || 'バリデーションエラーが発生しました'
        );
        return;
      }

      next();
      return;
    } catch (error) {
      sendValidationError(
        res,
        [{
          field: 'validation',
          message: 'バリデーション処理でエラーが発生しました'
        }],
        'バリデーション処理エラー'
      );
      return;
    }
  };
}

export function validateQuery(
  validationSchema: (data: any) => FieldValidation[]
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationSchema(req.query);

      if (errors.length > 0) {
        sendValidationError(
          res,
          errors,
          'クエリパラメータのバリデーションエラーが発生しました'
        );
        return;
      }

      next();
      return;
    } catch (error) {
      sendValidationError(
        res,
        [{
          field: 'query',
          message: 'クエリパラメータのバリデーション処理でエラーが発生しました'
        }],
        'クエリバリデーション処理エラー'
      );
      return;
    }
  };
}

/**
 * データサニタイゼーション
 */
export function sanitizeData(data: any): any {
  if (typeof data === 'string') {
    // XSS防止のため基本的なHTMLタグを除去
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        sanitized[key] = sanitizeData(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}

// =====================================
// ページネーションバリデーション
// =====================================

/**
 * ページネーションパラメータのバリデーション
 */
export function validatePagination(query: any): FieldValidation[] {
  const errors: FieldValidation[] = [];

  if (query.page !== undefined) {
    const page = parseInt(query.page);
    if (!isInteger(page) || !isPositive(page)) {
      errors.push({
        field: 'page',
        message: 'ページ番号は1以上の整数で入力してください',
        value: query.page,
        constraint: 'positive_integer'
      });
    }
  }

  if (query.limit !== undefined) {
    const limit = parseInt(query.limit);
    if (!isInteger(limit) || !isInRange(limit, 1, 100)) {
      errors.push({
        field: 'limit',
        message: '取得件数は1から100の範囲で入力してください',
        value: query.limit,
        constraint: 'limit_range'
      });
    }
  }

  if (query.sortOrder !== undefined && !isInArray(query.sortOrder, ['asc', 'desc'])) {
    errors.push({
      field: 'sortOrder',
      message: 'ソート順は"asc"または"desc"で指定してください',
      value: query.sortOrder,
      constraint: 'invalid_sort_order'
    });
  }

  return errors;
}
