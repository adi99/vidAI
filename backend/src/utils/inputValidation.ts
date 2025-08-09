import { contentModerationService } from '../services/contentModerationService';

/**
 * Comprehensive input validation utilities for content filtering
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validate and sanitize user-generated content before processing
 */
export class InputValidator {
  /**
   * Validate prompt content for generation requests
   */
  static validatePrompt(prompt: string, field: string = 'prompt'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    const basicValidation = contentModerationService.validatePromptInput(prompt);
    if (!basicValidation.isValid) {
      errors.push(...basicValidation.errors);
    }

    // Content moderation
    const moderation = contentModerationService.moderatePrompt(prompt);
    if (!moderation.isAllowed) {
      errors.push(`${field} contains inappropriate content: ${moderation.reason}`);
    }

    // Add warnings for medium severity content
    if (moderation.severity === 'medium') {
      warnings.push(`${field} may require additional review`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : []
    };
  }

  /**
   * Validate model name for training
   */
  static validateModelName(modelName: string): ValidationResult {
    const errors: string[] = [];

    if (!modelName || typeof modelName !== 'string') {
      errors.push('Model name is required');
      return { isValid: false, errors };
    }

    const trimmed = modelName.trim();

    // Length validation
    if (trimmed.length < 3) {
      errors.push('Model name must be at least 3 characters long');
    }

    if (trimmed.length > 50) {
      errors.push('Model name must be no more than 50 characters long');
    }

    // Character validation
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      errors.push('Model name can only contain letters, numbers, hyphens, and underscores');
    }

    // Content moderation
    const moderation = contentModerationService.moderatePrompt(trimmed);
    if (!moderation.isAllowed) {
      errors.push(`Model name contains inappropriate content: ${moderation.reason}`);
    }

    // Reserved names
    const reservedNames = ['admin', 'system', 'default', 'null', 'undefined', 'test'];
    if (reservedNames.includes(trimmed.toLowerCase())) {
      errors.push('Model name cannot use reserved words');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate file upload parameters
   */
  static validateFileUpload(file: any, allowedTypes: string[], maxSize: number): ValidationResult {
    const errors: string[] = [];

    if (!file) {
      errors.push('File is required');
      return { isValid: false, errors };
    }

    // File size validation
    if (file.size > maxSize) {
      errors.push(`File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`);
    }

    // File type validation
    const fileType = file.mimetype || file.type;
    if (!allowedTypes.includes(fileType)) {
      errors.push(`File must be one of: ${allowedTypes.join(', ')}`);
    }

    // Additional image-specific validation
    if (fileType?.startsWith('image/')) {
      const imageValidation = contentModerationService.validateImageUpload(file);
      if (!imageValidation.isValid) {
        errors.push(...imageValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate generation parameters
   */
  static validateGenerationParams(params: any): ValidationResult {
    const errors: string[] = [];

    // Quality validation
    if (params.quality && !['basic', 'standard', 'high'].includes(params.quality)) {
      errors.push('Quality must be basic, standard, or high');
    }

    // Dimension validation
    if (params.width) {
      if (params.width < 64 || params.width > 4096) {
        errors.push('Width must be between 64 and 4096 pixels');
      }
      if (params.width % 8 !== 0) {
        errors.push('Width must be divisible by 8');
      }
    }

    if (params.height) {
      if (params.height < 64 || params.height > 4096) {
        errors.push('Height must be between 64 and 4096 pixels');
      }
      if (params.height % 8 !== 0) {
        errors.push('Height must be divisible by 8');
      }
    }

    // Steps validation
    if (params.steps) {
      if (params.steps < 1 || params.steps > 100) {
        errors.push('Steps must be between 1 and 100');
      }
    }

    // Guidance scale validation
    if (params.guidance_scale) {
      if (params.guidance_scale < 1 || params.guidance_scale > 20) {
        errors.push('Guidance scale must be between 1 and 20');
      }
    }

    // Strength validation
    if (params.strength !== undefined) {
      if (params.strength < 0 || params.strength > 1) {
        errors.push('Strength must be between 0 and 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate video generation parameters
   */
  static validateVideoParams(params: any): ValidationResult {
    const errors: string[] = [];

    // Duration validation
    if (params.duration_seconds) {
      if (params.duration_seconds < 1 || params.duration_seconds > 30) {
        errors.push('Duration must be between 1 and 30 seconds');
      }
    }

    // FPS validation
    if (params.fps) {
      if (params.fps < 12 || params.fps > 60) {
        errors.push('FPS must be between 12 and 60');
      }
    }

    // Aspect ratio validation
    if (params.aspect_ratio && !['16:9', '9:16', '1:1', '4:3'].includes(params.aspect_ratio)) {
      errors.push('Aspect ratio must be 16:9, 9:16, 1:1, or 4:3');
    }

    // Motion strength validation
    if (params.motion_strength) {
      if (params.motion_strength < 1 || params.motion_strength > 10) {
        errors.push('Motion strength must be between 1 and 10');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize all input fields in an object
   */
  static sanitizeObject(obj: any): any {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = contentModerationService.sanitizeInput(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? contentModerationService.sanitizeInput(item) : item
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if content requires manual review
   */
  static requiresManualReview(content: string, userId: string): boolean {
    return contentModerationService.requiresPreScreening(content, userId);
  }
}

/**
 * Rate limiting validation
 */
export class RateLimitValidator {
  private static readonly RATE_LIMITS = {
    image_generation: { requests: 50, window: 3600 }, // 50 per hour
    video_generation: { requests: 20, window: 3600 }, // 20 per hour
    training: { requests: 5, window: 86400 }, // 5 per day
    api_calls: { requests: 1000, window: 3600 }, // 1000 per hour
  };

  /**
   * Check if user has exceeded rate limits
   */
  static async checkRateLimit(userId: string, action: string): Promise<ValidationResult> {
    // This would typically use Redis to track rate limits
    // For now, return a basic implementation
    
    const errors: string[] = [];
    const limit = this.RATE_LIMITS[action as keyof typeof this.RATE_LIMITS];
    
    if (!limit) {
      errors.push('Unknown action type for rate limiting');
      return { isValid: false, errors };
    }

    // TODO: Implement actual rate limiting with Redis
    // For now, always allow but log the check
    console.log(`Rate limit check for user ${userId}, action ${action}`);

    return {
      isValid: true,
      errors: []
    };
  }
}

export default InputValidator;