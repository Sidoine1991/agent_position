import { Request, Response, NextFunction } from 'express';

export class ValidationUtils {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateCoordinates(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180
    );
  }

  static validateRequiredFields(fields: Record<string, any>, requiredFields: string[]): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!fields[field] || (typeof fields[field] === 'string' && fields[field].trim() === '')) {
        missingFields.push(field);
      }
    }
    
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  static validatePaginationParams(page: any, limit: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (page && (isNaN(Number(page)) || Number(page) < 1)) {
      errors.push('Page must be a positive number');
    }
    
    if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
      errors.push('Limit must be a positive number between 1 and 100');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateDateRange(startDate: string, endDate: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
      errors.push('Start date must be a valid date');
    }
    
    if (isNaN(end.getTime())) {
      errors.push('End date must be a valid date');
    }
    
    if (start > end) {
      errors.push('Start date must be before end date');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const validateRequest = (validationFn: (req: Request) => { isValid: boolean; errors: string[] }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validation = validationFn(req);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    return next();
  };
};

export const validateLoginRequest = validateRequest((req) => {
  const { email, password } = req.body;
  const errors: string[] = [];
  
  if (!email || !password) {
    errors.push('Email and password are required');
  }
  
  if (email && !ValidationUtils.validateEmail(email)) {
    errors.push('Invalid email format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
});

export const validateRegisterRequest = validateRequest((req) => {
  const { email, password, name } = req.body;
  const errors: string[] = [];
  
  if (!email || !password || !name) {
    errors.push('Email, password, and name are required');
  }
  
  if (email && !ValidationUtils.validateEmail(email)) {
    errors.push('Invalid email format');
  }
  
  if (password) {
    const passwordValidation = ValidationUtils.validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
});

export const validatePresenceRequest = validateRequest((req) => {
  const { latitude, longitude, status } = req.body;
  const errors: string[] = [];
  
  if (latitude === undefined || longitude === undefined) {
    errors.push('Latitude and longitude are required');
  }
  
  if (latitude !== undefined && longitude !== undefined && !ValidationUtils.validateCoordinates(latitude, longitude)) {
    errors.push('Invalid coordinates');
  }
  
  if (!status || !['present', 'absent', 'late'].includes(status)) {
    errors.push('Status must be present, absent, or late');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
});
