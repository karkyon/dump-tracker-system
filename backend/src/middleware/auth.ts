import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/database';
import { JWTPayload } from '../types';

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'アクセストークンが必要です'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: '無効なアクセストークンです'
    });
    return;
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as JWTPayload;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: '認証が必要です'
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: '権限がありません'
      });
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole(['ADMIN']);
export const requireManager = requireRole(['ADMIN', 'MANAGER']);
export const requireDriver = requireRole(['ADMIN', 'MANAGER', 'DRIVER']);