import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Conditionally import expo-iap only on native platforms
let getSubscriptions: any = null;
let requestPurchase: any = null;
let deepLinkToSubscriptions: any = null;

if (Platform.OS !== 'web') {
  try {
    const expoIAP = require('expo-iap');
    getSubscriptions = expoIAP.getSubscriptions;
    requestPurchase = expoIAP.requestPurchase;
    deepLinkToSubscriptions = expoIAP.deepLinkToSubscriptions;
  } catch (error) {
    console.warn('expo-iap not available:', error);
  }
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  priceUsd: number;
  period: 'monthly' | 'yearly';
  credits: number;
  features: string[];
  popular?: boolean;
  savings?: string;
}

export interface SubscriptionStatus {
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

export interface SubscriptionPurchaseResult {
  success: boolean;
  transactionId?: string;
  planId?: string;
  error?: string;
}

// Subscription plan definitions
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    description: 'Perfect for regular creators',
    price: '$9.99',
    priceUsd: 9.99,
    period: 'monthly',
    credits: 1000,
    features: [
      '1,000 credits per month',
      'Priority generation queue',
      'Advanced AI models',
      'HD video generation',
      'Custom model training',
      'No watermarks',
    ],
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    description: 'Best value for power users',
    price: '$99.99',
    priceUsd: 99.99,
    period: 'yearly',
    credits: 15000,
    features: [
      '15,000 credits per year',
      'Priority generation queue',
      'Advanced AI models',
      'HD video generation',
      'Custom model training',
      'No watermarks',
      'Early access to new features',
    ],
    popular: true,
    savings: 'Save 17% vs monthly',
  },
  {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    description: 'For professional creators',
    price: '$19.99',
    priceUsd: 19.99,
    period: 'monthly',
    credits: 2500,
    features: [
      '2,500 credits per month',
      'Highest priority queue',
      'All AI models',
      '4K video generation',
      'Unlimited model training',
      'No watermarks',
      'Commercial license',
      'Priority support',
    ],
  },
  {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    description: 'Ultimate package for professionals',
    price: '$199.99',
    priceUsd: 199.99,
    period: 'yearly',
    credits: 35000,
    features: [
      '35,000 credits per year',
      'Highest priority queue',
      'All AI models',
      '4K video generation',
      'Unlimited model training',
      'No watermarks',
      'Commercial license',
      'Priority support',
      'API access',
    ],
    savings: 'Save 17% vs monthly',
  },
];

export class SubscriptionService {
  private static instance: SubscriptionService;

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Get available subscription plans with current pricing
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    if (Platform.OS === 'web') {
      return SUBSCRIPTION_PLANS;
    }

    try {
      if (!getSubscriptions) {
        return SUBSCRIPTION_PLANS;
      }

      // Fetch subscription products from the store
      const productIds = SUBSCRIPTION_PLANS.map(plan => plan.id);
      const products = await getSubscriptions({ skus: productIds });

      // Update plans with real pricing from the store
      return SUBSCRIPTION_PLANS.map(plan => {
        const product = products.find((p: any) => p.productId === plan.id);
        return {
          ...plan,
          price: product?.localizedPrice || plan.price,
          priceUsd: product?.price || plan.priceUsd,
        };
      });
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      return SUBSCRIPTION_PLANS;
    }
  }

  /**
   * Purchase a subscription plan
   */
  async purchaseSubscription(planId: string): Promise<SubscriptionPurchaseResult> {
    if (Platform.OS === 'web') {
      return {
        success: false,
        error: 'Subscriptions are not available on web',
      };
    }

    if (!requestPurchase) {
      return {
        success: false,
        error: 'In-app purchases not available',
      };
    }

    try {
      // Request subscription purchase with platform-specific parameters
      await requestPurchase({
        request: {
          ios: {
            sku: planId,
            andDangerouslyFinishTransactionAutomaticallyIOS: false,
          },
          android: {
            skus: [planId],
          },
        },
        type: 'subs',
      });

      // The actual result will be handled by the purchase update listener
      return {
        success: true,
        planId,
        transactionId: 'pending', // Will be updated in callback
      };
    } catch (error: any) {
      console.error('Subscription purchase failed:', error);
      return {
        success: false,
        error: error.message || 'Subscription purchase failed',
      };
    }
  }

  /**
   * Check current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { isActive: false };
      }

      // Get subscription status from backend
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/subscription/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
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
        };
      }

      return { isActive: false };
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      return { isActive: false };
    }
  }

  /**
   * Open platform-specific subscription management
   */
  async openSubscriptionManagement(): Promise<void> {
    if (Platform.OS === 'web') {
      // On web, redirect to account settings or show message
      console.log('Subscription management not available on web');
      return;
    }

    try {
      if (deepLinkToSubscriptions) {
        deepLinkToSubscriptions();
      } else {
        console.warn('Subscription management not available');
      }
    } catch (error) {
      console.error('Error opening subscription management:', error);
    }
  }

  /**
   * Validate subscription with backend
   */
  async validateSubscription(purchase: any): Promise<{
    success: boolean;
    subscription?: any;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return {
          success: false,
          error: 'User not authenticated',
        };
      }

      // Prepare platform-specific receipt data
      let receiptData: string;
      let planId: string;

      if (Platform.OS === 'ios') {
        receiptData = purchase.transactionReceipt;
        planId = purchase.productId || purchase.id;
      } else if (Platform.OS === 'android') {
        const androidPurchase = purchase as any;
        receiptData = JSON.stringify({
          purchaseToken: androidPurchase.purchaseTokenAndroid,
          packageName: androidPurchase.packageNameAndroid || 'com.yourapp.package',
          originalJson: androidPurchase.originalJson,
          signature: androidPurchase.signature,
        });
        planId = androidPurchase.ids?.[0] || androidPurchase.productId;
      } else {
        return {
          success: false,
          error: 'Platform not supported',
        };
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/subscription/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transaction_id: purchase.transactionId,
          plan_id: planId,
          platform: Platform.OS,
          receipt_data: receiptData,
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        return {
          success: true,
          subscription: result.subscription,
        };
      } else {
        return {
          success: false,
          error: result.message || 'Validation failed',
        };
      }
    } catch (error) {
      console.error('Subscription validation failed:', error);
      return {
        success: false,
        error: 'Network error during validation',
      };
    }
  }

  /**
   * Get plan by ID
   */
  getPlanById(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
  }

  /**
   * Format subscription period
   */
  formatPeriod(period: 'monthly' | 'yearly'): string {
    return period === 'monthly' ? 'month' : 'year';
  }

  /**
   * Calculate savings for yearly plans
   */
  calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): string {
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - yearlyPrice;
    const percentage = Math.round((savings / monthlyCost) * 100);
    return `Save ${percentage}% vs monthly`;
  }

  /**
   * Check if user can make subscription purchases
   */
  canMakeSubscriptionPurchases(): boolean {
    return Platform.OS !== 'web' && !!requestPurchase;
  }
}

// Export singleton instance
export const subscriptionService = SubscriptionService.getInstance();