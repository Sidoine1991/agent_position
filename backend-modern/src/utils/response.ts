import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

export class ResponseUtils {
  static success<T>(res: Response, data: T, message = 'Success', statusCode = 200) {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
    };
    return res.status(statusCode).json(response);
  }

  static error(res: Response, error: string, statusCode = 500) {
    const response: ApiResponse = {
      success: false,
      error,
    };
    return res.status(statusCode).json(response);
  }

  static validationError(res: Response, errors: string[]) {
    const response: ApiResponse = {
      success: false,
      error: 'Validation failed',
      data: { errors },
    };
    return res.status(400).json(response);
  }

  static unauthorized(res: Response, message = 'Unauthorized') {
    const response: ApiResponse = {
      success: false,
      error: message,
    };
    return res.status(401).json(response);
  }

  static forbidden(res: Response, message = 'Forbidden') {
    const response: ApiResponse = {
      success: false,
      error: message,
    };
    return res.status(403).json(response);
  }

  static notFound(res: Response, message = 'Resource not found') {
    const response: ApiResponse = {
      success: false,
      error: message,
    };
    return res.status(404).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    message = 'Data fetched successfully'
  ) {
    const response: PaginatedResponse<T> = {
      success: true,
      data,
      pagination,
      message,
    };
    return res.json(response);
  }

  static created<T>(res: Response, data: T, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  static noContent(res: Response, message = 'Operation completed successfully') {
    const response: ApiResponse = {
      success: true,
      message,
    };
    return res.status(204).json(response);
  }
}
