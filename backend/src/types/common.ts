// =====================================
// types/common.ts
// アプリケーション共通型定義
// DB連動のindex.tsとは独立して管理
// =====================================

// =====================================
// ページネーション関連型
// =====================================

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =====================================
// API レスポンス関連型
// =====================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
  details?: any;
}

// =====================================
// 検索・フィルタリング関連型
// =====================================

export interface SearchQuery {
  search?: string;
  filters?: Record<string, any>;
}

export interface SortOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =====================================
// 日付範囲関連型
// =====================================

export interface DateRange {
  startDate?: string | Date;
  endDate?: string | Date;
}

// =====================================
// 汎用的なID・タイムスタンプ関連型
// =====================================

export interface WithId {
  id: string;
}

export interface WithTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

// =====================================
// 操作結果関連型
// =====================================

export interface OperationResult {
  success: boolean;
  affectedCount?: number;
  message?: string;
}

export interface BulkOperationResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

// =====================================
// 統計・分析関連型
// =====================================

export interface StatisticsBase {
  total: number;
  period?: DateRange;
}

export interface UsageStatistics extends StatisticsBase {
  usageCount: number;
  uniqueUsers: number;
  averagePerDay: number;
}

// =====================================
// 選択肢・オプション関連型
// =====================================

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

// =====================================
// バリデーション関連型
// =====================================

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}