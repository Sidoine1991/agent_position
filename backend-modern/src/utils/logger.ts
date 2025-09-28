import { Request, Response, NextFunction } from 'express';

export class Logger {
  static info(message: string, data?: any) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  static error(message: string, error?: any) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
  }

  static warn(message: string, data?: any) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  static debug(message: string, data?: any) {
    if (process.env['NODE_ENV'] === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  static request(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      };
      
      if (res.statusCode >= 400) {
        this.error(`Request failed`, logData);
      } else {
        this.info(`Request completed`, logData);
      }
    });
    
    next();
  }

  static logError(error: Error, context?: string) {
    this.error(`Error in ${context || 'unknown context'}: ${error.message}`, {
      stack: error.stack,
      name: error.name,
    });
  }

  static logDatabaseOperation(operation: string, table: string, data?: any) {
    this.debug(`Database operation: ${operation} on ${table}`, data);
  }

  static logAuthAttempt(email: string, success: boolean, reason?: string) {
    const logData = {
      email,
      success,
      reason,
      timestamp: new Date().toISOString(),
    };
    
    if (success) {
      this.info('Authentication successful', logData);
    } else {
      this.warn('Authentication failed', logData);
    }
  }

  static logPresenceMark(userId: string, status: string, location?: { latitude: number; longitude: number }) {
    this.info('Presence marked', {
      userId,
      status,
      location,
      timestamp: new Date().toISOString(),
    });
  }

  static logReportGeneration(userId: string, reportType: string, period: { start: string; end: string }) {
    this.info('Report generated', {
      userId,
      reportType,
      period,
      timestamp: new Date().toISOString(),
    });
  }
}
