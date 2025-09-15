import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

// Define PaginatedResponse type
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export function successResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

export function errorResponse(
  message: string,
  statusCode: number = 500,
  errors?: any[]
): ApiResponse<null> {
  return {
    success: false,
    message,
    error: message,
    timestamp: new Date().toISOString()
  };
}

export function paginatedResponse<T>(
  data: T[],
  totalItems: number,
  currentPage: number,
  itemsPerPage: number,
  message?: string
): ApiResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  return {
    success: true,
    data: {
      data,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        itemsPerPage
      }
    },
    message,
    timestamp: new Date().toISOString()
  };
}
