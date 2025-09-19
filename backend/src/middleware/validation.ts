import { Request, Response, NextFunction } from 'express';

/**
 * 汎用バリデーションミドルウェア
 */

// IDフォーマットのバリデーション（UUID or MongoDBのObjectId形式）
export function validateId(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '必須パラメータ: IDが指定されていません',
      error: 'MISSING_ID'
    });
  }
  
  // UUID v4形式のチェック
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // MongoDB ObjectId形式のチェック
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  // カスタムID形式（例: user-123, vehicle-456）
  const customIdRegex = /^[a-z]+-[0-9]+$/i;
  
  if (!uuidRegex.test(id) && !objectIdRegex.test(id) && !customIdRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: '無効なID形式です',
      error: 'INVALID_ID_FORMAT'
    });
  }
  
  next();
}

// 複数IDのバリデーション
export function validateIds(req: Request, res: Response, next: NextFunction) {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({
      success: false,
      message: 'IDの配列が必要です',
      error: 'INVALID_IDS'
    });
  }
  
  if (ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: '少なくとも1つのIDが必要です',
      error: 'EMPTY_IDS'
    });
  }
  
  next();
}

// ページネーションパラメータのバリデーション
export function validatePagination(req: Request, res: Response, next: NextFunction) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const sortBy = req.query.sortBy as string || 'createdAt';
  const sortOrder = req.query.sortOrder as string || 'desc';
  
  // ページ番号のバリデーション
  if (page < 1) {
    return res.status(400).json({
      success: false,
      message: 'ページ番号は1以上である必要があります',
      error: 'INVALID_PAGE'
    });
  }
  
  // リミットのバリデーション
  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'リミットは1-100の範囲で指定してください',
      error: 'INVALID_LIMIT'
    });
  }
  
  // ソート順のバリデーション
  if (!['asc', 'desc'].includes(sortOrder.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'ソート順はascまたはdescを指定してください',
      error: 'INVALID_SORT_ORDER'
    });
  }
  
  // バリデーション済みの値をreqに追加
  req.query.page = page.toString();
  req.query.limit = limit.toString();
  req.query.sortBy = sortBy;
  req.query.sortOrder = sortOrder.toLowerCase();
  
  next();
}

// 日付範囲のバリデーション
export function validateDateRange(req: Request, res: Response, next: NextFunction) {
  const { startDate, endDate } = req.query;
  
  if (startDate) {
    const start = new Date(startDate as string);
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: '無効な開始日です',
        error: 'INVALID_START_DATE'
      });
    }
  }
  
  if (endDate) {
    const end = new Date(endDate as string);
    if (isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: '無効な終了日です',
        error: 'INVALID_END_DATE'
      });
    }
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: '開始日は終了日より前である必要があります',
        error: 'INVALID_DATE_RANGE'
      });
    }
  }
  
  next();
}

// 認証ヘッダーのバリデーション（Bearer Token形式）
export function validateAuthHeader(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: '認証ヘッダーがありません',
      error: 'MISSING_AUTH_HEADER'
    });
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: '無効な認証ヘッダー形式です。Bearer <token>の形式で指定してください',
      error: 'INVALID_AUTH_HEADER'
    });
  }
  
  const token = parts[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'トークンが指定されていません',
      error: 'MISSING_TOKEN'
    });
  }
  
  // トークンをreqオブジェクトに追加
  (req as any).token = token;
  
  next();
}

// メールアドレスのバリデーション
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 電話番号のバリデーション（日本形式）
export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^0\d{9,10}$/;
  return phoneRegex.test(phone.replace(/-/g, ''));
}

// 必須フィールドのバリデーション用ヘルパー
export function validateRequiredFields(
  fields: string[],
  data: any
): { valid: boolean; missing?: string[] } {
  const missing: string[] = [];
  
  for (const field of fields) {
    if (!data[field]) {
      missing.push(field);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined
  };
}

// 数値範囲のバリデーション用ヘルパー
export function validateNumberRange(
  value: number,
  min?: number,
  max?: number
): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

// 文字列長のバリデーション用ヘルパー
export function validateStringLength(
  value: string,
  min?: number,
  max?: number
): boolean {
  const length = value.length;
  if (min !== undefined && length < min) return false;
  if (max !== undefined && length > max) return false;
  return true;
}

// APIキーのバリデーション
export function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'APIキーが必要です',
      error: 'MISSING_API_KEY'
    });
  }
  
  // APIキー形式のバリデーション（例: 32文字の16進数）
  const apiKeyRegex = /^[a-f0-9]{32}$/i;
  if (!apiKeyRegex.test(apiKey)) {
    return res.status(401).json({
      success: false,
      message: '無効なAPIキー形式です',
      error: 'INVALID_API_KEY'
    });
  }
  
  next();
}

// コンテンツタイプのバリデーション
export function validateContentType(allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      return res.status(400).json({
        success: false,
        message: 'Content-Typeヘッダーが必要です',
        error: 'MISSING_CONTENT_TYPE'
      });
    }
    
    const hasValidType = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!hasValidType) {
      return res.status(400).json({
        success: false,
        message: `Content-Typeは次のいずれかである必要があります: ${allowedTypes.join(', ')}`,
        error: 'INVALID_CONTENT_TYPE'
      });
    }
    
    next();
  };
}

// クエリパラメータの型変換とサニタイズ
export function sanitizeQuery(req: Request, res: Response, next: NextFunction) {
  // 数値型への変換
  const numericParams = ['page', 'limit', 'offset', 'count'];
  for (const param of numericParams) {
    if (req.query[param]) {
      req.query[param] = parseInt(req.query[param] as string) as any;
    }
  }
  
  // ブール型への変換
  const booleanParams = ['active', 'isActive', 'enabled', 'deleted'];
  for (const param of booleanParams) {
    if (req.query[param]) {
      req.query[param] = (req.query[param] === 'true') as any;
    }
  }
  
  next();
}

// エクスポート用のバリデーショングループ
export const commonValidation = {
  id: validateId,
  ids: validateIds,
  pagination: validatePagination,
  dateRange: validateDateRange,
  authHeader: validateAuthHeader,
  apiKey: validateApiKey,
  sanitize: sanitizeQuery
};

// ユーティリティ関数のエクスポート
export const validators = {
  email: validateEmail,
  phone: validatePhoneNumber,
  requiredFields: validateRequiredFields,
  numberRange: validateNumberRange,
  stringLength: validateStringLength
};