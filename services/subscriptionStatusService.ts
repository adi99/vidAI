import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Conditionally import expo-iap only on native platforms
let getAvailablePurchases: any = null;

if (Platform.OS !== 'web') {
  try {
    const expoIAP = require('expo-iap');
    getAvailablePurchases = expoIAP.getAvailablePurchases;
  } catch (error) {
    console.warn('expo-iap not available:', error);
  }
}

export interface SubscriptionStatusDetails {
  isActive: boolean;
  planId?: string;
  planName?: string;
  expirationDate?: Date;
  autoRenewing?: boolean;
  inGracePeriod?: boolean;
  creditsRemaining?: number;
  nextBillingDate?: Date;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  totalCredits?: number;
  lastValidated?: Date;
  validationSource?: 'server' | 'local' | 'store';
}

export interface CreditAllowance {
  monthlyCredits: number;
  creditsUsedThisPeriod: number;
  creditsRemainingThisPeriod: number;
  periodStart: Date;
  periodEnd: Date;
  nextAllowanceDate: Date;
}

export interface SubscriptionValidationResult {
  isValid: boolean;
  status: SubscriptionStatusDetails;
  needsRenewal?: boolean;
  gracePeriodEnds?: Date;
  error?: string;
}

export class SubscriptionStatusService {
  private static instance: SubscriptionStatusService;
  private statusCache: SubscriptionStatusDetails | null = null;
  private lastCacheUpdate: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SubscriptionStatusService {
    if (!SubscriptionStatusService.instance) {
      SubscriptionStatusService.instance = new SubscriptionStatusService();
    }
    return SubscriptionStatusService.instance;
  }

  /**
   * Get comprehensive subscription status with validation
   */
  async getSubscriptionStatus(forceRefresh = false): Promise<SubscriptionStatusDetails> {
    // Return cached status if still valid
    if (!forceRefresh && this.isCacheValid()) {
      return this.statusCache!;
    }

    try {
      // Get status from server
      const serverStatus = await this.getServerSubscriptionStatus();
      
      // Validate with store if on native platform
      let validatedStatus = serverStatus;
      if (Platform.OS !== 'web' && serverStatus.isActive) {
        validatedStatus = await this.validateWithStore(serverStatus);
      }

      // Update cache
      this.statusCache = {
        ...validatedStatus,
        lastValidated: new Date(),
        validationSource: Platform.OS === 'web' ? 'server' : 'store',
      };
      this.lastCacheUpdate = new Date();

      return this.statusCache;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      
      // Return cached status if available, otherwise return inactive status
      return this.statusCache || {
        isActive: false,
        status: 'inactive',
        totalCredits: 0,
        lastValidated: new Date(),
        validationSource: 'local',
      };
    }
  }

