# Generation API Endpoints

This document describes the generation API endpoints for AI image and video generation with full database integration.

## Overview

The generation API handles AI-powered image and video creation with credit management, queue processing, and database persistence. All generations are tracked in the database with real-time status updates.

## Endpoints

### POST /api/generate/image

Generate AI images with various quality settings and models.

**Request Body:**
```json
{
  "prompt": "A beautiful sunset over mountains",
  "negative_prompt": "blurry, low quality",
  "model": "auto",
  "quality": "standard",
  "width": 512,
  "height": 512,
  "init_image_url": "https://example.com/init.jpg",
  "strength": 0.8,
  "caption_init_image": true,
  "metadata": {
    "custom_field": "value"
  }
}
```

**Parameters:**
- `prompt` (required): Text description of desired image (1-1000 chars)
- `negative_prompt` (optional): What to avoid in the image (max 500 chars)
- `model` (optional): AI model to use (default: 'auto')
- `quality` (optional): 'basic' | 'standard' | 'high' (default: 'standard')
- `width/height` (optional): Image dimensions (256-2048px)
- `init_image_url` (optional): Base image for img2img generation
- `strength` (optional): How much to modify init image (0-1)
- `caption_init_image` (optional): Auto-caption init image for better prompts
- `metadata` (optional): Additional data to store

**Credit Costs:**
- Basic quality: 1 credit
- Standard quality: 2 credits
- High quality: 3 credits

