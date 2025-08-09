import { Request, Response, NextFunction } from 'express';
import { rateLimitingService } from '../services/rateLimitingService';
import { AuthenticatedRequest } from './auth';

// Extend Request interface to include rate limit info
declare global {
  namespace Express {
    interface Request {
      rateLimitInfo?: {
        action: string;
        remaining: number;
        resetTime: number;
        totalRequests: number;
      };
    }
  }
}

/**
 * Create rate limiting middleware for specific actions
 */
export const createRateLimit = (action: string, options?: {
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get user ID from authenticated request or use IP as fallback
      const userId = (req as AuthenticatedRequest).user?.id || req.ip || 'anonymous';
      const ip = req.ip || 'unknown';

      // Use custom key generator if provided
      const key = options?.keyGenerator ? options.keyGenerator(req) : userId;

      // Check rate limit
      const result = await rateLimitingService.checkRateLimit(key, action, ip);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': rateLimitingService.getRateLimitConfig(action)?.requests.toString() || '0',
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        'X-RateLimit-Used': result.totalRequests.toString()
      });

      // Store rate limit info in request for logging
      req.rateLimitInfo = {
        action,
        remaining: result.remaining,
        resetTime: result.resetTime,
        totalRequests: result.totalRequests
      };

      if (!result.allowed) {
        // Add retry-after header if blocked
        if (result.retryAfter) {
          res.set('Retry-After', Math.ceil(result.retryAfter / 1000).toString());
        }

        res.status(429).json({
          error: 'RATE_LIMITED',
          message: `Too many ${action.replace('_', ' ')} requests. Please try again later.`,
          retryAfter: result.retryAfter ? Math.ceil(result.retryAfter / 1000) : undefined,
          resetTime: result.resetTime,
          timestamp: new Date().toISOString()
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      // Fail open - allow request if rate limiting fails
      next();
    }
  };
};

/**
 * Rate limiting middleware for image generation
 */
export const imageGenerationRateLimit = createRateLimit('image_generation');

/**
 * Rate limiting middleware for video generation
 */
export const videoGenerationRateLimit = createRateLimit('video_generation');

/**
 * Rate limiting middleware for training
 */
export const trainingRateLimit = createRateLimit('training');

/**
 * Rate limiting middleware for API calls (general)
 */
export const apiRateLimit = createRateLimit('api_calls', {
  keyGenerator: (req) => req.ip || 'unknown' // Use IP for general API rate limiting
});

/**
 * Rate limiting middleware for login attempts
 */
export const loginRateLimit = createRateLimit('login_attempts', {
  keyGenerator: (req) => req.body.email || req.ip
});

/**
 * Rate limiting middleware for content reports
 */
export const reportRateLimit = createRateLimit('content_reports');

/**
 * Rate limiting middleware for comments
 */
export const commentRateLimit = createRateLimit('comments');

/**
 * Rate limiting middleware for likes
 */
export const likeRateLimit = createRateLimit('likes');

/**
 * Rate limiting middleware for image uploads
 */
export const imageUploadRateLimit = createRateLimit('image_uploads');

/**
 * Rate limiting middleware for training uploads
 */
export const trainingUploadRateLimit = createRateLimit('training_uploads');

/**
 * Middleware to log rate limit information
 */
export const logRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log rate limit info if available
    if (req.rateLimitInfo) {
      console.log('Rate Limit Info:', {
        userId: (req as AuthenticatedRequest).user?.id,
        ip: req.ip,
        endpoint: req.path,
        method: req.method,
        action: req.rateLimitInfo.action,
        remaining: req.rateLimitInfo.remaining,
        totalRequests: req.rateLimitInfo.totalRequests,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware for burst protection (short-term high-frequency requests)
 */
export const burstProtection = (maxRequests: number = 10, windowMs: number = 60000) => {
  const requests = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req as AuthenticatedRequest).user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create request history for this key
    let requestTimes = requests.get(key) || [];
    
    // Remove old requests outside the window
    requestTimes = requestTimes.filter(time => time > windowStart);
    
    // Check if burst limit exceeded
    if (requestTimes.length >= maxRequests) {
      res.status(429).json({
        error: 'BURST_LIMIT_EXCEEDED',
        message: 'Too many requests in a short time. Please slow down.',
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Add current request
    requestTimes.push(now);
    requests.set(key, requestTimes);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [k, times] of requests.entries()) {
        const filteredTimes = times.filter(time => time > windowStart);
        if (filteredTimes.length === 0) {
          requests.delete(k);
        } else {
          requests.set(k, filteredTimes);
        }
      }
    }

    next();
  };
};

/**
 * Adaptive rate limiting based on user behavior
 */
export const adaptiveRateLimit = (baseAction: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        return next();
      }

      // Get user's violation history
      const violations = await rateLimitingService.getUserViolations(userId);
      const recentViolations = violations.filter(v => 
        Date.now() - new Date(v.timestamp).getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
      );

      // Adjust rate limit based on violation history
      let adjustedAction = baseAction;
      if (recentViolations.length > 5) {
        adjustedAction = `${baseAction}_restricted`; // Use more restrictive limits
      } else if (recentViolations.length === 0) {
        adjustedAction = `${baseAction}_trusted`; // Use more lenient limits
      }

      // Apply the adjusted rate limit
      const rateLimitMiddleware = createRateLimit(adjustedAction);
      return rateLimitMiddleware(req, res, next);
    } catch (error) {
      console.error('Adaptive rate limiting error:', error);
      // Fall back to base rate limit
      const rateLimitMiddleware = createRateLimit(baseAction);
      return rateLimitMiddleware(req, res, next);
    }
  };
};