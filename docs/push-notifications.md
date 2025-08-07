# Push Notification System

This document explains how the push notification system works in the AI Video Generation App.

## Overview

The push notification system is built using Expo's push notification service and consists of:

1. **Frontend**: React Native app with `expo-notifications`
2. **Backend**: Node.js server with `expo-server-sdk`
3. **Database**: Supabase with push token storage and user preferences

## Architecture

```
Mobile App (expo-notifications)
    ↓ Register push token
Backend API (expo-server-sdk)
    ↓ Store token & preferences
Supabase Database
    ↓ Queue job completion
BullMQ Workers
    ↓ Send notification
Expo Push Service
    ↓ Deliver notification
User's Device
```

## Frontend Implementation

### Notification Service (`services/notificationService.ts`)

The notification service handles:
- Permission requests
- Push token registration
- Notification preferences management
- Local notification scheduling (for testing)

### Key Methods

```typescript
// Request permissions and register token
await notificationService.registerPushToken();

// Update user preferences
await notificationService.updatePreferences({
  generation_complete: true,
  training_complete: true,
  social_interactions: false,
  subscription_updates: true,
  system_updates: true,
});

// Send test notification (development only)
await notificationService.scheduleLocalNotification(
  'Test Title',
  'Test message',
  { type: 'test' }
);
```

### Notification Preferences Component

The `NotificationPreferences` component provides a UI for users to manage their notification settings. It's accessible through the Profile tab → Push Notifications.

### Hooks

The `useNotifications` hook automatically:
- Requests permissions when user is authenticated
- Registers push tokens with the backend
- Handles permission state management

## Backend Implementation

### Push Notification Service (`backend/src/services/pushNotificationService.ts`)

Handles:
- Token registration and validation
- Preference management
- Notification sending with templates
- Error handling and invalid token cleanup

### API Endpoints

```
POST /api/notifications/register     - Register push token
POST /api/notifications/unregister   - Unregister push token
GET  /api/notifications/preferences  - Get user preferences
PUT  /api/notifications/preferences  - Update preferences
POST /api/notifications/test         - Send test notification (dev only)
GET  /api/notifications/tokens       - List user tokens (dev only)
```

### Queue Integration

Push notifications are automatically sent when:
- **Image generation completes**: `generation_complete` preference
- **Video generation completes**: `generation_complete` preference  
- **Model training completes**: `training_complete` preference
- **Credits are low**: `system_updates` preference
- **Subscription expires**: `subscription_updates` preference

### Notification Templates

Pre-defined templates in `pushNotificationService.templates`:

```typescript
// Generation complete
pushNotificationService.templates.generationComplete('image', jobId);
pushNotificationService.templates.generationComplete('video', jobId);

// Training complete
pushNotificationService.templates.trainingComplete(modelName, jobId);

// Social interactions
pushNotificationService.templates.newLike('video', likerName);
pushNotificationService.templates.newComment('image', commenterName);

// System notifications
pushNotificationService.templates.creditsLow(creditsLeft);
pushNotificationService.templates.subscriptionExpiring(daysLeft);
```

## Database Schema

### Push Tokens Table

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'ios' or 'android'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### User Notification Preferences

```sql
-- Added to users table
notification_preferences JSONB DEFAULT '{
  "generation_complete": true,
  "training_complete": true,
  "social_interactions": true,
  "subscription_updates": true,
  "system_updates": true
}'::jsonb
```

## Environment Variables

### Frontend (.env)

```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

### Backend (.env)

No additional environment variables needed - uses existing Supabase configuration.

## Testing

### Development Testing

1. **Test Notification Button**: Available in Profile tab (development builds only)
2. **Local Notifications**: Use `notificationService.scheduleLocalNotification()`
3. **API Testing**: Use `/api/notifications/test` endpoint

### Production Testing

1. **Generation Flow**: Create image/video generation and wait for completion
2. **Training Flow**: Start model training and wait for completion
3. **Preference Testing**: Toggle preferences and verify notifications respect settings

## Troubleshooting

### Common Issues

1. **No notifications received**:
   - Check device notification permissions
   - Verify push token registration in database
   - Check user notification preferences
   - Verify Expo project ID configuration

2. **Invalid push token errors**:
   - Tokens are automatically cleaned up on receipt errors
   - Users need to re-register tokens (happens automatically on app restart)

3. **Notifications not respecting preferences**:
   - Check database notification_preferences column
   - Verify preference updates are saving correctly

### Debugging

1. **Check push tokens**: Use `/api/notifications/tokens` endpoint (dev only)
2. **Test preferences**: Use `/api/notifications/test` endpoint (dev only)
3. **Monitor logs**: Check backend logs for notification sending errors
4. **Database queries**: Check push_tokens table for active tokens

## Security Considerations

1. **Token Validation**: All tokens are validated using `Expo.isExpoPushToken()`
2. **User Authorization**: Only authenticated users can register tokens
3. **Preference Privacy**: Users can only access their own preferences
4. **Rate Limiting**: API endpoints are rate-limited
5. **Development Endpoints**: Test endpoints are disabled in production

## Future Enhancements

1. **Rich Notifications**: Add images and action buttons
2. **Notification History**: Store sent notifications for user review
3. **Scheduled Notifications**: Support for delayed/scheduled notifications
4. **Notification Analytics**: Track delivery rates and user engagement
5. **Push Notification Campaigns**: Support for marketing notifications