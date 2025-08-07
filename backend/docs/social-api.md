# Social API Endpoints

This document describes the social API endpoints for the AI Video Generation App's social features including feed, likes, comments, and sharing.

## Overview

The social API enables users to discover, interact with, and share AI-generated content. It provides a TikTok-style social feed with engagement features.

## Endpoints

### GET /api/feed

Get paginated social feed with filtering and sorting options.

**Query Parameters:**
- `limit` (number, 1-50, default: 20): Number of items per page
- `offset` (number, default: 0): Pagination offset
- `content_type` (enum: 'video' | 'image' | 'all', default: 'all'): Filter by content type
- `user_id` (UUID, optional): Get content from specific user only
- `sort` (enum: 'recent' | 'popular' | 'trending', default: 'recent'): Sort order

**Response:**
```json
{
  "status": "ok",
  "feed": [
    {
      "id": "content-uuid",
      "user_id": "user-uuid",
      "username": "creator_username",
      "content_type": "video",
      "prompt": "A beautiful sunset over mountains",
      "media_url": "https://storage.example.com/video.mp4",
      "thumbnail_url": "https://storage.example.com/thumb.jpg",
      "likes_count": 42,
      "comments_count": 8,
      "shares_count": 3,
      "created_at": "2024-01-01T00:00:00.000Z"
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
    "sort": "recent",
    "user_id": null
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Sorting Options:**
- `recent`: Latest content first (default)
- `popular`: Highest likes count first
- `trending`: Recent content with high engagement (likes + comments * 2)

### POST /api/feed/content/:id/like

Like or unlike content.

**URL Parameters:**
- `id` (UUID): Content ID

**Request Body:**
```json
{
  "content_type": "video",
  "action": "like"
}
```

**Parameters:**
- `content_type`: 'video' or 'image'
- `action`: 'like' or 'unlike' (default: 'like')

**Response:**
```json
{
  "status": "ok",
  "contentId": "content-uuid",
  "contentType": "video",
  "action": "like",
  "likesCount": 43,
  "userLiked": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/feed/content/:id/comment

Add a comment to content.

**URL Parameters:**
- `id` (UUID): Content ID

**Request Body:**
```json
{
  "content_type": "video",
  "comment_text": "Amazing work! How did you create this?"
}
```

**Response:**
```json
{
  "status": "created",
  "comment": {
    "id": "comment-uuid",
    "userId": "user-uuid",
    "username": "commenter_username",
    "commentText": "Amazing work! How did you create this?",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/feed/content/:id/comments

Get comments for content with pagination.

**URL Parameters:**
- `id` (UUID): Content ID

**Query Parameters:**
- `content_type` (required): 'video' or 'image'
- `limit` (number, 1-100, default: 20): Comments per page
- `offset` (number, default: 0): Pagination offset
- `sort` (enum: 'recent' | 'oldest', default: 'recent'): Sort order

**Response:**
```json
{
  "status": "ok",
  "comments": [
    {
      "id": "comment-uuid",
      "userId": "user-uuid",
      "username": "commenter_username",
      "commentText": "This is incredible!",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 8,
    "hasMore": false
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/feed/content/:id/share

Generate share URLs for content on various platforms.

**URL Parameters:**
- `id` (UUID): Content ID

**Request Body:**
```json
{
  "content_id": "content-uuid",
  "content_type": "video",
  "platform": "twitter",
  "message": "Check out this amazing AI video!"
}
```

**Parameters:**
- `platform`: 'twitter' | 'facebook' | 'instagram' | 'tiktok' | 'copy_link'
- `message` (optional): Custom share message (max 280 chars)

**Response:**
```json
{
  "status": "ok",
  "shareUrl": "https://twitter.com/intent/tweet?text=...",
  "shareText": "Check out this amazing AI video!",
  "platform": "twitter",
  "content": {
    "id": "content-uuid",
    "type": "video",
    "prompt": "A beautiful sunset over mountains",
    "mediaUrl": "https://storage.example.com/video.mp4",
    "thumbnailUrl": "https://storage.example.com/thumb.jpg",
    "creator": "creator_username"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Platform URLs:**
- `twitter`: Twitter intent URL with pre-filled text
- `facebook`: Facebook sharer URL
- `copy_link`: Direct content URL for copying
- Others: Default to content URL

### PUT /api/feed/content/:id/privacy

Update content privacy settings (public/private).

**URL Parameters:**
- `id` (UUID): Content ID

**Request Body:**
```json
{
  "content_type": "video",
  "is_public": false
}
```

**Response:**
```json
{
  "status": "ok",
  "contentId": "content-uuid",
  "contentType": "video",
  "isPublic": false,
  "message": "Content is now private",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Note:** Users can only update privacy for content they own.

### DELETE /api/feed/content/:id

Delete user's own content (video or image).

**URL Parameters:**
- `id` (UUID): Content ID to delete

**Request Body:**
```json
{
  "content_type": "video"
}
```

**Parameters:**
- `content_type` (required): 'video' | 'image'

**Response:**
```json
{
  "status": "deleted",
  "contentId": "content-uuid",
  "contentType": "video",
  "message": "Content and related data deleted successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Notes:**
- Users can only delete their own content
- Deleting content also removes all associated likes and comments
- This action is irreversible
- Media files are marked for deletion from storage

**Error Responses:**
- `404 Not Found`: Content not found or user doesn't own it
- `500 Internal Server Error`: Failed to delete content

## Authentication

All endpoints except GET /feed and GET /comments require authentication:

```
Authorization: Bearer <jwt_token>
```

## Error Responses

Standardized error format:

```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Common Error Codes:**
- `FEED_FETCH_ERROR`: Failed to fetch social feed
- `LIKE_ERROR`: Failed to update like status
- `COMMENT_ERROR`: Failed to add comment
- `COMMENTS_FETCH_ERROR`: Failed to fetch comments
- `SHARE_ERROR`: Failed to share content
- `PRIVACY_UPDATE_ERROR`: Failed to update privacy
- `CONTENT_NOT_FOUND`: Content not found or not accessible

## Database Integration

### Automatic Count Updates

The API uses database triggers to automatically maintain accurate counts:

- **Likes Count**: Updated when likes are added/removed
- **Comments Count**: Updated when comments are added/removed
- **Shares Count**: Incremented when content is shared

### Row Level Security (RLS)

- Public content is viewable by all users
- Private content is only viewable by the owner
- Users can only modify content they own

### Feed Algorithm

The feed uses the `get_public_feed()` database function which:

1. Combines videos and images from public content
2. Joins with user profiles for creator information
3. Filters by completion status and media availability
4. Supports pagination and sorting

## Real-time Features

While not implemented in this version, the API is designed to support real-time updates:

- Like counts can be updated via WebSocket
- New comments can be pushed to active viewers
- Share notifications can be sent to content creators

## Rate Limiting

Social endpoints have the following rate limits:

- Feed: 60 requests per minute
- Like/Unlike: 30 requests per minute
- Comment: 10 requests per minute
- Share: 20 requests per minute
- Privacy Update: 10 requests per minute

## Testing

Use the provided test scripts:

```bash
# Test all social endpoints
node backend/test-social.js

# Test feed filtering options
node backend/test-social.js --filters
```

## Analytics Integration

The social API supports analytics tracking for:

- Feed engagement metrics
- Popular content identification
- User interaction patterns
- Share platform preferences

## Content Moderation

Future enhancements will include:

- Automatic content filtering
- User reporting system
- Community guidelines enforcement
- Spam detection for comments

## Performance Considerations

- Feed queries are optimized with proper database indexes
- Pagination prevents large data transfers
- Counts are maintained via triggers for fast retrieval
- Content URLs use CDN for fast media delivery