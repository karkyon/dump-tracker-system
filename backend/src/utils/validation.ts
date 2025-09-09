import { Request, Response, NextFunction } from 'express';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validate(rules: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '入力内容に誤りがあります',
        errors
      });
    }
    
    next();
  };
}

export const inspectionValidation = {
  create: validate({}),
  update: validate({})
};

export const reportValidation = {
  create: validate({}),
  update: validate({})
};

export const validateId = validate({});
export const validateReport = validate({});
