import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  const response: ApiResponse = {
    success: false,
    error: process.env['NODE_ENV'] === 'production' 
      ? 'Internal server error' 
      : err.message,
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    response.error = 'Validation error';
    res.status(400).json(response);
    return;
  }

  if (err.name === 'UnauthorizedError') {
    response.error = 'Unauthorized';
    res.status(401).json(response);
    return;
  }

  if (err.name === 'ForbiddenError') {
    response.error = 'Forbidden';
    res.status(403).json(response);
    return;
  }

  if (err.name === 'NotFoundError') {
    response.error = 'Resource not found';
    res.status(404).json(response);
    return;
  }

  // Default error
  res.status(500).json(response);
};
