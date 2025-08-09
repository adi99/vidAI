import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, AuthenticatedRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validation';
import { oneSignalPushService } from '../../services/oneSignalPushService';
import { logger } from '../../config/logger';

const router = Router();

// Type definitions
interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: 'generation_complete' | 'training_done' | 'credit_low' | 'subscription_reminder' | 'custom';
}

// Validation schemas
const SendNotificationBody = z.object({
  templateId: z.string().optional(),
  segmentId: z.string().min(1, 'Segment ID is required'),
  customTitle: z.string().optional(),
  customMessage: z.string().optional(),
  scheduleTime: z.string().optional(),
});

const CreateTemplateBody = z.object({
  name: z.string().min(1, 'Template name is required'),
  title: z.string().min(1, 'Template title is required'),
  message: z.string().min(1, 'Template message is required'),
  type: z.enum(['generation_complete', 'training_done', 'credit_low', 'subscription_reminder', 'custom']),
});

// Mock data for templates and segments (in production, these would come from OneSignal API or database)
const mockTemplates = [
  {
    id: 'template_1',
    name: 'Generation Complete',
    title: 'Your AI creation is ready! 🎨',
    message: 'Your AI-generated content has been processed and is ready to view.',
    type: 'generation_complete' as const,
  },
  {
    id: 'template_2',
    name: 'Training Complete',
    title: 'Model training finished! 🚀',
    message: 'Your custom AI model has finished training and is ready to use.',
    type: 'training_done' as const,
  },
  {
    id: 'template_3',
    name: 'Credits Low',
    title: 'Credits running low ⚡',
    message: 'You have less than 10 credits remaining. Top up to continue creating!',
    type: 'credit_low' as const,
  },
  {
    id: 'template_4',
    name: 'Subscription Reminder',
    title: 'Subscription expires soon 📅',
    message: 'Your premium subscription expires in 3 days. Renew to keep your benefits!',
    type: 'subscription_reminder' as const,
  },
];

const mockSegments = [
  {
    id: 'all_users',
    name: 'All Users',
    description: 'All registered users',
    userCount: 1250,
    filters: ['All Users'],
  },
  {
    id: 'active_users',
    name: 'Active Users',
    description: 'Users who have been active in the last 7 days',
    userCount: 890,
    filters: ['Last Seen < 7 days'],
  },
  {
    id: 'premium_users',
    name: 'Premium Users',
    description: 'Users with active premium subscriptions',
    userCount: 320,
    filters: ['Subscription Status = Premium'],
  },
  {
    id: 'low_credit_users',
    name: 'Low Credit Users',
    description: 'Users with less than 50 credits',
    userCount: 180,
    filters: ['Credits < 50'],
  },
  {
    id: 'new_users',
    name: 'New Users',
    description: 'Users who joined in the last 30 days',
    userCount: 95,
    filters: ['Registration Date < 30 days'],
  },
];

// GET /api/admin/onesignal/templates - Get notification templates
router.get('/templates', authenticateUser, async (_req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    // In production, you would fetch templates from OneSignal API or database
    res.json({
      success: true,
      templates: mockTemplates,
    });
  } catch (error) {
    logger.error('Failed to get OneSignal templates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get templates',
    });
  }
});

// POST /api/admin/onesignal/templates - Create notification template
router.post(
  '/templates',
  authenticateUser,
  validateBody(CreateTemplateBody),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const body = req.body as z.infer<typeof CreateTemplateBody>;

    try {
      // In production, you would create the template in OneSignal or database
      const newTemplate = {
        id: `template_${Date.now()}`,
        ...body,
      } as NotificationTemplate;

      (mockTemplates as any[]).push(newTemplate);

      logger.info(`OneSignal template created: ${newTemplate.name}`);

      res.json({
        success: true,
        template: newTemplate,
      });
    } catch (error) {
      logger.error('Failed to create OneSignal template:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create template',
      });
    }
  }
);

// GET /api/admin/onesignal/segments - Get user segments
router.get('/segments', authenticateUser, async (_req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    // In production, you would fetch segments from OneSignal API
    res.json({
      success: true,
      segments: mockSegments,
    });
  } catch (error) {
    logger.error('Failed to get OneSignal segments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get segments',
    });
  }
});