**Response:**
```json
{
  "status": "queued",
  "jobId": "image-uuid",
  "queue": "image",
  "cost": 2,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/generate/video

Generate AI videos from text, images, or keyframes.

**Request Body:**
```json
{
  "prompt": "A cat walking through a garden",
  "negative_prompt": "static, blurry",
  "generation_type": "text_to_video",
  "input_data": {
    "init_image_url": "https://example.com/start.jpg",
    "frames_urls": ["frame1.jpg", "frame2.jpg"]
  },
  "duration_seconds": 5,
  "fps": 16,
  "width": 512,
  "height": 512,
  "metadata": {
    "style": "cinematic"
  }
}
```

**Parameters:**
- `prompt` (required): Text description of desired video (1-1000 chars)
- `generation_type`: 'text_to_video' | 'image_to_video' | 'keyframe'
- `input_data` (optional): Input images/frames based on generation type
- `duration_seconds` (optional): Video length (1-30 seconds, default: 5)
- `fps` (optional): Frames per second (12-60, default: 16)
- `width/height` (optional): Video dimensions (256-2048px)

**Credit Costs:**
- Calculated based on duration and FPS
- Minimum 2 credits
- Formula: `max(2, ceil((seconds * fps) / 16))`

**Response:**
```json
{
  "status": "queued",
  "jobId": "video-uuid",
  "queue": "video",
  "cost": 5,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/generate/:jobId

Get the status and progress of a generation job.

**URL Parameters:**
- `jobId` (UUID): Job identifier

**Response:**
```json
{
  "status": "ok",
  "jobId": "job-uuid",
  "queue": "image",
  "state": "active",
  "progress": 75,
  "result": {
    "status": "completed",
    "provider": "modal",
    "imageUrl": "https://storage.example.com/generated.jpg",
    "latencyMs": 15000
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Job States:**
- `waiting`: Job is queued
- `active`: Job is being processed
- `completed`: Job finished successfully
- `failed`: Job failed with error
- `delayed`: Job is delayed (retry)

### POST /api/generate/:jobId/cancel

Cancel a pending or active generation job.

**URL Parameters:**
- `jobId` (UUID): Job identifier

**Request Body:**
```json
{
  "reason": "User requested cancellation"
}
```

**Response:**
```json
{
  "status": "cancelled",
  "jobId": "job-uuid",
  "queue": "image",
  "state": "failed",
  "reason": "User requested cancellation",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Notes:**
- Only pending/delayed jobs can be fully cancelled
- Active jobs are moved to failed state
- Completed jobs cannot be cancelled
- Users can only cancel their own jobs

### GET /api/generate/history

Get user's generation history with filtering and pagination.

**Query Parameters:**
- `content_type` (optional): 'video' | 'image' | 'all' (default: 'all')
- `status` (optional): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'all' (default: 'all')
- `limit` (optional): Items per page (1-100, default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "status": "ok",
  "generations": [
    {
      "id": "content-uuid",
      "content_type": "image",
      "prompt": "A beautiful sunset over mountains",
      "status": "completed",
      "progress": 100,
      "media_url": "https://storage.example.com/image.jpg",
      "thumbnail_url": "https://storage.example.com/thumb.jpg",
      "credits_used": 2,
      "likes_count": 5,
      "comments_count": 2,
      "shares_count": 1,
      "is_public": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "completed_at": "2024-01-01T00:01:30.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 15,
    "hasMore": false
  },
  "filters": {
    "content_type": "all",
    "status": "all"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Database Integration

### Generation Workflow

1. **Job Creation**: API creates database record with 'pending' status
2. **Queue Processing**: Job is added to Redis queue with database ID
3. **Status Updates**: Worker updates database as job progresses
4. **Completion**: Final status and media URLs are stored

### Database Functions

The API uses these PostgreSQL functions:

- `check_user_credits(user_id, required_credits)`: Verify sufficient credits
- `create_image_generation(...)`: Create image generation record
- `create_video_generation(...)`: Create video generation record
- `update_generation_status(...)`: Update job status and progress
- `get_generation_by_job_id(job_id)`: Retrieve generation by job ID
- `get_user_generations(...)`: Get user's generation history
- `deduct_credits(user_id, amount, metadata)`: Deduct credits atomically

### Real-time Updates

- Database records are updated as jobs progress (0%, 25%, 50%, 100%)
- Status changes: pending → processing → completed/failed
- Media URLs and thumbnails are stored on completion
- Error messages are captured for failed generations

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

## Error Responses

Standardized error format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Common Error Codes:**
- `INSUFFICIENT_CREDITS`: User doesn't have enough credits
- `IMAGE_QUEUE_ERROR`: Failed to queue image generation
- `VIDEO_QUEUE_ERROR`: Failed to queue video generation
- `JOB_STATUS_ERROR`: Failed to fetch job status
- `JOB_CANCEL_ERROR`: Failed to cancel job
- `NOT_OWNER`: User doesn't own the job
- `NOT_CANCELLABLE`: Job cannot be cancelled
- `HISTORY_FETCH_ERROR`: Failed to fetch generation history

## Rate Limiting

Generation endpoints have rate limits:

- Image generation: 10 requests per minute
- Video generation: 5 requests per minute
- Job status: 60 requests per minute
- History: 30 requests per minute

## Queue System

### Priority Levels
- High: Credit purchases, user actions
- Medium: Image and video generation
- Low: Training jobs

### Retry Logic
- Failed jobs are retried up to 3 times (images) or 5 times (videos)
- Exponential backoff between retries
- Dead letter queue for permanently failed jobs

### Monitoring
- Queue health endpoints available at `/health`
- Job metrics and statistics tracked
- Failed job analysis and alerting

## GPU Providers

### Supported Providers
- **Modal.com**: Primary provider for image and video generation
- **Runpod.io**: Fallback provider with automatic failover
- **OpenRouter**: Image captioning for enhanced prompts

### Failover Logic
- Automatic provider switching on failures
- Health monitoring and service status tracking
- Load balancing across available providers

## Testing

Use the provided test script:

```bash
# Test all generation endpoints
node backend/test-generation.js

# Test database functions
node backend/test-generation.js --db
```

## Performance Considerations

- Database records created before queuing for immediate tracking
- Efficient job lookup using database IDs as queue job IDs
- Progress updates minimize database calls
- Media URLs use CDN for fast delivery
- Proper indexing on job_id and user_id columns

## Security

- User ownership validation for all operations
- Credit validation before job creation
- Input sanitization and validation
- Rate limiting to prevent abuse
- Secure media URL generation

### GET /api/generate/models

Get information about available AI models for generation.

**Authentication:** Not required

**Response:**
```json
{
  "status": "ok",
  "models": {
    "image": [
      {
        "id": "sdxl",
        "name": "Stable Diffusion XL",
        "description": "High quality, versatile image generation",
        "speed": "fast",
        "credits_per_image": 2,
        "max_resolution": "1024x1024",
        "features": ["text_to_image", "image_to_image", "inpainting"]
      }
    ],
    "video": [
      {
        "id": "runwayml-gen3",
        "name": "RunwayML Gen-3",
        "description": "Latest generation video model with superior quality",
        "speed": "fast",
        "credits_per_second": 2,
        "max_duration": 15,
        "max_resolution": "1920x1080",
        "features": ["text_to_video", "image_to_video"]
      }
    ],
    "training": [
      {
        "id": "sdxl-lora",
        "name": "SDXL LoRA Training",
        "description": "Train custom LoRA models on SDXL base",
        "training_time_minutes": 30,
        "credits_per_step": 0.02,
        "min_images": 10,
        "max_images": 30,
        "supported_steps": [600, 1200, 2000]
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### POST /api/generate/image/edit

Edit existing images using AI-powered tools.

**Request Body:**
```json
{
  "image_url": "https://example.com/image.jpg",
  "prompt": "Change the background to a sunset",
  "negative_prompt": "blurry, low quality",
  "edit_type": "background_replace",
  "mask_url": "https://example.com/mask.png",
  "strength": 0.8,
  "guidance_scale": 7.5,
  "steps": 30,
  "metadata": {
    "source": "user_upload"
  }
}
```

**Edit Types:**
- `inpaint`: Fill masked areas with new content
- `outpaint`: Extend image beyond original boundaries
- `restyle`: Change style of specific regions
- `background_replace`: Replace background while preserving subject

**Credit Costs:**
- Base cost: 2 credits
- Background replace: 4 credits (2x multiplier)
- Restyle: 3 credits (1.5x multiplier)
- Inpaint/Outpaint: 2 credits (1x multiplier)

**Response:**
```json
{
  "status": "queued",
  "jobId": "uuid",
  "queue": "image",
  "editType": "background_replace",
  "cost": 4,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### POST /api/generate/video/text-to-video

Generate videos from text descriptions with specific models and settings.

**Request Body:**
```json
{
  "prompt": "A dragon flying through storm clouds",
  "negative_prompt": "blurry, low quality",
  "model": "runwayml-gen3",
  "duration_seconds": 5,
  "aspect_ratio": "16:9",
  "quality": "standard",
  "motion_strength": 7,
  "metadata": {
    "style": "cinematic"
  }
}
```

**Parameters:**
- `model`: 'runwayml-gen3' | 'pika-labs' | 'stable-video-diffusion' | 'zeroscope'
- `aspect_ratio`: '16:9' | '9:16' | '1:1' | '4:3'
- `quality`: 'basic' | 'standard' | 'high'
- `motion_strength`: 1-10 (intensity of movement)

**Credit Costs:**
- Base cost: 5 credits
- Duration multiplier: (duration_seconds / 5)
- Quality multiplier: basic=1x, standard=1.5x, high=2x
- Final cost: `ceil(5 * duration_multiplier * quality_multiplier)`

**Response:**
```json
{
  "status": "queued",
  "jobId": "uuid",
  "queue": "video",
  "generationType": "text_to_video",
  "cost": 15,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### POST /api/generate/video/image-to-video

Animate static images into videos.

**Request Body:**
```json
{
  "init_image_url": "https://example.com/image.jpg",
  "prompt": "Animate this image with gentle movement",
  "negative_prompt": "static, frozen",
  "model": "runwayml-gen3",
  "duration_seconds": 5,
  "motion_strength": 5,
  "aspect_ratio": "16:9",
  "quality": "high",
  "metadata": {
    "animation_type": "subtle"
  }
}
```

**Credit Costs:**
- Base cost: 8 credits (higher than text-to-video)
- Duration and quality multipliers apply
- Final cost: `ceil(8 * duration_multiplier * quality_multiplier)`

**Response:**
```json
{
  "status": "queued",
  "jobId": "uuid",
  "queue": "video",
  "generationType": "image_to_video",
  "cost": 20,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### POST /api/generate/video/frame-interpolation

Create smooth videos between two keyframes.

**Request Body:**
```json
{
  "first_frame_url": "https://example.com/frame1.jpg",
  "last_frame_url": "https://example.com/frame2.jpg",
  "duration_seconds": 3,
  "fps": 24,
  "interpolation_method": "smooth",
  "quality": "high",
  "metadata": {
    "transition_type": "morphing"
  }
}
```

**Interpolation Methods:**
- `linear`: Simple linear interpolation
- `smooth`: Smooth bezier-curve interpolation
- `dynamic`: AI-powered dynamic interpolation

**Credit Costs:**
- Base cost: 10 credits (most expensive due to complexity)
- Duration and quality multipliers apply
- Final cost: `ceil(10 * duration_multiplier * quality_multiplier)`

**Response:**
```json
{
  "status": "queued",
  "jobId": "uuid",
  "queue": "video",
  "generationType": "frame_interpolation",
  "cost": 25,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Analytics

The generation API supports tracking:

- Generation success/failure rates by provider
- Average generation times and costs
- User generation patterns and preferences
- Popular prompts and model usage
- Credit consumption analytics