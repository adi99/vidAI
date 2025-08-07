import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceiptId } from 'expo-server-sdk';
import { supabaseAdmin } from '../config/database';
import { logger } from '../config/logger';

export interface NotificationTemplate {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export interface NotificationPreferences {
  generation_complete: boolean;
  training_complete: boolean;
  social_interactions: boolean;
  subscription_updates: boolean;
  system_updates: boolean;
}

class PushNotificationService {
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  /**
   * Register a push token for a user
   */
  async registerPushToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    try {
      // Validate the token format
      if (!Expo.isExpoPushToken(token)) {
        throw new Error('Invalid Expo push token format');
      }

      // Deactivate any existing tokens for this user and platform
      await supabaseAdmin
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('platform', platform);

      // Insert or update the new token
      const { error } = await supabaseAdmin
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token,
          platform,
          is_active: true,
        }, {
          onConflict: 'user_id,token'
        });

      if (error) {
        throw error;
      }

      logger.info(`Push token registered for user ${userId} on ${platform}`);
    } catch (error) {
      logger.error('Failed to register push token:', error);
      throw error;
    }
  }

  /**
   * Unregister a push token
   */
  async unregisterPushToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('token', token);

      if (error) {
        throw error;
      }

      logger.info(`Push token unregistered for user ${userId}`);
    } catch (error) {
      logger.error('Failed to unregister push token:', error);
      throw error;
    }
  }

  /**
   * Get active push tokens for a user
   */
  async getUserPushTokens(userId: string): Promise<string[]> {
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
      logger.error('Failed to get user push tokens:', error);
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
   * Send notification to a specific user
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

      // Get user's push tokens
      const tokens = await this.getUserPushTokens(userId);
      if (tokens.length === 0) {
        logger.info(`No active push tokens found for user ${userId}`);
        return;
      }

      await this.sendNotificationToTokens(tokens, template);
    } catch (error) {
      logger.error(`Failed to send notification to user ${userId}:`, error);
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
      const promises = userIds.map(userId => 
        this.sendNotificationToUser(userId, template, notificationType)
      );
      
      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Failed to send notifications to users:', error);
      throw error;
    }
  }

  /**
   * Send notification to specific tokens
   */
  async sendNotificationToTokens(tokens: string[], template: NotificationTemplate): Promise<void> {
    try {
      // Filter valid tokens
      const validTokens = tokens.filter(token => Expo.isExpoPushToken(token));
      
      if (validTokens.length === 0) {
        logger.warn('No valid push tokens provided');
        return;
      }

      // Create messages
      const messages: ExpoPushMessage[] = validTokens.map(token => {
        const message: ExpoPushMessage = {
          to: token,
          title: template.title,
          body: template.body,
          data: template.data || {},
          sound: template.sound || 'default',
          priority: template.priority || 'default',
        };
        
        if (template.badge !== undefined) {
          message.badge = template.badge;
        }
        
        return message;
      });

      // Send notifications in chunks
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          logger.error('Failed to send push notification chunk:', error);
        }
      }

      // Handle tickets and get receipts
      await this.handlePushTickets(tickets);

      logger.info(`Sent ${messages.length} push notifications`);
    } catch (error) {
      logger.error('Failed to send push notifications:', error);
      throw error;
    }
  }

  /**
   * Handle push tickets and get receipts
   */
  private async handlePushTickets(tickets: ExpoPushTicket[]): Promise<void> {
    try {
      const receiptIds: ExpoPushReceiptId[] = [];

      // Collect receipt IDs from successful tickets
      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          receiptIds.push(ticket.id);
        } else {
          logger.error('Push notification ticket error:', ticket);
        }
      }

      if (receiptIds.length === 0) {
        return;
      }

      // Get receipts in chunks
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      
      for (const chunk of receiptIdChunks) {
        try {
          const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
          
          // Handle receipt errors
          for (const receiptId in receipts) {
            const receipt = receipts[receiptId];
            if (receipt.status === 'error') {
              logger.error(`Push notification receipt error for ${receiptId}:`, receipt);
              
              // Handle specific errors
              if (receipt.details?.error === 'DeviceNotRegistered') {
                // Token is invalid, should be removed from database
                await this.handleInvalidToken(receiptId);
              }
            }
          }
        } catch (error) {
          logger.error('Failed to get push notification receipts:', error);
        }
      }
    } catch (error) {
      logger.error('Failed to handle push tickets:', error);
    }
  }

  /**
   * Handle invalid tokens by marking them as inactive
   */
  private async handleInvalidToken(receiptId: string): Promise<void> {
    try {
      // In a production app, you'd want to track receipt IDs to tokens
      // For now, we'll log the invalid token
      logger.warn(`Invalid push token detected for receipt ${receiptId}`);
      
      // TODO: Implement token tracking and cleanup
      // This would require storing receipt IDs with tokens to identify which token is invalid
    } catch (error) {
      logger.error('Failed to handle invalid token:', error);
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

export { PushNotificationService };
export const pushNotificationService = new PushNotificationService();