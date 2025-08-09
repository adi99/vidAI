import { supabase } from '@/lib/supabase';

export interface NotificationPreferences {
    generation_complete: boolean;
    training_complete: boolean;
    social_interactions: boolean;
    subscription_updates: boolean;
    system_updates: boolean;
}

class NotificationService {
    /**
     * Get user's notification preferences
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

            // Return default preferences if none found
            return {
                generation_complete: true,
                training_complete: true,
                social_interactions: true,
                subscription_updates: true,
                system_updates: true,
            };
        } catch (error) {
            console.error('Error getting notification preferences:', error);
            return null;
        }
    }

    /**
     * Update user's notification preferences
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

            return response.ok;
        } catch (error) {
            console.error('Error updating notification preferences:', error);
            return false;
        }
    }
}

export const notificationService = new NotificationService();