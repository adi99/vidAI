# User Management API Documentation

This document describes the user management endpoints for content, settings, and credits.

## Base URL
```
/api/user
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Get User Content
Retrieve user's generated content (videos and images).

**Endpoint:** `GET /api/user/content`

**Query Parameters:**
- `content_type` (optional): Filter by content type (`video`, `image`, `all`). Default: `all`
- `status` (optional): Filter by status (`pending`, `processing`, `completed`, `failed`, `cancelled`, `all`). Default: `all`
- `is_public` (optional): Filter by privacy (`true`, `false`, `all`). Default: `all`
- `limit` (optional): Number of items to return (1-100). Default: `20`
- `offset` (optional): Number of items to skip. Default: `0`
- `sort` (optional): Sort order (`recent`, `oldest`, `popular`). Default: `recent`

**Response:**
```json
{
  "status": "ok",
  "content": [
    {
      "id": "uuid",
      "content_type": "video",
      "prompt": "A dragon flying through clouds",
      "video_url": "https://...",
      "thumbnail_url": "https://...",
      "status": "completed",
      "is_public": true,
      "likes_count": 42,
      "comments_count": 5,
      "shares_count": 3,
      "credits_used": 10,
      "created_at": "2024-01-01T00:00:00Z",
      "completed_at": "2024-01-01T00:05:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "hasMore": true
  },
  "filters": {
    "content_type": "all",
    "status": "all",
    "is_public": "all",
    "sort": "recent"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Get User Settings
Retrieve user's application settings.

**Endpoint:** `GET /api/user/settings`

**Response:**
```json
{
  "status": "ok",
  "settings": {
    "notifications_enabled": true,
    "email_notifications": true,
    "push_notifications": true,
    "privacy_profile": "public",
    "privacy_content": "public",
    "language": "en",
    "timezone": "UTC",
    "theme": "auto"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Update User Settings
Update user's application settings.

**Endpoint:** `POST /api/user/settings`

**Request Body:**
```json
{
  "notifications_enabled": true,
  "email_notifications": false,
  "push_notifications": true,
  "privacy_profile": "private",
  "privacy_content": "followers_only",
  "language": "en",
  "timezone": "America/New_York",
  "theme": "dark"
}
```

**Response:**
```json
{
  "status": "ok",
  "settings": {
    "notifications_enabled": true,
    "email_notifications": false,
    "push_notifications": true,
    "privacy_profile": "private",
    "privacy_content": "followers_only",
    "language": "en",
    "timezone": "America/New_York",
    "theme": "dark"
  },
  "message": "Settings updated successfully",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Get Credit History
Retrieve user's credit transaction history.

**Endpoint:** `GET /api/user/credits/history`

**Query Parameters:**
- `transaction_type` (optional): Filter by type (`purchase`, `deduction`, `refund`, `bonus`, `all`). Default: `all`
- `limit` (optional): Number of transactions to return (1-100). Default: `20`
- `offset` (optional): Number of transactions to skip. Default: `0`
- `start_date` (optional): Filter transactions after this date (ISO 8601)
- `end_date` (optional): Filter transactions before this date (ISO 8601)

**Response:**
```json
{
  "status": "ok",
  "transactions": [
    {
      "id": "uuid",
      "transaction_type": "purchase",
      "amount": 100,
      "balance_after": 150,
      "description": "Credits added",
      "metadata": {
        "type": "purchase",
        "package_id": "credits_100",
        "transaction_id": "app_store_123"
      },
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "transaction_type": "deduction",
      "amount": -10,
      "balance_after": 50,
      "description": "Credits deducted for video_generation",
      "metadata": {
        "type": "video_generation",
        "jobId": "job_123",
        "model": "runwayml-gen3"
      },
      "created_at": "2024-01-01T01:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 45,
    "hasMore": true
  },
  "filters": {
    "transaction_type": "all",
    "start_date": null,
    "end_date": null
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Process Credit Purchase
Process an in-app purchase for credits.

**Endpoint:** `POST /api/user/credits/purchase`

**Request Body:**
```json
{
  "package_id": "credits_100",
  "receipt_data": "base64_encoded_receipt",
  "platform": "ios",
  "transaction_id": "1000000123456789"
}
```

**Response:**
```json
{
  "status": "success",
  "purchase": {
    "transactionId": "1000000123456789",
    "packageId": "credits_100",
    "creditsPurchased": 100,
    "priceUsd": 4.99,
    "newBalance": 150
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Credit Packages

Available credit packages:

| Package ID | Credits | Price (USD) |
|------------|---------|-------------|
| credits_100 | 100 | $4.99 |
| credits_500 | 500 | $19.99 |
| credits_1000 | 1000 | $34.99 |
| credits_2500 | 2500 | $79.99 |

### Get User Achievements
Retrieve user's unlocked achievements and progress.

**Endpoint:** `GET /api/user/achievements`

**Response:**
```json
{
  "status": "ok",
  "achievements": [
    {
      "id": "early_adopter",
      "title": "Early Adopter",
      "description": "Joined in the first month",
      "icon": "star",
      "unlockedAt": "2024-01-15T00:00:00Z",
      "rarity": "rare"
    },
    {
      "id": "creator_pro",
      "title": "Creator Pro",
      "description": "1000+ generations",
      "icon": "crown",
      "unlockedAt": "2024-02-01T00:00:00Z",
      "rarity": "epic"
    }
  ],
  "totalAchievements": 2,
  "stats": {
    "totalGenerations": 1247,
    "daysSinceJoin": 45,
    "maxLikes": 12500,
    "recentContentCount": 5
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Achievement Rarities:**
- `common`: Basic achievements for regular activity
- `rare`: Achievements for significant milestones
- `epic`: Achievements for major accomplishments
- `legendary`: Achievements for exceptional performance

### Get User Statistics
Retrieve comprehensive user statistics for profile display.

**Endpoint:** `GET /api/user/stats`

**Response:**
```json
{
  "status": "ok",
  "stats": {
    "content": {
      "videosCreated": 1247,
      "imagesGenerated": 15432,
      "totalGenerations": 16679
    },
    "engagement": {
      "totalLikes": 125000,
      "totalComments": 8500,
      "totalShares": 2300,
      "totalLiked": 450,
      "engagementRate": "8.12"
    },
    "social": {
      "followers": 23400,
      "following": 567,
      "followerGrowth": "+12.5%"
    },
    "credits": {
      "totalSpent": 45000,
      "averagePerGeneration": "2.7"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 400 Bad Request
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "code": "INTERNAL_ERROR",
  "message": "Internal server error",
  "timestamp": "2024-01-01T00:00:00Z"
}
```