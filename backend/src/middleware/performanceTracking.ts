import { Request, Response, NextFunction } from 'express';
import { backendPerformanceMonitoringService } from '../services/performanceMonitoringService';
import { logger } from '../config/logger';

// Extend Request interface to include performance tracking
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      userId?: string;
    }
  }
}

/**
 * Middleware to track API performance metrics
 */
export const performanceTrackingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Record start time
  req.startTime = Date.now();

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    // Calculate response time
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    // Determine success based on status code
    const success = res.statusCode < 400;
    
    // Extract error type from response if available
    let errorType: string | undefined;
    if (!success) {
      // Try to extract error type from response body or headers
      if (res.locals.errorType) {
        errorType = res.locals.errorType;
      } else if (res.statusCode >= 500) {
        errorType = 'server_error';
      } else if (res.statusCode >= 400) {
        errorType = 'client_error';
      }
    }

    // Record API metrics
    backendPerformanceMonitoringService.recordAPIMetrics({
      endpoint: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      success,
      userId: req.userId || undefined,
      timestamp: Date.now(),
      errorType: errorType || undefined,
    });

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow API request detected', {
        endpoint: req.route?.path || req.path,
        method: req.method,
        responseTime,
        statusCode: res.statusCode,
        userId: req.userId,
      });
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

/**
 * Middleware to extract user ID from JWT token for tracking
 */
export const userTrackingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extract user ID from JWT token if available
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // This would typically decode the JWT token
      // For now, we'll extract it from res.locals if set by auth middleware
      if (res.locals.user?.id) {
        req.userId = res.locals.user.id;
      }
    } catch (error) {
      // Ignore JWT decode errors for performance tracking
    }
  }
  
  next();
};

/**
 * Helper function to track generation performance
 */
export const trackGenerationStart = (
  type: 'image' | 'video' | 'training',
  model: string,
  userId: string,
  settings: Record<string, any>
) => {
  const startTime = Date.now();
  
  return {
    complete: (success: boolean, errorType?: string, creditsUsed: number = 0, processingTime?: number) => {
      const endTime = Date.now();
      const queueTime = processingTime ? (endTime - startTime - processingTime) : 0;
      
      backendPerformanceMonitoringService.recordGenerationMetrics({
        type,
        model,
        userId,
        startTime,
        endTime,
        queueTime,
        processingTime: processingTime || 0,
        success,
        errorType: errorType || undefined,
        creditsUsed,
        settings,
      });
    },
    
    updateProcessingStart: () => {
      const processingStartTime = Date.now();
      return processingStartTime - startTime; // Return queue time
    },
  };
};

/**
 * Express error handler that tracks error types
 */
export const errorTrackingMiddleware = (
  error: any,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  // Set error type in res.locals for performance tracking
  if (error.code) {
    res.locals.errorType = error.code;
  } else if (error.name) {
    res.locals.errorType = error.name;
  } else {
    res.locals.errorType = 'unknown_error';
  }
  
  // Continue to next error handler
  next(error);
};

/**
 * Middleware to track database query performance
 */
export const databasePerformanceMiddleware = () => {
  const originalQuery = require('pg').Client.prototype.query;
  
  require('pg').Client.prototype.query = function(text: string, params?: any[], callback?: Function) {
    const startTime = Date.now();
    
    const handleResult = (err: any, result: any) => {
      const duration = Date.now() - startTime;
      
      // Log slow queries
      if (duration > 1000) {
        logger.warn('Slow database query detected', {
          query: typeof text === 'string' ? text.substring(0, 100) : 'complex_query',
          duration,
          error: err?.message,
        });
      }
      
      // Track database performance
      backendPerformanceMonitoringService.recordAPIMetrics({
        endpoint: 'database_query',
        method: 'QUERY',
        statusCode: err ? 500 : 200,
        responseTime: duration,
        success: !err,
        timestamp: Date.now(),
        errorType: err ? 'database_error' : undefined,
        userId: undefined,
      });
      
      if (callback) {
        callback(err, result);
      }
    };
    
    if (callback) {
      return originalQuery.call(this, text, params, handleResult);
    } else {
      return originalQuery.call(this, text, params).then(
        (result: any) => {
          handleResult(null, result);
          return result;
        },
        (err: any) => {
          handleResult(err, null);
          throw err;
        }
      );
    }
  };
};

/**
 * Health check endpoint performance tracking
 */
export const healthCheckPerformance = async (): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'pass' | 'fail';
    responseTime: number;
    error?: string;
  }>;
}> => {
  const checks: Record<string, {
    status: 'pass' | 'fail';
    responseTime: number;
    error?: string;
  }> = {};

  // Check database connectivity
  const dbStart = Date.now();
  try {
    // This would be a simple database query
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate DB check
    checks.database = {
      status: 'pass',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'fail',
      responseTime: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Redis connectivity
  const redisStart = Date.now();
  try {
    // This would be a Redis ping
    await new Promise(resolve => setTimeout(resolve, 5)); // Simulate Redis check
    checks.redis = {
      status: 'pass',
      responseTime: Date.now() - redisStart,
    };
  } catch (error) {
    checks.redis = {
      status: 'fail',
      responseTime: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check external GPU services
  const gpuStart = Date.now();
  try {
    // This would be a health check to GPU services
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate GPU service check
    checks.gpu_services = {
      status: 'pass',
      responseTime: Date.now() - gpuStart,
    };
  } catch (error) {
    checks.gpu_services = {
      status: 'fail',
      responseTime: Date.now() - gpuStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Determine overall status
  const failedChecks = Object.values(checks).filter(check => check.status === 'fail');
  const slowChecks = Object.values(checks).filter(check => check.responseTime > 1000);
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (failedChecks.length > 0) {
    status = 'unhealthy';
  } else if (slowChecks.length > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return { status, checks };
};