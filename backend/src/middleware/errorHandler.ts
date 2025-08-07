import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: APIError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const timestamp = new Date().toISOString();

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    logger.warn('Validation error', { 
      path: req.path, 
      method: req.method,
      errors: error.errors 
    });

    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.errors,
      timestamp,
    });
  }

  // Handle custom API errors
  if (error.statusCode) {
    logger.warn('API error', {
      path: req.path,
      method: req.method,
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    });

    return res.status(error.statusCode).json({
      code: error.code || 'API_ERROR',
      message: error.message,
      details: error.details,
      timestamp,
    });
  }

  // Handle unexpected errors
  logger.error('Unexpected error', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
  });

  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp,
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
};

// Helper function to create API errors
export const createAPIError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): APIError => {
  const error = new Error(message) as APIError;
  error.statusCode = statusCode;
  // Preserve strict optional typing by only assigning when defined
  if (code !== undefined) {
    error.code = code;
  }
  error.details = details;
  return error;
};