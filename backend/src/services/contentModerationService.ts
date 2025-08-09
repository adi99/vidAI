import { z } from 'zod';

// Content moderation configuration
const MODERATION_CONFIG = {
  // Explicit content keywords
  EXPLICIT_KEYWORDS: [
    'nude', 'naked', 'nsfw', 'porn', 'sex', 'sexual', 'erotic', 'adult',
    'explicit', 'inappropriate', 'vulgar', 'obscene', 'lewd', 'suggestive'
  ],
  
  // Violence keywords
  VIOLENCE_KEYWORDS: [
    'violence', 'violent', 'kill', 'murder', 'death', 'blood', 'gore',
    'weapon', 'gun', 'knife', 'bomb', 'terrorist', 'harm', 'hurt'
  ],
  
  // Hate speech keywords
  HATE_KEYWORDS: [
    'hate', 'racist', 'discrimination', 'slur', 'offensive', 'bigot',
    'supremacist', 'nazi', 'fascist'
  ],
  
  // Illegal content keywords
  ILLEGAL_KEYWORDS: [
    'drug', 'illegal', 'criminal', 'fraud', 'scam', 'piracy', 'copyright'
  ],
  
  // Maximum prompt length
  MAX_PROMPT_LENGTH: 500,
  
  // Minimum prompt length
  MIN_PROMPT_LENGTH: 3
};

export interface ModerationResult {
  isAllowed: boolean;
  reason?: string;
  flaggedKeywords?: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
}

class ContentModerationService {
  /**
   * Moderate text prompt for inappropriate content
   */
  moderatePrompt(prompt: string): ModerationResult {
    const normalizedPrompt = prompt.toLowerCase().trim();
    const flaggedKeywords: string[] = [];
    let severity: 'low' | 'medium' | 'high' = 'low';
    
    // Check for explicit content
    const explicitMatches = this.findKeywords(normalizedPrompt, MODERATION_CONFIG.EXPLICIT_KEYWORDS);
    if (explicitMatches.length > 0) {
      flaggedKeywords.push(...explicitMatches);
      severity = 'high';
    }
    
    // Check for violence
    const violenceMatches = this.findKeywords(normalizedPrompt, MODERATION_CONFIG.VIOLENCE_KEYWORDS);
    if (violenceMatches.length > 0) {
      flaggedKeywords.push(...violenceMatches);
      severity = severity === 'high' ? 'high' : 'medium';
    }
    
    // Check for hate speech
    const hateMatches = this.findKeywords(normalizedPrompt, MODERATION_CONFIG.HATE_KEYWORDS);
    if (hateMatches.length > 0) {
      flaggedKeywords.push(...hateMatches);
      severity = 'high';
    }
    
    // Check for illegal content
    const illegalMatches = this.findKeywords(normalizedPrompt, MODERATION_CONFIG.ILLEGAL_KEYWORDS);
    if (illegalMatches.length > 0) {
      flaggedKeywords.push(...illegalMatches);
      severity = severity === 'high' ? 'high' : 'medium';
    }
    
    const isAllowed = flaggedKeywords.length === 0;
    
    return {
      isAllowed,
      reason: isAllowed ? '' : `Content contains inappropriate keywords: ${flaggedKeywords.join(', ')}`,
      flaggedKeywords: flaggedKeywords.length > 0 ? flaggedKeywords : [],
      severity
    };
  }
  
