import { supabase } from '@/lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface UserStats {
  content: {
    videosCreated: number;
    imagesGenerated: number;
    totalGenerations: number;
  };
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalLiked: number;
    engagementRate: string;
  };
  social: {
    followers: number;
    following: number;
    followerGrowth: string;
  };
  credits: {
    totalSpent: number;
    averagePerGeneration: string;
  };
}

export interface UserAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserContent {
  id: string;
  content_type: 'video' | 'image';
  prompt: string;
  video_url?: string;
  image_url?: string;
  thumbnail_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  is_public: boolean;
  is_liked?: boolean;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  credits_used: number;
  created_at: string;
  completed_at?: string;
}

export interface UserSettings {
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  privacy_profile: 'public' | 'private' | 'followers_only';
  privacy_content: 'public' | 'private' | 'followers_only';
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  credits_per_month: number;
  features: string[];
  limits: {
    videos_per_month: number;
    images_per_month: number;
    max_video_duration: number;
    training_models: number;
  };
  popular: boolean;
}

export interface SubscriptionStatus {
  isActive: boolean;
  planId: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  creditsRemaining: number;
  totalCredits: number;
}

export interface CreditTransaction {
  id: string;
  transaction_type: 'purchase' | 'deduction' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

class ProfileService {
  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/user/stats`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user stats');
      }

      return data.stats;
    } catch (error) {
      console.error('Profile stats error:', error);
      throw error;
    }
  }

  // Get user achievements
  async getUserAchievements(): Promise<{
    achievements: UserAchievement[];
    totalAchievements: number;
    stats: Record<string, any>;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/user/achievements`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user achievements');
      }

      return {
        achievements: data.achievements,
        totalAchievements: data.totalAchievements,
        stats: data.stats,
      };
    } catch (error) {
      console.error('Profile achievements error:', error);
      throw error;
    }
  }

  // Get user content
  async getUserContent(options: {
    content_type?: 'video' | 'image' | 'all';
    status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'all';
    is_public?: 'true' | 'false' | 'all';
    limit?: number;
    offset?: number;
    sort?: 'recent' | 'oldest' | 'popular';
    liked?: boolean;
  } = {}): Promise<{
    content: UserContent[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const params = new URLSearchParams();
      if (options.content_type) params.append('content_type', options.content_type);
      if (options.status) params.append('status', options.status);
      if (options.is_public) params.append('is_public', options.is_public);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.sort) params.append('sort', options.sort);
      if (options.liked) params.append('liked', 'true');

      const response = await fetch(`${API_BASE_URL}/user/content?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user content');
      }

      return {
        content: data.content,
        pagination: data.pagination,
      };
    } catch (error) {
      console.error('Profile content error:', error);
      throw error;
    }
  }

  // Get user settings
  async getUserSettings(): Promise<UserSettings> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/user/settings`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user settings');
      }

      return data.settings;
    } catch (error) {
      console.error('Profile settings error:', error);
      throw error;
    }
  }

  // Update user settings
  async updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/user/settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user settings');
      }

      return data.settings;
    } catch (error) {
      console.error('Profile settings update error:', error);
      throw error;
    }
  }

  // Get credit history
  async getCreditHistory(options: {
    transaction_type?: 'purchase' | 'deduction' | 'refund' | 'bonus' | 'all';
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<{
    transactions: CreditTransaction[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const params = new URLSearchParams();
      if (options.transaction_type) params.append('transaction_type', options.transaction_type);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.start_date) params.append('start_date', options.start_date);
      if (options.end_date) params.append('end_date', options.end_date);

      const response = await fetch(`${API_BASE_URL}/user/credits/history?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get credit history');
      }

      return {
        transactions: data.transactions,
        pagination: data.pagination,
      };
    } catch (error) {
      console.error('Credit history error:', error);
      throw error;
    }
  }

  // Process credit purchase
  async purchaseCredits(options: {
    package_id: string;
    receipt_data: string;
    platform: 'ios' | 'android';
    transaction_id: string;
  }): Promise<{
    transactionId: string;
    packageId: string;
    creditsPurchased: number;
    priceUsd: number;
    newBalance: number;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/user/credits/purchase`, {
        method: 'POST',
        headers,
        body: JSON.stringify(options),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to purchase credits');
      }

      return data.purchase;
    } catch (error) {
      console.error('Credit purchase error:', error);
      throw error;
    }
  }

  // Get subscription plans
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/plans`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get subscription plans');
      }

      return data.plans;
    } catch (error) {
      console.error('Subscription plans error:', error);
      throw error;
    }
  }

  // Get subscription status
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/subscription/status`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get subscription status');
      }

      return data.subscription;
    } catch (error) {
      console.error('Subscription status error:', error);
      throw error;
    }
  }

  // Manage subscription
  async manageSubscription(options: {
    action: 'subscribe' | 'upgrade' | 'downgrade' | 'cancel' | 'reactivate';
    plan_id?: string;
    receipt_data?: string;
    platform?: 'ios' | 'android';
    transaction_id?: string;
  }): Promise<{
    action: string;
    subscription: any;
    creditsAdded?: number;
    effectiveDate?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/subscription/manage`, {
        method: 'POST',
        headers,
        body: JSON.stringify(options),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to manage subscription');
      }

      return {
        action: data.action,
        subscription: data.subscription,
        creditsAdded: data.creditsAdded,
        effectiveDate: data.effectiveDate,
      };
    } catch (error) {
      console.error('Subscription management error:', error);
      throw error;
    }
  }

  // Share content
  async shareContent(contentId: string, platform?: string): Promise<{
    shareUrl: string;
    shareCount: number;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/content/${contentId}/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ platform }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to share content');
      }

      return {
        shareUrl: data.shareUrl,
        shareCount: data.shareCount,
      };
    } catch (error) {
      console.error('Content share error:', error);
      throw error;
    }
  }

  // Delete content
  async deleteContent(contentId: string): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/content/${contentId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete content');
      }

      return true;
    } catch (error) {
      console.error('Content delete error:', error);
      throw error;
    }
  }
}

export const profileService = new ProfileService();