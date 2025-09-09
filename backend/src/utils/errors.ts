export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = '入力内容に誤りがあります') {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = '認証に失敗しました') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'アクセス権限がありません') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'データが見つかりません') {
    super(message, 404);
  }
}

export class FileProcessingError extends AppError {
  constructor(message: string = 'ファイル処理エラー') {
    super(message, 422);
  }
}