  /**
   * Get subscription status from server
   */
  private async getServerSubscriptionStatus(): Promise<SubscriptionStatusDetails> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { isActive: false, status: 'inactive', totalCredits: 0 };
    }

    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/subscription/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription status from server');
    }

    const result = await response.json();
    
    return {
      isActive: result.isActive || false,
      planId: result.planId,
      planName: result.planName,
      expirationDate: result.expirationDate ? new Date(result.expirationDate) : undefined,
      autoRenewing: result.autoRenewing,
      inGracePeriod: result.inGracePeriod,
      creditsRemaining: result.creditsRemaining,
      nextBillingDate: result.nextBillingDate ? new Date(result.nextBillingDate) : undefined,
      status: result.status,
      cancelAtPeriodEnd: result.cancelAtPeriodEnd,
      totalCredits: result.totalCredits,
    };
  }

  /**
   * Validate subscription status with app store
   */
  private async validateWithStore(serverStatus: SubscriptionStatusDetails): Promise<SubscriptionStatusDetails> {
    if (!getAvailablePurchases || !serverStatus.planId) {
      return serverStatus;
    }

    try {
      // Get available purchases from store
      const purchases = await getAvailablePurchases([serverStatus.planId]);
      
      if (!purchases || purchases.length === 0) {
        // No purchases found in store - subscription might be expired or cancelled
        return {
          ...serverStatus,
          isActive: false,
          status: 'expired',
          inGracePeriod: false,
        };
      }

      // Find matching subscription purchase
      const subscriptionPurchase = purchases.find((purchase: any) => 
        purchase.productId === serverStatus.planId
      );

      if (!subscriptionPurchase) {
        return serverStatus;
      }

      // Validate subscription based on platform
      const storeValidation = this.validateStorePurchase(subscriptionPurchase);
      
      return {
        ...serverStatus,
        isActive: storeValidation.isActive,
        autoRenewing: storeValidation.autoRenewing,
        inGracePeriod: storeValidation.inGracePeriod,
        expirationDate: storeValidation.expirationDate,
      };
    } catch (error) {
      console.error('Store validation failed:', error);
      // Return server status if store validation fails
      return serverStatus;
    }
  }

  /**
   * Validate individual store purchase
   */
  private validateStorePurchase(purchase: any): {
    isActive: boolean;
    autoRenewing?: boolean;
    inGracePeriod?: boolean;
    expirationDate?: Date;
  } {
    const currentTime = Date.now();
    
    if (Platform.OS === 'ios') {
      // iOS validation
      if (purchase.expirationDateIos) {
        const expirationDate = new Date(purchase.expirationDateIos);
        const isActive = expirationDate.getTime() > currentTime;
        
        // Check for grace period (typically 16 days after expiration)
        const gracePeriodEnd = new Date(expirationDate.getTime() + (16 * 24 * 60 * 60 * 1000));
        const inGracePeriod = !isActive && gracePeriodEnd.getTime() > currentTime;
        
        return {
          isActive: isActive || inGracePeriod,
          autoRenewing: !purchase.isInBillingRetryPeriod,
          inGracePeriod,
          expirationDate,
        };
      }
      
      // Fallback for sandbox environment
      if (purchase.environmentIos === 'Sandbox') {
        const dayInMs = 24 * 60 * 60 * 1000;
        const isRecent = purchase.transactionDate && (currentTime - purchase.transactionDate) < dayInMs;
        return {
          isActive: !!isRecent,
          autoRenewing: true,
          inGracePeriod: false,
        };
      }
    } else if (Platform.OS === 'android') {
      // Android validation
      if (purchase.autoRenewingAndroid !== undefined) {
        return {
          isActive: purchase.autoRenewingAndroid,
          autoRenewing: purchase.autoRenewingAndroid,
          inGracePeriod: false, // Android doesn't provide grace period info directly
        };
      }
      
      // Fallback: Check if purchase is recent
      const monthInMs = 30 * 24 * 60 * 60 * 1000;
      const isRecent = purchase.transactionDate && (currentTime - purchase.transactionDate) < monthInMs;
      return {
        isActive: !!isRecent,
        autoRenewing: true,
        inGracePeriod: false,
      };
    }
    
    return {
      isActive: false,
      autoRenewing: false,
      inGracePeriod: false,
    };
  }

  /**
   * Get monthly credit allowance details
   */
  async getCreditAllowance(): Promise<CreditAllowance | null> {
    const status = await this.getSubscriptionStatus();
    
    if (!status.isActive || !status.planId) {
      return null;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/subscription/usage`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch credit allowance');
      }

      const result = await response.json();
      const usage = result.usage;

      // Calculate monthly credits based on plan
      const monthlyCredits = this.getMonthlyCreditsForPlan(status.planId);
      
      return {
        monthlyCredits,
        creditsUsedThisPeriod: monthlyCredits - (usage.creditsRemaining || 0),
        creditsRemainingThisPeriod: usage.creditsRemaining || 0,
        periodStart: new Date(usage.currentPeriod.start),
        periodEnd: new Date(usage.currentPeriod.end),
        nextAllowanceDate: new Date(usage.currentPeriod.end),
      };
    } catch (error) {
      console.error('Error getting credit allowance:', error);
      return null;
    }
  }

  /**
   * Validate subscription and handle expiration
   */
  async validateAndHandleExpiration(): Promise<SubscriptionValidationResult> {
    try {
      const status = await this.getSubscriptionStatus(true); // Force refresh
      
      if (!status.isActive) {
        return {
          isValid: false,
          status,
          error: 'Subscription is not active',
        };
      }

      // Check if subscription is expired
      if (status.expirationDate && status.expirationDate < new Date()) {
        if (status.inGracePeriod) {
          return {
            isValid: true,
            status,
            needsRenewal: true,
            gracePeriodEnds: status.expirationDate,
          };
        } else {
          // Handle expiration
          await this.handleSubscriptionExpiration(status);
          return {
            isValid: false,
            status: { ...status, isActive: false, status: 'expired' },
            error: 'Subscription has expired',
          };
        }
      }

      return {
        isValid: true,
        status,
      };
    } catch (error) {
      console.error('Subscription validation failed:', error);
      return {
        isValid: false,
        status: { isActive: false, status: 'error', totalCredits: 0 },
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Handle subscription expiration
   */
  private async handleSubscriptionExpiration(status: SubscriptionStatusDetails): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Notify server about expiration
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/subscription/manage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'expire',
          plan_id: status.planId,
        }),
      });

      // Clear cache to force refresh
      this.clearCache();
    } catch (error) {
      console.error('Error handling subscription expiration:', error);
    }
  }

  /**
   * Get monthly credits for a plan
   */
  private getMonthlyCreditsForPlan(planId: string): number {
    const planCredits: { [key: string]: number } = {
      'premium_monthly': 1000,
      'premium_yearly': 1250, // 15000 / 12
      'pro_monthly': 2500,
      'pro_yearly': 2917, // 35000 / 12
    };
    
    return planCredits[planId] || 0;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.statusCache || !this.lastCacheUpdate) {
      return false;
    }
    
    const now = new Date();
    const cacheAge = now.getTime() - this.lastCacheUpdate.getTime();
    return cacheAge < this.CACHE_DURATION;
  }

  /**
   * Clear status cache
   */
  clearCache(): void {
    this.statusCache = null;
    this.lastCacheUpdate = null;
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    const status = await this.getSubscriptionStatus();
    return status.isActive;
  }

  /**
   * Get subscription tier (free, premium, pro)
   */
  async getSubscriptionTier(): Promise<'free' | 'premium' | 'pro'> {
    const status = await this.getSubscriptionStatus();
    
    if (!status.isActive || !status.planId) {
      return 'free';
    }
    
    if (status.planId.includes('pro')) {
      return 'pro';
    } else if (status.planId.includes('premium')) {
      return 'premium';
    }
    
    return 'free';
  }

  /**
   * Check if user can access premium features
   */
  async canAccessPremiumFeatures(): Promise<boolean> {
    const tier = await this.getSubscriptionTier();
    return tier === 'premium' || tier === 'pro';
  }

  /**
   * Check if user can access pro features
   */
  async canAccessProFeatures(): Promise<boolean> {
    const tier = await this.getSubscriptionTier();
    return tier === 'pro';
  }
}

// Export singleton instance
export const subscriptionStatusService = SubscriptionStatusService.getInstance();