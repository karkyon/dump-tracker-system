#!/bin/bash

# upload.ts型エラー修正スクリプト
# 使用方法: ./fix_upload_types.sh

set -e

echo "=== upload.ts型エラー修正開始 ==="

PROJECT_ROOT="/home/karkyon/dump-tracker/backend"
cd "$PROJECT_ROOT"

echo "プロジェクトルート: $PROJECT_ROOT"

# Step 1: constants.tsの型定義修正
echo "Step 1: constants.ts型定義修正..."
cat > src/config/constants.ts << 'EOF'
// backend/src/config/constants.ts
import { config } from './environment';

export const APP_CONSTANTS = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_TIME: 15 * 60 * 1000,
  SESSION_TIMEOUT: 30 * 60 * 1000,
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_FILE_SIZE: config.MAX_FILE_SIZE,
  UPLOAD_PATH: config.UPLOAD_DIR,
  TEMP_PATH: config.TEMP_PATH,
  REPORT_PATH: config.REPORT_PATH,
  BACKUP_PATH: config.BACKUP_PATH,
  REPORT_RETENTION_DAYS: 90,
  API_RATE_LIMIT: config.API_RATE_LIMIT,
  
  // 型安全なファイル形式（readonlyを削除）
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  
  DB_CONNECTION_TIMEOUT: 10000,
  DB_QUERY_TIMEOUT: 30000
} as const;

// エラーメッセージ（別定義で型エラー回避）
export const ERROR_MESSAGES = {
  UNAUTHORIZED: '認証が必要です',
  FORBIDDEN: 'アクセス権限がありません',
  NOT_FOUND: 'リソースが見つかりません',
  VALIDATION_ERROR: '入力データに誤りがあります',
  INTERNAL_ERROR: 'サーバー内部エラーが発生しました',
  FILE_TOO_LARGE: 'ファイルサイズが制限を超えています',
  INVALID_FILE_TYPE: 'サポートされていないファイル形式です'
};

export default APP_CONSTANTS;
EOF
echo "✓ constants.ts型定義修正完了"

# Step 2: upload.ts完全修正（型エラー解消版）
echo "Step 2: upload.ts完全修正..."
cat > src/middleware/upload.ts << 'EOF'
// backend/src/middleware/upload.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { APP_CONSTANTS, ERROR_MESSAGES } from '../config/constants';

/**
 * ファイルサイズをフォーマット
 */
function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * ディレクトリ作成（存在しない場合）
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * ストレージ設定を作成
 */
function createStorage(uploadPath: string): multer.StorageEngine {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      ensureDirectoryExists(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
  });
}

/**
 * ファイル形式チェック（型安全版）
 */
function createFileFilter(allowedTypes: string[]) {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`サポートされていないファイル形式です: ${file.mimetype}`));
    }
  };
}

/**
 * 汎用ファイルアップロード設定
 */
export const generalUpload = multer({
  storage: createStorage(APP_CONSTANTS.UPLOAD_PATH),
  limits: {
    fileSize: APP_CONSTANTS.MAX_FILE_SIZE,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExtensions.includes(ext)) {
      cb(new Error('危険なファイル形式です'));
    } else {
      cb(null, true);
    }
  }
});

/**
 * 一時ファイルアップロード設定
 */
export const tempUpload = multer({
  storage: createStorage(APP_CONSTANTS.TEMP_PATH),
  limits: {
    fileSize: APP_CONSTANTS.MAX_FILE_SIZE,
    files: 5
  }
});

/**
 * 画像ファイルアップロード設定（型安全版）
 */
export const imageUpload = multer({
  storage: createStorage(path.join(APP_CONSTANTS.UPLOAD_PATH, 'images')),
  limits: {
    fileSize: APP_CONSTANTS.MAX_FILE_SIZE,
    files: 5
  },
  fileFilter: createFileFilter([...APP_CONSTANTS.ALLOWED_IMAGE_TYPES])
});

