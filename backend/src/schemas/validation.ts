import { z } from 'zod';

// Common schemas
export const UUIDSchema = z.string().uuid();
export const PaginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// Auth schemas
export const AuthTokenSchema = z.object({
  authorization: z.string().startsWith('Bearer '),
});

// Generation schemas
export const ImageGenerationSchema = z.object({
  prompt: z.string().min(1).max(1000),
  negative_prompt: z.string().max(500).optional(),
  model: z.string().min(1),
  quality: z.enum(['basic', 'standard', 'high']),
  width: z.number().min(256).max(2048).optional(),
  height: z.number().min(256).max(2048).optional(),
});

export const VideoGenerationSchema = z.object({
  prompt: z.string().min(1).max(1000),
  negative_prompt: z.string().max(500).optional(),
  generation_type: z.enum(['text_to_video', 'image_to_video', 'keyframe']),
  input_data: z.any().optional(),
  duration_seconds: z.number().min(1).max(30).optional(),
  fps: z.number().min(12).max(60).optional(),
});

export const TrainingJobSchema = z.object({
  model_name: z.string().min(1).max(100),
  training_images: z.array(z.string().url()).min(10).max(30),
  // z.enum requires strings; use z.union of literals for numeric choices
  steps: z.union([z.literal(600), z.literal(1200), z.literal(2000)]),
});

// Social schemas
export const LikeSchema = z.object({
  content_id: UUIDSchema,
  content_type: z.enum(['video', 'image']),
});

export const CommentSchema = z.object({
  content_id: UUIDSchema,
  content_type: z.enum(['video', 'image']),
  comment_text: z.string().min(1).max(500),
});

// Credit schemas
export const CreditPurchaseSchema = z.object({
  product_id: z.string().min(1),
  receipt_data: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

// Push notification schemas
export const PushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

// Error response schema
export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
  timestamp: z.string(),
});