import { Request, Response, NextFunction } from 'express';

export function validate(rules: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

export function validateId(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      message: '無効なIDです'
    });
  }
  next();
}

export function validateReport(req: Request, res: Response, next: NextFunction) {
  next();
}

export const inspectionValidation = {
  create: validate({}),
  update: validate({})
};

export const reportValidation = {
  create: validate({}),
  update: validate({})
};