/**
 * ドキュメントファイルアップロード設定（型安全版）
 */
export const documentUpload = multer({
  storage: createStorage(path.join(APP_CONSTANTS.UPLOAD_PATH, 'documents')),
  limits: {
    fileSize: APP_CONSTANTS.MAX_FILE_SIZE,
    files: 3
  },
  fileFilter: createFileFilter([...APP_CONSTANTS.ALLOWED_DOCUMENT_TYPES])
});

/**
 * ファイルバリデーション
 */
export function validateUploadedFiles(files: Express.Multer.File[]): string[] {
  const errors: string[] = [];
  
  files.forEach((file, index) => {
    if (file.size > APP_CONSTANTS.MAX_FILE_SIZE) {
      errors.push(`ファイル${index + 1}: サイズが制限を超えています（最大: ${formatFileSize(APP_CONSTANTS.MAX_FILE_SIZE)}）`);
    }
    
    if (!file.originalname || file.originalname.trim() === '') {
      errors.push(`ファイル${index + 1}: ファイル名が無効です`);
    }
    
    const suspiciousPatterns = [/\.{2,}/, /[<>:"|?*]/, /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i];
    if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
      errors.push(`ファイル${index + 1}: ファイル名に不正な文字が含まれています`);
    }
  });
  
  return errors;
}

/**
 * 古いファイルのクリーンアップ
 */
export async function cleanupOldFiles(): Promise<void> {
  try {
    const tempDir = APP_CONSTANTS.TEMP_PATH;
    const reportDir = APP_CONSTANTS.REPORT_PATH;
    const maxAge = APP_CONSTANTS.REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    if (fs.existsSync(tempDir)) {
      const tempFiles = fs.readdirSync(tempDir);
      tempFiles.forEach(file => {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    if (fs.existsSync(reportDir)) {
      const reportFiles = fs.readdirSync(reportDir);
      reportFiles.forEach(file => {
        const filePath = path.join(reportDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
        }
      });
    }
  } catch (error) {
    console.error('ファイルクリーンアップエラー:', error);
  }
}

/**
 * アップロードエラーハンドラー（型安全版）
 */
export function handleUploadError(error: any, req: Request, res: Response, next: NextFunction): void {
  let message: string = ERROR_MESSAGES.INTERNAL_ERROR;
  let statusCode = 500;
  
  if (error instanceof multer.MulterError) {
    statusCode = 400;
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = ERROR_MESSAGES.FILE_TOO_LARGE;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'アップロード可能なファイル数を超えています';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = '予期しないファイルフィールドです';
        break;
      default:
        message = `アップロードエラー: ${error.message}`;
    }
  } else if (error.message) {
    statusCode = 400;
    message = error.message;
  }
  
  res.status(statusCode).json({
    success: false,
    message,
    error: 'UPLOAD_ERROR'
  });
}

/**
 * ファイル情報の取得
 */
export function getFileInfo(file: Express.Multer.File) {
  return {
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    sizeFormatted: formatFileSize(file.size),
    uploadedAt: new Date().toISOString()
  };
}

/**
 * 複数ファイル情報の取得
 */
export function getMultipleFileInfo(files: Express.Multer.File[]) {
  return files.map(file => getFileInfo(file));
}
EOF
echo "✓ upload.ts完全修正完了"

# Step 3: 型チェック実行
echo "Step 3: 型チェック実行..."
npx tsc --noEmit --skipLibCheck

echo ""
echo "=== 🎉 upload.ts型エラー修正完了 🎉 ==="
echo ""
echo "📋 修正内容："
echo "✓ readonly配列型エラー解消"
echo "✓ ERROR_MESSAGES型エラー解消"
echo "✓ upload.ts完全型安全化"
echo ""
echo "📈 期待される改善："
echo "• upload.ts関連エラーの完全解消"
echo "• 全体エラー数のさらなる減少"
echo ""