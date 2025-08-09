import { supabaseAdmin } from '../config/database';
import { logger } from '../config/logger';

export interface NotificationTemplate {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  image?: string;
  url?: string;
}

export interface NotificationPreferences {
  generation_complete: boolean;
  training_complete: boolean;
  social_interactions: boolean;
  subscription_updates: boolean;
  system_updates: boolean;
}

interface OneSignalNotificationPayload {
  app_id: string;
  target_channel: 'push';
  headings: { [key: string]: string };
  contents: { [key: string]: string };
  data?: Record<string, any>;
  ios_sound?: string;
  android_sound?: string;
  ios_badgeType?: string;
  ios_badgeCount?: number;
  priority?: number;
  big_picture?: string;
  ios_attachments?: { [key: string]: string };
  url?: string;
  include_external_user_ids?: string[];
  include_subscription_ids?: string[];
  filters?: Array<{ field: string; key?: string; relation: string; value: string }>;
}

class OneSignalPushService {
  private appId: string;
  private apiKey: string;
  private baseUrl = 'https://api.onesignal.com';

  constructor() {
    this.appId = process.env.ONESIGNAL_APP_ID || '';
    this.apiKey = process.env.ONESIGNAL_API_KEY || '';
    
    if (!this.appId || !this.apiKey) {
      logger.warn('OneSignal App ID or API Key not configured');
    }
  }

  /**
   * Register a OneSignal subscription for a user
   */
  async registerSubscription(
    userId: string, 
    subscriptionId: string, 
    platform: 'ios' | 'android'
  ): Promise<void> {
    try {
      // Deactivate any existing subscriptions for this user and platform
      await supabaseAdmin
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('platform', platform);

      // Insert or update the new subscription
      const { error } = await supabaseAdmin
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token: subscriptionId, // Store OneSignal subscription ID as token
          platform,
          is_active: true,
        }, {
          onConflict: 'user_id,token'
        });

      if (error) {
        throw error;
      }

