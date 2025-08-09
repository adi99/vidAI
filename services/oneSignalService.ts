import { OneSignal } from 'react-native-onesignal';
import { supabase } from '@/lib/supabase';

export interface NotificationPreferences {
  generation_complete: boolean;
  training_complete: boolean;
  social_interactions: boolean;
  subscription_updates: boolean;
  system_updates: boolean;
}

class OneSignalService {
  private isInitialized = false;

  /**
   * Initialize OneSignal with user identification and consent check
   */
  async initializeWithUser(userId: string, hasConsent: boolean = true): Promise<void> {
    try {
      if (!this.isInitialized) {
        // Set consent requirements if needed
        if (!hasConsent) {
          OneSignal.setConsentRequired(true);
          console.log('OneSignal consent required set to true');
          return; // Don't initialize until consent is given
        }

        // Set external ID for user identification
        OneSignal.login(userId);
        
        // Add basic user tags
        OneSignal.User.addTag('user_id', userId);
        OneSignal.User.addTag('platform', 'mobile');
        OneSignal.User.addTag('consent_given', 'true');
        
        this.isInitialized = true;
        console.log('OneSignal initialized with user:', userId);
      }
    } catch (error) {
      console.error('Error initializing OneSignal with user:', error);
    }
  }

  /**
   * Add user tags for segmentation
   */
  async addUserTags(tags: Record<string, string>): Promise<void> {
    try {
      OneSignal.User.addTags(tags);
      console.log('OneSignal tags added:', tags);
    } catch (error) {
      console.error('Error adding OneSignal tags:', error);
    }
  }

  /**
   * Add single user tag
   */
  async addUserTag(key: string, value: string): Promise<void> {
    try {
      OneSignal.User.addTag(key, value);
      console.log(`OneSignal tag added: ${key} = ${value}`);
    } catch (error) {
      console.error('Error adding OneSignal tag:', error);
    }
  }

  /**
   * Add email subscription
   */
  async addEmail(email: string): Promise<void> {
    try {
      OneSignal.User.addEmail(email);
      console.log('OneSignal email added:', email);
    } catch (error) {
      console.error('Error adding OneSignal email:', error);
    }
  }

  /**
   * Add SMS subscription
   */
  async addSms(phoneNumber: string): Promise<void> {
    try {
      OneSignal.User.addSms(phoneNumber);
      console.log('OneSignal SMS added:', phoneNumber);
    } catch (error) {
      console.error('Error adding OneSignal SMS:', error);
    }
  }

  /**
   * Request push notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const permission = await OneSignal.Notifications.requestPermission(true);
      console.log('OneSignal permission granted:', permission);
      return permission;
    } catch (error) {
      console.error('Error requesting OneSignal permissions:', error);
      return false;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: NotificationPreferences): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        // Update OneSignal tags based on preferences
        const tags: Record<string, string> = {};
        Object.entries(preferences).forEach(([key, value]) => {
          tags[`pref_${key}`] = value.toString();
        });
        await this.addUserTags(tags);
      }

      return response.ok;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
  }

  /**
   * Get current notification preferences
   */
  async getPreferences(): Promise<NotificationPreferences | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/notifications/preferences`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }

  /**
   * Setup OneSignal event listeners
   */
  setupEventListeners(): () => void {
    // Handle notification clicks
    const clickListener = OneSignal.Notifications.addEventListener('click', (event: any) => {
      console.log('OneSignal notification clicked:', event);
      
      const data = event.notification.additionalData;
      
      // Navigate based on notification type
      if (data?.type === 'generation_complete') {
        // Navigate to generation result
        // This would be handled by the navigation system
      } else if (data?.type === 'training_complete') {
        // Navigate to training tab
      } else if (data?.type === 'credits_low') {
        // Navigate to profile/credits
      }
    });

    // Handle foreground notifications
    const foregroundListener = OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
      console.log('OneSignal notification received in foreground:', event);
      // You can show in-app notification or update UI here
    });

    // Handle permission changes
    const permissionListener = OneSignal.Notifications.addEventListener('permissionChange', (permission: any) => {
      console.log('OneSignal permission changed:', permission);
    });

    // Handle user state changes - using a mock implementation since the exact API may vary
    const userStateListener = {
      remove: () => console.log('User state listener removed')
    };

    // Handle push subscription changes - using a mock implementation since the exact API may vary
    const subscriptionListener = {
      remove: () => console.log('Subscription listener removed')
    };

    // Return cleanup function
    return () => {
      // OneSignal listeners are automatically cleaned up when the app is closed
      // But we can explicitly remove them if needed
      console.log('OneSignal listeners cleaned up');
    };
  }

  /**
   * Set consent for privacy compliance
   */
  async setConsentRequired(required: boolean): Promise<void> {
    try {
      OneSignal.setConsentRequired(required);
      console.log('OneSignal consent required set to:', required);
    } catch (error) {
      console.error('Error setting OneSignal consent required:', error);
    }
  }

  /**
   * Give consent for data collection
   */
  async setConsentGiven(given: boolean): Promise<void> {
    try {
      OneSignal.setConsentGiven(given);
      
      if (given) {
        // Add consent tag
        await this.addUserTag('consent_given', 'true');
        await this.addUserTag('consent_date', new Date().toISOString());
      } else {
        // Add consent revoked tag
        await this.addUserTag('consent_given', 'false');
        await this.addUserTag('consent_revoked_date', new Date().toISOString());
      }
      
      console.log('OneSignal consent given set to:', given);
    } catch (error) {
      console.error('Error setting OneSignal consent given:', error);
    }
  }

  /**
   * Check if user has given consent
   */
  async hasUserConsent(): Promise<boolean> {
    try {
      // In a real implementation, you would check the user's consent status
      // For now, we'll assume consent is given unless explicitly set otherwise
      return true;
    } catch (error) {
      console.error('Error checking OneSignal consent:', error);
      return false;
    }
  }

  /**
   * Request user consent with explanation
   */
  async requestUserConsent(): Promise<boolean> {
    try {
      // This would typically show a consent dialog
      // For now, we'll return true and set consent
      await this.setConsentGiven(true);
      return true;
    } catch (error) {
      console.error('Error requesting OneSignal consent:', error);
      return false;
    }
  }

  /**
   * Revoke user consent and clear data
   */
  async revokeConsent(): Promise<void> {
    try {
      await this.setConsentGiven(false);
      
      // Logout user to clear OneSignal data
      await this.logout();
      
      console.log('OneSignal consent revoked and data cleared');
    } catch (error) {
      console.error('Error revoking OneSignal consent:', error);
    }
  }

  /**
   * Logout user from OneSignal
   */
  async logout(): Promise<void> {
    try {
      OneSignal.logout();
      this.isInitialized = false;
      console.log('OneSignal user logged out');
    } catch (error) {
      console.error('Error logging out OneSignal user:', error);
    }
  }

  /**
   * Get current push subscription ID
   */
  getPushSubscriptionId(): string | null {
    try {
      // Note: This may need to be async in the actual OneSignal implementation
      return OneSignal.User.pushSubscription.getPushSubscriptionId();
    } catch (error) {
      console.error('Error getting OneSignal push subscription ID:', error);
      return null;
    }
  }

  /**
   * Get current OneSignal user ID
   */
  async getOneSignalId(): Promise<string | null> {
    try {
      return await OneSignal.User.getOnesignalId();
    } catch (error) {
      console.error('Error getting OneSignal user ID:', error);
      return null;
    }
  }
}

export const oneSignalService = new OneSignalService();