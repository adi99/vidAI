import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { 
  profileService, 
  UserStats, 
  UserAchievement, 
  UserContent, 
  UserSettings, 
  SubscriptionPlan, 
  SubscriptionStatus,
  CreditTransaction 
} from '@/services/profileService';
import { useAuth } from '@/contexts/AuthContext';

export interface UseProfileReturn {
  // User data
  stats: UserStats | null;
  achievements: UserAchievement[];
  userContent: UserContent[];
  settings: UserSettings | null;
  
  // Subscription data
  subscriptionPlans: SubscriptionPlan[];
  subscriptionStatus: SubscriptionStatus | null;
  
  // Credit data
  creditHistory: CreditTransaction[];
  
  // Content management
  selectedContentTab: 'videos' | 'images' | 'liked';
  setSelectedContentTab: (tab: 'videos' | 'images' | 'liked') => void;
  
  // Actions
  loadUserData: () => Promise<void>;
  loadUserContent: (tab?: 'videos' | 'images' | 'liked', refresh?: boolean) => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  shareContent: (contentId: string) => Promise<void>;
  deleteContent: (contentId: string) => Promise<void>;
  purchaseCredits: (packageId: string, receiptData: string, platform: 'ios' | 'android', transactionId: string) => Promise<void>;
  manageSubscription: (action: 'subscribe' | 'upgrade' | 'downgrade' | 'cancel' | 'reactivate', planId?: string) => Promise<void>;
  
  // State
  isLoading: boolean;
  isLoadingContent: boolean;
  error: string | null;
  
  // Pagination
  hasMoreContent: boolean;
  loadMoreContent: () => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const { user, refreshProfile } = useAuth();
  
  // User data state
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [userContent, setUserContent] = useState<UserContent[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  
  // Subscription state
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  
  // Credit state
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([]);
  
  // Content management state
  const [selectedContentTab, setSelectedContentTab] = useState<'videos' | 'images' | 'liked'>('videos');
  
  // Loading and error state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [contentOffset, setContentOffset] = useState(0);
  const [hasMoreContent, setHasMoreContent] = useState(true);

  // Load user data (stats, achievements, settings, subscription)
  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all user data in parallel
      const [
        statsData,
        achievementsData,
        settingsData,
        plansData,
        subscriptionData,
      ] = await Promise.allSettled([
        profileService.getUserStats(),
        profileService.getUserAchievements(),
        profileService.getUserSettings(),
        profileService.getSubscriptionPlans(),
        profileService.getSubscriptionStatus(),
      ]);

      // Handle stats
      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      } else {
        console.error('Failed to load stats:', statsData.reason);
      }

      // Handle achievements
      if (achievementsData.status === 'fulfilled') {
        setAchievements(achievementsData.value.achievements);
      } else {
        console.error('Failed to load achievements:', achievementsData.reason);
      }

      // Handle settings
      if (settingsData.status === 'fulfilled') {
        setSettings(settingsData.value);
      } else {
        console.error('Failed to load settings:', settingsData.reason);
      }

      // Handle subscription plans
      if (plansData.status === 'fulfilled') {
        setSubscriptionPlans(plansData.value);
      } else {
        console.error('Failed to load subscription plans:', plansData.reason);
      }

