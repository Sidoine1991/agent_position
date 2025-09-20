import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/environment.js';

// Classe d'erreur personnalisée
export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Gestionnaire d'erreurs global
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Erreur interne du serveur';
  let code: string | undefined;

  // Log de l'erreur
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Gestion des différents types d'erreurs
  if (error instanceof CustomError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Données invalides';
    code = 'VALIDATION_ERROR';
    
    // Détails des erreurs de validation
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.input,
    }));
    
    res.status(statusCode).json({
      success: false,
      message,
      code,
      errors: validationErrors,
      timestamp: new Date().toISOString(),
    });
    return;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Erreur de validation des données';
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Format de données invalide';
    code = 'CAST_ERROR';
  } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    statusCode = 500;
    message = 'Erreur de base de données';
    code = 'DATABASE_ERROR';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token JWT invalide';
    code = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token JWT expiré';
    code = 'TOKEN_EXPIRED';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    message = 'Erreur de téléchargement de fichier';
    code = 'UPLOAD_ERROR';
  }

  // Réponse d'erreur
  const errorResponse: any = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (code) {
    errorResponse.code = code;
  }

  // En développement, inclure la stack trace
  if (config.isDevelopment) {
    errorResponse.stack = error.stack;
    errorResponse.details = {
      name: error.name,
      message: error.message,
    };
  }

  res.status(statusCode).json(errorResponse);
}

// Middleware pour les routes non trouvées
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new CustomError(
    `Route ${req.method} ${req.originalUrl} non trouvée`,
    404,
    true,
    'ROUTE_NOT_FOUND'
  );
  next(error);
}

// Middleware pour les erreurs asynchrones
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Gestionnaire d'erreurs pour les processus non gérés
export function handleUncaughtException(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

// Gestionnaire d'erreurs pour les promesses rejetées
export function handleUnhandledRejection(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', { reason, promise });
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}