// POST /api/admin/onesignal/send - Send notification
router.post(
  '/send',
  authenticateUser,
  validateBody(SendNotificationBody),
  async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const body = req.body as z.infer<typeof SendNotificationBody>;

    try {
      let template;

      if (body.templateId) {
        // Use predefined template
        const predefinedTemplate = mockTemplates.find(t => t.id === body.templateId);
        if (!predefinedTemplate) {
          return res.status(400).json({
            success: false,
            error: 'Template not found',
          });
        }
        
        template = {
          title: predefinedTemplate.title,
          body: predefinedTemplate.message,
          data: { 
            type: predefinedTemplate.type,
            template_id: predefinedTemplate.id,
          },
          sound: 'default' as const,
          priority: 'normal' as const,
        };
      } else if (body.customTitle && body.customMessage) {
        // Use custom title and message
        template = {
          title: body.customTitle,
          body: body.customMessage,
          data: { 
            type: 'custom',
            sent_from: 'admin_dashboard',
          },
          sound: 'default' as const,
          priority: 'normal' as const,
        };
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either templateId or both customTitle and customMessage are required',
        });
      }

      // Find segment
      const segment = mockSegments.find(s => s.id === body.segmentId);
      if (!segment) {
        return res.status(400).json({
          success: false,
          error: 'Segment not found',
        });
      }

      // Send notification based on segment
      if (body.segmentId === 'all_users') {
        // Send to all users using OneSignal segments
        await oneSignalPushService.sendNotificationToSegment('All', template);
      } else {
        // For other segments, you would implement specific logic
        // For now, we'll use the segment name as a tag filter
        await oneSignalPushService.sendNotificationToSegment(segment.name, template);
      }

      const notificationId = `notification_${Date.now()}`;

      logger.info(`OneSignal notification sent to segment ${segment.name}: ${notificationId}`);

      res.json({
        success: true,
        notificationId,
        message: `Notification sent to ${segment.userCount} users in segment "${segment.name}"`,
      });
    } catch (error) {
      logger.error('Failed to send OneSignal notification:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send notification',
      });
    }
  }
);

// GET /api/admin/onesignal/analytics - Get notification analytics
router.get('/analytics', authenticateUser, async (_req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    // In production, you would fetch analytics from OneSignal API
    const mockStats = {
      sent: 15420,
      delivered: 14890,
      opened: 8934,
      clicked: 2156,
      deliveryRate: 0.966,
      openRate: 0.600,
      clickRate: 0.241,
    };

    res.json({
      success: true,
      stats: mockStats,
    });
  } catch (error) {
    logger.error('Failed to get OneSignal analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
    });
  }
});

// GET /api/admin/onesignal/users/:userId - Get user notification info
router.get('/users/:userId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { userId } = req.params;

  try {
    // Get user's OneSignal subscriptions
    const subscriptions = await oneSignalPushService.getUserSubscriptions(userId);
    
    // Get user's notification preferences
    const preferences = await oneSignalPushService.getNotificationPreferences(userId);

    res.json({
      success: true,
      user: {
        id: userId,
        subscriptions,
        preferences,
        subscriptionCount: subscriptions.length,
      },
    });
  } catch (error) {
    logger.error(`Failed to get OneSignal user info for ${userId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user info',
    });
  }
});

// POST /api/admin/onesignal/test/:userId - Send test notification to specific user
router.post('/test/:userId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { userId } = req.params;

  try {
    const template = {
      title: '🧪 Test Notification',
      body: 'This is a test notification from the admin dashboard.',
      data: { 
        type: 'test',
        sent_from: 'admin_dashboard',
        timestamp: new Date().toISOString(),
      },
      sound: 'default' as const,
      priority: 'normal' as const,
    };

    await oneSignalPushService.sendNotificationToUser(userId, template, 'system_updates');

    logger.info(`Test notification sent to user ${userId}`);

    res.json({
      success: true,
      message: `Test notification sent to user ${userId}`,
    });
  } catch (error) {
    logger.error(`Failed to send test notification to user ${userId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
    });
  }
});

export default router;