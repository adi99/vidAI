// User service for fetching and managing user profile data
import { supabase } from '../lib/supabase';
import { Profile, SubscriptionStatus } from '../types/database';

export interface UserProfile extends Profile {
  // Additional computed fields
  isSubscribed: boolean;
  subscriptionDaysRemaining?: number;
}

export class UserService {
  // Fetch user profile with credits and subscription data
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      // Compute additional fields
      const isSubscribed = data.subscription_status !== 'free';
      let subscriptionDaysRemaining: number | undefined;

      if (data.subscription_expires_at) {
        const expiresAt = new Date(data.subscription_expires_at);
        const now = new Date();
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        subscriptionDaysRemaining = daysRemaining > 0 ? daysRemaining : 0;
      }

      return {
        ...data,
        isSubscribed,
        subscriptionDaysRemaining,
      };
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }

  // Subscribe to profile changes for real-time updates
  static subscribeToProfileChanges(
    userId: string,
    callback: (profile: UserProfile) => void
  ) {
    const subscription = supabase
      .channel(`profile:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          // Fetch the updated profile
          const profile = await UserService.getUserProfile(userId);
          if (profile) {
            callback(profile);
          }
        }
      )
      .subscribe();

    return subscription;
  }

  // Update user credits (for local optimistic updates)
  static async updateCredits(
    userId: string,
    amount: number,
    transactionType: string,
    description?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('update_user_credits', {
        user_id: userId,
        amount,
        transaction_type: transactionType,
        description,
      });

      if (error) {
        console.error('Error updating credits:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateCredits:', error);
      return false;
    }
  }

  // Get current credit balance
  static async getCreditBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching credit balance:', error);
        return 0;
      }

      return data?.credits || 0;
    } catch (error) {
      console.error('Error in getCreditBalance:', error);
      return 0;
    }
  }

  // Check if user has enough credits
  static async hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const balance = await UserService.getCreditBalance(userId);
    return balance >= requiredCredits;
  }

  // Get subscription status
  static async getSubscriptionStatus(userId: string): Promise<{
    status: SubscriptionStatus;
    expiresAt?: string;
    isActive: boolean;
  }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_expires_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching subscription status:', error);
        return { status: 'free', isActive: false };
      }

      const isActive = data.subscription_status !== 'free' && 
        (!data.subscription_expires_at || new Date(data.subscription_expires_at) > new Date());

      return {
        status: data.subscription_status,
        expiresAt: data.subscription_expires_at,
        isActive,
      };
    } catch (error) {
      console.error('Error in getSubscriptionStatus:', error);
      return { status: 'free', isActive: false };
    }
  }
}