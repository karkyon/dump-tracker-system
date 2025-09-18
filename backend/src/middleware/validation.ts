import { Request, Response, NextFunction } from 'express';

// バリデーションルールを適用するミドルウェア 
export function validate(rules: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    next();
  };
}

// IDのバリデーションミドルウェア (例: MongoDBのObjectId形式)
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

// ログイン情報のバリデーションミドルウェア (例: username/emailとpasswordのチェック)
export function validateLogin(req: Request, res: Response, next: NextFunction) {
  const { username, password, email } = req.body;
  
  if (!username && !email) {
    return res.status(400).json({
      success: false,
      message: 'ユーザー名またはメールアドレスが必要です',
      error: 'MISSING_CREDENTIALS'
    });
  }
  
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'パスワードが必要です',
      error: 'MISSING_PASSWORD'
    });
  }
  
  if (password.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'パスワードは3文字以上である必要があります',
      error: 'PASSWORD_TOO_SHORT'
    });
  }
  
  next();
}

// ユーザー登録情報のバリデーションミドルウェア (例: username, email, password, nameのチェック) 
export function validateRegister(req: Request, res: Response, next: NextFunction) {
  const { username, email, password, name } = req.body;
  
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'ユーザー名が必要です',
      error: 'MISSING_USERNAME'
    });
  }
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'メールアドレスが必要です',
      error: 'MISSING_EMAIL'
    });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: '有効なメールアドレスを入力してください',
      error: 'INVALID_EMAIL'
    });
  }
  
  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'パスワードは6文字以上である必要があります',
      error: 'INVALID_PASSWORD'
    });
  }
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: '名前が必要です',
      error: 'MISSING_NAME'
    });
  }
  
  next();
}

// 車両登録情報のバリデーションミドルウェア (例: vehicleNumber, vehicleTypeのチェック)
export function validateVehicle(req: Request, res: Response, next: NextFunction) {
  const { vehicleNumber, vehicleType } = req.body;
  
  if (!vehicleNumber) {
    return res.status(400).json({
      success: false,
      message: '車両番号が必要です',
      error: 'MISSING_VEHICLE_NUMBER'
    });
  }
  
  if (!vehicleType) {
    return res.status(400).json({
      success: false,
      message: '車両タイプが必要です',
      error: 'MISSING_VEHICLE_TYPE'
    });
  }
  
  next();
}

// 運行開始情報のバリデーションミドルウェア (例: vehicleId, driverId, startTimeのチェック)
export function validateOperation(req: Request, res: Response, next: NextFunction) {
  const { vehicleId, driverId, startTime } = req.body;
  
  if (!vehicleId) {
    return res.status(400).json({
      success: false,
      message: '車両IDが必要です',
      error: 'MISSING_VEHICLE_ID'
    });
  }
  
  if (!driverId) {
    return res.status(400).json({
      success: false,
      message: '運転手IDが必要です',
      error: 'MISSING_DRIVER_ID'
    });
  }
  
  if (!startTime) {
    return res.status(400).json({
      success: false,
      message: '開始時間が必要です',
      error: 'MISSING_START_TIME'
    });
  }
  
  next();
}

// validateInspection関数 (inspectionRoutes.ts用)
export function validateInspection(req: Request, res: Response, next: NextFunction) {
  next();
}

// validateReport関数 (reportRoutes.ts用)
export function validateReport(req: Request, res: Response, next: NextFunction) {
  next();
}

// validateUser関数 (userRoutes.ts用)
export function validateUser(req: Request, res: Response, next: NextFunction) {
  const { username, email, name, role } = req.body;
  
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'ユーザー名が必要です',
      error: 'MISSING_USERNAME'
    });
  }
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'メールアドレスが必要です',
      error: 'MISSING_EMAIL'
    });
  }
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: '名前が必要です',
      error: 'MISSING_NAME'
    });
  }
  
  const validRoles = ['ADMIN', 'MANAGER', 'DRIVER'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: '無効な役割です',
      error: 'INVALID_ROLE'
    });
  }
  
  next();
}

// validateTrip関数 (tripRoutes.ts用) 
export function validateTrip(req: Request, res: Response, next: NextFunction) {
  const { vehicleId, driverId, startLocation, endLocation, startTime } = req.body;
  
  if (!vehicleId) {
    return res.status(400).json({
      success: false,
      message: '車両IDが必要です',
      error: 'MISSING_VEHICLE_ID'
    });
  }
  
  if (!driverId) {
    return res.status(400).json({
      success: false,
      message: '運転手IDが必要です',
      error: 'MISSING_DRIVER_ID'
    });
  }
  
  if (!startLocation) {
    return res.status(400).json({
      success: false,
      message: '出発地が必要です',
      error: 'MISSING_START_LOCATION'
    });
  }
  
  if (!startTime) {
    return res.status(400).json({
      success: false,
      message: '開始時間が必要です',
      error: 'MISSING_START_TIME'
    });
  }
  
  next();
}

// validateLocation関数 (locationRoutes.ts用)
export function validateLocation(req: Request, res: Response, next: NextFunction) {
  const { name, address, latitude, longitude, locationType } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: '場所名が必要です',
      error: 'MISSING_NAME'
    });
  }
  
  if (!address) {
    return res.status(400).json({
      success: false,
      message: '住所が必要です',
      error: 'MISSING_ADDRESS'
    });
  }
  
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    return res.status(400).json({
      success: false,
      message: '緯度は-90から90の範囲で入力してください',
      error: 'INVALID_LATITUDE'
    });
  }
  
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    return res.status(400).json({
      success: false,
      message: '経度は-180から180の範囲で入力してください',
      error: 'INVALID_LONGITUDE'
    });
  }
  
  const validTypes = ['LOADING', 'UNLOADING', 'PARKING', 'MAINTENANCE'];
  if (locationType && !validTypes.includes(locationType)) {
    return res.status(400).json({
      success: false,
      message: '無効な場所タイプです',
      error: 'INVALID_LOCATION_TYPE'
    });
  }
  
  next();
}

// validateItem関数 (itemRoutes.ts用)
export function validateItem(req: Request, res: Response, next: NextFunction) {
  const { name, category, weight, volume } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: '品目名が必要です',
      error: 'MISSING_NAME'
    });
  }
  
  if (!category) {
    return res.status(400).json({
      success: false,
      message: 'カテゴリが必要です',
      error: 'MISSING_CATEGORY'
    });
  }
  
  if (weight !== undefined && weight < 0) {
    return res.status(400).json({
      success: false,
      message: '重量は0以上で入力してください',
      error: 'INVALID_WEIGHT'
    });
  }
  
  if (volume !== undefined && volume < 0) {
    return res.status(400).json({
      success: false,
      message: '体積は0以上で入力してください',
      error: 'INVALID_VOLUME'
    });
  }
  
  next();
}

// バリデーションミドルウェアのエクスポート
export const inspectionValidation = {
  create: validate({}),
  update: validate({})
};

// 他のバリデーションミドルウェアも同様にエクスポート
export const reportValidation = {
  create: validate({}),
  update: validate({})
};