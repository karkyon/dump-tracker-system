import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { config } from './database';
import { JWTPayload } from '../types';

interface FileRequest extends Request {
  user?: JWTPayload;
}

export const uploadConfig = {
  basePath: config.UPLOAD_PATH,
  tempPath: path.join(config.UPLOAD_PATH, 'temp'),
  reportsPath: path.join(config.UPLOAD_PATH, 'reports'),
  imagesPath: path.join(config.UPLOAD_PATH, 'images'),
  documentsPath: path.join(config.UPLOAD_PATH, 'documents'),
  
  limits: {
    maxFileSize: parseInt(config.MAX_FILE_SIZE, 10),
    maxFiles: 5
  },
  
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedDocumentTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
};

function getUploadPath(fileType: string): string {
  switch (fileType) {
    case 'image':
      return uploadConfig.imagesPath;
    case 'document':
      return uploadConfig.documentsPath;
    case 'report':
      return uploadConfig.reportsPath;
    default:
      return uploadConfig.tempPath;
  }
}

function generateFileName(req: FileRequest, file: Express.Multer.File): string {
  const userId = req.user?.id || 'anonymous';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(file.originalname);
  
  return `${userId}_${timestamp}_${randomStr}${ext}`;
}

function getFileType(mimetype: string): string {
  if (uploadConfig.allowedImageTypes.includes(mimetype)) {
    return 'image';
  }
  if (uploadConfig.allowedDocumentTypes.includes(mimetype)) {
    return 'document';
  }
  return 'other';
}

const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const fileType = getFileType(file.mimetype);
    const uploadPath = getUploadPath(fileType);
    cb(null, uploadPath);
  },
  filename: (req: Request, file, cb) => {
    const fileName = generateFileName(req as FileRequest, file);
    cb(null, fileName);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    ...uploadConfig.allowedImageTypes,
    ...uploadConfig.allowedDocumentTypes
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('このファイル形式はサポートされていません'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: uploadConfig.limits
});

export const uploadSingle = upload.single('file');
export const uploadMultiple = upload.array('files', uploadConfig.limits.maxFiles);

export function handleUploadError(error: any, req: Request, res: any, next: any) {
  if (error instanceof multer.MulterError) {
    let message = 'ファイルアップロードに失敗しました';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'ファイルサイズが制限を超えています';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'ファイル数が制限を超えています';
        break;
    }
    
    return res.status(400).json({
      success: false,
      message,
      error: error.message
    });
  }

  next(error);
}

export function getUploadConfig() {
  return uploadConfig;
}
