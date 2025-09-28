import { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100; // 100 requests per window

  const clientData = requestCounts.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    // New window or first request
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + windowMs,
    });
    next();
    return;
  }

  if (clientData.count >= maxRequests) {
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
    });
    return;
  }

  clientData.count++;
  next();
};
