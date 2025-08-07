import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { pushNotificationService } from '../services/pushNotificationService';
import { logger } from '../config/logger';

const router = Router();

// Validation schemas
const RegisterTokenBody = z.object({
  token: z.string().min(1, 'Push token is required'),
  platform: z.enum(['ios', 'android'], {
    errorMap: () => ({ message: 'Platform must be ios or android' })
  }),
});

const UnregisterTokenBody = z.object({
  token: z.string().min(1, 'Push token is required'),
});

const UpdatePreferencesBody = z.object({
  generation_complete: z.boolean().optional(),
  training_complete: z.boolean().optional(),
  social_interactions: z.boolean().optional(),
  subscription_updates: z.boolean().optional(),
  system_updates: z.boolean().optional(),
});

const TestNotificationBody = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  data: z.record(z.any()).optional(),
});

// POST /api/notifications/register - Register push token
router.post(
  '/register',
  authenticateUser,
  validateBody(RegisterTokenBody),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const body = req.body as z.infer<typeof RegisterTokenBody>;
    const userId = req.user!.id;

    try {
      await pushNotificationService.registerPushToken(
        userId,
        body.token,
        body.platform
      );

      res.json({
        status: 'success',
        message: 'Push token registered successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to register push token:', error);
      res.status(500).json({
        status: 'error',
        code: 'REGISTER_TOKEN_ERROR',
        message: error?.message || 'Failed to register push token',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/notifications/unregister - Unregister push token
router.post(
  '/unregister',
  authenticateUser,
  validateBody(UnregisterTokenBody),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const body = req.body as z.infer<typeof UnregisterTokenBody>;
    const userId = req.user!.id;

    try {
      await pushNotificationService.unregisterPushToken(userId, body.token);

      res.json({
        status: 'success',
        message: 'Push token unregistered successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to unregister push token:', error);
      res.status(500).json({
        status: 'error',
        code: 'UNREGISTER_TOKEN_ERROR',
        message: error?.message || 'Failed to unregister push token',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/notifications/preferences - Get notification preferences
router.get(
  '/preferences',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const userId = req.user!.id;

    try {
      const preferences = await pushNotificationService.getNotificationPreferences(userId);

      res.json({
        status: 'success',
        preferences,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to get notification preferences:', error);
      res.status(500).json({
        status: 'error',
        code: 'GET_PREFERENCES_ERROR',
        message: error?.message || 'Failed to get notification preferences',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// PUT /api/notifications/preferences - Update notification preferences
router.put(
  '/preferences',
  authenticateUser,
  validateBody(UpdatePreferencesBody),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const body = req.body as z.infer<typeof UpdatePreferencesBody>;
    const userId = req.user!.id;

    try {
      // Filter out undefined values to match the service interface
      const filteredPreferences = Object.fromEntries(
        Object.entries(body).filter(([_, value]) => value !== undefined)
      ) as Partial<import('../services/pushNotificationService').NotificationPreferences>;
      
      await pushNotificationService.updateNotificationPreferences(userId, filteredPreferences);

      const updatedPreferences = await pushNotificationService.getNotificationPreferences(userId);

      res.json({
        status: 'success',
        message: 'Notification preferences updated successfully',
        preferences: updatedPreferences,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to update notification preferences:', error);
      res.status(500).json({
        status: 'error',
        code: 'UPDATE_PREFERENCES_ERROR',
        message: error?.message || 'Failed to update notification preferences',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// POST /api/notifications/test - Send test notification (development only)
router.post(
  '/test',
  authenticateUser,
  validateBody(TestNotificationBody),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const body = req.body as z.infer<typeof TestNotificationBody>;
    const userId = req.user!.id;

    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        status: 'error',
        code: 'NOT_ALLOWED',
        message: 'Test notifications are not allowed in production',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const template = {
        title: body.title,
        body: body.body,
        data: body.data || { type: 'test' },
        sound: 'default' as const,
        priority: 'normal' as const,
      };

      await pushNotificationService.sendNotificationToUser(
        userId,
        template,
        'system_updates' // Use system_updates preference for test notifications
      );

      res.json({
        status: 'success',
        message: 'Test notification sent successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to send test notification:', error);
      res.status(500).json({
        status: 'error',
        code: 'TEST_NOTIFICATION_ERROR',
        message: error?.message || 'Failed to send test notification',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/notifications/tokens - Get user's registered tokens (for debugging)
router.get(
  '/tokens',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const userId = req.user!.id;

    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        status: 'error',
        code: 'NOT_ALLOWED',
        message: 'Token listing is not allowed in production',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const tokens = await pushNotificationService.getUserPushTokens(userId);

      res.json({
        status: 'success',
        tokens,
        count: tokens.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to get user tokens:', error);
      res.status(500).json({
        status: 'error',
        code: 'GET_TOKENS_ERROR',
        message: error?.message || 'Failed to get user tokens',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;