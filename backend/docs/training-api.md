# Training API Endpoints

This document describes the training API endpoints for LoRA model training functionality.

## Overview

The training API allows users to upload images and train personalized LoRA models that can be used for generating content featuring specific subjects or styles.

## Endpoints

### POST /api/train/upload

Upload and validate training images for a new model.

**Request Body:**
```json
{
  "images": [
    {
      "url": "https://example.com/image1.jpg",
      "filename": "image1.jpg",
      "size": 1024000,
      "format": "jpg"
    }
  ],
  "model_name": "my-custom-model"
}
```

**Requirements:**
- 10-30 images required
- Supported formats: jpg, jpeg, png, webp
- Model name must be unique for the user

**Response:**
```json
{
  "status": "uploaded",
  "sessionId": "upload_user123_1234567890",
  "modelName": "my-custom-model",
  "imageCount": 15,
  "images": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/train/start

Start a LoRA training job with uploaded images.

**Request Body:**
```json
{
  "model_name": "my-custom-model",
  "steps": 600,
  "training_images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "metadata": {
    "description": "Custom model for portraits"
  }
}
```

**Parameters:**
- `steps`: Training steps (600, 1200, or 2000)
- `training_images`: Array of 10-30 image URLs

**Credit Costs:**
- 600 steps: 10 credits
- 1200 steps: 20 credits  
- 2000 steps: 35 credits

**Response:**
```json
{
  "status": "queued",
  "jobId": "job_123",
  "trainingJobId": "training_456",
  "queue": "training",
  "modelName": "my-custom-model",
  "steps": 600,
  "cost": 10,
  "estimatedDuration": "60 minutes",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/train/:jobId

Get the status and progress of a training job.

**Response:**
```json
{
  "status": "ok",
  "jobId": "job_123",
  "trainingJob": {
    "id": "training_456",
    "modelName": "my-custom-model",
    "status": "processing",
    "progress": 65,
    "steps": 600,
    "creditsUsed": 10,
    "trainedModelUrl": null,
    "errorMessage": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "completedAt": null
  },
  "queueStatus": {
    "state": "active",
    "progress": 65
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Status Values:**
- `pending`: Job is queued
- `processing`: Training is in progress
- `completed`: Training finished successfully
- `failed`: Training failed

### GET /api/train/models

List all trained models for the authenticated user.

**Response:**
```json
{
  "status": "ok",
  "models": {
    "completed": [
      {
        "id": "training_456",
        "model_name": "my-custom-model",
        "status": "completed",
        "steps": 600,
        "credits_used": 10,
        "trained_model_url": "https://storage.example.com/models/user123/model.safetensors",
        "created_at": "2024-01-01T00:00:00.000Z",
        "completed_at": "2024-01-01T01:00:00.000Z"
      }
    ],
    "inProgress": [],
    "failed": []
  },
  "totalCount": 1,
  "completedCount": 1,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Common Error Codes:**
- `INSUFFICIENT_CREDITS`: User doesn't have enough credits
- `INVALID_IMAGE_COUNT`: Wrong number of training images
- `MODEL_NAME_EXISTS`: Model name already exists for user
- `TRAINING_START_ERROR`: Failed to start training job
- `TRAINING_STATUS_ERROR`: Failed to fetch job status

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

## Rate Limiting

Training endpoints are subject to rate limiting:
- Upload: 10 requests per minute
- Start: 5 requests per minute
- Status/Models: 60 requests per minute

## Database Functions

The following PostgreSQL functions support the training API:

- `deduct_credits(user_id, amount, meta)`: Deduct credits from user
- `refund_credits(user_id, amount, reason, reference_id)`: Refund credits for failed operations
- `increment_user_stat(user_id, stat_name, increment)`: Update user statistics
- `get_user_training_stats(user_id)`: Get training statistics for user

## Queue Processing

Training jobs are processed asynchronously using BullMQ:

1. Job is added to training queue with low priority
2. Worker picks up job and updates status to 'processing'
3. Progress updates are sent to database and job progress
4. On completion, model URL is stored and status updated
5. On failure, credits are refunded and error logged

## Testing

Use the provided test script to verify endpoints:

```bash
node backend/test-training.js
```

Make sure to update the auth token and API base URL in the test script.