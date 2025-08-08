import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Conditionally import expo-iap types only on native platforms
let Purchase: any = null;
let Product: any = null;

if (Platform.OS !== 'web') {
  try {
    const expoIAP = require('expo-iap');
    Purchase = expoIAP.Purchase;
    Product = expoIAP.Product;
  } catch (error) {
    console.warn('expo-iap not available:', error);
  }
}

export interface CreditPackage {
  id: string;
  credits: number;
  price: string;
  priceUsd: number;
  title: string;
  description: string;
  popular?: boolean;
  bonus?: number;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  credits?: number;
  error?: string;
}

export class IAPService {
  private static instance: IAPService;
  private isInitialized = false;
  private products: any[] = [];

  // Credit package definitions
  static readonly CREDIT_PACKAGES: CreditPackage[] = [
    {
      id: 'credits_100',
      credits: 100,
      price: '$4.99',
      priceUsd: 4.99,
      title: '100 Credits',
      description: 'Perfect for trying out features',
    },
    {
      id: 'credits_500',
      credits: 500,
      price: '$19.99',
      priceUsd: 19.99,
      title: '500 Credits',
      description: 'Great for regular creators',
      bonus: 50,
    },
    {
      id: 'credits_1000',
      credits: 1000,
      price: '$34.99',
      priceUsd: 34.99,
      title: '1,000 Credits',
      description: 'Best value for power users',
      popular: true,
      bonus: 200,
    },
    {
      id: 'credits_2500',
      credits: 2500,
      price: '$79.99',
      priceUsd: 79.99,
      title: '2,500 Credits',
      description: 'Ultimate package for professionals',
      bonus: 750,
    },
  ];

  static getInstance(): IAPService {
    if (!IAPService.instance) {
      IAPService.instance = new IAPService();
    }
    return IAPService.instance;
  }

  /**
   * Initialize the IAP service
   * Note: This is now handled by the useIAP hook, so this method is deprecated
   */
  async initialize(): Promise<boolean> {
    console.warn('IAPService.initialize() is deprecated. Use useIAP hook instead.');
    this.isInitialized = true;
    return true;
  }

  /**
   * Get available credit packages with current pricing
   */
  async getCreditPackages(): Promise<CreditPackage[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return IAPService.CREDIT_PACKAGES.map(pkg => {
      const product = this.products.find(p => p.id === pkg.id);
      return {
        ...pkg,
        price: product?.displayPrice || pkg.price,
        priceUsd: product?.price || pkg.priceUsd,
      };
    });
  }

  /**
   * Purchase credits
   * Note: This method is deprecated. Use the useIAP hook instead.
   */
  async purchaseCredits(packageId: string): Promise<PurchaseResult> {
    console.warn('IAPService.purchaseCredits() is deprecated. Use useIAP hook instead.');
    return {
      success: false,
      error: 'This method is deprecated. Use useIAP hook instead.',
    };
  }

  /**
   * Restore previous purchases
   * Note: This method is deprecated. Use the useIAP hook instead.
   */
  async restorePurchases(): Promise<{ success: boolean; restoredCount: number; error?: string }> {
    console.warn('IAPService.restorePurchases() is deprecated. Use useIAP hook instead.');
    return {
      success: false,
      restoredCount: 0,
      error: 'This method is deprecated. Use useIAP hook instead.',
    };
  }

  /**
   * Verify purchase with backend
   */
  private async verifyPurchaseWithBackend(purchase: any): Promise<{
    success: boolean;
    credits?: number;
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

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/user/credits/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transaction_id: purchase.transactionId,
          package_id: Platform.OS === 'android' ? (purchase as any).ids?.[0] : purchase.id,
          platform: Platform.OS,
          receipt_data: purchase.transactionReceipt,
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        return {
          success: true,
          credits: result.purchase.creditsPurchased,
        };
      } else {
        return {
          success: false,
          error: result.message || 'Verification failed',
        };
      }
    } catch (error) {
      console.error('Backend verification failed:', error);
      return {
        success: false,
        error: 'Network error during verification',
      };
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (error?.code) {
      switch (error.code) {
        case 'E_USER_CANCELLED':
          return 'Purchase cancelled by user';
        case 'E_PAYMENT_INVALID':
          return 'Invalid payment';
        case 'E_ITEM_UNAVAILABLE':
          return 'Product not available';
        case 'E_NETWORK_ERROR':
          return 'Network error';
        case 'E_SERVICE_ERROR':
          return 'Service unavailable';
        default:
          return error.message || 'Purchase failed';
      }
    }
    return 'Purchase failed';
  }

  /**
   * Check if user can make payments
   */
  async canMakePayments(): Promise<boolean> {
    try {
      // expo-iap doesn't have a direct equivalent, so we'll assume true if initialized
      return this.isInitialized;
    } catch (error) {
      console.error('Error checking payment capability:', error);
      return false;
    }
  }

  /**
   * Get purchase history from backend
   */
  async getPurchaseHistory(): Promise<any[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return [];
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/user/credits/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result.transactions || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching purchase history:', error);
      return [];
    }
  }

  /**
   * Disconnect from store
   * Note: This is now handled automatically by the useIAP hook
   */
  async disconnect(): Promise<void> {
    console.warn('IAPService.disconnect() is deprecated. Connection is handled by useIAP hook.');
    this.isInitialized = false;
    this.products = [];
  }
}

// Export singleton instance
export const iapService = IAPService.getInstance();