      // Handle subscription status
      if (subscriptionData.status === 'fulfilled') {
        setSubscriptionStatus(subscriptionData.value);
      } else {
        console.error('Failed to load subscription status:', subscriptionData.reason);
      }

    } catch (error: any) {
      console.error('Error loading user data:', error);
      setError('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load user content based on selected tab
  const loadUserContent = useCallback(async (tab?: 'videos' | 'images' | 'liked', refresh = false) => {
    try {
      setIsLoadingContent(true);
      setError(null);

      const contentTab = tab || selectedContentTab;
      const offset = refresh ? 0 : contentOffset;

      let contentType: 'video' | 'image' | 'all' = 'all';
      let liked = false;

      if (contentTab === 'videos') {
        contentType = 'video';
      } else if (contentTab === 'images') {
        contentType = 'image';
      } else if (contentTab === 'liked') {
        contentType = 'all';
        liked = true;
      }

      const response = await profileService.getUserContent({
        content_type: contentType,
        status: 'completed',
        is_public: 'all',
        limit: 20,
        offset,
        sort: 'recent',
        liked,
      });

      if (refresh) {
        setUserContent(response.content);
        setContentOffset(20);
      } else {
        setUserContent(prev => [...prev, ...response.content]);
        setContentOffset(prev => prev + 20);
      }

      setHasMoreContent(response.pagination.hasMore);

    } catch (error: any) {
      console.error('Error loading user content:', error);
      setError('Failed to load content');
    } finally {
      setIsLoadingContent(false);
    }
  }, [selectedContentTab, contentOffset]);

  // Load more content for pagination
  const loadMoreContent = useCallback(async () => {
    if (!hasMoreContent || isLoadingContent) return;
    await loadUserContent(selectedContentTab, false);
  }, [hasMoreContent, isLoadingContent, loadUserContent, selectedContentTab]);

  // Update user settings
  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    try {
      setError(null);
      
      const updatedSettings = await profileService.updateUserSettings(newSettings);
      setSettings(updatedSettings);
      
    } catch (error: any) {
      console.error('Error updating settings:', error);
      setError('Failed to update settings');
      Alert.alert('Error', 'Failed to update settings. Please try again.');
    }
  }, []);

  // Share content
  const shareContent = useCallback(async (contentId: string) => {
    try {
      setError(null);
      
      const result = await profileService.shareContent(contentId);
      
      // Update the content in the list to reflect new share count
      setUserContent(prev => prev.map(content => 
        content.id === contentId 
          ? { ...content, shares_count: result.shareCount }
          : content
      ));
      
      Alert.alert('Success', 'Content shared successfully!');
      
    } catch (error: any) {
      console.error('Error sharing content:', error);
      setError('Failed to share content');
      Alert.alert('Error', 'Failed to share content. Please try again.');
    }
  }, []);

  // Delete content
  const deleteContent = useCallback(async (contentId: string) => {
    try {
      setError(null);
      
      await profileService.deleteContent(contentId);
      
      // Remove the content from the list
      setUserContent(prev => prev.filter(content => content.id !== contentId));
      
      Alert.alert('Success', 'Content deleted successfully!');
      
    } catch (error: any) {
      console.error('Error deleting content:', error);
      setError('Failed to delete content');
      Alert.alert('Error', 'Failed to delete content. Please try again.');
    }
  }, []);

  // Purchase credits
  const purchaseCredits = useCallback(async (
    packageId: string, 
    receiptData: string, 
    platform: 'ios' | 'android', 
    transactionId: string
  ) => {
    try {
      setError(null);
      
      const result = await profileService.purchaseCredits({
        package_id: packageId,
        receipt_data: receiptData,
        platform,
        transaction_id: transactionId,
      });
      
      // Refresh profile to update credit balance
      await refreshProfile();
      
      Alert.alert(
        'Purchase Successful', 
        `${result.creditsPurchased} credits added to your account!`
      );
      
    } catch (error: any) {
      console.error('Error purchasing credits:', error);
      setError('Failed to purchase credits');
      Alert.alert('Purchase Failed', 'Failed to purchase credits. Please try again.');
    }
  }, [refreshProfile]);

  // Manage subscription
  const manageSubscription = useCallback(async (
    action: 'subscribe' | 'upgrade' | 'downgrade' | 'cancel' | 'reactivate',
    planId?: string
  ) => {
    try {
      setError(null);
      
      const result = await profileService.manageSubscription({
        action,
        plan_id: planId,
      });
      
      // Update subscription status
      setSubscriptionStatus(result.subscription);
      
      // Refresh profile to update subscription status
      await refreshProfile();
      
      let message = '';
      switch (action) {
        case 'subscribe':
          message = `Successfully subscribed to ${planId} plan!`;
          break;
        case 'upgrade':
          message = `Successfully upgraded to ${planId} plan!`;
          break;
        case 'downgrade':
          message = `Successfully downgraded to ${planId} plan!`;
          break;
        case 'cancel':
          message = 'Subscription cancelled. It will remain active until the end of your billing period.';
          break;
        case 'reactivate':
          message = 'Subscription reactivated successfully!';
          break;
      }
      
      Alert.alert('Success', message);
      
    } catch (error: any) {
      console.error('Error managing subscription:', error);
      setError('Failed to manage subscription');
      Alert.alert('Error', 'Failed to manage subscription. Please try again.');
    }
  }, [refreshProfile]);

  // Load initial data when component mounts
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  // Load content when tab changes
  useEffect(() => {
    if (user) {
      setUserContent([]);
      setContentOffset(0);
      setHasMoreContent(true);
      loadUserContent(selectedContentTab, true);
    }
  }, [selectedContentTab, user]);

  return {
    // User data
    stats,
    achievements,
    userContent,
    settings,
    
    // Subscription data
    subscriptionPlans,
    subscriptionStatus,
    
    // Credit data
    creditHistory,
    
    // Content management
    selectedContentTab,
    setSelectedContentTab,
    
    // Actions
    loadUserData,
    loadUserContent,
    updateSettings,
    shareContent,
    deleteContent,
    purchaseCredits,
    manageSubscription,
    
    // State
    isLoading,
    isLoadingContent,
    error,
    
    // Pagination
    hasMoreContent,
    loadMoreContent,
  };
}