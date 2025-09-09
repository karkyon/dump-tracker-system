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