  /**
   * Validate prompt input format and length
   */
  validatePromptInput(prompt: string): ContentValidationResult {
    const errors: string[] = [];
    
    // Check if prompt exists
    if (!prompt || typeof prompt !== 'string') {
      errors.push('Prompt is required and must be a string');
      return { isValid: false, errors };
    }
    
    const trimmedPrompt = prompt.trim();
    
    // Check minimum length
    if (trimmedPrompt.length < MODERATION_CONFIG.MIN_PROMPT_LENGTH) {
      errors.push(`Prompt must be at least ${MODERATION_CONFIG.MIN_PROMPT_LENGTH} characters long`);
    }
    
    // Check maximum length
    if (trimmedPrompt.length > MODERATION_CONFIG.MAX_PROMPT_LENGTH) {
      errors.push(`Prompt must be no more than ${MODERATION_CONFIG.MAX_PROMPT_LENGTH} characters long`);
    }
    
    // Check for only whitespace
    if (trimmedPrompt.length === 0) {
      errors.push('Prompt cannot be empty or contain only whitespace');
    }
    
    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(trimmedPrompt)) {
      errors.push('Prompt contains suspicious patterns or formatting');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate image upload for content generation
   */
  validateImageUpload(file: any): ContentValidationResult {
    const errors: string[] = [];
    
    if (!file) {
      errors.push('Image file is required');
      return { isValid: false, errors };
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      errors.push('Image file size must be less than 10MB');
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype || file.type)) {
      errors.push('Image must be in JPEG, PNG, or WebP format');
    }
    
    // Check image dimensions (basic validation)
    if (file.width && file.height) {
      const maxDimension = 4096;
      const minDimension = 64;
      
      if (file.width > maxDimension || file.height > maxDimension) {
        errors.push(`Image dimensions must be no larger than ${maxDimension}x${maxDimension} pixels`);
      }
      
      if (file.width < minDimension || file.height < minDimension) {
        errors.push(`Image dimensions must be at least ${minDimension}x${minDimension} pixels`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Sanitize user input to prevent injection attacks
   */
  sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      // Remove potential script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove potential HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove potential SQL injection patterns
      .replace(/['";\\]/g, '')
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Limit length
      .substring(0, MODERATION_CONFIG.MAX_PROMPT_LENGTH);
  }
  
  /**
   * Check if content should be pre-screened before generation
   */
  requiresPreScreening(prompt: string, _userId: string): boolean {
    const moderation = this.moderatePrompt(prompt);
    
    // Always pre-screen high severity content
    if (moderation.severity === 'high') {
      return true;
    }
    
    // Pre-screen medium severity content for new users
    // This would require user account age check
    if (moderation.severity === 'medium') {
      // For now, always pre-screen medium severity
      return true;
    }
    
    return false;
  }
  
  /**
   * Find keywords in text
   */
  private findKeywords(text: string, keywords: string[]): string[] {
    const found: string[] = [];
    
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        found.push(keyword);
      }
    }
    
    return found;
  }
  
  /**
   * Check for suspicious patterns in text
   */
  private containsSuspiciousPatterns(text: string): boolean {
    // Check for excessive special characters
    const specialCharCount = (text.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
    if (specialCharCount > text.length * 0.3) {
      return true;
    }
    
    // Check for repeated characters (potential spam)
    if (/(.)\1{10,}/.test(text)) {
      return true;
    }
    
    // Check for potential code injection
    if (/\b(eval|exec|system|shell_exec|passthru)\b/i.test(text)) {
      return true;
    }
    
    return false;
  }
}

// Zod schemas for validation
export const PromptValidationSchema = z.object({
  prompt: z.string()
    .min(MODERATION_CONFIG.MIN_PROMPT_LENGTH, `Prompt must be at least ${MODERATION_CONFIG.MIN_PROMPT_LENGTH} characters`)
    .max(MODERATION_CONFIG.MAX_PROMPT_LENGTH, `Prompt must be no more than ${MODERATION_CONFIG.MAX_PROMPT_LENGTH} characters`)
    .refine(
      (prompt) => prompt.trim().length > 0,
      { message: 'Prompt cannot be empty or contain only whitespace' }
    ),
  negativePrompt: z.string()
    .max(MODERATION_CONFIG.MAX_PROMPT_LENGTH, `Negative prompt must be no more than ${MODERATION_CONFIG.MAX_PROMPT_LENGTH} characters`)
    .optional()
});

export const ImageGenerationValidationSchema = PromptValidationSchema.extend({
  model: z.string().min(1, 'Model is required'),
  quality: z.enum(['basic', 'standard', 'high']),
  width: z.number().min(64).max(4096).optional(),
  height: z.number().min(64).max(4096).optional(),
  steps: z.number().min(1).max(100).optional()
});

export const VideoGenerationValidationSchema = PromptValidationSchema.extend({
  model: z.string().min(1, 'Model is required'),
  inputType: z.enum(['text', 'image', 'keyframe']),
  duration: z.number().min(1).max(30).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional()
});

export const TrainingValidationSchema = z.object({
  modelName: z.string()
    .min(3, 'Model name must be at least 3 characters')
    .max(50, 'Model name must be no more than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Model name can only contain letters, numbers, hyphens, and underscores'),
  steps: z.union([z.literal(600), z.literal(1200), z.literal(2000)]),
  images: z.array(z.string()).min(10, 'At least 10 images are required').max(30, 'Maximum 30 images allowed')
});

export const contentModerationService = new ContentModerationService();