      logger.info(`OneSignal subscription registered for user ${userId} on ${platform}`);
    } catch (error) {
      logger.error('Failed to register OneSignal subscription:', error);
      throw error;
    }
  }

  /**
   * Unregister a OneSignal subscription
   */
  async unregisterSubscription(userId: string, subscriptionId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('token', subscriptionId);

      if (error) {
        throw error;
      }

      logger.info(`OneSignal subscription unregistered for user ${userId}`);
    } catch (error) {
      logger.error('Failed to unregister OneSignal subscription:', error);
      throw error;
    }
  }

  /**
   * Get active OneSignal subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      return data?.map(row => row.token) || [];
    } catch (error) {
      logger.error('Failed to get user OneSignal subscriptions:', error);
      return [];
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('notification_preferences')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      // Default preferences if not set
      const defaultPreferences: NotificationPreferences = {
        generation_complete: true,
        training_complete: true,
        social_interactions: true,
        subscription_updates: true,
        system_updates: true,
      };

      return data?.notification_preferences || defaultPreferences;
    } catch (error) {
      logger.error('Failed to get notification preferences:', error);
      // Return default preferences on error
      return {
        generation_complete: true,
        training_complete: true,
        social_interactions: true,
        subscription_updates: true,
        system_updates: true,
      };
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const currentPreferences = await this.getNotificationPreferences(userId);
      const updatedPreferences = { ...currentPreferences, ...preferences };

      const { error } = await supabaseAdmin
        .from('users')
        .update({ notification_preferences: updatedPreferences })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      logger.info(`Notification preferences updated for user ${userId}`);
    } catch (error) {
      logger.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  /**
   * Send notification to a specific user using external user ID
   */
  async sendNotificationToUser(
    userId: string,
    template: NotificationTemplate,
    notificationType: keyof NotificationPreferences
  ): Promise<void> {
    try {
      // Check user preferences
      const preferences = await this.getNotificationPreferences(userId);
      if (!preferences[notificationType]) {
        logger.info(`Notification skipped for user ${userId} - preference disabled for ${notificationType}`);
        return;
      }

      const payload: OneSignalNotificationPayload = {
        app_id: this.appId,
        target_channel: 'push',
        headings: { en: template.title },
        contents: { en: template.body },
        include_external_user_ids: [userId], // Use external user ID (our user ID)
        data: template.data || {},
      };

      // Add optional properties
      if (template.sound) {
        payload.ios_sound = template.sound;
        payload.android_sound = template.sound;
      }

      if (template.badge !== undefined) {
        payload.ios_badgeType = 'SetTo';
        payload.ios_badgeCount = template.badge;
      }

      if (template.priority) {
        payload.priority = template.priority === 'high' ? 10 : template.priority === 'normal' ? 5 : 0;
      }

      if (template.image) {
        payload.big_picture = template.image;
        payload.ios_attachments = { image: template.image };
      }

      if (template.url) {
        payload.url = template.url;
      }

      await this.sendOneSignalNotification(payload);
    } catch (error) {
      logger.error(`Failed to send OneSignal notification to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendNotificationToUsers(
    userIds: string[],
    template: NotificationTemplate,
    notificationType: keyof NotificationPreferences
  ): Promise<void> {
    try {
      // Filter users based on preferences
      const eligibleUsers: string[] = [];
      
      for (const userId of userIds) {
        const preferences = await this.getNotificationPreferences(userId);
        if (preferences[notificationType]) {
          eligibleUsers.push(userId);
        }
      }

      if (eligibleUsers.length === 0) {
        logger.info('No eligible users for notification');
        return;
      }

      const payload: OneSignalNotificationPayload = {
        app_id: this.appId,
        target_channel: 'push',
        headings: { en: template.title },
        contents: { en: template.body },
        include_external_user_ids: eligibleUsers,
        data: template.data || {},
      };

      // Add optional properties
      if (template.sound) {
        payload.ios_sound = template.sound;
        payload.android_sound = template.sound;
      }

      if (template.badge !== undefined) {
        payload.ios_badgeType = 'SetTo';
        payload.ios_badgeCount = template.badge;
      }

      if (template.priority) {
        payload.priority = template.priority === 'high' ? 10 : template.priority === 'normal' ? 5 : 0;
      }

      if (template.image) {
        payload.big_picture = template.image;
        payload.ios_attachments = { image: template.image };
      }

      if (template.url) {
        payload.url = template.url;
      }

      await this.sendOneSignalNotification(payload);
    } catch (error) {
      logger.error('Failed to send OneSignal notifications to users:', error);
      throw error;
    }
  }

  /**
   * Send notification to users with specific tags/segments
   */
  async sendNotificationToSegment(
    segmentName: string,
    template: NotificationTemplate
  ): Promise<void> {
    try {
      const payload: OneSignalNotificationPayload = {
        app_id: this.appId,
        target_channel: 'push',
        headings: { en: template.title },
        contents: { en: template.body },
        filters: [
          { field: 'tag', key: 'segment', relation: '=', value: segmentName }
        ],
        data: template.data || {},
      };

      // Add optional properties
      if (template.sound) {
        payload.ios_sound = template.sound;
        payload.android_sound = template.sound;
      }

      if (template.priority) {
        payload.priority = template.priority === 'high' ? 10 : template.priority === 'normal' ? 5 : 0;
      }

      if (template.image) {
        payload.big_picture = template.image;
        payload.ios_attachments = { image: template.image };
      }

      if (template.url) {
        payload.url = template.url;
      }

      await this.sendOneSignalNotification(payload);
    } catch (error) {
      logger.error(`Failed to send OneSignal notification to segment ${segmentName}:`, error);
      throw error;
    }
  }

  /**
   * Send notification using OneSignal REST API
   */
  private async sendOneSignalNotification(payload: OneSignalNotificationPayload): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OneSignal API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      logger.info(`OneSignal notification sent successfully: ${result.id}`);
    } catch (error) {
      logger.error('Failed to send OneSignal notification:', error);
      throw error;
    }
  }

  /**
   * Create or update a user in OneSignal
   */
  async createOrUpdateUser(userId: string, properties: Record<string, any> = {}): Promise<void> {
    try {
      const payload = {
        identity: { external_id: userId },
        properties: {
          tags: properties,
          ...properties
        }
      };

      const response = await fetch(`${this.baseUrl}/apps/${this.appId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.warn(`OneSignal user creation/update warning: ${response.status} - ${JSON.stringify(errorData)}`);
        // Don't throw error as this is not critical
        return;
      }

      const result = await response.json();
      logger.info(`OneSignal user created/updated: ${result.identity?.external_id}`);
    } catch (error) {
      logger.error('Failed to create/update OneSignal user:', error);
      // Don't throw error as this is not critical for notification sending
    }
  }

  /**
   * Predefined notification templates
   */
  static templates = {
    generationComplete: (type: 'image' | 'video', jobId: string): NotificationTemplate => ({
      title: `${type === 'image' ? 'Image' : 'Video'} Generation Complete!`,
      body: `Your AI-generated ${type} is ready to view.`,
      data: { type: 'generation_complete', jobId, contentType: type },
      sound: 'default',
      priority: 'high' as const,
    }),

    trainingComplete: (modelName: string, jobId: string): NotificationTemplate => ({
      title: 'Model Training Complete!',
      body: `Your custom model "${modelName}" is ready to use.`,
      data: { type: 'training_complete', jobId, modelName },
      sound: 'default',
      priority: 'high' as const,
    }),

    newLike: (contentType: 'image' | 'video', likerName: string): NotificationTemplate => ({
      title: 'New Like!',
      body: `${likerName} liked your ${contentType}.`,
      data: { type: 'social_like', contentType, likerName },
      sound: 'default',
      priority: 'normal' as const,
    }),

    newComment: (contentType: 'image' | 'video', commenterName: string): NotificationTemplate => ({
      title: 'New Comment!',
      body: `${commenterName} commented on your ${contentType}.`,
      data: { type: 'social_comment', contentType, commenterName },
      sound: 'default',
      priority: 'normal' as const,
    }),

    subscriptionExpiring: (daysLeft: number): NotificationTemplate => ({
      title: 'Subscription Expiring Soon',
      body: `Your subscription expires in ${daysLeft} days. Renew to keep your benefits.`,
      data: { type: 'subscription_expiring', daysLeft },
      sound: 'default',
      priority: 'normal' as const,
    }),

    creditsLow: (creditsLeft: number): NotificationTemplate => ({
      title: 'Credits Running Low',
      body: `You have ${creditsLeft} credits remaining. Purchase more to continue creating.`,
      data: { type: 'credits_low', creditsLeft },
      sound: 'default',
      priority: 'normal' as const,
    }),

    systemMaintenance: (maintenanceTime: string): NotificationTemplate => ({
      title: 'Scheduled Maintenance',
      body: `The app will be under maintenance on ${maintenanceTime}. Plan accordingly.`,
      data: { type: 'system_maintenance', maintenanceTime },
      sound: 'default',
      priority: 'normal' as const,
    }),
  };
}

export { OneSignalPushService };
export const oneSignalPushService = new OneSignalPushService();