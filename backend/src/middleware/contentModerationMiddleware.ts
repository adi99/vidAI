import { Request, Response, NextFunction } from 'express';
import { contentModerationService, ModerationResult } from '../services/contentModerationService';
import { AuthenticatedRequest } from './auth';

// Extend Request interface to include moderation results
declare global {
  namespace Express {
    interface Request {
      moderationResult?: ModerationResult;
      sanitizedInput?: any;
    }
  }
}

/**
 * Middleware to moderate prompt content before processing
 */
export const moderatePrompt = (promptField: string = 'prompt') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const prompt = req.body[promptField];
      
      if (!prompt) {
        res.status(400).json({
          error: 'MISSING_PROMPT',
          message: 'Prompt is required for content moderation'
        });
        return;
      }
      
      // Validate input format
      const validation = contentModerationService.validatePromptInput(prompt);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'INVALID_PROMPT',
          message: 'Prompt validation failed',
          details: validation.errors
        });
        return;
      }
      
      // Moderate content
      const moderationResult = contentModerationService.moderatePrompt(prompt);
      
      if (!moderationResult.isAllowed) {
        res.status(400).json({
          error: 'CONTENT_BLOCKED',
          message: 'Content violates community guidelines',
          reason: moderationResult.reason,
          severity: moderationResult.severity
        });
        return;
      }
      
      // Store moderation result for logging
      req.moderationResult = moderationResult;
      
      next();
    } catch (error) {
      console.error('Content moderation error:', error);
      res.status(500).json({
        error: 'MODERATION_ERROR',
        message: 'Failed to moderate content'
      });
    }
  };
};

/**
 * Middleware to sanitize all input fields
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    const sanitizedBody: any = {};
    
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        sanitizedBody[key] = contentModerationService.sanitizeInput(value);
      } else {
        sanitizedBody[key] = value;
      }
    }
    
    req.sanitizedInput = sanitizedBody;
    req.body = sanitizedBody;
    
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(500).json({
      error: 'SANITIZATION_ERROR',
      message: 'Failed to sanitize input'
    });
  }
};

/**
 * Middleware to validate image uploads
 */
export const validateImageUpload = (req: Request & { file?: any }, res: Response, next: NextFunction): void => {
  try {
    const file = req.file;
    
    if (!file) {
      res.status(400).json({
        error: 'MISSING_IMAGE',
        message: 'Image file is required'
      });
      return;
    }
    
    const validation = contentModerationService.validateImageUpload(file);
    
    if (!validation.isValid) {
      res.status(400).json({
        error: 'INVALID_IMAGE',
        message: 'Image validation failed',
        details: validation.errors
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Image validation error:', error);
    res.status(500).json({
      error: 'VALIDATION_ERROR',
      message: 'Failed to validate image'
    });
  }
};

/**
 * Middleware to check if content requires pre-screening
 */
export const checkPreScreening = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const prompt = req.body.prompt;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User authentication required'
      });
      return;
    }
    
    const requiresScreening = contentModerationService.requiresPreScreening(prompt, userId);
    
    if (requiresScreening) {
      // For now, we'll block content that requires pre-screening
      // In a full implementation, this would queue for manual review
      res.status(400).json({
        error: 'CONTENT_REQUIRES_REVIEW',
        message: 'Content requires manual review before processing',
        details: 'Your content has been flagged for review and will be processed once approved'
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Pre-screening check error:', error);
    res.status(500).json({
      error: 'SCREENING_ERROR',
      message: 'Failed to check content screening requirements'
    });
  }
};

/**
 * Middleware to log moderation events
 */
export const logModerationEvent = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log moderation events
    if (req.moderationResult) {
      console.log('Moderation Event:', {
        userId: (req as AuthenticatedRequest).user?.id,
        endpoint: req.path,
        method: req.method,
        moderationResult: req.moderationResult,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};